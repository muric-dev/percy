import { PHASES, SOL_SECONDS } from '../astro/clock.js';

// Top-center clock: local solar time at Jezero, the current phase, a countdown to night
// (or to daylight at night) and a bar of the whole sol with a marker for "now".
const ICONS = { Dawn: '🌅', Day: '☀️', Dusk: '🌇', Night: '🌙' };
const BAR_COLORS = { Dawn: '#c7785a', Day: '#e9b47a', Dusk: '#8a4f58', Night: '#1d2140' };

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const hhmm = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;

export function createClockHud(element) {
  const text = element.querySelector('.clock-text');
  const bar = element.querySelector('.clock-bar');
  const marker = element.querySelector('.clock-marker');

  // Bar segments sized by each phase's real duration
  let at = 0;
  const stops = PHASES.flatMap(({ name, seconds }) => {
    const from = (at / SOL_SECONDS) * 100;
    at += seconds;
    return [`${BAR_COLORS[name]} ${from}%`, `${BAR_COLORS[name]} ${(at / SOL_SECONDS) * 100}%`];
  });
  bar.style.background = `linear-gradient(90deg, ${stops.join(', ')})`;

  // status: clock.status; ltst: local true solar time (hours)
  function update(status, ltst) {
    const { phase, nightIn, dayIn, progress } = status;
    const dark = phase.name === 'Night' || phase.name === 'Dawn';
    const countdown = dark ? `Daylight in ${mmss(dayIn)}` : `Night in ${mmss(nightIn)}`;
    text.textContent = `${ICONS[phase.name]} ${hhmm(ltst)} at Jezero · ${phase.name} · ${countdown}`;
    marker.style.left = `${progress * 100}%`;
  }

  return { update };
}
