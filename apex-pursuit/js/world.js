import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROAD_HALF, WALL, rng } from './track.js';
import { glowTexture } from './cars.js';

export const THEMES = {
  coast: {
    top: '#1f2a5c', horizon: '#ffad78', low: '#f58a6a', sun: '#ffd6a0', sunDir: [-0.55, 0.11, -0.83],
    fog: '#e6a08a', fogFar: 1700, hemiSky: '#ffd1b5', hemiGround: '#40432c', sunInt: 2.6,
    grass: '#6f7f3a', grass2: '#94924c', sand: '#e0c48c', rock: '#8c7666', snow: null,
    water: '#2a6a8f', waterLevel: 2, flora: 'palm', hills: 60, shoulder: '#9c8f7c'
  },
  canyon: {
    top: '#2a1f55', horizon: '#ff8d55', low: '#f0705a', sun: '#ffb27a', sunDir: [0.62, 0.08, -0.78],
    fog: '#e48a68', fogFar: 1500, hemiSky: '#ffc09a', hemiGround: '#5a2e1c', sunInt: 2.7,
    grass: '#b8653c', grass2: '#c98552', sand: '#dca06a', rock: '#8f4128', snow: null,
    water: null, flora: 'cactus', hills: 120, shoulder: '#a77356'
  },
  alpine: {
    top: '#1a2d5a', horizon: '#f7bd92', low: '#e99a86', sun: '#ffd8a8', sunDir: [-0.2, 0.1, 0.97],
    fog: '#c9a3a0', fogFar: 1800, hemiSky: '#ffd8c0', hemiGround: '#2d3b2a', sunInt: 2.4,
    grass: '#41613a', grass2: '#5c7a44', sand: '#8d8a6a', rock: '#7c7f86', snow: '#f2f5fa',
    water: '#2f6380', waterLevel: 22, flora: 'pine', hills: 170, shoulder: '#8b8f8c'
  }
};

// ---------- tiny value noise ----------
function makeNoise(seed) {
  const r = rng(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = r() * (i + 1) | 0; [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const val = new Float32Array(256).map(() => r() * 2 - 1);
  const fade = t => t * t * (3 - 2 * t);
  const n2 = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const a = val[perm[(xi & 255) + perm[yi & 255]]];
    const b = val[perm[((xi + 1) & 255) + perm[yi & 255]]];
    const c = val[perm[(xi & 255) + perm[(yi + 1) & 255]]];
    const d = val[perm[((xi + 1) & 255) + perm[(yi + 1) & 255]]];
    const u = fade(xf), v = fade(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return (x, y, oct = 4) => {
    let s = 0, amp = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { s += n2(x * f, y * f) * amp; amp *= 0.5; f *= 2.03; }
    return s;
  };
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w;
}`;
const SKY_FRAG = `
uniform vec3 top; uniform vec3 horizon; uniform vec3 low; uniform vec3 sunCol; uniform vec3 sunDir; uniform float time;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += noise(p) * a; p *= 2.07; a *= 0.5; } return s; }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.65, h), 0.75)) : mix(horizon, low, smoothstep(0.0, -0.25, h));
  float sd = max(dot(d, normalize(sunDir)), 0.0);
  col += sunCol * (pow(sd, 900.0) * 8.0 + pow(sd, 60.0) * 0.55 + pow(sd, 8.0) * 0.22);
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.12) * 1.4 + vec2(time * 0.004, 0.0);
    float c = smoothstep(0.52, 0.85, fbm(uv));
    vec3 cloud = mix(horizon * 1.15, sunCol * 1.3, pow(sd, 3.0)) * 0.95;
    cloud = mix(cloud, top * 1.4, smoothstep(0.1, 0.5, h) * 0.5);
    col = mix(col, cloud, c * smoothstep(0.0, 0.08, h) * 0.85);
  }
  col = mix(col, horizon * 1.02, exp(-abs(h) * 22.0) * 0.55);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function roadTexture(renderer) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#34363b';
  g.fillRect(0, 0, 512, 1024);
  const r = rng(5);
  for (let i = 0; i < 26000; i++) {
    const v = 40 + r() * 40 | 0;
    g.fillStyle = `rgba(${v},${v},${v + 4},${0.25 + r() * 0.3})`;
    g.fillRect(r() * 512, r() * 1024, 1.5, 1.5);
  }
  // tyre wear in each lane
  const W = 16.6, px = x => (x + W / 2) / W * 512;
  for (const lx of [-6, -2, 2, 6]) {
    for (const off of [-0.8, 0.8]) {
      const grd = g.createLinearGradient(px(lx + off - 0.35), 0, px(lx + off + 0.35), 0);
      grd.addColorStop(0, 'rgba(20,20,22,0)');
      grd.addColorStop(0.5, 'rgba(20,20,22,.28)');
      grd.addColorStop(1, 'rgba(20,20,22,0)');
      g.fillStyle = grd;
      g.fillRect(px(lx + off - 0.35), 0, px(lx + off + 0.35) - px(lx + off - 0.35), 1024);
    }
  }
  g.fillStyle = '#f2f2ee';
  for (const ex of [-7.75, 7.75]) g.fillRect(px(ex) - 3, 0, 6, 1024);
  for (const lx of [-4, 4]) for (let v = 0; v < 1024; v += 512) g.fillRect(px(lx) - 2.5, v, 5, 128);
  g.fillStyle = '#f2c230';
  for (const cx of [-0.16, 0.16]) g.fillRect(px(cx) - 2.5, 0, 5, 1024);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function billboardTexture(lines, bg, fg, accent) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 512, 256);
  grd.addColorStop(0, bg[0]); grd.addColorStop(1, bg[1]);
  g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
  g.fillStyle = accent; g.fillRect(0, 214, 512, 42);
  g.fillStyle = fg;
  g.font = 'italic 800 84px "Chakra Petch", Arial, sans-serif';
  g.fillText(lines[0], 32, 110);
  g.font = '600 34px "Inter", Arial, sans-serif';
  g.fillText(lines[1], 34, 168);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const ADS = [
  [['VOLTA', 'Charge the night.'], ['#0f172a', '#1e3a8a'], '#f8fafc', '#38bdf8'],
  [['BLAZE COLA', 'Ice cold. Always.'], ['#7f1d1d', '#dc2626'], '#fff7ed', '#fde047'],
  [['NORTHLINE', 'Tyres that hold on.'], ['#111827', '#374151'], '#fef3c7', '#f59e0b'],
  [['APEX FM 98.4', 'Drive loud.'], ['#4c1d95', '#db2777'], '#fdf4ff', '#22d3ee'],
  [['SUNRISE MOTEL', 'Vacancy. Next exit.'], ['#9a3412', '#f97316'], '#fff7ed', '#0f172a'],
];

export class World {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.dyn = new THREE.Group();
    this.scene.add(this.dyn);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.sunTarget = new THREE.Object3D();
    this.scene.add(this.sunTarget);
    this.envRT = null;
  }

  clear() {
    this.root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) for (const m of [].concat(o.material)) { if (m.map) m.map.dispose(); m.dispose(); }
    });
    this.root.clear();
    if (this.envRT) { this.envRT.dispose(); this.envRT = null; }
  }

  build(loc, track, quality) {
    this.clear();
    const T = THEMES[loc.id];
    this.theme = T;
    this.track = track;
    const scene = this.scene;
    const C = h => new THREE.Color(h);
    const sunDir = new THREE.Vector3(...T.sunDir).normalize();
    this.sunDir = sunDir;

    // sky + environment
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { top: { value: C(T.top) }, horizon: { value: C(T.horizon) }, low: { value: C(T.low) }, sunCol: { value: C(T.sun) }, sunDir: { value: sunDir }, time: { value: 0 } },
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.root.add(this.sky);
    const envScene = new THREE.Scene();
    const envMat = this.skyMat.clone();
    envMat.uniforms.sunCol.value = C(T.sun).multiplyScalar(0.25);
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), envMat));
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: C(T.hemiGround) }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -8;
    envScene.add(ground);
    this.envRT = this.pmrem.fromScene(envScene, 0.02, 0.1, 1000);
    scene.environment = this.envRT.texture;
    ground.geometry.dispose(); ground.material.dispose(); envMat.dispose();

    scene.fog = new THREE.Fog(C(T.fog), 140, T.fogFar);
    scene.background = C(T.horizon);

    const hemi = new THREE.HemisphereLight(C(T.hemiSky), C(T.hemiGround), 1.1);
    this.root.add(hemi);
    const sun = new THREE.DirectionalLight(C(T.sun), T.sunInt);
    sun.target = this.sunTarget;
    sun.castShadow = quality === 'high';
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 400;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.04;
    this.sun = sun;
    this.root.add(sun);

    const terrain = this.buildTerrain(loc, track, T);
    this.root.add(terrain);
    this.buildRoad(track, T);
    this.buildRoadside(track, T, loc);
    this.scatter(track, T, loc, quality);
    if (T.water) {
      const water = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000), new THREE.MeshStandardMaterial({ color: C(T.water), metalness: 0.35, roughness: 0.1 }));
      water.rotation.x = -Math.PI / 2;
      water.position.y = T.waterLevel;
      this.root.add(water);
    }
  }

  buildTerrain(loc, track, T) {
    const noise = makeNoise(loc.seed * 7 + 1);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < track.n; i++) {
      minX = Math.min(minX, track.X[i]); maxX = Math.max(maxX, track.X[i]);
      minZ = Math.min(minZ, track.Z[i]); maxZ = Math.max(maxZ, track.Z[i]);
    }
    const M = 1500;
    const x0 = minX - M, z0 = minZ - M, sx = maxX - minX + 2 * M, sz = maxZ - minZ + 2 * M;
    const N = 280;
    // spatial hash of road samples for nearest-road queries
    const CELL = 32, hash = new Map();
    for (let i = 0; i < track.n; i += 2) {
      const k = Math.floor(track.X[i] / CELL) + ',' + Math.floor(track.Z[i] / CELL);
      if (!hash.has(k)) hash.set(k, []);
      hash.get(k).push(i);
    }
    const nearest = (x, z) => {
      const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      let best = 1e9, by = 0;
      for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
        const list = hash.get((cx + a) + ',' + (cz + b));
        if (!list) continue;
        for (const i of list) {
          const d = (track.X[i] - x) ** 2 + (track.Z[i] - z) ** 2;
          if (d < best) { best = d; by = track.Y[i]; }
        }
      }
      return best < 1e9 ? [Math.sqrt(best), by] : [64, loc.baseY];
    };
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const span = Math.max(maxX - minX, maxZ - minZ) / 2;
    const far = (x, z) => {
      const n = noise(x * 0.0022, z * 0.0022);
      const r = Math.hypot(x - cx, z - cz) / span;
      if (loc.id === 'coast') {
        let h = loc.baseY + 6 + n * T.hills + smooth(1.1, 2.2, r) * 140 * (0.6 + noise(x * 0.004, z * 0.004, 2));
        h -= 110 * smooth(-0.1, 0.35, (x - cx) / span - 0.75 + noise(z * 0.003, 3.1, 2) * 0.5);
        return h;
      }
      if (loc.id === 'canyon') {
        const m = Math.abs(n) * T.hills * 1.4 + 18;
        const terr = Math.floor(m / 16) * 16 + smooth(0.6, 1, (m % 16) / 16) * 16;
        return loc.baseY + terr * (0.55 + smooth(0.9, 1.8, r) * 1.2) - 8;
      }
      // alpine: lake in the middle, peaks around
      let h = loc.baseY + n * T.hills * 0.7 + smooth(0.95, 2.2, r) * 380 * (0.5 + Math.abs(noise(x * 0.003, z * 0.003, 3)));
      h -= 45 * (1 - smooth(0.2, 0.75, r));
      return h;
    };
    const geo = new THREE.PlaneGeometry(sx, sz, N, N);
    geo.rotateX(-Math.PI / 2);
    geo.translate(x0 + sx / 2, 0, z0 + sz / 2);
    const pos = geo.attributes.position;
    const heights = new Float32Array(pos.count);
    const dist = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const [d, ry] = nearest(x, z);
      const f = smooth(13, 75, d);
      let h = (ry - 0.4) * (1 - f) + far(x, z) * f;
      if (d < 13) h = ry - 0.4;
      pos.setY(i, h);
      heights[i] = h; dist[i] = d;
    }
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal;
    const col = new Float32Array(pos.count * 3);
    const cG = new THREE.Color(T.grass), cG2 = new THREE.Color(T.grass2), cS = new THREE.Color(T.sand), cR = new THREE.Color(T.rock);
    const cSn = T.snow ? new THREE.Color(T.snow) : null, tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const h = heights[i], ny = nrm.getY(i);
      const x = pos.getX(i), z = pos.getZ(i);
      tmp.copy(cG).lerp(cG2, smooth(-0.3, 0.4, noise(x * 0.01, z * 0.01, 2)));
      if (T.water && h < T.waterLevel + 4) tmp.lerp(cS, smooth(T.waterLevel + 4, T.waterLevel + 0.5, h));
      tmp.lerp(cR, smooth(0.86, 0.68, ny));
      if (cSn) tmp.lerp(cSn, smooth(150, 230, h + noise(x * 0.02, z * 0.02) * 30) * smooth(0.5, 0.75, ny));
      if (loc.id === 'canyon') tmp.lerp(cR, smooth(0.93, 0.8, ny) * 0.7);
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: loc.id !== 'alpine' }));
    mesh.receiveShadow = true;
    this.grid = { x0, z0, sx, sz, N, heights, dist };
    return mesh;
  }

  groundAt(x, z) {
    const G = this.grid;
    const fx = (x - G.x0) / G.sx * G.N, fz = (z - G.z0) / G.sz * G.N;
    const ix = Math.max(0, Math.min(G.N - 1, Math.floor(fx))), iz = Math.max(0, Math.min(G.N - 1, Math.floor(fz)));
    const tx = fx - ix, tz = fz - iz, W = G.N + 1;
    const h = (a, b) => G.heights[b * W + a];
    const d = (a, b) => G.dist[b * W + a];
    const lerp = (f) => (f(ix, iz) * (1 - tx) + f(ix + 1, iz) * tx) * (1 - tz) + (f(ix, iz + 1) * (1 - tx) + f(ix + 1, iz + 1) * tx) * tz;
    return [lerp(h), lerp(d)];
  }

  buildRoad(track, T) {
    const n = track.n;
    const strip = (cols, mat, uvv, shadows = true) => {
      // cols: [[x, dy, u], ...] across the road
      const w = cols.length;
      const P = new Float32Array((n + 1) * w * 3), UV = new Float32Array((n + 1) * w * 2);
      const idx = [];
      for (let i = 0; i <= n; i++) {
        const k = i % n;
        const a = track.A[k], rx = -Math.cos(a), rz = Math.sin(a);
        for (let c = 0; c < w; c++) {
          const [x, dy, u] = cols[c];
          const o = (i * w + c);
          P[o * 3] = track.X[k] + rx * x;
          P[o * 3 + 1] = track.Y[k] + dy;
          P[o * 3 + 2] = track.Z[k] + rz * x;
          UV[o * 2] = u;
          UV[o * 2 + 1] = (i * track.step) / uvv;
        }
        if (i < n) for (let c = 0; c < w - 1; c++) {
          const a0 = i * w + c, b0 = (i + 1) * w + c;
          idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(P, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = shadows;
      this.root.add(m);
      return m;
    };
    const RW = ROAD_HALF + 0.3;
    const roadMat = new THREE.MeshStandardMaterial({ map: roadTexture(this.renderer), roughness: 0.82, metalness: 0.05 });
    const road = strip([[RW, 0.04, 0], [-RW, 0.04, 1]], roadMat, 24);
    road.geometry.computeVertexNormals();
    const sh = new THREE.MeshStandardMaterial({ color: T.shoulder, roughness: 1 });
    for (const sgn of [-1, 1]) {
      const cols = [[sgn * RW, 0.035, 0], [sgn * (WALL + 0.8), 0.0, 1], [sgn * (WALL + 6), -4, 1]];
      if (sgn > 0) cols.reverse();
      strip(cols, sh, 10);
    }
    // guardrails
    const railMat = new THREE.MeshStandardMaterial({ color: 0xaeb4bc, metalness: 0.45, roughness: 0.55, side: THREE.DoubleSide });
    for (const sgn of [-1, 1]) {
      const cols = [[sgn * (WALL + 0.05), 0.45, 0], [sgn * (WALL + 0.05), 0.62, 0.5], [sgn * (WALL + 0.15), 0.7, 0.6], [sgn * (WALL + 0.05), 0.82, 1]];
      if (sgn > 0) cols.reverse();
      strip(cols, railMat, 4, false).castShadow = true;
    }
    const postGeo = new THREE.BoxGeometry(0.12, 0.85, 0.12);
    postGeo.translate(0, 0.42, 0);
    const posts = new THREE.InstancedMesh(postGeo, new THREE.MeshStandardMaterial({ color: 0x8a9099, metalness: 0.6, roughness: 0.5 }), Math.ceil(n / 2) * 2);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    let pi = 0;
    for (let i = 0; i < n; i += 2) {
      const a = track.A[i], rx = -Math.cos(a), rz = Math.sin(a);
      for (const sgn of [-1, 1]) {
        v.set(track.X[i] + rx * sgn * (WALL + 0.25), track.Y[i], track.Z[i] + rz * sgn * (WALL + 0.25));
        q.setFromAxisAngle(up, a);
        posts.setMatrixAt(pi++, m4.compose(v, q, s1));
      }
    }
    posts.count = pi;
    this.root.add(posts);
  }

  buildRoadside(track, T, loc) {
    const n = track.n, R = rng(loc.seed + 3);
    // street lamps
    const poleG = new THREE.CylinderGeometry(0.09, 0.14, 8.5, 8);
    poleG.translate(0, 4.25, 0);
    const armG = new THREE.BoxGeometry(0.12, 0.12, 2.6);
    armG.translate(0, 8.4, 1.2);
    const pole = mergeGeometries([poleG, armG]);
    const headG = new THREE.BoxGeometry(0.5, 0.16, 0.9);
    headG.translate(0, 8.3, 2.4);
    const every = 70, count = Math.floor(track.length / every);
    const poles = new THREE.InstancedMesh(pole, new THREE.MeshStandardMaterial({ color: 0x3b4048, metalness: 0.7, roughness: 0.4 }), count);
    const heads = new THREE.InstancedMesh(headG, new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffc977, emissiveIntensity: 2.4 }), count);
    const glows = new THREE.InstancedMesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xffb35c, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }), count);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    const p = {};
    for (let k = 0; k < count; k++) {
      const sgn = k % 2 ? 1 : -1;
      track.world(k * every + 20, sgn * (WALL + 0.9), p);
      v.set(p.x, p.y, p.z);
      q.setFromAxisAngle(up, p.a + (sgn > 0 ? -Math.PI / 2 : Math.PI / 2));
      m4.compose(v, q, s1);
      poles.setMatrixAt(k, m4);
      heads.setMatrixAt(k, m4);
      track.world(k * every + 20, sgn * (WALL - 1.5), p);
      m4.makeRotationX(-Math.PI / 2).setPosition(p.x, p.y + 0.06, p.z);
      glows.setMatrixAt(k, m4);
    }
    this.root.add(poles, heads, glows);
    // start gantry with the chequered strip
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#0b0d12'; g.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#f8fafc' : '#0b0d12'; g.fillRect(i * 16, 44 + j * 10, 16, 10); }
    g.fillStyle = '#ff5a1f'; g.font = 'italic 900 34px "Chakra Petch", Arial'; g.textAlign = 'center';
    g.fillText('APEX PURSUIT', 128, 34);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const s0 = track.sample(0);
    const gantry = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.BoxGeometry(WALL * 2 + 1, 1.6, 0.4), [0, 0, 0, 0, 1, 1].map(i => i ? new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.6 }) : new THREE.MeshStandardMaterial({ color: 0x15171c })));
    beam.position.y = 7.2;
    gantry.add(beam);
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 0.5), new THREE.MeshStandardMaterial({ color: 0x15171c, metalness: 0.5, roughness: 0.5 }));
      post.position.set(sx * (WALL + 0.6), 4, 0);
      gantry.add(post);
    }
    gantry.position.set(s0.x, s0.y, s0.z);
    gantry.rotation.y = s0.a;
    this.root.add(gantry);
    // finish stripe on the asphalt
    const fin = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, 1.2), new THREE.MeshStandardMaterial({ map: (() => {
      const cc = document.createElement('canvas'); cc.width = 256; cc.height = 16;
      const gg = cc.getContext('2d');
      for (let i = 0; i < 32; i++) for (let j = 0; j < 2; j++) { gg.fillStyle = (i + j) % 2 ? '#f1f1ee' : '#16171a'; gg.fillRect(i * 8, j * 8, 8, 8); }
      const t = new THREE.CanvasTexture(cc); t.colorSpace = THREE.SRGBColorSpace; return t;
    })(), roughness: 0.8 }));
    fin.position.set(s0.x, s0.y + 0.06, s0.z);
    fin.rotation.order = 'YXZ';
    fin.rotation.set(-Math.PI / 2, s0.a, 0);
    this.root.add(fin);
    // billboards
    for (let k = 0; k < 7; k++) {
      const ad = ADS[k % ADS.length];
      const sgn = R() < 0.5 ? -1 : 1;
      const s = (k + 0.5) / 7 * track.length + R() * 120;
      track.world(s, sgn * (WALL + 14), p);
      const bb = new THREE.Group();
      const board = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 0.3), [0, 0, 0, 0, 1, 0].map(i => i ? new THREE.MeshStandardMaterial({ map: billboardTexture(...ad), emissive: 0xffffff, emissiveMap: null, roughness: 0.6 }) : new THREE.MeshStandardMaterial({ color: 0x23262d })));
      board.material[4].emissiveIntensity = 0;
      board.position.y = 9;
      bb.add(board);
      for (const sx of [-3.5, 3.5]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7, 0.4), new THREE.MeshStandardMaterial({ color: 0x2b2f36 }));
        leg.position.set(sx, 3.2, 0);
        bb.add(leg);
      }
      const [gy] = this.groundAt(p.x, p.z);
      bb.position.set(p.x, Math.min(p.y, gy), p.z);
      bb.rotation.y = p.a + (sgn > 0 ? Math.PI * 0.85 : Math.PI * 1.15);
      this.root.add(bb);
    }
  }

  scatter(track, T, loc, quality) {
    const R = rng(loc.seed + 11);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const p = {};
    const spots = (count, dmin, dmax) => {
      const out = [];
      for (let k = 0; k < count * 3 && out.length < count; k++) {
        const s = R() * track.length, sgn = R() < 0.5 ? -1 : 1;
        const d = dmin + Math.pow(R(), 1.6) * (dmax - dmin);
        track.world(s, sgn * d, p);
        const [gy, gd] = this.groundAt(p.x, p.z);
        if (gd < 15) continue;
        if (T.water && gy < T.waterLevel + 1) continue;
        out.push([p.x, gy, p.z]);
      }
      return out;
    };
    const place = (geo, mat, list, sMin, sMax, tiltAmt = 0) => {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach(([x, y, z], i) => {
        const s = sMin + R() * (sMax - sMin);
        q.setFromAxisAngle(up, R() * Math.PI * 2);
        if (tiltAmt) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (R() - 0.5) * tiltAmt));
        sc.set(s, s, s);
        v.set(x, y - 0.2, z);
        im.setMatrixAt(i, m4.compose(v, q, sc));
      });
      im.castShadow = quality === 'high';
      this.root.add(im);
      return im;
    };
    const lots = quality === 'high' ? 1 : 0.6;
    const std = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.9, flatShading: true }, o));

    if (T.flora === 'palm') {
      const trunk = new THREE.CylinderGeometry(0.18, 0.3, 9, 6);
      trunk.translate(0, 4.5, 0);
      const leaves = [];
      for (let i = 0; i < 7; i++) {
        const l = new THREE.ConeGeometry(0.55, 4.2, 4, 1);
        l.scale(1, 1, 0.25);
        l.translate(0, 2.1, 0);
        l.rotateX(Math.PI / 2 + 0.5);
        l.rotateY((i / 7) * Math.PI * 2);
        l.translate(0, 9, 0);
        leaves.push(l);
      }
      const crown = mergeGeometries(leaves);
      const list = spots(420 * lots, 13, 160);
      const r0 = list.map(x => x);
      place(trunk, std('#7a5a3c'), r0, 0.8, 1.25, 0.25);
      place(crown, std('#3f7d3a', { side: THREE.DoubleSide }), r0, 0.8, 1.25, 0.25);
    } else if (T.flora === 'pine') {
      const parts = [];
      const t = new THREE.CylinderGeometry(0.2, 0.3, 3, 6); t.translate(0, 1.5, 0); parts.push(t);
      const trunkG = mergeGeometries(parts);
      const cones = [];
      for (let i = 0; i < 3; i++) { const c = new THREE.ConeGeometry(2.6 - i * 0.6, 4.2, 7); c.translate(0, 3.5 + i * 2.4, 0); cones.push(c); }
      const crown = mergeGeometries(cones);
      const list = spots(900 * lots, 13, 260);
      place(trunkG, std('#4a3424'), list, 0.8, 1.6);
      place(crown, std('#244a32'), list, 0.8, 1.6);
    } else {
      const parts = [];
      const body = new THREE.CylinderGeometry(0.35, 0.4, 4, 8); body.translate(0, 2, 0); parts.push(body);
      for (const sx of [-1, 1]) {
        const arm = new THREE.CylinderGeometry(0.22, 0.22, 1.2, 6); arm.rotateZ(Math.PI / 2); arm.translate(sx * 0.8, 1.8 + sx * 0.3, 0); parts.push(arm);
        const up2 = new THREE.CylinderGeometry(0.22, 0.22, 1.5, 6); up2.translate(sx * 1.3, 2.4 + sx * 0.3, 0); parts.push(up2);
      }
      const cactus = mergeGeometries(parts);
      place(cactus, std('#4f7a3a'), spots(260 * lots, 13, 140), 0.7, 1.4);
      const bush = new THREE.IcosahedronGeometry(1, 0);
      place(bush, std('#8c7a45'), spots(300 * lots, 12, 120), 0.5, 1.3);
    }
    const rock = new THREE.IcosahedronGeometry(1.6, 0);
    place(rock, std(T.rock), spots(260 * lots, 13, 220), 0.6, 2.6, 1);
  }

  update(focus, t, camera) {
    if (!this.sun) return;
    this.sky.position.copy(camera.position);
    this.skyMat.uniforms.time.value = t;
    this.sunTarget.position.copy(focus);
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 220);
    this.sun.position.y = Math.max(this.sun.position.y, focus.y + 60);
  }
}
