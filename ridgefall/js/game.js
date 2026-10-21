'use strict';
/* One downhill run: riders, air, stunts, and the painted mountain. */

const G = 1280;
const TAU = Math.PI * 2;

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function angNorm(d) {
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}
function lerpAngle(a, b, t) { return a + angNorm(b - a) * t; }

class Race {
  constructor(opts) {
    this.mode = opts.mode;
    this.track = opts.track;
    this.terrain = buildTerrain(opts.track);
    this.finishX = this.terrain.finish;
    this.time = 0;
    this.phase = opts.mode === 'demo' ? 'run' : 'countdown';
    this.countdown = 3.2;
    this.countN = 4;
    this.shake = 0;
    this.particles = [];
    this.acc = 0;
    this.endTimer = 0;
    this.gems = this.placeGems();
    this.decor = this.placeDecor();
    this.ghost = (opts.ghost || []).slice();
    this.ghostI = 0;
    this.recording = [];
    this.recT = 0;
    this.stars = this.makeStars();
    this.clouds = Array.from({ length: 7 }, (_, i) => ({
      x: (i + 0.3) / 7, y: 0.08 + (i % 3) * 0.07, w: 70 + (i * 37) % 90, s: 6 + (i % 4) * 3,
    }));
    this.riders = this.makeRiders(opts);
    this.player = this.riders.find(r => r.human) || this.riders[0];
    this.guest = this.riders.find(r => r.guest) || null;
  }

  makeStars() {
    const rng = mulberry32(this.track.seed + 3);
    return Array.from({ length: this.track.night ? 90 : 0 }, () => [rng(), rng() * 0.55, 0.3 + rng() * 1.4]);
  }

  makeRiders(opts) {
    const list = [];
    const veh = opts.vehicle;
    const start = 260;
    if (this.mode === 'demo') {
      const ai = RIDERS[2];
      list.push(this.spawnRider({
        name: ai.name, vehicle: paint(vehicleById('cross'), ai),
        x: start, skill: 0.9, ai: true, lane: 1, human: false,
      }));
      return list;
    }
    if (this.mode === 'duel') {
      list.push(this.spawnRider({
        name: opts.name || 'P1', vehicle: veh, x: start, human: true, lane: 2, skill: 1,
      }));
      const guestPaint = Object.assign({}, veh, { color: '#fb7185', dark: '#881337', suit: '#ffe4e6' });
      list.push(this.spawnRider({
        name: 'GUEST', vehicle: guestPaint, x: start - 46, human: true, guest: true, lane: 1, skill: 1,
      }));
      return list;
    }
    list.push(this.spawnRider({
      name: opts.name || 'RIDER', vehicle: veh, x: start, human: true, lane: 2, skill: 1,
    }));
    if (this.mode === 'race') {
      const pool = aiVehicles(this.track.diff);
      RIDERS.forEach((ai, i) => {
        const v = paint(vehicleById(pool[i]), ai);
        list.push(this.spawnRider({
          name: ai.name, vehicle: v, x: start - 70 - i * 48,
          skill: ai.skill, ai: true, lane: i % 2, human: false,
        }));
      });
    }
    return list;
  }

  spawnRider(o) {
    const slope = slopeAt(this.terrain, o.x);
    const y = yAt(this.terrain, o.x) + o.vehicle.hover;
    const diff = this.track.diff;
    return {
      name: o.name, vehicle: o.vehicle, human: !!o.human, guest: !!o.guest, ai: !!o.ai,
      skill: o.skill || 1, lane: o.lane || 0,
      x: o.x, y, vx: 0, vy: 0, speed: 0, angle: slope, angVel: 0,
      grounded: true, airT: 0, spin: 0, crashT: 0, invuln: 0,
      wheelSpin: 0, bob: 0, hover: o.vehicle.hover,
      boost: 100, nitroOn: false, chute: false, tuck: 0,
      gems: 0, score: 0, combo: 1, popup: null,
      done: false, finishTime: null, place: 1, livePlace: 1,
      camX: o.x + 180, camY: y + 40, zoom: this.mode === 'demo' ? 1.05 : 1.28,
      aiMax: o.vehicle.max * (o.ai ? (0.86 + o.skill * 0.08 + (diff - 1) * 0.03) : 1),
      aiAccel: o.vehicle.accel * (o.ai ? (0.88 + o.skill * 0.08) : 1),
      chuteCd: 0,
    };
  }

  placeGems() {
    const gems = [];
    const seen = new Set();
    const add = (x, lift) => {
      const k = Math.round(x / 30);
      if (seen.has(k) || x < 900 || x > this.finishX - 200) return;
      seen.add(k);
      gems.push({ x, y: yAt(this.terrain, x) + lift, got: false, who: null });
    };
    this.terrain.ramps.forEach(lip => add(lip - 10, 86));
    const rng = mulberry32(this.track.seed + 101);
    for (let i = 0; i < 8; i++) {
      const x = 1600 + rng() * (this.finishX - 2200);
      add(x, 64 + rng() * 36);
    }
    return gems;
  }

  placeDecor() {
    const rng = mulberry32(this.track.seed + 55);
    const out = [];
    for (let x = 180; x < this.track.length; x += 90 + rng() * 150) {
      const surf = surfaceAt(this.track, x);
      if (surf === 'water') continue;
      const kind = this.track.decor[out.length % this.track.decor.length];
      out.push({
        x, y: yAt(this.terrain, x), kind,
        s: 0.75 + rng() * 0.7, flip: rng() > 0.5,
      });
    }
    return out;
  }

  update(dt, input) {
    if (this.phase === 'done') return;
    this.acc += Math.min(0.05, dt);
    const h = 1 / 90;
    let n = 0;
    let jump1 = input.p1.jumpEdge;
    let jump2 = input.p2.jumpEdge;
    let reset1 = input.p1.resetEdge;
    let reset2 = input.p2.resetEdge;
    input.p1.jumpEdge = input.p2.jumpEdge = false;
    input.p1.resetEdge = input.p2.resetEdge = false;
    while (this.acc >= h && n < 5) {
      this.step(h, input, jump1, jump2, reset1, reset2);
      jump1 = jump2 = reset1 = reset2 = false;
      this.acc -= h;
      n++;
    }
    this.smoothCam(dt);
    this.shake = Math.max(0, this.shake - dt * 24);
    if (this.phase === 'finish') {
      this.endTimer -= dt;
      if (this.endTimer <= 0) this.phase = 'done';
    }
  }

  step(dt, input, jump1, jump2, reset1, reset2) {
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown);
      if (n !== this.countN) {
        this.countN = n;
        if (this.mode !== 'demo') {
          if (n > 0) Sound.fx.beep();
          else Sound.fx.go();
        }
      }
      if (this.countdown <= 0) {
        this.phase = 'run';
        this.time = 0;
      }
    } else if (this.phase === 'run' || this.phase === 'finish') {
      if (this.phase === 'run') this.time += dt;
    }

    const racing = this.phase === 'run';
    for (const r of this.riders) {
      let inp = blankInput();
      if (racing && !r.done) {
        if (r.human && r.guest) inp = packInput(input.p2, jump2, reset2);
        else if (r.human) inp = packInput(input.p1, jump1, reset1);
        else if (r.ai) inp = this.aiInput(r);
      }
      this.stepRider(r, inp, dt, racing);
    }
    this.rank();
    this.stepParticles(dt);

    if (this.mode === 'demo') {
      const r = this.riders[0];
      if (r.x > this.finishX - 40 || r.x < 0) this.resetDemo(r);
    }

    if (this.mode === 'time' && racing) {
      const p = this.player;
      this.recT += dt;
      if (this.recT >= 0.12 && !p.done) {
        this.recT = 0;
        if (this.recording.length < 900) {
          this.recording.push({
            t: +this.time.toFixed(2), x: Math.round(p.x), y: Math.round(p.y), a: +p.angle.toFixed(3),
          });
        }
      }
    }
  }

  resetDemo(r) {
    r.x = 260;
    r.speed = 420;
    r.grounded = true;
    r.crashT = 0;
    r.done = false;
    r.y = yAt(this.terrain, r.x) + r.hover;
    r.angle = slopeAt(this.terrain, r.x);
    r.vx = 0;
    r.vy = 0;
    this.gems.forEach(g => { g.got = false; });
  }

  aiInput(r) {
    const inp = blankInput();
    if (r.grounded) {
      const surf = surfaceAt(this.track, r.x);
      const slippery = surf === 'ice' || surf === 'water';
      inp.gas = r.speed < r.aiMax * (slippery ? 0.86 : 1.02);
      if (r.boost > 75 && r.speed > 480 && Math.random() < 0.003 * r.skill) inp.nitro = true;
    } else if (Math.abs(angNorm(r.angle)) > 1.5 && r.vy < -220) {
      inp.chute = true;
    }
    return inp;
  }

  stepRider(r, inp, dt, racing) {
    if (r.popup) {
      r.popup.t -= dt;
      if (r.popup.t <= 0) r.popup = null;
    }
    if (r.invuln > 0) r.invuln -= dt;
    if (!Number.isFinite(r.x) || !Number.isFinite(r.y) || !Number.isFinite(r.speed)) {
      this.respawn(r);
      return;
    }
    if (r.crashT > 0) {
      r.crashT -= dt;
      r.vy -= G * dt;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.angle += 8 * dt;
      if (r.x >= this.finishX && racing) this.finishRider(r);
      if (r.crashT <= 0 && !r.done) this.respawn(r);
      return;
    }
    if (inp.reset && r.human && !r.done) {
      this.respawn(r);
      return;
    }
    if (r.done || !racing) {
      this.coast(r, dt);
      return;
    }

    const spec = r.vehicle;
    r.tuck = (inp.back ? 1 : 0) - (inp.fore ? 1 : 0);
    r.nitroOn = false;
    r.chute = false;

    if (r.grounded) {
      const slope = slopeAt(this.terrain, r.x);
      const gripInfo = trackGrip(this.track, spec, r.x);
      const grip = gripInfo.g;
      const target = slope + (inp.back ? 0.48 : 0) - (inp.fore ? 0.36 : 0);
      r.angle = lerpAngle(r.angle, target, Math.min(1, dt * 9));

      const nitro = inp.nitro && r.boost > 6;
      r.nitroOn = nitro;
      if (nitro) {
        r.boost = Math.max(0, r.boost - dt * 36);
        if (!r.nitroSnd) { r.nitroSnd = true; if (r.human && this.mode !== 'demo') Sound.fx.nitro(); }
      } else {
        r.nitroSnd = false;
        r.boost = Math.min(100, r.boost + dt * 9);
      }

      const accel = (r.ai ? r.aiAccel : spec.accel) * (inp.gas ? 1 : 0) * Math.min(grip, 1.15);
      const boost = nitro ? spec.boost : 1;
      const grav = -G * Math.sin(slope);
      const brake = inp.brake ? 1500 * clamp(grip, 0.35, 1.3) : 0;
      const drag = r.speed * Math.abs(r.speed) * spec.drag;
      r.speed += (accel * boost + grav - drag) * dt;
      if (inp.brake) {
        if (r.speed > 0) r.speed = Math.max(0, r.speed - brake * dt);
        else r.speed = Math.min(0, r.speed + brake * dt);
      }
      const cap = (r.ai ? r.aiMax : spec.max) * (nitro ? 1.06 : 1);
      if (r.speed > cap) r.speed += (cap - r.speed) * Math.min(1, dt * 2);
      if (r.speed < -220) r.speed = -220;

      const c = Math.cos(slope);
      const s = Math.sin(slope);
      r.vx = c * r.speed;
      r.vy = s * r.speed;
      r.x += r.vx * dt;
      if (r.x < 60) { r.x = 60; if (r.speed < 0) r.speed = 0; }
      r.y = yAt(this.terrain, r.x) + r.hover;
      r.bob = Math.sin(this.time * 26 + r.x * 0.15) * Math.min(2, Math.abs(r.speed) * 0.003);
      r.wheelSpin += r.speed * dt * 0.012;

      if (gripInfo.surf === 'water' && Math.abs(r.speed) > 200 && Math.random() < 0.4) {
        this.burst(r.x - 20, yAt(this.terrain, r.x), 1, '#bff7ff', 40, 20);
      } else if (Math.abs(r.speed) > 280 && Math.random() < 0.35) {
        const dust = gripInfo.surf === 'ice' ? '#eef6ff' : gripInfo.surf === 'gravel' ? '#e7c2a0' : '#d9c7a2';
        this.burst(r.x - 24, yAt(this.terrain, r.x) + 4, 1, dust, 30, 0);
      }

      const jump = inp.jump;
      const aheadX = r.x + Math.max(10, r.vx * 0.02);
      const groundAhead = yAt(this.terrain, aheadX) + r.hover;
      const ballistic = r.y + r.vy * 0.02 - 0.5 * G * 0.0004;
      const crest = ballistic > groundAhead + 22 && r.speed > 260;
      if (crest || jump) {
        r.grounded = false;
        r.airT = 0;
        r.spin = 0;
        if (crest) r.vy += Math.max(0, r.speed) * 0.12;
        if (jump) {
          r.vy += 460 + Math.max(0, r.speed) * 0.1;
          r.y += 8;
          if (r.human && this.mode !== 'demo') Sound.fx.jump();
        }
        r.angVel = (inp.back ? 2.6 : 0) - (inp.fore ? 2.4 : 0);
        if (jump) r.angVel += inp.back ? 1.4 : -0.4;
      }
    } else {
      r.airT += dt;
      const chute = inp.chute;
      r.chute = chute;
      if (r.ai) {
        const want = slopeAt(this.terrain, r.x + Math.max(90, r.vx * 0.45));
        const err = angNorm(want - r.angle);
        r.angVel += (err * 11 - r.angVel * 3.2) * dt;
      } else {
        if (inp.back) r.angVel += spec.air * dt;
        if (inp.fore) r.angVel -= spec.air * dt;
      }
      r.angVel = clamp(r.angVel, -9.5, 9.5);
      if (chute) {
        if (!r.chuteSnd) { r.chuteSnd = true; if (r.human && this.mode !== 'demo') Sound.fx.chute(); }
        r.angVel *= Math.pow(0.12, dt);
        r.vy += (-160 - r.vy) * Math.min(1, dt * 3.4);
        r.vx *= Math.pow(0.62, dt);
      } else {
        r.chuteSnd = false;
        r.vy -= G * dt;
        r.vx *= Math.pow(0.996, dt * 60);
      }
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.angle += r.angVel * dt;
      r.spin += r.angVel * dt;
      r.bob = 0;

      if (r.x >= this.finishX) {
        this.finishRider(r);
        return;
      }
      const gy = yAt(this.terrain, r.x) + r.hover;
      if (r.y <= gy && r.airT > 0.1) {
        this.land(r, gy);
      } else if (r.y < gy - 1600 || r.airT > 5) {
        this.crash(r);
      }
    }

    if (r.grounded && r.x >= this.finishX) this.finishRider(r);
    if (!r.done) this.collect(r);
  }

  coast(r, dt) {
    const slope = slopeAt(this.terrain, Math.min(r.x, this.track.length - 20));
    r.speed *= Math.pow(0.9, dt * 60);
    r.x += Math.cos(slope) * r.speed * dt;
    r.y = yAt(this.terrain, r.x) + r.hover;
    r.angle = lerpAngle(r.angle, slope, Math.min(1, dt * 6));
    r.grounded = true;
    r.wheelSpin += r.speed * dt * 0.012;
  }

  land(r, gy) {
    const slope = slopeAt(this.terrain, r.x);
    const impact = Math.max(0, -r.vy);
    const err = Math.abs(angNorm(r.angle - slope));
    const fatal = r.invuln <= 0 && r.airT > 0.22 && ((err > 1.4 && impact > 300) || err > 2.05 || impact > 1900);
    if (fatal) {
      this.crash(r);
      return;
    }
    r.grounded = true;
    r.y = gy;
    r.angle = slope;
    r.angVel = 0;
    r.chute = false;
    const sc = Math.cos(slope);
    const ss = Math.sin(slope);
    r.speed = r.vx * sc + r.vy * ss;
    r.speed *= 1 - Math.min(0.4, impact / 2600);
    if (r.speed < 0) r.speed *= 0.35;
    if (r.human && this.mode !== 'demo' && impact > 180) {
      Sound.fx.land();
      this.shake = Math.max(this.shake, Math.min(12, impact / 180));
    }
    this.burst(r.x, gy - r.hover, impact > 400 ? 8 : 4, '#efe6d4', 80, 40);
    this.scoreLanding(r);
  }

  scoreLanding(r) {
    const flips = Math.floor(Math.abs(r.spin) / TAU + 0.12);
    let base = 0;
    let label = '';
    if (r.airT > 0.48) {
      base += Math.round(r.airT * 280);
      label = r.airT > 1.25 ? 'HUGE AIR' : 'AIRTIME';
    }
    if (flips >= 1) {
      const dir = r.spin > 0 ? 'BACKFLIP' : 'FRONTFLIP';
      label = flips === 1 ? dir : flips === 2 ? 'DOUBLE ' + dir : flips + '× ' + dir;
      base += flips * 650 + (flips > 1 ? 500 : 0);
    }
    if (base <= 0) {
      if (r.airT > 0.35) r.combo = 1;
      return;
    }
    const pts = base * r.combo;
    r.score += pts;
    const combo = r.combo;
    r.combo = Math.min(8, r.combo + 1);
    r.popup = { text: label + '  +' + pts + (combo > 1 ? '  ×' + combo : ''), t: 1.25 };
    if (r.human && this.mode !== 'demo') Sound.fx.stunt();
  }

  crash(r) {
    if (r.invuln > 0) {
      r.grounded = true;
      r.y = yAt(this.terrain, r.x) + r.hover;
      r.angle = slopeAt(this.terrain, r.x);
      r.angVel = 0;
      r.speed *= 0.45;
      return;
    }
    r.crashT = 0.8;
    r.grounded = false;
    r.combo = 1;
    r.angVel = 7;
    r.vy = Math.max(r.vy, 160);
    r.vx *= 0.4;
    r.popup = { text: 'WIPEOUT', t: 0.9 };
    if (r.human && this.mode !== 'demo') {
      Sound.fx.crash();
      this.shake = 14;
    }
    this.burst(r.x, r.y, 14, r.vehicle.color, 160, 80);
  }

  respawn(r) {
    r.crashT = 0;
    r.x = clamp(r.x - 420, 80, this.finishX - 80);
    r.grounded = true;
    r.y = yAt(this.terrain, r.x) + r.hover;
    r.angle = slopeAt(this.terrain, r.x);
    r.angVel = 0;
    r.spin = 0;
    r.airT = 0;
    r.chute = false;
    r.speed = clamp(r.speed * 0.35, 140, 280);
    r.vx = 0;
    r.vy = 0;
    r.invuln = 0.65;
    r.combo = 1;
  }

  finishRider(r) {
    if (r.done) return;
    r.done = true;
    r.finishTime = this.time;
    r.grounded = true;
    r.chute = false;
    const ahead = this.riders.filter(o => o !== r && (o.done || o.x > r.x)).length;
    r.place = ahead + 1;
    if (r.human && this.mode !== 'demo') {
      Sound.fx.finish();
      this.shake = Math.max(this.shake, 4);
    }
    const humans = this.riders.filter(o => o.human);
    if (humans.length && humans.every(o => o.done)) {
      this.phase = 'finish';
      this.endTimer = 1.45;
    }
  }

  collect(r) {
    if (!r.human) return;
    for (const g of this.gems) {
      if (g.got) continue;
      const dx = g.x - r.x;
      const dy = g.y - r.y;
      if (dx * dx + dy * dy < 78 * 78) {
        g.got = true;
        g.who = r;
        r.gems++;
        r.popup = { text: 'GEM  +1', t: 0.7 };
        if (this.mode !== 'demo') Sound.fx.gem();
        this.burst(g.x, g.y, 8, '#7ef0ff', 90, 40);
      }
    }
  }

  rank() {
    const order = this.riders.slice().sort((a, b) => {
      if (a.done && b.done) return a.finishTime - b.finishTime;
      if (a.done) return -1;
      if (b.done) return 1;
      return b.x - a.x;
    });
    order.forEach((r, i) => { r.livePlace = i + 1; });
  }

  burst(x, y, n, color, spd, up) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = 20 + Math.random() * spd;
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 + up * Math.random(),
        life: 0.35 + Math.random() * 0.4, max: 0.75, color, s: 2 + Math.random() * 3, g: 200,
      });
    }
    if (this.particles.length > 220) this.particles.splice(0, this.particles.length - 220);
  }

  stepParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.vy -= (p.g || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  smoothCam(dt) {
    const focuses = this.mode === 'duel'
      ? this.riders.filter(r => r.human)
      : [this.player];
    for (const r of focuses) {
      const ahead = 210 + Math.max(0, r.speed) * 0.2;
      const air = !r.grounded && r.crashT <= 0;
      const z = this.mode === 'demo' ? 1.18 : air ? 1.12 : 1.32;
      r.camX += (r.x + ahead - r.camX) * Math.min(1, dt * 2.8);
      r.camY += (r.y + 36 - r.camY) * Math.min(1, dt * 3.2);
      r.zoom += (z - r.zoom) * Math.min(1, dt * 2.4);
    }
  }

  ghostAt(t) {
    const g = this.ghost;
    if (!g || !g.length || this.mode !== 'time') return null;
    if (t < g[0].t) return g[0];
    while (this.ghostI < g.length - 1 && g[this.ghostI + 1].t < t) this.ghostI++;
    const a = g[this.ghostI];
    const b = g[Math.min(g.length - 1, this.ghostI + 1)];
    if (!b || b.t <= a.t || t > g[g.length - 1].t) return t > g[g.length - 1].t ? null : a;
    const u = clamp((t - a.t) / (b.t - a.t), 0, 1);
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, a: a.a + angNorm(b.a - a.a) * u };
  }

  /* ---------- drawing ---------- */

  draw(ctx, w, h) {
    if (this.mode === 'duel') {
      const humans = this.riders.filter(r => r.human);
      this.drawViewport(ctx, { x: 0, y: 0, w, h: h / 2 }, humans[0]);
      this.drawViewport(ctx, { x: 0, y: h / 2, w, h: h / 2 }, humans[1]);
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.fillRect(0, h / 2 - 1, w, 2);
    } else {
      this.drawViewport(ctx, { x: 0, y: 0, w, h }, this.player);
    }
  }

  drawViewport(ctx, view, focus) {
    const cam = focus;
    ctx.save();
    ctx.beginPath();
    ctx.rect(view.x, view.y, view.w, view.h);
    ctx.clip();
    this.drawSky(ctx, view, cam);
    this.drawMountains(ctx, view, cam);
    ctx.save();
    if (this.shake > 0.4) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }
    this.drawTerrain(ctx, view, cam);
    this.drawDecor(ctx, view, cam);
    this.drawGates(ctx, view, cam);
    this.drawGems(ctx, view, cam);
    this.drawParticles(ctx, view, cam);
    const ghost = this.ghostAt(this.time);
    if (ghost) this.drawGhost(ctx, view, cam, ghost);
    const order = this.riders.slice().sort((a, b) => a.lane - b.lane);
    for (const r of order) this.drawRider(ctx, view, cam, r);
    ctx.restore();
    this.drawVignette(ctx, view);
    if (this.mode !== 'demo') this.drawBanner(ctx, view);
    ctx.restore();
  }

  project(view, cam, x, y) {
    const z = cam.zoom;
    const bias = this.mode === 'demo' ? view.w * 0.26 : 0;
    return [
      view.x + view.w * 0.5 + bias + (x - cam.camX) * z,
      view.y + view.h * 0.48 + (cam.camY - y) * z,
    ];
  }

  drawSky(ctx, view, cam) {
    const sky = this.track.sky;
    const g = ctx.createLinearGradient(0, view.y, 0, view.y + view.h);
    g.addColorStop(0, sky[0]);
    g.addColorStop(0.55, sky[1]);
    g.addColorStop(1, sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(view.x, view.y, view.w, view.h);
    if (this.track.night) {
      ctx.fillStyle = '#fff';
      for (const s of this.stars) {
        ctx.globalAlpha = 0.4 + Math.sin(this.time * 2 + s[0] * 20) * 0.3;
        ctx.fillRect(view.x + s[0] * view.w, view.y + s[1] * view.h * 0.7, s[2], s[2]);
      }
      ctx.globalAlpha = 1;
    }
    const sunX = view.x + view.w * (this.track.night ? 0.78 : 0.72);
    const sunY = view.y + view.h * (this.track.night ? 0.22 : 0.28);
    const rg = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 90);
    rg.addColorStop(0, this.track.night ? 'rgba(255,244,214,.95)' : 'rgba(255,248,220,.95)');
    rg.addColorStop(1, 'rgba(255,248,220,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 90, 0, TAU);
    ctx.fill();
    for (const c of this.clouds) {
      const px = view.x + ((c.x * view.w - cam.camX * 0.05 + this.time * c.s) % (view.w + 200)) - 80;
      const py = view.y + c.y * view.h;
      ctx.fillStyle = this.track.night ? 'rgba(180,200,230,.08)' : 'rgba(255,255,255,.55)';
      ctx.beginPath();
      ctx.ellipse(px, py, c.w, 16, 0, 0, TAU);
      ctx.ellipse(px + c.w * 0.35, py + 4, c.w * 0.6, 12, 0, 0, TAU);
      ctx.fill();
    }
  }

  drawMountains(ctx, view, cam) {
    const layers = [
      { color: this.track.far, amp: 70, parallax: 0.08, base: 0.42, f: 0.004 },
      { color: this.track.mid, amp: 48, parallax: 0.16, base: 0.52, f: 0.007 },
    ];
    for (const layer of layers) {
      ctx.beginPath();
      const y0 = view.y + view.h * layer.base;
      ctx.moveTo(view.x, view.y + view.h);
      for (let sx = 0; sx <= view.w; sx += 10) {
        const world = cam.camX * layer.parallax + sx / cam.zoom;
        const yy = y0 - Math.sin(world * layer.f) * layer.amp - Math.sin(world * layer.f * 2.3 + 1) * layer.amp * 0.35;
        ctx.lineTo(view.x + sx, yy);
      }
      ctx.lineTo(view.x + view.w, view.y + view.h);
      ctx.closePath();
      ctx.fillStyle = layer.color;
      ctx.fill();
    }
  }

  drawTerrain(ctx, view, cam) {
    const z = cam.zoom;
    const x0 = cam.camX - view.w / z * 0.5 - 40;
    const x1 = cam.camX + view.w / z * 0.5 + 40;
    const step = 8;
    const pts = [];
    for (let x = x0; x <= x1; x += step) {
      const y = yAt(this.terrain, x);
      const p = this.project(view, cam, x, y);
      pts.push({ x, sx: p[0], sy: p[1], surf: surfaceAt(this.track, x) });
    }
    if (pts.length < 2) return;
    const bottom = view.y + view.h + 40;
    let run = [pts[0]];
    const flush = () => {
      if (run.length < 2) return;
      const surf = run[0].surf;
      ctx.beginPath();
      ctx.moveTo(run[0].sx, run[0].sy);
      for (let i = 1; i < run.length; i++) ctx.lineTo(run[i].sx, run[i].sy);
      ctx.lineTo(run[run.length - 1].sx, bottom);
      ctx.lineTo(run[0].sx, bottom);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, run[0].sy - 10, 0, bottom);
      const cols = groundColors(surf, this.track);
      grad.addColorStop(0, cols[0]);
      grad.addColorStop(0.08, cols[1]);
      grad.addColorStop(1, cols[2]);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(run[0].sx, run[0].sy);
      for (let i = 1; i < run.length; i++) ctx.lineTo(run[i].sx, run[i].sy);
      ctx.strokeStyle = cols[0];
      ctx.lineWidth = 14;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    };
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].surf !== run[0].surf) {
        run.push(pts[i]);
        flush();
        run = [pts[i]];
      } else run.push(pts[i]);
    }
    flush();

    ctx.beginPath();
    ctx.moveTo(pts[0].sx, pts[0].sy);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 3;
    ctx.stroke();

    if (pts.some(p => p.surf === 'water')) {
      ctx.beginPath();
      let started = false;
      for (const p of pts) {
        if (p.surf !== 'water') { started = false; continue; }
        const yy = p.sy + Math.sin(p.x * 0.05 + this.time * 3) * 2;
        if (!started) { ctx.moveTo(p.sx, yy); started = true; }
        else ctx.lineTo(p.sx, yy);
      }
      ctx.strokeStyle = 'rgba(190,250,255,.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  drawDecor(ctx, view, cam) {
    for (const d of this.decor) {
      if (Math.abs(d.x - cam.camX) > view.w / cam.zoom) continue;
      const p = this.project(view, cam, d.x, d.y);
      ctx.save();
      ctx.translate(p[0], p[1]);
      ctx.scale((d.flip ? -1 : 1) * cam.zoom * d.s, cam.zoom * d.s);
      if (d.kind === 'pine') drawPine(ctx, this.track.night);
      else if (d.kind === 'palm') drawPalm(ctx);
      else if (d.kind === 'cactus') drawCactus(ctx);
      else if (d.kind === 'ice') drawIce(ctx);
      else drawRock(ctx, this.track.id === 'canyon');
      ctx.restore();
    }
  }

  drawGates(ctx, view, cam) {
    this.drawGate(ctx, view, cam, 140, 'START', false);
    this.drawGate(ctx, view, cam, this.finishX, 'FINISH', true);
  }

  drawGate(ctx, view, cam, x, label, finish) {
    if (Math.abs(x - cam.camX) > view.w / cam.zoom) return;
    const ground = yAt(this.terrain, x);
    const top = this.project(view, cam, x, ground + 150);
    const bot = this.project(view, cam, x, ground);
    ctx.save();
    ctx.strokeStyle = finish ? '#f8fafc' : this.track.accent;
    ctx.lineWidth = 4 * cam.zoom;
    ctx.beginPath();
    ctx.moveTo(bot[0] - 18 * cam.zoom, bot[1]);
    ctx.lineTo(top[0] - 18 * cam.zoom, top[1]);
    ctx.moveTo(bot[0] + 18 * cam.zoom, bot[1]);
    ctx.lineTo(top[0] + 18 * cam.zoom, top[1]);
    ctx.moveTo(top[0] - 20 * cam.zoom, top[1]);
    ctx.lineTo(top[0] + 20 * cam.zoom, top[1]);
    ctx.stroke();
    ctx.fillStyle = finish ? '#0f172a' : '#062018';
    const bw = 54 * cam.zoom;
    const bh = 16 * cam.zoom;
    ctx.fillRect(top[0] - bw / 2, top[1] - bh - 2, bw, bh);
    ctx.fillStyle = finish ? '#f8fafc' : this.track.accent;
    ctx.font = '700 ' + Math.max(9, 11 * cam.zoom) + 'px Sora, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, top[0], top[1] - bh / 2 - 2);
    ctx.restore();
  }

  drawGems(ctx, view, cam) {
    for (const g of this.gems) {
      if (g.got) continue;
      if (Math.abs(g.x - cam.camX) > view.w / cam.zoom) continue;
      const bob = Math.sin(this.time * 3 + g.x) * 6;
      const p = this.project(view, cam, g.x, g.y + bob);
      ctx.save();
      ctx.translate(p[0], p[1]);
      ctx.rotate(Math.sin(this.time * 2 + g.x) * 0.4);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.shadowColor = 'rgba(125, 240, 255, .8)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(8, 0);
      ctx.lineTo(0, 11);
      ctx.lineTo(-8, 0);
      ctx.closePath();
      ctx.fillStyle = '#dffbff';
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#67e8f9';
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(4, 0);
      ctx.lineTo(0, 6);
      ctx.lineTo(-4, 0);
      ctx.fill();
      ctx.restore();
    }
  }

  drawParticles(ctx, view, cam) {
    for (const p of this.particles) {
      if (Math.abs(p.x - cam.camX) > view.w / cam.zoom) continue;
      const s = this.project(view, cam, p.x, p.y);
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(s[0], s[1], p.s * cam.zoom, p.s * cam.zoom);
    }
    ctx.globalAlpha = 1;
  }

  drawGhost(ctx, view, cam, g) {
    const p = this.project(view, cam, g.x, g.y);
    ctx.save();
    ctx.translate(p[0], p[1]);
    ctx.rotate(-g.a);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.globalAlpha = 0.28;
    drawBike(ctx, {
      vehicle: this.player.vehicle, wheelSpin: this.time * 8, tuck: 0, nitroOn: false, angle: 0,
    }, this.time);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawRider(ctx, view, cam, r) {
    const py = r.y + (r.grounded ? r.bob : 0);
    const p = this.project(view, cam, r.x, py);
    const gy = yAt(this.terrain, r.x);
    const g = this.project(view, cam, r.x, gy);
    const alt = Math.max(0, py - gy);
    ctx.save();
    ctx.translate(g[0], g[1]);
    ctx.scale(1, 0.32);
    ctx.globalAlpha = clamp(0.38 - alt / 800, 0.08, 0.38);
    ctx.fillStyle = '#041018';
    ctx.beginPath();
    ctx.ellipse(0, 0, 36 * cam.zoom, 36 * cam.zoom, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(p[0], p[1]);
    ctx.rotate(-r.angle);
    const sc = cam.zoom * (r.human ? 1.2 : 1.08);
    ctx.scale(sc, sc);
    if (r.invuln > 0 && Math.sin(this.time * 30) > 0) ctx.globalAlpha = 0.45;
    if (r.vehicle.kind === 'atv') drawATV(ctx, r, this.time);
    else if (r.vehicle.kind === 'boat') drawBoat(ctx, r, this.time);
    else drawBike(ctx, r, this.time);
    if (r.chute) drawChute(ctx);
    ctx.restore();

    if (this.mode !== 'demo' && r.crashT <= 0) {
      ctx.save();
      ctx.translate(p[0], p[1] - 62 * cam.zoom);
      ctx.textAlign = 'center';
      ctx.font = '700 11px Sora, sans-serif';
      ctx.fillStyle = r.human ? '#f7ffe4' : 'rgba(255,255,255,.82)';
      ctx.fillText(r.livePlace + '  ' + r.name, 0, 0);
      if (r.popup) {
        ctx.globalAlpha = clamp(r.popup.t, 0, 1);
        ctx.font = '600 20px Teko, sans-serif';
        ctx.fillStyle = this.track.accent;
        ctx.fillText(r.popup.text, 0, -18 - (1.2 - r.popup.t) * 26);
      }
      ctx.restore();
    }
  }

  drawVignette(ctx, view) {
    const g = ctx.createLinearGradient(0, view.y + view.h * 0.55, 0, view.y + view.h);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.28)');
    ctx.fillStyle = g;
    ctx.fillRect(view.x, view.y, view.w, view.h);
  }

  drawBanner(ctx, view) {
    if (this.phase !== 'countdown' && this.phase !== 'finish') return;
    const label = this.phase === 'finish' ? 'FINISH' : (this.countdown > 0 ? String(Math.ceil(this.countdown)) : 'DROP');
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const size = Math.max(64, Math.min(120, view.h * 0.22));
    ctx.font = '600 ' + size + 'px Teko, sans-serif';
    ctx.fillStyle = 'rgba(6,16,20,.35)';
    ctx.fillText(label, view.x + view.w / 2 + 4, view.y + view.h * 0.34 + 4);
    ctx.fillStyle = '#f8fff0';
    ctx.fillText(label, view.x + view.w / 2, view.y + view.h * 0.34);
    ctx.restore();
  }
}

function blankInput() {
  return { gas: false, brake: false, back: false, fore: false, chute: false, nitro: false, jump: false, reset: false };
}
function packInput(src, jump, reset) {
  return {
    gas: !!src.gas, brake: !!src.brake, back: !!src.back, fore: !!src.fore,
    chute: !!src.chute, nitro: !!src.nitro, jump: !!jump, reset: !!reset,
  };
}
function aiVehicles(diff) {
  if (diff <= 1) return ['trail', 'trail', 'trail', 'cross'];
  if (diff === 2) return ['trail', 'cross', 'trail', 'cross'];
  if (diff === 3) return ['cross', 'atv', 'cross', 'trail'];
  if (diff === 4) return ['cross', 'storm', 'atv', 'wave'];
  return ['storm', 'wave', 'cross', 'atv'];
}
function paint(vehicle, ai) {
  return Object.assign({}, vehicle, { color: ai.color, dark: ai.dark, suit: ai.suit });
}
function groundColors(surf, track) {
  if (surf === 'water') return ['#5eead4', '#0f766e', '#042f2e'];
  if (surf === 'ice') return ['#f8fdff', '#b9c9d6', '#4b5c6b'];
  if (surf === 'gravel' || track.id === 'canyon') return ['#e0895c', '#8a4030', '#2c140e'];
  if (surf === 'sand') return ['#f0d7a0', '#c4a36a', '#3f2e18'];
  if (track.night) return ['#1f8a52', '#14362a', '#070d0c'];
  return ['#3ea35a', '#6b4a2c', '#24160f'];
}

function wheel(ctx, x, y, rad, spin, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.beginPath();
  ctx.arc(0, 0, rad, 0, TAU);
  ctx.fillStyle = '#0c1014';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1f2937';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, rad * 0.55, 0, TAU);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * rad * 0.82, Math.sin(a) * rad * 0.82);
  }
  ctx.stroke();
  ctx.restore();
}

function riderBody(ctx, r, hipX, hipY, barX, barY) {
  const v = r.vehicle;
  const tuck = r.tuck || 0;
  ctx.strokeStyle = v.suit;
  ctx.fillStyle = v.suit;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const shoulderX = hipX + 8 - tuck * 4;
  const shoulderY = hipY - 16 - tuck * 3;
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(shoulderX, shoulderY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(shoulderX, shoulderY);
  ctx.lineTo(barX, barY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(hipX - 10, hipY + 10);
  ctx.lineTo(hipX - 16, hipY + 16);
  ctx.stroke();
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(shoulderX + 4, shoulderY - 5, 6.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(shoulderX + 7, shoulderY - 5, 3.2, 0, TAU);
  ctx.fill();
}

function drawBike(ctx, r, time) {
  const v = r.vehicle;
  const spin = r.wheelSpin || 0;
  wheel(ctx, -34, 20, 14, spin, v.color);
  wheel(ctx, 38, 20, 14, spin, v.color);
  ctx.strokeStyle = v.dark;
  ctx.fillStyle = v.color;
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-34, 20);
  ctx.lineTo(-4, 6);
  ctx.lineTo(16, 8);
  ctx.lineTo(38, 20);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-4, 6);
  ctx.lineTo(10, -12);
  ctx.lineTo(28, -4);
  ctx.lineTo(38, 20);
  ctx.stroke();
  ctx.fillStyle = v.dark;
  ctx.fillRect(2, -6, 14, 4);
  ctx.strokeStyle = v.metal;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(28, -4);
  ctx.lineTo(34, -14);
  ctx.lineTo(22, -15);
  ctx.stroke();
  riderBody(ctx, r, 6, -2, 28, -14);
  if (r.nitroOn) {
    ctx.save();
    ctx.translate(-36, 12);
    ctx.fillStyle = `rgba(253, 224, 71, ${0.6 + Math.sin(time * 40) * 0.3})`;
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.lineTo(-16 - Math.random() * 10, 2);
    ctx.lineTo(0, 6);
    ctx.fill();
    ctx.restore();
  }
}

function drawATV(ctx, r, time) {
  const v = r.vehicle;
  const spin = r.wheelSpin || 0;
  wheel(ctx, -32, 16, 11, spin, v.color);
  wheel(ctx, -10, 16, 11, spin, v.color);
  wheel(ctx, 22, 16, 11, spin, v.color);
  wheel(ctx, 42, 16, 11, spin, v.color);
  ctx.fillStyle = v.color;
  ctx.strokeStyle = v.dark;
  ctx.lineWidth = 2;
  roundRect(ctx, -28, -6, 64, 18, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = v.dark;
  roundRect(ctx, -6, -16, 22, 12, 3);
  ctx.fill();
  riderBody(ctx, r, 8, -8, 24, -14);
  if (r.nitroOn) {
    ctx.fillStyle = '#fde047';
    ctx.fillRect(-40, 6, 10, 4);
  }
}

function drawBoat(ctx, r, time) {
  const v = r.vehicle;
  ctx.fillStyle = v.color;
  ctx.beginPath();
  ctx.moveTo(-40, 6);
  ctx.quadraticCurveTo(-10, 22, 46, 8);
  ctx.lineTo(36, -2);
  ctx.quadraticCurveTo(0, 8, -36, -2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = v.dark;
  ctx.beginPath();
  ctx.moveTo(6, -2);
  ctx.lineTo(28, -2);
  ctx.lineTo(22, -14);
  ctx.lineTo(10, -12);
  ctx.closePath();
  ctx.fill();
  riderBody(ctx, r, 0, -4, 18, -12);
  if (Math.abs(r.speed || 0) > 200) {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#bff7ff';
    ctx.beginPath();
    ctx.ellipse(-30, 14, 16, 5 + Math.sin(time * 20) * 2, -0.4, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawChute(ctx) {
  ctx.strokeStyle = 'rgba(248,250,252,.9)';
  ctx.fillStyle = 'rgba(248,250,252,.86)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-6, -10);
  ctx.lineTo(-28, -48);
  ctx.moveTo(8, -16);
  ctx.lineTo(28, -48);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-32, -46);
  ctx.quadraticCurveTo(0, -78, 32, -46);
  ctx.quadraticCurveTo(0, -36, -32, -46);
  ctx.fill();
}

function drawPine(ctx, night) {
  ctx.fillStyle = night ? '#14532d' : '#166534';
  ctx.beginPath();
  ctx.moveTo(0, -78);
  ctx.lineTo(22, -8);
  ctx.lineTo(-22, -8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = night ? '#166534' : '#22c55e';
  ctx.beginPath();
  ctx.moveTo(0, -58);
  ctx.lineTo(16, 0);
  ctx.lineTo(-16, 0);
  ctx.fill();
  ctx.fillStyle = '#6b3f24';
  ctx.fillRect(-3, 0, 6, 10);
}

function drawPalm(ctx) {
  ctx.strokeStyle = '#a16207';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.quadraticCurveTo(6, -20, -2, -48);
  ctx.stroke();
  ctx.strokeStyle = '#15803d';
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    const a = -2.4 + i * 0.7;
    ctx.beginPath();
    ctx.moveTo(-2, -48);
    ctx.quadraticCurveTo(Math.cos(a) * 16, -48 + Math.sin(a) * 10, Math.cos(a) * 28, -40 + Math.sin(a) * 16);
    ctx.stroke();
  }
}

function drawCactus(ctx) {
  ctx.fillStyle = '#3f7d4e';
  roundRect(ctx, -5, -46, 10, 52, 4);
  ctx.fill();
  roundRect(ctx, -18, -32, 14, 8, 3);
  ctx.fill();
  roundRect(ctx, 5, -24, 14, 8, 3);
  ctx.fill();
}

function drawRock(ctx, canyon) {
  ctx.fillStyle = canyon ? '#c46b4a' : '#6b7280';
  ctx.beginPath();
  ctx.moveTo(-18, 4);
  ctx.lineTo(-8, -16);
  ctx.lineTo(8, -12);
  ctx.lineTo(20, 4);
  ctx.closePath();
  ctx.fill();
}

function drawIce(ctx) {
  ctx.fillStyle = 'rgba(224,242,254,.95)';
  ctx.beginPath();
  ctx.moveTo(0, -40);
  ctx.lineTo(14, 4);
  ctx.lineTo(-14, 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#7dd3fc';
  ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
