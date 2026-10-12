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

// Mission control: the 4 channels must load real numbers, light time must tick live and T must hide it
const CHANNELS = {
  distance: [1, 1000], // km driven since landing
  elevation: [-5000, 0], // m, Jezero lies kilometers below Mars's average level
  tilt: [0, 45], // degrees
  lightTime: [3, 23], // min: 3.0 at closest approach, 22.3 at farthest
};
const loaded = await page
  .waitForFunction((keys) => keys.every((k) => window.__missionControl?.channels[k]?.value != null), Object.keys(CHANNELS), { timeout: 20000 })
  .then(() => true, () => false);
const mission = await page.evaluate(() => window.__missionControl);
console.log('Mission control:');
for (const [key, [min, max]] of Object.entries(CHANNELS)) {
  const c = mission?.channels[key];
  const ok = c && Number.isFinite(c.value) && c.value >= min && c.value <= max && c.points > 1;
  console.log(` ${ok ? '✅' : '❌'} ${c?.name ?? key}: ${c?.value ?? '—'} ${c?.unit ?? ''} (${c?.points ?? 0} points · ${c?.provider ?? 'no provider'})`);
  if (!ok) errors.push(`[check] mission control "${key}" did not load a real value${loaded ? '' : ' within 20 s'}`);
}
const lightBefore = mission?.channels.lightTime?.updatedAt;
await page.waitForTimeout(2200);
const lightAfter = await page.evaluate(() => window.__missionControl?.channels.lightTime?.updatedAt);
if (!lightBefore || lightAfter === lightBefore) errors.push('[check] mission control light time is not updating live');
const panelVisible = () => page.evaluate(() => !!document.getElementById('mission')?.checkVisibility());
const OUT_MISSION = 'screenshots/check-mission.png';
await page.mouse.move(1450, 345); // hover the first chart to show its crosshair readout
await page.waitForTimeout(200);
await page.screenshot({ path: OUT_MISSION });
const shownAtStart = await panelVisible();
await page.keyboard.press('KeyT');
await page.waitForTimeout(200);
const hiddenByT = !(await panelVisible());
await page.keyboard.press('KeyT');
await page.waitForTimeout(200);
const shownAgain = await panelVisible();
console.log(` ${shownAtStart && hiddenByT && shownAgain ? '✅' : '❌'} T hides and shows the panel\n`);
if (!(shownAtStart && hiddenByT && shownAgain)) errors.push('[check] T does not hide/show mission control');
await page.mouse.move(800, 450);

// Driving test: forward, turn and forward; then another screenshot showing the tracks
const OUT_DRIVE = 'screenshots/check-drive.png';
await page.keyboard.press('KeyQ'); // double speed
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

// Night: start the Martian clock at 23:00 local time to see the stars and the sky map
const OUT_NIGHT = 'screenshots/check-night.png';
await page.goto(`${URL}/?time=23`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready, null, { timeout: 30000 }).catch(() => {
  errors.push('[check] the night scene did not set window.__ready within 30 s');
});
await page.waitForTimeout(2000);
await page.screenshot({ path: OUT_NIGHT });

// Sky view (V): camera on the mast looking straight up
const OUT_SKY = 'screenshots/check-skyview.png';
await page.keyboard.press('KeyV');
await page.waitForTimeout(1000);
await page.screenshot({ path: OUT_SKY });
await browser.close();

if (logs.length) console.log('Console:\n' + logs.join('\n') + '\n');
console.log(`Screenshots: ${OUT}, ${OUT_MISSION}, ${OUT_TURN}, ${OUT_DRIVE}, ${OUT_NIGHT}, ${OUT_SKY}`);
if (errors.length) {
  console.log(`\n${errors.length} console error(s)/warning(s):`);
  errors.forEach((e) => console.log(' - ' + e));
  process.exit(1);
}
console.log('No console errors ✅');
