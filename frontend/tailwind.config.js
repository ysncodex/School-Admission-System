/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0c2a22',
        muted: '#566a62',
        line: '#dde5e0',
        paper: '#f1f5f2',
        night: { DEFAULT: '#0a2a22', 2: '#12392e' },
        forest: { DEFAULT: '#0e6b50', dark: '#0a5240', soft: '#e3f1ea', mint: '#6fe0b0' },
        amber: { DEFAULT: '#8f5400', bright: '#f5a623', soft: '#fff2d9' },
        clay: { DEFAULT: '#b13a2a', soft: '#fdebe7' },
      },
      fontFamily: {
        sans: ['Arial', 'Helvetica', 'sans-serif'],
        display: ['Arial', 'Helvetica', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(12,42,34,0.04), 0 8px 24px -12px rgba(12,42,34,0.12)',
      },
    },
  },
  plugins: [],
};
