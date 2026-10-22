// Places to walk into: the Neon Palms nightclub (bar + dance floor), the
// Coral Grill restaurant, the Sunset Palms resort (pool, loungers, pool bar)
// and the beach Tiki Shack. Interiors are built far west of the island and
// the player is moved there through the front door. Each venue can be bought
// and pays a daily income into its office till.
import * as THREE from 'three';
import { addSolid, buildingMeshes, signTexture, palmGeometries, PLACES, POOLS } from './city.js';
import { Person } from './people.js';
import { paint, posePerson } from './models.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const money = n => '$' + Math.round(n).toLocaleString('en-US');

export const VENUES = {
  bar: { name: 'The Driftwood', kicker: 'Bar · Midtown', ox: -2000, oz: -220, price: 8000, daily: 500, dim: 0.35, station: 3, music: 0.55, icon: 'B', color: '#ff8a1f' },
  nightclub: { name: 'Neon Palms', kicker: 'Nightclub · Ocean Strip', ox: -2000, oz: 0, price: 12000, daily: 800, dim: 0.25, station: 2, music: 1, icon: 'N', color: '#c77dff' },
  restaurant: { name: 'Coral Grill', kicker: 'Restaurant · Little Coral', ox: -2000, oz: 220, price: 6000, daily: 400, dim: 0.5, station: 3, music: 0.4, icon: 'F', color: '#ffb347' },
  resort: { name: 'Sunset Palms Resort', kicker: 'Resort · Ocean Strip', ox: -2000, oz: 440, price: 25000, daily: 1500, dim: 1, station: 0, music: 0.45, icon: 'R', color: '#21e6ff' }
};
const KEYS = Object.keys(VENUES);

const DRINKS = [
  { name: 'Neon Daiquiri', desc: '+10 health, a little buzz', price: 15, hp: 10, buzz: 0.25 },
  { name: 'Rum & Cola', desc: '+5 health, a bigger buzz', price: 10, hp: 5, buzz: 0.35 },
  { name: 'Piña Colada', desc: '+20 health, smooth', price: 25, hp: 20, buzz: 0.2 },
  { name: 'Sparkling water', desc: 'Sobers you up', price: 3, hp: 2, buzz: -1 }
];
const MENU = [
  { name: 'Key lime pie', desc: '+15 health', price: 10, hp: 15 },
  { name: 'Conch fritters', desc: '+30 health', price: 18, hp: 30 },
  { name: 'Cuban sandwich', desc: '+50 health', price: 28, hp: 50 },
  { name: 'Grilled snapper', desc: 'Full health', price: 55, hp: 100 },
  { name: 'Lobster platter', desc: 'Full health, and you take 30% less damage for 3 minutes', price: 140, hp: 100, fed: 180 }
];
const BARTENDER = ['First one tastes like the ocean. The second one tastes like a bad idea.', 'You look like you just got off the boat. Welcome.', 'The rum comes from Havana. Mostly.', 'Sonny drinks here. Don’t tell him I said that.'];

const CHATTER = [
  { who: 'Regular', text: 'Thirty years I been sitting on this stool. Best seat in Coral Bay.' },
  { who: 'Bartender', text: 'Big Lou over there hasn’t lost an arm wrestle since 1979. Allegedly.' },
  { who: 'Tourist', text: 'Is it always this hot at night? I came here from Ohio.' },
  { who: 'Regular', text: 'You hear the cops lost a chopper down by the docks? Nobody saw nothing.' },
  { who: 'Bartender', text: 'Put a quarter in the jukebox, the ballads keep the fights down.' },
  { who: 'Fisherman', text: 'Caught a marlin this big. Well. Almost caught it.' },
  { who: 'Regular', text: 'Sonny Reyes used to wash dishes here. Now look at him.' },
  { who: 'Bartender', text: 'This one’s on the house. Don’t tell anyone I’m nice.' }
];
const LABELS = {
  exit: () => 'Leave', bar: v => v.seat ? 'Sit at the bar' : 'Order a drink', dance: () => 'Dance for tips', seat: () => 'Sit down and order',
  rest: () => 'Relax on the lounger', office: v => `${v.name} office`, jukebox: () => 'Jukebox', darts: () => 'Darts with Big Lou · $50', arm: () => 'Arm wrestle Big Lou · $100'
};
const SEGS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

const glow = hex => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(1.7) });

// Small builder bound to one venue's origin.
function kit(scene, ox, oz) {
  const g = new THREE.Group();
  g.position.set(ox, 0, oz);
  scene.add(g);
  const box = (w, h, d, x, y, z, mat, solid) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    if (solid) addSolid(ox + x - w / 2, oz + z - d / 2, ox + x + w / 2, oz + z + d / 2, typeof solid === 'number' ? solid : y + h, 'venue');
    return m;
  };
  const cyl = (rt, rb, h, x, y, z, mat, seg = 14) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const room = (hw, hd, h, wall, floor, ceil) => {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, hd * 2).rotateX(-Math.PI / 2), floor);
    f.receiveShadow = true; f.position.y = 0.01; g.add(f);
    box(hw * 2 + 1, h, 0.5, 0, 0, -hd - 0.25, wall, 10);
    box(hw * 2 + 1, h, 0.5, 0, 0, hd + 0.25, wall, 10);
    box(0.5, h, hd * 2, -hw - 0.25, 0, 0, wall, 10);
    box(0.5, h, hd * 2, hw + 0.25, 0, 0, wall, 10);
    if (ceil) box(hw * 2 + 1, 0.3, hd * 2 + 1, 0, h, 0, ceil);
  };
  const sign = (text, color, x, y, z, rotY, width) => {
    const { tex, aspect } = signTexture(text, color);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width / aspect), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: new THREE.Color(1.5, 1.5, 1.5) }));
    m.position.set(x, y, z); m.rotation.y = rotY;
    g.add(m);
    return m;
  };
  return { g, box, cyl, room, sign };
}

function checker(a, b, n = 8) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const s = 128 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { x.fillStyle = (i + j) % 2 ? a : b; x.fillRect(i * s, j * s, s, s); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function planks() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    x.fillStyle = ['#6b4528', '#5e3c22', '#74502f', '#664126'][i % 4];
    x.fillRect(0, i * 32, 256, 32);
    x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, i * 32, 256, 2);
    x.fillRect(((i * 97) % 200) + 20, i * 32, 2, 32);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  return t;
}
export function drawBoard(g, S, darts = []) {
  const c = S / 2, R = S * 0.44;
  g.clearRect(0, 0, S, S);
  g.fillStyle = '#111'; g.beginPath(); g.arc(c, c, R * 1.12, 0, 7); g.fill();
  for (let i = 0; i < 20; i++) {
    const a0 = (i * 18 - 99) * Math.PI / 180, a1 = a0 + Math.PI / 10;
    const ring = (r0, r1, col) => { g.fillStyle = col; g.beginPath(); g.arc(c, c, r1, a0, a1); g.arc(c, c, r0, a1, a0, true); g.fill(); };
    ring(0, R, i % 2 ? '#f1e3c4' : '#1b1b1b');
    ring(R * 0.58, R * 0.65, i % 2 ? '#1f8a4c' : '#c8322f');
    ring(R * 0.92, R, i % 2 ? '#1f8a4c' : '#c8322f');
    const am = (a0 + a1) / 2;
    g.fillStyle = '#fff'; g.font = `700 ${S * 0.045}px Rubik, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(SEGS[i], c + Math.cos(am) * R * 1.06, c + Math.sin(am) * R * 1.06);
  }
  g.fillStyle = '#1f8a4c'; g.beginPath(); g.arc(c, c, R * 0.13, 0, 7); g.fill();
  g.fillStyle = '#c8322f'; g.beginPath(); g.arc(c, c, R * 0.06, 0, 7); g.fill();
  for (const d of darts) { g.fillStyle = '#ffd23f'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(d.x * S, d.y * S, S * 0.014, 0, 7); g.fill(); g.stroke(); }
}
// score for a hit at (x, y) in board units (0..1, centre 0.5)
function dartScore(x, y) {
  const dx = x - 0.5, dy = y - 0.5, r = Math.hypot(dx, dy) / 0.44;
  if (r < 0.06) return { pts: 50, name: 'Bullseye!' };
  if (r < 0.13) return { pts: 25, name: 'Outer bull' };
  if (r > 1) return { pts: 0, name: 'Off the board' };
  let a = Math.atan2(dy, dx) * 180 / Math.PI + 99;
  a = ((a % 360) + 360) % 360;
  const seg = SEGS[Math.floor(a / 18) % 20];
  if (r > 0.58 && r < 0.65) return { pts: seg * 3, name: `Triple ${seg}` };
  if (r > 0.92) return { pts: seg * 2, name: `Double ${seg}` };
  return { pts: seg, name: String(seg) };
}

// ---------- The Driftwood ----------
function buildBar(scene, v) {
  const K = kit(scene, v.ox, v.oz);
  K.room(10, 7, 4.2, paint('#4a2f1e', 0.85, 0), new THREE.MeshStandardMaterial({ map: planks(), roughness: 0.6 }), paint('#2a1a10', 0.9, 0));
  const wood = paint('#5a3620', 0.6, 0.05), dark = paint('#2b1a10', 0.7, 0), brass = paint('#c9a35a', 0.3, 0.9);
  // bar counter and back bar
  K.box(13, 1.1, 1, -2, 0, -4.6, wood, true);
  K.box(13.2, 0.08, 1.2, -2, 1.1, -4.6, paint('#7a4a2a', 0.25, 0.1));
  K.box(13, 0.06, 0.06, -2, 0.25, -4.05, brass);
  K.box(13, 2.6, 0.5, -2, 0, -6.6, dark, true);
  const bcols = ['#7ac74f', '#c8322f', '#ffd23f', '#e8e2d0', '#8a5a2b', '#3dc6e0'];
  for (let k = 0; k < 40; k++) K.box(0.13, 0.42, 0.13, -8 + (k % 20) * 0.62, k < 20 ? 1.3 : 2.05, -6.25, glow(bcols[k % bcols.length]));
  K.sign('Driftwood', '#ffb347', -2, 3.3, -6.95, 0, 5);
  K.box(1.4, 0.5, 0.05, 4.4, 2.9, -6.94, glow('#ff2fa0'));
  K.box(1.0, 0.4, 0.05, -7.6, 2.9, -6.94, glow('#3de0ff'));
  // stools
  for (let x = -7.2; x <= 3.2; x += 1.3) { K.cyl(0.24, 0.24, 0.08, x, 0.72, -3.5, paint('#b0322f', 0.6, 0)); K.cyl(0.04, 0.05, 0.72, x, 0, -3.5, brass); }
  // TV above the corner
  K.box(1.6, 1, 0.12, 6.5, 2.6, -6.9, dark);
  const tv = K.box(1.4, 0.82, 0.02, 6.5, 2.69, -6.82, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 0.8, 1.2) }));
  // booths on the east wall
  for (const z of [-1, 2.6]) {
    K.box(1.6, 0.06, 1, 8.3, 0.74, z, wood); K.box(0.12, 0.74, 0.12, 8.3, 0, z, dark);
    addSolid(v.ox + 7.6, v.oz + z - 0.5, v.ox + 9.1, v.oz + z + 0.5, 0.8, 'venue');
    for (const s of [-1, 1]) { K.box(1.6, 0.45, 0.6, 8.3, 0, z + s * 1.0, paint('#7a1f2b', 0.8, 0)); K.box(1.6, 0.8, 0.15, 8.3, 0.45, z + s * 1.3, paint('#7a1f2b', 0.8, 0)); }
  }
  // pool table
  K.box(2.8, 0.75, 1.6, 3.6, 0, 1.6, wood, 0.95);
  K.box(2.5, 0.05, 1.3, 3.6, 0.75, 1.6, paint('#1d6b3a', 0.9, 0));
  ['#ffd23f', '#2f6db5', '#c8322f', '#7a2f8f', '#ff8a3d', '#1d8a4c', '#8a1f1f', '#111', '#fff'].forEach((c, i) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), paint(c, 0.2, 0.1));
    b.position.set(3.0 + (i % 3) * 0.13 + (i > 7 ? 0.9 : 0), 0.86, 1.4 + Math.floor(i / 3) * 0.12);
    K.g.add(b);
  });
  K.box(0.03, 0.03, 1.5, 2.2, 0.95, 1.2, paint('#c9a35a', 0.5, 0)).rotation.x = 0.2;
  K.cyl(0.3, 0.45, 0.25, 3.6, 3.6, 1.6, glow('#ffd59a'));
  // dartboard on the west wall
  const dc = document.createElement('canvas'); dc.width = dc.height = 256;
  drawBoard(dc.getContext('2d'), 256);
  const dt = new THREE.CanvasTexture(dc); dt.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), new THREE.MeshBasicMaterial({ map: dt, color: new THREE.Color(1.1, 1.1, 1.1) }));
  board.position.set(-9.93, 1.75, 1); board.rotation.y = Math.PI / 2;
  K.g.add(board);
  K.box(0.1, 0.02, 1.4, -6.6, 0, 1, paint('#e8e2d0', 0.6, 0));
  // arm wrestling table
  K.box(1, 0.06, 1, -5, 0.78, 4.6, wood); K.box(0.14, 0.78, 0.14, -5, 0, 4.6, dark);
  addSolid(v.ox - 5.5, v.oz + 4.1, v.ox - 4.5, v.oz + 5.1, 0.85, 'venue');
  K.box(0.5, 0.45, 0.5, -3.95, 0, 4.6, wood);
  K.box(0.5, 0.45, 0.5, -6.05, 0, 4.6, wood);
  // jukebox
  K.box(1.2, 1.7, 0.7, 8.9, 0, -5.4, paint('#3a1f12', 0.4, 0.2), true);
  const juke = K.box(1, 0.7, 0.04, 8.9, 0.9, -5.03, new THREE.MeshBasicMaterial({ color: '#ff8a3d' }));
  K.cyl(0.55, 0.55, 0.06, 8.9, 1.7, -5.4, glow('#ff2fa0'));
  // ceiling fans
  const fans = [-4, 3].map(x => { const f = new THREE.Group(); f.position.set(x, 3.9, -0.5); f.add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.03, 0.22), dark), new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 2.2), dark)); K.g.add(f); return f; });
  K.box(2.4, 2.6, 0.08, 0, 0, 6.95, paint('#3a2414', 0.6, 0));
  v.spawn = { x: 0, z: 4.9, yaw: Math.PI };
  v.exit = { x: 0, z: 6.3 };
  v.seat = { x: 0.1, z: -3.5, yaw: Math.PI };
  v.spots = [
    { x: 0.1, z: -2.7, r: 0.8, act: 'bar', color: '#ff4fb3' },
    { x: 7.8, z: -4.4, r: 0.8, act: 'jukebox', color: '#ffb347' },
    { x: -6.6, z: 1, r: 0.8, act: 'darts', color: '#21e6ff' },
    { x: -7, z: 4.6, r: 0.75, act: 'arm', color: '#ffd23f' },
    { x: 8.6, z: 5.6, r: 0.75, act: 'office', color: '#3dff9e' }
  ];
  v.lights = [[-2, 3.6, -3, '#ffcf8a', 14], [4, 3.6, 2, '#ffd59a', 10]];
  v.npcs = [
    { kind: 'civ', x: -2, z: -5.8, yaw: 0, pose: 'idle' },
    { kind: 'civ', x: -5.9, z: -3.5, yaw: Math.PI, pose: 'sip', style: 0 },
    { kind: 'civ', x: -3.3, z: -3.5, yaw: Math.PI, pose: 'sit', style: 1 },
    { kind: 'civ', x: 2.7, z: -3.5, yaw: Math.PI, pose: 'sip', style: 2 },
    { kind: 'civ', x: 8.3, z: -2, yaw: 0, pose: 'sit', style: 3 }, { kind: 'civ', x: 8.3, z: 0, yaw: Math.PI, pose: 'sit', style: 4 },
    { kind: 'civ', x: 8.3, z: 3.6, yaw: Math.PI, pose: 'sip', style: 5 },
    { kind: 'civ', x: 2, z: 2.9, yaw: 2.2, pose: 'idle', style: 6 }, { kind: 'civ', x: 5.5, z: 0.4, yaw: -0.8, pose: 'idle', style: 7 },
    { kind: 'thug', x: -3.8, z: 4.6, yaw: -Math.PI / 2, pose: 'sit', id: 'lou', look: { shirt: '#f2f2f2', pants: '#2b3a55', skin: '#c68b59', hair: '#111', hat: null } }
  ];
  let k = 0;
  v.anim = (dt, t) => {
    for (const f of fans) f.rotation.y += dt * 4;
    tv.material.color.setRGB(0.3 + Math.sin(t * 7) * 0.08, 0.6 + Math.sin(t * 3.1) * 0.15, 1 + Math.sin(t * 5) * 0.1);
    k += dt;
    juke.material.color.setHSL((t * 0.08) % 1, 1, 0.55);
  };
}

// ---------- Neon Palms ----------
function buildNightclub(scene, v) {
  const K = kit(scene, v.ox, v.oz);
  const floor = new THREE.MeshStandardMaterial({ color: '#150d22', roughness: 0.25, metalness: 0.5 });
  K.room(15, 12, 7, paint('#1e1030', 0.9, 0), floor, paint('#0c0814', 0.9, 0));
  const pink = glow('#ff2fa0'), cyan = glow('#21e6ff'), purple = glow('#b04dff');
  for (const y of [2.2, 6.4]) {
    K.box(29.4, 0.08, 0.08, 0, y, -11.85, y < 3 ? pink : cyan);
    K.box(29.4, 0.08, 0.08, 0, y, 11.85, y < 3 ? pink : cyan);
    K.box(0.08, 0.08, 23.4, -14.85, y, 0, y < 3 ? cyan : purple);
    K.box(0.08, 0.08, 23.4, 14.85, y, 0, y < 3 ? cyan : purple);
  }
  // dance floor
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(1.74, 0.04, 1.74), new THREE.MeshBasicMaterial({ color: 0xffffff }), 25);
  const tmp = new THREE.Object3D();
  for (let i = 0; i < 25; i++) {
    tmp.position.set(((i % 5) - 2) * 1.8, 0.03, Math.floor(i / 5) * 1.8 - 3.6 - 1);
    tmp.updateMatrix();
    tiles.setMatrixAt(i, tmp.matrix);
    tiles.setColorAt(i, new THREE.Color(0.2, 0.1, 0.3));
  }
  tiles.frustumCulled = false;
  K.g.add(tiles);
  // DJ booth, speakers, sign
  K.box(4.2, 1.1, 1.2, 0, 0, -9.3, paint('#2a1a3a', 0.6, 0.2), true);
  K.box(4.2, 0.08, 0.06, 0, 0.8, -8.68, pink);
  K.cyl(0.32, 0.32, 0.06, -1, 1.1, -9.3, paint('#111', 0.4, 0.5));
  K.cyl(0.32, 0.32, 0.06, 1, 1.1, -9.3, paint('#111', 0.4, 0.5));
  for (const x of [-5, 5]) { K.box(1.4, 3, 1.2, x, 0, -10.6, paint('#121018', 0.8, 0), true); K.cyl(0.42, 0.42, 0.05, x, 1.9, -9.98, glow('#3a2a55')).rotation.x = Math.PI / 2; }
  K.sign('Neon Palms', '#ff2fa0', 0, 4.4, -11.7, 0, 9);
  // bar
  K.box(1.1, 1.15, 13, 11.6, 0, 1, paint('#3a1f4f', 0.4, 0.2), true);
  K.box(1.3, 0.06, 13.2, 11.6, 1.15, 1, paint('#e8e2f0', 0.2, 0.6));
  K.box(0.06, 0.06, 13, 11.02, 1.0, 1, cyan);
  K.box(0.5, 2.8, 13, 14.5, 0, 1, paint('#2a1a3a', 0.7, 0), true);
  const bcols = ['#ff5d8f', '#ffd23f', '#5fe08a', '#3dc6e0', '#ff8a3d', '#c77dff'];
  for (let k = 0; k < 34; k++) K.box(0.14, 0.4, 0.14, 14.1, k % 2 ? 1.5 : 2.3, -5 + (k >> 1) * 0.74, glow(bcols[k % bcols.length]));
  for (let z = -4.5; z <= 6.5; z += 1.6) { K.cyl(0.22, 0.22, 0.06, 10.5, 0.75, z, paint('#ff2fa0', 0.4, 0.3)); K.cyl(0.04, 0.04, 0.75, 10.5, 0, z, paint('#c9cdd3', 0.3, 1)); }
  // lounge sofas
  const plush = paint('#7a1f5c', 0.9, 0);
  K.box(1.4, 0.5, 9, -13.6, 0, -1.5, plush, 0.9);
  K.box(0.4, 1.0, 9, -14.4, 0.5, -1.5, plush);
  for (const z of [-4, 1]) K.box(1, 0.45, 1.6, -11.8, 0, z, paint('#21162e', 0.3, 0.4), true);
  // disco ball + beams
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.15, emissive: '#554466', flatShading: true }));
  ball.position.set(0, 6.1, -1);
  K.g.add(ball);
  const beams = [];
  ['#ff2fa0', '#21e6ff', '#b04dff', '#ffd23f'].forEach((c, i) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(1.4, 6.6, 18, 1, true).translate(0, -3.3, 0), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.position.set(i % 2 ? 6 : -6, 6.8, i < 2 ? -6 : 4);
    K.g.add(m);
    beams.push(m);
  });
  // door
  K.box(3, 3, 0.1, 0, 0, 11.7, paint('#0a0610', 0.5, 0));
  K.box(3.2, 0.08, 0.08, 0, 3.05, 11.6, pink);
  v.spawn = { x: 0, z: 9.2, yaw: Math.PI };
  v.seat = { x: 10.5, z: 1, yaw: Math.PI / 2 };
  v.exit = { x: 0, z: 10.9 };
  v.spots = [
    { x: 10.1, z: 1, r: 1.1, act: 'bar', color: '#ff4fb3' },
    { x: 0, z: 4.6, r: 1.3, act: 'dance', color: '#21e6ff' },
    { x: -12.5, z: 9.6, r: 0.9, act: 'office', color: '#3dff9e' }
  ];
  v.lights = [[0, 5.5, -1, '#ff4fd8', 30], [11, 4, 1, '#3de0ff', 14]];
  const npcs = [{ kind: 'civ', x: 0, z: -10.2, yaw: 0, pose: 'dance', style: 1, tempo: 4.1 }, { kind: 'civ', x: 13.3, z: 1, yaw: -Math.PI / 2, pose: 'idle' }];
  const spots = [[-2.7, -4.2], [0, -5.2], [2.7, -4.2], [-3.4, -1.2], [3.4, -0.6], [-2, 1.6], [2.2, 1.9], [-0.8, -2.6], [1.1, -2.2]];
  spots.forEach(([x, z], i) => npcs.push({ kind: 'civ', x, z, yaw: Math.random() * 6.3, pose: 'dance', style: i, tempo: 4.1 }));
  for (const z of [-4.8, -2.8, 0.9, 2.6]) npcs.push({ kind: 'civ', x: -13.3, z, yaw: Math.PI / 2, pose: 'sit', style: z });
  for (const z of [-2.9, 3.3]) npcs.push({ kind: 'civ', x: 10.3, z, yaw: Math.PI / 2, pose: 'sit', style: z });
  v.npcs = npcs;
  const beat = 60 / 122;
  let lastBeat = -1;
  const c = new THREE.Color();
  v.anim = (dt, t) => {
    ball.rotation.y += dt * 0.8;
    beams.forEach((b, i) => { b.rotation.z = Math.sin(t * 0.9 + i * 1.7) * 0.45; b.rotation.x = Math.cos(t * 0.7 + i) * 0.4; });
    const k = Math.floor(t / beat);
    if (k !== lastBeat) {
      lastBeat = k;
      for (let i = 0; i < 25; i++) {
        const h = ((i * 7 + k * 3) % 5) / 5;
        c.setHSL(0.78 + h * 0.5, 1, Math.random() < 0.55 ? 0.55 : 0.12);
        tiles.setColorAt(i, c.multiplyScalar(1.6));
      }
      tiles.instanceColor.needsUpdate = true;
    }
  };
}

// ---------- Coral Grill ----------
function buildRestaurant(scene, v) {
  const K = kit(scene, v.ox, v.oz);
  const ft = checker('#f2ece0', '#2b2f36');
  ft.repeat.set(5.5, 4);
  K.room(11, 8, 4.6, paint('#f4dcb8', 0.9, 0), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.35 }), paint('#fff4e2', 0.9, 0));
  const teal = paint('#2f8f8a', 0.7, 0);
  K.box(21.8, 1.1, 0.06, 0, 0, -7.95, teal); K.box(21.8, 1.1, 0.06, 0, 0, 7.95, teal);
  K.box(0.06, 1.1, 15.8, -10.95, 0, 0, teal); K.box(0.06, 1.1, 15.8, 10.95, 0, 0, teal);
  const cloth = paint('#fbfaf5', 0.8, 0), wood = paint('#7a5634', 0.7, 0), warm = glow('#ffcf87');
  const tables = [[-6, -2.4], [0, -2.4], [6, -2.4], [-6, 3], [0, 3], [6, 3]];
  for (const [x, z] of tables) {
    K.cyl(0.78, 0.78, 0.06, x, 0.76, z, cloth);
    K.cyl(0.07, 0.07, 0.76, x, 0, z, wood);
    addSolid(v.ox + x - 0.6, v.oz + z - 0.6, v.ox + x + 0.6, v.oz + z + 0.6, 0.85, 'venue');
    for (const s of [-1, 1]) { K.box(0.5, 0.06, 0.5, x, 0.45, z + s * 1.05, wood); K.box(0.5, 0.6, 0.06, x, 0.48, z + s * 1.3, wood); for (const lx of [-0.2, 0.2]) K.box(0.05, 0.45, 0.05, x + lx, 0, z + s * 1.05, wood); }
    K.cyl(0.16, 0.24, 0.2, x, 3.9, z, warm);
    K.box(0.02, 0.5, 0.02, x, 4.1, z, paint('#222', 0.5, 0));
    K.cyl(0.05, 0.05, 0.22, x + 0.25, 0.82, z, glow('#ff8a3d'));
  }
  // kitchen pass and sign
  K.box(14, 1.1, 1, 0, 0, -6.8, paint('#c9965a', 0.5, 0.1), true);
  K.box(14.2, 0.06, 1.1, 0, 1.1, -6.8, paint('#e8e2d0', 0.3, 0.2));
  K.box(8, 1.2, 0.05, 0, 1.6, -7.9, glow('#ffe2b0'));
  K.sign('Coral Grill', '#ff8a3d', 0, 3.4, -7.85, 0, 6);
  // wall art
  [['#ff7eb6', -8], ['#5ee0c8', 8], ['#ffd23f', -3.5], ['#9b6bff', 3.5]].forEach(([c, x]) => K.box(1.4, 1, 0.05, x, 2, 7.9, paint(c, 0.6, 0)));
  K.box(2.4, 2.6, 0.08, 0, 0, 7.92, paint('#4a2f1e', 0.6, 0));
  v.spawn = { x: 0, z: 5.7, yaw: Math.PI };
  v.exit = { x: 0, z: 7.25 };
  v.spots = [
    { x: -6, z: 4.6, r: 0.8, act: 'seat', color: '#ffb347' },
    { x: 6, z: 4.6, r: 0.8, act: 'seat', color: '#ffb347' },
    { x: -9.6, z: 6.4, r: 0.8, act: 'office', color: '#3dff9e' }
  ];
  v.lights = [[-4, 3.8, 0, '#ffd59a', 12], [5, 3.8, 0, '#ffd59a', 12]];
  const npcs = [{ kind: 'civ', x: 2, z: -7.5, yaw: 0, pose: 'idle' }, { kind: 'civ', x: 3.2, z: 0.3, yaw: Math.PI / 2, pose: 'idle', style: 2 }];
  for (const i of [0, 1, 2, 4]) {
    const [x, z] = tables[i];
    npcs.push({ kind: 'civ', x, z: z - 1.05, yaw: 0, pose: 'sit', style: i });
    if (i !== 1) npcs.push({ kind: 'civ', x, z: z + 1.05, yaw: Math.PI, pose: 'sit', style: i + 3 });
  }
  v.npcs = npcs;
}

// ---------- Sunset Palms Resort ----------
function buildResort(scene, v) {
  const K = kit(scene, v.ox, v.oz), ox = v.ox, oz = v.oz;
  const deck = paint('#efe2c8', 0.85, 0);
  K.box(15, 0.02, 44, -16.5, 0, 0, deck); K.box(15, 0.02, 44, 16.5, 0, 0, deck);
  K.box(18, 0.02, 14, 0, 0, -15, deck); K.box(18, 0.02, 18, 0, 0, 13, deck);
  // pool
  const tile = paint('#8fe0ec', 0.4, 0);
  const basin = new THREE.Mesh(new THREE.PlaneGeometry(18, 12).rotateX(-Math.PI / 2), tile);
  basin.position.set(0, -1.4, -2); K.g.add(basin);
  K.box(18, 1.4, 0.05, 0, -1.4, -8, tile); K.box(18, 1.4, 0.05, 0, -1.4, 4, tile);
  K.box(0.05, 1.4, 12, -9, -1.4, -2, tile); K.box(0.05, 1.4, 12, 9, -1.4, -2, tile);
  const white = paint('#ffffff', 0.5, 0);
  K.box(18.8, 0.08, 0.4, 0, 0, -8.2, white); K.box(18.8, 0.08, 0.4, 0, 0, 4.2, white);
  K.box(0.4, 0.08, 12.8, -9.2, 0, -2, white); K.box(0.4, 0.08, 12.8, 9.2, 0, -2, white);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(18, 12).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#1fc8dc', emissive: '#0b6e80', emissiveIntensity: 0.5, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.78 }));
  water.position.set(0, -0.25, -2); K.g.add(water);
  POOLS.push({ x0: ox - 9, x1: ox + 9, z0: oz - 8, z1: oz + 4 });
  // hotel wings
  const blds = { deco: [], plain: [], glass: [] };
  const wing = (x0, z0, x1, z1, h, color) => { blds.deco.push({ x0: ox + x0, z0: oz + z0, x1: ox + x1, z1: oz + z1, h, color, seed: Math.random() }); addSolid(ox + x0, oz + z0, ox + x1, oz + z1, h, 'venue'); };
  wing(-25, -29, 25, -22, 18, '#ffd3a5');
  wing(-31, -22, -24, 22, 13, '#f6b7c9');
  wing(24, -22, 31, 22, 13, '#a8e6cf');
  wing(-25, 22, -3, 26, 6, '#fdf1b8');
  wing(3, 22, 25, 26, 6, '#fdf1b8');
  wing(-3, 24.5, 3, 26, 6, '#fdf1b8');
  buildingMeshes(scene, blds);
  const pink = glow('#ff2fa0'), cyan = glow('#21e6ff');
  K.box(50, 0.22, 0.22, 0, 17.8, -21.9, pink);
  K.box(0.22, 0.22, 44, -23.9, 12.8, 0, cyan);
  K.box(0.22, 0.22, 44, 23.9, 12.8, 0, cyan);
  K.sign('Sunset Palms', '#21e6ff', 0, 13.5, -21.85, 0, 16);
  // palms
  const pg = palmGeometries();
  const spots = [[-20, -18], [20, -18], [-20, 18], [20, 18], [-13, -12], [13, -12], [-13, 9], [13, 9], [-20, 0], [20, 0]];
  const trunks = new THREE.InstancedMesh(pg.trunk, paint('#8a6f4e', 0.95, 0), spots.length);
  const crowns = new THREE.InstancedMesh(pg.crown, new THREE.MeshStandardMaterial({ color: '#4a9a3c', roughness: 0.8, side: THREE.DoubleSide }), spots.length);
  const tmp = new THREE.Object3D();
  spots.forEach(([x, z], i) => {
    const h = 7 + (i % 3) * 1.5, yaw = i * 1.3;
    tmp.position.set(x, 0, z); tmp.rotation.set(0, yaw, 0); tmp.scale.set(1, h, 1); tmp.updateMatrix(); trunks.setMatrixAt(i, tmp.matrix);
    tmp.position.set(x + Math.cos(yaw) * 0.9, h - 0.1, z - Math.sin(yaw) * 0.9); tmp.scale.set(1.1, 1, 1.1); tmp.updateMatrix(); crowns.setMatrixAt(i, tmp.matrix);
    addSolid(ox + x - 0.3, oz + z - 0.3, ox + x + 0.3, oz + z + 0.3, 6, 'palm');
  });
  trunks.castShadow = crowns.castShadow = true;
  K.g.add(trunks, crowns);
  // loungers + umbrellas
  const lounger = paint('#ffffff', 0.6, 0), ucols = ['#ff5d8f', '#3dc6e0', '#ffd23f', '#9b6bff'];
  const loungers = [];
  for (const side of [-1, 1]) for (let k = 0; k < 4; k++) {
    const z = -6.5 + k * 3, x = side * 11.6;
    K.box(1.9, 0.38, 0.75, x, 0, z, lounger);
    const back = K.box(0.8, 0.1, 0.75, x + side * 1.05, 0.55, z, lounger);
    back.rotation.z = side * 0.6;
    loungers.push({ x, z, side });
    if (k % 2 === 0) { K.cyl(0.04, 0.04, 2.4, x + side * 1.6, 0, z + 1.5, white); const u = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.6, 8), paint(ucols[(k + (side > 0 ? 1 : 0)) % 4], 0.7, 0)); u.position.set(x + side * 1.6, 2.6, z + 1.5); u.castShadow = true; K.g.add(u); }
  }
  // pool bar
  K.box(1, 1.1, 5, 15.5, 0, 9, paint('#9b6b3c', 0.7, 0), true);
  K.box(1.2, 0.08, 5.2, 15.5, 1.1, 9, paint('#c9965a', 0.6, 0));
  for (const [a, b] of [[-0.4, -2.4], [2.4, -2.4], [-0.4, 2.4], [2.4, 2.4]]) K.box(0.2, 3, 0.2, 15.5 + a, 0, 9 + b, paint('#7a5634', 0.8, 0));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 1.6, 8), paint('#c9a35a', 0.95, 0));
  roof.position.set(16.5, 3.6, 9); roof.castShadow = true; K.g.add(roof);
  K.box(0.1, 0.1, 5, 15, 1.0, 9, pink);
  // string lights
  const bulbs = [];
  const line = (x0, z0, x1, z1, n) => { for (let k = 0; k <= n; k++) { const t = k / n; bulbs.push([x0 + (x1 - x0) * t, 5.2 - Math.sin(t * Math.PI) * 1.1, z0 + (z1 - z0) * t]); } };
  line(-20, -18, 20, -18, 24); line(-20, 18, 20, 18, 24); line(-20, -18, -20, 18, 22); line(20, -18, 20, 18, 22);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const bm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 6, 4), bulbMat, bulbs.length);
  bulbs.forEach(([x, y, z], i) => { tmp.position.set(x, y, z); tmp.rotation.set(0, 0, 0); tmp.scale.set(1, 1, 1); tmp.updateMatrix(); bm.setMatrixAt(i, tmp.matrix); bm.setColorAt(i, new THREE.Color(['#ffd59a', '#ff7eb6', '#7fe8ff'][i % 3])); });
  bm.frustumCulled = false;
  K.g.add(bm);
  // entrance gate
  K.box(6, 0.3, 0.3, 0, 4.2, 22.4, pink);
  v.spawn = { x: 0, z: 18.5, yaw: Math.PI };
  v.exit = { x: 0, z: 22.3 };
  v.spots = [
    { x: 13.8, z: 9, r: 1, act: 'bar', color: '#ff4fb3' },
    { x: 9.4, z: 2.5, r: 0.9, act: 'rest', color: '#ffd23f' },
    { x: -20, z: 20.5, r: 0.9, act: 'office', color: '#3dff9e' }
  ];
  v.lights = [[0, 1.5, -2, '#5fe8ff', 10], [15, 3, 9, '#ffcf87', 10]];
  const npcs = [{ kind: 'civ', x: 16.9, z: 9, yaw: -Math.PI / 2, pose: 'idle' }];
  loungers.forEach((l, i) => { if (i === 6) return; if (i % 2 === 0 || i === 3) npcs.push({ kind: 'civ', x: l.x - l.side * 0.6, z: l.z, yaw: l.side > 0 ? -Math.PI / 2 : Math.PI / 2, pose: 'lie', style: i }); });
  for (const [x, z] of [[-4, -4], [3, -1], [5.5, -5.5]]) npcs.push({ kind: 'civ', x, z, yaw: Math.random() * 6, pose: 'idle', style: x });
  for (const [x, z, yaw] of [[12.6, 7.6, Math.PI / 2], [12.4, 10.6, Math.PI / 2], [-4, 12, 0.3], [-3.2, 13, Math.PI + 0.3]]) npcs.push({ kind: 'civ', x, z, yaw, pose: 'idle', style: z });
  v.npcs = npcs;
  v.anim = (dt, t, night) => {
    water.material.emissiveIntensity = 0.35 + night * 0.6 + Math.sin(t * 2) * 0.05;
    bulbMat.color.setScalar(0.5 + night * 1.6);
  };
}

export class Venues {
  constructor(G) {
    this.G = G;
    this.inside = null; this.npcs = []; this.dance = null; this.armed = {};
    this.v = {};
    for (const k of KEYS) this.v[k] = { ...VENUES[k], key: k };
    buildBar(G.scene, this.v.bar);
    buildNightclub(G.scene, this.v.nightclub);
    buildRestaurant(G.scene, this.v.restaurant);
    buildResort(G.scene, this.v.resort);
    this.lights = [0, 1].map(() => { const l = new THREE.PointLight(0xffffff, 0, 30, 1.2); G.scene.add(l); return l; });
    for (const k of KEYS) {
      const v = this.v[k];
      for (const s of v.spots) s.mark = G.fx.marker(v.ox + s.x, v.oz + s.z, s.color, s.r, 0.35);
      v.exitMark = G.fx.marker(v.ox + v.exit.x, v.oz + v.exit.z, '#ffffff', 1, 0.35);
      G.fx.marker(PLACES[k].x, PLACES[k].z, v.color, 1, 1.6);
    }
    G.fx.marker(PLACES.tiki.x, PLACES.tiki.z, '#ffb347', 1, 1.4);
    this.setupDanceUI();
    this.mini = null; this.nearDoor = null;
    this.miniUI = { root: document.querySelector('#mini'), kicker: document.querySelector('#miniKicker'), title: document.querySelector('#miniTitle'), canvas: document.querySelector('#dartsCanvas'), arm: document.querySelector('#armBar'), info: document.querySelector('#miniInfo'), hint: document.querySelector('#miniHint') };
    this.miniUI.root.addEventListener('pointerdown', e => { e.preventDefault(); G.input.hits.add('Space'); });
  }
  props() { return (this.G.save.props = this.G.save.props || {}); }
  owned(k) { return !!this.props()[k]?.owned; }
  // ---------- frame ----------
  update(dt) {
    const G = this.G, P = G.player;
    const hrs = dt / 50, pr = this.props();
    for (const k of KEYS) if (pr[k]?.owned) pr[k].till = Math.min(VENUES[k].daily * 3, (pr[k].till || 0) + VENUES[k].daily * hrs / 24);
    G.drunk = Math.max(0, (G.drunk || 0) - dt * 0.012);
    G.fed = Math.max(0, (G.fed || 0) - dt);
    if (this.inside) this.v[this.inside].anim?.(dt, G.now, G.night);
    if (this.dance) { this.updateDance(dt); return; }
    if (this.mini) { this.mini.kind === 'darts' ? this.updateDarts(dt) : this.updateArm(dt); return; }
    if (G.activity === 'sit') { this.updateSit(dt); return; }
    this.nearDoor = null;
    if (G.mode !== 'play') { G.hud.prompt(null); return; }
    const F = G.input.hit('KeyF') || G.input.hit('Enter');
    if (!this.inside) {
      let near = null, nd = 4;
      for (const k of [...KEYS, 'tiki']) { const d = dist(P, PLACES[k]); if (d < nd && P.onFoot) { nd = d; near = k; } }
      this.nearDoor = near;
      G.hud.prompt(near ? (near === 'tiki' ? 'Tiki Shack · <kbd>F</kbd> order a drink' : `${PLACES[near].name} · <kbd>F</kbd> go inside`) : null);
      for (const k of [...KEYS, 'tiki']) {
        const d = dist(P, PLACES[k]);
        if (d > 3) this.armed[k] = true;
        const pressed = F && near === k;
        if (!pressed && (!P.onFoot || d > 1.4 || !this.armed[k])) continue;
        this.armed[k] = false;
        if (k === 'tiki') this.openDrinks('Tiki Shack', 'Beach bar · Ocean Beach');
        else if (G.stars > 0) G.hud.help('Lose the cops before you go in.', 2500);
        else this.enter(k);
      }
      return;
    }
    const v = this.v[this.inside];
    let near = null, nd = 2.6;
    for (const s of [...v.spots, v.exitSpot]) {
      const d = Math.hypot(P.x - v.ox - s.x, P.z - v.oz - s.z);
      if (d < nd) { nd = d; near = s; }
      if (d > s.r + 1.2) s.armed = true;
      if (d < s.r && s.armed) { s.armed = false; this.act(s.act, v); return; }
    }
    this.nearDoor = near ? 'inside' : null;
    G.hud.prompt(near ? `${LABELS[near.act](v)} · <kbd>F</kbd>` : null);
    if (near && F) { near.armed = false; this.act(near.act, v); }
  }
  act(a, v) {
    this.G.hud.prompt(null);
    if (a === 'exit') this.exit();
    else if (a === 'bar' && v.seat) this.sit(v);
    else if (a === 'bar') this.openDrinks(v.key === 'resort' ? 'Pool bar' : 'The bar', v.name);
    else if (a === 'jukebox') this.openJukebox(v);
    else if (a === 'darts') this.startDarts(v);
    else if (a === 'arm') this.startArm(v);
    else if (a === 'dance') this.startDance();
    else if (a === 'seat') this.openMenu();
    else if (a === 'rest') this.openRest();
    else if (a === 'office') this.openOffice(v);
  }
  // ---------- in and out ----------
  enter(k) {
    const G = this.G, P = G.player, v = this.v[k], door = PLACES[k];
    const out = door.side === 'e' ? [2.6, 0, Math.PI / 2] : door.side === 'w' ? [-2.6, 0, -Math.PI / 2] : door.side === 'n' ? [0, -2.6, Math.PI] : [0, 2.6, 0];
    this.back = { x: door.x + out[0], z: door.z + out[1], yaw: out[2] };
    G.fade(0.4);
    this.inside = k; G.inside = k;
    P.place(v.ox + v.spawn.x, v.oz + v.spawn.z, v.spawn.yaw);
    G.cam.yaw = v.spawn.yaw; G.cam.pitch = 0.22; G.cam.snap = true; G.cam.dist = undefined;
    v.exitSpot = { x: v.exit.x, z: v.exit.z, r: 1.1, act: 'exit', armed: false };
    for (const s of v.spots) s.armed = true;
    for (const n of v.npcs) {
      const p = new Person(G, n.kind, v.ox + n.x, v.oz + n.z, { state: 'script', yaw: n.yaw, keep: true, look: n.look });
      if (n.id === 'lou') this.lou = p;
      p.pose = n.pose; p.style = n.style || 0; p.tempo = n.tempo || 1; p.venue = true;
      G.peds.push(p); this.npcs.push(p);
    }
    v.lights.forEach(([x, y, z, c, i], n) => { const l = this.lights[n]; l.position.set(v.ox + x, y, v.oz + z); l.color.set(c); l.intensity = i; });
    G.sky.indoor = v.dim;
    G.audio.venue(v.station, v.music);
    G.hud.banner(v.name, v.kicker, v.color, 2600);
    const pr = this.props()[k];
    if (pr?.owned && pr.till >= 1) {
      const t = Math.floor(pr.till); pr.till -= t; G.addCash(t); G.audio.cash();
      setTimeout(() => G.hud.banner('Takings collected', money(t), '#3dff9e', 2600), 2700);
    }
    const tips = {
      bar: 'Grab a stool at the bar for a drink and some gossip. Try the <b>jukebox</b>, beat Big Lou at <b>darts</b>, or <b>arm wrestle</b> him for cash.',
      nightclub: 'Step on the <b>pink</b> marker at the bar for drinks, the <b>cyan</b> one on the dance floor to dance for tips. The <b>green</b> marker is the office.',
      restaurant: 'Walk to an <b>orange</b> marker by a free table to order. The <b>green</b> marker is the manager’s office.',
      resort: 'Swim in the pool, grab a cocktail at the <b>pink</b> pool bar, or relax on the <b>yellow</b> lounger to pass the time. The office is by the gate.'
    };
    G.hud.help(tips[k] + ' Walk up to a marker and press <kbd>F</kbd>. Go back to the door to leave.', 8000);
    G.persist();
  }
  exit(silent) {
    const G = this.G, P = G.player, k = this.inside;
    if (!k) return;
    if (this.dance) this.endDance(true);
    this.endMini(true); this.stand(true);
    G.hud.prompt(null);
    if (!silent) G.fade(0.4);
    for (const p of this.npcs) p.remove(G);
    G.peds = G.peds.filter(p => !p.removed);
    this.npcs = [];
    for (const l of this.lights) l.intensity = 0;
    G.sky.indoor = 1;
    G.audio.venue(null);
    this.inside = null; G.inside = null;
    this.armed[k] = false;
    if (this.back && !silent) {
      P.place(this.back.x, this.back.z, this.back.yaw);
      G.cam.yaw = this.back.yaw; G.cam.snap = true; G.cam.dist = undefined;
    }
  }
  reset() { if (this.inside) this.exit(true); if (this.dance) this.endDance(true); this.endMini(true); this.stand(true); this.G.hud.prompt(null); }
  // ---------- menus ----------
  openDrinks(title, kicker) {
    const G = this.G, P = G.player;
    G.hud.say([{ who: 'Bartender', text: BARTENDER[Math.floor(Math.random() * BARTENDER.length)] }]);
    G.openPanel(() => ({
      kicker, title, note: G.drunk > 0.05 ? `Buzz: ${Math.round(G.drunk * 100)}%` : '',
      items: DRINKS.map(d => ({
        name: d.name, desc: d.desc, price: d.price, label: 'Order',
        act: () => {
          G.addCash(-d.price);
          P.hp = Math.min(100, P.hp + d.hp);
          G.drunk = d.buzz < 0 ? 0 : Math.min(1, (G.drunk || 0) + d.buzz);
          if (P.pose) { P.pose = 'sip'; P.poseT = 0; this.sipT = 6; }
          G.audio.pickup();
          if (G.drunk > 0.75) G.hud.help('The room is starting to spin…', 2500);
        }
      }))
    }));
  }
  openMenu() {
    const G = this.G, P = G.player;
    G.openPanel(() => ({
      kicker: 'Tonight’s menu', title: 'Coral Grill', note: G.fed > 0 ? `Well fed: ${Math.ceil(G.fed)}s of tougher skin left` : '',
      items: MENU.map(d => ({
        name: d.name, desc: d.desc, price: d.price, label: 'Eat',
        off: P.hp >= 100 && !d.fed,
        act: () => {
          G.addCash(-d.price);
          P.hp = Math.min(100, P.hp + d.hp);
          if (d.fed) G.fed = d.fed;
          G.hour = (G.hour + 0.4) % 24;
          G.audio.cash();
          G.hud.help(`${d.name}: delicious.`, 2200);
        }
      }))
    }));
  }
  openRest() {
    const G = this.G, P = G.player;
    const until = (h, label) => ({
      name: label, desc: `Wake up at ${String(h).padStart(2, '0')}:00 with full health`, price: 0, label: 'Relax',
      act: () => { G.fade(0.8); G.hour = h; P.hp = 100; G.drunk = 0; G.persist(); G.hud.help('You feel brand new.', 2500); return true; }
    });
    G.openPanel(() => ({ kicker: 'Sunset Palms', title: 'Poolside lounger', note: 'Soak up the sun and let the hours drift by.', items: [until(8, 'Sleep until morning'), until(13, 'Doze until lunch'), until(19, 'Nap until sunset')] }));
  }
  openOffice(v) {
    const G = this.G, pr = this.props();
    G.openPanel(() => {
      const own = pr[v.key]?.owned;
      const till = Math.floor(pr[v.key]?.till || 0);
      const count = KEYS.filter(k => pr[k]?.owned).length;
      return {
        kicker: own ? 'Your property' : 'For sale', title: v.name,
        note: own ? `It earns ${money(v.daily)} a game day. Takings also collect themselves when you walk in.` : `Buy it and it earns ${money(v.daily)} every game day. Properties owned: ${count} of ${KEYS.length}.`,
        items: own
          ? [{ name: 'Takings in the till', desc: money(till), price: 0, label: 'Collect', off: till < 1, act: () => { pr[v.key].till -= till; G.addCash(till); G.audio.cash(); G.persist(); } }]
          : [{ name: `Buy ${v.name}`, desc: `Pays ${money(v.daily)} a day`, price: v.price, label: 'Buy', act: () => {
              G.addCash(-v.price);
              pr[v.key] = { owned: true, till: 0 };
              G.audio.passed();
              G.hud.banner('Property bought', v.name, '#3dff9e', 3500);
              if (KEYS.every(k => pr[k]?.owned)) setTimeout(() => { G.addCash(5000); G.hud.banner('Coral Bay mogul', 'Every venue is yours · $5,000 bonus', '#ffd36b', 4500); }, 3700);
              G.persist();
            } }]
      };
    });
  }
  // ---------- sitting at the bar ----------
  sit(v) {
    const G = this.G, P = G.player, s = v.seat;
    P.place(v.ox + s.x, v.oz + s.z, s.yaw);
    P.pose = 'sit'; P.poseT = 0;
    G.activity = 'sit';
    G.cam.yaw = s.yaw + 0.5; G.cam.pitch = 0.2;
    this.chatT = 3; this.sipT = 0; this.seatV = v;
    G.hud.prompt('<kbd>E</kbd> order a drink · <kbd>F</kbd> stand up');
    this.openDrinks('The bar', v.name);
  }
  updateSit(dt) {
    const G = this.G, P = G.player, I = G.input;
    G.hud.prompt('Enjoying a drink · <kbd>E</kbd> order another · <kbd>F</kbd> stand up');
    if (this.sipT > 0 && (this.sipT -= dt) <= 0) P.pose = 'sit';
    this.chatT -= dt;
    if (this.chatT <= 0) { this.chatT = 9 + Math.random() * 6; G.hud.say([CHATTER[Math.floor(Math.random() * CHATTER.length)]]); }
    if (I.hit('KeyE')) this.openDrinks('The bar', this.seatV.name);
    else if (I.hit('KeyF') || Math.abs(I.moveY()) > 0.5 || Math.abs(I.moveX()) > 0.5) this.stand();
  }
  stand(silent) {
    const G = this.G, P = G.player;
    if (G.activity !== 'sit') return;
    G.activity = null; P.pose = null;
    G.hud.prompt(null);
    if (silent) return;
    const s = this.seatV.seat;
    P.place(P.x - Math.sin(s.yaw) * 1.6, P.z - Math.cos(s.yaw) * 1.6, s.yaw + Math.PI);
  }
  openJukebox(v) {
    const G = this.G, st = G.audio.STATIONS;
    G.openPanel(() => ({
      kicker: 'Jukebox', title: 'Pick a record', note: `Now playing: ${st[v.station].name}`,
      items: st.filter(x => !x.off).map((x, i) => ({
        name: x.name, desc: x.tag, price: 1, label: i === v.station ? 'Playing' : 'Play', off: i === v.station,
        act: () => { G.addCash(-1); v.station = i; G.audio.venue(i, v.music); G.audio.ui(); }
      }))
    }));
  }
  // ---------- darts and arm wrestling ----------
  showMini(kicker, title, darts, hint) {
    const u = this.miniUI;
    u.root.hidden = false;
    u.kicker.textContent = kicker; u.title.textContent = title;
    u.canvas.hidden = !darts; u.arm.hidden = darts;
    u.hint.innerHTML = hint;
  }
  startDarts(v) {
    const G = this.G, P = G.player;
    if (G.save.cash < 50) { G.hud.help('Big Lou plays darts for $50 a game.', 2500); return; }
    G.addCash(-50);
    P.place(v.ox - 6.6, v.oz + 1, -Math.PI / 2);
    P.pose = 'throw'; P.poseT = 1;
    G.cam.yaw = -Math.PI / 2; G.cam.pitch = 0.08; G.cam.snap = true;
    G.activity = 'darts';
    this.mini = { kind: 'darts', t: 0, darts: [], score: 0, cool: 0.6, done: 0 };
    this.showMini('Darts · $50 stake', 'Beat Big Lou', true, '<kbd>Space</kbd> or tap to throw · 9 darts · win pays $100');
    G.hud.say([{ who: 'Big Lou', text: 'Nine darts. Beat my score and I pay double. You won’t.' }]);
  }
  updateDarts(dt) {
    const G = this.G, P = G.player, m = this.mini, u = this.miniUI;
    m.t += dt; m.cool -= dt;
    const A = 0.07 + (G.drunk || 0) * 0.15;
    const rx = 0.5 + Math.sin(m.t * 1.9) * A + Math.sin(m.t * 4.3) * A * 0.3;
    const ry = 0.5 + Math.cos(m.t * 1.45) * A * 0.9 + Math.sin(m.t * 3.3) * A * 0.25;
    if (m.darts.length < 9 && m.cool <= 0 && (G.input.hit('Space') || G.input.hit('Mouse0'))) {
      const s = dartScore(rx, ry);
      m.darts.push({ x: rx, y: ry }); m.score += s.pts; m.cool = 0.55;
      P.poseT = 0;
      G.audio.punch(true);
      u.info.innerHTML = `<b>${s.name}</b> · ${s.pts} · total ${m.score}`;
    }
    const g = u.canvas.getContext('2d'), S = u.canvas.width;
    drawBoard(g, S, m.darts);
    if (m.darts.length < 9) {
      g.strokeStyle = '#21e6ff'; g.lineWidth = 3;
      g.beginPath(); g.arc(rx * S, ry * S, S * 0.03, 0, 7); g.moveTo(rx * S - S * 0.05, ry * S); g.lineTo(rx * S + S * 0.05, ry * S); g.moveTo(rx * S, ry * S - S * 0.05); g.lineTo(rx * S, ry * S + S * 0.05); g.stroke();
      if (!m.darts.length) u.info.textContent = `Dart 1 of 9`;
    } else if ((m.done += dt) > 1.4) {
      const lou = 110 + Math.floor(Math.random() * 120);
      const win = m.score > lou;
      if (win) { G.addCash(100); G.audio.cash(); }
      G.hud.banner(win ? 'You beat Big Lou' : 'Big Lou wins', `You ${m.score} · Lou ${lou}${win ? ' · +$100' : ''}`, win ? '#3dff9e' : '#ff8a3d', 3800);
      G.hud.say([{ who: 'Big Lou', text: win ? 'Beginner’s luck. Again tomorrow.' : 'Fifty bucks, thank you very much.' }]);
      this.endMini();
    }
  }
  startArm(v) {
    const G = this.G, P = G.player;
    if (G.save.cash < 100) { G.hud.help('Big Lou arm wrestles for $100.', 2500); return; }
    G.addCash(-100);
    P.place(v.ox - 6.05, v.oz + 4.6, Math.PI / 2);
    P.pose = 'arm'; P.poseT = 0;
    if (this.lou) this.lou.pose = 'arm';
    G.cam.yaw = Math.PI / 2 + 0.9; G.cam.pitch = 0.3; G.cam.snap = true;
    G.activity = 'arm';
    this.mini = { kind: 'arm', t: -2, p: 0.5, lou: 0.2 + (G.save.stats.armWins || 0) * 0.02 };
    this.showMini('Arm wrestling · $100 stake', 'Big Lou', false, 'Mash <kbd>Space</kbd> or tap as fast as you can · win pays $200');
  }
  updateArm(dt) {
    const G = this.G, P = G.player, m = this.mini, u = this.miniUI;
    m.t += dt;
    if (m.t < 0) { u.info.textContent = m.t < -1 ? 'Grip…' : 'Ready…'; }
    else if (!m.over) {
      if (m.t < 0.15) u.info.textContent = 'Go!';
      m.p -= (m.lou + Math.max(0, Math.sin(m.t * 2.3)) * 0.12) * dt;
      if (G.input.hit('Space') || G.input.hit('Mouse0')) m.p += 0.05 * (1 - (G.drunk || 0) * 0.35);
      m.p = Math.max(0, Math.min(1, m.p));
      if (m.p >= 1 || m.p <= 0) {
        m.over = true; m.end = 1.6;
        const win = m.p >= 1;
        if (win) { G.addCash(200); G.audio.cash(); G.save.stats.armWins = (G.save.stats.armWins || 0) + 1; }
        u.info.textContent = win ? 'You win!' : 'Lou wins';
        G.hud.banner(win ? 'Arm of steel' : 'Slammed', win ? '+$200 · Lou wants a rematch' : 'Lou keeps your $100', win ? '#3dff9e' : '#ff8a3d', 3500);
        G.hud.say([{ who: 'Big Lou', text: win ? 'Nobody beats Big Lou… What just happened?' : 'Come back when you’ve been eating your vegetables.' }]);
      }
    } else if ((m.end -= dt) <= 0) { this.endMini(); return; }
    u.arm.style.setProperty('--p', m.p);
    const tilt = (m.p - 0.5) * 1.6;
    P.poseStyle = -tilt;
    if (this.lou) this.lou.style = tilt;
  }
  endMini(silent) {
    const G = this.G, P = G.player, m = this.mini;
    if (!m) return;
    this.mini = null;
    this.miniUI.root.hidden = true;
    this.miniUI.info.textContent = '';
    G.activity = null; P.pose = null; P.poseStyle = 0;
    if (this.lou) { this.lou.pose = 'sit'; this.lou.style = 0; }
    if (!silent) G.persist();
  }
  // ---------- dance floor ----------
  setupDanceUI() {
    this.ui = { root: document.querySelector('#dance'), lanes: [...document.querySelectorAll('#dance .lane')], score: document.querySelector('#danceScore'), combo: document.querySelector('#danceCombo'), judge: document.querySelector('#danceJudge'), bar: document.querySelector('#danceBar') };
    const codes = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight'];
    this.ui.lanes.forEach((l, i) => l.addEventListener('pointerdown', e => { e.preventDefault(); this.G.input.hits.add(codes[i]); }));
  }
  startDance() {
    const G = this.G, P = G.player, v = this.v.nightclub;
    const beat = 60 / 122, dur = 30, notes = [];
    for (let t = 2; t < dur; t += beat) {
      if (Math.random() < 0.82) notes.push({ lane: Math.floor(Math.random() * 4), time: t });
      if (t > 10 && Math.random() < 0.18) notes.push({ lane: Math.floor(Math.random() * 4), time: t + beat / 2 });
    }
    this.dance = { t: 0, dur, notes, travel: 1.6, score: 0, combo: 0, best: 0, hits: 0, perfect: 0 };
    P.place(v.ox, v.oz - 1, Math.PI);
    G.cam.yaw = 0; G.cam.pitch = 0.32; G.cam.snap = true;
    G.activity = 'dance';
    this.ui.root.hidden = false;
    this.ui.score.textContent = '0'; this.ui.combo.textContent = ''; this.ui.judge.textContent = 'Get ready…';
    G.hud.help('', 10);
  }
  judge(text, cls) {
    const j = this.ui.judge;
    j.textContent = text; j.className = cls;
    void j.offsetWidth; j.classList.add('pop');
  }
  updateDance(dt) {
    const G = this.G, P = G.player, d = this.dance, I = G.input;
    d.t += dt;
    const keys = [['ArrowLeft', 'KeyA'], ['ArrowDown', 'KeyS'], ['ArrowUp', 'KeyW'], ['ArrowRight', 'KeyD']];
    keys.forEach((ks, lane) => {
      if (!ks.some(k => I.hit(k))) return;
      this.ui.lanes[lane].classList.remove('hit'); void this.ui.lanes[lane].offsetWidth; this.ui.lanes[lane].classList.add('hit');
      let best = null;
      for (const n of d.notes) if (!n.done && n.lane === lane && Math.abs(n.time - d.t) < 0.26 && (!best || Math.abs(n.time - d.t) < Math.abs(best.time - d.t))) best = n;
      if (!best) { d.combo = 0; this.judge('Off beat', 'miss'); return; }
      const err = Math.abs(best.time - d.t);
      best.done = true; best.el?.remove();
      d.combo++; d.hits++; d.best = Math.max(d.best, d.combo);
      const mult = 1 + Math.min(d.combo, 30) / 10;
      if (err < 0.09) { d.score += Math.round(100 * mult); d.perfect++; this.judge('Perfect!', 'perfect'); }
      else { d.score += Math.round(50 * mult); this.judge('Good', 'good'); }
    });
    if (I.hit('KeyF')) { this.endDance(); return; }
    const H = this.ui.lanes[0].clientHeight || 360;
    for (const n of d.notes) {
      if (n.done) continue;
      const dtn = n.time - d.t;
      if (dtn < -0.26) { n.done = true; n.el?.remove(); d.combo = 0; this.judge('Miss', 'miss'); continue; }
      if (dtn > d.travel) continue;
      if (!n.el) { n.el = document.createElement('i'); n.el.className = 'note n' + n.lane; n.el.textContent = ['←', '↓', '↑', '→'][n.lane]; this.ui.lanes[n.lane].appendChild(n.el); }
      n.el.style.transform = `translateY(${(1 - dtn / d.travel) * (H - 70)}px)`;
    }
    this.ui.score.textContent = d.score.toLocaleString('en-US');
    this.ui.combo.textContent = d.combo > 2 ? `${d.combo} combo` : '';
    this.ui.bar.style.width = Math.min(100, d.t / d.dur * 100) + '%';
    P.m.root.position.set(P.x, P.y, P.z);
    P.m.root.rotation.y = P.yaw;
    P.m.gun.visible = false;
    posePerson(P.m, 'dance', d.t * 4.1 * (d.combo > 10 ? 1.25 : 1), d.combo > 10 ? 1 : 0);
    if (d.t > d.dur + 0.5) this.endDance();
  }
  endDance(silent) {
    const G = this.G, d = this.dance;
    this.dance = null;
    G.activity = null;
    this.ui.root.hidden = true;
    for (const n of d.notes) n.el?.remove();
    if (silent) return;
    const total = d.notes.length, acc = total ? d.hits / total : 0;
    const tips = Math.round(d.score / 40);
    G.addCash(tips);
    G.audio.cash();
    const title = acc > 0.9 ? 'Disco legend' : acc > 0.7 ? 'Smooth moves' : acc > 0.4 ? 'Not bad' : 'Two left feet';
    G.hud.banner(title, `${Math.round(acc * 100)}% on the beat · best combo ${d.best} · tips ${money(tips)}`, '#21e6ff', 4200);
    G.save.stats.bestDance = Math.max(G.save.stats.bestDance || 0, d.score);
    G.persist();
  }
  blips() {
    const pr = this.props(), out = [];
    for (const k of KEYS) out.push({ x: PLACES[k].x, z: PLACES[k].z, color: pr[k]?.owned ? '#3dff9e' : VENUES[k].color, icon: VENUES[k].icon });
    out.push({ x: PLACES.tiki.x, z: PLACES.tiki.z, color: '#ffb347', icon: 'T' });
    return out;
  }
}
