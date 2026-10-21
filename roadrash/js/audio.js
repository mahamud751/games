'use strict';
/* ---------- Synthesized audio: sfx, engine, siren and a small music loop ---------- */
const Sound = (() => {
  let ac = null, master = null, sfxBus = null, musicBus = null;
  let muted = false, musicOn = true;
  try { muted = localStorage.getItem('rr_muted') === '1'; musicOn = localStorage.getItem('rr_music') !== '0'; } catch (e) { }
  let engine = null, siren = null, wind = null;
  let noiseBuf = null;

  function init() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ac.destination);
      sfxBus = ac.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
      musicBus = ac.createGain(); musicBus.gain.value = 0.22; musicBus.connect(master);
      const len = ac.sampleRate * 2;
      noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
  }

  function tone(freq, dur, type = 'square', vol = 0.3, slide = 0, delay = 0, bus = sfxBus) {
    if (!ac) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.4, cutoff = 1200, delay = 0, type = 'lowpass', bus = sfxBus) {
    if (!ac) return;
    const t = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = cutoff;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(bus);
    s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }

  const fx = {
    punch: () => { noise(0.12, 0.7, 700); tone(110, 0.12, 'sine', 0.5, 0.5); },
    whoosh: () => noise(0.14, 0.18, 2500, 0, 'bandpass'),
    club: () => { noise(0.1, 0.8, 1400); tone(180, 0.1, 'triangle', 0.4, 0.4); },
    chain: () => { [0, 0.04, 0.08].forEach(d => tone(2400 + Math.random() * 800, 0.05, 'square', 0.08, 0.7, d)); noise(0.12, 0.5, 3000); },
    crash: () => { noise(0.9, 0.9, 900); noise(0.4, 0.6, 3500, 0.05, 'highpass'); tone(70, 0.6, 'sawtooth', 0.35, 0.3); },
    bump: () => { noise(0.08, 0.4, 600); tone(90, 0.08, 'sine', 0.3); },
    horn: () => { tone(392, 0.4, 'sawtooth', 0.09); tone(494, 0.4, 'sawtooth', 0.07); },
    beep: () => tone(660, 0.18, 'square', 0.2),
    go: () => tone(1320, 0.5, 'square', 0.22),
    nitro: () => { noise(0.8, 0.5, 1800, 0, 'bandpass'); tone(200, 0.7, 'sawtooth', 0.15, 3); },
    ko: () => [0, 4, 7, 12].forEach((s, i) => tone(523 * Math.pow(2, s / 12), 0.12, 'square', 0.12, 1, i * 0.06)),
    cash: () => [0, 7, 12, 16].forEach((s, i) => tone(784 * Math.pow(2, s / 12), 0.1, 'triangle', 0.18, 1, i * 0.05)),
    click: () => tone(900, 0.04, 'square', 0.08),
    select: () => tone(1200, 0.06, 'triangle', 0.15, 1.3),
    bust: () => [0, 0.25, 0.5].forEach(d => { tone(880, 0.2, 'square', 0.15, 1, d); tone(660, 0.2, 'square', 0.15, 1, d + 0.12); }),
  };

  /* --- continuous engine --- */
  function engineStart() {
    if (!ac || engine) return;
    const o1 = ac.createOscillator(), o2 = ac.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'square';
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; f.Q.value = 4;
    const g = ac.createGain(); g.gain.value = 0;
    o1.connect(f); o2.connect(f); f.connect(g).connect(sfxBus);
    o1.start(); o2.start();
    const ws = ac.createBufferSource(); ws.buffer = noiseBuf; ws.loop = true;
    const wf = ac.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 800;
    const wg = ac.createGain(); wg.gain.value = 0;
    ws.connect(wf).connect(wg).connect(sfxBus); ws.start();
    engine = { o1, o2, f, g }; wind = { ws, wf, wg };
  }
  function engineSet(speedPct, throttle, nitro) {
    if (!engine) return;
    const t = ac.currentTime;
    // fake gearbox: rpm climbs through 5 gears
    const gears = 5, gp = Math.min(speedPct, 0.999) * gears, gear = Math.floor(gp);
    const rpm = 0.25 + (gp - gear) * 0.75 * (gear === 0 ? 1 : 0.8) + (gear === 0 ? 0 : 0.15);
    const base = 38 + rpm * 95 + gear * 6 + (nitro ? 25 : 0);
    engine.o1.frequency.setTargetAtTime(base, t, 0.05);
    engine.o2.frequency.setTargetAtTime(base * 0.5, t, 0.05);
    engine.f.frequency.setTargetAtTime(350 + rpm * 900 + (throttle ? 500 : 0), t, 0.08);
    engine.g.gain.setTargetAtTime(0.06 + (throttle ? 0.07 : 0.025), t, 0.1);
    wind.wg.gain.setTargetAtTime(speedPct * speedPct * 0.12, t, 0.2);
    wind.wf.frequency.setTargetAtTime(500 + speedPct * 1500, t, 0.2);
  }
  function engineStop() {
    if (!engine) return;
    const t = ac.currentTime;
    engine.g.gain.setTargetAtTime(0, t, 0.05); wind.wg.gain.setTargetAtTime(0, t, 0.05);
    const e = engine, w = wind;
    setTimeout(() => { try { e.o1.stop(); e.o2.stop(); w.ws.stop(); } catch (er) { } }, 300);
    engine = null; wind = null;
  }

  /* --- police siren, volume by proximity (0..1) --- */
  function sirenSet(v) {
    if (!ac) return;
    if (!siren && v > 0.01) {
      const o = ac.createOscillator(); o.type = 'triangle';
      const lfo = ac.createOscillator(); lfo.frequency.value = 1.6;
      const lg = ac.createGain(); lg.gain.value = 220;
      lfo.connect(lg).connect(o.frequency); o.frequency.value = 760;
      const g = ac.createGain(); g.gain.value = 0;
      o.connect(g).connect(sfxBus); o.start(); lfo.start();
      siren = { o, lfo, g };
    }
    if (siren) siren.g.gain.setTargetAtTime(v * 0.06, ac.currentTime, 0.1);
    if (siren && v <= 0.01) {
      const s = siren; siren = null;
      s.g.gain.setTargetAtTime(0, ac.currentTime, 0.05);
      setTimeout(() => { try { s.o.stop(); s.lfo.stop(); } catch (e) { } }, 300);
    }
  }

  /* --- music: driving synth-rock loop --- */
  const Music = (() => {
    let timer = null, step = 0, next = 0;
    const bpm = 132, sixteenth = 60 / bpm / 4;
    const roots = [40, 40, 43, 38];   // E E G D (midi)
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    function kick(t) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g).connect(musicBus); o.start(t); o.stop(t + 0.2);
    }
    function hit(t, dur, vol, cut, type) {
      const s = ac.createBufferSource(); s.buffer = noiseBuf;
      const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = cut;
      const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      s.connect(f).connect(g).connect(musicBus); s.start(t, Math.random()); s.stop(t + dur);
    }
    function note(t, m, dur, type, vol, cut) {
      const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
      o.type = type; o.frequency.value = mtof(m);
      f.type = 'lowpass'; f.frequency.setValueAtTime(cut, t); f.frequency.exponentialRampToValueAtTime(cut * 0.3, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(f).connect(g).connect(musicBus); o.start(t); o.stop(t + dur + 0.02);
    }
    const lead = [0, null, 7, null, 12, null, 10, 7, null, 7, 5, null, 3, null, 5, null];
    function schedule() {
      while (next < ac.currentTime + 0.12) {
        const s = step % 16, bar = Math.floor(step / 16) % 4, root = roots[bar];
        if (s % 4 === 0) kick(next);
        if (s === 4 || s === 12) hit(next, 0.16, 0.5, 1800, 'bandpass');
        if (s % 2 === 0) hit(next, 0.04, 0.18, 7000, 'highpass');
        note(next, root + (s % 4 === 2 ? 12 : 0), sixteenth * 0.9, 'sawtooth', 0.32, 900);
        const phrase = Math.floor(step / 64) % 2;
        if (phrase === 1 && lead[s] != null) note(next, root + 24 + lead[s], sixteenth * 1.8, 'square', 0.07, 3000);
        next += sixteenth; step++;
      }
    }
    return {
      start() { if (!ac || timer) return; step = 0; next = ac.currentTime + 0.05; timer = setInterval(schedule, 40); },
      stop() { clearInterval(timer); timer = null; },
      get playing() { return !!timer; },
    };
  })();

  return {
    init, fx: new Proxy(fx, { get: (o, k) => (...a) => { if (ac && !muted) o[k](...a); } }),
    engineStart, engineSet, engineStop, sirenSet,
    musicStart() { if (musicOn) Music.start(); }, musicStop: () => Music.stop(),
    get muted() { return muted; },
    get music() { return musicOn; },
    toggleMute() {
      muted = !muted;
      try { localStorage.setItem('rr_muted', muted ? '1' : '0'); } catch (e) { }
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.5, ac.currentTime, 0.02);
      return muted;
    },
    toggleMusic() {
      musicOn = !musicOn;
      try { localStorage.setItem('rr_music', musicOn ? '1' : '0'); } catch (e) { }
      if (!musicOn) Music.stop();
      return musicOn;
    },
  };
})();
