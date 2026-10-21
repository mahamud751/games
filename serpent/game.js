(() => {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const N = 20;
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const menu = document.getElementById('menu');
  const over = document.getElementById('over');
  const KEY = 'serpent-best';
  let best = Number(localStorage.getItem(KEY) || 0);
  bestEl.textContent = best;

  let wrap = false;
  let snake, dir, queue, food, score, alive, acc, step, paused, raf, tickCount;

  function cell() { return canvas.width / N; }

  function reset() {
    const mid = Math.floor(N / 2);
    snake = [{ x: mid, y: mid }, { x: mid - 1, y: mid }, { x: mid - 2, y: mid }, { x: mid - 3, y: mid }];
    dir = { x: 1, y: 0 };
    queue = [];
    score = 0;
    tickCount = 0;
    step = 0.15;
    acc = 0;
    alive = true;
    paused = false;
    scoreEl.textContent = '0';
    placeFood();
  }

  function placeFood() {
    const open = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (!snake.some(s => s.x === x && s.y === y)) open.push({ x, y });
      }
    }
    if (!open.length) { score += 50; return die(); }
    food = open[Math.floor(Math.random() * open.length)];
  }

  function setDir(x, y) {
    const cur = queue.length ? queue[queue.length - 1] : dir;
    if (cur.x + x === 0 && cur.y + y === 0) return;
    if (queue.length < 2) queue.push({ x, y });
  }

  function tick() {
    if (queue.length) dir = queue.shift();
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (wrap) {
      head.x = (head.x + N) % N;
      head.y = (head.y + N) % N;
    } else if (head.x < 0 || head.y < 0 || head.x >= N || head.y >= N) {
      return die();
    }
    if (snake.some(s => s.x === head.x && s.y === head.y)) return die();
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      tickCount++;
      if (tickCount % 5 === 0) score += 20;
      scoreEl.textContent = score;
      step = Math.max(0.06, 0.15 - tickCount * 0.006);
      placeFood();
    } else snake.pop();
  }

  function die() {
    alive = false;
    if (score > best) {
      best = score;
      localStorage.setItem(KEY, String(best));
      bestEl.textContent = best;
    }
    document.getElementById('final').textContent = score;
    over.hidden = false;
  }

  function draw() {
    const C = canvas.width / N;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0c1f18';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(180,255,210,.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i < N; i++) {
      ctx.beginPath();
      ctx.moveTo(i * C, 0); ctx.lineTo(i * C, canvas.width);
      ctx.moveTo(0, i * C); ctx.lineTo(canvas.width, i * C);
      ctx.stroke();
    }
    const f = food;
    ctx.fillStyle = '#ff5d73';
    round(f.x * C + C * .18, f.y * C + C * .18, C * .64, C * .2);
    ctx.fill();
    ctx.fillStyle = '#b6f7c9';
    ctx.beginPath();
    ctx.ellipse(f.x * C + C * .62, f.y * C + C * .22, C * .12, C * .08, -0.6, 0, Math.PI * 2);
    ctx.fill();
    snake.forEach((s, i) => {
      const t = i / Math.max(1, snake.length - 1);
      ctx.fillStyle = i === 0 ? '#effff6' : `hsl(${148 - t * 20} 78% ${62 - t * 18}%)`;
      const pad = i === 0 ? C * .08 : C * .14;
      round(s.x * C + pad, s.y * C + pad, C - pad * 2, C * .32);
      ctx.fill();
    });
    const head = snake[0];
    ctx.fillStyle = '#072116';
    const ex = head.x * C + C * .5 + dir.x * C * .16;
    const ey = head.y * C + C * .5 + dir.y * C * .16;
    ctx.beginPath(); ctx.arc(ex - dir.y * C * .16, ey - dir.x * C * .16, C * .06, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(ex + dir.y * C * .16, ey + dir.x * C * .16, C * .06, 0, 7); ctx.fill();
    if (paused && alive) {
      ctx.fillStyle = 'rgba(7,20,15,.55)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#effff6';
      ctx.font = '700 42px Syne, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Paused', canvas.width / 2, canvas.width / 2);
    }
  }

  function round(x, y, s, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + s, y, x + s, y + s, r);
    ctx.arcTo(x + s, y + s, x, y + s, r);
    ctx.arcTo(x, y + s, x, y, r);
    ctx.arcTo(x, y, x + s, y, r);
    ctx.closePath();
  }

  let last = 0;
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000 || 0);
    last = t;
    if (alive && !paused && menu.hidden && over.hidden) {
      acc += dt;
      while (acc >= step) { acc -= step; tick(); if (!alive) break; }
    }
    draw();
    raf = requestAnimationFrame(frame);
  }

  function begin() {
    menu.hidden = true;
    over.hidden = true;
    reset();
  }

  document.getElementById('play').onclick = begin;
  document.getElementById('again').onclick = begin;
  document.getElementById('walls').onclick = () => { wrap = false; document.getElementById('walls').classList.add('on'); document.getElementById('wrap').classList.remove('on'); };
  document.getElementById('wrap').onclick = () => { wrap = true; document.getElementById('wrap').classList.add('on'); document.getElementById('walls').classList.remove('on'); };

  const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
  window.addEventListener('keydown', (e) => {
    if (map[e.key]) { e.preventDefault(); if (menu.hidden) setDir(map[e.key][0], map[e.key][1]); }
    if (e.key === 'p' || e.key === 'P') paused = !paused;
    if (e.key === 'Enter' && (!menu.hidden || !over.hidden)) begin();
  });

  let sx = 0, sy = 0;
  canvas.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
  canvas.addEventListener('pointerup', (e) => {
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.hypot(dx, dy) < 16) return;
    if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
    else setDir(0, dy > 0 ? 1 : -1);
  });

  reset();
  draw();
  requestAnimationFrame(frame);
})();
