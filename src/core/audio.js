// Sonido ambiente generado con Web Audio: viento marciano + motores del rover.
// Los navegadores solo permiten audio tras un gesto del usuario, así que se crea al primer clic/tecla.
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

  // Viento: en Marte la atmósfera es muy fina y el sonido llega apagado y grave
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

  // Ráfagas: osciladores lentos que modulan volumen y tono del viento
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

  // Motores de las ruedas: zumbido eléctrico que sube con la velocidad
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

// effort: esfuerzo de los motores de 0 (parado) a 1 (a tope)
export function updateAudio(effort) {
  if (!ctx) return;
  const t = ctx.currentTime;
  motorGain.gain.setTargetAtTime(effort * 0.05, t, 0.1);
  motorOsc.frequency.setTargetAtTime(55 + effort * 70, t, 0.1);
  motorFilter.frequency.setTargetAtTime(300 + effort * 500, t, 0.1);
}
