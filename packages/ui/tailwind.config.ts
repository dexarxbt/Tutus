import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        tutus: {
          red: '#c41e1e',
          'red-light': '#e83a3a',
          'red-dark': '#8b1515',
          black: '#1a1a1a',
        },
        surface: {
          primary: '#fafaf9',
          secondary: '#f5f5f4',
          tertiary: '#e7e5e4',
          card: '#ffffff',
        },
        text: {
          primary: '#1c1917',
          secondary: '#57534e',
          tertiary: '#a8a29e',
          inverse: '#fafaf9',
        },
        border: {
          DEFAULT: '#e7e5e4',
          subtle: '#f5f5f4',
          strong: '#d6d3d1',
        },
        state: {
          critical: '#c41e1e',
          'critical-bg': '#fef2f2',
          high: '#c2410c',
          'high-bg': '#fff7ed',
          medium: '#a16207',
          'medium-bg': '#fefce8',
          verified: '#15803d',
          'verified-bg': '#f0fdf4',
          running: '#1a1a1a',
          failed: '#c41e1e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        'display': ['3.5rem', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline': ['2.25rem', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '700' }],
        'title': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body': ['0.9375rem', { lineHeight: '1.6', fontWeight: '400' }],
        'caption': ['0.8125rem', { lineHeight: '1.5', fontWeight: '400' }],
        'micro': ['0.6875rem', { lineHeight: '1.4', fontWeight: '500' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
