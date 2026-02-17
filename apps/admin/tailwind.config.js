/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['JetBrains Mono', 'SF Mono', 'Consolas', 'monospace'],
        display: ['Cal Sans', 'JetBrains Mono', 'sans-serif'],
      },
      colors: {
        surface: {
          800: '#1a1b1e',
          700: '#212225',
          600: '#2c2d31',
          500: '#36373c',
        },
        accent: {
          DEFAULT: '#7c3aed',
          hover: '#8b5cf6',
          muted: '#5b21b6',
        },
      },
      animation: {
        'pulse-soft': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
