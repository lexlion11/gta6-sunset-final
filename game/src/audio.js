// Audio: every sound is generated at runtime with the Web Audio API — an engine hum from
// oscillators, gunshots from filtered noise bursts, sirens from sweeping tones, pickup
// chimes. No audio files, nothing loaded.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let lastShot = 0;

  function ensure() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (err) {
      ctx = null;
    }
    return ctx;
  }

  function resume() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume();
  }

  function noiseBurst(duration, gain, filterFreq) {
    const c = ensure();
    if (!c) return;
    const bufferSize = Math.floor(c.sampleRate * duration);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(c.destination);
    src.start();
  }

  function tone(freq, duration, type, gain, sweepTo) {
    const c = ensure();
    if (!c) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, c.currentTime + duration);
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(g);
    g.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration);
  }

  return {
    resume,
    gunshot(volume = 1) {
      const now = performance.now();
      if (now - lastShot < 45) return;
      lastShot = now;
      noiseBurst(0.12 * volume, 0.35 * volume, 2200);
      tone(180 * volume, 0.08, 'square', 0.12 * volume, 60);
    },
    whoosh() { noiseBurst(0.1, 0.08, 900); },
    chime() { tone(880, 0.12, 'sine', 0.18); setTimeout(() => tone(1320, 0.16, 'sine', 0.16), 90); },
    door() { noiseBurst(0.08, 0.12, 600); },
    siren() {
      const c = ensure();
      if (!c || sirenOsc) return;
      sirenOsc = c.createOscillator();
      sirenGain = c.createGain();
      sirenLfo = c.createOscillator();
      const lfoGain = c.createGain();
      sirenOsc.type = 'sawtooth';
      sirenOsc.frequency.value = 700;
      sirenLfo.frequency.value = 1.6;
      lfoGain.gain.value = 220;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenGain.gain.value = 0.05;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(c.destination);
      sirenOsc.start();
      sirenLfo.start();
    },
    stopSiren() {
      if (sirenOsc) { try { sirenOsc.stop(); sirenLfo.stop(); } catch (err) { /* already stopped */ } }
      sirenOsc = null;
      sirenLfo = null;
      sirenGain = null;
    },
    /** Engine hum follows the driven car's speed. */
    engine(speed, driving) {
      const c = ensure();
      if (!c) return;
      if (!driving) {
        if (engineOsc) {
          try { engineOsc.stop(); } catch (err) { /* stopped */ }
          engineOsc = null;
          engineGain = null;
        }
        return;
      }
      if (!engineOsc) {
        engineOsc = c.createOscillator();
        engineGain = c.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 60;
        engineGain.gain.value = 0.04;
        engineOsc.connect(engineGain);
        engineGain.connect(c.destination);
        engineOsc.start();
      }
      engineOsc.frequency.value = 55 + Math.abs(speed) * 0.35;
      engineGain.gain.value = 0.03 + Math.min(0.05, Math.abs(speed) / 4000);
    },
    explosion() { noiseBurst(0.5, 0.5, 800); tone(90, 0.4, 'square', 0.2, 30); },
    /** Two short honks when the player leans on the horn (H). */
    horn() {
      tone(440, 0.09, 'square', 0.16);
      setTimeout(() => tone(440, 0.09, 'square', 0.16), 130);
    },
  };
}
