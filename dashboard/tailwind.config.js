/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Light-purple UI scale — page bg is the lightest swatch, text is darkest.
        lp: {
          50:  '#F5F0FF', // page background (lightest swatch)
          100: '#EBE0FF', // card hover / skeleton
          200: '#D4BEFF', // borders
          300: '#BBA0F0', // muted elements
          400: '#8B7FC0', // secondary text / axis ticks
          500: '#6B48C8', // primary accent (swatch 4)
          600: '#4B1FA0', // headings (swatch 5)
          700: '#3B1580', // strong text
          800: '#2D1060', // body text
          900: '#1E0840', // darkest text
        },
        // Dark-purple scale kept for reference.
        dp: {
          950: '#0E0920',
          900: '#130A28',
          800: '#1C1240',
          700: '#2A1B55',
          600: '#3D2880',
        },
      },
    },
  },
  plugins: [],
}
