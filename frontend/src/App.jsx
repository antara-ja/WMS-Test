import { useState, useEffect, useCallback, useMemo } from 'react'
import HeatmapGrid from './components/HeatmapGrid.jsx'
import DetailPanel from './components/DetailPanel.jsx'
import StatCards from './components/StatCards.jsx'
import SearchBar from './components/SearchBar.jsx'
import TimelineChart from './components/TimelineChart.jsx'
import AgingTable from './components/AgingTable.jsx'
import ToastContainer from './components/Toast.jsx'
import useSocket from './hooks/useSocket.js'

const VIEWS = [
  { id: 'count', label: 'Dress Count' },
  { id: 'avg', label: 'Avg per Bin' },
  { id: 'empty', label: 'Empty Bins' },
  { id: 'picks', label: 'Pick Frequency' },
]

export default function App() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('wms-dark-mode')
    return saved !== null ? saved === 'true' : true // dark by default
  })
  const [view, setView] = useState('count')
  const [heatData, setHeatData] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [detailPanel, setDetailPanel] = useState(null)
  const [highlightCells, setHighlightCells] = useState(null)
  const [flashCells, setFlashCells] = useState(null)

  const { isConnected, lastEvent } = useSocket()

  // Dark mode toggle
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('wms-dark-mode', dark)
  }, [dark])

  // Fetch heatmap data
  const fetchHeatmap = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/inventory/heatmap?view=${view}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setHeatData(json.data)
      setStats(json.stats)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [view])

  useEffect(() => { fetchHeatmap() }, [fetchHeatmap])

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(fetchHeatmap, 30000)
    return () => clearInterval(id)
  }, [fetchHeatmap])

  // Flash cells on WebSocket event
  useEffect(() => {
    if (!lastEvent) return
    // Parse source/dest location to find aisle-level
    const flash = new Set()
    for (const loc of [lastEvent.from, lastEvent.to]) {
      if (!loc) continue
      const parts = loc.split('-')
      if (parts.length >= 3 && /^\d+$/.test(parts[1])) {
        flash.add(`${parts[0]}-${parts[1]}`)
      }
    }
    if (flash.size > 0) {
      setFlashCells(flash)
      setTimeout(() => setFlashCells(null), 1500)
      // Refresh data
      fetchHeatmap()
    }
  }, [lastEvent, fetchHeatmap])

  function handleCellClick(info) {
    if (info.type === 'cell') {
      setDetailPanel({ aisle: info.aisle, level: info.level })
    }
  }

  return (
    <div className={`min-h-screen transition-colors ${dark ? 'bg-slate-900' : 'bg-slate-50'}`}>
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              WMS Dashboard
            </h1>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
              title={isConnected ? 'WebSocket connected' : 'WebSocket disconnected'}
            />
          </div>

          <SearchBar onHighlight={setHighlightCells} />

          <button
            onClick={() => setDark(d => !d)}
            className="shrink-0 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 text-sm"
            title="Toggle dark mode"
          >
            {dark ? '\u2600\uFE0F' : '\uD83C\uDF19'}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="p-6 max-w-[1600px] mx-auto">
        {/* Stat Cards */}
        <StatCards stats={stats} view={view} />

        {/* View toggles + controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            {VIEWS.map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  view === v.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchHeatmap}
              disabled={loading}
              className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-3 text-xs text-slate-500 dark:text-slate-400">
          {view !== 'empty' ? (
            <>
              <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded border border-red-300 bg-white" /> 0</span>
              <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded bg-amber-100" /> 1-49</span>
              <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded bg-blue-200" /> 50-199</span>
              <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded bg-blue-400" /> 200-499</span>
              <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded bg-blue-500" /> 500-999</span>
              <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded bg-blue-900" /> 1000+</span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded bg-green-50 border border-green-200" /> 0 empty</span>
              <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded bg-yellow-100" /> 1-4</span>
              <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded bg-orange-200" /> 5-14</span>
              <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded bg-red-300" /> 15-29</span>
              <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded bg-red-500" /> 30+</span>
            </>
          )}
        </div>

        {/* Heatmap Grid */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 mb-6">
          {error ? (
            <div className="text-center py-16 text-red-500">Error: {error}</div>
          ) : loading && heatData.length === 0 ? (
            <div className="text-center py-16 text-slate-400">Loading heatmap...</div>
          ) : (
            <HeatmapGrid
              data={heatData}
              view={view}
              onCellClick={handleCellClick}
              highlightCells={highlightCells}
              flashCells={flashCells}
            />
          )}
        </div>

        {/* Bottom row: Timeline + Aging */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TimelineChart />
          <AgingTable />
        </div>
      </main>

      {/* Detail Panel */}
      {detailPanel && (
        <DetailPanel
          aisle={detailPanel.aisle}
          level={detailPanel.level}
          onClose={() => setDetailPanel(null)}
        />
      )}

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  )
}
