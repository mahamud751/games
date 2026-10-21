(() => {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const W = 960, H = 540, GY = 478;
  const SLING = { x: 158, y: 332 };
  const MAX = 120;
  const menu = document.getElementById('menu');
  const result = document.getElementById('result');
  const KEY = 'sling-riot-stars';
  let stars = {};
  try { stars = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { stars = {}; }

  function body(x, y, w, h, kind) {
    const hp = kind === 'stone' ? 2.7 : kind === 'glass' ? 0.45 : 1.15;
    return { x, y, w, h, hp, kind, vx: 0, vy: 0, dead: false };
  }
  function ground(x, w, h, kind) { return body(x, GY - h / 2, w, h, kind); }
  function atop(support, x, w, h, kind) {
    return body(x, support.y - support.h / 2 - h / 2, w, h, kind);
  }
  function lampOn(support, x) {
    const top = support.y - support.h / 2;
    return { x, y: top - 17, r: 17, hp: 0.55, kind: 'lamp', vx: 0, vy: 0, dead: false };
  }

  function makeLevels() {
    const porchL = ground(640, 26, 118, 'wood');
    const porchR = ground(800, 26, 118, 'wood');
    const porchBeam = atop(porchL, 720, 196, 18, 'wood');

    const base = ground(700, 168, 48, 'stone');
    const kL = atop(base, 646, 24, 102, 'wood');
    const kR = atop(base, 754, 24, 102, 'wood');
    const pane = atop(base, 700, 16, 78, 'glass');
    const kBeam = atop(kL, 700, 146, 18, 'wood');
    const post = ground(880, 24, 84, 'wood');

    const t1 = ground(560, 24, 90, 'wood');
    const t1b = atop(t1, 560, 70, 16, 'wood');
    const t2 = ground(760, 28, 150, 'stone');
    const t2a = atop(t2, 760, 24, 90, 'wood');
    const t2b = atop(t2a, 760, 80, 16, 'wood');

    const sL = ground(620, 34, 150, 'stone');
    const sR = ground(820, 34, 150, 'stone');
    const arch = atop(sL, 720, 240, 22, 'stone');
    const shelf = ground(720, 70, 16, 'glass');

    const p1 = ground(700, 70, 28, 'wood');
    const p2 = atop(p1, 700, 52, 28, 'wood');
    const p3 = atop(p2, 700, 34, 28, 'wood');

    const a = ground(600, 24, 130, 'wood');
    const b = ground(760, 24, 170, 'stone');
    const c = atop(b, 760, 90, 16, 'glass');
    const d = ground(900, 22, 70, 'wood');
    const e = atop(a, 640, 100, 16, 'wood');

    return [
      { name: 'Porch', pebbles: 3, blocks: [porchL, porchR, porchBeam], lanterns: [lampOn(porchBeam, 720)] },
      { name: 'Kiln', pebbles: 4, blocks: [base, kL, kR, pane, kBeam, post], lanterns: [lampOn(kBeam, 700), lampOn(post, 880)] },
      { name: 'Twins', pebbles: 4, blocks: [t1, t1b, t2, t2a, t2b], lanterns: [lampOn(t1b, 560), lampOn(t2b, 760)] },
      { name: 'Arch', pebbles: 4, blocks: [sL, sR, arch, shelf], lanterns: [lampOn(shelf, 720), lampOn(arch, 640)] },
      { name: 'Stack', pebbles: 3, blocks: [p1, p2, p3], lanterns: [lampOn(p3, 700)] },
      { name: 'Yard', pebbles: 5, blocks: [a, b, c, d, e], lanterns: [lampOn(e, 640), lampOn(c, 760), lampOn(d, 900)] }
    ];
  }

  const LEVELS = makeLevels();
  let level = 0;
  let blocks = [], lanterns = [], pebbles = 3, score = 0, total = 0;
  let bird = null, pull = null, phase = 'menu', particles = [], shake = 0;

  function halfH(b) { return b.h ? b.h / 2 : b.r; }
  function halfW(b) { return b.w ? b.w / 2 : b.r; }
  function solids() { return blocks.concat(lanterns).filter(b => !b.dead); }

  function supported(b, list) {
    const bottom = b.y + halfH(b);
    if (bottom >= GY - 2.5) return true;
    for (const o of list) {
      if (o === b || o.dead) continue;
      if (o.falling && o.vy > 40) continue;
      const top = o.y - halfH(o);
      if (bottom < top - 1 || bottom > top + 6) continue;
      if (halfW(b) + halfW(o) - Math.abs(b.x - o.x) > 8) return true;
    }
    return false;
  }

  function load(i) {
    level = i;
    const src = LEVELS[i];
    blocks = src.blocks.map(b => Object.assign({}, b, { vx: 0, vy: 0, dead: false }));
    lanterns = src.lanterns.map(b => Object.assign({}, b, { vx: 0, vy: 0, dead: false }));
    pebbles = src.pebbles;
    score = 0;
    particles = [];
    phase = 'aim';
    menu.hidden = true;
    result.hidden = true;
    document.getElementById('levelName').textContent = src.name;
    spawn();
    paintHud();
  }

  function spawn() {
    bird = { x: SLING.x, y: SLING.y, r: 15, vx: 0, vy: 0, flying: false, rest: 0 };
    pull = null;
    phase = 'aim';
  }

  function paintHud() {
    document.getElementById('score').textContent = total + score;
    document.getElementById('pebbles').textContent = '●'.repeat(Math.max(0, pebbles));
  }

  function launchVel(from) {
    const p = from || pull;
    if (!p) return { x: 0, y: 0 };
    let x = SLING.x - p.x;
    let y = SLING.y - p.y;
    const len = Math.hypot(x, y) || 1;
    const pullLen = Math.min(MAX, len);
    x = x / len * pullLen;
    y = y / len * pullLen;
    return { x: x * 8.4, y: y * 8.4 };
  }

  function circleRect(c, b) {
    if (b.r && !b.w) {
      const dx = c.x - b.x, dy = c.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      const pen = c.r + b.r - d;
      if (pen <= 0) return null;
      return { nx: dx / d, ny: dy / d, pen };
    }
    const dx = c.x - b.x, dy = c.y - b.y;
    const px = halfW(b) + c.r - Math.abs(dx);
    const py = halfH(b) + c.r - Math.abs(dy);
    if (px <= 0 || py <= 0) return null;
    if (px < py) return { nx: dx < 0 ? -1 : 1, ny: 0, pen: px };
    return { nx: 0, ny: dy < 0 ? -1 : 1, pen: py };
  }

  function pop(b, bonus) {
    if (b.dead) return;
    b.dead = true;
    score += bonus;
    shake = Math.max(shake, 7);
    for (let i = 0; i < 10; i++) {
      particles.push({
        x: b.x, y: b.y,
        vx: (Math.random() - .5) * 280,
        vy: -Math.random() * 220,
        life: 0.5 + Math.random() * 0.3,
        color: b.kind === 'lamp' ? '#ffd56a' : b.kind === 'glass' ? '#b7ecff' : '#e7b07a'
      });
    }
    paintHud();
  }

  function hurt(b, impact, birdVx) {
    const div = b.kind === 'stone' ? 360 : b.kind === 'glass' ? 160 : b.kind === 'lamp' ? 200 : 250;
    if (impact < 150) return;
    b.hp -= impact / div;
    b.vx += birdVx * 0.12;
    b.falling = true;
    if (b.hp <= 0) pop(b, b.kind === 'lamp' ? 500 : b.kind === 'glass' ? 80 : 40);
  }

  function separate(a) {
    for (const o of solids()) {
      if (o === a) continue;
      const dx = a.x - o.x, dy = a.y - o.y;
      const px = halfW(a) + halfW(o) - Math.abs(dx);
      const py = halfH(a) + halfH(o) - Math.abs(dy);
      if (px <= 0 || py <= 0) continue;
      if (py < px) {
        a.y += dy < 0 ? -py : py;
        if (dy < 0 && a.vy > 0) a.vy = 0;
      } else {
        a.x += dx < 0 ? -px : px;
        a.vx *= 0.45;
      }
    }
    const bottom = a.y + halfH(a);
    if (bottom > GY) {
      a.y -= bottom - GY;
      if (Math.abs(a.vy) > 240) a.hp -= Math.abs(a.vy) / 900;
      a.vy = 0;
      a.vx *= 0.7;
      if (a.hp <= 0) pop(a, a.kind === 'lamp' ? 500 : 40);
    }
  }

  function step(dt) {
    const list = solids().sort((a, b) => b.y - a.y);
    for (const b of list) {
      b.x += b.vx * dt;
      b.vx *= Math.max(0, 1 - 1.8 * dt);
      if (!supported(b, list)) {
        b.vy += 1700 * dt;
        b.y += b.vy * dt;
      } else b.vy = 0;
      separate(b);
      separate(b);
    }
    if (bird && bird.flying) {
      bird.vy += 1500 * dt;
      bird.vx *= Math.max(0, 1 - 0.18 * dt);
      bird.x += bird.vx * dt;
      bird.y += bird.vy * dt;
      if (bird.y + bird.r > GY) {
        bird.y = GY - bird.r;
        bird.vy *= -0.32;
        bird.vx *= 0.84;
        if (Math.abs(bird.vy) < 60) bird.vy = 0;
      }
      for (const b of solids()) {
        const hit = circleRect(bird, b);
        if (!hit) continue;
        const impact = Math.hypot(bird.vx, bird.vy);
        bird.x += hit.nx * hit.pen;
        bird.y += hit.ny * hit.pen;
        const vn = bird.vx * hit.nx + bird.vy * hit.ny;
        if (vn < 0) {
          const e = b.kind === 'stone' ? 0.35 : 0.2;
          bird.vx -= (1 + e) * vn * hit.nx;
          bird.vy -= (1 + e) * vn * hit.ny;
        }
        hurt(b, impact, bird.vx);
        shake = Math.max(shake, Math.min(8, impact / 180));
      }
      const speed = Math.hypot(bird.vx, bird.vy);
      const gone = bird.x < -60 || bird.x > W + 80 || bird.y > H + 40;
      if (gone) endShot();
      else if (speed < 70) {
        bird.rest += dt;
        if (bird.rest > 0.45) endShot();
      } else bird.rest = 0;
    }
    for (const p of particles) {
      p.life -= dt;
      p.vy += 900 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    particles = particles.filter(p => p.life > 0);
    if (shake > 0) shake = Math.max(0, shake - dt * 14);
    if ((phase === 'aim' || phase === 'fly') && lanterns.length && lanterns.every(l => l.dead) && bird && !bird.flying) win();
  }

  function endShot() {
    if (phase !== 'fly') return;
    if (lanterns.every(l => l.dead)) { win(); return; }
    pebbles -= 1;
    if (pebbles <= 0) return lose();
    spawn();
    paintHud();
  }

  function win() {
    if (phase === 'won' || phase === 'lost') return;
    phase = 'won';
    const left = Math.max(0, pebbles - (bird && bird.flying ? 1 : 0));
    const earned = Math.min(3, left + 1);
    const prev = stars[level] || 0;
    if (earned > prev) {
      stars[level] = earned;
      localStorage.setItem(KEY, JSON.stringify(stars));
    }
    total += score + left * 250;
    showResult('Cleared', LEVELS[level].name, '★'.repeat(earned) + '☆'.repeat(3 - earned));
    document.getElementById('next').hidden = level >= LEVELS.length - 1;
  }

  function lose() {
    phase = 'lost';
    showResult('Still standing', 'The lanterns held', 'Out of pebbles');
    document.getElementById('next').hidden = true;
  }

  function showResult(kicker, title, sub) {
    result.hidden = false;
    document.getElementById('resultKicker').textContent = kicker;
    document.getElementById('resultTitle').textContent = title;
    document.getElementById('stars').textContent = sub;
    paintHud();
    buildMenu();
  }

  function draw() {
    const ox = (Math.random() - .5) * shake;
    const oy = (Math.random() - .5) * shake;
    ctx.setTransform(1, 0, 0, 1, ox, oy);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#f6b16a');
    sky.addColorStop(.45, '#f08a78');
    sky.addColorStop(1, '#6e8cae');
    ctx.fillStyle = sky;
    ctx.fillRect(-10, -10, W + 20, H + 20);
    ctx.fillStyle = 'rgba(255,244,214,.9)';
    ctx.beginPath(); ctx.arc(760, 92, 42, 0, 7); ctx.fill();
    ctx.fillStyle = '#3d6a4a';
    ctx.beginPath();
    ctx.moveTo(0, 390); ctx.quadraticCurveTo(220, 330, 460, 390); ctx.quadraticCurveTo(700, 450, 980, 360); ctx.lineTo(980, 430); ctx.lineTo(0, 430); ctx.fill();
    ctx.fillStyle = '#2f6a3e';
    ctx.fillRect(0, 400, W, 40);
    ctx.fillStyle = '#6d4a2e';
    ctx.fillRect(0, GY, W, H - GY);
    ctx.fillStyle = '#87b85a';
    ctx.fillRect(0, GY - 8, W, 10);

    ctx.strokeStyle = '#6b3d22';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(SLING.x + 26, SLING.y + 70);
    ctx.lineTo(SLING.x + 8, SLING.y);
    ctx.lineTo(SLING.x - 18, SLING.y - 34);
    ctx.moveTo(SLING.x + 8, SLING.y);
    ctx.lineTo(SLING.x + 34, SLING.y - 28);
    ctx.stroke();

    const hold = phase === 'aim' && bird && !bird.flying ? (pull || { x: bird.x, y: bird.y }) : null;
    if (hold) {
      ctx.strokeStyle = '#2a1a12';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(SLING.x - 18, SLING.y - 34);
      ctx.lineTo(hold.x, hold.y);
      ctx.lineTo(SLING.x + 34, SLING.y - 28);
      ctx.stroke();
      if (pull) {
      const v = launchVel(hold);
      let x = hold.x, y = hold.y, vx = v.x, vy = v.y;
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      for (let i = 0; i < 9; i++) {
        vy += 1500 * 0.06;
        x += vx * 0.06; y += vy * 0.06;
        ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7); ctx.fill();
        if (y > GY) break;
        }
      }
    }

    for (const b of blocks) if (!b.dead) drawBlock(b);
    for (const l of lanterns) if (!l.dead) drawLamp(l);
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (bird && (phase === 'aim' || phase === 'fly' || phase === 'won' || phase === 'lost')) drawPebble(bird);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawBlock(b) {
    const x = b.x - b.w / 2, y = b.y - b.h / 2;
    if (b.kind === 'glass') {
      ctx.fillStyle = 'rgba(190, 236, 255, .45)';
      ctx.strokeStyle = 'rgba(230,250,255,.9)';
      ctx.lineWidth = 2;
      ctx.fillRect(x, y, b.w, b.h);
      ctx.strokeRect(x, y, b.w, b.h);
      return;
    }
    ctx.fillStyle = b.kind === 'stone' ? '#8a877f' : '#d08945';
    roundRect(x, y, b.w, b.h, 3);
    ctx.fill();
    ctx.strokeStyle = b.kind === 'stone' ? 'rgba(255,255,255,.18)' : 'rgba(90,40,10,.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (b.kind === 'wood') {
      ctx.moveTo(x + 4, y + b.h * .35); ctx.lineTo(x + b.w - 4, y + b.h * .35);
      ctx.moveTo(x + 4, y + b.h * .7); ctx.lineTo(x + b.w - 4, y + b.h * .7);
    }
    ctx.stroke();
  }

  function drawLamp(l) {
    ctx.fillStyle = 'rgba(255, 200, 80, .35)';
    ctx.beginPath(); ctx.arc(l.x, l.y, l.r + 10, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffcf70';
    ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath(); ctx.arc(l.x - 4, l.y - 4, 5, 0, 7); ctx.fill();
    ctx.strokeStyle = '#6b3d12';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(l.x, l.y - l.r); ctx.lineTo(l.x, l.y - l.r - 8); ctx.stroke();
  }

  function drawPebble(b) {
    ctx.fillStyle = '#f4efe4';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
    ctx.strokeStyle = '#e07a3d';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 2, 0.4, 2.4); ctx.stroke();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function pointer(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (phase !== 'aim') return;
    const p = pointer(e);
    if (Math.hypot(p.x - bird.x, p.y - bird.y) > 50 && p.x > 280) return;
    pull = clampPull(p);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pull || phase !== 'aim') return;
    pull = clampPull(pointer(e));
    bird.x = pull.x; bird.y = pull.y;
  });
  canvas.addEventListener('pointerup', () => {
    if (!pull || phase !== 'aim') return;
    const v = launchVel(pull);
    pull = null;
    if (v.x < 80) { bird.x = SLING.x; bird.y = SLING.y; return; }
    bird.vx = v.x; bird.vy = v.y; bird.flying = true; phase = 'fly';
  });

  function clampPull(p) {
    let x = p.x - SLING.x, y = p.y - SLING.y;
    const len = Math.hypot(x, y) || 1;
    const n = Math.min(MAX, len);
    return { x: SLING.x + x / len * n, y: SLING.y + y / len * n };
  }

  function buildMenu() {
    const box = document.getElementById('levels');
    box.innerHTML = '';
    LEVELS.forEach((L, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      const s = stars[i] || 0;
      b.innerHTML = L.name + '<small>' + (s ? '★'.repeat(s) : 'Play') + '</small>';
      b.onclick = () => load(i);
      box.appendChild(b);
    });
  }

  document.getElementById('retry').onclick = () => load(level);
  document.getElementById('next').onclick = () => load(Math.min(LEVELS.length - 1, level + 1));

  let last = 0;
  function frame(t) {
    const dt = Math.min(0.033, (t - last) / 1000 || 0);
    last = t;
    if (phase === 'aim' || phase === 'fly') step(dt);
    else if (particles.length) step(0);
    draw();
    requestAnimationFrame(frame);
  }
  buildMenu();
  draw();
  requestAnimationFrame(frame);
  window.__sling = {
    load,
    get phase() { return phase; },
    get bird() { return bird; },
    get blocks() { return blocks; },
    get lanterns() { return lanterns; }
  };
})();
