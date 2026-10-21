/* Neon Ball — an original brick breaker inspired by 90s classics. */
(() => {
  'use strict';

  // ---------------------------------------------------------------- constants
  const W = 800, H = 600;
  const COLS = 16, BW = 48, BH = 22, GX = 16, TOP = 66;
  const WALL_T = 52;                 // top wall (below the HUD)
  const PY = 556, PH = 14;           // paddle centre y / height
  const MAX_SPEED = 760;
  const DROP_CHANCE = 0.16;

  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const stage = $('stage');
  let dpr = 1;
  const sprites = new Map();

  function resize() {
    const nd = Math.min(window.devicePixelRatio || 1, 2);
    if (nd === dpr && canvas.width === W * nd) return;
    dpr = nd;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    sprites.clear();
  }
  dpr = 0; resize();
  addEventListener('resize', resize);

  // ---------------------------------------------------------------- audio (synthesized)
  const Sound = (() => {
    let ac = null, master = null;
    let muted = localStorage.getItem('neonball_muted') === '1';
    function init() {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ac = new AC();
        master = ac.createGain();
        master.gain.value = 0.32;
        master.connect(ac.destination);
      }
      if (ac.state === 'suspended') ac.resume();
    }
    function tone(freq, dur, type = 'square', vol = 0.3, slide = 0, delay = 0) {
      if (!ac || muted) return;
      const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(master);
      o.start(t); o.stop(t + dur + 0.02);
    }
    function noise(dur, vol = 0.4, cutoff = 1200) {
      if (!ac || muted) return;
      const len = Math.floor(ac.sampleRate * dur);
      const buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const s = ac.createBufferSource(); s.buffer = buf;
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
      const g = ac.createGain(); g.gain.value = vol;
      s.connect(f).connect(g).connect(master); s.start();
    }
    const semi = (base, s) => base * Math.pow(2, s / 12);
    const fx = {
      paddle: () => tone(210, 0.09, 'square', 0.22, 1.6),
      brick: n => tone(semi(523, Math.min(n || 0, 14)), 0.07, 'square', 0.16, 1.25),
      steel: () => { tone(980, 0.06, 'triangle', 0.25, 0.8); tone(1560, 0.05, 'sine', 0.12); },
      gold: () => tone(1250, 0.1, 'triangle', 0.2, 0.7),
      wall: () => tone(150, 0.04, 'sine', 0.18),
      explode: () => { noise(0.45, 0.7, 900); tone(90, 0.35, 'sawtooth', 0.22, 0.3); },
      power: () => [0, 4, 7, 12].forEach((s, i) => tone(semi(440, s), 0.09, 'square', 0.14, 1, i * 0.05)),
      bad: () => [0, -3, -6].forEach((s, i) => tone(semi(300, s), 0.13, 'sawtooth', 0.14, 1, i * 0.07)),
      laser: () => tone(1500, 0.08, 'sawtooth', 0.08, 0.3),
      launch: () => tone(330, 0.1, 'triangle', 0.25, 2),
      lose: () => { noise(0.6, 0.5, 600); [0, -2, -4, -7, -12].forEach((s, i) => tone(semi(330, s), 0.16, 'triangle', 0.22, 1, 0.15 + i * 0.1)); },
      clear: () => [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(semi(523, s), 0.13, 'square', 0.13, 1, i * 0.07)),
      life: () => [0, 7, 12, 19, 24].forEach((s, i) => tone(semi(392, s), 0.1, 'triangle', 0.2, 1, i * 0.06)),
      over: () => [0, -5, -8, -12].forEach((s, i) => tone(semi(262, s), 0.35, 'sawtooth', 0.16, 1, i * 0.22)),
    };
    return {
      init,
      play(name, arg) { if (fx[name]) fx[name](arg); },
      toggle() { muted = !muted; localStorage.setItem('neonball_muted', muted ? '1' : '0'); return muted; },
      get muted() { return muted; },
    };
  })();
  const sfx = (n, a) => { if (!demo) Sound.play(n, a); };

  // ---------------------------------------------------------------- levels
  const COLORS = {
    r: [350, 88, 60], o: [22, 95, 57], y: [46, 95, 56], g: [145, 68, 48], c: [188, 85, 50],
    b: [218, 85, 60], p: [268, 75, 64], m: [318, 80, 62], w: [215, 22, 80],
  };

  const LEVELS = [
    { name: 'First Light', map: [
      '................',
      '................',
      'wwwwwwwwwwwwwwww',
      'rrrrrrrrrrrrrrrr',
      'oooooooooooooooo',
      'yyyyyyyyyyyyyyyy',
      'gggggggggggggggg',
      'cccccccccccccccc',
      'bbbbbbbbbbbbbbbb',
    ] },
    { name: 'The Pyramid', map: [
      '................',
      '.......XX.......',
      '......yyyy......',
      '.....oooooo.....',
      '....rrrrrrrr....',
      '...pppppppppp...',
      '..bbbbbbbbbbbb..',
      '.cccccccccccccc.',
      'SSSSSSSSSSSSSSSS',
    ] },
    { name: 'Checkmate', map: [
      '................',
      'r.o.y.g.c.b.p.m.',
      '.r.o.y.g.c.b.p.m',
      'o.y.g.c.b.p.m.r.',
      '.o.y.g.c.b.p.m.r',
      'y.g.c.b.p.m.r.o.',
      '.y.g.c.b.p.m.r.o',
      '................',
      'I..I..I..I..I..I',
    ] },
    { name: 'Space Bug', map: [
      '................',
      '....g......g....',
      '.....g....g.....',
      '....gggggggg....',
      '...gg.gXXg.gg...',
      '..gggggggggggg..',
      '..g.gggggggg.g..',
      '..g.g......g.g..',
      '.....gg..gg.....',
      '................',
      'SSSS..SSSS..SSSS',
    ] },
    { name: 'Fortress', map: [
      '................',
      'IIIIIII..IIIIIII',
      'I..............I',
      'I.rrrrrrrrrrrr.I',
      'I.rXXXrrrrXXXr.I',
      'I.rrrrrrrrrrrr.I',
      'I.SSSSSSSSSSSS.I',
      'I..............I',
      'I.cccccccccccc.I',
      'I.bbbbbbbbbbbb.I',
      'IIIIII....IIIIII',
    ] },
    { name: 'Diamond Mind', map: [
      '.......ww.......',
      '......wccw......',
      '.....wcbbcw.....',
      '....wcbppbcw....',
      '...wcbpmmpbcw...',
      '..wcbpmXXmpbcw..',
      '...wcbpmmpbcw...',
      '....wcbppbcw....',
      '.....wcbbcw.....',
      '......wccw......',
      '.......ww.......',
    ] },
    { name: 'Pillars', map: [
      '................',
      'S.S.S.S..S.S.S.S',
      'r.o.y.g..g.y.o.r',
      'r.o.y.g..g.y.o.r',
      'r.o.y.g..g.y.o.r',
      'r.o.y.gXXg.y.o.r',
      'r.o.y.g..g.y.o.r',
      'r.o.y.g..g.y.o.r',
      'r.o.y.g..g.y.o.r',
      'I.I.I.I..I.I.I.I',
    ] },
    { name: 'Heartbreaker', map: [
      '................',
      '..mmm......mmm..',
      '.mrrrm....mrrrm.',
      'mrrrrrm..mrrrrrm',
      'mrrrrrrmmrrrrrrm',
      'mrrrrrrXXrrrrrrm',
      '.mrrrrrrrrrrrrm.',
      '..mrrrrrrrrrrm..',
      '...mrrrrrrrrm...',
      '....mrrrrrrm....',
      '.....mrrrrm.....',
      '......mrrm......',
      '.......mm.......',
    ] },
    { name: 'The Maze', map: [
      'SSSSSSSSSSSSSSSS',
      'y..............y',
      'y.IIIIII.IIIII.y',
      'y.g..........g.y',
      'y.g.SSSSSSSS.g.y',
      'y.g.cXccccXc.g.y',
      'y.g.SSSSSSSS.g.y',
      'y.g..........g.y',
      'y.IIIII.IIIIII.y',
      'y..............y',
      'bbbbbbbbbbbbbbbb',
    ] },
    { name: 'Rainbow Core', map: [
      'pppppppppppppppp',
      'pbbbbbbbbbbbbbbp',
      'pbccccccccccccbp',
      'pbcggggggggggcbp',
      'pbcgyyyyyyyygcbp',
      'pbcgyooooooygcbp',
      'pbcgyorrrroygcbp',
      'pbcgyorXXroygcbp',
      'SSSSSSSSSSSSSSSS',
    ] },
  ];

  function seeded(seed) {
    return () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Procedural, mirror-symmetric levels beyond the hand-made ones
  function generateLevel(n) {
    const r = seeded(n * 9973 + 17);
    const keys = 'roygcbpmw';
    const rows = 8 + Math.floor(r() * 6);
    const style = Math.floor(r() * 5);
    const map = [];
    for (let y = 0; y < rows; y++) {
      let half = '';
      for (let x = 0; x < 8; x++) {
        const v = r();
        let ch = '.';
        if (style === 0) ch = v < 0.8 ? keys[(y + n) % 9] : '.';
        else if (style === 1) ch = (x + y) % 2 === 0 ? keys[(x + n) % 9] : (v < 0.35 ? '.' : keys[y % 9]);
        else if (style === 2) ch = (x + y) % 3 === 0 ? '.' : keys[(x + y + n) % 9];
        else if (style === 3) ch = (Math.abs(7.5 - x) + y) % 4 < 2.5 ? keys[(y + n) % 9] : '.';
        else ch = v < 0.65 ? keys[Math.floor(r() * 9)] : '.';
        if (ch !== '.') {
          const s = r(), hard = Math.min(0.12, n * 0.004);
          if (s < 0.05 + hard) ch = 'S';
          else if (s < 0.09 + hard) ch = 'X';
          else if (s < 0.1 + hard * 0.6 && y > 1) ch = 'I';
        }
        half += ch;
      }
      map.push(half + [...half].reverse().join(''));
    }
    const names = ['Nebula', 'Vortex', 'Quasar', 'Pulsar', 'Eclipse', 'Zenith', 'Nova', 'Aurora', 'Helix', 'Prism'];
    return { name: names[n % names.length] + ' ' + (Math.floor(n / names.length) + 1), map };
  }
  const getLevel = n => (n < LEVELS.length ? LEVELS[n] : generateLevel(n));

  // ---------------------------------------------------------------- power-ups
  const POWERS = {
    expand: { label: 'WIDE',  name: 'Wide paddle',     color: '#34d399', good: true,  w: 14 },
    multi:  { label: 'MULTI', name: 'Multiball',       color: '#60a5fa', good: true,  w: 12 },
    laser:  { label: 'LASER', name: 'Laser cannons',   color: '#f43f5e', good: true,  w: 9 },
    fire:   { label: 'FIRE',  name: 'Fireball',        color: '#fb923c', good: true,  w: 6 },
    catch:  { label: 'CATCH', name: 'Sticky paddle',   color: '#a3e635', good: true,  w: 9 },
    slow:   { label: 'SLOW',  name: 'Slow ball',       color: '#22d3ee', good: true,  w: 9 },
    zap:    { label: 'ZAP',   name: 'Rigs bricks to blow', color: '#c084fc', good: true, w: 5 },
    life:   { label: '+1UP',  name: 'Extra life',      color: '#e879f9', good: true,  w: 3 },
    shrink: { label: 'SMALL', name: 'Small paddle',    color: '#f87171', good: false, w: 7 },
    fast:   { label: 'FAST',  name: 'Fast ball',       color: '#facc15', good: false, w: 6 },
    death:  { label: 'DEATH', name: 'Instant death!',  color: '#475569', good: false, w: 3, dark: true },
  };
  const POWER_BAG = [];
  for (const [k, p] of Object.entries(POWERS)) for (let i = 0; i < p.w; i++) POWER_BAG.push(k);

  // ---------------------------------------------------------------- state
  let state = 'title';     // title | play | paused | dead | clear | over
  let demo = true;         // attract mode behind the title screen
  let score = 0, lives = 3, level = 0, levelName = '', startLevelIdx = 0;
  let bricks = [], grid = [], balls = [], caps = [], bullets = [], particles = [], popups = [], flashes = [], blasts = [];
  const paddle = { x: W / 2, w: 100, tw: 100, squash: 0 };
  let ballSpeed = 380, effects = { fire: 0, laser: 0, catch: 0 };
  let combo = 0, shake = 0, bannerT = 0, time = 0, laserCD = 0, stateT = 0, clearBonus = 0;
  const keys = {};
  let pointerDown = false;
  const stars = Array.from({ length: 90 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: rand(0.2, 1) }));

  const baseSpeed = lv => Math.min(360 + lv * 12, 540);

  // ---------------------------------------------------------------- level / round setup
  function buildLevel(n) {
    const def = getLevel(n);
    bricks = []; grid = [];
    def.map.forEach((row, ry) => {
      grid[ry] = [];
      for (let cx = 0; cx < COLS; cx++) {
        const ch = row[cx] || '.';
        if (ch === '.') continue;
        const b = { x: GX + cx * BW, y: TOP + ry * BH, w: BW, h: BH, col: cx, row: ry, alive: true, flash: 0, ch };
        if (ch === 'S') { b.type = 'steel'; b.hits = 3; }
        else if (ch === 'I') { b.type = 'gold'; b.hits = Infinity; }
        else if (ch === 'X') { b.type = 'explosive'; b.hits = 1; }
        else { b.type = 'normal'; b.hits = 1; }
        bricks.push(b);
        grid[ry][cx] = b;
      }
    });
    levelName = def.name;
  }

  function makeBall(x, y, vx, vy) {
    return { x, y, vx, vy, r: 7, stuck: false, caught: false, off: 0, stuckT: 0, trail: [], dead: false };
  }

  function resetRound() {
    paddle.tw = paddle.w = 100;
    const b = makeBall(paddle.x, PY - PH / 2 - 7, 0, 0);
    b.stuck = true; b.off = rand(-22, 22);
    balls = [b];
    caps = []; bullets = []; blasts = [];
    effects = { fire: 0, laser: 0, catch: 0 };
    ballSpeed = baseSpeed(level);
    combo = 0;
  }

  function startLevel() {
    buildLevel(level);
    resetRound();
    bannerT = demo ? 0 : 2.6;
    if (!demo) state = 'play';
  }

  function newGame() {
    demo = false;
    score = 0; lives = 3; level = startLevelIdx;
    particles = []; popups = []; flashes = [];
    paddle.x = W / 2;
    startLevel();
    showOverlay(null);
  }

  function startDemo() {
    demo = true;
    level = Math.floor(Math.random() * LEVELS.length);
    startLevel();
  }

  // ---------------------------------------------------------------- gameplay helpers
  function launch(b) {
    if (!b.stuck) return;
    const rel = clamp(b.off / (paddle.w / 2), -1, 1);
    const ang = rel * 0.9 + (Math.abs(rel) < 0.05 ? rand(-0.25, 0.25) : 0);
    b.vx = Math.sin(ang) * ballSpeed;
    b.vy = -Math.cos(ang) * ballSpeed;
    b.stuck = false; b.caught = false;
    sfx('launch');
  }

  function action() {
    const stuck = balls.filter(b => b.stuck);
    if (stuck.length) { stuck.forEach(launch); bannerT = Math.min(bannerT, 0.4); return; }
    if (effects.laser > 0 && laserCD <= 0) fireLaser();
  }

  function fireLaser() {
    laserCD = 0.2;
    const off = paddle.w / 2 - 8;
    bullets.push({ x: paddle.x - off, y: PY - PH }, { x: paddle.x + off, y: PY - PH });
    sfx('laser');
  }

  function addScore(pts, x, y, mult) {
    if (demo) return;
    score += pts;
    popups.push({ x, y, text: '+' + pts, life: 0.8, max: 0.8, color: mult > 1 ? '#fde047' : '#ffffff', big: mult > 1 });
  }

  function brickColor(b) {
    if (b.type === 'steel') return '#b8c4d4';
    if (b.type === 'gold') return '#fbbf24';
    if (b.type === 'explosive') return '#ff5a36';
    const [h, s, l] = COLORS[b.ch] || COLORS.w;
    return `hsl(${h} ${s}% ${l}%)`;
  }

  function spawnShards(b, n = 10) {
    const c = brickColor(b), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    for (let i = 0; i < n; i++) {
      particles.push({
        x: cx + rand(-b.w / 2, b.w / 2), y: cy + rand(-b.h / 2, b.h / 2),
        vx: rand(-160, 160), vy: rand(-220, 60), life: rand(0.5, 1), max: 1,
        size: rand(3, 7), rot: rand(0, 6), vr: rand(-10, 10), color: c, g: 700,
      });
    }
  }

  function spawnSparks(x, y, color, n = 8, speed = 220) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(speed * 0.3, speed);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.25, 0.55), max: 0.55, size: rand(1.5, 3), rot: 0, vr: 0, color, g: 0, spark: true });
    }
  }

  function damage(k) {
    k.flash = 1;
    if (k.type === 'gold') { sfx('gold'); spawnSparks(k.x + k.w / 2, k.y + k.h / 2, '#fde68a', 5); return; }
    k.hits--;
    if (k.hits > 0) { sfx('steel'); addScore(5, k.x + k.w / 2, k.y, 1); spawnSparks(k.x + k.w / 2, k.y + k.h / 2, '#e2e8f0', 6); return; }
    destroy(k);
  }

  function destroy(k, chained) {
    if (!k.alive || k.type === 'gold') return;
    k.alive = false;
    grid[k.row][k.col] = null;
    combo++;
    const base = k.type === 'steel' ? 50 : k.type === 'explosive' ? 25 : 10;
    const mult = 1 + Math.floor(combo / 6);
    addScore(base * mult, k.x + k.w / 2, k.y + k.h / 2, mult);
    spawnShards(k);
    if (k.type === 'explosive') blasts.push({ k, t: 0.08 });
    else if (!chained) sfx('brick', combo);
    if (Math.random() < DROP_CHANCE) {
      caps.push({ x: k.x + k.w / 2, y: k.y + k.h / 2, type: POWER_BAG[Math.floor(Math.random() * POWER_BAG.length)], t: 0 });
    }
  }

  function blast(k) {
    const cx = k.x + k.w / 2, cy = k.y + k.h / 2;
    sfx('explode');
    shake = Math.min(16, shake + 8);
    flashes.push({ x: cx, y: cy, t: 0, max: 0.4 });
    spawnSparks(cx, cy, '#ffb347', 18, 360);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const n = grid[k.row + dy] && grid[k.row + dy][k.col + dx];
        if (n && n.alive) destroy(n, true);
      }
    }
  }

  function applyPower(type, x) {
    const p = POWERS[type];
    popups.push({ x, y: PY - 30, text: p.name.toUpperCase(), life: 1.2, max: 1.2, color: p.color, big: true });
    if (type !== 'death') sfx(p.good ? 'power' : 'bad');
    if (!demo) score += 50;
    switch (type) {
      case 'expand': paddle.tw = Math.min(200, paddle.tw + 36); break;
      case 'shrink': paddle.tw = Math.max(56, paddle.tw - 28); break;
      case 'multi': {
        if (balls.every(b => b.stuck)) balls.forEach(launch);
        const add = [];
        for (const b of balls) {
          if (b.stuck) continue;
          const a = Math.atan2(b.vy, b.vx);
          for (const d of [-0.5, 0.5]) {
            if (balls.length + add.length >= 18) break;
            add.push(makeBall(b.x, b.y, Math.cos(a + d) * ballSpeed, Math.sin(a + d) * ballSpeed));
          }
        }
        balls.push(...add);
        break;
      }
      case 'fire': effects.fire = 12; break;
      case 'laser': effects.laser = 14; break;
      case 'catch': effects.catch = 18; break;
      case 'slow': ballSpeed = Math.max(260, ballSpeed * 0.7); break;
      case 'fast': ballSpeed = Math.min(MAX_SPEED, ballSpeed * 1.3); break;
      case 'life': lives = Math.min(9, lives + 1); sfx('life'); break;
      case 'zap': {
        const pool = bricks.filter(b => b.alive && b.type === 'normal').sort(() => Math.random() - 0.5).slice(0, 7);
        pool.forEach(b => { b.type = 'explosive'; b.ch = 'X'; b.flash = 1; spawnSparks(b.x + b.w / 2, b.y + b.h / 2, '#c084fc', 6); });
        break;
      }
      case 'death': loseLife(); break;
    }
  }

  function loseLife() {
    if (state !== 'play' && !demo) return;
    // the paddle explodes
    spawnSparks(paddle.x, PY, '#22d3ee', 30, 420);
    for (let i = 0; i < 16; i++) {
      particles.push({ x: paddle.x + rand(-paddle.w / 2, paddle.w / 2), y: PY, vx: rand(-200, 200), vy: rand(-380, -60),
        life: rand(0.7, 1.3), max: 1.3, size: rand(3, 7), rot: rand(0, 6), vr: rand(-12, 12), color: i % 2 ? '#cbd5e1' : '#22d3ee', g: 800 });
    }
    flashes.push({ x: paddle.x, y: PY, t: 0, max: 0.5 });
    shake = 14;
    balls = []; caps = []; bullets = [];
    if (demo) { resetRound(); return; }
    lives--;
    sfx('lose');
    state = 'dead';
    stateT = 1.5;
  }

  function levelCleared() {
    if (demo) { level++; startLevel(); return; }
    state = 'clear';
    stateT = 2.8;
    clearBonus = 1000 + level * 250;
    score += clearBonus;
    sfx('clear');
    for (let i = 0; i < 6; i++) setTimeout(() => spawnSparks(rand(100, W - 100), rand(120, 400), `hsl(${rand(0, 360)} 90% 65%)`, 30, 320), i * 180);
  }

  function gameOver() {
    state = 'over';
    sfx('over');
    if (document.pointerLockElement) document.exitPointerLock();
    $('final-score').textContent = score.toLocaleString();
    $('final-level').textContent = level + 1;
    const form = $('name-form');
    if (qualifies(score)) {
      form.classList.remove('hidden');
      $('name-input').value = localStorage.getItem('neonball_name') || '';
      setTimeout(() => $('name-input').focus(), 350);
    } else form.classList.add('hidden');
    renderScores($('scores-over'));
    showOverlay('over');
  }

  // ---------------------------------------------------------------- physics
  function overlapping(b) {
    const x0 = b.x - b.r, x1 = b.x + b.r, y0 = b.y - b.r, y1 = b.y + b.r, out = [];
    for (const k of bricks) {
      if (k.alive && x1 > k.x && x0 < k.x + k.w && y1 > k.y && y0 < k.y + k.h) out.push(k);
    }
    return out;
  }

  function resolveBricks(b, axis) {
    const hits = overlapping(b);
    if (!hits.length) return;
    const fire = effects.fire > 0;
    let solid = null, best = Infinity;
    for (const k of hits) {
      if (fire && k.type !== 'gold') { destroy(k); continue; }
      const d = Math.hypot(k.x + k.w / 2 - b.x, k.y + k.h / 2 - b.y);
      if (d < best) { best = d; solid = k; }
    }
    if (!solid) return;
    damage(solid);
    if (axis === 'x') {
      b.x = b.vx > 0 ? solid.x - b.r - 0.01 : solid.x + solid.w + b.r + 0.01;
      b.vx = -b.vx;
    } else {
      b.y = b.vy > 0 ? solid.y - b.r - 0.01 : solid.y + solid.h + b.r + 0.01;
      b.vy = -b.vy;
    }
  }

  function updateBall(b, dt) {
    b.trail.push(b.x, b.y);
    if (b.trail.length > 20) b.trail.splice(0, 2);
    if (b.stuck) {
      b.x = paddle.x + b.off;
      b.y = PY - PH / 2 - b.r;
      b.stuckT += dt;
      if ((b.caught && b.stuckT > 3) || (demo && b.stuckT > 0.8)) launch(b);
      return;
    }
    // keep a constant speed & avoid near-horizontal paths
    let sp = Math.hypot(b.vx, b.vy) || 1;
    b.vx *= ballSpeed / sp; b.vy *= ballSpeed / sp;
    const minVy = ballSpeed * 0.22;
    if (Math.abs(b.vy) < minVy) {
      b.vy = (b.vy < 0 ? -1 : 1) * minVy;
      b.vx = Math.sign(b.vx || 1) * Math.sqrt(ballSpeed * ballSpeed - minVy * minVy);
    }

    const steps = Math.max(1, Math.ceil((ballSpeed * dt) / (b.r * 0.7)));
    const sdt = dt / steps;
    for (let i = 0; i < steps && !b.dead && !b.stuck; i++) {
      b.x += b.vx * sdt;
      if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); sfx('wall'); }
      else if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx); sfx('wall'); }
      resolveBricks(b, 'x');

      b.y += b.vy * sdt;
      if (b.y - b.r < WALL_T) { b.y = WALL_T + b.r; b.vy = Math.abs(b.vy); sfx('wall'); }
      resolveBricks(b, 'y');

      // paddle
      const top = PY - PH / 2;
      if (b.vy > 0 && b.y + b.r >= top && b.y + b.r <= top + PH &&
          b.x >= paddle.x - paddle.w / 2 - b.r && b.x <= paddle.x + paddle.w / 2 + b.r) {
        const rel = clamp((b.x - paddle.x) / (paddle.w / 2), -1, 1);
        const ang = rel * (Math.PI / 3) + rand(-0.03, 0.03);
        b.vx = Math.sin(ang) * ballSpeed;
        b.vy = -Math.cos(ang) * ballSpeed;
        b.y = top - b.r;
        combo = 0;
        paddle.squash = 1;
        sfx('paddle');
        if (effects.catch > 0) { b.stuck = true; b.caught = true; b.stuckT = 0; b.off = b.x - paddle.x; }
      }
      if (b.y - b.r > H) b.dead = true;
    }
  }

  // ---------------------------------------------------------------- update
  function update(dt) {
    time += dt;
    shake = Math.max(0, shake - dt * 40);
    bannerT = Math.max(0, bannerT - dt);

    updateFx(dt);

    if (state === 'dead') {
      stateT -= dt;
      if (stateT <= 0) {
        if (lives <= 0) gameOver();
        else { resetRound(); state = 'play'; }
      }
      return;
    }
    if (state === 'clear') {
      stateT -= dt;
      if (stateT <= 0) { level++; startLevel(); }
      return;
    }
    if (state !== 'play' && !(state === 'title' && demo)) return;
    if (state === 'title') { /* demo runs below */ }

    // paddle control
    if (demo) {
      const live = balls.filter(b => !b.stuck);
      const target = live.length ? live.reduce((a, b) => (b.y > a.y ? b : a)) : null;
      if (target) {
        const aim = target.x + Math.sin(time * 1.3) * paddle.w * 0.3;
        paddle.x += (aim - paddle.x) * Math.min(1, dt * 14);
      }
    } else {
      const dir = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
      if (dir) paddle.x += dir * 760 * dt;
    }
    paddle.w += (paddle.tw - paddle.w) * Math.min(1, dt * 10);
    paddle.x = clamp(paddle.x, paddle.w / 2 + 2, W - paddle.w / 2 - 2);
    paddle.squash = Math.max(0, paddle.squash - dt * 6);

    // timers
    for (const k in effects) {
      if (effects[k] > 0) {
        effects[k] -= dt;
        if (effects[k] <= 0) {
          effects[k] = 0;
          if (k === 'catch') balls.forEach(b => b.stuck && b.caught && launch(b));
        }
      }
    }
    if (balls.some(b => !b.stuck)) ballSpeed = Math.min(MAX_SPEED, ballSpeed + 3 * dt);

    // lasers
    laserCD -= dt;
    if (!demo && effects.laser > 0 && (pointerDown || keys.Space) && laserCD <= 0 && !balls.some(b => b.stuck)) fireLaser();
    for (const s of bullets) {
      s.y -= 720 * dt;
      for (const k of bricks) {
        if (k.alive && s.x > k.x && s.x < k.x + k.w && s.y < k.y + k.h && s.y > k.y - 10) {
          damage(k); s.dead = true;
          spawnSparks(s.x, k.y + k.h, '#fda4af', 4, 140);
          break;
        }
      }
      if (s.y < WALL_T) s.dead = true;
    }
    bullets = bullets.filter(s => !s.dead);

    // balls
    for (const b of balls) updateBall(b, dt);
    balls = balls.filter(b => !b.dead);

    // explosions (chain with a small delay)
    for (const bl of blasts) { bl.t -= dt; if (bl.t <= 0) { bl.done = true; blast(bl.k); } }
    blasts = blasts.filter(bl => !bl.done);

    // capsules
    for (const c of caps) {
      c.y += 150 * dt; c.t += dt;
      if (c.y + 9 >= PY - PH / 2 && c.y - 9 <= PY + PH / 2 && Math.abs(c.x - paddle.x) < paddle.w / 2 + 22) {
        c.dead = true;
        applyPower(c.type, c.x);
        if (state === 'dead') return;
      }
      if (c.y > H + 20) c.dead = true;
    }
    caps = caps.filter(c => !c.dead);

    if (balls.length === 0) { loseLife(); return; }
    if (!blasts.length && !bricks.some(b => b.alive && b.type !== 'gold')) levelCleared();
  }

  function updateFx(dt) {
    for (const p of particles) {
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= dt;
      if (p.spark) { p.vx *= 0.94; p.vy *= 0.94; }
    }
    particles = particles.filter(p => p.life > 0);
    if (particles.length > 900) particles.splice(0, particles.length - 900);
    for (const p of popups) { p.y -= 40 * dt; p.life -= dt; }
    popups = popups.filter(p => p.life > 0);
    for (const f of flashes) f.t += dt;
    flashes = flashes.filter(f => f.t < f.max);
    for (const b of bricks) if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 5);
  }

  // ---------------------------------------------------------------- rendering
  function rr(g, x, y, w, h, r) {
    r = Math.min(r, h / 2, w / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function brickSprite(b) {
    const key = b.type === 'steel' ? 'S' + b.hits : b.ch;
    let s = sprites.get(key);
    if (s) return s;
    s = document.createElement('canvas');
    s.width = BW * dpr; s.height = BH * dpr;
    const g = s.getContext('2d');
    g.scale(dpr, dpr);
    const x = 1, y = 1, w = BW - 2, h = BH - 2;
    let top, mid, bot;
    if (b.type === 'steel') { top = '#f1f5f9'; mid = '#8a97a8'; bot = '#353d4a'; }
    else if (b.type === 'gold') { top = '#fff6c2'; mid = '#d9a514'; bot = '#5e4004'; }
    else if (b.type === 'explosive') { top = '#ffd8a0'; mid = '#ff4d2e'; bot = '#5c0b0b'; }
    else {
      const [hh, ss, ll] = COLORS[b.ch] || COLORS.w;
      top = `hsl(${hh} ${ss}% ${Math.min(94, ll + 28)}%)`; mid = `hsl(${hh} ${ss}% ${ll}%)`; bot = `hsl(${hh} ${ss}% ${Math.max(10, ll - 32)}%)`;
    }
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, top); gr.addColorStop(0.5, mid); gr.addColorStop(1, bot);
    rr(g, x, y, w, h, 3); g.fillStyle = gr; g.fill();

    // bevel
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.beginPath(); g.moveTo(x + 1.5, y + h - 3); g.lineTo(x + 1.5, y + 1.5); g.lineTo(x + w - 3, y + 1.5); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.beginPath(); g.moveTo(x + w - 1.5, y + 3); g.lineTo(x + w - 1.5, y + h - 1.5); g.lineTo(x + 3, y + h - 1.5); g.stroke();

    // gloss
    const gl = g.createLinearGradient(0, y, 0, y + h * 0.5);
    gl.addColorStop(0, 'rgba(255,255,255,0.5)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    rr(g, x + 3, y + 2, w - 6, h * 0.42, 2); g.fillStyle = gl; g.fill();

    if (b.type === 'steel') {
      g.fillStyle = 'rgba(30,35,45,0.7)';
      for (const [px, py] of [[x + 5, y + 5], [x + w - 5, y + 5], [x + 5, y + h - 5], [x + w - 5, y + h - 5]]) {
        g.beginPath(); g.arc(px, py, 1.6, 0, Math.PI * 2); g.fill();
      }
      g.strokeStyle = 'rgba(20,24,32,0.85)'; g.lineWidth = 1.2;
      if (b.hits <= 2) { g.beginPath(); g.moveTo(x + 14, y + 2); g.lineTo(x + 19, y + 9); g.lineTo(x + 16, y + 14); g.lineTo(x + 22, y + h - 1); g.stroke(); }
      if (b.hits <= 1) { g.beginPath(); g.moveTo(x + w - 10, y + 1); g.lineTo(x + w - 16, y + 8); g.lineTo(x + w - 12, y + 12); g.lineTo(x + w - 19, y + h - 1); g.moveTo(x + w - 16, y + 8); g.lineTo(x + w - 24, y + 9); g.stroke(); }
    } else if (b.type === 'gold') {
      g.save(); rr(g, x, y, w, h, 3); g.clip();
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3;
      for (let i = -20; i < w; i += 14) { g.beginPath(); g.moveTo(x + i, y + h); g.lineTo(x + i + h, y); g.stroke(); }
      g.restore();
      g.strokeStyle = 'rgba(94,64,4,0.6)'; g.lineWidth = 1;
      rr(g, x + 4, y + 4, w - 8, h - 8, 2); g.stroke();
    } else if (b.type === 'explosive') {
      const cx = x + w / 2, cy = y + h / 2;
      g.fillStyle = 'rgba(40,0,0,0.75)';
      g.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2, r = i % 2 ? 3 : 7.5;
        g.lineTo(cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r);
      }
      g.closePath(); g.fill();
      g.fillStyle = '#ffe08a'; g.beginPath(); g.arc(cx, cy, 2.2, 0, Math.PI * 2); g.fill();
    }
    sprites.set(key, s);
    return s;
  }

  function drawBackground() {
    const hue = (level * 53 + 250) % 360;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `hsl(${hue} 55% 9%)`);
    g.addColorStop(1, `hsl(${(hue + 40) % 360} 65% 4%)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    const rg = ctx.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.35, 460);
    rg.addColorStop(0, `hsla(${hue}, 90%, 60%, 0.16)`);
    rg.addColorStop(1, 'hsla(0,0%,0%,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#fff';
    for (const s of stars) {
      const y = (s.y + time * s.z * 18) % H;
      ctx.globalAlpha = s.z * (0.5 + 0.5 * Math.sin(time * 2 + s.x));
      ctx.fillRect(s.x, y, s.z * 1.8, s.z * 1.8);
    }
    ctx.globalAlpha = 1;

    // synthwave floor grid
    const hy = 400;
    ctx.save();
    const fade = ctx.createLinearGradient(0, hy, 0, H);
    fade.addColorStop(0, `hsla(${hue}, 90%, 60%, 0)`);
    fade.addColorStop(1, `hsla(${hue}, 90%, 65%, 0.28)`);
    ctx.strokeStyle = fade; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -10; i <= 10; i++) { ctx.moveTo(W / 2 + i * 20, hy); ctx.lineTo(W / 2 + i * 120, H); }
    const off = (time * 0.6) % 1;
    for (let i = 0; i < 10; i++) {
      const t = (i + off) / 10, y = hy + (H - hy) * t * t;
      ctx.moveTo(0, y); ctx.lineTo(W, y);
    }
    ctx.stroke();
    ctx.restore();

    // side rails
    const rail = ctx.createLinearGradient(0, WALL_T, 0, H);
    rail.addColorStop(0, `hsla(${hue}, 90%, 65%, 0.6)`); rail.addColorStop(1, `hsla(${hue}, 90%, 65%, 0.05)`);
    ctx.fillStyle = rail;
    ctx.fillRect(0, WALL_T, 2, H - WALL_T); ctx.fillRect(W - 2, WALL_T, 2, H - WALL_T);
  }

  function drawBricks() {
    for (const b of bricks) {
      if (!b.alive) continue;
      ctx.drawImage(brickSprite(b), b.x, b.y, BW, BH);
      if (b.type === 'explosive') {
        ctx.fillStyle = `rgba(255,170,80,${0.12 + 0.12 * Math.sin(time * 6 + b.col)})`;
        ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      }
      if (b.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${b.flash * 0.8})`;
        rr(ctx, b.x + 1, b.y + 1, b.w - 2, b.h - 2, 3); ctx.fill();
      }
    }
  }

  function drawPaddle() {
    if (state === 'dead' || state === 'over') return;
    const sq = paddle.squash * 3;
    const w = paddle.w + sq * 2, h = PH - sq, x = paddle.x - w / 2, y = PY - h / 2 + sq / 2;
    const accent = effects.catch > 0 ? '#a3e635' : effects.laser > 0 ? '#f43f5e' : '#22d3ee';

    if (effects.laser > 0) {
      ctx.fillStyle = '#94a3b8';
      for (const cx of [paddle.x - paddle.w / 2 + 8, paddle.x + paddle.w / 2 - 8]) {
        ctx.fillRect(cx - 3, y - 9, 6, 10);
        ctx.fillStyle = '#f43f5e'; ctx.fillRect(cx - 2, y - 11, 4, 3); ctx.fillStyle = '#94a3b8';
      }
    }

    ctx.save();
    ctx.shadowColor = accent; ctx.shadowBlur = 20;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#a9b8ca'); g.addColorStop(1, '#2f3b4b');
    rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = g; ctx.fill();
    ctx.restore();

    const cg = ctx.createLinearGradient(0, y, 0, y + h);
    cg.addColorStop(0, '#ffffff'); cg.addColorStop(0.4, accent); cg.addColorStop(1, '#0b1020');
    ctx.fillStyle = cg;
    rr(ctx, x, y, 18, h, h / 2); ctx.fill();
    rr(ctx, x + w - 18, y, 18, h, h / 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(x + 20, y + 2, w - 40, 1.5);
  }

  function drawBalls() {
    const fire = effects.fire > 0;
    for (const b of balls) {
      const t = b.trail;
      for (let i = 0; i < t.length; i += 2) {
        const a = (i / t.length);
        ctx.fillStyle = fire ? `rgba(255,${120 + a * 100},40,${a * 0.5})` : `rgba(150,230,255,${a * 0.35})`;
        ctx.beginPath(); ctx.arc(t[i], t[i + 1], b.r * (0.4 + a * 0.6), 0, Math.PI * 2); ctx.fill();
      }
      ctx.save();
      ctx.shadowColor = fire ? '#ff7a18' : '#7dd3fc';
      ctx.shadowBlur = fire ? 26 : 16;
      const g = ctx.createRadialGradient(b.x - 2, b.y - 2, 0.5, b.x, b.y, b.r);
      if (fire) { g.addColorStop(0, '#fffbe6'); g.addColorStop(0.4, '#ffb347'); g.addColorStop(1, '#e8430f'); }
      else { g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#dbeafe'); g.addColorStop(1, '#5b7ea8'); }
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (fire && Math.random() < 0.6) {
        particles.push({ x: b.x + rand(-3, 3), y: b.y + rand(-3, 3), vx: rand(-30, 30), vy: rand(-60, 0), life: 0.35, max: 0.35, size: rand(2, 4), rot: 0, vr: 0, color: '#ff9a3c', g: 0, spark: true });
      }
    }
  }

  function drawCaps() {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 9px Orbitron, sans-serif';
    for (const c of caps) {
      const p = POWERS[c.type];
      const w = 46, h = 18, x = c.x - w / 2, y = c.y - h / 2;
      const pulse = 0.5 + 0.5 * Math.sin(c.t * 8);
      ctx.save();
      ctx.shadowColor = p.color; ctx.shadowBlur = 10 + pulse * 10;
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, p.color); g.addColorStop(1, '#111');
      rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = g; ctx.fill();
      ctx.restore();
      ctx.fillStyle = p.dark ? '#fff' : '#0b0b18';
      ctx.fillText(p.label, c.x, c.y + 1);
    }
  }

  function drawBullets() {
    ctx.save();
    ctx.shadowColor = '#f43f5e'; ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffe4e6';
    for (const s of bullets) { ctx.fillRect(s.x - 1.5, s.y - 10, 3, 12); }
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      const a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.spark) { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a + 0.5, 0, Math.PI * 2); ctx.fill(); }
      else {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawFlashes() {
    for (const f of flashes) {
      const k = f.t / f.max, r = 20 + k * 90;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      g.addColorStop(0, `rgba(255,240,200,${0.9 * (1 - k)})`);
      g.addColorStop(0.4, `rgba(255,140,40,${0.6 * (1 - k)})`);
      g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(255,220,160,${1 - k})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(f.x, f.y, r * 0.9, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawPopups() {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of popups) {
      ctx.globalAlpha = clamp(p.life / p.max * 1.5, 0, 1);
      ctx.font = p.big ? '700 14px Orbitron, sans-serif' : '600 10px Orbitron, sans-serif';
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    const g = ctx.createLinearGradient(0, 0, 0, WALL_T);
    g.addColorStop(0, 'rgba(8,8,22,0.95)'); g.addColorStop(1, 'rgba(14,12,34,0.85)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, WALL_T);
    const line = ctx.createLinearGradient(0, 0, W, 0);
    line.addColorStop(0, '#22d3ee'); line.addColorStop(0.5, '#8b5cf6'); line.addColorStop(1, '#e879f9');
    ctx.fillStyle = line; ctx.fillRect(0, WALL_T - 2, W, 2);

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8b8fbf'; ctx.font = '600 10px Orbitron, sans-serif';
    ctx.fillText('SCORE', 18, 18);
    ctx.fillStyle = '#ffffff'; ctx.font = '900 22px Orbitron, sans-serif';
    ctx.fillText(score.toLocaleString(), 18, 42);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#8b8fbf'; ctx.font = '600 10px Orbitron, sans-serif';
    ctx.fillText('LEVEL ' + String(level + 1).padStart(2, '0'), W / 2, 18);
    ctx.fillStyle = '#e0e7ff'; ctx.font = '700 15px Orbitron, sans-serif';
    ctx.fillText(levelName.toUpperCase(), W / 2, 40);

    // lives
    ctx.textAlign = 'right';
    ctx.fillStyle = '#8b8fbf'; ctx.font = '600 10px Orbitron, sans-serif';
    ctx.fillText('LIVES', W - 18, 18);
    const show = Math.min(lives, 7);
    for (let i = 0; i < show; i++) {
      const x = W - 18 - 30 - i * 34, y = 30;
      const pg = ctx.createLinearGradient(0, y, 0, y + 8);
      pg.addColorStop(0, '#fff'); pg.addColorStop(1, '#22d3ee');
      ctx.fillStyle = pg; rr(ctx, x, y, 28, 8, 4); ctx.fill();
    }

    // active effects
    let ex = 200;
    const info = { fire: ['FIRE', '#fb923c', 12], laser: ['LASER', '#f43f5e', 14], catch: ['CATCH', '#a3e635', 18] };
    ctx.textAlign = 'left'; ctx.font = '700 9px Orbitron, sans-serif';
    for (const k in effects) {
      if (effects[k] <= 0) continue;
      const [label, col, max] = info[k];
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; rr(ctx, ex, 28, 58, 14, 7); ctx.fill();
      ctx.fillStyle = col; rr(ctx, ex, 28, 58 * clamp(effects[k] / max, 0, 1), 14, 7); ctx.fill();
      ctx.fillStyle = '#0b0b18'; ctx.fillText(label, ex + 8, 38);
      ex += 64;
    }
    if (combo >= 6) {
      ctx.fillStyle = '#fde047'; ctx.font = '900 13px Orbitron, sans-serif';
      ctx.fillText('x' + (1 + Math.floor(combo / 6)) + ' COMBO', 200, 20);
    }
  }

  function centerText(text, y, size, color, glow) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${size}px Orbitron, sans-serif`;
    ctx.shadowColor = glow || color; ctx.shadowBlur = 24;
    ctx.fillStyle = color;
    ctx.fillText(text, W / 2, y);
    ctx.restore();
  }

  function drawMessages() {
    if (demo) return;
    if (bannerT > 0 && state === 'play') {
      const a = clamp(bannerT / 0.5, 0, 1);
      const slide = (1 - clamp((2.6 - bannerT) / 0.3, 0, 1)) * 40;
      ctx.globalAlpha = a;
      centerText('LEVEL ' + (level + 1), 330 - slide, 46, '#ffffff', '#8b5cf6');
      centerText(levelName.toUpperCase(), 380 - slide, 18, '#22d3ee');
      ctx.globalAlpha = 1;
    }
    if (state === 'play' && balls.some(b => b.stuck && !b.caught) && bannerT < 1.8) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 5);
      centerText('CLICK TO LAUNCH', 470, 14, '#e0e7ff', '#22d3ee');
      ctx.globalAlpha = 1;
    }
    if (state === 'clear') {
      const k = clamp((2.8 - stateT) / 0.4, 0, 1);
      ctx.globalAlpha = k;
      centerText('LEVEL CLEAR!', 300, 50 * (0.7 + 0.3 * k), '#fde047', '#f97316');
      centerText('BONUS +' + clearBonus.toLocaleString(), 360, 20, '#ffffff', '#22d3ee');
      ctx.globalAlpha = 1;
    }
    if (state === 'dead' && lives > 0) {
      centerText(lives === 1 ? 'LAST LIFE!' : lives + ' LIVES LEFT', 340, 26, '#fb7185');
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground();
    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake, shake) * 0.5, rand(-shake, shake) * 0.5);
    drawBricks();
    drawCaps();
    drawBullets();
    drawPaddle();
    drawBalls();
    drawParticles();
    drawFlashes();
    drawPopups();
    ctx.restore();
    if (!demo) drawHUD();
    drawMessages();
  }

  // ---------------------------------------------------------------- high scores
  const HS_KEY = 'neonball_scores';
  const getScores = () => { try { return JSON.parse(localStorage.getItem(HS_KEY)) || []; } catch { return []; } };
  const qualifies = s => { const l = getScores(); return s > 0 && (l.length < 8 || s > l[l.length - 1].score); };
  let lastEntry = null;
  function saveScore(name, s, lv) {
    const l = getScores();
    lastEntry = { name, score: s, level: lv, t: Date.now() };
    l.push(lastEntry);
    l.sort((a, b) => b.score - a.score);
    localStorage.setItem(HS_KEY, JSON.stringify(l.slice(0, 8)));
  }
  function renderScores(el) {
    const l = getScores();
    el.innerHTML = '';
    if (!l.length) { el.innerHTML = '<li class="empty">No scores yet. Be the first!</li>'; return; }
    for (const e of l) {
      const li = document.createElement('li');
      if (lastEntry && e.t === lastEntry.t) li.className = 'me';
      const n = document.createElement('span'); n.className = 'n'; n.textContent = e.name;
      const lv = document.createElement('span'); lv.className = 'l'; lv.textContent = 'LV ' + e.level;
      const s = document.createElement('span'); s.className = 's'; s.textContent = e.score.toLocaleString();
      li.append(n, lv, s);
      el.appendChild(li);
    }
  }

  // ---------------------------------------------------------------- UI / overlays
  const overlay = $('overlay');
  function showOverlay(which) {
    for (const id of ['title', 'pause', 'over']) $('panel-' + id).classList.toggle('hidden', id !== which);
    overlay.classList.toggle('hidden', !which);
    stage.classList.toggle('playing', !which);
  }

  function toTitle() {
    if (document.pointerLockElement) document.exitPointerLock();
    renderScores($('scores-title'));
    showOverlay('title');
    state = 'title';
    startDemo();
    state = 'title';
  }

  function pause() {
    if (demo || state !== 'play') return;
    state = 'paused';
    pointerDown = false;
    if (document.pointerLockElement) document.exitPointerLock();
    showOverlay('pause');
  }
  function resume() {
    if (state !== 'paused') return;
    state = 'play';
    showOverlay(null);
  }

  const sel = $('sel-level');
  for (let i = 0; i < 30; i++) {
    const o = document.createElement('option');
    o.value = i; o.textContent = (i + 1) + ' — ' + getLevel(i).name;
    sel.appendChild(o);
  }
  sel.value = localStorage.getItem('neonball_start') || 0;
  sel.addEventListener('change', () => localStorage.setItem('neonball_start', sel.value));

  $('btn-play').addEventListener('click', () => { Sound.init(); startLevelIdx = +sel.value || 0; newGame(); });
  $('btn-again').addEventListener('click', () => { Sound.init(); newGame(); });
  $('btn-menu').addEventListener('click', toTitle);
  $('btn-resume').addEventListener('click', resume);
  $('btn-quit').addEventListener('click', toTitle);
  $('name-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = ($('name-input').value.trim() || 'PLAYER').toUpperCase().slice(0, 12);
    localStorage.setItem('neonball_name', name);
    saveScore(name, score, level + 1);
    $('name-form').classList.add('hidden');
    renderScores($('scores-over'));
  });

  const soundBtn = $('btn-sound');
  const syncSound = () => { soundBtn.textContent = Sound.muted ? '🔇' : '🔊'; };
  syncSound();
  soundBtn.addEventListener('click', () => { Sound.init(); Sound.toggle(); syncSound(); });
  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (stage.requestFullscreen) stage.requestFullscreen();
  }
  $('btn-full').addEventListener('click', toggleFull);

  // power-up legend
  const legend = $('power-legend');
  for (const p of Object.values(POWERS)) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="cap${p.dark ? ' dark' : ''}" style="--c:${p.color}">${p.label}</span><span>${p.name}</span>`;
    legend.appendChild(li);
  }

  // ---------------------------------------------------------------- input
  const controlling = () => !demo && (state === 'play' || state === 'dead' || state === 'clear');
  const locked = () => document.pointerLockElement === canvas;
  function canvasX(clientX) {
    const r = canvas.getBoundingClientRect();
    return (clientX - r.left) / r.width * W;
  }

  document.addEventListener('mousemove', e => {
    if (!controlling()) return;
    if (locked()) { const r = canvas.getBoundingClientRect(); paddle.x += e.movementX * W / r.width; }
    else paddle.x = canvasX(e.clientX);
  });
  canvas.addEventListener('mousedown', e => {
    Sound.init();
    if (state !== 'play' || demo) return;
    if (!locked() && canvas.requestPointerLock) {
      try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (_) { /* ignore */ }
    }
    pointerDown = true;
    action();
    e.preventDefault();
  });
  document.addEventListener('mouseup', () => { pointerDown = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('pointerlockchange', () => {
    if (!locked() && state === 'play' && !demo) pause();
  });

  canvas.addEventListener('touchstart', e => {
    Sound.init();
    if (state !== 'play' || demo) return;
    paddle.x = canvasX(e.touches[0].clientX);
    pointerDown = true;
    action();
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    if (controlling()) paddle.x = canvasX(e.touches[0].clientX);
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', () => { pointerDown = false; });

  document.addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return;
    keys[e.code] = true;
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        if (state === 'play' && !demo && !e.repeat) { Sound.init(); action(); }
        break;
      case 'ArrowLeft': case 'ArrowRight': e.preventDefault(); break;
      case 'KeyP': case 'Escape':
        if (state === 'play') pause(); else if (state === 'paused') resume();
        break;
      case 'KeyM': Sound.init(); Sound.toggle(); syncSound(); break;
      case 'KeyF': toggleFull(); break;
      case 'Enter':
        if (state === 'title') { Sound.init(); startLevelIdx = +sel.value || 0; newGame(); }
        else if (state === 'over' && $('name-form').classList.contains('hidden')) newGame();
        break;
    }
  });
  document.addEventListener('keyup', e => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; pause(); });

  // ---------------------------------------------------------------- loop
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  toTitle();
  requestAnimationFrame(frame);
})();
