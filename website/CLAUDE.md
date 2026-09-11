# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Astro-based static site template for university course websites. The design is intentionally minimal: **authors edit Markdown files; everything else is automatic.** The home page (`/`) is the course content list, generated entirely from lecture frontmatter. There is no separate syllabus document — the course intro lives in lecture 1.

## Development Commands

```bash
# Install dependencies
command npm install

# Start development server
command npm run dev

# Build for production
command npm run build

# Preview production build
command npm run preview
```

## Content Architecture

Content is managed through Astro's content collections defined in `src/content.config.ts`:

- **lectures**: Course lectures with frontmatter metadata
- **assignments**: Homework assignments linked to lectures via `lectureRef`

Content files are stored in `src/content/{collection}/` as Markdown.

There is **no syllabus document**. The course intro (description, textbook, objectives) is written as the top sections of `lecture01.md` — the first lecture *is* the course introduction. The site/course name lives in `src/config.ts` (`site.title`).

### Lecture Frontmatter Schema

```yaml
---
title: string
lectureNumber: number
slidevUrl: string (optional)  # online slides; homepage schedule shows a "课件" link when set
draft: boolean
---
```

### Assignment Frontmatter Schema

```yaml
---
title: string
assignmentNumber: number
lectureRef: string  # Matches lecture slug (e.g., "lecture01")
submissionFormat: string
downloadFile: string (optional)
dueDate: date (optional)
draft: boolean
---
```

## Central Configuration

`src/config.ts` is intentionally tiny — the one thing that cannot live in Markdown:

- `site`: Site metadata (lang, title, description, separator). `site.title` is the course/site name shown in the header + footer.

Navigation labels are hardcoded in `MainNav.astro`, and the assignment `submissionFormat` default lives in `src/content.config.ts`.

All course content (lectures, assignments) lives in Markdown files under `src/content/`. UI labels are hardcoded in the page templates. The homepage is the single lecture list, generated automatically from lecture frontmatter (number, title link, slidev link if set, homework link if an assignment references the lecture) — nothing hand-written. Each assignment has its own detail page at `/assignments/[slug]` (no list page), linked from its lecture on the homepage and in the lecture footer.

## Pages

- `/` — Course content list (lecture number, title link, slidev link if set, homework link if one exists)
- `/lectures/[slug]` — Lecture content with inline TOC and prev/next nav
- `/assignments/[slug]` — Assignment detail (no assignments list page — homework links live on the homepage and in each lecture's footer)

## Layout Hierarchy

- `BaseLayout.astro`: Root HTML structure, global styles
- `CourseLayout.astro`: Course-specific chrome (header, navigation, footer)
- `DocLayout.astro`: Single centered content column with an inline table of contents

## Key Components

- `src/components/navigation/MainNav.astro`: Top bar (brand = `site.title` from config, links home; no nav items — the homepage is the only list, so the title is enough)

## Styling System

Single centered reading column (`max-w-3xl` on doc pages, `max-w-4xl` on the homepage). Uses Tailwind CSS v3 with a small custom palette in `tailwind.config.mjs` and clean prose styles via `.prose-custom` in `src/styles/global.css`.

Design language: scholarly editorial. Cool paper background (`paper`), ink text with a green tint (`ink`), one desaturated deep-verdigris accent (`primary`), hairline borders (`line`). Typography uses system CJK stacks (no external font network dependency): serif display headings (Songti SC / Noto Serif CJK SC) for the editorial register, clean sans body, and monospace for meta labels, numbers, and code. Code blocks use Shiki `github-dark` tokens on a green-tinted dark surface (`.prose-custom pre` overrides Shiki's inline background with `!important`).

Flat design — no shadows, no floating/sticky elements other than the top nav. Decorative depth comes from a fixed, pointer-events-none ambient radial wash (`.ambient` in `global.css`). All colors pass WCAG AA on their surfaces (see `ink.faint` — tuned to 4.5:1+). There is deliberately **no client-side JS**: motion is CSS-only (hover/active transitions, transform/opacity only), and `prefers-reduced-motion` is respected by default since nothing auto-animates.

## Build Configuration

- Static output (`output: 'static'`)
- Base URL: `/course-template-astro/` (configured in `astro.config.mjs`)
- Shiki syntax highlighting with GitHub Dark theme
- Rehype plugins: `rehype-slug`, `rehype-autolink-headings` for TOC generation

## Deployment

GitHub Actions workflow (`.github/workflows/deploy.yml`) deploys to GitHub Pages on push to main. Also supports Netlify deployment via `netlify.toml`.

## Important Notes

- Update `site` URL in `astro.config.mjs` before deploying
- Draft content (frontmatter: `draft: true`) is filtered out in production
- There is deliberately **no client-side JS** (no progress tracking, no scroll-spy, no mark-complete) — the site is fully static and readable
