# Course Template — Design Snapshot

Canonical project memory. Read this first each session. (Plans in journey/plans/, logs in
journey/logs/, research in journey/research/.)

## Strategy

Minimal-dependency, content-driven course site: authors edit Markdown, everything else is
automatic. Chinese (`zh-CN`) university course. Astro website + Slidev decks, both deployed
as a single static `site/`.

## Key design decisions

- **Two content stores**: `src/` (plain Markdown, no frontmatter, draft source) and
  `website/src/content/` (Markdown + YAML frontmatter, what Astro consumes). Manual sync
  between them; no automation script (by design — keep it simple).
- **Slide decks mirror the site**: `site/slides/lectureN/` holds built decks, linked from
  the homepage via `slidevUrl` (rendered as `base + slidevUrl`).
- **Root build workflow** (added 2026-09-11, see journey/plans/2026-09-11-build-workflow.md):
  - `astro build` clears `website/dist/` by default (emptyOutDir) → website sync is always
    a full regenerate + full mirror into `site/` (empty first).
  - Slide decks build incrementally (mtime-based) into `slides/dist/lectureN/` cache, then
    copied to `site/slides/lectureN/`. `--force` rebuilds all.
  - Deck base = `<siteBase>slides/lectureN/` (derived from astro.config.mjs) + hash router.
  - No `--download` (requires Playwright, not installed). Astro telemetry disabled during build.
- **Deploy**: GitHub Pages via `.github/workflows/deploy.yml` (added 2026-09-11). On push
  to `main` (or `workflow_dispatch`): `npm ci` in `website/`+`slides/` → root `npm run
  build` → `touch site/.nojekyll` → `upload-pages-artifact` (path `site/`) →
  `deploy-pages`. Repo Pages source must be **GitHub Actions** (Settings → Pages).
  `astro.config.mjs` `site`/`base` already point at `https://jame-louis.github.io/course-template/`.
  `netlify.toml` remains for optional Netlify fallback.

## Constraints

- No client-side JS in the website (CSS-only motion, respects prefers-reduced-motion).
- No root npm dependencies (Node built-ins only for scripts).
- Local preview: `npm run dev`/`serve` (`scripts/serve.mjs`) serves built `site/` under the
  site base with SPA fallback.
- `site/`, `website/dist/`, `website/.astro/`, `slides/dist/`, `node_modules/` are
  gitignored build artifacts.

## Open questions / trade-offs

- Incremental slide check only tracks the deck's own `.md`; shared includes
  (`pages/`, `snippets/`, `components/`, theme) need `--force` after changes.
- A root `.gitignore` exists now; no automated sync between `src/` and `website/src/content/`.
