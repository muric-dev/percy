import * as THREE from 'three';
import { fbm, noise } from '../utils/noise.js';
import { smoothstep } from '../utils/math.js';
import { craterHeight } from './craters.js';

const SIZE = 1000, SEG = 600, STEP = SIZE / SEG;

// Transverse aeolian ridges (TARs), the typical bedforms of the Jezero floor.
// Typical TAR (Hugenholtz et al. 2017, 2,295 TARs measured on HiRISE DTMs):
// 1.3 m tall, 17.3 m wide, 88.5 m long, 25.8 m wavelength, symmetric profile.
const TAR_HEIGHT = 1.3, TAR_WIDTH = 17.3, TAR_LENGTH = 88.5, TAR_WAVELENGTH = 25.8;
const TAR_ANGLE = THREE.MathUtils.degToRad(25); // crest orientation, perpendicular to the wind

// 0..1 shape of the ridges at (x, z), already masked into discontinuous ridges and fields
function tarAmount(x, z) {
  const ca = Math.cos(TAR_ANGLE), sa = Math.sin(TAR_ANGLE);
  const u = (x * ca + z * sa) / TAR_WAVELENGTH + fbm(x * 0.01 + 10, z * 0.01) * 0.6;
  const ridge = Math.floor(u);
  const across = 1 - (Math.abs(u - ridge - 0.5) * 2 * TAR_WAVELENGTH) / TAR_WIDTH;
  if (across <= 0) return 0;
  const profile = smoothstep(0, 1, across); // symmetric, rounded crest

  // Each ridge is a discontinuous segment ~TAR_LENGTH long, and ridges come in fields
  const v = (-x * sa + z * ca) / TAR_LENGTH;
  const segment = smoothstep(-0.15, 0.35, noise(v * 1.6 + ridge * 7.31, ridge * 3.17));
  const field = smoothstep(-0.25, 0.25, noise(x * 0.005 + 3, z * 0.005 - 7));
  const size = 0.6 + 0.8 * (noise(ridge * 1.9, v) * 0.5 + 0.5);
  return profile * segment * field * size;
}

// Terrain height at (x, z): gently undulating crater floor + TARs + small craters.
function heightAt(x, z) {
  return fbm(x * 0.004, z * 0.004) * 3 + tarAmount(x, z) * TAR_HEIGHT + craterHeight(x, z);
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

// Vertex colors: rust overall, light-toned sand on TARs (as seen from orbit), darker on slopes
function paintGround(geo) {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const rust = new THREE.Color(0xa2502a);
  const sand = new THREE.Color(0xd08850);
  const dark = new THREE.Color(0x6a3420);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const slope = 1 - nrm.getY(i);
    const grain = fbm(x * 0.15, z * 0.15, 3) * 0.5 + 0.5;
    c.copy(rust).lerp(sand, Math.min(tarAmount(x, z), 1) * 0.75 + grain * 0.25);
    c.lerp(dark, smoothstep(0.04, 0.25, slope) * 0.6);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}
