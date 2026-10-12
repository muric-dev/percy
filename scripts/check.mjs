// npm run check: opens the scene in headless Chrome, saves screenshots and lists console errors.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const URL = process.env.URL || 'http://localhost:5173';
const OUT = 'screenshots/check.png';
mkdirSync('screenshots', { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome', // uses the installed Chrome, no browser downloads
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

const errors = [];
const logs = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
  else logs.push(m.text());
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

try {
  await page.goto(URL, { waitUntil: 'load', timeout: 15000 });
} catch (e) {
  console.error(`Could not open ${URL}. Is "npm run dev" running?\n${e.message}`);
  await browser.close();
  process.exit(1);
}
// Wait for the rover to load (window.__ready), if the scene sets it
await page.waitForFunction(() => window.__ready, null, { timeout: 30000 }).catch(() => {
  errors.push('[check] the scene did not set window.__ready within 30 s');
});
await page.waitForTimeout(2500);
await page.screenshot({ path: OUT });

// Driving test: forward, turn and forward; then another screenshot showing the tracks
const OUT_DRIVE = 'screenshots/check-drive.png';
await page.keyboard.down('KeyW');
await page.waitForTimeout(3000);
await page.keyboard.down('KeyA');
await page.waitForTimeout(1200);
const OUT_TURN = 'screenshots/check-turn.png'; // mid-turn: corner wheels should be steered
await page.screenshot({ path: OUT_TURN });
await page.waitForTimeout(800);
await page.keyboard.up('KeyA');
await page.waitForTimeout(1500);
await page.keyboard.up('KeyW');
await page.waitForTimeout(1500);
await page.screenshot({ path: OUT_DRIVE });
await browser.close();

if (logs.length) console.log('Console:\n' + logs.join('\n') + '\n');
console.log(`Screenshots: ${OUT}, ${OUT_TURN}, ${OUT_DRIVE}`);
if (errors.length) {
  console.log(`\n${errors.length} console error(s)/warning(s):`);
  errors.forEach((e) => console.log(' - ' + e));
  process.exit(1);
}
console.log('No console errors ✅');
