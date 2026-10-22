// Low-poly models built from boxes: cars (static parts merged per material),
// people with swinging limbs, the police helicopter and pickups.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const CAR_TYPES = {
  sedan: { name: 'Marquis', L: 4.7, W: 1.9, H: 1.42, wr: 0.36, top: 40, acc: 9, grip: 7.5, hp: 100, mass: 1.2, colors: ['#7b1f2b', '#2f4f6f', '#c7c2b5', '#3e6b4f', '#5a5f66', '#e9e4da', '#6b4a8f'] },
  sports: { name: 'Stiletto', L: 4.4, W: 2.0, H: 1.12, wr: 0.34, top: 58, acc: 16, grip: 9, hp: 90, mass: 1, sporty: true, colors: ['#e0222f', '#f4f4f4', '#151515', '#ffcc00', '#ff4fa3', '#2fd0ff'] },
  convertible: { name: 'Flamenco', L: 4.6, W: 1.95, H: 1.0, wr: 0.35, top: 46, acc: 12, grip: 8, hp: 90, mass: 1.1, open: true, colors: ['#ff7eb6', '#5ee0c8', '#f5f0e1', '#8ab6ff', '#ffb347'] },
  taxi: { name: 'Cabana Cab', L: 4.8, W: 1.9, H: 1.45, wr: 0.36, top: 40, acc: 9.5, grip: 7.5, hp: 110, mass: 1.2, taxi: true, colors: ['#f6c445'] },
  van: { name: 'Pelican', L: 5.2, W: 2.1, H: 2.3, wr: 0.4, top: 32, acc: 7, grip: 6.5, hp: 140, mass: 1.8, van: true, colors: ['#e8e6df', '#6a8caf', '#c46a3d', '#8e9a5b'] },
  muscle: { name: 'Razorback', L: 4.9, W: 2.0, H: 1.25, wr: 0.38, top: 50, acc: 13, grip: 7, hp: 115, mass: 1.3, colors: ['#ff8a00', '#1d2d6b', '#2b2b2b', '#a51d2d', '#2f8f6f'] },
  police: { name: 'Interceptor', L: 4.8, W: 1.95, H: 1.4, wr: 0.37, top: 52, acc: 14, grip: 8.5, hp: 130, mass: 1.4, police: true, colors: ['#f2f2f2'] },
  swat: { name: 'Bulwark', L: 5.4, W: 2.2, H: 2.4, wr: 0.45, top: 40, acc: 10, grip: 7, hp: 260, mass: 2.3, van: true, police: true, colors: ['#22262e'] }
};

const cache = new Map();
export function paint(hex, rough = 0.38, metal = 0.35) {
  const k = hex + rough + metal;
  if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal }));
  return cache.get(k);
}
const GLASS = new THREE.MeshStandardMaterial({ color: '#101826', roughness: 0.08, metalness: 0.85 });
const DARK = new THREE.MeshStandardMaterial({ color: '#16171b', roughness: 0.85 });
const CHROME = new THREE.MeshStandardMaterial({ color: '#c9cdd3', roughness: 0.25, metalness: 1 });
export const HEAD_MAT = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.5, 2.2) });
const WRECK = new THREE.MeshStandardMaterial({ color: '#1b1a19', roughness: 1 });

function box(w, h, d, x, y, z) { return new THREE.BoxGeometry(w, h, d).translate(x, y, z); }
const wheelGeo = new THREE.CylinderGeometry(1, 1, 1, 14).rotateZ(Math.PI / 2);
const hubGeo = new THREE.CylinderGeometry(1, 1, 1, 8).rotateZ(Math.PI / 2);

export function buildCar(type, color) {
  const t = CAR_TYPES[type];
  const { L, W, H, wr } = t;
  const g = new THREE.Group();
  const body = [], dark = [], glass = [], head = [], tail = [], chrome = [];
  const y0 = wr * 0.6;
  const hb = t.van ? H - y0 - 0.05 : (H - y0) * (t.open ? 0.62 : 0.5);
  body.push(box(W, hb, L, 0, y0 + hb / 2, 0));
  if (t.van) {
    glass.push(box(W + 0.02, 0.55, L * 0.62, 0, H - 0.75, -L * 0.05));
    glass.push(box(W - 0.3, 0.7, 0.04, 0, H - 0.8, L / 2 + 0.01));
    body.push(box(W - 0.1, 0.5, 0.5, 0, y0 + 0.25, L / 2 + 0.2));
  } else if (t.open) {
    glass.push(box(W * 0.84, 0.36, 0.06, 0, y0 + hb + 0.18, L * 0.12));
    dark.push(box(W * 0.36, 0.5, 0.5, W * 0.21, y0 + hb, -L * 0.08), box(W * 0.36, 0.5, 0.5, -W * 0.21, y0 + hb, -L * 0.08));
    dark.push(box(W * 0.8, 0.4, 0.6, 0, y0 + hb - 0.05, -L * 0.3));
  } else {
    const ch = H - y0 - hb - 0.06;
    glass.push(box(W * 0.84, ch, L * (t.sporty ? 0.4 : 0.46), 0, y0 + hb + ch / 2, -L * 0.05));
    body.push(box(W * 0.8, 0.07, L * (t.sporty ? 0.34 : 0.4), 0, H - 0.03, -L * 0.06));
  }
  if (t.sporty) {
    body.push(box(W * 0.92, 0.06, 0.32, 0, y0 + hb + 0.32, -L / 2 + 0.22));
    dark.push(box(0.08, 0.3, 0.08, W * 0.3, y0 + hb + 0.15, -L / 2 + 0.22), box(0.08, 0.3, 0.08, -W * 0.3, y0 + hb + 0.15, -L / 2 + 0.22));
  }
  if (t.police && !t.van) {
    dark.push(box(W + 0.02, hb * 0.55, L * 0.42, 0, y0 + hb * 0.3, -L * 0.02));
  }
  if (t.police && t.van) chrome.push(box(W + 0.03, 0.12, L * 0.9, 0, y0 + hb * 0.45, 0));
  dark.push(box(W + 0.04, 0.24, 0.22, 0, y0 + 0.14, L / 2), box(W + 0.04, 0.24, 0.22, 0, y0 + 0.14, -L / 2));
  dark.push(box(W * 0.5, 0.16, 0.04, 0, y0 + hb * 0.55, L / 2 + 0.01));
  head.push(box(0.36, 0.14, 0.06, W * 0.33, y0 + hb * 0.72, L / 2 + 0.02), box(0.36, 0.14, 0.06, -W * 0.33, y0 + hb * 0.72, L / 2 + 0.02));
  tail.push(box(0.4, 0.14, 0.06, W * 0.32, y0 + hb * 0.72, -L / 2 - 0.02), box(0.4, 0.14, 0.06, -W * 0.32, y0 + hb * 0.72, -L / 2 - 0.02));
  const bodyMat = paint(color, t.police ? 0.5 : 0.32, t.police ? 0.1 : 0.45);
  const add = (list, mat, shadow) => {
    if (!list.length) return null;
    const m = new THREE.Mesh(mergeGeometries(list), mat);
    m.castShadow = !!shadow;
    g.add(m);
    return m;
  };
  const bodyMesh = add(body, bodyMat, true);
  add(dark, DARK, true); add(glass, GLASS); add(chrome, CHROME);
  add(head, HEAD_MAT);
  const tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.03, 0.03) });
  add(tail, tailMat);
  let bar = null;
  if (t.police) {
    const top = t.van ? H : H;
    const red = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 0.02, 0.02) });
    const blue = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.02, 0.05, 0.4) });
    const r = new THREE.Mesh(new THREE.BoxGeometry(W * 0.3, 0.13, 0.26), red); r.position.set(W * 0.16, top + 0.06, -L * 0.05);
    const b = new THREE.Mesh(new THREE.BoxGeometry(W * 0.3, 0.13, 0.26), blue); b.position.set(-W * 0.16, top + 0.06, -L * 0.05);
    g.add(r, b);
    bar = { red, blue };
  }
  if (t.taxi) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.26), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.5, 0.6) }));
    s.position.set(0, H + 0.11, -L * 0.05);
    g.add(s);
  }
  const wheels = [];
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const piv = new THREE.Group();
    piv.position.set(sx * (W / 2 - 0.14), wr, sz * (L / 2 - 0.82));
    const tyre = new THREE.Mesh(wheelGeo, DARK);
    tyre.scale.set(0.26, wr, wr);
    const hub = new THREE.Mesh(hubGeo, CHROME);
    hub.scale.set(0.27, wr * 0.55, wr * 0.55);
    const spin = new THREE.Group();
    spin.add(tyre, hub);
    piv.add(spin);
    g.add(piv);
    wheels.push({ piv, spin, front: sz > 0 });
  }
  return { group: g, wheels, tailMat, bar, bodyMesh, wreck: () => { if (bodyMesh) bodyMesh.material = WRECK; } };
}

// ---------- people ----------
const skinTones = ['#f1c7a3', '#e0ac7e', '#c68b59', '#8d5a3b', '#5e3b26', '#f5d5bf'];
const hairs = ['#1d1510', '#3b2414', '#6b4a2b', '#c9a86a', '#2a2a2a', '#8f3b1d', '#d9d4cc'];
const shirts = ['#ff7eb6', '#5ee0c8', '#ffffff', '#ffd23f', '#8ab6ff', '#ff8a3d', '#c9b6f2', '#e84a5f', '#2f6db5', '#3dbb7a', '#f4e4c1', '#1d1d1d'];
const pantsC = ['#2b3a55', '#e9e1cf', '#3b3b3b', '#7a5c3c', '#5a6b7c', '#c7b28a', '#ffffff', '#1b2440'];

function floralTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#1aa6b7'; g.fillRect(0, 0, 128, 128);
  const cols = ['#ff7eb6', '#ffe066', '#ffffff', '#ff8a3d'];
  for (let n = 0; n < 26; n++) {
    const x = (n * 47) % 128, y = (n * 83) % 128, r = 5 + (n % 3) * 2;
    g.fillStyle = cols[n % cols.length];
    for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.45, 0, 7); g.fill(); }
    g.fillStyle = '#2f7a34';
    g.fillRect(x + r, y - 2, 6, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
let floral = null;

export function personLook(kind, R = Math.random) {
  const pick = a => a[Math.floor(R() * a.length)];
  if (kind === 'player') return { shirt: '#1aa6b7', floral: true, pants: '#3b5f9a', skin: '#e0ac7e', hair: '#1d1510' };
  if (kind === 'cop') return { shirt: '#8fb2df', pants: '#1c2340', skin: pick(skinTones), hair: '#1d1510', hat: '#1c2340' };
  if (kind === 'swat') return { shirt: '#2a2e36', pants: '#2a2e36', skin: pick(skinTones), hair: '#111', hat: '#1a1c20' };
  if (kind === 'thug') return { shirt: pick(['#f2f2f2', '#c0392b', '#1d1d1d', '#8e44ad']), pants: pick(['#1d1d1d', '#e9e1cf', '#2b3a55']), skin: pick(skinTones), hair: pick(hairs), hat: R() < 0.4 ? '#f2f2f2' : null };
  return { shirt: pick(shirts), pants: pick(pantsC), skin: pick(skinTones), hair: pick(hairs), hat: R() < 0.12 ? pick(['#f4e4c1', '#ff7eb6', '#1d1d1d']) : null };
}

const partGeo = {
  leg: box(0.2, 0.86, 0.22, 0, -0.43, 0),
  shoe: box(0.22, 0.1, 0.32, 0, -0.86, 0.04),
  torso: box(0.48, 0.62, 0.28, 0, 0.31, 0),
  sleeve: box(0.16, 0.28, 0.17, 0, -0.12, 0),
  fore: box(0.13, 0.38, 0.14, 0, -0.44, 0),
  head: box(0.26, 0.28, 0.27, 0, 0.14, 0),
  hair: box(0.29, 0.1, 0.3, 0, 0.31, -0.01),
  hairBack: box(0.29, 0.2, 0.06, 0, 0.18, -0.14),
  hat: box(0.32, 0.1, 0.34, 0, 0.32, 0.02),
  brim: box(0.32, 0.03, 0.14, 0, 0.28, 0.2),
  gun: box(0.06, 0.12, 0.3, 0, -0.62, 0.1)
};

export function buildPerson(look) {
  const root = new THREE.Group();
  const skin = paint(look.skin, 0.8, 0), pants = paint(look.pants, 0.85, 0), hair = paint(look.hair, 0.9, 0);
  let shirt = paint(look.shirt, 0.8, 0);
  if (look.floral) {
    floral = floral || floralTexture();
    shirt = new THREE.MeshStandardMaterial({ map: floral, roughness: 0.75 });
  }
  const mk = (geo, mat, parent) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; parent.add(m); return m; };
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(0.12, 0.92, 0); legR.position.set(-0.12, 0.92, 0);
  mk(partGeo.leg, pants, legL); mk(partGeo.shoe, DARK, legL);
  mk(partGeo.leg, pants, legR); mk(partGeo.shoe, DARK, legR);
  const torso = new THREE.Group();
  torso.position.set(0, 0.9, 0);
  mk(partGeo.torso, shirt, torso);
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(0.32, 0.58, 0); armR.position.set(-0.32, 0.58, 0);
  mk(partGeo.sleeve, shirt, armL); mk(partGeo.fore, skin, armL);
  mk(partGeo.sleeve, shirt, armR); mk(partGeo.fore, skin, armR);
  const gun = mk(partGeo.gun, DARK, armR);
  gun.visible = false;
  const head = new THREE.Group();
  head.position.set(0, 0.64, 0);
  mk(partGeo.head, skin, head);
  if (look.hat) { mk(partGeo.hat, paint(look.hat, 0.8, 0), head); mk(partGeo.brim, paint(look.hat, 0.8, 0), head); }
  else { mk(partGeo.hair, hair, head); mk(partGeo.hairBack, hair, head); }
  torso.add(armL, armR, head);
  const body = new THREE.Group();
  body.add(legL, legR, torso);
  root.add(body);
  return { root, body, legL, legR, torso, armL, armR, head, gun };
}

// walk/run/aim pose
export function animatePerson(m, phase, amount, aim, dead) {
  if (dead) return;
  const s = Math.sin(phase) * amount;
  m.legL.rotation.x = s; m.legR.rotation.x = -s;
  m.armL.rotation.x = -s * 0.9;
  m.armR.rotation.x = aim ? -Math.PI / 2 : s * 0.9;
  m.torso.rotation.x = amount > 0.7 ? 0.12 : 0;
  m.body.position.y = Math.abs(Math.cos(phase)) * amount * 0.06;
}

// ---------- helicopter ----------
export function buildHeli() {
  const g = new THREE.Group();
  const navy = paint('#1e2a44', 0.5, 0.3), white = paint('#e8ebef', 0.5, 0.3);
  const parts = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const cab = parts(new THREE.SphereGeometry(1.4, 12, 10), navy, 0, 0, 0.3);
  cab.scale.set(1, 0.9, 1.6);
  parts(new THREE.SphereGeometry(1.0, 10, 8), GLASS, 0, 0.15, 1.6).scale.set(1.05, 0.85, 0.9);
  parts(new THREE.BoxGeometry(0.5, 0.5, 5), white, 0, 0.2, -3.2);
  parts(new THREE.BoxGeometry(0.12, 1.2, 0.7), navy, 0, 0.8, -5.5);
  for (const x of [-1, 1]) {
    parts(new THREE.BoxGeometry(0.1, 0.1, 3.2), DARK, x, -1.35, 0.3);
    parts(new THREE.BoxGeometry(0.08, 0.6, 0.08), DARK, x * 0.8, -1.05, 0.8);
    parts(new THREE.BoxGeometry(0.08, 0.6, 0.08), DARK, x * 0.8, -1.05, -0.4);
  }
  const rotor = new THREE.Group();
  rotor.position.set(0, 1.35, 0.3);
  rotor.add(new THREE.Mesh(new THREE.BoxGeometry(9, 0.05, 0.28), DARK), new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 9), DARK));
  g.add(rotor);
  const tail = new THREE.Group();
  tail.position.set(0.12, 0.8, -5.6);
  tail.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.8, 0.16), DARK));
  g.add(tail);
  const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.2) }));
  beacon.position.set(0, -1.25, 0.6);
  g.add(beacon);
  return { group: g, rotor, tail, beacon };
}

// ---------- pickups ----------
const pickupCache = {};
export function pickupMesh(kind) {
  const g = new THREE.Group();
  const glow = c => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.8) });
  const spec = {
    health: () => { const m = glow('#ff3b6b'); g.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.22), m), new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), m)); },
    armor: () => { g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.6, 6), glow('#3d8bff'))); },
    cash: () => { g.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.35), glow('#3dff9e'))); },
    star: () => { g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.42), glow('#ffd36b'))); },
    shell: () => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 7), glow('#ffb3d9')); m.rotation.z = Math.PI / 2; g.add(m); },
    package: () => { g.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), glow('#ff9a3d'))); },
    pistol: () => { g.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.5), glow('#9ad7ff'))); },
    smg: () => { g.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.8), glow('#9ad7ff'))); },
    shotgun: () => { g.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 1.1), glow('#9ad7ff'))); },
    bat: () => { g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 1, 6), glow('#e8c890'))); }
  };
  (spec[kind] || spec.cash)();
  return g;
}
