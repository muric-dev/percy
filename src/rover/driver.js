import * as THREE from 'three';
import { groundHeight, groundNormal } from '../world/terrain.js';
import { axis } from '../core/input.js';
import { damp } from '../utils/math.js';

const MAX_SPEED = 3; // m/s (the real one drives at ~0.04 m/s; sped up to make it fun)
const REVERSE_FACTOR = 0.5;
const TURN_SPEED = 0.8; // rad/s
const FOOTPRINT = 1.3; // radius (m) over which the slope under the wheels is averaged

const FORWARD_KEYS = ['KeyW', 'ArrowUp'], BACK_KEYS = ['KeyS', 'ArrowDown'];
const LEFT_KEYS = ['KeyA', 'ArrowLeft'], RIGHT_KEYS = ['KeyD', 'ArrowRight'];

// WASD/arrow-key driving. Returns { update(dt) } and keeps the rover on the ground.
export function createDriver(rover, { x, z, heading }) {
  let speed = 0;
  rover.position.set(x, groundHeight(x, z), z);
  alignToGround(rover, heading, 1);

  function update(dt) {
    const throttle = axis(FORWARD_KEYS, BACK_KEYS);
    const steer = axis(LEFT_KEYS, RIGHT_KEYS);

    const targetSpeed = throttle * MAX_SPEED * (throttle < 0 ? REVERSE_FACTOR : 1);
    speed += (targetSpeed - speed) * damp(2, dt);
    // Perseverance can turn in place, so it turns even when stopped
    heading += steer * TURN_SPEED * dt * (speed < -0.05 ? -1 : 1);

    rover.position.x += Math.sin(heading) * speed * dt;
    rover.position.z += Math.cos(heading) * speed * dt;
    alignToGround(rover, heading, damp(8, dt));

    // Motor effort from 0 to 1 (for the sound)
    const effort = Math.min(Math.abs(speed) / MAX_SPEED + (steer ? 0.3 : 0), 1);
    return { speed, effort };
  }

  return { update };
}

// Tilts the rover to the slope and rests it on the ground; k = smoothing (1 = instant)
const up = new THREE.Vector3(), forward = new THREE.Vector3(), right = new THREE.Vector3();
const basis = new THREE.Matrix4(), tilt = new THREE.Quaternion();
function alignToGround(rover, heading, k) {
  const { x, z } = rover.position;
  groundNormal(x, z, FOOTPRINT, up);
  forward.set(Math.sin(heading), 0, Math.cos(heading));
  forward.addScaledVector(up, -forward.dot(up)).normalize();
  right.crossVectors(up, forward);
  tilt.setFromRotationMatrix(basis.makeBasis(right, up, forward));

  rover.quaternion.slerp(tilt, k);
  rover.position.y += (groundHeight(x, z) - rover.position.y) * k;
}
