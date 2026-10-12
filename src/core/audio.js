import { createMusic } from './music.js';

// Ambient sound generated with Web Audio, tuned to what Perseverance's microphones measured
// (Maurice et al. 2022, "In situ recording of Mars soundscape", Nature 605, 653–658, and
// NASA's Sol 16 drive recorded by the EDL microphone). The listener is the camera.
// - Wind is turbulence: on calm days it only reaches ~100 Hz, typically ~300 Hz, and falls very
//   steeply above that (spectral slope about f^-4.9). Daytime convection makes it gusty; at night
//   the stable air almost silences it, and turbulence vanishes at dusk.
// - Mars' thin CO2 air (0.6 kPa) makes the same source ~20 dB weaker than on Earth and absorbs
//   high pitches: amplitude falls as e^(-αr) on top of 1/r, with α = 0.21 /m at 3–6 kHz and
//   0.34 /m at 6–11 kHz (an 8 kHz tone loses 40 dB in 8 m; on Earth, 20 dB).
// - Sound travels at ~240 m/s, so the rover is heard slightly late from far away.
// - Driving sounds like the bangs, pings and rattles of the aluminum wheels on rocks.
// - The rover is electric: each wheel has its own geared electric actuator (the four corner
//   wheels also have steering actuators) and brakes hold the wheels when it stops. NASA has not
//   published the motor type, so this is a generic gearmotor: a whine that follows the motor
//   speed plus the higher gear-mesh tone, six of them slightly out of step.
// Browsers only allow audio after a user gesture, so it is created on the first click/key press.
// Everything that reacts to driving or gusts moves half as much as it used to (SWING) so the
// soundscape stays calm.
const SWING = 0.5;
const MASTER_VOLUME = 0.7; // half the old level: about -10 dB, which sounds half as loud
const SPEED_OF_SOUND = 240; // m/s, below 240 Hz
const ALPHA_MID = 0.21, ALPHA_HIGH = 0.34; // attenuation, 1/m (3–6 kHz and 6–11 kHz)
const NEPER_DB = 8.686; // dB per neper
const REF_DISTANCE = 8; // m: rover sounds are mixed for the usual chase-camera distance
const MIN_DISTANCE = 2.5; // m: never louder than from the mast (sky view)
// Wind: corner frequency of the turbulence noise, calm night → convective day
const WIND_CORNER = { calm: 70, day: 260 }; // Hz
const NIGHT_TURBULENCE = 0.15; // fraction of the daytime wind level left at night
const GUST_TIME = 6; // s: how long a gust takes to build or fade
const GUST_DEPTH = 0.6 * SWING; // ± fraction of the wind level

let ctx = null;
let roverBus, motorGain, motorFilter, motors, gearTone, music;
let air; // propagation from the rover to the camera: delay, distance gain and absorption
let wind; // filters and gain of the turbulence noise
let gust = 0, clankDebt = 0, wasSteering = false;
const buffers = {};

function noiseBuffer(seconds = 4) {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// Attack/decay envelope on a gain node
function envelope(gain, start, attack, decay, peak) {
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
}

// Short filtered noise burst (hiss, click, ping), optionally sweeping the filter frequency
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

// Electric drive: one geared motor per wheel, each a few cents off the others so they beat
// together. Pitch follows speed (half as much as before, SWING); the gear-mesh tone sits above.
const MOTOR = { idle: 140, range: 260, gearMesh: 3.6, detune: [-22, -9, -3, 4, 11, 19] }; // Hz, Hz, ×, cents
const WHINE = [0, 1, 0.55, 0.3, 0.18, 0.1, 0.06]; // harmonic amplitudes of the motor whine

const BRAKES = {
  // The wheel brakes release with a small solenoid tick before the motors spin up
  accelerate() {
    noiseBurst({ type: 'highpass', freq: 2500, decay: 0.015, peak: 0.1 });
    tone({ from: 320, to: 240, attack: 0.002, decay: 0.05, peak: 0.05, filterFreq: 1200 });
  },
  // The brakes clamp: a firmer tick and the gear train settling with a soft clunk
  brake() {
    noiseBurst({ type: 'highpass', freq: 2200, decay: 0.02, peak: 0.14 });
    tone({ from: 150, to: 95, attack: 0.004, decay: 0.15, peak: 0.12, filterFreq: 500, delay: 0.02 });
  },
};

// The four corner steering actuators turning the wheels: a short, higher whir
function steeringWhir() {
  for (const cents of [-12, 12]) tone({ type: 'triangle', from: 380, to: 470, attack: 0.05, decay: 0.35, peak: 0.035, filterFreq: 1500, delay: cents > 0 ? 0.03 : 0 });
}

// One wheel meeting a rock: a dull thud from the suspension and a short ring of the aluminum rim
function wheelClank() {
  const size = 0.5 + Math.random() * 0.5;
  tone({ from: 95 + Math.random() * 30, to: 55, attack: 0.003, decay: 0.12, peak: 0.12 * size, filterFreq: 400 });
  noiseBurst({ freq: 1800 + Math.random() * 1600, q: 9, attack: 0.002, decay: 0.08 + 0.1 * size, peak: 0.18 * size });
}

function createAudioGraph() {
  ctx = new AudioContext();
  buffers.white = noiseBuffer();

  // Master: a gentle compressor that only catches peaks, below a quiet master level
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.ratio.value = 3;
  compressor.connect(ctx.destination);
  // The microphones' response starts at 20 Hz; cut what no speaker can play
  const infrasound = ctx.createBiquadFilter();
  infrasound.type = 'highpass';
  infrasound.frequency.value = 25;
  infrasound.connect(compressor);
  const master = ctx.createGain();
  master.gain.value = MASTER_VOLUME;
  master.connect(infrasound);

  // Rover → camera: travel delay, spreading loss and Martian air absorption (two high shelves)
  air = {
    delay: new DelayNode(ctx, { maxDelayTime: 1 }),
    distance: new GainNode(ctx),
    mid: new BiquadFilterNode(ctx, { type: 'highshelf', frequency: 2000 }),
    high: new BiquadFilterNode(ctx, { type: 'highshelf', frequency: 6000 }),
  };
  roverBus = ctx.createGain();
  roverBus.connect(air.delay).connect(air.distance).connect(air.mid).connect(air.high).connect(master);

  // Wind: white noise through a steep low-pass (12 dB/octave) and a gentle one (6 dB/octave),
  // which together fall about as steeply as the measured f^-4.9 turbulence spectrum
  wind = {
    steep: new BiquadFilterNode(ctx, { type: 'lowpass', frequency: WIND_CORNER.day, Q: 0.7 }),
    gentle: onePoleLowpass(WIND_CORNER.day * 2),
    gain: new GainNode(ctx, { gain: 0 }),
  };
  loopNoise().connect(wind.steep).connect(wind.gentle).connect(wind.gain).connect(master);

  // Wheel motors: six geared electric motors and their gear-mesh tone
  motorFilter = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 1200 });
  motorGain = new GainNode(ctx, { gain: 0 });
  motorFilter.connect(motorGain).connect(roverBus);
  const whine = ctx.createPeriodicWave(new Float32Array(WHINE.length), new Float32Array(WHINE));
  motors = MOTOR.detune.map((detune) => {
    const osc = new OscillatorNode(ctx, { frequency: MOTOR.idle, detune });
    osc.setPeriodicWave(whine);
    osc.connect(motorFilter);
    osc.start();
    return osc;
  });
  gearTone = new OscillatorNode(ctx, { frequency: MOTOR.idle * MOTOR.gearMesh });
  gearTone.connect(new GainNode(ctx, { gain: 0.6 })).connect(motorFilter);
  gearTone.start();

  music = createMusic(ctx, master);
}

// First-order low-pass as an IIR filter (Web Audio's biquads are all second order)
function onePoleLowpass(cutoff) {
  const a = Math.exp((-2 * Math.PI * cutoff) / ctx.sampleRate);
  return new IIRFilterNode(ctx, { feedforward: [1 - a], feedback: [1, -a] });
}

function loopNoise() {
  const src = new AudioBufferSourceNode(ctx, { buffer: buffers.white, loop: true });
  src.start();
  return src;
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
export const isMusicOn = () => music?.isOn() ?? true;
export const toggleMusic = () => music?.toggle();

// Sound on/off switch: off suspends all audio processing; on resumes it (or starts it)
export function toggleSound() {
  wanted = !isAudioOn();
  if (wanted) startAudio();
  else ctx?.suspend();
}

// drive: { effort 0–1, speed m/s, yawRate rad/s, event 'accelerate' | 'brake' | null }
// distance: camera to rover (m); daylight: 0 at night, 1 in full day
export function updateAudio(dt, { effort, speed, yawRate, event }, { distance, daylight }) {
  if (!isAudioOn()) return;
  const t = ctx.currentTime;

  // Propagation from the rover to the camera
  const r = Math.max(distance, MIN_DISTANCE);
  air.delay.delayTime.setTargetAtTime(r / SPEED_OF_SOUND, t, 0.2);
  air.distance.gain.setTargetAtTime(REF_DISTANCE / r, t, 0.1);
  air.mid.gain.setTargetAtTime(-NEPER_DB * ALPHA_MID * r, t, 0.1);
  air.high.gain.setTargetAtTime(-NEPER_DB * (ALPHA_HIGH - ALPHA_MID) * r, t, 0.1);

  // Wind: daytime convection, calm nights, and slow random gusts (a smoothed random walk)
  gust += (Math.random() * 2 - 1) * Math.sqrt(dt / GUST_TIME) - gust * (dt / GUST_TIME);
  const g = Math.max(-1, Math.min(1, gust * 2));
  const turbulence = NIGHT_TURBULENCE + (1 - NIGHT_TURBULENCE) * daylight;
  const corner = WIND_CORNER.calm + (WIND_CORNER.day - WIND_CORNER.calm) * turbulence * (1 + 0.5 * SWING * g);
  wind.gain.gain.setTargetAtTime(1.1 * turbulence * (1 + GUST_DEPTH * g), t, 0.3);
  wind.steep.frequency.setTargetAtTime(corner, t, 0.3);

  // Motors and wheels
  // Motors spin up and down with some inertia: the pitch glides while the volume follows
  const motorHz = MOTOR.idle + effort * MOTOR.range * SWING;
  motors.forEach((osc) => osc.frequency.setTargetAtTime(motorHz, t, 0.4));
  gearTone.frequency.setTargetAtTime(motorHz * MOTOR.gearMesh, t, 0.4);
  motorGain.gain.setTargetAtTime(effort * 0.035, t, 0.3);
  const steering = yawRate !== 0;
  if (steering !== wasSteering) steeringWhir();
  wasSteering = steering;
  clankDebt += Math.abs(speed) * 0.6 * dt * Math.random() * 2; // about one rock every 1.7 m
  if (clankDebt > 1) {
    clankDebt = 0;
    wheelClank();
  }
  if (event) BRAKES[event]();

  music.update(dt, effort, daylight);
}
