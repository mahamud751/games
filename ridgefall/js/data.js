'use strict';
/* Tracks, vehicles, terrain and the saved career. */

const SAVE_KEY = 'ridgefall_save_v1';

const VEHICLES = [
  {
    id: 'trail', name: 'Trail 250', kind: 'bike', blurb: 'Honest, planted, and free. Learn the mountain on this.',
    price: 0, accel: 780, max: 860, grip: 1, air: 6.4, boost: 1.18, drag: 0.00084, hover: 34,
    color: '#d6ff4a', dark: '#3f6212', suit: '#ecfccb', metal: '#1c1917',
  },
  {
    id: 'cross', name: 'Cross 450', kind: 'bike', blurb: 'Lighter in the air. The bike you want when the lip gets steep.',
    price: 800, accel: 900, max: 980, grip: 0.94, air: 7.6, boost: 1.28, drag: 0.0007, hover: 34,
    color: '#7dd3fc', dark: '#0c4a6e', suit: '#e0f2fe', metal: '#0f172a',
  },
  {
    id: 'atv', name: 'Ridge ATV', kind: 'atv', blurb: 'Four wheels and a low center. Ice and gravel barely argue.',
    price: 1200, accel: 700, max: 800, grip: 1.28, air: 4.3, boost: 1.22, drag: 0.00098, hover: 30,
    color: '#fb923c', dark: '#7c2d12', suit: '#ffedd5', metal: '#1c1917',
  },
  {
    id: 'wave', name: 'Wave Runner', kind: 'boat', blurb: 'A jet hull for the lagoons. On dry dirt it is merely quick.',
    price: 1600, accel: 840, max: 940, grip: 0.78, air: 5.1, boost: 1.34, drag: 0.00074, hover: 24,
    color: '#2dd4bf', dark: '#115e59', suit: '#ccfbf1', metal: '#042f2e',
  },
  {
    id: 'storm', name: 'Storm X', kind: 'bike', blurb: 'Too much motor. Forgive it on the landings or it will not forgive you.',
    price: 2600, accel: 1040, max: 1120, grip: 0.82, air: 8.2, boost: 1.42, drag: 0.00058, hover: 34,
    color: '#f472b6', dark: '#9d174d', suit: '#fce7f3', metal: '#1f2937',
  },
];

const RIDERS = [
  { name: 'NOOR', color: '#67e8f9', dark: '#155e75', suit: '#cffafe', skill: 0.7 },
  { name: 'KENJI', color: '#fdba74', dark: '#9a3412', suit: '#ffedd5', skill: 0.8 },
  { name: 'RIO', color: '#c4b5fd', dark: '#5b21b6', suit: '#ede9fe', skill: 0.88 },
  { name: 'AVA', color: '#fda4af', dark: '#9f1239', suit: '#ffe4e6', skill: 0.96 },
];

const TRACKS = [
  {
    id: 'pine', name: 'Pine Descent', region: 'North Ridge', diff: 1,
    length: 25000, drop: 0.22, seed: 11,
    f1: 0.0042, a1: 54, f2: 0.0095, a2: 20, f3: 0.0018, a3: 64,
    rampEvery: [1700, 2400], rampH: 120, rampClimb: 400, rampDrop: 460, rampDropLen: 170,
    surface: 'dirt', water: [], night: false,
    medals: [36, 43, 52], reward: 240,
    sky: ['#10283c', '#6eb6e0', '#f3ddb4'],
    far: '#1b4660', mid: '#1e6846', haze: 'rgba(243,221,180,.35)',
    accent: '#d6ff4a',
    decor: ['pine', 'pine', 'rock'],
  },
  {
    id: 'canyon', name: 'Red Canyon', region: 'Split Rock', diff: 2,
    length: 27000, drop: 0.26, seed: 29,
    f1: 0.0048, a1: 42, f2: 0.011, a2: 16, f3: 0.0016, a3: 36,
    rampEvery: [1600, 2200], rampH: 130, rampClimb: 380, rampDrop: 520, rampDropLen: 160,
    surface: 'gravel', water: [], night: false,
    medals: [42, 50, 60], reward: 320,
    sky: ['#2a1238', '#e07a4c', '#ffd0a8'],
    far: '#4a2344', mid: '#8a4632', haze: 'rgba(255,180,120,.28)',
    accent: '#fdba74',
    decor: ['rock', 'cactus', 'rock'],
  },
  {
    id: 'timber', name: 'Black Timber', region: 'Owl Line', diff: 3,
    length: 29000, drop: 0.24, seed: 47,
    f1: 0.0056, a1: 48, f2: 0.012, a2: 18, f3: 0.0022, a3: 52,
    rampEvery: [1650, 2300], rampH: 125, rampClimb: 390, rampDrop: 500, rampDropLen: 165,
    surface: 'dirt', water: [], night: true,
    medals: [44, 53, 64], reward: 400,
    sky: ['#070b16', '#1a2744', '#243044'],
    far: '#121a2c', mid: '#16382c', haze: 'rgba(80,120,180,.18)',
    accent: '#a5b4fc',
    decor: ['pine', 'pine', 'pine'],
  },
  {
    id: 'glacier', name: 'Glacier Gate', region: 'White Spine', diff: 4,
    length: 30000, drop: 0.2, seed: 71,
    f1: 0.0032, a1: 32, f2: 0.0072, a2: 14, f3: 0.0014, a3: 40,
    rampEvery: [1900, 2600], rampH: 100, rampClimb: 440, rampDrop: 480, rampDropLen: 180,
    surface: 'ice', water: [], night: false,
    medals: [48, 57, 68], reward: 500,
    sky: ['#d7ecff', '#8eafc9', '#f5fbff'],
    far: '#8aa4b8', mid: '#c5d5e2', haze: 'rgba(255,255,255,.45)',
    accent: '#e0f2fe',
    decor: ['ice', 'rock', 'ice'],
  },
  {
    id: 'coast', name: 'Laguna Drop', region: 'Salt Coast', diff: 5,
    length: 31000, drop: 0.23, seed: 93,
    f1: 0.0038, a1: 40, f2: 0.0088, a2: 16, f3: 0.0017, a3: 48,
    rampEvery: [1750, 2400], rampH: 115, rampClimb: 400, rampDrop: 470, rampDropLen: 170,
    surface: 'sand', water: [[0.18, 0.36], [0.55, 0.74]], night: false,
    medals: [46, 55, 66], reward: 620,
    sky: ['#062034', '#1aa6b8', '#ffe3a3'],
    far: '#0e4a5c', mid: '#0f766e', haze: 'rgba(255,227,163,.3)',
    accent: '#5eead4',
    decor: ['palm', 'rock', 'palm'],
  },
];

const GRIP = { dirt: 1, sand: 0.9, gravel: 0.84, snow: 0.74, ice: 0.52, water: 0.58 };

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function yAt(terrain, x) {
  const ys = terrain.ys;
  const step = terrain.step;
  if (x <= 0) return ys[0];
  const maxX = (ys.length - 1) * step;
  if (x >= maxX) return ys[ys.length - 1];
  const f = x / step;
  const i = f | 0;
  const u = f - i;
  return ys[i] * (1 - u) + ys[i + 1] * u;
}

function slopeAt(terrain, x) {
  const d = 12;
  return Math.atan2(yAt(terrain, x + d) - yAt(terrain, x - d), d * 2);
}

function surfaceAt(track, x) {
  const u = x / track.length;
  if (track.surface === 'ice') return 'ice';
  if (track.surface === 'gravel') return u > 0.08 && u < 0.94 ? 'gravel' : 'dirt';
  if (track.water) {
    for (let i = 0; i < track.water.length; i++) {
      if (u >= track.water[i][0] && u <= track.water[i][1]) return 'water';
    }
  }
  if (track.surface === 'sand') return 'sand';
  return 'dirt';
}

function trackGrip(track, vehicle, x) {
  const surf = surfaceAt(track, x);
  let g = GRIP[surf] * vehicle.grip;
  if (surf === 'water' && vehicle.kind === 'boat') g = Math.max(g, 1.12);
  if ((surf === 'ice' || surf === 'snow') && vehicle.kind === 'atv') g *= 1.18;
  return { g, surf };
}

function buildTerrain(track) {
  const step = 8;
  const n = Math.ceil(track.length / step);
  const ys = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const x = i * step;
    const t = x / track.length;
    const drop = track.drop * (0.72 + 0.55 * Math.sin(t * Math.PI));
    let y = -drop * x;
    y += Math.sin(x * track.f1 + track.seed) * track.a1;
    y += Math.sin(x * track.f2 + 1.7) * track.a2;
    y += Math.sin(x * track.f3 + 0.4) * track.a3;
    ys[i] = y;
  }

  const iFlat = Math.min(n - 2, Math.floor(720 / step));
  const baseY = ys[iFlat];
  for (let i = 0; i < iFlat; i++) {
    const u = i / iFlat;
    const s = u * u * (3 - 2 * u);
    ys[i] = baseY * (1 - s) + ys[i] * s;
  }
  const rng = mulberry32(track.seed + 17);
  const ramps = [];
  let x = 1600;
  while (x < track.length - 1900) {
    addRamp(ys, step, x, track);
    ramps.push(x + track.rampClimb);
    x += track.rampEvery[0] + rng() * (track.rampEvery[1] - track.rampEvery[0]);
  }

  const iEnd = Math.max(1, n - Math.floor(560 / step));
  const endY = ys[iEnd];
  for (let i = iEnd + 1; i <= n; i++) {
    const u = (i - iEnd) / (n - iEnd);
    const s = u * u * (3 - 2 * u);
    ys[i] = ys[i] * (1 - s) + endY * s;
  }

  return { step, ys, length: track.length, ramps, finish: track.length - 460 };
}

function addRamp(ys, step, cx, track) {
  const climb = track.rampClimb;
  const h = track.rampH;
  const drop = track.rampDrop;
  const dropLen = track.rampDropLen;
  const lip = cx + climb;
  const i0 = Math.max(0, Math.floor(cx / step));
  const iLip = Math.min(ys.length - 1, Math.floor(lip / step));
  const iDrop = Math.min(ys.length - 1, Math.floor((lip + dropLen) / step));
  for (let i = i0; i <= iLip; i++) {
    const u = (i * step - cx) / climb;
    if (u > 0 && u <= 1) ys[i] += h * u * u;
  }
  for (let i = iLip + 1; i <= iDrop; i++) {
    const u = Math.min(1, (i * step - lip) / dropLen);
    const s = u * u * (3 - 2 * u);
    ys[i] += h * (1 - s) - drop * s;
  }
  for (let i = iDrop + 1; i < ys.length; i++) ys[i] -= drop;
}

function medalFor(track, time) {
  if (time == null || !isFinite(time)) return null;
  if (time <= track.medals[0]) return 'gold';
  if (time <= track.medals[1]) return 'silver';
  if (time <= track.medals[2]) return 'bronze';
  return null;
}

function defaultSave() {
  return { v: 1, credits: 0, name: 'RIDER', vehicle: 'trail', owned: ['trail'], cleared: [], best: {} };
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const s = Object.assign(defaultSave(), JSON.parse(raw));
    if (!Array.isArray(s.owned) || !s.owned.includes('trail')) s.owned = ['trail'].concat(s.owned || []);
    if (!VEHICLES.some(v => v.id === s.vehicle)) s.vehicle = 'trail';
    s.best = s.best || {};
    s.cleared = s.cleared || [];
    s.name = String(s.name || 'RIDER').slice(0, 12);
    return s;
  } catch (e) {
    return defaultSave();
  }
}

function writeSave(save) {
  const pack = (withGhost) => {
    const copy = {
      v: 1, credits: save.credits | 0, name: save.name, vehicle: save.vehicle,
      owned: save.owned, cleared: save.cleared, best: {},
    };
    for (const id in save.best) {
      const b = save.best[id];
      copy.best[id] = { time: b.time, score: b.score | 0, gems: b.gems | 0 };
      if (withGhost && b.ghost) copy.best[id].ghost = b.ghost;
    }
    return JSON.stringify(copy);
  };
  try {
    localStorage.setItem(SAVE_KEY, pack(true));
  } catch (e) {
    try { localStorage.setItem(SAVE_KEY, pack(false)); } catch (err) { /* ignore quota */ }
  }
}

function vehicleById(id) {
  return VEHICLES.find(v => v.id === id) || VEHICLES[0];
}

function trackById(id) {
  return TRACKS.find(t => t.id === id) || TRACKS[0];
}

function isUnlocked(save, track) {
  const i = TRACKS.findIndex(t => t.id === track.id);
  if (i <= 0) return true;
  return save.cleared.includes(TRACKS[i - 1].id);
}

function fmtTime(t) {
  if (t == null || !isFinite(t)) return '—';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return m + ':' + s.toFixed(2).padStart(5, '0');
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function money(n) {
  return '$' + Math.max(0, Math.round(n)).toLocaleString('en-US');
}
