import { Router } from 'express'

const router = Router()

const VALID_AISLES = ['B','C','D','E','F','G','H','I','J','K','L','M','N','O','Q']

// GET /api/inventory/aging?minDays=0&aisle=&page=1&limit=25&sortBy=daysSinceMove&sortDir=-1
router.get('/inventory/aging', async (req, res) => {
  const minDays = parseInt(req.query.minDays) || 0
  const aisle = req.query.aisle || ''
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25))
  const sortBy = req.query.sortBy || 'daysSinceMove'
  const sortDir = parseInt(req.query.sortDir) === 1 ? 1 : -1
  const db = req.app.locals.db

  try {
    const matchStage = { warehouseCode: 'US', 'items.0': { $exists: true } }

    const pipeline = [
      { $match: matchStage },
      { $unwind: '$items' },
      { $project: {
        locationLookupCode: 1,
        aisle: { $arrayElemAt: [{ $split: ['$locationLookupCode', '-'] }, 0] },
        bin: { $arrayElemAt: [{ $split: ['$locationLookupCode', '-'] }, 2] },
        itemNumber: '$items.itemNumber',
        colorCode: '$items.colorCode',
        description: '$items.description',
        quantity: '$items.itemQuantity',
        customer: { $arrayElemAt: ['$items.details.customer', 0] },
        lastTransaction: '$items.lastTransactionDate'
      }},
      { $match: { aisle: { $in: VALID_AISLES } } },
      // Only include bins 001–020
      { $match: { $expr: { $lte: [{ $toInt: '$bin' }, 20] } } },
      // Merge duplicate items at same location (same style+color+location)
      { $group: {
        _id: {
          locationLookupCode: '$locationLookupCode',
          aisle: '$aisle',
          itemNumber: '$itemNumber',
          colorCode: '$colorCode'
        },
        description: { $first: '$description' },
        quantity: { $sum: '$quantity' },
        customer: { $first: '$customer' },
        lastTransaction: { $max: '$lastTransaction' }
      }},
      { $project: {
        _id: 0,
        locationLookupCode: '$_id.locationLookupCode',
        aisle: '$_id.aisle',
        itemNumber: '$_id.itemNumber',
        colorCode: '$_id.colorCode',
        description: 1,
        quantity: 1,
        customer: 1,
        lastTransaction: 1,
        daysSinceMove: {
          $dateDiff: {
            startDate: '$lastTransaction',
            endDate: '$$NOW',
            unit: 'day'
          }
        }
      }}
    ]

    // Optional filters
    if (minDays > 0) {
      pipeline.push({ $match: { daysSinceMove: { $gte: minDays } } })
    }
    if (aisle && VALID_AISLES.includes(aisle)) {
      pipeline.push({ $match: { aisle } })
    }

    // Use $facet for pagination + total count
    pipeline.push({
      $facet: {
        data: [
          { $sort: { [sortBy]: sortDir } },
          { $skip: (page - 1) * limit },
          { $limit: limit }
        ],
        total: [{ $count: 'count' }]
      }
    })

    const [result] = await db.collection('locationInventory').aggregate(pipeline).toArray()
    const total = result.total[0]?.count || 0

    res.json({
      data: result.data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    })
  } catch (err) {
    console.error('Aging aggregation error:', err)
    res.status(500).json({ error: 'Failed to fetch aging data' })
  }
})

export default router
