import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRouter from './routes/auth.js'
import dataRouter from './routes/data.js'
import recommendationsRouter from './routes/recommendations.js'

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(cors())
app.use(express.json())

app.use('/auth', authRouter)
app.use('/data', dataRouter)
app.use('/recommendations', recommendationsRouter)

app.get('/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }))

app.listen(PORT, () => {
  console.log(`[server] Running on http://localhost:${PORT}`)
})
