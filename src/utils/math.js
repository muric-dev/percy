import * as THREE from 'three';

export function smoothstep(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

// Fraction to approach a target smoothly, independent of frame rate
export const damp = (rate, dt) => Math.min(rate * dt, 1);

// Wraps an angle into the range [-π, π]
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Horizontal angle an object is facing (its +Z axis)
const forward = new THREE.Vector3();
export function yawOf(object) {
  forward.set(0, 0, 1).applyQuaternion(object.quaternion);
  return Math.atan2(forward.x, forward.z);
}
