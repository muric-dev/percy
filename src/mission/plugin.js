import { onPress } from '../core/input.js';
import { daysSinceJ2000 } from '../astro/ephemeris.js';
import { createTelemetry } from './telemetry.js';
import { createWaypointsProvider } from './providers/waypoints.js';
import { createLightTimeProvider } from './providers/lightTime.js';
import { missionSol } from './missionSol.js';
import { CHANNELS } from './channels.js';
import { createChart } from './chart.js';

// Mission control: a self-contained piece that plugs into the game with one call, like an
// Open MCT plugin. It registers the providers and channels, then builds a card per channel
// with its value and unit, a chart of the whole mission and what the number means.
// T shows/hides it. window.__missionControl exposes the loaded values for npm run check.
const TOGGLE_KEY = 'KeyT';

const STYLE = `
#mission{position:fixed;top:236px;right:16px;bottom:16px;width:320px;display:flex;flex-direction:column;gap:6px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,226,196,.35) transparent;color:#fff1e2;font:12px/1.4 system-ui,sans-serif}
#mission.hidden{display:none}
.mc-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:6px 12px;border-radius:8px;background:rgba(20,12,10,.62);letter-spacing:.06em;text-transform:uppercase;font-weight:700;font-size:11px}
.mc-head span{color:rgba(255,226,196,.65);font-weight:600;letter-spacing:.02em;text-transform:none;font-variant-numeric:tabular-nums}
.mc-card{padding:7px 12px 8px;border-radius:8px;background:rgba(42,23,16,.62);box-shadow:inset 3px 0 0 #ffb36b}
.mc-top{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.mc-name{color:rgba(255,226,196,.8);font-weight:600}
.mc-value{font:700 20px/1.1 system-ui,sans-serif;font-variant-numeric:tabular-nums;white-space:nowrap}
.mc-value small{font-size:12px;font-weight:600;color:rgba(255,226,196,.75);margin-left:3px}
.mc-chart{display:block;width:100%;height:50px;margin:4px 0 2px;cursor:crosshair}
.mc-meaning{margin:0}
.mc-source{margin:3px 0 0;color:rgba(255,226,196,.55);font-size:11px}
.mc-live{display:inline-block;width:7px;height:7px;margin-right:5px;border-radius:50%;background:#7dff9a;animation:mc-pulse 1s ease-in-out infinite alternate}
@keyframes mc-pulse{to{opacity:.25}}
@media (max-width:600px){#mission{top:auto;left:16px;width:auto;max-height:42vh;bottom:56px}}
`;

export function installMissionControl() {
  const telemetry = createTelemetry();
  telemetry.addProvider(createWaypointsProvider());
  telemetry.addProvider(createLightTimeProvider());
  CHANNELS.forEach(telemetry.addChannel);

  document.head.insertAdjacentHTML('beforeend', `<style>${STYLE}</style>`);
  const panel = document.createElement('aside');
  panel.id = 'mission';
  panel.innerHTML = `<div class="mc-head">Mission control <span></span></div>`;
  document.body.append(panel);
  const solLabel = panel.querySelector('.mc-head span');
  const showSol = () => (solLabel.textContent = `Today is sol ${Math.floor(missionSol(daysSinceJ2000(new Date())))} · T hides`);
  showSol();
  setInterval(showSol, 60000);

  const state = { visible: true, channels: {} };
  window.__missionControl = state;
  const charts = telemetry.channels().map((channel) => addCard(panel, telemetry, channel, state));

  onPress(TOGGLE_KEY, () => {
    state.visible = !state.visible;
    panel.classList.toggle('hidden', !state.visible);
    if (state.visible) charts.forEach((chart) => chart.draw()); // canvases have no size while hidden
  });
}

function addCard(panel, telemetry, channel, state) {
  const provider = telemetry.providerOf(channel);
  const card = document.createElement('section');
  card.className = 'mc-card';
  card.innerHTML = `
    <div class="mc-top"><span class="mc-name"></span><span class="mc-value">…</span></div>
    <canvas class="mc-chart"></canvas>
    <p class="mc-meaning">Waiting for signal…</p>
    <p class="mc-source"></p>`;
  panel.append(card);
  const [name, value, meaning, source] = ['.mc-name', '.mc-value', '.mc-meaning', '.mc-source'].map((s) => card.querySelector(s));
  name.textContent = channel.name;
  source.textContent = `Source: ${provider.name}`;
  const chart = createChart(card.querySelector('canvas'), channel);
  const entry = (state.channels[channel.key] = { name: channel.name, unit: channel.unit, provider: provider.name, value: null, points: 0, updatedAt: null });

  let points = [];
  function show() {
    const latest = points.at(-1);
    value.innerHTML = `${latest.value.toFixed(channel.decimals)}<small>${channel.unit}</small>`;
    meaning.textContent = channel.meaning(latest.value, points);
    Object.assign(entry, { value: latest.value, points: points.length, updatedAt: Date.now() });
  }

  telemetry
    .request(channel)
    .then((history) => {
      points = history;
      if (!points.length) throw new Error('no data');
      const live = !!provider.subscribe;
      if (live) name.insertAdjacentHTML('afterbegin', '<span class="mc-live" title="Live"></span>');
      else source.textContent += ` · up to sol ${Math.floor(points.at(-1).sol)}`;
      show();
      chart.setPoints(points);
      telemetry.subscribe(channel, (point) => {
        points[points.length - 1] = point; // the newest point slides forward in real time
        show();
        if (state.visible) chart.draw();
      });
    })
    .catch((error) => {
      value.textContent = '—';
      meaning.textContent = `No signal from ${provider.name}.`;
      console.error(`Mission control: could not load "${channel.name}": ${error.message}`);
    });

  return chart;
}
