'use strict';
/* ---------- Shared helpers ---------- */
const U = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (a, b) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  mod: (n, m) => ((n % m) + m) % m,
  easeIn: (a, b, p) => a + (b - a) * p * p,
  easeInOut: (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5),
  expFog: (d, density) => 1 / Math.pow(Math.E, d * d * density),
  overlap: (x1, w1, x2, w2) => Math.abs(x1 - x2) < (w1 + w2) / 2,
  rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  hexToRgb(hex) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const n = parseInt(c, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },
  shade(hex, amt) {
    let [r, g, b] = U.hexToRgb(hex);
    if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  },
  rgba(hex, a) { const [r, g, b] = U.hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; },
  formatTime(t) {
    if (t == null || !isFinite(t)) return '--:--.--';
    const m = Math.floor(t / 60), s = Math.floor(t % 60), cs = Math.floor((t % 1) * 100);
    return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  },
  money: (n) => '$' + Math.round(n).toLocaleString('en-US'),
  ordinal(n) { const s = ['TH', 'ST', 'ND', 'RD'], v = n % 100; return s[(v - 20) % 10] || s[v] || s[0]; },
};

/* ---------- Input ---------- */
const Input = {
  keys: {}, pressed: {},
  init() {
    const block = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
    window.addEventListener('keydown', e => {
      if (block.includes(e.code)) e.preventDefault();
      if (!this.keys[e.code]) this.pressed[e.code] = true;
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
    // touch buttons
    document.querySelectorAll('[data-key]').forEach(btn => {
      const k = btn.dataset.key;
      const on = e => { e.preventDefault(); if (!this.keys[k]) this.pressed[k] = true; this.keys[k] = true; btn.classList.add('on'); };
      const off = e => { e.preventDefault(); this.keys[k] = false; btn.classList.remove('on'); };
      btn.addEventListener('touchstart', on, { passive: false });
      btn.addEventListener('touchend', off, { passive: false });
      btn.addEventListener('touchcancel', off, { passive: false });
    });
  },
  down(...c) { return c.some(k => this.keys[k]); },
  hit(...c) { let r = false; c.forEach(k => { if (this.pressed[k]) { r = true; this.pressed[k] = false; } }); return r; },
  endFrame() { this.pressed = {}; },
  get up() { return this.down('ArrowUp', 'KeyW'); },
  get downKey() { return this.down('ArrowDown', 'KeyS'); },
  get left() { return this.down('ArrowLeft', 'KeyA'); },
  get right() { return this.down('ArrowRight', 'KeyD'); },
  get nitro() { return this.down('Space', 'ShiftLeft', 'ShiftRight', 'KeyN'); },
};
