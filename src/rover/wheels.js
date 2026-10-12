import * as THREE from 'three';
import { groundHeight } from '../world/terrain.js';
import { damp } from '../utils/math.js';

// Perseverance's six wheels, animated: they roll with the distance traveled, the four corner
// wheels steer (the middle pair can't), and each wheel follows the ground under it like the
// rocker-bogie suspension does. The NASA model has all six wheels fused into one mesh
// ('Wheels_objs'), so it is split here into one mesh per wheel.
const MAX_STEER = THREE.MathUtils.degToRad(70);
const MAX_TRAVEL = 0.25; // m of vertical wheel travel relative to the body
const STEER_RATE = 6, SUSPENSION_RATE = 10;

export function createWheels(rover) {
  const source = rover.getObjectByName('Wheels_objs');
  if (!source) return { update() {} };

  rover.updateMatrixWorld(true);
  const meshes = [];
  source.traverse((o) => o.isMesh && meshes.push(o));
  const wheels = splitIntoWheels(meshes).map((parts) => buildWheel(parts, rover));
  meshes.forEach((m) => m.removeFromParent());

  // Only the four corner wheels steer; the middle pair is fixed
  const zs = wheels.map((w) => w.base.z);
  const midZ = (Math.max(...zs) + Math.min(...zs)) / 2, span = Math.max(...zs) - Math.min(...zs);
  wheels.forEach((w) => (w.steers = Math.abs(w.base.z - midZ) > span / 4));
  console.log(`Wheels: ${wheels.length} (radius ${wheels[0]?.radius.toFixed(2)} m)`);

  const velocity = new THREE.Vector2(), contact = new THREE.Vector3();

  // speed: m/s along the rover's forward axis; yawRate: rad/s (positive = turning left)
  function update(dt, { speed, yawRate }) {
    for (const w of wheels) {
      // Velocity of this wheel's contact point in rover space: v + ω × r
      velocity.set(yawRate * w.base.z, speed - yawRate * w.base.x);
      let rolling = velocity.y;

      if (w.steers && velocity.length() > 0.01) {
        let angle = Math.atan2(velocity.x, velocity.y);
        rolling = velocity.length();
        if (Math.abs(angle) > Math.PI / 2) {
          angle -= Math.sign(angle) * Math.PI; // drive backwards instead of turning around
          rolling = -rolling;
        }
        angle = THREE.MathUtils.clamp(angle, -MAX_STEER, MAX_STEER);
        w.steer.rotation.y += (angle - w.steer.rotation.y) * damp(STEER_RATE, dt);
      }
      w.spin.rotation.x += (rolling * dt) / w.radius;

      // Suspension: move the wheel up/down so its bottom touches the ground under it
      contact.copy(w.base).applyMatrix4(rover.matrixWorld);
      const gap = groundHeight(contact.x, contact.z) - (contact.y - w.radius);
      const travel = THREE.MathUtils.clamp(gap, -MAX_TRAVEL, MAX_TRAVEL);
      w.steer.position.y += (w.base.y + travel - w.steer.position.y) * damp(SUSPENSION_RATE, dt);
    }
  }

  return { update };
}

// Groups the triangles of the fused wheel mesh into 6 wheels: left/right × front/middle/rear.
// Returns, per wheel, a list of { mesh, triangles } (triangle indices in a non-indexed copy).
function splitIntoWheels(meshes) {
  const tris = []; // { mesh, geo, t, x, z } with x,z the triangle centroid in rover space
  const v = new THREE.Vector3();
  for (const mesh of meshes) {
    const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
    const pos = geo.attributes.position;
    for (let t = 0; t < pos.count / 3; t++) {
      let x = 0, z = 0;
      for (let k = 0; k < 3; k++) {
        v.fromBufferAttribute(pos, t * 3 + k).applyMatrix4(mesh.matrixWorld);
        x += v.x / 3;
        z += v.z / 3;
      }
      tris.push({ mesh, geo, t, x, z });
    }
  }

  const axles = kMeans1D(tris.map((tri) => tri.z), 3);
  const groups = Array.from({ length: 6 }, () => new Map());
  for (const tri of tris) {
    const axle = nearestIndex(axles, tri.z);
    const side = tri.x < 0 ? 0 : 1;
    const group = groups[axle * 2 + side];
    if (!group.has(tri.mesh)) group.set(tri.mesh, { mesh: tri.mesh, geo: tri.geo, triangles: [] });
    group.get(tri.mesh).triangles.push(tri.t);
  }
  return groups.map((g) => [...g.values()]).filter((parts) => parts.length);
}

// Builds pivot (steering, suspension) → spin (rolling) → meshes centered on the wheel's hub
function buildWheel(parts, rover) {
  const geometries = parts.map(({ mesh, geo, triangles }) => ({
    material: mesh.material,
    geometry: extractTriangles(geo, triangles, mesh.matrixWorld),
  }));
  const box = new THREE.Box3();
  geometries.forEach(({ geometry }) => {
    geometry.computeBoundingBox();
    box.union(geometry.boundingBox);
  });
  const center = box.getCenter(new THREE.Vector3());
  const radius = (box.max.y - box.min.y) / 2;

  const steer = new THREE.Group(), spin = new THREE.Group();
  steer.position.copy(center);
  steer.add(spin);
  for (const { geometry, material } of geometries) {
    geometry.translate(-center.x, -center.y, -center.z);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    spin.add(mesh);
  }
  rover.add(steer);
  return { steer, spin, radius, base: center.clone(), steers: false };
}

// Copies the given triangles into a new geometry, transformed into rover space
function extractTriangles(geo, triangles, matrix) {
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(geo.attributes)) {
    const size = attr.itemSize;
    const data = new Float32Array(triangles.length * 3 * size);
    triangles.forEach((t, i) => {
      for (let k = 0; k < 3 * size; k++) {
        data[i * 3 * size + k] = attr.getComponent(t * 3 + Math.floor(k / size), k % size);
      }
    });
    out.setAttribute(name, new THREE.BufferAttribute(data, size));
  }
  out.applyMatrix4(matrix);
  return out;
}

function kMeans1D(values, k) {
  const sorted = [...values].sort((a, b) => a - b);
  const centers = Array.from({ length: k }, (_, i) => sorted[Math.floor(((i + 0.5) / k) * sorted.length)]);
  for (let iter = 0; iter < 10; iter++) {
    const sums = new Array(k).fill(0), counts = new Array(k).fill(0);
    for (const v of values) {
      const i = nearestIndex(centers, v);
      sums[i] += v;
      counts[i]++;
    }
    centers.forEach((_, i) => counts[i] && (centers[i] = sums[i] / counts[i]));
  }
  return centers;
}

const nearestIndex = (centers, v) =>
  centers.reduce((best, c, i) => (Math.abs(c - v) < Math.abs(centers[best] - v) ? i : best), 0);
