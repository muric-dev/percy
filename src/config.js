import { skyDirection } from './utils/math.js';

// Values shared by several scene modules.
// World axes: north = -Z, east = +X, up = +Y. 1 unit = 1 meter.

// Color of the suspended dust: the sky horizon and the fog use the same tone
export const DUST_COLOR = 0xd29a5e;

// Late-afternoon sun at Jezero (18.4°N): low in the west-southwest, backlit for long shadows
export const SUN_AZIMUTH = 255;
export const SUN_DIRECTION = skyDirection(SUN_AZIMUTH, 7);

// Where the rover spawns, facing the sun
export const ROVER_START = { x: 0, z: 20, heading: Math.atan2(SUN_DIRECTION.x, SUN_DIRECTION.z) };

export const MARS_RADIUS = 3389500; // m
