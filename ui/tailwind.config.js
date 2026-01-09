/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Health states
        'health-healthy': '#166534',
        'health-warning': '#854d0e',
        'health-critical': '#991b1b',
        // UI grays
        'surface': '#18181b',
        'surface-elevated': '#27272a',
        'surface-overlay': '#3f3f46',
        'border': '#3f3f46',
        'border-focus': '#a1a1aa',
        // Status
        'online': '#22c55e',
        'offline': '#6b7280',
        'pending': '#f59e0b',
        'error': '#ef4444',
      },
      animation: {
        'pulse-alert': 'pulse-alert 1s ease-in-out infinite',
      },
      keyframes: {
        'pulse-alert': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
};
