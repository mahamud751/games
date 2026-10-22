// Effects: point-sprite particles (fire, smoke, sparks, blood), bullet tracers,
// explosion flashes, glowing mission markers and bobbing target arrows.
import * as THREE from 'three';

const PV = `attribute float aSize; attribute vec4 aCol;
varying vec4 vCol;
void main() { vCol = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * 420.0 / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }`;
const PF = `varying vec4 vCol;
void main() { vec2 c = gl_PointCoord - 0.5; float r = length(c); if (r > 0.5) discard; float a = smoothstep(0.5, 0.0, r); gl_FragColor = vec4(vCol.rgb, vCol.a * a); }`;

class Pool {
  constructor(scene, n, additive) {
    this.n = n; this.i = 0;
    this.p = []; for (let k = 0; k < n; k++) this.p.push({ life: 0 });
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.size = new Float32Array(n); this.col = new Float32Array(n * 4);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4));
    this.geo = g;
    this.mesh = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: PV, fragmentShader: PF, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav = 0, drag = 0) {
    const p = this.p[this.i]; this.i = (this.i + 1) % this.n;
    Object.assign(p, { x, y, z, vx, vy, vz, life, max: life, s0, s1, r, g, b, a, grav, drag });
  }
  update(dt) {
    for (let k = 0; k < this.n; k++) {
      const p = this.p[k];
      if (p.life <= 0) { this.size[k] = 0; continue; }
      p.life -= dt;
      p.vy -= p.grav * dt;
      const d = 1 - p.drag * dt;
      p.vx *= d; p.vy *= d; p.vz *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const t = 1 - Math.max(0, p.life) / p.max;
      this.pos[k * 3] = p.x; this.pos[k * 3 + 1] = p.y; this.pos[k * 3 + 2] = p.z;
      this.size[k] = p.s0 + (p.s1 - p.s0) * t;
      this.col[k * 4] = p.r; this.col[k * 4 + 1] = p.g; this.col[k * 4 + 2] = p.b;
      this.col[k * 4 + 3] = p.a * (1 - t) * Math.min(1, t * 8 + 0.3);
    }
    this.geo.attributes.position.needsUpdate = this.geo.attributes.aSize.needsUpdate = this.geo.attributes.aCol.needsUpdate = true;
  }
}

function fadeTexture(color) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 128, 0, 0);
  grd.addColorStop(0, color); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(c);
  return t;
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.add = new Pool(scene, 700, true);
    this.norm = new Pool(scene, 700, false);
    // tracers
    this.maxT = 48;
    this.tr = []; for (let k = 0; k < this.maxT; k++) this.tr.push({ life: 0 });
    this.trPos = new Float32Array(this.maxT * 6); this.trCol = new Float32Array(this.maxT * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.trPos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.trCol, 3));
    this.trGeo = g;
    const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    lines.frustumCulled = false;
    scene.add(lines);
    this.trI = 0;
    this.flash = new THREE.PointLight(0xffaa55, 0, 40, 1.6);
    scene.add(this.flash);
    this.markers = [];
    this.arrows = [];
    this.t = 0;
  }
  spark(x, y, z, n = 6) {
    for (let k = 0; k < n; k++) this.add.emit(x, y, z, (Math.random() - 0.5) * 8, Math.random() * 6, (Math.random() - 0.5) * 8, 0.25 + Math.random() * 0.2, 0.14, 0.02, 2.2, 1.6, 0.6, 1, 14, 1);
  }
  muzzle(x, y, z) {
    this.add.emit(x, y, z, 0, 0, 0, 0.06, 0.7, 0.3, 3, 2.2, 1, 1);
    this.flash.position.set(x, y, z);
    this.flash.intensity = Math.max(this.flash.intensity, 18);
  }
  dust(x, y, z, n = 3, c = [0.75, 0.7, 0.62]) {
    for (let k = 0; k < n; k++) this.norm.emit(x + (Math.random() - 0.5), y, z + (Math.random() - 0.5), (Math.random() - 0.5) * 2, 0.8 + Math.random(), (Math.random() - 0.5) * 2, 0.8 + Math.random() * 0.6, 0.4, 1.6, c[0], c[1], c[2], 0.35, 0, 1.5);
  }
  blood(x, y, z) {
    for (let k = 0; k < 6; k++) this.norm.emit(x, y, z, (Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3, 0.45, 0.22, 0.12, 0.55, 0.02, 0.04, 0.9, 12, 0.5);
  }
  smoke(x, y, z, heavy) {
    const c = heavy ? 0.12 : 0.55;
    this.norm.emit(x + (Math.random() - 0.5) * 0.6, y, z + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.8, 1.6 + Math.random(), (Math.random() - 0.5) * 0.8, 1.6 + Math.random(), 0.6, 2.8, c, c, c * 1.05, heavy ? 0.6 : 0.35, -0.5, 0.6);
  }
  fire(x, y, z) {
    if (Math.random() < 0.7) this.add.emit(x + (Math.random() - 0.5) * 1.6, y, z + (Math.random() - 0.5) * 1.6, 0, 2.5 + Math.random() * 2, 0, 0.5 + Math.random() * 0.3, 1.1, 0.3, 2.4, 0.9, 0.2, 0.9, -1, 0.5);
    if (Math.random() < 0.3) this.smoke(x, y + 1, z, true);
    this.flash.position.set(x, y + 1, z);
    this.flash.intensity = Math.max(this.flash.intensity, 6 + Math.random() * 6);
  }
  explosion(x, y, z) {
    for (let k = 0; k < 40; k++) {
      const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, s = 4 + Math.random() * 9;
      const r = Math.sqrt(1 - u * u);
      this.add.emit(x, y, z, Math.cos(a) * r * s, Math.abs(u) * s * 0.8 + 2, Math.sin(a) * r * s, 0.6 + Math.random() * 0.5, 2.4, 0.4, 2.8, 1.2 + Math.random() * 0.6, 0.3, 1, 2, 2.5);
    }
    for (let k = 0; k < 24; k++) this.norm.emit(x + (Math.random() - 0.5) * 3, y + Math.random() * 2, z + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 4, 2 + Math.random() * 4, (Math.random() - 0.5) * 4, 2.2 + Math.random() * 1.5, 1.6, 5, 0.1, 0.09, 0.09, 0.75, -0.3, 0.8);
    this.spark(x, y, z, 18);
    this.flash.position.set(x, y + 2, z);
    this.flash.intensity = 160;
  }
  splash(x, z) {
    for (let k = 0; k < 10; k++) this.norm.emit(x, -0.4, z, (Math.random() - 0.5) * 3, 3 + Math.random() * 3, (Math.random() - 0.5) * 3, 0.7, 0.3, 0.6, 0.85, 0.95, 1, 0.7, 12, 0.3);
  }
  tracer(ax, ay, az, bx, by, bz, color = [2.2, 1.7, 0.9]) {
    const t = this.tr[this.trI]; const i = this.trI; this.trI = (this.trI + 1) % this.maxT;
    t.life = 0.07; t.col = color;
    this.trPos.set([ax, ay, az, bx, by, bz], i * 6);
  }
  marker(x, z, color = '#ff4fb3', r = 1.6, h = 3) {
    const tex = fadeTexture(color);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24, 1, true), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, color: new THREE.Color(1.1, 1.1, 1.1), opacity: 0.7 }));
    m.position.set(x, h / 2, z);
    m.renderOrder = 4;
    this.scene.add(m);
    const mk = { mesh: m, x, z, r, remove: () => { this.scene.remove(m); this.markers = this.markers.filter(q => q !== mk); } };
    this.markers.push(mk);
    return mk;
  }
  arrow(color = '#ffd23f') {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2) }));
    m.rotation.x = Math.PI;
    this.scene.add(m);
    const a = { mesh: m, follow: null, remove: () => { this.scene.remove(m); this.arrows = this.arrows.filter(q => q !== a); } };
    this.arrows.push(a);
    return a;
  }
  update(dt, cam) {
    this.t += dt;
    this.add.update(dt); this.norm.update(dt);
    for (let i = 0; i < this.maxT; i++) {
      const t = this.tr[i];
      if (t.life > 0) t.life -= dt;
      const k = Math.max(0, t.life) / 0.07;
      const c = t.col || [0, 0, 0];
      for (let j = 0; j < 2; j++) { this.trCol[i * 6 + j * 3] = c[0] * k; this.trCol[i * 6 + j * 3 + 1] = c[1] * k; this.trCol[i * 6 + j * 3 + 2] = c[2] * k * (j ? 1 : 0.4); }
    }
    this.trGeo.attributes.position.needsUpdate = this.trGeo.attributes.color.needsUpdate = true;
    this.flash.intensity *= Math.exp(-dt * 9);
    for (const mk of this.markers) {
      const near = cam ? Math.hypot(cam.x - mk.x, cam.z - mk.z) - mk.r : 9;
      mk.mesh.material.opacity = (0.55 + Math.sin(this.t * 4) * 0.15) * Math.min(1, Math.max(0.08, (near - 0.5) / 3));
    }
    for (const a of this.arrows) {
      const f = a.follow;
      if (!f) { a.mesh.visible = false; continue; }
      a.mesh.visible = !f.removed;
      a.mesh.position.set(f.x, (f.y || 0) + (f.t ? f.t.H + 1.6 : 2.6) + Math.sin(this.t * 4) * 0.2, f.z);
      a.mesh.rotation.y += dt * 3;
    }
  }
}
