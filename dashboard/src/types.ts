// Types for parsed ThingSpeak data.

export interface FeedEntry {
  timestamp: Date;
  co2: number;       // ppm
  tempF: number;     // °F
  humidity: number;  // %RH
  noise: number;     // dB(A)
  lux: number;       // lux
  score: number;     // 0-100
}

export interface ChannelData {
  entries: FeedEntry[];
  latest: FeedEntry | null;
  fetchedAt: Date;
}

export type ScoreColor = 'green' | 'yellow' | 'red';

export interface MetricConfig {
  key: keyof Omit<FeedEntry, 'timestamp'>;
  label: string;
  unit: string;
  // Short string shown on the card, e.g. "65–68 °F"
  healthyRange: string;
  // One-liner explaining why this metric matters for sleep.
  description: string;
  // Optional reference lines drawn on the time-series chart (ideal zone).
  referenceMin?: number;
  referenceMax?: number;
  // Returns a 0-100 score for color-coding purposes.
  scoreValue: (v: number) => number;
}
