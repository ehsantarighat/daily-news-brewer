'use client'

import { cn } from '@/lib/utils'

interface TopicCardProps {
  name: string
  selected: boolean
  disabled?: boolean
  isCustom?: boolean
  onToggle: (name: string) => void
}

export function TopicCard({ name, selected, disabled = false, isCustom = false, onToggle }: TopicCardProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onToggle(name)}
      disabled={disabled && !selected}
      className={cn(
        'relative flex flex-col items-center justify-center rounded-lg border-2 p-3 text-sm font-medium transition-all text-center leading-tight',
        selected
          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
        disabled && !selected && 'opacity-40 cursor-not-allowed'
      )}
    >
      {isCustom && (
        <span className="absolute top-1 right-1 text-[9px] font-semibold uppercase tracking-wide text-indigo-500 bg-indigo-100 rounded px-1">
          custom
        </span>
      )}
      {selected && (
        <span className="absolute top-1 left-1 w-4 h-4 flex items-center justify-center bg-indigo-500 rounded-full text-white text-[10px] font-bold">
          ✓
        </span>
      )}
      <span className="mt-1">{name}</span>
    </button>
  )
}
