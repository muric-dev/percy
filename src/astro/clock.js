import { daysSinceJ2000, marsTime, skyAt, SOL_IN_DAYS, JEZERO } from './ephemeris.js';

// Simulated Martian time, paced like a Minecraft day: a full sol lasts 20 real minutes —
// 10 min of day, 1.5 min of dusk, 7 min of night and 1.5 min of dawn. The phases are tied
// to the real sun altitude at Jezero for today's season, and time runs at a different speed
// in each phase so they always last those real durations.
// It starts from today's real date at a chosen local solar time.
const DAY_ALT = 3; // degrees: above this it is day
const NIGHT_ALT = -9; // degrees: below this it is night (stars are out)
export const PHASES = [
  // name, real seconds, label of the event that ends it
  { name: 'Dawn', seconds: 90, ends: 'Day' },
  { name: 'Day', seconds: 600, ends: 'Sunset' },
  { name: 'Dusk', seconds: 90, ends: 'Night' },
  { name: 'Night', seconds: 420, ends: 'Dawn' },
];
export const SOL_SECONDS = PHASES.reduce((sum, p) => sum + p.seconds, 0);
const DAY_STARTS = PHASES[0].seconds; // real seconds into the cycle
const NIGHT_STARTS = PHASES[0].seconds + PHASES[1].seconds + PHASES[2].seconds;
const DEFAULT_START = 16.75; // 16:45, late afternoon at Jezero
const DEG = Math.PI / 180;

// Local solar times (hours) when the sun crosses an altitude, rising and setting
function crossing(altDeg, ls) {
  const lsr = ls * DEG, lat = JEZERO.lat * DEG;
  const dec = Math.asin(0.42565 * Math.sin(lsr)) + 0.25 * DEG * Math.sin(lsr); // Mars24 solar declination
  const cosH = (Math.sin(altDeg * DEG) - Math.sin(lat) * Math.sin(dec)) / (Math.cos(lat) * Math.cos(dec));
  const H = Math.acos(Math.min(Math.max(cosH, -1), 1)) / DEG / 15;
  return { rise: 12 - H, set: 12 + H };
}

// Phase boundaries in local solar time, starting at the beginning of dawn (wrapping past 24 h)
function phaseTimes(ls) {
  const night = crossing(NIGHT_ALT, ls), day = crossing(DAY_ALT, ls);
  return [night.rise, day.rise, day.set, night.set, night.rise + 24];
}

export function createMarsClock({ date = new Date(), startLocalTime = DEFAULT_START } = {}) {
  const now = daysSinceJ2000(date);
  const { ltst, ls } = marsTime(now);
  const times = phaseTimes(ls);

  // d at the start of the current cycle (dawn), and the real time elapsed in the cycle
  const hoursSinceDawn = (((ltst - times[0]) % 24) + 24) % 24;
  let cycleStart = now - (hoursSinceDawn / 24) * SOL_IN_DAYS;
  let elapsed = realSecondsAt((((startLocalTime - times[0]) % 24) + 24) % 24);

  // Real seconds until a moment of the cycle comes around again
  const untilCycle = (at) => (((at - elapsed) % SOL_SECONDS) + SOL_SECONDS) % SOL_SECONDS;

  function realSecondsAt(hoursSinceDawn) {
    let seconds = 0;
    for (let i = 0; i < PHASES.length; i++) {
      const from = times[i] - times[0], to = times[i + 1] - times[0];
      if (hoursSinceDawn < to) return seconds + ((hoursSinceDawn - from) / (to - from)) * PHASES[i].seconds;
      seconds += PHASES[i].seconds;
    }
    return 0;
  }

  // Current phase and local time from the real seconds elapsed in the cycle
  function state() {
    let start = 0;
    for (let i = 0; i < PHASES.length; i++) {
      const end = start + PHASES[i].seconds;
      if (elapsed < end) {
        const f = (elapsed - start) / PHASES[i].seconds;
        const hours = times[i] - times[0] + f * (times[i + 1] - times[i]);
        const nightIn = untilCycle(NIGHT_STARTS), dayIn = untilCycle(DAY_STARTS);
        return { phase: PHASES[i], hours, phaseLeft: end - elapsed, nightIn, dayIn, progress: elapsed / SOL_SECONDS };
      }
      start = end;
    }
  }
  let current = state();
  let sky = skyAt(cycleStart + (current.hours / 24) * SOL_IN_DAYS);

  return {
    get sky() {
      return sky;
    },
    // { phase: { name, ends }, phaseLeft, nightIn, dayIn } — seconds of real time; progress: 0..1 of the sol
    get status() {
      return current;
    },
    update(dt) {
      elapsed += dt;
      if (elapsed >= SOL_SECONDS) {
        elapsed -= SOL_SECONDS;
        cycleStart += SOL_IN_DAYS;
      }
      current = state();
      sky = skyAt(cycleStart + (current.hours / 24) * SOL_IN_DAYS);
      return sky;
    },
  };
}
