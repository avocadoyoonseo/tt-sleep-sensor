// Metric definitions, sleep scoring algorithm, and color utilities.

import type { MetricConfig, ScoreColor } from './types'

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

// ======================================================
// SLEEP SCORE CALCULATION
// ======================================================

export function calculateSleepScore(
  lux: number,
  tempF: number,
  co2: number,
  humidity: number,
): number {

  // ---------- LIGHT PENALTY ----------
  // 10–30 lux: strong effect
  // 30+ lux: flatter effect

  let lightPenalty = 0

  if (lux > 10 && lux <= 30) {
    lightPenalty = (lux - 10) * 1.1
  }

  if (lux > 30) {
    lightPenalty =
      (20 * 1.1) +
      ((lux - 30) * 0.1)
  }

  // ---------- TEMPERATURE PENALTY ----------
  // 68–77°F: mild effect
  // Above 77°F: stronger nonlinear effect

  let tempPenalty = 0

  if (tempF > 68 && tempF <= 77) {
    tempPenalty = (tempF - 68) * 0.15
  }

  if (tempF > 77) {
    tempPenalty =
      (9 * 0.15) +
      ((tempF - 77) * 1.5)
  }

  // ---------- CO2 PENALTY ----------
  // Exponential scaling above 750 ppm

  let co2Penalty = 0

  if (co2 > 750) {
    const excessCO2 = co2 - 750

    co2Penalty =
      0.5 * (Math.exp(0.0023 * excessCO2) - 1)

    // Physiological ceiling cap
    co2Penalty = Math.min(co2Penalty, 25)
  }

  // ---------- HUMIDITY PENALTY ----------
  // Humidity interacts with heat

  let humidityPenalty = 0

  if (humidity > 50) {
    const excessRH = humidity - 50

    // Parabolic growth
    const baseHumidityLoss =
      (excessRH ** 2) * 0.005

    // Heat amplifies humidity discomfort
    if (tempF >= 77) {

      // Convert Fahrenheit difference into
      // Celsius-sized scaling steps
      const tempMultiplier =
        1 + ((tempF - 77) / 1.8) * 0.4

      humidityPenalty =
        baseHumidityLoss * tempMultiplier

    } else {
      humidityPenalty = baseHumidityLoss
    }

    // Ceiling cap
    humidityPenalty = Math.min(humidityPenalty, 20)
  }

  // ---------- FINAL SCORE ----------

  const totalPenalty =
    lightPenalty +
    tempPenalty +
    co2Penalty +
    humidityPenalty

  const sleepScore =
    clamp(100 - totalPenalty, 0, 100)

  return Math.round(sleepScore)
}

// ======================================================
// METRIC DEFINITIONS
// ======================================================

export const METRICS: MetricConfig[] = [
  {
    key: 'co2',
    label: 'CO₂',
    unit: 'ppm',
    healthyRange: '< 750 ppm',
    description: 'High CO₂ increases micro-arousals and shortens deep sleep.',
    referenceMax: 750,
    scoreValue: (v: number) => {
      if (v <= 750) return 100
      const excess = v - 750
      const penalty = 0.5 * (Math.exp(0.0023 * excess) - 1)
      return Math.round(clamp(100 - Math.min(penalty, 25), 0, 100))
    },
  },
  {
    key: 'tempF',
    label: 'Temperature',
    unit: '°F',
    healthyRange: '68–77 °F',
    description: 'Core body temperature must drop at sleep onset; cooler rooms help.',
    referenceMin: 68,
    referenceMax: 77,
    scoreValue: (v: number) => {
      let penalty = 0
      if (v > 68 && v <= 77) penalty = (v - 68) * 0.15
      if (v > 77) penalty = (9 * 0.15) + ((v - 77) * 1.5)
      return Math.round(clamp(100 - penalty, 0, 100))
    },
  },
  {
    key: 'humidity',
    label: 'Humidity',
    unit: '%RH',
    healthyRange: '30–50 %RH',
    description: 'Too dry irritates airways; too humid encourages mold.',
    referenceMin: 30,
    referenceMax: 50,
    scoreValue: (v: number) => {
      if (v <= 50) return 100
      const excess = v - 50
      const penalty = Math.min((excess ** 2) * 0.005, 20)
      return Math.round(clamp(100 - penalty, 0, 100))
    },
  },
  {
    key: 'noise',
    label: 'Noise',
    unit: 'dB(A)',
    healthyRange: '< 30 dB(A)',
    description: 'Even sub-conscious noise above 30 dB(A) causes micro-awakenings (WHO).',
    referenceMax: 30,
    scoreValue: (v: number) => {
      if (v <= 30) return 100
      if (v >= 50) return 0
      return Math.round(clamp(100 - ((v - 30) / 20) * 100, 0, 100))
    },
  },
  {
    key: 'lux',
    label: 'Light',
    unit: 'lux',
    healthyRange: '< 10 lux',
    description: 'Even dim light suppresses melatonin and delays sleep onset.',
    referenceMax: 10,
    scoreValue: (v: number) => {
      let penalty = 0
      if (v > 10 && v <= 30) penalty = (v - 10) * 1.1
      if (v > 30) penalty = (20 * 1.1) + ((v - 30) * 0.1)
      return Math.round(clamp(100 - penalty, 0, 100))
    },
  },
  {
    key: 'score',
    label: 'Sleep Score',
    unit: '/ 100',
    healthyRange: '≥ 80',
    description: 'Penalty-based environmental sleep quality score.',
    scoreValue: (v: number) => v,
  },
]

// ======================================================
// SCORE COLORS / LABELS
// ======================================================

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

// ======================================================
// TAILWIND COLOR CLASSES
// ======================================================

export const COLOR_CLASSES: Record<
  ScoreColor,
  {
    text: string
    bg: string
    border: string
    ring: string
  }
> = {
  green: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-500/40',
    ring: 'ring-emerald-400/40',
  },

  yellow: {
    text: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-500/40',
    ring: 'ring-amber-400/40',
  },

  red: {
    text: 'text-rose-400',
    bg: 'bg-rose-400/10',
    border: 'border-rose-500/40',
    ring: 'ring-rose-400/40',
  },
}

// ======================================================
// CHART COLORS
// ======================================================

export const CHART_COLORS: Record<
  MetricConfig['key'],
  string
> = {
  co2: '#c084fc',
  tempF: '#fb923c',
  humidity: '#818cf8',
  noise: '#f472b6',
  lux: '#fcd34d',
  score: '#a78bfa',
}