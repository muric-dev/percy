import * as THREE from 'three';
import { DUST_COLOR } from '../config.js';
import { smoothstep } from '../utils/math.js';

// Martian sky through the sol. By day it is butterscotch (dust absorbs blue light), the zenith is
// darker brown and the sun has a bluish halo, because the fine dust scatters blue light forward
// into a narrow cone around the sun. That blue glow lingers on the horizon after sunset.

// Sky colors by sun altitude (degrees). Fog, lights and the skyline all share these.
const PALETTE = [
  { alt: -18, horizon: 0x0b0a0c, zenith: 0x020205 },
  { alt: -8, horizon: 0x2a2128, zenith: 0x0b0a10 },
  { alt: -2, horizon: 0x6e4c42, zenith: 0x2a1c1c },
  { alt: 4, horizon: 0xb98256, zenith: 0x4e3022 },
  { alt: 15, horizon: DUST_COLOR, zenith: 0x6e4632 },
];
const HALO = new THREE.Color(0x9ab4c4);
const SUN = new THREE.Color(0xfff2dc);

// Interpolates the palette at a sun altitude
function paletteAt(alt, key, target) {
  const i = PALETTE.findIndex((p) => p.alt > alt);
  if (i === 0) return target.set(PALETTE[0][key]);
  if (i === -1) return target.set(PALETTE.at(-1)[key]);
  const a = PALETTE[i - 1], b = PALETTE[i];
  return target.set(a[key]).lerp(new THREE.Color(b[key]), (alt - a.alt) / (b.alt - a.alt));
}

// How the sky looks for a given sun altitude (degrees)
export function skyLook(sunAlt, look = { horizon: new THREE.Color(), zenith: new THREE.Color() }) {
  paletteAt(sunAlt, 'horizon', look.horizon);
  paletteAt(sunAlt, 'zenith', look.zenith);
  look.daylight = smoothstep(-6, 12, sunAlt); // 0 at night, 1 in full day
  look.sunUp = smoothstep(-0.6, 0.4, sunAlt); // sun disc above the horizon
  look.lowSun = 1 - smoothstep(4, 30, sunAlt); // golden hour / blue-halo strength
  look.twilight = smoothstep(-14, -3, sunAlt) * (1 - smoothstep(-1, 6, sunAlt)); // post-sunset glow
  look.stars = 1 - smoothstep(-13, -4, sunAlt); // 0 by day, 1 in full night
  return look;
}

export function createSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      horizon: { value: new THREE.Color() },
      zenith: { value: new THREE.Color() },
      halo: { value: HALO },
      sunColor: { value: SUN },
      daylight: { value: 1 },
      sunUp: { value: 1 },
      lowSun: { value: 0 },
      twilight: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww; // always at the far plane, behind everything
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir, horizon, zenith, halo, sunColor;
      uniform float daylight, sunUp, lowSun, twilight;
      varying vec3 vDir;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 col = mix(horizon, zenith, pow(h, 0.5));
        float s = dot(d, sunDir), sPos = max(s, 0.0);

        // Dust forward scattering: wide warm glow around the sun, brighter on the sun's side
        vec2 dh = normalize(d.xz + 1e-5), sh = normalize(sunDir.xz + 1e-5);
        float sunSide = max(dot(dh, sh), 0.0);
        col += vec3(1.0, 0.62, 0.32) * (pow(sPos, 6.0) * 0.3 + sunSide * exp(-h * 4.0) * 0.08) * daylight;

        // Blue halo of the Martian sunset, around the sun when it is low
        col = mix(col, halo, clamp(pow(sPos, 70.0) * (0.25 + 0.5 * lowSun) * daylight, 0.0, 1.0));

        // After sunset: blue glow over the horizon where the sun went down
        col += halo * pow(sunSide, 6.0) * exp(-h * 10.0) * twilight * 0.35;

        // Solar disc: 0.35° across from Mars (1.52 AU), two thirds of what we see from Earth.
        // 1 - cos(angle) ≈ angle² / 2; the disc radius is 0.175° = 0.00305 rad.
        col += sunColor * (1.0 - smoothstep(3.6e-6, 5.6e-6, 1.0 - s)) * 6.0 * sunUp;
        col += sunColor * pow(sPos, 3000.0) * 0.6 * sunUp;

        // Below the horizon, same tone as the fog
        col = mix(col, horizon, smoothstep(0.0, -0.05, d.y));
        col += (hash(gl_FragCoord.xy) - 0.5) / 255.0; // dithering: no color banding
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 64, 32), mat);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  return sky;
}

export function updateSky(sky, sunDir, look) {
  const u = sky.material.uniforms;
  u.sunDir.value.copy(sunDir);
  u.horizon.value.copy(look.horizon);
  u.zenith.value.copy(look.zenith);
  u.daylight.value = look.daylight;
  u.sunUp.value = look.sunUp;
  u.lowSun.value = look.lowSun;
  u.twilight.value = look.twilight;
}
