import { memo } from 'react'
import { getHeatColor, formatNumber } from '../utils/heatColors.js'

const AISLES = ['B','C','D','E','F','G','H','I','J','K','L','M','N','O','Q']
const LEVELS = ['01','02','03','04','05']

function HeatmapGrid({ data, view, onCellClick, highlightCells, flashCells }) {
  // Build lookup map
  const cellMap = {}
  for (const d of data) {
    cellMap[`${d.aisle}-${d.level}`] = d
  }

  const isEmptyView = view === 'empty'

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse w-full">
        <thead>
          <tr>
            <th className="w-16 p-2 text-xs font-semibold text-slate-500 dark:text-slate-400 text-right">
              Level
            </th>
            {AISLES.map(aisle => (
              <th
                key={aisle}
                className="p-2 text-xs font-semibold text-slate-600 dark:text-slate-300 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                onClick={() => onCellClick?.({ type: 'aisle', aisle })}
              >
                {aisle}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LEVELS.map(level => (
            <tr key={level}>
              <td
                className="p-2 text-xs font-semibold text-slate-600 dark:text-slate-300 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                onClick={() => onCellClick?.({ type: 'level', level })}
              >
                L{level}
              </td>
              {AISLES.map(aisle => {
                const cell = cellMap[`${aisle}-${level}`]
                const value = cell?.value ?? 0
                const colors = getHeatColor(value, isEmptyView)
                const key = `${aisle}-${level}`
                const isHighlighted = highlightCells?.has(key)
                const isFlashing = flashCells?.has(key)

                return (
                  <td
                    key={key}
                    className={`
                      p-1 text-center cursor-pointer transition-all duration-150
                      hover:ring-2 hover:ring-blue-400 hover:z-10 relative
                      tabular-nums text-sm font-semibold
                      ${isFlashing ? 'cell-flash' : ''}
                      ${isHighlighted ? 'ring-2 ring-amber-400 z-10' : ''}
                    `}
                    style={{
                      backgroundColor: colors.bg,
                      color: colors.text,
                      border: colors.border ? `2px solid ${colors.border}` : '1px solid rgba(0,0,0,0.06)',
                      minWidth: '60px',
                      height: '44px'
                    }}
                    onClick={() => onCellClick?.({ type: 'cell', aisle, level })}
                    title={`Aisle ${aisle}, Level ${level}: ${value.toLocaleString()} ${
                      view === 'count' ? 'dresses' :
                      view === 'avg' ? 'avg/bin' :
                      view === 'empty' ? 'empty bins' :
                      'picks (7d)'
                    }`}
                  >
                    {formatNumber(value)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default memo(HeatmapGrid)
