import { MongoClient } from 'mongodb'
import { createWriteStream } from 'fs'
import { resolve } from 'path'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../.env') })

const VALID_AISLES = ['B','C','D','E','F','G','H','I','J','K','L','M','N','O','Q']

const client = new MongoClient(process.env.MONGODB_URI)

function escapeCsv(val) {
  if (val == null) return ''
  const s = String(val)
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

async function run() {
  await client.connect()
  const db = client.db()

  const pipeline = [
    { $match: { warehouseCode: 'US', 'items.0': { $exists: true } } },
    { $unwind: '$items' },
    { $project: {
      location: '$locationLookupCode',
      aisle: { $arrayElemAt: [{ $split: ['$locationLookupCode', '-'] }, 0] },
      level: { $arrayElemAt: [{ $split: ['$locationLookupCode', '-'] }, 1] },
      bin:   { $arrayElemAt: [{ $split: ['$locationLookupCode', '-'] }, 2] },
      itemNumber:  '$items.itemNumber',
      colorCode:   '$items.colorCode',
      description: '$items.description',
      quantity:    '$items.itemQuantity',
      classCode:   '$items.classCode',
      size:        { $arrayElemAt: ['$items.sizes.size', 0] },
      customer:    { $arrayElemAt: ['$items.details.customer', 0] },
      lastMove:    '$items.lastTransactionDate'
    }},
    { $match: { aisle: { $in: VALID_AISLES } } },
    { $match: { $expr: { $lte: [{ $toInt: '$bin' }, 20] } } },
    { $sort: { location: 1, itemNumber: 1 } }
  ]

  const outPath = resolve('C:/Users/administrator/Desktop/US_Inventory_Export.csv')
  const stream = createWriteStream(outPath)

  const headers = ['Location','Aisle','Level','Bin','Item Number','Color','Description','Quantity','Class Code','Size','Customer','Last Move']
  stream.write(headers.join(',') + '\r\n')

  let count = 0
  const cursor = db.collection('locationInventory').aggregate(pipeline, { allowDiskUse: true })

  for await (const doc of cursor) {
    const row = [
      doc.location,
      doc.aisle,
      doc.level,
      doc.bin,
      doc.itemNumber,
      doc.colorCode,
      doc.description,
      doc.quantity,
      doc.classCode || '',
      doc.size,
      doc.customer,
      doc.lastMove ? new Date(doc.lastMove).toISOString().split('T')[0] : ''
    ].map(escapeCsv)
    stream.write(row.join(',') + '\r\n')
    count++
  }

  await new Promise(resolve => stream.end(resolve))
  console.log(`Exported ${count} rows to ${outPath}`)
  await client.close()
}

run().catch(err => { console.error(err); process.exit(1) })
