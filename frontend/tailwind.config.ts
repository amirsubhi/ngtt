import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class', '[data-theme]'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--bg-base)',
        surface: 'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        primary: 'var(--text-primary)',
        muted: 'var(--text-muted)',
        subtle: 'var(--text-subtle)',
        border: 'var(--border)',
        success: 'var(--success)',
        danger: 'var(--danger)',
        warning: 'var(--warning)',
      },
      borderColor: {
        DEFAULT: 'var(--border)',
        focus: 'var(--border-focus)',
      },
    },
  },
  plugins: [],
};

export default config;
