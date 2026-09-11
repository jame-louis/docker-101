// Full build: website first (empties site/), then incremental slides.
import { run } from './lib.mjs';

run('node', ['scripts/sync-website.mjs']);
run('node', ['scripts/sync-slides.mjs']);

console.log('\n✅ Full build complete: site/ holds the website + slide decks.');
