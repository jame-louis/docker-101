# Log: Root build workflow (website + slides)

Date: 2026-09-11

## What was done

Added a zero-dependency root build workflow so `npm run build` produces the complete
deployable `site/` (Astro website + Slidev decks).

Files added/changed:
- `package.json` (root) — `build`, `build:website`, `build:slides`, `build:slides:force`,
  `dev:website`, `dev:slides` (no deps).
- `scripts/lib.mjs` — helpers (run, emptyDir, copyDir, readSiteBase, listLectures,
  needsRebuild, copyDeckToSite).
- `scripts/sync-website.mjs` — astro build → empty site/ → mirror website/dist → restore
  cached decks.
- `scripts/sync-slides.mjs` — incremental per-deck build + copy to site/slides/lectureN.
- `scripts/build.mjs` — runs website then slides.
- `.gitignore` — now ignores website/dist, website/.astro, slides/dist, node_modules.
- `AGENTS.md` — documented the root workflow (Commands, Build workflow details,
  Deployment, Getting Started step 6).

## Facts verified (in installed sources)

1. **Astro clears dist by default.** `website/node_modules/astro/dist/core/build/static-build.js`
   lines 39-41: `if (settings.config?.vite?.build?.emptyOutDir !== false) emptyDir(outDir, {'.git'})`.
   → website sync is always a full regenerate + full mirror.
2. **Slidev single-entry output.** `slides/node_modules/@slidev/cli/dist/cli.mjs` line 319:
   single entry → out goes directly into `-o <dir>`; multi-entry → `-o <dir>/<name>/`.
   We always build one deck per invocation into `slides/dist/lectureN/`.
3. **Slidev `--download` requires Playwright** (not installed) — build failed on export
   step. Excluded from the workflow.
4. **Deck base**: `--base /course-template/slides/lectureN/ --router-mode hash` makes the
   built index.html reference `/course-template/slides/lectureN/assets/...` (verified in
   output). Derived from `astro.config.mjs` base via `readSiteBase()`.
5. **Telemetry**: `astro build` writes `~/.astro/config.json`; blocked in sandbox → set
   `ASTRO_TELEMETRY_DISABLED=1` in the website sync for hermetic builds.

## Behavior validated

- `npm run build` → website built, site/ emptied + mirrored, deck built into
  site/slides/lecture01/, assets resolve under the site base.
- Re-run `build:slides` → `lecture01.md — already generated, skipping` (incremental works).
- Touch `slides/lecture01.md` → only lecture01 rebuilt.
- `build:website` standalone → site/ emptied, website copied, cached deck restored (no rebuild).
- `build:slides:force` → rebuilds all.

## Notes / caveats

- Incremental check is mtime-based on the deck's own `.md` only. Shared includes
  (`pages/`, `snippets/`, `components/`, theme) are not tracked; use `--force` after
  changing those.
- `git checkout` was blocked by the harness sandbox during testing (`.gitconfig` access);
  restored test edits with `sed` instead.
- Only lecture01 deck exists so far; the workflow iterates `slides/lectureNN.md` and will
  pick up new decks automatically.

## Follow-up: local site server (`dev` / `serve`)

Added `scripts/serve.mjs` — a zero-dependency static server for the built `site/`:
- Serves `site/` under the site `base` (read from `astro.config.mjs`), redirects `/` → base,
  SPA fallback to `index.html` (slide decks need this).
- Root scripts: `npm run dev` (alias `serve`), default port 4321, `--port N` or `PORT=N`.
- Verified with curl: `/`→302→`/course-template/`, homepage/deck/assets 200, missing→404.
- Fixed a bug where `--port` was read as `argv[0]` when absent (NaN port) — now guarded.
