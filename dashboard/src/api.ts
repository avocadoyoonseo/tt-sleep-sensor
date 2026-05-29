import type { ChannelData, FeedEntry } from "./types";
import { FEED_24H, API_BASE_URL } from "./config";

// ── Token storage ─────────────────────────────────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem("tt_token");
}

export function setToken(token: string): void {
  localStorage.setItem("tt_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("tt_token");
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: number;
  email: string;
  name: string;
}

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json()) as {
    token?: string;
    user?: AuthUser;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? "Login failed");
  return { token: data.token!, user: data.user! };
}

export async function register(
  email: string,
  name: string,
  password: string,
): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name, password }),
  });
  const data = (await res.json()) as {
    token?: string;
    user?: AuthUser;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? "Registration failed");
  return { token: data.token!, user: data.user! };
}

// ── Backend feed format ───────────────────────────────────────────────────────

interface BackendFeed {
  id: number;
  user_id: number;
  timestamp: string;
  co2: number;
  temp_f: number;
  humidity: number;
  noise: number;
  lux: number;
  score: number;
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
  };
}

// ── Main fetch ────────────────────────────────────────────────────────────────

export async function fetchChannelData(token: string): Promise<ChannelData> {
  const res = await fetch(`${API_BASE_URL}/data/feed?results=${FEED_24H}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    clearToken();
    throw new Error("Session expired — please log in again");
  }
  if (!res.ok) throw new Error(`Backend responded ${res.status}`);
  const data = (await res.json()) as { feeds: BackendFeed[] };
  const entries = data.feeds.map(parseBackendEntry);
  return { entries, latest: entries[entries.length - 1] ?? null, fetchedAt: new Date() };
}

// ── AI Recommendations ────────────────────────────────────────────────────────

export async function fetchRecommendation(token: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/recommendations`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as {
    recommendation?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? "Failed to fetch recommendation");
  return data.recommendation ?? "No recommendation available.";
}
