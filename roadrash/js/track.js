'use strict';
/* ---------- Road geometry: segment-based pseudo-3D track + parallax backdrops ---------- */
const ROAD = {
  segLen: 200, rumble: 3, width: 2000, lanes: 3,
  camH: 1000, depth: 1 / Math.tan((100 / 2) * Math.PI / 180), draw: 280, fog: 4,
};
ROAD.playerZ = ROAD.camH * ROAD.depth;
const LANE_X = [-0.66, 0, 0.66];

class Track {
  constructor(def, level) {
    this.def = def;
    this.theme = THEMES[def.theme];
    this.level = level;
    this.segments = [];
    this.rng = U.rng(def.seed + level * 977);
    this.build(LEVELS[level - 1].segs);
    this.layers = Backdrop.layers(def.theme);
  }

  lastY() { const s = this.segments; return s.length ? s[s.length - 1].p2.world.y : 0; }

  addSegment(curve, y) {
    const n = this.segments.length, len = ROAD.segLen;
    this.segments.push({
      index: n, curve, sprites: [], ents: [], dark: Math.floor(n / ROAD.rumble) % 2,
      p1: { world: { y: this.lastY(), z: n * len }, camera: {}, screen: {} },
      p2: { world: { y, z: (n + 1) * len }, camera: {}, screen: {} },
      clip: 0, fog: 1,
    });
  }

  addRoad(enter, hold, leave, curve, height) {
    const startY = this.lastY(), endY = startY + height * ROAD.segLen, total = enter + hold + leave;
    for (let n = 0; n < enter; n++) this.addSegment(U.easeIn(0, curve, n / enter), U.easeInOut(startY, endY, n / total));
    for (let n = 0; n < hold; n++) this.addSegment(curve, U.easeInOut(startY, endY, (enter + n) / total));
    for (let n = 0; n < leave; n++) this.addSegment(U.easeInOut(curve, 0, n / leave), U.easeInOut(startY, endY, (enter + hold + n) / total));
  }

  build(target) {
    const r = this.rng, d = this.def;
    const pick = (a, b) => a + r() * (b - a);
    const curve = () => (r() < 0.5 ? -1 : 1) * [2, 3, 4, 6][Math.floor(r() * 4 * Math.min(1, 0.5 + d.curvy * 0.5))];
    const hill = () => (r() < 0.5 ? -1 : 1) * pick(15, 70) * d.hilly;
    this.addRoad(10, 70, 10, 0, 0);
    this.startIndex = 40;
    const curveStarts = [];
    while (this.segments.length < target) {
      const k = r(), L = [25, 50, 100][Math.floor(r() * 3)];
      const at = this.segments.length;
      if (k < 0.18) this.addRoad(L / 2, L, L / 2, 0, 0);
      else if (k < 0.32) this.addRoad(L / 2, L, L / 2, 0, hill());
      else if (k < 0.62) { const c = curve() * d.curvy; curveStarts.push([at, c]); this.addRoad(L / 2, L, L / 2, c, r() < 0.5 ? hill() : 0); }
      else if (k < 0.78) {   // S-bend
        const c = curve() * d.curvy;
        curveStarts.push([at, c]); this.addRoad(25, 25, 25, c, hill() * 0.5);
        curveStarts.push([this.segments.length, -c]); this.addRoad(25, 25, 25, -c, -hill() * 0.5);
      } else if (k < 0.9) {  // roller-coaster dips
        const h = Math.abs(hill()) * 0.6;
        for (let i = 0; i < 3; i++) { this.addRoad(15, 15, 15, 0, h); this.addRoad(15, 15, 15, 0, -h); }
      } else { const c = curve() * d.curvy * 0.6; curveStarts.push([at, c]); this.addRoad(50, 100, 50, c, hill()); }
    }
    // level the road back out, straight run to the line
    this.addRoad(40, 40, 40, 0, -this.lastY() / ROAD.segLen);
    this.finishIndex = this.segments.length + 20;
    this.addRoad(0, ROAD.draw + 120, 0, 0, 0);
    this.length = this.segments.length * ROAD.segLen;
    this.finishZ = this.finishIndex * ROAD.segLen;
    this.segments[this.finishIndex].banner = 'FINISH';
    this.segments[this.startIndex + 4].banner = 'START';
    for (let i = 0; i < 3; i++) this.segments[this.startIndex + 2 - i * 2].grid = true;
    this.segments[this.finishIndex].checker = this.segments[this.finishIndex + 1].checker = true;
    this.placeScenery(curveStarts);
  }

  placeScenery(curveStarts) {
    const r = this.rng, t = this.theme, segs = this.segments;
    const table = t.scenery, totalW = table.reduce((a, s) => a + s[1], 0);
    const pickKind = () => { let x = r() * totalW; for (const [k, w] of table) { if ((x -= w) <= 0) return k; } return table[0][0]; };
    const add = (i, kind, offset, variant = Math.floor(r() * 6)) => {
      if (segs[i]) segs[i].sprites.push({ kind, offset, variant, flip: offset > 0 && kind !== 'billboard' && kind !== 'building' });
    };
    // chevron warning signs on the outside of curves
    for (const [i, c] of curveStarts) {
      if (Math.abs(c) < 3) continue;
      const side = c > 0 ? -1 : 1;
      for (let k = 0; k < 4; k++) add(i - 12 + k * 6, 'sign', side * 1.25, c > 0 ? 0 : 1);
    }
    const city = this.def.theme === 'city';
    for (let i = 10; i < segs.length; i++) {
      if (i % 12 === 0 && !city) { add(i, 'post', -1.12); add(i, 'post', 1.12); }
      if (city && i % 9 === 0) { add(i, 'lamp', -1.25, 0); add(i, 'lamp', 1.25, 0); }
      if (r() < (city ? 0.22 : 0.32)) {
        const side = r() < 0.5 ? -1 : 1, kind = pickKind();
        let off = 1.35 + r() * 1.8;
        if (kind === 'building') off = 2.2 + r() * 0.6;
        if (kind === 'billboard') off = 1.9 + r() * 0.4;
        if (kind === 'lamp') off = 1.25;
        add(i, kind, side * off);
      }
      if (r() < 0.12 && !city) add(i, pickKind(), (r() < 0.5 ? -1 : 1) * (3.4 + r() * 3));
    }
    // keep the start area clean
    for (let i = this.startIndex - 6; i < this.startIndex + 10; i++) if (segs[i]) segs[i].sprites = segs[i].sprites.filter(s => Math.abs(s.offset) > 2);
  }

  seg(z) { return this.segments[U.clamp(Math.floor(z / ROAD.segLen), 0, this.segments.length - 1)]; }
}

/* ---------- Pre-rendered, horizontally-tileable sky layers ---------- */
const Backdrop = (() => {
  const cache = {};
  const LW = 2048, LH = 360;
  function ridge(g, color, base, amp, freqs, r, highlight) {
    const ph = freqs.map(() => r() * Math.PI * 2);
    const yAt = x => base - freqs.reduce((a, f, i) => a + Math.sin((x / LW) * Math.PI * 2 * f + ph[i]) * amp / (i + 1), 0) - amp;
    g.fillStyle = color;
    g.beginPath(); g.moveTo(0, LH);
    for (let x = 0; x <= LW; x += 8) g.lineTo(x, yAt(x));
    g.lineTo(LW, LH); g.closePath(); g.fill();
    if (highlight) {
      g.save(); g.clip();
      g.fillStyle = highlight;
      g.beginPath(); g.moveTo(0, LH);
      for (let x = 0; x <= LW; x += 8) g.lineTo(x, yAt(x) + 26 + Math.sin(x * 0.05) * 6);
      g.lineTo(LW, 0); g.lineTo(0, 0); g.closePath(); g.fill();
      g.restore();
    }
  }
  function layers(themeId) {
    if (cache[themeId]) return cache[themeId];
    const t = THEMES[themeId], r = U.rng(themeId.length * 1337 + 7);
    const mk = () => { const c = document.createElement('canvas'); c.width = LW; c.height = LH; return c; };
    const far = mk(), near = mk();
    const gf = far.getContext('2d'), gn = near.getContext('2d');
    ridge(gf, t.far, LH - 40, 70, [3, 7, 13], r, t.snowcaps ? '#f8fafc' : null);
    gf.globalAlpha = 0.35; gf.fillStyle = t.fog; gf.fillRect(0, 0, LW, LH); gf.globalAlpha = 1;
    if (t.skyline) {
      // city skyline with lit windows
      let x = 0;
      while (x < LW) {
        const w = 40 + r() * 90, h = 60 + r() * 220;
        gn.fillStyle = r() < 0.5 ? '#120c2e' : '#1b1340';
        gn.fillRect(x, LH - h, w, h);
        for (let wy = LH - h + 8; wy < LH - 6; wy += 12) for (let wx = x + 6; wx < x + w - 6; wx += 10)
          if (r() < 0.3) { gn.fillStyle = r() < 0.5 ? 'rgba(253,224,71,0.8)' : 'rgba(240,171,252,0.7)'; gn.fillRect(wx, wy, 4, 5); }
        if (r() < 0.2) { gn.fillStyle = '#f43f5e'; gn.fillRect(x + w / 2 - 1, LH - h - 14, 2, 14); }
        x += w + r() * 6;
      }
    } else if (t.sea) {
      const sea = gn.createLinearGradient(0, LH - 70, 0, LH);
      sea.addColorStop(0, '#7c3aed'); sea.addColorStop(0.4, '#db2777'); sea.addColorStop(1, '#1e1b4b');
      gn.fillStyle = sea; gn.fillRect(0, LH - 70, LW, 70);
      for (let i = 0; i < 160; i++) {
        gn.fillStyle = `rgba(255,236,170,${0.2 + r() * 0.5})`;
        gn.fillRect(r() * LW, LH - 66 + r() * 60, 10 + r() * 40, 2);
      }
      ridge(gn, t.near, LH - 60, 30, [2, 5], r);
    } else {
      ridge(gn, t.near, LH - 6, 34, [4, 9, 17], r, null);
      if (themeId === 'forest' || themeId === 'snow') {
        for (let i = 0; i < 260; i++) {
          const x = r() * LW, h = 18 + r() * 30, y = LH - 10 - r() * 26;
          gn.fillStyle = themeId === 'snow' ? (r() < 0.5 ? '#334155' : '#475569') : (r() < 0.5 ? '#14532d' : '#166534');
          gn.beginPath(); gn.moveTo(x - h * 0.3, y); gn.lineTo(x, y - h); gn.lineTo(x + h * 0.3, y); gn.fill();
        }
      }
      if (themeId === 'desert') {
        for (let i = 0; i < 6; i++) {   // mesas
          const x = r() * LW, w = 80 + r() * 160, h = 50 + r() * 70;
          gn.fillStyle = '#7c2d12';
          gn.beginPath(); gn.moveTo(x, LH); gn.lineTo(x + 20, LH - h); gn.lineTo(x + w - 20, LH - h); gn.lineTo(x + w, LH); gn.fill();
          gn.fillStyle = 'rgba(255,200,150,0.25)'; gn.fillRect(x + 20, LH - h, w - 40, 6);
        }
      }
    }
    return (cache[themeId] = { far, near, LW, LH });
  }
  return { layers };
})();
