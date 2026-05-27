import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import db from '../db.js'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_in_prod'

router.post('/register', (req, res) => {
  const { email, name, password } = req.body as {
    email?: string
    name?: string
    password?: string
  }

  if (!email || !name || !password) {
    res.status(400).json({ error: 'email, name, and password are required' })
    return
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' })
    return
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) {
    res.status(409).json({ error: 'Email already registered' })
    return
  }

  const password_hash = bcrypt.hashSync(password, 10)
  const result = db
    .prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)')
    .run(email.toLowerCase().trim(), name.trim(), password_hash)

  const token = jwt.sign(
    { userId: result.lastInsertRowid, email: email.toLowerCase().trim() },
    JWT_SECRET,
    { expiresIn: '30d' },
  )

  res.status(201).json({
    token,
    user: { id: result.lastInsertRowid, email: email.toLowerCase().trim(), name: name.trim() },
  })
})

router.post('/login', (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string }

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' })
    return
  }

  const user = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(email.toLowerCase().trim()) as
    | { id: number; email: string; name: string; password_hash: string }
    | undefined

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: '30d',
  })

  res.json({ token, user: { id: user.id, email: user.email, name: user.name } })
})

export default router
