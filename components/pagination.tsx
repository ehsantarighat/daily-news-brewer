'use client'

interface PaginationProps {
  page: number
  totalPages: number
  onPage: (p: number) => void
}

export function Pagination({ page, totalPages, onPage }: PaginationProps) {
  if (totalPages <= 1) return null

  // Show up to 5 page buttons around the current page
  const range: number[] = []
  const delta = 2
  const start = Math.max(1, page - delta)
  const end   = Math.min(totalPages, page + delta)
  for (let i = start; i <= end; i++) range.push(i)

  return (
    <div className="flex items-center justify-center gap-1 pt-2">
      {/* Prev */}
      <button
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
        className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        ← Prev
      </button>

      {/* First page + ellipsis */}
      {start > 1 && (
        <>
          <button onClick={() => onPage(1)} className="w-8 h-8 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">1</button>
          {start > 2 && <span className="text-xs text-gray-400 dark:text-gray-500 px-1">…</span>}
        </>
      )}

      {/* Page range */}
      {range.map((p) => (
        <button
          key={p}
          onClick={() => onPage(p)}
          className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
            p === page
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          {p}
        </button>
      ))}

      {/* Last page + ellipsis */}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="text-xs text-gray-400 dark:text-gray-500 px-1">…</span>}
          <button onClick={() => onPage(totalPages)} className="w-8 h-8 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">{totalPages}</button>
        </>
      )}

      {/* Next */}
      <button
        onClick={() => onPage(page + 1)}
        disabled={page === totalPages}
        className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Next →
      </button>
    </div>
  )
}
