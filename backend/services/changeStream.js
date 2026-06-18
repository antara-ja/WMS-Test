function watch(db, io) {
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
      console.log('Reconnecting change stream in 5 seconds...')
      setTimeout(() => watch(db, io), 5000)
    })

    changeStream.on('close', () => {
      console.log('Change stream closed. Reconnecting in 5 seconds...')
      setTimeout(() => watch(db, io), 5000)
    })

    console.log('Change Stream watching adjustments collection')
    return changeStream
  } catch (err) {
    console.warn('Change Stream failed, retrying in 10 seconds:', err.message)
    setTimeout(() => watch(db, io), 10000)
    return null
  }
}

export function startChangeStream(db, io) {
  watch(db, io)
}
