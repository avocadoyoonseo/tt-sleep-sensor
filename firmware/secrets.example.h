#pragma once

// Copy this file to secrets.h and fill in your real values.
// secrets.h is in .gitignore — never commit it.

// Password for the WiFiManager captive-portal AP on first boot.
// Users join "TT-Sleep-Setup" with this password to configure WiFi.
#define WIFI_AP_PASSWORD "ttsetup123"

// ThingSpeak channel ID (numeric, from Channels → My Channels).
#define THINGSPEAK_CHANNEL_ID 0000000UL

// ThingSpeak Write API Key (Channels → API Keys → Write API Key).
#define THINGSPEAK_WRITE_KEY "XXXXXXXXXXXXXXXX"

// ── Custom backend (tt-sleep-sensor backend/) ──────────────────────────────
// Base URL of your Express server (no trailing slash).
// Use your machine's LAN IP so the ESP32 can reach it on the same network.
// Example: "http://192.168.1.42:3001"
#define BACKEND_URL "http://YOUR_SERVER_IP:3001"

// Must match DEVICE_INGEST_KEY in backend/.env
#define DEVICE_INGEST_KEY "change_me_device_secret"

// Your user ID from the backend (returned on register/login as user.id).
#define BACKEND_USER_ID 1
