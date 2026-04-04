'use client'

import { useState, useRef, type FormEvent } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Source = { title: string; url: string; source: string }

type Result = {
  answer: string
  sources: Source[]
  hasAnswer: boolean
}

// ─── Suggested questions ──────────────────────────────────────────────────────

const SUGGESTIONS = [
  'What are the biggest AI news this week?',
  'Any recent funding rounds or acquisitions?',
  'What are people saying about climate change?',
  'Latest product launches or announcements?',
]

// ─── Component ────────────────────────────────────────────────────────────────

export function BlogsAskAI() {
  const [question,  setQuestion]  = useState('')
  const [loading,   setLoading]   = useState(false)
  const [result,    setResult]    = useState<Result | null>(null)
  const [error,     setError]     = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  async function ask(q: string) {
    const trimmed = q.trim()
    if (!trimmed || loading) return

    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const res = await fetch('/api/blogs/ask', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ question: trimmed }),
      })

      if (!res.ok) {
        setError('Something went wrong. Please try again.')
        return
      }

      const data: Result = await res.json()
      setResult(data)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    ask(question)
  }

  function handleSuggestion(s: string) {
    setQuestion(s)
    ask(s)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      ask(question)
    }
  }

  return (
    <div className="rounded-2xl border border-violet-100 dark:border-violet-900 bg-gradient-to-br from-violet-50 via-white to-indigo-50 dark:from-violet-950/50 dark:via-gray-900 dark:to-indigo-950/40 p-4 sm:p-6 shadow-sm">

      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-violet-600 shadow-sm shrink-0">
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-violet-900 dark:text-violet-200 tracking-tight">Ask AI</span>
            <span className="text-[10px] font-medium text-violet-400 dark:text-violet-500 bg-violet-100 dark:bg-violet-900/60 px-1.5 py-0.5 rounded-full shrink-0">
              From your sources
            </span>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">
            Ask anything — answered only from publications you follow
          </p>
        </div>
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex gap-2 items-end mb-4">
        <textarea
          ref={inputRef}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. What's the latest on AI regulation?"
          rows={2}
          disabled={loading}
          className="flex-1 resize-none px-3.5 py-2.5 rounded-xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all disabled:opacity-60 leading-snug"
        />
        <button
          type="submit"
          disabled={!question.trim() || loading}
          className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors shadow-sm"
          aria-label="Ask"
        >
          {loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </form>

      {/* Suggestions — only shown when no result yet */}
      {!result && !loading && (
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => handleSuggestion(s)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-900 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-2.5 py-2">
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <span className="text-xs text-violet-400">Searching your sources…</span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex items-center gap-2 text-xs text-red-500 dark:text-red-400 py-2">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Answer */}
      {result && !loading && (
        <div className="mt-1 space-y-3">
          <div className={`rounded-xl p-4 ${
            result.hasAnswer
              ? 'bg-white dark:bg-gray-900/80 border border-violet-100 dark:border-violet-900'
              : 'bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50'
          }`}>
            {/* Answer icon */}
            <div className="flex items-start gap-2.5">
              <div className={`flex items-center justify-center w-5 h-5 rounded-full shrink-0 mt-0.5 ${
                result.hasAnswer ? 'bg-violet-100 dark:bg-violet-900/60' : 'bg-amber-100 dark:bg-amber-900/60'
              }`}>
                {result.hasAnswer ? (
                  <svg className="w-2.5 h-2.5 text-violet-600 dark:text-violet-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{result.answer}</p>
            </div>
          </div>

          {/* Source articles */}
          {result.sources.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide px-0.5">Sources</p>
              <div className="space-y-1">
                {result.sources.map((src, i) => (
                  <a
                    key={i}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 p-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:border-violet-200 dark:hover:border-violet-800 transition-colors group"
                  >
                    <svg className="w-3 h-3 text-violet-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors line-clamp-1">{src.title}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">{src.source}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Ask another */}
          <button
            onClick={() => { setResult(null); setQuestion(''); setTimeout(() => inputRef.current?.focus(), 50) }}
            className="text-xs text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 transition-colors"
          >
            ← Ask another question
          </button>
        </div>
      )}
    </div>
  )
}
