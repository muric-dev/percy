import * as THREE from 'three';
import STARS from '../data/stars.json';
import { equatorialToVector } from '../astro/ephemeris.js';
import { colorFromBV } from '../utils/colors.js';
import { createMilkyWay } from './milkyway.js';

// Real night sky over Jezero: 5,044 naked-eye stars (magnitude ≤ 6, d3-celestial catalog), the
// Milky Way and the planets. Stars sit on a unit sphere in equatorial (ICRF) coordinates and are rotated into
// the local sky each frame with a single matrix, so their positions match the date and time.
// Mars' thin air barely makes stars twinkle, so they don't; dust dims them near the horizon.

const sizeOf = (mag) => Math.max(1.8, 6.2 - 0.75 * mag);

function pointsMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    uniforms: { visibility: { value: 0 }, pixelRatio: { value: Math.min(devicePixelRatio, 2) } },
    vertexShader: /* glsl */ `
      attribute float size, mag;
      attribute vec3 color;
      uniform float visibility, pixelRatio;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec3 dir = normalize(mat3(modelMatrix) * position);
        // Bright stars show up first at dusk; dust hides them near the horizon
        float need = (mag + 2.0) / 9.0;
        vAlpha = smoothstep(need - 0.12, need + 0.12, visibility) * smoothstep(0.0, 0.18, dir.y);
        vAlpha *= clamp(1.4 - mag * 0.15, 0.4, 1.0);
        vColor = color;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww; // at the far plane: terrain and skyline hide stars behind them
        gl_PointSize = size * pixelRatio;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float a = (1.0 - smoothstep(0.35, 1.0, r)) * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor * a, a);
      }`,
  });
}

function pointsGeometry(count) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(count), 1));
  geo.setAttribute('mag', new THREE.BufferAttribute(new Float32Array(count), 1));
  return geo;
}

export function createStarfield(planetList) {
  const group = new THREE.Group();
  const v = new THREE.Vector3(), c = new THREE.Color();

  const starGeo = pointsGeometry(STARS.length);
  STARS.forEach(([ra, dec, mag, bv], i) => {
    starGeo.attributes.position.setXYZ(i, ...equatorialToVector(ra, dec, v).toArray());
    starGeo.attributes.color.setXYZ(i, ...colorFromBV(bv, c).toArray());
    starGeo.attributes.size.setX(i, sizeOf(mag));
    starGeo.attributes.mag.setX(i, mag);
  });
  const stars = new THREE.Points(starGeo, pointsMaterial());
  stars.matrixAutoUpdate = false;

  // Planets: positions are updated every frame, already in the local sky
  const planetGeo = pointsGeometry(planetList.length);
  planetList.forEach(({ mag, color }, i) => {
    planetGeo.attributes.color.setXYZ(i, ...c.set(color).toArray());
    planetGeo.attributes.size.setX(i, sizeOf(mag) + 1);
    planetGeo.attributes.mag.setX(i, mag);
  });
  const planets = new THREE.Points(planetGeo, pointsMaterial());

  [stars, planets].forEach((p) => (p.frustumCulled = false));
  const milkyWay = createMilkyWay();
  milkyWay.matrixAutoUpdate = false;
  milkyWay.renderOrder = -0.5; // behind the stars
  group.add(milkyWay, stars, planets);
  group.userData = { milkyWay, stars, planets };
  return group;
}

// sky: output of skyAt(); visibility: 0 (day) … 1 (full night)
export function updateStarfield(starfield, camera, sky, visibility) {
  const { milkyWay, stars, planets } = starfield.userData;
  starfield.position.copy(camera.position); // the sky is at infinity: no parallax
  stars.matrix.copy(sky.sceneFromICRF);
  milkyWay.matrix.copy(sky.sceneFromICRF);
  milkyWay.material.uniforms.visibility.value = visibility;

  const pos = planets.geometry.attributes.position;
  sky.planets.forEach((p, i) => pos.setXYZ(i, p.dir.x, p.dir.y, p.dir.z));
  pos.needsUpdate = true;

  stars.material.uniforms.visibility.value = visibility;
  planets.material.uniforms.visibility.value = visibility;
}
