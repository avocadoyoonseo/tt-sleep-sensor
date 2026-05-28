// Realistic fake data for development / demo when no ThingSpeak channel is configured.
// Simulates a 24-hour bedroom night: CO₂ builds up, light/noise are low, temp dips.
// Uses deterministic math (no Math.random) so the chart looks stable across reloads.

import type { ChannelData, FeedEntry } from './types'
import { calculateSleepScore } from './metrics'

// Smooth periodic noise: sum of low-frequency sine waves.
function wave(t: number, period: number, amplitude: number, phase = 0): number {
  return amplitude * Math.sin((2 * Math.PI * t) / period + phase)
}

// Hour of day from a fractional position in [0, 1].
function hourOf(frac: number): number {
  return frac * 24
}

function makeCo2(hour: number, i: number): number {
  // Baseline ~700, rises overnight (8 pm – 7 am), peak ~1050 around 3 am.
  const night = Math.max(0, -Math.cos(((hour - 3) / 24) * 2 * Math.PI)) * 280
  const drift = wave(i, 180, 30, 1.1) + wave(i, 60, 12, 0.3)
  return Math.round(700 + night + drift)
}

function makeTempF(hour: number, i: number): number {
  // 72 °F during the day, dips to ~65 °F overnight (set thermostat scenario).
  const dayNight = -3.5 * Math.cos(((hour - 14) / 24) * 2 * Math.PI)
  const drift = wave(i, 240, 0.4, 0.8)
  return +(67.5 + dayNight + drift).toFixed(1)
}

function makeHumidity(hour: number, i: number): number {
  // 38–48 %RH, slightly higher late at night.
  const night = 4 * Math.max(0, Math.cos(((hour - 2) / 24) * 2 * Math.PI))
  const drift = wave(i, 150, 1.5, 2.1)
  return +(42 + night + drift).toFixed(1)
}

function makeNoise(hour: number, i: number): number {
  // Quiet at night (~22 dB), louder during waking hours (~34 dB).
  // Occasional spikes (conversation, traffic) during the day.
  const base = hour >= 7 && hour <= 22 ? 34 : 22
  const drift = wave(i, 40, 4, 0.5) + Math.abs(wave(i, 13, 3, 1.7))
  return +(base + drift).toFixed(1)
}

function makeLux(hour: number, i: number): number {
  // Near-zero 10 pm – 7 am; rises sharply after sunrise, peaks ~200 lux midday.
  if (hour >= 22 || hour < 7) return +(Math.abs(wave(i, 30, 0.4, 0.9))).toFixed(1)
  const daylight = 180 * Math.max(0, Math.sin(((hour - 7) / 15) * Math.PI))
  const drift = wave(i, 50, 5, 1.2)
  return +(daylight + drift).toFixed(1)
}

type SensorValues = { co2: number; tempF: number; humidity: number; noise: number; lux: number }

function computeScore(s: SensorValues): number {
  return calculateSleepScore(
    s.lux,
    s.tempF,
    s.co2,
    s.humidity,
  )
}

export function generateMockData(): ChannelData {
  const now = Date.now()
  // 1440 entries = 24 hours at 60-second cadence.
  const COUNT = 1440
  const entries: FeedEntry[] = []

  for (let i = 0; i < COUNT; i++) {
    const timestamp = new Date(now - (COUNT - 1 - i) * 60_000)
    const frac = i / COUNT
    const hour = hourOf(frac)

    const co2 = makeCo2(hour, i)
    const tempF = makeTempF(hour, i)
    const humidity = makeHumidity(hour, i)
    const noise = makeNoise(hour, i)
    const lux = makeLux(hour, i)
    const score = computeScore({ co2, tempF, humidity, noise, lux })

    entries.push({ timestamp, co2, tempF, humidity, noise, lux, score })
  }

  return {
    entries,
    latest: entries[entries.length - 1],
    fetchedAt: new Date(),
  }
}
