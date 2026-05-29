import type { FeedEntry } from '../types'
import { METRICS, scoreColor, COLOR_CLASSES, CHART_COLORS } from '../metrics'

interface Props {
  latest: FeedEntry
}

// The score metric itself isn't a sub-score input, so filter it out.
const SUB_METRICS = METRICS.filter((m) => m.key !== 'score')

export function ScoreBreakdown({ latest }: Props) {
  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl border border-lp-200 bg-lp-100">
      <h2 className="text-xs font-semibold text-lp-500 uppercase tracking-widest">
        Score Breakdown · 20% each
      </h2>

      <div className="flex flex-col gap-2.5">
        {SUB_METRICS.map((cfg) => {
          const rawValue = latest[cfg.key] as number
          const sub = Math.round(cfg.scoreValue(rawValue))
          const color = scoreColor(sub)
          const { text } = COLOR_CLASSES[color]
          const barColor = CHART_COLORS[cfg.key]

          return (
            <div key={cfg.key} className="flex items-center gap-3">
              {/* Label + value */}
              <div className="w-28 shrink-0">
                <span className="text-xs font-medium text-lp-700">{cfg.label}</span>
                <div className="text-xs text-lp-400 font-mono">
                  {Number.isFinite(rawValue)
                    ? `${rawValue % 1 === 0 ? rawValue : rawValue.toFixed(1)} ${cfg.unit}`
                    : '—'}
                </div>
              </div>

              {/* Bar */}
              <div
                className="flex-1 h-2 rounded-full overflow-hidden"
                style={{ background: barColor + '38' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${sub}%`,
                    background: barColor,
                  }}
                />
              </div>

              {/* Sub-score */}
              <span className={`w-9 text-right text-xs font-mono font-semibold ${text}`}>
                {sub}
              </span>
            </div>
          )
        })}
      </div>

      <p className="text-[10px] text-lp-300 pt-1">
        Each metric linearly interpolated between its healthy band (100 pts) and worst-case band (0 pts). Equal weight per the project spec.
      </p>
    </div>
  )
}
