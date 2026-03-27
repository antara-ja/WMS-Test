import { Router } from 'express'

const router = Router()

// GET /api/search?q=66345
router.get('/search', async (req, res) => {
  const query = (req.query.q || '').trim()
  if (query.length < 2) {
    return res.json([])
  }

  const db = req.app.locals.db

  try {
    // Escape regex special chars
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    const result = await db.collection('locationInventory').aggregate([
      { $match: { warehouseCode: 'US', 'items.0': { $exists: true } } },
      { $unwind: '$items' },
      { $match: {
        $or: [
          { 'items.itemNumber': { $regex: escaped, $options: 'i' } },
          { 'items.colorCode': { $regex: escaped, $options: 'i' } },
          { 'items.description': { $regex: escaped, $options: 'i' } }
        ]
      }},
      { $project: {
        locationLookupCode: 1,
        aisle: { $arrayElemAt: [{ $split: ['$locationLookupCode', '-'] }, 0] },
        level: { $arrayElemAt: [{ $split: ['$locationLookupCode', '-'] }, 1] },
        itemNumber: '$items.itemNumber',
        colorCode: '$items.colorCode',
        description: '$items.description',
        quantity: '$items.itemQuantity',
        sizes: '$items.sizes'
      }},
      { $group: {
        _id: { itemNumber: '$itemNumber', colorCode: '$colorCode' },
        description: { $first: '$description' },
        totalQuantity: { $sum: '$quantity' },
        locations: { $push: {
          location: '$locationLookupCode',
          aisle: '$aisle',
          level: '$level',
          quantity: '$quantity',
          sizes: '$sizes'
        }},
        locationCount: { $sum: 1 }
      }},
      { $sort: { totalQuantity: -1 } },
      { $limit: 20 },
      { $project: {
        _id: 0,
        itemNumber: '$_id.itemNumber',
        colorCode: '$_id.colorCode',
        description: 1,
        totalQuantity: 1,
        locations: 1,
        locationCount: 1
      }}
    ]).toArray()

    res.json(result)
  } catch (err) {
    console.error('Search error:', err)
    res.status(500).json({ error: 'Search failed' })
  }
})

export default router
