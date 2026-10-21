(() => {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const W = 1000, H = 560;
  const GOAL_T = 190, GOAL_B = 370;
  const menu = document.getElementById('menu');
  const end = document.getElementById('end');
  const banner = document.getElementById('banner');
  const keys = {};
  let mode = '1p';
  let players = [], ball, score, time, phase, wait, pointer, match;

  function resetPositions() {
    const spots = [
      [230, 170], [230, 390], [320, 280],
      [770, 170], [770, 390], [680, 280]
    ];
    players.forEach((p, i) => {
      p.x = spots[i][0]; p.y = spots[i][1]; p.vx = 0; p.vy = 0; p.cool = 0; p.kick = 0;
    });
    ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 11 };
  }

  function start(next) {
    mode = next;
    match++;
    score = [0, 0];
    time = 70;
    phase = 'play';
    wait = 0;
    players = [0, 0, 0, 1, 1, 1].map((team, i) => ({
      team, role: i === 2 ? 'you' : (i === 5 && mode === '2p' ? 'p2' : 'ai'),
      r: 18, x: 0, y: 0, vx: 0, vy: 0, cool: 0, kick: 0
    }));
    resetPositions();
    menu.hidden = true;
    end.hidden = true;
    banner.hidden = true;
    document.getElementById('p2help').hidden = mode !== '2p';
    paintScore();
  }

  let pointerId = null;
  function paintScore() {
    document.getElementById('s0').textContent = score[0];
    document.getElementById('s1').textContent = score[1];
    const t = Math.max(0, Math.ceil(time));
    document.getElementById('clock').textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  }

  function steer(p, tx, ty, dt, speed) {
    let dx = tx - p.x, dy = ty - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 8) { p.vx *= 0.8; p.vy *= 0.8; return; }
    p.vx += dx / d * 1600 * dt;
    p.vy += dy / d * 1600 * dt;
    const v = Math.hypot(p.vx, p.vy);
    if (v > speed) { p.vx = p.vx / v * speed; p.vy = p.vy / v * speed; }
  }

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function control(p, dt) {
    if (p.role === 'you') {
      const left = keys.a || keys.ArrowLeft && mode === '1p';
      let x = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
      let y = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
      if (mode === '1p' && (keys.ArrowLeft || keys.ArrowRight || keys.ArrowUp || keys.ArrowDown)) {
        x = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
        y = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
      }
      if (x || y) {
        const l = Math.hypot(x, y);
        steer(p, p.x + x / l * 80, p.y + y / l * 80, dt, 270);
        return;
      }
      if (mode === '1p' && pointer) steer(p, pointer.x, pointer.y, dt, 270);
      else { p.vx *= 0.86; p.vy *= 0.86; }
      return;
    }
    if (p.role === 'p2') {
      const x = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
      const y = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
      if (x || y) {
        const l = Math.hypot(x, y);
        steer(p, p.x + x / l * 80, p.y + y / l * 80, dt, 270);
      } else { p.vx *= 0.86; p.vy *= 0.86; }
      return;
    }
    const mates = players.filter(o => o.team === p.team);
    const hunter = mates.slice().sort((a, b) => dist(a, ball) - dist(b, ball))[0];
    if (p === hunter) {
      const behind = p.team === 0 ? -26 : 26;
      steer(p, ball.x + behind, ball.y, dt, 250);
      if (dist(p, ball) < 36) p.kick = 0.12;
    } else {
      const i = mates.indexOf(p);
      const base = p.team === 0 ? 200 : W - 200;
      const tx = base + (ball.x - W / 2) * 0.35;
      const ty = H * (0.28 + i * 0.22);
      steer(p, tx, ty * 0.55 + ball.y * 0.45, dt, 220);
    }
  }

  function touch(p) {
    const dx = ball.x - p.x, dy = ball.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const min = p.r + ball.r;
    if (d > min + 4) return;
    const nx = dx / d, ny = dy / d;
    ball.x = p.x + nx * (min + 0.5);
    ball.y = p.y + ny * (min + 0.5);
    if (p.cool > 0) return;
    p.cool = 0.16;
    let px = nx, py = ny, power = 320 + Math.hypot(p.vx, p.vy) * 0.45;
    if (p.kick > 0) {
      const gx = p.team === 0 ? W + 30 : -30;
      let kx = gx - ball.x, ky = H / 2 - ball.y;
      const kl = Math.hypot(kx, ky) || 1;
      px = nx * 0.3 + (kx / kl) * 0.7;
      py = ny * 0.3 + (ky / kl) * 0.7;
      const pl = Math.hypot(px, py) || 1;
      px /= pl; py /= pl;
      power = 640;
      p.kick = 0;
    }
    ball.vx = px * power + p.vx * 0.2;
    ball.vy = py * power + p.vy * 0.2;
  }

  function goal(team) {
    score[team] += 1;
    phase = 'goal';
    wait = 1.15;
    banner.hidden = false;
    banner.textContent = 'GOAL';
    paintScore();
    const id = match;
    if (score[team] >= 5) setTimeout(() => { if (id === match) finish(); }, 700);
  }

  function finish() {
    phase = 'end';
    banner.hidden = true;
    const title = score[0] === score[1] ? 'Drawn' : (score[0] > score[1] ? 'Coral wins' : 'Blue wins');
    document.getElementById('endTitle').textContent = title;
    end.hidden = false;
  }

  function update(dt) {
    if (phase === 'goal') {
      wait -= dt;
      ball.vx *= 0.98; ball.vy *= 0.98;
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      if (wait <= 0) {
        banner.hidden = true;
        if (score[0] >= 5 || score[1] >= 5) return;
        phase = 'play';
        resetPositions();
      }
      return;
    }
    if (phase !== 'play') return;
    time -= dt;
    paintScore();
    if (time <= 0) { finish(); return; }
    for (const p of players) {
      p.cool = Math.max(0, p.cool - dt);
      p.kick = Math.max(0, p.kick - dt);
      control(p, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.x = Math.max(48, Math.min(W - 48, p.x));
      p.y = Math.max(28, Math.min(H - 28, p.y));
    }
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const a = players[i], b = players[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const min = a.r + b.r;
        if (d < min) {
          const push = (min - d) / 2;
          a.x -= dx / d * push; b.x += dx / d * push;
          a.y -= dy / d * push; b.y += dy / d * push;
        }
      }
    }
    ball.vx *= Math.exp(-0.85 * dt);
    ball.vy *= Math.exp(-0.85 * dt);
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (ball.y < 16) { ball.y = 16; ball.vy *= -0.75; }
    if (ball.y > H - 16) { ball.y = H - 16; ball.vy *= -0.75; }
    const mouth = ball.y > GOAL_T && ball.y < GOAL_B;
    if (ball.x < 18) {
      if (mouth) goal(1);
      else { ball.x = 18; ball.vx *= -0.7; }
    } else if (ball.x > W - 18) {
      if (mouth) goal(0);
      else { ball.x = W - 18; ball.vx *= -0.7; }
    }
    if (phase === 'play') {
      const ordered = players.slice().sort((a, b) => (b.kick - a.kick) || (dist(a, ball) - dist(b, ball)));
      for (const p of ordered) touch(p);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 ? '#1f8a42' : '#187438';
      ctx.fillRect(i * (W / 10), 0, W / 10, H);
    }
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    ctx.lineWidth = 3;
    ctx.strokeRect(28, 18, W - 56, H - 36);
    ctx.beginPath();
    ctx.moveTo(W / 2, 18); ctx.lineTo(W / 2, H - 18);
    ctx.arc(W / 2, H / 2, 70, 0, 7);
    ctx.stroke();
    ctx.strokeRect(28, 150, 110, 260);
    ctx.strokeRect(W - 138, 150, 110, 260);
    ctx.fillStyle = 'rgba(255,255,255,.15)';
    ctx.fillRect(0, GOAL_T, 28, GOAL_B - GOAL_T);
    ctx.fillRect(W - 28, GOAL_T, 28, GOAL_B - GOAL_T);
    ctx.strokeStyle = '#f4fff6';
    ctx.strokeRect(6, GOAL_T, 22, GOAL_B - GOAL_T);
    ctx.strokeRect(W - 28, GOAL_T, 22, GOAL_B - GOAL_T);
    for (const p of players) {
      ctx.fillStyle = p.team === 0 ? '#ff6b57' : '#4cc3ff';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.beginPath(); ctx.arc(p.x - 4, p.y - 5, 5, 0, 7); ctx.fill();
      if (p.role === 'you' || p.role === 'p2') {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 4, 0, 7); ctx.stroke();
      }
    }
    ctx.fillStyle = '#f7f7f2';
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, 7); ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r - 2, 0.4, 2.2); ctx.stroke();
  }

  function local(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }

  canvas.addEventListener('pointerdown', (e) => { pointer = local(e); });
  canvas.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') pointer = local(e); });
  window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    if (e.key === ' ' && phase === 'play') { const you = players.find(p => p.role === 'you'); if (you) you.kick = 0.4; }
    if ((e.key === 'l' || e.key === 'L') && phase === 'play') { const p2 = players.find(p => p.role === 'p2'); if (p2) p2.kick = 0.4; }
  });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });
  document.getElementById('shoot').onclick = () => {
    const you = players.find(p => p.role === 'you');
    if (you && phase === 'play') you.kick = 0.4;
  };
  document.getElementById('one').onclick = () => start('1p');
  document.getElementById('two').onclick = () => start('2p');
  document.getElementById('again').onclick = () => start(mode);

  match = 0;
  let last = 0;
  function frame(t) {
    const dt = Math.min(0.033, (t - last) / 1000 || 0);
    last = t;
    if (menu.hidden) update(dt);
    if (players.length) draw();
    else {
      ctx.fillStyle = '#187438';
      ctx.fillRect(0, 0, W, H);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
