// Arcade car physics (grip, handbrake slides, jumps, crashes, fire) and the
// drivers: lane-following traffic, police pursuit over the road grid, racers.
import { CAR_TYPES, buildCar } from './models.js';
import {
  collideCircle, groundHeight, SHORE, LANE, NX, NZ, nodePos, neighbors, nearestNode, stepToward,
  segmentClear, laneSpot, clamp, PITCH as PITCH_
} from './city.js';

export const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const TRAFFIC_MIX = [['sedan', 30], ['taxi', 12], ['convertible', 10], ['sports', 7], ['van', 12], ['muscle', 10], ['police', 5]];
export function randomType() {
  let r = Math.random() * TRAFFIC_MIX.reduce((s, m) => s + m[1], 0);
  for (const [k, w] of TRAFFIC_MIX) if ((r -= w) < 0) return k;
  return 'sedan';
}

let nextId = 1;
export class Vehicle {
  constructor(G, type, x, z, yaw, color) {
    const t = CAR_TYPES[type];
    this.id = nextId++;
    this.type = type; this.t = t;
    this.color = color || t.colors[Math.floor(Math.random() * t.colors.length)];
    const m = buildCar(type, this.color);
    this.mesh = m.group; this.bodyMesh = m.bodyMesh; this.wheels = m.wheels; this.tailMat = m.tailMat; this.bar = m.bar; this.wreckFn = m.wreck;
    this.x = x; this.z = z; this.y = groundHeight(x, z); this.vy = 0; this.yaw = yaw;
    this.vx = 0; this.vz = 0; this.steer = 0; this.spin = 0; this.lean = 0;
    this.hp = t.hp; this.dead = false; this.burn = 0; this.flood = 0; this.smokeT = 0;
    this.driver = null;
    this.ctrl = { throttle: 0, steer: 0, hb: false };
    this.ai = null; this.siren = false; this.air = 0; this.grounded = true;
    this.topMul = 1; this.lastHitBy = null; this.keep = false; this.removed = false;
    this.r = t.W / 2;
    this._c = [{ x: 0, z: 0, o: 0 }, { x: 0, z: 0, o: 0 }, { x: 0, z: 0, o: 0 }];
    G.scene.add(this.mesh);
    this.sync(0, 0);
  }
  get fwd() { return this.vx * Math.sin(this.yaw) + this.vz * Math.cos(this.yaw); }
  get speed() { return Math.hypot(this.vx, this.vz); }
  circles() {
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), off = this.t.L / 2 - this.r;
    const c = this._c;
    c[0].o = off; c[1].o = 0; c[2].o = -off;
    for (const p of c) { p.x = this.x + fx * p.o; p.z = this.z + fz * p.o; }
    return c;
  }
  // world position of the driver's door (left side)
  door(extra = 0.7) {
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    return { x: this.x + fz * (this.t.W / 2 + extra) + fx * 0.3, z: this.z - fx * (this.t.W / 2 + extra) + fz * 0.3 };
  }
  damage(n, G, by) {
    if (this.dead || n <= 0) return;
    this.hp -= n;
    if (by) this.lastHitBy = by;
    if (this.hp <= 0 && !this.burn) { this.hp = 0; this.burn = 4.5; }
  }
  explode(G) {
    this.dead = true; this.burn = 0;
    this.wreckFn();
    this.vy = 5; this.y += 0.05; this.grounded = false;
    this.vx *= 0.3; this.vz *= 0.3;
    G.explosion(this.x, this.y + 0.8, this.z, this);
  }
  step(dt, G) {
    const t = this.t, c = this.ctrl;
    if (this.dead || this.flood > 0 || (!this.driver && !this.ai)) { c.throttle = 0; c.steer = 0; c.hb = !this.driver; }
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), rx = -fz, rz = fx;
    let f = this.vx * fx + this.vz * fz, s = this.vx * rx + this.vz * rz;
    if (this.grounded) {
      const top = t.top * this.topMul;
      if (c.throttle > 0) {
        if (f < -0.5) f += 24 * c.throttle * dt;
        else f += t.acc * this.topMul * c.throttle * dt * Math.max(0.1, 1 - f / top);
      } else if (c.throttle < 0) {
        if (f > 0.5) f = Math.max(0, f + c.throttle * 24 * dt);
        else f = Math.max(-top * 0.32, f + c.throttle * t.acc * 0.75 * dt);
      } else f -= Math.sign(f) * Math.min(Math.abs(f), (this.driver ? 2.2 : 5) * dt);
      if (c.hb) f -= Math.sign(f) * Math.min(Math.abs(f), 7 * dt);
      f -= f * 0.06 * dt;
      const maxSteer = 0.58 / (1 + Math.abs(f) / 20);
      this.steer += (c.steer * maxSteer - this.steer) * Math.min(1, dt * 7);
      const grip = c.hb ? 1.3 : this.dead ? 3 : t.grip;
      s *= Math.exp(-grip * dt);
      this.vx = fx * f + rx * s; this.vz = fz * f + rz * s;
      const yawRate = f * Math.tan(this.steer) / (t.L * 0.58) * (c.hb ? 1.3 : 1);
      this.yaw = wrap(this.yaw + yawRate * dt);
      this.lean += (clamp(-yawRate * f * 0.012, -0.08, 0.08) - this.lean) * Math.min(1, dt * 5);
    } else {
      this.vx *= 1 - 0.05 * dt; this.vz *= 1 - 0.05 * dt;
    }
    const px = this.x, pz = this.z, py = this.y;
    this.x += this.vx * dt; this.z += this.vz * dt;
    // ground & jumps
    const gh = groundHeight(this.x, this.z);
    if (this.grounded) {
      if (gh - py > 0.6) { this.x = px; this.z = pz; this.vx *= -0.3; this.vz *= -0.3; }
      else if (gh < py - 0.25) { this.grounded = false; this.air = 0; }
      else { this.vy = clamp((gh - py) / Math.max(dt, 1e-3), -20, 14); this.y = gh; }
    }
    if (!this.grounded) {
      this.vy -= 22 * dt; this.y += this.vy * dt; this.air += dt;
      const g2 = groundHeight(this.x, this.z);
      if (this.y <= g2) {
        if (this.vy < -9) { this.damage((-this.vy - 9) * 3, G); G.onLand?.(this, this.air); }
        else if (this.air > 0.3) G.onLand?.(this, this.air);
        this.y = g2; this.vy = 0; this.grounded = true;
      }
    }
    // buildings
    for (const p of this.circles()) {
      const ox = p.x, oz = p.z;
      const hit = collideCircle(p, this.r, this.y);
      if (!hit) continue;
      this.x += p.x - ox; this.z += p.z - oz;
      const vn = this.vx * hit.nx + this.vz * hit.nz;
      if (vn < 0) {
        this.vx -= hit.nx * vn * 1.3; this.vz -= hit.nz * vn * 1.3;
        this.vx *= 0.96; this.vz *= 0.96;
        this.yaw = wrap(this.yaw + clamp(p.o * (hit.nx * Math.cos(this.yaw) - hit.nz * Math.sin(this.yaw)) * -vn * 0.012, -0.3, 0.3));
        const impact = -vn;
        if (impact > 5) { this.damage((impact - 5) * 2.4, G); G.onCrash?.(this, impact); }
      }
    }
    // sea
    if (this.x > SHORE + 16 && !this.dead) {
      this.flood += dt;
      this.vx *= 1 - 2 * dt; this.vz *= 1 - 2 * dt;
      if (this.flood > 2.5) { this.dead = true; this.sunk = true; this.wreckFn(); }
    }
    // fire
    if (this.burn > 0) {
      this.burn -= dt;
      G.fx.fire(this.x, this.y + 1, this.z);
      if (this.burn <= 0) this.explode(G);
    } else if (!this.dead && this.hp < this.t.hp * 0.35) {
      this.smokeT -= dt;
      if (this.smokeT <= 0) { this.smokeT = 0.08; G.fx.smoke(this.x + Math.sin(this.yaw) * this.t.L * 0.4, this.y + 1, this.z + Math.cos(this.yaw) * this.t.L * 0.4, this.hp < this.t.hp * 0.15); }
    }
    if (this.dead && this.y < -1.6) this.y = -1.6;
  }
  sync(dt, night) {
    const m = this.mesh;
    m.position.set(this.x, this.y, this.z);
    m.rotation.set(0, this.yaw, 0);
    m.rotateZ(this.lean);
    if (!this.grounded) m.rotateX(clamp(-this.vy * 0.03, -0.35, 0.35));
    const f = this.fwd;
    this.spin += f * dt / this.t.wr;
    for (const w of this.wheels) {
      w.spin.rotation.x = this.spin;
      if (w.front) w.piv.rotation.y = this.steer;
    }
    const braking = this.ctrl.throttle < -0.1 && f > 0.5;
    const k = this.dead ? 0 : braking ? 3 : 0.35 + night * 0.9;
    this.tailMat.color.setRGB(k, k * 0.06, k * 0.06);
    if (this.bar) {
      const on = this.siren && !this.dead, ph = Math.floor(performance.now() / 140) % 2;
      this.bar.red.color.setRGB(on && ph ? 4 : 0.35, 0.05, 0.05);
      this.bar.blue.color.setRGB(0.05, 0.1, on && !ph ? 4 : 0.35);
    }
  }
  remove(G) { G.scene.remove(this.mesh); this.removed = true; }
}

// ---------- collisions between cars ----------
export function collideCars(list, G) {
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      const dx = b.x - a.x, dz = b.z - a.z, lim = (a.t.L + b.t.L) / 2;
      if (dx * dx + dz * dz > lim * lim || Math.abs(a.y - b.y) > 1.4) continue;
      const ca = a.circles().map(p => ({ x: p.x, z: p.z })), cb = b.circles();
      let best = null;
      const rr = a.r + b.r;
      for (const p of ca) for (const q of cb) {
        const ex = q.x - p.x, ez = q.z - p.z, d2 = ex * ex + ez * ez;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 0.01, pen = rr - d;
        if (!best || pen > best.pen) best = { nx: ex / d, nz: ez / d, pen };
      }
      if (!best) continue;
      const ma = a.t.mass * (a.dead ? 2 : 1), mb = b.t.mass * (b.dead ? 2 : 1), tot = ma + mb;
      a.x -= best.nx * best.pen * mb / tot; a.z -= best.nz * best.pen * mb / tot;
      b.x += best.nx * best.pen * ma / tot; b.z += best.nz * best.pen * ma / tot;
      const rv = (b.vx - a.vx) * best.nx + (b.vz - a.vz) * best.nz;
      if (rv >= 0) continue;
      const jimp = -1.25 * rv / (1 / ma + 1 / mb);
      a.vx -= jimp / ma * best.nx; a.vz -= jimp / ma * best.nz;
      b.vx += jimp / mb * best.nx; b.vz += jimp / mb * best.nz;
      const hit = -rv;
      if (hit > 4) {
        const byA = a.driver === 'player' ? 'player' : null, byB = b.driver === 'player' ? 'player' : null;
        a.damage((hit - 4) * 2.6 * mb / tot * 2, G, byB);
        b.damage((hit - 4) * 2.6 * ma / tot * 2, G, byA);
        G.onCarHit?.(a, b, hit);
      }
    }
  }
}

// ---------- shared steering ----------
function steerTo(v, tx, tz, target, dt, hbOk) {
  const want = Math.atan2(tx - v.x, tz - v.z), diff = wrap(want - v.yaw);
  const f = v.fwd;
  v.ctrl.steer = clamp(diff * 2.6, -1, 1);
  const turnSlow = Math.abs(diff) > 0.45 ? Math.max(9, target * 0.45) : target;
  const tgt = Math.min(target, turnSlow);
  v.ctrl.throttle = f < tgt - 0.5 ? clamp((tgt - f) * 0.35, 0.35, 1) : f > tgt + 1.5 ? -clamp((f - tgt) * 0.25, 0.2, 1) : 0.1;
  v.ctrl.hb = !!hbOk && Math.abs(diff) > 0.9 && f > 13;
  return diff;
}

function unstick(v, ai, dt) {
  if (ai.rev > 0) {
    ai.rev -= dt;
    v.ctrl.throttle = -1; v.ctrl.steer = -ai.revSteer; v.ctrl.hb = false;
    return true;
  }
  if (Math.abs(v.fwd) < 1.2 && v.ctrl.throttle > 0.4) {
    ai.stuck = (ai.stuck || 0) + dt;
    if (ai.stuck > 1.2) { ai.stuck = 0; ai.rev = 1.0; ai.revSteer = v.ctrl.steer >= 0 ? 1 : -1; }
  } else ai.stuck = 0;
  return false;
}

// Moves along intersections toward (tx,tz); goes straight once it can see it.
function entryNode(v, tx, tz) {
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  let best = null, score = Infinity;
  for (const i of [Math.floor(v.x / PITCH_), Math.ceil(v.x / PITCH_)]) for (const j of [Math.floor(v.z / PITCH_), Math.ceil(v.z / PITCH_)]) {
    if (i < 0 || i > NX || j < 0 || j > NZ) continue;
    const p = nodePos(i, j), dx = p.x - v.x, dz = p.z - v.z;
    const sc = Math.hypot(dx, dz) + Math.hypot(tx - p.x, tz - p.z) + (dx * fx + dz * fz < -4 ? 40 : 0);
    if (sc < score) { score = sc; best = { i, j }; }
  }
  return best || nearestNode(v.x, v.z);
}
function navigate(v, ai, tx, tz, dt, directRange = 45) {
  const d = Math.hypot(tx - v.x, tz - v.z);
  ai.losT = (ai.losT || 0) - dt;
  if (ai.losT <= 0) { ai.losT = 0.3; ai.los = d < directRange && segmentClear(v.x, v.z, tx, tz, 1); }
  if (ai.los) { ai.next = null; return { x: tx, z: tz, d, direct: true }; }
  if (!ai.next) { ai.next = entryNode(v, tx, tz); ai.nextP = nodePos(ai.next.i, ai.next.j); }
  if (Math.hypot(ai.nextP.x - v.x, ai.nextP.z - v.z) < 9) {
    const nx = stepToward(ai.next, nearestNode(tx, tz));
    if (nx.i === ai.next.i && nx.j === ai.next.j) return { x: tx, z: tz, d, direct: true };
    ai.next = nx; ai.nextP = nodePos(nx.i, nx.j);
  }
  return { x: ai.nextP.x, z: ai.nextP.z, d, direct: false };
}

// ---------- traffic ----------
function planTraffic(ai) {
  const { a, b } = ai;
  const opts = neighbors(b.i, b.j).filter(n => !(n.i === a.i && n.j === a.j));
  const c = opts[Math.floor(Math.random() * opts.length)] || a;
  const A = nodePos(a.i, a.j), B = nodePos(b.i, b.j), C = nodePos(c.i, c.j);
  const d1x = Math.sign(B.x - A.x), d1z = Math.sign(B.z - A.z), d2x = Math.sign(C.x - B.x), d2z = Math.sign(C.z - B.z);
  ai.wp.push({ x: B.x - d1x * 10 - d1z * LANE, z: B.z - d1z * 10 + d1x * LANE });
  ai.wp.push({ x: B.x + d2x * 10 - d2z * LANE, z: B.z + d2z * 10 + d2x * LANE });
  ai.a = b; ai.b = c;
}

function lookAhead(v, G, range) {
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  let best = range, who = null;
  for (const o of G.cars) {
    if (o === v || o.removed) continue;
    const dx = o.x - v.x, dz = o.z - v.z, al = dx * fx + dz * fz;
    if (al <= 0 || al > best + 4) continue;
    if (Math.abs(-dx * fz + dz * fx) < 2.3) { const e = al - o.t.L / 2; if (e < best) { best = e; who = o; } }
  }
  for (const p of G.walkers) {
    const dx = p.x - v.x, dz = p.z - v.z, al = dx * fx + dz * fz;
    if (al <= 0 || al > best) continue;
    if (Math.abs(-dx * fz + dz * fx) < 1.7) { best = al; who = p; }
  }
  return { d: best - v.t.L / 2, who };
}

export function driveTraffic(v, G, dt) {
  const ai = v.ai;
  if (!ai.wp.length) planTraffic(ai);
  let w = ai.wp[0];
  if (Math.hypot(w.x - v.x, w.z - v.z) < 4.5) { ai.wp.shift(); if (!ai.wp.length) planTraffic(ai); w = ai.wp[0]; }
  let target = ai.cruise;
  if (ai.panic > 0) { ai.panic -= dt; target *= 1.6; }
  const look = lookAhead(v, G, 14);
  if (look.d < 12 && ai.panic <= 0) target = Math.min(target, Math.max(0, (look.d - 2.5) * 1.4));
  if (look.d < 4 && look.who && (look.who === G.player || look.who.driver === 'player')) {
    ai.honk = (ai.honk || 0) + dt;
    if (ai.honk > 1.6) { ai.honk = -2.5; G.audio.horn(v.x, v.z); }
  }
  if (unstick(v, ai, dt)) return;
  steerTo(v, w.x, w.z, target, dt, false);
  if (target < 0.5) v.ctrl.throttle = v.fwd > 0.3 ? -1 : 0;
}

export function spawnTraffic(G, focus, minD, maxD, type, inView) {
  for (let tries = 0; tries < 14; tries++) {
    const i = Math.floor(Math.random() * (NX + 1)), j = Math.floor(Math.random() * (NZ + 1));
    const nb = neighbors(i, j), b = nb[Math.floor(Math.random() * nb.length)];
    const s = laneSpot({ i, j }, b, 0.25 + Math.random() * 0.5);
    const d = Math.hypot(s.x - focus.x, s.z - focus.z);
    if (d < minD || d > maxD) continue;
    if (inView && d < 130 && inView(s.x, s.z)) continue;
    if (G.cars.some(c => Math.abs(c.x - s.x) < 9 && Math.abs(c.z - s.z) < 9)) continue;
    const v = new Vehicle(G, type || randomType(), s.x, s.z, s.yaw);
    v.driver = 'ai';
    v.ai = { mode: 'traffic', a: { i, j }, b, wp: [], cruise: 10 + Math.random() * 5, panic: 0 };
    v.vx = Math.sin(s.yaw) * 8; v.vz = Math.cos(s.yaw) * 8;
    G.cars.push(v);
    return v;
  }
  return null;
}

// ---------- police ----------
export function driveCop(v, G, dt) {
  const ai = v.ai, P = G.target;
  v.siren = true;
  if (unstick(v, ai, dt)) return;
  const nav = navigate(v, ai, P.x + P.vx * 0.5, P.z + P.vz * 0.5, dt, 50);
  if (nav.direct && nav.d < 13 && P.onFoot) {
    v.ctrl.throttle = v.fwd > 0.5 ? -1 : 0; v.ctrl.steer = 0; v.ctrl.hb = false;
    if (v.speed < 2) ai.deploy = true;
    return;
  }
  const target = (nav.direct ? 40 : 30) * v.topMul;
  steerTo(v, nav.x, nav.z, target, dt, true);
  if (nav.direct) v.ctrl.throttle = 1;
}

// Drive to a point along the road grid (mission targets, racers).
export function driveTo(v, G, dt, tx, tz, speed) {
  const ai = v.ai;
  if (unstick(v, ai, dt)) return Infinity;
  const nav = navigate(v, ai, tx, tz, dt, 40);
  steerTo(v, nav.x, nav.z, speed, dt, true);
  return nav.d;
}

export function driveRoute(v, G, dt, route) {
  const ai = v.ai;
  if (ai.idx >= route.length) { v.ctrl.throttle = v.fwd > 0.5 ? -1 : 0; v.ctrl.steer = 0; return; }
  const p = route[ai.idx];
  if (Math.hypot(p.x - v.x, p.z - v.z) < 12) ai.idx++;
  if (unstick(v, ai, dt)) return;
  steerTo(v, p.x, p.z, v.t.top * v.topMul, dt, true);
}
