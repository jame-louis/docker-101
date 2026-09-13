# Log: Lecture 02 slide deck (Docker 安装实战)

Date: 2026-09-13

## What was done

Transformed `src/lectures/lecture02.md` (Ubuntu 软件安装体系与 Docker 实践完全手册) into a
Slidev deck `slides/lecture02.md` (50 slides), plus supporting assets.

Files added/changed:
- `slides/lecture02.md` — new deck: cover → 9 chapters + appendices → QA include,
  following the lecture structure slide-by-slide (code breakdowns, tables, tree diagrams,
  and all 27 实机截图 grouped 2-per-slide in grids for the paired steps, solo for key steps).
- `slides/public/images/` — all 27 screenshots copied from `src/lectures/images/`
  (16 `vm-install-ubuntu-step-*` + 11 `ubuntu-install-docker-step-*`; the unreferenced
  `vm-install-ubuntu.png` was not copied).
- `slides/lecture01.md` — fixed the QA include (see finding below).

Verified end-to-end with `npm run build` → deck in `site/slides/lecture02/`; served with
`scripts/serve.mjs` and curl-checked: deck index, JS assets, and images all 200.

## Update (same session): one image per slide

Per user request, restructured chapter 8 so every screenshot has its own slide
instead of 2-per-slide grids: the 9 paired grid slides were split into 27 solo image
slides (16 VM + 11 Docker steps), each with a short description line + the screenshot
at `w-3/4` centered. Grid HTML (`grid grid-cols-2`) removed entirely from content.
Deck grew 50 → 58 slides. Rebuilt + re-verified: 26 content chunks reference exactly
one `/images/` file, step-1 is served via its hashed asset
(`assets/vm-install-ubuntu-step-1-DANl5eoc.png`), all 200 on serve.

## Key findings (Slidev 52.19.1, rolldown-based)

1. **Images must live in `slides/public/`** and be referenced with absolute paths
   (`![alt](/images/x.png)` or `<img src="/images/x.png">`). Relative paths
   (`images/x.png`) fail: rolldown tries to resolve them as JS imports from the md and
   errors (`failed to resolve import ... from ...md__slidev_N.md`).
2. **HTML `<img>` and markdown image both work** from `public/`. HTML imgs stay at
   `/images/...` and get the deck base prefix at runtime (`/docker-101/slides/lecture02/images/...`);
   a markdown import at least once got hashed into `assets/vm-install-ubuntu-step-1-DANl5eoc.png`
   (also base-prefixed and served fine). Either way the URL is correct under the site base.
3. **QA include frontmatter at end of file needs a closing `---`.** The template
   (`lecture01.md`) ended the file with `layout: section / class / src: ./pages/QA.md /
   hide: false` and NO trailing `---` — built output rendered those YAML lines as a
   literal paragraph (slide content `i('hr'), i('p', 'layout: section class: ...')`), so
   the QA section silently never worked. Added the closing `---` to both decks; verified
   the last slide now loads `pages/QA.md` (`QA.md__slidev_50`, section layout, `Q&A` h1).

## Notes / caveats

- Deck asset check: Shiki splits code into token spans in the built md chunks, so naive
  substring checks on shell one-liners (e.g. `<<-'EOF'`, `gpg --dearmor ...`) fail;
  verify with looser patterns.
- A stale `node` server on port 4399 couldn't be killed from the sandbox; used port 4599
  for the serve check instead.
- `slides/public/` is tracked by git (not in slides/.gitignore) — intended, since decks
  build incrementally from committed assets.
- No automated sync between `src/lectures/`, `website/src/content/lectures/` and
  `slides/` — this deck was written by hand from the lecture.
