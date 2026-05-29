import { useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip as RechartsTooltip,
} from 'recharts'
import type { FeedEntry } from '../types'
import { METRICS, CHART_COLORS } from '../metrics'

interface Props {
  entries: FeedEntry[]
}

type Window = '1h' | '6h' | '24h'

const WINDOW_LABELS: Record<Window, string> = { '1h': '1 Hour', '6h': '6 Hours', '24h': '24 Hours' }
// At 60-second cadence, how many entries each window holds.
const WINDOW_ENTRIES: Record<Window, number> = { '1h': 60, '6h': 360, '24h': 1440 }

// Format a Date to "h:mm AM/PM" (12-hour, per project convention).
function fmt12h(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

// Thin array to at most maxPoints for chart performance on mobile.
function thin<T>(arr: T[], maxPoints: number): T[] {
  if (arr.length <= maxPoints) return arr
  const step = Math.ceil(arr.length / maxPoints)
  return arr.filter((_, i) => i % step === 0)
}

const METRIC_KEYS = METRICS.filter((m) => m.key !== 'score').map((m) => m.key)

export function TimeSeriesChart({ entries }: Props) {
  const [window, setWindow] = useState<Window>('24h')
  const [visible, setVisible] = useState<Record<string, boolean>>(
    Object.fromEntries(METRIC_KEYS.map((k) => [k, true])),
  )

  const windowEntries = entries.slice(-WINDOW_ENTRIES[window])

  const data = thin(
    windowEntries.map((e) => ({
      t: fmt12h(e.timestamp),
      co2: e.co2,
      tempF: e.tempF,
      humidity: e.humidity,
      noise: e.noise,
      lux: e.lux,
    })),
    240,
  )

  function toggleMetric(key: string) {
    setVisible((prev: Record<string, boolean>) => ({ ...prev, [key]: !prev[key] }))
  }

  // Collect reference lines for currently visible metrics.
  const refLines: { y: number; label: string; color: string }[] = []
  METRICS.forEach((cfg) => {
    if (cfg.key === 'score' || !visible[cfg.key]) return
    if (cfg.referenceMax !== undefined)
      refLines.push({ y: cfg.referenceMax, label: `${cfg.label} max`, color: CHART_COLORS[cfg.key] })
    if (cfg.referenceMin !== undefined)
      refLines.push({ y: cfg.referenceMin, label: `${cfg.label} min`, color: CHART_COLORS[cfg.key] })
  })

  return (
    <div className="flex flex-col gap-4 p-4 rounded-2xl border border-lp-200 bg-lp-100">
      {/* Header row: title + window selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-lp-700">
          Environment History
        </h2>

        {/* Time window buttons */}
        <div className="flex rounded-lg overflow-hidden border border-lp-200 text-xs">
          {(Object.keys(WINDOW_LABELS) as Window[]).map((w) => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              className={`px-3 py-1.5 transition-colors ${
                window === w
                  ? 'bg-lp-200 text-lp-700 font-semibold'
                  : 'text-lp-400 hover:bg-lp-50'
              }`}
            >
              {WINDOW_LABELS[w]}
            </button>
          ))}
        </div>
      </div>

      {/* Metric toggle buttons */}
      <div className="flex flex-wrap gap-1.5">
        {METRIC_KEYS.map((key) => {
          const cfg = METRICS.find((m) => m.key === key)!
          const on = visible[key]
          return (
            <button
              key={key}
              onClick={() => toggleMetric(key)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${
                on ? 'opacity-100 border-lp-300' : 'opacity-40 border-lp-200'
              }`}
              style={{ color: on ? CHART_COLORS[key] : '#475569' }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ background: on ? CHART_COLORS[key] : '#334155' }}
              />
              {cfg.label}
            </button>
          )
        })}
      </div>

      {/* Chart */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="t"
              tick={{ fontSize: 10, fill: '#94A3B8' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94A3B8' }}
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <RechartsTooltip
              contentStyle={{
                background: '#1E293B',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#E2E8F0',
              }}
            />
            {/* Healthy-zone reference lines (dashed, subtle) */}
            {refLines.map((r) => (
              <ReferenceLine
                key={`${r.label}`}
                y={r.y}
                stroke={r.color}
                strokeWidth={1}
                strokeDasharray="4 3"
                strokeOpacity={0.4}
              />
            ))}
            {METRIC_KEYS.map((key) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={CHART_COLORS[key]}
                strokeWidth={1.5}
                dot={false}
                hide={!visible[key]}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[10px] text-lp-300">
        Dashed lines mark healthy-zone thresholds. Data from SCD41 (CO₂/temp/humidity), BH1750 (light), INMP441 I²S mic (noise). 60-second cadence.
      </p>
    </div>
  )
}
