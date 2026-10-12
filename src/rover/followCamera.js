import * as THREE from 'three';
import { groundHeight } from '../world/terrain.js';
import { damp, wrapAngle, yawOf } from '../utils/math.js';

const LOOK_HEIGHT = 1.4; // the camera looks at the height of the rover's body
const MIN_CLEARANCE = 1.2; // minimum height above the ground
const REALIGN_RATE = 1.5;
const START_OFFSET = new THREE.Vector3(3, 2.2, -8); // in rover space: slightly to the side and behind

// Camera that follows the rover: it moves with it and, while driving, gradually swings behind it.
// The user can orbit it with the mouse at any time (OrbitControls).
export function createFollowCamera(camera, controls, rover) {
  let dragging = false;
  controls.addEventListener('start', () => (dragging = true));
  controls.addEventListener('end', () => (dragging = false));

  const lastPos = rover.position.clone();
  const offset = new THREE.Vector3();
  camera.position.copy(START_OFFSET).applyQuaternion(rover.quaternion).add(rover.position);

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

    // The camera never goes inside a dune
    const minY = groundHeight(camera.position.x, camera.position.z) + MIN_CLEARANCE;
    camera.position.y = Math.max(camera.position.y, minY);
  }

  return { update };
}
