import * as THREE from 'three';
import { groundHeight } from '../world/terrain.js';
import { damp, wrapAngle, yawOf } from '../utils/math.js';
import { onPress } from '../core/input.js';

const LOOK_HEIGHT = 1.4; // the camera looks at the height of the rover's body
const MIN_CLEARANCE = 1.2; // minimum height above the ground
const REALIGN_RATE = 1.5;
const START_OFFSET = new THREE.Vector3(3, 2.2, -8); // in rover space: slightly to the side and behind
const SKY_VIEW_KEY = 'KeyV';
const MAST_HEIGHT = 2; // m: where the rover's Mastcam-Z looks out from
const SKY_VIEW = { minPolarAngle: Math.PI / 2, maxPolarAngle: Math.PI, minDistance: 0.05, maxDistance: 0.05, enableZoom: false, rotateSpeed: -0.4 };
const SKY_VIEW_FOV = 75;

// Camera that follows the rover: it moves with it and, while driving, gradually swings behind it.
// The user can orbit it with the mouse at any time (OrbitControls).
// V toggles the sky view: the camera sits on the rover's mast looking straight up at the zenith,
// and the mouse looks around the sky. It keeps riding along if you drive.
export function createFollowCamera(camera, controls, rover) {
  let dragging = false;
  controls.addEventListener('start', () => (dragging = true));
  controls.addEventListener('end', () => (dragging = false));

  const lastPos = rover.position.clone();
  const offset = new THREE.Vector3();
  camera.position.copy(START_OFFSET).applyQuaternion(rover.quaternion).add(rover.position);

  let skyView = false, chaseOffset = new THREE.Vector3(), chaseSettings = {}, chaseFov = camera.fov;
  onPress(SKY_VIEW_KEY, () => {
    skyView = !skyView;
    if (skyView) {
      chaseOffset.subVectors(camera.position, controls.target);
      chaseSettings = Object.fromEntries(Object.keys(SKY_VIEW).map((k) => [k, controls[k]]));
      Object.assign(controls, SKY_VIEW);
      camera.position.copy(rover.position).y += MAST_HEIGHT;
      controls.target.copy(camera.position).y += SKY_VIEW.minDistance; // straight above: look at the zenith
      setFov(SKY_VIEW_FOV);
    } else {
      Object.assign(controls, chaseSettings);
      controls.target.copy(rover.position).y += LOOK_HEIGHT;
      camera.position.copy(controls.target).add(chaseOffset);
      setFov(chaseFov);
    }
  });
  function setFov(fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }

  function update(dt, speed) {
    offset.subVectors(rover.position, lastPos);
    camera.position.add(offset);
    lastPos.copy(rover.position);
    if (skyView) {
      controls.target.add(offset);
      return;
    }
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

  return {
    update,
    get skyView() {
      return skyView;
    },
  };
}
