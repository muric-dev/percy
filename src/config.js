import * as THREE from 'three';

// Values shared by several scene modules.

// Color of the suspended dust: the sky horizon and the fog use the same tone
export const DUST_COLOR = 0xd29a5e;

// Afternoon sun: low and backlit for long shadows
export const SUN_DIRECTION = new THREE.Vector3(-0.25, 0.12, -1).normalize();

// Where the rover spawns, facing the sun
export const ROVER_START = { x: 0, z: 20, heading: Math.PI };
