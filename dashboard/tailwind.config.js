/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Fira Sans', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
        display: ['Fira Code', 'monospace'],
      },
      colors: {
        // OLED dark scale — lp-50 is deepest dark (page bg), lp-900 is brightest (headings).
        lp: {
          50:  '#0F172A', // page background (deepest)
          100: '#1E293B', // card surface
          200: '#334155', // borders / dividers
          300: '#64748B', // very muted text / helper
          400: '#94A3B8', // secondary text / axis ticks
          500: '#22C55E', // primary accent (green)
          600: '#16A34A', // hover green
          700: '#CBD5E1', // strong secondary text
          800: '#E2E8F0', // body text
          900: '#F8FAFC', // headings (brightest)
        },
      },
    },
  },
  plugins: [],
}
