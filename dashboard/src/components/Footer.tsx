
const HARDWARE = [
  { name: 'ESP32-WROOM-32E', role: 'Microcontroller' },
  { name: 'Sensirion SCD41', role: 'CO₂ + Temp + Humidity (I²C)' },
  { name: 'BH1750', role: 'Ambient Light (I²C)' },
  { name: 'INMP441', role: 'Noise dB(A) (I²S)' },
  { name: 'DS3231 RTC', role: 'Real-time clock (I²C)' },
  { name: 'SSD1309 OLED', role: '2.42″ display (I²C)' },
]

export function Footer() {
  return (
    <footer className="w-full px-4 py-8 border-t border-lp-200 mt-4 text-xs text-lp-400">
      <div className="max-w-3xl mx-auto flex flex-col gap-5">
        {/* Hardware table */}
        <div>
          <p className="text-lp-500 font-semibold mb-2 uppercase tracking-widest text-[10px]">Hardware</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1">
            {HARDWARE.map((h) => (
              <div key={h.name} className="flex flex-col">
                <span className="text-lp-700 font-medium">{h.name}</span>
                <span className="text-lp-400">{h.role}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-lp-300">
          Data streams every 60 s via WiFi to the custom backend. OLED + web dashboard are supplemental — primary output is always the on-device display.
        </p>
      </div>
    </footer>
  )
}
