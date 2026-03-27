import { useState, useEffect, useRef } from 'react'

export default function SearchBar({ onHighlight }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const containerRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (query.trim().length < 2) {
      setResults([])
      setIsOpen(false)
      onHighlight?.(null)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        const data = await res.json()
        setResults(data)
        setIsOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  // Click outside to close
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(item) {
    // Highlight all cells where this item exists
    const cells = new Set()
    for (const loc of item.locations) {
      if (loc.aisle && loc.level) {
        cells.add(`${loc.aisle}-${loc.level}`)
      }
    }
    onHighlight?.(cells)
    setExpanded(expanded === item.itemNumber ? null : item.itemNumber)
  }

  function handleClear() {
    setQuery('')
    setResults([])
    setIsOpen(false)
    setExpanded(null)
    onHighlight?.(null)
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Search style#, color, or description..."
          className="w-full px-4 py-2.5 pl-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <svg className="absolute left-3 top-3 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {query && (
          <button onClick={handleClear} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            &times;
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-96 overflow-y-auto z-50">
          {loading && (
            <div className="p-3 text-sm text-slate-400 text-center">Searching...</div>
          )}
          {!loading && results.length === 0 && query.length >= 2 && (
            <div className="p-3 text-sm text-slate-400 text-center">No results found</div>
          )}
          {results.map(item => (
            <div key={`${item.itemNumber}-${item.colorCode}`}>
              <button
                onClick={() => handleSelect(item)}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-750 border-b border-slate-100 dark:border-slate-700 last:border-b-0"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">
                      #{item.itemNumber}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">
                      / {item.colorCode}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                      {item.totalQuantity}
                    </span>
                    <span className="text-xs text-slate-400 ml-1">
                      in {item.locationCount} loc{item.locationCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                  {item.description}
                </div>
              </button>
              {expanded === item.itemNumber && (
                <div className="px-4 pb-3 bg-slate-50 dark:bg-slate-850">
                  {item.locations.map((loc, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-slate-500 dark:text-slate-400 py-1 border-b border-slate-100 dark:border-slate-700 last:border-b-0">
                      <span className="font-mono">{loc.location}</span>
                      <span>Qty: {loc.quantity}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
