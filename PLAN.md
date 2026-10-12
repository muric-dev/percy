# Plan: Mars landscape with Vite + Three.js

## Context
Empty folder (only `CLAUDE.md` and `.git`). Node 24, npm 11, Google Chrome installed in `/Applications`. Goal: a cinematic Mars scene (dunes, rocks, caramel sky with dust, warm afternoon sun, soft shadows, Phobos and Deimos), visible in the browser in under 4 minutes, then improved through an automated check loop (`npm run check`).

## Step 0 — Save the plan
Copy this plan to `PLAN.md` in the project root (first action after leaving plan mode).

## Step 1 — Quick start (goal: < 4 min)
1. Create by hand (no `npm create`, to avoid prompts): `package.json`, `index.html`, `src/main.js`.
2. `npm i three` and `npm i -D vite playwright-core` (playwright-core does not download browsers).
3. Minimal first version in `src/main.js`: renderer with shadows, noise-based terrain (dunes), caramel background + fog, low warm directional light, a few rocks, OrbitControls with slow auto-rotation.
4. Start `npm run dev -- --host --port 5173` in the background and share the URL `http://localhost:5173`. Vite hot-reloads on every change.

## Step 2 — Check script `npm run check`
`scripts/check.mjs` using `playwright-core`:
- `chromium.launch({ channel: 'chrome', headless: true, args: [...] })` so WebGL works headless.
- Opens `http://localhost:5173` (assumes the dev server is running; warns if it does not respond).
- Listens to `console` (error/warning) and `pageerror`.
- Waits for the scene to render, saves `screenshots/check.png` (1600×900).
- Prints the error list and exits with code 1 if there are errors.

## Step 3 — Improvements (max 4 rounds, `npm run check` + review the screenshot after each)
Organize into small modules under `src/`:
- `terrain.js`: large subdivided plane, fBm noise + ridge-like dunes (noise-warped sine waves), vertex colors ochre/rust by height and slope.
- `rocks.js`: noise-deformed `IcosahedronGeometry`, `InstancedMesh` with random scale/rotation, resting on the terrain height, `castShadow`.
- `sky.js`: sky sphere with a custom shader: caramel/butterscotch gradient at the horizon → darker brown overhead, bluish halo around the sun (a real feature of Martian sunsets), small solar disc.
- `moons.js`: Phobos (larger, irregular) and Deimos (small) as deformed spheres with a faint emissive material, placed in the sky and slowly rotating.
- `dust.js`: floating `Points` particles with soft additive blending + caramel `FogExp2`.
- Lighting: low warm `DirectionalLight` (afternoon sun) with soft shadows, caramel/rust `HemisphereLight`; `ACESFilmicToneMapping`, `SRGBColorSpace`.
- Optional post-processing if the screenshot calls for it: `EffectComposer` + soft `UnrealBloomPass` for the sun.
- Low "cinematic shot" camera.

## Files
- `package.json` (scripts: `dev`, `build`, `check`)
- `index.html`, `src/main.js`, `src/terrain.js`, `src/rocks.js`, `src/sky.js`, `src/moons.js`, `src/dust.js`
- `scripts/check.mjs`
- `.gitignore` (`node_modules`, `dist`, `screenshots`)

## Verification / definition of done
- `npm run check` with no console errors and no `pageerror`.
- `screenshots/check.png` shows: dunes, rocks with soft shadows, caramel sky with dust/fog, low warm sun and both moons.
- At most 4 fix rounds; if something is still missing after the 4th, report it honestly.
