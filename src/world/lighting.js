import * as THREE from 'three';
import { SUN_DIRECTION } from '../config.js';

const SUN_DISTANCE = 200;
const SHADOW_HALF_SIZE = 70; // metros cubiertos por las sombras alrededor del punto enfocado

// Sol de tarde cálido con sombras suaves + luz de cielo/suelo rebotada
export function createLights() {
  const sun = new THREE.DirectionalLight(0xffb878, 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 4;
  sun.shadow.blurSamples = 16;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
  const s = SHADOW_HALF_SIZE;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 500 });
  aimSunAt(sun, new THREE.Vector3());

  const sky = new THREE.HemisphereLight(0xe8b080, 0x4a2214, 0.9);
  return { sun, sky };
}

// Mueve el sol (y su zona de sombras) para que acompañe a un punto, p. ej. el rover
export function aimSunAt(sun, position) {
  sun.position.copy(position).addScaledVector(SUN_DIRECTION, SUN_DISTANCE);
  sun.target.position.copy(position);
}
