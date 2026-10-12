// npm run check: abre la escena en Chrome invisible, guarda captura y lista errores de consola.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const URL = process.env.URL || 'http://localhost:5173';
const OUT = 'screenshots/check.png';
mkdirSync('screenshots', { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome', // usa el Chrome instalado, sin descargar navegadores
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
  console.error(`No se pudo abrir ${URL}. ¿Está corriendo "npm run dev"?\n${e.message}`);
  await browser.close();
  process.exit(1);
}
// Esperar a que cargue el rover (window.__ready), si la escena lo tiene
await page.waitForFunction(() => window.__ready, null, { timeout: 30000 }).catch(() => {
  errors.push('[check] la escena no marcó window.__ready en 30 s');
});
await page.waitForTimeout(2500);
await page.screenshot({ path: OUT });

// Prueba de conducción: avanzar, girar y avanzar; luego otra captura con las huellas
const OUT_DRIVE = 'screenshots/check-drive.png';
await page.keyboard.down('KeyW');
await page.waitForTimeout(3000);
await page.keyboard.down('KeyA');
await page.waitForTimeout(2000);
await page.keyboard.up('KeyA');
await page.waitForTimeout(1500);
await page.keyboard.up('KeyW');
await page.waitForTimeout(1500);
await page.screenshot({ path: OUT_DRIVE });
await browser.close();

if (logs.length) console.log('Consola:\n' + logs.join('\n') + '\n');
console.log(`Capturas: ${OUT}, ${OUT_DRIVE}`);
if (errors.length) {
  console.log(`\n${errors.length} error(es)/aviso(s) de consola:`);
  errors.forEach((e) => console.log(' - ' + e));
  process.exit(1);
}
console.log('Sin errores de consola ✅');
