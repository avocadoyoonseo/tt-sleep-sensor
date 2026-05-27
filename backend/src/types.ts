export interface User {
  id: number
  email: string
  name: string
  password_hash: string
  created_at: string
}

export interface Reading {
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

export interface JwtPayload {
  userId: number
  email: string
}

export interface NightlySummary {
  night: string
  avg_co2: number
  avg_temp: number
  avg_humidity: number
  avg_noise: number
  avg_lux: number
  avg_score: number
  min_score: number
  max_score: number
}
