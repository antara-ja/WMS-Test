import { Router } from 'express'

const router = Router()

const US_VALID_AISLES = ['B','C','D','E','F','G','H','I','J','K','L','M','N','O','Q']
const US_MAX_BIN = 20

const EU_VALID_AISLES = ['C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X']
const EU_MAX_BIN = 86

// GET /api/inventory/heatmap?view=count|avg|empty|picks&warehouse=US|EU
router.get('/inventory/heatmap', async (req, res) => {
  const view = req.query.view || 'count'
  const warehouse = req.query.warehouse === 'EU' ? 'EU' : 'US'
  const db = req.app.locals.db

  const VALID_AISLES = warehouse === 'EU' ? EU_VALID_AISLES : US_VALID_AISLES
  const MAX_BIN = warehouse === 'EU' ? EU_MAX_BIN : US_MAX_BIN

  try {
    const basePipeline = [
      { $match: { warehouseCode: warehouse } },
      { $project: {
        parts: { $split: ['$locationLookupCode', '-'] },
        totalItems: { $sum: '$items.itemQuantity' },
        itemCount: { $size: '$items' },
        hasItems: { $gt: [{ $size: '$items' }, 0] }
      }},
      { $match: { $expr: { $and: [
        { $gte: [{ $size: '$parts' }, 3] },
        { $regexMatch: { input: { $arrayElemAt: ['$parts', 1] }, regex: /^\d+$/ } }
      ]}}},
      { $project: {
        aisle: { $arrayElemAt: ['$parts', 0] },
        level: { $arrayElemAt: ['$parts', 1] },
        bin: { $arrayElemAt: ['$parts', 2] },
        totalItems: 1,
        itemCount: 1,
        hasItems: 1
      }},
      { $match: { aisle: { $in: VALID_AISLES } } },
      { $match: { $expr: { $lte: [{ $toInt: '$bin' }, MAX_BIN] } } },
      { $group: {
        _id: { aisle: '$aisle', level: '$level' },
        totalQuantity: { $sum: '$totalItems' },
        totalSKUs: { $sum: '$itemCount' },
        binCount: { $sum: 1 },
        occupiedBins: { $sum: { $cond: ['$hasItems', 1, 0] } },
        emptyBins: { $sum: { $cond: ['$hasItems', 0, 1] } }
      }},
      { $sort: { '_id.aisle': 1, '_id.level': 1 } }
    ]

    const raw = await db.collection('locationInventory').aggregate(basePipeline).toArray()

    const data = raw.map(r => {
      let value
      switch (view) {
        case 'avg':
          value = r.binCount > 0 ? Math.round(r.totalQuantity / r.binCount) : 0
          break
        case 'empty':
          value = r.emptyBins
          break
        default:
          value = r.totalQuantity
      }
      return {
        aisle: r._id.aisle,
        level: r._id.level,
        value,
        totalQuantity: r.totalQuantity,
        binCount: r.binCount,
        occupiedBins: r.occupiedBins,
        emptyBins: r.emptyBins
      }
    })

    // Pick frequency view (US only)
    if (view === 'picks' && warehouse === 'US') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const picks = await db.collection('adjustments').aggregate([
        { $match: {
          warehouseCode: 'US',
          adjustmentType: 'Transfer',
          createdAt: { $gte: sevenDaysAgo }
        }},
        { $project: {
          parts: { $split: ['$sourceLocationCode', '-'] }
        }},
        { $match: { $expr: { $gte: [{ $size: '$parts' }, 3] } } },
        { $project: {
          aisle: { $arrayElemAt: ['$parts', 0] },
          level: { $arrayElemAt: ['$parts', 1] }
        }},
        { $match: {
          aisle: { $in: US_VALID_AISLES },
          level: { $regex: /^\d+$/ }
        }},
        { $group: {
          _id: { aisle: '$aisle', level: '$level' },
          pickCount: { $sum: 1 }
        }}
      ]).toArray()

      const pickMap = {}
      for (const p of picks) {
        pickMap[`${p._id.aisle}-${p._id.level}`] = p.pickCount
      }

      for (const d of data) {
        d.value = pickMap[`${d.aisle}-${d.level}`] || 0
      }
    }

    const total = data.reduce((s, d) => s + d.totalQuantity, 0)

    if (warehouse === 'EU') {
      const emptyLocations = data.reduce((s, d) => s + d.emptyBins, 0)
      res.json({ data, stats: { total, emptyLocations } })
    } else {
      const lvl01and02 = data
        .filter(d => d.level === '01' || d.level === '02')
        .reduce((s, d) => s + d.totalQuantity, 0)
      const lvlUp = total - lvl01and02
      const emptyLocations = data
        .filter(d => d.level === '01' || d.level === '02')
        .reduce((s, d) => s + d.emptyBins, 0)
      res.json({ data, stats: { total, lvl01: lvl01and02, lvlUp, emptyLocations } })
    }
  } catch (err) {
    console.error('Heatmap aggregation error:', err)
    res.status(500).json({ error: 'Failed to fetch heatmap data' })
  }
})

// GET /api/inventory/detail/:aisle/:level?warehouse=US|EU
router.get('/inventory/detail/:aisle/:level', async (req, res) => {
  const { aisle, level } = req.params
  const warehouse = req.query.warehouse === 'EU' ? 'EU' : 'US'
  const db = req.app.locals.db

  // US: bins 001-020; EU: any numeric bin
  const binPattern = warehouse === 'EU'
    ? new RegExp(`^${aisle}-${level}-\\d+$`)
    : new RegExp(`^${aisle}-${level}-(0[01][0-9]|020)$`)

  try {
    const result = await db.collection('locationInventory').aggregate([
      { $match: {
        warehouseCode: warehouse,
        locationLookupCode: { $regex: binPattern }
      }},
      { $project: {
        locationLookupCode: 1,
        items: {
          $map: {
            input: '$items',
            as: 'item',
            in: {
              itemNumber: '$$item.itemNumber',
              colorCode: '$$item.colorCode',
              description: '$$item.description',
              quantity: '$$item.itemQuantity',
              sizes: '$$item.sizes',
              lastTransaction: '$$item.lastTransactionDate',
              customer: { $arrayElemAt: ['$$item.details.customer', 0] }
            }
          }
        },
        totalQty: { $sum: '$items.itemQuantity' }
      }},
      { $sort: { locationLookupCode: 1 } }
    ]).toArray()

    res.json(result)
  } catch (err) {
    console.error('Detail aggregation error:', err)
    res.status(500).json({ error: 'Failed to fetch detail data' })
  }
})

export default router
