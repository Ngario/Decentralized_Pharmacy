import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brandPrimary: '#FA7E00',
        brandSoft: '#FDC18D',
        brandAccent: '#F89A33',
        brandRose: '#F16D8B',
        brandMagenta: '#F25571',
        brandViolet: '#D87F89'
      },
      boxShadow: {
        card: '0 10px 25px rgba(0,0,0,0.08)'
      }
    }
  },
  plugins: []
};

export default config;

