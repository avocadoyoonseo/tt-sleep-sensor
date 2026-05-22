// Metric definitions and color-band scoring logic.
// Scores are linearly interpolated between the 100-point and 0-point bands
// from the spec, then clamped to [0, 100].
// Color thresholds: green ≥ 80, yellow 50–79, red < 50.

import type { MetricConfig, ScoreColor } from './types'

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

// Linear interpolation: score = 100 when v ≤ idealLow, 0 when v ≥ worstHigh.
function linearScore(v: number, idealLow: number, worstHigh: number): number {
  if (v <= idealLow) return 100
  if (v >= worstHigh) return 0
  return clamp(100 - ((v - idealLow) / (worstHigh - idealLow)) * 100, 0, 100)
}

// For metrics with a "good window" (temp, humidity): distance from the window
// maps to a penalty. Inside the window → 100.
function windowScore(
  v: number,
  windowLow: number,
  windowHigh: number,
  worstLow: number,
  worstHigh: number,
): number {
  if (v >= windowLow && v <= windowHigh) return 100
  if (v < windowLow)
    return clamp(((v - worstLow) / (windowLow - worstLow)) * 100, 0, 100)
  return clamp(((worstHigh - v) / (worstHigh - windowHigh)) * 100, 0, 100)
}

export const METRICS: MetricConfig[] = [
  {
    key: 'co2',
    label: 'CO₂',
    unit: 'ppm',
    healthyRange: '< 800 ppm',
    description: 'High CO₂ increases micro-arousals and shortens deep sleep.',
    referenceMax: 800,
    // Good: < 800 ppm → 100; Bad: > 1500 ppm → 0
    scoreValue: (v) => linearScore(v, 800, 1500),
  },
  {
    key: 'tempF',
    label: 'Temperature',
    unit: '°F',
    healthyRange: '65–68 °F',
    description: 'Core body temp must drop at sleep onset; cool rooms help.',
    referenceMin: 65,
    referenceMax: 68,
    // Good: 65–68 °F → 100; Bad: < 55 °F or > 80 °F → 0
    scoreValue: (v) => windowScore(v, 65, 68, 55, 80),
  },
  {
    key: 'humidity',
    label: 'Humidity',
    unit: '%RH',
    healthyRange: '30–50 %RH',
    description: 'Too dry irritates airways; too humid encourages mold.',
    referenceMin: 30,
    referenceMax: 50,
    // Good: 30–50 % → 100; Bad: < 20 % or > 70 % → 0
    scoreValue: (v) => windowScore(v, 30, 50, 20, 70),
  },
  {
    key: 'noise',
    label: 'Noise',
    unit: 'dB(A)',
    healthyRange: '< 30 dB(A)',
    description: 'Even sub-conscious noise above 30 dB(A) causes micro-awakenings (WHO).',
    referenceMax: 30,
    // Good: < 30 dB(A) → 100; Bad: > 50 dB(A) → 0
    scoreValue: (v) => linearScore(v, 30, 50),
  },
  {
    key: 'lux',
    label: 'Light',
    unit: 'lux',
    healthyRange: '< 5 lux',
    description: 'Even dim light suppresses melatonin and delays sleep onset.',
    referenceMax: 5,
    // Good: < 5 lux → 100; Bad: > 50 lux → 0
    scoreValue: (v) => linearScore(v, 5, 50),
  },
  {
    key: 'score',
    label: 'Sleep Score',
    unit: '/ 100',
    healthyRange: '≥ 80',
    description: 'Equal-weighted average of all 5 environment sub-scores.',
    scoreValue: (v) => v,
  },
]

export function scoreColor(score: number): ScoreColor {
  if (score >= 80) return 'green'
  if (score >= 50) return 'yellow'
  return 'red'
}

export function sleepScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 50) return 'Good'
  return 'Poor'
}

export const COLOR_CLASSES: Record<ScoreColor, { text: string; bg: string; border: string; ring: string }> = {
  green:  { text: 'text-emerald-700',  bg: 'bg-emerald-50',  border: 'border-emerald-200',  ring: 'ring-emerald-400' },
  yellow: { text: 'text-amber-700',    bg: 'bg-amber-50',    border: 'border-amber-200',    ring: 'ring-amber-400'   },
  red:    { text: 'text-rose-700',     bg: 'bg-rose-50',     border: 'border-rose-200',     ring: 'ring-rose-500'    },
}

export const CHART_COLORS: Record<MetricConfig['key'], string> = {
  co2:      '#c084fc', // purple-400
  tempF:    '#fb923c', // orange-400 — warm contrast
  humidity: '#818cf8', // indigo-400
  noise:    '#f472b6', // pink-400
  lux:      '#b45309', // amber-700 — dark enough to read on light bg
  score:    '#a78bfa', // violet-400
}
