// Padel simulation: ball physics, rules, scoring and AI. No rendering here.
// Court space (metres): x runs along the court (-10..10, net at 0, your team on x<0),
// y runs across it (0..10), z is height.
export const C = { HALF: 10, WIDTH: 10, NET_H: 0.9, WALL_H: 3, SERVICE: 6.95, GLASS_X: 8, G: 9.8, REACH: 1.2 };
const { HALF, WIDTH, NET_H, WALL_H, SERVICE, GLASS_X, G, REACH } = C;

export const SKILL = {
  easy: { speed: 3.7, react: 0.34, err: 1.5, mistake: 0.13, smash: 0.4, judge: 0.7, pace: 0.9 },
  medium: { speed: 4.2, react: 0.25, err: 1.0, mistake: 0.08, smash: 0.65, judge: 0.45, pace: 1 },
  hard: { speed: 4.7, react: 0.18, err: 0.65, mistake: 0.05, smash: 0.85, judge: 0.3, pace: 1.1 },
  pro: { speed: 5.1, react: 0.13, err: 0.45, mistake: 0.035, smash: 0.95, judge: 0.2, pace: 1.16 },
};

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pick = a => a[Math.random() * a.length | 0];
export const side = team => team === 0 ? -1 : 1;
const PT = ['0', '15', '30', '40'];
export const pointLabel = n => PT[Math.min(3, n)];

function makePlayer(team, idx, human) {
  return { team, idx, human, x: 0, y: 0, vx: 0, vy: 0, face: team ? -1 : 1, swing: null, armed: null, cool: 0, react: 0, target: null, mood: 0, moodT: 0, anim: 0, seenHit: -1 };
}

export function createMatch(o) {
  const M = {
    skill: SKILL[o.skill] || SKILL.medium, games: o.games || 4, assist: o.assist || 'light',
    racket: o.racket || { pace: 1, control: 1 }, training: !!o.training,
    players: [makePlayer(0, 0, true), makePlayer(0, 1, false), makePlayer(1, 0, false), makePlayer(1, 1, false)],
    ball: { x: 0, y: 5, z: 1, vx: 0, vy: 0, vz: 0, live: false, kill: 0 },
    rally: null, points: [0, 0], gamesWon: [0, 0], serveTeam: 0, serveSide: 0, serverIdx: [0, 0],
    state: 'intro', stateT: 0, landing: null, hits: 0, ev: [],
    stats: { winners: 0, perfect: 0, longest: 0, pointsWon: 0, smashes: 0 },
    time: 0,
  };
  if (M.training) {
    M.players = [M.players[0]];
    Object.assign(M.training = {}, { left: 60, score: 0, combo: 0, best: 0, feedT: 1.2, targets: [], hitsOk: 0, shots: 0 });
    M.state = 'training';
    place(M.players[0], -7, 5);
    newTargets(M);
  } else resetPositions(M);
  return M;
}

const teamPlayer = (M, team, idx) => M.players.find(p => p.team === team && p.idx === idx);
const laneY = idx => idx === 0 ? 2.6 : 7.4;
function place(p, x, y) { p.x = x; p.y = y; p.vx = p.vy = 0; }

function resetPositions(M) {
  const st = M.serveTeam, rt = 1 - st;
  const sy = M.serveSide === 0 ? 2.6 : 7.4, ry = M.serveSide === 0 ? 7.4 : 2.6;
  const server = teamPlayer(M, st, M.serverIdx[st]);
  const sMate = teamPlayer(M, st, 1 - M.serverIdx[st]);
  const receiver = M.players.find(p => p.team === rt && Math.abs(laneY(p.idx) - ry) < 1) || teamPlayer(M, rt, 0);
  const rMate = M.players.find(p => p.team === rt && p !== receiver);
  place(server, side(st) * 9.2, sy);
  place(sMate, side(st) * 3.2, ry);
  place(receiver, side(rt) * 8.6, ry);
  place(rMate, side(rt) * 5.2, sy);
  M.server = server; M.receiver = receiver;
  Object.assign(M.ball, { x: server.x + server.face * 0.45, y: server.y + 0.3, z: 0.9, vx: 0, vy: 0, vz: 0, live: false, kill: 0 });
  M.rally = null; M.landing = null; M.hits = 0;
  for (const p of M.players) { p.swing = null; p.armed = null; p.cool = 0; p.target = null; p.mood = 0; }
}

// ---------- ball ----------
export function stepBall(b, dt, on) {
  b.vz -= G * dt;
  const ox = b.x;
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  if ((ox < 0) !== (b.x < 0) && b.y > 0 && b.y < WIDTH) {
    if (b.z < NET_H + Math.abs(b.y - 5) * 0.004) {
      b.x = ox < 0 ? -0.05 : 0.05; b.vx *= -0.15; b.vy *= 0.3; b.vz = Math.min(b.vz, 0) * 0.3;
      if (on) on('net', b);
    } else if (on) on('cross', b);
  }
  if (b.z < 0) {
    b.z = 0;
    const v = -b.vz;
    b.vz = v * 0.72; b.vx *= 0.86; b.vy *= 0.86;
    if (b.kill && Math.sign(b.x) === b.kill) { b.vz = 12.5; b.vx *= 1.15; b.kill = 0; }
    if (v < 0.6) b.vz = 0;
    if (on) on('floor', b, v);
  }
  for (const s of [-1, 1]) {
    if (b.x * s > HALF) {
      if (b.z < WALL_H) { b.x = s * HALF; b.vx = -b.vx * 0.68; b.vz *= 0.92; if (on) on('wall', b, s, 'glass'); }
      else if (on) on('out', b);
    }
  }
  for (const yy of [0, WIDTH]) {
    const over = yy === 0 ? b.y < 0 : b.y > WIDTH;
    if (!over) continue;
    if (b.z < WALL_H) {
      const glass = Math.abs(b.x) > GLASS_X;
      b.y = yy; b.vy = -b.vy * (glass ? 0.66 : 0.32);
      if (!glass) { b.vx *= 0.7; b.vz *= 0.7; }
      if (on) on('wall', b, Math.sign(b.x) || 1, glass ? 'glass' : 'fence');
    } else if (on) on('out', b);
  }
}

function predict(b, seconds) {
  const s = { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, kill: b.kill };
  const out = [];
  let bounces = 0, first = null;
  for (let t = 0; t < seconds; t += 1 / 60) {
    let ev = false;
    const on = k => { if (k === 'floor') ev = true; };
    stepBall(s, 1 / 120, on); stepBall(s, 1 / 120, on);
    if (ev) { bounces++; if (!first) first = { x: s.x, y: s.y }; }
    out.push({ t: t + 1 / 60, x: s.x, y: s.y, z: s.z, bounces });
  }
  return { path: out, first };
}

// ---------- rules ----------
function onBall(M, kind, b, a, c) {
  if (kind === 'net') { M.ev.push({ t: 'net' }); }
  if (kind === 'floor') { if (a > 1.2) M.ev.push({ t: 'bounce', v: a, x: b.x, y: b.y }); }
  if (kind === 'wall') M.ev.push({ t: c, v: Math.hypot(b.vx, b.vy, b.vz), x: b.x, y: b.y, z: b.z });
  if (M.training) return trainingBall(M, kind, b);
  const r = M.rally;
  if (!r || M.state !== 'rally') return;
  const hitter = r.team, recv = 1 - r.team;
  if (kind === 'cross') { r.crossed = Math.sign(b.x) === side(recv); if (r.crossed) r.ever = true; return; }
  if (kind === 'floor') {
    const s = b.x < 0 ? 0 : 1;
    if (s === hitter) {
      if (!r.ever) return endPoint(M, recv, r.serve ? 'FAULT' : 'NET');
      return endPoint(M, hitter, 'WINNER');
    }
    r.bounces++;
    if (r.serve && r.bounces === 1) {
      const boxX = Math.abs(b.x) <= SERVICE, boxY = (b.y > 5) === (M.serveSide === 0);
      if (!boxX || !boxY) return endPoint(M, recv, 'FAULT');
    }
    if (r.bounces >= 2) return endPoint(M, hitter, r.hits > 0 ? 'WINNER' : 'ACE');
    return;
  }
  if (kind === 'wall') {
    const s = a < 0 ? 0 : 1;
    if (s === recv && r.bounces === 0) return endPoint(M, recv, 'OUT');
    return;
  }
  if (kind === 'out') {
    if (r.bounces >= 1) return endPoint(M, hitter, 'OUT OF COURT!');
    return endPoint(M, recv, 'OUT');
  }
}

function endPoint(M, winner, reason) {
  if (M.state !== 'rally') return;
  M.state = 'point'; M.stateT = 0;
  const r = M.rally;
  const hits = r ? r.hits : 0;
  M.stats.longest = Math.max(M.stats.longest, hits + 1);
  if (winner === 0) M.stats.pointsWon++;
  if (winner === 0 && (reason === 'WINNER' || reason === 'OUT OF COURT!' || reason === 'ACE')) M.stats.winners++;
  for (const p of M.players) { p.mood = p.team === winner ? 1 : -1; p.moodT = 0; p.armed = null; }
  const game = addPoint(M, winner);
  const label = reason === 'WINNER' ? (winner === 0 ? pick(['WINNER!', 'GREAT SHOT!', 'UNSTOPPABLE!']) : 'THEIR POINT') : reason;
  M.ev.push({ t: 'point', winner, reason, label, big: hits > 7 || reason === 'OUT OF COURT!', game, hits: hits + 1 });
}

function addPoint(M, team) {
  M.points[team]++;
  if (M.points[team] >= 4) return winGame(M, team); // golden point at 40-40
  M.serveSide = 1 - M.serveSide;
  return null;
}
function winGame(M, team) {
  M.gamesWon[team]++;
  M.points = [0, 0];
  M.serveSide = 0;
  M.serverIdx[M.serveTeam] = 1 - M.serverIdx[M.serveTeam];
  M.serveTeam = 1 - M.serveTeam;
  if (M.gamesWon[team] >= M.games) M.matchWon = team;
  return team;
}

// ---------- shots ----------
function launch(b, tx, ty, T) {
  for (let k = 0; k < 8; k++) {
    const vx = (tx - b.x) / T, vy = (ty - b.y) / T, vz = (-b.z + 0.5 * G * T * T) / T;
    const tn = (0 - b.x) / vx;
    const zn = tn > 0 && tn < T ? b.z + vz * tn - 0.5 * G * tn * tn : 9;
    if (zn > NET_H + 0.25 || k === 7) return { vx, vy, vz };
    T *= 1.12;
  }
}

function hitBall(M, p, type, quality, aim) {
  const b = M.ball, opp = side(1 - p.team), sk = M.skill, rk = M.racket;
  const perfect = p.human && quality > 0.7;
  const err = p.human ? ((1 - quality) * 1.5 + 0.22) / rk.control : sk.err * (p.team === 0 ? 0.8 : 1);
  const power = p.human ? (perfect ? 1.16 : 0.84 + quality * 0.3) * rk.pace : sk.pace;
  let tx, ty = aim.y, T;
  const dist = () => Math.hypot(tx - b.x, ty - b.y);
  const deep = aim.deep || 0;
  if (type === 'smash' || type === 'power') { tx = opp * rand(4, 6.5); T = dist() / (24 * power * (type === 'power' ? 1.12 : 1)); }
  else if (type === 'lob') { tx = opp * rand(8.2, 9.4); T = 1.65 + rand(0, 0.3); }
  else if (type === 'serve') { tx = opp * rand(3.6, 6.2); T = dist() / 12.5; }
  else if (type === 'volley') { tx = opp * (rand(5, 7.5) + deep * 1.2); T = dist() / (14 * power); }
  else { tx = opp * (rand(5.5, 8.6) + deep * 0.8); T = dist() / (16.5 * power); }
  const e2 = type === 'serve' ? err * 0.3 : err;
  tx += rand(-e2, e2) * 0.7; ty += rand(-e2, e2);
  if (type === 'serve') ty = aim.y > 5 ? clamp(ty, 5.5, 9.3) : clamp(ty, 0.7, 4.5);
  else ty = clamp(ty, 0.6, WIDTH - 0.6);
  tx = clamp(tx, -11.5, 11.5);

  // misses get likelier under pressure: a fast ball, a stretch, a long rally
  const incoming = Math.hypot(b.vx, b.vy, b.vz);
  const stretch = clamp(Math.hypot(b.x - p.x, (b.y - p.y) * 1.25) / REACH, 0, 1);
  const rallyLen = M.rally ? M.rally.hits : 0;
  let miss = 0;
  if (type !== 'serve') {
    miss = p.human ? (quality < 0.12 ? 0.4 : type === 'power' ? 0.1 : 0.012)
      : sk.mistake + 0.1 * stretch * stretch + Math.max(0, incoming - 12) * 0.007 + (type === 'smash' ? 0.05 : 0) + Math.min(0.06, rallyLen * 0.004);
  }
  const missed = Math.random() < miss;
  let v;
  if (missed && Math.random() < 0.45) {
    const T2 = 0.45, nx = opp * 0.8;
    v = { vx: (nx - b.x) / T2, vy: (ty - b.y) / T2, vz: (Math.min(b.z, 0.5) - b.z + 0.5 * G * T2 * T2 * 0.3) / T2 };
  } else {
    if (missed) tx = opp * rand(10.4, 11.2);
    v = launch(b, tx, ty, Math.max(0.28, T));
  }
  const smashy = type === 'smash' || type === 'power';
  if (smashy && !missed) {
    v.vz = Math.min(v.vz, -2);
    const tn = -b.x / v.vx;
    if (tn > 0 && b.z + v.vz * tn - 0.5 * G * tn * tn < NET_H + 0.2) Object.assign(v, launch(b, tx, ty, Math.max(0.28, T)));
  }
  Object.assign(b, v);
  b.live = true; b.kill = 0;
  if (smashy && !missed && Math.abs(b.x) < 5.5) {
    const killChance = p.human ? (type === 'power' ? (quality > 0.45 ? 1 : 0.3) : perfect ? 0.5 : 0) : (sk.pace - 0.9) * 0.9;
    if (Math.random() < killChance) b.kill = opp;
  }
  const r = M.rally;
  if (r) Object.assign(r, { team: p.team, bounces: 0, crossed: false, ever: false, serve: false, lastType: type, missed }), r.hits++;
  else M.rally = { team: p.team, bounces: 0, crossed: false, ever: false, hits: 0, serve: type === 'serve', lastType: type };
  M.hits++;
  p.cool = 0.35;
  if (smashy && p.team === 0 && p.human) M.stats.smashes++;
  if (perfect) M.stats.perfect++;
  M.ev.push({ t: 'hit', p, type, perfect, kill: !!b.kill, quality, x: b.x, y: b.y, z: b.z });
  M.landing = null;
}

function chooseShot(M, p) {
  const b = M.ball, opps = M.players.filter(o => o.team !== p.team);
  const oppsAtNet = opps.every(o => Math.abs(o.x) < 5);
  if (b.z > 1.75 && Math.abs(b.x) < 7 && Math.random() < M.skill.smash) return 'smash';
  if (oppsAtNet && Math.random() < 0.55) return 'lob';
  if (Math.abs(b.x) > 8 && b.z < 1 && Math.random() < 0.35) return 'lob';
  return Math.abs(p.x) < 4.5 ? 'volley' : 'drive';
}
function gapY(M, p) {
  const opps = M.players.filter(o => o.team !== p.team);
  if (!opps.length) return rand(1.5, 8.5);
  let best = 5, bestD = -1;
  for (let y = 1; y <= 9; y += 0.5) {
    const d = Math.min(...opps.map(o => Math.abs(o.y - y)));
    if (d > bestD) { bestD = d; best = y; }
  }
  return best;
}
function aiAim(M, p) {
  const best = gapY(M, p);
  const wide = M.skill.pace > 1 && Math.random() < 0.35 ? (best > 5 ? rand(8.2, 9.3) : rand(0.7, 1.8)) : best;
  return { y: Math.random() < 0.25 ? rand(1.5, 8.5) : wide, deep: 0 };
}

// ---------- players ----------
export function canReach(p, b) {
  const dx = b.x - p.x, dy = (b.y - p.y) * 1.25;
  return Math.hypot(dx, dy) < REACH && b.z > 0.08 && b.z < 2.8;
}
function legalToHit(M, team) {
  const r = M.rally;
  if (!r || r.team === team) return false;
  if (Math.sign(M.ball.x) !== side(team)) return false;
  if (r.serve && r.bounces === 0) return false;
  return r.bounces < 2;
}
export function hittable(M, p) { return M.state === 'rally' || M.state === 'training' ? legalToHit(M, p.team) && canReach(p, M.ball) : false; }

function planIntercepts(M) {
  const b = M.ball, r = M.rally;
  for (const p of M.players) p.target = null;
  if (!r || !b.live) return;
  const team = 1 - r.team;
  const pr = predict(b, 2.6);
  M.landing = pr.first;
  if (!M.players.some(q => q.team === team)) return;
  const already = Math.sign(b.x) === side(team) ? r.bounces : 0;
  const cands = pr.path.filter(c => Math.sign(c.x) === side(team) && Math.abs(c.x) < HALF - 0.2 && c.z > 0.25 && c.z < 2.3 && already + c.bounces <= 1 && !(r.serve && already + c.bounces === 0));
  let best = null;
  for (const p of M.players.filter(q => q.team === team)) {
    const spd = p.human ? 6 : M.skill.speed;
    for (const c of cands) {
      const d = Math.hypot(c.x - p.x, c.y - p.y) - REACH * 0.6;
      const need = Math.max(0, d) / spd + (p.human ? 0 : M.skill.react * 0.5);
      if (need <= c.t) { if (!best || c.t < best.c.t - 0.05 || (Math.abs(c.t - best.c.t) < 0.05 && need < best.need)) best = { p, c, need }; break; }
    }
  }
  if (!best && cands.length) {
    const c = cands[cands.length - 1];
    const p = M.players.filter(q => q.team === team).sort((a, b2) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b2.x - c.x, b2.y - c.y))[0];
    best = { p, c };
  }
  if (best) {
    const j = best.p.human ? 0 : M.skill.judge;
    if (!best.p.judgeOff || M.hits !== best.p.judgeHit) { best.p.judgeOff = { x: rand(-j, j), y: rand(-j, j) }; best.p.judgeHit = M.hits; }
    best.p.target = { x: best.c.x + side(team) * 0.35 + best.p.judgeOff.x, y: best.c.y - 0.2 + best.p.judgeOff.y, t: best.c.t, z: best.c.z };
  }
}

function homePos(M, p) {
  const r = M.rally, b = M.ball;
  const s = side(p.team);
  const attacking = r && r.team === p.team && r.lastType !== 'lob';
  const mate = M.players.find(q => q.team === p.team && q !== p);
  let y = laneY(p.idx) * 0.6 + b.y * 0.4;
  if (mate && mate.target) y = mate.target.y > 5 ? 2.8 : 7.2;
  return { x: s * (attacking ? 3.4 : 7.6), y: clamp(y, 1, 9) };
}

function movePlayer(p, tx, ty, spd, dt) {
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
  const v = d > 0.05 ? Math.min(spd, d * 6) : 0;
  p.vx = d ? dx / d * v : 0; p.vy = d ? dy / d * v : 0;
  applyMove(p, dt);
}
function applyMove(p, dt) {
  p.x += p.vx * dt; p.y += p.vy * dt;
  const s = side(p.team);
  p.x = s < 0 ? clamp(p.x, -HALF + 0.35, -0.5) : clamp(p.x, 0.5, HALF - 0.35);
  p.y = clamp(p.y, 0.3, WIDTH - 0.3);
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > 0.3) p.anim += sp * dt * 2.2;
}

// forehand or backhand from where the ball is relative to the player's right hand
function stroke(M, p, type) {
  if (type === 'smash' || type === 'power' || type === 'lob' || type === 'serve') return type;
  const right = p.team === 0 ? M.ball.y > p.y : M.ball.y < p.y;
  return (type === 'volley' ? 'v' : '') + (right ? 'fh' : 'bh');
}

function startSwing(M, p, type, aim) {
  p.swing = { type, anim: stroke(M, p, type), t: 0, done: false, aim, dur: type === 'smash' || type === 'power' ? 0.42 : type === 'lob' ? 0.45 : 0.36 };
  M.ev.push({ t: 'swing', p });
}

function updateSwing(M, p, dt) {
  const s = p.swing;
  if (!s) return;
  s.t += dt;
  const active = s.t > s.dur * 0.25 && s.t < s.dur * 0.72;
  if (active && !s.done && (M.state === 'rally' || M.state === 'training') && legalToHit(M, p.team) && canReach(p, M.ball)) {
    s.done = true;
    let quality = s.quality;
    if (quality === undefined) {
      const d = Math.hypot(M.ball.x - p.x, (M.ball.y - p.y) * 1.25);
      quality = clamp(1 - d / REACH, 0, 1) * (1 - Math.abs(s.t / s.dur - 0.45) * 0.8);
    }
    hitBall(M, p, s.type, quality, s.aim);
  }
  if (s.t > s.dur) p.swing = null;
}

// human: an arcade "armed swing". Press shortly before the ball arrives; the swing fires on contact.
function decideHumanShot(M, p, kind) {
  const b = M.ball, high = b.z > 1.7 && Math.abs(b.x) < 7;
  if (kind === 'lob') return high ? 'power' : 'lob';
  if (high) return 'smash';
  return Math.abs(p.x) < 4.5 && (!M.rally || M.rally.bounces === 0) ? 'volley' : 'drive';
}
function humanAim(M, p, inp) {
  let y;
  const lat = p.team === 0 ? inp.mx : -inp.mx;
  if (lat > 0.3) y = rand(7.2, 9.2); else if (lat < -0.3) y = rand(0.8, 2.8); else y = gapY(M, p) * 0.6 + 5 * 0.4;
  return { y, deep: inp.mz > 0.3 ? 1 : inp.mz < -0.3 ? -0.6 : 0 };
}

function updateHuman(M, p, dt, inp) {
  if (M.state === 'serve' && M.server === p) {
    if ((inp.hit || inp.lob) && M.stateT > 0.4) serve(M, p, humanAim(M, p, inp));
    return;
  }
  const live = M.state === 'rally' || M.state === 'training';
  if (!live && M.state !== 'serve') { p.vx *= 0.85; p.vy *= 0.85; return; }
  const mag = Math.hypot(inp.mx, inp.mz);
  // assist runs you toward the ball: full = automatic, light = a strong nudge, off = all you
  const assist = M.assist === 'full' ? 1 : M.assist === 'light' ? 0.7 : 0;
  const s = side(p.team);
  let vx = 0, vy = 0;
  if (mag > 0.1) { vx = -s * inp.mz / Math.max(1, mag) * 6; vy = (p.team === 0 ? 1 : -1) * inp.mx / Math.max(1, mag) * 6; }
  if (assist && p.target) {
    const dx = p.target.x - p.x, dy = p.target.y - p.y, d = Math.hypot(dx, dy);
    if (d > 0.08) {
      const v = Math.min(5.6, d * 6), tx = dx / d * v, ty = dy / d * v;
      if (mag > 0.1) { const k = assist * 0.45; vx = vx * (1 - k) + tx * k; vy = vy * (1 - k) + ty * k; }
      else { vx = tx * assist; vy = ty * assist; }
    }
  }
  p.vx = vx; p.vy = vy;
  applyMove(p, dt);

  if (!live) return;
  if (inp.hit || inp.lob) p.armed = { kind: inp.lob ? 'lob' : 'hit', t: 0, aim: humanAim(M, p, inp) };
  if (p.armed) {
    p.armed.t += dt;
    if (inp.mx || inp.mz) p.armed.aim = humanAim(M, p, inp);
    const b = M.ball;
    const soon = { x: b.x + b.vx * 0.1, y: b.y + b.vy * 0.1, z: b.z + b.vz * 0.1 };
    if (!p.swing && legalToHit(M, p.team) && (canReach(p, soon) || canReach(p, b))) {
      // quality: pressing 0.1–0.3 s before contact is perfect
      const lead = p.armed.t;
      const timing = lead < 0.06 ? 0.55 : lead < 0.34 ? 1 : clamp(1 - (lead - 0.34) * 2.4, 0.25, 1);
      const d = Math.hypot(b.x - p.x, (b.y - p.y) * 1.25);
      const reachQ = clamp(1.15 - d / REACH, 0.2, 1);
      const type = decideHumanShot(M, p, p.armed.kind);
      startSwing(M, p, type, p.armed.aim);
      p.swing.quality = clamp(timing * reachQ, 0, 1);
      p.armed = null;
    } else if (p.armed.t > 0.65) {
      startSwing(M, p, decideHumanShot(M, p, p.armed.kind), p.armed.aim); // a whiff
      p.swing.quality = 0.1;
      p.armed = null;
    }
  }
}

function updateAI(M, p, dt) {
  if (M.state === 'serve') { if (M.server === p && M.stateT > 1.1) serve(M, p, aiAim(M, p)); return; }
  if (M.state !== 'rally') { p.vx *= 0.85; p.vy *= 0.85; return; }
  if (p.seenHit !== M.hits) { p.seenHit = M.hits; p.react = M.skill.react * rand(0.7, 1.4); }
  p.react -= dt;
  const spd = M.skill.speed * (p.team === 0 ? 1.05 : 1);
  if (p.react > 0) { p.vx *= 0.8; p.vy *= 0.8; applyMove(p, dt); }
  else if (p.target) movePlayer(p, p.target.x, p.target.y, spd, dt);
  else { const h = homePos(M, p); movePlayer(p, h.x, h.y, spd * 0.7, dt); }
  if (!p.swing && p.cool <= 0 && legalToHit(M, p.team) && M.ball.live) {
    const b = M.ball;
    const ahead = { x: b.x + b.vx * 0.09, y: b.y + b.vy * 0.09, z: b.z + b.vz * 0.09 };
    if (canReach(p, ahead) || canReach(p, b)) startSwing(M, p, chooseShot(M, p), aiAim(M, p));
  }
}

function serve(M, p, aim) {
  if (M.state !== 'serve') return;
  M.state = 'rally'; M.stateT = 0;
  M.ball.z = 0.9;
  const ry = M.serveSide === 0 ? rand(6.2, 8.8) : rand(1.2, 3.8);
  startSwing(M, p, 'serve', { y: ry });
  p.swing.done = true;
  M.rally = null;
  hitBall(M, p, 'serve', 0.8, { y: ry, deep: aim.deep || 0 });
}

// ---------- training ----------
function newTargets(M) {
  const T = M.training;
  T.targets = [0, 1, 2].map(() => ({ x: rand(4.5, 8.8), y: rand(1.4, 8.6), r: rand(0.8, 1.1), hit: 0 }));
}
function feed(M) {
  const b = M.ball, p = M.players[0];
  Object.assign(b, { x: 8.8, y: rand(2, 8), z: 1.1, kill: 0 });
  const tx = -rand(5.2, 8.2), ty = clamp(p.y + rand(-2.5, 2.5), 1, 9);
  const T = rand(1, 1.35);
  Object.assign(b, launch(b, tx, ty, T));
  b.live = true;
  M.rally = { team: 1, bounces: 0, crossed: false, ever: false, hits: 0, serve: false, lastType: 'feed' };
  M.training.shots++;
  M.hits++;
  M.ev.push({ t: 'feed' });
}
function trainingBall(M, kind, b) {
  const r = M.rally, T = M.training;
  if (!r || r.done) return;
  if (kind === 'cross' && r.team === 0 && b.x > 0) r.ever = true;
  if (kind === 'floor') {
    const s = b.x < 0 ? 0 : 1;
    if (r.team === 0 && s === 1) {
      let pts = 25, hitT = null;
      for (const t of T.targets) if (Math.hypot(b.x - t.x, b.y - t.y) < t.r) hitT = t;
      if (hitT) { T.combo++; pts = 150 + T.combo * 50; hitT.hit = 1; T.hitsOk++; }
      else T.combo = 0;
      T.score += pts; T.best = Math.max(T.best, T.combo);
      M.ev.push({ t: 'target', pts, hit: !!hitT, x: b.x, y: b.y, combo: T.combo });
      if (hitT) T.refresh = true;
      r.done = true; T.feedT = 0.9;
    } else if (r.team === 0 && s === 0) { T.combo = 0; r.done = true; T.feedT = 0.8; M.ev.push({ t: 'target', pts: 0, miss: 'NET' }); }
    else if (r.team === 1 && s === 0) {
      r.bounces++;
      if (r.bounces >= 2) { T.combo = 0; r.done = true; T.feedT = 0.5; M.ev.push({ t: 'target', pts: 0, miss: 'MISSED' }); }
    }
  }
  if ((kind === 'wall' || kind === 'out') && r.team === 0 && b.x > 0 && !r.done) { T.combo = 0; r.done = true; T.feedT = 0.8; M.ev.push({ t: 'target', pts: 0, miss: 'OUT' }); }
}

// ---------- main update ----------
export function updateMatch(M, dt, inp) {
  M.time += dt;
  M.stateT += dt;
  const b = M.ball;
  if (M.state === 'intro') { if (M.stateT > 2.6) { M.state = 'serve'; M.stateT = 0; } }
  else if (M.state === 'point') {
    if (M.stateT > 2.1) {
      if (M.matchWon !== undefined) { M.state = 'over'; M.ev.push({ t: 'over', winner: M.matchWon }); return; }
      resetPositions(M);
      M.state = 'serve'; M.stateT = 0;
      M.ev.push({ t: 'serveReady' });
    }
  } else if (M.state === 'training') {
    const T = M.training;
    T.left -= dt;
    if (T.left <= 0) { T.left = 0; M.state = 'over'; M.ev.push({ t: 'over', training: true }); return; }
    if (T.refresh) { T.refresh = false; newTargets(M); }
    if (T.feedT > 0) { T.feedT -= dt; if (T.feedT <= 0) feed(M); }
    else if (M.rally && !M.rally.done && b.live && b.z === 0 && Math.hypot(b.vx, b.vy) < 0.4) { M.rally.done = true; T.feedT = 0.4; }
  }
  if (M.state === 'serve') {
    const s = M.server;
    b.x = s.x + s.face * 0.4; b.y = s.y + (s.team === 0 ? 0.35 : -0.35); b.z = 0.9 + Math.abs(Math.sin(M.time * 4)) * 0.5; b.vx = b.vy = b.vz = 0;
  } else if (b.live) {
    for (let i = 0; i < 4; i++) stepBall(b, dt / 4, (k, bb, a, c) => onBall(M, k, bb, a, c));
  }
  if (M.state === 'rally' || M.state === 'training') {
    M.planT = (M.planT || 0) - dt;
    if (M.planT <= 0 || M.hits !== M.planHits) { planIntercepts(M); M.planT = 0.12; M.planHits = M.hits; }
    if (M.state === 'rally' && b.live && b.z === 0 && Math.hypot(b.vx, b.vy) < 0.4 && M.rally) endPoint(M, M.rally.team, 'WINNER');
  }
  for (const p of M.players) {
    if (p.cool > 0) p.cool -= dt;
    p.moodT += dt;
    if (p.human) updateHuman(M, p, dt, inp); else updateAI(M, p, dt);
    updateSwing(M, p, dt);
  }
}
