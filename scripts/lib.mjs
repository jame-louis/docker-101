// Shared helpers for the root-level build workflow. Zero dependencies (Node built-ins only).
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url)); // repo root (trailing slash)
export const WEBSITE_DIR = join(ROOT, 'website');
export const SLIDES_DIR = join(ROOT, 'slides');
export const SITE_DIR = join(ROOT, 'site');
export const DIST_DIR = join(WEBSITE_DIR, 'dist');
export const SLIDES_DIST_DIR = join(SLIDES_DIR, 'dist');
export const SLIDEV_BIN = join(SLIDES_DIR, 'node_modules/.bin/slidev');

/** Run a command synchronously, inheriting stdio. Exits on non-zero status. */
export function run(cmd, args, { cwd = ROOT, env = {} } = {}) {
  const res = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    process.stderr.write(`\n✗ Command failed (${res.status}): ${cmd} ${args.join(' ')}\n`);
    process.exit(res.status ?? 1);
  }
}

/** Recursively delete a directory's contents and recreate it. */
export function emptyDir(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

/** Recursively copy a directory's contents into dest (dest is created if needed). */
export function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
}

/** Read `base` from website/astro.config.mjs (falls back to '/'). */
export function readSiteBase() {
  const config = join(WEBSITE_DIR, 'astro.config.mjs');
  if (existsSync(config)) {
    const m = readFileSync(config, 'utf8').match(/base\s*:\s*['"]([^'"]+)['"]/);
    if (m) return m[1];
  }
  return '/';
}

/** List slide decks in slides/ (lectureNN.md), sorted by number. */
export function listLectures() {
  return readdirSync(SLIDES_DIR)
    .filter((f) => /^lecture\d+\.md$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
    .map((f) => ({
      file: f,
      name: f.replace(/\.md$/, ''), // lecture01
      src: join(SLIDES_DIR, f),
    }));
}

/** Incremental check: rebuild if marker is missing or the source md is newer. */
export function needsRebuild(lectureMdPath, markerPath) {
  if (!existsSync(markerPath)) return true;
  return statSync(lectureMdPath).mtimeMs > statSync(markerPath).mtimeMs;
}

/** Copy a built deck from the cache (slides/dist/lectureN) into site/slides/lectureN. */
export function copyDeckToSite(deckName) {
  const src = join(SLIDES_DIST_DIR, deckName);
  if (!existsSync(join(src, 'index.html'))) return false;
  copyDir(src, join(SITE_DIR, 'slides', deckName));
  return true;
}
