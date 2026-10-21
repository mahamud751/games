'use strict';
/* ---------- A single race: simulation, AI, combat, rendering and HUD ---------- */
const VW = 1280, VH = 720;
const BASE_SPEED = ROAD.segLen * 60;
const MPH = 165 / BASE_SPEED;
const RIDER_W = 300, CRASH_W = 380;
const CAR_W = { sedan: 720, sport: 700, van: 740, truck: 860 };
const FONT = '"Russo One", "Rajdhani", system-ui, sans-serif';
const FONT2 = '"Rajdhani", system-ui, sans-serif';

class Race {
  /* opts: { track, level, bike, mode: 'career'|'quick'|'demo', bikeHP, name } */
  constructor(opts) {
    this.opts = opts;
    this.mode = opts.mode;
    this.demo = opts.mode === 'demo';
    this.level = opts.level;
    this.L = LEVELS[opts.level - 1];
    this.track = new Track(opts.track, opts.level);
    this.theme = this.track.theme;
    this.time = 0;
    this.phase = this.demo ? 'race' : 'countdown';
    this.countdown = 3.6;
    this.endT = 0;
    this.result = null;
    this.msgs = []; this.toasts = []; this.particles = [];
    this.shake = 0; this.flash = 0;
    this.skyOffset = 0; this.camX = 0;
    this.earned = 0;
    this.bumpCd = 0;
    this.stars = Array.from({ length: 140 }, () => [Math.random() * VW, Math.random() * VH * 0.5, Math.random()]);
    this.clouds = Array.from({ length: 7 }, () => [Math.random(), 0.06 + Math.random() * 0.22, 60 + Math.random() * 120]);
    this.makeRiders();
    this.makeTraffic();
    this.copTimers = [];
    for (let i = 0; i < this.L.cops; i++) this.copTimers.push(30 + i * 40 + Math.random() * 15);
    if (this.demo) this.copTimers = [];
  }

  /* ---------- setup ---------- */
  rider(o) {
    return Object.assign({
      x: 0, z: 0, prevZ: 0, speed: 0, lean: 0, stamina: 100, maxStamina: 100, state: 'ride', crashT: 0,
      attackT: 0, attackSide: 0, attackCd: 0, struck: false, invuln: 0, hurtT: 0,
      finished: false, finishTime: 0, kos: 0, nitroLeft: 0, nitroT: 0, screen: null, weapon: 'fist',
      ai: { lane: 0, laneT: 0, pace: 1, paceT: 0, fight: 0, calm: 0, aggro: 0.5 },
    }, o);
  }

  makeRiders() {
    const b = this.opts.bike, L = this.L, sz = this.track.startIndex * ROAD.segLen;
    const pMax = BASE_SPEED * b.top;
    this.player = this.rider({
      isPlayer: true, name: this.opts.name || 'YOU', weapon: 'fist',
      spec: { jacket: '#f97316', helmet: '#fafafa', bike: b.color, nitro: b.nitro > 0 },
      maxSpeed: pMax, accel: pMax / 4.4 * b.accel, handling: b.handling, armor: b.armor,
      bikeHP: this.opts.bikeHP ?? 100, nitroLeft: b.nitro,
    });
    this.player.ai.aggro = 0.6;
    const pool = RIVALS.slice().sort(() => Math.random() - 0.5).slice(0, 7);
    this.rivals = pool.map(rv => {
      const m = BASE_SPEED * L.rival * rv.skill;
      return this.rider({
        name: rv.name, weapon: rv.weapon, spec: { jacket: rv.jacket, helmet: rv.helmet, bike: rv.bike },
        maxSpeed: m, accel: m / 4.2, handling: 1, armor: 1,
        ai: { lane: 0, laneT: 0, pace: 1, paceT: 0, fight: 0, calm: 0, aggro: rv.aggro },
      });
    });
    // starting grid: rows of three, player in the middle of the second row
    const all = this.rivals.slice();
    all.splice(4, 0, this.player);
    all.forEach((r, i) => {
      const row = Math.floor(i / 3), col = i % 3;
      r.z = r.prevZ = sz - row * 420;
      r.x = r.ai.lane = [-0.55, 0, 0.55][col];
    });
    this.riders = all;
    this.cops = [];
  }

  makeTraffic() {
    const types = ['sedan', 'sedan', 'sport', 'van', 'truck'];
    const n = Math.floor(this.track.finishIndex / 52 * this.L.traffic * this.track.def.traffic);
    this.cars = [];
    const startZ = this.track.startIndex * ROAD.segLen;
    for (let i = 0; i < n; i++) {
      const oncoming = Math.random() < 0.42;
      const lane = oncoming ? 0 : (Math.random() < 0.5 ? 1 : 2);
      let z = startZ + 4000 + Math.random() * (this.track.finishZ - startZ);
      const base = oncoming ? -(3200 + Math.random() * 3600) : 2600 + Math.random() * 3600;
      const type = U.pick(types);
      this.cars.push({ z, prevZ: z, x: LANE_X[lane], lane, base, speed: base, type, color: U.pick(CAR_COLORS), front: oncoming, honk: 0 });
    }
  }

  spawnCop() {
    const p = this.player;
    const cop = this.rider({
      isCop: true, name: 'POLICE', weapon: 'baton',
      spec: { jacket: '#1e293b', helmet: '#f8fafc', bike: '#f1f5f9', cop: true },
      maxSpeed: p.maxSpeed * 0.99, accel: BASE_SPEED / 3.6, handling: 1.1, armor: 1.3,
      maxStamina: 140, stamina: 140,
      ai: { lane: 0, laneT: 0, pace: 1, paceT: 0, fight: 0, calm: 0, aggro: 0.75 },
    });
    cop.z = cop.prevZ = Math.max(0, p.z - 3600);
    cop.x = (Math.random() - 0.5) * 1.2;
    cop.speed = Math.max(p.speed, cop.maxSpeed * 0.8);
    this.cops.push(cop);
    this.riders.push(cop);
    this.message('COPS ON YOUR TAIL', 'Don\'t crash near them — or you\'re BUSTED', '#60a5fa');
  }

  /* ---------- helpers ---------- */
  message(text, sub = '', color = '#fff', dur = 2.2) { this.msgs.push({ text, sub, color, t: 0, dur }); if (this.msgs.length > 2) this.msgs.shift(); }
  toast(text, color = '#fde047') { this.toasts.push({ text, color, t: 0 }); if (this.toasts.length > 5) this.toasts.shift(); }
  near(r, dist = 3000) { return Math.abs(r.z - this.player.z) < dist; }
  standings() {
    return this.riders.filter(r => !r.isCop).sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.z - a.z;
    });
  }

  burst(x, y, n, kind, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 380;
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (kind === 'spark' ? 160 : 60),
        life: 0, max: 0.35 + Math.random() * 0.5, kind, color, size: kind === 'smoke' ? 10 + Math.random() * 18 : 2 + Math.random() * 4,
      });
    }
  }

  /* ---------- update ---------- */
  update(dt) {
    this.time += dt;
    const p = this.player;
    if (this.phase === 'countdown') {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      const after = Math.ceil(this.countdown);
      if (after !== before && after > 0 && after <= 3) Sound.fx.beep();
      if (this.countdown <= 0) { this.phase = 'race'; this.time = 0; Sound.fx.go(); this.message('GO!', '', '#4ade80', 1); }
      this.updateFx(dt);
      return;
    }
    if (this.phase === 'race' && !this.demo) {
      this.raceTime = (this.raceTime || 0) + dt;
      this.copTimers = this.copTimers.map(t => t - dt);
      const due = this.copTimers.findIndex(t => t <= 0);
      if (due >= 0) { this.copTimers.splice(due, 1); this.spawnCop(); }
    }

    for (const r of this.riders) {
      r.prevZ = r.z;
      if (r.state === 'crash') { this.crashStep(r, dt); continue; }
      const ctl = (r.isPlayer && !this.demo && !r.finished && this.phase === 'race') ? this.playerControl() : this.aiControl(r, dt);
      this.rideStep(r, ctl, dt);
    }
    this.updateCars(dt);
    this.collisions(dt);

    // finishing
    for (const r of this.riders) {
      if (!r.finished && !r.isCop && r.z >= this.track.finishZ) {
        r.finished = true; r.finishTime = this.raceTime || this.time;
        if (r.isPlayer && !this.demo) this.playerFinished();
      }
    }
    // cops giving up
    for (const c of this.cops) {
      if (c.state === 'ride' && p.z - c.z > 9000 && !c.gone) {
        c.gone = true; this.message('YOU LOST THE COPS', '', '#93c5fd', 1.6);
        this.copTimers.push(30);
      }
    }
    this.cops = this.cops.filter(c => !c.gone);
    this.riders = this.riders.filter(r => !r.gone);

    if (this.demo && p.z > this.track.finishZ - 4000) { // loop the attract mode
      for (const r of this.riders) { r.z -= this.track.finishZ - 8000; r.prevZ = r.z; }
      for (const c of this.cars) { c.z = U.mod(c.z - (this.track.finishZ - 8000), this.track.finishZ); c.prevZ = c.z; }
    }

    if (this.phase === 'over') {
      this.endT += dt;
      if (p.state === 'ride') p.speed = Math.max(0, p.speed - p.maxSpeed * 0.35 * dt);
    }
    this.updateFx(dt);
  }

  playerControl() {
    return {
      left: Input.left, right: Input.right, gas: Input.up, brake: Input.downKey,
      nitro: Input.hit('Space', 'ShiftLeft', 'ShiftRight', 'KeyN'),
      atkL: Input.down('KeyZ', 'KeyJ', 'KeyQ'), atkR: Input.down('KeyX', 'KeyK', 'KeyE'),
    };
  }

  aiControl(r, dt) {
    const ai = r.ai, p = this.player, seg = this.track.seg(r.z);
    const ctl = {};
    ai.paceT -= dt; ai.calm -= dt;
    if (ai.paceT <= 0) { ai.pace = r.isPlayer ? 0.97 : 0.92 + Math.random() * 0.08; ai.paceT = 3 + Math.random() * 4; }
    let tSpeed = r.maxSpeed * ai.pace * (1 - Math.min(0.12, Math.abs(seg.curve) * 0.014));
    if (this.phase === 'countdown') tSpeed = 0;
    if (r.isPlayer && (r.finished || this.phase === 'over')) tSpeed = this.demo ? tSpeed : 0;

    // rubber band against the player so races stay close
    if (!r.isCop && !r.isPlayer && !this.demo && !r.finished) {
      const gap = r.z - p.z;
      if (gap > 2500) tSpeed *= U.clamp(1 - (gap - 2500) / 50000, 0.86, 1);
      else if (gap < -3500) tSpeed = Math.min(r.maxSpeed * 1.12, Math.max(tSpeed, p.speed * 1.04));
    }

    ai.laneT -= dt;
    if (ai.laneT <= 0) { ai.lane = U.pick([-0.62, -0.3, 0, 0.3, 0.62]); ai.laneT = 2 + Math.random() * 4; }
    let wantX = ai.lane;

    // pick a fight
    let target = null;
    if (r.isCop && p.state === 'crash' && this.phase === 'race') { wantX = p.x; tSpeed = U.clamp((p.z - r.z) * 1.5, 0, r.maxSpeed); }
    if (r.isCop) target = (p.state === 'ride' && !p.finished && this.phase === 'race') ? p : null;
    else if (ai.calm <= 0 && this.phase === 'race' && !r.finished && (this.raceTime || 0) > 8) {
      let best = 600;
      for (const o of this.riders) {
        if (o === r || o.state !== 'ride' || o.finished || o.isCop) continue;
        const d = Math.abs(o.z - r.z) + Math.abs(o.x - r.x) * 300 - (o.isPlayer ? 250 : 0);
        if (d < best && Math.abs(o.x - r.x) < 1.1) { best = d; target = o; }
      }
      if (target && Math.random() > ai.aggro + 0.25) target = null;
    }
    if (target) {
      ai.fight += dt;
      if (!r.isCop && ai.fight > 7) { ai.fight = 0; ai.calm = 5 + Math.random() * 5; }
      const side = Math.sign(target.x - r.x) || (Math.random() < 0.5 ? -1 : 1);
      const reach = WEAPONS[r.weapon].reach;
      wantX = target.x - side * reach * 0.6;
      const dz = r.z - target.z;
      tSpeed = U.clamp(target.speed - dz * 2.2, 0, r.maxSpeed * (r.isCop ? 1 : 1.04));
      const dx = Math.abs(target.x - r.x);
      if (Math.abs(dz) < 220 && dx < reach * 0.95 && dx > 0.05 && r.attackCd <= 0 && Math.random() < dt * (target.isPlayer ? 1.1 : 1.6) * ai.aggro) {
        if (side < 0) ctl.atkL = true; else ctl.atkR = true;
      }
    } else ai.fight = Math.max(0, ai.fight - dt);

    // traffic avoidance
    let blockedAhead = false;
    for (const c of this.cars) {
      const dz = c.z - r.z;
      if (dz < 0 || dz > 2600) continue;
      const closing = r.speed - c.speed;
      if (closing <= 0 || dz > 300 + closing * 0.9) continue;
      if (Math.abs(c.x - wantX) < 0.42 || Math.abs(c.x - r.x) < 0.38) {
        const opts = [-0.82, -0.33, 0.33, 0.82].filter(cand => !this.cars.some(o => {
          const d = o.z - r.z; return d > -150 && d < 300 + Math.max(0, r.speed - o.speed) * 0.9 && Math.abs(o.x - cand) < 0.42;
        }));
        if (opts.length) { opts.sort((a, b) => Math.abs(a - r.x) - Math.abs(b - r.x)); wantX = opts[0]; ai.lane = wantX; ai.laneT = 1.5; }
        else blockedAhead = true;
        break;
      }
    }
    if (blockedAhead) tSpeed = Math.min(tSpeed, r.speed * 0.8);

    wantX = U.clamp(wantX, -0.88, 0.88);
    const dx = wantX - r.x;
    ctl.left = dx < -0.03; ctl.right = dx > 0.03;
    ctl.gas = r.speed < tSpeed;
    ctl.brake = r.speed > tSpeed * 1.15;
    if (r.isPlayer && this.demo && r.nitroLeft > 0 && Math.random() < dt * 0.05) ctl.nitro = true;
    return ctl;
  }

  rideStep(r, ctl, dt) {
    const seg = this.track.seg(r.z);
    const pct = r.speed / r.maxSpeed;
    const boosting = r.nitroT > 0;
    const top = r.maxSpeed * (boosting ? 1.32 : 1);
    const steer = dt * 2.3 * Math.min(1, pct * 1.6 + 0.25) * r.handling;
    if (ctl.left) r.x -= steer;
    if (ctl.right) r.x += steer;
    if (r.isPlayer && !this.demo && !r.finished) r.x -= dt * 2 * pct * pct * seg.curve * 0.3;
    const leanT = ((ctl.right ? 1 : 0) - (ctl.left ? 1 : 0)) * 0.24 * Math.min(1, pct * 2);
    r.lean += (leanT - r.lean) * Math.min(1, dt * 7);

    if (this.phase === 'countdown') { r.speed = 0; }
    else if (ctl.gas) r.speed += r.accel * (boosting ? 2 : 1) * (1 - Math.max(0, pct - 0.85) * 2) * dt;
    else if (ctl.brake) r.speed -= r.maxSpeed * 1.1 * dt;
    else r.speed -= r.maxSpeed * 0.2 * dt;
    if (boosting) r.speed += r.accel * 0.6 * dt;
    if (r.speed > top) r.speed -= (r.speed - top) * Math.min(1, dt * 1.5);

    r.offroad = Math.abs(r.x) > 1.06;
    if (r.offroad && r.speed > r.maxSpeed * 0.32) r.speed -= r.maxSpeed * 0.95 * dt;
    r.speed = U.clamp(r.speed, 0, r.maxSpeed * 1.4);
    r.x = U.clamp(r.x, -2.8, 2.8);
    r.z += r.speed * dt;

    if (ctl.nitro && r.nitroLeft > 0 && r.nitroT <= 0) {
      r.nitroLeft--; r.nitroT = 3.2;
      if (r.isPlayer && !this.demo) { Sound.fx.nitro(); this.toast('NITRO!', '#38bdf8'); this.shake = Math.max(this.shake, 6); }
    }
    r.nitroT -= dt;
    r.invuln -= dt; r.hurtT -= dt;
    if (r.hurtT < -3) r.stamina = Math.min(r.maxStamina, r.stamina + dt * (r.isPlayer ? 4 : 2));

    // combat
    r.attackCd -= dt;
    if ((ctl.atkL || ctl.atkR) && r.attackT <= 0 && r.attackCd <= 0) {
      r.attackSide = ctl.atkL ? -1 : 1; r.attackT = 0.34; r.attackCd = 0.55; r.struck = false;
      if (r.isPlayer && !this.demo) Sound.fx.whoosh();
    }
    if (r.attackT > 0) {
      r.attackT -= dt;
      if (!r.struck && r.attackT < 0.2) { r.struck = true; this.strike(r); }
    }
  }

  strike(a) {
    const w = WEAPONS[a.weapon];
    let best = null, bestD = 1e9;
    for (const t of this.riders) {
      if (t === a || t.state !== 'ride' || t.invuln > 0 || t.finished) continue;
      if (a.isCop && !t.isPlayer) continue;
      const dz = Math.abs(t.z - a.z), side = (t.x - a.x) * a.attackSide;
      if (dz < 250 && side > 0.03 && side < w.reach) {
        const d = dz + side * 200;
        if (d < bestD) { bestD = d; best = t; }
      }
    }
    if (!best) return;
    const dmg = w.dmg * (0.85 + Math.random() * 0.3) / (best.armor || 1) * (best.isPlayer ? 0.6 : 1);
    best.stamina -= dmg; best.hurtT = 0.25;
    best.x += a.attackSide * 0.09;
    best.speed *= 0.97;
    const involved = a.isPlayer || best.isPlayer;
    if (involved && !this.demo) {
      ({ fist: Sound.fx.punch, club: Sound.fx.club, chain: Sound.fx.chain, baton: Sound.fx.club })[a.weapon]();
      const s = best.screen;
      if (s) this.burst(s.x + (a.attackSide > 0 ? -s.w * 0.3 : s.w * 0.3), s.y - s.h * 0.6, 10, 'spark', '#fde047');
      if (best.isPlayer) { this.shake = Math.max(this.shake, 10); this.flash = 0.35; }
      else this.shake = Math.max(this.shake, 4);
    }
    if (best.stamina <= 0) this.crash(best, 'ko', a);
  }

  crash(r, cause, by) {
    if (r.state === 'crash') return;
    r.state = 'crash'; r.crashT = 0; r.attackT = 0; r.nitroT = 0;
    r.crashDir = Math.sign(r.x) || 1;
    const p = this.player, show = !this.demo && this.near(r, 2500);
    if (show) {
      Sound.fx.crash();
      if (r.screen) { this.burst(r.screen.x, r.screen.y - 20, 18, 'spark', '#fbbf24'); this.burst(r.screen.x, r.screen.y - 10, 8, 'smoke', '#94a3b8'); }
    }
    if (r.isPlayer && !this.demo) {
      this.shake = 18; this.flash = 0.5;
      const dmg = { car: 20, scenery: 13, ko: 6, bump: 4 }[cause] / (r.armor || 1);
      r.bikeHP = Math.max(0, r.bikeHP - dmg);
      const label = { car: 'TOTALLED BY TRAFFIC', scenery: 'WIPEOUT', ko: by ? `KNOCKED OFF BY ${by.name.toUpperCase()}` : 'KNOCKED OFF' }[cause] || 'CRASH';
      this.message(label, `Bike condition ${Math.round(r.bikeHP)}%`, '#f87171');
      if (this.phase === 'race') {
        if (r.bikeHP <= 0) this.endRace('wrecked');
        else if (this.cops.some(c => c.state === 'ride' && Math.abs(c.z - r.z) < 3000)) this.toast('Get up before the cop reaches you!', '#93c5fd');
      }
    }
    if (by && by.isPlayer && !r.isPlayer && !this.demo) {
      p.kos++;
      const bonus = (r.isCop ? 400 : 120) * this.L.prize;
      this.earned += bonus;
      Sound.fx.ko();
      this.message(r.isCop ? 'COP DOWN!' : 'KNOCKOUT!', r.name, r.isCop ? '#60a5fa' : '#fde047', 1.6);
      this.toast(`+${U.money(bonus)} KO bonus`, '#4ade80');
      if (WEAPONS[r.weapon].dmg > WEAPONS[p.weapon].dmg && !r.isCop) {
        p.weapon = r.weapon; r.weapon = 'fist';
        this.toast(`Grabbed the ${WEAPONS[p.weapon].name.toUpperCase()}!`, '#f0abfc');
      }
      if (r.isCop) this.copTimers.push(30);
    }
    if (r.isCop && by && by.isPlayer) r.copDown = true;
  }

  crashStep(r, dt) {
    r.crashT += dt;
    if (r.isPlayer && !this.demo && this.phase === 'race' && this.cops.some(c => c.state === 'ride' && Math.abs(c.z - r.z) < 260)) this.endRace('busted');
    r.speed = Math.max(0, r.speed - r.speed * 2.6 * dt - 400 * dt);
    r.z += r.speed * dt;
    r.x += r.crashDir * r.speed / BASE_SPEED * dt * 0.8;
    if (r.crashT > (r.isPlayer ? 1.9 : 2.8)) {
      if (r.copDown) { r.gone = true; return; }
      r.state = 'ride'; r.speed = 0; r.lean = 0;
      r.x = U.clamp(r.x, -0.8, 0.8);
      r.stamina = r.maxStamina * (r.isPlayer ? 0.7 : 0.6);
      r.invuln = 2;
    }
  }

  updateCars(dt) {
    const fz = this.track.finishZ;
    this.laneSortT = (this.laneSortT || 0) - dt;
    if (this.laneSortT <= 0) {
      this.laneSortT = 0.2;
      for (const lane of [0, 1, 2]) {
        const list = this.cars.filter(c => c.lane === lane).sort((a, b) => a.z - b.z);
        for (let i = 0; i < list.length; i++) {
          const c = list[i], ahead = c.front ? list[i - 1] : list[i + 1];
          c.speed = c.base;
          if (ahead && Math.abs(ahead.z - c.z) < 900 && Math.abs(ahead.speed) < Math.abs(c.base)) c.speed = ahead.speed;
        }
      }
    }
    const p = this.player;
    for (const c of this.cars) {
      c.prevZ = c.z;
      c.z += c.speed * dt;
      if (c.z > fz) { c.z -= fz - 2000; c.prevZ = c.z; }
      if (c.z < 2000) { c.z += fz - 2000; c.prevZ = c.z; }
      c.honk -= dt;
      if (!this.demo && c.front && c.honk <= 0 && p.state === 'ride') {
        const dz = c.z - p.z;
        if (dz > 0 && dz < 1500 && Math.abs(c.x - p.x) < 0.3) { Sound.fx.horn(); c.honk = 4; }
      }
    }
  }

  collisions(dt) {
    const riders = this.riders, segs = this.track;
    this.bumpCd -= dt;
    for (const r of riders) {
      if (r.state !== 'ride') continue;
      const hw = 0.07;
      // traffic
      for (const c of this.cars) {
        if (Math.abs(c.z - r.z) > 1500) continue;
        const cw = CAR_W[c.type] / ROAD.width / 2;
        if (Math.abs(c.x - r.x) > cw + hw) continue;
        const relPrev = c.prevZ - r.prevZ, relNow = c.z - r.z;
        if (Math.min(relPrev, relNow) < 170 && Math.max(relPrev, relNow) > -50) {
          if (r.invuln > 0) continue;
          const closing = r.speed - c.speed;
          if (closing > 2600 || c.front) { this.crash(r, 'car'); }
          else {
            r.speed = Math.max(0, c.speed * 0.7);
            r.x += (Math.sign(r.x - c.x) || 1) * 0.06;
            if (r.isPlayer && !this.demo) { Sound.fx.bump(); r.stamina -= 6; this.shake = 6; if (r.stamina <= 0) this.crash(r, 'car'); }
          }
          break;
        }
      }
      if (r.state !== 'ride') continue;
      // roadside objects
      if (Math.abs(r.x) > 1.05) {
        for (const s of segs.seg(r.z + 60).sprites) {
          const def = Sprites.SCENERY[s.kind];
          if (!def.collide) continue;
          const sw = def.w / ROAD.width * (s.kind === 'building' ? 0.9 : 0.42);
          if (U.overlap(r.x, hw * 2, s.offset, sw)) { this.crash(r, 'scenery'); break; }
        }
        if (r.state !== 'ride') continue;
        if (r.isPlayer && r.speed > 2000 && Math.random() < 0.6 && r.screen) this.particles.push({ x: r.screen.x + (Math.random() - 0.5) * 30, y: r.screen.y - 4, vx: (Math.random() - 0.5) * 200, vy: -80 - Math.random() * 120, life: 0, max: 0.6, kind: 'smoke', color: this.theme.grass[0], size: 8 + Math.random() * 10 });
      }
    }
    // rider bumps
    for (let i = 0; i < riders.length; i++) for (let j = i + 1; j < riders.length; j++) {
      const a = riders[i], b = riders[j];
      if (a.state !== 'ride' || b.state !== 'ride') continue;
      if (Math.abs(a.z - b.z) < 110 && Math.abs(a.x - b.x) < 0.15) {
        const s = Math.sign(a.x - b.x) || 1;
        a.x += s * 0.035; b.x -= s * 0.035;
        const back = a.z < b.z ? a : b; back.speed *= 0.96;
        if ((a.isPlayer || b.isPlayer) && this.bumpCd <= 0 && !this.demo) { Sound.fx.bump(); this.bumpCd = 0.3; }
      }
    }
  }

  playerFinished() {
    const p = this.player;
    const st = this.standings();
    p.place = st.indexOf(p) + 1;
    const prize = Math.round((PRIZES[p.place - 1] || 0) * this.L.prize);
    this.earned += prize;
    this.message(p.place === 1 ? 'YOU WIN!' : `${p.place}${U.ordinal(p.place)} PLACE`, p.place <= 3 ? 'Qualified!' : 'Did not qualify — top 3 needed', p.place <= 3 ? '#4ade80' : '#fbbf24', 3.5);
    if (prize) { this.toast(`+${U.money(prize)} prize`, '#4ade80'); Sound.fx.cash(); }
    this.endRace('finished');
  }

  endRace(kind) {
    if (this.phase === 'over') return;
    this.phase = 'over'; this.endKind = kind;
    if (kind === 'busted') { Sound.fx.bust(); this.message('BUSTED!', `Fine: ${U.money(this.fine())}`, '#60a5fa', 4); }
    if (kind === 'wrecked') this.message('BIKE WRECKED', 'Your ride is scrap metal', '#f87171', 4);
  }
  fine() { return 600 * this.level; }

  get finishedResult() {
    if (this.phase !== 'over' || this.endT < 3.6) return null;
    const p = this.player, st = this.standings();
    const rows = st.map(r => ({
      name: r.isPlayer ? (this.opts.name || 'YOU') : r.name, isPlayer: !!r.isPlayer, color: r.spec.jacket,
      time: r.finished ? r.finishTime : null,
    }));
    return { kind: this.endKind, place: p.place || null, earned: Math.round(this.earned), kos: p.kos, bikeHP: p.bikeHP, rows, time: p.finished ? p.finishTime : null, fine: this.endKind === 'busted' ? this.fine() : 0 };
  }

  updateFx(dt) {
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt);
    for (const m of this.msgs) m.t += dt;
    this.msgs = this.msgs.filter(m => m.t < m.dur);
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter(t => t.t < 2.4);
    for (const q of this.particles) {
      q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.kind === 'spark') q.vy += 900 * dt; else { q.vx *= 0.96; q.vy *= 0.96; q.size += dt * 20; }
    }
    this.particles = this.particles.filter(q => q.life < q.max);
    // engine & siren
    if (!this.demo) {
      const p = this.player;
      Sound.engineSet(p.speed / p.maxSpeed, this.phase === 'countdown' ? Input.up : (p.state === 'ride' && Input.up), p.nitroT > 0);
      let s = 0;
      for (const c of this.cops) if (c.state === 'ride') s = Math.max(s, 1 - Math.abs(c.z - p.z) / 6000);
      Sound.sirenSet(Math.max(0, s));
    }
  }

  /* ---------- rendering ---------- */
  project(pt, camX, camY, camZ) {
    pt.camera.x = -camX; pt.camera.y = pt.world.y - camY; pt.camera.z = pt.world.z - camZ;
    const s = pt.screen.scale = ROAD.depth / pt.camera.z;
    pt.screen.x = Math.round(VW / 2 + s * pt.camera.x * VW / 2);
    pt.screen.y = Math.round(VH / 2 - s * pt.camera.y * VH / 2);
    pt.screen.w = Math.round(s * ROAD.width * VW / 2);
  }

  render(g) {
    const p = this.player, tr = this.track, segs = tr.segments, th = this.theme;
    const position = Math.max(0, p.z - ROAD.playerZ);
    const base = tr.seg(position), basePct = (position % ROAD.segLen) / ROAD.segLen;
    const pSeg = tr.seg(p.z), pPct = (p.z % ROAD.segLen) / ROAD.segLen;
    const playerY = U.lerp(pSeg.p1.world.y, pSeg.p2.world.y, pPct);
    this.camX += (p.x * ROAD.width - this.camX) * 0.25;
    this.skyOffset += pSeg.curve * (p.z - (this.lastZ ?? p.z)) / ROAD.segLen * 0.0016;
    this.lastZ = p.z;

    g.save();
    if (this.shake > 0) g.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    g.translate(VW / 2, VH); g.rotate(-p.lean * 0.1); g.translate(-VW / 2, -VH);
    this.drawBackground(g, playerY);

    // collect entities into the segments they occupy
    const drawn = [];
    for (let n = 0; n < ROAD.draw; n++) { const s = segs[base.index + n]; if (!s) break; s.ents.length = 0; drawn.push(s); }
    const zMin = position, zMax = position + ROAD.draw * ROAD.segLen;
    const last = base.index + drawn.length;
    const place = e => { if (e.z >= zMin && e.z < zMax) { const s = tr.seg(e.z); if (s.index >= base.index && s.index < last) s.ents.push(e); } };
    this.riders.forEach(place); this.cars.forEach(place);

    let maxy = VH, x = 0, dx = -(base.curve * basePct);
    for (let n = 0; n < drawn.length; n++) {
      const s = drawn[n];
      s.fog = U.expFog(n / ROAD.draw, ROAD.fog);
      s.clip = maxy;
      this.project(s.p1, this.camX - x, playerY + ROAD.camH, position);
      this.project(s.p2, this.camX - x - dx, playerY + ROAD.camH, position);
      x += dx; dx += s.curve;
      if (s.p1.camera.z <= ROAD.depth || s.p2.screen.y >= s.p1.screen.y || s.p2.screen.y >= maxy) { s.skip = true; continue; }
      s.skip = false;
      this.drawSegment(g, s);
      maxy = s.p1.screen.y;
    }
    if (th.night) this.drawHeadlight(g, p);
    // back to front: scenery, banners, riders, cars
    for (let n = drawn.length - 1; n > 0; n--) {
      const s = drawn[n];
      if (s.p1.camera.z <= ROAD.depth) continue;
      const fade = U.clamp((drawn.length - n) / 30, 0, 1);
      g.globalAlpha = fade;
      for (const sp of s.sprites) {
        const img = Sprites.scenery(sp.kind, sp.variant, th.night);
        const sc = s.p1.screen.scale;
        const sx = s.p1.screen.x + sc * sp.offset * ROAD.width * VW / 2;
        this.drawSprite(g, img, img.worldW, sc, sx, s.p1.screen.y, s.clip, 0, sp.flip);
      }
      if (s.banner) this.drawBanner(g, s);
      if (s.ents.length > 1) s.ents.sort((a, b) => b.z - a.z);
      for (const e of s.ents) this.drawEntity(g, e, s);
      g.globalAlpha = 1;
    }
    g.globalAlpha = 1;
    this.drawParticles(g);
    if (p.nitroT > 0 || p.speed > p.maxSpeed * 0.97) this.drawSpeedLines(g, p.nitroT > 0 ? 1 : 0.4);
    g.restore();

    // vignette + hurt flash
    const vg = g.createRadialGradient(VW / 2, VH / 2, VH * 0.45, VW / 2, VH / 2, VH * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = vg; g.fillRect(0, 0, VW, VH);
    if (this.flash > 0) { g.fillStyle = `rgba(239,68,68,${this.flash * 0.5})`; g.fillRect(0, 0, VW, VH); }
    if (!this.demo) this.drawHUD(g);
  }

  drawBackground(g, playerY) {
    const th = this.theme;
    if (!this.skyGrad) {
      this.skyGrad = g.createLinearGradient(0, 0, 0, VH / 2 + 40);
      th.sky.forEach((c, i) => this.skyGrad.addColorStop(i / (th.sky.length - 1), c));
    }
    g.fillStyle = this.skyGrad; g.fillRect(-60, -60, VW + 120, VH / 2 + 120);
    if (th.stars) for (const [x, y, b] of this.stars) {
      g.fillStyle = `rgba(255,255,255,${0.3 + 0.7 * Math.abs(Math.sin(this.time * (1 + b) + b * 9)) * b})`;
      g.fillRect(x, y, 2, 2);
    }
    if (th.sun) {
      const sx = U.mod(VW * 0.5 - this.skyOffset * 700, VW * 1.8) - VW * 0.4, sy = VH * th.sunY * 0.62;
      const glow = g.createRadialGradient(sx, sy, th.sunR * 0.4, sx, sy, th.sunR * 4);
      glow.addColorStop(0, U.rgba(th.sun, 0.55)); glow.addColorStop(1, U.rgba(th.sun, 0));
      g.fillStyle = glow; g.fillRect(sx - th.sunR * 4, sy - th.sunR * 4, th.sunR * 8, th.sunR * 8);
      g.save(); g.beginPath(); g.arc(sx, sy, th.sunR, 0, Math.PI * 2); g.clip();
      const sg = g.createLinearGradient(0, sy - th.sunR, 0, sy + th.sunR);
      sg.addColorStop(0, th.sun); sg.addColorStop(1, this.track.def.theme === 'coast' ? '#fb7185' : th.sun);
      g.fillStyle = sg; g.fillRect(sx - th.sunR, sy - th.sunR, th.sunR * 2, th.sunR * 2);
      if (this.track.def.theme === 'coast' || this.track.def.theme === 'desert') {
        g.fillStyle = th.sky[2];
        for (let i = 0; i < 6; i++) g.fillRect(sx - th.sunR, sy + i * 11 + 4, th.sunR * 2, 2 + i * 1.4);
      }
      g.restore();
    }
    if (th.clouds) for (const [cx, cy, w] of this.clouds) {
      const x = U.mod(cx * VW * 1.6 - this.skyOffset * 400 + this.time * 6, VW * 1.6) - VW * 0.3, y = cy * VH;
      g.fillStyle = 'rgba(255,255,255,0.55)';
      for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(x + k * w * 0.35, y + Math.sin(k * 2) * 6, w * 0.4, w * 0.16, 0, 0, Math.PI * 2); g.fill(); }
    }
    const L = this.track.layers, horizon = VH / 2 + 34;
    const layer = (c, speed, yk) => {
      const ox = -U.mod(this.skyOffset * speed * L.LW, L.LW);
      const y = horizon - L.LH + playerY * yk;
      g.drawImage(c, ox, y); g.drawImage(c, ox + L.LW, y);
    };
    layer(L.far, 1, 0.0012);
    layer(L.near, 2, 0.0025);
    g.fillStyle = th.fog; g.fillRect(-60, horizon - 1, VW + 120, VH);
  }

  drawSegment(g, s) {
    const th = this.theme, { p1, p2 } = s;
    const x1 = p1.screen.x, y1 = p1.screen.y + 1, w1 = p1.screen.w, x2 = p2.screen.x, y2 = p2.screen.y, w2 = p2.screen.w;
    const poly = (ax, ay, bx, by, cx, cy, dx, dy, col) => {
      g.fillStyle = col; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(cx, cy); g.lineTo(dx, dy); g.closePath(); g.fill();
    };
    g.fillStyle = th.grass[s.dark]; g.fillRect(-60, y2, VW + 120, y1 - 1 - y2);
    const r1 = w1 / 7, r2 = w2 / 7;
    poly(x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2, th.rumble[s.dark]);
    poly(x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2, th.rumble[s.dark]);
    poly(x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, th.road[s.dark]);
    // edge lines
    const e1 = w1 / 40, e2 = w2 / 40;
    poly(x1 - w1 + e1, y1, x1 - w1 + e1 * 2.2, y1, x2 - w2 + e2 * 2.2, y2, x2 - w2 + e2, y2, 'rgba(255,255,255,0.7)');
    poly(x1 + w1 - e1, y1, x1 + w1 - e1 * 2.2, y1, x2 + w2 - e2 * 2.2, y2, x2 + w2 - e2, y2, 'rgba(255,255,255,0.7)');
    if (s.checker) {
      const n = 16;
      for (let i = 0; i < n; i++) for (let row = 0; row < 2; row++) {
        if ((i + row) % 2) continue;
        const ya = U.lerp(y1, y2, row / 2), yb = U.lerp(y1, y2, (row + 1) / 2), wa = U.lerp(w1, w2, row / 2), wb = U.lerp(w1, w2, (row + 1) / 2);
        const xa = U.lerp(x1, x2, row / 2), xb = U.lerp(x1, x2, (row + 1) / 2);
        poly(xa - wa + 2 * wa * i / n, ya, xa - wa + 2 * wa * (i + 1) / n, ya, xb - wb + 2 * wb * (i + 1) / n, yb, xb - wb + 2 * wb * i / n, yb, '#f8fafc');
      }
    } else if (s.grid) {
      poly(x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, 'rgba(255,255,255,0.85)');
    } else if (s.dark) {
      const l1 = w1 / 34, l2 = w2 / 34, lw1 = 2 * w1 / ROAD.lanes, lw2 = 2 * w2 / ROAD.lanes;
      let lx1 = x1 - w1 + lw1, lx2 = x2 - w2 + lw2;
      for (let l = 1; l < ROAD.lanes; l++, lx1 += lw1, lx2 += lw2) poly(lx1 - l1 / 2, y1, lx1 + l1 / 2, y1, lx2 + l2 / 2, y2, lx2 - l2 / 2, y2, th.lane);
    }
    if (s.fog < 1) {
      g.globalAlpha = 1 - s.fog; g.fillStyle = th.fog; g.fillRect(-60, y2, VW + 120, y1 - 1 - y2); g.globalAlpha = 1;
    }
  }

  drawHeadlight(g, p) {
    if (!p.screen) return;
    g.save(); g.globalCompositeOperation = 'lighter';
    const x = p.screen.x, y = p.screen.y - p.screen.h * 0.4;
    const gr = g.createRadialGradient(x, y - 120, 10, x, y - 120, 320);
    gr.addColorStop(0, 'rgba(255,240,200,0.22)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x - 30, y); g.lineTo(x - 360, VH / 2 + 30); g.lineTo(x + 360, VH / 2 + 30); g.lineTo(x + 30, y); g.fill();
    g.restore();
  }

  drawSprite(g, img, worldW, scale, x, y, clipY, lean, flip) {
    const destW = worldW * scale * VW / 2, destH = destW * img.h / img.w;
    if (destW < 1 || destW > VW * 3) return;
    const clipH = clipY ? Math.max(0, y - clipY) : 0;
    if (clipH >= destH) return;
    const srcH = img.h * (1 - clipH / destH);
    g.save();
    g.translate(x, y);
    if (lean) g.rotate(lean);
    if (flip) g.scale(-1, 1);
    g.drawImage(img.c, 0, 0, img.w, srcH, -destW / 2, -destH, destW, destH - clipH);
    g.restore();
    return { w: destW, h: destH };
  }

  drawBanner(g, s) {
    const sc = s.p1.screen.scale, px = sc * VW / 2, y = s.p1.screen.y;
    const xl = s.p1.screen.x - s.p1.screen.w * 1.22, xr = s.p1.screen.x + s.p1.screen.w * 1.22;
    const ph = 1300 * px, pw = Math.max(2, 50 * px), bh = 230 * px;
    if (y - ph > s.clip) return;
    g.fillStyle = '#e5e7eb'; g.fillRect(xl - pw / 2, y - ph, pw, ph); g.fillRect(xr - pw / 2, y - ph, pw, ph);
    const finish = s.banner === 'FINISH';
    g.fillStyle = finish ? '#0f172a' : '#b91c1c'; g.fillRect(xl, y - ph, xr - xl, bh);
    if (finish) {
      const n = 24, cw = (xr - xl) / n;
      for (let i = 0; i < n; i++) for (let r = 0; r < 2; r++) if ((i + r) % 2) { g.fillStyle = '#f8fafc'; g.fillRect(xl + i * cw, y - ph + r * bh / 6, cw + 0.5, bh / 6); }
    }
    if (bh > 8) {
      g.fillStyle = '#fff'; g.font = `${Math.round(bh * 0.5)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(s.banner, (xl + xr) / 2, y - ph + bh * (finish ? 0.62 : 0.5));
      g.textBaseline = 'alphabetic';
    }
  }

  drawEntity(g, e, s) {
    const pct = (e.z % ROAD.segLen) / ROAD.segLen;
    const sc = U.lerp(s.p1.screen.scale, s.p2.screen.scale, pct);
    const x = U.lerp(s.p1.screen.x, s.p2.screen.x, pct) + sc * e.x * ROAD.width * VW / 2;
    const y = U.lerp(s.p1.screen.y, s.p2.screen.y, pct);
    if (e.type) {   // car
      const img = Sprites.car(e.type, e.color, e.front);
      this.drawSprite(g, img, CAR_W[e.type], sc, x, y, s.clip);
      return;
    }
    if (e.invuln > 0 && e.state === 'ride' && Math.floor(this.time * 12) % 2) { e.screen = null; return; }
    let img, w = RIDER_W, lean = 0;
    if (e.state === 'crash') { img = Sprites.crashed(e.spec); w = CRASH_W; }
    else {
      const pose = e.attackT > 0 ? (e.attackSide < 0 ? 'L' : 'R') : 'ride';
      img = Sprites.rider(Object.assign({ pose, weapon: e.weapon, flash: Math.floor(this.time * 7) % 2, nitro: e.nitroT > 0 }, e.spec));
      lean = e.lean + (e.hurtT > 0 ? Math.sin(this.time * 60) * 0.06 : 0);
    }
    const dim = this.drawSprite(g, img, w, sc, x, y, s.clip, lean, e.state === 'crash' && e.crashDir < 0);
    if (!dim) { e.screen = null; return; }
    e.screen = { x, y, w: dim.w, h: dim.h };
    if (e.nitroT > 0 && e.state === 'ride') {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const side of [-1, 1]) {
        const fx = x + side * dim.w * 0.23, fy = y - dim.h * 0.2, f = 0.7 + Math.random() * 0.5;
        const gr = g.createRadialGradient(fx, fy, 1, fx, fy, dim.w * 0.16 * f);
        gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.35, 'rgba(56,189,248,0.8)'); gr.addColorStop(1, 'rgba(37,99,235,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(fx, fy, dim.w * 0.16 * f, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    }
    // name tags for nearby rivals
    if (!this.demo && !e.isPlayer && e.state === 'ride' && dim.w > 40) {
      g.globalAlpha = Math.min(1, (dim.w - 40) / 40);
      g.font = `600 ${Math.round(U.clamp(dim.w * 0.12, 11, 18))}px ${FONT2}`; g.textAlign = 'center';
      const ty = y - dim.h - 8;
      g.fillStyle = 'rgba(0,0,0,0.55)';
      const tw = g.measureText(e.name).width + 12;
      g.fillRect(x - tw / 2, ty - 15, tw, 19);
      g.fillStyle = e.isCop ? '#93c5fd' : '#fff'; g.fillText(e.name.toUpperCase(), x, ty);
      g.globalAlpha = 1;
    }
  }

  drawParticles(g) {
    for (const q of this.particles) {
      const a = 1 - q.life / q.max;
      if (q.kind === 'spark') {
        g.strokeStyle = q.color; g.globalAlpha = a; g.lineWidth = 2;
        g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x - q.vx * 0.03, q.y - q.vy * 0.03); g.stroke();
      } else {
        g.globalAlpha = a * 0.5; g.fillStyle = q.color;
        g.beginPath(); g.arc(q.x, q.y, q.size, 0, Math.PI * 2); g.fill();
      }
    }
    g.globalAlpha = 1;
  }

  drawSpeedLines(g, k) {
    g.save(); g.strokeStyle = `rgba(255,255,255,${0.18 * k})`; g.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, r0 = 260 + Math.random() * 200, r1 = r0 + 80 + Math.random() * 200 * k;
      g.beginPath(); g.moveTo(VW / 2 + Math.cos(a) * r0, VH / 2 + Math.sin(a) * r0 * 0.6);
      g.lineTo(VW / 2 + Math.cos(a) * r1, VH / 2 + Math.sin(a) * r1 * 0.6); g.stroke();
    }
    g.restore();
  }

  /* ---------- HUD ---------- */
  panel(g, x, y, w, h, r = 14) {
    g.fillStyle = 'rgba(10,8,24,0.62)'; Sprites.rr(g, x, y, w, h, r); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1.5; g.stroke();
  }
  bar(g, x, y, w, h, v, c1, c2) {
    g.fillStyle = 'rgba(255,255,255,0.1)'; Sprites.rr(g, x, y, w, h, h / 2); g.fill();
    if (v <= 0) return;
    const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; Sprites.rr(g, x, y, Math.max(h, w * U.clamp(v, 0, 1)), h, h / 2); g.fill();
  }

  drawHUD(g) {
    const p = this.player, st = this.standings();
    const pos = p.finished ? p.place : st.indexOf(p) + 1, total = st.length;
    g.textBaseline = 'alphabetic';
    // position + time
    this.panel(g, 20, 18, 210, 104);
    g.fillStyle = '#fff'; g.textAlign = 'left';
    g.font = `64px ${FONT}`; g.fillText(pos, 36, 86);
    const pw = g.measureText(pos).width;
    g.font = `22px ${FONT}`; g.fillStyle = '#fb923c'; g.fillText(U.ordinal(pos), 40 + pw, 56);
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.font = `600 18px ${FONT2}`; g.fillText(`OF ${total}`, 42 + pw, 84);
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = `600 15px ${FONT2}`; g.fillText('TIME', 140, 52);
    g.fillStyle = '#fff'; g.font = `20px ${FONT}`; g.fillText(U.formatTime(this.raceTime || 0).slice(0, -1), 140, 78);
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = `600 15px ${FONT2}`; g.fillText(`KO ${p.kos}`, 140, 106);

    // progress strip
    const bx = VW / 2 - 300, by = 34, bw = 600;
    this.panel(g, bx - 24, 16, bw + 48, 46, 23);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(bx, by + 6, bw, 3);
    const startZ = this.track.startIndex * ROAD.segLen, fz = this.track.finishZ;
    const prog = z => bx + bw * U.clamp((z - startZ) / (fz - startZ), 0, 1);
    for (let i = 1; i < 10; i++) { g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(bx + bw * i / 10, by + 3, 1, 9); }
    for (let i = 0; i < 4; i++) for (let r = 0; r < 2; r++) { g.fillStyle = (i + r) % 2 ? '#fff' : '#111'; g.fillRect(bx + bw - 2 + i * 4, by + r * 7, 4, 7); }
    for (const r of this.riders) {
      if (r.isPlayer) continue;
      const rx = prog(r.z);
      if (r.isCop) g.fillStyle = Math.floor(this.time * 6) % 2 ? '#ef4444' : '#3b82f6'; else g.fillStyle = r.spec.jacket;
      g.beginPath(); g.arc(rx, by + 7.5, 5.5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1.5; g.stroke();
    }
    const px = prog(p.z);
    g.save(); g.shadowColor = '#fb923c'; g.shadowBlur = 12; g.fillStyle = '#fb923c';
    g.beginPath(); g.moveTo(px, by - 6); g.lineTo(px + 8, by + 8); g.lineTo(px, by + 20); g.lineTo(px - 8, by + 8); g.closePath(); g.fill(); g.restore();

    // nearest rival card
    let foe = null, fd = 1300;
    for (const r of this.riders) if (!r.isPlayer && r.state === 'ride') { const d = Math.abs(r.z - p.z) + Math.abs(r.x - p.x) * 400; if (d < fd) { fd = d; foe = r; } }
    if (foe) {
      const fx = VW / 2 - 130, fy = 72;
      this.panel(g, fx, fy, 260, 46, 12);
      g.textAlign = 'left'; g.fillStyle = foe.isCop ? '#93c5fd' : '#fff'; g.font = `15px ${FONT}`;
      g.fillText(foe.name.toUpperCase(), fx + 14, fy + 20);
      g.textAlign = 'right'; g.font = `600 14px ${FONT2}`; g.fillStyle = 'rgba(255,255,255,0.7)';
      g.fillText(`${WEAPONS[foe.weapon].icon} ${WEAPONS[foe.weapon].name}`, fx + 246, fy + 20);
      this.bar(g, fx + 14, fy + 28, 232, 8, foe.stamina / foe.maxStamina, '#dc2626', '#f97316');
    }

    // money / bonus (top right)
    this.panel(g, VW - 230, 18, 210, 74);
    g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = `600 15px ${FONT2}`;
    g.fillText(this.mode === 'career' ? 'RACE EARNINGS' : `LEVEL ${this.level}`, VW - 36, 44);
    g.fillStyle = '#4ade80'; g.font = `26px ${FONT}`;
    g.fillText(this.mode === 'career' ? U.money(this.earned) : this.track.def.name.toUpperCase().slice(0, 14), VW - 36, 78);

    // health / bike / weapon / nitro (bottom left)
    const hy = VH - 136;
    this.panel(g, 20, hy, 300, 116);
    g.textAlign = 'left'; g.font = `600 14px ${FONT2}`; g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillText('RIDER', 36, hy + 26); g.fillText('BIKE', 36, hy + 52);
    this.bar(g, 90, hy + 15, 210, 12, p.stamina / p.maxStamina, '#16a34a', '#a3e635');
    this.bar(g, 90, hy + 41, 210, 12, p.bikeHP / 100, '#ea580c', '#facc15');
    g.font = `22px sans-serif`; g.fillText(WEAPONS[p.weapon].icon, 34, hy + 94);
    g.font = `15px ${FONT}`; g.fillStyle = '#fff'; g.fillText(WEAPONS[p.weapon].name.toUpperCase(), 66, hy + 90);
    const nb = this.opts.bike.nitro;
    if (nb) {
      for (let i = 0; i < nb; i++) {
        const nx = 296 - (nb - i) * 24, on = i < p.nitroLeft;
        g.fillStyle = on ? '#38bdf8' : 'rgba(255,255,255,0.12)';
        Sprites.rr(g, nx, hy + 74, 16, 26, 5); g.fill();
        if (on) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(nx + 4, hy + 78, 3, 16); }
      }
      if (p.nitroT > 0) { g.fillStyle = '#38bdf8'; g.fillRect(170, hy + 104, 126 * (p.nitroT / 3.2), 4); }
    }

    // speedometer (bottom right)
    const cx = VW - 130, cy = VH - 70, R = 96;
    const mph = Math.round(p.speed * MPH), maxMph = 240;
    g.fillStyle = 'rgba(10,8,24,0.62)'; g.beginPath(); g.arc(cx, cy, R + 12, Math.PI, 0); g.lineTo(cx + R + 12, cy + 50); g.lineTo(cx - R - 12, cy + 50); g.closePath(); g.fill();
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 12; g.beginPath(); g.arc(cx, cy, R, Math.PI, 0); g.stroke();
    const sp = U.clamp(mph / maxMph, 0, 1);
    const sg = g.createLinearGradient(cx - R, 0, cx + R, 0);
    sg.addColorStop(0, '#22d3ee'); sg.addColorStop(0.6, '#fb923c'); sg.addColorStop(1, '#ef4444');
    g.strokeStyle = sg; g.beginPath(); g.arc(cx, cy, R, Math.PI, Math.PI + Math.PI * sp); g.stroke();
    g.lineCap = 'butt';
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI + Math.PI * i / 12;
      g.strokeStyle = i % 3 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.8)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * (R - 14), cy + Math.sin(a) * (R - 14)); g.lineTo(cx + Math.cos(a) * (R - (i % 3 ? 20 : 26)), cy + Math.sin(a) * (R - (i % 3 ? 20 : 26))); g.stroke();
    }
    const na = Math.PI + Math.PI * sp;
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(na) * (R - 18), cy + Math.sin(na) * (R - 18)); g.stroke();
    g.fillStyle = '#fb923c'; g.beginPath(); g.arc(cx, cy, 7, 0, Math.PI * 2); g.fill();
    g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = `38px ${FONT}`; g.fillText(mph, cx, cy + 40);
    g.font = `600 13px ${FONT2}`; g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillText('MPH', cx + 62, cy + 40);

    // threats from behind
    for (const r of this.riders) {
      if (r.isPlayer || r.state !== 'ride') continue;
      const dz = p.z - r.z;
      if (dz > 150 && dz < 1600) {
        const a = 1 - dz / 1600, side = r.x < p.x ? -1 : 1;
        const ax = VW / 2 + side * 210, ay = VH - 60;
        g.globalAlpha = a; g.fillStyle = r.isCop ? '#60a5fa' : '#f87171';
        g.beginPath(); g.moveTo(ax, ay - 16); g.lineTo(ax + 14, ay + 4); g.lineTo(ax - 14, ay + 4); g.closePath(); g.fill();
        g.font = `600 14px ${FONT2}`; g.textAlign = 'center'; g.fillText(r.name.toUpperCase(), ax, ay + 22);
        g.globalAlpha = 1;
      }
    }

    // countdown lights
    if (this.phase === 'countdown') {
      const n = Math.ceil(this.countdown);
      const lx = VW / 2 - 105, ly = 150;
      this.panel(g, lx, ly, 210, 80, 40);
      for (let i = 0; i < 3; i++) {
        const lit = n <= 3 && 3 - i >= n;
        g.save();
        g.fillStyle = lit ? (n === 1 ? '#facc15' : '#ef4444') : 'rgba(255,255,255,0.1)';
        if (lit) { g.shadowColor = g.fillStyle; g.shadowBlur = 24; }
        g.beginPath(); g.arc(lx + 45 + i * 60, ly + 40, 24, 0, Math.PI * 2); g.fill(); g.restore();
      }
      if (n <= 3) { g.fillStyle = '#fff'; g.font = `90px ${FONT}`; g.textAlign = 'center'; g.fillText(n, VW / 2, VH / 2 + 10); }
      g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = `600 20px ${FONT2}`; g.textAlign = 'center';
      g.fillText('Hold ↑ to rev the engine', VW / 2, VH / 2 + 60);
    }

    // big messages
    this.msgs.forEach((m, i) => {
      const k = Math.min(1, m.t * 6), out = Math.min(1, (m.dur - m.t) * 3);
      g.save(); g.globalAlpha = out; g.textAlign = 'center';
      g.translate(VW / 2, 250 + i * 90); g.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
      g.font = `58px ${FONT}`; g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.strokeText(m.text, 0, 0);
      g.fillStyle = m.color; g.fillText(m.text, 0, 0);
      if (m.sub) { g.font = `600 24px ${FONT2}`; g.lineWidth = 5; g.strokeText(m.sub, 0, 34); g.fillStyle = '#fff'; g.fillText(m.sub, 0, 34); }
      g.restore();
    });
    this.toasts.forEach((t, i) => {
      const a = Math.min(1, (2.4 - t.t) * 2);
      g.globalAlpha = a; g.textAlign = 'right'; g.font = `18px ${FONT}`;
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillText(t.text, VW - 34 + 2, 128 + i * 28 - t.t * 6 + 2);
      g.fillStyle = t.color; g.fillText(t.text, VW - 34, 128 + i * 28 - t.t * 6);
      g.globalAlpha = 1;
    });
  }
}
