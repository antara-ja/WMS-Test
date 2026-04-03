import { useState, useEffect } from 'react'

const SORT_MODES = [
  { id: 'volume', label: 'Volume' },
  { id: 'frequency', label: 'Frequency' },
  { id: 'trending', label: 'Trending' },
]

const PRESETS = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

export default function BestsellersList() {
  const [data, setData] = useState([])
  const [period, setPeriod] = useState(30)
  const [sort, setSort] = useState('volume')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/bestsellers?period=${period}&sort=${sort}&limit=10`)
      .then(r => r.json())
      .then(json => setData(json.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [period, sort])

  function renderTrend(item) {
    if (item.isNew) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
          NEW
        </span>
      )
    }
    if (item.percentChange === null || item.percentChange === undefined) {
      return <span className="text-slate-400">--</span>
    }
    if (item.percentChange > 0) {
      return (
        <span className="text-green-600 dark:text-green-400 font-medium text-xs">
          {'\u2191'} {item.percentChange}%
        </span>
      )
    }
    if (item.percentChange < 0) {
      return (
        <span className="text-red-500 dark:text-red-400 font-medium text-xs">
          {'\u2193'} {Math.abs(item.percentChange)}%
        </span>
      )
    }
    return <span className="text-slate-400 text-xs">0%</span>
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Bestsellers
        </h3>
        <div className="flex items-center gap-3">
          {/* Sort toggles */}
          <div className="flex gap-1">
            {SORT_MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setSort(m.id)}
                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                  sort === m.id
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {/* Period presets */}
          <div className="flex gap-1">
            {PRESETS.map(p => (
              <button
                key={p.days}
                onClick={() => setPeriod(p.days)}
                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                  period === p.days
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
          Loading bestsellers...
        </div>
      ) : data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
          No bestseller data available
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 pr-2 w-8">#</th>
                <th className="py-2 pr-3">Style</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Color</th>
                <th className="py-2 pr-3 text-right">Shipped</th>
                <th className="py-2 pr-3 text-right">Stock</th>
                <th className="py-2 text-right">Trend</th>
              </tr>
            </thead>
            <tbody>
              {data.map(item => (
                <tr
                  key={`${item.itemNumber}-${item.colorCode}`}
                  className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <td className="py-2.5 pr-2 tabular-nums text-slate-400 dark:text-slate-500 font-medium">
                    {item.rank}
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-xs text-slate-900 dark:text-white">
                    {item.itemNumber}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                    {item.name || '--'}
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                    {item.colorCode}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums font-medium text-slate-900 dark:text-white">
                    {sort === 'frequency' ? item.shipmentCount : item.totalQtyShipped}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    <span className={`${item.currentStock <= 5 ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                      {item.currentStock}
                    </span>
                    {item.currentStock <= 5 && (
                      <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                        Low
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    {renderTrend(item)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
