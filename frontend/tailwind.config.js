/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#edfafa',
          100: '#d2f1f0',
          200: '#a8dfdd',
          300: '#73c7c5',
          400: '#37aaa8',
          500: '#148d8a',
          600: '#0f716f',
          700: '#115b5a',
          800: '#124a49',
          900: '#123f3e',
        },
        accent: {
          orange: '#d97706',
          green: '#16a34a',
          purple: '#6d5dfc',
          pink: '#db2777',
          red: '#dc2626',
          ink: '#111827',
          paper: '#fbfaf7',
          line: '#e7e2d8',
        },
        neutral: {
          50: '#fbfaf7',
          100: '#f4f1eb',
          200: '#e7e2d8',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      fontSize: {
        'display-large': ['34px', { lineHeight: '41px', letterSpacing: '0', fontWeight: '700' }],
        'display': ['28px', { lineHeight: '34px', letterSpacing: '0', fontWeight: '700' }],
        'title-1': ['22px', { lineHeight: '28px', letterSpacing: '0', fontWeight: '650' }],
        'title-2': ['17px', { lineHeight: '22px', letterSpacing: '0', fontWeight: '650' }],
        'title-3': ['15px', { lineHeight: '20px', letterSpacing: '0', fontWeight: '650' }],
        'body': ['17px', { lineHeight: '24px', letterSpacing: '0', fontWeight: '400' }],
        'callout': ['16px', { lineHeight: '22px', letterSpacing: '0', fontWeight: '400' }],
        'subhead': ['15px', { lineHeight: '21px', letterSpacing: '0', fontWeight: '400' }],
        'footnote': ['13px', { lineHeight: '18px', letterSpacing: '0', fontWeight: '400' }],
        'caption-1': ['12px', { lineHeight: '16px', letterSpacing: '0', fontWeight: '500' }],
        'caption-2': ['11px', { lineHeight: '13px', letterSpacing: '0', fontWeight: '500' }],
      },
      borderRadius: {
        'card': '8px',
        'button': '12px',
        'input': '10px',
      },
      boxShadow: {
        'card': '0 1px 2px rgba(17, 24, 39, 0.04), 0 8px 24px rgba(17, 24, 39, 0.06)',
        'card-hover': '0 8px 20px rgba(17, 24, 39, 0.08), 0 16px 40px rgba(17, 24, 39, 0.08)',
        'button': '0 1px 3px rgba(0, 0, 0, 0.08)',
        'modal': '0 8px 32px rgba(0, 0, 0, 0.12), 0 16px 48px rgba(0, 0, 0, 0.16)',
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      }
    },
  },
  plugins: [],
}
