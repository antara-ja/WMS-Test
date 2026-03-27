import { useState, useEffect, useCallback } from 'react'

let toastId = 0
let addToastGlobal = null

export function showToast(message) {
  addToastGlobal?.(message)
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message) => {
    const id = ++toastId
    setToasts(prev => [...prev.slice(-4), { id, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 5000)
  }, [])

  useEffect(() => {
    addToastGlobal = addToast
    return () => { addToastGlobal = null }
  }, [addToast])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="toast-enter bg-slate-800 dark:bg-slate-700 text-white text-sm px-4 py-3 rounded-lg shadow-lg border border-slate-700 dark:border-slate-600"
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}
