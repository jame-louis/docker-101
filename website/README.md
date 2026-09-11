# Course Site

Astro-based static site for the course. Minimal by design: **edit Markdown for all content (lectures, assignments) — everything else is automatic.**

## Structure

- `src/content/lectures/` - Course lecture content (Markdown + minimal frontmatter). Lecture 1 carries the course intro (description, textbook, objectives)
- `src/content/assignments/` - Assignments (Markdown + minimal frontmatter)
- `src/config.ts` - The course/site name (`site.title`), shown in the header + footer
- `src/pages/` - Site pages (Course content list, Lecture detail, Assignment detail)
- `src/layouts/` - Page layouts
- `src/components/` - Reusable components

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build static site
npm run build

# Preview build
npm run preview
```

## Deployment

The site is configured for static output (`output: 'static'`). Deploy the `dist/` folder to any static host (GitHub Pages, Vercel, Netlify, etc.).

## Content Management

There is no separate syllabus document. Lectures and assignments are markdown with minimal YAML frontmatter (see `CLAUDE.md` for the schemas); the course intro is written as the top sections of `lecture01.md`, and the course name lives in `src/config.ts` (`site.title`). The homepage is generated automatically from lecture frontmatter (number, title link, slidev link if set, homework link if an assignment references the lecture). Assignments have their own detail pages at `/assignments/[slug]` — there is no assignment list page; each is reached from its lecture (homepage homework link or lecture footer).

## Features

- Homepage course content list, generated from lecture frontmatter (with slidev + homework links)
- Lecture pages with inline TOC and prev/next nav
- Assignment detail pages with metadata + download + body (no separate list page — homework links live on the homepage and in each lecture's footer)
- Syntax-highlighted code blocks
- Responsive editorial layout (serif display headings + system CJK type, one desaturated accent, no external fonts)
- Branded 404 page, SVG favicon, social meta tags, and a keyboard skip-to-content link
- Zero client-side JavaScript

## Design

A scholarly, document-first look: cool paper background, ink text with a green tint, and a single deep-verdigris accent. The palette and fonts live in `tailwind.config.mjs`; prose styling in `src/styles/global.css` (`.prose-custom`). Headings use a serif CJK stack (Songti SC / Noto Serif CJK SC), body is a clean CJK sans, and meta labels/numbers are monospace. No external font or JS dependencies — edit Markdown and everything else is automatic.
