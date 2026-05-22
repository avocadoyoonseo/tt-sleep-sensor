// Set your ThingSpeak channel ID here, or via VITE_THINGSPEAK_CHANNEL_ID env var.
export const THINGSPEAK_CHANNEL_ID: string =
  import.meta.env.VITE_THINGSPEAK_CHANNEL_ID ?? '0000000';

// Number of entries to fetch for the 24-hour time-series view (60s cadence).
export const FEED_24H = 1440;

// Auto-refresh interval (ms).
export const REFRESH_INTERVAL_MS = 60_000;

// GitHub repo URL shown in the footer.
export const GITHUB_URL = 'https://github.com/your-team/tt-sleep-sensor';
