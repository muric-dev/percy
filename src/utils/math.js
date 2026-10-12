import * as THREE from 'three';

export function smoothstep(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

// Fracción para acercarse a un objetivo de forma suave e independiente de los FPS
export const damp = (rate, dt) => Math.min(rate * dt, 1);

// Lleva un ángulo al rango [-π, π]
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Ángulo horizontal hacia el que mira un objeto (su eje +Z)
const forward = new THREE.Vector3();
export function yawOf(object) {
  forward.set(0, 0, 1).applyQuaternion(object.quaternion);
  return Math.atan2(forward.x, forward.z);
}
