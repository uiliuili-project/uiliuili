import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#fb7299',
          dark: '#e45c82',
          light: '#ffd9e4',
        },
        ink: '#18191c',
        muted: '#61666d',
        line: '#e3e5e7',
        canvas: '#f6f7f8',
      },
      boxShadow: {
        card: '0 2px 10px rgba(21, 26, 38, 0.06)',
        float: '0 12px 32px rgba(21, 26, 38, 0.14)',
      },
      borderRadius: {
        xl2: '14px',
      },
    },
  },
  plugins: [],
};

export default config;
