// People on foot: civilians walking the block sidewalks or the beach, cops and
// thugs who chase and shoot, ragdoll-ish knockdowns and bodies that fade out.
import { buildPerson, personLook, animatePerson } from './models.js';
import { collideCircle, groundHeight, sidewalkCorner, blockRect, segmentClear, NX, NZ, BEACH_X, SHORE, CITY_H, PITCH, clamp } from './city.js';
import { wrap } from './vehicles.js';

export class Person {
  constructor(G, kind, x, z, opts = {}) {
    this.kind = kind;
    this.m = buildPerson(opts.look || personLook(kind === 'target' ? 'thug' : kind));
    G.scene.add(this.m.root);
    this.x = x; this.z = z; this.y = groundHeight(x, z); this.vy = 0; this.vx = 0; this.vz = 0;
    this.yaw = opts.yaw ?? Math.random() * Math.PI * 2;
    this.hp = kind === 'swat' ? 160 : kind === 'target' ? 140 : 100;
    this.dead = false; this.removed = false; this.fade = 0;
    this.state = opts.state || 'walk';
    this.phase = Math.random() * 6; this.moving = 0;
    this.weapon = kind === 'swat' ? 'smg' : kind === 'cop' || kind === 'thug' || kind === 'target' ? 'pistol' : null;
    this.fireCd = 0.8 + Math.random(); this.aim = false;
    this.cash = kind === 'civ' ? 5 + Math.floor(Math.random() * 45) : kind === 'thug' ? 60 : 30;
    this.keep = !!opts.keep; this.mission = opts.mission || null;
    this.flee = { t: 0, x: 0, z: 0 };
    this.route = null; this.wait = 0; this.tumble = 0;
    this.speedMul = 0.9 + Math.random() * 0.25;
    if (this.state === 'walk') this.joinSidewalk();
    this.sync();
  }
  get onFoot() { return true; }
  joinSidewalk() {
    const bx = clamp(Math.floor(this.x / PITCH), 0, NX - 1), bz = clamp(Math.floor(this.z / PITCH), 0, NZ - 1);
    let best = 0, bd = Infinity;
    for (let k = 0; k < 4; k++) { const c = sidewalkCorner(bx, bz, k), d = Math.hypot(c.x - this.x, c.z - this.z); if (d < bd) { bd = d; best = k; } }
    this.route = { bx, bz, k: best, dir: Math.random() < 0.5 ? 1 : 3 };
    if (this.x > BEACH_X + 2) this.state = 'beach';
  }
  target() {
    if (this.state === 'beach') return this.beachT || (this.beachT = { x: BEACH_X + 10 + Math.random() * (SHORE - BEACH_X - 14), z: clamp(this.z + (Math.random() - 0.5) * 80, 4, CITY_H - 4) });
    return sidewalkCorner(this.route.bx, this.route.bz, this.route.k);
  }
  nextCorner() {
    const r = this.route;
    // sometimes cross the street to the next block
    if (Math.random() < 0.3) {
      const k = r.k, opts = [];
      if ((k === 0 || k === 3) && r.bx > 0) opts.push([-1, 0, k === 0 ? 1 : 2]);
      if ((k === 1 || k === 2) && r.bx < NX - 1) opts.push([1, 0, k === 1 ? 0 : 3]);
      if ((k === 0 || k === 1) && r.bz > 0) opts.push([0, -1, k === 0 ? 3 : 2]);
      if ((k === 2 || k === 3) && r.bz < NZ - 1) opts.push([0, 1, k === 3 ? 0 : 1]);
      if (opts.length) {
        const o = opts[Math.floor(Math.random() * opts.length)];
        r.bx += o[0]; r.bz += o[1]; r.k = o[2];
        return;
      }
    }
    r.k = (r.k + r.dir) & 3;
  }
  scare(x, z, t = 7) {
    if (this.dead || this.kind !== 'civ' || this.state === 'ride') return;
    this.state = 'flee';
    this.flee.t = t; this.flee.x = x; this.flee.z = z;
  }
  hurt(G, dmg, from, cause) {
    if (this.dead) return;
    this.hp -= dmg;
    G.fx.blood(this.x, this.y + 1.2, this.z);
    if (this.kind === 'civ') this.scare(from?.x ?? this.x, from?.z ?? this.z, 9);
    else if (this.state !== 'fly') this.state = 'attack';
    if (this.hp <= 0) this.die(G, from, cause);
    G.onPedHurt?.(this, dmg, from, cause);
  }
  knock(G, vx, vz, vy, dmg, from) {
    if (this.state === 'fly') return;
    if (this.dead && this.state !== 'fly') { this.vx = vx * 0.5; this.vz = vz * 0.5; return; }
    this.vx = vx; this.vz = vz; this.vy = vy; this.state = 'fly'; this.tumble = 0;
    this.hurt(G, dmg, from, 'car');
  }
  die(G, from, cause) {
    this.dead = true; this.hp = 0;
    this.m.gun.visible = false;
    if (this.state !== 'fly') this.state = 'dead';
    G.onPedDeath?.(this, from, cause);
  }
  update(dt, G) {
    if (this.removed) return;
    if (this.state === 'ride') return;
    const P = G.target;
    let wantX = 0, wantZ = 0, speed = 0;
    if (this.state === 'fly') {
      this.vy -= 20 * dt;
      this.x += this.vx * dt; this.z += this.vz * dt; this.y += this.vy * dt;
      this.tumble += dt * 9;
      const g = groundHeight(this.x, this.z);
      if (this.y <= g) {
        this.y = g; this.vx *= 0.4; this.vz *= 0.4;
        if (Math.abs(this.vy) > 3) { this.vy = -this.vy * 0.25; }
        else { this.vy = 0; this.state = this.dead ? 'dead' : this.kind === 'civ' ? 'flee' : 'attack'; this.flee.t = 8; this.flee.x = P.x; this.flee.z = P.z; }
      }
      const hit = collideCircle(this, 0.35, this.y);
      if (hit) { const vn = this.vx * hit.nx + this.vz * hit.nz; if (vn < 0) { this.vx -= hit.nx * vn * 1.5; this.vz -= hit.nz * vn * 1.5; } }
      this.sync(dt);
      return;
    }
    if (this.dead) {
      this.fade += dt;
      this.vx *= 1 - 3 * dt; this.vz *= 1 - 3 * dt;
      this.x += this.vx * dt; this.z += this.vz * dt;
      this.sync(dt);
      return;
    }
    switch (this.state) {
      case 'walk':
      case 'beach': {
        if (this.wait > 0) { this.wait -= dt; break; }
        const t = this.target();
        const dx = t.x - this.x, dz = t.z - this.z, d = Math.hypot(dx, dz);
        if (d < 0.8) {
          if (this.state === 'beach') { this.beachT = null; this.wait = Math.random() < 0.5 ? 2 + Math.random() * 6 : 0; }
          else this.nextCorner();
        } else { wantX = dx / d; wantZ = dz / d; speed = 1.35 * this.speedMul; }
        if ((this.kind === 'cop' || this.kind === 'swat') && G.stars > 0 && Math.hypot(P.x - this.x, P.z - this.z) < 60) this.state = 'attack';
        break;
      }
      case 'flee': {
        this.flee.t -= dt;
        const dx = this.x - this.flee.x, dz = this.z - this.flee.z, d = Math.hypot(dx, dz) || 1;
        wantX = dx / d; wantZ = dz / d; speed = 5.2 * this.speedMul;
        if (this.flee.t <= 0) { this.state = 'walk'; this.joinSidewalk(); }
        break;
      }
      case 'idle':
        if (this.alert || (this.kind === 'thug' && Math.hypot(P.x - this.x, P.z - this.z) < 22)) this.state = 'attack';
        break;
      case 'attack': {
        if ((this.kind === 'cop' || this.kind === 'swat') && G.stars === 0) { this.state = 'walk'; this.joinSidewalk(); this.aim = false; break; }
        const dx = P.x - this.x, dz = P.z - this.z, d = Math.hypot(dx, dz) || 1;
        const arrest = (this.kind === 'cop' && G.stars === 1);
        const range = arrest ? 0.9 : this.weapon === 'smg' ? 16 : 14;
        this.losT = (this.losT || 0) - dt;
        if (this.losT <= 0) { this.losT = 0.4; this.los = segmentClear(this.x, this.z, P.x, P.z, 1.4); }
        if (d > range || !this.los) { wantX = dx / d; wantZ = dz / d; speed = 5.4 * this.speedMul; }
        this.yaw = Math.atan2(dx, dz);
        this.aim = !arrest && d < 40 && this.los;
        if (arrest && d < 1.4 && P.onFoot) G.tryBust(this, dt);
        if (arrest && !P.onFoot && P.speed < 1.2 && d < 3.2) G.tryBust(this, dt);
        if (this.aim) {
          this.fireCd -= dt;
          if (this.fireCd <= 0) {
            this.fireCd = this.weapon === 'smg' ? 0.16 : 0.9 + Math.random() * 0.7;
            if (this.weapon === 'smg' && Math.random() < 0.25) this.fireCd = 0.9;
            G.npcShoot(this, d);
          }
        }
        if (d > 160 && !this.keep) this.removeMe = true;
        break;
      }
      case 'cower':
      case 'script':
        break;
    }
    if (speed > 0) {
      const want = Math.atan2(wantX, wantZ);
      if (this.state !== 'attack') this.yaw += wrap(want - this.yaw) * Math.min(1, dt * 8);
      this.vx += (wantX * speed - this.vx) * Math.min(1, dt * 8);
      this.vz += (wantZ * speed - this.vz) * Math.min(1, dt * 8);
    } else { this.vx *= 1 - Math.min(1, dt * 10); this.vz *= 1 - Math.min(1, dt * 10); }
    this.x += this.vx * dt; this.z += this.vz * dt;
    const hit = collideCircle(this, 0.35, this.y);
    if (hit && this.state === 'flee') { this.flee.x = this.x - hit.nz * 5 - hit.nx * 3; this.flee.z = this.z + hit.nx * 5 - hit.nz * 3; }
    this.y = groundHeight(this.x, this.z);
    this.moving = Math.hypot(this.vx, this.vz);
    this.sync(dt);
  }
  sync(dt = 0) {
    const m = this.m;
    m.root.position.set(this.x, this.y, this.z);
    m.root.rotation.y = this.yaw;
    if (this.state === 'fly') {
      m.body.rotation.x = -this.tumble;
      return;
    }
    if (this.dead) {
      m.body.rotation.x = -Math.PI / 2; m.body.position.y = 0.16;
      m.legL.rotation.x = 0.2; m.legR.rotation.x = -0.1; m.armL.rotation.x = -2.6; m.armR.rotation.x = -0.4;
      return;
    }
    m.body.rotation.x = 0;
    m.gun.visible = !!this.weapon && this.state === 'attack';
    const run = this.moving > 3;
    this.phase += dt * (run ? 11 : 6.5) * Math.min(1, this.moving / 1.2);
    animatePerson(m, this.phase, Math.min(1, this.moving / (run ? 5 : 2.2)) * (run ? 1 : 0.55), this.aim, false);
    if (this.state === 'cower') { m.body.position.y = -0.35; m.armL.rotation.x = m.armR.rotation.x = -2.6; }
  }
  remove(G) { G.scene.remove(this.m.root); this.removed = true; }
}

// A spot to spawn a walker: on a sidewalk loop, or on the sand near the focus.
export function walkerSpot(focus, minD, maxD, inView) {
  for (let tries = 0; tries < 16; tries++) {
    const beach = focus.x > BEACH_X - 80 && Math.random() < 0.35;
    let x, z;
    if (beach) { x = BEACH_X + 10 + Math.random() * (SHORE - BEACH_X - 16); z = clamp(focus.z + (Math.random() - 0.5) * 2 * maxD, 4, CITY_H - 4); }
    else {
      const bx = clamp(Math.floor((focus.x + (Math.random() - 0.5) * 2 * maxD) / PITCH), 0, NX - 1);
      const bz = clamp(Math.floor((focus.z + (Math.random() - 0.5) * 2 * maxD) / PITCH), 0, NZ - 1);
      const r = blockRect(bx, bz), side = Math.floor(Math.random() * 4), t = Math.random();
      x = side < 2 ? r.x0 + 2.2 + t * (r.x1 - r.x0 - 4.4) : side === 2 ? r.x0 + 2.2 : r.x1 - 2.2;
      z = side >= 2 ? r.z0 + 2.2 + t * (r.z1 - r.z0 - 4.4) : side === 0 ? r.z0 + 2.2 : r.z1 - 2.2;
    }
    const d = Math.hypot(x - focus.x, z - focus.z);
    if (d < minD || d > maxD) continue;
    if (inView && d < 70 && inView(x, z)) continue;
    return { x, z };
  }
  return null;
}
