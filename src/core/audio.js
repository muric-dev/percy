// Ambient sound generated with Web Audio: Martian wind + rover motors.
// Browsers only allow audio after a user gesture, so it is created on the first click/key press.
let ctx = null;
let motorGain, motorOsc, motorFilter;

function brownNoise(ctx, seconds = 4) {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }
  return buf;
}

function startAudio() {
  if (ctx) return;
  ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);

  // Wind: the Martian atmosphere is very thin, so sound arrives muffled and low-pitched
  const wind = ctx.createBufferSource();
  wind.buffer = brownNoise(ctx);
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
  motorOsc.connect(motorFilter).connect(motorGain).connect(master);
  motorOsc.start();
}

addEventListener('pointerdown', startAudio);
addEventListener('keydown', startAudio);

// effort: motor effort from 0 (stopped) to 1 (full power)
export function updateAudio(effort) {
  if (!ctx) return;
  const t = ctx.currentTime;
  motorGain.gain.setTargetAtTime(effort * 0.05, t, 0.1);
  motorOsc.frequency.setTargetAtTime(55 + effort * 70, t, 0.1);
  motorFilter.frequency.setTargetAtTime(300 + effort * 500, t, 0.1);
}
