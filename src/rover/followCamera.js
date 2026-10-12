import * as THREE from 'three';
import { groundHeight } from '../world/terrain.js';
import { damp, wrapAngle, yawOf } from '../utils/math.js';

const LOOK_HEIGHT = 1.4; // la cámara mira a la altura del cuerpo del rover
const MIN_CLEARANCE = 1.2; // altura mínima sobre el suelo
const REALIGN_RATE = 1.5;

// Cámara que sigue al rover: se mueve con él y, al conducir, se coloca poco a poco detrás.
// El usuario puede girarla con el ratón en cualquier momento (OrbitControls).
export function createFollowCamera(camera, controls, rover) {
  let dragging = false;
  controls.addEventListener('start', () => (dragging = true));
  controls.addEventListener('end', () => (dragging = false));

  const lastPos = rover.position.clone();
  const offset = new THREE.Vector3();

  function update(dt, speed) {
    camera.position.add(offset.subVectors(rover.position, lastPos));
    lastPos.copy(rover.position);
    controls.target.copy(rover.position).y += LOOK_HEIGHT;

    if (Math.abs(speed) > 0.1 && !dragging) {
      offset.subVectors(camera.position, controls.target);
      const behind = yawOf(rover) + (speed > 0 ? Math.PI : 0);
      const diff = wrapAngle(behind - Math.atan2(offset.x, offset.z));
      offset.applyAxisAngle(THREE.Object3D.DEFAULT_UP, diff * damp(REALIGN_RATE, dt));
      camera.position.copy(controls.target).add(offset);
    }

    // La cámara nunca se mete dentro de una duna
    const minY = groundHeight(camera.position.x, camera.position.z) + MIN_CLEARANCE;
    camera.position.y = Math.max(camera.position.y, minY);
  }

  return { update };
}
