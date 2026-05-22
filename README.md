# tt-sleep-sensor

Real-time bedroom sleep environment monitor. An ESP32 reads 5 environmental sensors every 60 seconds, computes a 0–100 sleep quality score, displays it on an OLED, and streams data to a React dashboard via ThingSpeak.

---

## Hardware

| Component | Role |
|---|---|
| ESP32-WROOM-32E | Microcontroller |
| Sensirion SCD41 | CO₂ + Temperature + Humidity (I²C) |
| BH1750 | Ambient Light in lux (I²C) |
| INMP441 | Noise level in dB(A) (I²S) |
| DS3231 RTC | Real-time clock (I²C) |
| SSD1309 OLED 2.42″ | On-device display (I²C) |

---

## How the Sleep Score Works

Each sensor produces a 0–100 sub-score. The final score is an **equal-weighted average (20% each)**.

| Metric | Healthy Range | Scoring |
|---|---|---|
| CO₂ | < 800 ppm | 100 at ≤800, 0 at ≥1500, linear between |
| Temperature | 65–68 °F | 100 inside window, linear decay to 0 outside |
| Humidity | 30–50 %RH | 100 inside window, linear decay to 0 outside |
| Noise | < 30 dB(A) | 100 at ≤30, 0 at ≥50, linear between |
| Light | < 5 lux | 100 at ≤5, 0 at ≥50, linear between |

**Color bands:** 🟢 Excellent ≥ 80 · 🟡 Good 50–79 · 🔴 Poor < 50

---

## Project Structure

```
tt-sleep-sensor/
├── dashboard/          # React + TypeScript web dashboard
│   ├── src/
│   │   ├── components/ # Header, MetricCard, TimeSeriesChart, etc.
│   │   ├── api.ts      # ThingSpeak fetch + response parsing
│   │   ├── metrics.ts  # Scoring functions + metric definitions
│   │   ├── mockData.ts # Deterministic demo data (no API key needed)
│   │   ├── config.ts   # Channel ID, refresh interval, env vars
│   │   └── types.ts    # FeedEntry, ChannelData, MetricConfig
│   └── ...
└── firmware/           # Arduino/C++ ESP32 firmware
    ├── cloud.cpp       # WiFiManager + ThingSpeak upload module
    ├── cloud.h
    └── secrets.example.h
```

---

## Dashboard Setup

```bash
cd dashboard
npm install
npm run dev       # http://localhost:5173
```

By default the dashboard runs in **demo mode** with generated mock data. To connect to a real ThingSpeak channel:

```bash
cp .env.example .env
# set VITE_THINGSPEAK_CHANNEL_ID=your_channel_id in .env
```

### Build for production

```bash
npm run build     # output in dist/
```

---

## Firmware Setup

1. Copy `firmware/secrets.example.h` → `firmware/secrets.h` and fill in your values:

```cpp
#define WIFI_AP_PASSWORD   "yourpassword"
#define THINGSPEAK_CHANNEL_ID  1234567UL
#define THINGSPEAK_WRITE_KEY   "XXXXXXXXXXXXXXXX"
```

2. Install libraries via Arduino Library Manager:
   - `ThingSpeak` (Mathworks)
   - `WiFiManager` (tzapu)

3. Flash to ESP32. On first boot, join the `TT-Sleep-Setup` WiFi AP from your phone to configure credentials.

> `secrets.h` is gitignored — never commit it.

---

## Data Flow

```
Sensors → ESP32 (every 60s) → ThingSpeak REST API → Dashboard fetch → React state → Recharts
```

- ThingSpeak free tier: 6 fields, public channel, 60s minimum write cadence
- Dashboard fetches last 1440 entries (24h at 60s cadence) and auto-refreshes every 60s
- The OLED is the primary output — device works fully standalone without WiFi

---

## Tech Stack

**Dashboard:** React 18 · TypeScript 5 · Vite · TailwindCSS · Recharts

**Firmware:** ESP32 Arduino C++ · WiFiManager · ThingSpeak Arduino library
