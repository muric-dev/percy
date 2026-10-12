import * as THREE from 'three';
import { groundHeight } from './terrain.js';
import { rng } from '../utils/noise.js';
import { ROVER_START } from '../config.js';

// Rock population from the model used to assess Mars landing sites (Golombek & Rapp 1997,
// Golombek et al. 2003): the cumulative fractional area covered by rocks of diameter ≥ D is
// F(D) = k·exp(−q·D), with q = 1.79 + 0.152/k and k the total rock abundance.
// k = 8% sits between InSight (~3%) and Mars Pathfinder (~19%).
const K = 0.08;
const Q = 1.79 + 0.152 / K;
const D_MAX = 3; // m
const BIN = 0.02; // m, diameter step used to sample the distribution
const HEIGHT_RATIO = 0.5; // rock height ≈ half its diameter
const BURIAL = 0.2; // fraction of the height below the surface
const SPAWN_CLEARANCE = 6; // m kept free around the rover's start

// Small rocks are only placed near the center to keep the rock count manageable
const ZONES = [
  { rMin: 0, rMax: 40, dMin: 0.1 },
  { rMin: 40, rMax: 160, dMin: 0.35 },
];

// Rocks per m² with diameter in [D, D + dD]: n(D) = −F'(D) / (π D² / 4)
const density = (d) => (4 * K * Q * Math.exp(-Q * d)) / (Math.PI * d * d);

// Rock geometry: icosahedron with randomly displaced vertices (displaced consistently
// so shared faces don't split apart). Radius ≈ 1.
function rockGeometry(rand) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  const offsets = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!offsets.has(key)) offsets.set(key, 0.75 + rand() * 0.45);
    pos.setXYZ(i, pos.getX(i) * offsets.get(key), pos.getY(i) * offsets.get(key), pos.getZ(i) * offsets.get(key));
  }
  geo.computeVertexNormals();
  return geo;
}

// Diameters and positions of every rock, sampled from the size-frequency distribution
function sampleRocks(rand) {
  const rocks = [];
  for (const { rMin, rMax, dMin } of ZONES) {
    const area = Math.PI * (rMax * rMax - rMin * rMin);
    for (let d = dMin; d < D_MAX; d += BIN) {
      const count = Math.floor(area * density(d + BIN / 2) * BIN + rand());
      for (let i = 0; i < count; i++) {
        const r = Math.sqrt(rMin * rMin + rand() * (rMax * rMax - rMin * rMin));
        const a = rand() * Math.PI * 2;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (Math.hypot(x - ROVER_START.x, z - ROVER_START.z) > SPAWN_CLEARANCE) rocks.push({ x, z, d: d + rand() * BIN });
      }
    }
  }
  return rocks;
}

export function createRocks() {
  const rand = rng(42);
  const rocks = sampleRocks(rand);
  const variants = Array.from({ length: 6 }, () => rockGeometry(rand));
  const mat = new THREE.MeshStandardMaterial({ color: 0x5e3a2a, roughness: 0.9, flatShading: true });
  const meshes = variants.map((geo, v) => {
    const mesh = new THREE.InstancedMesh(geo, mat, Math.ceil((rocks.length - v) / variants.length));
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  });

  const dummy = new THREE.Object3D();
  rocks.forEach(({ x, z, d }, i) => {
    const radius = d / 2, height = d * HEIGHT_RATIO;
    dummy.position.set(x, groundHeight(x, z) + height * (0.5 - BURIAL), z);
    dummy.rotation.set(rand() * 0.3, rand() * Math.PI * 2, rand() * 0.3);
    dummy.scale.set(radius * (0.8 + rand() * 0.4), height / 2, radius * (0.8 + rand() * 0.4));
    dummy.updateMatrix();
    meshes[i % variants.length].setMatrixAt(Math.floor(i / variants.length), dummy.matrix);
  });

  console.log(`Rocks: ${rocks.length} (Golombek model, k = ${K * 100}%)`);
  const group = new THREE.Group();
  group.add(...meshes);
  return group;
}
