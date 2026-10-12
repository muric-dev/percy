// Cinematic score generated live with Web Audio, laid over the real-sounding Martian ambience.
// A slow D minor progression on a wide string pad with a low drone, in a large reverb.
// It reacts to the game: driving fades in a pulsing low-string ostinato and deep drum hits on
// each bar (more power, more drive), and at night a high celesta sparkles under the stars.
// N toggles the music. Score, not diegetic sound: it skips the Martian air filters.
const BPM = 72;
const BEAT = 60 / BPM;
const BAR = 4 * BEAT;
const CHORD = 2 * BAR; // seconds per chord
const STEPS_PER_CHORD = (CHORD / BEAT) * 2; // eighth notes
const LOOKAHEAD = 0.4; // s: notes are scheduled this far ahead on the audio clock
const VOLUME = 0.7;
// i – VI – III – VII – i – VI – iv – V  (bass note, then pad voicing; MIDI numbers)
const PROGRESSION = [
  [38, [57, 62, 65]], // Dm
  [34, [53, 58, 62]], // B♭
  [41, [53, 57, 60]], // F
  [36, [52, 55, 60]], // C
  [38, [57, 62, 65]], // Dm
  [34, [53, 58, 62]], // B♭
  [43, [55, 58, 62]], // Gm
  [33, [52, 57, 61]], // A
];
// Ostinato in eighth notes, accented 3 + 3 + 2 like a film-score pulse (1 = accent)
const PULSE = [1, 0.45, 0.45, 1, 0.45, 0.45, 1, 0.45];

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

export function createMusic(ctx, destination) {
  const out = new GainNode(ctx, { gain: VOLUME });
  out.connect(destination);
  const reverb = new ConvolverNode(ctx, { buffer: impulseResponse(ctx, 4.5) });
  const wet = new GainNode(ctx, { gain: 0.9 });
  reverb.connect(wet).connect(out);
  // A bus per layer, with a dry and a reverb send
  const bus = (dry, send) => {
    const g = new GainNode(ctx, { gain: 1 });
    g.connect(new GainNode(ctx, { gain: dry })).connect(out);
    g.connect(new GainNode(ctx, { gain: send })).connect(reverb);
    return g;
  };
  const padTone = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 900, Q: 0.5 });
  padTone.connect(bus(0.5, 0.8));
  const drive = new GainNode(ctx, { gain: 0 }); // fades the driving layers in and out
  const ostinato = new GainNode(ctx, { gain: 1 });
  ostinato.connect(drive);
  drive.connect(bus(0.7, 0.4));
  const drums = new GainNode(ctx, { gain: 0 });
  drums.connect(bus(0.8, 0.35));
  const celesta = new GainNode(ctx, { gain: 0 });
  celesta.connect(bus(0.25, 1));
  const noise = noiseBuffer(ctx);

  let on = true, intensity = 0, night = 0, nextStep = 0, step = 0;

  function playChord([bass, voicing], start) {
    const end = start + CHORD;
    // String pad: two slightly detuned saws per note, slow swell and long overlap
    for (const note of voicing) for (const cents of [-7, 7]) voice('sawtooth', hz(note), cents, start, end, 2.5, 3, 0.05, padTone);
    // Low drone: the bass note and its octave
    voice('triangle', hz(bass), 0, start, end, 2, 3, 0.16, padTone);
    voice('sine', hz(bass + 12), 0, start, end, 2, 3, 0.07, padTone);
  }

  function voice(type, freq, detune, start, end, attack, release, peak, target) {
    const osc = new OscillatorNode(ctx, { type, frequency: freq, detune });
    const gain = new GainNode(ctx, { gain: 0 });
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    gain.gain.setValueAtTime(peak, end);
    gain.gain.linearRampToValueAtTime(0, end + release);
    osc.connect(gain).connect(target);
    osc.start(start);
    osc.stop(end + release + 0.1);
  }

  function pluck(freq, start, peak, target, decay = 0.22, type = 'sawtooth', cutoff = 1100) {
    const osc = new OscillatorNode(ctx, { type, frequency: freq });
    const filter = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: cutoff, Q: 1 });
    const gain = new GainNode(ctx, { gain: 0 });
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);
    osc.connect(filter).connect(gain).connect(target);
    osc.start(start);
    osc.stop(start + decay + 0.05);
  }

  // Deep cinematic drum: a falling sine body and a soft skin noise
  function boom(start, peak) {
    const osc = new OscillatorNode(ctx, { type: 'sine', frequency: 75 });
    osc.frequency.setValueAtTime(75, start);
    osc.frequency.exponentialRampToValueAtTime(38, start + 0.6);
    const gain = new GainNode(ctx, { gain: 0 });
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.4);
    osc.connect(gain).connect(drums);
    osc.start(start);
    osc.stop(start + 1.5);
    const skin = new AudioBufferSourceNode(ctx, { buffer: noise });
    const tone = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 260 });
    const skinGain = new GainNode(ctx, { gain: 0 });
    skinGain.gain.setValueAtTime(peak * 0.5, start);
    skinGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
    skin.connect(tone).connect(skinGain).connect(drums);
    skin.start(start);
    skin.stop(start + 0.3);
  }

  // One clock for everything: eighth-note steps; a new chord every STEPS_PER_CHORD steps.
  // Layers that are silent right now get no notes.
  function schedule() {
    const now = ctx.currentTime;
    if (nextStep < now) {
      // First call, or catching up after a pause: restart on the next chord
      nextStep = now + 0.05;
      step = Math.ceil(step / STEPS_PER_CHORD) * STEPS_PER_CHORD;
    }
    while (nextStep < now + LOOKAHEAD) {
      const chord = PROGRESSION[Math.floor(step / STEPS_PER_CHORD) % PROGRESSION.length];
      const [bass, voicing] = chord;
      const i = step % PULSE.length;
      if (step % STEPS_PER_CHORD === 0) playChord(chord, nextStep);
      if (intensity > 0.02) {
        pluck(hz(bass + 12), nextStep, 0.14 * PULSE[i], ostinato);
        if (i === 0) boom(nextStep, 0.5);
        if (step % 16 === 8) boom(nextStep + BEAT * 1.5, 0.3); // a pickup hit every other bar
      }
      // Night celesta: an occasional chord tone two octaves up
      if (night > 0.05 && Math.random() < 0.18) pluck(hz(voicing[Math.floor(Math.random() * voicing.length)] + 24), nextStep, 0.05, celesta, 2.2, 'sine', 6000);
      nextStep += BEAT / 2;
      step++;
    }
  }

  return {
    isOn: () => on,
    toggle() {
      on = !on;
      out.gain.setTargetAtTime(on ? VOLUME : 0, ctx.currentTime, 0.4);
    },
    // effort: how hard the rover drives (0–1); daylight: 0 at night, 1 in full day
    update(dt, effort, daylight) {
      // Swells in over ~2 s when you drive and lingers ~5 s after you stop
      const target = Math.min(1, effort * 2.5);
      intensity += (target - intensity) * Math.min(1, dt / (target > intensity ? 2 : 5));
      night = 1 - daylight;
      const t = ctx.currentTime;
      drive.gain.setTargetAtTime(intensity, t, 0.2);
      drums.gain.setTargetAtTime(Math.max(0, intensity - 0.2) * 1.25, t, 0.2);
      celesta.gain.setTargetAtTime(night * (1 - 0.6 * intensity), t, 1);
      padTone.frequency.setTargetAtTime(700 + 900 * intensity + 300 * daylight, t, 0.5);
      schedule();
    },
  };
}

// Stereo hall reverb: decaying noise, a little different in each ear
function impulseResponse(ctx, seconds) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  return buffer;
}

function noiseBuffer(ctx) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
