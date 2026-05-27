import type { ChannelData, FeedEntry } from './types'
import { THINGSPEAK_CHANNEL_ID, FEED_24H, API_BASE_URL } from './config'
import { generateMockData } from './mockData'

// If the channel ID is still the placeholder, serve generated demo data.
export const IS_DEMO = THINGSPEAK_CHANNEL_ID === '0000000'

// ── Token storage ─────────────────────────────────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem('tt_token')
}

export function setToken(token: string): void {
  localStorage.setItem('tt_token', token)
}

export function clearToken(): void {
  localStorage.removeItem('tt_token')
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: number
  email: string
  name: string
}

export async function login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json() as { token?: string; user?: AuthUser; error?: string }
  if (!res.ok) throw new Error(data.error ?? 'Login failed')
  return { token: data.token!, user: data.user! }
}

export async function register(
  email: string,
  name: string,
  password: string,
): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, password }),
  })
  const data = await res.json() as { token?: string; user?: AuthUser; error?: string }
  if (!res.ok) throw new Error(data.error ?? 'Registration failed')
  return { token: data.token!, user: data.user! }
}

// ── Data fetch (ThingSpeak raw format for backwards compat) ───────────────────

interface RawFeed {
  created_at: string
  entry_id: number
  field1: string | null
  field2: string | null
  field3: string | null
  field4: string | null
  field5: string | null
  field6: string | null
}

interface ThingSpeakResponse {
  feeds: RawFeed[]
}

function parseThingSpeakEntry(raw: RawFeed): FeedEntry | null {
  const co2   = Number(raw.field1)
  const tempF = Number(raw.field2)
  const hum   = Number(raw.field3)
  const noise = Number(raw.field4)
  const lux   = Number(raw.field5)
  const score = Number(raw.field6)
  if ([co2, tempF, hum, noise, lux, score].some(isNaN)) return null
  return { timestamp: new Date(raw.created_at), co2, tempF, humidity: hum, noise, lux, score }
}

// ── Backend feed format ───────────────────────────────────────────────────────

interface BackendFeed {
  id: number
  user_id: number
  timestamp: string
  co2: number
  temp_f: number
  humidity: number
  noise: number
  lux: number
  score: number
}

function parseBackendEntry(raw: BackendFeed): FeedEntry {
  return {
    timestamp: new Date(raw.timestamp),
    co2: raw.co2,
    tempF: raw.temp_f,
    humidity: raw.humidity,
    noise: raw.noise,
    lux: raw.lux,
    score: raw.score,
  }
}

// ── Main fetch — uses backend if token present, else ThingSpeak / demo ────────

export async function fetchChannelData(token?: string | null): Promise<ChannelData> {
  if (token) {
    const res = await fetch(`${API_BASE_URL}/data/feed?results=${FEED_24H}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 401) {
      clearToken()
      throw new Error('Session expired — please log in again')
    }
    if (!res.ok) throw new Error(`Backend responded ${res.status}`)
    const data = await res.json() as { feeds: BackendFeed[] }
    const entries = data.feeds.map(parseBackendEntry)
    return { entries, latest: entries.at(-1) ?? null, fetchedAt: new Date() }
  }

  if (IS_DEMO) return generateMockData()

  const url = `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/feeds.json?results=${FEED_24H}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`ThingSpeak responded ${res.status}`)
  const data: ThingSpeakResponse = await res.json()
  const entries = data.feeds.map(parseThingSpeakEntry).filter((e): e is FeedEntry => e !== null)
  return { entries, latest: entries.at(-1) ?? null, fetchedAt: new Date() }
}

// ── AI Recommendations ────────────────────────────────────────────────────────

export async function fetchRecommendation(token: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/recommendations`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json() as { recommendation?: string; error?: string }
  if (!res.ok) throw new Error(data.error ?? 'Failed to fetch recommendation')
  return data.recommendation ?? 'No recommendation available.'
}
