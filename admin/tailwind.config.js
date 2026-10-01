// tailwind.config.js
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Bhumi Bazar Design System — brand colors from the logo.
        // Token names (terracotta/cream/sand) are kept so existing classes keep working.
        cream: {
          DEFAULT: '#FAF8FB',
          50: '#FDFCFE',
          100: '#FAF8FB',
          200: '#F5F0F6',
        },
        terracotta: {
          DEFAULT: '#A3078F',
          50: '#FCEFFA',
          100: '#F6D9F2',
          200: '#EBB3E5',
          300: '#D65FCB',
          400: '#A3078F',
          500: '#7A0A74',
          600: '#5E0860',
          700: '#4A0552',
        },
        dark: {
          DEFAULT: '#17131A',
          50: '#F5F5F4',
          100: '#E8E7E5',
          200: '#C5C3BF',
          300: '#9E9B96',
          400: '#5A5856',
          500: '#3D3742',
          600: '#2A2330',
          700: '#17131A',
          800: '#110E13',
          900: '#0A080B',
        },
        sand: {
          DEFAULT: '#E6D6E8',
          50: '#FBF8FC',
          100: '#F5EDF6',
          200: '#E6D6E8',
          300: '#D1B5D6',
          400: '#B98AC0',
        },
        muted: '#5A5856',
      },
      fontFamily: {
        'sans': [
          'Manrope',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        'body': [
          'Manrope',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },
      backgroundImage: {
        'gradient-terracotta': 'linear-gradient(135deg, #A3078F, #7A0A74)',
        'gradient-dark': 'linear-gradient(135deg, #17131A, #2A2330)',
      },
      boxShadow: {
        'terracotta': '0 4px 14px 0 rgba(163, 7, 143, 0.25)',
        'card': '0 1px 3px 0 rgba(23, 19, 26, 0.06), 0 1px 2px -1px rgba(23, 19, 26, 0.06)',
        'card-hover': '0 10px 25px -5px rgba(23, 19, 26, 0.1), 0 8px 10px -6px rgba(23, 19, 26, 0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}