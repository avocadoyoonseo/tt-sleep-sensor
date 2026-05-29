#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <SensirionI2cScd4x.h>
#include <BH1750.h>
#include <RTClib.h>
#include <ESP_I2S.h>
#include <U8g2lib.h>
#include <Preferences.h>
#include <math.h>

#include "secrets.h"

static const uint8_t PIN_SDA = 21;
static const uint8_t PIN_SCL = 22;
static const uint8_t PIN_BOOT_BUTTON = 0;
static const uint8_t PIN_VIEW_BUTTON = 26;
static const uint8_t PIN_ALARM_BUTTON = 27;
static const uint8_t PIN_SET_BUTTON = 14;
static const uint8_t PIN_BUZZER = 25;
static const uint8_t PIN_I2S_BCLK = 4;
static const uint8_t PIN_I2S_WS = 18;
static const uint8_t PIN_I2S_SD = 23;
static const unsigned long RESET_HOLD_MS = 3000;
static const unsigned long LONG_PRESS_MS = 700;
static const unsigned long SHORT_PRESS_DEBOUNCE_MS = 30;
static const unsigned long SNOOZE_DURATION_MS = 60000;
static const unsigned long UPLOAD_INTERVAL_MS = 60000;
static const unsigned long MIC_INTERVAL_MS = 5000;
static const unsigned long DISPLAY_INTERVAL_MS = 1000;
static const unsigned long ALARM_CHECK_INTERVAL_MS = 1000;
static const uint32_t MIC_SAMPLE_RATE_HZ = 16000;
static const size_t MIC_FRAME_SAMPLES = 2048;
static const uint32_t BUZZER_FREQ_HZ = 2700;
static const unsigned long BUZZER_ON_MS = 500;
static const unsigned long BUZZER_OFF_MS = 200;
static const float NOISE_DB_OFFSET = 26.0f;
static const char* AP_SSID = "TT-Sleep-Setup";
static const char* AP_PASSWORD = WIFI_AP_PASSWORD;
static const unsigned int PORTAL_TIMEOUT_S = 180;

SensirionI2cScd4x sensor;
BH1750 lightMeter;
RTC_DS3231 rtc;
WiFiManager wm;
I2SClass i2s;
Preferences prefs;
U8G2_SSD1309_128X64_NONAME0_F_HW_I2C u8g2(U8G2_R0, /*reset=*/U8X8_PIN_NONE);

enum DisplayMode {
  MODE_DASHBOARD,
  MODE_CLOCK,
  MODE_ALARM_EDIT,
  MODE_ALARM_FIRING,
};

struct ButtonState {
  unsigned long pressedAtMs;
  bool longFired;
};

static float lastCO2_ppm = NAN;
static float lastTempF = NAN;
static float lastHumidity = NAN;
static float lastLux = NAN;
static float lastNoiseDb = NAN;
static unsigned long lastBackendUploadMs = 0;
static unsigned long lastMicMs = 0;
static unsigned long lastDisplayMs = 0;
static unsigned long lastAlarmCheckMs = 0;
static unsigned long resetPressedAtMs = 0;

static DisplayMode displayMode = MODE_DASHBOARD;
static bool alarmEnabled = false;
static uint8_t alarmHour = 7;
static uint8_t alarmMinute = 30;
static bool alarmFiring = false;
static unsigned long snoozeUntilMs = 0;
static int16_t lastFiredYearDay = -1;
static uint8_t editSlot = 0;

static ButtonState viewBtn = {0, false};
static ButtonState alarmBtn = {0, false};
static ButtonState setBtn = {0, false};

static unsigned long buzzerPhaseStartMs = 0;
static bool buzzerPhaseOn = false;
static bool buzzerActive = false;

static void printSensirionError(const char* where, uint16_t error) {
  char message[64];
  errorToString(error, message, sizeof(message));
  Serial.print(F("[SCD41] "));
  Serial.print(where);
  Serial.print(F(" error: "));
  Serial.println(message);
}

static float sampleNoiseDb() {
  static int32_t buf[MIC_FRAME_SAMPLES];
  size_t bytesRead = i2s.readBytes((char*)buf, sizeof(buf));
  if (bytesRead < sizeof(buf)) {
    return NAN;
  }

  int64_t sum = 0;
  for (size_t i = 0; i < MIC_FRAME_SAMPLES; i++) {
    sum += (buf[i] >> 14);
  }
  int32_t mean = (int32_t)(sum / (int64_t)MIC_FRAME_SAMPLES);

  double sumSq = 0.0;
  for (size_t i = 0; i < MIC_FRAME_SAMPLES; i++) {
    int32_t x = (buf[i] >> 14) - mean;
    sumSq += (double)x * (double)x;
  }
  float rms = sqrtf((float)(sumSq / (double)MIC_FRAME_SAMPLES));
  if (rms < 1.0f) {
    return NAN;
  }
  return 20.0f * log10f(rms) + NOISE_DB_OFFSET;
}

static inline float clamp01(float t) {
  if (t < 0.0f) return 0.0f;
  if (t > 1.0f) return 1.0f;
  return t;
}

static float computeSleepScore() {
  if (isnan(lastCO2_ppm) || isnan(lastTempF) || isnan(lastHumidity) ||
      isnan(lastNoiseDb) || isnan(lastLux)) {
    return NAN;
  }

  float co2Sub = 100.0f * clamp01((1500.0f - lastCO2_ppm) / (1500.0f - 800.0f));

  float tempSub;
  if (lastTempF >= 65.0f && lastTempF <= 68.0f) {
    tempSub = 100.0f;
  } else if (lastTempF < 65.0f) {
    tempSub = 100.0f * clamp01((lastTempF - 55.0f) / (65.0f - 55.0f));
  } else {
    tempSub = 100.0f * clamp01((80.0f - lastTempF) / (80.0f - 68.0f));
  }

  float humSub;
  if (lastHumidity >= 30.0f && lastHumidity <= 50.0f) {
    humSub = 100.0f;
  } else if (lastHumidity < 30.0f) {
    humSub = 100.0f * clamp01((lastHumidity - 20.0f) / (30.0f - 20.0f));
  } else {
    humSub = 100.0f * clamp01((70.0f - lastHumidity) / (70.0f - 50.0f));
  }

  float noiseSub = 100.0f * clamp01((50.0f - lastNoiseDb) / (50.0f - 30.0f));
  float lightSub = 100.0f * clamp01((50.0f - lastLux) / (50.0f - 5.0f));

  return (co2Sub + tempSub + humSub + noiseSub + lightSub) / 5.0f;
}

// ---------- Alarm helpers ----------

static void slotToHourMin(uint8_t slot, uint8_t& h24, uint8_t& m, bool& off) {
  if (slot >= 96) {
    h24 = 0; m = 0; off = true;
  } else {
    h24 = slot / 4;
    m   = (slot % 4) * 15;
    off = false;
  }
}

static uint8_t currentAlarmSlot() {
  if (!alarmEnabled) return 96;
  return (alarmHour * 4) + (alarmMinute / 15);
}

static void loadAlarmFromNVS() {
  prefs.begin("alarm", true);
  alarmEnabled = prefs.getUChar("enabled", 0) != 0;
  alarmHour    = prefs.getUChar("hour", 7);
  alarmMinute  = prefs.getUChar("minute", 30);
  prefs.end();
}

static void saveAlarmToNVS() {
  prefs.begin("alarm", false);
  prefs.putUChar("enabled", alarmEnabled ? 1 : 0);
  prefs.putUChar("hour",    alarmHour);
  prefs.putUChar("minute",  alarmMinute);
  prefs.end();
}

static void enterAlarmEdit() {
  editSlot = currentAlarmSlot();
  displayMode = MODE_ALARM_EDIT;
}

static void exitAlarmEdit(bool save) {
  if (save) {
    uint8_t h, m;
    bool off;
    slotToHourMin(editSlot, h, m, off);
    if (off) {
      alarmEnabled = false;
    } else {
      alarmEnabled = true;
      alarmHour = h;
      alarmMinute = m;
    }
    saveAlarmToNVS();
    lastFiredYearDay = -1;
    snoozeUntilMs = 0;
  }
  displayMode = MODE_DASHBOARD;
}

static void advanceAlarmSlot() {
  editSlot = (editSlot + 1) % 97;
}

static void startAlarmFiring() {
  alarmFiring = true;
  displayMode = MODE_ALARM_FIRING;
  buzzerActive = true;
  buzzerPhaseOn = true;
  buzzerPhaseStartMs = millis();
  tone(PIN_BUZZER, BUZZER_FREQ_HZ);
}

static void stopBuzzer() {
  noTone(PIN_BUZZER);
  buzzerActive = false;
  buzzerPhaseOn = false;
}

static void snoozeAlarm() {
  stopBuzzer();
  alarmFiring = false;
  snoozeUntilMs = millis() + SNOOZE_DURATION_MS;
  displayMode = MODE_DASHBOARD;
}

static int16_t todayId(const DateTime& now) {
  return (int16_t)(((now.year() - 2000) << 9) | (now.month() << 5) | now.day());
}

static void dismissAlarm() {
  stopBuzzer();
  alarmFiring = false;
  snoozeUntilMs = 0;
  lastFiredYearDay = todayId(rtc.now());
  displayMode = MODE_DASHBOARD;
}

static void updateBuzzer() {
  if (!alarmFiring) {
    if (buzzerActive) {
      stopBuzzer();
    }
    return;
  }

  unsigned long nowMs = millis();
  if (buzzerPhaseOn) {
    if (nowMs - buzzerPhaseStartMs >= BUZZER_ON_MS) {
      noTone(PIN_BUZZER);
      buzzerPhaseOn = false;
      buzzerPhaseStartMs = nowMs;
    }
  } else {
    if (nowMs - buzzerPhaseStartMs >= BUZZER_OFF_MS) {
      tone(PIN_BUZZER, BUZZER_FREQ_HZ);
      buzzerPhaseOn = true;
      buzzerPhaseStartMs = nowMs;
    }
  }
}

static void checkAlarmTrigger() {
  unsigned long nowMs = millis();
  if (nowMs - lastAlarmCheckMs < ALARM_CHECK_INTERVAL_MS) {
    return;
  }
  lastAlarmCheckMs = nowMs;

  if (alarmFiring) return;

  if (snoozeUntilMs != 0 && (long)(nowMs - snoozeUntilMs) >= 0) {
    snoozeUntilMs = 0;
    startAlarmFiring();
    return;
  }

  if (!alarmEnabled) return;

  DateTime now = rtc.now();
  int16_t tid = todayId(now);
  if (now.hour() == alarmHour && now.minute() == alarmMinute && lastFiredYearDay != tid) {
    lastFiredYearDay = tid;
    startAlarmFiring();
  }
}

// ---------- Button input ----------

static int pollButton(uint8_t pin, ButtonState& state) {
  bool pressed = (digitalRead(pin) == LOW);
  unsigned long nowMs = millis();
  if (pressed) {
    if (state.pressedAtMs == 0) {
      state.pressedAtMs = nowMs;
      state.longFired = false;
    } else if (!state.longFired && (nowMs - state.pressedAtMs >= LONG_PRESS_MS)) {
      state.longFired = true;
      return 2;
    }
  } else {
    if (state.pressedAtMs != 0) {
      bool wasLong = state.longFired;
      unsigned long heldMs = nowMs - state.pressedAtMs;
      state.pressedAtMs = 0;
      state.longFired = false;
      if (!wasLong && heldMs >= SHORT_PRESS_DEBOUNCE_MS) {
        return 1;
      }
    }
  }
  return 0;
}

static void handleButtons() {
  int viewEvt  = pollButton(PIN_VIEW_BUTTON,  viewBtn);
  int alarmEvt = pollButton(PIN_ALARM_BUTTON, alarmBtn);
  int setEvt   = pollButton(PIN_SET_BUTTON,   setBtn);

  if (viewEvt == 1) {
    if (displayMode == MODE_DASHBOARD) {
      displayMode = MODE_CLOCK;
    } else if (displayMode == MODE_CLOCK) {
      displayMode = MODE_DASHBOARD;
    }
  }

  if (displayMode == MODE_ALARM_FIRING) {
    if (alarmEvt == 1) {
      snoozeAlarm();
    } else if (alarmEvt == 2) {
      dismissAlarm();
    }
  }

  if (displayMode == MODE_ALARM_EDIT) {
    if (setEvt == 1) {
      advanceAlarmSlot();
    } else if (setEvt == 2) {
      exitAlarmEdit(/*save=*/true);
    }
  } else if (displayMode != MODE_ALARM_FIRING) {
    if (setEvt == 2) {
      enterAlarmEdit();
    }
  }
}

static void checkResetButton() {
  bool pressed = (digitalRead(PIN_BOOT_BUTTON) == LOW);
  if (pressed) {
    if (resetPressedAtMs == 0) {
      resetPressedAtMs = millis();
    } else if (millis() - resetPressedAtMs >= RESET_HOLD_MS) {
      Serial.println(F("[WiFi] BOOT held — clearing creds and rebooting"));
      wm.resetSettings();
      delay(200);
      ESP.restart();
    }
  } else {
    resetPressedAtMs = 0;
  }
}

static void readSensorsIfReady() {
  bool dataReady = false;
  uint16_t error = sensor.getDataReadyStatus(dataReady);
  if (error) {
    printSensirionError("getDataReadyStatus", error);
    return;
  }
  if (!dataReady) {
    return;
  }

  uint16_t co2 = 0;
  float tempC = 0.0f;
  float humidity = 0.0f;
  error = sensor.readMeasurement(co2, tempC, humidity);
  if (error) {
    printSensirionError("readMeasurement", error);
    return;
  }

  if (co2 == 0) {
    return;
  }

  float lux = lightMeter.readLightLevel();
  DateTime now = rtc.now();
  float tempF = tempC * 9.0f / 5.0f + 32.0f;

  lastCO2_ppm = (float)co2;
  lastTempF = tempF;
  lastHumidity = humidity;
  if (lux >= 0.0f) {
    lastLux = lux;
  }

  float score = computeSleepScore();
  Serial.printf("%02u:%02u:%02u,%u,%.2f,%.2f,%.2f,%.2f,%.2f\n",
                now.hour(), now.minute(), now.second(),
                co2, tempF, humidity, lux, lastNoiseDb, score);
}

// ---------- Cloud upload ----------

// Posts sensor data to the custom Express backend so the dashboard
// can serve per-user history and the AI recommendation engine has data.
// Requires BACKEND_URL, DEVICE_INGEST_KEY, BACKEND_USER_ID in secrets.h.
static void uploadToBackendIfDue() {
  unsigned long nowMs = millis();
  if (nowMs - lastBackendUploadMs < UPLOAD_INTERVAL_MS) {
    return;
  }
  lastBackendUploadMs = nowMs;

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(F("[Backend] skipped — WiFi not connected"));
    return;
  }
  if (isnan(lastCO2_ppm)) {
    Serial.println(F("[Backend] skipped — no sensor data yet"));
    return;
  }

  float score = computeSleepScore();
  DateTime now = rtc.now();

  // ISO-8601 UTC timestamp from RTC (DS3231 keeps UTC if set correctly).
  char ts[25];
  snprintf(ts, sizeof(ts), "%04d-%02d-%02dT%02d:%02d:%02dZ",
           now.year(), now.month(), now.day(),
           now.hour(), now.minute(), now.second());

  // Build JSON body manually — avoids pulling in ArduinoJson.
  char body[256];
  snprintf(body, sizeof(body),
    "{\"user_id\":%d,"
    "\"co2\":%.1f,"
    "\"temp_f\":%.1f,"
    "\"humidity\":%.1f,"
    "\"noise\":%.1f,"
    "\"lux\":%.1f,"
    "\"score\":%.1f,"
    "\"timestamp\":\"%s\"}",
    BACKEND_USER_ID,
    lastCO2_ppm,
    lastTempF,
    lastHumidity,
    isnan(lastNoiseDb) ? 0.0f : lastNoiseDb,
    isnan(lastLux)     ? 0.0f : lastLux,
    isnan(score)       ? 0.0f : score,
    ts);

  HTTPClient http;
  http.begin(BACKEND_URL "/data/ingest");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_INGEST_KEY);

  int httpCode = http.POST(body);
  if (httpCode == 200) {
    Serial.println(F("[Backend] upload OK"));
  } else {
    Serial.printf("[Backend] upload failed, HTTP %d\n", httpCode);
  }
  http.end();
}

// ---------- Display renderers ----------

static void formatTime12(uint8_t h24, uint8_t m, char* outHM, size_t hmSize, const char** outAmPm) {
  uint8_t h12 = h24 % 12;
  if (h12 == 0) h12 = 12;
  snprintf(outHM, hmSize, "%u:%02u", h12, m);
  *outAmPm = (h24 < 12) ? "AM" : "PM";
}

static void renderDashboard() {
  char co2Buf[8], tempBuf[8], humBuf[8], dbBuf[8], luxBuf[8], scoreBuf[6];
  if (isnan(lastCO2_ppm))   strcpy(co2Buf,  "--"); else snprintf(co2Buf,  sizeof(co2Buf),  "%d",   (int)lastCO2_ppm);
  if (isnan(lastTempF))     strcpy(tempBuf, "--"); else snprintf(tempBuf, sizeof(tempBuf), "%dF",  (int)(lastTempF + 0.5f));
  if (isnan(lastHumidity))  strcpy(humBuf,  "--"); else snprintf(humBuf,  sizeof(humBuf),  "%d%%", (int)(lastHumidity + 0.5f));
  if (isnan(lastNoiseDb))   strcpy(dbBuf,   "--"); else snprintf(dbBuf,   sizeof(dbBuf),   "%d",   (int)(lastNoiseDb + 0.5f));
  if (isnan(lastLux))       strcpy(luxBuf,  "--"); else snprintf(luxBuf,  sizeof(luxBuf),  "%d",   (int)(lastLux + 0.5f));

  float score = computeSleepScore();
  if (isnan(score)) {
    strcpy(scoreBuf, "--");
  } else {
    snprintf(scoreBuf, sizeof(scoreBuf), "%d", (int)(score + 0.5f));
  }

  u8g2.setFont(u8g2_font_6x10_tf);
  DateTime now = rtc.now();
  char timeStr[12];
  const char* ampm;
  formatTime12(now.hour(), now.minute(), timeStr, sizeof(timeStr), &ampm);
  char timeFull[16];
  snprintf(timeFull, sizeof(timeFull), "%s%s", timeStr, ampm[0] == 'A' ? "A" : "P");
  char alarmStr[12];
  if (alarmEnabled) {
    char ahm[8]; const char* aap;
    formatTime12(alarmHour, alarmMinute, ahm, sizeof(ahm), &aap);
    snprintf(alarmStr, sizeof(alarmStr), "%s%s", ahm, aap[0] == 'A' ? "A" : "P");
  } else {
    strcpy(alarmStr, "Off");
  }
  const char* wifiStr = (WiFi.status() == WL_CONNECTED) ? "W:OK" : "W:--";

  u8g2.drawStr(0, 8, timeFull);
  u8g2.drawStr(128 - u8g2.getStrWidth(wifiStr), 8, wifiStr);
  u8g2.drawStr((128 - u8g2.getStrWidth(alarmStr)) / 2, 8, alarmStr);

  u8g2.setFont(u8g2_font_logisoso20_tn);
  u8g2.drawStr((128 - u8g2.getStrWidth(scoreBuf)) / 2, 30, scoreBuf);

  u8g2.setFont(u8g2_font_6x10_tf);
  const char* label = "sleep score";
  u8g2.drawStr((128 - u8g2.getStrWidth(label)) / 2, 40, label);

  char row[40];
  snprintf(row, sizeof(row), "CO2 %s ppm  Tmp %s", co2Buf, tempBuf);
  u8g2.drawStr(0, 52, row);
  snprintf(row, sizeof(row), "Hum %s dB %s Lux %s", humBuf, dbBuf, luxBuf);
  u8g2.drawStr(0, 64, row);
}

static void renderClock() {
  u8g2.setFont(u8g2_font_6x10_tf);

  DateTime now = rtc.now();
  char timeBig[8];
  const char* ampm;
  formatTime12(now.hour(), now.minute(), timeBig, sizeof(timeBig), &ampm);
  u8g2.setFont(u8g2_font_logisoso24_tn);
  int bigW = u8g2.getStrWidth(timeBig);
  u8g2.setFont(u8g2_font_6x10_tf);
  int amW = u8g2.getStrWidth(ampm);
  int totalW = bigW + 4 + amW;
  int startX = (128 - totalW) / 2;
  u8g2.setFont(u8g2_font_logisoso24_tn);
  u8g2.drawStr(startX, 28, timeBig);
  u8g2.setFont(u8g2_font_6x10_tf);
  u8g2.drawStr(startX + bigW + 4, 16, ampm);

  char info[24];
  if (alarmEnabled) {
    char ahm[8]; const char* aap;
    formatTime12(alarmHour, alarmMinute, ahm, sizeof(ahm), &aap);
    snprintf(info, sizeof(info), "Alarm: %s %s", ahm, aap);
  } else {
    strcpy(info, "Alarm: Off");
  }
  u8g2.drawStr((128 - u8g2.getStrWidth(info)) / 2, 42, info);

  char co2Buf[8], tempBuf[8], humBuf[8], dbBuf[8], luxBuf[8];
  if (isnan(lastCO2_ppm))   strcpy(co2Buf,  "--"); else snprintf(co2Buf,  sizeof(co2Buf),  "%d",   (int)lastCO2_ppm);
  if (isnan(lastTempF))     strcpy(tempBuf, "--"); else snprintf(tempBuf, sizeof(tempBuf), "%dF",  (int)(lastTempF + 0.5f));
  if (isnan(lastHumidity))  strcpy(humBuf,  "--"); else snprintf(humBuf,  sizeof(humBuf),  "%d%%", (int)(lastHumidity + 0.5f));
  if (isnan(lastNoiseDb))   strcpy(dbBuf,   "--"); else snprintf(dbBuf,   sizeof(dbBuf),   "%d",   (int)(lastNoiseDb + 0.5f));
  if (isnan(lastLux))       strcpy(luxBuf,  "--"); else snprintf(luxBuf,  sizeof(luxBuf),  "%d",   (int)(lastLux + 0.5f));
  char row[40];
  snprintf(row, sizeof(row), "CO2 %s ppm  Tmp %s", co2Buf, tempBuf);
  u8g2.drawStr(0, 53, row);
  snprintf(row, sizeof(row), "Hum %s dB %s Lux %s", humBuf, dbBuf, luxBuf);
  u8g2.drawStr(0, 64, row);
}

static void renderAlarmEdit() {
  u8g2.setFont(u8g2_font_6x10_tf);
  const char* title = "Set Alarm";
  u8g2.drawStr((128 - u8g2.getStrWidth(title)) / 2, 10, title);

  uint8_t h, m; bool off;
  slotToHourMin(editSlot, h, m, off);

  char display[12];
  if (off) {
    strcpy(display, "OFF");
    u8g2.setFont(u8g2_font_helvB18_tr);
    u8g2.drawStr((128 - u8g2.getStrWidth(display)) / 2, 38, display);
  } else {
    char hm[8];
    const char* ap;
    formatTime12(h, m, hm, sizeof(hm), &ap);
    u8g2.setFont(u8g2_font_logisoso20_tn);
    int digW = u8g2.getStrWidth(hm);
    u8g2.setFont(u8g2_font_helvB14_tr);
    int apW = u8g2.getStrWidth(ap);
    int totalW = digW + 6 + apW;
    int startX = (128 - totalW) / 2;
    u8g2.setFont(u8g2_font_logisoso20_tn);
    u8g2.drawStr(startX, 38, hm);
    u8g2.setFont(u8g2_font_helvB14_tr);
    u8g2.drawStr(startX + digW + 6, 36, ap);
  }

  u8g2.setFont(u8g2_font_6x10_tf);
  const char* footer = "click=next  hold=save";
  u8g2.drawStr((128 - u8g2.getStrWidth(footer)) / 2, 62, footer);
}

static void renderAlarmFiring() {
  u8g2.setFont(u8g2_font_6x10_tf);
  const char* banner = "*** ALARM ***";
  u8g2.drawStr((128 - u8g2.getStrWidth(banner)) / 2, 10, banner);

  char hm[8];
  const char* ap;
  formatTime12(alarmHour, alarmMinute, hm, sizeof(hm), &ap);
  u8g2.setFont(u8g2_font_logisoso20_tn);
  int digW = u8g2.getStrWidth(hm);
  u8g2.setFont(u8g2_font_helvB14_tr);
  int apW = u8g2.getStrWidth(ap);
  int totalW = digW + 6 + apW;
  int startX = (128 - totalW) / 2;
  u8g2.setFont(u8g2_font_logisoso20_tn);
  u8g2.drawStr(startX, 38, hm);
  u8g2.setFont(u8g2_font_helvB14_tr);
  u8g2.drawStr(startX + digW + 6, 36, ap);

  u8g2.setFont(u8g2_font_6x10_tf);
  const char* line1 = "click = snooze";
  const char* line2 = "hold = stop";
  u8g2.drawStr((128 - u8g2.getStrWidth(line1)) / 2, 54, line1);
  u8g2.drawStr((128 - u8g2.getStrWidth(line2)) / 2, 64, line2);
}

static void updateDisplayIfDue() {
  unsigned long nowMs = millis();
  if (nowMs - lastDisplayMs < DISPLAY_INTERVAL_MS) {
    return;
  }
  lastDisplayMs = nowMs;

  if (!isnan(lastLux)) {
    long c = constrain(map((long)lastLux, 0, 50, 10, 255), 10L, 255L);
    u8g2.setContrast((uint8_t)c);
  }

  u8g2.clearBuffer();
  switch (displayMode) {
    case MODE_CLOCK:         renderClock();        break;
    case MODE_ALARM_EDIT:    renderAlarmEdit();    break;
    case MODE_ALARM_FIRING:  renderAlarmFiring();  break;
    case MODE_DASHBOARD:
    default:                 renderDashboard();    break;
  }
  u8g2.sendBuffer();
}

void setup() {
  Serial.begin(115200);
  while (!Serial && millis() < 2000) {}

  pinMode(PIN_BOOT_BUTTON,  INPUT_PULLUP);
  pinMode(PIN_VIEW_BUTTON,  INPUT_PULLUP);
  pinMode(PIN_ALARM_BUTTON, INPUT_PULLUP);
  pinMode(PIN_SET_BUTTON,   INPUT_PULLUP);
  pinMode(PIN_BUZZER, OUTPUT);
  noTone(PIN_BUZZER);

  Wire.begin(PIN_SDA, PIN_SCL);

  if (!lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
    Serial.println(F("[BH1750] begin failed — check wiring / ADDR pin"));
  }

  if (!rtc.begin()) {
    Serial.println(F("[DS3231] begin failed — check wiring"));
  } else if (rtc.lostPower()) {
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
    Serial.println(F("[DS3231] lost power — time set to compile time; replace coin cell"));
  }

  sensor.begin(Wire, SCD41_I2C_ADDR_62);

  uint16_t error = 0;

  sensor.wakeUp();
  error = sensor.stopPeriodicMeasurement();
  if (error) printSensirionError("stopPeriodicMeasurement", error);
  error = sensor.reinit();
  if (error) printSensirionError("reinit", error);

  uint64_t serialNumber = 0;
  error = sensor.getSerialNumber(serialNumber);
  if (error) {
    printSensirionError("getSerialNumber", error);
  } else {
    Serial.print(F("[SCD41] serial number: 0x"));
    Serial.println((unsigned long long)serialNumber, HEX);
  }

  error = sensor.startPeriodicMeasurement();
  if (error) printSensirionError("startPeriodicMeasurement", error);

  Serial.println(F("time,co2_ppm,temp_F,humidity_pct,lux,noise_dbspl,score"));

  u8g2.begin();
  u8g2.setContrast(180);

  loadAlarmFromNVS();

  i2s.setPins(PIN_I2S_BCLK, PIN_I2S_WS, -1, PIN_I2S_SD, -1);
  if (!i2s.begin(I2S_MODE_STD, MIC_SAMPLE_RATE_HZ,
                 I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_MONO,
                 I2S_STD_SLOT_LEFT)) {
    Serial.println(F("[INMP441] I2S begin failed — check BCLK/WS/SD wiring and L/R-to-GND"));
  }

  wm.setConfigPortalTimeout(PORTAL_TIMEOUT_S);
  wm.setDebugOutput(false);
  Serial.print(F("[WiFi] connecting (captive portal SSID if needed: "));
  Serial.print(AP_SSID);
  Serial.println(F(")..."));
  if (!wm.autoConnect(AP_SSID, AP_PASSWORD)) {
    Serial.println(F("[WiFi] autoConnect failed/timed out — continuing offline"));
  } else {
    Serial.print(F("[WiFi] connected, IP: "));
    Serial.println(WiFi.localIP());
    WiFi.setAutoReconnect(true);
    WiFi.persistent(true);
  }

}

void loop() {
  checkResetButton();
  handleButtons();
  readSensorsIfReady();

  if (millis() - lastMicMs >= MIC_INTERVAL_MS) {
    lastMicMs = millis();
    float db = sampleNoiseDb();
    if (!isnan(db)) {
      lastNoiseDb = db;
    }
  }

  checkAlarmTrigger();
  updateBuzzer();
  updateDisplayIfDue();
  uploadToBackendIfDue();
  delay(50);
}
