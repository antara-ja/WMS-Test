import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import http from 'http'
import { Server as SocketIO } from 'socket.io'
import { MongoClient } from 'mongodb'
import heatmapRouter from './routes/heatmap.js'
import adjustmentsRouter from './routes/adjustments.js'
import inventoryRouter from './routes/inventory.js'
import searchRouter from './routes/search.js'
import { startChangeStream } from './services/changeStream.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

const server = http.createServer(app)
const io = new SocketIO(server, {
  cors: { origin: '*' }
})

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
  })
})

const client = new MongoClient(process.env.MONGODB_URI)

async function start() {
  await client.connect()
  console.log('Connected to MongoDB')

  const db = client.db('wms_db')
  app.locals.db = db
  app.locals.io = io

  // Mount routes
  app.use('/api', heatmapRouter)
  app.use('/api', adjustmentsRouter)
  app.use('/api', inventoryRouter)
  app.use('/api', searchRouter)

  // Start Change Stream for real-time updates
  startChangeStream(db, io)

  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
  })
}

start().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
