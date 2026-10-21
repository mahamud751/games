'use strict';
(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const cv = $('#game'), ctx = cv.getContext('2d');
  const VW = 960, VH = 540, TS = 48;
  const RUN = 300, ACC = 2600, AIRACC = 1900, JUMPV = 840, DJUMPV = 730, GRAV = 2300, MAXFALL = 1100;
  const WORD = 'SUNBLADE';
  const P = Art.P;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const pick = a => a[Math.random() * a.length | 0];
  const DIFF = {
    easy: { hp: 8, lives: 5, boss: 0.75, edmg: 1 },
    normal: { hp: 6, lives: 3, boss: 1, edmg: 1 },
    hard: { hp: 5, lives: 2, boss: 1.3, edmg: 1.5 },
  };
  const BLADE = { flame: '#fb923c', storm: '#7dd3fc', shield: '#fde047' };
  const POTION_NAME = { flame: 'Flame Blade', storm: 'Storm Blade', shield: 'Sun Shield' };

  const HERO = { skin: '#c68a5a', hair: '#1d4ed8', hair2: '#facc15', hairStyle: 'nemes', topStyle: 'none', sleeves: 'none', pants: '#f5f0e1', shorts: true, kilt: '#f8f4e8', collar: '#facc15', collar2: '#14b8a6', shoes: '#b45309', gloves: '#facc15', belt: '#facc15', khopesh: true, scale: 0.84, bulk: 1.05 };
  const LOOKS = {
    jackal: { head: 'jackal', skin: '#34303f', hair2: '#facc15', topStyle: 'none', sleeves: 'none', pants: '#34303f', shorts: true, kilt: '#f5f0e1', collar: '#facc15', collar2: '#1d4ed8', shoes: '#34303f', gloves: '#facc15', belt: '#facc15', spear: true, scale: 0.86, bulk: 1 },
    archer: { head: 'jackal', skin: '#4a3f36', hair2: '#e5e7eb', topStyle: 'none', sleeves: 'none', pants: '#4a3f36', shorts: true, kilt: '#c2410c', collar: '#e5e7eb', collar2: '#c2410c', shoes: '#4a3f36', gloves: '#e5e7eb', belt: '#e5e7eb', bow: true, scale: 0.86, bulk: 0.95 },
    mummy: { skin: '#d9cfae', hairStyle: 'wrapped', wraps: true, topStyle: 'none', sleeves: 'none', pants: '#d9cfae', shorts: true, shoes: '#cfc39d', gloves: '#cfc39d', belt: '#a8a07c', glowEyes: true, scale: 0.88, bulk: 1.08 },
    jackalgod: { head: 'jackal', crown: true, eyeGlow: '#22d3ee', skin: '#1f1b2e', hair2: '#facc15', topStyle: 'none', sleeves: 'none', pants: '#1f1b2e', shorts: true, kilt: '#facc15', collar: '#facc15', collar2: '#22d3ee', shoes: '#1f1b2e', gloves: '#facc15', belt: '#22d3ee', staff: true, cape: '#7f1d1d', pads: '#facc15', scale: 1.9, bulk: 1.2 },
  };
  const ENEMY = {
    jackal: { hp: 3, w: 28, h: 72, spd: 70, score: 300 },
    mummy: { hp: 4, w: 30, h: 72, spd: 45, score: 300 },
    archer: { hp: 2, w: 28, h: 72, spd: 0, score: 250 },
    scarab: { hp: 1, w: 30, h: 22, spd: 110, score: 100 },
    vulture: { hp: 2, w: 52, h: 30, spd: 0, score: 200 },
    cobra: { hp: 2, w: 32, h: 40, spd: 0, score: 250 },
  };

  // ---------- app state ----------
  const app = { state: 'title', diff: 'normal', level: 0, score: 0, lives: 3, coins: 0, levelScore: 0, time: 0 };
  let L = null, pl = null, K = 1;

  function loadProgress() { try { return JSON.parse(localStorage.getItem('sunblade.progress')) || { level: 0, hi: 0 }; } catch (e) { return { level: 0, hi: 0 }; } }
  function saveProgress(p) { try { localStorage.setItem('sunblade.progress', JSON.stringify(p)); } catch (e) {} }

  // ---------- level ----------
  function loadLevel(i) {
    const def = LEVELS[i];
    const grid = def.map.map(r => r.split(''));
    L = {
      def, i, W: grid[0].length, H: grid.length, grid, items: [], enemies: [], projs: [], fx: [], plats: [], checks: [],
      gate: null, arenaX: null, arena: false, boss: null, camX: 0, camY: 36, t: 0, letters: 0, gotLetters: new Set(),
      chase: def.chase || 0, chaseDelay: 1.6, start: null, check: null, endT: 0, sprites: Art.tileSprites(def.theme, K),
    };
    let letterIdx = 0, mCount = 0;
    for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) {
      const ch = grid[y][x], cx = x * TS + TS / 2, by = (y + 1) * TS, my = y * TS + TS / 2;
      let keep = false;
      switch (ch) {
        case '#': case '=': case 'B': case '^': case '~': keep = true; break;
        case '@': L.start = { x: cx, y: by }; break;
        case 'C': L.items.push({ type: 'coin', x: cx, y: my, t: Math.random() * 6 }); break;
        case 'L': L.items.push({ type: 'letter', ch: WORD[letterIdx], idx: letterIdx, x: cx, y: my, t: 0 }); letterIdx++; break;
        case 'H': L.items.push({ type: 'jar', x: cx, y: my + 8, t: 0 }); break;
        case 'P': L.items.push({ type: 'potion', kind: def.potion, x: cx, y: my + 10, t: 0 }); break;
        case 'K': L.checks.push({ x: cx, y: by, lit: false }); break;
        case 'M': L.plats.push({ x0: cx, x: cx, y: y * TS + 14, w: 144, range: 130, speed: 1.1, phase: x * 0.9, dx: 0 }); break;
        case 'F': L.gate = { x: cx, y: by }; break;
        case 'X': L.arenaX = x * TS; break;
        default:
          if (def.enemies[ch]) {
            let type = def.enemies[ch];
            if (ch === 'm' && i === 3) type = mCount++ % 2 ? 'jackal' : 'mummy';
            L.enemies.push(makeEnemy(type, cx, by));
          }
      }
      if (!keep) grid[y][x] = '.';
    }
    // number the letters left to right so they spell the word as you travel
    L.items.filter(it => it.type === 'letter').sort((a, b) => a.x - b.x).forEach((it, k) => { it.idx = k; it.ch = WORD[k]; });
    L.letters = letterIdx;
    L.check = { x: L.start.x, y: L.start.y };
    pl = makePlayer(L.start.x, L.start.y);
    L.camX = clamp(pl.x - VW * 0.4, 0, L.W * TS - VW);
  }

  const tile = (tx, ty) => tx < 0 || tx >= L.W ? '#' : ty < 0 || ty >= L.H ? '.' : L.grid[ty][tx];
  const solid = c => c === '#' || c === 'B';

  // axis-separated movement against tiles and moving ledges
  function moveBody(b, dt, grav = 1) {
    b.hitWall = 0;
    b.x += b.vx * dt;
    let top = b.y - b.h + 2, bot = b.y - 2;
    const ty0 = Math.floor(top / TS), ty1 = Math.floor(bot / TS);
    if (b.vx > 0) {
      const tx = Math.floor((b.x + b.w / 2) / TS);
      for (let ty = ty0; ty <= ty1; ty++) if (solid(tile(tx, ty))) { b.x = tx * TS - b.w / 2 - 0.01; b.vx = 0; b.hitWall = 1; break; }
    } else if (b.vx < 0) {
      const tx = Math.floor((b.x - b.w / 2) / TS);
      for (let ty = ty0; ty <= ty1; ty++) if (solid(tile(tx, ty))) { b.x = (tx + 1) * TS + b.w / 2 + 0.01; b.vx = 0; b.hitWall = -1; break; }
    }
    const prevY = b.y;
    b.vy = Math.min(b.vy + GRAV * grav * dt, MAXFALL);
    b.y += b.vy * dt;
    b.onGround = false; b.plat = null; b.bumped = null;
    const tx0 = Math.floor((b.x - b.w / 2 + 2) / TS), tx1 = Math.floor((b.x + b.w / 2 - 2) / TS);
    if (b.vy >= 0) {
      const ty = Math.floor(b.y / TS);
      for (let tx = tx0; tx <= tx1; tx++) {
        const c = tile(tx, ty);
        if (solid(c) || (c === '=' && prevY <= ty * TS + 1 && !(b.drop > 0))) { b.y = ty * TS; b.vy = 0; b.onGround = true; break; }
      }
      if (!b.onGround) for (const p of L.plats) {
        if (b.x + b.w / 2 < p.x - p.w / 2 + 4 || b.x - b.w / 2 > p.x + p.w / 2 - 4) continue;
        if (prevY <= p.y + 2 && b.y >= p.y) { b.y = p.y; b.vy = 0; b.onGround = true; b.plat = p; break; }
      }
    } else {
      const ty = Math.floor((b.y - b.h) / TS);
      for (let tx = tx0; tx <= tx1; tx++) {
        if (solid(tile(tx, ty))) { b.y = (ty + 1) * TS + b.h; b.vy = 0; b.bumped = [tx, ty]; break; }
      }
    }
  }
  function onGroundAhead(e) {
    const tx = Math.floor((e.x + e.face * (e.w / 2 + 4)) / TS), ty = Math.floor((e.y + 4) / TS);
    const c = tile(tx, ty);
    return solid(c) || c === '=';
  }
  const overlap = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  const boxOf = e => ({ l: e.x - e.w / 2, r: e.x + e.w / 2, t: e.y - e.h, b: e.y });

  // ---------- particles ----------
  function fx(o) { L.fx.push(Object.assign({ t: 0 }, o)); }
  function sparks(x, y, n = 8, cols = ['#fff7c2', '#fde047', '#fb923c']) {
    for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), v = rand(80, 320); fx({ k: 'bit', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.2, 0.45), r: rand(1.5, 3.5), color: pick(cols) }); }
  }
  function puff(x, y, n = 10, color = 'rgba(230,210,170,') {
    for (let i = 0; i < n; i++) fx({ k: 'puff', x: x + rand(-14, 14), y: y + rand(-20, 10), vx: rand(-70, 70), vy: rand(-90, -10), life: rand(0.4, 0.8), r: rand(6, 14), color });
  }
  function popText(x, y, text, color = '#fde047', size = 20) { fx({ k: 'text', x, y, text, color, size, life: 1 }); }
  function ring(x, y, r, color) { fx({ k: 'ring', x, y, r, color, life: 0.4 }); }

  // ---------- player ----------
  function makePlayer(x, y) {
    return {
      x, y, w: 28, h: 74, vx: 0, vy: 0, face: 1, onGround: false, coyote: 0, jumpBuf: 0, jumps: 0, drop: 0,
      state: 'normal', st: 0, atk: null, combo: 0, lastSlash: -9, invul: 1.5, hp: DIFF[app.diff].hp, maxHp: DIFF[app.diff].hp,
      potion: null, potT: 0, energy: 40, anim: 0, djT: 0, flash: 0, prevBottom: y, shieldHits: new Map(),
    };
  }

  function hurtPlayer(dmg, srcX) {
    const p = pl;
    if (!p || p.invul > 0 || p.state === 'dead' || p.state === 'win') return;
    if (p.potion === 'shield') return;
    p.hp -= Math.max(1, Math.round(dmg * DIFF[app.diff].edmg));
    p.invul = 1.3; p.flash = 0.15;
    p.state = 'hurt'; p.st = 0; p.atk = null;
    p.vx = (p.x < srcX ? -1 : 1) * 280; p.vy = -440;
    Sound.play('hurt'); app.shake = 6;
    sparks(p.x, p.y - 45, 8, ['#fecaca', '#ef4444', '#fff']);
    if (p.hp <= 0) killPlayer();
  }

  function killPlayer() {
    const p = pl;
    if (p.state === 'dead') return;
    p.hp = 0; p.state = 'dead'; p.st = 0; p.vy = -620; p.vx = -p.face * 80; p.atk = null; p.potion = null;
    Sound.play('ko'); app.shake = 8;
    app.lives--;
  }

  function respawn() {
    if (app.lives < 0) { gameOver(); return; }
    const c = L.check;
    Object.assign(pl, { x: c.x, y: c.y - 2, vx: 0, vy: 0, state: 'normal', st: 0, hp: pl.maxHp, invul: 2.2, potion: null, atk: null });
    if (L.arena && L.boss) { L.arena = false; L.boss = null; L.projs = []; L.enemies = L.enemies.filter(e => !e.summoned); $('#bossBar').classList.add('hidden'); Sound.music(L.def.song); }
    if (L.chase) { L.camX = clamp(c.x - 300, 0, L.W * TS - VW); L.chaseDelay = 1.2; }
    puff(pl.x, pl.y - 20, 14, 'rgba(253,224,71,');
  }

  function startSlash(p, air) {
    const fresh = app.t - p.lastSlash > 0.45;
    p.combo = air ? 0 : fresh ? 0 : (p.combo + 1) % 3;
    const dur = p.combo === 2 ? 0.36 : 0.27;
    p.atk = { kind: air ? 'air' : 'slash', idx: p.combo, t: 0, dur, act: [p.combo === 2 ? 0.11 : 0.06, p.combo === 2 ? 0.23 : 0.16], hit: new Set(), fired: false };
    p.lastSlash = app.t;
    Sound.play('swing');
  }

  function updatePlayer(dt) {
    const p = pl, inp = Input.get(0), c = inp.cur, hit = inp.hit;
    const mx = (c.right ? 1 : 0) - (c.left ? 1 : 0);
    p.st += dt;
    if (p.invul > 0) p.invul -= dt;
    if (p.flash > 0) p.flash -= dt;
    if (p.djT > 0) p.djT -= dt;
    if (p.drop > 0) p.drop -= dt;
    if (p.potion) { p.potT -= dt; if (p.potT <= 0) { p.potion = null; popText(p.x, p.y - 100, 'Power faded', '#e5e7eb', 16); } }

    if (p.state === 'dead') {
      p.vy += GRAV * dt; p.y += p.vy * dt; p.x += p.vx * dt;
      if (p.st > 1.7) respawn();
      return;
    }
    if (p.state === 'win') { p.vx = 0; moveBody(p, dt); return; }

    // platform carry
    if (p.plat) p.x += p.plat.dx;
    p.prevBottom = p.y;

    const control = p.state !== 'hurt';
    if (p.state === 'hurt' && p.st > 0.3) p.state = 'normal';
    if (p.onGround) { p.coyote = 0.1; p.jumps = 0; } else p.coyote -= dt;
    p.jumpBuf = hit.jump ? 0.12 : p.jumpBuf - dt;

    if (control) {
      const slowed = p.atk && p.onGround && p.atk.kind === 'slash';
      const target = mx * RUN * (slowed ? 0.3 : 1);
      const acc = p.onGround ? ACC : AIRACC;
      if (p.state !== 'plunge') p.vx += clamp(target - p.vx, -acc * dt, acc * dt);
      if (mx && !p.atk) p.face = mx;
      if (p.jumpBuf > 0 && p.state === 'normal') {
        if (c.down && p.onGround && isOnLedge(p)) { p.drop = 0.25; p.jumpBuf = 0; p.y += 2; }
        else if (p.coyote > 0) { p.vy = -JUMPV; p.coyote = 0; p.jumpBuf = 0; p.jumps = 1; Sound.play('jump'); }
        else if (p.jumps < 2) { p.vy = -DJUMPV; p.jumps = 2; p.jumpBuf = 0; p.djT = 0.35; Sound.play('dj'); ring(p.x, p.y, 30, '#fde047'); }
      }
      if (!c.jump && p.vy < -260 && p.state === 'normal') p.vy += GRAV * 1.6 * dt;
      if (hit.atk && p.state === 'normal' && (!p.atk || p.atk.t > p.atk.dur * 0.65)) {
        if (!p.onGround && c.down) { p.state = 'plunge'; p.vy = 950; p.vx = 0; p.atk = { kind: 'plunge', t: 0, hit: new Set() }; Sound.play('swing'); }
        else startSlash(p, !p.onGround);
      }
      if (hit.spc && p.state === 'normal') throwDisc(p);
    }

    moveBody(p, dt);
    if (p.bumped) {
      const [bx, by] = p.bumped;
      if (tile(bx, by) === 'B') breakBlock(bx, by); else Sound.play('bump');
    }
    if (p.state === 'plunge' && p.onGround) {
      p.state = 'normal'; p.atk = null; app.shake = 7; Sound.play('shock');
      ring(p.x, p.y, 70, '#fde047'); puff(p.x, p.y, 10);
      attackBox({ l: p.x - 70, r: p.x + 70, t: p.y - 40, b: p.y + 4 }, 2, new Set(), p.face);
    }

    // attack timing
    if (p.atk) {
      const a = p.atk;
      a.t += dt;
      if (a.kind === 'plunge') attackBox({ l: p.x - 30, r: p.x + 30, t: p.y - 30, b: p.y + 16 }, 2, a.hit, p.face, true);
      else {
        if (a.t >= a.act[0] && a.t <= a.act[1]) {
          const reach = 84, box = { l: p.face > 0 ? p.x - 6 : p.x - reach, r: p.face > 0 ? p.x + reach : p.x + 6, t: p.y - 88, b: p.y - 6 };
          attackBox(box, a.idx === 2 ? 2 : 1, a.hit, p.face);
          if (!a.fired) { a.fired = true; potionShot(p); }
        }
        if (a.t >= a.dur) p.atk = null;
      }
    }
    if (p.potion === 'shield') {
      for (const t of targets()) {
        const last = p.shieldHits.get(t.ref) || -9;
        if (app.t - last > 0.45 && overlap(boxOf(p), t.box)) { p.shieldHits.set(t.ref, app.t); t.hurt(1, p.face); }
      }
    }
    // hazards
    const feetTy = Math.floor((p.y - 6) / TS), midTy = Math.floor((p.y - 30) / TS);
    const txs = [Math.floor((p.x - p.w / 2 + 4) / TS), Math.floor((p.x + p.w / 2 - 4) / TS)];
    for (const tx of txs) {
      if (tile(tx, feetTy) === '^' || tile(tx, midTy) === '^') { hurtPlayer(1, p.x - p.face * 10); if (pl.state !== 'dead') pl.vy = -620; break; }
      if (tile(tx, feetTy) === '~') { killPlayer(); return; }
    }
    if (p.y > L.H * TS + 120) { killPlayer(); return; }
    const minX = L.arena ? L.arenaX + 20 : 16, maxX = L.arena ? L.arenaX + VW - 20 : L.W * TS - 16;
    p.x = clamp(p.x, minX, maxX);
    if (L.chase) {
      p.x = Math.min(p.x, L.camX + VW - 20);
      if (p.x < L.camX + 46) { killPlayer(); return; }
    }
    if (p.onGround && Math.abs(p.vx) > 40) p.anim += Math.abs(p.vx) * dt * 0.045;
    if (p.onGround && !p.wasGround && p.vy === 0 && p.st > 0.1) puff(p.x, p.y, 3);
    p.wasGround = p.onGround;

    pickups();
    checkpoints();
    if (L.gate && Math.abs(p.x - L.gate.x) < 40 && p.y > L.gate.y - 150 && p.state === 'normal') levelComplete();
    if (L.arenaX !== null && !L.arena && !L.bossDone && p.x > L.arenaX + 160) startBoss();
  }

  function isOnLedge(p) {
    const ty = Math.floor((p.y + 2) / TS);
    const a = tile(Math.floor((p.x - 10) / TS), ty), b = tile(Math.floor((p.x + 10) / TS), ty);
    return (a === '=' || a === '.') && (b === '=' || b === '.') && (a === '=' || b === '=');
  }

  function potionShot(p) {
    if (p.potion === 'flame') {
      Sound.play('fire');
      L.projs.push({ kind: 'pfire', x: p.x + p.face * 40, y: p.y - 50, vx: p.face * 700, vy: 0, r: 14, life: 0.8, dmg: 2, from: 'p', hit: new Set() });
    } else if (p.potion === 'storm' && p.onGround) {
      Sound.play('zap');
      L.projs.push({ kind: 'pbolt', x: p.x + p.face * 40, y: p.y, vx: p.face * 560, vy: 0, r: 22, life: 0.65, dmg: 2, from: 'p', hit: new Set() });
    }
  }

  function throwDisc(p) {
    if (L.projs.some(q => q.kind === 'disc')) return;
    if (p.energy < 30) { popText(p.x, p.y - 100, 'Need Ra energy', '#e5e7eb', 15); return; }
    p.energy -= 30;
    Sound.play('disc');
    L.projs.push({ kind: 'disc', x: p.x + p.face * 30, y: p.y - 50, vx: p.face * 640, vy: 0, r: 17, life: 3, dmg: 2, from: 'p', hit: new Set(), t: 0, back: false });
  }

  // things the hero can damage
  function targets() {
    const out = [];
    for (const e of L.enemies) if (!e.dying) out.push({ ref: e, box: boxOf(e), hurt: (d, dir) => hurtEnemy(e, d, dir) });
    if (L.boss && !L.boss.dead) for (const b of L.boss.boxes()) out.push({ ref: b.part, box: b, hurt: (d, dir) => L.boss.hurt(d, b.part, dir) });
    return out;
  }
  function attackBox(box, dmg, hitSet, dir, plunge) {
    for (const t of targets()) {
      if (hitSet.has(t.ref) || !overlap(box, t.box)) continue;
      hitSet.add(t.ref);
      t.hurt(dmg, dir);
      if (plunge && pl.state === 'plunge') { pl.vy = -520; pl.state = 'normal'; pl.atk = null; pl.jumps = 1; }
    }
    // smash breakable blocks
    const tx0 = Math.floor(box.l / TS), tx1 = Math.floor(box.r / TS), ty0 = Math.floor(box.t / TS), ty1 = Math.floor(box.b / TS);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (tile(tx, ty) === 'B' && !hitSet.has('b' + tx + ',' + ty)) { hitSet.add('b' + tx + ',' + ty); breakBlock(tx, ty); }
  }
  function breakBlock(tx, ty) {
    L.grid[ty][tx] = '.';
    Sound.play('crash'); app.shake = Math.max(app.shake, 3);
    const x = tx * TS + TS / 2, y = ty * TS + TS / 2;
    for (let i = 0; i < 8; i++) fx({ k: 'chunk', x, y, vx: rand(-220, 220), vy: rand(-420, -80), rot: rand(0, 6), vr: rand(-10, 10), life: rand(0.6, 1), color: pick(['#d98b52', '#8f4a22', '#b86a35']) });
    app.score += 50;
    if (Math.random() < 0.45) L.items.push({ type: Math.random() < 0.85 ? 'coin' : 'jar', x, y, t: 0, vy: -300, fall: true });
  }

  function pickups() {
    const pb = boxOf(pl);
    for (let i = L.items.length - 1; i >= 0; i--) {
      const it = L.items[i];
      if (!overlap(pb, { l: it.x - 18, r: it.x + 18, t: it.y - 22, b: it.y + 22 })) continue;
      L.items.splice(i, 1);
      switch (it.type) {
        case 'coin':
          app.coins++; app.score += 100; pl.energy = Math.min(100, pl.energy + 3);
          Sound.play('coin'); sparks(it.x, it.y, 5, ['#fde047', '#fff7c2']);
          if (app.coins % 100 === 0) oneUp();
          break;
        case 'letter':
          L.gotLetters.add(it.idx); app.score += 500;
          Sound.play('letter'); sparks(it.x, it.y, 14);
          popText(it.x, it.y - 30, it.ch, '#fde047', 34);
          if (L.gotLetters.size === 8) { app.score += 5000; oneUp(); popText(pl.x, pl.y - 140, 'SUNBLADE!', '#fde047', 36); }
          break;
        case 'jar':
          pl.hp = Math.min(pl.maxHp, pl.hp + 2); Sound.play('pickup');
          popText(it.x, it.y - 30, '+2 ♥', '#4ade80', 20);
          break;
        case 'potion':
          pl.potion = it.kind; pl.potT = 15; Sound.play('potion');
          popText(it.x, it.y - 40, POTION_NAME[it.kind] + '!', BLADE[it.kind], 24);
          ring(pl.x, pl.y - 40, 60, BLADE[it.kind]);
          break;
      }
    }
  }
  function oneUp() { app.lives++; Sound.play('oneUp'); popText(pl.x, pl.y - 120, '1UP', '#4ade80', 30); }
  function checkpoints() {
    for (const c of L.checks) {
      if (!c.lit && pl.x > c.x - 10) {
        c.lit = true; L.check = { x: c.x, y: c.y };
        Sound.play('checkpoint'); sparks(c.x, c.y - 110, 16);
        popText(c.x, c.y - 150, 'Checkpoint', '#fde047', 18);
        pl.hp = Math.max(pl.hp, Math.min(pl.maxHp, pl.hp + 1));
      }
    }
  }

  // ---------- enemies ----------
  function makeEnemy(type, x, y) {
    const d = ENEMY[type];
    const e = { type, x, y, vx: 0, vy: 0, w: d.w, h: d.h, hp: d.hp, face: -1, state: 'walk', st: 0, flash: 0, stun: 0, home: x, cd: rand(0.8, 2), anim: Math.random() * 6, rise: 0, phase: Math.random() * 6 };
    if (type === 'vulture') { e.baseY = y - 170; e.y = e.baseY; e.state = 'fly'; }
    return e;
  }

  function hurtEnemy(e, dmg, dir) {
    if (e.dying) return;
    e.hp -= dmg; e.flash = 0.12;
    sparks(e.x, e.y - e.h * 0.6, 7);
    Sound.play('punch', dmg > 1);
    app.shake = Math.max(app.shake, dmg > 1 ? 4 : 2);
    app.hitstop = Math.max(app.hitstop, 0.04);
    pl.energy = Math.min(100, pl.energy + 8);
    if (e.hp <= 0) {
      e.dying = true; e.st = 0;
      const sc = ENEMY[e.type].score;
      app.score += sc;
      popText(e.x, e.y - e.h - 10, '+' + sc, '#fde047', 18);
      puff(e.x, e.y - e.h / 2, 12, e.type === 'mummy' ? 'rgba(230,220,190,' : 'rgba(210,180,130,');
      Sound.play('ko');
      if (Math.random() < 0.35) L.items.push({ type: Math.random() < 0.8 ? 'coin' : 'jar', x: e.x, y: e.y - 30, t: 0, vy: -320, fall: true });
      return;
    }
    e.stun = 0.28; e.state = e.type === 'vulture' ? 'fly' : 'walk';
    if (e.type !== 'vulture' && e.type !== 'cobra' && e.type !== 'archer') { e.vx = dir * 230; e.vy = -200; }
    if (e.type === 'vulture') { e.vx = dir * 200; }
  }

  function updateEnemy(e, dt) {
    if (e.flash > 0) e.flash -= dt;
    if (e.dying) { e.st += dt; return; }
    if (Math.abs(e.x - pl.x) > VW * 1.3 && !L.chase) return; // asleep off-screen
    e.st += dt; e.cd -= dt; e.anim += dt;
    const dx = pl.x - e.x, adx = Math.abs(dx), dy = pl.y - e.y;
    const walker = e.type === 'jackal' || e.type === 'mummy' || e.type === 'scarab';

    if (e.stun > 0) {
      e.stun -= dt;
      if (e.type !== 'vulture') { e.vx *= 1 - 6 * dt; moveBody(e, dt); } else { e.x += e.vx * dt; e.vx *= 1 - 4 * dt; }
      return;
    }
    if (walker) {
      const d = ENEMY[e.type];
      let spd = d.spd;
      if (e.type === 'jackal') {
        if (e.state === 'walk' && adx < 260 && Math.abs(dy) < 80) e.state = 'chase';
        if (e.state === 'chase') {
          e.face = Math.sign(dx) || e.face; spd = 150;
          if (adx < 74 && e.cd <= 0) { e.state = 'wind'; e.st = 0; }
          if (adx > 380) e.state = 'walk';
        }
        if (e.state === 'wind') { spd = 0; if (e.st > 0.38) { e.state = 'thrust'; e.st = 0; Sound.play('swing'); } }
        if (e.state === 'thrust') {
          spd = 0;
          const box = { l: e.face > 0 ? e.x : e.x - 92, r: e.face > 0 ? e.x + 92 : e.x, t: e.y - 64, b: e.y - 28 };
          if (overlap(box, boxOf(pl))) hurtPlayer(1, e.x);
          if (e.st > 0.22) { e.state = 'recover'; e.st = 0; }
        }
        if (e.state === 'recover') { spd = 0; if (e.st > 0.45) { e.state = 'chase'; e.cd = rand(0.9, 1.6); } }
      } else if (e.type === 'mummy') {
        if (e.state === 'walk' && adx < 220 && Math.abs(dy) < 70) { e.face = Math.sign(dx) || e.face; spd = 70; if (adx < 110 && e.cd <= 0) { e.state = 'lunge'; e.st = 0; Sound.play('roar'); } }
        if (e.state === 'lunge') { spd = 230; if (e.st > 0.5) { e.state = 'walk'; e.cd = 2; } }
      }
      e.vx = e.face * spd;
      moveBody(e, dt);
      if (e.onGround && (e.hitWall || (spd && !onGroundAhead(e)))) { e.face *= -1; if (e.state === 'chase' || e.state === 'lunge') e.state = 'walk'; }
      if (e.type === 'scarab' && Math.random() < 0.02) puff(e.x - e.face * 12, e.y, 1);
    } else if (e.type === 'archer') {
      if (adx < 600) e.face = Math.sign(dx) || e.face;
      moveBody(e, dt);
      if (e.state === 'walk' && e.cd <= 0 && adx < 600 && adx > 50 && Math.abs(dy) < 200) { e.state = 'draw'; e.st = 0; }
      if (e.state === 'draw' && e.st > 0.65) {
        Sound.play('knife');
        const vy = clamp(dy / Math.max(0.4, adx / 480), -220, 220);
        L.projs.push({ kind: 'arrow', x: e.x + e.face * 26, y: e.y - 52, vx: e.face * 480, vy, grav: 0, r: 8, life: 2.2, dmg: 1, from: 'e' });
        e.state = 'walk'; e.cd = rand(1.8, 2.6);
      }
    } else if (e.type === 'vulture') {
      if (e.state === 'fly') {
        const tx = e.home + Math.sin(L.t * 0.8 + e.phase) * 150;
        e.face = Math.sign(tx - e.x) || e.face;
        e.x += (tx - e.x) * Math.min(1, dt * 3);
        e.y += (e.baseY + Math.sin(L.t * 2.5 + e.phase) * 12 - e.y) * Math.min(1, dt * 3);
        if (adx < 220 && dy > 30 && e.cd <= 0) { e.state = 'dive'; e.st = 0; const d = Math.hypot(dx, dy - 40); e.vx = dx / d * 380; e.vy = (dy - 40) / d * 380; e.face = Math.sign(dx) || 1; Sound.play('swing'); }
      } else if (e.state === 'dive') {
        e.x += e.vx * dt; e.y += e.vy * dt;
        if (e.st > 0.9 || e.y > pl.y - 20) { e.state = 'rise'; e.st = 0; }
      } else if (e.state === 'rise') {
        e.x += (e.home - e.x) * Math.min(1, dt * 1.5); e.y += (e.baseY - e.y) * Math.min(1, dt * 2);
        if (e.st > 1.2) { e.state = 'fly'; e.cd = rand(2, 3); }
      }
    } else if (e.type === 'cobra') {
      moveBody(e, dt);
      const near = adx < 440 && Math.abs(dy) < 220;
      e.rise += ((near ? 1 : 0) - e.rise) * Math.min(1, dt * 4);
      if (near) e.face = Math.sign(dx) || e.face;
      if (near && e.cd <= 0 && e.rise > 0.8) {
        const T = 0.85, g = 900;
        L.projs.push({ kind: 'venom', x: e.x + e.face * 16, y: e.y - 60, vx: dx / T, vy: (dy - 30 - 0.5 * g * T * T + 30) / T, grav: g, r: 8, life: 2, dmg: 1, from: 'e' });
        Sound.play('knife');
        e.cd = rand(2.2, 3);
      }
    }
    // touching the hero
    if (overlap(boxOf(e), boxOf(pl)) && pl.state !== 'dead') {
      const stomp = pl.vy > 0 && pl.prevBottom <= e.y - e.h + 14 && e.type !== 'cobra';
      if (stomp) { hurtEnemy(e, 1, pl.face); pl.vy = -560; pl.jumps = 1; Sound.play('jump'); }
      else if (pl.potion !== 'shield') hurtPlayer(1, e.x);
    }
    if (e.y > L.H * TS + 100) e.dying = true;
  }

  // ---------- bosses ----------
  const ARENA_Y = 10 * TS;
  function bossHp(n) { return Math.round(n * DIFF[app.diff].boss); }

  function makeScorpion(ax) {
    const b = { name: 'KHARSET', title: 'The Scorpion King', x: ax + VW + 140, y: ARENA_Y, face: -1, hp: bossHp(40), state: 'enter', st: 0, tail: 0, claw: 0, flash: 0, cd: 1.2, walk: false, t: 0 };
    b.maxHp = b.hp;
    b.boxes = () => b.state === 'dead' ? [] : [{ l: b.x - (b.face > 0 ? 110 : 70), r: b.x + (b.face > 0 ? 70 : 110), t: b.y - 78, b: b.y - 6, part: b }];
    b.hurt = (d, part, dir) => { bossHurt(b, d); void dir; };
    b.update = dt => {
      b.t += dt; b.st += dt; if (b.flash > 0) b.flash -= dt;
      const p2 = b.hp < b.maxHp / 2, dx = pl.x - b.x;
      b.walk = false;
      switch (b.state) {
        case 'enter': b.x -= 120 * dt; b.walk = true; if (b.x < ax + VW - 220) { b.state = 'idle'; b.st = 0; } break;
        case 'idle':
          b.face = dx > 0 ? 1 : -1; b.cd -= dt;
          if (Math.abs(dx) > 170) { b.x += b.face * (p2 ? 120 : 80) * dt; b.walk = true; }
          b.claw += (0 - b.claw) * dt * 6; b.tail += (0 - b.tail) * dt * 4;
          if (b.cd <= 0) { b.state = Math.abs(dx) < 220 ? 'claw' : Math.random() < 0.5 ? 'sting' : 'spit'; b.st = 0; }
          break;
        case 'claw':
          if (b.st < 0.45) b.claw = -0.25 * (b.st / 0.45);
          else if (b.st < 0.7) { b.claw = 1; if (b.st - dt < 0.45) Sound.play('slash'); hitPlayerBox({ l: b.face > 0 ? b.x + 50 : b.x - 210, r: b.face > 0 ? b.x + 210 : b.x - 50, t: b.y - 80, b: b.y - 10 }, 1, b.x); }
          else if (b.st > 1) { b.state = 'idle'; b.cd = p2 ? 0.7 : 1.2; }
          break;
        case 'sting':
          if (b.st < 0.6) b.tail = b.st / 0.6;
          else if (b.st < 0.85) { b.tail = 1 - (b.st - 0.6) * 8; if (b.st - dt < 0.6) { Sound.play('shock'); app.shake = 6; } hitPlayerBox({ l: b.face > 0 ? b.x + 90 : b.x - 230, r: b.face > 0 ? b.x + 230 : b.x - 90, t: b.y - 70, b: b.y }, 2, b.x); }
          else if (b.st > 1.6) { b.state = 'idle'; b.cd = p2 ? 0.6 : 1.1; }
          break;
        case 'spit':
          b.tail = Math.min(0.6, b.st);
          if (b.st > 0.45 && !b.spat) {
            b.spat = true; Sound.play('fire');
            const n = p2 ? 5 : 3;
            for (let i = 0; i < n; i++) {
              const T = 0.9 + i * 0.12, tx = pl.x + (i - (n - 1) / 2) * 70, g = 1000;
              const sx = b.x + b.face * 60, sy = b.y - 70;
              L.projs.push({ kind: 'sand', x: sx, y: sy, vx: (tx - sx) / T, vy: (pl.y - sy - 0.5 * g * T * T) / T, grav: g, r: 12, life: 3, dmg: 1, from: 'e' });
            }
          }
          if (b.st > 1.1) { b.spat = false; b.state = 'idle'; b.cd = p2 ? 0.8 : 1.4; }
          break;
        case 'dead': break;
      }
      b.x = clamp(b.x, ax + 90, ax + VW + 200);
      if (b.state !== 'dead' && b.state !== 'enter') hitPlayerBox(b.boxes()[0], 1, b.x);
    };
    b.draw = cam => {
      const a = b.state === 'dead' ? Math.max(0, 1 - b.st / 1.6) : 1;
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(b.x - cam, b.y - L.camY, 150, 18, 0, 0, Math.PI * 2); ctx.fill();
      Art.drawScorpion(ctx, b.x - cam, b.y - L.camY + (b.state === 'dead' ? b.st * 20 : 0), b.face, b.t, { walk: b.walk, tail: b.tail, claw: Math.max(0, b.claw) }, b.flash > 0);
      ctx.restore();
    };
    return b;
  }

  function makeJackalGod(ax) {
    const b = { name: 'SETHAKH', title: 'Jackal of the Dusk', x: ax + VW + 80, y: ARENA_Y, vx: 0, vy: 0, w: 64, h: 175, face: -1, hp: bossHp(48), state: 'enter', st: 0, flash: 0, cd: 1.4, anim: 0, t: 0, onGround: true, summoned: [false, false] };
    b.maxHp = b.hp;
    b.boxes = () => b.state === 'dead' ? [] : [{ l: b.x - 34, r: b.x + 34, t: b.y - 175, b: b.y, part: b }];
    b.hurt = d => bossHurt(b, d);
    b.update = dt => {
      b.t += dt; b.st += dt; if (b.flash > 0) b.flash -= dt;
      const dx = pl.x - b.x, p2 = b.hp < b.maxHp / 2;
      const r = b.hp / b.maxHp;
      if (r < 0.66 && !b.summoned[0]) { b.summoned[0] = true; summonMummies(ax); }
      if (r < 0.33 && !b.summoned[1]) { b.summoned[1] = true; summonMummies(ax); }
      switch (b.state) {
        case 'enter': b.x -= 130 * dt; b.anim += dt; if (b.x < ax + VW - 200) { b.state = 'idle'; b.st = 0; Sound.play('roar'); } break;
        case 'idle':
          b.face = dx > 0 ? 1 : -1; b.cd -= dt;
          if (Math.abs(dx) > 140) { b.x += b.face * (p2 ? 130 : 90) * dt; b.anim += dt; }
          if (b.cd <= 0) {
            const opts = Math.abs(dx) < 170 ? ['swing', 'swing', 'leap'] : ['leap', 'beam', 'dash'];
            b.state = pick(opts); b.st = 0;
          }
          break;
        case 'swing':
          if (b.st > 0.5 && b.st < 0.72) hitPlayerBox({ l: b.face > 0 ? b.x : b.x - 170, r: b.face > 0 ? b.x + 170 : b.x, t: b.y - 175, b: b.y - 10 }, 2, b.x);
          if (b.st > 0.5 && b.st - dt <= 0.5) Sound.play('slash');
          if (b.st > 1.15) { b.state = 'idle'; b.cd = p2 ? 0.5 : 0.9; }
          break;
        case 'leap':
          if (b.st < 0.35) break;
          if (!b.jumped) { b.jumped = true; b.vy = -1000; b.vx = clamp(dx / 0.85, -700, 700); b.y -= 2; Sound.play('jump'); }
          b.vy += GRAV * dt; b.x += b.vx * dt; b.y += b.vy * dt;
          if (b.y >= ARENA_Y && b.vy > 0) {
            b.y = ARENA_Y; b.jumped = false; b.state = 'land'; b.st = 0; app.shake = 12; Sound.play('shock');
            puff(b.x, b.y, 16); ring(b.x, b.y, 140, '#22d3ee');
            for (const d of [-1, 1]) L.projs.push({ kind: 'wave', x: b.x + d * 50, y: ARENA_Y, vx: d * 460, vy: 0, grav: 0, r: 26, life: 1.4, dmg: 1, from: 'e' });
            hitPlayerBox({ l: b.x - 70, r: b.x + 70, t: b.y - 160, b: b.y }, 2, b.x);
          }
          break;
        case 'land': if (b.st > 0.6) { b.state = 'idle'; b.cd = p2 ? 0.6 : 1.1; } break;
        case 'beam':
          if (b.st > 0.85 && !b.fired) {
            b.fired = true; Sound.play('zap'); app.shake = 5;
            L.projs.push({ kind: 'beam', x: b.x, y: b.y - 34, dir: b.face, life: 0.55, dmg: 1, from: 'e', len: VW });
          }
          if (b.st > 1.6) { b.fired = false; b.state = 'idle'; b.cd = p2 ? 0.6 : 1.2; }
          break;
        case 'dash':
          if (b.st < 0.45) break;
          if (!b.dashing) { b.dashing = true; Sound.play('roar'); }
          b.x += b.face * 680 * dt;
          if (Math.random() < 0.5) ghosts.push({ x: b.x, y: b.y, look: LOOKS.jackalgod, pose: P.charge, face: b.face, t: 0, life: 0.3 });
          hitPlayerBox(b.boxes()[0], 2, b.x);
          if (b.x < ax + 80 || b.x > ax + VW - 80 || b.st > 2) { b.dashing = false; b.state = 'idle'; b.cd = 1; b.x = clamp(b.x, ax + 80, ax + VW - 80); }
          break;
      }
      if (b.state !== 'enter') b.x = clamp(b.x, ax + 60, ax + VW - 60);
      if (b.state !== 'dead' && b.state !== 'enter' && b.state !== 'dash') hitPlayerBox(b.boxes()[0], 1, b.x);
    };
    b.pose = () => {
      const s = b.st;
      switch (b.state) {
        case 'enter': case 'idle': return Math.abs(pl.x - b.x) > 140 && b.state === 'idle' || b.state === 'enter' ? Art.lerpPose(P.walkA, P.walkB, (Math.sin(b.anim * 8) + 1) / 2) : P.idle;
        case 'swing': return s < 0.5 ? Art.lerpPose(P.idle, P.slashUp, s / 0.5) : s < 0.72 ? P.slash : Art.lerpPose(P.slash, P.idle, (s - 0.72) / 0.43);
        case 'leap': return s < 0.35 ? P.crouchPre : P.jump;
        case 'land': return P.slam;
        case 'beam': return s < 0.85 ? Art.lerpPose(P.idle, P.taunt, Math.min(1, s / 0.4)) : P.blast;
        case 'dash': return s < 0.45 ? P.crouchPre : P.charge;
        case 'dead': return P.down;
      }
      return P.idle;
    };
    b.draw = cam => {
      const a = b.state === 'dead' ? Math.max(0, 1 - b.st / 1.8) : 1;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(b.x - cam, ARENA_Y - L.camY, 60, 12, 0, 0, Math.PI * 2); ctx.fill();
      if (b.state === 'beam' && b.st < 0.85) {
        const k = b.st / 0.85;
        const g = ctx.createRadialGradient(b.x - cam + b.face * 20, b.y - L.camY - 190, 2, b.x - cam + b.face * 20, b.y - L.camY - 190, 40 * k + 10);
        g.addColorStop(0, 'rgba(165,243,252,.9)'); g.addColorStop(1, 'rgba(34,211,238,0)');
        ctx.fillStyle = g; ctx.fillRect(b.x - cam - 80, b.y - L.camY - 270, 200, 160);
      }
      Art.drawFighter(ctx, b.x - cam, b.y - L.camY, LOOKS.jackalgod, b.pose(), b.face, { flash: b.flash > 0, t: b.t, alpha: a });
    };
    return b;
  }
  function summonMummies(ax) {
    Sound.play('roar');
    for (const x of [ax + 60, ax + VW - 60]) { const e = makeEnemy('mummy', x, ARENA_Y); e.summoned = true; e.face = x < pl.x ? 1 : -1; L.enemies.push(e); puff(x, ARENA_Y - 30, 14); }
  }

  function makeApep(ax) {
    const b = { name: 'APEP', title: 'Serpent of Chaos', t: 0, cd: 2, flash: 0, heads: [], dead: false, state: 'fight', st: 0 };
    const bases = [ax + 300, ax + 480, ax + 660];
    bases.forEach((bx, i) => b.heads.push({ i, bx, by: 640, x: bx, y: 700, restY: 200 + (i % 2) * 50, hp: bossHp(18), state: 'rise', st: 0, flash: 0, tx: 0, ty: 0, open: 0, alpha: 1, face: i === 0 ? 1 : i === 2 ? -1 : (pl.x < bx ? -1 : 1) }));
    b.maxHp = b.heads.reduce((s, h) => s + h.hp, 0);
    Object.defineProperty(b, 'hp', { get: () => b.heads.reduce((s, h) => s + Math.max(0, h.hp), 0) });
    b.boxes = () => b.heads.filter(h => h.state !== 'dead' && h.state !== 'rise').map(h => ({ l: h.x - 36, r: h.x + 36, t: h.y - 34, b: h.y + 30, part: h }));
    b.hurt = (d, h) => {
      if (h.state === 'dead') return;
      h.hp -= d; h.flash = 0.12; b.flash = 0.1;
      sparks(h.x, h.y, 10, ['#e9d5ff', '#a855f7', '#fff']);
      Sound.play('punch', true); app.hitstop = 0.05; app.shake = 4;
      pl.energy = Math.min(100, pl.energy + 6);
      if (h.hp <= 0) { h.state = 'dead'; h.st = 0; Sound.play('roar'); app.shake = 10; app.score += 3000; popText(h.x, h.y - 40, '+3000', '#fde047', 24); }
      if (b.heads.every(x => x.state === 'dead')) bossDefeated(b);
    };
    b.update = dt => {
      b.t += dt; b.cd -= dt;
      const alive = b.heads.filter(h => h.state !== 'dead');
      const faster = alive.length === 1 ? 0.55 : alive.length === 2 ? 0.8 : 1;
      if (b.cd <= 0 && alive.every(h => h.state === 'idle' || h.state === 'dead')) {
        const h = pick(alive.filter(x => x.state === 'idle'));
        if (h) {
          if (Math.random() < 0.6) { h.state = 'tele'; h.tx = clamp(pl.x, ax + 60, ax + VW - 60); h.ty = clamp(pl.y - 40, 170, 460); }
          else h.state = 'spit';
          h.st = 0;
        }
        b.cd = rand(1.2, 1.9) * faster;
      }
      for (const h of b.heads) {
        h.st += dt; if (h.flash > 0) h.flash -= dt;
        const restX = h.bx + Math.sin(b.t * 1.1 + h.i * 2) * 40, restY = h.restY + Math.sin(b.t * 1.7 + h.i) * 14;
        if (h.state !== 'strike' && h.state !== 'stuck') h.face = pl.x < h.x ? -1 : 1;
        switch (h.state) {
          case 'rise': h.x += (restX - h.x) * dt * 3; h.y += (restY - h.y) * dt * 2.2; if (h.st > 1.6) { h.state = 'idle'; } break;
          case 'idle': h.x += (restX - h.x) * dt * 4; h.y += (restY - h.y) * dt * 4; h.open += (0 - h.open) * dt * 5; break;
          case 'tele':
            h.x += (restX - h.face * 30 - h.x) * dt * 5 + Math.sin(b.t * 50) * 1.5; h.y += (restY - 40 - h.y) * dt * 5; h.open = 0.5;
            if (h.st > 0.65 * faster + 0.15) { h.state = 'strike'; h.st = 0; h.sx = h.x; h.sy = h.y; Sound.play('roar'); }
            break;
          case 'strike': {
            const k = Math.min(1, h.st / 0.22);
            h.x = h.sx + (h.tx - h.sx) * k; h.y = h.sy + (h.ty - h.sy) * k; h.open = 1;
            if (k >= 1) { h.state = 'stuck'; h.st = 0; app.shake = 6; Sound.play('shock'); puff(h.x, h.y + 20, 8, 'rgba(196,181,253,'); }
            break;
          }
          case 'stuck': h.open = 0.3; if (h.st > 1) { h.state = 'back'; h.st = 0; } break;
          case 'back': h.x += (restX - h.x) * dt * 4; h.y += (restY - h.y) * dt * 4; if (h.st > 0.6) h.state = 'idle'; break;
          case 'spit':
            h.open = Math.min(1, h.st * 2.5);
            if (h.st > 0.45 && !h.spat) {
              h.spat = true; Sound.play('fire');
              const ddx = pl.x - h.x, ddy = pl.y - 40 - h.y, d = Math.hypot(ddx, ddy);
              L.projs.push({ kind: 'efire', x: h.x + h.face * 30, y: h.y, vx: ddx / d * 380, vy: ddy / d * 380, grav: 0, r: 15, life: 3, dmg: 1, from: 'e' });
            }
            if (h.st > 0.9) { h.spat = false; h.state = 'idle'; }
            break;
          case 'dead': h.y += 160 * dt; h.alpha = Math.max(0, 1 - h.st / 1.4); break;
        }
        if ((h.state === 'strike' || h.state === 'stuck' || h.state === 'tele') && h.alpha > 0) hitPlayerBox({ l: h.x - 32, r: h.x + 32, t: h.y - 28, b: h.y + 26 }, 1, h.x);
      }
    };
    b.draw = cam => {
      for (const h of b.heads) if (h.alpha > 0) Art.drawSerpent(ctx, h.bx - cam, h.by - L.camY, h.x - cam, h.y - L.camY, b.t + h.i, h.open, h.flash > 0, h.alpha, h.face);
    };
    return b;
  }

  function hitPlayerBox(box, dmg, srcX) { if (box && overlap(box, boxOf(pl))) hurtPlayer(dmg, srcX); }
  function bossHurt(b, d) {
    if (b.state === 'dead' || b.state === 'enter') return;
    b.hp -= d; b.flash = 0.12;
    sparks(pl.x + pl.face * 50, pl.y - 60, 9);
    Sound.play('punch', d > 1); app.hitstop = 0.05; app.shake = Math.max(app.shake, 3);
    pl.energy = Math.min(100, pl.energy + 6);
    if (b.hp <= 0) { b.hp = 0; b.state = 'dead'; b.st = 0; bossDefeated(b); }
  }
  function startBoss() {
    L.arena = true;
    const ax = L.arenaX, kind = L.def.boss;
    L.boss = kind === 'scorpion' ? makeScorpion(ax) : kind === 'jackalgod' ? makeJackalGod(ax) : makeApep(ax);
    Sound.music('boss'); Sound.play('roar');
    $('#bossName').textContent = L.boss.name; $('#bossTitle').textContent = L.boss.title;
    $('#bossBar').classList.remove('hidden');
    showCard('Guardian', L.boss.name, L.boss.title, true);
    app.shake = 8;
  }
  function bossDefeated(b) {
    if (L.bossDone) return;
    L.bossDone = true; b.dead = true;
    app.score += 10000; app.slow = 1.4; app.flash = 0.8;
    Sound.stopMusic(); Sound.play('superMove');
    for (const e of L.enemies) if (!e.dying) hurtEnemy(e, 99, 1);
    L.projs = L.projs.filter(q => q.from === 'p');
    setTimeout(() => { if (L && L.boss === b) { pl.state = 'win'; pl.st = 0; Sound.play('clear'); } }, 1400);
    setTimeout(() => { if (L && L.boss === b) levelComplete(); }, 3200);
  }

  // ---------- projectiles ----------
  function updateProjs(dt) {
    for (let i = L.projs.length - 1; i >= 0; i--) {
      const q = L.projs[i];
      q.life -= dt; q.t = (q.t || 0) + dt;
      let dead = q.life <= 0;
      if (q.kind === 'beam') {
        const box = q.dir > 0 ? { l: q.x, r: q.x + q.len, t: q.y - 14, b: q.y + 14 } : { l: q.x - q.len, r: q.x, t: q.y - 14, b: q.y + 14 };
        if (q.life > 0.1) hitPlayerBox(box, q.dmg, q.x);
        if (dead) L.projs.splice(i, 1);
        continue;
      }
      if (q.kind === 'disc') {
        if (!q.back && q.t > 0.42) { q.back = true; q.hit = new Set(); }
        if (q.back) {
          const dx = pl.x - q.x, dy = pl.y - 50 - q.y, d = Math.hypot(dx, dy) || 1;
          q.vx += dx / d * 3200 * dt; q.vy += dy / d * 3200 * dt;
          const sp = Math.hypot(q.vx, q.vy); if (sp > 760) { q.vx *= 760 / sp; q.vy *= 760 / sp; }
          if (d < 30) dead = true;
        }
      }
      q.vy += (q.grav || 0) * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.kind === 'pfire' || q.kind === 'efire') if (Math.random() < 0.7) fx({ k: 'ember', x: q.x, y: q.y + rand(-8, 8), vx: -q.vx * 0.15, vy: rand(-80, -10), life: 0.35, r: rand(3, 6) });
      if (q.kind === 'wave' || q.kind === 'pbolt') { if (Math.random() < 0.6) puff(q.x, q.y - 4, 1, q.kind === 'pbolt' ? 'rgba(186,230,253,' : 'rgba(165,243,252,'); }
      // walls stop most shots
      if (q.kind !== 'disc' && q.kind !== 'wave' && q.kind !== 'pbolt' && solid(tile(Math.floor(q.x / TS), Math.floor(q.y / TS)))) { dead = true; puff(q.x, q.y, 3); }
      if (q.from === 'p') {
        const box = q.kind === 'pbolt' ? { l: q.x - 22, r: q.x + 22, t: q.y - 70, b: q.y } : { l: q.x - q.r, r: q.x + q.r, t: q.y - q.r, b: q.y + q.r };
        for (const t of targets()) {
          if (q.hit.has(t.ref) || !overlap(box, t.box)) continue;
          q.hit.add(t.ref); t.hurt(q.dmg, Math.sign(q.vx) || 1);
          if (q.kind === 'pfire') { dead = true; break; }
        }
      } else {
        const box = q.kind === 'wave' ? { l: q.x - 24, r: q.x + 24, t: q.y - 34, b: q.y } : { l: q.x - q.r, r: q.x + q.r, t: q.y - q.r, b: q.y + q.r };
        if (overlap(box, boxOf(pl)) && pl.state !== 'dead') { hurtPlayer(q.dmg, q.x - (q.vx || 0) * 0.01); if (q.kind !== 'wave') dead = true; }
        // the hero's blade can knock arrows and fireballs away
        if (pl.atk && pl.atk.kind !== 'plunge' && q.kind !== 'wave' && Math.abs(q.x - (pl.x + pl.face * 40)) < 46 && Math.abs(q.y - (pl.y - 50)) < 46 && pl.atk.t >= pl.atk.act[0] && pl.atk.t <= pl.atk.act[1]) {
          dead = true; sparks(q.x, q.y, 6, ['#fff', '#7dd3fc']); Sound.play('block'); app.score += 20;
        }
      }
      if (q.x < L.camX - 300 || q.x > L.camX + VW + 300 || q.y > L.H * TS + 200) dead = true;
      if (dead) L.projs.splice(i, 1);
    }
  }

  const ghosts = [];
  function updateFx(dt) {
    for (let i = L.fx.length - 1; i >= 0; i--) {
      const f = L.fx[i];
      f.t += dt;
      if (f.k === 'bit' || f.k === 'ember' || f.k === 'puff') { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 1 - 4 * dt; f.vy *= 1 - 3 * dt; }
      if (f.k === 'chunk') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 1500 * dt; f.rot += f.vr * dt; }
      if (f.t > f.life) L.fx.splice(i, 1);
    }
    for (let i = ghosts.length - 1; i >= 0; i--) { ghosts[i].t += dt; if (ghosts[i].t > ghosts[i].life) ghosts.splice(i, 1); }
    for (const it of L.items) {
      it.t += dt;
      if (it.fall) {
        it.vy += 1400 * dt; it.y += it.vy * dt;
        const ty = Math.floor((it.y + 14) / TS), c = tile(Math.floor(it.x / TS), ty);
        if (it.vy > 0 && (solid(c) || c === '=')) { it.y = ty * TS - 14; it.fall = false; }
        if (it.y > L.H * TS + 50) it.fall = false;
      }
    }
  }

  // ---------- main update ----------
  function update(dt) {
    app.time += dt;
    if (app.state !== 'play') return;
    if (Input.get(0).hit.start && !app.eat) { pause(); return; }
    if (app.slow > 0) { app.slow -= dt; dt *= 0.35; }
    if (app.flash > 0) app.flash -= dt * 1.5;
    if (app.shake > 0) app.shake = Math.max(0, app.shake - dt * 30);
    if (app.hitstop > 0) { app.hitstop -= dt; return; }
    app.t += dt; L.t += dt;
    for (const p of L.plats) { const nx = p.x0 + Math.sin(L.t * p.speed + p.phase) * p.range; p.dx = nx - p.x; p.x = nx; }
    updatePlayer(dt);
    if (!L) return;
    for (const e of L.enemies) updateEnemy(e, dt);
    L.enemies = L.enemies.filter(e => !(e.dying && e.st > 0.5));
    if (L.boss) { L.boss.update(dt); if (L.boss.state === 'dead') L.boss.st += 0; }
    updateProjs(dt);
    updateFx(dt);
    updateCamera(dt);
    updateHud();
  }

  function updateCamera(dt) {
    const maxX = L.W * TS - VW;
    if (L.arena) L.camX += (L.arenaX - L.camX) * Math.min(1, dt * 4);
    else if (L.chase) {
      if (L.chaseDelay > 0) L.chaseDelay -= dt;
      else if (pl.state !== 'dead') L.camX = Math.min(maxX, L.camX + L.chase * dt);
    } else {
      const target = pl.x - VW * 0.42 + pl.face * 70;
      L.camX += (target - L.camX) * Math.min(1, dt * 5);
    }
    L.camX = clamp(L.camX, 0, maxX);
    const ty = clamp(pl.y - 380, 0, L.H * TS - VH);
    L.camY += (ty - L.camY) * Math.min(1, dt * 4);
  }

  // ---------- render ----------
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const s = Math.min(innerWidth / VW, innerHeight / VH);
    const w = Math.floor(VW * s), h = Math.floor(VH * s);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    K = cv.width / VW;
    if (L) L.sprites = Art.tileSprites(L.def.theme, K);
    const left = (innerWidth - w) / 2 + 'px', top = (innerHeight - h) / 2 + 'px';
    Object.assign($('#hud').style, { left, top, width: w + 'px' });
    Object.assign($('#btns').style, { right: `calc(${left} + 14px)`, bottom: `calc(${top} + 12px)` });
    Object.assign($('#bossBar').style, { bottom: `calc(${top} + 20px)` });
  }

  function hash(x, y) { return ((x * 73856093) ^ (y * 19349663)) >>> 0; }

  function drawTiles(cam, camY) {
    const S = L.sprites, th = L.def.theme;
    const x0 = Math.floor(cam / TS), x1 = Math.ceil((cam + VW) / TS);
    for (let ty = 0; ty < L.H; ty++) for (let tx = x0; tx <= x1; tx++) {
      const c = tile(tx, ty);
      if (c === '.' || tx < 0 || tx >= L.W) continue;
      const x = tx * TS - cam, y = ty * TS - camY;
      if (c === '#') {
        const topEdge = !solid(tile(tx, ty - 1));
        const h = hash(tx, ty);
        ctx.drawImage(topEdge ? S.tops[h % S.tops.length] : S.mids[h % S.mids.length], x, y, TS + 0.5, TS + 0.5);
      } else if (c === '=') ctx.drawImage(S.plat, x, y, TS + 0.5, TS);
      else if (c === 'B') ctx.drawImage(S.brk, x, y, TS, TS);
      else if (c === '^') ctx.drawImage(S.spike, x, y, TS, TS);
      else if (c === '~') Art.drawLiquid(ctx, th, x, y, TS + 0.5, L.t, tile(tx, ty - 1) !== '~');
    }
  }

  function heroPose(p) {
    if (p.state === 'dead') return p.vy < 0 ? P.hurt : Object.assign({}, P.fall, { rot: -p.st * 6 });
    if (p.state === 'win') return Art.lerpPose(P.idle, P.victory, Math.min(1, p.st / 0.3));
    if (p.state === 'hurt') return P.hurt;
    if (p.state === 'plunge') return P.plunge;
    if (p.atk) {
      const a = p.atk, k = a.t / a.dur;
      if (a.kind === 'air') return k < 0.3 ? Art.lerpPose(P.jump, P.slashUp, k / 0.3) : Art.lerpPose(P.slashUp, P.slash, Math.min(1, (k - 0.3) / 0.3));
      const seq = [[P.slashUp, P.slash], [P.slash, P.slashBack], [P.hammerUp, P.hammer]][a.idx];
      const s0 = a.act[0] / a.dur;
      return k < s0 ? Art.lerpPose(P.idle, seq[0], k / s0) : k < s0 + 0.2 ? Art.lerpPose(seq[0], seq[1], (k - s0) / 0.2) : Art.lerpPose(seq[1], P.idle, Math.min(1, (k - s0 - 0.2) / (1 - s0 - 0.2)));
    }
    if (!p.onGround) {
      const base = p.vy < 0 ? P.jump : P.fallAir;
      if (p.djT > 0) return Object.assign({}, P.jump, { rot: (0.35 - p.djT) / 0.35 * Math.PI * 2 * 0.999 });
      return base;
    }
    if (Math.abs(p.vx) > 40) return Art.lerpPose(P.runA, P.runB, (Math.sin(p.anim * 2.2) + 1) / 2);
    const id = Object.assign({}, P.idle); id.hipY += Math.sin(app.time * 3) * 1.2; return id;
  }

  function enemyPose(e) {
    if (e.stun > 0 || e.dying) return P.hurt;
    const walk = Art.lerpPose(P.walkA, P.walkB, (Math.sin(e.anim * (e.state === 'chase' ? 14 : 8)) + 1) / 2);
    if (e.type === 'jackal') {
      if (e.state === 'wind') return Art.lerpPose(P.idle, P.windup, Math.min(1, e.st / 0.3));
      if (e.state === 'thrust') return P.thrust;
      if (e.state === 'recover') return Art.lerpPose(P.thrust, P.idle, Math.min(1, e.st / 0.45));
      if (e.state === 'chase') return Art.lerpPose(P.runA, P.runB, (Math.sin(e.anim * 14) + 1) / 2);
      return walk;
    }
    if (e.type === 'mummy') return Object.assign({}, walk, { aF: 1.5, eF: 0.05, aB: 1.35, eB: 0.1, lean: e.state === 'lunge' ? 0.4 : 0.15, head: 0.2 });
    if (e.type === 'archer') return e.state === 'draw' ? P.bowDraw : P.idle;
    return P.idle;
  }

  function drawSlashTrail(p, cam, camY) {
    const a = p.atk;
    if (!a || a.kind === 'plunge' || a.t < a.act[0] || a.t > a.act[1] + 0.06) return;
    const k = (a.t - a.act[0]) / (a.act[1] - a.act[0] + 0.06);
    const col = p.potion ? BLADE[p.potion] : '#fff7d6';
    const cx = p.x - cam + p.face * 14, cy = p.y - camY - 48;
    const [s0, s1] = a.idx === 1 ? [0.9, -1.3] : a.idx === 2 ? [-2.2, 0.9] : [-1.5, 0.9];
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(p.face, 1);
    ctx.globalAlpha = 0.85 * (1 - k * 0.6);
    ctx.shadowColor = col; ctx.shadowBlur = 16;
    const end = s0 + (s1 - s0) * Math.min(1, k * 1.6);
    ctx.beginPath();
    ctx.arc(0, 0, 66, Math.min(s0, end), Math.max(s0, end));
    ctx.arc(0, 0, 46, Math.max(s0, end), Math.min(s0, end), true);
    ctx.closePath();
    const g = ctx.createRadialGradient(0, 0, 40, 0, 0, 70);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, col);
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
  }

  function render() {
    ctx.setTransform(K, 0, 0, K, 0, 0);
    if (!L || app.state === 'title' || app.state === 'map') { renderTitle(); return; }
    const cam = Math.round(L.camX * K) / K, camY = Math.round(L.camY * K) / K;
    ctx.save();
    if (app.shake) ctx.translate(rand(-app.shake, app.shake), rand(-app.shake, app.shake) * 0.6);
    Art.drawBG(ctx, L.def.theme, cam, camY, L.t);
    drawTiles(cam, camY);
    for (const c of L.checks) if (c.x > cam - 60 && c.x < cam + VW + 60) Art.drawObelisk(ctx, c.x - cam, c.y - camY, c.lit, L.t);
    if (L.gate) Art.drawGate(ctx, L.gate.x - cam, L.gate.y - camY, L.t);
    for (const p of L.plats) Art.drawPlatform(ctx, p.x - cam, p.y - camY, p.w, L.def.theme);
    for (const it of L.items) {
      if (it.x < cam - 40 || it.x > cam + VW + 40) continue;
      const x = it.x - cam, y = it.y - camY;
      if (it.type === 'coin') Art.drawCoin(ctx, x, y, it.t);
      else if (it.type === 'letter') Art.drawLetter(ctx, x, y, it.ch, L.t);
      else if (it.type === 'jar') Art.drawJar(ctx, x, y, it.t);
      else Art.drawPotion(ctx, x, y, it.kind, L.t);
    }
    if (L.boss && L.def.boss === 'apep') L.boss.draw(cam);
    for (const e of L.enemies) {
      if (e.x < cam - 100 || e.x > cam + VW + 100) continue;
      const x = e.x - cam, y = e.y - camY, fl = e.flash > 0;
      ctx.save();
      if (e.dying) { ctx.globalAlpha = Math.max(0, 1 - e.st / 0.5); }
      if (e.type !== 'vulture') { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y, e.w * 0.7, 5, 0, 0, Math.PI * 2); ctx.fill(); }
      if (e.type === 'scarab') Art.drawScarab(ctx, x, y, e.face, e.anim, fl);
      else if (e.type === 'vulture') Art.drawVulture(ctx, x, y, e.face, e.anim, fl);
      else if (e.type === 'cobra') Art.drawCobra(ctx, x, y, e.face, e.rise, e.anim, fl);
      else Art.drawFighter(ctx, x, y, LOOKS[e.type], enemyPose(e), e.face, { flash: fl, t: e.anim, hurt: e.stun > 0 });
      if (e.type === 'jackal' && e.state === 'wind') { ctx.fillStyle = '#ef4444'; ctx.font = '26px Cinzel, Georgia'; ctx.textAlign = 'center'; ctx.fillText('!', x, y - e.h - 22); }
      ctx.restore();
    }
    for (const g of ghosts) Art.drawFighter(ctx, g.x - cam, g.y - camY, g.look, g.pose, g.face, { alpha: 0.3 * (1 - g.t / g.life), t: 0 });
    if (L.boss && L.def.boss !== 'apep') L.boss.draw(cam);

    // hero
    const p = pl;
    if (!(p.invul > 0 && p.state !== 'dead' && Math.floor(app.time * 16) % 2)) {
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(p.x - cam, p.y - camY, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
      const look = p.potion ? Object.assign({}, HERO, { bladeGlow: BLADE[p.potion] }) : HERO;
      if (p.potion === 'shield') {
        const g = ctx.createRadialGradient(p.x - cam, p.y - camY - 40, 10, p.x - cam, p.y - camY - 40, 64);
        g.addColorStop(0, 'rgba(253,224,71,0)'); g.addColorStop(0.75, `rgba(253,224,71,${0.25 + 0.1 * Math.sin(app.time * 8)})`); g.addColorStop(1, 'rgba(253,224,71,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x - cam, p.y - camY - 40, 64, 0, Math.PI * 2); ctx.fill();
      }
      Art.drawFighter(ctx, p.x - cam, p.y - camY, look, heroPose(p), p.face, { flash: p.flash > 0, t: app.time, hurt: p.state === 'hurt' || p.state === 'dead' });
      drawSlashTrail(p, cam, camY);
    }

    for (const q of L.projs) drawProj(q, cam, camY);
    drawFx(cam, camY);

    if (L.chase) {
      const w = 70 + Math.sin(L.t * 3) * 8;
      const g = ctx.createLinearGradient(0, 0, w + 60, 0);
      g.addColorStop(0, 'rgba(120,70,30,.95)'); g.addColorStop(0.6, 'rgba(200,140,70,.7)'); g.addColorStop(1, 'rgba(230,180,110,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w + 60, VH);
      for (let i = 0; i < 18; i++) {
        const y = (i * 37 + L.t * 220) % VH;
        ctx.fillStyle = 'rgba(255,220,170,.4)'; ctx.fillRect(10 + Math.sin(L.t * 5 + i) * 20, y, 50 + (i % 3) * 20, 3);
      }
      if (L.chaseDelay > 0) { ctx.fillStyle = '#fde047'; ctx.font = '44px Cinzel, Georgia'; ctx.textAlign = 'center'; ctx.fillText('RUN!', VW / 2, 200); }
    }
    ctx.restore();
    if (app.flash > 0) { ctx.fillStyle = `rgba(255,248,220,${Math.min(0.8, app.flash)})`; ctx.fillRect(0, 0, VW, VH); }
  }

  function drawProj(q, cam, camY) {
    const x = q.x - cam, y = q.y - camY;
    switch (q.kind) {
      case 'disc': Art.drawDisc(ctx, x, y, q.t); break;
      case 'arrow': Art.drawArrow(ctx, x, y, Math.sign(q.vx)); break;
      case 'pfire': Art.drawFireball(ctx, x, y, q.r, q.t); break;
      case 'efire': Art.drawFireball(ctx, x, y, q.r, q.t, '#f5d0fe', '#a855f7'); break;
      case 'pbolt': Art.drawBolt(ctx, x, y, 70, q.t); break;
      case 'venom': Art.drawBlob(ctx, x, y, q.r, '#84cc16'); break;
      case 'sand': Art.drawBlob(ctx, x, y, q.r, '#d6a35c'); break;
      case 'wave': {
        ctx.save(); ctx.globalAlpha = Math.min(1, q.life * 2);
        const g = ctx.createLinearGradient(0, y - 46, 0, y);
        g.addColorStop(0, 'rgba(165,243,252,0)'); g.addColorStop(1, 'rgba(34,211,238,.9)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 26, y); ctx.quadraticCurveTo(x, y - 60, x + 26, y); ctx.closePath(); ctx.fill();
        ctx.restore(); break;
      }
      case 'beam': {
        const k = q.life / 0.55;
        ctx.save(); ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 24;
        ctx.fillStyle = `rgba(165,243,252,${0.6 + 0.4 * k})`;
        const l = q.dir > 0 ? x : x - q.len;
        ctx.fillRect(l, y - 12 * k, q.len, 24 * k);
        ctx.fillStyle = '#fff'; ctx.fillRect(l, y - 4 * k, q.len, 8 * k);
        ctx.restore(); break;
      }
    }
  }

  function drawFx(cam, camY) {
    for (const f of L.fx) {
      const k = f.t / f.life, x = f.x - cam, y = f.y - camY;
      switch (f.k) {
        case 'bit': case 'ember':
          ctx.globalAlpha = 1 - k; ctx.fillStyle = f.k === 'ember' ? pick(['#fb923c', '#fde047', '#ef4444']) : f.color;
          ctx.beginPath(); ctx.arc(x, y, f.r * (f.k === 'ember' ? 1 - k : 1), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; break;
        case 'puff':
          ctx.fillStyle = f.color + (0.45 * (1 - k)) + ')';
          ctx.beginPath(); ctx.arc(x, y, f.r * (1 + k), 0, Math.PI * 2); ctx.fill(); break;
        case 'chunk':
          ctx.save(); ctx.translate(x, y); ctx.rotate(f.rot); ctx.globalAlpha = Math.min(1, (1 - k) * 2);
          ctx.fillStyle = f.color; ctx.fillRect(-7, -5, 14, 10); ctx.strokeStyle = Art.OUT; ctx.lineWidth = 1.5; ctx.strokeRect(-7, -5, 14, 10);
          ctx.restore(); break;
        case 'ring':
          ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.color; ctx.lineWidth = 5 * (1 - k) + 1;
          ctx.beginPath(); ctx.ellipse(x, y, f.r * (0.3 + k), f.r * 0.3 * (0.3 + k), 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); break;
        case 'text':
          ctx.save(); ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
          ctx.font = `${f.size}px Cinzel, Georgia, serif`; ctx.textAlign = 'center';
          ctx.lineWidth = 4; ctx.strokeStyle = Art.OUT; ctx.strokeText(f.text, x, y - k * 40);
          ctx.fillStyle = f.color; ctx.fillText(f.text, x, y - k * 40);
          ctx.restore(); break;
      }
    }
  }

  function renderTitle() {
    const cam = app.time * 30;
    Art.drawBG(ctx, 'nile', cam, 0, app.time);
    const S = titleSprites || (titleSprites = Art.tileSprites('nile', K));
    const off = cam % TS;
    for (let i = -1; i < VW / TS + 2; i++) { ctx.drawImage(S.tops[Math.abs(i + Math.floor(cam / TS)) % 4], i * TS - off, 444, TS, TS); ctx.drawImage(S.mids[Math.abs(i * 3 + Math.floor(cam / TS)) % 7], i * TS - off, 492, TS, TS); }
    const pose = Art.lerpPose(P.runA, P.runB, (Math.sin(app.time * 9) + 1) / 2);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(300, 444, 22, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(300, 444); ctx.scale(1.3, 1.3);
    Art.drawFighter(ctx, 0, 0, HERO, pose, 1, { t: app.time });
    ctx.restore();
    Art.drawScarab(ctx, 560 + Math.sin(app.time) * 30, 444, -1, app.time, false);
  }
  let titleSprites = null;

  // ---------- HUD ----------
  const hc = {};
  function setH(sel, key, val, prop = 'textContent') { if (hc[key] !== val) { hc[key] = val; if (prop === 'width') $(sel).style.width = val; else $(sel)[prop] = val; } }
  function updateHud() {
    const p = pl;
    let hearts = '';
    for (let i = 0; i < p.maxHp; i++) hearts += `<i class="${i < p.hp ? 'on' : ''}"></i>`;
    setH('#hearts', 'hearts', hearts, 'innerHTML');
    setH('#lives', 'lives', '×' + Math.max(0, app.lives));
    setH('#energy i', 'en', p.energy.toFixed(0) + '%', 'width');
    $('#energy').classList.toggle('ready', p.energy >= 30);
    setH('#coins b', 'coins', String(app.coins));
    setH('#score', 'score', String(app.score).padStart(7, '0'));
    let letters = '';
    for (let i = 0; i < 8; i++) letters += `<span class="${L.gotLetters.has(i) ? 'on' : ''}">${WORD[i]}</span>`;
    setH('#letters', 'letters', letters, 'innerHTML');
    const pot = $('#potion');
    pot.classList.toggle('hidden', !p.potion);
    if (p.potion) {
      pot.style.setProperty('--pc', BLADE[p.potion]);
      setH('#potion .pn', 'pn', POTION_NAME[p.potion]);
      setH('#potion i', 'pt', (p.potT / 15 * 100).toFixed(0) + '%', 'width');
    }
    if (L.boss) {
      const r = Math.max(0, L.boss.hp / L.boss.maxHp) * 100;
      setH('#bossBar .fill', 'bhp', r.toFixed(1) + '%', 'width');
      setH('#bossBar .lag', 'blag', r.toFixed(1) + '%', 'width');
    }
  }

  function showCard(k, t, s, boss) {
    const el = $('#card');
    $('#cardK').textContent = k; $('#cardT').textContent = t; $('#cardS').textContent = s;
    el.classList.toggle('boss', !!boss);
    el.classList.remove('hidden');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  }

  // ---------- screens ----------
  function showOnly(id) { $$('.ov').forEach(o => o.classList.toggle('show', o.id === id)); }

  function toTitle() {
    app.state = 'title'; L = null;
    showOnly('title');
    $('#hud').classList.add('hidden'); $('#bossBar').classList.add('hidden'); $('#card').classList.add('hidden');
    const pr = loadProgress();
    $('#btnContinue').classList.toggle('hidden', !pr.level);
    $('#btnContinue').textContent = `Continue · ${LEVELS[Math.min(pr.level, 3)].sub}`;
    $('#hiScore').textContent = pr.hi ? `Best score ${String(pr.hi).padStart(7, '0')}` : '';
    Sound.music('title');
  }

  function newGame(level) {
    Sound.ensure(); Sound.play('confirm');
    app.score = 0; app.coins = 0; app.lives = DIFF[app.diff].lives; app.level = level;
    showMap();
  }

  function showMap() {
    app.state = 'map';
    $('#hud').classList.add('hidden'); $('#bossBar').classList.add('hidden');
    const nodes = $('#nodes');
    nodes.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const n = document.createElement('div');
      n.className = 'node' + (i < app.level ? ' done' : i === app.level ? ' cur' : '');
      n.innerHTML = `<div class="dot">${i < app.level ? '✓' : ['☥', '☀', '⚱', '◈'][i]}</div><div class="nn">${lv.sub}</div><div class="nt">${lv.name}</div>`;
      nodes.appendChild(n);
    });
    $('#mapTitle').textContent = LEVELS[app.level].name;
    $('#mapSub').textContent = LEVELS[app.level].chase ? 'Outrun the sandstorm — it will not wait for you!' : LEVELS[app.level].boss ? 'A guardian waits at the end of the path.' : '';
    showOnly('map');
  }

  function startLevel() {
    Sound.ensure(); Sound.play('confirm');
    loadLevel(app.level);
    app.levelStartScore = app.score;
    app.levelStartCoins = app.coins;
    app.t = 0; app.state = 'play';
    showOnly(null);
    $('#hud').classList.remove('hidden');
    $('#bossBar').classList.add('hidden');
    showCard(L.def.sub, L.def.name.toUpperCase(), L.def.chase ? 'The storm is coming. RUN!' : 'Find the eight letters of SUNBLADE');
    Sound.music(L.def.song);
  }

  function levelComplete() {
    if (app.state !== 'play') return;
    app.state = 'clear';
    const letters = L.gotLetters.size;
    const timeBonus = Math.max(0, Math.round((240 - app.t) * 15));
    const hpBonus = pl.hp * 300;
    app.score += timeBonus + hpBonus;
    $('#tally').innerHTML = `<span>Letters</span><span>${letters} / 8${letters === 8 ? ' ★' : ''}</span>
      <span>Ankh coins</span><span>${app.coins - app.levelStartCoins}</span>
      <span>Time bonus</span><span>${timeBonus}</span><span>Health bonus</span><span>${hpBonus}</span>
      <span class="tot">Score</span><span>${app.score}</span>`;
    const last = app.level === LEVELS.length - 1;
    $('#btnNext').textContent = last ? 'Finish' : 'Continue';
    const pr = loadProgress();
    pr.level = Math.max(pr.level, Math.min(app.level + 1, LEVELS.length - 1));
    saveProgress(pr);
    $('#bossBar').classList.add('hidden');
    Sound.stopMusic(); Sound.play('clear');
    showOnly('clear');
  }

  function gameOver() {
    app.state = 'over';
    const pr = loadProgress();
    if (app.score > pr.hi) { pr.hi = app.score; saveProgress(pr); }
    $('#overT').textContent = 'THE SANDS CLAIM YOU';
    $('#overS').textContent = `Score ${app.score}. Try the chapter again?`;
    $('#btnRetry').classList.remove('hidden');
    Sound.stopMusic(); Sound.play('lose');
    $('#bossBar').classList.add('hidden');
    showOnly('over');
  }

  function showEnding() {
    app.state = 'over';
    const pr = loadProgress();
    const best = app.score > pr.hi;
    if (best) { pr.hi = app.score; }
    pr.level = 0; saveProgress(pr);
    $('#overT').textContent = 'THE SUN RISES AGAIN';
    $('#overS').textContent = `Apep is sealed away and the Nile is safe. Final score ${app.score}${best ? ' — a new record!' : ''}`;
    $('#btnRetry').classList.add('hidden');
    Sound.play('clear');
    showOnly('over');
  }

  function pause() { if (app.state !== 'play') return; app.state = 'paused'; $('#pause').classList.add('show'); }
  function resume() { if (app.state !== 'paused') return; app.state = 'play'; $('#pause').classList.remove('show'); }

  // ---------- wiring ----------
  $('#btnNew').addEventListener('click', () => newGame(0));
  $('#btnContinue').addEventListener('click', () => newGame(Math.min(loadProgress().level, LEVELS.length - 1)));
  $('#diffSeg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    Sound.ensure(); Sound.play('select'); app.diff = b.dataset.v;
    $$('#diffSeg button').forEach(x => x.classList.toggle('on', x === b));
  });
  $('#btnBegin').addEventListener('click', startLevel);
  $('#btnMapBack').addEventListener('click', toTitle);
  $('#btnNext').addEventListener('click', () => { Sound.play('confirm'); if (app.level === LEVELS.length - 1) showEnding(); else { app.level++; showMap(); } });
  $('#btnRetry').addEventListener('click', () => { app.lives = DIFF[app.diff].lives; app.score = app.levelStartScore; app.coins = app.levelStartCoins; startLevel(); });
  $('#btnTitle').addEventListener('click', toTitle);
  $('#btnResume').addEventListener('click', resume);
  $('#btnRestart').addEventListener('click', () => { $('#pause').classList.remove('show'); app.score = app.levelStartScore; app.coins = app.levelStartCoins; startLevel(); });
  $('#btnQuit').addEventListener('click', toTitle);
  $('#btnPause').addEventListener('click', pause);
  const syncAudio = () => { $('#btnMusic').classList.toggle('off', !Sound.musicOn); $('#btnSfx').classList.toggle('off', !Sound.sfxOn); };
  $('#btnMusic').addEventListener('click', () => { Sound.ensure(); Sound.toggleMusic(); syncAudio(); });
  $('#btnSfx').addEventListener('click', () => { Sound.ensure(); Sound.toggleSfx(); syncAudio(); });
  syncAudio();
  addEventListener('keydown', e => {
    Sound.ensure();
    if (e.code === 'Escape' || e.code === 'KeyP') app.state === 'paused' ? resume() : pause();
    if (e.code === 'KeyM') { Sound.toggleMusic(); syncAudio(); }
  });
  addEventListener('pointerdown', () => { if (Sound.ensure() && app.state === 'title') Sound.music('title'); }, { once: true });

  function menuKeys() {
    const i = Input.get(0), before = app.state;
    app.eat = false;
    const ok = i.hit.start || i.hit.atk || i.hit.jump;
    if (app.state === 'title' && ok) newGame(0);
    else if (app.state === 'map' && ok) startLevel();
    else if (app.state === 'clear' && i.hit.start) $('#btnNext').click();
    else if (app.state === 'paused' && i.hit.start) resume();
    if (app.state !== before) app.eat = true;
  }

  // touch
  if (matchMedia('(pointer: coarse)').matches) {
    $('#touch').classList.remove('hidden');
    const stick = $('#stick'), knob = $('#knob');
    let sid = null;
    const setStick = e => {
      const r = stick.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy), max = r.width / 2 - 20;
      if (len > max) { dx *= max / len; dy *= max / len; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      const T = Input.touch, th = 16;
      T.left = dx < -th; T.right = dx > th; T.up = dy < -th * 1.5; T.down = dy > th * 1.5;
    };
    stick.addEventListener('pointerdown', e => { sid = e.pointerId; stick.setPointerCapture(sid); setStick(e); Sound.ensure(); });
    stick.addEventListener('pointermove', e => { if (e.pointerId === sid) setStick(e); });
    const end = e => { if (e.pointerId !== sid) return; sid = null; knob.style.transform = ''; Object.assign(Input.touch, { left: false, right: false, up: false, down: false }); };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
    $$('#tbtns .tb').forEach(b => {
      const k = b.dataset.b;
      b.addEventListener('pointerdown', e => { e.preventDefault(); Sound.ensure(); Input.touch[k] = true; Input.touchHits.add(k); b.classList.add('down'); });
      const up = () => { Input.touch[k] = false; b.classList.remove('down'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    });
  }

  // ---------- loop ----------
  let last = performance.now();
  function frame(now) {
    let dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    Input.poll();
    menuKeys();
    // two half-steps keep fast falls from tunnelling through ledges
    const steps = dt > 1 / 50 ? 2 : 1;
    for (let s = 0; s < steps; s++) { update(dt / steps); if (s === 0) Input.clearHits(); }
    render();
    requestAnimationFrame(frame);
  }
  Object.assign(app, { shake: 0, flash: 0, slow: 0, hitstop: 0, t: 0, eat: false });
  addEventListener('resize', resize);
  resize();
  toTitle();
  requestAnimationFrame(frame);

  window.__sunblade = { app, get L() { return L; }, get pl() { return pl; }, startLevel, newGame, loadLevel: i => { app.level = i; startLevel(); } };
})();
