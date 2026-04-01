'use client'

import { PRESET_TOPICS, MAX_TOPICS } from '@/lib/topics'
import { TopicCard } from './TopicCard'

interface TopicGridProps {
  selected: string[]
  customTopics?: string[]
  onToggle: (name: string) => void
  showCustom?: boolean
}

export function TopicGrid({ selected, customTopics = [], onToggle, showCustom = false }: TopicGridProps) {
  const atMax = selected.length >= MAX_TOPICS

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
      {PRESET_TOPICS.map((topic) => (
        <TopicCard
          key={topic}
          name={topic}
          selected={selected.includes(topic)}
          disabled={atMax}
          onToggle={onToggle}
        />
      ))}
      {showCustom &&
        customTopics.map((topic) => (
          <TopicCard
            key={topic}
            name={topic}
            selected={selected.includes(topic)}
            disabled={atMax}
            isCustom
            onToggle={onToggle}
          />
        ))}
    </div>
  )
}
