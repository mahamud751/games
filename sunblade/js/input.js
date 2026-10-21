'use strict';
// Keyboard, gamepad and touch input, merged into one button state per player.
window.Input = (() => {
  const BTN = ['left', 'right', 'up', 'down', 'atk', 'jump', 'spc', 'start'];
  const SOLO = {
    left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
    atk: ['KeyJ', 'KeyZ'], jump: ['KeyK', 'KeyX', 'Space'], spc: ['KeyL', 'KeyC'], start: ['Enter'],
  };
  const DUO = [
    { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], atk: ['KeyJ'], jump: ['KeyK'], spc: ['KeyL'], start: ['Enter'] },
    { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], atk: ['Numpad1', 'Comma'], jump: ['Numpad2', 'Period'], spc: ['Numpad3', 'Slash'], start: ['NumpadEnter'] },
  ];
  const down = new Set(), hits = new Set();
  let players = 1;
  const touch = { left: false, right: false, up: false, down: false, atk: false, jump: false, spc: false, start: false };
  const touchHits = new Set();
  const state = [0, 1].map(() => ({ cur: {}, prev: {}, hit: {} }));

  addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) hits.add(e.code);
    down.add(e.code);
  });
  addEventListener('keyup', e => down.delete(e.code));
  addEventListener('blur', () => down.clear());

  function padState(i) {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    const p = pads[i];
    if (!p) return null;
    const b = k => p.buttons[k] && p.buttons[k].pressed;
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    return {
      left: ax < -0.4 || b(14), right: ax > 0.4 || b(15), up: ay < -0.4 || b(12), down: ay > 0.4 || b(13),
      atk: b(2) || b(5), jump: b(0), spc: b(1) || b(3) || b(4), start: b(9),
    };
  }

  function poll() {
    for (let i = 0; i < 2; i++) {
      const s = state[i];
      s.prev = s.cur;
      const map = players === 1 ? SOLO : DUO[i];
      const cur = {}, hit = {};
      const pad = padState(i);
      for (const k of BTN) {
        const codes = (i === 0 || players === 2) ? map[k] : [];
        cur[k] = codes.some(c => down.has(c));
        hit[k] = codes.some(c => hits.has(c));
        if (pad && pad[k]) cur[k] = true;
        if (i === 0) {
          if (touch[k]) cur[k] = true;
          if (touchHits.has(k)) hit[k] = true;
        }
        hit[k] = hit[k] || (cur[k] && !s.prev[k]);
      }
      s.cur = cur; s.hit = hit;
    }
    hits.clear(); touchHits.clear();
  }

  return {
    poll,
    setPlayers(n) { players = n; },
    get(i) { return state[i]; },
    clearHits() { for (const st of state) st.hit = {}; },
    anyHit(k) { return state[0].hit[k] || state[1].hit[k]; },
    touch, touchHits,
    hasPad() { return navigator.getGamepads && [...navigator.getGamepads()].some(Boolean); },
  };
})();
