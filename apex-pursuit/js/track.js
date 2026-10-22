// Closed-loop four-lane highway. Everything on the road lives in (s, x):
// s = metres along the loop, x = metres right of the centre line.
export const ROAD_HALF = 8;          // four 4 m lanes
export const WALL = 9.1;             // guardrail line
export const LANES = [-6, -2, 2, 6]; // negative x = oncoming side

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));

export function buildTrack(loc) {
  const r = rng(loc.seed);
  const ph = Array.from({ length: 8 }, () => r() * Math.PI * 2);
  let amp = [0.16, 0.11, 0.05];
  for (let attempt = 0; attempt < 12; attempt++) {
    const t = trace(loc, ph, amp);
    if (t.maxK < 1 / 120) return t;
    amp = amp.map(a => a * 0.82);
  }
  return trace(loc, ph, amp);
}

function trace(loc, ph, amp) {
  const R = loc.radius;
  const N = 6000;
  const px = new Float64Array(N + 1), pz = new Float64Array(N + 1), cum = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * Math.PI * 2;
    const rr = R * (1 + amp[0] * Math.sin(2 * th + ph[0]) + amp[1] * Math.sin(3 * th + ph[1]) + amp[2] * Math.sin(5 * th + ph[2]));
    px[i] = rr * Math.cos(th);
    pz[i] = rr * Math.sin(th) * loc.squash;
    if (i) cum[i] = cum[i - 1] + Math.hypot(px[i] - px[i - 1], pz[i] - pz[i - 1]);
  }
  const total = cum[N];
  const n = Math.round(total / 2);
  const step = total / n;
  const X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n);
  const A = new Float32Array(n), K = new Float32Array(n), G = new Float32Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const s = i * step;
    while (j < N - 1 && cum[j + 1] < s) j++;
    const f = (s - cum[j]) / (cum[j + 1] - cum[j]);
    X[i] = px[j] + (px[j + 1] - px[j]) * f;
    Z[i] = pz[j] + (pz[j + 1] - pz[j]) * f;
    const u = (s / total) * Math.PI * 2;
    Y[i] = loc.baseY + loc.hills * (0.6 * Math.sin(2 * u + ph[3]) + 0.3 * Math.sin(5 * u + ph[4]) + 0.12 * Math.sin(9 * u + ph[5]));
  }
  for (let i = 0; i < n; i++) {
    const a = (i + n - 1) % n, b = (i + 1) % n;
    A[i] = Math.atan2(X[b] - X[a], Z[b] - Z[a]);
    G[i] = (Y[b] - Y[a]) / (2 * step);
  }
  let maxK = 0;
  for (let i = 0; i < n; i++) {
    const a = (i + n - 2) % n, b = (i + 2) % n;
    K[i] = wrapA(A[b] - A[a]) / (4 * step);
  }
  // light smoothing so steering assist doesn't twitch
  const K2 = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let d = -6; d <= 6; d++) sum += K[(i + d + n) % n];
    K2[i] = sum / 13;
    maxK = Math.max(maxK, Math.abs(K2[i]));
  }
  return new Track(X, Y, Z, A, K2, G, step, total, maxK);
}

export class Track {
  constructor(X, Y, Z, A, K, G, step, length, maxK) {
    Object.assign(this, { X, Y, Z, A, K, G, step, length, maxK, n: X.length });
  }
  wrap(s) { s %= this.length; return s < 0 ? s + this.length : s; }
  // signed shortest distance from s1 to s2 along the loop
  delta(s1, s2) {
    let d = (s2 - s1) % this.length;
    if (d > this.length / 2) d -= this.length;
    if (d < -this.length / 2) d += this.length;
    return d;
  }
  sample(s, out = {}) {
    s = this.wrap(s);
    const fi = s / this.step;
    const i = Math.floor(fi) % this.n, k = (i + 1) % this.n, f = fi - Math.floor(fi);
    out.x = this.X[i] + (this.X[k] - this.X[i]) * f;
    out.y = this.Y[i] + (this.Y[k] - this.Y[i]) * f;
    out.z = this.Z[i] + (this.Z[k] - this.Z[i]) * f;
    out.a = this.A[i] + wrapA(this.A[k] - this.A[i]) * f;
    out.k = this.K[i] + (this.K[k] - this.K[i]) * f;
    out.g = this.G[i] + (this.G[k] - this.G[i]) * f;
    return out;
  }
  // world position of a point x metres right of the centre line
  world(s, x, out = {}) {
    this.sample(s, out);
    out.x += -Math.cos(out.a) * x;
    out.z += Math.sin(out.a) * x;
    return out;
  }
}
