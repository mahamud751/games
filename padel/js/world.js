// The 3D world: club venues, court, glass, crowd, lights, ball, players and the camera.
import * as THREE from 'three';
import { makePlayer, applyPose, POSE, SWINGS, lerpPose, runPose } from './rig.js';

// court space (x along, y across, z up) -> three.js (X across, Y up, Z towards the camera)
export const W = (x, y, z) => new THREE.Vector3(y - 5, z, -x);
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function mixHex(a, b, k) { return '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString(); }

const LIGHTS = {
  day: { sky: ['#4a90d9', '#9fd0f5', '#e8f4ff'], sun: '#fff6e0', sunI: 2.6, hemi: ['#cfe8ff', '#4a6b3a', 1.1], fog: '#b9d7ef', exposure: 1.05, sunPos: [8, 16, 6], skyline: '#6f88a3', windows: 0 },
  sunset: { sky: ['#2c1b4a', '#d86b6b', '#ffc38a'], sun: '#ffb070', sunI: 2.2, hemi: ['#ffd2b0', '#3a2a4a', 0.9], fog: '#d8957f', exposure: 1.05, sunPos: [-12, 6, -10], skyline: '#3a2440', windows: 0.25 },
  night: { sky: ['#03040c', '#0d1030', '#1d1a40'], sun: '#dfe6ff', sunI: 1.6, hemi: ['#5b6cff', '#100820', 0.55], fog: '#0b0c20', exposure: 1.15, sunPos: [4, 18, 8], skyline: '#0c0f24', windows: 0.7 },
  rain: { sky: ['#1a2230', '#3a4a5e', '#5d6c7d'], sun: '#dbe7ff', sunI: 1.7, hemi: ['#a9b8cc', '#2a3138', 0.8], fog: '#4f5d6e', exposure: 1.1, sunPos: [6, 18, 4], skyline: '#232b38', windows: 0.45 },
  indoor: { sky: ['#05060d', '#0b0d1c', '#121530'], sun: '#ffffff', sunI: 2.4, hemi: ['#c7d2fe', '#0b0b16', 0.6], fog: '#080914', exposure: 1.1, sunPos: [3, 20, 3], skyline: '#000', windows: 0 },
};

export class World {
  constructor(renderer) {
    this.r = renderer;
    this.camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 500);
    this.camPos = new THREE.Vector3(0, 7, 16);
    this.camLook = new THREE.Vector3(0, 0.5, -2);
    this.t = 0;
    this.rigs = [];
    this.rings = [];
    this.targets = [];
    this.fx = [];
  }

  build(club) {
    this.club = club;
    const L = LIGHTS[club.time];
    this.L = L;
    const scene = new THREE.Scene();
    this.scene = scene;
    scene.fog = new THREE.Fog(L.fog, 60, club.time === 'indoor' ? 120 : 230);
    this.r.toneMappingExposure = L.exposure;

    // sky dome
    const skyTex = canvasTex(16, 512, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, L.sky[0]); gr.addColorStop(0.55, L.sky[1]); gr.addColorStop(1, L.sky[2]);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })));
    if (club.time === 'night' || club.time === 'indoor') {
      const pts = new Float32Array(900 * 3);
      for (let i = 0; i < 900; i++) { const a = Math.random() * TAU, e = rnd(0.15, 1.3), r = 280; pts.set([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r], i * 3); }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      if (club.time === 'night') scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 1.2, sizeAttenuation: false, fog: false })));
    }
    if (club.time === 'day' || club.time === 'sunset') {
      const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(L.sun), fog: false, depthWrite: false, transparent: true }));
      const sp = new THREE.Vector3(...L.sunPos).normalize().multiplyScalar(250);
      sun.position.copy(sp); sun.scale.setScalar(club.time === 'sunset' ? 120 : 70); scene.add(sun);
    }
    if (club.time !== 'indoor') this.skyline(scene, L, club);

    // lights
    scene.add(new THREE.HemisphereLight(L.hemi[0], L.hemi[1], L.hemi[2]));
    const sun = new THREE.DirectionalLight(L.sun, L.sunI);
    sun.position.set(...L.sunPos); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
    scene.add(sun); scene.add(sun.target);
    if (club.time === 'night' || club.time === 'rain' || club.time === 'indoor') {
      for (const [x, z, col] of [[-8, -12, club.accent], [8, 12, club.accent2], [8, -12, '#ffffff'], [-8, 12, '#ffffff']]) {
        const pl = new THREE.PointLight(col, club.time === 'indoor' ? 60 : 45, 40, 1.6); pl.position.set(x, 9, z); scene.add(pl);
      }
    }

    // ground & apron
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: club.ground, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03; ground.receiveShadow = true; scene.add(ground);
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(15, 25), new THREE.MeshStandardMaterial({ color: club.apron, roughness: 0.9 }));
    apron.rotation.x = -Math.PI / 2; apron.position.y = -0.015; apron.receiveShadow = true; scene.add(apron);

    this.court(scene, club);
    this.walls(scene, club);
    this.net(scene);
    this.boards(scene, club);
    this.stands(scene, club);
    this.poles(scene, club);
    if (club.time === 'indoor') this.roof(scene, club);
    if (club.time === 'night') this.neon(scene, club);
    this.rain = null;
    if (club.time === 'rain') this.makeRain(scene);

    // ball, shadow, landing marker, trail
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), new THREE.MeshStandardMaterial({ color: '#e6f04a', emissive: '#7c8a12', emissiveIntensity: 0.35, roughness: 0.55 }));
    this.ball.castShadow = true; scene.add(this.ball);
    this.ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), new THREE.MeshBasicMaterial({ map: glowTex('#000000'), transparent: true, opacity: 0.55, depthWrite: false }));
    this.ballShadow.rotation.x = -Math.PI / 2; scene.add(this.ballShadow);
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.34, 32), new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.8, depthWrite: false }));
    this.marker.rotation.x = -Math.PI / 2; this.marker.position.y = 0.02; scene.add(this.marker);
    this.trail = [];
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: '#f7ffb0', transparent: true, opacity: 0, depthWrite: false }));
      scene.add(s); this.trail.push(s);
    }
    this.trailPts = [];
    this.fx = [];
    this.rigs = [];
    this.rings = [];
    this.showcase = null;
    this.targets = [];
  }

  // ---------- venue pieces ----------
  court(scene, club) {
    const tex = canvasTex(1024, 2048, (g, w, h) => {
      g.fillStyle = club.turf; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.03)'; g.fillRect(0, i * h / 9, w, h / 9); }
      for (let i = 0; i < 26000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      const X = y => y / 10 * w, Y = x => (10 - x) / 20 * h, lw = 6;
      g.fillStyle = 'rgba(255,255,255,.92)';
      for (const s of [-1, 1]) g.fillRect(0, Y(s * 6.95) - lw / 2, w, lw);
      g.fillRect(X(5) - lw / 2, Y(6.95), lw, Y(-6.95) - Y(6.95));
      for (const s of [-1, 1]) g.fillRect(X(5) - lw / 2, s < 0 ? Y(-10) - 22 : Y(10), lw, 22);
      g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineWidth = lw * 1.4; g.strokeRect(lw / 2, lw / 2, w - lw, h - lw);
      // club logo in the middle of each half
      g.save(); g.globalAlpha = 0.14; g.fillStyle = '#ffffff'; g.font = 'italic 800 120px "Barlow Condensed", Impact, sans-serif'; g.textAlign = 'center';
      g.translate(w / 2, Y(-3.3)); g.fillText(club.short, 0, 40); g.restore();
    });
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: club.time === 'rain' ? 0.45 : 0.85, metalness: club.time === 'rain' ? 0.15 : 0 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 20), m);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  }

  walls(scene, club) {
    const glass = new THREE.MeshStandardMaterial({ color: '#dff3ff', transparent: true, opacity: 0.13, roughness: 0.04, metalness: 0.3, depthWrite: false, side: THREE.DoubleSide });
    const nearGlass = glass.clone(); nearGlass.opacity = 0.05;
    const metal = new THREE.MeshStandardMaterial({ color: club.frame, roughness: 0.4, metalness: 0.6 });
    const fenceTex = canvasTex(64, 64, (g, w, h) => {
      g.strokeStyle = 'rgba(190,198,210,1)'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke();
    }, [60, 11]);
    const fence = new THREE.MeshStandardMaterial({ map: fenceTex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5 });
    const add = (geo, mt, pos, rotY = 0, cast = false) => { const o = new THREE.Mesh(geo, mt); o.position.copy(pos); o.rotation.y = rotY; o.castShadow = cast; scene.add(o); return o; };
    // back walls (glass + 1 m of mesh above)
    const mesh = (rx, ry) => { const ft = fenceTex.clone(); ft.needsUpdate = true; ft.repeat.set(rx, ry); return new THREE.MeshStandardMaterial({ map: ft, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, metalness: 0.4, roughness: 0.5 }); };
    // the wall behind the camera stays glass only so nothing crosses the view
    add(new THREE.PlaneGeometry(10, 3), nearGlass, new THREE.Vector3(0, 1.5, 10));
    add(new THREE.PlaneGeometry(10, 3), glass, new THREE.Vector3(0, 1.5, -10));
    add(new THREE.PlaneGeometry(10, 1), mesh(38, 4), new THREE.Vector3(0, 3.5, -10));
    // side walls: glass near the ends, mesh in the middle
    for (const sx of [-5, 5]) {
      for (const s of [-1, 1]) add(new THREE.PlaneGeometry(2, 3), glass, new THREE.Vector3(sx, 1.5, s * 9), Math.PI / 2);
      add(new THREE.PlaneGeometry(16, 3), mesh(60, 11), new THREE.Vector3(sx, 1.5, 0), Math.PI / 2);
    }
    // frame posts and rails
    const post = new THREE.BoxGeometry(0.07, 4, 0.07);
    for (const sx of [-5, 5]) for (let z = -10; z <= 10; z += 2) add(post, metal, new THREE.Vector3(sx, z === -10 || z === 10 ? 2 : 1.5, z).setY(Math.abs(z) >= 8 ? 2 : 1.5), 0, true).scale.y = Math.abs(z) >= 8 ? 1 : 0.75;
    for (let x = -5; x <= 5; x += 2.5) add(post, metal, new THREE.Vector3(x, 2, -10), 0, true);
    for (const sx of [-5, 5]) add(new THREE.BoxGeometry(0.07, 0.07, 20), metal, new THREE.Vector3(sx, 3, 0));
    add(new THREE.BoxGeometry(10, 0.07, 0.07), metal, new THREE.Vector3(0, 3, -10)); add(new THREE.BoxGeometry(10, 0.07, 0.07), metal, new THREE.Vector3(0, 4, -10));
    for (const sx of [-5, 5]) add(new THREE.BoxGeometry(0.07, 0.07, 2), metal, new THREE.Vector3(sx, 4, -9));
    // glass highlight streaks
    const streak = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide });
    for (const x of [-3.2, 1.4, 3.6]) { const o = add(new THREE.PlaneGeometry(0.35, 2.6), streak, new THREE.Vector3(x, 1.5, -9.98)); o.rotation.z = 0.35; }
  }

  net(scene) {
    const tex = canvasTex(512, 64, (g, w, h) => {
      g.strokeStyle = 'rgba(15,15,25,.95)'; g.lineWidth = 2;
      for (let x = 0; x <= w; x += 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      for (let y = 0; y <= h; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    });
    const n = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.86), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.2, side: THREE.DoubleSide }));
    n.position.set(0, 0.45, 0); scene.add(n);
    const band = new THREE.Mesh(new THREE.BoxGeometry(10, 0.07, 0.03), new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.6 }));
    band.position.set(0, 0.89, 0); band.castShadow = true; scene.add(band);
    for (const x of [-5.05, 5.05]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 12), new THREE.MeshStandardMaterial({ color: '#111827', metalness: 0.6, roughness: 0.4 })); p.position.set(x, 0.5, 0); p.castShadow = true; scene.add(p); }
  }

  boards(scene, club) {
    this.boardTex = [];
    const msg = `  PADEL RUSH  ·  ${club.name.toUpperCase()}  ·  ${club.area.toUpperCase()}  ·`;
    for (const sx of [-6.1, 6.1]) {
      const tex = canvasTex(2048, 64, (g, w, h) => {
        g.fillStyle = '#05060c'; g.fillRect(0, 0, w, h);
        g.font = 'italic 800 46px "Barlow Condensed", Impact, sans-serif'; g.textBaseline = 'middle';
        let x = 0, i = 0;
        while (x < w) { g.fillStyle = i++ % 2 ? club.accent : '#f8fafc'; g.fillText(msg, x, h / 2 + 2); x += g.measureText(msg).width; }
      });
      tex.wrapS = THREE.RepeatWrapping;
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 22), [0, 0, 0, 0, 1, 1].map(() => new THREE.MeshBasicMaterial({ map: tex })));
      b.position.set(sx, 0.36, 0); scene.add(b);
      this.boardTex.push(tex);
    }
  }

  stands(scene, club) {
    const seat = new THREE.MeshStandardMaterial({ color: club.stand, roughness: 0.9 });
    const lip = new THREE.MeshStandardMaterial({ color: club.accent, roughness: 0.6, emissive: club.accent, emissiveIntensity: club.time === 'day' ? 0 : 0.35 });
    const spots = [];
    const tier = (cx, cz, w, d, dir, rows) => {
      for (let r = 0; r < rows; r++) {
        const h = 0.9 + r * 0.55;
        const g = new THREE.Mesh(new THREE.BoxGeometry(dir === 'x' ? d : w, h, dir === 'x' ? w : d), seat);
        const off = r * d;
        if (dir === 'x') g.position.set(cx + Math.sign(cx) * off, h / 2, cz); else g.position.set(cx, h / 2, cz - off);
        g.receiveShadow = true; scene.add(g);
        const l = new THREE.Mesh(new THREE.BoxGeometry(dir === 'x' ? 0.06 : w, 0.06, dir === 'x' ? w : 0.06), lip);
        if (dir === 'x') l.position.set(cx + Math.sign(cx) * off - Math.sign(cx) * d / 2, h, cz); else l.position.set(cx, h, cz - off + d / 2);
        scene.add(l);
        const n = Math.floor(w / 0.62);
        for (let i = 0; i < n; i++) if (Math.random() < club.crowd) {
          const a = -w / 2 + (i + 0.5) * w / n;
          spots.push(dir === 'x' ? [cx + Math.sign(cx) * off, h, cz + a] : [cx + a, h, cz - off]);
        }
      }
    };
    tier(-8.6, 0, 24, 1.1, 'x', 6);
    tier(8.6, 0, 24, 1.1, 'x', 6);
    tier(0, -13.8, 16, 1.1, 'z', 7);
    // crowd
    const n = spots.length;
    const body = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.55, 0.3), new THREE.MeshStandardMaterial({ roughness: 0.8 }), n);
    const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.8 }), n);
    const col = new THREE.Color();
    const SH = ['#f8fafc', '#ef4444', '#3b82f6', '#facc15', '#22c55e', '#a855f7', '#f97316', '#0ea5e9', '#111827', club.accent, club.accent];
    const SK = ['#f0c29a', '#d49a6a', '#a46a43', '#7a4a2e', '#e8b48a'];
    this.crowd = { body, heads, spots, phase: spots.map(() => Math.random() * TAU), dummy: new THREE.Object3D() };
    for (let i = 0; i < n; i++) {
      body.setColorAt(i, col.set(SH[i % SH.length === 0 ? 0 : (Math.random() * SH.length) | 0]));
      heads.setColorAt(i, col.set(SK[(Math.random() * SK.length) | 0]));
    }
    scene.add(body, heads);
    this.updateCrowd(0);
  }
  updateCrowd(excite) {
    const C = this.crowd; if (!C) return;
    const d = C.dummy;
    for (let i = 0; i < C.spots.length; i++) {
      const [x, y, z] = C.spots[i];
      const jump = Math.max(0, Math.sin(this.t * 8 + C.phase[i])) * 0.28 * excite + Math.sin(this.t * 1.5 + C.phase[i]) * 0.02;
      d.position.set(x, y + 0.28 + jump, z); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); d.updateMatrix();
      C.body.setMatrixAt(i, d.matrix);
      d.position.y = y + 0.68 + jump; d.updateMatrix();
      C.heads.setMatrixAt(i, d.matrix);
    }
    C.body.instanceMatrix.needsUpdate = true; C.heads.instanceMatrix.needsUpdate = true;
  }

  poles(scene, club) {
    const metal = new THREE.MeshStandardMaterial({ color: '#1f2937', metalness: 0.6, roughness: 0.4 });
    const lampMat = new THREE.MeshBasicMaterial({ color: '#fffbe8' });
    const glow = new THREE.SpriteMaterial({ map: glowTex('#fffbe8'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: club.time === 'day' ? 0.25 : 0.9 });
    for (const [x, z] of [[-6.5, -11.5], [6.5, -11.5], [-6.5, 11.5], [6.5, 11.5]]) {
      if (club.time === 'indoor') continue;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 9, 10), metal); p.position.set(x, 4.5, z); p.castShadow = true; scene.add(p);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.25), metal); head.position.set(x * 0.96, 9.1, z * 0.96); head.lookAt(0, 0, 0); scene.add(head);
      const lamp = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.36), lampMat); lamp.position.copy(head.position).multiplyScalar(0.985); lamp.lookAt(0, 0, 0); scene.add(lamp);
      const s = new THREE.Sprite(glow); s.position.copy(lamp.position); s.scale.setScalar(club.time === 'day' ? 3 : 7); scene.add(s);
    }
  }

  roof(scene, club) {
    const dark = new THREE.MeshStandardMaterial({ color: '#0b0d18', roughness: 1, side: THREE.DoubleSide });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(60, 1, 70), dark); roof.position.y = 19; scene.add(roof);
    const walls = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, 20, 40, 1, true), dark); walls.position.y = 9; scene.add(walls);
    const strip = new THREE.MeshBasicMaterial({ color: club.accent });
    for (let i = -3; i <= 3; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 30), strip); s.position.set(i * 3, 18.4, 0); scene.add(s); }
    // jumbotron behind the far end
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    this.jumbo = { c, g: c.getContext('2d'), tex: new THREE.CanvasTexture(c) };
    this.jumbo.tex.colorSpace = THREE.SRGBColorSpace;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), new THREE.MeshBasicMaterial({ map: this.jumbo.tex }));
    scr.position.set(0, 11, -22); scene.add(scr);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(12.6, 6.6, 0.3), new THREE.MeshStandardMaterial({ color: '#111827', metalness: 0.5 })); fr.position.set(0, 11, -22.2); scene.add(fr);
    this.drawJumbo('PADEL RUSH', club.name.toUpperCase());
    for (const [x, z, col] of [[-10, -6, club.accent], [10, -6, club.accent2], [-10, 6, club.accent2], [10, 6, club.accent]]) {
      const s = new THREE.SpotLight(col, 260, 50, 0.45, 0.6, 1.4); s.position.set(x, 17, z); s.target.position.set(0, 0, 0); scene.add(s, s.target);
    }
  }
  drawJumbo(a, b) {
    const J = this.jumbo; if (!J) return;
    const g = J.g;
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#0b1230'); gr.addColorStop(1, '#030510');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    g.fillStyle = this.club.accent; g.fillRect(0, 0, 512, 10); g.fillRect(0, 246, 512, 10);
    g.textAlign = 'center'; g.fillStyle = '#f8fafc';
    g.font = 'italic 800 86px "Barlow Condensed", Impact, sans-serif'; g.fillText(a, 256, 120);
    g.font = '600 36px "Barlow Condensed", Impact, sans-serif'; g.fillStyle = this.club.accent; g.fillText(b, 256, 190);
    J.tex.needsUpdate = true;
  }

  neon(scene, club) {
    for (const [col, y] of [[club.accent, 3.05], [club.accent2, 0.05]]) {
      const m = new THREE.MeshBasicMaterial({ color: col });
      for (const sx of [-5.06, 5.06]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 20), m); s.position.set(sx, y, 0); scene.add(s); }
      for (const z of y > 1 ? [-10.06] : [-10.06, 10.06]) { const s = new THREE.Mesh(new THREE.BoxGeometry(10, 0.05, 0.05), m); s.position.set(0, y, z); scene.add(s); }
    }
  }

  skyline(scene, L, club) {
    const tex = canvasTex(4096, 512, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const base = h, sil = L.skyline;
      const win = (x, y, bw, bh) => { if (!L.windows) return; g.fillStyle = `rgba(255,214,140,${L.windows})`; for (let yy = y + 8; yy < base - 6; yy += 14) for (let xx = x + 5; xx < x + bw - 6; xx += 11) if (Math.random() < 0.45) g.fillRect(xx, yy, 5, 7); };
      let x = 0;
      while (x < w) {
        const bw = 50 + Math.random() * 110, bh = 60 + Math.random() * 170;
        g.fillStyle = mixHex(sil, L.sky[1], Math.random() * 0.25); g.fillRect(x, base - bh, bw, bh); win(x, base - bh, bw, bh);
        x += bw + Math.random() * 20;
      }
      for (const ox of [0, w / 2]) {
        g.fillStyle = sil;
        // clock tower
        g.fillRect(ox + 400, base - 330, 46, 330); g.beginPath(); g.moveTo(ox + 394, base - 330); g.lineTo(ox + 423, base - 410); g.lineTo(ox + 452, base - 330); g.fill();
        g.fillStyle = L.windows ? '#ffe7a8' : '#d9d2b8'; g.beginPath(); g.arc(ox + 423, base - 300, 13, 0, TAU); g.fill();
        // observation wheel
        g.strokeStyle = sil; g.lineWidth = 6; g.beginPath(); g.arc(ox + 900, base - 170, 150, 0, TAU); g.stroke();
        g.lineWidth = 2; for (let k = 0; k < 24; k++) { const a = k / 24 * TAU; g.beginPath(); g.moveTo(ox + 900, base - 170); g.lineTo(ox + 900 + Math.cos(a) * 150, base - 170 + Math.sin(a) * 150); g.stroke(); g.fillStyle = sil; g.fillRect(ox + 896 + Math.cos(a) * 150, base - 176 + Math.sin(a) * 150, 9, 9); }
        g.lineWidth = 8; g.beginPath(); g.moveTo(ox + 860, base); g.lineTo(ox + 900, base - 170); g.lineTo(ox + 940, base); g.stroke();
        // glass shard tower
        g.fillStyle = mixHex(sil, '#9fb3c8', 0.15); g.beginPath(); g.moveTo(ox + 1350, base); g.lineTo(ox + 1395, base - 460); g.lineTo(ox + 1440, base); g.fill();
        // bullet-shaped tower
        g.fillStyle = sil; g.beginPath(); g.moveTo(ox + 1640, base); g.quadraticCurveTo(ox + 1610, base - 260, ox + 1680, base - 300); g.quadraticCurveTo(ox + 1750, base - 260, ox + 1720, base); g.fill();
        // domed cathedral
        g.fillRect(ox + 1830, base - 120, 150, 120); g.beginPath(); g.arc(ox + 1905, base - 120, 62, Math.PI, 0); g.fill(); g.fillRect(ox + 1900, base - 220, 10, 40);
        win(ox + 1830, base - 120, 150, 120);
      }
    });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(150, 150, 46, 64, 1, true), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, fog: true }));
    m.position.y = 20; scene.add(m);
    if (club.river) {
      const river = new THREE.Mesh(new THREE.PlaneGeometry(600, 40), new THREE.MeshStandardMaterial({ color: '#2b4a6b', roughness: 0.2, metalness: 0.6 }));
      river.rotation.x = -Math.PI / 2; river.position.set(0, -0.02, -95); scene.add(river);
    }
  }

  makeRain(scene) {
    const n = 2400, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([rnd(-25, 25), rnd(0, 25), rnd(-25, 25)], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.Points(g, new THREE.PointsMaterial({ color: '#c7d7f0', size: 0.06, transparent: true, opacity: 0.6 }));
    scene.add(this.rain);
  }

  // ---------- players ----------
  setPlayers(list) {
    if (!this.scene) return;
    for (const r of this.rigs) this.scene.remove(r.root);
    for (const r of this.rings) this.scene.remove(r);
    this.rigs = list.map((l, i) => { const rig = makePlayer(l.look, l.num || i + 3); this.scene.add(rig.root); return rig; });
    this.rings = list.map(l => {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 36), new THREE.MeshBasicMaterial({ color: l.ring, transparent: true, opacity: l.human ? 0.85 : 0.35, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.015; this.scene.add(m); return m;
    });
  }
  setShowcase(look) {
    if (!this.scene) return;
    if (this.showcase) this.scene.remove(this.showcase.root);
    this.showcase = look ? makePlayer(look, 10) : null;
    if (this.showcase) { this.showcase.root.position.set(0, 0, 3.2); this.scene.add(this.showcase.root); }
  }

  posePlayer(rig, p, M) {
    let pose;
    const s = p.swing;
    if (s && SWINGS[s.anim]) {
      const [a, b, c] = SWINGS[s.anim].map(k => POSE[k]);
      const k = s.t / s.dur;
      pose = k < 0.35 ? lerpPose(POSE.ready, a, k / 0.35) : k < 0.55 ? lerpPose(a, b, (k - 0.35) / 0.2) : lerpPose(b, c, Math.min(1, (k - 0.55) / 0.3));
    } else if (M.state === 'point' && p.moodT > 0.3) {
      pose = p.mood > 0 ? lerpPose(POSE.ready, POSE.cheer, Math.min(1, (p.moodT - 0.3) * 3)) : lerpPose(POSE.ready, POSE.sad, Math.min(1, (p.moodT - 0.3) * 3));
    } else if (M.state === 'serve' && M.server === p) pose = POSE.servePrep;
    else {
      const sp = Math.hypot(p.vx, p.vy);
      pose = sp > 0.5 ? runPose(p.anim * 2.6, sp) : Object.assign({}, POSE.ready, { hip: POSE.ready.hip + Math.sin(this.t * 4 + p.idx) * 0.012 });
    }
    applyPose(rig, pose, this.t);
    const pos = W(p.x, p.y, 0);
    rig.root.position.copy(pos);
    if (M.state === 'point' && p.mood > 0 && p.moodT > 0.3) rig.root.position.y = Math.max(0, Math.sin((p.moodT - 0.3) * 9)) * 0.18;
    rig.root.rotation.y = p.team === 0 ? 0 : Math.PI;
  }

  // ---------- per frame ----------
  update(dt, M, mode, hint) {
    this.t += dt;
    for (const t of this.boardTex || []) t.offset.x = (t.offset.x + dt * 0.04) % 1;
    if (this.rain) {
      const a = this.rain.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) { let y = a.getY(i) - dt * 18; if (y < 0) y += 25; a.setY(i, y); }
      a.needsUpdate = true;
    }
    this.updateCrowd(M ? M.excite || 0 : 0.15);

    if (M) {
      M.players.forEach((p, i) => {
        this.posePlayer(this.rigs[i], p, M);
        const ring = this.rings[i];
        ring.position.set(p.y - 5, 0.015, -p.x);
        if (p.human) {
          const c = ring.material.color;
          if (hint === 'perfect') c.set('#4ade80'); else if (hint === 'ready') c.set('#fde047'); else c.set('#38bdf8');
          const s = hint === 'ready' ? 1 + Math.sin(this.t * 20) * 0.08 : 1;
          ring.scale.set(s, s, s);
        }
      });
      const b = M.ball;
      const bp = W(b.x, b.y, b.z);
      this.ball.position.copy(bp);
      this.ball.visible = b.live || M.state === 'serve';
      this.ballShadow.visible = this.ball.visible;
      this.ballShadow.position.set(bp.x, 0.012, bp.z);
      const sk = Math.max(0.35, 1 - b.z / 5); this.ballShadow.scale.setScalar(sk); this.ballShadow.material.opacity = 0.55 * sk;
      // trail
      if (b.live) { this.trailPts.unshift(bp.clone()); if (this.trailPts.length > 10) this.trailPts.pop(); } else this.trailPts.length = 0;
      const speed = Math.hypot(b.vx, b.vy, b.vz);
      this.trail.forEach((s, i) => {
        const p = this.trailPts[i];
        s.visible = !!p && speed > 6;
        if (p) { s.position.copy(p); s.material.opacity = (1 - i / 10) * 0.28; s.scale.setScalar(1 - i / 12); }
      });
      // landing marker on your side
      const show = M.landing && M.rally && M.rally.team === 1 && b.live && b.x > -10 && (M.state === 'rally' || M.state === 'training');
      this.marker.visible = !!show;
      if (show) { this.marker.position.set(M.landing.y - 5, 0.02, -M.landing.x); const k = 1 + Math.sin(this.t * 12) * 0.1; this.marker.scale.set(k, k, k); }
    } else {
      this.ball.visible = this.ballShadow.visible = this.marker.visible = false;
      this.trail.forEach(s => (s.visible = false));
    }
    if (this.showcase) {
      applyPose(this.showcase, Object.assign({}, POSE.ready, { hip: -0.06 + Math.sin(this.t * 3) * 0.01, lean: 0.2 }), this.t);
      this.showcase.root.rotation.y = Math.PI + Math.sin(this.t * 0.6) * 0.7;
    }
    // effects
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += dt;
      const k = f.t / f.life;
      f.obj.material.opacity = (1 - k) * f.a;
      f.obj.scale.setScalar(f.s0 + (f.s1 - f.s0) * k);
      if (k >= 1) { this.scene.remove(f.obj); this.fx.splice(i, 1); }
    }
    this.updateCamera(dt, M, mode);
  }

  syncTargets(list) {
    if (!this.scene) return;
    this.targets = this.targets || [];
    if (!list) { for (const t of this.targets) this.scene.remove(t); this.targets = []; return; }
    while (this.targets.length < list.length) {
      const g = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.18, depthWrite: false }));
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 40), new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.9, depthWrite: false }));
      const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.48, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false }));
      g.add(disc, ring, ring2); g.rotation.x = -Math.PI / 2;
      this.scene.add(g); this.targets.push(g);
    }
    list.forEach((t, i) => {
      const g = this.targets[i];
      g.position.set(t.y - 5, 0.02, -t.x);
      const k = t.r * (1 + Math.sin(this.t * 5 + i) * 0.04);
      g.scale.set(k, k, k);
    });
  }

  flash(x, y, z, color, size = 1.2, life = 0.35) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.copy(W(x, y, z)); this.scene.add(s);
    this.fx.push({ obj: s, t: 0, life, a: 1, s0: size * 0.4, s1: size });
  }
  ripple(x, y, z, color) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.16, 32), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    m.position.copy(W(x, y, Math.max(0.03, z)));
    if (Math.abs(x) >= 9.9) m.rotation.y = 0; else if (y <= 0.05 || y >= 9.95) m.rotation.y = Math.PI / 2; else m.rotation.x = -Math.PI / 2;
    this.scene.add(m);
    this.fx.push({ obj: m, t: 0, life: 0.45, a: 0.9, s0: 1, s1: 6 });
  }

  updateCamera(dt, M, mode) {
    const cam = this.camera, t = this.t;
    let pos, look;
    if (mode === 'menu') {
      const a = Math.sin(t * 0.12) * 0.45;
      pos = new THREE.Vector3(Math.sin(a) * 21 + 3, 10 + Math.sin(t * 0.2) * 0.8, Math.cos(a) * 21);
      look = new THREE.Vector3(2.5, 0.5, -1.5);
    } else if (mode === 'locker') {
      pos = new THREE.Vector3(0.9, 1.45, 6.6); look = new THREE.Vector3(0, 1.05, 3.2);
    } else if (mode === 'intro') {
      const k = Math.min(1, (M ? M.stateT : 0) / 2.6), a = -0.9 + k * 0.9;
      pos = new THREE.Vector3(Math.sin(a) * 18, 4 + k * 3, Math.cos(a) * 18);
      look = new THREE.Vector3(0, 0.8, -1);
    } else {
      const me = M.players[0], b = M.ball;
      const fx = (me.y - 5) * 0.35 + (b.y - 5) * 0.25;
      const back = M.state === 'point' ? 17 : 18;
      pos = new THREE.Vector3(fx * 0.8, 7.8, back + Math.max(0, -me.x - 7) * 0.35);
      look = new THREE.Vector3(fx * 0.55, 0.2, -1.6 + Math.min(0, b.x) * -0.05);
    }
    const k = mode === 'locker' ? Math.min(1, dt * 5) : Math.min(1, dt * 2.6);
    this.camPos.lerp(pos, mode === 'intro' ? 1 : k);
    this.camLook.lerp(look, mode === 'intro' ? 1 : k);
    cam.position.copy(this.camPos);
    cam.lookAt(this.camLook);
  }

  project(x, y, z, w, h) {
    const v = W(x, y, z).project(this.camera);
    return [(v.x + 1) / 2 * w, (1 - v.y) / 2 * h, v.z < 1];
  }

  render() { this.r.render(this.scene, this.camera); }
}

const glowCache = new Map();
function glowTex(color) {
  if (glowCache.has(color)) return glowCache.get(color);
  const t = canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, color); gr.addColorStop(0.35, color + 'aa'); gr.addColorStop(1, color + '00');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  glowCache.set(color, t);
  return t;
}
