/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // Single accent family: deep "verdigris" green, desaturated for a scholarly,
        // calm read. Verdigris against warm bone (paper) is the premium pairing here —
        // the whole neutral system runs warm, so colour stays a scarce accent.
        primary: {
          DEFAULT: '#2f6b5f',
          dark: '#25554b',
          soft: '#e7efea',
        },
        paper: {
          DEFAULT: '#f7f6f3', // warm bone
          card: '#ffffff',
        },
        ink: {
          DEFAULT: '#1f2a26',
          muted: '#5f6e68',
          faint: '#64756d',
        },
        line: '#e6e3db', // warm bone hairline
        // Utilitarian near-black for primary actions (download, back). High contrast,
        // zero chrome — the one place ink goes all the way dark.
        solid: {
          DEFAULT: '#111111',
          hover: '#333333',
        },
      },
      fontFamily: {
        // No external font network dependency (Google Fonts is unreachable in CN
        // contexts) — rely on high-quality system CJK stacks instead.
        // Serif display: Chinese editorial headings (Songti / Noto Serif CJK).
        serif: [
          '"Songti SC"',
          '"Noto Serif CJK SC"',
          '"Source Han Serif SC"',
          '"STSong"',
          'Georgia',
          '"Times New Roman"',
          'serif',
        ],
        // Body / UI sans.
        sans: [
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"Noto Sans CJK SC"',
          '"Source Han Sans SC"',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        // Meta labels, numbers, code.
        mono: [
          '"SF Mono"',
          '"JetBrains Mono"',
          '"Fira Code"',
          'Menlo',
          'Monaco',
          '"Cascadia Code"',
          'Consolas',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
}
