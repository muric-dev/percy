import * as THREE from 'three';
import STARS from '../data/stars.json';
import CONSTELLATIONS from '../data/constellations.json';
import { equatorialToVector } from '../astro/ephemeris.js';
import { colorFromBV, constellationColor } from '../utils/colors.js';
import { GALACTIC_POLE, GALACTIC_CENTER } from '../world/milkyway.js';

// Sky chart of what is above Jezero right now: zenith at the center, horizon on the edge,
// north up and east on the LEFT (as when you lie down looking up). Shows constellation figures
// and names, bright stars, planets, the sun and the moons.
const MAX_MAG = 4.5; // stars drawn on the chart
// Labels: major constellations above 8°, medium ones only higher up, minor ones never (less clutter)
const LABEL_MIN_ALT = { 1: 8, 2: 30 };
const REDRAW_EVERY = 0.25; // s
const SEASONS = ['northern spring', 'northern summer', 'northern autumn', 'northern winter'];

// Precomputed equatorial unit vectors
const css = (color) => `#${color.getHexString()}`;
const stars = STARS.filter(([, , mag]) => mag <= MAX_MAG).map(([ra, dec, mag, bv]) => ({ v: equatorialToVector(ra, dec), mag, color: css(colorFromBV(bv)) }));
const figures = CONSTELLATIONS.map(({ name, rank, label, lines }, index) => ({
  name,
  rank,
  color: constellationColor(index),
  label: equatorialToVector(...label),
  lines: lines.map((line) => {
    const pts = [];
    for (let i = 0; i < line.length; i += 2) pts.push(equatorialToVector(line[i], line[i + 1]));
    return pts;
  }),
}));

// Points along the galactic equator; t = 0 at the galactic center (warm), 1 far from it (violet)
const GALACTIC_Y = new THREE.Vector3().crossVectors(GALACTIC_POLE, GALACTIC_CENTER).normalize();
const milkyWay = Array.from({ length: 120 }, (_, i) => {
  const l = (i / 120) * Math.PI * 2;
  const v = GALACTIC_CENTER.clone().multiplyScalar(Math.cos(l)).addScaledVector(GALACTIC_Y, Math.sin(l));
  const color = new THREE.Color(0xffc080).lerp(new THREE.Color(0x9a70ff), Math.min(1, Math.abs(Math.sin(l / 2)) * 1.6));
  return { v, color: css(color) };
});

export function createSkymap(canvas, info) {
  const dpr = Math.min(devicePixelRatio, 2);
  const size = canvas.clientWidth;
  canvas.width = canvas.height = size * dpr;
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  const c = size / 2, R = c - 2;
  const v = new THREE.Vector3();
  let wait = 0;

  // Scene direction → chart position (null if below the horizon)
  const project = (dir) => {
    if (dir.y < 0) return null;
    const r = (1 - Math.asin(dir.y) / (Math.PI / 2)) * R;
    const h = Math.hypot(dir.x, dir.z) || 1;
    return [c - (dir.x / h) * r, c + (dir.z / h) * r]; // east → left, north (−Z) → up
  };
  const toChart = (icrf, sky) => project(v.copy(icrf).applyMatrix4(sky.sceneFromICRF));

  // sky: output of skyAt(); look: output of skyLook()
  function update(dt, sky, look) {
    if ((wait -= dt) > 0) return;
    wait = REDRAW_EVERY;

    g.clearRect(0, 0, size, size);
    g.save();
    g.beginPath();
    g.arc(c, c, R, 0, Math.PI * 2);
    g.clip();
    const bg = new THREE.Color(0x0a0d1c).lerp(look.zenith, look.daylight * 0.8);
    g.fillStyle = `#${bg.getHexString()}`;
    g.fillRect(0, 0, size, size);
    drawAltitudeRings(g, c, R);

    // Milky Way band
    g.globalAlpha = 0.16;
    for (const p of milkyWay) {
      const xy = toChart(p.v, sky);
      if (!xy) continue;
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(xy[0], xy[1], R * 0.09, 0, Math.PI * 2);
      g.fill();
    }

    // Constellation figures
    g.lineWidth = 1;
    g.globalAlpha = 0.75;
    for (const { lines, color } of figures) {
      g.strokeStyle = css(color);
      for (const line of lines) {
        g.beginPath();
        let pen = false;
        for (const p of line) {
          const xy = toChart(p, sky);
          if (xy && pen) g.lineTo(...xy);
          else if (xy) g.moveTo(...xy);
          pen = Boolean(xy);
        }
        g.stroke();
      }
    }

    // Stars
    for (const s of stars) {
      const xy = toChart(s.v, sky);
      if (!xy) continue;
      g.fillStyle = s.color;
      g.globalAlpha = Math.min(1, 1.15 - s.mag * 0.17);
      g.beginPath();
      g.arc(xy[0], xy[1], Math.max(0.5, 2.4 - s.mag * 0.4), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;

    // Constellation names
    g.font = '9px system-ui, sans-serif';
    g.textAlign = 'center';
    let visible = 0;
    for (const f of figures) {
      v.copy(f.label).applyMatrix4(sky.sceneFromICRF);
      if (v.y <= 0) continue;
      visible++;
      g.fillStyle = css(f.color);
      if (Math.asin(v.y) * THREE.MathUtils.RAD2DEG >= (LABEL_MIN_ALT[f.rank] ?? 90)) g.fillText(f.name, ...project(v));
    }

    // Planets, moons and the sun
    for (const p of sky.planets) drawBody(g, project(p.dir), `#${new THREE.Color(p.color).getHexString()}`, 3, p.name);
    drawBody(g, project(sky.moons.phobos), '#c8b4a4', 3, 'Phobos');
    drawBody(g, project(sky.moons.deimos), '#c8b4a4', 2, 'Deimos');
    drawBody(g, project(sky.sunDir), '#ffe9b0', 6, 'Sun');
    g.restore();

    drawCardinals(g, c, R);
    info.textContent = `Ls ${sky.ls.toFixed(0)}° ${SEASONS[Math.floor(sky.ls / 90)]} · ${visible} constellations up`;
  }

  return { update };
}

function drawAltitudeRings(g, c, R) {
  g.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  for (const alt of [30, 60]) {
    g.beginPath();
    g.arc(c, c, (1 - alt / 90) * R, 0, Math.PI * 2);
    g.stroke();
  }
}

function drawBody(g, xy, color, radius, label) {
  if (!xy) return;
  g.fillStyle = color;
  g.beginPath();
  g.arc(xy[0], xy[1], radius, 0, Math.PI * 2);
  g.fill();
  g.font = '600 9px system-ui, sans-serif';
  g.textAlign = 'left';
  g.fillText(label, xy[0] + radius + 2, xy[1] + 3);
  g.textAlign = 'center';
}

function drawCardinals(g, c, R) {
  g.font = '600 11px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  [['N', 0, -1], ['E', -1, 0], ['S', 0, 1], ['W', 1, 0]].forEach(([label, dx, dy]) => {
    g.fillStyle = label === 'N' ? '#fff' : 'rgba(220, 230, 255, 0.8)';
    g.fillText(label, c + dx * (R - 9), c + dy * (R - 9));
  });
  g.textBaseline = 'alphabetic';
}
