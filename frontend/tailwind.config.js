module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./index.html"
  ],
  theme: {
    extend: {
      animation: {
        'spin-slow': 'spin 4s linear infinite',
      }
    },
  },
  plugins: [],
}; 