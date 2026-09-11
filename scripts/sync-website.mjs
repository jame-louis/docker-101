// Website sync: build Astro, empty site/, mirror website/dist → site/,
// then restore cached slide decks (cheap copy, no rebuild).
import { copyDir, DIST_DIR, emptyDir, listLectures, copyDeckToSite, run, SITE_DIR, WEBSITE_DIR } from './lib.mjs';

console.log('\n━━━ Website sync ━━━');

// 1. Build Astro. Verified: `astro build` clears website/dist/ by default
//    (emptyOutDir in static-build.js), so dist is always a fresh full build.
console.log('[1/3] Building Astro website…');
// ASTRO_TELEMETRY_DISABLED: keep builds offline/hermetic (no ~/.astro config writes).
run('npm', ['--prefix', WEBSITE_DIR, 'run', 'build'], { env: { ASTRO_TELEMETRY_DISABLED: '1' } });

// 2. Empty site/ so the mirror is clean (a website update always regenerates dist).
console.log('[2/3] Emptying site/…');
emptyDir(SITE_DIR);

// 3. Mirror website/dist → site/.
console.log('[3/3] Copying website/dist → site/…');
copyDir(DIST_DIR, SITE_DIR);

// 4. Restore any cached slide decks so site/slides survives the reset.
let restored = 0;
for (const l of listLectures()) {
  if (copyDeckToSite(l.name)) restored++;
}
console.log(`Restored ${restored} cached slide deck(s) into site/slides/ (no rebuild).`);
console.log('Website sync done.');
