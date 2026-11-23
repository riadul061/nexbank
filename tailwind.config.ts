import type { Config } from 'tailwindcss';
const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;
export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'), surface: c('surface'), surface2: c('surface2'), line: c('line'), ink: c('ink'), muted: c('muted'),
        brand: c('brand'), brandfg: c('brandfg'), accent: c('accent'),
        success: c('success'), warn: c('warn'), danger: c('danger'), info: c('info'),
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'system-ui', 'sans-serif'],
        display: ['"Fraunces Variable"', 'Georgia', 'serif'],
      },
      boxShadow: { card: '0 1px 2px rgb(0 0 0 / 0.04), 0 4px 16px -6px rgb(0 0 0 / 0.08)' },
      borderRadius: { xl2: '1.125rem' },
      opacity: { 7: '0.07', 8: '0.08', 12: '0.12', 14: '0.14' },
    },
  },
  plugins: [],
} satisfies Config;
