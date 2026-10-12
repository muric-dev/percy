import * as THREE from 'three';
import { rng } from '../utils/noise.js';

// Lunas irregulares tipo "patata": esfera deformada.
function moonGeometry(radius, seed, stretch) {
  const rand = rng(seed);
  const geo = new THREE.SphereGeometry(radius, 48, 32);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const bumps = Array.from({ length: 12 }, () => ({
    dir: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
    size: 0.15 + rand() * 0.25,
    depth: 0.04 + rand() * 0.06,
  }));
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let k = 1;
    for (const b of bumps) {
      const d = v.distanceTo(b.dir);
      if (d < b.size) k -= b.depth * (1 - d / b.size); // cráteres
    }
    v.multiplyScalar(radius * k);
    v.x *= stretch;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createMoons() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xc4ab96,
    roughness: 1,
    emissive: 0x6a5242,
    fog: false,
  });

  // Fobos: más grande y alargado, a la derecha del sol
  const phobos = new THREE.Mesh(moonGeometry(16, 7, 1.35), mat);
  phobos.position.set(0.38, 0.3, -1).normalize().multiplyScalar(900);
  phobos.rotation.set(0.4, 0.8, 0.2);

  // Deimos: pequeño y lejano, a la izquierda
  const deimos = new THREE.Mesh(moonGeometry(6, 13, 1.15), mat);
  deimos.position.set(-0.55, 0.36, -1).normalize().multiplyScalar(900);

  group.add(phobos, deimos);
  group.userData = { phobos, deimos };
  return group;
}

export function updateMoons(group, t) {
  const { phobos, deimos } = group.userData;
  phobos.rotation.y = 0.8 + t * 0.05;
  deimos.rotation.y = t * 0.02;
}
