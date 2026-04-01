'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PRESET_TOPICS, MAX_TOPICS } from '@/lib/topics'
import { TopicCard } from '@/components/topics/TopicCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import type { Topic } from '@/lib/types'

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [customInput, setCustomInput] = useState('')
  const [customError, setCustomError] = useState<string | null>(null)
  const supabase = createClient()

  const activeTopics = topics.filter((t) => t.active)
  const activeCount = activeTopics.length
  const activeNames = activeTopics.map((t) => t.name)
  const atMax = activeCount >= MAX_TOPICS

  const loadTopics = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('topics')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at')

    setTopics((data ?? []) as Topic[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadTopics()
  }, [loadTopics])

  async function togglePresetTopic(name: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const existing = topics.find((t) => t.name === name)

    if (existing) {
      // Toggle active state
      if (existing.active && activeCount <= 1) {
        toast.error('You must have at least one topic active.')
        return
      }
      const newActive = !existing.active
      if (newActive && atMax) {
        toast.error(`You can have at most ${MAX_TOPICS} topics.`)
        return
      }
      await supabase.from('topics').update({ active: newActive }).eq('id', existing.id)
      setTopics((prev) =>
        prev.map((t) => (t.id === existing.id ? { ...t, active: newActive } : t))
      )
    } else {
      // Add new preset topic
      if (atMax) {
        toast.error(`You can have at most ${MAX_TOPICS} topics.`)
        return
      }
      const { data: newTopic } = await supabase
        .from('topics')
        .insert({ user_id: user.id, name, is_custom: false, active: true })
        .select()
        .single()
      if (newTopic) setTopics((prev) => [...prev, newTopic as Topic])
    }
  }

  async function addCustomTopic() {
    setCustomError(null)
    const trimmed = customInput.trim()

    if (trimmed.length < 2) {
      setCustomError('Topic name must be at least 2 characters.')
      return
    }
    if (trimmed.length > 60) {
      setCustomError('Topic name must be 60 characters or fewer.')
      return
    }
    if (activeNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      setCustomError('You already have this topic.')
      return
    }
    if (atMax) {
      setCustomError(`You can have at most ${MAX_TOPICS} topics.`)
      return
    }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: newTopic, error } = await supabase
      .from('topics')
      .insert({ user_id: user.id, name: trimmed, is_custom: true, active: true })
      .select()
      .single()

    setSaving(false)
    if (error) {
      setCustomError('Failed to add topic.')
      return
    }

    setTopics((prev) => [...prev, newTopic as Topic])
    setCustomInput('')
    toast.success(`"${trimmed}" added to your topics.`)
  }

  async function deleteTopic(topicId: string, topicName: string) {
    if (activeCount <= 1 && activeTopics.find((t) => t.id === topicId)) {
      toast.error('You must have at least one topic active.')
      return
    }
    await supabase.from('topics').delete().eq('id', topicId)
    setTopics((prev) => prev.filter((t) => t.id !== topicId))
    toast.success(`"${topicName}" removed.`)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-7 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const customTopicNames = topics.filter((t) => t.is_custom).map((t) => t.name)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manage Topics</h1>
        <p className="text-sm text-gray-500 mt-1">Select up to {MAX_TOPICS} topics for your daily briefing.</p>
      </div>

      {/* Count & active topics */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            <span className={atMax ? 'text-indigo-600 font-bold' : ''}>{activeCount}</span>/{MAX_TOPICS} topics active
          </span>
        </div>

        {/* Active topics chips with delete */}
        {activeTopics.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeTopics.map((topic) => (
              <span
                key={topic.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"
              >
                {topic.name}
                {topic.is_custom && <Badge variant="secondary" className="text-[9px] px-1 py-0 h-auto">custom</Badge>}
                <button
                  type="button"
                  onClick={() => deleteTopic(topic.id, topic.name)}
                  className="ml-0.5 text-indigo-400 hover:text-red-500 transition-colors font-bold"
                  aria-label={`Remove ${topic.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Preset topics grid */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Preset Topics</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {PRESET_TOPICS.map((name) => (
            <TopicCard
              key={name}
              name={name}
              selected={activeNames.includes(name)}
              disabled={atMax}
              onToggle={togglePresetTopic}
            />
          ))}
        </div>
      </div>

      {/* Custom topics in grid */}
      {customTopicNames.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Custom Topics</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {customTopicNames.map((name) => (
              <TopicCard
                key={name}
                name={name}
                selected={activeNames.includes(name)}
                disabled={atMax}
                isCustom
                onToggle={togglePresetTopic}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add custom topic */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Add Custom Topic</h2>
        <div className="flex gap-2 max-w-sm">
          <Input
            value={customInput}
            onChange={(e) => {
              setCustomInput(e.target.value)
              setCustomError(null)
            }}
            placeholder="e.g. Central Asia fintech"
            maxLength={60}
            onKeyDown={(e) => e.key === 'Enter' && addCustomTopic()}
          />
          <Button
            onClick={addCustomTopic}
            disabled={saving || !customInput.trim() || atMax}
            className="bg-indigo-600 hover:bg-indigo-700 shrink-0"
          >
            Add
          </Button>
        </div>
        {customError && <p className="mt-1.5 text-xs text-red-600">{customError}</p>}
        {atMax && <p className="mt-1.5 text-xs text-amber-600">Maximum {MAX_TOPICS} topics reached. Remove one to add another.</p>}
      </div>
    </div>
  )
}
