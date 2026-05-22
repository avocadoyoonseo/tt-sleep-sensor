#include "cloud.h"

#include <WiFi.h>
#include <WiFiManager.h>
#include <ThingSpeak.h>

#include "secrets.h"   // WIFI_AP_PASSWORD, THINGSPEAK_CHANNEL_ID, THINGSPEAK_WRITE_KEY
#include "sensors.h"   // SensorReadings, getLatestReadings()

// ── Constants ──────────────────────────────────────────────────────────────

static const char*   AP_SSID          = "TT-Sleep-Setup";
static const char*   AP_PASSWORD      = WIFI_AP_PASSWORD;
static const unsigned long CHANNEL_ID = THINGSPEAK_CHANNEL_ID;
static const char*   WRITE_KEY        = THINGSPEAK_WRITE_KEY;

// Upload interval in milliseconds (60 seconds).
static const unsigned long UPLOAD_INTERVAL_MS = 60000UL;

// How long to block in WiFiManager's captive portal before giving up and
// continuing without WiFi (seconds). Prevents locking the device forever.
static const unsigned int  PORTAL_TIMEOUT_S   = 180;

// Base delay for WiFi reconnect exponential backoff (ms).
static const unsigned long BACKOFF_BASE_MS     = 5000UL;
static const unsigned long BACKOFF_MAX_MS      = 60000UL;

// ── Module-private state ───────────────────────────────────────────────────

static WiFiClient   s_wifiClient;
static unsigned long s_backoffMs    = BACKOFF_BASE_MS;
static unsigned long s_nextRetryMs  = 0;

// ── Public API ─────────────────────────────────────────────────────────────

void CloudUploader::begin() {
  Serial.begin(115200);
  Serial.println("[Cloud] begin()");

  WiFiManager wm;

  // Non-blocking portal: if no credentials are stored, show the captive portal
  // for up to PORTAL_TIMEOUT_S seconds; if the user doesn't configure it in
  // time, continue without WiFi and retry on the next tick cycle.
  wm.setConfigPortalTimeout(PORTAL_TIMEOUT_S);

  // Disable the debug output from WiFiManager to keep Serial readable.
  wm.setDebugOutput(false);

  bool connected = wm.autoConnect(AP_SSID, AP_PASSWORD);
  if (connected) {
    Serial.println("[Cloud] WiFi connected: " + WiFi.localIP().toString());
    _wifiReady   = true;
    s_backoffMs  = BACKOFF_BASE_MS;
    s_nextRetryMs = 0;
  } else {
    Serial.println("[Cloud] WiFi not configured yet — will retry in main loop.");
    _wifiReady = false;
  }

  ThingSpeak.begin(s_wifiClient);
}

void CloudUploader::tick() {
  unsigned long now = millis();

  // Enforce upload interval.
  if (now - _lastUploadMs < UPLOAD_INTERVAL_MS) {
    return;
  }
  _lastUploadMs = now;

  // Check / restore WiFi before attempting upload.
  if (!_ensureWifi()) {
    // WiFi unavailable — skip this cycle silently.
    return;
  }

  // Grab the latest sensor readings.
  SensorReadings r = getLatestReadings();
  if (!r.valid) {
    Serial.println("[Cloud] Sensor readings invalid — skipping upload.");
    return;
  }

  // Stage all 6 fields (field order matches ThingSpeak channel setup).
  ThingSpeak.setField(1, r.co2_ppm);       // CO₂ (ppm)
  ThingSpeak.setField(2, r.temp_f);        // Temperature (°F)
  ThingSpeak.setField(3, r.humidity_pct);  // Humidity (%RH)
  ThingSpeak.setField(4, r.noise_dba);     // Noise (dB(A))
  ThingSpeak.setField(5, r.lux);           // Light (lux)
  ThingSpeak.setField(6, (int)r.sleep_score); // Sleep score (0-100)

  int httpCode = ThingSpeak.writeFields(CHANNEL_ID, WRITE_KEY);
  if (httpCode == 200) {
    Serial.println("[Cloud] Upload OK (HTTP 200).");
  } else {
    Serial.printf("[Cloud] Upload failed — HTTP %d.\n", httpCode);
  }
}

// ── Private helpers ────────────────────────────────────────────────────────

bool CloudUploader::_ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    s_backoffMs   = BACKOFF_BASE_MS;
    s_nextRetryMs = 0;
    return true;
  }

  unsigned long now = millis();

  // Respect the backoff window.
  if (now < s_nextRetryMs) {
    return false;
  }

  Serial.println("[Cloud] WiFi down — attempting reconnect...");
  WiFi.reconnect();

  // Brief non-blocking wait for the reconnect to resolve (up to 3 s).
  unsigned long deadline = millis() + 3000UL;
  while (millis() < deadline) {
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("[Cloud] WiFi reconnected: " + WiFi.localIP().toString());
      s_backoffMs   = BACKOFF_BASE_MS;
      s_nextRetryMs = 0;
      return true;
    }
    delay(100);
  }

  // Reconnect failed — schedule next attempt with exponential backoff.
  Serial.printf("[Cloud] Reconnect failed — will retry in %lu s.\n",
                s_backoffMs / 1000UL);
  s_nextRetryMs = millis() + s_backoffMs;
  s_backoffMs   = min(s_backoffMs * 2, BACKOFF_MAX_MS);
  return false;
}
