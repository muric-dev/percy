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
    tone({ type: 'sawtooth', from: 110, to: 260, attack: 0.15, decay: 0.7, peak: 0.12, filterFreq: 900 });
    noiseBurst({ freq: 900, to: 1400, q: 1.2, attack: 0.05, decay: 0.35, peak: 0.12, delay: 0.05 });
  },
  // Brakes clamp (clunk), pressure is released (hiss) and the pump winds down
  brake() {
    tone({ from: 160, to: 70, attack: 0.005, decay: 0.2, peak: 0.45, filterFreq: 600 });
    noiseBurst({ type: 'highpass', freq: 900, decay: 0.04, peak: 0.3 }); // metallic contact
    noiseBurst({ freq: 1300, to: 450, q: 0.9, attack: 0.02, decay: 0.9, peak: 0.22, delay: 0.04 });
    tone({ type: 'sawtooth', from: 180, to: 55, attack: 0.02, decay: 0.6, peak: 0.08, filterFreq: 500 });
  },
};

function createAudioGraph() {
  ctx = new AudioContext();
  buffers.white = noiseBuffer('white');
  buffers.brown = noiseBuffer('brown');

  // Master: a compressor evens out the levels so quiet layers stay audible
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.ratio.value = 4;
  compressor.connect(ctx.destination);
  // Cut infrasound that no speaker can play
  const infrasound = ctx.createBiquadFilter();
  infrasound.type = 'highpass';
  infrasound.frequency.value = 35;
  infrasound.connect(compressor);
  const master = ctx.createGain();
  master.gain.value = 1.4;
  master.connect(infrasound);

  roverBus = ctx.createBiquadFilter();
  roverBus.type = 'lowpass';
  roverBus.frequency.value = MARS_AIR_CUTOFF;
  roverBus.connect(master);

  // Wind, two layers: a deep rumble (felt on headphones) and a soft mid-range whoosh
  // that laptop speakers can play — that whoosh is what the rover's microphones picked up.
  const windGain = ctx.createGain();
  windGain.gain.value = 0.5;
  windGain.connect(master);
  const rumble = ctx.createBiquadFilter();
  rumble.type = 'lowpass';
  rumble.frequency.value = 380;
  rumble.Q.value = 1.5;
  const whoosh = ctx.createBiquadFilter();
  whoosh.type = 'bandpass';
  whoosh.frequency.value = 700;
  whoosh.Q.value = 0.7;
  const whooshGain = ctx.createGain();
  whooshGain.gain.value = 2; // band-passed white noise keeps only ~4% of its power
  loopNoise('brown').connect(rumble).connect(windGain);
  loopNoise('white').connect(whoosh).connect(whooshGain).connect(windGain);

  // Gusts: slow oscillators that modulate the wind's volume and pitch
  lfo(0.11, 0.3, windGain.gain);
  lfo(0.07, 180, rumble.frequency);
  lfo(0.05, 280, whoosh.frequency);

  // Wheel motors: electric whine that rises with speed
  motorOsc = ctx.createOscillator();
  motorOsc.type = 'sawtooth';
  motorOsc.frequency.value = 110;
  motorFilter = ctx.createBiquadFilter();
  motorFilter.type = 'lowpass';
  motorFilter.frequency.value = 600;
  motorGain = ctx.createGain();
  motorGain.gain.value = 0;
  motorOsc.connect(motorFilter).connect(motorGain).connect(roverBus);
  motorOsc.start();
}

function loopNoise(kind) {
  const src = ctx.createBufferSource();
  src.buffer = buffers[kind];
  src.loop = true;
  src.start();
  return src;
}

// Low-frequency oscillator that wobbles an audio parameter
function lfo(frequency, depth, param) {
  const osc = ctx.createOscillator();
  osc.frequency.value = frequency;
  const gain = ctx.createGain();
  gain.gain.value = depth;
  osc.connect(gain).connect(param);
  osc.start();
}

// Browsers differ on which gestures may start audio (Safari ignores pointerdown), so every
// gesture tries, and a context that was created suspended or got interrupted is resumed —
// unless the user switched the sound off.
let wanted = true;
function startAudio() {
  if (!wanted) return;
  if (!ctx) createAudioGraph();
  if (ctx.state !== 'running') ctx.resume();
}
['pointerdown', 'pointerup', 'click', 'touchend', 'keydown'].forEach((type) => addEventListener(type, startAudio));

export const isAudioOn = () => wanted && ctx?.state === 'running';

// Sound on/off switch: off suspends all audio processing; on resumes it (or starts it)
export function toggleSound() {
  wanted = !isAudioOn();
  if (wanted) startAudio();
  else ctx?.suspend();
}

// effort: motor effort from 0 (stopped) to 1 (full power); event: 'accelerate' | 'brake' | null
export function updateAudio(effort, event) {
  if (!isAudioOn()) return;
  const t = ctx.currentTime;
  motorGain.gain.setTargetAtTime(effort * 0.16, t, 0.1);
  motorOsc.frequency.setTargetAtTime(110 + effort * 150, t, 0.1);
  motorFilter.frequency.setTargetAtTime(600 + effort * 1400, t, 0.1);
  if (event) HYDRAULICS[event]();
}
