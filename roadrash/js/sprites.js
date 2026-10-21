'use strict';
/* ---------- Procedural sprites: everything is drawn in code, then cached ---------- */
const Sprites = (() => {
  const cache = new Map();
  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return { c, g: c.getContext('2d') };
  }
  function cached(key, fn) {
    let s = cache.get(key);
    if (!s) { s = fn(); cache.set(key, s); }
    return s;
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function ellipse(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }
  function lin(g, x0, y0, x1, y1, stops) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    stops.forEach((s, i) => gr.addColorStop(i / (stops.length - 1), s));
    return gr;
  }
  const chrome = g => (x0, x1) => lin(g, x0, 0, x1, 0, ['#475569', '#f8fafc', '#94a3b8', '#334155']);

  /* ----- weapon held at hand (hx,hy), pointing to side s ----- */
  function drawWeapon(g, weapon, hx, hy, s) {
    g.save(); g.lineCap = 'round';
    if (weapon === 'club') {
      g.strokeStyle = '#7c4a1e'; g.lineWidth = 11;
      g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + s * 44, hy - 40); g.stroke();
      g.strokeStyle = '#a16207'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(hx + s * 6, hy - 8); g.lineTo(hx + s * 42, hy - 40); g.stroke();
    } else if (weapon === 'chain') {
      g.strokeStyle = '#cbd5e1'; g.lineWidth = 3;
      for (let i = 1; i <= 9; i++) {
        const t = i / 9, x = hx + s * 58 * t, y = hy - 22 * t + Math.sin(t * Math.PI) * 14;
        g.beginPath(); g.ellipse(x, y, 5, 3.4, i % 2 ? 0.6 : -0.6, 0, Math.PI * 2); g.stroke();
      }
    } else if (weapon === 'baton') {
      g.strokeStyle = '#0b0b0b'; g.lineWidth = 9;
      g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + s * 40, hy - 30); g.stroke();
      g.strokeStyle = '#475569'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(hx + s * 8, hy - 9); g.lineTo(hx + s * 38, hy - 30); g.stroke();
    }
    g.restore();
  }

  /* ----- rider + bike seen from behind. 200x260, origin bottom-centre ----- */
  function rider(spec) {
    const key = `r|${spec.jacket}|${spec.helmet}|${spec.bike}|${spec.pose}|${spec.weapon}|${spec.cop ? spec.flash : '-'}|${spec.nitro ? 1 : 0}`;
    return cached(key, () => {
      const W = 200, H = 260, { c, g } = mk(W, H), cx = 100;
      const ch = chrome(g);
      // shadow
      g.fillStyle = 'rgba(0,0,0,0.38)'; ellipse(g, cx, 252, 70, 9); g.fill();
      // exhausts
      for (const s of [-1, 1]) {
        g.fillStyle = ch(cx + s * 46 - 13, cx + s * 46 + 13);
        rr(g, cx + s * 46 - 13, 194, 26, 18, 8); g.fill();
        g.fillStyle = '#111827'; ellipse(g, cx + s * 46, 203, 7, 6); g.fill();
        if (spec.nitro) { g.fillStyle = 'rgba(56,189,248,0.9)'; ellipse(g, cx + s * 46, 203, 4, 3); g.fill(); }
      }
      // rear tyre
      g.fillStyle = lin(g, cx - 18, 0, cx + 18, 0, ['#030303', '#2a2a2a', '#3a3a3a', '#2a2a2a', '#030303']);
      rr(g, cx - 18, 184, 36, 70, 13); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 2;
      for (let y = 192; y < 250; y += 8) { g.beginPath(); g.moveTo(cx - 12, y); g.lineTo(cx + 12, y + 3); g.stroke(); }
      // legs
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const s of [-1, 1]) {
        g.strokeStyle = spec.cop ? '#0f172a' : '#1e293b'; g.lineWidth = 21;
        g.beginPath(); g.moveTo(cx + s * 20, 148); g.lineTo(cx + s * 50, 170); g.lineTo(cx + s * 54, 208); g.stroke();
        g.fillStyle = '#0a0a0a'; rr(g, cx + s * 54 - 13, 200, 26, 22, 6); g.fill();
      }
      // tail / fender
      g.fillStyle = lin(g, 0, 150, 0, 205, [U.shade(spec.bike, 0.35), spec.bike, U.shade(spec.bike, -0.45)]);
      g.beginPath(); g.moveTo(cx - 40, 196); g.quadraticCurveTo(cx, 208, cx + 40, 196);
      g.lineTo(cx + 30, 158); g.quadraticCurveTo(cx, 148, cx - 30, 158); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(cx - 28, 162); g.quadraticCurveTo(cx, 153, cx + 28, 162); g.stroke();
      // tail light
      g.save(); g.shadowColor = '#ff2020'; g.shadowBlur = 14;
      g.fillStyle = '#ff3b3b'; rr(g, cx - 18, 172, 36, 9, 4); g.fill(); g.restore();
      g.fillStyle = '#ffd5d5'; rr(g, cx - 12, 174, 24, 3, 1.5); g.fill();
      // plate
      g.fillStyle = '#f1f5f9'; rr(g, cx - 12, 185, 24, 11, 2); g.fill();
      g.fillStyle = '#334155'; g.font = 'bold 8px sans-serif'; g.textAlign = 'center'; g.fillText(spec.cop ? 'PD' : 'RR', cx, 194);
      if (spec.cop) {
        for (const s of [-1, 1]) {
          const on = (s === -1) === (spec.flash === 0);
          g.save(); g.shadowColor = s < 0 ? '#ef4444' : '#3b82f6'; g.shadowBlur = on ? 24 : 4;
          g.fillStyle = s < 0 ? (on ? '#ff6b6b' : '#7f1d1d') : (on ? '#7db4ff' : '#1e3a8a');
          ellipse(g, cx + s * 30, 166, 9, 7); g.fill(); g.restore();
        }
      }
      // handlebar + mirrors
      g.strokeStyle = '#111'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(cx - 76, 126); g.lineTo(cx + 76, 126); g.stroke();
      for (const s of [-1, 1]) {
        g.lineWidth = 3; g.beginPath(); g.moveTo(cx + s * 64, 126); g.lineTo(cx + s * 80, 104); g.stroke();
        g.fillStyle = ch(cx + s * 80 - 10, cx + s * 80 + 10); ellipse(g, cx + s * 80, 102, 10, 7); g.fill();
      }
      // torso
      const jk = spec.jacket;
      g.fillStyle = lin(g, cx - 40, 0, cx + 40, 0, [U.shade(jk, -0.35), U.shade(jk, 0.15), jk, U.shade(jk, -0.4)]);
      g.beginPath(); g.moveTo(cx - 40, 98); g.quadraticCurveTo(cx, 80, cx + 40, 98);
      g.lineTo(cx + 27, 156); g.quadraticCurveTo(cx, 164, cx - 27, 156); g.closePath(); g.fill();
      if (spec.cop) {
        g.fillStyle = '#facc15'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.fillText('POLICE', cx, 124);
        g.fillStyle = 'rgba(250,204,21,0.8)'; g.fillRect(cx - 30, 140, 60, 4);
      } else {
        g.fillStyle = 'rgba(255,255,255,0.22)';
        g.fillRect(cx - 9, 92, 5, 64); g.fillRect(cx + 4, 92, 5, 64);
      }
      // arms
      const arm = (s, attacking) => {
        g.strokeStyle = U.shade(jk, -0.15); g.lineWidth = 16;
        g.beginPath(); g.moveTo(cx + s * 32, 102);
        let hx, hy;
        if (attacking) { g.lineTo(cx + s * 66, 84); hx = cx + s * 94; hy = 76; }
        else { g.lineTo(cx + s * 54, 116); hx = cx + s * 68; hy = 126; }
        g.lineTo(hx, hy); g.stroke();
        if (attacking) drawWeapon(g, spec.weapon, hx, hy, s);
        g.fillStyle = '#0a0a0a'; ellipse(g, hx, hy, attacking && spec.weapon === 'fist' ? 10 : 8, attacking && spec.weapon === 'fist' ? 10 : 8); g.fill();
      };
      arm(-1, spec.pose === 'L'); arm(1, spec.pose === 'R');
      // neck + helmet
      g.fillStyle = '#111'; g.fillRect(cx - 10, 74, 20, 18);
      const hm = spec.helmet;
      const hg = g.createRadialGradient(cx - 9, 50, 3, cx, 62, 30);
      hg.addColorStop(0, U.shade(hm, 0.6)); hg.addColorStop(0.5, hm); hg.addColorStop(1, U.shade(hm, -0.45));
      g.fillStyle = hg; ellipse(g, cx, 62, 27, 29); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - 4, 34, 8, 54);
      g.fillStyle = 'rgba(255,255,255,0.5)'; ellipse(g, cx - 10, 48, 7, 4); g.fill();
      return { c, w: W, h: H };
    });
  }

  /* ----- rider fallen + bike on its side ----- */
  function crashed(spec) {
    return cached(`x|${spec.jacket}|${spec.helmet}|${spec.bike}`, () => {
      const W = 260, H = 120, { c, g } = mk(W, H);
      g.fillStyle = 'rgba(0,0,0,0.35)'; ellipse(g, 130, 112, 120, 9); g.fill();
      for (const x of [62, 196]) {
        g.fillStyle = '#0a0a0a'; ellipse(g, x, 92, 16, 26); g.fill();
        g.fillStyle = '#64748b'; ellipse(g, x, 92, 6, 12); g.fill();
      }
      g.fillStyle = lin(g, 0, 60, 0, 110, [U.shade(spec.bike, 0.3), spec.bike, U.shade(spec.bike, -0.5)]);
      g.beginPath(); g.moveTo(50, 84); g.lineTo(110, 64); g.lineTo(200, 70); g.lineTo(214, 96); g.lineTo(80, 110); g.closePath(); g.fill();
      g.fillStyle = '#111'; g.fillRect(96, 70, 60, 8);
      g.strokeStyle = '#1e293b'; g.lineWidth = 14; g.lineCap = 'round';
      g.beginPath(); g.moveTo(150, 50); g.lineTo(186, 40); g.lineTo(214, 52); g.stroke();
      g.fillStyle = spec.jacket; ellipse(g, 128, 44, 30, 15); g.fill();
      g.strokeStyle = spec.jacket; g.lineWidth = 11;
      g.beginPath(); g.moveTo(108, 40); g.lineTo(88, 24); g.stroke();
      g.fillStyle = spec.helmet; ellipse(g, 90, 46, 17, 16); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.4)'; ellipse(g, 84, 40, 5, 3); g.fill();
      return { c, w: W, h: H };
    });
  }

  /* ----- cars: rear view (same direction) or front view (oncoming) ----- */
  const CAR_DIM = { sedan: [300, 190], sport: [300, 160], van: [300, 250], truck: [340, 330] };
  function car(type, color, front) {
    return cached(`c|${type}|${color}|${front ? 1 : 0}`, () => {
      const [W, H] = CAR_DIM[type], { c, g } = mk(W, H), cx = W / 2;
      g.fillStyle = 'rgba(0,0,0,0.4)'; ellipse(g, cx, H - 6, W * 0.5, 10); g.fill();
      // tyres
      g.fillStyle = '#050505';
      rr(g, 18, H - 46, 46, 42, 8); g.fill(); rr(g, W - 64, H - 46, 46, 42, 8); g.fill();
      if (type === 'truck' && !front) {
        // cargo box
        g.fillStyle = lin(g, 0, 0, W, 0, ['#cbd5e1', '#f8fafc', '#e2e8f0', '#94a3b8']);
        rr(g, 6, 10, W - 12, H - 60, 6); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(cx, 16); g.lineTo(cx, H - 56); g.stroke();
        g.fillStyle = color; g.fillRect(14, H - 120, W - 28, 16);
        g.fillStyle = '#1f2937'; g.fillRect(6, H - 62, W - 12, 18);
        g.save(); g.shadowColor = '#ff2020'; g.shadowBlur = 12; g.fillStyle = '#ff3b3b';
        g.fillRect(14, H - 58, 30, 10); g.fillRect(W - 44, H - 58, 30, 10); g.restore();
        return { c, w: W, h: H };
      }
      const bodyTop = type === 'van' ? 30 : type === 'truck' ? 120 : type === 'sport' ? 70 : 64;
      const roofTop = type === 'van' ? 18 : type === 'truck' ? 34 : type === 'sport' ? 46 : 22;
      // cabin
      g.fillStyle = U.shade(color, -0.2);
      g.beginPath();
      const inset = type === 'van' ? 18 : type === 'truck' ? 40 : 52;
      g.moveTo(inset, bodyTop + 30); g.lineTo(inset + 22, roofTop); g.lineTo(W - inset - 22, roofTop); g.lineTo(W - inset, bodyTop + 30); g.closePath(); g.fill();
      // glass
      g.fillStyle = front ? lin(g, 0, roofTop, 0, bodyTop + 26, ['#93c5fd', '#1e3a8a', '#0f172a']) : lin(g, 0, roofTop, 0, bodyTop + 26, ['#334155', '#0f172a']);
      g.beginPath();
      g.moveTo(inset + 12, bodyTop + 24); g.lineTo(inset + 28, roofTop + 8); g.lineTo(W - inset - 28, roofTop + 8); g.lineTo(W - inset - 12, bodyTop + 24); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.beginPath(); g.moveTo(inset + 40, bodyTop + 24); g.lineTo(inset + 60, roofTop + 8); g.lineTo(inset + 80, roofTop + 8); g.lineTo(inset + 60, bodyTop + 24); g.fill();
      // body
      g.fillStyle = lin(g, 0, bodyTop + 20, 0, H - 30, [U.shade(color, 0.35), color, U.shade(color, -0.4)]);
      rr(g, 8, bodyTop + 22, W - 16, H - bodyTop - 50, 16); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(18, bodyTop + 28, W - 36, 4);
      // bumper
      g.fillStyle = '#1f2937'; rr(g, 12, H - 44, W - 24, 14, 6); g.fill();
      // plate
      g.fillStyle = '#f8fafc'; rr(g, cx - 26, H - 70, 52, 18, 3); g.fill();
      g.fillStyle = '#1e293b'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.fillText(front ? '' : 'RASH', cx, H - 57);
      // lights
      const ly = H - 82;
      g.save();
      if (front) {
        g.shadowColor = '#fff7cc'; g.shadowBlur = 18; g.fillStyle = '#fffbe6';
        rr(g, 20, ly, 56, 18, 8); g.fill(); rr(g, W - 76, ly, 56, 18, 8); g.fill();
        g.shadowBlur = 0; g.fillStyle = '#0f172a'; rr(g, cx - 50, ly + 2, 100, 16, 4); g.fill();
        g.strokeStyle = '#475569'; g.lineWidth = 2;
        for (let x = cx - 44; x < cx + 50; x += 10) { g.beginPath(); g.moveTo(x, ly + 4); g.lineTo(x, ly + 16); g.stroke(); }
      } else {
        g.shadowColor = '#ff2020'; g.shadowBlur = 16; g.fillStyle = '#ff3030';
        rr(g, 18, ly, 52, 14, 5); g.fill(); rr(g, W - 70, ly, 52, 14, 5); g.fill();
        g.shadowBlur = 0; g.fillStyle = '#fecaca'; g.fillRect(24, ly + 3, 18, 4); g.fillRect(W - 64, ly + 3, 18, 4);
      }
      g.restore();
      return { c, w: W, h: H };
    });
  }

  /* ----- roadside scenery ----- */
  const SCENERY = {
    palm: { w: 1300, collide: true }, pine: { w: 1000, collide: true }, snowpine: { w: 1000, collide: true },
    oak: { w: 1400, collide: true }, cactus: { w: 520, collide: true }, rock: { w: 900, collide: true },
    bush: { w: 700, collide: false }, billboard: { w: 1900, collide: true }, lamp: { w: 420, collide: true },
    building: { w: 3000, collide: true }, sign: { w: 420, collide: true }, post: { w: 140, collide: false },
  };
  const BILLBOARDS = [
    ['NEON BALL', 'smash every brick', '#7c3aed', '#22d3ee'], ['RIDE OR DIE', 'est. 1991', '#111827', '#f97316'],
    ['GAS & GRUB', 'next exit · 2 mi', '#b91c1c', '#fde047'], ['ROAD RASH', 'no rules · no brakes', '#0f172a', '#ef4444'],
    ['MOTEL 66', 'vacancy', '#0e7490', '#f0abfc'], ['SURF SHACK', 'boards & tacos', '#0369a1', '#fde68a'],
  ];
  function scenery(kind, variant, night) {
    return cached(`s|${kind}|${variant}|${night ? 1 : 0}`, () => {
      const r = U.rng(variant * 7919 + kind.length * 31);
      let W = 240, H = 300;
      const sizes = { palm: [260, 460], pine: [220, 400], snowpine: [220, 400], oak: [300, 320], cactus: [140, 240], rock: [240, 140], bush: [200, 110], billboard: [420, 300], lamp: [120, 460], building: [400, 640], sign: [120, 150], post: [24, 80] };
      [W, H] = sizes[kind];
      const { c, g } = mk(W, H), cx = W / 2;
      g.lineCap = 'round'; g.lineJoin = 'round';
      if (kind === 'palm') {
        const lean = (r() - 0.5) * 60;
        g.strokeStyle = '#7c5a3a'; g.lineWidth = 16;
        g.beginPath(); g.moveTo(cx, H); g.quadraticCurveTo(cx + lean * 0.2, H * 0.5, cx + lean, 90); g.stroke();
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
        for (let i = 0; i < 18; i++) {
          const t = i / 18, x = U.lerp(cx, cx + lean, t * t), y = U.lerp(H, 90, t);
          g.beginPath(); g.moveTo(x - 8, y); g.lineTo(x + 8, y - 4); g.stroke();
        }
        const tx = cx + lean, ty = 90;
        for (let i = 0; i < 9; i++) {
          const a = -Math.PI + (i / 8) * Math.PI + (r() - 0.5) * 0.3, len = 90 + r() * 30;
          const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.5 + 40;
          g.strokeStyle = i % 2 ? '#15803d' : '#166534'; g.lineWidth = 12;
          g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo((tx + ex) / 2, ty + Math.sin(a) * len * 0.4 - 20, ex, ey); g.stroke();
        }
        g.fillStyle = '#5b3a1e'; ellipse(g, tx, ty + 6, 14, 10); g.fill();
      } else if (kind === 'pine' || kind === 'snowpine') {
        g.fillStyle = '#4a2f1b'; g.fillRect(cx - 12, H - 70, 24, 70);
        const greens = ['#14532d', '#166534', '#15803d'];
        for (let i = 0; i < 5; i++) {
          const y = H - 60 - i * 62, w = 105 - i * 17;
          g.fillStyle = greens[i % 3];
          g.beginPath(); g.moveTo(cx - w, y); g.lineTo(cx, y - 110); g.lineTo(cx + w, y); g.closePath(); g.fill();
          g.fillStyle = 'rgba(0,0,0,0.18)';
          g.beginPath(); g.moveTo(cx, y - 110); g.lineTo(cx + w, y); g.lineTo(cx + w * 0.3, y); g.closePath(); g.fill();
          if (kind === 'snowpine') {
            g.fillStyle = '#f8fafc';
            g.beginPath(); g.moveTo(cx - w * 0.55, y - 46); g.lineTo(cx, y - 110); g.lineTo(cx + w * 0.55, y - 46);
            g.quadraticCurveTo(cx, y - 60, cx - w * 0.55, y - 46); g.fill();
          }
        }
      } else if (kind === 'oak') {
        g.fillStyle = '#5b3a1e'; g.beginPath(); g.moveTo(cx - 16, H); g.lineTo(cx - 8, H - 130); g.lineTo(cx + 8, H - 130); g.lineTo(cx + 16, H); g.fill();
        const blobs = [[0, -190, 90], [-70, -160, 70], [70, -160, 72], [-40, -230, 64], [45, -230, 66], [0, -130, 70]];
        blobs.forEach(([x, y, rad], i) => {
          const gr = g.createRadialGradient(cx + x - 20, H + y - 20, 5, cx + x, H + y, rad);
          gr.addColorStop(0, '#4ade80'); gr.addColorStop(0.6, i % 2 ? '#16a34a' : '#15803d'); gr.addColorStop(1, '#14532d');
          g.fillStyle = gr; ellipse(g, cx + x, H + y, rad, rad * 0.85); g.fill();
        });
      } else if (kind === 'cactus') {
        const col = '#3f8f3a';
        g.strokeStyle = col; g.lineWidth = 34;
        g.beginPath(); g.moveTo(cx, H - 4); g.lineTo(cx, 30); g.stroke();
        g.lineWidth = 22;
        g.beginPath(); g.moveTo(cx - 10, H - 100); g.lineTo(cx - 46, H - 100); g.lineTo(cx - 46, 70 + r() * 30); g.stroke();
        g.beginPath(); g.moveTo(cx + 10, H - 130); g.lineTo(cx + 44, H - 130); g.lineTo(cx + 44, 90 + r() * 30); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(cx - 6, H - 10); g.lineTo(cx - 6, 34); g.stroke();
      } else if (kind === 'rock') {
        const base = night ? '#3f3f46' : ['#78716c', '#a8a29e', '#9a6b4f'][variant % 3];
        g.fillStyle = lin(g, 0, 0, W, H, [U.shade(base, 0.3), base, U.shade(base, -0.4)]);
        g.beginPath(); g.moveTo(10, H);
        const pts = 7;
        for (let i = 0; i <= pts; i++) g.lineTo(10 + (W - 20) * i / pts, H - 40 - r() * (H - 50) * Math.sin(Math.PI * (i / pts) + 0.2));
        g.lineTo(W - 10, H); g.closePath(); g.fill();
      } else if (kind === 'bush') {
        for (let i = 0; i < 6; i++) {
          const x = 30 + r() * (W - 60), y = H - 30 - r() * 40, rad = 26 + r() * 20;
          g.fillStyle = ['#166534', '#15803d', '#3f6212', '#4d7c0f'][i % 4];
          ellipse(g, x, y, rad, rad * 0.8); g.fill();
        }
      } else if (kind === 'billboard') {
        const [t1, t2, bg, fg] = BILLBOARDS[variant % BILLBOARDS.length];
        g.fillStyle = '#3f3f46'; g.fillRect(70, 150, 14, 150); g.fillRect(W - 84, 150, 14, 150);
        g.fillStyle = lin(g, 0, 0, 0, 170, [U.shade(bg, 0.25), bg]); rr(g, 6, 6, W - 12, 160, 6); g.fill();
        g.strokeStyle = '#e5e7eb'; g.lineWidth = 6; rr(g, 6, 6, W - 12, 160, 6); g.stroke();
        g.fillStyle = fg; g.textAlign = 'center'; g.font = '900 54px Impact, sans-serif'; g.fillText(t1, cx, 92);
        g.fillStyle = '#f8fafc'; g.font = '600 24px sans-serif'; g.fillText(t2.toUpperCase(), cx, 132);
        if (night) { g.fillStyle = 'rgba(255,255,220,0.12)'; g.fillRect(6, 6, W - 12, 160); }
      } else if (kind === 'lamp') {
        g.fillStyle = '#334155'; g.fillRect(cx - 5, 30, 10, H - 30);
        g.fillRect(cx - 50, 26, 55, 8);
        g.save(); g.shadowColor = '#fde68a'; g.shadowBlur = 30; g.fillStyle = '#fef9c3';
        rr(g, cx - 58, 30, 30, 10, 4); g.fill(); g.restore();
        const gl = g.createRadialGradient(cx - 43, 40, 2, cx - 43, 40, 60);
        gl.addColorStop(0, 'rgba(254,240,138,0.6)'); gl.addColorStop(1, 'rgba(254,240,138,0)');
        g.fillStyle = gl; ellipse(g, cx - 43, 40, 60, 60); g.fill();
      } else if (kind === 'building') {
        const hues = ['#1e1b4b', '#312e81', '#1f2937', '#3b0764', '#172554'];
        const bh = H - r() * 220, top = H - bh;
        g.fillStyle = lin(g, 0, 0, W, 0, [hues[variant % 5], U.shade(hues[variant % 5], 0.15), U.shade(hues[variant % 5], -0.3)]);
        g.fillRect(10, top, W - 20, bh);
        const lit = ['#fde047', '#f0abfc', '#67e8f9', '#fef3c7'];
        for (let y = top + 24; y < H - 40; y += 34) for (let x = 30; x < W - 40; x += 36) {
          g.fillStyle = r() < 0.55 ? lit[Math.floor(r() * 4)] : 'rgba(0,0,0,0.4)';
          g.globalAlpha = 0.6 + r() * 0.4; g.fillRect(x, y, 20, 18); g.globalAlpha = 1;
        }
        // neon sign
        const nc = ['#f472b6', '#22d3ee', '#a3e635', '#fb923c'][variant % 4];
        g.save(); g.shadowColor = nc; g.shadowBlur = 18; g.strokeStyle = nc; g.lineWidth = 5;
        rr(g, 50, H - 140, W - 100, 50, 10); g.stroke();
        g.fillStyle = nc; g.font = '900 30px sans-serif'; g.textAlign = 'center';
        g.fillText(['HOTEL', 'BAR', 'PIZZA', 'ARCADE', 'DINER'][variant % 5], cx, H - 104); g.restore();
      } else if (kind === 'sign') {
        g.fillStyle = '#52525b'; g.fillRect(cx - 4, 70, 8, H - 70);
        g.fillStyle = '#facc15'; rr(g, 6, 6, W - 12, 72, 6); g.fill();
        g.fillStyle = '#111'; g.save(); g.translate(cx, 42); if (variant) g.scale(-1, 1);
        for (const dx of [-24, 6]) { g.beginPath(); g.moveTo(dx, -22); g.lineTo(dx + 20, 0); g.lineTo(dx, 22); g.lineTo(dx + 10, 0); g.closePath(); g.fill(); }
        g.restore();
      } else if (kind === 'post') {
        g.fillStyle = '#f8fafc'; g.fillRect(4, 0, W - 8, H);
        g.fillStyle = '#ef4444'; g.fillRect(4, 8, W - 8, 10);
      }
      return { c, w: W, h: H, worldW: SCENERY[kind].w };
    });
  }

  /* ----- side view bike for the garage ----- */
  function bikeSide(bike) {
    return cached(`side|${bike.id}`, () => {
      const W = 380, H = 220, { c, g } = mk(W, H);
      g.fillStyle = 'rgba(0,0,0,0.35)'; ellipse(g, 190, 204, 160, 10); g.fill();
      const wheel = (x, y) => {
        g.fillStyle = '#0a0a0a'; ellipse(g, x, y, 48, 48); g.fill();
        g.strokeStyle = '#1f2937'; g.lineWidth = 3; ellipse(g, x, y, 42, 42); g.stroke();
        g.fillStyle = lin(g, x - 30, y - 30, x + 30, y + 30, ['#e2e8f0', '#64748b', '#cbd5e1']); ellipse(g, x, y, 30, 30); g.fill();
        g.fillStyle = '#111'; ellipse(g, x, y, 25, 25); g.fill();
        g.strokeStyle = bike.accent; g.lineWidth = 5;
        for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 26, y + Math.sin(a) * 26); g.stroke(); }
        g.fillStyle = '#94a3b8'; ellipse(g, x, y, 7, 7); g.fill();
        g.strokeStyle = '#64748b'; g.lineWidth = 2; ellipse(g, x + 6, y, 18, 18); g.stroke();
      };
      wheel(84, 154); wheel(300, 154);
      g.lineCap = 'round'; g.lineJoin = 'round';
      // swingarm + fork
      g.strokeStyle = '#334155'; g.lineWidth = 10; g.beginPath(); g.moveTo(84, 154); g.lineTo(170, 132); g.stroke();
      g.strokeStyle = '#cbd5e1'; g.lineWidth = 9; g.beginPath(); g.moveTo(300, 154); g.lineTo(266, 64); g.stroke();
      // exhaust
      g.fillStyle = lin(g, 0, 118, 0, 140, ['#f8fafc', '#94a3b8', '#475569']); rr(g, 60, 112, 90, 22, 10); g.fill();
      // engine block
      g.fillStyle = '#1f2937'; rr(g, 150, 108, 70, 52, 10); g.fill();
      g.strokeStyle = '#475569'; g.lineWidth = 3; for (let y = 116; y < 156; y += 8) { g.beginPath(); g.moveTo(156, y); g.lineTo(214, y); g.stroke(); }
      // bodywork
      g.fillStyle = lin(g, 0, 40, 0, 150, [U.shade(bike.color, 0.4), bike.color, U.shade(bike.color, -0.45)]);
      g.beginPath();
      g.moveTo(52, 70); g.lineTo(130, 88); g.lineTo(170, 72); g.quadraticCurveTo(210, 46, 250, 52);
      g.lineTo(282, 40); g.quadraticCurveTo(316, 60, 318, 96); g.lineTo(270, 130); g.lineTo(226, 140);
      g.lineTo(206, 110); g.lineTo(140, 108); g.lineTo(80, 92); g.closePath(); g.fill();
      g.fillStyle = bike.accent;
      g.beginPath(); g.moveTo(150, 96); g.lineTo(250, 70); g.lineTo(300, 74); g.lineTo(296, 84); g.lineTo(250, 82); g.lineTo(160, 104); g.closePath(); g.fill();
      // windscreen + seat + headlight
      g.fillStyle = 'rgba(147,197,253,0.55)'; g.beginPath(); g.moveTo(266, 46); g.lineTo(276, 18); g.lineTo(292, 38); g.closePath(); g.fill();
      g.fillStyle = '#111827'; g.beginPath(); g.moveTo(90, 72); g.quadraticCurveTo(130, 60, 176, 70); g.lineTo(170, 80); g.lineTo(100, 84); g.closePath(); g.fill();
      g.save(); g.shadowColor = '#fff7cc'; g.shadowBlur = 16; g.fillStyle = '#fffbe6'; ellipse(g, 310, 72, 8, 6); g.fill(); g.restore();
      g.fillStyle = '#ff3b3b'; ellipse(g, 56, 72, 6, 4); g.fill();
      if (bike.nitro) {
        g.fillStyle = lin(g, 0, 90, 0, 112, ['#7dd3fc', '#0369a1']); rr(g, 92, 92, 52, 16, 8); g.fill();
        g.fillStyle = '#f8fafc'; g.font = 'bold 10px sans-serif'; g.fillText('N₂O', 104, 104);
      }
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(186, 60); g.quadraticCurveTo(220, 48, 250, 54); g.lineTo(248, 58); g.quadraticCurveTo(220, 54, 190, 64); g.fill();
      return { c, w: W, h: H };
    });
  }

  return { rider, crashed, car, scenery, bikeSide, SCENERY, CAR_DIM, BILLBOARDS, rr };
})();
