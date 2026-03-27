import { Router } from 'express'

const router = Router()

// GET /api/adjustments/timeline?days=30
router.get('/adjustments/timeline', async (req, res) => {
  const days = parseInt(req.query.days) || 30
  const db = req.app.locals.db

  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const raw = await db.collection('adjustments').aggregate([
      { $match: {
        warehouseCode: 'US',
        createdAt: { $gte: startDate }
      }},
      { $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          type: '$adjustmentType'
        },
        count: { $sum: 1 },
        totalQty: { $sum: {
          $reduce: {
            input: '$adjustmentDetails.items',
            initialValue: 0,
            in: { $add: ['$$value', { $ifNull: ['$$this.quantity', 0] }] }
          }
        }}
      }},
      { $sort: { '_id.date': 1 } }
    ]).toArray()

    // Pivot into { date, Transfer, In, Out } format
    const dateMap = {}
    for (const r of raw) {
      const date = r._id.date
      if (!dateMap[date]) dateMap[date] = { date, Transfer: 0, In: 0, Out: 0 }
      dateMap[date][r._id.type] = r.totalQty
    }

    const timeline = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date))
    res.json(timeline)
  } catch (err) {
    console.error('Timeline aggregation error:', err)
    res.status(500).json({ error: 'Failed to fetch timeline data' })
  }
})

export default router
