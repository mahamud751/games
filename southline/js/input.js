// Keyboard + mouse (pointer lock or right-drag to look) and touch controls:
// a floating stick on the left, drag-to-look on the right, and buttons.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {}; this.hits = new Set();
    this.dx = 0; this.dy = 0; this.wheel = 0;
    this.lmb = false; this.rmb = false;
    this.locked = false; this.enabled = false;
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.stick = { x: 0, y: 0, id: null, ox: 0, oy: 0 };
    this.lookId = null; this.lx = 0; this.ly = 0;
    addEventListener('keydown', e => {
      if (e.repeat) { if (this.enabled && ['Space', 'Tab'].includes(e.code)) e.preventDefault(); return; }
      this.keys[e.code] = true; this.hits.add(e.code);
      if (this.enabled && ['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; this.lmb = this.rmb = false; });
    canvas.addEventListener('mousedown', e => {
      if (!this.enabled) return;
      if (e.button === 0) { this.lmb = true; this.hits.add('Mouse0'); }
      if (e.button === 2) this.rmb = true;
      if (!this.locked && !this.touch && canvas.requestPointerLock) {
        try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) {}
      }
    });
    addEventListener('mouseup', e => { if (e.button === 0) this.lmb = false; if (e.button === 2) this.rmb = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('mousemove', e => {
      if (!this.enabled) return;
      if (this.locked || this.rmb || this.lmb) { this.dx += e.movementX || 0; this.dy += e.movementY || 0; }
    });
    addEventListener('wheel', e => { if (this.enabled) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.onUnlock?.();
    });
    this.setupTouch();
  }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  down(c) { return !!this.keys[c]; }
  hit(c) { return this.hits.has(c); }
  any(...cs) { return cs.some(c => this.hits.has(c)); }
  moveX() { return clamp1((this.keys.KeyD || this.keys.ArrowRight ? 1 : 0) - (this.keys.KeyA || this.keys.ArrowLeft ? 1 : 0) + this.stick.x); }
  moveY() { return clamp1((this.keys.KeyW || this.keys.ArrowUp ? 1 : 0) - (this.keys.KeyS || this.keys.ArrowDown ? 1 : 0) - this.stick.y); }
  steer() { return -this.moveX(); }
  aim() { return this.rmb || !!this.keys.KeyC || this.touchAim; }
  fire() { return this.lmb || !!this.keys.KeyX || this.touchFire; }
  sprint() { return !!(this.keys.ShiftLeft || this.keys.ShiftRight) || Math.hypot(this.stick.x, this.stick.y) > 0.92; }
  look() { const r = { dx: this.dx, dy: this.dy }; this.dx = this.dy = 0; return r; }
  endFrame() { this.hits.clear(); this.wheel = 0; }

  setupTouch() {
    const pad = document.getElementById('touch');
    if (!pad) return;
    if (!this.touch) { pad.remove(); return; }
    const knob = pad.querySelector('.knob'), base = pad.querySelector('.base');
    const zone = pad.querySelector('.stick-zone'), look = pad.querySelector('.look-zone');
    zone.addEventListener('pointerdown', e => {
      this.stick.id = e.pointerId; this.stick.ox = e.clientX; this.stick.oy = e.clientY;
      base.style.left = knob.style.left = e.clientX + 'px'; base.style.top = knob.style.top = e.clientY + 'px';
      base.classList.add('on'); zone.setPointerCapture(e.pointerId);
    });
    zone.addEventListener('pointermove', e => {
      if (e.pointerId !== this.stick.id) return;
      let dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
      const d = Math.hypot(dx, dy), m = 56;
      if (d > m) { dx = dx / d * m; dy = dy / d * m; }
      this.stick.x = dx / m; this.stick.y = dy / m;
      knob.style.left = this.stick.ox + dx + 'px'; knob.style.top = this.stick.oy + dy + 'px';
    });
    const end = e => {
      if (e.pointerId !== this.stick.id) return;
      this.stick.id = null; this.stick.x = this.stick.y = 0; base.classList.remove('on');
      knob.style.left = base.style.left; knob.style.top = base.style.top;
    };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
    look.addEventListener('pointerdown', e => { this.lookId = e.pointerId; this.lx = e.clientX; this.ly = e.clientY; look.setPointerCapture(e.pointerId); });
    look.addEventListener('pointermove', e => {
      if (e.pointerId !== this.lookId) return;
      this.dx += (e.clientX - this.lx) * 1.6; this.dy += (e.clientY - this.ly) * 1.6;
      this.lx = e.clientX; this.ly = e.clientY;
    });
    const lend = e => { if (e.pointerId === this.lookId) this.lookId = null; };
    look.addEventListener('pointerup', lend); look.addEventListener('pointercancel', lend);
    for (const b of pad.querySelectorAll('[data-key]')) {
      const key = b.dataset.key;
      b.addEventListener('pointerdown', e => {
        e.preventDefault(); b.classList.add('on');
        if (key === 'fire') { this.touchFire = true; this.touchAim = true; this.hits.add('Mouse0'); }
        else { this.keys[key] = true; this.hits.add(key); }
      });
      const up = () => {
        b.classList.remove('on');
        if (key === 'fire') { this.touchFire = false; this.touchAim = false; } else this.keys[key] = false;
      };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    }
  }
}
const clamp1 = v => v < -1 ? -1 : v > 1 ? 1 : v;
