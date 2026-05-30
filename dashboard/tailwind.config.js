/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
        display: ['Cormorant', 'serif'],
        didot: ['GFS Didot', 'serif'],
      },
      colors: {
        // Luxury Minimal — warm cream bg, white cards, gold accent.
        lp: {
          50:  '#FAFAF9', // page background (warm stone cream)
          100: '#FFFFFF', // card surface (pure white)
          200: '#E7E5E4', // borders (warm stone)
          300: '#A8A29E', // muted text / helper
          400: '#78716C', // secondary text
          500: '#A16207', // primary accent (amber gold)
          600: '#854D0E', // hover gold (darker)
          700: '#44403C', // strong secondary text
          800: '#1C1917', // body text
          900: '#0C0A09', // headings (near-black)
        },
      },
    },
  },
  plugins: [],
}
