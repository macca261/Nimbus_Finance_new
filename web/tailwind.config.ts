import type { Config } from 'tailwindcss';

export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          500: '#4361ee',
          400: '#4895ef',
          300: '#4cc9f0'
        }
      }
    }
  },
  plugins: []
} satisfies Config;


