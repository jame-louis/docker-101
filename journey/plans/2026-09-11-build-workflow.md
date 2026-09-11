# Plan: Root-level build workflow (site + slides)

Date: 2026-09-11

## Goal

A root `package.json` + small Node scripts (zero new deps) that orchestrate the full
build:

1. Build the Astro website, then mirror `website/dist/` → `site/`.
2. Build slide decks, then copy each into `site/slides/lectureN/`.
3. When the website is rebuilt, empty `site/` first (clean mirror).
4. When slides change, only the changed lecture deck is rebuilt and copied.
5. Do **not** regenerate already-built slide decks (incremental, mtime-based).
6. Verified fact: `astro build` clears `dist/` by default
   (`emptyOutDir !== false` in `website/node_modules/astro/dist/core/build/static-build.js`
   lines 39-41), so website sync is always a full regenerate + full copy.

## Verified facts

- **Astro 5.18.2**: static build calls `emptyDir(outDir, {'.git'})` unless
  `vite.build.emptyOutDir === false`. So `npm --prefix website run build` wipes
  `website/dist/` first. → website sync is always full.
- **Slidev 52.19.1**: `slidev build <entry> -o <dir>` puts a single entry directly into
  `<dir>` (index.html + 404.html + _redirects + assets/). Multi-entry puts each deck into
  `<dir>/<basename-without-.md>/`. Source: `slides/node_modules/@slidev/cli/dist/cli.mjs` line 319.
- Slidev `--download` requires Playwright (not installed) → do **not** use it.
- Deck base must be set so assets resolve under the deployed path:
  `--base <siteBase>slides/lectureN/ --router-mode hash` (hash router recommended for
  GitHub Pages / subdirectory deploys). Verified: built index.html references
  `/course-template/slides/lecture01/assets/...`.
- `site/` is currently byte-identical to `website/dist/`; no slides present yet.
- Homepage renders `slidevUrl` as `base + slidevUrl` (index.astro line 74), and lecture01
  sets `slidevUrl: /slides/lecture01` → deck URL is `/course-template/slides/lecture01`.

## Design

```
Root package.json scripts (run from root, no root deps):
  build             → node scripts/build.mjs          (website + slides)
  build:website     → node scripts/sync-website.mjs   (astro build → empty site → copy → restore cached decks)
  build:slides      → node scripts/sync-slides.mjs    (incremental; --force rebuilds all)
  dev:website / dev:slides → convenience dev servers

scripts/lib.mjs         shared helpers (emptyDir, copyDir, readSiteBase, listLectures, needsRebuild)
scripts/sync-website.mjs  astro build; empty site/; copy website/dist/* → site/; restore cached slide decks
scripts/sync-slides.mjs   for each slides/lectureNN.md: if stale → slidev build into slides/dist/lectureNN/
                          then copy slides/dist/lectureNN/ → site/slides/lectureNN/
scripts/build.mjs         run sync-website then sync-slides
```

### Incremental slide logic (`sync-slides.mjs`)

For each `slides/lectureNN.md`:
- Build-cache marker: `slides/dist/lectureNN/index.html` (cache survives `site/` resets)
- Rebuild iff: marker missing **or** `slides/lectureNN.md` mtime > marker mtime
- After (re)build, copy `slides/dist/lectureNN/` → `site/slides/lectureNN/`
- `--force` rebuilds every deck.

Caveat: shared includes (`pages/`, `snippets/`, `components/`, theme) are NOT tracked;
changing only those won't trigger a rebuild unless the deck's own md changes. Use
`build:slides --force` for that.

### Website sync (`sync-website.mjs`)

1. `npm --prefix website run build` (Astro empties `website/dist/` itself).
2. Empty `site/`.
3. Copy `website/dist/*` → `site/` (including dotfiles).
4. Restore every built deck from `slides/dist/lectureNN/` → `site/slides/lectureNN/`
   (cheap copy, no rebuild) so `site/` always has slides even when only the site is rebuilt.

### Base path

Deck base derived from `website/astro.config.mjs` (`base: '...'`) so it stays in sync with
the site base. Deck base = `<siteBase>slides/lectureNN/`.

## Files touched

- `package.json` (root) — rewrite with build scripts
- `.gitignore` — add build artifacts + caches (website/dist, website/.astro, slides/dist, node_modules, etc.)
- `scripts/lib.mjs`, `scripts/sync-website.mjs`, `scripts/sync-slides.mjs`, `scripts/build.mjs`
- `journey/plans/2026-09-11-build-workflow.md`, `journey/logs/2026-09-11-build-workflow.md`

## Validation

- `npm run build` → check `site/` has website + `site/slides/lecture01/`
- Run `npm run build:slides` again → all decks skipped (already generated)
- Touch `slides/lecture01.md` → only lecture01 rebuilt
- `npm run build:slides -- --force` → all rebuilt
