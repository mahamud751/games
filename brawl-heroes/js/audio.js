'use strict';
// Web Audio synth: sound effects plus a small step-sequencer soundtrack.
window.Sound = (() => {
  let ac = null, master, sfxBus, musicBus, noiseBuf;
  let sfxOn = true, musicOn = true;
  try {
    sfxOn = localStorage.getItem('brawl.sfx') !== '0';
    musicOn = localStorage.getItem('brawl.music') !== '0';
  } catch (e) {}

  function ensure() {
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
        sfxBus = ac.createGain(); sfxBus.gain.value = sfxOn ? 1 : 0; sfxBus.connect(master);
        musicBus = ac.createGain(); musicBus.gain.value = musicOn ? 0.42 : 0; musicBus.connect(master);
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { return false; }
    }
    if (ac.state === 'suspended') ac.resume();
    return true;
  }

  function tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null, delay = 0, bus = sfxBus, t0 = null) {
    if (!ac) return;
    const t = (t0 ?? ac.currentTime) + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, freq, q = 1, vol = 0.3, delay = 0, type = 'bandpass', bus = sfxBus, t0 = null) {
    if (!ac) return;
    const t = (t0 ?? ac.currentTime) + delay;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  }

  const fx = {
    swing() { noise(0.09, 1400, 0.8, 0.12, 0, 'bandpass'); },
    punch(big) { noise(0.08, 900, 1, big ? 0.6 : 0.4); tone(big ? 110 : 160, 0.12, 'sine', big ? 0.5 : 0.35, 50); if (big) noise(0.2, 300, 0.7, 0.35, 0.02); },
    kick() { noise(0.1, 700, 1, 0.45); tone(130, 0.14, 'sine', 0.4, 45); },
    slash() { noise(0.12, 3800, 2, 0.3); tone(1800, 0.08, 'sawtooth', 0.05, 600); },
    block() { tone(900, 0.05, 'square', 0.1); },
    thud() { noise(0.25, 180, 0.8, 0.5); tone(70, 0.25, 'sine', 0.45, 35); },
    jump() { tone(260, 0.12, 'triangle', 0.12, 520); },
    land() { noise(0.08, 300, 0.8, 0.15); },
    grab() { tone(300, 0.06, 'square', 0.08); },
    throwIt() { noise(0.25, 900, 0.6, 0.25); tone(400, 0.25, 'triangle', 0.12, 120); },
    pickup() { [880, 1175, 1568].forEach((f, i) => tone(f, 0.12, 'triangle', 0.14, null, i * 0.05)); },
    coin() { tone(1319, 0.08, 'square', 0.08); tone(1760, 0.18, 'square', 0.08, null, 0.07); },
    crash() { noise(0.35, 1200, 0.5, 0.45); noise(0.2, 300, 0.8, 0.3, 0.03); for (let i = 0; i < 4; i++) tone(200 + Math.random() * 300, 0.05, 'square', 0.04, null, i * 0.04); },
    special() { tone(200, 0.4, 'sawtooth', 0.12, 900); noise(0.5, 2000, 0.5, 0.2); },
    superMove() { tone(80, 1.2, 'sawtooth', 0.25, 40); [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.6, 'square', 0.08, null, i * 0.05)); noise(1.0, 600, 0.4, 0.5, 0.25); },
    ko() { tone(600, 0.5, 'square', 0.1, 80); },
    hurt() { tone(220, 0.15, 'square', 0.08, 120); },
    roar() { tone(90, 1.0, 'sawtooth', 0.25, 55); noise(1.0, 400, 0.5, 0.3); tone(140, 0.9, 'square', 0.08, 70); },
    fire() { noise(0.6, 500, 0.4, 0.35); tone(120, 0.5, 'sawtooth', 0.12, 60); },
    knife() { noise(0.1, 4500, 3, 0.18); },
    shock() { noise(0.5, 120, 0.5, 0.6); tone(55, 0.5, 'sine', 0.5, 30); },
    select() { tone(660, 0.05, 'square', 0.07); },
    confirm() { tone(523, 0.08, 'square', 0.1); tone(784, 0.14, 'square', 0.1, null, 0.08); },
    go() { [784, 784, 1046].forEach((f, i) => tone(f, 0.12, 'square', 0.09, null, i * 0.12)); },
    clear() { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, 0.22, 'square', 0.1, null, i * 0.11)); },
    lose() { [392, 349, 330, 262].forEach((f, i) => tone(f, 0.35, 'triangle', 0.15, null, i * 0.2)); },
  };

  // ---------- music ----------
  const SONGS = {
    title: { bpm: 112, chords: [45, 41, 36, 43], lead: 1 },
    s1: { bpm: 132, chords: [45, 41, 43, 40], lead: 2 },
    s2: { bpm: 140, chords: [38, 41, 36, 43], lead: 3 },
    s3: { bpm: 148, chords: [40, 36, 38, 35], lead: 2 },
    boss: { bpm: 160, chords: [40, 41, 40, 43], lead: 4 },
  };
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  let song = null, step = 0, nextT = 0, timer = null;

  function drum(kind, t) {
    if (kind === 'k') { tone(150, 0.14, 'sine', 0.7, 42, 0, musicBus, t); }
    else if (kind === 's') { noise(0.14, 1800, 0.7, 0.35, 0, 'bandpass', musicBus, t); tone(190, 0.08, 'triangle', 0.18, 140, 0, musicBus, t); }
    else noise(0.03, 8000, 1, 0.12, 0, 'highpass', musicBus, t);
  }
  function playStep(i, t) {
    const s = SONGS[song], bar = Math.floor(i / 16) % 4, st = i % 16, root = s.chords[bar];
    if (st % 4 === 0) drum('k', t);
    if (song === 'boss' && st % 4 === 2) drum('k', t);
    if (st === 4 || st === 12) drum('s', t);
    if (st % 2 === 1) drum('h', t);
    const bassPat = [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 0, 12, 10, 7];
    if (song !== 'title' || st % 2 === 0) {
      const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sawtooth'; o.frequency.value = midi(root + bassPat[st]);
      f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(200, t + 0.14);
      g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(f); f.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.2);
    }
    // arpeggiated lead using minor chord tones
    const arp = [0, 3, 7, 12, 7, 3, 12, 15];
    const leadOn = s.lead === 1 ? st % 4 === 0 : s.lead === 2 ? st % 2 === 0 && (st < 12 || bar % 2) : s.lead === 3 ? [0, 3, 6, 8, 10, 12, 14].includes(st) : st % 2 === 0;
    if (leadOn) tone(midi(root + 24 + arp[(st / 2 + bar) % 8 | 0]), 0.12, 'square', 0.045, null, 0, musicBus, t);
  }
  function scheduler() {
    if (!song || !ac) return;
    const spb = 60 / SONGS[song].bpm / 4;
    while (nextT < ac.currentTime + 0.15) { playStep(step, nextT); nextT += spb; step = (step + 1) % 64; }
  }

  return {
    ensure,
    play(name) { if (sfxOn && ac && fx[name]) fx[name](...[].slice.call(arguments, 1)); },
    music(name) {
      if (!ensure()) return;
      if (song === name) return;
      song = name; step = 0; nextT = ac.currentTime + 0.08;
      if (!timer) timer = setInterval(scheduler, 40);
    },
    stopMusic() { song = null; },
    get sfxOn() { return sfxOn; },
    get musicOn() { return musicOn; },
    toggleSfx() { sfxOn = !sfxOn; if (sfxBus) sfxBus.gain.value = sfxOn ? 1 : 0; try { localStorage.setItem('brawl.sfx', sfxOn ? '1' : '0'); } catch (e) {} return sfxOn; },
    toggleMusic() { musicOn = !musicOn; if (musicBus) musicBus.gain.value = musicOn ? 0.42 : 0; try { localStorage.setItem('brawl.music', musicOn ? '1' : '0'); } catch (e) {} return musicOn; },
  };
})();
