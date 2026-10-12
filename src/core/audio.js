// Ambient sound generated with Web Audio: Martian wind, rover motors and hydraulics.
// Browsers only allow audio after a user gesture, so it is created on the first click/key press.
//
// Mars' thin CO2 atmosphere (~0.6% of Earth's pressure) makes everything quieter and absorbs
// high frequencies much more strongly, as Perseverance's microphones recorded. All rover sounds
// go through a low-pass "Martian air" filter and are kept low in volume.
const MARS_AIR_CUTOFF = 1800; // Hz
let ctx = null;
let roverBus, motorGain, motorOsc, motorFilter;
const buffers = {};

function noiseBuffer(kind, seconds = 4) {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    if (kind === 'white') data[i] = white;
    else data[i] = (last = (last + 0.02 * white) / 1.02) * 3.5; // brown: deep rumble
  }
  return buf;
}

// Attack/decay envelope on a gain node
function envelope(gain, start, attack, decay, peak) {
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
}

// Short filtered noise burst (hiss, click), optionally sweeping the filter frequency
function noiseBurst({ type = 'bandpass', freq, to = freq, q = 1, attack = 0.01, decay, peak, delay = 0 }) {
  const start = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = buffers.white;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, start);
  filter.frequency.exponentialRampToValueAtTime(to, start + attack + decay);
  const gain = ctx.createGain();
  envelope(gain, start, attack, decay, peak);
  src.connect(filter).connect(gain).connect(roverBus);
  src.start(start, Math.random() * 3);
  src.stop(start + attack + decay + 0.05);
}

// Pitched tone with a frequency glide (pump whine, mechanical clunk)
function tone({ type = 'sine', from, to, attack = 0.02, decay, peak, filterFreq = 800, delay = 0 }) {
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + attack + decay);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  envelope(gain, start, attack, decay, peak);
  osc.connect(filter).connect(gain).connect(roverBus);
  osc.start(start);
  osc.stop(start + attack + decay + 0.05);
}

const HYDRAULICS = {
  // Valve opens, the pump spins up and pressurizes the drive actuators
  accelerate() {
    noiseBurst({ type: 'highpass', freq: 1200, decay: 0.03, peak: 0.25 }); // valve click
    tone({ type: 'sawtooth', from: 70, to: 190, attack: 0.15, decay: 0.7, peak: 0.12, filterFreq: 600 });
    noiseBurst({ freq: 900, to: 1400, q: 1.2, attack: 0.05, decay: 0.35, peak: 0.12, delay: 0.05 });
  },
  // Brakes clamp (clunk), pressure is released (hiss) and the pump winds down
  brake() {
    tone({ from: 70, to: 40, attack: 0.005, decay: 0.2, peak: 0.45, filterFreq: 300 });
    noiseBurst({ freq: 1300, to: 450, q: 0.9, attack: 0.02, decay: 0.9, peak: 0.22, delay: 0.04 });
    tone({ type: 'sawtooth', from: 180, to: 55, attack: 0.02, decay: 0.6, peak: 0.08, filterFreq: 500 });
  },
};

function startAudio() {
  if (ctx) return;
  ctx = new AudioContext();
  buffers.white = noiseBuffer('white');
  buffers.brown = noiseBuffer('brown');

  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);

  roverBus = ctx.createBiquadFilter();
  roverBus.type = 'lowpass';
  roverBus.frequency.value = MARS_AIR_CUTOFF;
  roverBus.connect(master);

  // Wind: deep, muffled rumble
  const wind = ctx.createBufferSource();
  wind.buffer = buffers.brown;
  wind.loop = true;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 380;
  lowpass.Q.value = 1.5;
  const windGain = ctx.createGain();
  windGain.gain.value = 0.5;
  wind.connect(lowpass).connect(windGain).connect(master);
  wind.start();

  // Gusts: slow oscillators that modulate the wind's volume and pitch
  const gust = ctx.createOscillator();
  gust.frequency.value = 0.11;
  const gustDepth = ctx.createGain();
  gustDepth.gain.value = 0.3;
  gust.connect(gustDepth).connect(windGain.gain);
  gust.start();
  const whistle = ctx.createOscillator();
  whistle.frequency.value = 0.07;
  const whistleDepth = ctx.createGain();
  whistleDepth.gain.value = 180;
  whistle.connect(whistleDepth).connect(lowpass.frequency);
  whistle.start();

  // Wheel motors: electric hum that rises with speed
  motorOsc = ctx.createOscillator();
  motorOsc.type = 'sawtooth';
  motorOsc.frequency.value = 60;
  motorFilter = ctx.createBiquadFilter();
  motorFilter.type = 'lowpass';
  motorFilter.frequency.value = 400;
  motorGain = ctx.createGain();
  motorGain.gain.value = 0;
  motorOsc.connect(motorFilter).connect(motorGain).connect(roverBus);
  motorOsc.start();
}

addEventListener('pointerdown', startAudio);
addEventListener('keydown', startAudio);

// effort: motor effort from 0 (stopped) to 1 (full power); event: 'accelerate' | 'brake' | null
export function updateAudio(effort, event) {
  if (!ctx) return;
  const t = ctx.currentTime;
  motorGain.gain.setTargetAtTime(effort * 0.05, t, 0.1);
  motorOsc.frequency.setTargetAtTime(55 + effort * 70, t, 0.1);
  motorFilter.frequency.setTargetAtTime(300 + effort * 500, t, 0.1);
  if (event) HYDRAULICS[event]();
}
