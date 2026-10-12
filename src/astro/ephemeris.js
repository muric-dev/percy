import * as THREE from 'three';

// Positional astronomy as seen from Jezero crater, accurate to well under a degree.
// - Planet positions: JPL Keplerian elements, valid 1800–2050 (Standish, "Approximate Positions
//   of the Planets", Table 1).
// - Mars orientation: IAU rotation model (pole α0 = 317.68143 − 0.1061T, δ0 = 52.88650 − 0.0609T,
//   prime meridian W = 176.630 + 350.89198226d).
// - Local solar time and solar longitude Ls: Mars24 algorithm (Allison & McEwen 2000).
// Scene axes: north = -Z, east = +X, up = +Y.

const DEG = Math.PI / 180;
export const JEZERO = { lat: 18.4446, lon: 77.4509 }; // Octavia E. Butler Landing, °N / °E
export const SOL_IN_DAYS = 1.0274912517; // Earth days per Mars solar day
const OBLIQUITY = 23.43928 * DEG; // Earth's, to turn ecliptic into equatorial (ICRF) coordinates
const TT_MINUS_UTC = 69.184; // s

// Days since J2000.0 (Terrestrial Time) for a JavaScript Date
export const daysSinceJ2000 = (date) => (date.getTime() + TT_MINUS_UTC * 1000) / 86400000 + 2440587.5 - 2451545.0;

// a (AU), e, I, L, ϖ (long. of perihelion), Ω (long. of ascending node) and their rates per century
const ELEMENTS = {
  venus: [0.72333566, 0.0000039, 0.00677672, -0.00004107, 3.39467605, -0.0007889, 181.9790995, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418],
  earth: [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0, 0],
  mars: [1.52371034, 0.00001847, 0.0933941, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343],
  jupiter: [5.202887, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714, 34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106],
  saturn: [9.53667594, -0.0012506, 0.05386179, -0.00050991, 2.48599187, 0.00193609, 49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794],
};

// Heliocentric position (AU) in equatorial J2000 coordinates
export function heliocentric(planet, d) {
  const T = d / 36525;
  const [a0, da, e0, de, I0, dI, L0, dL, w0, dw, N0, dN] = ELEMENTS[planet];
  const a = a0 + da * T, e = e0 + de * T, I = (I0 + dI * T) * DEG;
  const L = L0 + dL * T, varpi = w0 + dw * T, node = (N0 + dN * T) * DEG;
  const omega = varpi * DEG - node;
  const M = ((((L - varpi) % 360) + 540) % 360 - 180) * DEG;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 6; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));

  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const [co, so, cN, sN, cI, sI] = [Math.cos(omega), Math.sin(omega), Math.cos(node), Math.sin(node), Math.cos(I), Math.sin(I)];
  const x = (co * cN - so * sN * cI) * xp + (-so * cN - co * sN * cI) * yp;
  const y = (co * sN + so * cN * cI) * xp + (-so * sN + co * cN * cI) * yp;
  const z = so * sI * xp + co * sI * yp;
  return new THREE.Vector3(x, y * Math.cos(OBLIQUITY) - z * Math.sin(OBLIQUITY), y * Math.sin(OBLIQUITY) + z * Math.cos(OBLIQUITY));
}

// Rotation from ICRF (equatorial J2000) to Mars body-fixed coordinates
function bodyFromICRF(d) {
  const T = d / 36525;
  const ra = (317.68143 - 0.1061 * T) * DEG, dec = (52.8865 - 0.0609 * T) * DEG;
  const W = ((176.63 + 350.89198226 * d) % 360) * DEG;
  const rz = (t) => new THREE.Matrix4().set(Math.cos(t), Math.sin(t), 0, 0, -Math.sin(t), Math.cos(t), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
  const rx = (t) => new THREE.Matrix4().set(1, 0, 0, 0, 0, Math.cos(t), Math.sin(t), 0, 0, -Math.sin(t), Math.cos(t), 0, 0, 0, 0, 1);
  return rz(W).multiply(rx(Math.PI / 2 - dec)).multiply(rz(Math.PI / 2 + ra));
}

// Rotation from Mars body-fixed coordinates to the local scene (east, up, south) at Jezero
const SCENE_FROM_BODY = (() => {
  const p = JEZERO.lat * DEG, l = JEZERO.lon * DEG;
  const east = [-Math.sin(l), Math.cos(l), 0];
  const up = [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
  const north = [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)];
  return new THREE.Matrix4().set(...east, 0, ...up, 0, ...north.map((v) => -v), 0, 0, 0, 0, 1);
})();

// Observer's position in body-fixed km (for the parallax of Phobos and Deimos)
const MARS_RADIUS_KM = 3389.5;
const OBSERVER = new THREE.Vector3(
  Math.cos(JEZERO.lat * DEG) * Math.cos(JEZERO.lon * DEG),
  Math.cos(JEZERO.lat * DEG) * Math.sin(JEZERO.lon * DEG),
  Math.sin(JEZERO.lat * DEG),
).multiplyScalar(MARS_RADIUS_KM);

// Moons on circular equatorial orbits with their real periods and radii.
// Their orbital phase is approximate (no full ephemeris), but the motion is right:
// Phobos rises in the west and crosses the sky in ~5.5 h; Deimos drifts slowly westward.
const MOONS = {
  phobos: { radius: 9376, period: 0.31891023, phase: 0 },
  deimos: { radius: 23463.2, period: 1.263, phase: 140 },
};
const SIDEREAL_DAY = 360 / 350.89198226;

// Mars24: Ls (solar longitude, the Martian season) and local true solar time at Jezero (hours)
export function marsTime(d) {
  const M = (19.3871 + 0.52402073 * d) * DEG;
  const alphaFMS = 270.3871 + 0.524038496 * d;
  const equationOfCenter =
    (10.691 + 3e-7 * d) * Math.sin(M) + 0.623 * Math.sin(2 * M) + 0.05 * Math.sin(3 * M) + 0.005 * Math.sin(4 * M);
  const ls = (((alphaFMS + equationOfCenter) % 360) + 360) % 360;
  const mtc = ((((24 * (d - 4.5)) / SOL_IN_DAYS + 24 * 44796.0 - 24 * 0.0009626) % 24) + 24) % 24;
  const lmst = (mtc + JEZERO.lon / 15) % 24;
  const lsr = ls * DEG;
  const eot = 2.861 * Math.sin(2 * lsr) - 0.071 * Math.sin(4 * lsr) + 0.002 * Math.sin(6 * lsr) - equationOfCenter;
  const ltst = (((lmst + eot / 15) % 24) + 24) % 24;
  return { ls, ltst };
}

// Mars Sol Date (Mars24): sols elapsed since the Martian epoch, at Mars's prime meridian
export const marsSolDate = (d) => (d - 4.5) / SOL_IN_DAYS + 44796.0 - 0.0009626;

// Seconds a radio signal takes to cross the Earth–Mars distance at time d
const AU_LIGHT_SECONDS = 499.004784;
export const lightTimeSeconds = (d) => heliocentric('mars', d).distanceTo(heliocentric('earth', d)) * AU_LIGHT_SECONDS;

const PLANETS = [
  { name: 'Earth', key: 'earth', mag: -1.5, color: 0x9cc4ff },
  { name: 'Venus', key: 'venus', mag: -3.2, color: 0xfff6e0 },
  { name: 'Jupiter', key: 'jupiter', mag: -2.3, color: 0xffe8c8 },
  { name: 'Saturn', key: 'saturn', mag: 0.6, color: 0xf3dca8 },
];

// Everything the sky needs at time d (days since J2000 TT)
export function skyAt(d) {
  const sceneFromICRF = SCENE_FROM_BODY.clone().multiply(bodyFromICRF(d));
  const marsPos = heliocentric('mars', d);
  const toScene = (icrf) => icrf.clone().normalize().applyMatrix4(sceneFromICRF).normalize();

  const sunDir = toScene(marsPos.clone().negate());
  const planets = PLANETS.map((p) => ({ ...p, dir: toScene(heliocentric(p.key, d).sub(marsPos)) }));

  const moons = {};
  for (const [name, m] of Object.entries(MOONS)) {
    const lon = (m.phase + 360 * d * (1 / m.period - 1 / SIDEREAL_DAY)) * DEG;
    const pos = new THREE.Vector3(Math.cos(lon), Math.sin(lon), 0).multiplyScalar(m.radius).sub(OBSERVER);
    moons[name] = pos.applyMatrix4(SCENE_FROM_BODY).normalize();
  }

  return { d, sceneFromICRF, sunDir, planets, moons, ...marsTime(d) };
}

// Unit vector (ICRF) for right ascension / declination in degrees
export function equatorialToVector(ra, dec, target = new THREE.Vector3()) {
  const r = ra * DEG, c = dec * DEG;
  return target.set(Math.cos(c) * Math.cos(r), Math.cos(c) * Math.sin(r), Math.sin(c));
}

// Altitude (degrees) and compass azimuth (degrees, 0 = north, 90 = east) of a scene direction
export function altAz(dir) {
  return {
    alt: Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)) / DEG,
    az: ((Math.atan2(dir.x, -dir.z) / DEG) + 360) % 360,
  };
}
