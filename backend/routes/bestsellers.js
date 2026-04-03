import { Router } from 'express'

const router = Router()

// GET /api/bestsellers?period=30&sort=volume&limit=10
router.get('/bestsellers', async (req, res) => {
  const period = parseInt(req.query.period) || 30
  const sort = req.query.sort || 'volume'
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10))
  const db = req.app.locals.db

  try {
    const now = new Date()
    const periodStart = new Date(now - period * 24 * 60 * 60 * 1000)
    const prevPeriodStart = new Date(now - period * 2 * 24 * 60 * 60 * 1000)

    // Build the base aggregation pipeline
    function buildPipeline(startDate, endDate) {
      return [
        { $match: {
          warehouseCode: 'US',
          transactionType: 'Invoice',
          createdAt: { $gte: startDate, $lt: endDate },
          'adjustmentDetails.items.itemNumber': { $ne: 'FABRIC' }
        }},
        { $unwind: '$adjustmentDetails.items' },
        { $match: { 'adjustmentDetails.items.itemNumber': { $ne: 'FABRIC' } } },
        { $group: {
          _id: {
            itemNumber: '$adjustmentDetails.items.itemNumber',
            colorCode: '$adjustmentDetails.items.colorCode'
          },
          totalQtyShipped: { $sum: '$adjustmentDetails.items.quantity' },
          shipmentCount: { $sum: 1 },
          lastShipped: { $max: '$createdAt' }
        }}
      ]
    }

    // Current period
    const currentPipeline = buildPipeline(periodStart, now)

    // Sort based on mode
    if (sort === 'frequency') {
      currentPipeline.push({ $sort: { shipmentCount: -1 } })
    } else {
      currentPipeline.push({ $sort: { totalQtyShipped: -1 } })
    }

    // For trending, we need all results to compare; for others, limit early
    if (sort !== 'trending') {
      currentPipeline.push({ $limit: limit })
    }

    // Lookup inventory for stock + description
    currentPipeline.push(
      { $lookup: {
        from: 'locationInventory',
        let: { style: '$_id.itemNumber', color: '$_id.colorCode' },
        pipeline: [
          { $unwind: '$items' },
          { $match: { $expr: { $and: [
            { $eq: ['$items.itemNumber', '$$style'] },
            { $eq: ['$items.colorCode', '$$color'] }
          ]}}},
          { $group: {
            _id: null,
            description: { $first: '$items.description' },
            currentStock: { $sum: '$items.itemQuantity' },
            locationCount: { $sum: 1 }
          }}
        ],
        as: 'inventory'
      }},
      { $unwind: { path: '$inventory', preserveNullAndEmptyArrays: true } }
    )

    const currentResults = await db.collection('adjustments').aggregate(currentPipeline).toArray()

    // Previous period (for trend calculation)
    const prevPipeline = buildPipeline(prevPeriodStart, periodStart)
    const prevResults = await db.collection('adjustments').aggregate(prevPipeline).toArray()

    // Build previous period lookup map
    const prevMap = {}
    for (const p of prevResults) {
      prevMap[`${p._id.itemNumber}|${p._id.colorCode}`] = p
    }

    // Extract name from description (first word before " - ")
    function extractName(description) {
      if (!description) return ''
      const dashIndex = description.indexOf(' - ')
      if (dashIndex > 0) return description.substring(0, dashIndex).trim()
      // Fallback: first word
      return description.split(' ')[0] || ''
    }

    // Build final data with trend info
    let data = currentResults.map(r => {
      const key = `${r._id.itemNumber}|${r._id.colorCode}`
      const prev = prevMap[key]
      let percentChange = null
      let isNew = false

      if (prev) {
        const prevQty = sort === 'frequency' ? prev.shipmentCount : prev.totalQtyShipped
        const currQty = sort === 'frequency' ? r.shipmentCount : r.totalQtyShipped
        percentChange = prevQty > 0 ? Math.round(((currQty - prevQty) / prevQty) * 100) : null
      } else {
        isNew = true
      }

      return {
        itemNumber: r._id.itemNumber,
        colorCode: r._id.colorCode,
        name: extractName(r.inventory?.description),
        totalQtyShipped: r.totalQtyShipped,
        shipmentCount: r.shipmentCount,
        lastShipped: r.lastShipped,
        currentStock: r.inventory?.currentStock || 0,
        locationCount: r.inventory?.locationCount || 0,
        percentChange,
        isNew
      }
    })

    // For trending sort, sort by percentChange descending (new items last)
    if (sort === 'trending') {
      data.sort((a, b) => {
        // New items go after items with real % change
        if (a.isNew && !b.isNew) return 1
        if (!a.isNew && b.isNew) return -1
        if (a.isNew && b.isNew) return b.totalQtyShipped - a.totalQtyShipped
        return (b.percentChange || 0) - (a.percentChange || 0)
      })
      data = data.slice(0, limit)
    }

    // Add rank
    data = data.map((d, i) => ({ rank: i + 1, ...d }))

    res.json({ data, period, sort })
  } catch (err) {
    console.error('Bestsellers aggregation error:', err)
    res.status(500).json({ error: 'Failed to fetch bestsellers data' })
  }
})

export default router
