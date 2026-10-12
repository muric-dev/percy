import { rng } from '../utils/noise.js';
import { ROVER_START } from '../config.js';

// Small impact craters on the Jezero floor.
// Shape: bowl with raised rim. Fresh simple craters on Mars have depth/diameter ≈ 0.2
// (Daubar et al. 2014 measured ~0.23); older eroded ones are much shallower.
// Sizes follow a power law, N(>D) ∝ D^-2, a common approximation for small craters.
const AREA = 1000; // side of the square (m) where craters are scattered
const COUNT = 140;
const D_MIN = 6, D_MAX = 80; // m (smaller craters are below the terrain mesh resolution)
const FRESH_DEPTH_RATIO = 0.2, DEGRADED_DEPTH_RATIO = 0.06;
const FRESH_RIM_RATIO = 0.036; // rim height / diameter for fresh craters
const EJECTA_REACH = 2; // the rim's ejecta blanket fades out at 2 crater radii
const CELL = 100; // spatial grid cell (m), larger than the biggest crater's reach

const grid = new Map();
const cellKey = (cx, cz) => `${cx},${cz}`;

function generate() {
  const rand = rng(2020);
  for (let i = 0; i < COUNT; i++) {
    const diameter = Math.min(D_MIN / Math.sqrt(1 - rand()), D_MAX);
    const radius = diameter / 2;
    const x = (rand() - 0.5) * AREA, z = (rand() - 0.5) * AREA;
    if (Math.hypot(x - ROVER_START.x, z - ROVER_START.z) < radius * EJECTA_REACH + 6) continue; // flat spawn

    const freshness = Math.pow(rand(), 3); // most small craters are degraded
    const depthRatio = DEGRADED_DEPTH_RATIO + (FRESH_DEPTH_RATIO - DEGRADED_DEPTH_RATIO) * freshness;
    const rim = FRESH_RIM_RATIO * diameter * (depthRatio / FRESH_DEPTH_RATIO);
    const crater = { x, z, radius, rim, bowl: depthRatio * diameter };

    const key = cellKey(Math.floor(x / CELL), Math.floor(z / CELL));
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(crater);
  }
}
generate();

// Height offset (m) produced by craters at (x, z)
export function craterHeight(x, z) {
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  let h = 0;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      for (const c of grid.get(cellKey(cx + i, cz + j)) ?? []) {
        const r = Math.hypot(x - c.x, z - c.z) / c.radius;
        if (r < 1) h += c.bowl * r * r - (c.bowl - c.rim); // bowl: floor at rim − depth
        else if (r < EJECTA_REACH) h += c.rim * Math.pow(r, -3) * (1 - (r - 1) / (EJECTA_REACH - 1));
      }
    }
  }
  return h;
}
