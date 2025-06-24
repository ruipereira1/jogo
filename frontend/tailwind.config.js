module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./index.html"
  ],
  theme: {
    screens: {
      'xs': '320px',
      'sm': '480px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
      // Custom mobile breakpoints
      'mobile': { 'max': '767px' },
      'tablet': { 'min': '768px', 'max': '1023px' },
      'desktop': { 'min': '1024px' },
      // Orientation breakpoints
      'landscape': { 'raw': '(orientation: landscape)' },
      'portrait': { 'raw': '(orientation: portrait)' },
      // Device-specific
      'touch': { 'raw': '(hover: none) and (pointer: coarse)' },
      'mouse': { 'raw': '(hover: hover) and (pointer: fine)' },
    },
    extend: {
      animation: {
        'fade-in-out': 'fadeInOut 3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-gentle': 'bounceGentle 2s infinite',
        'tap-feedback': 'tapFeedback 0.15s ease',
      },
      keyframes: {
        fadeInOut: {
          '0%': { opacity: 0, transform: 'translateY(-20px) translateX(-50%)' },
          '10%': { opacity: 1, transform: 'translateY(0) translateX(-50%)' },
          '80%': { opacity: 1, transform: 'translateY(0) translateX(-50%)' },
          '100%': { opacity: 0, transform: 'translateY(-20px) translateX(-50%)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        tapFeedback: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      minHeight: {
        'touch': '44px', // iOS recommended touch target
        'screen-safe': 'calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
      },
      minWidth: {
        'touch': '44px',
      },
      maxHeight: {
        'mobile-canvas': '70vh',
        'mobile-chat': '60vh',
      },
      fontFamily: {
        'mobile': ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        'xs-mobile': ['0.75rem', { lineHeight: '1.2' }],
        'sm-mobile': ['0.875rem', { lineHeight: '1.3' }],
        'base-mobile': ['1rem', { lineHeight: '1.4' }],
        'lg-mobile': ['1.125rem', { lineHeight: '1.4' }],
        'xl-mobile': ['1.25rem', { lineHeight: '1.4' }],
      },
      backdropBlur: {
        'xs': '2px',
      },
      colors: {
        'mobile-overlay': 'rgba(0, 0, 0, 0.95)',
        'ios-button': 'rgba(255, 255, 255, 0.15)',
        'ios-button-active': 'rgba(255, 255, 255, 0.25)',
      },
      zIndex: {
        'mobile-chat': '50',
        'mobile-modal': '100',
        'orientation-hint': '999',
      },
    },
  },
  plugins: [
    // Plugin customizado para utilitários mobile
    function({ addUtilities, theme }) {
      const newUtilities = {
        '.touch-manipulation': {
          'touch-action': 'manipulation',
        },
        '.no-tap-highlight': {
          '-webkit-tap-highlight-color': 'transparent',
        },
        '.no-scroll-bounce': {
          'overscroll-behavior': 'none',
        },
        '.gpu-accelerated': {
          'transform': 'translateZ(0)',
          'backface-visibility': 'hidden',
          'perspective': '1000',
        },
        '.mobile-scroll': {
          '-webkit-overflow-scrolling': 'touch',
          'scrollbar-width': 'thin',
        },
      }
      addUtilities(newUtilities)
    }
  ],
};