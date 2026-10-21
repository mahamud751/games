// Low-poly 3D padel players built from primitives, with a small pose library.
import * as THREE from 'three';

const mats = new Map();
function mat(color, rough = 0.62, metal = 0) {
  const k = color + rough + metal;
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
  return mats.get(k);
}
function mesh(geo, m, cast = true) { const o = new THREE.Mesh(geo, m); o.castShadow = cast; return o; }
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);

function racketTexture(face, accent) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 256, 256);
  gr.addColorStop(0, face); gr.addColorStop(1, accent);
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, 108, 256, 14);
  // the sweet spot is drilled with holes, as on a real padel racket
  g.fillStyle = 'rgba(10,10,20,.75)';
  for (let y = 40; y < 230; y += 22) for (let x = 40; x < 230; x += 22) {
    const dx = (x - 128) / 100, dy = (y - 128) / 108;
    if (dx * dx + dy * dy < 0.72) { g.beginPath(); g.arc(x + (y / 22 % 2) * 11 - 5, y, 5, 0, 7); g.fill(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function backTexture(num, color, text) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = text; g.font = 'bold 76px "Barlow Condensed", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(num), 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; void color; return t;
}

export function makeRacket(r) {
  const g = new THREE.Group();
  const handle = mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.15, 10), mat('#111827', 0.5));
  handle.position.y = -0.06; g.add(handle);
  const grip = mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.09, 10), mat(r.grip || '#f8fafc', 0.8));
  grip.position.y = -0.03; g.add(grip);
  const throat = mesh(new THREE.ConeGeometry(0.06, 0.1, 3), mat(r.frame || '#111827', 0.4, 0.3));
  throat.position.y = -0.17; throat.rotation.x = Math.PI; throat.scale.z = 0.35; g.add(throat);
  const face = mesh(new THREE.CircleGeometry(0.125, 28), new THREE.MeshStandardMaterial({ map: racketTexture(r.face, r.accent || r.face), roughness: 0.4, metalness: 0.15, side: THREE.DoubleSide }));
  face.position.y = -0.33; face.scale.y = 1.12; g.add(face);
  const rim = mesh(new THREE.TorusGeometry(0.125, 0.016, 8, 30), mat(r.frame || '#111827', 0.35, 0.5));
  rim.position.y = -0.33; rim.scale.y = 1.12; g.add(rim);
  return g;
}

export function makePlayer(look, num = 7) {
  const skin = mat(look.skin, 0.7), shirt = mat(look.shirt, 0.75), shorts = mat(look.shorts, 0.8), shoe = mat(look.shoes, 0.5), sock = mat('#f8fafc', 0.9);
  const hairM = mat(look.hair, 0.85);
  const root = new THREE.Group();
  const pelvis = new THREE.Group(); pelvis.position.y = 0.92; root.add(pelvis);
  const hips = mesh(new THREE.CylinderGeometry(0.165, 0.155, 0.24, 14), shorts); hips.position.y = -0.03; pelvis.add(hips);
  const spine = new THREE.Group(); spine.position.y = 0.08; spine.rotation.order = 'YXZ'; pelvis.add(spine);
  const torso = mesh(cap(0.15, 0.3), shirt); torso.position.y = 0.25; torso.scale.set(1.18, 1, 0.78); spine.add(torso);
  const stripe = mesh(new THREE.BoxGeometry(0.03, 0.42, 0.25), mat(look.accent, 0.7)); stripe.position.set(0.175, 0.26, 0); spine.add(stripe);
  const stripe2 = stripe.clone(); stripe2.position.x = -0.175; spine.add(stripe2);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: backTexture(num, look.shirt, look.accent), transparent: true }));
  back.position.set(0, 0.3, 0.125); spine.add(back);
  const neck = new THREE.Group(); neck.position.y = 0.52; spine.add(neck);
  const neckM = mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 10), skin); neckM.position.y = 0.03; neck.add(neckM);
  const head = new THREE.Group(); head.position.y = 0.15; neck.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.115, 20, 16), skin));
  const eyeM = mat('#111827', 0.3);
  for (const s of [-1, 1]) {
    const e = mesh(new THREE.SphereGeometry(0.015, 8, 6), eyeM, false); e.position.set(s * 0.042, 0.015, -0.105); head.add(e);
    const ear = mesh(new THREE.SphereGeometry(0.025, 8, 6), skin, false); ear.position.set(s * 0.112, 0, 0); ear.scale.z = 0.6; head.add(ear);
  }
  const nose = mesh(new THREE.SphereGeometry(0.018, 8, 6), skin, false); nose.position.set(0, -0.012, -0.115); head.add(nose);
  // hair
  const hairStyle = look.hairStyle;
  if (hairStyle !== 'bald') {
    const top = mesh(new THREE.SphereGeometry(0.123, 20, 12, 0, Math.PI * 2, 0, Math.PI * (hairStyle === 'long' ? 0.7 : 0.55)), hairM);
    top.position.y = 0.012; top.rotation.x = -0.25; head.add(top);
  }
  if (hairStyle === 'pony' || hairStyle === 'long') {
    const pony = mesh(cap(0.04, hairStyle === 'long' ? 0.18 : 0.14), hairM); pony.position.set(0, -0.03, 0.13); pony.rotation.x = 0.5; head.add(pony);
    head.userData.pony = pony;
  }
  if (hairStyle === 'bun') { const bun = mesh(new THREE.SphereGeometry(0.055, 12, 10), hairM); bun.position.set(0, 0.1, 0.07); head.add(bun); }
  if (hairStyle === 'cap') {
    const c = mesh(new THREE.SphereGeometry(0.126, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(look.accent, 0.7)); c.position.y = 0.012; head.add(c);
    const brim = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.012, 16, 1, false, Math.PI * 0.5, Math.PI), mat(look.accent, 0.7)); brim.position.set(0, 0.02, -0.09); brim.scale.z = 1.2; head.add(brim);
  }
  if (look.band) { const band = mesh(new THREE.TorusGeometry(0.117, 0.014, 6, 24), mat(look.band, 0.8)); band.rotation.x = Math.PI / 2 - 0.15; band.position.y = 0.035; head.add(band); }
  if (look.beard) { const b = mesh(new THREE.SphereGeometry(0.1, 14, 10, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), hairM); b.position.set(0, -0.01, -0.012); head.add(b); }

  function arm(sgn) {
    const sh = new THREE.Group(); sh.position.set(sgn * 0.215, 0.44, 0); spine.add(sh);
    const sleeve = mesh(new THREE.CylinderGeometry(0.062, 0.056, 0.13, 10), shirt); sleeve.position.y = -0.04; sh.add(sleeve);
    const up = mesh(cap(0.047, 0.2), skin); up.position.y = -0.15; sh.add(up);
    const el = new THREE.Group(); el.position.y = -0.29; sh.add(el);
    const fo = mesh(cap(0.042, 0.19), skin); fo.position.y = -0.13; el.add(fo);
    const wb = mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.05, 10), mat(look.accent, 0.8)); wb.position.y = -0.22; el.add(wb);
    const hand = new THREE.Group(); hand.position.y = -0.27; el.add(hand);
    hand.add(mesh(new THREE.SphereGeometry(0.046, 10, 8), skin));
    return { sh, el, hand };
  }
  function leg(sgn) {
    const hp = new THREE.Group(); hp.position.set(sgn * 0.09, -0.06, 0); pelvis.add(hp);
    const leg = mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.14, 10), shorts); leg.position.y = -0.06; hp.add(leg);
    const th = mesh(cap(0.064, 0.26), skin); th.position.y = -0.21; hp.add(th);
    const kn = new THREE.Group(); kn.position.y = -0.42; hp.add(kn);
    const sh = mesh(cap(0.054, 0.28), skin); sh.position.y = -0.2; kn.add(sh);
    const so = mesh(new THREE.CylinderGeometry(0.058, 0.052, 0.12, 10), sock); so.position.y = -0.32; kn.add(so);
    const ft = new THREE.Group(); ft.position.y = -0.42; kn.add(ft);
    const s = mesh(new THREE.BoxGeometry(0.11, 0.075, 0.27), shoe); s.position.set(0, -0.005, -0.055); ft.add(s);
    const sole = mesh(new THREE.BoxGeometry(0.115, 0.02, 0.28), mat('#f8fafc', 0.6)); sole.position.set(0, -0.045, -0.055); ft.add(sole);
    return { hp, kn, ft };
  }
  const R = arm(1), L = arm(-1), LL = leg(-1), RL = leg(1);
  const racket = makeRacket(look.racket);
  R.hand.add(racket);
  root.traverse(o => { if (o.isMesh) o.receiveShadow = false; });
  return { root, pelvis, spine, head, neck, R, L, LL, RL, racket, look };
}

// ---------- poses (facing -Z, right-handed) ----------
// hip: pelvis drop, lean: torso forward, twist: torso yaw (+ = chest turns to the player's left)
const base = { hip: 0, lean: 0.05, twist: 0, side: 0, head: 0, rS: [0.15, 0, 0.12], rE: 0.3, rW: 0, lS: [0.1, 0, -0.1], lE: 0.25, lH: 0, lK: 0, rH: 0, rK: 0 };
const mk = o => Object.assign({}, base, o);
export const POSE = {
  idle: mk({}),
  ready: mk({ hip: -0.1, lean: 0.35, rS: [0.7, 0, 0.25], rE: 1.0, rW: -0.3, lS: [0.6, 0, -0.25], lE: 1.1, lH: 0.45, lK: -0.8, rH: 0.45, rK: -0.8 }),
  fhPrep: mk({ hip: -0.12, lean: 0.25, twist: -1.0, rS: [-0.2, 0, 1.0], rE: 0.5, rW: 0.3, lS: [1.0, 0, -0.1], lE: 0.4, lH: 0.5, lK: -0.7, rH: 0.2, rK: -0.9 }),
  fhHit: mk({ hip: -0.1, lean: 0.3, twist: -0.1, rS: [1.3, 0, 0.55], rE: 0.15, rW: 0.1, lS: [0.6, 0, -0.5], lE: 0.8, lH: 0.5, lK: -0.6, rH: 0.1, rK: -0.6 }),
  fhEnd: mk({ hip: -0.08, lean: 0.3, twist: 0.9, rS: [1.5, 0, -0.5], rE: 1.3, rW: 0.3, lS: [0.3, 0, -0.3], lE: 1.0, lH: 0.4, lK: -0.5, rH: -0.1, rK: -0.7 }),
  bhPrep: mk({ hip: -0.12, lean: 0.3, twist: 1.0, rS: [0.9, 0, -0.9], rE: 1.1, rW: 0.4, lS: [0.7, 0, -0.4], lE: 1.2, lH: 0.2, lK: -0.9, rH: 0.5, rK: -0.7 }),
  bhHit: mk({ hip: -0.1, lean: 0.3, twist: 0.2, rS: [1.3, 0, -0.1], rE: 0.25, rW: 0.1, lS: [0.5, 0, -0.5], lE: 0.8, lH: 0.1, lK: -0.6, rH: 0.5, rK: -0.6 }),
  bhEnd: mk({ hip: -0.08, lean: 0.25, twist: -0.7, rS: [1.4, 0, 0.9], rE: 0.4, rW: 0.2, lS: [0.3, 0, -0.6], lE: 0.6, lH: -0.1, lK: -0.7, rH: 0.4, rK: -0.5 }),
  vfhPrep: mk({ hip: -0.1, lean: 0.35, twist: -0.5, rS: [0.6, 0, 0.9], rE: 1.0, rW: 0.2, lS: [0.8, 0, -0.3], lE: 0.8, lH: 0.4, lK: -0.7, rH: 0.4, rK: -0.7 }),
  vfhHit: mk({ hip: -0.1, lean: 0.35, twist: -0.1, rS: [1.2, 0, 0.35], rE: 0.6, rW: 0, lS: [0.6, 0, -0.4], lE: 0.8, lH: 0.5, lK: -0.6, rH: 0.3, rK: -0.7 }),
  vbhPrep: mk({ hip: -0.1, lean: 0.35, twist: 0.5, rS: [0.9, 0, -0.6], rE: 1.2, rW: 0.2, lS: [0.8, 0, -0.4], lE: 1.0, lH: 0.4, lK: -0.7, rH: 0.4, rK: -0.7 }),
  vbhHit: mk({ hip: -0.1, lean: 0.35, twist: 0.1, rS: [1.2, 0, -0.1], rE: 0.6, rW: 0, lS: [0.6, 0, -0.4], lE: 0.8, lH: 0.4, lK: -0.7, rH: 0.4, rK: -0.6 }),
  smashPrep: mk({ hip: -0.04, lean: -0.2, twist: -0.6, rS: [3.6, 0, 0.35], rE: 1.7, rW: 0.5, lS: [2.9, 0, -0.25], lE: 0.2, lH: 0.2, lK: -0.3, rH: -0.2, rK: -0.4 }),
  smashHit: mk({ hip: -0.02, lean: 0.45, twist: 0.3, rS: [2.4, 0, 0.2], rE: 0.1, rW: 0.2, lS: [0.8, 0, -0.4], lE: 0.8, lH: 0.5, lK: -0.3, rH: -0.2, rK: -0.6 }),
  smashEnd: mk({ hip: -0.06, lean: 0.6, twist: 0.6, rS: [0.6, 0, -0.5], rE: 0.6, rW: 0.2, lS: [0.4, 0, -0.4], lE: 0.6, lH: 0.4, lK: -0.6, rH: -0.1, rK: -0.8 }),
  lobPrep: mk({ hip: -0.2, lean: 0.45, twist: -0.5, rS: [-0.5, 0, 0.6], rE: 0.2, rW: -0.3, lS: [0.8, 0, -0.3], lE: 0.6, lH: 0.7, lK: -1.2, rH: 0.4, rK: -1.1 }),
  lobHit: mk({ hip: -0.08, lean: 0.05, twist: -0.1, rS: [2.4, 0, 0.4], rE: 0.2, rW: 0.4, lS: [0.6, 0, -0.4], lE: 0.6, lH: 0.4, lK: -0.5, rH: 0.2, rK: -0.5 }),
  servePrep: mk({ hip: -0.05, lean: 0.2, twist: -0.6, rS: [-0.6, 0, 0.5], rE: 0.3, rW: 0.2, lS: [0.9, 0, -0.2], lE: 0.3, lH: 0.3, lK: -0.4, rH: 0, rK: -0.3 }),
  serveHit: mk({ hip: -0.05, lean: 0.2, twist: 0.1, rS: [1.4, 0, 0.3], rE: 0.2, rW: 0.1, lS: [0.6, 0, -0.3], lE: 0.6, lH: 0.3, lK: -0.4, rH: 0, rK: -0.3 }),
  serveEnd: mk({ hip: -0.03, lean: 0.1, twist: 0.4, rS: [2.2, 0, 0.1], rE: 0.4, rW: 0.2, lS: [0.4, 0, -0.3], lE: 0.6, lH: 0.2, lK: -0.3, rH: 0, rK: -0.3 }),
  cheer: mk({ hip: 0.02, lean: -0.1, rS: [3.0, 0, 0.35], rE: 0.3, rW: 0.2, lS: [3.0, 0, -0.35], lE: 0.3 }),
  sad: mk({ hip: -0.04, lean: 0.65, head: 0.45, rS: [0.25, 0, 0.1], rE: 0.3, lS: [0.15, 0, -0.1], lE: 0.2, lH: 0.1, lK: -0.2, rH: 0.1, rK: -0.2 }),
};
export const SWINGS = {
  fh: ['fhPrep', 'fhHit', 'fhEnd'], bh: ['bhPrep', 'bhHit', 'bhEnd'],
  vfh: ['vfhPrep', 'vfhHit', 'fhHit'], vbh: ['vbhPrep', 'vbhHit', 'bhHit'],
  smash: ['smashPrep', 'smashHit', 'smashEnd'], power: ['smashPrep', 'smashHit', 'smashEnd'],
  lob: ['lobPrep', 'lobHit', 'lobHit'], serve: ['servePrep', 'serveHit', 'serveEnd'],
};

export function lerpPose(a, b, t) {
  const o = {};
  for (const k in base) {
    const va = a[k], vb = b[k];
    o[k] = Array.isArray(va) ? va.map((v, i) => v + (vb[i] - v) * t) : va + (vb - va) * t;
  }
  return o;
}
export function runPose(phase, speed) {
  const s = Math.sin(phase), c = Math.cos(phase), k = Math.min(1, speed / 4);
  const p = Object.assign({}, POSE.ready);
  p.lean = 0.35 + 0.12 * k;
  p.hip = -0.08 - Math.abs(s) * 0.05 * k;
  p.lH = 0.3 + s * 0.75 * k; p.rH = 0.3 - s * 0.75 * k;
  p.lK = -0.35 - Math.max(0, -c) * 1.1 * k - 0.3; p.rK = -0.35 - Math.max(0, c) * 1.1 * k - 0.3;
  p.lS = [0.4 - s * 0.6 * k, 0, -0.2]; p.lE = 1.1;
  p.rS = [0.7 + s * 0.3 * k, 0, 0.3]; p.rE = 1.0;
  return p;
}

export function applyPose(rig, p, t = 0) {
  rig.pelvis.position.y = 0.92 + p.hip;
  rig.spine.rotation.set(-p.lean, p.twist, p.side);
  rig.neck.rotation.x = p.lean * 0.6 - p.head;
  rig.R.sh.rotation.set(p.rS[0], p.rS[1], p.rS[2]);
  rig.R.el.rotation.x = p.rE;
  rig.R.hand.rotation.x = p.rW;
  rig.L.sh.rotation.set(p.lS[0], p.lS[1], p.lS[2]);
  rig.L.el.rotation.x = p.lE;
  rig.LL.hp.rotation.x = p.lH; rig.LL.kn.rotation.x = p.lK; rig.LL.ft.rotation.x = -p.lH - p.lK;
  rig.RL.hp.rotation.x = p.rH; rig.RL.kn.rotation.x = p.rK; rig.RL.ft.rotation.x = -p.rH - p.rK;
  if (rig.head.userData.pony) rig.head.userData.pony.rotation.x = 0.5 + Math.sin(t * 9) * 0.12;
}
