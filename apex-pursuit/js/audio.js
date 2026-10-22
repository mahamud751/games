// Web Audio: engine note, tyres, wind, siren, one-shots and a small driving loop.
let ac = null, master, sfxBus, musicBus, noiseBuf;
let sfxOn = true, musicOn = true;
try {
  sfxOn = localStorage.getItem('apex.sfx') !== '0';
  musicOn = localStorage.getItem('apex.music') !== '0';
} catch (e) {}
let eng = null, siren = null, music = null;

function ensure() {
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return false; }
    master = ac.createGain(); master.gain.value = 0.6; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = sfxOn ? 1 : 0; sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = musicOn ? 0.32 : 0; musicBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume();
  return true;
}

function noiseSrc() {
  const s = ac.createBufferSource();
  s.buffer = noiseBuf; s.loop = true;
  return s;
}

function tone(freq, dur, type = 'sine', vol = 0.2, slide = null, delay = 0, bus = sfxBus) {
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.05);
}
function burst(dur, freq, q, vol, type = 'lowpass', delay = 0, sweep = null) {
  const t = ac.currentTime + delay;
  const s = noiseSrc(), f = ac.createBiquadFilter(), g = ac.createGain();
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(sfxBus);
  s.start(t, Math.random()); s.stop(t + dur + 0.05);
}

export const Sound = {
  get sfx() { return sfxOn; },
  get music() { return musicOn; },
  unlock() { ensure(); },
  toggleSfx() {
    sfxOn = !sfxOn;
    try { localStorage.setItem('apex.sfx', sfxOn ? '1' : '0'); } catch (e) {}
    if (ac) sfxBus.gain.value = sfxOn ? 1 : 0;
    return sfxOn;
  },
  toggleMusic() {
    musicOn = !musicOn;
    try { localStorage.setItem('apex.music', musicOn ? '1' : '0'); } catch (e) {}
    if (ac) musicBus.gain.value = musicOn ? 0.32 : 0;
    return musicOn;
  },

  engineStart() {
    if (!ensure() || eng) return;
    const out = ac.createGain(); out.gain.value = 0; out.connect(sfxBus);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3; lp.connect(out);
    const shaper = ac.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.4); }
    shaper.curve = curve;
    shaper.connect(lp);
    const o1 = ac.createOscillator(); o1.type = 'sawtooth';
    const o2 = ac.createOscillator(); o2.type = 'square';
    const o3 = ac.createOscillator(); o3.type = 'sawtooth';
    const g1 = ac.createGain(); g1.gain.value = 0.5;
    const g2 = ac.createGain(); g2.gain.value = 0.3;
    const g3 = ac.createGain(); g3.gain.value = 0.18;
    o1.connect(g1).connect(shaper); o2.connect(g2).connect(shaper); o3.connect(g3).connect(shaper);
    o1.start(); o2.start(); o3.start();
    // tyres + wind
    const tyre = noiseSrc(), tf = ac.createBiquadFilter(), tg = ac.createGain();
    tf.type = 'bandpass'; tf.frequency.value = 1600; tf.Q.value = 6; tg.gain.value = 0;
    tyre.connect(tf).connect(tg).connect(sfxBus); tyre.start();
    const wind = noiseSrc(), wf = ac.createBiquadFilter(), wg = ac.createGain();
    wf.type = 'lowpass'; wf.frequency.value = 700; wg.gain.value = 0;
    wind.connect(wf).connect(wg).connect(sfxBus); wind.start();
    const boost = noiseSrc(), bf = ac.createBiquadFilter(), bg = ac.createGain();
    bf.type = 'bandpass'; bf.frequency.value = 900; bf.Q.value = 1.2; bg.gain.value = 0;
    boost.connect(bf).connect(bg).connect(sfxBus); boost.start();
    eng = { out, lp, o1, o2, o3, tg, tf, wg, wf, bg, bf, nodes: [o1, o2, o3, tyre, wind, boost] };
  },
  engineStop() {
    if (!eng) return;
    const t = ac.currentTime;
    for (const g of [eng.out, eng.tg, eng.wg, eng.bg]) g.gain.setTargetAtTime(0, t, 0.08);
    const e = eng; eng = null;
    setTimeout(() => e.nodes.forEach(n => { try { n.stop(); } catch (x) {} }), 400);
  },
  // rpm 0..1, throttle 0..1, speed m/s, slip 0..1, nitro bool
  engine(rpm, throttle, speed, slip, nitro) {
    if (!eng) return;
    const t = ac.currentTime;
    const f = 42 + rpm * 150;
    eng.o1.frequency.setTargetAtTime(f, t, 0.04);
    eng.o2.frequency.setTargetAtTime(f * 0.5, t, 0.04);
    eng.o3.frequency.setTargetAtTime(f * 1.505, t, 0.04);
    eng.lp.frequency.setTargetAtTime(300 + rpm * 1900 + throttle * 700, t, 0.05);
    eng.out.gain.setTargetAtTime(0.09 + throttle * 0.09 + rpm * 0.05, t, 0.06);
    eng.tg.gain.setTargetAtTime(slip * 0.12, t, 0.05);
    eng.tf.frequency.setTargetAtTime(1300 + slip * 900, t, 0.1);
    eng.wg.gain.setTargetAtTime(Math.min(0.2, speed / 450), t, 0.2);
    eng.wf.frequency.setTargetAtTime(400 + speed * 18, t, 0.2);
    eng.bg.gain.setTargetAtTime(nitro ? 0.12 : 0, t, 0.08);
    eng.bf.frequency.setTargetAtTime(nitro ? 1400 : 600, t, 0.3);
  },

  siren(level, t) {
    if (!ac) return;
    if (!siren && level > 0.01) {
      const o = ac.createOscillator(); o.type = 'triangle';
      const o2 = ac.createOscillator(); o2.type = 'square';
      const g = ac.createGain(); g.gain.value = 0;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      const g2 = ac.createGain(); g2.gain.value = 0.15;
      o.connect(g); o2.connect(g2).connect(g); g.connect(lp).connect(sfxBus);
      o.start(); o2.start();
      siren = { o, o2, g };
    }
    if (!siren) return;
    const now = ac.currentTime;
    const f = 760 + 380 * Math.sin(t * Math.PI * 2 * 0.42);
    siren.o.frequency.setTargetAtTime(f, now, 0.03);
    siren.o2.frequency.setTargetAtTime(f, now, 0.03);
    siren.g.gain.setTargetAtTime(level * 0.07, now, 0.1);
  },
  sirenStop() {
    if (!siren) return;
    const s = siren; siren = null;
    s.g.gain.setTargetAtTime(0, ac.currentTime, 0.1);
    setTimeout(() => { try { s.o.stop(); s.o2.stop(); } catch (e) {} }, 500);
  },

  play(name, power = 1) {
    if (!ensure()) return;
    switch (name) {
      case 'click': tone(880, 0.06, 'triangle', 0.08); break;
      case 'hover': tone(1320, 0.03, 'sine', 0.03); break;
      case 'buy': tone(660, 0.1, 'triangle', 0.12); tone(990, 0.18, 'triangle', 0.12, null, 0.08); break;
      case 'count': tone(520, 0.18, 'square', 0.08); break;
      case 'go': tone(1040, 0.5, 'square', 0.09); break;
      case 'crash': {
        const v = Math.min(1, power / 25);
        burst(0.35 + v * 0.4, 900, 0.7, 0.25 + v * 0.5);
        tone(90, 0.3, 'sine', 0.2 + v * 0.3, 40);
        if (v > 0.4) burst(0.6, 3200, 2, 0.12, 'bandpass', 0.05, 1200);
        break;
      }
      case 'wall': burst(0.4, 2400, 3, 0.25, 'bandpass', 0, 900); break;
      case 'near': burst(0.35, 600, 2, 0.22, 'bandpass', 0, 2400); tone(1200, 0.12, 'sine', 0.05, 1800, 0.05); break;
      case 'nitro': burst(0.5, 300, 1, 0.3, 'bandpass', 0, 2200); break;
      case 'takedown':
        burst(0.8, 700, 0.8, 0.7); tone(70, 0.5, 'sine', 0.5, 35);
        tone(784, 0.16, 'triangle', 0.1, null, 0.18); tone(1175, 0.3, 'triangle', 0.1, null, 0.3);
        break;
      case 'heat': for (let i = 0; i < 3; i++) { tone(960, 0.14, 'square', 0.07, null, i * 0.24); tone(720, 0.14, 'square', 0.07, null, i * 0.24 + 0.12); } break;
      case 'radio': burst(0.25, 2500, 4, 0.08, 'bandpass'); tone(1800, 0.08, 'square', 0.04, null, 0.22); break;
      case 'spikes': for (let i = 0; i < 4; i++) burst(0.12, 3000, 3, 0.25, 'bandpass', i * 0.07); burst(1.2, 400, 1, 0.3, 'lowpass', 0.2, 120); break;
      case 'busted': tone(196, 0.5, 'sawtooth', 0.12); tone(147, 0.9, 'sawtooth', 0.12, null, 0.4); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, 'triangle', 0.1, null, i * 0.12)); break;
      case 'lose': [392, 330, 262].forEach((f, i) => tone(f, 0.45, 'triangle', 0.1, null, i * 0.16)); break;
    }
  },

  musicStart(intensity = 0) {
    if (!ensure()) return;
    if (!music) {
      music = { step: 0, next: ac.currentTime + 0.1, intensity, timer: null };
      const bass = [0, 0, 12, 0, 0, 10, 0, 7, 0, 0, 12, 0, 3, 0, 5, 7];
      const root = [55, 55, 43.65, 49];
      const tick = () => {
        if (!music) return;
        while (music.next < ac.currentTime + 0.2) {
          const st = music.step, t = music.next, bar = Math.floor(st / 16) % 4;
          const beat = st % 16;
          const iv = music.intensity;
          if (beat % 4 === 0) kick(t);
          if (beat % 4 === 2) hat(t, 0.05);
          if (iv > 0.4 && beat % 2 === 1) hat(t, 0.025);
          if (beat === 4 || beat === 12) snare(t, iv);
          const n = root[bar] * Math.pow(2, bass[beat] / 12);
          bassNote(t, n, 0.11);
          if (iv > 0.5 && beat % 4 === 0) pad(t, root[bar] * 4, 0.4);
          music.step++;
          music.next += 60 / 128 / 4;
        }
        music.timer = setTimeout(tick, 50);
      };
      tick();
    }
    music.intensity = intensity;
  },
  musicIntensity(v) { if (music) music.intensity = v; },
  musicStop() { if (music) { clearTimeout(music.timer); music = null; } }
};

function kick(t) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
  o.connect(g).connect(musicBus); o.start(t); o.stop(t + 0.3);
}
function hat(t, v) {
  const s = noiseSrc(), f = ac.createBiquadFilter(), g = ac.createGain();
  f.type = 'highpass'; f.frequency.value = 7000;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  s.connect(f).connect(g).connect(musicBus); s.start(t, Math.random()); s.stop(t + 0.06);
}
function snare(t, iv) {
  const s = noiseSrc(), f = ac.createBiquadFilter(), g = ac.createGain();
  f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
  g.gain.setValueAtTime(0.18 + iv * 0.1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  s.connect(f).connect(g).connect(musicBus); s.start(t, Math.random()); s.stop(t + 0.2);
}
function bassNote(t, f, v) {
  const o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
  o.type = 'sawtooth'; o.frequency.value = f;
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(180, t + 0.1);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
  o.connect(lp).connect(g).connect(musicBus); o.start(t); o.stop(t + 0.13);
}
function pad(t, f, dur) {
  for (const m of [1, 1.19, 1.5]) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle'; o.frequency.value = f * m;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(musicBus); o.start(t); o.stop(t + dur + 0.05);
  }
}
