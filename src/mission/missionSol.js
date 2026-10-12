import { daysSinceJ2000, marsSolDate, SOL_IN_DAYS, JEZERO } from '../astro/ephemeris.js';

// Mission sols: sol 0 is the Martian day Perseverance landed (18 Feb 2021), counted in
// local mean solar time at Jezero, like the sol numbers in NASA's data.
const LANDING = daysSinceJ2000(new Date('2021-02-18T20:55:00Z'));
const localSolDate = (d) => marsSolDate(d) + JEZERO.lon / 360;
const SOL_ZERO = Math.floor(localSolDate(LANDING));

// Fractional mission sol at time d (days since J2000), and back
export const missionSol = (d) => localSolDate(d) - SOL_ZERO;
export const daysAtSol = (sol) => (sol + SOL_ZERO - JEZERO.lon / 360 - 44796.0 + 0.0009626) * SOL_IN_DAYS + 4.5;
export const LANDING_DAYS = LANDING;
