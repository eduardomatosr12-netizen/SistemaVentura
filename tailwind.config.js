/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          DEFAULT: '#CCFF00',
          50: '#F5FFCC',
          100: '#EBFF99',
          200: '#E1FF66',
          300: '#D7FF33',
          400: '#CCFF00',
          500: '#A3CC00',
          600: '#7A9900',
          700: '#526600',
          800: '#293300',
          900: '#141A00',
        },
        surface: {
          DEFAULT: '#000000',
          card: '#111111',
          cardAlt: '#0F0F0F',
          border: 'rgba(255,255,255,0.08)',
          'border-hover': 'rgba(255,255,255,0.15)',
          overlay: 'rgba(0,0,0,0.7)',
        },
        zinc: {
          750: '#2A2A2A',
          850: '#1A1A1A',
          950: '#0A0A0A',
        },
        brand: {
          red: '#FF4444',
          yellow: '#FFB800',
          orange: '#FF8C00',
          blue: '#4488FF',
        },
      },
    },
  },
  plugins: [],
}
