import * as THREE from 'three';
import { fbm, noise } from '../utils/noise.js';
import { smoothstep } from '../utils/math.js';

const SIZE = 1000, SEG = 400, STEP = SIZE / SEG;

// Terrain height at (x, z): rolling plain + dune fields + Jezero crater rim.
function heightAt(x, z) {
  let h = fbm(x * 0.008, z * 0.008) * 7;

  // Sharp-crested dunes, oriented by the wind and warped by noise
  const warp = fbm(x * 0.015 + 10, z * 0.015) * 4;
  const u = x * 0.035 + z * 0.015 + warp;
  const crest = Math.pow(1 - Math.abs(Math.sin(u)), 2.2);
  const duneMask = smoothstep(-0.4, 0.2, noise(x * 0.006 + 3, z * 0.006 - 7));
  h += crest * 5.5 * duneMask;

  // Fine ripples in the sand
  h += Math.sin(x * 0.9 + z * 0.35 + warp * 3) * 0.05;

  // Distant crater rim
  const r = Math.hypot(x, z);
  const ang = Math.atan2(z, x);
  const rim = smoothstep(220, 420, r) * (35 + fbm(Math.cos(ang) * 3, Math.sin(ang) * 3) * 40);
  return h + rim;
}

// Height of the mesh as rendered (interpolated between vertices), so objects rest on it
// without sinking or floating between grid vertices.
export function groundHeight(x, z) {
  const gx = (x + SIZE / 2) / STEP, gz = (z + SIZE / 2) / STEP;
  const ix = Math.floor(gx), iz = Math.floor(gz);
  const fx = gx - ix, fz = gz - iz;
  const x0 = ix * STEP - SIZE / 2, z0 = iz * STEP - SIZE / 2;
  const h00 = heightAt(x0, z0), h10 = heightAt(x0 + STEP, z0);
  const h01 = heightAt(x0, z0 + STEP), h11 = heightAt(x0 + STEP, z0 + STEP);
  return (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;
}

// Ground normal at (x, z). `spread` is the sampling distance: large to average
// the slope under the whole rover, small for a single track mark.
const along = new THREE.Vector3(), across = new THREE.Vector3();
export function groundNormal(x, z, spread, target = new THREE.Vector3()) {
  along.set(2 * spread, groundHeight(x + spread, z) - groundHeight(x - spread, z), 0);
  across.set(0, groundHeight(x, z + spread) - groundHeight(x, z - spread), 2 * spread);
  return target.crossVectors(across, along).normalize();
}

export function createTerrain() {
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();
  paintGround(geo);

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

// Vertex colors: rust overall, light sand on crests, darker tones on slopes
function paintGround(geo) {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const rust = new THREE.Color(0xa2502a);
  const sand = new THREE.Color(0xd08850);
  const dark = new THREE.Color(0x6a3420);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const slope = 1 - nrm.getY(i);
    const grain = fbm(x * 0.15, z * 0.15, 3) * 0.5 + 0.5;
    c.copy(rust).lerp(sand, smoothstep(0.5, 3.5, y) * 0.7 + grain * 0.25);
    c.lerp(dark, smoothstep(0.08, 0.35, slope) * 0.6);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}
