/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#070D18',
          900: '#0A1628',
          850: '#0F2137',
          800: '#152C4A',
          700: '#1E3A5F',
          600: '#2A4D7B',
          500: '#3B6A9E',
          100: '#E8F0FE',
          50: '#F0F5FD'
        },
        gold: {
          600: '#B45309',
          500: '#D97706',
          400: '#F59E0B',
          300: '#FBBF24',
          100: '#FEF3C7',
          50: '#FFFBEB'
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      boxShadow: {
        'premium': '0 10px 30px -10px rgba(15, 33, 55, 0.15)',
        'premium-lg': '0 20px 40px -15px rgba(15, 33, 55, 0.25)',
        'gold-glow': '0 0 20px -3px rgba(245, 158, 11, 0.35)'
      }
    },
  },
  plugins: [],
}
