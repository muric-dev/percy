# Plan: Paisaje de Marte con Vite + Three.js

## Contexto
Carpeta vacía (solo `CLAUDE.md` y `.git`). Node 24, npm 11, Google Chrome instalado en `/Applications`. Objetivo: escena cinematográfica de Marte (dunas, rocas, cielo caramelo con polvo, sol de tarde cálido, sombras suaves, Fobos y Deimos), visible en el navegador en < 4 min, luego mejorada con un bucle de verificación automática (`npm run check`).

## Paso 0 — Guardar el plan
Copiar este plan tal cual a `/Users/marco/Documents/perseverancia/PLAN.md` (primera acción al salir del modo plan).

## Paso 1 — Arranque rápido (meta: < 4 min)
1. Crear a mano (sin `npm create`, para evitar prompts): `package.json`, `index.html`, `src/main.js`.
2. `npm i three` y `npm i -D vite playwright-core` (playwright-core no descarga navegadores).
3. Primera versión mínima en `src/main.js`: renderer con sombras, terreno con ruido (dunas), fondo color caramelo + niebla, luz direccional cálida baja, unas rocas, OrbitControls con auto-rotación lenta.
4. Lanzar `npm run dev -- --host --port 5173` en segundo plano y dar la URL `http://localhost:5173`. Vite recarga en vivo con cada cambio.

## Paso 2 — Script de verificación `npm run check`
`scripts/check.mjs` con `playwright-core`:
- `chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal' / '--enable-unsafe-swiftshader'] })` para que WebGL funcione en headless.
- Abre `http://localhost:5173` (asume servidor de dev ya corriendo; si no responde, avisa).
- Escucha `console` (type error/warning) y `pageerror`.
- Espera ~3 s a que renderice, guarda `screenshots/check.png` (1600×900).
- Imprime la lista de errores y sale con código 1 si hay errores.

## Paso 3 — Mejoras (máx. 4 rondas, `npm run check` + mirar captura tras cada una)
Organizar en módulos pequeños dentro de `src/`:
- `terrain.js`: plano grande subdividido, ruido fBm + dunas tipo cresta (ondas sinusoidales deformadas por ruido), colores por vértice ocre/óxido según altura y pendiente.
- `rocks.js`: `IcosahedronGeometry` deformadas con ruido, `InstancedMesh` con escala/rotación aleatorias, posadas sobre la altura del terreno, `castShadow`.
- `sky.js`: esfera de cielo con shader propio: gradiente caramelo/butterscotch en el horizonte → marrón más oscuro arriba, halo azulado alrededor del sol (rasgo real del atardecer marciano), disco solar pequeño.
- `moons.js`: Fobos (más grande, irregular) y Deimos (pequeño) como esferas deformadas con material emisivo tenue, colocadas en el cielo y orbitando lentamente.
- `dust.js`: partículas `Points` flotando con aditivo suave + `FogExp2` color caramelo.
- Iluminación: `DirectionalLight` cálida baja (sol de tarde) con `PCFSoftShadowMap`, `shadow.radius`, `HemisphereLight` caramelo/óxido; `ACESFilmicToneMapping`, `SRGBColorSpace`.
- Post-proceso opcional si la captura lo pide: `EffectComposer` + `UnrealBloomPass` suave para el sol.
- Cámara baja tipo "plano de cine" con auto-rotación lenta.

## Archivos
- `package.json` (scripts: `dev`, `build`, `check`)
- `index.html`, `src/main.js`, `src/terrain.js`, `src/rocks.js`, `src/sky.js`, `src/moons.js`, `src/dust.js`
- `scripts/check.mjs`
- `.gitignore` (`node_modules`, `dist`, `screenshots`)

## Verificación / criterio de "listo"
- `npm run check` sin errores de consola ni `pageerror`.
- Al revisar `screenshots/check.png` se ven: dunas, rocas con sombras suaves, cielo caramelo con polvo/niebla, sol cálido bajo y las dos lunas.
- Máximo 4 rondas de corrección; si algo no queda tras la 4ª, lo reporto honestamente.
