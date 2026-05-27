import { Router } from 'express'
import OpenAI from 'openai'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import type { AuthRequest } from '../middleware/auth.js'
import type { NightlySummary, Reading } from '../types.js'

const router = Router()

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  if (!process.env.OPENAI_API_KEY) {
    res.status(503).json({ error: 'OpenAI API key not configured on server' })
    return
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  // ── Retrieval: last 7 nightly summaries + the single latest reading ────────
  const nights = db
    .prepare(
      `SELECT
        date(timestamp)         AS night,
        round(avg(co2), 1)      AS avg_co2,
        round(avg(temp_f), 1)   AS avg_temp,
        round(avg(humidity), 1) AS avg_humidity,
        round(avg(noise), 1)    AS avg_noise,
        round(avg(lux), 1)      AS avg_lux,
        round(avg(score), 1)    AS avg_score,
        round(min(score), 1)    AS min_score,
        round(max(score), 1)    AS max_score
       FROM readings
       WHERE user_id = ? AND timestamp >= datetime('now', '-7 days')
       GROUP BY date(timestamp)
       ORDER BY night DESC
       LIMIT 7`,
    )
    .all(req.userId) as NightlySummary[]

  if (nights.length === 0) {
    res.json({
      recommendation:
        'No data yet. Recommendations will appear here after your first night of readings.',
      nights_analyzed: 0,
    })
    return
  }

  const latest = db
    .prepare('SELECT * FROM readings WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1')
    .get(req.userId) as Reading | undefined

  // ── Augmentation: build structured context string ─────────────────────────
  const nightLines = nights
    .map(
      (r) =>
        `${r.night}: score ${r.avg_score}/100 | CO₂ ${r.avg_co2}ppm | ` +
        `temp ${r.avg_temp}°F | humidity ${r.avg_humidity}%RH | ` +
        `noise ${r.avg_noise}dB | light ${r.avg_lux}lux`,
    )
    .join('\n')

  const currentLine = latest
    ? `Current reading — CO₂: ${latest.co2}ppm | temp: ${latest.temp_f}°F | ` +
      `humidity: ${latest.humidity}%RH | noise: ${latest.noise}dB | ` +
      `light: ${latest.lux}lux | score: ${latest.score}/100`
    : ''

  const context = [
    `User's nightly sleep environment (last ${nights.length} night${nights.length > 1 ? 's' : ''}):`,
    nightLines,
    currentLine,
    '',
    'Sleep science thresholds:',
    '- CO₂: ideal <800ppm, poor >1500ppm',
    '- Temperature: ideal 65–68°F',
    '- Humidity: ideal 30–50%RH',
    '- Noise: ideal <30dB(A) (WHO guideline)',
    '- Light: ideal <5 lux (melatonin suppression threshold)',
  ]
    .filter(Boolean)
    .join('\n')

  // ── Generation ─────────────────────────────────────────────────────────────
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a sleep environment coach. Based on real bedroom sensor data, give 3–4 concise, actionable bullet points to improve sleep quality. Focus on the worst-performing metrics. Be specific to the actual numbers — do not give generic sleep hygiene advice that ignores the readings. Start each bullet with "•".`,
      },
      { role: 'user', content: context },
    ],
    max_tokens: 350,
    temperature: 0.4,
  })

  const recommendation =
    completion.choices[0]?.message?.content ?? 'Unable to generate recommendation.'

  res.json({ recommendation, nights_analyzed: nights.length })
})

export default router
