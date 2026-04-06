export default function StatCards({ stats, view }) {
  const cards = [
    {
      primary: true,
      value: (stats.total || 0).toLocaleString(),
      label: 'Total items in warehouse',
      sub: 'US Warehouse · all aisles'
    },
    {
      value: (stats.lvl01 || 0).toLocaleString(),
      label: 'Items at Levels 1 & 2',
      sub: `No ladder needed · ${stats.total ? Math.round((stats.lvl01 / stats.total) * 100) : 0}% of total`
    },
    {
      value: (stats.lvlUp || 0).toLocaleString(),
      label: 'Items at Levels 3-5',
      sub: `Require ladder · ${stats.total ? Math.round((stats.lvlUp / stats.total) * 100) : 0}% of total`
    },
    {
      value: stats.emptyLocations ?? 0,
      label: 'Empty Locations',
      sub: 'Empty boxes across Levels 1 & 2'
    }
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, i) => (
        <div
          key={i}
          className={`rounded-xl p-5 ${
            card.primary
              ? 'bg-blue-700 text-white'
              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <div className={`text-3xl font-bold tabular-nums ${
            card.primary ? '' : 'text-slate-900 dark:text-white'
          }`}>
            {card.value}
          </div>
          <div className={`text-sm mt-1 ${
            card.primary ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
          }`}>
            {card.label}
          </div>
          <div className={`text-xs mt-1 ${
            card.primary ? 'text-blue-200/70' : 'text-slate-400 dark:text-slate-500'
          }`}>
            {card.sub}
          </div>
        </div>
      ))}
    </div>
  )
}
