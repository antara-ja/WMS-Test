import { useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'
import { showToast } from '../components/Toast.jsx'

export default function useSocket() {
  const [isConnected, setIsConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState(null)
  const socketRef = useRef(null)

  useEffect(() => {
    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity
    })
    socketRef.current = socket

    socket.on('connect', () => setIsConnected(true))
    socket.on('disconnect', () => setIsConnected(false))

    socket.on('adjustment', (data) => {
      setLastEvent(data)

      // Show toast notification
      const items = data.items?.map(i => `${i.qty}x ${i.style}/${i.color}`).join(', ') || 'items'
      const action = data.type === 'Transfer' ? 'moved' : data.type === 'In' ? 'received' : 'shipped'
      showToast(`${data.user} ${action} ${items} from ${data.from || '?'}`)
    })

    return () => socket.disconnect()
  }, [])

  return { isConnected, lastEvent }
}
