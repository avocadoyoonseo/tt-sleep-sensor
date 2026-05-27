import { useEffect, useRef, useState, useCallback } from 'react'
import type { ChannelData } from './types'
import { fetchChannelData, getToken, setToken, clearToken } from './api'
import type { AuthUser } from './api'
import { METRICS } from './metrics'
import { REFRESH_INTERVAL_MS } from './config'
import { Header } from './components/Header'
import { SleepScoreHero } from './components/SleepScoreHero'
import { ScoreBreakdown } from './components/ScoreBreakdown'
import { MetricCard } from './components/MetricCard'
import { TimeSeriesChart } from './components/TimeSeriesChart'
import { RecommendationsPanel } from './components/RecommendationsPanel'
import { AuthModal } from './components/AuthModal'
import { Footer } from './components/Footer'

// Sensor metrics only (exclude the composite sleep score card from the grid).
const SENSOR_METRICS = METRICS.filter((m) => m.key !== 'score')

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-lp-200 bg-lp-100/60 p-4 animate-pulse h-40">
      <div className="h-3 w-20 bg-lp-200 rounded mb-3" />
      <div className="h-7 w-24 bg-lp-200 rounded mb-3" />
      <div className="h-2 w-32 bg-lp-100 rounded mb-2" />
      <div className="h-10 w-full bg-lp-100 rounded" />
    </div>
  )
}

// ── Error banner ──────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
      {message}
    </div>
  )
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: string }) {
  return (
    <h2 className="text-[10px] font-semibold text-lp-400 uppercase tracking-widest">
      {children}
    </h2>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────

export function App() {
  const [token, setTokenState] = useState<string | null>(() => getToken())
  const [user, setUser] = useState<AuthUser | null>(null)
  const [data, setData] = useState<ChannelData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function handleAuthSuccess(t: string, u: AuthUser) {
    setToken(t)
    setTokenState(t)
    setUser(u)
  }

  function handleLogout() {
    clearToken()
    setTokenState(null)
    setUser(null)
    setData(null)
  }

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await fetchChannelData(token)
      setData(result)
    } catch (e) {
      setError(
        e instanceof Error
          ? `Could not load data: ${e.message}`
          : 'Could not load data.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    void refresh()
    intervalRef.current = setInterval(() => void refresh(), REFRESH_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [refresh])

  if (!token) {
    return <AuthModal onSuccess={handleAuthSuccess} />
  }

  const latest = data?.latest ?? null
  // Sparkline = last hour (60 readings at 60 s cadence).
  const sparklineEntries = data ? data.entries.slice(-60) : []

  // Count how many sensors are currently in a non-red zone (score ≥ 50).
  const healthySensorCount = latest
    ? SENSOR_METRICS.filter((m) => m.scoreValue(latest[m.key] as number) >= 50).length
    : undefined

  // Format the RTC timestamp from the latest ThingSpeak entry.
  const lastReadingTime = latest
    ? latest.timestamp.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : null

  return (
    <div className="min-h-screen bg-lp-50 text-lp-800">
      <div className="max-w-4xl mx-auto pb-12">
        <Header
          fetchedAt={data?.fetchedAt ?? null}
          isLoading={isLoading}
          isDemo={false}
          onRefresh={() => void refresh()}
          user={user}
          onLogout={handleLogout}
        />

        <div className="px-4 pt-6 flex flex-col gap-7">
          {error && <ErrorBanner message={error} />}

          {/* Device reading timestamp */}
          {lastReadingTime && (
            <div className="flex items-center gap-1.5 text-xs text-lp-400">
              <span className="w-2 h-2 rounded-full bg-lp-500 animate-pulse shrink-0" />
              <span>Device reading as of</span>
              <span className="text-lp-700 font-medium">{lastReadingTime}</span>
              <span className="text-lp-300">· auto-refresh every 60 s</span>
            </div>
          )}

          {/* ── Hero: score gauge + breakdown side-by-side on md+ ── */}
          <section className="flex flex-col gap-4">
            <SectionHeading>Overall Sleep Score</SectionHeading>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {latest ? (
                <SleepScoreHero
                  score={latest.score}
                  healthySensorCount={healthySensorCount}
                />
              ) : (
                <div className="rounded-2xl border border-lp-200 bg-lp-100 h-56 animate-pulse" />
              )}

              {latest ? (
                <ScoreBreakdown latest={latest} />
              ) : (
                <div className="rounded-2xl border border-lp-200 bg-lp-100 h-56 animate-pulse" />
              )}
            </div>
          </section>

          {/* ── 5 sensor metric cards ── */}
          <section className="flex flex-col gap-4">
            <SectionHeading>Live Sensor Readings · Last hour sparkline</SectionHeading>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {latest
                ? SENSOR_METRICS.map((cfg) => (
                    <MetricCard
                      key={cfg.key}
                      config={cfg}
                      current={latest[cfg.key] as number}
                      sparklineData={sparklineEntries}
                    />
                  ))
                : Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          </section>

          {/* ── Time-series history chart ── */}
          <section className="flex flex-col gap-4">
            <SectionHeading>History</SectionHeading>
            {data && data.entries.length > 1 ? (
              <TimeSeriesChart entries={data.entries} />
            ) : (
              <div className="rounded-2xl border border-lp-200 bg-lp-100 h-80 animate-pulse" />
            )}
          </section>

          {/* ── AI recommendations ── */}
          <section className="flex flex-col gap-4">
            <SectionHeading>AI Recommendations</SectionHeading>
            <RecommendationsPanel token={token} />
          </section>
        </div>

        <Footer />
      </div>
    </div>
  )
}
