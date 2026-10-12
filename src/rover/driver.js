import * as THREE from 'three';
import { groundHeight, groundNormal } from '../world/terrain.js';
import { axis, onPress } from '../core/input.js';
import { damp } from '../utils/math.js';

const MAX_SPEED = 3; // m/s (the real one drives at ~0.04 m/s; sped up to make it fun)
const REVERSE_FACTOR = 0.5;
const BOOST = 2; // Q toggles double speed
const TURN_SPEED = 0.8; // rad/s
const FOOTPRINT = 1.3; // radius (m) over which the slope under the wheels is averaged

const FORWARD_KEYS = ['KeyW', 'ArrowUp'], BACK_KEYS = ['KeyS', 'ArrowDown'];
const LEFT_KEYS = ['KeyA', 'ArrowLeft'], RIGHT_KEYS = ['KeyD', 'ArrowRight'];
const BOOST_KEY = 'KeyQ';

// WASD/arrow-key driving. Returns { update(dt) } and keeps the rover on the ground.
// update() also reports hydraulic events: 'accelerate' when the rover starts driving and
// 'brake' when it stops or reverses direction while moving.
export function createDriver(rover, { x, z, heading }) {
  let speed = 0, lastThrottle = 0, boost = false;
  onPress(BOOST_KEY, () => (boost = !boost));
  rover.position.set(x, groundHeight(x, z), z);
  alignToGround(rover, heading, 1);

  function update(dt) {
    const throttle = axis(FORWARD_KEYS, BACK_KEYS);
    const steer = axis(LEFT_KEYS, RIGHT_KEYS);

    const maxSpeed = MAX_SPEED * (boost ? BOOST : 1);
    const targetSpeed = throttle * maxSpeed * (throttle < 0 ? REVERSE_FACTOR : 1);
    speed += (targetSpeed - speed) * damp(2, dt);
    // Perseverance can turn in place, so it turns even when stopped
    const yawRate = steer * TURN_SPEED * (speed < -0.05 ? -1 : 1);
    heading += yawRate * dt;

    rover.position.x += Math.sin(heading) * speed * dt;
    rover.position.z += Math.cos(heading) * speed * dt;
    alignToGround(rover, heading, damp(8, dt));

    // Motor effort from 0 to 1 (for the sound); full effort only at double speed
    const effort = Math.min(Math.abs(speed) / (MAX_SPEED * BOOST) + (steer ? 0.15 : 0), 1);
    const event = hydraulicEvent(lastThrottle, throttle, speed);
    lastThrottle = throttle;
    return { speed, yawRate, effort, event, boost };
  }

  return { update };
}

const MOVING = 0.3; // m/s: below this a release is just stopping, not braking

function hydraulicEvent(previous, current, speed) {
  if (current === previous) return null;
  if (current !== 0 && (previous === 0 || Math.abs(speed) < MOVING)) return 'accelerate';
  if (Math.abs(speed) > MOVING) return 'brake'; // released or reversed while moving
  return null;
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
