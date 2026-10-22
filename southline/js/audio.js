// Web Audio: engine, siren, rotor, guns, crashes and a radio with procedural
// 80s stations (synth-pop, synthwave, disco, a slow jam) played only in cars.
let ac = null, master, sfx, music, radioBus, noiseBuf;
let sfxVol = 1, musicVol = 0.8;
try {
  sfxVol = Number(localStorage.getItem('southline.sfx') ?? 1);
  musicVol = Number(localStorage.getItem('southline.music') ?? 0.8);
} catch (e) {}
let listener = { x: 0, z: 0 };

function ensure() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
    master = ac.createGain(); master.gain.value = 0.7; master.connect(ac.destination);
    sfx = ac.createGain(); sfx.gain.value = sfxVol; sfx.connect(master);
    music = ac.createGain(); music.gain.value = musicVol * 0.5; music.connect(master);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000;
    radioBus = ac.createGain(); radioBus.gain.value = 0; radioBus.connect(lp); lp.connect(music);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume();
  return true;
}
const noise = () => { const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s; };
function env(g, t, a, peak, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
function tone(freq, dur, type = 'sine', vol = 0.2, slide = null, delay = 0, bus = sfx) {
  if (!(vol > 0.0005)) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  env(g, t, 0.008, vol, dur);
  o.connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.05);
}
function burst(dur, vol, type, freq, q = 1, delay = 0, bus = sfx, slide = null) {
  if (!(vol > 0.0005)) return;
  const t = ac.currentTime + delay;
  const s = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (slide) f.frequency.exponentialRampToValueAtTime(slide, t + dur);
  env(g, t, 0.004, vol, dur);
  s.connect(f).connect(g).connect(bus);
  s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
const fall = (x, z, r = 70) => x === undefined ? 1 : Math.max(0, 1 - Math.hypot(x - listener.x, z - listener.z) / r);

// ---------- radio ----------
const N = m => 440 * Math.pow(2, (m - 69) / 12);
export const STATIONS = [
  { name: 'Flash 86', tag: 'Synth-pop hits', bpm: 118, root: 57, prog: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], bass: 'o.o.o.o.o.o.o.o.', kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', lead: [12, 15, 19, 17, 15, 12, 10, 12], pad: 'saw', arp: true },
  { name: 'Neon Drive 99', tag: 'Late-night synthwave', bpm: 96, root: 50, prog: [[0, 3, 7], [-4, 0, 3], [-9, -5, -2], [-2, 2, 5]], bass: 'oooooooooooooooo', kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', lead: [19, 17, 15, 14, 15, 12, 14, 10], pad: 'saw', arp: true, gated: true },
  { name: 'Boogie 101', tag: 'Disco & funk', bpm: 122, root: 52, prog: [[0, 3, 7, 10], [5, 8, 12, 15], [0, 3, 7, 10], [-2, 2, 5, 9]], bass: 'o.O.o.O.o.O.o.O.', kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', open: true, lead: [24, 22, 19, 22, 24, 27, 24, 19], pad: 'square', arp: false },
  { name: 'Slow Burn 98', tag: 'Power ballads', bpm: 74, root: 48, prog: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], bass: 'o.......o...o...', kick: 'x.........x.....', snare: '....x.......x...', hat: '', lead: [16, 14, 12, 11, 12, 7, 9, 7], pad: 'tri', arp: false },
  { name: 'Radio off', off: true }
];
let station = 0, step = 0, nextT = 0, timer = null, radioOn = false;

function drum(kind, t) {
  if (kind === 'k') {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(radioBus); o.start(t); o.stop(t + 0.32);
  } else {
    const s = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
    const hat = kind === 'h' || kind === 'o';
    f.type = hat ? 'highpass' : 'bandpass'; f.frequency.value = hat ? 7500 : 1800;
    const d = kind === 'h' ? 0.04 : kind === 'o' ? 0.18 : 0.2;
    g.gain.setValueAtTime(hat ? 0.18 : 0.45, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    s.connect(f).connect(g).connect(radioBus); s.start(t, Math.random()); s.stop(t + d + 0.02);
    if (kind === 's') { const o = ac.createOscillator(), g2 = ac.createGain(); o.frequency.value = 190; g2.gain.setValueAtTime(0.25, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.connect(g2).connect(radioBus); o.start(t); o.stop(t + 0.12); }
  }
}
function synth(freq, t, dur, type, vol, cutoff, det = 0) {
  const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
  o.type = type; o.frequency.value = freq; o.detune.value = det;
  f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, t); f.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff * 0.35), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(radioBus); o.start(t); o.stop(t + dur + 0.05);
}
function schedule() {
  const s = STATIONS[station];
  if (!s || s.off || !radioOn) return;
  const sp = 60 / s.bpm / 4;
  while (nextT < ac.currentTime + 0.15) {
    const t = nextT, k = step % 16, bar = Math.floor(step / 16), chord = s.prog[bar % s.prog.length];
    if (s.kick[k] === 'x') drum('k', t);
    if (s.snare[k] === 'x') drum('s', t);
    if (s.hat && s.hat[k] === 'x') drum(s.open && k % 4 === 2 ? 'o' : 'h', t);
    if (s.bass[k] !== '.') synth(N(s.root - 12 + chord[0] + (s.bass[k] === 'O' ? 12 : 0)), t, sp * (s.bass === 'oooooooooooooooo' ? 0.9 : 1.6), 'sawtooth', 0.22, 900);
    if (k === 0) for (const n of chord) for (const det of [-9, 9]) synth(N(s.root + n), t, sp * 15.5, s.pad === 'saw' ? 'sawtooth' : s.pad === 'tri' ? 'triangle' : 'square', s.gated ? 0.03 : 0.045, 1800, det);
    if (s.gated && k % 2 === 0) for (const n of chord) synth(N(s.root + 12 + n), t, sp * 0.9, 'sawtooth', 0.02, 2600);
    if (s.arp && k % 2 === 1) synth(N(s.root + 12 + chord[(k >> 1) % chord.length]), t, sp * 1.2, 'square', 0.04, 3200);
    const phrase = bar % 4;
    if (phrase >= 2 && k % 4 === 0) synth(N(s.root + s.lead[(k / 4 + phrase * 4) % s.lead.length]), t, sp * 3.6, s.pad === 'tri' ? 'triangle' : 'sawtooth', 0.055, 2400, 6);
    nextT += sp; step++;
  }
}
function setRadio(on) {
  if (!ensure()) return;
  radioOn = on;
  radioBus.gain.setTargetAtTime(on && !STATIONS[station].off ? 1 : 0, ac.currentTime, 0.15);
  if (on && !timer) { nextT = ac.currentTime + 0.05; step = 0; timer = setInterval(schedule, 40); }
  if (!on && timer) { clearInterval(timer); timer = null; }
}

// ---------- loops ----------
let eng = null, siren = null, rotor = null, ambience = null;
function makeEngine() {
  const o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
  o1.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 500; g.gain.value = 0;
  o1.connect(f); o2.connect(f); f.connect(g).connect(sfx); o1.start(); o2.start();
  const sk = noise(), sf = ac.createBiquadFilter(), sg = ac.createGain();
  sf.type = 'bandpass'; sf.frequency.value = 1400; sf.Q.value = 2; sg.gain.value = 0;
  sk.connect(sf).connect(sg).connect(sfx); sk.start();
  return { o1, o2, f, g, sg };
}
function makeSiren() {
  const o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain();
  o.type = 'square'; o.frequency.value = 900; lfo.frequency.value = 0.55; lg.gain.value = 320;
  lfo.connect(lg).connect(o.frequency);
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200;
  g.gain.value = 0; o.connect(f).connect(g).connect(sfx); o.start(); lfo.start();
  return { g };
}
function makeRotor() {
  const s = noise(), f = ac.createBiquadFilter(), g = ac.createGain(), am = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
  f.type = 'lowpass'; f.frequency.value = 380; lfo.frequency.value = 16; lg.gain.value = 0.5; am.gain.value = 0.5;
  lfo.connect(lg).connect(am.gain);
  s.connect(f).connect(am).connect(g).connect(sfx); g.gain.value = 0; s.start(); lfo.start();
  return { g };
}
function makeAmbience() {
  const s = noise(), f = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
  f.type = 'lowpass'; f.frequency.value = 520; g.gain.value = 0;
  const wave = ac.createGain(); wave.gain.value = 0.5; lfo.frequency.value = 0.12; lg.gain.value = 0.45;
  lfo.connect(lg).connect(wave.gain);
  s.connect(f).connect(wave).connect(g).connect(sfx); s.start(); lfo.start();
  return { g, f };
}

export const Sound = {
  STATIONS,
  unlock() { ensure(); },
  get station() { return station; },
  setListener(x, z) { listener.x = x; listener.z = z; },
  setVolumes(s, m) {
    sfxVol = s; musicVol = m;
    try { localStorage.setItem('southline.sfx', s); localStorage.setItem('southline.music', m); } catch (e) {}
    if (ac) { sfx.gain.value = s; music.gain.value = m * 0.5; }
  },
  get volumes() { return { sfx: sfxVol, music: musicVol }; },
  radio(on) { setRadio(on); },
  nextStation(dir = 1) {
    if (!ensure()) return STATIONS[station];
    station = (station + dir + STATIONS.length) % STATIONS.length;
    burst(0.25, 0.12, 'bandpass', 2500, 0.6, 0, music);
    step = 0; nextT = ac.currentTime + 0.25;
    radioBus.gain.setTargetAtTime(radioOn && !STATIONS[station].off ? 1 : 0, ac.currentTime, 0.1);
    return STATIONS[station];
  },
  setStation(i) { station = i; },
  engine(on, speed, throttle, top) {
    if (!ac) return;
    if (!eng) eng = makeEngine();
    const t = ac.currentTime, s = Math.abs(speed), gears = [0, 9, 17, 26, 36, 70];
    let g = 1; while (g < 5 && s > gears[g]) g++;
    const lo = gears[g - 1], hi = gears[g], rpm = 0.25 + 0.75 * Math.min(1, (s - lo) / (hi - lo));
    const f = 45 + rpm * 95 + g * 6;
    eng.o1.frequency.setTargetAtTime(f, t, 0.05); eng.o2.frequency.setTargetAtTime(f * 0.501, t, 0.05);
    eng.f.frequency.setTargetAtTime(300 + rpm * 900 + throttle * 600, t, 0.05);
    eng.g.gain.setTargetAtTime(on ? 0.05 + throttle * 0.05 + rpm * 0.03 : 0, t, 0.08);
  },
  skid(amount) { if (eng) eng.sg.gain.setTargetAtTime(Math.min(0.2, amount * 0.2), ac.currentTime, 0.05); },
  siren(vol) { if (!ac) return; if (!siren) siren = makeSiren(); siren.g.gain.setTargetAtTime(vol * 0.06, ac.currentTime, 0.2); },
  rotor(vol) { if (!ac) return; if (!rotor) rotor = makeRotor(); rotor.g.gain.setTargetAtTime(vol * 0.5, ac.currentTime, 0.3); },
  ambience(beach, city) {
    if (!ac) return;
    if (!ambience) ambience = makeAmbience();
    ambience.g.gain.setTargetAtTime(beach * 0.08 + city * 0.02, ac.currentTime, 0.5);
    ambience.f.frequency.setTargetAtTime(beach > 0.3 ? 700 : 300, ac.currentTime, 0.5);
  },
  silenceLoops() {
    if (!ac) return;
    const t = ac.currentTime;
    for (const l of [eng?.g, eng?.sg, siren?.g, rotor?.g, ambience?.g]) l?.gain.setTargetAtTime(0, t, 0.1);
  },
  gun(kind, x, z) {
    if (!ensure()) return;
    const v = fall(x, z, 120);
    if (v <= 0) return;
    if (kind === 'shotgun') { burst(0.35, 0.7 * v, 'lowpass', 2400, 0.7, 0, sfx, 300); tone(70, 0.2, 'sine', 0.5 * v, 40); }
    else if (kind === 'smg') { burst(0.08, 0.4 * v, 'bandpass', 2200, 0.8); tone(110, 0.06, 'square', 0.12 * v, 60); }
    else { burst(0.16, 0.55 * v, 'bandpass', 1600, 0.7, 0, sfx, 500); tone(95, 0.12, 'sine', 0.35 * v, 45); }
  },
  punch(hit) { if (!ensure()) return; burst(0.1, hit ? 0.45 : 0.15, 'lowpass', hit ? 900 : 2500); if (hit) tone(90, 0.1, 'sine', 0.35, 50); },
  swing() { if (!ensure()) return; burst(0.12, 0.12, 'bandpass', 1800, 1, 0, sfx, 600); },
  explosion(x, z) {
    if (!ensure()) return;
    const v = fall(x, z, 220);
    burst(1.4, 0.9 * v, 'lowpass', 1200, 0.5, 0, sfx, 80); tone(55, 0.9, 'sine', 0.8 * v, 30); burst(0.3, 0.5 * v, 'highpass', 3000);
  },
  crash(force, x, z) {
    if (!ensure()) return;
    const v = fall(x, z, 90) * Math.min(1, force / 18);
    burst(0.35, 0.6 * v, 'lowpass', 1800, 0.6, 0, sfx, 200); burst(0.2, 0.3 * v, 'highpass', 4000, 0.5, 0.02); tone(80, 0.18, 'sine', 0.4 * v, 40);
  },
  hitPed() { if (!ensure()) return; burst(0.15, 0.4, 'lowpass', 600); tone(120, 0.12, 'sine', 0.3, 60); },
  impact(x, z) { if (!ensure()) return; const v = fall(x, z, 60); if (v > 0) burst(0.05, 0.25 * v, 'highpass', 3500); },
  horn(x, z) {
    if (!ensure()) return;
    const v = fall(x, z, 70);
    if (v <= 0) return;
    tone(392, 0.45, 'square', 0.06 * v); tone(494, 0.45, 'square', 0.05 * v);
  },
  door() { if (!ensure()) return; burst(0.08, 0.3, 'lowpass', 700); tone(160, 0.06, 'square', 0.12, 90, 0.05); },
  pickup() { if (!ensure()) return; tone(880, 0.1, 'triangle', 0.2); tone(1320, 0.18, 'triangle', 0.18, null, 0.08); },
  cash() { if (!ensure()) return; tone(1568, 0.08, 'square', 0.08); tone(2093, 0.16, 'square', 0.08, null, 0.07); },
  star() { if (!ensure()) return; tone(660, 0.12, 'square', 0.1); tone(990, 0.2, 'square', 0.1, null, 0.12); },
  splash() { if (!ensure()) return; burst(0.5, 0.4, 'lowpass', 1500, 0.5, 0, sfx, 300); },
  passed() {
    if (!ensure()) return;
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => { tone(f, 0.28, 'square', 0.09, null, i * 0.13); tone(f / 2, 0.28, 'triangle', 0.12, null, i * 0.13); });
  },
  failed() { if (!ensure()) return; [392, 330, 262].forEach((f, i) => tone(f, 0.4, 'sawtooth', 0.1, null, i * 0.22)); },
  wasted() { if (!ensure()) return; tone(220, 1.6, 'sawtooth', 0.14, 55); burst(1.2, 0.2, 'lowpass', 800, 0.5, 0, sfx, 100); },
  ui() { if (!ensure()) return; tone(1200, 0.05, 'square', 0.05); },
  stunt() { if (!ensure()) return; [660, 880, 1100, 1320].forEach((f, i) => tone(f, 0.12, 'square', 0.08, null, i * 0.07)); }
};
