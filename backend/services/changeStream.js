export function startChangeStream(db, io) {
  try {
    const pipeline = [{ $match: { operationType: 'insert' } }]
    const changeStream = db.collection('adjustments').watch(pipeline, {
      fullDocument: 'updateLookup'
    })

    changeStream.on('change', (change) => {
      const adj = change.fullDocument
      if (!adj) return

      io.emit('adjustment', {
        id: adj.adjustmentId,
        user: adj.userId,
        type: adj.adjustmentType,
        from: adj.sourceLocationCode,
        to: adj.destinationLocationCode,
        items: adj.adjustmentDetails?.items?.map(i => ({
          style: i.itemNumber,
          color: i.colorCode,
          qty: i.quantity
        })),
        timestamp: adj.createdAt
      })
    })

    changeStream.on('error', (err) => {
      console.error('Change stream error:', err.message)
      // Change Streams require a replica set — log gracefully
    })

    console.log('Change Stream watching adjustments collection')
    return changeStream
  } catch (err) {
    console.warn('Change Streams not available (requires replica set):', err.message)
    return null
  }
}
