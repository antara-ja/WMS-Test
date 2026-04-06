import { useState, useEffect, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender
} from '@tanstack/react-table'
import { getAgingColor } from '../utils/heatColors.js'

const VALID_AISLES = ['B','C','D','E','F','G','H','I','J','K','L','M','N','O','Q']

const columns = [
  { accessorKey: 'locationLookupCode', header: 'Location', size: 120 },
  { accessorKey: 'itemNumber', header: 'Style#', size: 80 },
  { accessorKey: 'colorCode', header: 'Color', size: 80 },
  {
    accessorKey: 'sizes',
    header: 'Size',
    size: 100,
    cell: ({ getValue }) => {
      const sizes = getValue()
      if (!sizes || sizes.length === 0) return '--'
      return sizes.sort().join(', ')
    }
  },
  {
    accessorKey: 'quantity',
    header: 'Qty',
    size: 60,
    cell: ({ getValue }) => <span className="font-semibold">{getValue()}</span>
  },
  { accessorKey: 'customer', header: 'Customer', size: 90 },
  {
    accessorKey: 'daysSinceMove',
    header: 'Days Idle',
    size: 90,
    cell: ({ getValue }) => {
      const days = getValue()
      return (
        <span className={`font-bold ${
          days >= 90 ? 'text-red-600 dark:text-red-400' :
          days >= 60 ? 'text-orange-600 dark:text-orange-400' :
          days >= 30 ? 'text-yellow-600 dark:text-yellow-400' :
          'text-slate-600 dark:text-slate-300'
        }`}>
          {days}d
        </span>
      )
    }
  }
]

export default function AgingTable() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [aisleFilter, setAisleFilter] = useState('')
  const [sorting, setSorting] = useState([{ id: 'daysSinceMove', desc: true }])

  useEffect(() => {
    setLoading(true)
    const sortBy = sorting[0]?.id || 'daysSinceMove'
    const sortDir = sorting[0]?.desc ? -1 : 1
    const params = new URLSearchParams({
      page: String(page),
      limit: '25',
      sortBy,
      sortDir: String(sortDir),
      ...(aisleFilter && { aisle: aisleFilter })
    })
    fetch(`/api/inventory/aging?${params}`)
      .then(r => r.json())
      .then(res => {
        setData(res.data || [])
        setTotal(res.total || 0)
        setTotalPages(res.totalPages || 1)
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [page, sorting, aisleFilter])

  // Reset page when filter changes
  useEffect(() => { setPage(1) }, [aisleFilter, sorting])

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: true
  })

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Aging Inventory
          <span className="ml-2 text-xs font-normal text-slate-400">
            {total.toLocaleString()} items
          </span>
        </h3>
        <select
          value={aisleFilter}
          onChange={(e) => setAisleFilter(e.target.value)}
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
        >
          <option value="">All Aisles</option>
          {VALID_AISLES.map(a => (
            <option key={a} value={a}>Aisle {a}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
          Loading aging data...
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id}>
                    {hg.headers.map(header => (
                      <th
                        key={header.id}
                        className="text-left px-3 py-2 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700 cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200"
                        style={{ width: header.column.getSize() }}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <span className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{ asc: ' \u2191', desc: ' \u2193' }[header.column.getIsSorted()] ?? ''}
                        </span>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr
                    key={row.id}
                    className={`border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-750 ${
                      getAgingColor(row.original.daysSinceMove)
                    }`}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-3 py-2 text-slate-700 dark:text-slate-300">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-3 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Page {page} of {totalPages} ({total.toLocaleString()} total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Prev
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
