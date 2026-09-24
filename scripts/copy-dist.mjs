// Copies the single-file build to the repo root under a descriptive name and
// fails loudly if anything would still be fetched from the network.
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
const external = html.match(/<(script|link)[^>]+(src|href)=["'](?!data:)[^"']+["']/gi) || [];
if (external.length) {
  console.error('External references found in build:', external);
  process.exit(1);
}
writeFileSync('m4-sopmod.html', html);
console.log(`m4-sopmod.html written (${(html.length / 1024).toFixed(0)} KB, no external references)`);
