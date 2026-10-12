// Builds the compact star and constellation data used by the sky from d3-celestial
// (https://github.com/ofrohn/d3-celestial, BSD-3-Clause, © Olaf Frohn).
// Usage: node scripts/build-sky-data.mjs <folder with stars.6.json, constellations.json, constellations.lines.json>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const src = process.argv[2];
if (!src) throw new Error('Pass the folder that holds the downloaded d3-celestial JSON files');
const read = (name) => JSON.parse(readFileSync(join(src, name), 'utf8'));
const round = (v, digits) => Number(v.toFixed(digits));
const toRA = (lon) => round((lon + 360) % 360, 3); // d3-celestial stores RA as −180..180°

// Stars: [ra°, dec°, magnitude, B−V color index]
const stars = read('stars.6.json').features.map(({ geometry, properties }) => [
  toRA(geometry.coordinates[0]),
  round(geometry.coordinates[1], 3),
  round(properties.mag, 2),
  round(parseFloat(properties.bv) || 0.6, 2),
]);

// Constellations: name, rank, label position and stick-figure lines as flat [ra, dec, ra, dec, ...] arrays
const lines = new Map(read('constellations.lines.json').features.map((f) => [f.id, f.geometry.coordinates]));
// Names are the official IAU Latin names; rank 1 = major, 2 = medium, 3 = minor constellation
const constellations = read('constellations.json').features.map(({ id, properties, geometry }) => ({
  id,
  name: properties.name.replace(/\s/g, ' '),
  rank: Number(properties.rank),
  label: [toRA(geometry.coordinates[0]), round(geometry.coordinates[1], 2)],
  lines: (lines.get(id) ?? []).map((line) => line.flatMap(([lon, lat]) => [toRA(lon), round(lat, 3)])),
}));

mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/stars.json', JSON.stringify(stars));
writeFileSync('src/data/constellations.json', JSON.stringify(constellations));
console.log(`${stars.length} stars, ${constellations.length} constellations`);
