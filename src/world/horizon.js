import * as THREE from 'three';
import { MARS_RADIUS } from '../config.js';
import { fbm } from '../utils/noise.js';

// Distant skyline seen from the landing site: the rim of Jezero crater and, to the west, the delta.
// Jezero is ~45 km across. Octavia E. Butler Landing (18.445°N 77.451°E) lies ~7.2 km west and
// ~3.8 km north of the crater center, so the rim is ~14 km away to the WNW and ~31 km to the ESE.
// Distances use the planet's curvature (drop = d² / 2R), which hides much of the far eastern rim.
const RIM_RADIUS = 22500;
const SITE = { x: -7200, z: -3800 }; // landing site relative to the crater center (north = -Z)
const RIM_HEIGHT = 500; // estimated rim relief above the floor (the rover climbed ~300 m up the western rim)
const DELTA = { from: 235, to: 305, distance: 2200, height: 50 }; // western fan front (estimated height)
const RENDER_RADIUS = 3000; // the skyline is drawn as a ring at this distance, following the camera
const SEGMENTS = 720;

const curvatureDrop = (d) => (d * d) / (2 * MARS_RADIUS);
const elevationOf = (height, distance) => Math.atan2(height - curvatureDrop(distance), distance);

// Distance from the landing site to the rim along a compass azimuth (ray-circle intersection)
function rimDistance(az) {
  const dx = Math.sin(az), dz = -Math.cos(az);
  const b = SITE.x * dx + SITE.z * dz;
  const c = SITE.x * SITE.x + SITE.z * SITE.z - RIM_RADIUS * RIM_RADIUS;
  return -b + Math.sqrt(b * b - c);
}

// Rim: angle above the horizon at a given azimuth (degrees)
function rimElevation(azDeg) {
  const az = THREE.MathUtils.degToRad(azDeg);
  const rugged = 1 + fbm(Math.cos(az) * 6, Math.sin(az) * 6, 5) * 0.5; // eroded rim
  return elevationOf(RIM_HEIGHT * rugged, rimDistance(az));
}

// Delta front: a flat-topped scarp with eroded flanks
function deltaElevation(azDeg) {
  const flank = Math.min(azDeg - DELTA.from, DELTA.to - azDeg) / 6;
  const scarp = DELTA.height * Math.min(flank, 1) * (1 + fbm(azDeg * 0.3, 1.7, 3) * 0.4);
  return elevationOf(scarp, DELTA.distance);
}

// A vertical band at `radius` whose top follows elevationFn(azimuth); haze 0..1 blends it into the dust
function ring(radius, fromDeg, toDeg, elevationFn, haze) {
  const positions = [], indices = [];
  const steps = Math.ceil(((toDeg - fromDeg) / 360) * SEGMENTS);
  for (let i = 0; i <= steps; i++) {
    const azDeg = fromDeg + ((toDeg - fromDeg) * i) / steps;
    const az = THREE.MathUtils.degToRad(azDeg);
    const x = Math.sin(az) * radius, z = -Math.cos(az) * radius;
    positions.push(x, Math.tan(elevationFn(azDeg)) * radius, z, x, -radius * 0.03, z);
    if (i < steps) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ fog: false, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  mesh.userData.haze = haze;
  return mesh;
}

export function createHorizon() {
  const horizon = new THREE.Group();
  horizon.add(
    ring(RENDER_RADIUS, 0, 360, rimElevation, 0.88),
    ring(RENDER_RADIUS * 0.9, DELTA.from, DELTA.to, deltaElevation, 0.7), // closer: less dust in between
  );
  return horizon;
}

// The skyline is effectively at infinity: keep it centered on the viewer. Its color is the lit
// rock seen through dust, so it follows the sky through the sol (look: from skyLook()).
const ROCK = new THREE.Color(0x7a4a32);
export function updateHorizon(horizon, camera, look) {
  horizon.position.copy(camera.position);
  for (const ring of horizon.children) {
    ring.material.color.copy(ROCK).multiplyScalar(0.08 + 0.92 * look.daylight).lerp(look.horizon, ring.userData.haze);
  }
}
