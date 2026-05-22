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
