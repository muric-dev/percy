import * as THREE from 'three';
import CONSTELLATIONS from '../data/constellations.json';
import { equatorialToVector } from '../astro/ephemeris.js';
import { constellationColor } from '../utils/colors.js';

// Night-sky guide to find your way: colored constellation figures, names of the major
// constellations and the planets, and the compass points on the horizon.
const LABEL_DISTANCE = 900; // m: in front of the skyline, behind everything else
const LABEL_HEIGHT = 0.022; // label height as a fraction of its distance (~1.3°)
const MIN_LABEL_ALT = Math.sin(THREE.MathUtils.degToRad(4)); // hide labels close to the horizon
const LINE_OPACITY = 1;

// Text sprite drawn on a canvas
function label(text, color, scale = 1) {
  const font = 64;
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d');
  g.font = `600 ${font}px system-ui, sans-serif`;
  canvas.width = Math.ceil(g.measureText(text).width) + 24;
  canvas.height = font * 1.4;
  g.font = `600 ${font}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0, 0, 0, 0.9)';
  g.shadowBlur = 10;
  g.fillStyle = `#${color.getHexString()}`;
  g.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
  const h = LABEL_DISTANCE * LABEL_HEIGHT * scale;
  sprite.scale.set((h * canvas.width) / canvas.height, h, 1);
  return sprite;
}

// Constellation figures as line segments on the unit sphere, one color per constellation
function constellationLines() {
  const positions = [], colors = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Color();
  CONSTELLATIONS.forEach(({ lines }, index) => {
    constellationColor(index, c);
    for (const line of lines) {
      for (let i = 0; i + 3 < line.length; i += 2) {
        equatorialToVector(line[i], line[i + 1], a);
        equatorialToVector(line[i + 2], line[i + 3], b);
        positions.push(...a.toArray(), ...b.toArray());
        colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    uniforms: { opacity: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      varying vec3 vColor;
      varying float vHeight;
      void main() {
        vColor = color;
        vHeight = normalize(mat3(modelMatrix) * position).y;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform float opacity;
      varying vec3 vColor;
      varying float vHeight;
      void main() {
        float a = opacity * smoothstep(0.0, 0.12, vHeight);
        gl_FragColor = vec4(vColor * a * 0.6, a); // kept dim: bright colors wash out to white in tone mapping
      }`,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  return lines;
}

export function createSkyGuide(planetList) {
  const guide = new THREE.Group();

  // Moves with the stars (equatorial frame)
  const celestial = new THREE.Group();
  celestial.matrixAutoUpdate = false;
  celestial.add(constellationLines());
  const c = new THREE.Color();
  const names = CONSTELLATIONS.map((k, index) => ({ ...k, index })).filter((k) => k.rank === 1).map((k) => {
    const sprite = label(k.name, constellationColor(k.index, c));
    sprite.userData.dir = equatorialToVector(...k.label);
    sprite.position.copy(sprite.userData.dir).multiplyScalar(LABEL_DISTANCE);
    celestial.add(sprite);
    return sprite;
  });

  // Planets (their positions change every frame) and compass points (fixed in the local sky)
  const planets = planetList.map((p) => {
    const sprite = label(p.name, c.set(p.color), p.name === 'Earth' ? 1.2 : 1);
    sprite.center.set(-0.08, 0.5); // text to the right of the planet
    guide.add(sprite);
    return sprite;
  });
  const compass = [['N', 0, -1], ['E', 1, 0], ['S', 0, 1], ['W', -1, 0]].map(([text, x, z]) => {
    const sprite = label(text, c.set(0xffffff), 1.6);
    sprite.position.set(x, 0.035, z).normalize().multiplyScalar(LABEL_DISTANCE);
    guide.add(sprite);
    return sprite;
  });

  guide.add(celestial);
  guide.userData = { celestial, names, planets, compass };
  return guide;
}

// sky: output of skyAt(); visibility: 0 (day) … 1 (full night)
const v = new THREE.Vector3();
export function updateSkyGuide(guide, camera, sky, visibility) {
  const { celestial, names, planets, compass } = guide.userData;
  guide.position.copy(camera.position); // the sky is at infinity: no parallax
  guide.visible = visibility > 0.01;
  if (!guide.visible) return;

  celestial.matrix.copy(sky.sceneFromICRF);
  celestial.children[0].material.uniforms.opacity.value = LINE_OPACITY * visibility;
  for (const sprite of names) {
    v.copy(sprite.userData.dir).applyMatrix4(sky.sceneFromICRF);
    sprite.visible = v.y > MIN_LABEL_ALT;
    sprite.material.opacity = 0.9 * visibility;
  }
  sky.planets.forEach((p, i) => {
    planets[i].position.copy(p.dir).multiplyScalar(LABEL_DISTANCE);
    planets[i].visible = p.dir.y > MIN_LABEL_ALT;
    planets[i].material.opacity = visibility;
  });
  compass.forEach((sprite) => (sprite.material.opacity = 0.8 * visibility));
}
