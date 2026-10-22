import * as THREE from 'three';

// Side profiles (metres). cabR/cabF = where the glass meets the body, roofR/roofF = roof line.
const SHAPES = {
  coupe:    { len: 4.4, w: 1.9, deck: 0.84, nose: 0.6, roof: 1.3, cabR: -1.15, cabF: 0.7, roofR: -0.55, roofF: 0.15, rw: 0.36, wing: 'lip' },
  fastback: { len: 4.55, w: 1.95, deck: 0.8, nose: 0.52, roof: 1.26, cabR: -1.75, cabF: 0.62, roofR: -0.45, roofF: 0.12, rw: 0.37, wing: 'duck' },
  wedge:    { len: 4.5, w: 1.98, deck: 0.86, nose: 0.44, roof: 1.18, cabR: -1.0, cabF: 0.85, roofR: -0.38, roofF: 0.28, rw: 0.37, wing: 'wing' },
  gt:       { len: 4.7, w: 2.0, deck: 0.84, nose: 0.48, roof: 1.2, cabR: -1.35, cabF: 0.55, roofR: -0.55, roofF: 0.05, rw: 0.38, wing: 'wing' },
  hyper:    { len: 4.75, w: 2.06, deck: 0.8, nose: 0.36, roof: 1.12, cabR: -0.75, cabF: 1.05, roofR: -0.2, roofF: 0.45, rw: 0.38, wing: 'big' },
  police:   { len: 4.85, w: 2.0, deck: 0.95, nose: 0.74, roof: 1.42, cabR: -1.35, cabF: 0.8, roofR: -0.75, roofF: 0.25, rw: 0.38, wing: null },
  sedan:    { len: 4.6, w: 1.9, deck: 0.96, nose: 0.82, roof: 1.46, cabR: -1.3, cabF: 0.85, roofR: -0.75, roofF: 0.3, rw: 0.35, wing: null },
  hatch:    { len: 4.0, w: 1.8, deck: 0.98, nose: 0.82, roof: 1.5, cabR: -1.9, cabF: 0.6, roofR: -1.7, roofF: 0.0, rw: 0.33, wing: null },
  suv:      { len: 4.9, w: 2.0, deck: 1.22, nose: 1.1, roof: 1.86, cabR: -2.2, cabF: 0.9, roofR: -2.1, roofF: 0.25, rw: 0.42, ride: 0.42, wing: null },
  van:      { len: 5.3, w: 2.1, deck: 1.3, nose: 1.05, roof: 2.25, cabR: -2.6, cabF: 1.55, roofR: -2.6, roofF: 1.0, rw: 0.38, ride: 0.36, wing: null, paintCab: true },
};

const BEVEL = 0.1;
const geoCache = new Map();
const matCache = new Map();

function mat(key, make) {
  if (!matCache.has(key)) matCache.set(key, make());
  return matCache.get(key);
}

export function paintMaterial(hex) {
  return mat('paint' + hex, () => new THREE.MeshPhysicalMaterial({
    color: hex, metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06
  }));
}
const glass = () => mat('glass', () => new THREE.MeshPhysicalMaterial({ color: 0x0a0f16, metalness: 0.2, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.92 }));
const trim = () => mat('trim', () => new THREE.MeshStandardMaterial({ color: 0x111317, metalness: 0.4, roughness: 0.55 }));
const tire = () => mat('tire', () => new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 }));
const rim = () => mat('rim', () => new THREE.MeshStandardMaterial({ color: 0xb8bec8, metalness: 0.95, roughness: 0.22 }));
const head = () => mat('head', () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d6, emissiveIntensity: 1.4 }));

let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
let shadowTex = null;
function blobTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 64, 4, 32, 64, 62);
  grd.addColorStop(0, 'rgba(0,0,0,.75)');
  grd.addColorStop(0.6, 'rgba(0,0,0,.4)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.save(); g.scale(1, 1); g.fillRect(0, 0, 64, 128); g.restore();
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

function glow(color, size, opacity = 1) {
  const m = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  return s;
}

function extrude(shape, width) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: width - BEVEL * 2, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 3, curveSegments: 14
  });
  g.translate(0, 0, -(width - BEVEL * 2) / 2);
  g.rotateY(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function bodyGeo(id) {
  const key = 'body' + id;
  if (geoCache.has(key)) return geoCache.get(key);
  const P = SHAPES[id];
  const L = P.len / 2, ride = P.ride ?? 0.3, rw = P.rw, wf = L * 0.64, wr = -L * 0.64;
  const arch = rw + 0.17;
  const s = new THREE.Shape();
  s.moveTo(L - 0.05, ride + 0.08);
  s.lineTo(wf + arch, ride + 0.02);
  s.absarc(wf, ride + 0.02, arch, 0, Math.PI, false);
  s.lineTo(wr + arch, ride + 0.02);
  s.absarc(wr, ride + 0.02, arch, 0, Math.PI, false);
  s.lineTo(-L + 0.05, ride + 0.08);
  s.quadraticCurveTo(-L - 0.04, ride + 0.2, -L - 0.03, P.deck - 0.18);
  s.quadraticCurveTo(-L, P.deck, -L + 0.3, P.deck);
  s.lineTo(P.cabR, P.deck + 0.03);
  s.lineTo(P.cabF, P.deck + 0.02);
  s.quadraticCurveTo(L - 0.5, P.nose + 0.14, L - 0.12, P.nose);
  s.quadraticCurveTo(L + 0.06, P.nose - 0.05, L + 0.02, P.nose - 0.25);
  s.quadraticCurveTo(L + 0.04, ride + 0.12, L - 0.05, ride + 0.08);
  const body = extrude(s, P.w);

  const c = new THREE.Shape();
  c.moveTo(P.cabR, P.deck - 0.04);
  c.quadraticCurveTo((P.cabR + P.roofR) / 2 - 0.05, (P.deck + P.roof) / 2 + 0.06, P.roofR, P.roof);
  c.lineTo(P.roofF, P.roof);
  c.quadraticCurveTo((P.roofF + P.cabF) / 2 + 0.08, (P.deck + P.roof) / 2 + 0.08, P.cabF, P.deck - 0.04);
  c.closePath();
  const cabin = extrude(c, P.w - 0.3);

  const r = new THREE.Shape();
  const inset = 0.12;
  r.moveTo(P.roofR - 0.02, P.roof - 0.06);
  r.lineTo(P.roofF + 0.02, P.roof - 0.06);
  r.lineTo(P.roofF - inset * 0.3, P.roof + 0.025);
  r.lineTo(P.roofR + inset * 0.3, P.roof + 0.025);
  r.closePath();
  const roof = extrude(r, P.w - 0.36);
  const out = { body, cabin, roof, P, L, ride, wf, wr };
  geoCache.set(key, out);
  return out;
}

const wheelGeo = {};
function wheel(rw) {
  if (!wheelGeo[rw]) {
    const t = new THREE.CylinderGeometry(rw, rw, 0.28, 22);
    t.rotateZ(Math.PI / 2);
    const r = new THREE.CylinderGeometry(rw * 0.66, rw * 0.66, 0.29, 14);
    r.rotateZ(Math.PI / 2);
    const spoke = new THREE.BoxGeometry(0.3, rw * 1.15, 0.08);
    wheelGeo[rw] = { t, r, spoke };
  }
  const G = wheelGeo[rw];
  const g = new THREE.Group();
  g.add(new THREE.Mesh(G.t, tire()));
  g.add(new THREE.Mesh(G.r, rim()));
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.Mesh(G.spoke, trim());
    sp.rotation.x = (i * Math.PI) / 3;
    g.add(sp);
  }
  return g;
}

function sideText(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 256, 64);
  g.fillStyle = fg;
  g.font = 'italic 900 40px "Chakra Petch", Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
let policeTex = null;

export function makeCar(shapeId, hex, { police = false, lights = true } = {}) {
  const { body, cabin, roof, P, L, ride, wf, wr } = bodyGeo(shapeId);
  const root = new THREE.Group();
  const tilt = new THREE.Group(); // body roll/pitch lives here; wheels stay planted
  root.add(tilt);
  const paint = paintMaterial(hex);
  const bodyMesh = new THREE.Mesh(body, paint);
  bodyMesh.castShadow = true;
  tilt.add(bodyMesh);
  const cab = new THREE.Mesh(cabin, P.paintCab ? paint : glass());
  cab.castShadow = true;
  tilt.add(cab);
  const roofMesh = new THREE.Mesh(roof, police ? paintMaterial('#f4f6fa') : paint);
  tilt.add(roofMesh);
  if (P.paintCab) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(P.w - 0.26, (P.roof - P.deck) * 0.55, 0.08), glass());
    win.position.set(0, P.deck + (P.roof - P.deck) * 0.5, P.cabF + 0.12);
    win.rotation.x = -0.35;
    tilt.add(win);
  }

  const skirt = new THREE.Mesh(new THREE.BoxGeometry(P.w - 0.1, 0.16, P.len - 0.5), trim());
  skirt.position.y = ride + 0.06;
  tilt.add(skirt);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(P.w * 0.62, 0.14, 0.06), trim());
  grille.position.set(0, ride + 0.24, L + 0.04);
  tilt.add(grille);

  const hl = new THREE.BoxGeometry(0.42, 0.09, 0.08);
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(hl, head());
    h.position.set(sx * (P.w / 2 - 0.36), P.nose - 0.12, L - 0.02);
    tilt.add(h);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1020, emissiveIntensity: 1.1 });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(P.w - 0.3, 0.07, 0.06), tailMat);
  tail.position.set(0, P.deck - 0.14, -L - 0.03);
  tilt.add(tail);

  const glows = { head: [], tail: [] };
  if (lights) {
    for (const sx of [-1, 1]) {
      const h = glow(0xffe8c4, 0.75, 0.45);
      h.position.set(sx * (P.w / 2 - 0.36), P.nose - 0.12, L + 0.2);
      tilt.add(h); glows.head.push(h);
      const t = glow(0xff1830, 0.6, 0.5);
      t.position.set(sx * (P.w / 2 - 0.3), P.deck - 0.14, -L - 0.15);
      tilt.add(t); glows.tail.push(t);
    }
  }

  if (P.wing) {
    const span = P.w - 0.18;
    const h = { lip: 0.05, duck: 0.08, wing: 0.3, big: 0.42 }[P.wing];
    const blade = new THREE.Mesh(new THREE.BoxGeometry(span, 0.05, P.wing === 'big' ? 0.42 : 0.3), P.wing === 'big' ? trim() : paint);
    blade.position.set(0, P.deck + h, -L + 0.28);
    blade.rotation.x = -0.12;
    tilt.add(blade);
    if (h > 0.1) {
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, 0.12), trim());
        post.position.set(sx * span * 0.32, P.deck + h / 2, -L + 0.3);
        tilt.add(post);
      }
    }
  }

  let bar = null;
  if (police) {
    if (!policeTex) policeTex = sideText('POLICE', '#f4f6fa', '#0b1220');
    const doorMat = new THREE.MeshStandardMaterial({ map: policeTex, roughness: 0.35, metalness: 0.2 });
    for (const sx of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.PlaneGeometry(P.len * 0.42, 0.34), doorMat);
      door.position.set(sx * (P.w / 2 + 0.006), (ride + P.deck) / 2 + 0.12, 0.05);
      door.rotation.y = sx * Math.PI / 2;
      tilt.add(door);
    }
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.32), trim());
    base.position.set(0, P.roof + 0.06, (P.roofR + P.roofF) / 2);
    tilt.add(base);
    const red = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff1a2e, emissiveIntensity: 3 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x000a33, emissive: 0x2a5bff, emissiveIntensity: 3 });
    const lr = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.26), red);
    const lb = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.26), blue);
    lr.position.set(-0.3, P.roof + 0.15, base.position.z);
    lb.position.set(0.3, P.roof + 0.15, base.position.z);
    tilt.add(lr, lb);
    const gr = glow(0xff2238, 3.2, 0.9), gb = glow(0x3a6bff, 3.2, 0.9);
    gr.position.copy(lr.position).y += 0.1;
    gb.position.copy(lb.position).y += 0.1;
    tilt.add(gr, gb);
    bar = { red, blue, gr, gb };
  }

  const wheels = [];
  for (const [z, front] of [[wf, true], [wr, false]]) {
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * (P.w / 2 - 0.2), P.rw, z);
      const w = wheel(P.rw);
      pivot.add(w);
      root.add(pivot);
      wheels.push({ pivot, w, front });
    }
  }

  const blob = new THREE.Mesh(new THREE.PlaneGeometry(P.w * 1.35, P.len * 1.2), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.04;
  root.add(blob);

  // nitro flames
  const flames = [];
  if (!police && ['coupe', 'fastback', 'wedge', 'gt', 'hyper'].includes(shapeId)) {
    const fg = new THREE.ConeGeometry(0.11, 0.9, 10, 1, true);
    fg.rotateX(-Math.PI / 2);
    fg.translate(0, 0, -0.45);
    const fm = new THREE.MeshBasicMaterial({ color: 0x66b8ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const sx of [-1, 1]) {
      const f = new THREE.Mesh(fg, fm);
      f.position.set(sx * 0.42, ride + 0.18, -L - 0.02);
      f.visible = false;
      tilt.add(f);
      const fgl = glow(0x5aa8ff, 0.55, 0.7);
      fgl.position.set(sx * 0.42, ride + 0.18, -L - 0.4);
      fgl.visible = false;
      tilt.add(fgl);
      flames.push(f, fgl);
    }
  }

  const car = {
    root, tilt, wheels, bar, flames, glows, tailMat, len: P.len, rw: P.rw,
    setPaint(h) {
      const m = paintMaterial(h);
      bodyMesh.material = m;
      if (!P.paintCab) { if (!police) roofMesh.material = m; } else cab.material = m;
      if (P.wing && P.wing !== 'big') tilt.children.forEach(c => { if (c.material === paint) c.material = m; });
    },
    // speed in m/s, steer -1..1, brake bool, t = clock
    animate(dt, speed, steer, brake, t, nitro = false) {
      for (const wh of wheels) {
        wh.w.rotation.x += (speed * dt) / P.rw;
        if (wh.front) wh.pivot.rotation.y = -steer * 0.42;
      }
      tailMat.emissiveIntensity = brake ? 4 : 1.1;
      for (const g of glows.tail) g.material.opacity = brake ? 1 : 0.5;
      if (bar) {
        const ph = Math.floor(t * 7) % 4;
        const r = ph === 0 || ph === 1 ? 1 : 0.06;
        const b = ph === 2 || ph === 3 ? 1 : 0.06;
        bar.red.emissiveIntensity = r * 5; bar.blue.emissiveIntensity = b * 5;
        bar.gr.material.opacity = r; bar.gb.material.opacity = b;
      }
      for (const f of flames) {
        f.visible = nitro;
        if (nitro) f.scale.set(1, 1, 0.7 + Math.random() * 0.6);
      }
    }
  };
  return car;
}

export function makeTruck(hex) {
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  root.add(tilt);
  const paint = paintMaterial(hex);
  const box = mat('trailer', () => new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: 0.6, metalness: 0.1 }));
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.3, 2.2), paint);
  cab.position.set(0, 1.75, 3.55);
  cab.castShadow = true;
  const ws = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 0.06), glass());
  ws.position.set(0, 2.25, 4.66);
  const trailer = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3.0, 7.0), box);
  trailer.position.set(0, 2.15, -1.05);
  trailer.castShadow = true;
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 9.2), trim());
  chassis.position.set(0, 0.62, 0);
  tilt.add(cab, ws, trailer, chassis);
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1020, emissiveIntensity: 1.2 });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.12, 0.06), tailMat);
  tail.position.set(0, 0.85, -4.58);
  tilt.add(tail);
  const glows = { head: [], tail: [] };
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.06), head());
    h.position.set(sx * 0.85, 0.95, 4.67);
    tilt.add(h);
    const hg = glow(0xffe8c4, 0.9, 0.45);
    hg.position.set(sx * 0.85, 0.95, 4.85);
    tilt.add(hg); glows.head.push(hg);
    const tg = glow(0xff1830, 1, 0.55);
    tg.position.set(sx * 1.0, 0.85, -4.7);
    tilt.add(tg); glows.tail.push(tg);
  }
  const wheels = [];
  for (const z of [3.4, -2.6, -3.7]) {
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 1.05, 0.5, z);
      const w = wheel(0.5);
      pivot.add(w);
      root.add(pivot);
      wheels.push({ pivot, w, front: false });
    }
  }
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 11), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.04;
  root.add(blob);
  return {
    root, tilt, wheels, glows, tailMat, len: 9.5, rw: 0.5, bar: null, flames: [],
    animate(dt, speed, steer, brake) {
      for (const wh of wheels) wh.w.rotation.x += (speed * dt) / 0.5;
      tailMat.emissiveIntensity = brake ? 4 : 1.2;
    }
  };
}

export const TRAFFIC_SHAPE = { sedan: 'sedan', hatch: 'hatch', suv: 'suv', van: 'van' };
