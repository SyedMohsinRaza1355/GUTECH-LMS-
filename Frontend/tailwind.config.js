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
        // "navy" is the primary brand scale, now the GU TECH crimson (brand colour = 700).
        navy: {
          950: '#2A0A0E',
          900: '#4A0F16',
          850: '#5E1219',
          800: '#7A1520',
          700: '#9B1C25',
          600: '#B72A33',
          500: '#CF4A52',
          300: '#E8A0A5',
          200: '#F2C6C9',
          100: '#FBE4E5',
          50: '#FEF3F3'
        },
        // "gold" is the accent scale: a warm blush that sits next to the crimson.
        gold: {
          800: '#8E2A33',
          700: '#A8343D',
          600: '#C94550',
          500: '#E5646C',
          400: '#F2878D',
          300: '#F8B4B8',
          100: '#FDE3E5',
          50: '#FEF3F4'
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      boxShadow: {
        'premium': '0 10px 30px -10px rgba(74, 15, 22, 0.16)',
        'premium-lg': '0 20px 40px -15px rgba(74, 15, 22, 0.28)',
        'gold-glow': '0 0 20px -3px rgba(229, 100, 108, 0.40)'
      }
    },
  },
  plugins: [],
}
