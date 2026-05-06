/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          500: '#22d3ee',
          600: '#0891b2'
        }
      }
    }
  },
  plugins: []
};
