import { useState, useEffect, useRef } from 'react'

export default function DetailPanel({ aisle, level, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const panelRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/inventory/detail/${aisle}/${level}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [aisle, level])

  // Click outside to close
  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const totalQty = data?.reduce((s, bin) => s + bin.totalQty, 0) || 0

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
      <div
        ref={panelRef}
        className="panel-slide w-full max-w-lg bg-white dark:bg-slate-800 shadow-2xl overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Aisle {aisle} &middot; Level {level}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {data?.length || 0} bins &middot; {totalQty.toLocaleString()} total items
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 text-xl"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {loading && (
            <div className="text-center py-12 text-slate-400">Loading bin details...</div>
          )}
          {error && (
            <div className="text-center py-12 text-red-500">Error: {error}</div>
          )}
          {data && data.map(bin => (
            <div key={bin.locationLookupCode} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                  {bin.locationLookupCode}
                </span>
                <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-semibold">
                  {bin.totalQty} items
                </span>
              </div>
              {bin.items.length === 0 ? (
                <div className="text-xs text-slate-400 italic">Empty bin</div>
              ) : (
                <div className="space-y-2">
                  {bin.items.map((item, idx) => (
                    <div key={idx} className="text-xs bg-slate-100 dark:bg-slate-700 rounded p-2">
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">
                          #{item.itemNumber} / {item.colorCode}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          Qty: {item.quantity}
                        </span>
                      </div>
                      <div className="text-slate-600 dark:text-slate-300 truncate mt-0.5">
                        {item.description}
                      </div>
                      <div className="flex gap-3 mt-1 text-slate-500 dark:text-slate-400">
                        {item.customer && <span>Customer: {item.customer}</span>}
                        {item.sizes?.length > 0 && (
                          <span>Sizes: {item.sizes.map(s => s.size).join(', ')}</span>
                        )}
                      </div>
                      {item.lastTransaction && (
                        <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                          Last move: {new Date(item.lastTransaction).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
