#pragma once

// cloud.h — CloudUploader: WiFi management + ThingSpeak upload module.
//
// Usage:
//   #include "cloud.h"
//   CloudUploader cloud;
//
//   void setup() { cloud.begin(); }
//   void loop()  { cloud.tick(); }
//
// Requires: ThingSpeak (Mathworks), WiFiManager (tzapu) from Library Manager.
// Requires: secrets.h (copy from secrets.example.h and fill in real values).

class CloudUploader {
 public:
  // Call once from setup(). Initializes WiFiManager; on first boot with no
  // stored credentials it starts the "TT-Sleep-Setup" captive portal so the
  // user can enter WiFi credentials from their phone.
  void begin();

  // Call every loop(). Non-blocking. Uploads all 6 sensor fields to
  // ThingSpeak if 60 seconds have elapsed and WiFi is connected.
  void tick();

 private:
  // Timestamp (millis) of the last successful or attempted upload.
  unsigned long _lastUploadMs = 0;

  // Whether WiFiManager has completed its connection attempt this session.
  bool _wifiReady = false;

  // Attempt to reconnect WiFi if it has dropped; returns true if connected.
  bool _ensureWifi();
};
