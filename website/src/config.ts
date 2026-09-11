// Site metadata — the only non-content configuration.
// Everything else (navigation labels, lectures, assignments) lives in Markdown under src/content/.
export const site = {
  lang: 'zh-CN',
  title: '前端开发课程（示例）', // Course/site name shown in header + footer — edit to rename the site
  description: '基于 Astro 的课程内容管理系统', // One-line description shown in the homepage header + meta
  term: '2025 春季学期', // Shown as a meta line in the homepage header — edit or remove for your semester
  separator: ' · ',
} as const;
