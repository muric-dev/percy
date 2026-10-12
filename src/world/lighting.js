import * as THREE from 'three';
import { smoothstep } from '../utils/math.js';

const SUN_DISTANCE = 200;
const SHADOW_HALF_SIZE = 70; // meters covered by shadows around the focus point
const SUN_INTENSITY = 3.2;
const LOW_SUN = new THREE.Color(0xffa060), HIGH_SUN = new THREE.Color(0xffe6c8);
// Night light is brighter than the real Martian night (starlight + Phobos) so you can still drive
const NIGHT_SKY = new THREE.Color(0x6a7898);
const GROUND_BOUNCE = new THREE.Color(0x4a2214);

// Warm sun with soft shadows + bounced sky/ground light
export function createLights() {
  const sun = new THREE.DirectionalLight(0xffb878, SUN_INTENSITY);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 4;
  sun.shadow.blurSamples = 16;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
  const s = SHADOW_HALF_SIZE;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 500 });

  const sky = new THREE.HemisphereLight(0xe8b080, GROUND_BOUNCE, 0.9);
  return { sun, sky };
}

// Places the sun along its true direction around a point (e.g. the rover) and sets how strong
// and warm it is for its altitude; the sky light follows the sky color, down to starlight at night.
export function updateLights({ sun, sky }, position, sunDir, sunAlt, look) {
  sun.position.copy(position).addScaledVector(sunDir, SUN_DISTANCE);
  sun.target.position.copy(position);
  sun.intensity = SUN_INTENSITY * smoothstep(-0.5, 8, sunAlt);
  sun.color.copy(LOW_SUN).lerp(HIGH_SUN, smoothstep(5, 40, sunAlt));
  sun.castShadow = sun.intensity > 0.01;

  sky.color.copy(NIGHT_SKY).lerp(look.horizon, look.daylight);
  sky.intensity = 0.55 + 0.35 * look.daylight;
}
