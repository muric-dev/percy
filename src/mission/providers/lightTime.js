import { daysSinceJ2000, lightTimeSeconds } from '../../astro/ephemeris.js';
import { missionSol, daysAtSol, LANDING_DAYS } from '../missionSol.js';

// Provider computed on the spot: how long light (and radio) takes between Earth and Mars,
// from the planets' real orbits. History is one point per sol since landing; live values
// tick every second from the real clock (not the game's sped-up sol).
const LIVE_EVERY = 1000; // ms

const now = () => daysSinceJ2000(new Date());
const pointAt = (d) => ({ sol: missionSol(d), value: lightTimeSeconds(d) / 60 });

export function createLightTimeProvider() {
  return {
    key: 'light-time',
    name: 'Computed live from planetary orbits',
    async request() {
      const today = now();
      const points = [pointAt(LANDING_DAYS)];
      for (let sol = Math.ceil(missionSol(LANDING_DAYS)); daysAtSol(sol) < today; sol++) points.push(pointAt(daysAtSol(sol)));
      points.push(pointAt(today));
      return points;
    },
    subscribe(channel, fn) {
      const timer = setInterval(() => fn(pointAt(now())), LIVE_EVERY);
      return () => clearInterval(timer);
    },
  };
}
