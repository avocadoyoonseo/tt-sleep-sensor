import { scoreColor, sleepScoreLabel, COLOR_CLASSES } from '../metrics'

interface Props {
  score: number
  healthySensorCount?: number   // how many of the 5 sensors are in the green/yellow zone
}

export function SleepScoreHero({ score, healthySensorCount }: Props) {
  const color = scoreColor(score)
  const { text, border, ring } = COLOR_CLASSES[color]
  const label = sleepScoreLabel(score)

  // Half-circle arc length for an arc with radius 52 (matches the SVG path).
  const circumference = Math.PI * 52
  const progress = (score / 100) * circumference

  // Stroke color raw values for SVG (Tailwind can't set SVG stroke dynamically).
  const strokeColor =
    color === 'green' ? '#34d399' : color === 'yellow' ? '#fbbf24' : '#f87171'

  return (
    <div
      className={`flex flex-col items-center gap-3 p-6 rounded-2xl border ${border} bg-lp-100`}
    >
      <p className="text-sm font-medium text-lp-400 uppercase tracking-widest">
        Sleep Score
      </p>

      {/* Half-circle gauge */}
      <div className="relative w-40 h-20 overflow-hidden">
        <svg
          viewBox="0 0 120 64"
          className="w-full h-full"
          aria-hidden="true"
        >
          {/* Track */}
          <path
            d="M 8 60 A 52 52 0 0 1 112 60"
            fill="none"
            stroke="#E7E5E4"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Progress */}
          <path
            d="M 8 60 A 52 52 0 0 1 112 60"
            fill="none"
            stroke={strokeColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={`${circumference - progress}`}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>

        {/* Score number overlaid at the bottom center */}
        <div className="absolute inset-x-0 bottom-0 flex justify-center">
          <span className={`font-mono text-4xl font-bold ${text}`}>
            {Math.round(score)}
          </span>
        </div>
      </div>

      <span
        className={`text-lg font-semibold ${text} ring-1 ${ring} px-4 py-1 rounded-full`}
      >
        {label}
      </span>

      {healthySensorCount !== undefined && (
        <p className="text-xs text-lp-400 text-center">
          <span className="text-lp-700 font-medium">{healthySensorCount} of 5</span> sensors in healthy range
        </p>
      )}

      <p className="text-[10px] text-lp-300">
        Equal-weighted avg of CO₂, temp, humidity, noise, light
      </p>
    </div>
  )
}
