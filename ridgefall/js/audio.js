'use strict';
/* Soft engine, wind, and a short downhill score. All synthesized. */

const Sound = (() => {
  let ac = null, master = null, sfxBus = null, musicBus = null;
  let muted = false, musicOn = true;
  try {
    muted = localStorage.getItem('rf_muted') === '1';
    musicOn = localStorage.getItem('rf_music') !== '0';
  } catch (e) { /* private mode */ }
  let engine = null, noiseBuf = null;

  function init() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(ac.destination);
      sfxBus = ac.createGain();
      sfxBus.gain.value = 0.9;
      sfxBus.connect(master);
      musicBus = ac.createGain();
      musicBus.gain.value = musicOn ? 0.22 : 0;
      musicBus.connect(master);
      const len = ac.sampleRate * 2;
      noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
  }

  function tone(freq, dur, type, vol, slide, delay, bus) {
    if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(Math.max(20, freq), t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(bus || sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, cutoff, delay, type, bus) {
    if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    const s = ac.createBufferSource();
    s.buffer = noiseBuf;
    const f = ac.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.value = cutoff;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(bus || sfxBus);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.02);
  }

  const fx = {
    click: () => tone(880, 0.04, 'square', 0.05),
    select: () => { tone(660, 0.07, 'triangle', 0.08, 1.4); },
    beep: () => tone(740, 0.14, 'square', 0.08),
    go: () => { tone(520, 0.12, 'square', 0.1); tone(780, 0.18, 'square', 0.1, 1, 0.1); },
    jump: () => { noise(0.16, 0.18, 1800, 0, 'bandpass'); tone(220, 0.12, 'sine', 0.08, 1.8); },
    land: () => { noise(0.12, 0.28, 500); tone(90, 0.1, 'sine', 0.12, 0.6); },
    crash: () => { noise(0.55, 0.55, 900); noise(0.3, 0.3, 2800, 0.02, 'highpass'); tone(70, 0.4, 'sawtooth', 0.12, 0.4); },
    gem: () => { tone(880, 0.08, 'sine', 0.1, 1.2); tone(1320, 0.12, 'triangle', 0.08, 1, 0.06); },
    stunt: () => [0, 4, 7].forEach((s, i) => tone(523 * Math.pow(2, s / 12), 0.1, 'triangle', 0.08, 1, i * 0.05)),
    nitro: () => { noise(0.45, 0.22, 1600, 0, 'bandpass'); tone(180, 0.35, 'sawtooth', 0.06, 2.2); },
    chute: () => noise(0.25, 0.16, 900, 0, 'bandpass'),
    finish: () => [0, 4, 7, 12].forEach((s, i) => tone(523 * Math.pow(2, s / 12), 0.16, 'triangle', 0.1, 1, i * 0.07)),
    buy: () => [0, 7, 12].forEach((s, i) => tone(660 * Math.pow(2, s / 12), 0.1, 'square', 0.06, 1, i * 0.06)),
    wipe: () => { tone(200, 0.2, 'sawtooth', 0.08, 0.4); noise(0.2, 0.2, 400); },
  };

  function engineStart() {
    if (!ac || engine) return;
    const o1 = ac.createOscillator();
    const o2 = ac.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'square';
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    f.Q.value = 3;
    const g = ac.createGain();
    g.gain.value = 0;
    o1.connect(f);
    o2.connect(f);
    f.connect(g).connect(sfxBus);
    o1.start();
    o2.start();
    const ws = ac.createBufferSource();
    ws.buffer = noiseBuf;
    ws.loop = true;
    const wf = ac.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 700;
    const wg = ac.createGain();
    wg.gain.value = 0;
    ws.connect(wf).connect(wg).connect(sfxBus);
    ws.start();
    engine = { o1, o2, f, g, wg, wf };
  }

  function engineSet(speed, throttle, nitro, on) {
    if (!ac) return;
    if (on && !engine) engineStart();
    if (!engine) return;
    const t = ac.currentTime;
    const sp = Math.max(0, speed);
    const pct = Math.min(1, sp / 1100);
    const gears = 4;
    const gp = pct * gears;
    const gear = Math.min(gears - 1, Math.floor(gp));
    const rpm = (gp - gear);
    const base = 42 + rpm * 70 + gear * 18 + (nitro ? 22 : 0);
    engine.o1.frequency.setTargetAtTime(base, t, 0.05);
    engine.o2.frequency.setTargetAtTime(base * 0.5, t, 0.05);
    engine.f.frequency.setTargetAtTime(280 + rpm * 700 + (throttle ? 380 : 0) + (nitro ? 500 : 0), t, 0.08);
    const vol = on ? 0.035 + (throttle ? 0.05 : 0.02) + pct * 0.03 : 0;
    engine.g.gain.setTargetAtTime(vol, t, 0.08);
    engine.wg.gain.setTargetAtTime(on ? pct * pct * 0.1 : 0, t, 0.15);
    engine.wf.frequency.setTargetAtTime(500 + pct * 1400, t, 0.2);
  }

  const Music = (() => {
    let timer = null, step = 0, next = 0;
    const bpm = 92;
    const eighth = 60 / bpm / 2;
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    function note(t, m, dur, type, vol, cut) {
      const o = ac.createOscillator();
      const f = ac.createBiquadFilter();
      const g = ac.createGain();
      o.type = type;
      o.frequency.value = mtof(m);
      f.type = 'lowpass';
      f.frequency.setValueAtTime(cut, t);
      f.frequency.exponentialRampToValueAtTime(Math.max(80, cut * 0.45), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(f).connect(g).connect(musicBus);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
    function hat(t) {
      const s = ac.createBufferSource();
      s.buffer = noiseBuf;
      const f = ac.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 7000;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      s.connect(f).connect(g).connect(musicBus);
      s.start(t, Math.random());
      s.stop(t + 0.05);
    }
    /* D major pentatonic, two bars, kept quiet under the engine. */
    const lead = [0, 2, 4, 7, 4, 2, 7, 4, 9, 7, 4, 2, 4, 0, 2, 4];
    const deg = [0, 2, 4, 7, 9];
    function schedule() {
      if (!ac) return;
      while (next < ac.currentTime + 0.16) {
        const s = step % 16;
        const root = 62; /* D4 */
        if (s % 4 === 0) note(next, 50, eighth * 1.6, 'sine', 0.16, 400);
        if (s % 2 === 0) hat(next);
        note(next, root + deg[lead[s] % 5], eighth * 0.9, 'triangle', 0.05, 1800);
        next += eighth;
        step++;
      }
    }
    return {
      start() {
        if (!ac || timer || !musicOn) return;
        step = 0;
        next = ac.currentTime + 0.08;
        timer = setInterval(schedule, 50);
      },
      stop() { clearInterval(timer); timer = null; },
    };
  })();

  return {
    init,
    fx: new Proxy(fx, { get: (o, k) => (...a) => { if (ac && !muted) o[k](...a); } }),
    engineSet,
    musicStart() { if (musicOn) Music.start(); },
    musicStop() { Music.stop(); },
    setMusicGain(on) { if (musicBus && ac) musicBus.gain.setTargetAtTime(on ? 0.22 : 0, ac.currentTime, 0.03); },
    get muted() { return muted; },
    get music() { return musicOn; },
    toggleMute() {
      init();
      muted = !muted;
      try { localStorage.setItem('rf_muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
      if (master && ac) master.gain.setTargetAtTime(muted ? 0 : 0.55, ac.currentTime, 0.02);
      return muted;
    },
    toggleMusic() {
      init();
      musicOn = !musicOn;
      try { localStorage.setItem('rf_music', musicOn ? '1' : '0'); } catch (e) { /* ignore */ }
      this.setMusicGain(musicOn);
      if (musicOn) Music.start();
      else Music.stop();
      return musicOn;
    },
  };
})();
