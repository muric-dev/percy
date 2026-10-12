import * as THREE from 'three';
import { equatorialToVector } from '../astro/ephemeris.js';

// The Milky Way and the naked-eye galaxies, drawn where they really are among the stars.
// The band is placed with the IAU galactic frame: north galactic pole at RA 192.859°, Dec +27.128°,
// galactic center (Sagittarius) at RA 266.405°, Dec −28.936°. Its glow, colorful star clouds and
// dark dust lanes are procedural. Also: Large and Small Magellanic Clouds and Andromeda (M31).
export const GALACTIC_POLE = equatorialToVector(192.85948, 27.12825);
export const GALACTIC_CENTER = equatorialToVector(266.4051, -28.93617);
const GALAXIES = [
  { dir: equatorialToVector(80.894, -69.756), size: 0.06, color: new THREE.Color(0.75, 0.8, 1.0) }, // LMC
  { dir: equatorialToVector(13.187, -72.829), size: 0.035, color: new THREE.Color(0.7, 0.75, 1.0) }, // SMC
  { dir: equatorialToVector(10.685, 41.269), size: 0.025, color: new THREE.Color(0.95, 0.7, 1.0) }, // M31
];

export function createMilkyWay() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      visibility: { value: 0 },
      pole: { value: GALACTIC_POLE },
      center: { value: GALACTIC_CENTER },
      galaxyDirs: { value: GALAXIES.map((g) => g.dir) },
      galaxySizes: { value: GALAXIES.map((g) => g.size) },
      galaxyColors: { value: GALAXIES.map((g) => g.color) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;     // equatorial (ICRF) direction
      varying float vHeight; // altitude in the local sky
      void main() {
        vDir = position;
        vHeight = normalize(mat3(modelMatrix) * position).y;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform float visibility;
      uniform vec3 pole, center;
      uniform vec3 galaxyDirs[3], galaxyColors[3];
      uniform float galaxySizes[3];
      varying vec3 vDir;
      varying float vHeight;

      float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float noise(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p) { return noise(p) * 0.5 + noise(p * 2.1) * 0.25 + noise(p * 4.3) * 0.125 + noise(p * 8.7) * 0.0625; }

      void main() {
        vec3 d = normalize(vDir);
        float b = asin(clamp(dot(d, pole), -1.0, 1.0));                 // galactic latitude
        float l = atan(dot(d, normalize(cross(pole, center))), dot(d, center)); // galactic longitude

        float clouds = fbm(d * 7.0);
        float band = exp(-pow(b / (0.11 + 0.06 * clouds), 2.0)) * (0.45 + 0.55 * fbm(d * 16.0 + 4.0));
        band *= 0.55 + 0.45 * cos(l * 0.5) * cos(l * 0.5);               // brighter toward the center
        float bulge = exp(-pow(l / 0.4, 2.0) - pow(b / 0.14, 2.0));
        float lanes = smoothstep(0.45, 0.75, fbm(d * 11.0 + 9.0)) * exp(-pow(b / 0.05, 2.0));

        // Colorful: blue-violet star clouds, magenta nebulae, a warm golden core
        vec3 col = mix(vec3(0.35, 0.5, 1.0), vec3(0.9, 0.4, 0.95), smoothstep(0.35, 0.7, clouds));
        col = mix(col, vec3(1.0, 0.78, 0.5), bulge);
        float glow = (band + bulge * 0.9) * (1.0 - 0.7 * lanes);

        vec3 light = col * glow * 0.24;
        for (int i = 0; i < 3; i++) {
          float a = acos(clamp(dot(d, galaxyDirs[i]), -1.0, 1.0));
          light += galaxyColors[i] * exp(-pow(a / galaxySizes[i], 2.0)) * 0.35;
        }
        float fade = visibility * smoothstep(0.0, 0.3, vHeight); // dust hides it near the horizon
        gl_FragColor = vec4(light * fade, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), mat);
  mesh.frustumCulled = false;
  return mesh;
}
