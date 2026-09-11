# 2026-09-11 — GitHub Pages deploy workflow

## What

Added `.github/workflows/deploy.yml` so pushing to `main` builds the site and publishes
`site/` to GitHub Pages. Previously only `netlify.toml` existed; no workflow was present
(AGENTS.md mentioned one, but the repo had none).

## Workflow (build job → deploy job)

1. Checkout, setup-node 20 (with npm cache).
2. `npm --prefix website ci` + `npm --prefix slides ci` (root has no deps and no lockfile —
   a root `npm ci` was tried first and correctly removed; root needs no install).
3. `npm run build` with `ASTRO_TELEMETRY_DISABLED=1` (verified locally — full build OK,
   site/ = Astro dist + `slides/lecture01` deck).
4. `touch site/.nojekyll` — defensive: GH Pages Actions deploys don't run Jekyll, but the
   marker guarantees `_astro/` assets are served.
5. `actions/upload-pages-artifact@v3` (path `site/`) → `actions/deploy-pages@v4`.
   Permissions: `contents: read`, `pages: write`, `id-token: write`; concurrency group
   `pages` with cancel-in-progress.

## Verified

- Local full build passes (`npm run build`), output structure correct.
- `npm --prefix website ci --dry-run` / `npm --prefix slides ci --dry-run` both pass →
   lockfiles in sync, no CI install failure expected.

## User action needed (one-time)

Repo Settings → Pages → Source: **GitHub Actions**. Then the next push to `main` deploys.

## Docs updated

- `AGENTS.md`: fixed workflow path in layout tree (repo root, not `website/.github/`),
  documented the workflow in the Deployment section, added Pages setup to the Getting
  Started checklist.
- `journey/design.md`: Deployment decision updated.

## Notes / follow-ups

- Root `package-lock.json` does not exist (root has no deps) — fine; don't add a root
  install step to the workflow.
- **Fix (same day)**: first CI run failed at `actions/setup-node@v4` — `cache: npm`
  requires a lockfile at the repo root, which doesn't exist. Removed `cache: npm`
  (simplest reliable fix; `cache-dependency-path` with globs/multi-lists is documented
  but has known version-specific bugs — e.g. "path glob not matched"). Installs now run
  uncached (slightly slower, correct).
- Netlify fallback (`website/netlify.toml`) intentionally kept.
- **README.md added (same day)**: repo front page, in Chinese (zh-CN) matching course
  content language. Covers overview, tech stack, quick start, content workflow
  (Markdown-driven), directory layout, deployment (GitHub Pages default + Netlify
  fallback), new-course checklist, and license note (none specified).
