import type { ChannelData, FeedEntry } from './types'
import { THINGSPEAK_CHANNEL_ID, FEED_24H } from './config'
import { generateMockData } from './mockData'

// If the channel ID is still the placeholder, serve generated demo data.
export const IS_DEMO = THINGSPEAK_CHANNEL_ID === '0000000'

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

function parseEntry(raw: RawFeed): FeedEntry | null {
  // All fieldN values come back as strings; skip entries missing key fields.
  const co2   = Number(raw.field1)
  const tempF = Number(raw.field2)
  const hum   = Number(raw.field3)
  const noise = Number(raw.field4)
  const lux   = Number(raw.field5)
  const score = Number(raw.field6)

  if ([co2, tempF, hum, noise, lux, score].some(isNaN)) return null

  return {
    timestamp: new Date(raw.created_at),
    co2,
    tempF,
    humidity: hum,
    noise,
    lux,
    score,
  }
}

export async function fetchChannelData(): Promise<ChannelData> {
  if (IS_DEMO) return generateMockData()

  const url = `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/feeds.json?results=${FEED_24H}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`ThingSpeak responded ${res.status}`)

  const data: ThingSpeakResponse = await res.json()

  const entries = data.feeds
    .map(parseEntry)
    .filter((e): e is FeedEntry => e !== null)

  return {
    entries,
    latest: entries.length > 0 ? entries[entries.length - 1] : null,
    fetchedAt: new Date(),
  }
}
