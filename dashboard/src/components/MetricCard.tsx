import {
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine,
  Tooltip as RechartsTooltip,
} from 'recharts'
import type { MetricConfig, FeedEntry } from '../types'
import { scoreColor, COLOR_CLASSES, CHART_COLORS } from '../metrics'

interface Props {
  config: MetricConfig
  current: number
  sparklineData: FeedEntry[]
}

function fmt(v: number): string {
  if (!Number.isFinite(v)) return '—'
  return v % 1 === 0 ? String(v) : v.toFixed(1)
}

export function MetricCard({ config, current, sparklineData }: Props) {
  const health = scoreColor(config.scoreValue(current))
  const sub = Math.round(config.scoreValue(current))
  const { text, border } = COLOR_CLASSES[health]
  const chartColor = CHART_COLORS[config.key]

  const values = sparklineData.map((e) => e[config.key] as number).filter(Number.isFinite)
  const minVal = values.length ? Math.min(...values) : null
  const maxVal = values.length ? Math.max(...values) : null
  const avgVal = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null

  const chartData = sparklineData.map((e) => ({ v: e[config.key] as number }))

  return (
    <div className={`flex flex-col gap-2.5 p-4 rounded-xl border ${border} bg-white min-w-0`}>
      {/* Label row */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-medium text-lp-400 uppercase tracking-wider truncate">
          {config.label}
        </span>
        {/* Sub-score badge */}
        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${text} bg-lp-50 shrink-0`}>
          {sub}/100
        </span>
      </div>

      {/* Current value */}
      <div className="flex items-baseline gap-1">
        <span className={`font-mono text-2xl font-bold ${text} leading-none`}>
          {fmt(current)}
        </span>
        <span className="text-xs text-lp-400">{config.unit}</span>
      </div>

      {/* Healthy range */}
      <div className="flex items-center gap-1.5 text-[10px] text-lp-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
        <span>Healthy: <span className="text-lp-600 font-medium">{config.healthyRange}</span></span>
      </div>

      {/* Sparkline */}
      {chartData.length > 1 && (
        <div className="h-10 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 1, bottom: 1, left: 0, right: 0 }}>
              <defs>
                <linearGradient id={`grad-${config.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              {config.referenceMax !== undefined && (
                <ReferenceLine y={config.referenceMax} stroke="#34d399" strokeWidth={1} strokeDasharray="3 2" />
              )}
              {config.referenceMin !== undefined && (
                <ReferenceLine y={config.referenceMin} stroke="#34d399" strokeWidth={1} strokeDasharray="3 2" />
              )}
              <Area
                type="monotone"
                dataKey="v"
                stroke={chartColor}
                strokeWidth={1.5}
                fill={`url(#grad-${config.key})`}
                dot={false}
                isAnimationActive={false}
              />
              <RechartsTooltip
                contentStyle={{
                  background: '#FFFFFF',
                  border: '1px solid #D4BEFF',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: '#2D1060',
                }}
                formatter={(v: number) => [`${fmt(v)} ${config.unit}`, config.label]}
                labelFormatter={() => ''}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Min / avg / max over sparkline window */}
      {minVal !== null && avgVal !== null && maxVal !== null && (
        <div className="flex justify-between text-[10px] font-mono text-lp-400 pt-0.5">
          <span>↓ {fmt(minVal)}</span>
          <span className="text-lp-500 font-medium">avg {fmt(avgVal)}</span>
          <span>↑ {fmt(maxVal)}</span>
        </div>
      )}

      {/* Why it matters */}
      <p className="text-[10px] text-lp-300 leading-tight">{config.description}</p>
    </div>
  )
}
