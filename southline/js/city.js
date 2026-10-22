// Coral Bay: an island grid of avenues and streets, a beach strip on the east
// coast, districts with their own building styles, and the collision world.
import * as THREE from 'three';

export const ROAD = 16, BLOCK = 60, PITCH = ROAD + BLOCK, HALF = ROAD / 2;
export const NX = 7, NZ = 9;
export const CITY_W = NX * PITCH, CITY_H = NZ * PITCH;
export const BEACH_X = CITY_W + HALF;
export const SHORE = 630;
export const SEA_Y = -0.55;
export const DEEP = SHORE + 26;
export const LAND = { x0: -14, x1: SHORE, z0: -14, z1: CITY_H + 14 };
export const LANE = 3.8;

export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function blockRect(bx, bz) {
  const x0 = bx * PITCH + HALF, z0 = bz * PITCH + HALF;
  return { x0, z0, x1: x0 + BLOCK, z1: z0 + BLOCK, cx: x0 + BLOCK / 2, cz: z0 + BLOCK / 2 };
}

const SPECIAL = {
  '6,2': 'club', '6,5': 'safehouse', '4,6': 'hospital', '1,4': 'hospital2', '2,4': 'police',
  '3,7': 'gunshop', '5,3': 'spray', '1,6': 'spray2', '3,1': 'bank', '4,2': 'showroom', '0,1': 'dock9',
  '4,4': 'park', '1,8': 'park', '5,7': 'park',
  '6,7': 'nightclub', '2,6': 'restaurant', '6,0': 'resort', '4,5': 'bar'
};
export function blockKind(bx, bz) {
  const s = SPECIAL[bx + ',' + bz];
  if (s) return s;
  if (bx === NX - 1) return 'strip';
  if (bx <= 1 && bz <= 3) return 'docks';
  if (bx >= 2 && bx <= 5 && bz <= 2) return 'downtown';
  if (bx <= 2 && bz >= 6) return 'havana';
  return 'mid';
}

export function zoneName(x, z) {
  if (x > BEACH_X) return 'Ocean Beach';
  const bx = clamp(Math.floor(x / PITCH), 0, NX - 1), bz = clamp(Math.floor(z / PITCH), 0, NZ - 1);
  if (bx === NX - 1) return 'Ocean Strip';
  if (bx <= 1 && bz <= 3) return 'Starfish Docks';
  if (bz <= 2) return 'Downtown';
  if (bx <= 2 && bz >= 6) return 'Little Coral';
  if (bz >= 6) return 'Palm Heights';
  return 'Midtown';
}

// Point on the sidewalk in front of a block, facing the given road.
function front(bx, bz, side, inset = 3) {
  const r = blockRect(bx, bz);
  if (side === 'e') return { x: r.x1 - inset, z: r.cz, side, bx, bz };
  if (side === 'w') return { x: r.x0 + inset, z: r.cz, side, bx, bz };
  if (side === 'n') return { x: r.cx, z: r.z0 + inset, side, bx, bz };
  return { x: r.cx, z: r.z1 - inset, side, bx, bz };
}

export const PLACES = {
  club: { name: 'Starfish Club', ...front(6, 2, 'e') },
  safehouse: { name: 'Ocean View Hotel', ...front(6, 5, 'e') },
  hospital: { name: 'Coral General', ...front(4, 6, 'n') },
  hospital2: { name: 'Bayside Clinic', ...front(1, 4, 'e') },
  police: { name: 'Coral Bay PD', ...front(2, 4, 'e') },
  gunshop: { name: 'Bullet Bay', ...front(3, 7, 'n') },
  spray: { name: 'Spray & Go', ...front(5, 3, 's') },
  spray2: { name: 'Spray & Go', ...front(1, 6, 'e') },
  bank: { name: 'Coral Federal', ...front(3, 1, 's') },
  showroom: { name: 'Sunrise Autos', ...front(4, 2, 'w', 12) },
  dock9: { name: 'Dock 9', ...front(0, 1, 'e') },
  nightclub: { name: 'Neon Palms', ...front(6, 7, 'e') },
  bar: { name: 'The Driftwood', ...front(4, 5, 'w') },
  restaurant: { name: 'Coral Grill', ...front(2, 6, 'n') },
  resort: { name: 'Sunset Palms Resort', ...front(6, 0, 'e') },
  tiki: { name: 'Tiki Shack', x: 574.5, z: 300, side: 'w' }
};

// ---------- ramps ----------
export const RAMPS = [
  { x: 585, z: 190, dx: 0, dz: 1, len: 10, w: 5, h: 2.4 },
  { x: 595, z: 500, dx: 0, dz: -1, len: 10, w: 5, h: 2.4 },
  { x: 326, z: 342, dx: 1, dz: 0, len: 9, w: 5, h: 2 }
];

// Swimming pools in the venue interiors (far west of the island).
export const POOLS = [];
export function groundHeight(x, z) {
  if (x > SHORE) return -Math.min(2.1, (x - SHORE) * 2.1 / 40);
  if (x < -500) {
    for (const p of POOLS) if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) return -1.3;
    return 0;
  }
  for (const r of RAMPS) {
    const ux = x - r.x, uz = z - r.z;
    const u = ux * r.dx + uz * r.dz, v = ux * -r.dz + uz * r.dx;
    if (u >= 0 && u <= r.len && Math.abs(v) <= r.w / 2) return r.h * u / r.len;
  }
  return 0;
}

// ---------- road graph ----------
export const nodePos = (i, j) => ({ x: i * PITCH, z: j * PITCH });
export function nearestNode(x, z) {
  return { i: clamp(Math.round(x / PITCH), 0, NX), j: clamp(Math.round(z / PITCH), 0, NZ) };
}
export function neighbors(i, j) {
  const out = [];
  if (i > 0) out.push({ i: i - 1, j });
  if (i < NX) out.push({ i: i + 1, j });
  if (j > 0) out.push({ i, j: j - 1 });
  if (j < NZ) out.push({ i, j: j + 1 });
  return out;
}
// Next intersection on a shortest path across the grid.
export function stepToward(a, b) {
  const di = b.i - a.i, dj = b.j - a.j;
  if (!di && !dj) return { i: a.i, j: a.j };
  if (Math.abs(di) >= Math.abs(dj)) return { i: a.i + Math.sign(di), j: a.j };
  return { i: a.i, j: a.j + Math.sign(dj) };
}
export function onRoad(x, z) {
  const mx = ((x % PITCH) + PITCH) % PITCH, mz = ((z % PITCH) + PITCH) % PITCH;
  const inX = x > -HALF && x < CITY_W + HALF, inZ = z > -HALF && z < CITY_H + HALF;
  return inX && inZ && (mx < HALF || mx > PITCH - HALF || mz < HALF || mz > PITCH - HALF);
}

// ---------- collision grid ----------
const CELL = 20;
const grid = new Map();
export const solids = [];
let stamp = 1;
export function addSolid(x0, z0, x1, z1, h, tag) {
  const b = { x0, z0, x1, z1, h, tag, q: 0 };
  solids.push(b);
  for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++)
    for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) {
      const k = cx * 4096 + cz;
      let l = grid.get(k);
      if (!l) grid.set(k, l = []);
      l.push(b);
    }
  return b;
}
const qOut = [];
export function query(x, z, r) {
  qOut.length = 0;
  stamp++;
  for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++)
    for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
      const l = grid.get(cx * 4096 + cz);
      if (!l) continue;
      for (const b of l) if (b.q !== stamp) { b.q = stamp; qOut.push(b); }
    }
  return qOut;
}
export function solidAt(x, y, z) {
  const l = grid.get(Math.floor(x / CELL) * 4096 + Math.floor(z / CELL));
  if (l) for (const b of l) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y < b.h) return b;
  return null;
}
// Pushes p out of every box it overlaps; returns the averaged contact normal.
export function collideCircle(p, r, y = 0) {
  let hit = null;
  for (const b of query(p.x, p.z, r)) {
    if (b.h <= y + 0.3) continue;
    const cx = clamp(p.x, b.x0, b.x1), cz = clamp(p.z, b.z0, b.z1);
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    let nx, nz, pen;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      nx = dx / d; nz = dz / d; pen = r - d;
    } else {
      const l = p.x - b.x0, rr = b.x1 - p.x, t = p.z - b.z0, bo = b.z1 - p.z, m = Math.min(l, rr, t, bo);
      if (m === l) { nx = -1; nz = 0; pen = l + r; }
      else if (m === rr) { nx = 1; nz = 0; pen = rr + r; }
      else if (m === t) { nx = 0; nz = -1; pen = t + r; }
      else { nx = 0; nz = 1; pen = bo + r; }
    }
    p.x += nx * pen; p.z += nz * pen;
    if (!hit) hit = { nx, nz, pen };
    else { hit.nx += nx; hit.nz += nz; hit.pen = Math.max(hit.pen, pen); }
  }
  if (hit) { const l = Math.hypot(hit.nx, hit.nz) || 1; hit.nx /= l; hit.nz /= l; }
  return hit;
}
export function segmentClear(x0, z0, x1, z1, y = 1.4) {
  const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / 2);
  for (let k = 1; k < n; k++) {
    const t = k / n;
    if (solidAt(x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t)) return false;
  }
  return true;
}
// Distance along a 3D ray to the first solid or the ground, up to max.
export function rayWorld(ox, oy, oz, dx, dy, dz, max) {
  for (let t = 0.5; t < max; t += 0.6) {
    const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
    if (y < groundHeight(x, z)) return t;
    if (solidAt(x, y, z)) return t;
  }
  return max;
}

// ---------- lanes & sidewalks ----------
export function laneSpot(a, b, t) {
  const A = nodePos(a.i, a.j), B = nodePos(b.i, b.j);
  const dx = Math.sign(B.x - A.x), dz = Math.sign(B.z - A.z);
  return { x: A.x + (B.x - A.x) * t - dz * LANE, z: A.z + (B.z - A.z) * t + dx * LANE, yaw: Math.atan2(dx, dz) };
}
export function sidewalkCorner(bx, bz, k) {
  const r = blockRect(bx, bz), m = 2.2;
  return [
    { x: r.x0 + m, z: r.z0 + m }, { x: r.x1 - m, z: r.z0 + m },
    { x: r.x1 - m, z: r.z1 - m }, { x: r.x0 + m, z: r.z1 - m }
  ][k & 3];
}

// ---------- textures ----------
const SCALE = 3.2;
const GW = Math.round((LAND.x1 - LAND.x0) * SCALE), GH = Math.round((LAND.z1 - LAND.z0) * SCALE);
const LOT = {
  park: '#5d8f45', docks: '#8c8a84', dock9: '#8c8a84', strip: '#d9c6b8', club: '#d9c6b8', safehouse: '#d9c6b8',
  showroom: '#34353b', downtown: '#a9a59c', bank: '#b9b2a3', havana: '#cdb79d', spray: '#4a4b50', spray2: '#4a4b50'
};

function paintGround(R) {
  const c = document.createElement('canvas');
  c.width = GW; c.height = GH;
  const g = c.getContext('2d');
  const X = x => (x - LAND.x0) * SCALE, Z = z => (z - LAND.z0) * SCALE;
  g.fillStyle = '#b7afa2'; g.fillRect(0, 0, GW, GH);
  // beach
  const sand = g.createLinearGradient(X(BEACH_X), 0, X(SHORE), 0);
  sand.addColorStop(0, '#ead7aa'); sand.addColorStop(0.75, '#e2c995'); sand.addColorStop(1, '#bfa577');
  g.fillStyle = sand; g.fillRect(X(BEACH_X), 0, X(SHORE) - X(BEACH_X), GH);
  for (let n = 0; n < 9000; n++) {
    g.fillStyle = `rgba(${R() < 0.5 ? '120,95,60' : '255,250,235'},${0.08 + R() * 0.1})`;
    g.fillRect(X(BEACH_X + R() * (SHORE - BEACH_X)), R() * GH, 1.5, 1.5);
  }
  const towel = ['#ff5d8f', '#3dc6e0', '#ffd23f', '#9b6bff', '#ffffff', '#ff8a3d'];
  for (let n = 0; n < 70; n++) {
    const x = X(BEACH_X + 14 + R() * 70), z = R() * GH, horiz = R() < 0.5;
    g.fillStyle = towel[n % towel.length];
    g.fillRect(x, z, horiz ? 6 : 3, horiz ? 3 : 6);
  }
  // blocks
  for (let bx = 0; bx < NX; bx++) for (let bz = 0; bz < NZ; bz++) {
    const r = blockRect(bx, bz), k = blockKind(bx, bz);
    g.fillStyle = '#c4bcaf'; g.fillRect(X(r.x0), Z(r.z0), BLOCK * SCALE, BLOCK * SCALE);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(X(r.x0), Z(r.z0), BLOCK * SCALE, 1.5);
    g.fillRect(X(r.x0), Z(r.z0), 1.5, BLOCK * SCALE);
    g.fillStyle = LOT[k] || '#aaa59b';
    g.fillRect(X(r.x0 + 4), Z(r.z0 + 4), (BLOCK - 8) * SCALE, (BLOCK - 8) * SCALE);
    if (k === 'park') {
      g.fillStyle = '#d8c9a4';
      g.fillRect(X(r.cx - 1.5), Z(r.z0 + 4), 3 * SCALE, (BLOCK - 8) * SCALE);
      g.fillRect(X(r.x0 + 4), Z(r.cz - 1.5), (BLOCK - 8) * SCALE, 3 * SCALE);
      g.beginPath(); g.arc(X(r.cx), Z(r.cz), 8 * SCALE, 0, 7); g.fill();
      for (let n = 0; n < 400; n++) {
        g.fillStyle = `rgba(${R() < 0.5 ? '40,80,30' : '120,170,80'},.25)`;
        g.fillRect(X(r.x0 + 4 + R() * (BLOCK - 8)), Z(r.z0 + 4 + R() * (BLOCK - 8)), 2, 2);
      }
    }
    if (k === 'showroom' || k === 'spray' || k === 'spray2') {
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.2;
      for (let s = 0; s < 6; s++) {
        const xx = X(r.x0 + 8 + s * 4.5);
        g.beginPath(); g.moveTo(xx, Z(r.z0 + 6)); g.lineTo(xx, Z(r.z0 + 12)); g.stroke();
      }
    }
  }
  // roads
  const asphalt = '#2d2e34';
  g.fillStyle = asphalt;
  for (let i = 0; i <= NX; i++) g.fillRect(X(i * PITCH - HALF), Z(-HALF), ROAD * SCALE, (CITY_H + ROAD) * SCALE);
  for (let j = 0; j <= NZ; j++) g.fillRect(X(-HALF), Z(j * PITCH - HALF), (CITY_W + ROAD) * SCALE, ROAD * SCALE);
  for (let n = 0; n < 50000; n++) {
    const x = R() * (CITY_W + ROAD) - HALF, z = R() * (CITY_H + ROAD) - HALF;
    if (!onRoad(x, z)) continue;
    g.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${0.04 + R() * 0.05})`;
    g.fillRect(X(x), Z(z), 2, 2);
  }
  // markings
  const line = (x0, z0, x1, z1, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(X(x0), Z(z0)); g.lineTo(X(x1), Z(z1)); g.stroke(); };
  const yellow = '#e6b93a', white = 'rgba(240,240,240,.85)';
  for (let i = 0; i <= NX; i++) for (let j = 0; j < NZ; j++) {
    const x = i * PITCH, z0 = j * PITCH + HALF + 3, z1 = (j + 1) * PITCH - HALF - 3;
    line(x - 0.3, z0, x - 0.3, z1, yellow, 1.1); line(x + 0.3, z0, x + 0.3, z1, yellow, 1.1);
    line(x - 7, z0, x - 7, z1, white, 1); line(x + 7, z0, x + 7, z1, white, 1);
  }
  for (let j = 0; j <= NZ; j++) for (let i = 0; i < NX; i++) {
    const z = j * PITCH, x0 = i * PITCH + HALF + 3, x1 = (i + 1) * PITCH - HALF - 3;
    line(x0, z - 0.3, x1, z - 0.3, yellow, 1.1); line(x0, z + 0.3, x1, z + 0.3, yellow, 1.1);
    line(x0, z - 7, x1, z - 7, white, 1); line(x0, z + 7, x1, z + 7, white, 1);
  }
  // crosswalks
  g.fillStyle = 'rgba(240,240,240,.8)';
  for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) {
    const x = i * PITCH, z = j * PITCH;
    for (let s = -6; s <= 6; s += 1.6) {
      if (j < NZ) g.fillRect(X(x + s - 0.4), Z(z + HALF + 0.4), 0.8 * SCALE, 2.4 * SCALE);
      if (j > 0) g.fillRect(X(x + s - 0.4), Z(z - HALF - 2.8), 0.8 * SCALE, 2.4 * SCALE);
      if (i < NX) g.fillRect(X(x + HALF + 0.4), Z(z + s - 0.4), 2.4 * SCALE, 0.8 * SCALE);
      if (i > 0) g.fillRect(X(x - HALF - 2.8), Z(z + s - 0.4), 2.4 * SCALE, 0.8 * SCALE);
    }
  }
  return c;
}

export function paintRadar(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const span = 820, x0 = -60, z0 = -60, s = size / span;
  const X = x => (x - x0) * s, Z = z => (z - z0) * s;
  g.fillStyle = '#245a86'; g.fillRect(0, 0, size, size);
  g.fillStyle = '#3c4a3f'; g.fillRect(X(LAND.x0), Z(LAND.z0), (BEACH_X - LAND.x0) * s, (LAND.z1 - LAND.z0) * s);
  g.fillStyle = '#d9c38c'; g.fillRect(X(BEACH_X), Z(LAND.z0), (SHORE + 8 - BEACH_X) * s, (LAND.z1 - LAND.z0) * s);
  for (let bx = 0; bx < NX; bx++) for (let bz = 0; bz < NZ; bz++) {
    const r = blockRect(bx, bz), k = blockKind(bx, bz);
    g.fillStyle = k === 'park' ? '#4f7f3c' : k === 'docks' || k === 'dock9' ? '#5a5f63' : '#55606c';
    g.fillRect(X(r.x0), Z(r.z0), BLOCK * s, BLOCK * s);
  }
  g.fillStyle = '#d6dbe3';
  for (let i = 0; i <= NX; i++) g.fillRect(X(i * PITCH - HALF), Z(-HALF), ROAD * s, (CITY_H + ROAD) * s);
  for (let j = 0; j <= NZ; j++) g.fillRect(X(-HALF), Z(j * PITCH - HALF), (CITY_W + ROAD) * s, ROAD * s);
  return { canvas: c, x0, z0, span };
}

export function signTexture(text, color, font = 'Kaushan Script') {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const px = 96;
  g.font = `${px}px "${font}", cursive`;
  const w = Math.ceil(g.measureText(text).width) + 80;
  c.width = w; c.height = 150;
  g.font = `${px}px "${font}", cursive`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 26;
  g.fillStyle = color; g.fillText(text, w / 2, 78);
  g.shadowBlur = 8; g.fillStyle = '#fff'; g.globalAlpha = 0.85; g.fillText(text, w / 2, 78);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { tex: t, aspect: w / 150 };
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,220,160,.75)'); grd.addColorStop(0.45, 'rgba(255,190,120,.25)'); grd.addColorStop(1, 'rgba(255,170,100,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- building material: windows drawn from world position ----------
const STYLES = {
  glass: { win: [2.2, 3.4, 0.07, 0.42], glass: '#22344a', shop: 1 },
  deco: { win: [3.0, 3.4, 0.3, 0.5], glass: '#2b3242', shop: 1 },
  plain: { win: [4.2, 3.6, 0.3, 0.38], glass: '#2e3238', shop: 0 }
};
export const nightUniform = { value: 0 };

function buildingMaterial(style) {
  const s = STYLES[style];
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: style === 'glass' ? 0.45 : 0.85, metalness: style === 'glass' ? 0.25 : 0.02 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uNight = nightUniform;
    sh.uniforms.uWin = { value: new THREE.Vector4(...s.win) };
    sh.uniforms.uGlass = { value: new THREE.Color(s.glass) };
    sh.uniforms.uShop = { value: s.shop };
    sh.vertexShader = 'attribute float aTop;\nattribute float aSeed;\nvarying vec3 vWP;\nvarying vec3 vWN;\nvarying float vTop;\nvarying float vSeed;\n' + sh.vertexShader
      .replace('#include <project_vertex>', `#include <project_vertex>
        vWP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        vWN = normalize(mat3(instanceMatrix) * objectNormal);
        vTop = aTop; vSeed = aSeed;`);
    sh.fragmentShader = 'uniform float uNight;\nuniform vec4 uWin;\nuniform vec3 uGlass;\nuniform float uShop;\nvarying vec3 vWP;\nvarying vec3 vWN;\nvarying float vTop;\nvarying float vSeed;\nfloat bWin = 0.0; float bLit = 0.0; vec3 bTint = vec3(1.0);\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float wall = 1.0 - step(0.6, abs(vWN.y));
          float along = abs(vWN.x) > 0.5 ? vWP.z : vWP.x;
          vec2 g = vec2(along / uWin.x, vWP.y / uWin.y);
          vec2 id = floor(g); vec2 f = fract(g);
          float w = step(uWin.z, f.x) * step(f.x, 1.0 - uWin.z) * step(0.3, f.y) * step(f.y, 0.78);
          w *= wall * step(0.5, id.y) * step(vWP.y, vTop - 1.4);
          float sd = floor(vSeed * 97.0 + 0.5);
          float r = fract(sin(dot(id + vec2(sd * 7.0, sd * 3.0), vec2(12.9898, 78.233))) * 43758.5453);
          float shop = uShop * wall * step(0.35, vWP.y) * step(vWP.y, 2.7) * step(0.1, fract(along / 6.0)) * step(fract(along / 6.0), 0.9) * step(4.0, vTop);
          bWin = max(w, shop);
          bLit = max(w * step(1.0 - uWin.w, r), shop);
          bTint = mix(vec3(1.0, 0.74, 0.42), vec3(0.62, 0.84, 1.0), step(0.72, fract(r * 7.0)));
          bTint = mix(bTint, vec3(1.0, 0.55, 0.85), shop * step(0.5, fract(sd * 0.37)));
          diffuseColor.rgb = mix(diffuseColor.rgb, mix(uGlass * 2.4 + vec3(0.05, 0.08, 0.12), uGlass, uNight), bWin * 0.88);
          diffuseColor.rgb *= mix(1.0, 0.62, step(0.6, vWN.y));
          diffuseColor.rgb *= mix(0.86, 1.0, smoothstep(0.0, 6.0, vWP.y));
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += bLit * uNight * bTint * 0.95;`);
  };
  return m;
}

// ---------- palm geometry ----------
export function palmGeometries() {
  const trunk = new THREE.CylinderGeometry(0.16, 0.26, 1, 6, 6);
  trunk.translate(0, 0.5, 0);
  const p = trunk.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + 0.9 * y * y); }
  trunk.computeVertexNormals();
  const fronds = [];
  for (let k = 0; k < 8; k++) {
    const pos = [], idx = [];
    const seg = 6, len = 3.4;
    for (let s = 0; s <= seg; s++) {
      const t = s / seg, r = t * len, y = 0.35 * t - 1.25 * t * t, w = 0.55 * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08));
      pos.push(r, y, -w, r, y - 0.06, w);
      if (s < seg) { const a = s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.rotateZ(0.12 * (k % 3));
    g.rotateY(k / 8 * Math.PI * 2 + (k % 2) * 0.2);
    fronds.push(g);
  }
  const all = [];
  for (const f of fronds) all.push(...f.toNonIndexed().attributes.position.array);
  const crown = new THREE.BufferGeometry();
  crown.setAttribute('position', new THREE.Float32BufferAttribute(all, 3));
  crown.computeVertexNormals();
  return { trunk, crown };
}

// Instanced building boxes per window style; returns the meshes.
export function buildingMeshes(scene, blds) {
  const tmp = new THREE.Object3D(), col = new THREE.Color(), out = [];
  for (const st of Object.keys(blds)) {
    const list = blds[st];
    if (!list.length) continue;
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const top = new Float32Array(list.length), seed = new Float32Array(list.length);
    const mesh = new THREE.InstancedMesh(geo, buildingMaterial(st), list.length);
    list.forEach((b, i) => {
      tmp.position.set((b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2);
      tmp.scale.set(b.x1 - b.x0, b.h, b.z1 - b.z0);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
      mesh.setColorAt(i, col.set(b.color));
      top[i] = b.h; seed[i] = b.seed ?? Math.random();
    });
    geo.setAttribute('aTop', new THREE.InstancedBufferAttribute(top, 1));
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    out.push(mesh);
  }
  return out;
}

// ---------- the world ----------
export function buildCity(scene, quality) {
  const R = rng(1986);
  const pick = a => a[Math.floor(R() * a.length)];
  const lerp = (a, b) => a + R() * (b - a);
  const blds = { glass: [], deco: [], plain: [] };
  const trims = [], props = [], palms = [], signs = [], lamps = [], umbrellas = [];
  const parking = [];
  const PASTEL = ['#f6b7c9', '#a8e6cf', '#c9b6f2', '#ffd3a5', '#fdf1b8', '#9fd8f0', '#f7f3ea', '#ffc0a8'];
  const TOWER = ['#8193a8', '#647790', '#9aa8b6', '#56707f', '#b8c4cc', '#707d8f', '#8aa0b0'];
  const STUCCO = ['#e98a6b', '#f2c46d', '#77c3b5', '#e46f8e', '#f0e0c0', '#8fb3e0', '#d9a3e0', '#f2a65a'];
  const WARE = ['#8a8f96', '#a07862', '#6d7f8c', '#b5a48a', '#7f8a78'];
  const NEON = ['#ff2fa0', '#21e6ff', '#b04dff', '#ff8a1f', '#3dff9e', '#ff5edb'];

  function trim(x0, z0, x1, z1, y, col) {
    const t = 0.22;
    trims.push([x0, y, z0 - t / 2, x1 - x0, t, t, col], [x0, y, z1 - t / 2, x1 - x0, t, t, col]);
    trims.push([x0 - t / 2, y, z0, t, t, z1 - z0, col], [x1 - t / 2, y, z0, t, t, z1 - z0, col]);
  }
  function building(x0, z0, x1, z1, h, style, color, opt = {}) {
    blds[style].push({ x0, z0, x1, z1, h, color, seed: R() });
    addSolid(x0, z0, x1, z1, h, 'building');
    if (opt.trim) {
      trim(x0, z0, x1, z1, h - 0.15, opt.trim);
      if (opt.band) trim(x0, z0, x1, z1, Math.min(4.2, h * 0.3), opt.band);
      if (opt.corners) for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) trims.push([cx - 0.12, 0.5, cz - 0.12, 0.24, h - 1, 0.24, opt.trim]);
    }
    if (opt.roof !== false && style !== 'glass' && h < 40) {
      const n = 1 + Math.floor(R() * 3);
      for (let k = 0; k < n; k++) {
        const w = lerp(1.6, 3), d = lerp(1.4, 2.6);
        const x = lerp(x0 + 1, x1 - 1 - w), z = lerp(z0 + 1, z1 - 1 - d);
        props.push([x, h, z, w, lerp(0.9, 1.6), d, '#9aa0a6']);
      }
    }
  }
  function sign(text, col, x, y, z, nx, nz, width) {
    signs.push({ text, col, x, y, z, nx, nz, width });
  }
  function faceSign(r, side, text, col, h, widthMax = 22) {
    const w = Math.min(widthMax, (side === 'e' || side === 'w' ? r.z1 - r.z0 : r.x1 - r.x0) * 0.8);
    const y = h - 2.6;
    if (side === 'e') sign(text, col, r.x1 + 0.12, y, (r.z0 + r.z1) / 2, 1, 0, w);
    if (side === 'w') sign(text, col, r.x0 - 0.12, y, (r.z0 + r.z1) / 2, -1, 0, w);
    if (side === 's') sign(text, col, (r.x0 + r.x1) / 2, y, r.z1 + 0.12, 0, 1, w);
    if (side === 'n') sign(text, col, (r.x0 + r.x1) / 2, y, r.z0 - 0.12, 0, -1, w);
  }
  // building footprint on a special block, leaving a forecourt on the front side
  function lot(bx, bz, side, depthCut = 8) {
    const r = blockRect(bx, bz);
    const o = { x0: r.x0 + 6, z0: r.z0 + 6, x1: r.x1 - 6, z1: r.z1 - 6 };
    if (side === 'e') o.x1 -= depthCut; if (side === 'w') o.x0 += depthCut;
    if (side === 's') o.z1 -= depthCut; if (side === 'n') o.z0 += depthCut;
    return o;
  }
  function palm(x, z, solid = true) {
    palms.push({ x, z, h: lerp(7, 11.5), yaw: R() * Math.PI * 2 });
    if (solid) addSolid(x - 0.32, z - 0.32, x + 0.32, z + 0.32, 6, 'palm');
  }

  for (let bx = 0; bx < NX; bx++) for (let bz = 0; bz < NZ; bz++) {
    const r = blockRect(bx, bz), k = blockKind(bx, bz);
    const I = { x0: r.x0 + 4, z0: r.z0 + 4, x1: r.x1 - 4, z1: r.z1 - 4 };
    const W = I.x1 - I.x0;
    if (k === 'downtown') {
      if (R() < 0.5) {
        const c = pick(TOWER), h = lerp(45, 95);
        building(I.x0, I.z0, I.x1, I.z1, 9, 'glass', c);
        building(I.x0 + 7, I.z0 + 7, I.x1 - 7, I.z1 - 7, h, 'glass', c, { trim: R() < 0.6 ? pick(NEON) : null });
        building(I.x0 + 13, I.z0 + 13, I.x1 - 13, I.z1 - 13, h + lerp(4, 10), 'glass', pick(TOWER));
      } else {
        const m = I.x0 + W / 2;
        building(I.x0, I.z0, m - 2, I.z1, lerp(30, 70), 'glass', pick(TOWER), { trim: R() < 0.4 ? pick(NEON) : null });
        building(m + 2, I.z0, I.x1, I.z1 - 14, lerp(25, 60), 'glass', pick(TOWER));
        building(m + 2, I.z1 - 12, I.x1, I.z1, 6, 'deco', pick(PASTEL));
      }
    } else if (k === 'strip') {
      const n = R() < 0.5 ? 2 : 3, step = (I.z1 - I.z0) / n;
      for (let s = 0; s < n; s++) {
        const z0 = I.z0 + s * step + 1, z1 = I.z0 + (s + 1) * step - 1, h = lerp(12, 26);
        const neon = pick(NEON);
        building(I.x0 + 8, z0, I.x1 - 4, z1, h, 'deco', pick(PASTEL), { trim: neon, band: pick(NEON), corners: R() < 0.5 });
        props.push([I.x1 - 4, 3.6, z0 + 2, 3.2, 0.35, z1 - z0 - 4, pick(PASTEL)]);
        faceSign({ x0: I.x0 + 8, z0, x1: I.x1 - 4, z1 }, 'e', pick(['Flamingo', 'Coral', 'Sundown', 'Atlantic', 'Paradise', 'Marina', 'Tropicana', 'Seabreeze', 'Pelican', 'Royal Palm']), neon, h, 16);
      }
    } else if (k === 'havana') {
      const cols = 2 + Math.floor(R() * 2), rows = 2;
      const cw = W / cols, ch = (I.z1 - I.z0) / rows;
      for (let a = 0; a < cols; a++) for (let b = 0; b < rows; b++) {
        if (R() < 0.12) continue;
        building(I.x0 + a * cw + 1, I.z0 + b * ch + 1, I.x0 + (a + 1) * cw - 1, I.z0 + (b + 1) * ch - 1, lerp(6, 11), 'plain', pick(STUCCO), { trim: R() < 0.3 ? pick(NEON) : null });
      }
    } else if (k === 'docks') {
      building(I.x0, I.z0, I.x1, I.z0 + 26, lerp(9, 13), 'plain', pick(WARE), { roof: false });
      for (let cx = I.x0 + 2; cx < I.x1 - 8; cx += 7) for (let cz = I.z0 + 32; cz < I.z1 - 3; cz += 3.4) {
        if (R() < 0.25) continue;
        const stack = 1 + Math.floor(R() * 3);
        for (let s = 0; s < stack; s++) props.push([cx, s * 2.6, cz, 6, 2.55, 2.6, pick(['#c0392b', '#2f6db5', '#e0a526', '#2e8b57', '#8e44ad', '#d35400', '#7f8c8d'])]);
        addSolid(cx, cz, cx + 6, cz + 2.6, stack * 2.6, 'container');
      }
    } else if (k === 'park') {
      props.push([r.cx - 3, 0, r.cz - 3, 6, 0.7, 6, '#d7d2c4']);
      props.push([r.cx - 0.5, 0.7, r.cz - 0.5, 1, 1.4, 1, '#cfc8b8']);
      addSolid(r.cx - 3, r.cz - 3, r.cx + 3, r.cz + 3, 0.9, 'fountain');
      for (let n = 0; n < 14; n++) {
        const x = lerp(I.x0 + 2, I.x1 - 2), z = lerp(I.z0 + 2, I.z1 - 2);
        if (Math.abs(x - r.cx) < 6 || Math.abs(z - r.cz) < 6) continue;
        palm(x, z);
      }
    } else if (k === 'mid') {
      const split = Math.floor(R() * 4);
      const lots = split === 0 ? [[0, 0, 1, 1]] : split === 1 ? [[0, 0, 0.5, 1], [0.5, 0, 1, 1]] : split === 2 ? [[0, 0, 1, 0.5], [0, 0.5, 1, 1]] : [[0, 0, 0.5, 0.5], [0.5, 0, 1, 0.5], [0, 0.5, 0.5, 1], [0.5, 0.5, 1, 1]];
      for (const [a, b, c, d] of lots) {
        const st = R() < 0.3 ? 'glass' : R() < 0.6 ? 'deco' : 'plain';
        const col = st === 'glass' ? pick(TOWER) : st === 'deco' ? pick(PASTEL) : pick(STUCCO);
        building(I.x0 + a * W + 1, I.z0 + b * W + 1, I.x0 + c * W - 1, I.z0 + d * W - 1, st === 'glass' ? lerp(18, 40) : lerp(9, 24), st, col, { trim: R() < 0.35 ? pick(NEON) : null });
      }
    } else {
      // special landmarks
      const P = Object.values(PLACES).find(p => p.bx === bx && p.bz === bz);
      const side = P.side, L = lot(bx, bz, side, k === 'showroom' ? 22 : 8);
      const spec = {
        club: ['deco', '#ff9fc6', 15, '#ff2fa0', 'Starfish', '#21e6ff'],
        safehouse: ['deco', '#a8e6cf', 24, '#21e6ff', 'Ocean View', '#ff5edb'],
        hospital: ['plain', '#f2f2ee', 20, '#ff3b3b', 'Hospital', '#ff3b3b'],
        hospital2: ['plain', '#eef2f2', 12, '#ff3b3b', 'Clinic', '#ff3b3b'],
        police: ['plain', '#3f5f8f', 15, '#3d8bff', 'Police', '#5fb0ff'],
        gunshop: ['plain', '#4b4440', 8, '#ff8a1f', 'Bullet Bay', '#ff8a1f'],
        spray: ['plain', '#57606b', 7, '#ff2fa0', 'Spray & Go', '#ff5edb'],
        spray2: ['plain', '#6b5f57', 7, '#ff2fa0', 'Spray & Go', '#ff5edb'],
        bank: ['glass', '#c9b98f', 62, '#ffd36b', 'Coral Federal', '#ffd36b'],
        showroom: ['glass', '#d9e4ec', 9, '#ff8a1f', 'Sunrise Autos', '#ffb347'],
        dock9: ['plain', '#8a8f96', 12, '#3dff9e', 'Dock 9', '#3dff9e'],
        nightclub: ['deco', '#3a2050', 16, '#b04dff', 'Neon Palms', '#ff2fa0'],
        bar: ['plain', '#6b4a33', 8, '#ff8a1f', 'Driftwood', '#ffb347'],
        restaurant: ['plain', '#f2c46d', 9, '#ff8a1f', 'Coral Grill', '#ffb347'],
        resort: ['deco', '#ffd3a5', 24, '#21e6ff', 'Sunset Palms', '#21e6ff']
      }[k];
      building(L.x0, L.z0, L.x1, L.z1, spec[2], spec[0], spec[1], { trim: spec[3], band: k === 'nightclub' ? '#21e6ff' : null, corners: k === 'club' || k === 'safehouse' || k === 'nightclub' || k === 'resort' });
      faceSign(L, side, spec[4], spec[5], Math.min(spec[2], 14), 20);
      if (k === 'showroom') for (let s = 0; s < 3; s++) parking.push({ x: blockRect(bx, bz).x0 + 10, z: blockRect(bx, bz).z0 + 14 + s * 14, yaw: Math.PI / 2, lot: 'showroom' });
    }
  }

  // lamps on every block side, palms on Ocean Drive and the beach
  for (let bx = 0; bx < NX; bx++) for (let bz = 0; bz < NZ; bz++) {
    const r = blockRect(bx, bz);
    for (const t of [0.25, 0.75]) {
      const x = r.x0 + BLOCK * t, z = r.z0 + BLOCK * t;
      lamps.push({ x, z: r.z0 + 0.9, ax: 0, az: -1 }, { x, z: r.z1 - 0.9, ax: 0, az: 1 });
      lamps.push({ x: r.x0 + 0.9, z, ax: -1, az: 0 });
      if (bx < NX - 1) lamps.push({ x: r.x1 - 0.9, z, ax: 1, az: 0 });
    }
    // parked cars along the curb
    if (R() < 0.55) {
      const side = Math.floor(R() * 4), t = lerp(0.25, 0.75);
      if (side === 0) parking.push({ x: r.x0 + BLOCK * t, z: r.z0 - 6.4, yaw: Math.PI / 2 });
      if (side === 1) parking.push({ x: r.x0 + BLOCK * t, z: r.z1 + 6.4, yaw: -Math.PI / 2 });
      if (side === 2 && bx > 0) parking.push({ x: r.x0 - 6.4, z: r.z0 + BLOCK * t, yaw: Math.PI });
      if (side === 3 && bx < NX - 1) parking.push({ x: r.x1 + 6.4, z: r.z0 + BLOCK * t, yaw: 0 });
    }
  }
  for (let z = 6; z < CITY_H; z += 13) {
    if (Math.abs(((z + HALF) % PITCH) - HALF) < HALF + 2) continue;
    palm(CITY_W - HALF - 1.3, z);
    palm(BEACH_X + 1.6, z + 6);
  }
  for (let n = 0; n < 46; n++) palm(lerp(BEACH_X + 10, SHORE - 6), lerp(0, CITY_H));
  const UMB = ['#ff5d8f', '#3dc6e0', '#ffd23f', '#9b6bff', '#ff8a3d', '#5fe08a'];
  for (let n = 0; n < 34; n++) {
    const x = lerp(BEACH_X + 16, SHORE - 14), z = lerp(4, CITY_H - 4);
    umbrellas.push({ x, z, col: UMB[n % UMB.length] });
    props.push([x - 0.05, 0, z - 0.05, 0.1, 2.3, 0.1, '#eeeeee']);
  }
  for (const z of [110, 340, 590]) {
    const x = SHORE - 22;
    for (const [a, b] of [[0, 0], [2.4, 0], [0, 2.4], [2.4, 2.4]]) props.push([x + a, 0, z + b, 0.2, 2.6, 0.2, '#f2f2f2']);
    props.push([x - 0.3, 2.6, z - 0.3, 3.2, 2.2, 3.2, pick(PASTEL)]);
    props.push([x - 0.6, 4.8, z - 0.6, 3.8, 0.25, 3.8, '#ff5d8f']);
    addSolid(x, z, x + 2.6, z + 2.6, 5, 'tower');
  }
  // tiki shack on the beach
  {
    const tx = 578, tz = 300;
    for (const [a, b] of [[0, -3], [4, -3], [0, 3], [4, 3]]) props.push([tx + a - 0.12, 0, tz + b - 0.12, 0.24, 3.2, 0.24, '#7a5634']);
    props.push([tx - 0.6, 0, tz - 3, 1, 1.1, 6, '#9b6b3c']);
    props.push([tx - 0.7, 1.1, tz - 3.1, 1.2, 0.08, 6.2, '#c9965a']);
    props.push([tx + 3, 0, tz - 2.5, 0.5, 2.2, 5, '#6b4a2b']);
    for (let k = 0; k < 6; k++) props.push([tx + 3.1, 1.6, tz - 2.2 + k * 0.85, 0.12, 0.35, 0.12, ['#ff5d8f', '#ffd23f', '#5fe08a', '#3dc6e0'][k % 4]]);
    addSolid(tx - 0.6, tz - 3, tx + 3.5, tz + 3, 3, 'tiki');
    umbrellas.push({ x: tx + 2, z: tz, col: '#c9a35a', big: true });
    trims.push([tx - 0.7, 1.2, tz - 3.1, 0.1, 0.1, 6.2, '#ff2fa0']);
    signs.push({ text: 'Tiki', col: '#ffb347', x: tx - 0.9, y: 1.85, z: tz, nx: -1, nz: 0, width: 2.6 });
  }
  // sea walls
  const wall = (x0, z0, x1, z1) => { props.push([x0, -1.6, z0, x1 - x0, 2.5, z1 - z0, '#9c968a']); addSolid(x0, z0, x1, z1, 12, 'wall'); };
  wall(LAND.x0 - 1.2, LAND.z0 - 1.2, LAND.x0, LAND.z1 + 1.2);
  wall(LAND.x0 - 1.2, LAND.z0 - 1.2, DEEP + 30, LAND.z0);
  wall(LAND.x0 - 1.2, LAND.z1, DEEP + 30, LAND.z1 + 1.2);

  // ---------- meshes ----------
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0.5, 0.5);
  const tmp = new THREE.Object3D(), col = new THREE.Color();
  buildingMeshes(scene, blds);

  // lamp poles + arms go into the prop list
  for (const l of lamps) {
    props.push([l.x - 0.09, 0, l.z - 0.09, 0.18, 7, 0.18, '#3a3d44']);
    const ax0 = l.x + Math.min(0, l.ax * 2.2), az0 = l.z + Math.min(0, l.az * 2.2);
    props.push([ax0 - (l.az ? 0.06 : 0), 6.85, az0 - (l.ax ? 0.06 : 0), l.ax ? 2.2 : 0.12, 0.12, l.az ? 2.2 : 0.12, '#3a3d44']);
  }
  {
    const mesh = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ roughness: 0.8 }), props.length);
    props.forEach((p, i) => {
      tmp.position.set(p[0], p[1], p[2]); tmp.scale.set(p[3], p[4], p[5]); tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix); mesh.setColorAt(i, col.set(p[6]));
    });
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
  }
  const neonMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  {
    const mesh = new THREE.InstancedMesh(box, neonMat, trims.length);
    trims.forEach((p, i) => {
      tmp.position.set(p[0], p[1], p[2]); tmp.scale.set(p[3], p[4], p[5]); tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix); mesh.setColorAt(i, col.set(p[6]));
    });
    mesh.frustumCulled = false;
    scene.add(mesh);
  }
  // bulbs + light pools
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const bulbs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.16, 0.36), bulbMat, lamps.length);
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(11, 11).rotateX(-Math.PI / 2), poolMat, lamps.length);
  lamps.forEach((l, i) => {
    const x = l.x + l.ax * 2.1, z = l.z + l.az * 2.1;
    tmp.position.set(x, 6.78, z); tmp.scale.set(1, 1, 1);
    tmp.rotation.y = l.ax ? Math.PI / 2 : 0; tmp.updateMatrix();
    bulbs.setMatrixAt(i, tmp.matrix);
    tmp.rotation.y = 0; tmp.position.set(x, 0.04, z); tmp.updateMatrix();
    pools.setMatrixAt(i, tmp.matrix);
  });
  bulbs.frustumCulled = pools.frustumCulled = false;
  pools.renderOrder = 1;
  scene.add(bulbs, pools);

  // palms
  const pg = palmGeometries();
  const trunks = new THREE.InstancedMesh(pg.trunk, new THREE.MeshStandardMaterial({ color: '#8a6f4e', roughness: 0.95 }), palms.length);
  const crowns = new THREE.InstancedMesh(pg.crown, new THREE.MeshStandardMaterial({ color: '#3f8a3a', roughness: 0.8, side: THREE.DoubleSide }), palms.length);
  palms.forEach((p, i) => {
    tmp.position.set(p.x, 0, p.z); tmp.rotation.set(0, p.yaw, 0); tmp.scale.set(1, p.h, 1); tmp.updateMatrix();
    trunks.setMatrixAt(i, tmp.matrix);
    const lean = 0.9;
    tmp.position.set(p.x + Math.cos(p.yaw) * lean, p.h - 0.1, p.z - Math.sin(p.yaw) * lean);
    tmp.scale.set(1.1, 1, 1.1); tmp.rotation.set(0, R() * 6, 0); tmp.updateMatrix();
    crowns.setMatrixAt(i, tmp.matrix);
    crowns.setColorAt(i, col.set(pick(['#4a9a3c', '#3c8536', '#5aa845', '#2f7a34'])));
  });
  trunks.castShadow = crowns.castShadow = true;
  trunks.frustumCulled = crowns.frustumCulled = false;
  scene.add(trunks, crowns);

  // umbrellas
  {
    const mesh = new THREE.InstancedMesh(new THREE.ConeGeometry(1.8, 0.7, 8), new THREE.MeshStandardMaterial({ roughness: 0.7 }), umbrellas.length);
    umbrellas.forEach((u, i) => {
      tmp.position.set(u.x, u.big ? 3.6 : 2.5, u.z); tmp.rotation.set(0, 0, 0); tmp.scale.setScalar(u.big ? 2.6 : 1); tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix); mesh.setColorAt(i, col.set(u.col));
    });
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
  }

  // signs
  for (const s of signs) {
    const { tex, aspect } = signTexture(s.text, s.col);
    const w = Math.min(s.width, 4.2 * aspect), h = w / aspect;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: 0xffffff }));
    m.position.set(s.x, s.y, s.z);
    m.rotation.y = Math.atan2(s.nx, s.nz);
    m.userData.sign = true;
    scene.add(m);
    s.mesh = m;
  }

  // ramps
  for (const r of RAMPS) {
    const g = new THREE.BufferGeometry();
    const hw = r.w / 2, L = r.len, H = r.h;
    const v = [
      -hw, 0, 0, hw, 0, 0, hw, H, L, -hw, 0, 0, hw, H, L, -hw, H, L,
      hw, 0, 0, hw, 0, L, hw, H, L, -hw, 0, 0, -hw, H, L, -hw, 0, L,
      -hw, 0, L, -hw, H, L, hw, H, L, -hw, 0, L, hw, H, L, hw, 0, L
    ];
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#d39b3c', roughness: 0.7, side: THREE.DoubleSide }));
    m.position.set(r.x, 0, r.z);
    m.rotation.y = Math.atan2(r.dx, r.dz);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  }

  // ground
  const groundCanvas = paintGround(R);
  const gtex = new THREE.CanvasTexture(groundCanvas);
  gtex.colorSpace = THREE.SRGBColorSpace;
  gtex.anisotropy = 8;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(LAND.x1 - LAND.x0, LAND.z1 - LAND.z0).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: gtex, roughness: 0.92 }));
  ground.position.set((LAND.x0 + LAND.x1) / 2, 0, (LAND.z0 + LAND.z1) / 2);
  ground.receiveShadow = true;
  scene.add(ground);
  const slope = new THREE.PlaneGeometry(40, LAND.z1 - LAND.z0 + 2, 1, 1).rotateX(-Math.PI / 2);
  const sp = slope.attributes.position;
  for (let i = 0; i < sp.count; i++) if (sp.getX(i) > 0) sp.setY(i, -2.1);
  slope.computeVertexNormals();
  const shore = new THREE.Mesh(slope, new THREE.MeshStandardMaterial({ color: '#b89c6c', roughness: 1 }));
  shore.position.set(SHORE + 20, 0, (LAND.z0 + LAND.z1) / 2);
  shore.receiveShadow = true;
  scene.add(shore);

  return {
    parking,
    setNight(n) {
      nightUniform.value = n;
      const k = 0.55 + n * 1.6;
      neonMat.color.setRGB(k, k, k);
      bulbMat.color.setRGB(0.6 + n * 2.6, 0.55 + n * 2.1, 0.45 + n * 1.4);
      poolMat.opacity = n * 0.85;
      for (const s of signs) s.mesh.material.color.setScalar(0.6 + n * 1.3);
    }
  };
}
