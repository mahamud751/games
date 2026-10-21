(() => {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const W = 480, H = 720;
  const KEY = 'sortie-best';
  const menu = document.getElementById('menu');
  const over = document.getElementById('over');
  let best = Number(localStorage.getItem(KEY) || 0);
  document.getElementById('best').textContent = best;

  const keys = {};
  let pointer = null;
  let player, bullets, foes, shots, drops, parts, stars, score, wave, lives, toSpawn, spawnIn, gap, boss, phase, spread;

  function scramble() {
    player = { x: W / 2, y: H - 110, r: 16, cool: 0, inv: 2 };
    bullets = []; foes = []; shots = []; drops = []; parts = [];
    stars = Array.from({ length: 50 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: 0.4 + Math.random() }));
    score = 0; wave = 1; lives = 3; spread = 0; boss = null;
    toSpawn = 0; spawnIn = 0; gap = 1.2;
    phase = 'play';
    openWave();
    menu.hidden = true;
    over.hidden = true;
    hud();
  }

  function hud() {
    document.getElementById('score').textContent = score;
    document.getElementById('wave').textContent = wave;
    document.getElementById('lives').textContent = lives;
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      parts.push({ x, y, vx: (Math.random() - .5) * 220, vy: (Math.random() - .5) * 220, life: 0.4 + Math.random() * .3, color });
    }
  }

  function openWave() {
    if (wave % 4 === 0) {
      boss = { x: W / 2, y: 90, r: 36, hp: 28 + wave * 3, max: 28 + wave * 3, t: 0, cool: 0.4 };
      toSpawn = 0;
    } else toSpawn = 4 + wave;
    spawnIn = 0.3;
  }

  function spawnOne() {
    const kind = Math.random() < 0.28 ? 'dart' : 'drone';
    foes.push({
      kind, x: 40 + Math.random() * (W - 80), y: -30,
      r: kind === 'dart' ? 14 : 16,
      hp: 1 + Math.floor(wave / 4),
      t: Math.random() * 6,
      cool: 1 + Math.random()
    });
  }

  function fire() {
    const fan = spread > 0 ? [-0.28, 0, 0.28] : [0];
    for (const a of fan) {
      bullets.push({ x: player.x, y: player.y - 16, vx: Math.sin(a) * 140, vy: -560, r: 3 });
    }
  }

  function hitPlayer() {
    if (player.inv > 0 || phase !== 'play') return;
    lives -= 1;
    player.inv = 1.6;
    burst(player.x, player.y, '#ff8d7a', 16);
    shots.length = 0;
    hud();
    if (lives <= 0) {
      phase = 'over';
      if (score > best) {
        best = score;
        localStorage.setItem(KEY, String(best));
        document.getElementById('best').textContent = best;
      }
      document.getElementById('final').textContent = score;
      over.hidden = false;
    }
  }

  function kill(f) {
    score += f.boss ? 400 : f.kind === 'dart' ? 30 : 20;
    burst(f.x, f.y, f.boss ? '#ffd56a' : '#9ad7ff', f.boss ? 24 : 8);
    if (!f.boss && Math.random() < 0.14) {
      drops.push({ x: f.x, y: f.y, kind: Math.random() < 0.7 ? 'spread' : 'life', vy: 70 });
    }
    hud();
  }

  function update(dt) {
    spread = Math.max(0, spread - dt);
    player.inv = Math.max(0, player.inv - dt);
    player.cool -= dt;
    let ax = (keys.d || keys.ArrowRight ? 1 : 0) - (keys.a || keys.ArrowLeft ? 1 : 0);
    let ay = (keys.s || keys.ArrowDown ? 1 : 0) - (keys.w || keys.ArrowUp ? 1 : 0);
    if (ax || ay) {
      const l = Math.hypot(ax, ay);
      player.x += ax / l * 320 * dt;
      player.y += ay / l * 320 * dt;
    } else if (pointer) {
      player.x += (pointer.x - player.x) * Math.min(1, dt * 9);
      player.y += (pointer.y - player.y) * Math.min(1, dt * 9);
    }
    player.x = Math.max(20, Math.min(W - 20, player.x));
    player.y = Math.max(40, Math.min(H - 30, player.y));
    if (player.cool <= 0) { fire(); player.cool = spread > 0 ? 0.1 : 0.16; }

    if (!boss && toSpawn <= 0 && foes.length === 0) {
      gap -= dt;
      if (gap <= 0) { wave += 1; hud(); gap = 1.3; openWave(); }
    } else gap = 1.1;
    if (toSpawn > 0) {
      spawnIn -= dt;
      if (spawnIn <= 0) { spawnOne(); toSpawn--; spawnIn = Math.max(0.28, 0.7 - wave * 0.03); }
    }

    for (const b of bullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
    bullets = bullets.filter(b => b.y > -20 && b.x > -20 && b.x < W + 20);

    for (const f of foes) {
      f.t += dt;
      if (f.kind === 'dart') {
        f.y += (150 + wave * 8) * dt;
        f.x += Math.sin(f.t * 2) * 20 * dt;
        f.cool -= dt;
        if (f.cool <= 0 && f.y > 40) {
          const dx = player.x - f.x, dy = player.y - f.y;
          const d = Math.hypot(dx, dy) || 1;
          shots.push({ x: f.x, y: f.y, vx: dx / d * 180, vy: dy / d * 180, r: 4 });
          f.cool = 1.6;
        }
      } else {
        f.y += (70 + wave * 6) * dt;
        f.x += Math.sin(f.t * 2.2) * 90 * dt;
      }
      if (Math.hypot(f.x - player.x, f.y - player.y) < f.r + player.r) { f.hp = 0; hitPlayer(); }
    }
    if (boss) {
      boss.t += dt;
      boss.x = W / 2 + Math.sin(boss.t * 0.8) * 150;
      boss.cool -= dt;
      if (boss.cool <= 0) {
        for (const a of [-0.4, 0, 0.4]) shots.push({ x: boss.x, y: boss.y + 20, vx: Math.sin(a) * 160, vy: 200, r: 5 });
        boss.cool = 0.7;
      }
      if (Math.hypot(boss.x - player.x, boss.y - player.y) < boss.r + player.r) hitPlayer();
    }

    for (const b of bullets) {
      for (const f of foes) {
        if (f.hp <= 0) continue;
        if (Math.hypot(b.x - f.x, b.y - f.y) < f.r + b.r) { f.hp--; b.y = -99; }
      }
      if (boss && Math.hypot(b.x - boss.x, b.y - boss.y) < boss.r) { boss.hp--; b.y = -99; }
    }
    const dead = foes.filter(f => f.hp <= 0);
    foes = foes.filter(f => f.hp > 0 && f.y < H + 40);
    dead.forEach(kill);
    if (boss && boss.hp <= 0) { kill(Object.assign(boss, { boss: true })); boss = null; }

    for (const s of shots) {
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (Math.hypot(s.x - player.x, s.y - player.y) < s.r + player.r - 4) { s.y = H + 99; hitPlayer(); }
    }
    shots = shots.filter(s => s.y < H + 30 && s.y > -20 && s.x > -20 && s.x < W + 20);

    for (const d of drops) {
      d.y += d.vy * dt;
      if (Math.hypot(d.x - player.x, d.y - player.y) < 22) {
        if (d.kind === 'spread') spread = 8;
        else lives = Math.min(5, lives + 1);
        d.y = H + 99;
        hud();
      }
    }
    drops = drops.filter(d => d.y < H + 20);
    for (const p of parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    parts = parts.filter(p => p.life > 0);
    for (const s of stars) { s.y += (30 + s.z * 80) * dt; if (s.y > H) s.y = 0; }
  }

  function draw() {
    ctx.fillStyle = '#070b16';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    for (const s of stars) { ctx.globalAlpha = s.z; ctx.fillRect(s.x, s.y, 2, 2); }
    ctx.globalAlpha = 1;
    for (const d of drops) {
      ctx.fillStyle = d.kind === 'spread' ? '#5cc8ff' : '#ffd56a';
      ctx.beginPath(); ctx.arc(d.x, d.y, 8, 0, 7); ctx.fill();
    }
    for (const b of bullets) {
      ctx.fillStyle = '#d7f4ff';
      ctx.fillRect(b.x - 2, b.y - 8, 4, 14);
    }
    for (const s of shots) {
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
    }
    for (const f of foes) {
      ctx.fillStyle = f.kind === 'dart' ? '#ff8b6a' : '#c9d4e4';
      ctx.beginPath();
      ctx.moveTo(f.x, f.y + f.r);
      ctx.lineTo(f.x - f.r, f.y - f.r);
      ctx.lineTo(f.x + f.r, f.y - f.r);
      ctx.fill();
    }
    if (boss) {
      ctx.fillStyle = '#8ea0b8';
      ctx.fillRect(boss.x - 46, boss.y - 18, 92, 36);
      ctx.fillStyle = '#ff5d5d';
      ctx.fillRect(boss.x - 40, boss.y + 22, 80 * (boss.hp / boss.max), 5);
    }
    if (player && (player.inv <= 0 || Math.sin(player.inv * 30) > 0)) {
      ctx.fillStyle = '#7ee0ff';
      ctx.beginPath();
      ctx.moveTo(player.x, player.y - 18);
      ctx.lineTo(player.x - 16, player.y + 14);
      ctx.lineTo(player.x + 16, player.y + 14);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(player.x - 3, player.y - 4, 6, 10);
    }
    for (const p of parts) {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  function local(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  canvas.addEventListener('pointerdown', (e) => { pointer = local(e); });
  canvas.addEventListener('pointermove', (e) => { if (phase === 'play') pointer = local(e); });
  window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    if (e.key === 'Enter' && (!menu.hidden || !over.hidden)) scramble();
  });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });
  document.getElementById('play').onclick = scramble;
  document.getElementById('again').onclick = scramble;

  let last = 0;
  function frame(t) {
    const dt = Math.min(0.033, (t - last) / 1000 || 0);
    last = t;
    if (phase === 'play') update(dt);
    if (player) draw();
    else { ctx.fillStyle = '#070b16'; ctx.fillRect(0, 0, W, H); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
