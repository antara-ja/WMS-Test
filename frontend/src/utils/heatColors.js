// Color scale per spec
export function getHeatColor(value, isEmptyView = false) {
  if (isEmptyView) {
    // Red scale for empty bins
    if (value === 0) return { bg: '#f0fdf4', text: '#166534' } // green-ish = good
    if (value < 5) return { bg: '#fef9c3', text: '#854d0e' }
    if (value < 15) return { bg: '#fed7aa', text: '#9a3412' }
    if (value < 30) return { bg: '#fca5a5', text: '#991b1b' }
    return { bg: '#ef4444', text: '#ffffff' }
  }

  if (value === 0) return { bg: '#ffffff', text: '#64748b', border: '#fca5a5' }
  if (value < 50) return { bg: '#fef3c7', text: '#92400e' }
  if (value < 200) return { bg: '#dbeafe', text: '#1e40af' }
  if (value < 500) return { bg: '#93c5fd', text: '#1e3a8a' }
  if (value < 1000) return { bg: '#3b82f6', text: '#ffffff' }
  return { bg: '#1e3a8a', text: '#ffffff' }
}

export function getAgingColor(days) {
  if (days < 30) return ''
  if (days < 60) return 'bg-yellow-50 dark:bg-yellow-950'
  if (days < 90) return 'bg-orange-50 dark:bg-orange-950'
  return 'bg-red-50 dark:bg-red-950'
}

export function formatNumber(n) {
  if (n === 0) return '0'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toLocaleString()
}
