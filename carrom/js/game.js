'use strict';
(() => {
  const $ = s => document.querySelector(s);
  const canvas = $('#game');
  const ctx = canvas.getContext('2d');

  // ---------- constants (board is 1000x1000 world units) ----------
  const S = 1000, FR = 64;
  const CR = 21, SR = 27, PR = 33;
  const POCKETS = [[34, 34], [966, 34], [34, 966], [966, 966]];
  const BASE_X0 = 181, BASE_X1 = 819;
  const BASE_Y = [842, 158];                // player 0 shoots from the bottom, player 1 from the top
  const COLORS = ['white', 'black'];
  const DT = 1 / 240;
  const MU = 520, LIN_DAMP = 0.55;          // board friction (well powdered)
  const VMAX = 2400, MAX_DRAG = 200;
  const E_COIN = 0.9, E_STRIKER = 0.85, E_WALL = 0.72;
  const SINK_TIME = 0.3;
  const P_COLORS = ['#38bdf8', '#fb7185'];
  const TAU = Math.PI * 2;

  const THEMES = [
    { id: 'classic', name: 'Classic Maple', frame: ['#7a3c12', '#3a1a07'], surf: ['#f8e7c0', '#e6c98e'], grain: '140,90,30', line: '#1d140c', red: '#c1272d', glow: false },
    { id: 'rose', name: 'Royal Rosewood', frame: ['#5a1219', '#22060a'], surf: ['#f1cd9b', '#d6a467'], grain: '120,60,20', line: '#3a1205', red: '#9f1239', glow: false },
    { id: 'neon', name: 'Midnight Neon', frame: ['#232a4f', '#0a0c1a'], surf: ['#22305a', '#121a33'], grain: '140,170,255', line: '#7dd3fc', red: '#f472b6', glow: true },
  ];
  const DIFF = {
    easy: { samples: 28, noise: 0.05, top: 6 },
    normal: { samples: 70, noise: 0.016, top: 3 },
    hard: { samples: 170, noise: 0.003, top: 1 },
  };

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

  // ---------- audio ----------
  const Sfx = (() => {
    let ac = null, master = null, noiseBuf = null, muted = false;
    try { muted = localStorage.getItem('carrom.muted') === '1'; } catch (e) {}
    function ensure() {
      if (!ac) {
        try {
          ac = new (window.AudioContext || window.webkitAudioContext)();
          master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
        } catch (e) { return; }
      }
      if (ac.state === 'suspended') ac.resume();
    }
    function tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null, delay = 0) {
      if (!ac || muted) return;
      const t = ac.currentTime + delay;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
    }
    function noise(dur, freq, q = 1, vol = 0.3, delay = 0) {
      if (!ac || muted) return;
      if (!noiseBuf) {
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const t = ac.currentTime + delay;
      const s = ac.createBufferSource(); s.buffer = noiseBuf;
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      const g = ac.createGain();
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
    }
    return {
      ensure,
      get muted() { return muted; },
      toggle() { muted = !muted; try { localStorage.setItem('carrom.muted', muted ? '1' : '0'); } catch (e) {} return muted; },
      click() { tone(660, 0.05, 'triangle', 0.12); },
      tick() { tone(1400, 0.02, 'square', 0.03); },
      strike(p) { noise(0.05, 1800, 2, 0.25 + p * 0.35); tone(420, 0.06, 'triangle', 0.2, 200); },
      clack(s) {
        const v = Math.min(1, s / 1400);
        noise(0.025 + v * 0.03, 3200 + v * 1500, 4, 0.08 + v * 0.4);
        tone(2300 + v * 600, 0.035, 'sine', 0.04 + v * 0.12);
      },
      wall(s) { const v = Math.min(1, s / 1400); noise(0.06, 500, 1.2, 0.08 + v * 0.3); tone(140, 0.08, 'sine', 0.05 + v * 0.15, 90); },
      pocket() { tone(520, 0.18, 'sine', 0.22, 180); noise(0.12, 300, 0.8, 0.25, 0.08); tone(880, 0.12, 'triangle', 0.1, null, 0.12); },
      foul() { tone(180, 0.25, 'sawtooth', 0.12, 120); tone(150, 0.3, 'sawtooth', 0.1, 100, 0.12); },
      queen() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.22, 'triangle', 0.15, null, i * 0.08)); },
      again() { tone(660, 0.08, 'sine', 0.12); tone(990, 0.1, 'sine', 0.12, null, 0.07); },
      turn() { tone(520, 0.08, 'sine', 0.1); tone(780, 0.1, 'sine', 0.1, null, 0.07); },
      win() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, 'triangle', 0.2, null, i * 0.11)); },
      lose() { [392, 330, 262].forEach((f, i) => tone(f, 0.32, 'triangle', 0.16, null, i * 0.16)); },
    };
  })();

  // ---------- physics ----------
  function makeBody(type, x, y) {
    const striker = type === 'striker';
    // state: 0 on board, 1 sinking into a pocket, 2 pocketed, 3 striker waiting on the baseline
    return { type, x, y, vx: 0, vy: 0, r: striker ? SR : CR, m: striker ? 2.2 : 1, state: striker ? 3 : 0, t: 0, px: 0, py: 0 };
  }

  function step(bs, dt, fx) {
    for (const b of bs) {
      if (b.state >= 2) continue;
      if (b.state === 1) {
        b.t += dt;
        const k = Math.min(1, dt * 16);
        b.x += (b.px - b.x) * k; b.y += (b.py - b.y) * k;
        if (b.t > SINK_TIME) b.state = 2;
        continue;
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 0) {
        const ns = Math.max(0, sp - (MU + sp * LIN_DAMP) * dt);
        b.vx *= ns / sp; b.vy *= ns / sp;
      }
      for (const [px, py] of POCKETS) {
        const dx = b.x - px, dy = b.y - py;
        if (dx * dx + dy * dy < PR * PR) {
          b.state = 1; b.t = 0; b.px = px; b.py = py; b.vx = b.vy = 0;
          if (fx) fx.pocket(b);
          break;
        }
      }
      if (b.state) continue;
      if (b.x < b.r) { b.x = b.r; if (b.vx < 0) { if (fx) fx.wall(-b.vx); b.vx = -b.vx * E_WALL; } }
      else if (b.x > S - b.r) { b.x = S - b.r; if (b.vx > 0) { if (fx) fx.wall(b.vx); b.vx = -b.vx * E_WALL; } }
      if (b.y < b.r) { b.y = b.r; if (b.vy < 0) { if (fx) fx.wall(-b.vy); b.vy = -b.vy * E_WALL; } }
      else if (b.y > S - b.r) { b.y = S - b.r; if (b.vy > 0) { if (fx) fx.wall(b.vy); b.vy = -b.vy * E_WALL; } }
    }
    for (let i = 0; i < bs.length; i++) {
      const A = bs[i];
      if (A.state) continue;
      for (let k = i + 1; k < bs.length; k++) {
        const B = bs[k];
        if (B.state) continue;
        const dx = B.x - A.x, dy = B.y - A.y, R = A.r + B.r, dd = dx * dx + dy * dy;
        if (dd >= R * R || dd === 0) continue;
        const d = Math.sqrt(dd), nx = dx / d, ny = dy / d;
        const imA = 1 / A.m, imB = 1 / B.m, corr = (R - d) / (imA + imB);
        A.x -= nx * corr * imA; A.y -= ny * corr * imA;
        B.x += nx * corr * imB; B.y += ny * corr * imB;
        const vn = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
        if (vn >= 0) continue;
        const e = A.type === 'striker' || B.type === 'striker' ? E_STRIKER : E_COIN;
        const j = -(1 + e) * vn / (imA + imB);
        A.vx -= j * nx * imA; A.vy -= j * ny * imA;
        B.vx += j * nx * imB; B.vy += j * ny * imB;
        if (fx) fx.hit(A.x + nx * A.r, A.y + ny * A.r, -vn);
      }
    }
  }

  function settled(bs) {
    for (const b of bs) {
      if (b.state === 1) return false;
      if (b.state === 0 && b.vx * b.vx + b.vy * b.vy > 9) return false;
    }
    return true;
  }

  function setupCoins() {
    const bs = [makeBody('queen', S / 2, S / 2)];
    const g = CR * 2 + 0.6;
    const inner = [], outerA = [], outerB = [];
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3 + Math.PI / 2, a2 = a + Math.PI / 6;
      inner.push([Math.cos(a) * g, Math.sin(a) * g]);
      outerA.push([Math.cos(a) * g * 2, Math.sin(a) * g * 2]);
      outerB.push([Math.cos(a2) * g * Math.sqrt(3), Math.sin(a2) * g * Math.sqrt(3)]);
    }
    inner.forEach(([x, y], k) => bs.push(makeBody(COLORS[k % 2], S / 2 + x, S / 2 + y)));
    outerA.forEach(([x, y], k) => bs.push(makeBody(COLORS[k % 2], S / 2 + x, S / 2 + y)));
    outerB.forEach(([x, y], k) => bs.push(makeBody(COLORS[(k + 1) % 2], S / 2 + x, S / 2 + y)));
    return bs;
  }

  function placementOk(bs, x, y) {
    for (const b of bs) {
      if (b.state !== 0 || b.type === 'striker') continue;
      const dx = b.x - x, dy = b.y - y;
      if (dx * dx + dy * dy < (b.r + SR + 0.5) ** 2) return false;
    }
    return true;
  }

  function freeSpotNearCenter(bs, r) {
    for (let ring = 0; ring < 12; ring++) {
      const dist = ring * (r + 4), n = ring === 0 ? 1 : ring * 8;
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + ring;
        const x = S / 2 + Math.cos(a) * dist, y = S / 2 + Math.sin(a) * dist;
        if (bs.every(o => o.state !== 0 || Math.hypot(o.x - x, o.y - y) > o.r + r + 1)) return [x, y];
      }
    }
    return [S / 2, S / 2];
  }

  function returnToCenter(bs, b) {
    const [x, y] = freeSpotNearCenter(bs, b.r);
    b.state = 0; b.x = x; b.y = y; b.vx = b.vy = 0; b.t = 0;
  }

  // ---------- art ----------
  function rrect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function mulberry32(a) {
    return () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function drawBoard(g, th) {
    const rnd = mulberry32(5);
    // frame
    g.save();
    const fg = g.createLinearGradient(-FR, -FR, S + FR, S + FR);
    fg.addColorStop(0, th.frame[0]); fg.addColorStop(0.5, th.frame[1]); fg.addColorStop(1, th.frame[0]);
    g.fillStyle = fg; rrect(g, -FR, -FR, S + FR * 2, S + FR * 2, 28); g.fill();
    g.clip();
    for (let i = 0; i < 140; i++) {
      const horiz = rnd() < 0.5, p = rnd() * (S + FR * 2) - FR;
      g.strokeStyle = `rgba(${rnd() < 0.7 ? '0,0,0' : '255,220,180'},${0.05 + rnd() * 0.1})`;
      g.lineWidth = 0.6 + rnd() * 1.5;
      g.beginPath();
      for (let s = -FR; s <= S + FR; s += 20) {
        const w = Math.sin(s * 0.01 + i) * 3;
        horiz ? (s === -FR ? g.moveTo(s, p + w) : g.lineTo(s, p + w)) : (s === -FR ? g.moveTo(p + w, s) : g.lineTo(p + w, s));
      }
      g.stroke();
    }
    g.restore();
    // frame highlights + inner lip
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 3;
    rrect(g, -FR + 3, -FR + 3, S + FR * 2 - 6, S + FR * 2 - 6, 26); g.stroke();
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(-10, -10, S + 20, S + 20);
    g.strokeStyle = th.glow ? 'rgba(125,211,252,.55)' : 'rgba(255,230,190,.25)'; g.lineWidth = 2;
    g.strokeRect(-10, -10, S + 20, S + 20);

    // playing surface
    const sg = g.createRadialGradient(S / 2, S / 2, 60, S / 2, S / 2, S * 0.75);
    sg.addColorStop(0, th.surf[0]); sg.addColorStop(1, th.surf[1]);
    g.fillStyle = sg; g.fillRect(0, 0, S, S);
    g.save(); g.beginPath(); g.rect(0, 0, S, S); g.clip();
    for (let i = 0; i < 160; i++) {
      const y0 = rnd() * S, amp = 2 + rnd() * 6, fq = 0.002 + rnd() * 0.006, ph = rnd() * TAU;
      g.strokeStyle = `rgba(${th.grain},${0.03 + rnd() * 0.07})`; g.lineWidth = 0.6 + rnd() * 1.6;
      g.beginPath();
      for (let x = 0; x <= S; x += 12) {
        const y = y0 + Math.sin(x * fq + ph) * amp;
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
    g.restore();

    // markings
    g.save();
    g.strokeStyle = th.line; g.fillStyle = th.red; g.lineWidth = 2.6; g.lineCap = 'round';
    if (th.glow) { g.shadowColor = th.line; g.shadowBlur = 10; }
    for (let side = 0; side < 4; side++) {
      g.save();
      g.translate(S / 2, S / 2); g.rotate(side * Math.PI / 2); g.translate(-S / 2, -S / 2);
      // baseline
      g.beginPath();
      g.moveTo(BASE_X0, 821); g.lineTo(BASE_X1, 821);
      g.moveTo(BASE_X0, 863); g.lineTo(BASE_X1, 863);
      g.stroke();
      for (const x of [BASE_X0, BASE_X1]) {
        g.beginPath(); g.arc(x, 842, 21.5, 0, TAU); g.fillStyle = th.red; g.fill(); g.stroke();
        g.beginPath(); g.arc(x, 842, 9, 0, TAU); g.lineWidth = 1.5; g.stroke(); g.lineWidth = 2.6;
      }
      // corner arrow
      g.beginPath(); g.moveTo(108, 892); g.lineTo(300, 700); g.stroke();
      g.beginPath(); g.moveTo(96, 904); g.lineTo(122, 896); g.lineTo(104, 878); g.closePath(); g.fillStyle = th.line; g.fill();
      g.beginPath(); g.arc(322, 678, 30, Math.PI * 0.25 + 0.4, Math.PI * 0.25 + TAU - 0.4); g.stroke();
      g.restore();
    }
    // centre design
    g.beginPath(); g.arc(S / 2, S / 2, 118, 0, TAU); g.stroke();
    g.beginPath(); g.arc(S / 2, S / 2, 108, 0, TAU); g.lineWidth = 1.4; g.stroke(); g.lineWidth = 2.6;
    g.fillStyle = th.red;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      g.save(); g.translate(S / 2 + Math.cos(a) * 62, S / 2 + Math.sin(a) * 62); g.rotate(a);
      g.beginPath(); g.moveTo(-36, 0); g.quadraticCurveTo(0, -15, 36, 0); g.quadraticCurveTo(0, 15, -36, 0); g.fill();
      g.restore();
    }
    g.fillStyle = th.line;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + Math.PI / 8;
      g.beginPath(); g.arc(S / 2 + Math.cos(a) * 82, S / 2 + Math.sin(a) * 82, 4, 0, TAU); g.fill();
    }
    g.beginPath(); g.arc(S / 2, S / 2, 24, 0, TAU); g.stroke();
    g.restore();

    // pockets
    for (const [px, py] of POCKETS) {
      g.beginPath(); g.arc(px, py, PR + 4, 0, TAU);
      g.fillStyle = th.glow ? 'rgba(125,211,252,.35)' : 'rgba(0,0,0,.25)'; g.fill();
      const pg = g.createRadialGradient(px - 6, py - 6, 2, px, py, PR + 1);
      pg.addColorStop(0, '#000'); pg.addColorStop(0.7, '#0b0806'); pg.addColorStop(1, '#2a1d14');
      g.beginPath(); g.arc(px, py, PR + 1, 0, TAU); g.fillStyle = pg; g.fill();
      g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1;
      for (let i = -3; i <= 3; i++) {
        g.beginPath(); g.moveTo(px + i * 8, py - PR); g.lineTo(px + i * 8, py + PR); g.stroke();
        g.beginPath(); g.moveTo(px - PR, py + i * 8); g.lineTo(px + PR, py + i * 8); g.stroke();
      }
    }
    // inner edge shadow + gloss
    for (const [x0, y0, x1, y1] of [[0, 0, 0, 22], [0, S, 0, S - 22], [0, 0, 22, 0], [S, 0, S - 22, 0]]) {
      const eg = g.createLinearGradient(x0, y0, x1, y1);
      eg.addColorStop(0, 'rgba(0,0,0,.28)'); eg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = eg; g.fillRect(0, 0, S, S);
    }
    const gl = g.createLinearGradient(0, 0, S, S);
    gl.addColorStop(0, 'rgba(255,255,255,.16)'); gl.addColorStop(0.45, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(255,255,255,.04)');
    g.fillStyle = gl; g.fillRect(0, 0, S, S);
  }

  function genBoard(k, th) {
    const cv = document.createElement('canvas');
    cv.width = Math.ceil((S + FR * 2) * k); cv.height = cv.width;
    const g = cv.getContext('2d');
    g.scale(k, k); g.translate(FR, FR);
    drawBoard(g, th);
    return cv;
  }

  const COIN_ART = {
    white: { g: ['#fffaf0', '#ecd7ab', '#b9975f'], ring: 'rgba(120,80,30,.35)' },
    black: { g: ['#655a52', '#2a221d', '#0f0c0a'], ring: 'rgba(255,255,255,.13)' },
    queen: { g: ['#ff9aaa', '#d61f3c', '#7a0a1c'], ring: 'rgba(255,255,255,.28)' },
    striker: { g: ['#ffffff', '#ece7dc', '#a9a294'], ring: 'rgba(0,0,0,.12)' },
  };
  function makeSprite(type, r, k) {
    const pad = 2, size = Math.ceil((r + pad) * 2 * k);
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const g = cv.getContext('2d');
    g.scale(k, k); g.translate(r + pad, r + pad);
    const art = COIN_ART[type];
    const rg = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    rg.addColorStop(0, art.g[0]); rg.addColorStop(0.6, art.g[1]); rg.addColorStop(1, art.g[2]);
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fillStyle = rg; g.fill();
    g.strokeStyle = art.ring; g.lineWidth = 1.3;
    for (const f of [0.82, 0.58, 0.32]) { g.beginPath(); g.arc(0, 0, r * f, 0, TAU); g.stroke(); }
    if (type === 'striker') {
      g.strokeStyle = '#2563eb'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r * 0.74, 0, TAU); g.stroke();
      g.fillStyle = '#d61f3c';
      g.beginPath();
      for (let i = 0; i <= 16; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 8, rr = i % 2 ? r * 0.22 : r * 0.5;
        i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.fill();
    } else if (type === 'queen') {
      g.fillStyle = '#fde68a';
      g.beginPath();
      for (let i = 0; i <= 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.14 : r * 0.32;
        i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.fill();
    } else {
      g.beginPath(); g.arc(0, 0, r * 0.1, 0, TAU); g.fillStyle = art.ring; g.fill();
    }
    // rim + specular
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, r - 0.5, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, r * 0.86, Math.PI * 1.1, Math.PI * 1.5); g.stroke();
    return { cv, half: r + pad };
  }

  // ---------- view ----------
  let dpr = 1, cw = 0, ch = 0, scale = 1, ox = 0, oy = 0, boardCv = null, sprites = {};
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = innerWidth; ch = innerHeight;
    canvas.width = cw * dpr; canvas.height = ch * dpr;
    const hudH = cw < 720 ? 76 : 92, bottom = 74;
    const avail = Math.max(200, ch - hudH - bottom);
    const px = Math.min(cw - 16, avail);
    scale = px / (S + FR * 2);
    ox = (cw - px) / 2 + FR * scale;
    oy = hudH + (avail - px) / 2 + FR * scale;
    rebuildArt();
  }
  function rebuildArt() {
    const k = scale * dpr;
    boardCv = genBoard(k, THEMES[game.theme]);
    for (const t of ['white', 'black', 'queen', 'striker']) sprites[t] = makeSprite(t, t === 'striker' ? SR : CR, k);
  }
  const toWorld = (x, y) => [(x - ox) / scale, (y - oy) / scale];
  const toScreen = (x, y) => [ox + x * scale, oy + y * scale];

  // ---------- game state ----------
  const game = {
    mode: 'cpu', diff: 'normal', boardsToWin: 1, guide: true, theme: 0,
    boardWins: [0, 0], points: [0, 0], boardNo: 1, breaker: 0,
    current: 0, state: 'menu', prevState: null,
    bodies: [], striker: null, aim: null, drag: null, ai: null,
    queenOwner: null, queenPending: null, preOn: null, settleT: 0, moveT: 0, shake: 0, firstShot: true,
  };
  const particles = [], popups = [];
  let lastClack = 0, lastWall = 0;

  const isCpu = i => game.mode === 'cpu' && i === 1;
  const pname = i => game.mode === 'cpu' ? (i === 0 ? 'You' : 'CPU') : `Player ${i + 1}`;
  const coinsOf = (bs, col) => bs.filter(b => b.type === col);
  const pocketedCount = (bs, col) => coinsOf(bs, col).filter(b => b.state > 0).length;
  const queenBody = () => game.bodies.find(b => b.type === 'queen');

  const FX = {
    hit(x, y, s) {
      if (s < 40) return;
      const now = performance.now();
      if (now - lastClack > 25) { Sfx.clack(s); lastClack = now; }
      if (s > 500) {
        for (let i = 0; i < Math.min(10, s / 150); i++) {
          const a = rand(0, TAU), v = rand(40, 100 + s * 0.15);
          particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.2, 0.4), max: 0.4, size: rand(1.2, 2.6), color: '#fff7d6' });
        }
      }
      if (s > 1500) game.shake = Math.max(game.shake, 5);
    },
    wall(s) {
      if (s < 60) return;
      const now = performance.now();
      if (now - lastWall > 40) { Sfx.wall(s); lastWall = now; }
    },
    pocket(b) {
      Sfx.pocket();
      const col = b.type === 'white' ? '#fff3d6' : b.type === 'black' ? '#a8a29e' : b.type === 'queen' ? '#fb7185' : '#60a5fa';
      for (let i = 0; i < 18; i++) {
        const a = rand(0, TAU), v = rand(60, 220);
        particles.push({ x: b.px, y: b.py, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.3, 0.7), max: 0.7, size: rand(1.5, 3.5), color: col });
      }
      popups.push({ x: clamp(b.px, 110, S - 110), y: clamp(b.py, 90, S - 90), text: b.type === 'striker' ? 'FOUL!' : b.type === 'queen' ? 'QUEEN!' : '+1', color: b.type === 'striker' ? '#f87171' : col, t: 0 });
    },
  };

  // ---------- flow ----------
  function newBoardBodies() {
    game.bodies = setupCoins();
    game.striker = makeBody('striker', S / 2, BASE_Y[0]);
    game.bodies.push(game.striker);
    game.queenOwner = null; game.queenPending = null;
  }

  function startMatch() {
    game.boardWins = [0, 0]; game.points = [0, 0]; game.boardNo = 1; game.breaker = 0;
    hideAll(); $('#hud').classList.remove('hidden');
    startBoard();
  }

  function startBoard() {
    hideAll();
    newBoardBodies();
    particles.length = 0; popups.length = 0;
    game.current = game.breaker;
    toast(`Board ${game.boardNo}`, '#fde047');
    game.state = 'wait';
    refreshHud();
    setTimeout(beginTurn, 800);
  }

  function beginTurn() {
    if (!['wait', 'moving'].includes(game.state)) return;
    const st = game.striker;
    st.state = 3; st.vx = st.vy = 0;
    st.y = BASE_Y[game.current];
    st.x = findValidX(S / 2);
    game.aim = null; game.drag = null;
    refreshHud();
    Sfx.turn();
    if (isCpu(game.current)) {
      game.state = 'ai';
      setTurnText('CPU is studying the board…', P_COLORS[1]);
      $('#placer').classList.add('hidden');
      setTimeout(aiStart, 350);
    } else {
      game.state = 'place';
      setTurnText(game.mode === 'cpu' ? 'Your shot!' : `${pname(game.current)} — your shot!`, P_COLORS[game.current]);
      $('#placer').classList.remove('hidden');
      $('#placer').style.setProperty('--pc', P_COLORS[game.current]);
      syncSlider();
      if (game.firstShot) $('#hint').classList.remove('hidden');
    }
  }

  function findValidX(pref) {
    const y = game.striker.y;
    for (let d = 0; d <= BASE_X1 - BASE_X0; d += 4) {
      for (const x of [pref + d, pref - d]) if (x >= BASE_X0 && x <= BASE_X1 && placementOk(game.bodies, x, y)) return x;
    }
    return pref;
  }

  function shoot(ux, uy, power) {
    const st = game.striker;
    game.preOn = new Set(game.bodies.filter(b => b.state === 0 || b === st));
    st.state = 0;
    const v = power * VMAX;
    st.vx = ux * v; st.vy = uy * v;
    Sfx.strike(power);
    game.state = 'moving'; game.settleT = 0; game.moveT = 0;
    game.aim = null; game.drag = null;
    game.firstShot = false;
    $('#hint').classList.add('hidden'); $('#placer').classList.add('hidden');
    setTurnText('…', '#f1f4ff');
  }

  // Carrom rules, applied once everything stops moving
  function resolveShot() {
    const bs = game.bodies, cur = game.current, my = COLORS[cur];
    const potted = bs.filter(b => b.state > 0 && game.preOn.has(b));
    const strikerIn = potted.includes(game.striker);
    const own = potted.filter(b => b.type === my);
    const queenNow = potted.some(b => b.type === 'queen');
    const queen = queenBody();
    const ownBefore = pocketedCount(bs, my) - own.length;
    let again = false, msg = null, msgColor = '#fde047';

    if (strikerIn) {
      own.forEach(b => returnToCenter(bs, b));
      if (queenNow || game.queenPending === cur) returnToCenter(bs, queen);
      game.queenPending = null;
      const penalty = coinsOf(bs, my).find(b => b.state === 2);
      if (penalty) returnToCenter(bs, penalty);
      msg = 'Foul! Striker pocketed'; msgColor = '#f87171';
      Sfx.foul();
    } else {
      if (game.queenPending === cur) {
        if (own.length) { game.queenOwner = cur; msg = 'Queen covered! +3'; Sfx.queen(); }
        else { returnToCenter(bs, queen); msg = 'Queen not covered — back to centre'; msgColor = '#fb923c'; }
        game.queenPending = null;
      }
      if (queenNow) {
        if (ownBefore + own.length === 0) { returnToCenter(bs, queen); msg = 'Sink one of your coins before the Queen!'; msgColor = '#fb923c'; }
        else if (own.length) { game.queenOwner = cur; msg = 'Queen pocketed & covered! +3'; Sfx.queen(); }
        else { game.queenPending = cur; again = true; msg = 'Queen in! Now cover it'; msgColor = '#fb7185'; }
      }
      if (own.length) { again = true; if (!msg) { msg = own.length > 1 ? `Double! Shoot again` : 'Nice! Shoot again'; Sfx.again(); } }
    }

    // a colour can't be finished while the Queen is still uncovered
    for (const col of COLORS) {
      if (pocketedCount(bs, col) === 9 && game.queenOwner === null && game.queenPending === null) {
        const back = coinsOf(bs, col).find(b => b.state === 2 && potted.includes(b)) || coinsOf(bs, col).find(b => b.state === 2);
        returnToCenter(bs, back);
        msg = 'Cover the Queen before your last coin!'; msgColor = '#fb923c';
      }
    }

    if (msg) toast(msg, msgColor);
    refreshHud();

    for (let p = 0; p < 2; p++) {
      if (pocketedCount(bs, COLORS[p]) === 9 && game.queenOwner !== null) {
        endBoard(p);
        return;
      }
    }
    if (!again) game.current = 1 - game.current;
    setTimeout(beginTurn, msg ? 700 : 250);
  }

  function endBoard(winner) {
    game.state = 'boardEnd';
    const left = 9 - pocketedCount(game.bodies, COLORS[1 - winner]);
    const pts = left + (game.queenOwner === winner ? 3 : 0);
    game.points[winner] += pts;
    game.boardWins[winner]++;
    refreshHud();
    const matchOver = game.boardWins[winner] >= game.boardsToWin;
    setTimeout(() => {
      if (matchOver) return showMatchEnd(winner, pts);
      $('#boKicker').textContent = `Board ${game.boardNo}`;
      $('#boTitle').textContent = game.mode === 'cpu' ? (winner === 0 ? 'You cleared the board!' : 'CPU cleared the board') : `${pname(winner)} cleared the board!`;
      $('#boTitle').style.color = P_COLORS[winner];
      $('#boSub').textContent = `+${pts} points (${left} coin${left === 1 ? '' : 's'} left${game.queenOwner === winner ? ' + Queen' : ''})`;
      $('#boScore').innerHTML = scoreHTML();
      (game.mode === 'cpu' && winner === 1 ? Sfx.lose : Sfx.win)();
      game.breaker = 1 - game.breaker;
      $('#boardOv').classList.add('show');
    }, 900);
  }

  function scoreHTML() {
    return `<span class="s0">${game.boardWins[0]}</span><span class="dash">–</span><span class="s1">${game.boardWins[1]}</span>`;
  }

  function showMatchEnd(winner, pts) {
    const cpuLoss = game.mode === 'cpu' && winner === 1;
    $('#moTitle').textContent = game.mode === 'cpu' ? (winner === 0 ? 'Carrom champion!' : 'The CPU wins this time') : `${pname(winner)} wins!`;
    $('#moTitle').style.color = P_COLORS[winner];
    $('#moSub').textContent = cpuLoss ? 'Line up your shots and try again.' : `Final board worth ${pts} points · total ${game.points[winner]}`;
    $('#moScore').innerHTML = scoreHTML();
    if (game.mode === 'cpu') {
      const st = loadStats(), k = game.diff;
      st[k] = st[k] || { w: 0, l: 0 };
      winner === 0 ? st[k].w++ : st[k].l++;
      saveStats(st);
    }
    $('.trophy').style.display = cpuLoss ? 'none' : '';
    (cpuLoss ? Sfx.lose : Sfx.win)();
    game.state = 'matchEnd';
    $('#matchOv').classList.add('show');
  }

  function loadStats() { try { return JSON.parse(localStorage.getItem('carrom.stats')) || {}; } catch (e) { return {}; } }
  function saveStats(s) { try { localStorage.setItem('carrom.stats', JSON.stringify(s)); } catch (e) {} }

  function hideAll() { document.querySelectorAll('.overlay').forEach(o => o.classList.remove('show')); }

  function showMenu() {
    hideAll();
    game.state = 'menu'; game.ai = null; game.aim = null;
    $('#hud').classList.add('hidden'); $('#hint').classList.add('hidden'); $('#placer').classList.add('hidden');
    newBoardBodies();
    game.striker.y = BASE_Y[0];
    buildMenu();
    $('#menu').classList.add('show');
  }

  function pause() {
    if (['menu', 'matchEnd', 'paused', 'boardEnd'].includes(game.state)) return;
    game.prevState = game.state; game.state = 'paused';
    $('#pauseOv').classList.add('show');
  }
  function resume() {
    if (game.state !== 'paused') return;
    game.state = game.prevState;
    $('#pauseOv').classList.remove('show');
    if (game.state === 'ai' && !game.ai) aiStart();
  }

  // ---------- AI ----------
  function evalShot(shot, me) {
    const bs = game.bodies.map(b => ({ ...b }));
    const st = bs.find(b => b.type === 'striker');
    st.x = shot.x; st.y = BASE_Y[me]; st.state = 0;
    st.vx = Math.cos(shot.ang) * shot.power * VMAX; st.vy = Math.sin(shot.ang) * shot.power * VMAX;
    const before = bs.map(b => b.state);
    for (let i = 0; i < 2600; i++) {
      step(bs, DT, null);
      if (i % 24 === 23 && settled(bs)) break;
    }
    const my = COLORS[me], op = COLORS[1 - me];
    let score = 0, own = 0, queenIn = false;
    bs.forEach((b, i) => {
      if (before[i] !== 0 || b.state === 0 || b.type === 'striker') return;
      if (b.type === my) { own++; score += 100; }
      else if (b.type === op) score -= 45;
      else if (b.type === 'queen') queenIn = true;
    });
    const mine = pocketedCount(game.bodies, my);
    if (queenIn) score += mine + own > 0 ? 70 : -10;
    // finishing your colour before the Queen is covered just hands a coin back
    const covered = game.queenOwner !== null || ((queenIn || game.queenPending === me) && own > 0);
    if (mine + own >= 9 && !covered) score -= 250;
    if (st.state > 0) score -= 160 + own * 100;
    // leave own coins close to pockets for next time
    for (const b of bs) {
      if (b.state || b.type !== my) continue;
      let d = Infinity;
      for (const [px, py] of POCKETS) d = Math.min(d, Math.hypot(b.x - px, b.y - py));
      score -= d * 0.015;
    }
    return score;
  }

  function genShot(me) {
    const my = COLORS[me], y = BASE_Y[me];
    const canQueen = pocketedCount(game.bodies, my) > 0 || game.queenPending === me;
    let targets = game.bodies.filter(b => b.state === 0 && (b.type === my || (b.type === 'queen' && canQueen)));
    const queen = targets.find(b => b.type === 'queen');
    if (queen && game.queenOwner === null && pocketedCount(game.bodies, my) === 8) targets = [queen];
    if (!targets.length || Math.random() < 0.12) {
      const x = rand(BASE_X0, BASE_X1);
      return placementOk(game.bodies, x, y) ? { x, ang: me ? rand(0.2, Math.PI - 0.2) : -rand(0.2, Math.PI - 0.2), power: rand(0.5, 1) } : null;
    }
    for (let tries = 0; tries < 12; tries++) {
      const t = targets[Math.random() * targets.length | 0];
      const [px, py] = POCKETS[Math.random() * 4 | 0];
      let ux = px - t.x, uy = py - t.y;
      const dp = Math.hypot(ux, uy); ux /= dp; uy /= dp;
      const gx = t.x - ux * (CR + SR), gy = t.y - uy * (CR + SR);
      const x = Math.random() < 0.3 ? clamp(gx, BASE_X0, BASE_X1) : rand(BASE_X0, BASE_X1);
      if (!placementOk(game.bodies, x, y)) continue;
      let dx = gx - x, dy = gy - y;
      const dg = Math.hypot(dx, dy);
      if (dg < 1) continue;
      dx /= dg; dy /= dg;
      if (dx * ux + dy * uy < 0.3) continue;   // cut too thin
      const power = clamp(0.32 + (dg + dp) / 2600 + rand(-0.06, 0.25), 0.25, 1);
      return { x, ang: Math.atan2(dy, dx), power };
    }
    return null;
  }

  function aiStart() {
    if (game.state !== 'ai') return;
    const me = game.current, cfg = DIFF[game.diff], results = [];
    let n = 0;
    game.ai = { thinking: true };
    const work = () => {
      if (game.state !== 'ai') { game.ai = null; return; }
      const t0 = performance.now();
      while (n < cfg.samples && performance.now() - t0 < 10) {
        const shot = genShot(me);
        n++;
        if (shot) results.push({ shot, score: evalShot(shot, me) });
      }
      if (n < cfg.samples) { setTimeout(work, 0); return; }
      if (!results.length) results.push({ shot: { x: findValidX(S / 2), ang: me ? Math.PI / 2 : -Math.PI / 2, power: 0.7 }, score: 0 });
      results.sort((a, b) => b.score - a.score);
      const pick = { ...results[Math.floor(Math.random() * Math.min(cfg.top, results.length))].shot };
      pick.ang += gauss() * cfg.noise;
      pick.power = clamp(pick.power + gauss() * cfg.noise * 2, 0.2, 1);
      game.ai = { shot: pick, t: 0, fromX: game.striker.x };
    };
    setTimeout(work, 0);
  }

  function updateAi(dt) {
    const ai = game.ai;
    if (!ai || ai.thinking) return;
    ai.t += dt;
    const st = game.striker, sh = ai.shot;
    const k1 = clamp(ai.t / 0.6, 0, 1), e1 = 1 - (1 - k1) ** 3;
    st.x = ai.fromX + (sh.x - ai.fromX) * e1;
    if (ai.t > 0.7) {
      const k2 = clamp((ai.t - 0.7) / 0.6, 0, 1), e2 = 1 - (1 - k2) ** 2;
      const L = sh.power * MAX_DRAG * e2;
      game.aim = { dx: Math.cos(sh.ang) * L, dy: Math.sin(sh.ang) * L };
    }
    if (ai.t > 1.55) { game.ai = null; st.x = sh.x; shoot(Math.cos(sh.ang), Math.sin(sh.ang), sh.power); }
  }

  // ---------- input ----------
  function pointerWorld(e) { const r = canvas.getBoundingClientRect(); return toWorld(e.clientX - r.left, e.clientY - r.top); }
  const grabRadius = () => SR + 26 / Math.max(0.5, scale);

  function moveStrikerTo(x) {
    const nx = clamp(x, BASE_X0, BASE_X1);
    if (Math.abs(nx - game.striker.x) > 6) Sfx.tick();
    game.striker.x = nx;
    syncSlider();
  }
  function syncSlider() { $('#slider').value = Math.round((game.striker.x - BASE_X0) / (BASE_X1 - BASE_X0) * 1000); }

  canvas.addEventListener('pointerdown', e => {
    Sfx.ensure();
    if (game.state !== 'place') return;
    const [wx, wy] = pointerWorld(e), st = game.striker;
    canvas.setPointerCapture(e.pointerId);
    if (Math.hypot(wx - st.x, wy - st.y) < grabRadius()) {
      game.drag = { id: e.pointerId, kind: 'aim' };
      game.aim = { dx: 0, dy: 0 };
    } else if (Math.abs(wy - st.y) < 60) {
      game.drag = { id: e.pointerId, kind: 'slide' };
      moveStrikerTo(wx);
    }
  });
  canvas.addEventListener('pointermove', e => {
    const [wx, wy] = pointerWorld(e), st = game.striker;
    const d = game.drag;
    if (d && e.pointerId === d.id) {
      if (d.kind === 'slide') moveStrikerTo(wx);
      else {
        let dx = st.x - wx, dy = st.y - wy;
        const len = Math.hypot(dx, dy);
        if (len > MAX_DRAG) { dx *= MAX_DRAG / len; dy *= MAX_DRAG / len; }
        game.aim = { dx, dy };
      }
      return;
    }
    let cursor = 'default';
    if (game.state === 'place') {
      if (Math.hypot(wx - st.x, wy - st.y) < grabRadius()) cursor = 'grab';
      else if (Math.abs(wy - st.y) < 60 && wx > BASE_X0 - 40 && wx < BASE_X1 + 40) cursor = 'ew-resize';
    }
    canvas.style.cursor = cursor;
  });
  const release = e => {
    const d = game.drag;
    if (!d || e.pointerId !== d.id) return;
    game.drag = null;
    if (d.kind !== 'aim') return;
    const a = game.aim, len = a ? Math.hypot(a.dx, a.dy) : 0;
    game.aim = null;
    if (len < 12 || game.state !== 'place') return;
    if (!placementOk(game.bodies, game.striker.x, game.striker.y)) { toast('Striker is touching a coin — slide it', '#fb923c'); return; }
    shoot(a.dx / len, a.dy / len, len / MAX_DRAG);
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', e => { if (game.drag && e.pointerId === game.drag.id) { game.drag = null; game.aim = null; } });

  $('#slider').addEventListener('input', e => {
    if (game.state !== 'place') return;
    moveStrikerTo(BASE_X0 + (+e.target.value) / 1000 * (BASE_X1 - BASE_X0));
  });

  addEventListener('keydown', e => {
    if (e.key === 'Escape' || e.key === 'p') game.state === 'paused' ? resume() : pause();
    else if (e.key === 'm') toggleSound();
    else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && game.state === 'place') {
      moveStrikerTo(game.striker.x + (e.key === 'ArrowLeft' ? -8 : 8) * (e.shiftKey ? 4 : 1));
    } else if (e.key === 'Enter') {
      if ($('#boardOv').classList.contains('show')) $('#btnNext').click();
      else if ($('#matchOv').classList.contains('show')) $('#btnRematch').click();
      else if ($('#menu').classList.contains('show')) $('#btnStart').click();
    }
  });

  // ---------- HUD / menu ----------
  let toastTimer = 0;
  function toast(text, color) {
    const el = $('#toast');
    el.textContent = text; el.style.color = color;
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    clearTimeout(toastTimer);
  }
  function setTurnText(text, color) { const t = $('#turn'); t.textContent = text; t.style.color = color; t.style.borderColor = color + '66'; }

  function refreshHud() {
    for (let i = 0; i < 2; i++) {
      const card = $('#pc' + i), col = COLORS[i];
      card.querySelector('.pname').textContent = pname(i);
      card.classList.toggle('active', game.current === i && ['place', 'ai', 'wait'].includes(game.state));
      const tray = card.querySelector('.tray');
      tray.className = 'tray ' + col;
      const n = pocketedCount(game.bodies, col);
      let html = '';
      for (let k = 0; k < 9; k++) html += `<i class="${k < n ? 'on' : ''}"></i>`;
      if (game.queenOwner === i) html += '<i class="q"></i>';
      tray.innerHTML = html;
      const boards = card.querySelector('.boards');
      boards.innerHTML = '';
      if (game.boardsToWin > 1) {
        for (let k = 0; k < game.boardsToWin; k++) {
          const p = document.createElement('div');
          p.className = 'pip' + (k < game.boardWins[i] ? ' on' : '');
          boards.appendChild(p);
        }
      }
    }
    const q = $('#queenText');
    if (game.queenOwner !== null) q.textContent = `Queen covered by ${pname(game.queenOwner)}`;
    else if (game.queenPending !== null) q.textContent = `${pname(game.queenPending)} must cover the Queen!`;
    else q.textContent = 'Queen on board';
  }

  function buildMenu() {
    const box = $('#themes');
    box.innerHTML = '';
    THEMES.forEach((th, i) => {
      const card = document.createElement('button');
      card.className = 'theme-card' + (game.theme === i ? ' sel' : '');
      const cv = document.createElement('canvas');
      card.appendChild(cv);
      card.appendChild(document.createTextNode(th.name));
      card.addEventListener('click', () => { Sfx.ensure(); Sfx.click(); game.theme = i; rebuildArt(); buildMenu(); });
      box.appendChild(card);
      requestAnimationFrame(() => {
        const w = cv.clientWidth || 120, d = Math.min(2, devicePixelRatio || 1);
        cv.width = cv.height = w * d;
        const g = cv.getContext('2d'), k = w * d / (S + FR * 2);
        g.scale(k, k); g.translate(FR, FR);
        drawBoard(g, th);
        for (const b of game.bodies) {
          if (b.state !== 0) continue;
          const art = COIN_ART[b.type];
          g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.fillStyle = art.g[1]; g.fill();
        }
      });
    });
    $('#diffRow').classList.toggle('hidden', game.mode !== 'cpu');
    const st = loadStats()[game.diff];
    $('#record').textContent = game.mode === 'cpu' && st ? `Your record vs ${game.diff} CPU: ${st.w} W – ${st.l} L` : '';
  }

  document.querySelectorAll('.seg').forEach(seg => {
    seg.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      Sfx.ensure(); Sfx.click();
      seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
      const key = seg.dataset.key, v = btn.dataset.v;
      if (key === 'boardsToWin') game.boardsToWin = +v;
      else if (key === 'guide') game.guide = v === '1';
      else game[key] = v;
      buildMenu();
    });
  });

  function toggleSound() { Sfx.ensure(); const m = Sfx.toggle(); $('#btnSound').classList.toggle('muted', m); }
  $('#btnSound').classList.toggle('muted', Sfx.muted);
  $('#btnSound').addEventListener('click', toggleSound);
  $('#btnPause').addEventListener('click', () => { Sfx.click(); pause(); });
  $('#btnStart').addEventListener('click', () => { Sfx.ensure(); Sfx.click(); startMatch(); });
  $('#btnNext').addEventListener('click', () => { Sfx.click(); game.boardNo++; startBoard(); });
  $('#btnRematch').addEventListener('click', () => { Sfx.click(); startMatch(); });
  $('#btnMenu').addEventListener('click', () => { Sfx.click(); showMenu(); });
  $('#btnResume').addEventListener('click', () => { Sfx.click(); resume(); });
  $('#btnRestart').addEventListener('click', () => { Sfx.click(); game.ai = null; startBoard(); });
  $('#btnQuit').addEventListener('click', () => { Sfx.click(); showMenu(); });

  // ---------- render ----------
  function drawBackground(now) {
    const g = ctx.createRadialGradient(cw / 2, ch * 0.5, 50, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
    g.addColorStop(0, '#22284f'); g.addColorStop(0.6, '#10142f'); g.addColorStop(1, '#070915');
    ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
    for (let i = 0; i < 3; i++) {
      const x = cw * (0.15 + 0.35 * i) + Math.sin(now / 4000 + i * 2) * 60, y = ch * (0.3 + 0.3 * (i % 2)) + Math.cos(now / 5000 + i) * 40;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, 300);
      rg.addColorStop(0, ['rgba(56,189,248,.10)', 'rgba(214,31,60,.10)', 'rgba(250,204,21,.07)'][i]);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg; ctx.fillRect(x - 300, y - 300, 600, 600);
    }
  }

  function drawCoin(b) {
    const sp = sprites[b.type];
    if (!sp) return;
    let sc = 1, alpha = 1;
    if (b.state === 1) { const t = b.t / SINK_TIME; sc = 1 - 0.55 * t; alpha = 1 - t * 0.7; }
    ctx.globalAlpha = alpha;
    const h = sp.half * sc;
    ctx.drawImage(sp.cv, b.x - h, b.y - h, h * 2, h * 2);
    ctx.globalAlpha = 1;
  }

  function drawShadow(b) {
    ctx.fillStyle = 'rgba(0,0,0,.16)';
    ctx.beginPath(); ctx.arc(b.x + 3, b.y + 5, b.r + 2.5, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.arc(b.x + 2, b.y + 3, b.r, 0, TAU); ctx.fill();
  }

  // sweep the striker along (ux,uy): first coin hit or first cushion
  function castAim(sx, sy, ux, uy) {
    let best = Infinity, hit = null;
    for (const b of game.bodies) {
      if (b.state !== 0 || b.type === 'striker') continue;
      const R = b.r + SR, fx = sx - b.x, fy = sy - b.y;
      const bq = fx * ux + fy * uy, c = fx * fx + fy * fy - R * R;
      const disc = bq * bq - c;
      if (disc < 0) continue;
      const t = -bq - Math.sqrt(disc);
      if (t > 0 && t < best) { best = t; hit = b; }
    }
    let tw = Infinity, wall = null;
    if (ux > 0) { const t = (S - SR - sx) / ux; if (t < tw) { tw = t; wall = 'x'; } }
    if (ux < 0) { const t = (SR - sx) / ux; if (t < tw) { tw = t; wall = 'x'; } }
    if (uy > 0) { const t = (S - SR - sy) / uy; if (t < tw) { tw = t; wall = 'y'; } }
    if (uy < 0) { const t = (SR - sy) / uy; if (t < tw) { tw = t; wall = 'y'; } }
    if (hit && best < tw) return { t: best, coin: hit };
    return { t: tw, wall };
  }

  function drawAim(now) {
    const a = game.aim, st = game.striker;
    if (!a) return null;
    const len = Math.hypot(a.dx, a.dy);
    if (len < 2) return null;
    const p = len / MAX_DRAG, ux = a.dx / len, uy = a.dy / len;
    const col = `hsl(${120 - p * 120},95%,60%)`;
    ctx.save();
    ctx.lineCap = 'round';
    if (game.guide) {
      const r = castAim(st.x, st.y, ux, uy);
      const ex = st.x + ux * r.t, ey = st.y + uy * r.t;
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2.5; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -now / 25;
      ctx.beginPath(); ctx.moveTo(st.x + ux * SR, st.y + uy * SR); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ex, ey, SR, 0, TAU); ctx.stroke();
      if (r.coin) {
        let nx = r.coin.x - ex, ny = r.coin.y - ey;
        const d = Math.hypot(nx, ny); nx /= d; ny /= d;
        ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.shadowColor = col; ctx.shadowBlur = 10 * scale * dpr;
        ctx.beginPath(); ctx.moveTo(r.coin.x, r.coin.y); ctx.lineTo(r.coin.x + nx * 150, r.coin.y + ny * 150); ctx.stroke();
        ctx.shadowBlur = 0;
        // striker's deflection
        const dot = ux * nx + uy * ny;
        let tx = ux - nx * dot, ty = uy - ny * dot;
        const tl = Math.hypot(tx, ty);
        if (tl > 0.05) {
          tx /= tl; ty /= tl;
          ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]);
          ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + tx * 80 * tl, ey + ty * 80 * tl); ctx.stroke();
          ctx.setLineDash([]);
        }
      } else if (r.wall) {
        const rx = r.wall === 'x' ? -ux : ux, ry = r.wall === 'y' ? -uy : uy;
        ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2; ctx.setLineDash([6, 8]);
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + rx * 160, ey + ry * 160); ctx.stroke();
        ctx.setLineDash([]);
      }
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2.5; ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(st.x + ux * SR, st.y + uy * SR); ctx.lineTo(st.x + ux * 120, st.y + uy * 120); ctx.stroke();
      ctx.setLineDash([]);
    }
    // pull-back band and finger
    const fx = st.x - a.dx, fy = st.y - a.dy;
    ctx.strokeStyle = col; ctx.lineWidth = 5 + p * 4; ctx.shadowColor = col; ctx.shadowBlur = 14 * scale * dpr;
    ctx.beginPath(); ctx.moveTo(st.x - ux * SR, st.y - uy * SR); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(fx, fy, 14, 0, TAU); ctx.fill(); ctx.stroke();
    // power ring around the striker
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(st.x, st.y, SR + 10, 0, TAU); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(st.x, st.y, SR + 10, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke();
    ctx.restore();
    return [fx, fy, p, col];
  }

  function render(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground(now);
    const shx = (Math.random() - 0.5) * game.shake * scale * 2, shy = (Math.random() - 0.5) * game.shake * scale * 2;
    ctx.setTransform(dpr, 0, 0, dpr, (ox + shx) * dpr, (oy + shy) * dpr);
    ctx.scale(scale, scale);

    // board with a big soft drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 50 * scale * dpr; ctx.shadowOffsetY = 18 * scale * dpr;
    ctx.fillStyle = '#000'; rrect(ctx, -FR + 4, -FR + 4, S + FR * 2 - 8, S + FR * 2 - 8, 28); ctx.fill();
    ctx.restore();
    ctx.drawImage(boardCv, -FR, -FR, S + FR * 2, S + FR * 2);

    const st = game.striker;
    for (const b of game.bodies) if (b.state === 1) drawCoin(b);
    for (const b of game.bodies) if (b.state === 0 || b.state === 3) drawShadow(b);
    for (const b of game.bodies) if (b.state === 0 && b !== st) drawCoin(b);

    if (st && (st.state === 0 || st.state === 3)) {
      if (st.state === 3 && game.state !== 'menu') {
        const ok = placementOk(game.bodies, st.x, st.y);
        const pulse = 0.5 + 0.5 * Math.sin(now / 220);
        ctx.save();
        ctx.strokeStyle = ok ? P_COLORS[game.current] : '#ef4444';
        ctx.lineWidth = 3 + pulse * 2; ctx.globalAlpha = 0.5 + pulse * 0.5;
        ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 16 * scale * dpr;
        ctx.beginPath(); ctx.arc(st.x, st.y, SR + 6, 0, TAU); ctx.stroke();
        ctx.restore();
        if (game.state === 'place') {
          ctx.fillStyle = 'rgba(255,255,255,.55)';
          for (const dir of [-1, 1]) {
            const ax = st.x + dir * (SR + 22);
            ctx.beginPath(); ctx.moveTo(ax + dir * 9, st.y); ctx.lineTo(ax - dir * 3, st.y - 8); ctx.lineTo(ax - dir * 3, st.y + 8); ctx.closePath(); ctx.fill();
          }
        }
      }
      drawCoin(st);
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    const aimInfo = (game.state === 'place' || game.state === 'ai') ? drawAim(now) : null;

    // screen-space text
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    if (aimInfo) {
      const [sx, sy] = toScreen(aimInfo[0], aimInfo[1]);
      ctx.font = '700 16px Fredoka, sans-serif';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.fillStyle = aimInfo[3];
      const txt = Math.round(aimInfo[2] * 100) + '%';
      ctx.strokeText(txt, sx, sy - 28); ctx.fillText(txt, sx, sy - 28);
    }
    for (const p of popups) {
      const [sx, sy] = toScreen(p.x, p.y);
      const t = p.t, k = t < 0.15 ? t / 0.15 : 1;
      const size = 30 * (0.6 + 0.4 * k) * Math.max(0.75, Math.min(1.25, scale * 1.6));
      ctx.save();
      ctx.globalAlpha = t > 0.8 ? Math.max(0, 1 - (t - 0.8) / 0.4) : 1;
      ctx.translate(sx, sy - t * 46); ctx.rotate(-0.06);
      ctx.font = `700 ${size}px Fredoka, sans-serif`;
      ctx.lineWidth = size * 0.18; ctx.strokeStyle = '#1a1030';
      ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = p.color; ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
  }

  // ---------- loop ----------
  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (game.state !== 'paused') {
      acc += dt;
      while (acc >= DT) { step(game.bodies, DT, game.state === 'menu' ? null : FX); acc -= DT; }
      if (game.state === 'moving') {
        game.moveT += dt;
        game.settleT = settled(game.bodies) ? game.settleT + dt : 0;
        if (game.settleT > 0.2 || game.moveT > 15) {
          for (const b of game.bodies) if (b.state === 0) b.vx = b.vy = 0;
          game.state = 'wait';
          resolveShot();
        }
      }
      if (game.state === 'ai') updateAi(dt);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - 4 * dt; p.vy *= 1 - 4 * dt; p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }
      for (let i = popups.length - 1; i >= 0; i--) { popups[i].t += dt; if (popups[i].t > 1.2) popups.splice(i, 1); }
      game.shake = Math.max(0, game.shake - dt * 30);
    }
    render(now);
    requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  newBoardBodies();
  resize();
  showMenu();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => buildMenu());
  requestAnimationFrame(frame);
})();
