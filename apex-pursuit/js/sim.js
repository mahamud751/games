// Game rules and physics. No three.js here, so it runs headless in Node for bot tests.
import { WALL, LANES, rng } from './track.js';

export const CARS = [
  { id: 'kestrel', name: 'Kestrel GT', cls: 'Street', price: 0, top: 64, accel: 12, grip: 17, nitro: 1, shape: 'coupe' },
  { id: 'vanta', name: 'Vanta R', cls: 'Sport', price: 15000, top: 69, accel: 13.5, grip: 18.5, nitro: 1.1, shape: 'fastback' },
  { id: 'sabre', name: 'Sabre S', cls: 'Sport', price: 28000, top: 73, accel: 15, grip: 19.5, nitro: 1.15, shape: 'wedge' },
  { id: 'halcyon', name: 'Halcyon RS', cls: 'Super', price: 46000, top: 78, accel: 16.5, grip: 21, nitro: 1.2, shape: 'gt' },
  { id: 'zero', name: 'Apex Zero', cls: 'Hyper', price: 80000, top: 85, accel: 18.5, grip: 23, nitro: 1.3, shape: 'hyper' },
];
export const carById = id => CARS.find(c => c.id === id) || CARS[0];

export const PAINTS = [
  { id: 'ember', name: 'Ember Orange', hex: '#ff5a1f' },
  { id: 'volt', name: 'Volt Lime', hex: '#b6f22e' },
  { id: 'ice', name: 'Glacier White', hex: '#e9eef5' },
  { id: 'cobalt', name: 'Cobalt Blue', hex: '#2563eb' },
  { id: 'crimson', name: 'Crimson', hex: '#d1122f' },
  { id: 'onyx', name: 'Onyx Black', hex: '#15171c' },
  { id: 'violet', name: 'Ultra Violet', hex: '#7c3aed' },
  { id: 'gold', name: 'Sunset Gold', hex: '#f5b31b' },
];

export const LOCATIONS = [
  { id: 'coast', name: 'Coastline Highway', short: 'COASTLINE', blurb: 'Ocean cliffs at golden hour.', seed: 1307, radius: 720, squash: 0.78, baseY: 22, hills: 9, traffic: 30 },
  { id: 'canyon', name: 'Red Rock Canyon', short: 'CANYON', blurb: 'Desert switchbacks at dusk.', seed: 4242, radius: 640, squash: 0.9, baseY: 14, hills: 14, traffic: 26 },
  { id: 'alpine', name: 'Alpine Pass', short: 'ALPINE', blurb: 'Lakeside pines, last light.', seed: 9001, radius: 680, squash: 0.85, baseY: 40, hills: 16, traffic: 28 },
];
export const locById = id => LOCATIONS.find(l => l.id === id) || LOCATIONS[0];

// The Wanted List: beat each racer to take their car.
export const RIVALS = [
  { rank: 5, name: 'Rook', tag: 'Corner-store kingpin', car: 'vanta', paint: '#14b8a6', loc: 'coast', skill: 0.83, laps: 1, need: 0, prize: 6000 },
  { rank: 4, name: 'Jinx', tag: 'Never lifts', car: 'sabre', paint: '#a855f7', loc: 'canyon', skill: 0.87, laps: 1, need: 4000, prize: 9000 },
  { rank: 3, name: 'Mara Voss', tag: 'Ice in her veins', car: 'halcyon', paint: '#e9eef5', loc: 'alpine', skill: 0.9, laps: 1, need: 12000, prize: 14000 },
  { rank: 2, name: 'Diesel', tag: 'Leaves paint on everyone', car: 'halcyon', paint: '#f5b31b', loc: 'coast', skill: 0.93, laps: 2, need: 25000, prize: 20000 },
  { rank: 1, name: 'Kaito Zero', tag: 'Untouchable', car: 'zero', paint: '#15171c', loc: 'canyon', skill: 0.96, laps: 2, need: 40000, prize: 40000 },
];

const TRAFFIC_TYPES = [
  { type: 'sedan', len: 4.6, w: 1.9, mass: 1 },
  { type: 'sedan', len: 4.6, w: 1.9, mass: 1 },
  { type: 'hatch', len: 4.0, w: 1.8, mass: 0.9 },
  { type: 'suv', len: 4.9, w: 2.0, mass: 1.3 },
  { type: 'van', len: 5.3, w: 2.1, mass: 1.6 },
  { type: 'truck', len: 9.5, w: 2.5, mass: 4 },
];
const TRAFFIC_COLORS = ['#cbd5e1', '#94a3b8', '#1f2937', '#7f1d1d', '#1e3a8a', '#e5e7eb', '#365314', '#78350f', '#0f766e', '#57534e'];

const HEAT_AT = [0, 0, 22, 55, 100, 160];
const COPS_AT = [0, 2, 3, 4, 5, 6];
const ASSIST = 0.55;

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

export function createGame({ track, mode, car, rival = null, seed = 7 }) {
  const R = rng(seed);
  const st = {
    track, mode, R, t: 0, id: 0, over: null,
    player: {
      kind: 'player', s: 0, x: 2, v: 0, psi: 0, vx: 0, steer: 0, drift: 0, nitro: 1, nitroOn: false,
      spiked: false, len: 4.5, w: 1.95, mass: 1, spec: car, dist: 0, rpm: 0, gear: 1, scrape: 0, hitT: 0
    },
    traffic: [], cops: [], blocks: [], spikes: [], rival: null,
    pursuit: false, heat: 0, heatPts: 0, bounty: 0, busted: 0, evade: 0,
    spawnT: 4, blockT: 18, patrolT: 22,
    goal: mode === 'race' ? rival.laps * track.length : 0,
    events: [],
    stats: { top: 0, takedowns: 0, near: 0, blocks: 0, cops: 0, crashes: 0 }
  };
  for (let i = 0; i < (mode === 'race' ? 24 : 30); i++) spawnTraffic(st, true);
  if (mode === 'race') {
    st.player.x = 2;
    st.rival = {
      kind: 'rival', s: 0, x: 6, v: 0, vx: 0, len: 4.5, w: 1.95, mass: 1, spec: carById(rival.car),
      info: rival, nitro: 1, nitroOn: false, dist: 0, steer: 0, yaw: 0, id: ++st.id
    };
  } else {
    // a patrol unit cruising ahead that kicks off the pursuit
    addCop(st, 380, 2, 23, 'patrol');
  }
  return st;
}

function emit(st, type, data = {}) { st.events.push(Object.assign({ type }, data)); }

function spawnTraffic(st, initial) {
  const p = st.player, R = st.R;
  const T = TRAFFIC_TYPES[R() * TRAFFIC_TYPES.length | 0];
  for (let tries = 0; tries < 12; tries++) {
    const lane = LANES[R() * 4 | 0];
    const s = initial ? p.s + 90 + R() * 1100 : p.s + 650 + R() * 350;
    const ok = st.traffic.every(o => Math.abs(st.track.delta(o.s, s)) > 16 || Math.abs(o.x - lane) > 2);
    if (!ok) continue;
    const dir = lane > 0 ? 1 : -1;
    const base = T.type === 'truck' ? 19 : 21 + R() * 6;
    const car = {
      kind: 'traffic', id: ++st.id, type: T.type, len: T.len, w: T.w, mass: T.mass,
      color: TRAFFIC_COLORS[R() * TRAFFIC_COLORS.length | 0],
      s: st.track.wrap(s), x: lane, lane, cruise: base * dir, v: base * dir, vx: 0, near: false, yaw: 0
    };
    if (initial) st.traffic.push(car);
    return car;
  }
  return null;
}

function addCop(st, gap, x, v, mode = 'chase') {
  const p = st.player;
  const cop = {
    kind: 'cop', id: ++st.id, s: st.track.wrap(p.s + gap), x, v, vx: 0, len: 4.8, w: 2, mass: 1.2,
    mode, dmg: 0, wrecked: false, wreckT: 0, spin: 0, yaw: 0, flip: 0, side: st.R() < 0.5 ? -1 : 1
  };
  st.cops.push(cop);
  return cop;
}

function startPursuit(st) {
  if (st.pursuit || st.mode !== 'pursuit') return;
  st.pursuit = true;
  st.heat = 1;
  for (const c of st.cops) c.mode = 'chase';
  // first backup unit rolls in from behind straight away
  addCop(st, -(150 + st.R() * 40), st.player.x > 4 ? 2 : 6, Math.max(18, st.player.v * 0.9));
  st.stats.cops += 2;
  emit(st, 'pursuit');
}

// lane picker shared by cops and the rival: stay put unless something is in the way
function pickLane(st, e, want, look) {
  const blocked = lane => {
    for (const o of st.traffic) {
      if (Math.abs(o.x - lane) > 2.3) continue;
      const d = st.track.delta(e.s, o.s);
      const closing = e.v - o.v;
      if (d > -4 && d < look + Math.max(0, closing) * 0.9) return d;
    }
    for (const b of st.blocks) {
      if (Math.abs(b.x - lane) > 3) continue;
      const d = st.track.delta(e.s, b.s);
      if (d > -4 && d < look + e.v * 0.8) return d;
    }
    return Infinity;
  };
  const here = blocked(e.x);
  if (here === Infinity && Math.abs(want - e.x) < 0.5) return want;
  let best = want, bestScore = -Infinity;
  for (const lane of LANES) {
    const free = blocked(lane);
    const score = Math.min(free, 400) - Math.abs(lane - e.x) * 6 - Math.abs(lane - want) * 2 - (lane < 0 && free < 200 ? 50 : 0);
    if (score > bestScore) { bestScore = score; best = lane; }
  }
  return best;
}

function steerTo(e, tx, dt, rate = 7) {
  const want = clamp((tx - e.x) * 2.2, -rate, rate);
  e.vx += (want - e.vx) * Math.min(1, dt * 4);
}

export function update(st, input, dt) {
  // after the result the world keeps rolling for the outro, the player just lifts off
  if (st.over) input = { throttle: 0, brake: 0.5, steer: 0, nitro: false, handbrake: false };
  else st.t += dt;
  const tr = st.track, p = st.player, spec = p.spec;
  const smp = tr.sample(p.s);

  // ---- player drive ----
  let top = spec.top * (p.spiked ? 0.55 : 1);
  let accel = spec.accel * (p.spiked ? 0.6 : 1);
  p.nitroOn = !!(input.nitro && p.nitro > 0.01 && input.throttle > 0 && p.v > 5);
  if (p.nitroOn) {
    p.nitro = Math.max(0, p.nitro - dt / (4.5 * spec.nitro));
    top *= 1.2;
    accel += 9;
  } else {
    p.nitro = Math.min(1, p.nitro + dt * 0.03);
  }
  let a = 0;
  if (input.throttle > 0) {
    a += p.v < top ? accel * input.throttle * Math.max(0.12, 1 - (p.v / top) ** 2) : -(p.v - top) * 0.9;
  }
  if (input.brake > 0) {
    if (p.v > 1) a -= 26 * input.brake;
    else if (p.v > -12) a -= 7 * input.brake;
  }
  if (!input.throttle && !input.brake) a -= Math.sign(p.v) * Math.min(Math.abs(p.v) / dt, 2.2);
  a -= 0.00042 * p.v * Math.abs(p.v) + smp.g * 5.5;
  const handbrake = input.handbrake && Math.abs(p.v) > 14;
  if (handbrake) a -= 5;
  p.v += a * dt;
  if (Math.abs(p.v) < 0.05 && !input.throttle && !input.brake) p.v = 0;

  p.steer += (clamp(input.steer, -1, 1) - p.steer) * Math.min(1, dt * 7);
  const spd = Math.abs(p.v);
  const lat = spec.grip * (p.spiked ? 0.55 : 1);
  let yaw = p.steer * Math.min(1.5, lat / Math.max(spd, 6)) * Math.sign(p.v || 1);
  if (handbrake) yaw *= 1.7;
  const driftTarget = handbrake || (Math.abs(p.steer) > 0.85 && spd > 45) ? -p.steer * (handbrake ? 0.6 : 0.25) : 0;
  p.drift += (driftTarget - p.drift) * Math.min(1, dt * (driftTarget ? 3 : 4));
  if (Math.abs(p.drift) > 0.18 && spd > 20) {
    p.nitro = Math.min(1, p.nitro + dt * 0.11);
    if (st.mode === 'pursuit' && st.pursuit) st.bounty += Math.round(dt * 40);
  }
  const centre = Math.abs(input.steer) < 0.1 ? 1.6 : 0.25;
  const vsNow = p.v * Math.cos(p.psi);
  p.psi += (smp.k * vsNow * (1 - ASSIST) + yaw - p.psi * centre) * dt;
  p.psi = clamp(p.psi, -1.1, 1.1);
  let vs = p.v * Math.cos(p.psi);
  let vx = p.v * Math.sin(p.psi);
  p.s = tr.wrap(p.s + vs * dt);
  p.x += vx * dt;
  p.dist += vs * dt;
  p.vs = vs; p.vx = vx;
  p.hitT = Math.max(0, p.hitT - dt);

  const lim = WALL - p.w / 2 - 0.1;
  p.scrape = 0;
  if (Math.abs(p.x) > lim) {
    const hit = Math.abs(vx);
    p.x = Math.sign(p.x) * lim;
    if (hit > 3) {
      p.v *= Math.max(0.55, 1 - hit * 0.025);
      if (hit > 8) { emit(st, 'wall', { power: hit }); st.stats.crashes++; }
    }
    p.psi *= -0.25;
    p.scrape = Math.min(1, spd / 40);
  }
  st.stats.top = Math.max(st.stats.top, spd);
  // gear + rpm for the HUD and engine note
  const ratio = clamp(Math.abs(p.v) / (spec.top * 1.2), 0, 1);
  const gear = Math.min(6, 1 + Math.floor(ratio * 6.2));
  const inGear = ratio * 6.2 - (gear - 1);
  p.gear = p.v < -0.5 ? 0 : gear;
  p.rpm = clamp(0.18 + inGear * 0.8 + (input.throttle && spd < 2 ? 0.25 : 0), 0.12, 1);

  // ---- traffic ----
  for (const c of st.traffic) {
    const dir = Math.sign(c.cruise);
    let want = c.cruise;
    for (const o of st.traffic) {
      if (o === c || Math.abs(o.x - c.x) > 2.2) continue;
      const d = tr.delta(c.s, o.s) * dir;
      if (d > 0 && d < 28) want = dir * Math.min(Math.abs(want), Math.max(0, o.v * dir - (28 - d) * 0.3));
    }
    c.v += clamp(want - c.v, -9 * dt, 4 * dt);
    c.vx *= Math.max(0, 1 - dt * 3);
    c.x += c.vx * dt + (c.lane - c.x) * Math.min(1, dt * 0.8);
    c.s = tr.wrap(c.s + c.v * dt);
    c.yaw = Math.atan2(c.vx, Math.abs(c.v) + 1) * dir;
    const d = tr.delta(p.s, c.s);
    if (d < -380 || d > 1300) respawnTraffic(st, c);
  }

  if (st.mode === 'pursuit') updatePursuit(st, dt);
  if (st.rival) updateRival(st, dt);

  collisions(st, dt);
  nearMisses(st);

  if (st.mode === 'race' && !st.over) {
    const r = st.rival;
    if (p.dist >= st.goal) st.over = r.dist >= st.goal ? 'lose' : 'win';
    else if (r.dist >= st.goal) st.over = 'lose';
    if (st.over) emit(st, st.over);
  }
}

function respawnTraffic(st, c) {
  const n = spawnTraffic(st, false);
  if (!n) { c.s = st.track.wrap(st.player.s + 900 + st.R() * 300); return; }
  Object.assign(c, n, { id: c.id });
}

function updatePursuit(st, dt) {
  const tr = st.track, p = st.player;
  if (!st.pursuit) {
    st.patrolT -= dt;
    for (const c of st.cops) {
      const d = tr.delta(p.s, c.s);
      if (Math.abs(d) < 45 && Math.abs(p.v) > 26) startPursuit(st);
    }
    if (st.patrolT <= 0) { addCop(st, -220, p.x > 0 ? 6 : 2, p.v); startPursuit(st); }
  } else {
    st.heatPts += dt;
    st.bounty += Math.round(dt * 15 * st.heat);
    while (st.heat < 5 && st.heatPts >= HEAT_AT[st.heat + 1]) {
      st.heat++;
      emit(st, 'heat', { heat: st.heat });
    }
  }

  const active = st.cops.filter(c => !c.wrecked);
  // backup is only radioed in while a unit still has eyes on you
  const eyes = active.some(c => c.mode !== 'patrol' && Math.abs(tr.delta(p.s, c.s)) < 330);
  if (st.pursuit) {
    st.spawnT -= dt;
    if (st.spawnT <= 0 && eyes && active.length < COPS_AT[st.heat]) {
      st.spawnT = 5.5 - st.heat * 0.5;
      st.stats.cops++;
      if (st.R() < 0.3) {
        const c = addCop(st, 320 + st.R() * 80, -6 + (st.R() < 0.5 ? 4 : 0), -26, 'intercept');
        c.yaw = Math.PI;
      } else {
        addCop(st, -(170 + st.R() * 80), LANES[2 + (st.R() * 2 | 0)], Math.max(20, p.v * 0.95));
      }
    }
    if (st.heat >= 3) {
      st.blockT -= dt;
      if (st.blockT <= 0) { st.blockT = 34 - st.heat * 3; roadblock(st); }
    }
  }

  const copTop = 52 + st.heat * 6;
  for (const c of st.cops) {
    if (c.wrecked) {
      c.wreckT += dt;
      c.v += clamp(-c.v, -20 * dt, 20 * dt);
      c.vx *= Math.max(0, 1 - dt * 2);
      c.spin *= Math.max(0, 1 - dt * 1.5);
      c.yaw += c.spin * dt;
      c.s = tr.wrap(c.s + c.v * dt);
      c.x = clamp(c.x + c.vx * dt, -WALL + 1, WALL - 1);
      continue;
    }
    const gap = tr.delta(c.s, p.s);
    let tv, tx;
    if (c.mode === 'patrol') {
      tv = 23; tx = 2;
    } else if (c.mode === 'intercept') {
      tv = -28; tx = c.x;
      if (gap > 4) { // passed the player: swing round and give chase
        c.mode = 'chase'; c.v = 6; c.yaw = 0; emit(st, 'uturn', { id: c.id });
      }
    } else {
      if (gap > 16) tv = Math.min(gap > 260 ? copTop * 1.04 : copTop, p.vs + 5 + gap * 0.14);
      else if (gap > -7) tv = p.vs + (gap > 4 ? 4 : 1.5);
      else tv = Math.max(8, p.vs - 7);
      tx = gap > 30 ? pickLane(st, c, clamp(p.x, -6, 6), 40) : p.x + (gap > -7 && gap < 7 ? -c.side * 0.4 : 0);
    }
    const acc = tv > c.v ? 15 + st.heat : 24;
    c.v += clamp(tv - c.v, -acc * dt, acc * dt);
    if (c.mode !== 'intercept') steerTo(c, tx, dt, 8);
    c.s = tr.wrap(c.s + c.v * dt);
    c.x += c.vx * dt;
    const lim = WALL - c.w / 2 - 0.1;
    if (Math.abs(c.x) > lim) {
      if (Math.abs(c.vx) > 5) hurtCop(st, c, Math.abs(c.vx) * 2.5);
      c.x = Math.sign(c.x) * lim; c.vx *= -0.3;
    }
    c.yaw = c.mode === 'intercept' ? Math.PI : Math.atan2(c.vx, Math.abs(c.v) + 2);
  }
  // clear out wrecks and anything left far behind
  st.cops = st.cops.filter(c => {
    const d = tr.delta(p.s, c.s);
    if (c.wrecked) return c.wreckT < 9 && d > -260;
    if (d < -700 || d > 900) return false;
    return true;
  });
  for (const b of st.blocks) {
    if (!b.passed && tr.delta(p.s, b.s) < -6) {
      b.passed = true;
      if (b.lead && !b.hit) { st.bounty += 1500; st.stats.blocks++; emit(st, 'dodge'); }
    }
  }
  st.blocks = st.blocks.filter(b => tr.delta(p.s, b.s) > -220);
  st.spikes = st.spikes.filter(k => tr.delta(p.s, k.s) > -220);
  for (const k of st.spikes) {
    if (!p.spiked && Math.abs(tr.delta(p.s, k.s)) < 2.5 && p.x + p.w / 2 > k.x0 && p.x - p.w / 2 < k.x1) {
      p.spiked = true;
      emit(st, 'spiked');
    }
  }

  if (!st.pursuit || st.over) return;
  const live = st.cops.filter(c => !c.wrecked);
  let near = false, inRange = false;
  for (const c of live) {
    const d = Math.abs(tr.delta(p.s, c.s));
    if (d < 14 && Math.abs(c.x - p.x) < 6) near = true;
    if (d < 330) inRange = true;
  }
  for (const b of st.blocks) if (Math.abs(tr.delta(p.s, b.s)) < 14) near = true;
  if (near && Math.abs(p.v) < 7) st.busted = Math.min(1, st.busted + dt / 3);
  else st.busted = Math.max(0, st.busted - dt * 0.7);
  if (!inRange) st.evade = Math.min(1, st.evade + dt / (6.5 + st.heat * 1.5));
  else st.evade = Math.max(0, st.evade - dt * 1.5);
  if (st.busted >= 1) { st.over = 'busted'; emit(st, 'busted'); }
  else if (st.evade >= 1) { st.over = 'escaped'; emit(st, 'escaped'); }
}

function roadblock(st) {
  const tr = st.track, p = st.player;
  const s = tr.wrap(p.s + 700);
  const gap = 1 + (st.R() * 3 | 0);
  let first = true;
  for (let i = 0; i < 4; i++) {
    if (i === gap) continue;
    st.blocks.push({ kind: 'block', id: ++st.id, s, x: LANES[i], v: 0, vx: 0, len: 2.1, w: 4.8, mass: 50, yaw: Math.PI / 2 * (i % 2 ? 1 : -1), lead: first, hit: false });
    first = false;
  }
  if (st.heat >= 4 || st.R() < 0.4) st.spikes.push({ s: tr.wrap(s - 4), x0: LANES[gap] - 2, x1: LANES[gap] + 2 });
  emit(st, 'roadblock');
}

function hurtCop(st, c, amount) {
  if (c.wrecked) return;
  c.dmg += amount;
  if (c.dmg >= 100) {
    c.wrecked = true;
    c.spin = (st.R() < 0.5 ? -1 : 1) * (4 + st.R() * 4);
    c.flip = st.R() < 0.35 ? 1 : 0;
    if (st.pursuit) {
      st.stats.takedowns++;
      const gain = 2000 + 600 * st.heat;
      st.bounty += gain;
      st.heatPts += 8;
      emit(st, 'takedown', { gain, id: c.id });
    }
  }
}

function updateRival(st, dt) {
  const tr = st.track, r = st.rival, p = st.player, spec = r.spec;
  let corner = Infinity;
  for (const ahead of [20, 50, 90, 140]) {
    const k = Math.abs(tr.sample(r.s + ahead).k);
    if (k > 1e-4) corner = Math.min(corner, Math.sqrt(spec.grip * 1.25 / k) + ahead * 0.12);
  }
  let top = spec.top * r.info.skill;
  const lead = r.dist - p.dist;
  if (lead < -50) top *= 1 + Math.min(0.14, -lead / 1500);
  if (lead > 60) top *= 0.9;
  r.nitroOn = r.nitro > 0.05 && corner > top * 1.1 && lead < 80 && r.v > 25;
  if (r.nitroOn) { top *= 1.15; r.nitro -= dt / 5; } else r.nitro = Math.min(1, r.nitro + dt * 0.04);
  const tv = Math.min(top * (r.nitroOn ? 1.15 : 1), corner);
  const acc = tv > r.v ? spec.accel * Math.max(0.15, 1 - (r.v / (spec.top * 1.15)) ** 2) + (r.nitroOn ? 8 : 0) : 20;
  r.v += clamp(tv - r.v, -acc * dt, acc * dt);
  const tx = pickLane(st, r, r.x > 0 ? (r.x > 4 ? 6 : 2) : 2, 55);
  steerTo(r, tx, dt, 6.5);
  r.s = tr.wrap(r.s + r.v * dt);
  r.dist += r.v * dt;
  r.x = clamp(r.x + r.vx * dt, -WALL + 1.1, WALL - 1.1);
  r.yaw = Math.atan2(r.vx, r.v + 2);
}

function collisions(st, dt) {
  const tr = st.track, p = st.player;
  const bodies = [p];
  if (st.rival) bodies.push(st.rival);
  for (const c of st.cops) bodies.push(c);
  for (const b of st.blocks) bodies.push(b);
  for (const c of st.traffic) bodies.push(c);
  const near = bodies.filter(b => Math.abs(tr.delta(p.s, b.s)) < 260);
  // player keeps v/psi; give it working s/x velocities for the solver
  p.vsC = p.vs; p.vxC = p.vx;
  for (const b of near) if (b !== p) { b.vsC = b.v; b.vxC = b.vx; }
  for (let i = 0; i < near.length; i++) {
    for (let j = i + 1; j < near.length; j++) {
      const a = near[i], b = near[j];
      if (a.kind === 'traffic' && b.kind === 'traffic') continue;
      const ds = tr.delta(a.s, b.s);
      if (Math.abs(ds) > 12) continue;
      const dx = b.x - a.x;
      const ox = (a.w + b.w) / 2 - Math.abs(dx);
      const os = (a.len + b.len) / 2 - Math.abs(ds);
      if (ox <= 0 || os <= 0) continue;
      const ia = 1 / a.mass, ib = 1 / b.mass;
      let impact;
      if (os < ox) {
        const n = Math.sign(ds) || 1;
        const rel = (a.vsC - b.vsC) * n;
        impact = Math.max(0, rel);
        if (rel > 0) {
          const j = 1.25 * rel / (ia + ib);
          a.vsC -= j * ia * n; b.vsC += j * ib * n;
        }
        a.s = tr.wrap(a.s - n * os * ia / (ia + ib));
        b.s = tr.wrap(b.s + n * os * ib / (ia + ib));
      } else {
        const n = Math.sign(dx) || 1;
        const rel = (a.vxC - b.vxC) * n;
        impact = Math.max(0, rel);
        if (rel > 0) {
          const j = 1.4 * rel / (ia + ib);
          a.vxC -= j * ia * n; b.vxC += j * ib * n;
        }
        a.x -= n * ox * ia / (ia + ib);
        b.x += n * ox * ib / (ia + ib);
        // trading paint scrubs a little speed
        const avg = (a.vsC + b.vsC) / 2;
        a.vsC += (avg - a.vsC) * 0.08; b.vsC += (avg - b.vsC) * 0.08;
      }
      contact(st, a, b, impact);
    }
  }
  for (const b of near) {
    if (b === p) continue;
    if (b.kind === 'block') continue;
    b.v = b.vsC; b.vx = b.vxC;
  }
  if (p.vsC !== p.vs || p.vxC !== p.vx) {
    const sp = Math.hypot(p.vsC, p.vxC) * Math.sign(p.vsC || 1);
    p.v = Math.min(sp, Math.max(p.v, p.spec.top * 1.2));
    p.psi = clamp(Math.atan2(p.vxC, Math.abs(p.vsC) + 0.01), -0.7, 0.7);
  }
}

function contact(st, a, b, impact) {
  const p = st.player;
  const pair = (k1, k2) => (a.kind === k1 && b.kind === k2) ? [a, b] : (a.kind === k2 && b.kind === k1) ? [b, a] : null;
  let m;
  if ((m = pair('player', 'cop'))) {
    const cop = m[1];
    if (cop.mode === 'patrol') startPursuit(st);
    if (impact > 3) hurtCop(st, cop, impact * 3.4);
    if (st.pursuit && impact > 2) st.heatPts += 0.5;
  } else if ((m = pair('cop', 'traffic'))) {
    if (impact > 6) hurtCop(st, m[0], impact * 2);
  } else if ((m = pair('cop', 'cop'))) {
    if (impact > 6) { hurtCop(st, m[0], impact * 1.5); hurtCop(st, m[1], impact * 1.5); }
  } else if ((m = pair('player', 'block'))) {
    for (const b of st.blocks) if (Math.abs(st.track.delta(b.s, m[1].s)) < 1) b.hit = true;
  } else if ((m = pair('player', 'traffic'))) {
    if (impact > 3 && st.pursuit) st.bounty += 100;
  }
  if ((a === p || b === p) && impact > 2 && p.hitT <= 0) {
    p.hitT = 0.25;
    const other = a === p ? b : a;
    emit(st, 'crash', { power: impact, with: other.kind });
    if (impact > 8) st.stats.crashes++;
  }
}

function nearMisses(st) {
  const tr = st.track, p = st.player;
  if (Math.abs(p.v) < 28) return;
  for (const c of st.traffic) {
    if (c.near) continue;
    const d = tr.delta(p.s, c.s);
    if (Math.abs(d) > (p.len + c.len) / 2) continue;
    const gap = Math.abs(c.x - p.x) - (p.w + c.w) / 2;
    if (gap > 0 && gap < 0.95 && Math.abs(p.vs - c.v) > 12) {
      c.near = true;
      st.stats.near++;
      p.nitro = Math.min(1, p.nitro + 0.08);
      const gain = st.pursuit ? 500 : 250;
      st.bounty += gain;
      emit(st, 'near', { gain, oncoming: c.v < 0 });
    }
  }
}

export const HEAT_COLORS = ['#94a3b8', '#facc15', '#fb923c', '#f97316', '#ef4444', '#dc2626'];
