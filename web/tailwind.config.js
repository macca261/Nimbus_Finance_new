/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html','./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        nimbus: {
          primary: '#5B8DEF', // accent
          muted: '#9AA4B2'
        }
      },
      boxShadow: {
        soft: '0 8px 24px rgba(0,0,0,0.08)'
      },
      borderRadius: {
        '2xl': '1rem'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}

