// Headless screenshot of the built single file.
// usage: node scripts/screenshot.mjs out.png [explode=0.5] [cat=upper] [view=az,el,zoom] [focus=x,y,z] [select=Part name] [w=412] [h=915] [theme=dark] [reduced=1]
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';

const [out = 'shot.png', ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.split('=')));
const w = +(opt.w || 412), h = +(opt.h || 915);

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({
  viewport: { width: w, height: h },
  deviceScaleFactor: 2,
  colorScheme: opt.theme === 'dark' ? 'dark' : 'light',
  reducedMotion: opt.reduced ? 'reduce' : 'no-preference',
});
page.on('console', (m) => console.log('[page]', m.type(), m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('file://' + resolve('m4-sopmod.html'));
await page.waitForFunction(() => window.app && window.app.ready, null, { timeout: 60000 });
await page.evaluate(async (o) => {
  const a = window.app;
  if (o.cat) a.setCategory(o.cat);
  if (o.explode) a.setExplode(+o.explode, true);
  if (o.view) a.setView(...o.view.split(',').map(Number));
  if (o.focus) a.focus(...o.focus.split(',').map(Number));
  if (o.select) a.selectByName(o.select);
  await a.settle();
}, opt);
await page.screenshot({ path: out });
await browser.close();
console.log('saved', out);
