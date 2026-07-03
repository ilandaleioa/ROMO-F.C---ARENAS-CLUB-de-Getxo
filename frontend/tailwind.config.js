/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        club: {
          red: 'rgb(var(--club-red) / <alpha-value>)',
          redDark: 'rgb(var(--club-red-dark) / <alpha-value>)',
          black: 'rgb(var(--club-black) / <alpha-value>)',
          white: 'rgb(var(--club-white) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
