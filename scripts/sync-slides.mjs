// Slides sync: incrementally build changed slide decks (skip already-generated ones),
// then copy each deck into site/slides/lectureN/.
// Usage: node scripts/sync-slides.mjs [--force]   (--force rebuilds every deck)
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { copyDeckToSite, listLectures, needsRebuild, readSiteBase, run, SLIDES_DIR, SLIDES_DIST_DIR } from './lib.mjs';

const force = process.argv.includes('--force');
const base = readSiteBase();
const lectures = listLectures();

console.log('\n━━━ Slides sync ━━━');
console.log(force ? 'Force rebuild: all decks will be regenerated.' : 'Incremental: only decks whose source changed will be rebuilt.');

if (lectures.length === 0) {
  console.log('No slides/lectureNN.md files found — nothing to do.');
  process.exit(0);
}

let built = 0;
let skipped = 0;

for (const l of lectures) {
  const outDir = join(SLIDES_DIST_DIR, l.name); // build cache: slides/dist/lectureN/
  const marker = join(outDir, 'index.html');
  const stale = needsRebuild(l.src, marker);

  if (force || stale) {
    const deckBase = `${base}slides/${l.name}/`; // e.g. /course-template/slides/lecture01/
    console.log(`\n▶ Building ${l.file} → ${outDir}`);
    console.log(`  base: ${deckBase} (hash router for subdirectory deploys)`);
    run('node', [join(SLIDES_DIR, 'node_modules/@slidev/cli/bin/slidev.mjs'), 'build', l.file, '-o', outDir, '--base', deckBase, '--router-mode', 'hash'], { cwd: SLIDES_DIR });
    built++;
  } else {
    skipped++;
    console.log(`· ${l.file} — already generated, skipping.`);
  }

  // Copy the (re)built deck into site/slides/lectureN/.
  if (existsSync(marker)) {
    copyDeckToSite(l.name);
  } else {
    console.warn(`  ⚠ ${l.file} produced no output at ${outDir} — not copied.`);
  }
}

console.log(`\nSlides sync done: ${built} built, ${skipped} skipped.`);
