import { useEffect, useState } from 'react'
import { REFRESH_INTERVAL_MS } from '../config'
import type { AuthUser } from '../api'

interface Props {
  fetchedAt: Date | null
  isLoading: boolean
  isDemo: boolean
  onRefresh: () => void
  user?: AuthUser | null
  onLogout?: () => void
}

function relativeTime(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (secs < 5) return 'just now'
  if (secs < 60) return `${secs} seconds ago`
  const mins = Math.floor(secs / 60)
  return `${mins} minute${mins === 1 ? '' : 's'} ago`
}

export function Header({ fetchedAt, isLoading, isDemo, onRefresh, user, onLogout }: Props) {
  const [, setTick] = useState(0)

  // Refresh the "X seconds ago" label every 5 s without hitting the API.
  useEffect(() => {
    const id = setInterval(() => setTick((t: number) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const nextRefreshSec = fetchedAt
    ? Math.max(
        0,
        Math.round(
          (REFRESH_INTERVAL_MS - (Date.now() - fetchedAt.getTime())) / 1000,
        ),
      )
    : null

  return (
    <header className="w-full px-4 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-lp-200">
      <div className="flex items-end gap-2">
        <svg className="w-6 h-6 text-lp-500 shrink-0 mb-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
        <h1 className="font-display text-3xl font-semibold italic text-lp-900 leading-none">
          Dormi
        </h1>
        <span className="font-didot text-lp-500 text-xs tracking-widest leading-none mb-0.5">
          &#920;&#932;&ensp;Upsilon Delta
        </span>
        {isDemo && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase tracking-wider mb-0.5">
            Demo Data
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-sm text-lp-400">
        {user && (
          <span className="text-xs text-lp-500 font-medium hidden sm:inline">{user.name}</span>
        )}

        {fetchedAt && (
          <span>Updated {relativeTime(fetchedAt)}</span>
        )}

        {nextRefreshSec !== null && !isLoading && (
          <span className="text-lp-300">· next in {nextRefreshSec}s</span>
        )}

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-lp-100 hover:bg-lp-200 border border-lp-200 text-lp-700 transition-colors disabled:opacity-50 cursor-pointer"
          aria-label="Refresh now"
        >
          {/* Spinner or static icon */}
          <svg
            className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582M20 20v-5h-.581M5.635 19A9 9 0 1 0 4.582 9"
            />
          </svg>
          <span>{isLoading ? 'Refreshing…' : 'Refresh'}</span>
        </button>

        {onLogout && (
          <button
            onClick={onLogout}
            className="px-3 py-1.5 rounded-full bg-lp-100 hover:bg-rose-50 border border-lp-200 hover:border-rose-200 text-lp-400 hover:text-rose-600 text-xs transition-colors cursor-pointer"
          >
            Sign out
          </button>
        )}
      </div>
    </header>
  )
}
