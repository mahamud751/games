// The player on foot (move, sprint, jump, fight, shoot) and at the wheel
// (enter, carjack, drive, horn, radio, bail out), plus shot hit-testing.
import * as THREE from 'three';
import { buildPerson, personLook, animatePerson } from './models.js';
import { collideCircle, groundHeight, rayWorld, SEA_Y, DEEP, clamp } from './city.js';
import { Person } from './people.js';
import { wrap } from './vehicles.js';

export const WEAPONS = {
  fists: { name: 'Fists', melee: true, dmg: 22, rate: 0.42, range: 1.7 },
  bat: { name: 'Bat', melee: true, dmg: 50, rate: 0.6, range: 2.2, price: 60 },
  pistol: { name: 'Pistol', dmg: 34, rate: 0.28, range: 80, spread: 0.008, price: 250, pack: 36 },
  smg: { name: 'SMG', dmg: 17, rate: 0.085, range: 65, spread: 0.028, auto: true, price: 700, pack: 150 },
  shotgun: { name: 'Shotgun', dmg: 15, pellets: 8, rate: 0.85, range: 32, spread: 0.065, price: 1000, pack: 20 }
};
export const ORDER = ['fists', 'bat', 'pistol', 'smg', 'shotgun'];

const _v = new THREE.Vector3();

// Ray against people, cars, the helicopter and the city.
export function castShot(G, o, d, max, skipCar) {
  let best = { t: rayWorld(o.x, o.y, o.z, d.x, d.y, d.z, max), kind: 'world', obj: null };
  for (const p of G.peds) {
    if (p.dead || p.removed || p.state === 'ride') continue;
    const cx = p.x - o.x, cz = p.z - o.z, along = cx * d.x + cz * d.z;
    if (along < 0 || along > best.t + 1) continue;
    for (const h of [0.5, 1.05, 1.5]) {
      const cy = p.y + h - o.y, t = cx * d.x + cy * d.y + cz * d.z;
      if (t < 0 || t > best.t) continue;
      const q = cx * cx + cy * cy + cz * cz - t * t, r = h > 1.4 ? 0.3 : 0.38;
      if (q < r * r) { best = { t: t - Math.sqrt(r * r - q), kind: 'ped', obj: p, head: h > 1.4 }; break; }
    }
  }
  for (const c of G.cars) {
    if (c === skipCar || c.removed) continue;
    const px = o.x - c.x, py = o.y - c.y, pz = o.z - c.z;
    if (px * px + pz * pz > (max + 6) * (max + 6)) continue;
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    const lo = [px * fz - pz * fx, py, px * fx + pz * fz], ld = [d.x * fz - d.z * fx, d.y, d.x * fx + d.z * fz];
    const mn = [-c.t.W / 2, 0.2, -c.t.L / 2], mx = [c.t.W / 2, c.t.H, c.t.L / 2];
    let t0 = 0, t1 = best.t, ok = true;
    for (let k = 0; k < 3 && ok; k++) {
      if (Math.abs(ld[k]) < 1e-6) { if (lo[k] < mn[k] || lo[k] > mx[k]) ok = false; continue; }
      let a = (mn[k] - lo[k]) / ld[k], b = (mx[k] - lo[k]) / ld[k];
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) ok = false;
    }
    if (ok && t0 < best.t) best = { t: t0, kind: 'car', obj: c };
  }
  const h = G.heli;
  if (h && !h.dead) {
    const cx = h.x - o.x, cy = h.y - o.y, cz = h.z - o.z, t = cx * d.x + cy * d.y + cz * d.z;
    const q = cx * cx + cy * cy + cz * cz - t * t;
    if (t > 0 && t < best.t && q < 7) best = { t: t - Math.sqrt(7 - q), kind: 'heli', obj: h };
  }
  best.x = o.x + d.x * best.t; best.y = o.y + d.y * best.t; best.z = o.z + d.z * best.t;
  return best;
}

// Snap a near miss onto a person within a few degrees of the crosshair.
function assist(G, o, d, max, miss) {
  let best = null, bc = 0.9955;
  for (const p of G.peds) {
    if (p.dead || p.removed || p.state === 'ride') continue;
    const cx = p.x - o.x, cy = p.y + 1.1 - o.y, cz = p.z - o.z, l = Math.hypot(cx, cy, cz);
    if (l > Math.min(max, miss.t + 1) || l < 1) continue;
    const c = (cx * d.x + cy * d.y + cz * d.z) / l;
    if (c > bc) { bc = c; best = { t: l, kind: 'ped', obj: p, x: p.x, y: p.y + 1.1, z: p.z }; }
  }
  return best || miss;
}

export class Player {
  constructor(G, save) {
    this.m = buildPerson(personLook('player'));
    G.scene.add(this.m.root);
    this.x = 0; this.z = 0; this.y = 0; this.vx = 0; this.vz = 0; this.vy = 0; this.yaw = 0;
    this.hp = 100; this.armor = save.armor || 0;
    this.has = { fists: true, bat: false, pistol: false, smg: false, shotgun: false, ...save.has };
    this.ammo = { pistol: 0, smg: 0, shotgun: 0, ...save.ammo };
    this.weapon = 'fists';
    this.car = null; this.lastCar = null;
    this.fireCd = 0; this.aimHold = 0; this.punchT = 0;
    this.grounded = true; this.phase = 0; this.moving = 0;
    this.enter = null; this.splashT = 0;
  }
  get onFoot() { return !this.car; }
  get speed() { return this.car ? this.car.speed : Math.hypot(this.vx, this.vz); }
  place(x, z, yaw = 0) {
    this.x = x; this.z = z; this.y = groundHeight(x, z); this.yaw = yaw;
    this.vx = this.vz = this.vy = 0;
    this.m.root.visible = true;
  }
  available() { return ORDER.filter(w => this.has[w] && (WEAPONS[w].melee || this.ammo[w] > 0)); }
  cycle(dir) {
    const list = this.available();
    const i = list.indexOf(this.weapon);
    this.weapon = list[(i + dir + list.length) % list.length] || 'fists';
  }
  give(w, ammo) {
    this.has[w] = true;
    if (ammo) this.ammo[w] = Math.min(999, (this.ammo[w] || 0) + ammo);
    if (this.weapon === 'fists' || this.weapon === 'bat') this.weapon = w;
  }
  stripWeapons() {
    this.has = { fists: true, bat: false, pistol: false, smg: false, shotgun: false };
    this.ammo = { pistol: 0, smg: 0, shotgun: 0 };
    this.weapon = 'fists';
  }
  update(dt, G, I) {
    if (I.wheel) this.cycle(I.wheel > 0 ? 1 : -1);
    if (I.hit('KeyE')) this.cycle(1);
    if (I.hit('KeyQ')) this.cycle(-1);
    ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].forEach((k, i) => { if (I.hit(k) && this.available().includes(ORDER[i])) this.weapon = ORDER[i]; });
    if (this.car) this.drive(dt, G, I);
    else this.walk(dt, G, I);
  }
  // ---------- on foot ----------
  walk(dt, G, I) {
    if (this.enter) return this.entering(dt, G);
    const cy = G.cam.yaw, fx = Math.sin(cy), fz = Math.cos(cy), rx = -fz, rz = fx;
    const mx = I.moveX(), mz = I.moveY();
    let wx = fx * mz + rx * mx, wz = fz * mz + rz * mx;
    const len = Math.hypot(wx, wz);
    if (len > 1) { wx /= len; wz /= len; }
    const w = WEAPONS[this.weapon];
    this.aiming = (I.aim() && !w.melee) || this.aimHold > 0;
    const wade = this.y < SEA_Y - 0.1;
    let sp = this.aiming ? 2.8 : I.sprint() ? 7.4 : 4.4;
    if (wade) sp *= 0.5;
    const acc = this.grounded ? 12 : 2;
    this.vx += (wx * sp - this.vx) * Math.min(1, dt * acc);
    this.vz += (wz * sp - this.vz) * Math.min(1, dt * acc);
    if (I.hit('Space') && this.grounded && !wade) { this.vy = 5.8; this.grounded = false; }
    this.vy -= 18 * dt;
    this.x += this.vx * dt; this.z += this.vz * dt; this.y += this.vy * dt;
    collideCircle(this, 0.38, this.y);
    // cars are solid
    for (const c of G.cars) {
      if (c.removed || Math.abs(c.x - this.x) > 6 || Math.abs(c.z - this.z) > 6) continue;
      const sx = Math.sin(c.yaw), sz = Math.cos(c.yaw), dx = this.x - c.x, dz = this.z - c.z;
      const lx = dx * sz - dz * sx, lz = dx * sx + dz * sz;
      const hw = c.t.W / 2 + 0.38, hl = c.t.L / 2 + 0.38;
      if (Math.abs(lx) >= hw || Math.abs(lz) >= hl) continue;
      if (this.y > c.y + c.t.H - 0.3) { this.y = c.y + c.t.H; this.vy = Math.max(0, this.vy); this.grounded = true; continue; }
      const px = hw - Math.abs(lx), pz = hl - Math.abs(lz);
      let nlx = 0, nlz = 0;
      if (px < pz) nlx = Math.sign(lx) * px; else nlz = Math.sign(lz) * pz;
      this.x += nlx * sz + nlz * sx; this.z += -nlx * sx + nlz * sz;
    }
    const g = groundHeight(this.x, this.z);
    if (this.y <= g) { this.y = g; this.vy = 0; this.grounded = true; }
    else if (this.y > g + 0.05 && this.vy <= 0 && this.grounded && this.y - g < 0.4) this.y = g;
    else if (this.y > g + 0.4) this.grounded = this.grounded && this.vy === 0;
    this.moving = Math.hypot(this.vx, this.vz);
    // facing
    if (this.aiming) this.yaw = cy;
    else if (this.moving > 0.4 && len > 0.05) this.yaw += wrap(Math.atan2(wx, wz) - this.yaw) * Math.min(1, dt * 12);
    // water
    if (wade && this.moving > 1) { this.splashT -= dt; if (this.splashT <= 0) { this.splashT = 0.3; G.fx.splash(this.x, this.z); } }
    if (this.x > DEEP) G.drown();
    // combat
    this.fireCd -= dt; this.aimHold -= dt; this.punchT -= dt;
    if ((w.auto ? I.fire() : I.hit('Mouse0') || (I.fire() && w.melee)) && this.fireCd <= 0) this.fire(G);
    if (I.hit('KeyF') || I.hit('Enter')) this.tryEnter(G);
    this.sync(dt);
  }
  tryEnter(G) {
    let best = null, bd = 4.2;
    for (const c of G.cars) {
      if (c.removed || c.dead || c.flood > 0 || c.burn > 0 || (c.locked && c.driver === 'ai')) continue;
      const d = Math.hypot(c.x - this.x, c.z - this.z) - c.t.L / 2 + 1.2;
      if (d < bd && c.speed < 7) { bd = d; best = c; }
    }
    if (!best) return;
    if (best.driver === 'ai') {
      const door = best.door(0.9);
      const cop = best.t.police;
      const p = new Person(G, cop ? 'cop' : 'civ', door.x, door.z, { state: cop ? 'attack' : 'flee' });
      p.flee.t = 8; p.flee.x = this.x; p.flee.z = this.z;
      G.peds.push(p);
      G.onCarjack(best, cop);
    }
    best.driver = null; best.ai = null; best.siren = false;
    best.ctrl.throttle = 0; best.ctrl.steer = 0; best.ctrl.hb = true;
    this.enter = { car: best, t: 0 };
    G.audio.door();
  }
  entering(dt, G) {
    const e = this.enter, c = e.car;
    e.t += dt;
    const door = c.door(0.6);
    this.x += (door.x - this.x) * Math.min(1, dt * 10);
    this.z += (door.z - this.z) * Math.min(1, dt * 10);
    this.yaw = c.yaw;
    if (c.removed || c.dead) { this.enter = null; return; }
    if (e.t > 0.4) {
      this.enter = null;
      this.car = c; this.lastCar = c;
      c.driver = 'player'; c.ai = null;
      this.m.root.visible = false;
      G.onEnterCar(c);
    }
    this.sync(dt);
  }
  // ---------- driving ----------
  drive(dt, G, I) {
    const c = this.car;
    c.ctrl.throttle = I.moveY();
    c.ctrl.steer = I.steer();
    c.ctrl.hb = I.down('Space');
    if (I.hit('KeyH')) { G.audio.horn(); G.onHorn(c); }
    if (I.hit('KeyR')) G.nextStation();
    if (c.t.police && I.hit('KeyG')) c.siren = !c.siren;
    this.x = c.x; this.z = c.z; this.y = c.y; this.yaw = c.yaw;
    this.fireCd -= dt;
    if (I.hit('KeyF') || I.hit('Enter') || (c.dead && !c.sunk)) this.exitCar(G);
    else if (c.x > DEEP) G.drown();
  }
  exitCar(G) {
    const c = this.car;
    if (!c) return;
    this.car = null;
    c.driver = null; c.ctrl.throttle = 0; c.ctrl.steer = 0; c.ctrl.hb = c.speed < 8;
    let spot = c.door(0.7);
    const p = { x: spot.x, z: spot.z };
    if (collideCircle(p, 0.38, 0)) {
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
      spot = { x: c.x - fz * (c.t.W / 2 + 0.8), z: c.z + fx * (c.t.W / 2 + 0.8) };
    }
    this.place(spot.x, spot.z, c.yaw);
    this.vx = c.vx * 0.4; this.vz = c.vz * 0.4;
    G.onExitCar(c);
  }
  // ---------- combat ----------
  fire(G) {
    const w = WEAPONS[this.weapon];
    this.fireCd = w.rate;
    this.yaw = G.cam.yaw;
    if (w.melee) {
      this.punchT = 0.22;
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      let tgt = null, bd = w.range + 0.4;
      for (const p of G.peds) {
        if (p.dead || p.removed || p.state === 'ride') continue;
        const dx = p.x - this.x, dz = p.z - this.z, d = Math.hypot(dx, dz);
        if (d < bd && (dx * fx + dz * fz) / (d || 1) > 0.4) { bd = d; tgt = p; }
      }
      if (tgt) {
        tgt.vx += fx * 3; tgt.vz += fz * 3;
        tgt.hurt(G, w.dmg, this, 'melee');
        if (!tgt.dead && Math.random() < 0.3 && tgt.kind === 'civ') { tgt.knock(G, fx * 3, fz * 3, 2.5, 0, this); }
        G.audio.punch(true);
      } else G.audio.swing();
      return;
    }
    this.aimHold = 1.4;
    this.ammo[this.weapon]--;
    const cam = G.camera;
    cam.getWorldDirection(_v);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const gun = { x: this.x + fx * 0.55 - fz * 0.3, y: this.y + 1.42, z: this.z + fz * 0.55 + fx * 0.3 };
    const skip = cam.position.distanceTo(new THREE.Vector3(this.x, this.y + 1.5, this.z)) * 0.85;
    const o = { x: cam.position.x + _v.x * skip, y: cam.position.y + _v.y * skip, z: cam.position.z + _v.z * skip };
    const n = w.pellets || 1;
    for (let k = 0; k < n; k++) {
      const s = w.spread * (this.moving > 3 ? 2 : 1);
      const d = { x: _v.x + (Math.random() - 0.5) * 2 * s, y: _v.y + (Math.random() - 0.5) * 2 * s, z: _v.z + (Math.random() - 0.5) * 2 * s };
      const l = Math.hypot(d.x, d.y, d.z); d.x /= l; d.y /= l; d.z /= l;
      let hit = castShot(G, o, d, w.range, null);
      if (hit.kind !== 'ped') hit = assist(G, o, d, w.range, hit);
      G.fx.tracer(gun.x, gun.y, gun.z, hit.x, hit.y, hit.z);
      if (hit.kind === 'ped') {
        hit.obj.vx += d.x * 1.5; hit.obj.vz += d.z * 1.5;
        hit.obj.hurt(G, w.dmg * (hit.head ? 2.5 : 1), this, 'gun');
      } else if (hit.kind === 'car') {
        hit.obj.damage(w.dmg * 0.28, G, 'player');
        G.fx.spark(hit.x, hit.y, hit.z, 3);
        G.onShootCar?.(hit.obj);
      } else if (hit.kind === 'heli') {
        hit.obj.hp -= w.dmg; G.fx.spark(hit.x, hit.y, hit.z, 4);
        G.addHeat(4);
      } else if (hit.t < w.range) { G.fx.spark(hit.x, hit.y, hit.z, 2); G.fx.dust(hit.x, hit.y, hit.z, 1, [0.6, 0.6, 0.6]); }
    }
    G.fx.muzzle(gun.x, gun.y, gun.z);
    G.audio.gun(this.weapon);
    G.onGunfire(this.x, this.z);
    if (this.ammo[this.weapon] <= 0) this.cycle(-1);
  }
  sync(dt) {
    const m = this.m;
    m.root.position.set(this.x, this.y, this.z);
    m.root.rotation.y = this.yaw;
    m.body.rotation.x = 0;
    const run = this.moving > 5;
    this.phase += dt * (run ? 11 : 7.5) * Math.min(1, this.moving / 1.5);
    const amt = this.grounded ? Math.min(1, this.moving / (run ? 6 : 3)) * (run ? 1 : 0.6) : 0.25;
    const ranged = !WEAPONS[this.weapon].melee;
    animatePerson(m, this.phase, amt, this.aiming && ranged, false);
    m.gun.visible = ranged;
    if (this.punchT > 0) m.armR.rotation.x = -Math.PI / 2 * clamp(this.punchT / 0.11, 0, 1.4);
    if (!this.grounded) { m.legL.rotation.x = -0.6; m.legR.rotation.x = 0.3; }
  }
}
