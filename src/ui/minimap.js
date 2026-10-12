import * as THREE from 'three';
import { SUN_DIRECTION } from '../config.js';
import { bearingOf, yawOf } from '../utils/math.js';

// North-up minimap centered on the rover: shaded-relief terrain, the path driven so far,
// the rover's heading, compass points and the sun's direction.
const VIEW = 160; // meters shown across the map
const TRAIL_STEP = 1; // m between recorded trail points
const MAX_TRAIL = 5000;
const RELIEF = 5; // vertical exaggeration of the hillshade (TARs are only ~1.3 m tall)
const LIGHT = new THREE.Vector3(-1, 1.2, -1).normalize(); // classic NW hillshade light
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function createMinimap(canvas, info, terrain) {
  const { width: mapSize, widthSegments } = terrain.geometry.parameters;
  const relief = shadedRelief(terrain.geometry, widthSegments + 1);
  const texelsPerMeter = widthSegments / mapSize;

  const dpr = Math.min(devicePixelRatio, 2);
  const size = canvas.clientWidth;
  canvas.width = canvas.height = size * dpr;
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  const scale = size / VIEW; // px per meter

  const start = new THREE.Vector3();
  const trail = [];
  let traveled = 0;

  function update(rover) {
    const { x, z } = rover.position;
    const yaw = yawOf(rover);
    const last = trail.at(-1);
    if (!last) start.copy(rover.position);
    if (!last || Math.hypot(x - last.x, z - last.z) >= TRAIL_STEP) {
      if (last) traveled += Math.hypot(x - last.x, z - last.z);
      trail.push({ x, z });
      if (trail.length > MAX_TRAIL) trail.shift();
    }

    const c = size / 2;
    g.save();
    g.clearRect(0, 0, size, size);
    g.beginPath();
    g.arc(c, c, c, 0, Math.PI * 2);
    g.clip();

    // Terrain around the rover
    g.fillStyle = '#7a3c22';
    g.fillRect(0, 0, size, size);
    const half = (VIEW / 2) * texelsPerMeter;
    const sx = (x + mapSize / 2) * texelsPerMeter, sz = (z + mapSize / 2) * texelsPerMeter;
    g.drawImage(relief, sx - half, sz - half, half * 2, half * 2, 0, 0, size, size);

    // Path driven
    const toMap = (p) => [c + (p.x - x) * scale, c + (p.z - z) * scale];
    g.strokeStyle = 'rgba(255, 236, 200, 0.85)';
    g.lineWidth = 1.5;
    g.setLineDash([3, 3]);
    g.beginPath();
    trail.forEach((p, i) => (i ? g.lineTo(...toMap(p)) : g.moveTo(...toMap(p))));
    g.lineTo(c, c);
    g.stroke();
    g.setLineDash([]);

    drawCompass(g, c);
    drawRover(g, c, yaw);
    g.restore();

    const bearing = bearingOf(Math.sin(yaw), Math.cos(yaw));
    const away = Math.hypot(x - start.x, z - start.z);
    info.textContent = `${Math.round(bearing)}° ${COMPASS[Math.round(bearing / 45) % 8]} · ${traveled.toFixed(0)} m driven · ${away.toFixed(0)} m from start`;
  }

  return { update };
}

// Terrain colors × hillshade, one pixel per terrain vertex (row 0 = north)
function shadedRelief(geo, side) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = side;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(side, side);
  const col = geo.attributes.color, nrm = geo.attributes.normal;
  const n = new THREE.Vector3();
  const toSRGB = (v) => Math.round(Math.pow(Math.min(v, 1), 1 / 2.2) * 255);
  for (let i = 0; i < side * side; i++) {
    n.set(nrm.getX(i) * RELIEF, nrm.getY(i), nrm.getZ(i) * RELIEF).normalize();
    const shade = 0.45 + 0.75 * Math.max(n.dot(LIGHT), 0);
    img.data[i * 4] = toSRGB(col.getX(i) * shade);
    img.data[i * 4 + 1] = toSRGB(col.getY(i) * shade);
    img.data[i * 4 + 2] = toSRGB(col.getZ(i) * shade);
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function drawCompass(g, c) {
  g.font = '600 11px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  [['N', 0, -1], ['E', 1, 0], ['S', 0, 1], ['W', -1, 0]].forEach(([label, dx, dy]) => {
    g.fillStyle = label === 'N' ? '#fff' : 'rgba(255, 226, 196, 0.8)';
    g.fillText(label, c + dx * (c - 10), c + dy * (c - 10));
  });

  // Sun marker on the edge, in the sun's direction
  const sun = new THREE.Vector2(SUN_DIRECTION.x, SUN_DIRECTION.z).normalize();
  g.fillStyle = '#ffe9b0';
  g.beginPath();
  g.arc(c + sun.x * (c - 24), c + sun.y * (c - 24), 4, 0, Math.PI * 2);
  g.fill();
}

// Arrow at the center pointing where the rover is heading
function drawRover(g, c, yaw) {
  g.save();
  g.translate(c, c);
  g.rotate(Math.atan2(Math.cos(yaw), Math.sin(yaw)));
  g.fillStyle = '#ffffff';
  g.strokeStyle = 'rgba(40, 18, 8, 0.9)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(9, 0);
  g.lineTo(-6, 6);
  g.lineTo(-3, 0);
  g.lineTo(-6, -6);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
}
