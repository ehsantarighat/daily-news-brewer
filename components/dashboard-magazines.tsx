'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { BlogPost } from '@/app/api/blogs/route'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1)  return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)   return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function DashboardMagazines() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/blogs')
        if (!res.ok) return
        const data = await res.json()
        setPosts((data.posts ?? []).slice(0, 3))
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // If no sources at all, hide the section
  if (!loading && posts.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Latest from Your Magazines
        </h2>
        <Link href="/dashboard/blogs" className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
          All posts →
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {posts.map(post => (
            <a
              key={post.id}
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col gap-1.5 p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors group"
            >
              <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-400 dark:text-indigo-500">
                {post.source}
              </span>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {post.title}
              </p>
              <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-auto">
                {timeAgo(post.publishedAt)}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
