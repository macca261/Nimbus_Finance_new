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
        },
        'nf': {
          'bg-root': 'var(--nf-bg-root)',
          'bg-shell': 'var(--nf-bg-shell)',
          'bg-sidebar': 'var(--nf-bg-sidebar)',
          'bg-card': 'var(--nf-bg-card)',
          'bg-card-subtle': 'var(--nf-bg-card-subtle)',
          'border-subtle': 'var(--nf-border-subtle)',
          'border-strong': 'var(--nf-border-strong)',
          'primary': 'var(--nf-primary)',
          'primary-soft': 'var(--nf-primary-soft)',
          'positive': 'var(--nf-positive)',
          'negative': 'var(--nf-negative)',
          'warning': 'var(--nf-warning)',
          'text-main': 'var(--nf-text-main)',
          'text-muted': 'var(--nf-text-muted)',
          'text-soft': 'var(--nf-text-soft)',
        }
      },
      boxShadow: {
        soft: '0 8px 24px rgba(0,0,0,0.08)',
        'elevated': 'var(--nf-shadow-elevated)',
        'card': 'var(--nf-shadow-card)',
        'glow-primary': '0 0 20px rgba(96, 165, 250, 0.3)',
      },
      backgroundImage: {
        'nf-shell': 'var(--nf-bg-shell)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}

