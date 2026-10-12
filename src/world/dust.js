import * as THREE from 'three';
import { rng } from '../utils/noise.js';
import { canvasTexture } from '../utils/textures.js';

const softDot = () =>
  canvasTexture(64, (g, size) => {
    const r = size / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  });

// Partículas de polvo flotando a la deriva con el viento.
const AREA = 120, HEIGHT = 25;

export function createDust() {
  const rand = rng(7);
  const count = 4000;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rand() - 0.5) * AREA;
    pos[i * 3 + 1] = rand() * HEIGHT;
    pos[i * 3 + 2] = (rand() - 0.5) * AREA;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffc896,
    size: 0.18,
    map: softDot(),
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geo, mat);
}

export function updateDust(points, dt, t) {
  const p = points.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) + dt * 2.2;
    let y = p.getY(i) + Math.sin(t * 0.7 + i) * dt * 0.3;
    if (x > AREA / 2) x -= AREA;
    p.setXY(i, x, y);
  }
  p.needsUpdate = true;
}
