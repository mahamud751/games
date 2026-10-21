'use strict';
(() => {
  const $ = s => document.querySelector(s);
  const canvas = $('#game');
  const ctx = canvas.getContext('2d');

  // ---------- constants ----------
  const W = 1000, H = 620;          // desk size in world units
  const DT = 1 / 240;               // fixed physics step
  const VMAX = 1150;                // full-power flick speed for a mass-1 pen
  const MU = 700;                   // sliding friction (units/s²)
  const ANG_MU = 7, LIN_DAMP = 0.5, ANG_DAMP = 1.1;
  const E = 0.5, TFRIC = 0.25;      // restitution, contact friction
  const MAX_DRAG = 170;
  const FALL_TIME = 0.8;
  const P_COLORS = ['#38bdf8', '#fb7185'];
  const TAU = Math.PI * 2;

  const PENS = [
    { id: 'classic', name: 'Classic Blue', desc: 'The trusty ballpoint everyone had. Balanced in every way.', len: 228, r: 11, m: 1.0, pow: 1.0, fric: 1.0, style: 'ball', body: '#2f6fe0', accent: '#dfe7f5' },
    { id: 'metal', name: 'Iron Clicker', desc: 'Heavy steel body. Hits like a truck and hard to push off.', len: 212, r: 12, m: 1.55, pow: 1.32, fric: 1.1, style: 'metal', body: '#9aa6b4', accent: '#e0b44a' },
    { id: 'gel', name: 'Gel Sprite', desc: 'Light and zippy. Slides far, but flies off easily too.', len: 205, r: 10, m: 0.72, pow: 0.9, fric: 0.82, style: 'gel', body: '#ff4fa3', accent: '#ffd1e8' },
    { id: 'marker', name: 'Big Marker', desc: 'Fat and grippy. A wall on the desk, slow to get going.', len: 190, r: 16, m: 1.4, pow: 1.2, fric: 1.25, style: 'marker', body: '#1b1d22', accent: '#22c55e' },
    { id: 'pencil', name: 'Yellow No.2', desc: 'Extra long reach. Flick the ends for wild spinning sweeps.', len: 268, r: 9, m: 0.85, pow: 0.95, fric: 0.95, style: 'pencil', body: '#f6c21c', accent: '#f472b6' },
  ];
  const ERASER = { id: 'eraser', name: 'Eraser', len: 96, r: 21, m: 2.4, pow: 1, fric: 1.8, style: 'eraser', body: '#f5f1ea', accent: '#2563eb' };
  const DIFF = {
    easy: { samples: 22, noise: 0.22, top: 5 },
    normal: { samples: 60, noise: 0.07, top: 2 },
    hard: { samples: 150, noise: 0.012, top: 1 },
  };

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

  // ---------- audio ----------
  const Sfx = (() => {
    let ac = null, master = null, noiseBuf = null, muted = false;
    try { muted = localStorage.getItem('penclash.muted') === '1'; } catch (e) {}
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
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
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
      toggle() { muted = !muted; try { localStorage.setItem('penclash.muted', muted ? '1' : '0'); } catch (e) {} return muted; },
      click() { tone(660, 0.06, 'triangle', 0.14); },
      flick(p) { noise(0.08, 2600, 2, 0.2 + p * 0.3); tone(280 + p * 300, 0.1, 'triangle', 0.14, 900 + p * 700); },
      hit(s) {
        const v = Math.min(1, s / 900);
        noise(0.04 + v * 0.06, 1700 + v * 1600, 3, 0.1 + v * 0.45);
        tone(1100 + v * 600, 0.05, 'square', 0.04 + v * 0.07, 600);
      },
      fall() { tone(760, 0.5, 'sine', 0.2, 110); noise(0.25, 380, 0.8, 0.35, 0.45); tone(95, 0.22, 'sine', 0.35, 50, 0.45); },
      turn() { tone(520, 0.08, 'sine', 0.1); tone(780, 0.1, 'sine', 0.1, null, 0.07); },
      win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.28, 'triangle', 0.2, null, i * 0.11)); },
      lose() { [392, 330, 262].forEach((f, i) => tone(f, 0.32, 'triangle', 0.16, null, i * 0.16)); },
    };
  })();

  // ---------- physics ----------
  function makeBody(def, x, y, a, owner) {
    return {
      def, x, y, a, vx: 0, vy: 0, w: 0,
      h: def.len / 2 - def.r, r: def.r, m: def.m, I: def.m * def.len * def.len / 12 * 0.9,
      fric: def.fric, owner, state: 0, fallT: 0,  // state: 0 on desk, 1 falling, 2 gone
    };
  }

  function segOf(b) {
    const c = Math.cos(b.a) * b.h, s = Math.sin(b.a) * b.h;
    return [b.x - c, b.y - s, b.x + c, b.y + s];
  }

  function closestOnSeg(b, px, py) {
    const [ax, ay, bx, by] = segOf(b);
    const dx = bx - ax, dy = by - ay;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    return [ax + dx * t, ay + dy * t];
  }

  function applyImpulse(b, px, py, jx, jy) {
    b.vx += jx / b.m; b.vy += jy / b.m;
    b.w += ((px - b.x) * jy - (py - b.y) * jx) / b.I;
  }

  function collide(A, B, fx) {
    const [p1x, p1y, q1x, q1y] = segOf(A), [p2x, p2y, q2x, q2y] = segOf(B);
    const d1x = q1x - p1x, d1y = q1y - p1y, d2x = q2x - p2x, d2y = q2y - p2y;
    const rx = p1x - p2x, ry = p1y - p2y;
    const a = d1x * d1x + d1y * d1y, e = d2x * d2x + d2y * d2y, f = d2x * rx + d2y * ry;
    const c = d1x * rx + d1y * ry, bb = d1x * d2x + d1y * d2y, den = a * e - bb * bb;
    let s = den > 1e-9 ? clamp((bb * f - c * e) / den, 0, 1) : 0;
    let t = (bb * s + f) / e;
    if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((bb - c) / a, 0, 1); }
    const c1x = p1x + d1x * s, c1y = p1y + d1y * s, c2x = p2x + d2x * t, c2y = p2y + d2y * t;
    let dx = c2x - c1x, dy = c2y - c1y;
    const R = A.r + B.r, dd = dx * dx + dy * dy;
    if (dd >= R * R) return;
    const d = Math.sqrt(dd);
    let nx, ny;
    if (d < 1e-6) { nx = -Math.sin(A.a); ny = Math.cos(A.a); } else { nx = dx / d; ny = dy / d; }
    const pen = R - d;
    const px = c1x + nx * (A.r - pen / 2), py = c1y + ny * (A.r - pen / 2);
    const imA = 1 / A.m, imB = 1 / B.m;
    const corr = pen / (imA + imB) * 0.8;
    A.x -= nx * corr * imA; A.y -= ny * corr * imA;
    B.x += nx * corr * imB; B.y += ny * corr * imB;

    const rax = px - A.x, ray = py - A.y, rbx = px - B.x, rby = py - B.y;
    const rvx = (B.vx - B.w * rby) - (A.vx - A.w * ray);
    const rvy = (B.vy + B.w * rbx) - (A.vy + A.w * rax);
    const vn = rvx * nx + rvy * ny;
    if (vn >= 0) return;
    const raN = rax * ny - ray * nx, rbN = rbx * ny - rby * nx;
    const j = -(1 + E) * vn / (imA + imB + raN * raN / A.I + rbN * rbN / B.I);
    A.vx -= j * nx * imA; A.vy -= j * ny * imA; A.w -= raN * j / A.I;
    B.vx += j * nx * imB; B.vy += j * ny * imB; B.w += rbN * j / B.I;

    const tx = -ny, ty = nx, vt = rvx * tx + rvy * ty;
    const raT = rax * ty - ray * tx, rbT = rbx * ty - rby * tx;
    let jt = -vt / (imA + imB + raT * raT / A.I + rbT * rbT / B.I);
    jt = clamp(jt, -TFRIC * j, TFRIC * j);
    A.vx -= jt * tx * imA; A.vy -= jt * ty * imA; A.w -= raT * jt / A.I;
    B.vx += jt * tx * imB; B.vy += jt * ty * imB; B.w += rbT * jt / B.I;

    if (fx) fx.hit(px, py, -vn);
  }

  function step(bs, dt, fx) {
    for (const b of bs) {
      if (b.state === 2) continue;
      b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.w * dt;
      if (b.state === 0) {
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > 0) {
          const ns = Math.max(0, sp - (MU * b.fric + sp * LIN_DAMP) * dt);
          b.vx *= ns / sp; b.vy *= ns / sp;
        }
        const aw = Math.abs(b.w);
        if (aw > 0) b.w *= Math.max(0, aw - (ANG_MU * b.fric + aw * ANG_DAMP) * dt) / aw;
        // a pen tips over once its centre of mass leaves the desk
        if (b.x < 0 || b.x > W || b.y < 0 || b.y > H) {
          b.state = 1; b.fallT = 0;
          if (fx) fx.fall(b);
        }
      } else {
        b.fallT += dt;
        b.vx *= 1 - 1.5 * dt; b.vy *= 1 - 1.5 * dt;
        if (b.fallT > FALL_TIME) b.state = 2;
      }
    }
    for (let i = 0; i < bs.length; i++) {
      if (bs[i].state) continue;
      for (let k = i + 1; k < bs.length; k++) if (!bs[k].state) collide(bs[i], bs[k], fx);
    }
  }

  function settled(bs) {
    for (const b of bs) {
      if (b.state === 1) return false;
      if (b.state === 0 && (b.vx * b.vx + b.vy * b.vy > 16 || Math.abs(b.w) > 0.05)) return false;
    }
    return true;
  }

  // ---------- drawing helpers ----------
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
    else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    return '#' + [r, g, b].map(v => (v | 0).toString(16).padStart(2, '0')).join('');
  }
  function cylGrad(c, r, base, gloss = 0.6) {
    const g = c.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, shade(base, -0.6));
    g.addColorStop(0.2, shade(base, 0));
    g.addColorStop(0.34, shade(base, gloss));
    g.addColorStop(0.48, shade(base, 0.1));
    g.addColorStop(0.82, shade(base, -0.3));
    g.addColorStop(1, shade(base, -0.68));
    return g;
  }
  function capsulePath(c, x0, x1, r) {
    c.beginPath();
    c.moveTo(x0, -r); c.lineTo(x1, -r);
    c.arc(x1, 0, r, -Math.PI / 2, Math.PI / 2);
    c.lineTo(x0, r);
    c.arc(x0, 0, r, Math.PI / 2, Math.PI * 1.5);
    c.closePath();
  }
  function rrect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  // body from x0 to x1 with a rounded back end at x0
  function barrel(c, x0, x1, r, fill) {
    c.beginPath();
    c.moveTo(x1, -r); c.lineTo(x0 + r, -r);
    c.arc(x0 + r, 0, r, -Math.PI / 2, Math.PI / 2, true);
    c.lineTo(x1, r); c.closePath();
    c.fillStyle = fill; c.fill();
  }
  function band(c, x, w, r, color) { c.fillStyle = cylGrad(c, r, color); c.fillRect(x, -r, w, r * 2); }
  function clip(c, x0, x1, r, color) {
    c.save();
    c.fillStyle = 'rgba(0,0,0,.25)';
    rrect(c, x0 + 1, -r * 0.42 + 2, x1 - x0, r * 0.5, r * 0.25); c.fill();
    const g = c.createLinearGradient(0, -r * 0.45, 0, r * 0.05);
    g.addColorStop(0, shade(color, 0.7)); g.addColorStop(0.5, color); g.addColorStop(1, shade(color, -0.4));
    c.fillStyle = g;
    rrect(c, x0, -r * 0.45, x1 - x0, r * 0.5, r * 0.25); c.fill();
    c.restore();
  }
  function metalTip(c, x0, x1, r0, r1, gold) {
    const base = gold ? '#e0b44a' : '#c9d1dc';
    c.beginPath();
    c.moveTo(x0, -r0); c.lineTo(x1, -r1); c.lineTo(x1, r1); c.lineTo(x0, r0); c.closePath();
    c.fillStyle = cylGrad(c, r0, base, 0.75); c.fill();
    c.beginPath(); c.arc(x1 + r1 * 0.3, 0, r1 * 0.9, 0, TAU); c.fillStyle = '#2b2f36'; c.fill();
  }

  function drawPen(c, def) {
    const L = def.len, r = def.r, hL = L / 2;
    c.lineJoin = 'round';
    switch (def.style) {
      case 'ball':
      case 'metal': {
        const metal = def.style === 'metal';
        const tipLen = r * 2.4, bodyEnd = hL - tipLen;
        barrel(c, -hL, bodyEnd, r, cylGrad(c, r, def.body, metal ? 0.85 : 0.55));
        // grip
        const g0 = bodyEnd - L * 0.24;
        band(c, g0, L * 0.24, r * 1.02, metal ? '#4b5563' : shade(def.body, -0.45));
        c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 1.2;
        for (let x = g0 + 5; x < bodyEnd - 2; x += 5) { c.beginPath(); c.moveTo(x, -r); c.lineTo(x, r); c.stroke(); }
        band(c, bodyEnd - 4, 4, r, metal ? '#e0b44a' : '#c9d1dc');
        band(c, g0 - 4, 4, r, metal ? '#e0b44a' : '#c9d1dc');
        if (metal) { band(c, -hL + L * 0.36, 3, r, '#e0b44a'); band(c, -hL + L * 0.4, 3, r, '#e0b44a'); }
        metalTip(c, bodyEnd, hL - r * 0.35, r * 0.85, r * 0.25, metal);
        // click button
        c.beginPath(); c.arc(-hL + r * 0.55, 0, r * 0.45, 0, TAU);
        c.fillStyle = cylGrad(c, r * 0.45, metal ? '#e0b44a' : def.accent); c.fill();
        clip(c, -hL + r * 1.6, -hL + L * 0.34, r, metal ? '#f1f5f9' : '#c9d1dc');
        break;
      }
      case 'gel': {
        const tipLen = r * 2.4, bodyEnd = hL - tipLen, capEnd = -hL + L * 0.3;
        c.save(); c.globalAlpha *= 0.55;
        barrel(c, -hL, bodyEnd, r, cylGrad(c, r, '#e8f0ff', 0.9));
        c.restore();
        // ink tube inside
        c.fillStyle = def.body; c.fillRect(capEnd, -r * 0.28, bodyEnd - capEnd - 2, r * 0.56);
        c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(capEnd, -r * 0.2, bodyEnd - capEnd - 2, r * 0.12);
        // grip
        c.save(); c.globalAlpha *= 0.8;
        band(c, bodyEnd - L * 0.22, L * 0.22, r * 1.03, def.body);
        c.restore();
        c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5;
        for (let x = bodyEnd - L * 0.22 + 4; x < bodyEnd - 2; x += 6) { c.beginPath(); c.arc(x, 0, r * 0.95, -1.1, 1.1); c.stroke(); }
        // back cap
        barrel(c, -hL, capEnd, r * 1.04, cylGrad(c, r * 1.04, def.body, 0.6));
        clip(c, -hL + r * 1.2, capEnd + L * 0.06, r, def.accent);
        metalTip(c, bodyEnd, hL - r * 0.35, r * 0.8, r * 0.22, false);
        c.fillStyle = 'rgba(255,255,255,.55)';
        c.fillRect(capEnd + 4, -r * 0.62, bodyEnd - capEnd - 10, r * 0.14);
        break;
      }
      case 'marker': {
        const capStart = hL - L * 0.4;
        barrel(c, -hL, capStart + 6, r, cylGrad(c, r, def.body, 0.35));
        // label
        c.fillStyle = cylGrad(c, r, '#f1f5f9', 0.4);
        c.fillRect(-hL + L * 0.18, -r, L * 0.3, r * 2);
        c.fillStyle = def.accent; c.fillRect(-hL + L * 0.18, -r * 0.25, L * 0.3, r * 0.5);
        c.fillStyle = '#111'; c.font = `700 ${r * 0.5}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('PERMANENT', -hL + L * 0.33, -r * 0.6);
        // back plug
        c.beginPath(); c.arc(-hL + r * 0.4, 0, r * 0.55, 0, TAU); c.fillStyle = cylGrad(c, r * 0.55, def.accent); c.fill();
        // cap
        c.beginPath();
        c.moveTo(capStart, -r * 1.06); c.lineTo(hL - r * 0.6, -r * 1.0);
        c.quadraticCurveTo(hL, -r * 0.9, hL, 0); c.quadraticCurveTo(hL, r * 0.9, hL - r * 0.6, r);
        c.lineTo(capStart, r * 1.06); c.closePath();
        c.fillStyle = cylGrad(c, r * 1.06, def.accent, 0.5); c.fill();
        c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 1.4;
        for (let x = capStart + 6; x < capStart + 26; x += 4) { c.beginPath(); c.moveTo(x, -r); c.lineTo(x, r); c.stroke(); }
        clip(c, capStart + 4, capStart + L * 0.26, r, shade(def.accent, -0.1));
        break;
      }
      case 'pencil': {
        const coneLen = r * 3.4, coneStart = hL - coneLen, eraserLen = r * 2.2, ferLen = r * 1.6;
        const x0 = -hL + eraserLen + ferLen;
        // hex faces
        c.fillStyle = shade(def.body, -0.35); c.fillRect(x0, -r, coneStart - x0, r * 2);
        c.fillStyle = shade(def.body, 0.25); c.fillRect(x0, -r * 0.85, coneStart - x0, r * 0.6);
        c.fillStyle = def.body; c.fillRect(x0, -r * 0.25, coneStart - x0, r * 0.55);
        c.fillStyle = shade(def.body, -0.15); c.fillRect(x0, r * 0.3, coneStart - x0, r * 0.5);
        c.fillStyle = 'rgba(0,0,0,.6)'; c.font = `600 ${r * 0.9}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('HB  No.2', x0 + (coneStart - x0) * 0.35, 0);
        // sharpened wood cone
        c.beginPath(); c.moveTo(coneStart, -r);
        for (let i = 0; i <= 4; i++) c.lineTo(coneStart + (i % 2) * 3, -r + i * r / 2);
        c.lineTo(hL, 0); c.closePath();
        c.fillStyle = cylGrad(c, r, '#e9c28f', 0.4); c.fill();
        c.beginPath(); c.moveTo(hL - coneLen * 0.32, -r * 0.3); c.lineTo(hL, 0); c.lineTo(hL - coneLen * 0.32, r * 0.3); c.closePath();
        c.fillStyle = '#3a3a44'; c.fill();
        // ferrule + eraser
        band(c, -hL + eraserLen, ferLen, r * 1.03, '#c9d1dc');
        c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1;
        for (let x = -hL + eraserLen + 3; x < x0 - 1; x += 3.5) { c.beginPath(); c.moveTo(x, -r); c.lineTo(x, r); c.stroke(); }
        barrel(c, -hL, -hL + eraserLen + 1, r * 0.98, cylGrad(c, r, def.accent, 0.35));
        break;
      }
      case 'eraser': {
        const rr = r * 0.8;
        c.fillStyle = cylGrad(c, r, def.body, 0.4);
        rrect(c, -hL, -r, L, r * 2, rr); c.fill();
        // paper sleeve
        const sw = L * 0.56;
        c.fillStyle = cylGrad(c, r, def.accent, 0.35);
        c.fillRect(-sw / 2, -r, sw, r * 2);
        c.fillStyle = '#ef4444'; c.fillRect(-sw / 2, -r * 0.18, sw, r * 0.36);
        c.fillStyle = '#fff'; c.font = `700 ${r * 0.48}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('ERASE', 0, -r * 0.55);
        // crumbs / smudge on the rubber
        c.fillStyle = 'rgba(80,80,90,.18)';
        c.beginPath(); c.ellipse(L * 0.38, r * 0.2, 6, 9, 0.3, 0, TAU); c.fill();
        break;
      }
    }
  }

  function drawPreview(cv, def) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth || 120, h = cv.clientHeight || 30;
    cv.width = w * dpr; cv.height = h * dpr;
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    const k = Math.min((w - 6) / def.len, (h - 4) / (def.r * 2.2));
    c.translate(w / 2, h / 2); c.scale(k, k);
    drawPen(c, def);
  }

  // ---------- desk texture ----------
  function mulberry32(a) {
    return () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function genDesk(k) {
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(W * k); cv.height = Math.ceil(H * k);
    const g = cv.getContext('2d');
    g.scale(k, k);
    const rnd = mulberry32(11);
    const base = g.createLinearGradient(0, 0, W, H);
    base.addColorStop(0, '#d39a5c'); base.addColorStop(0.5, '#c58a4f'); base.addColorStop(1, '#b27844');
    g.fillStyle = base; g.fillRect(0, 0, W, H);

    // planks
    const ph = H / 4;
    for (let i = 0; i < 4; i++) {
      g.fillStyle = rnd() < 0.5 ? `rgba(90,45,15,${0.04 + rnd() * 0.06})` : `rgba(255,225,180,${0.04 + rnd() * 0.06})`;
      g.fillRect(0, i * ph, W, ph);
    }
    // grain
    for (let i = 0; i < 300; i++) {
      const plank = Math.floor(rnd() * 4), y0 = plank * ph + rnd() * ph;
      const amp = 1.5 + rnd() * 5, fq = 0.003 + rnd() * 0.01, ph0 = rnd() * TAU;
      g.strokeStyle = rnd() < 0.75 ? `rgba(85,40,12,${0.05 + rnd() * 0.13})` : `rgba(255,230,190,${0.06 + rnd() * 0.08})`;
      g.lineWidth = 0.5 + rnd() * 1.8;
      g.save(); g.beginPath(); g.rect(0, plank * ph, W, ph); g.clip();
      g.beginPath();
      for (let x = -10; x <= W + 10; x += 10) {
        const y = y0 + Math.sin(x * fq + ph0) * amp + Math.sin(x * fq * 3.3 + ph0 * 2) * amp * 0.3;
        x < 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke(); g.restore();
    }
    // knots
    for (let i = 0; i < 3; i++) {
      const x = 80 + rnd() * (W - 160), y = 40 + rnd() * (H - 80), rx = 10 + rnd() * 10;
      for (let j = 6; j > 0; j--) {
        g.strokeStyle = `rgba(80,35,10,${0.08 + (6 - j) * 0.03})`; g.lineWidth = 1.4;
        g.beginPath(); g.ellipse(x, y, rx * j * 0.5 + 2, rx * j * 0.18 + 1, 0, 0, TAU); g.stroke();
      }
      g.fillStyle = 'rgba(70,30,8,.35)'; g.beginPath(); g.ellipse(x, y, rx * 0.4, rx * 0.16, 0, 0, TAU); g.fill();
    }
    // plank seams
    for (let i = 1; i < 4; i++) {
      g.fillStyle = 'rgba(50,22,6,.45)'; g.fillRect(0, i * ph - 1, W, 1.5);
      g.fillStyle = 'rgba(255,235,200,.15)'; g.fillRect(0, i * ph + 0.5, W, 1);
    }

    // graphite doodles from bored students
    g.save();
    g.strokeStyle = 'rgba(50,46,58,.34)'; g.fillStyle = 'rgba(50,46,58,.34)';
    g.lineWidth = 2; g.lineCap = 'round'; g.lineJoin = 'round';
    // heart
    const hx = 120, hy = 92, hs = 26;
    g.beginPath(); g.moveTo(hx, hy + hs * 0.3);
    g.bezierCurveTo(hx, hy - hs * 0.3, hx - hs, hy - hs * 0.3, hx - hs, hy + hs * 0.2);
    g.bezierCurveTo(hx - hs, hy + hs * 0.65, hx, hy + hs * 0.85, hx, hy + hs * 1.15);
    g.bezierCurveTo(hx, hy + hs * 0.85, hx + hs, hy + hs * 0.65, hx + hs, hy + hs * 0.2);
    g.bezierCurveTo(hx + hs, hy - hs * 0.3, hx, hy - hs * 0.3, hx, hy + hs * 0.3);
    g.stroke();
    g.font = '600 22px Caveat, cursive'; g.textAlign = 'center';
    g.fillText('A + R', hx, hy + hs * 0.62);
    // tic-tac-toe
    const tx = 830, ty = 455, ts = 32;
    g.beginPath();
    for (let i = 1; i < 3; i++) {
      g.moveTo(tx + ts * i, ty - 4); g.lineTo(tx + ts * i + 2, ty + ts * 3 + 3);
      g.moveTo(tx - 4, ty + ts * i); g.lineTo(tx + ts * 3 + 3, ty + ts * i - 2);
    }
    g.stroke();
    const X = (cx, cy) => { g.beginPath(); g.moveTo(cx - 9, cy - 9); g.lineTo(cx + 9, cy + 9); g.moveTo(cx + 9, cy - 9); g.lineTo(cx - 9, cy + 9); g.stroke(); };
    const O = (cx, cy) => { g.beginPath(); g.arc(cx, cy, 10, 0, TAU); g.stroke(); };
    X(tx + 16, ty + 16); O(tx + 48, ty + 16); X(tx + 48, ty + 48); O(tx + 80, ty + 48); X(tx + 80, ty + 80); O(tx + 16, ty + 80);
    g.beginPath(); g.moveTo(tx + 6, ty + 6); g.lineTo(tx + 90, ty + 90); g.stroke();
    // star
    g.beginPath();
    for (let i = 0; i <= 10; i++) {
      const ang = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 11 : 26;
      const x = 890 + Math.cos(ang) * rr, y = 100 + Math.sin(ang) * rr;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
    // smiley
    g.beginPath(); g.arc(110, 520, 28, 0, TAU); g.stroke();
    g.beginPath(); g.arc(110, 524, 15, 0.2, Math.PI - 0.2); g.stroke();
    g.beginPath(); g.arc(100, 512, 2.5, 0, TAU); g.arc(120, 512, 2.5, 0, TAU); g.fill();
    // tally marks
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(40 + i * 9, 280); g.lineTo(42 + i * 9, 316); g.stroke(); }
    g.beginPath(); g.moveTo(32, 306); g.lineTo(76, 288); g.stroke();
    // scribbles
    g.save(); g.translate(560, 585); g.rotate(-0.04);
    g.font = '600 26px Caveat, cursive'; g.textAlign = 'left';
    g.fillText('pen fight champ ★', 0, 0);
    g.restore();
    g.save(); g.translate(640, 44); g.rotate(0.06);
    g.font = '600 30px Caveat, cursive'; g.fillText('A+', 0, 0);
    g.beginPath(); g.ellipse(0, -10, 28, 20, 0, 0, TAU); g.stroke();
    g.restore();
    g.restore();

    // ink blot
    g.fillStyle = 'rgba(30,55,150,.32)';
    g.beginPath(); g.ellipse(250, 560, 16, 11, 0.4, 0, TAU); g.fill();
    for (let i = 0; i < 9; i++) {
      const a = rnd() * TAU, d = 16 + rnd() * 18;
      g.beginPath(); g.arc(250 + Math.cos(a) * d, 560 + Math.sin(a) * d * 0.7, 1 + rnd() * 3, 0, TAU); g.fill();
    }
    // carved scratch
    g.strokeStyle = 'rgba(60,25,5,.4)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(700, 300); g.lineTo(760, 286); g.lineTo(790, 295); g.stroke();
    g.strokeStyle = 'rgba(255,235,200,.25)';
    g.beginPath(); g.moveTo(700, 301.5); g.lineTo(760, 287.5); g.lineTo(790, 296.5); g.stroke();

    // lighting
    const vg = g.createRadialGradient(W / 2, H * 0.42, 100, W / 2, H / 2, W * 0.68);
    vg.addColorStop(0, 'rgba(255,240,210,.12)'); vg.addColorStop(1, 'rgba(40,15,0,.38)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,230,190,.4)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, W - 3, H - 3);
    g.strokeStyle = 'rgba(60,25,5,.5)'; g.lineWidth = 2; g.strokeRect(5, 5, W - 10, H - 10);
    return cv;
  }

  // ---------- view ----------
  let dpr = 1, cw = 0, ch = 0, scale = 1, M = new DOMMatrix(), INV = new DOMMatrix(), desk = null;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = innerWidth; ch = innerHeight;
    canvas.width = cw * dpr; canvas.height = ch * dpr;
    const hudH = cw < 720 ? 84 : 96;
    const portrait = ch > cw * 1.15;
    const ww = portrait ? H + 20 : W, wh = portrait ? W : H + 20;
    const availW = cw - 32, availH = ch - hudH - 24;
    scale = Math.min(availW / ww, availH / wh);
    const tw = (portrait ? H : W) * scale, th = (portrait ? W : H) * scale;
    const left = (cw - tw) / 2, top = hudH + (availH - th) / 2 - (portrait ? 0 : 6);
    M = portrait ? new DOMMatrix().translate(left + tw, top).rotate(90).scale(scale) : new DOMMatrix().translate(left, top).scale(scale);
    INV = M.inverse();
    desk = genDesk(scale * dpr);
  }
  const toWorld = (x, y) => { const p = INV.transformPoint(new DOMPoint(x, y)); return [p.x, p.y]; };
  const toScreen = (x, y) => { const p = M.transformPoint(new DOMPoint(x, y)); return [p.x, p.y]; };

  // ---------- game state ----------
  const game = {
    mode: 'cpu', diff: 'normal', bestOf: 3, items: true, picks: [0, 2],
    scores: [0, 0], round: 1, starter: 0, current: 0, shooter: 0,
    state: 'menu', prevState: null, bodies: [], aim: null, drag: null, ai: null,
    moveT: 0, settleT: 0, shake: 0, firstFlick: true,
  };
  const particles = [], popups = [];
  let lastHit = 0;

  const isCpu = i => game.mode === 'cpu' && i === 1;
  const pname = i => game.mode === 'cpu' ? (i === 0 ? 'You' : 'CPU') : `Player ${i + 1}`;
  const need = () => Math.ceil(game.bestOf / 2);

  const FX = {
    hit(x, y, s) {
      if (s < 50) return;
      const now = performance.now();
      if (now - lastHit > 35) { Sfx.hit(s); lastHit = now; }
      const n = Math.min(14, 3 + s / 70);
      for (let i = 0; i < n; i++) {
        const a = rand(0, TAU), v = rand(40, 120 + s * 0.35);
        particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.25, 0.5), max: 0.5, size: rand(1.5, 3.5), color: Math.random() < 0.6 ? '#fff7d6' : '#fde047' });
      }
      if (s > 620) {
        game.shake = Math.max(game.shake, Math.min(12, s / 110));
        popup(x, y, ['BONK!', 'WHACK!', 'POW!', 'CLACK!', 'THWACK!'][Math.random() * 5 | 0], '#fde047', 0.8 + Math.min(0.6, s / 2500));
      }
    },
    fall(b) {
      const x = clamp(b.x, 40, W - 40), y = clamp(b.y, 40, H - 40);
      if (b.owner >= 0) {
        Sfx.fall(); game.shake = Math.max(game.shake, 7);
        popup(x, y, 'OFF THE DESK!', P_COLORS[b.owner], 1.1);
      } else Sfx.hit(260);
      for (let i = 0; i < 16; i++) {
        const a = rand(0, TAU), v = rand(30, 160);
        particles.push({ x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.4, 0.8), max: 0.8, size: rand(2, 5), color: b.owner >= 0 ? P_COLORS[b.owner] : '#e5e7eb' });
      }
    },
  };

  function popup(x, y, text, color, size = 1) { popups.push({ x, y, text, color, size, t: 0 }); }

  function setupBodies() {
    const bs = [];
    bs.push(makeBody(PENS[game.picks[0]], 290 + rand(-20, 20), H / 2 + rand(-50, 50), Math.PI / 2 + rand(-0.45, 0.45), 0));
    bs.push(makeBody(PENS[game.picks[1]], 710 + rand(-20, 20), H / 2 + rand(-50, 50), Math.PI / 2 + rand(-0.45, 0.45), 1));
    if (game.items) {
      const count = Math.random() < 0.5 ? 1 : 2;
      for (let n = 0, tries = 0; n < count && tries < 80; tries++) {
        const e = makeBody(ERASER, rand(410, 590), rand(110, H - 110), rand(0, Math.PI), -1);
        const ok = bs.every(o => {
          const [cx, cy] = closestOnSeg(o, e.x, e.y);
          return Math.hypot(cx - e.x, cy - e.y) > o.r + e.r + 60;
        });
        if (ok) { bs.push(e); n++; }
      }
    }
    game.bodies = bs;
  }

  // ---------- flow ----------
  function startMatch() {
    game.scores = [0, 0]; game.round = 1; game.starter = Math.random() < 0.5 ? 0 : 1;
    if (game.mode === 'cpu') game.starter = 0;
    hideAll(); $('#hud').classList.remove('hidden');
    refreshHud();
    startRound();
  }

  function startRound() {
    hideAll();
    setupBodies();
    particles.length = 0; popups.length = 0;
    game.current = game.starter; game.aim = null; game.drag = null; game.ai = null;
    $('#roundLabel').textContent = `Round ${game.round} · first to ${need()}`;
    refreshHud();
    banner(`Round ${game.round}`, '#fde047');
    setTimeout(beginTurn, 700);
    game.state = 'wait';
  }

  function beginTurn() {
    if (game.state === 'menu' || game.state === 'paused') return;
    game.aim = null; game.drag = null;
    refreshHud();
    Sfx.turn();
    if (isCpu(game.current)) {
      game.state = 'ai';
      setTurnText('CPU is lining up a shot…', P_COLORS[1]);
      setTimeout(() => {
        if (game.state !== 'ai') return;
        game.ai = { shot: aiPlan(), t: 0 };
      }, 500);
    } else {
      game.state = 'aim';
      setTurnText(game.mode === 'cpu' ? 'Your turn — flick!' : `${pname(game.current)} — your flick!`, P_COLORS[game.current]);
      if (game.firstFlick) $('#hint').classList.remove('hidden');
    }
  }

  function doFlick(b, gx, gy, ux, uy, power) {
    const J = power * VMAX * b.def.pow;
    applyImpulse(b, gx, gy, ux * J, uy * J);
    Sfx.flick(power);
    game.state = 'moving'; game.shooter = game.current; game.moveT = 0; game.settleT = 0;
    game.aim = null; game.drag = null;
    game.firstFlick = false; $('#hint').classList.add('hidden');
    setTurnText('Sliiiide…', '#f1f4ff');
  }

  function resolve() {
    for (const b of game.bodies) if (b.state === 0) { b.vx = b.vy = b.w = 0; }
    const fallen = [0, 1].filter(i => game.bodies[i].state > 0);
    if (!fallen.length) { game.current = 1 - game.current; beginTurn(); return; }
    const selfKO = fallen.includes(game.shooter);
    const loser = selfKO ? game.shooter : fallen[0], winner = 1 - loser;
    game.scores[winner]++;
    game.state = 'roundEnd';
    refreshHud();
    const matchOver = game.scores[winner] >= need();
    setTimeout(() => matchOver ? showMatchEnd(winner) : showRoundEnd(winner, loser, selfKO), 900);
  }

  function scoreHTML() {
    return `<span class="s0">${game.scores[0]}</span><span class="dash">–</span><span class="s1">${game.scores[1]}</span>`;
  }

  function showRoundEnd(winner, loser, selfKO) {
    const wPen = PENS[game.picks[winner]].name, lPen = PENS[game.picks[loser]].name;
    $('#roKicker').textContent = `Round ${game.round}`;
    $('#roTitle').textContent = game.mode === 'cpu' ? (winner === 0 ? 'You take the round!' : 'CPU takes the round') : `${pname(winner)} takes the round!`;
    $('#roTitle').style.color = P_COLORS[winner];
    $('#roSub').textContent = selfKO ? `Oops — ${lPen} flew off the desk all by itself!` : `${wPen} knocked ${lPen} clean off the desk.`;
    $('#roScore').innerHTML = scoreHTML();
    (game.mode === 'cpu' && winner === 1 ? Sfx.lose : Sfx.win)();
    game.starter = loser;
    $('#roundOv').classList.add('show');
  }

  function showMatchEnd(winner) {
    const cpuLoss = game.mode === 'cpu' && winner === 1;
    $('#moTitle').textContent = game.mode === 'cpu' ? (winner === 0 ? 'Desk champion!' : 'The CPU wins the match') : `${pname(winner)} wins the match!`;
    $('#moTitle').style.color = P_COLORS[winner];
    $('#moSub').textContent = cpuLoss ? 'Sharpen up and try again.' : `${PENS[game.picks[winner]].name} rules the desk.`;
    $('#moScore').innerHTML = scoreHTML();
    if (game.mode === 'cpu') {
      const st = loadStats();
      const k = game.diff;
      st[k] = st[k] || { w: 0, l: 0 };
      winner === 0 ? st[k].w++ : st[k].l++;
      saveStats(st);
    }
    $('.trophy').style.display = cpuLoss ? 'none' : '';
    (cpuLoss ? Sfx.lose : Sfx.win)();
    game.state = 'matchEnd';
    $('#matchOv').classList.add('show');
  }

  function loadStats() { try { return JSON.parse(localStorage.getItem('penclash.stats')) || {}; } catch (e) { return {}; } }
  function saveStats(s) { try { localStorage.setItem('penclash.stats', JSON.stringify(s)); } catch (e) {} }

  function hideAll() { document.querySelectorAll('.overlay').forEach(o => o.classList.remove('show')); }

  function showMenu() {
    hideAll();
    game.state = 'menu'; game.ai = null; game.aim = null;
    $('#hud').classList.add('hidden'); $('#hint').classList.add('hidden');
    setupBodies();
    buildMenu();
    $('#menu').classList.add('show');
  }

  function pause() {
    if (['menu', 'matchEnd', 'paused'].includes(game.state)) return;
    game.prevState = game.state; game.state = 'paused';
    $('#pauseOv').classList.add('show');
  }
  function resume() {
    if (game.state !== 'paused') return;
    game.state = game.prevState;
    $('#pauseOv').classList.remove('show');
  }

  // ---------- AI ----------
  function shotFor(b, t, ang, power) {
    const c = Math.cos(b.a), s = Math.sin(b.a);
    return { gx: b.x + c * b.h * t, gy: b.y + s * b.h * t, ang, power: clamp(power, 0.15, 1) };
  }

  function evalShot(shot) {
    const bs = game.bodies.map(b => ({ ...b }));
    const me = bs[1], opp = bs[0];
    const J = shot.power * VMAX * me.def.pow;
    applyImpulse(me, shot.gx, shot.gy, Math.cos(shot.ang) * J, Math.sin(shot.ang) * J);
    for (let i = 0; i < 2600; i++) {
      step(bs, DT, null);
      if (i % 24 === 23 && settled(bs)) break;
    }
    const edge = b => Math.min(b.x, W - b.x, b.y, H - b.y);
    if (me.state) return -1000 + (opp.state ? 0 : -edge(opp));
    if (opp.state) return 1000 + Math.min(edge(me), 200);
    return -edge(opp) * 1.5 + Math.min(edge(me), 160);
  }

  function aiPlan() {
    const cfg = DIFF[game.diff], me = game.bodies[1], opp = game.bodies[0];
    const results = [];
    const [ox0, oy0, ox1, oy1] = segOf(opp);
    for (let i = 0; i < cfg.samples; i++) {
      const t = rand(-0.85, 0.85);
      const base = shotFor(me, t, 0, 1);
      let ang;
      if (Math.random() < 0.82) {
        const u = Math.random();
        ang = Math.atan2(oy0 + (oy1 - oy0) * u - base.gy, ox0 + (ox1 - ox0) * u - base.gx) + rand(-0.3, 0.3);
      } else ang = rand(0, TAU);
      const shot = shotFor(me, t, ang, rand(0.35, 1));
      results.push({ shot, score: evalShot(shot) });
    }
    results.sort((a, b) => b.score - a.score);
    const pick = results[Math.floor(Math.random() * Math.min(cfg.top, results.length))].shot;
    pick.ang += gauss() * cfg.noise;
    pick.power = clamp(pick.power + gauss() * cfg.noise * 0.7, 0.15, 1);
    return pick;
  }

  // ---------- input ----------
  function pointerWorld(e) { const r = canvas.getBoundingClientRect(); return toWorld(e.clientX - r.left, e.clientY - r.top); }

  canvas.addEventListener('pointerdown', e => {
    Sfx.ensure();
    if (game.state !== 'aim' || isCpu(game.current)) return;
    const [wx, wy] = pointerWorld(e);
    const b = game.bodies[game.current];
    const [cx, cy] = closestOnSeg(b, wx, wy);
    if (Math.hypot(cx - wx, cy - wy) > b.r + 30 / Math.max(0.6, scale)) return;
    canvas.setPointerCapture(e.pointerId);
    game.drag = { id: e.pointerId, gx: cx, gy: cy };
    game.aim = { gx: cx, gy: cy, dx: 0, dy: 0 };
  });
  canvas.addEventListener('pointermove', e => {
    const [wx, wy] = pointerWorld(e);
    if (game.drag && e.pointerId === game.drag.id) {
      let dx = game.drag.gx - wx, dy = game.drag.gy - wy;
      const len = Math.hypot(dx, dy);
      if (len > MAX_DRAG) { dx *= MAX_DRAG / len; dy *= MAX_DRAG / len; }
      game.aim = { gx: game.drag.gx, gy: game.drag.gy, dx, dy };
      return;
    }
    let cursor = 'default';
    if (game.state === 'aim' && !isCpu(game.current)) {
      const b = game.bodies[game.current];
      const [cx, cy] = closestOnSeg(b, wx, wy);
      if (Math.hypot(cx - wx, cy - wy) < b.r + 30 / Math.max(0.6, scale)) cursor = 'grab';
    }
    canvas.style.cursor = cursor;
  });
  const release = e => {
    if (!game.drag || e.pointerId !== game.drag.id) return;
    const a = game.aim, len = Math.hypot(a.dx, a.dy);
    game.drag = null;
    if (len < 10 || game.state !== 'aim') { game.aim = null; return; }
    doFlick(game.bodies[game.current], a.gx, a.gy, a.dx / len, a.dy / len, len / MAX_DRAG);
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', e => { if (game.drag && e.pointerId === game.drag.id) { game.drag = null; game.aim = null; } });

  addEventListener('keydown', e => {
    if (e.key === 'Escape' || e.key === 'p') game.state === 'paused' ? resume() : pause();
    else if (e.key === 'm') toggleSound();
    else if (e.key === 'Enter' || e.key === ' ') {
      if ($('#roundOv').classList.contains('show')) $('#btnNext').click();
      else if ($('#matchOv').classList.contains('show')) $('#btnRematch').click();
      else if ($('#menu').classList.contains('show')) $('#btnStart').click();
    }
  });

  // ---------- HUD / menu ----------
  function banner(text, color) {
    const el = $('#banner');
    el.textContent = text; el.style.color = color;
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  }
  function setTurnText(text, color) { const t = $('#turn'); t.textContent = text; t.style.color = color; t.style.borderColor = color + '66'; }

  function refreshHud() {
    for (let i = 0; i < 2; i++) {
      const card = $('#pc' + i);
      card.querySelector('.pname').textContent = pname(i);
      card.querySelector('.pen-name').textContent = PENS[game.picks[i]].name;
      card.classList.toggle('active', game.current === i && ['aim', 'ai', 'wait'].includes(game.state));
      const pips = card.querySelector('.pips');
      pips.innerHTML = '';
      for (let k = 0; k < need(); k++) {
        const p = document.createElement('div');
        p.className = 'pip' + (k < game.scores[i] ? ' on' : '');
        pips.appendChild(p);
      }
      drawPreview(card.querySelector('.mini'), PENS[game.picks[i]]);
    }
  }

  const maxSpeed = Math.max(...PENS.map(p => p.pow / p.m));
  function buildMenu() {
    for (let i = 0; i < 2; i++) {
      const box = $('#pens' + i);
      box.innerHTML = '';
      PENS.forEach((def, idx) => {
        const card = document.createElement('button');
        card.className = 'pen-card' + (game.picks[i] === idx ? ' sel' : '');
        card.innerHTML = `<canvas></canvas><div class="nm">${def.name}</div>
          <div class="stat">Speed<div class="bar"><i style="width:${def.pow / def.m / maxSpeed * 100}%"></i></div></div>
          <div class="stat">Weight<div class="bar"><i style="width:${def.m / 1.6 * 100}%"></i></div></div>
          <div class="stat">Reach<div class="bar"><i style="width:${def.len / 270 * 100}%"></i></div></div>`;
        card.addEventListener('click', () => { Sfx.ensure(); Sfx.click(); game.picks[i] = idx; buildMenu(); setupBodies(); });
        box.appendChild(card);
        requestAnimationFrame(() => drawPreview(card.querySelector('canvas'), def));
      });
      $('#desc' + i).textContent = PENS[game.picks[i]].desc;
    }
    $('#pickLabel0').textContent = game.mode === 'cpu' ? 'Your pen' : 'Player 1 — pick your pen';
    $('#pickLabel1').textContent = game.mode === 'cpu' ? "CPU's pen" : 'Player 2 — pick your pen';
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
      if (key === 'bestOf') game.bestOf = +v;
      else if (key === 'items') { game.items = v === '1'; setupBodies(); }
      else game[key] = v;
      buildMenu();
    });
  });

  function toggleSound() { Sfx.ensure(); const m = Sfx.toggle(); $('#btnSound').classList.toggle('muted', m); }
  $('#btnSound').classList.toggle('muted', Sfx.muted);
  $('#btnSound').addEventListener('click', toggleSound);
  $('#btnPause').addEventListener('click', () => { Sfx.click(); pause(); });
  $('#btnStart').addEventListener('click', () => { Sfx.ensure(); Sfx.click(); startMatch(); });
  $('#btnNext').addEventListener('click', () => { Sfx.click(); game.round++; startRound(); });
  $('#btnRematch').addEventListener('click', () => { Sfx.click(); startMatch(); });
  $('#btnMenu').addEventListener('click', () => { Sfx.click(); showMenu(); });
  $('#btnResume').addEventListener('click', () => { Sfx.click(); resume(); });
  $('#btnRestart').addEventListener('click', () => { Sfx.click(); startRound(); });
  $('#btnQuit').addEventListener('click', () => { Sfx.click(); showMenu(); });

  // ---------- render ----------
  function drawBackground(now) {
    const g = ctx.createRadialGradient(cw / 2, ch * 0.45, 50, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
    g.addColorStop(0, '#1d2347'); g.addColorStop(0.6, '#0f1330'); g.addColorStop(1, '#070915');
    ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
    // floating ambient glows
    for (let i = 0; i < 3; i++) {
      const x = cw * (0.2 + 0.3 * i) + Math.sin(now / 4000 + i * 2) * 60, y = ch * (0.3 + 0.25 * (i % 2)) + Math.cos(now / 5000 + i) * 40;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, 260);
      rg.addColorStop(0, ['rgba(56,189,248,.10)', 'rgba(244,114,182,.09)', 'rgba(250,204,21,.07)'][i]);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg; ctx.fillRect(x - 260, y - 260, 520, 520);
    }
  }

  function drawDesk() {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 50 * scale * dpr; ctx.shadowOffsetY = 20 * scale * dpr;
    ctx.fillStyle = '#5b3416'; rrect(ctx, -2, -2, W + 4, H + 22, 14); ctx.fill();
    ctx.restore();
    // front edge for depth
    const eg = ctx.createLinearGradient(0, H, 0, H + 20);
    eg.addColorStop(0, '#7a4a22'); eg.addColorStop(1, '#3d2210');
    ctx.fillStyle = eg; rrect(ctx, 0, H - 10, W, 30, 12); ctx.fill();
    ctx.save(); rrect(ctx, 0, 0, W, H, 12); ctx.clip();
    ctx.drawImage(desk, 0, 0, W, H);
    ctx.restore();
  }

  function drawShadow(b) {
    ctx.save(); ctx.translate(b.x + 5, b.y + 8); ctx.rotate(b.a);
    ctx.fillStyle = 'rgba(40,15,0,.16)'; capsulePath(ctx, -b.h, b.h, b.r + 5); ctx.fill();
    ctx.fillStyle = 'rgba(40,15,0,.26)'; capsulePath(ctx, -b.h, b.h, b.r + 1); ctx.fill();
    ctx.restore();
  }

  function drawBody(b, now) {
    ctx.save();
    ctx.translate(b.x, b.y); ctx.rotate(b.a);
    if (b.state === 1) {
      const t = b.fallT / FALL_TIME;
      const sc = 1 - 0.45 * t;
      ctx.scale(sc, sc); ctx.globalAlpha = 1 - t * t;
      ctx.rotate(t * 0.4);
    }
    if (b.owner >= 0 && b.state === 0) {
      const myTurn = game.current === b.owner && (game.state === 'aim' || game.state === 'ai');
      const pulse = myTurn ? 0.55 + 0.45 * Math.sin(now / 220) : 0;
      ctx.save();
      ctx.strokeStyle = P_COLORS[b.owner];
      ctx.globalAlpha *= myTurn ? 0.5 + pulse * 0.5 : 0.35;
      ctx.lineWidth = myTurn ? 3 + pulse * 2 : 2;
      ctx.shadowColor = P_COLORS[b.owner]; ctx.shadowBlur = (myTurn ? 18 : 8) * scale * dpr;
      capsulePath(ctx, -b.h, b.h, b.r + 6 + pulse * 2); ctx.stroke();
      ctx.restore();
    }
    drawPen(ctx, b.def);
    ctx.restore();
  }

  function drawAim(a, b, now) {
    const len = Math.hypot(a.dx, a.dy);
    if (len < 2) return;
    const p = len / MAX_DRAG, ux = a.dx / len, uy = a.dy / len;
    const col = `hsl(${120 - p * 120},95%,60%)`;
    // guide dots along the travel direction
    const v = p * VMAX * b.def.pow / b.m;
    const dist = Math.min(620, v * v / (2 * MU * b.fric)) * 0.5;
    ctx.fillStyle = col;
    for (let d = 30; d < dist; d += 18) {
      ctx.globalAlpha = (1 - d / dist) * 0.7;
      ctx.beginPath(); ctx.arc(b.x + ux * d, b.y + uy * d, 3.2, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // rubber band back to the finger
    const fx = a.gx - a.dx, fy = a.gy - a.dy;
    ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -now / 30;
    ctx.beginPath(); ctx.moveTo(a.gx, a.gy); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(fx, fy, 12, 0, TAU); ctx.fill(); ctx.stroke();
    // flick arrow
    const al = 34 + p * 110, ex = a.gx + ux * al, ey = a.gy + uy * al;
    ctx.save();
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 6 + p * 3; ctx.lineCap = 'round';
    ctx.shadowColor = col; ctx.shadowBlur = 14 * scale * dpr;
    ctx.beginPath(); ctx.moveTo(a.gx, a.gy); ctx.lineTo(ex - ux * 10, ey - uy * 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex + ux * 8, ey + uy * 8);
    ctx.lineTo(ex - ux * 14 - uy * 13, ey - uy * 14 + ux * 13);
    ctx.lineTo(ex - ux * 14 + uy * 13, ey - uy * 14 - ux * 13); ctx.closePath(); ctx.fill();
    ctx.restore();
    // grab point
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(a.gx, a.gy, 5, 0, TAU); ctx.fill();
    // spin hint ring around the pen centre
    const torque = ((a.gx - b.x) * uy - (a.gy - b.y) * ux) / b.h;
    if (Math.abs(torque) > 0.25) {
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2.5;
      const r0 = 26, dir = Math.sign(torque), st = now / 300 * dir;
      ctx.beginPath(); ctx.arc(b.x, b.y, r0, st, st + dir * 2.2, dir < 0); ctx.stroke();
      const ea = st + dir * 2.2, hx = b.x + Math.cos(ea) * r0, hy = b.y + Math.sin(ea) * r0;
      const tx = -Math.sin(ea) * dir, ty = Math.cos(ea) * dir;
      ctx.beginPath(); ctx.moveTo(hx + tx * 7, hy + ty * 7); ctx.lineTo(hx - tx * 3 - ty * 6, hy - ty * 3 + tx * 6); ctx.lineTo(hx - tx * 3 + ty * 6, hy - ty * 3 - tx * 6);
      ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fill();
    }
    return [fx, fy, p, col];
  }

  function render(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground(now);
    const shx = (Math.random() - 0.5) * game.shake * scale * 2, shy = (Math.random() - 0.5) * game.shake * scale * 2;
    ctx.translate(shx, shy);
    ctx.transform(M.a, M.b, M.c, M.d, M.e, M.f);

    // pens dropping below the desk are drawn underneath it
    for (const b of game.bodies) if (b.state === 1 && b.fallT > 0.15) drawBody(b, now);
    drawDesk();
    for (const b of game.bodies) if (b.state === 0) drawShadow(b);
    for (const b of game.bodies) if (b.owner < 0 && (b.state === 0 || (b.state === 1 && b.fallT <= 0.15))) drawBody(b, now);
    for (const b of game.bodies) if (b.owner >= 0 && (b.state === 0 || (b.state === 1 && b.fallT <= 0.15))) drawBody(b, now);

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    let aimInfo = null;
    if (game.aim && game.state !== 'moving') aimInfo = drawAim(game.aim, game.bodies[game.current], now);

    // screen-space text
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (aimInfo) {
      const [sx, sy] = toScreen(aimInfo[0], aimInfo[1]);
      ctx.font = '700 16px Fredoka, sans-serif';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.fillStyle = aimInfo[3];
      const txt = Math.round(aimInfo[2] * 100) + '%';
      ctx.strokeText(txt, sx, sy - 26); ctx.fillText(txt, sx, sy - 26);
    }
    for (const p of popups) {
      const [sx, sy] = toScreen(p.x, p.y);
      const t = p.t, k = t < 0.15 ? t / 0.15 : 1;
      const size = (22 + 18 * p.size) * (0.6 + 0.4 * k) * Math.max(0.7, Math.min(1.2, scale * 1.4));
      ctx.save();
      ctx.globalAlpha = t > 0.8 ? Math.max(0, 1 - (t - 0.8) / 0.4) : 1;
      ctx.translate(sx, sy - t * 50); ctx.rotate(-0.08);
      ctx.font = `700 ${size}px Fredoka, sans-serif`;
      ctx.lineWidth = size * 0.18; ctx.strokeStyle = '#1a1030'; ctx.lineJoin = 'round';
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
        if (game.settleT > 0.25 || game.moveT > 12) resolve();
      }
      if (game.state === 'ai' && game.ai) {
        const ai = game.ai, me = game.bodies[1];
        ai.t += dt;
        const k = Math.min(1, ai.t / 0.75), e = 1 - (1 - k) * (1 - k);
        const L = ai.shot.power * MAX_DRAG * e;
        game.aim = { gx: ai.shot.gx, gy: ai.shot.gy, dx: Math.cos(ai.shot.ang) * L, dy: Math.sin(ai.shot.ang) * L };
        if (ai.t > 1.05) {
          game.ai = null;
          doFlick(me, ai.shot.gx, ai.shot.gy, Math.cos(ai.shot.ang), Math.sin(ai.shot.ang), ai.shot.power);
        }
      }
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
  resize();
  showMenu();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { resize(); buildMenu(); });
  requestAnimationFrame(frame);
})();
