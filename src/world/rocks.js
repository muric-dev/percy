import * as THREE from 'three';
import { groundHeight } from './terrain.js';
import { rng } from '../utils/noise.js';
import { ROVER_START } from '../config.js';

// Geometría de roca: icosaedro con vértices desplazados al azar (de forma consistente
// para que las caras compartidas no se separen).
function rockGeometry(rand) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  const offsets = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!offsets.has(key)) offsets.set(key, 0.7 + rand() * 0.55);
    const k = offsets.get(key);
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.7, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createRocks() {
  const rand = rng(42);
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x6a3e2a, roughness: 0.9, flatShading: true });
  const dummy = new THREE.Object3D();
  const variants = 6, perVariant = 70;

  for (let v = 0; v < variants; v++) {
    const mesh = new THREE.InstancedMesh(rockGeometry(rand), mat, perVariant);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    for (let i = 0; i < perVariant; i++) {
      const r = Math.pow(rand(), 0.7) * 140;
      const a = rand() * Math.PI * 2;
      let x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.hypot(x - ROVER_START.x, z - ROVER_START.z) < 8) x += Math.sign(x || 1) * 10; // despejar donde aparece el rover
      // La mayoría pequeñas, unas pocas grandes
      const s = 0.15 + Math.pow(rand(), 4) * 2.8;
      dummy.position.set(x, groundHeight(x, z) - s * 0.4, z);
      dummy.rotation.set(rand() * 0.4, rand() * Math.PI * 2, rand() * 0.4);
      dummy.scale.set(s * (0.8 + rand() * 0.6), s, s * (0.8 + rand() * 0.6));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    group.add(mesh);
  }
  return group;
}
