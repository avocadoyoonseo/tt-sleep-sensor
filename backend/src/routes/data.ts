import { Router } from 'express'
import db from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import type { AuthRequest } from '../middleware/auth.js'
import type { Reading } from '../types.js'

const router = Router()

// ESP32 posts here every 60s — authenticated by X-Device-Key + user_id in body.
router.post('/ingest', (req, res) => {
  const deviceKey = req.headers['x-device-key']
  if (!deviceKey || deviceKey !== process.env.DEVICE_INGEST_KEY) {
    res.status(401).json({ error: 'Invalid device key' })
    return
  }

  const { user_id, co2, temp_f, humidity, noise, lux, score, timestamp } = req.body as {
    user_id?: number
    co2?: number
    temp_f?: number
    humidity?: number
    noise?: number
    lux?: number
    score?: number
    timestamp?: string
  }

  if (!user_id) {
    res.status(400).json({ error: 'user_id is required' })
    return
  }

  if ([co2, temp_f, humidity, noise, lux, score].some((v) => typeof v !== 'number' || isNaN(v))) {
    res.status(400).json({ error: 'Invalid or missing sensor values' })
    return
  }

  const ts = timestamp ?? new Date().toISOString()

  db.prepare(
    'INSERT INTO readings (user_id, timestamp, co2, temp_f, humidity, noise, lux, score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(user_id, ts, co2, temp_f, humidity, noise, lux, score)

  res.json({ ok: true })
})

// Dashboard fetches authenticated user's readings.
router.get('/feed', requireAuth, (req: AuthRequest, res) => {
  const results = Math.min(Number(req.query.results) || 1440, 1440)

  const rows = db
    .prepare(
      'SELECT * FROM readings WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?',
    )
    .all(req.userId, results) as Reading[]

  res.json({ feeds: rows.reverse() })
})

// Nightly summary — last N nights aggregated.
router.get('/summary', requireAuth, (req: AuthRequest, res) => {
  const nights = Math.min(Number(req.query.nights) || 7, 30)

  const rows = db
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
       WHERE user_id = ?
       GROUP BY date(timestamp)
       ORDER BY night DESC
       LIMIT ?`,
    )
    .all(req.userId, nights)

  res.json({ summary: rows })
})

export default router
