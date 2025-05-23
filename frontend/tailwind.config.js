module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./index.html"
  ],
  theme: {
    extend: {
      animation: {
        'fade-in-out': 'fadeInOut 3s ease-in-out',
      },
      keyframes: {
        fadeInOut: {
          '0%': { opacity: 0, transform: 'translateY(-20px) translateX(-50%)' },
          '10%': { opacity: 1, transform: 'translateY(0) translateX(-50%)' },
          '80%': { opacity: 1, transform: 'translateY(0) translateX(-50%)' },
          '100%': { opacity: 0, transform: 'translateY(-20px) translateX(-50%)' },
        }
      }
    },
  },
  plugins: [],
};