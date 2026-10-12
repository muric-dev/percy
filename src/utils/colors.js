import * as THREE from 'three';

// Star color from its B−V color index (blue-white hot stars → orange cool stars)
export function colorFromBV(bv, target = new THREE.Color()) {
  const t = THREE.MathUtils.clamp((bv + 0.3) / 2.1, 0, 1);
  return target.setRGB(0.62 + 0.38 * t, 0.72 + 0.18 * (1 - Math.abs(t - 0.45) * 2), 1 - 0.55 * t);
}

// A distinct pastel color per constellation (hues spread by the golden angle)
export function constellationColor(index, target = new THREE.Color()) {
  return target.setHSL(((index * 137.508) % 360) / 360, 0.95, 0.6);
}
