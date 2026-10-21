'use strict';
// Procedural art: posable cartoon heroes and monsters, desert tiles, backgrounds and pickups.
window.Art = (() => {
  const TAU = Math.PI * 2;
  const OUT = '#140d1c';
  const VW = 960, GT = 330;
  const L = { torso: 36, ua: 19, fa: 18, th: 24, sh: 24, head: 11.5 };

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
    else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    return '#' + [r, g, b].map(v => (v | 0).toString(16).padStart(2, '0')).join('');
  }
  function mulberry32(a) {
    return () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ---------- poses (angles absolute, 0 = straight down, + = towards facing) ----------
  const BASE = { lean: 0, head: 0, hipY: 0, x: 0, aF: 0.3, eF: 0.3, aB: 0.2, eB: 0.3, tF: 0.1, kF: -0.1, tB: -0.1, kB: -0.1, rot: 0, air: 0 };
  const ST = { tF: 0.35, kF: -0.45, tB: -0.3, kB: -0.2 };
  const RAW = {
    idle: { lean: 0.08, aF: 0.8, eF: 1.85, aB: 0.45, eB: 2.0, ...ST },
    walkA: { lean: 0.1, aF: 0.85, eF: 1.8, aB: 0.4, eB: 2.0, tF: 0.5, kF: -0.25, tB: -0.4, kB: -0.55 },
    walkB: { lean: 0.1, aF: 0.7, eF: 1.9, aB: 0.5, eB: 1.9, tF: -0.3, kF: -0.55, tB: 0.45, kB: -0.25 },
    runA: { lean: 0.35, aF: 1.2, eF: 1.3, aB: -0.7, eB: 1.4, tF: 0.95, kF: -0.5, tB: -0.7, kB: -1.1 },
    runB: { lean: 0.35, aF: -0.6, eF: 1.4, aB: 1.1, eB: 1.3, tF: -0.6, kF: -1.1, tB: 0.9, kB: -0.5 },
    windup: { lean: -0.05, aF: 0.5, eF: 2.2, aB: 0.2, eB: 2.2, ...ST },
    jab: { lean: 0.15, aF: 1.57, eF: 0.05, aB: 0.45, eB: 2.0, tF: 0.45, kF: -0.5, tB: -0.4, kB: -0.2 },
    cross: { lean: 0.3, x: 4, aF: 0.55, eF: 1.9, aB: 1.6, eB: 0.05, tF: 0.55, kF: -0.6, tB: -0.55, kB: -0.1 },
    hook: { lean: 0.3, aF: 1.75, eF: 0.75, aB: 0.4, eB: 2.0, tF: 0.5, kF: -0.55, tB: -0.45, kB: -0.15 },
    crouchPre: { lean: 0.25, hipY: 6, aF: 0.3, eF: 1.9, aB: 0.4, eB: 2.0, tF: 0.7, kF: -1.1, tB: -0.2, kB: -0.7 },
    uppercut: { lean: -0.1, aF: 2.8, eF: 0.25, aB: 0.2, eB: 2.1, tF: 0.25, kF: -0.15, tB: -0.35, kB: -0.1 },
    kickLow: { lean: -0.12, aF: 0.9, eF: 1.7, aB: 0.5, eB: 1.8, tF: 1.05, kF: -0.1, tB: -0.1, kB: -0.1 },
    kickHigh: { lean: -0.35, aF: 1.1, eF: 1.3, aB: -0.4, eB: 1.3, tF: 1.85, kF: -0.05, tB: -0.05, kB: -0.05 },
    roundhouse: { lean: -0.55, head: 0.2, aF: 1.3, eF: 1.0, aB: -0.7, eB: 1.0, tF: 2.0, kF: 0, tB: 0, kB: -0.1 },
    hammerUp: { lean: -0.15, aF: 3.0, eF: 0.4, aB: 2.8, eB: 0.5, ...ST },
    hammer: { lean: 0.45, aF: 1.3, eF: 0.15, aB: 1.2, eB: 0.2, tF: 0.55, kF: -0.6, tB: -0.5, kB: -0.1 },
    headbuttPre: { lean: -0.35, head: -0.3, aF: 0.3, eF: 1.5, aB: 0.2, eB: 1.5, ...ST },
    headbutt: { lean: 0.75, head: 0.4, aF: 0.6, eF: 1.2, aB: 0.4, eB: 1.2, tF: 0.6, kF: -0.5, tB: -0.6, kB: -0.1 },
    jump: { air: 1, lean: 0.05, aF: 1.0, eF: 1.6, aB: 0.6, eB: 1.8, tF: 1.1, kF: -1.7, tB: 0.4, kB: -1.6 },
    jumpKick: { air: 1, lean: -0.2, aF: 0.9, eF: 1.2, aB: -0.5, eB: 1.2, tF: 1.5, kF: -0.05, tB: 0.2, kB: -1.8 },
    dashPunch: { lean: 0.55, aF: 1.6, eF: 0.08, aB: -0.3, eB: 1.6, tF: 0.9, kF: -0.5, tB: -0.85, kB: -0.3 },
    hurt: { lean: -0.45, head: -0.35, aF: -0.25, eF: 0.9, aB: -0.55, eB: 0.8, tF: 0.3, kF: -0.35, tB: -0.25, kB: -0.3 },
    hurt2: { lean: 0.6, head: 0.35, aF: 0.45, eF: 0.6, aB: 0.3, eB: 0.6, tF: 0.2, kF: -0.45, tB: -0.3, kB: -0.35 },
    fall: { air: 1, rot: -1.0, lean: -0.2, head: -0.3, aF: 2.6, eF: 0.4, aB: 2.2, eB: 0.4, tF: 0.7, kF: -0.6, tB: 0.2, kB: -0.6 },
    down: { air: 1, rot: -1.52, hipY: 40, head: 0.15, aF: 2.9, eF: 0.15, aB: 2.7, eB: 0.2, tF: 0.12, kF: -0.08, tB: -0.04, kB: -0.1 },
    getup: { lean: 0.55, hipY: 10, aF: 0.9, eF: 0.4, aB: 0.6, eB: 0.5, tF: 1.3, kF: -2.1, tB: -0.2, kB: -1.5 },
    grabHold: { lean: 0.12, aF: 1.45, eF: 0.45, aB: 1.35, eB: 0.55, ...ST },
    knee: { lean: 0.15, aF: 1.4, eF: 0.6, aB: 1.3, eB: 0.6, tF: 1.55, kF: -1.7, tB: -0.1, kB: -0.1 },
    throwP: { lean: -0.45, aF: 2.9, eF: 0.2, aB: 2.7, eB: 0.3, tF: 0.45, kF: -0.3, tB: -0.45, kB: -0.2 },
    lariat: { lean: 0, aF: 1.6, eF: 0, aB: -1.6, eB: 0, tF: 0.35, kF: -0.3, tB: -0.35, kB: -0.3 },
    cyclone: { air: 1, lean: -0.15, aF: 1.0, eF: 0.4, aB: -1.0, eB: 0.4, tF: 1.57, kF: 0, tB: -1.4, kB: -0.1 },
    poundUp: { air: 1, lean: -0.1, aF: 3.05, eF: 0.1, aB: 2.95, eB: 0.1, tF: 0.9, kF: -1.4, tB: 0.3, kB: -1.3 },
    slam: { lean: 0.55, hipY: 6, aF: 1.0, eF: 0.1, aB: 0.9, eB: 0.1, tF: 0.9, kF: -1.4, tB: -0.6, kB: -0.7 },
    slashUp: { lean: -0.1, aF: 2.9, eF: 0.6, aB: 0.4, eB: 1.8, ...ST },
    slash: { lean: 0.4, aF: 1.1, eF: 0.1, aB: -0.2, eB: 1.5, tF: 0.7, kF: -0.6, tB: -0.6, kB: -0.15 },
    blast: { lean: 0.2, aF: 1.57, eF: 0, aB: 1.5, eB: 0.05, tF: 0.5, kF: -0.5, tB: -0.5, kB: -0.15 },
    victory: { lean: -0.05, aF: 3.0, eF: 0.25, aB: 0.4, eB: 2.0, tF: 0.2, kF: -0.1, tB: -0.2, kB: -0.1 },
    taunt: { lean: -0.15, aF: 2.2, eF: 1.3, aB: 2.0, eB: 1.3, ...ST },
    charge: { lean: 0.6, head: 0.2, aF: 0.4, eF: 0.5, aB: -0.2, eB: 0.8, tF: 0.9, kF: -0.6, tB: -0.8, kB: -0.4 },
    zombie: { lean: 0.15, head: 0.2, aF: 1.5, eF: 0.05, aB: 1.35, eB: 0.1, ...ST },
    plunge: { air: 1, lean: 0.25, head: 0.3, aF: 0.15, eF: 0.05, aB: 1.6, eB: 1.2, tF: 1.3, kF: -1.8, tB: 0.6, kB: -1.7 },
    thrust: { lean: 0.35, aF: 1.57, eF: 0.02, aB: 1.45, eB: 0.4, tF: 0.7, kF: -0.5, tB: -0.6, kB: -0.15 },
    bowDraw: { lean: -0.05, aF: 1.57, eF: 0.02, aB: 1.5, eB: 1.9, ...ST },
    fallAir: { air: 1, lean: -0.05, aF: 2.4, eF: 0.5, aB: 2.1, eB: 0.6, tF: 0.4, kF: -0.6, tB: -0.2, kB: -0.5 },
    slashBack: { lean: 0.2, aF: 0.6, eF: 0.3, aB: 0.5, eB: 1.8, tF: 0.55, kF: -0.6, tB: -0.5, kB: -0.15 },
  };
  const P = {};
  for (const k in RAW) P[k] = Object.assign({}, BASE, RAW[k]);

  function lerpPose(a, b, t) {
    const o = {};
    for (const k in BASE) o[k] = a[k] + (b[k] - a[k]) * t;
    o.air = t < 0.5 ? a.air : b.air;
    return o;
  }

  // ---------- fighter renderer ----------
  const dv = a => [Math.sin(a), Math.cos(a)];
  const add = (p, v, l) => [p[0] + v[0] * l, p[1] + v[1] * l];

  function limb(c, pts, w, cols) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = OUT; c.lineWidth = w + 4;
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.stroke();
    for (let i = 1; i < pts.length; i++) {
      c.strokeStyle = cols[i - 1]; c.lineWidth = w * (i === 1 ? 1 : 0.9);
      c.beginPath(); c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); c.stroke();
    }
    c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = w * 0.28;
    c.beginPath(); c.moveTo(pts[0][0] - 1, pts[0][1] - w * 0.18);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0] - 1, pts[i][1] - w * 0.18);
    c.stroke();
  }
  function blob(c, x, y, r, fill) {
    c.beginPath(); c.arc(x, y, r, 0, TAU);
    c.fillStyle = fill; c.fill();
    c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
  }

  function drawFighter(c, x, y, look, p, face, o = {}) {
    const s = look.scale || 1, bulk = look.bulk || 1, time = o.t || 0;
    const F = o.flash ? () => '#ffffff' : v => v;
    const back = v => o.flash ? '#ffffff' : shade(v, -0.25);

    const hip = [p.x, -50 + p.hipY];
    const up = [Math.sin(p.lean), -Math.cos(p.lean)];
    const pr = [Math.cos(p.lean), Math.sin(p.lean)];
    const neck = add(hip, up, L.torso);
    const sh = add(neck, up, -5);
    const shF = add(sh, pr, 2), shB = add(sh, pr, -4);
    const elF = add(shF, dv(p.aF), L.ua), haF = add(elF, dv(p.aF + p.eF), L.fa);
    const elB = add(shB, dv(p.aB), L.ua), haB = add(elB, dv(p.aB + p.eB), L.fa);
    const hipF = add(hip, pr, 2), hipB = add(hip, pr, -3);
    const knF = add(hipF, dv(p.tF), L.th), ftF = add(knF, dv(p.tF + p.kF), L.sh);
    const knB = add(hipB, dv(p.tB), L.th), ftB = add(knB, dv(p.tB + p.kB), L.sh);
    const offY = p.air ? 0 : -(Math.max(ftF[1], ftB[1]) + 4);

    c.save();
    c.translate(x, y);
    c.scale(face * s, s);
    c.translate(0, offY);
    if (p.rot) { c.translate(hip[0], hip[1]); c.rotate(p.rot); c.translate(-hip[0], -hip[1]); }
    if (o.alpha !== undefined) c.globalAlpha *= o.alpha;

    const armW = 8.5 * Math.sqrt(bulk), legW = 10.5 * Math.sqrt(bulk);
    const sleeve = look.sleeves === 'long' ? [look.top, look.top] : look.sleeves === 'short' ? [look.top, look.skin] : [look.skin, look.skin];
    const shin = look.shorts ? look.skin : look.pants;

    // cape behind everything
    if (look.cape) {
      const wv = Math.sin(time * 5) * 6;
      c.beginPath();
      c.moveTo(shB[0] - 2, shB[1] - 2);
      c.quadraticCurveTo(hip[0] - 26 + wv, hip[1] + 6, hip[0] - 30 + wv, hip[1] + 40);
      c.lineTo(hip[0] - 6, hip[1] + 36);
      c.lineTo(hip[0], hip[1]);
      c.closePath();
      c.fillStyle = F(look.cape); c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    }

    const toe = (ft, a) => { const v = [Math.cos(a), -Math.sin(a)]; return [add(ft, v, -2), add(ft, v, 9)]; };
    function leg(hp, kn, ft, a, isBack) {
      const cf = isBack ? back : F;
      limb(c, [hp, kn, ft], legW, [cf(look.pants), cf(shin)]);
      if (look.wraps) wraps(c, [hp, kn, ft], legW);
      const [t0, t1] = toe(ft, a);
      limb(c, [t0, t1], 8, [cf(look.shoes)]);
    }
    function arm(shp, el, ha, isBack) {
      const cf = isBack ? back : F;
      limb(c, [shp, el, ha], armW, [cf(sleeve[0]), cf(sleeve[1])]);
      if (look.wraps) wraps(c, [shp, el, ha], armW);
      blob(c, ha[0], ha[1], 5.5 * Math.sqrt(bulk), cf(look.gloves || look.skin));
    }

    // back arm + weapons
    arm(shB, elB, haB, true);
    if (look.blades) weapon(c, haB, p.aB + p.eB, 26, '#67e8f9', o.flash, true);
    leg(hipB, knB, ftB, p.tB + p.kB, true);
    leg(hipF, knF, ftF, p.tF + p.kF, false);
    if (look.kilt) {
      const kw = 15 * bulk;
      const a = add(hip, pr, -kw), b = add(hip, pr, kw * 1.05);
      const a2 = add(add(hip, pr, -kw * 1.25), [0, 1], 26), b2 = add(add(hip, pr, kw * 1.4), [0, 1], 24);
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(b2[0], b2[1]); c.lineTo(a2[0], a2[1]); c.closePath();
      c.lineWidth = 3.5; c.strokeStyle = OUT; c.stroke(); c.fillStyle = F(look.kilt); c.fill();
      c.strokeStyle = F(shade(look.kilt, -0.25)); c.lineWidth = 1.4;
      for (let k = 1; k < 4; k++) { const u = add(a, pr, kw * 0.5 * k), v2 = add(a2, pr, kw * 0.65 * k); c.beginPath(); c.moveTo(u[0], u[1]); c.lineTo(v2[0], v2[1]); c.stroke(); }
    }

    // torso
    const SW = 24 * bulk, WW = 18 * bulk;
    const nF = add(neck, pr, SW / 2), nB = add(neck, pr, -SW / 2), hF = add(hip, pr, WW / 2), hB = add(hip, pr, -WW / 2);
    c.lineJoin = 'round';
    c.beginPath(); c.moveTo(nB[0], nB[1]); c.lineTo(nF[0], nF[1]); c.lineTo(hF[0], hF[1]); c.lineTo(hB[0], hB[1]); c.closePath();
    c.lineWidth = 4.5; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = F(look.topStyle === 'none' ? look.skin : look.top); c.fill();
    if (bulk > 1.2) {
      const bc = add(add(hip, up, 13), pr, WW * 0.32);
      c.beginPath(); c.ellipse(bc[0], bc[1], WW * 0.42, 13, p.lean, 0, TAU);
      c.lineWidth = 3.5; c.strokeStyle = OUT; c.stroke();
      c.fillStyle = F(look.topStyle === 'tank' || look.topStyle === 'none' ? (look.topStyle === 'tank' ? look.top : look.skin) : look.top); c.fill();
    }
    // torso details
    c.save();
    c.beginPath(); c.moveTo(nB[0], nB[1]); c.lineTo(nF[0], nF[1]); c.lineTo(hF[0], hF[1]); c.lineTo(hB[0], hB[1]); c.closePath();
    c.clip();
    if (look.topStyle === 'jacket') {
      const a = add(neck, pr, SW * 0.18), b = add(neck, pr, SW * 0.48), d = add(hip, pr, WW * 0.5), e2 = add(hip, pr, WW * 0.2);
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.lineTo(e2[0], e2[1]); c.closePath();
      c.fillStyle = F(look.inner || '#eee'); c.fill();
      c.strokeStyle = F(shade(look.top, -0.35)); c.lineWidth = 2;
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(e2[0], e2[1]); c.stroke();
    } else if (look.topStyle === 'vest') {
      const a = add(neck, pr, SW * 0.05), b = add(neck, pr, SW * 0.5), d = add(hip, pr, WW * 0.5), e2 = add(hip, pr, WW * 0.15);
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.lineTo(e2[0], e2[1]); c.closePath();
      c.fillStyle = F(look.skin); c.fill();
    } else if (look.topStyle === 'armor') {
      c.strokeStyle = F(shade(look.top, 0.35)); c.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        const a = add(add(hip, up, i * 9), pr, -SW), b = add(add(hip, up, i * 9), pr, SW);
        c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
      }
      const gem = add(add(hip, up, 26), pr, SW * 0.15);
      c.beginPath(); c.arc(gem[0], gem[1], 4, 0, TAU); c.fillStyle = F('#ef4444'); c.fill();
    } else if (look.topStyle === 'gi') {
      const a = add(neck, pr, SW * 0.4), e2 = add(hip, pr, WW * 0.1);
      c.strokeStyle = F(shade(look.top, -0.4)); c.lineWidth = 3;
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(e2[0], e2[1]); c.stroke();
    } else if (look.topStyle === 'tank') {
      c.fillStyle = 'rgba(255,255,255,.12)';
      const a = add(neck, pr, -SW * 0.1);
      c.fillRect(a[0] - 2, a[1], 4, 20);
    }
    // soft shading on the back edge
    const sa = add(neck, pr, -SW * 0.5), sb = add(hip, pr, -WW * 0.5);
    c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 7;
    c.beginPath(); c.moveTo(sa[0], sa[1]); c.lineTo(sb[0], sb[1]); c.stroke();
    c.restore();
    // belt
    limb(c, [add(hip, pr, -WW * 0.55), add(hip, pr, WW * 0.55)], 4.5, [F(look.belt || '#2b2133')]);
    if (look.collar) {
      c.save(); c.translate(neck[0], neck[1] + 2); c.rotate(p.lean);
      for (let k = 2; k >= 0; k--) {
        c.beginPath(); c.ellipse(1, 2, SW * 0.5 + k * 2.2, 7 + k * 2.6, 0, 0, Math.PI);
        c.fillStyle = F(k % 2 ? look.collar2 || '#2dd4bf' : look.collar); c.fill();
      }
      c.lineWidth = 1.8; c.strokeStyle = OUT; c.beginPath(); c.ellipse(1, 2, SW * 0.5 + 4.4, 12.2, 0, 0, Math.PI); c.stroke();
      c.restore();
    }

    if (look.pads) {
      for (const sp of [shB, shF]) {
        c.fillStyle = F(look.pads);
        c.beginPath();
        for (let i = 0; i <= 6; i++) {
          const a = -Math.PI + i * Math.PI / 6, r = i % 2 ? 9 : 14;
          const px = sp[0] + Math.cos(a) * r, py = sp[1] + Math.sin(a) * r * 0.8;
          i ? c.lineTo(px, py) : c.moveTo(px, py);
        }
        c.closePath(); c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
      }
    }

    // head
    const ha = p.lean + p.head;
    const hu = [Math.sin(ha), -Math.cos(ha)];
    const R = L.head;
    const hc = add(neck, hu, R + 1.5);
    limb(c, [add(neck, up, -3), add(neck, hu, 5)], 8, [F(look.skin)]);
    c.save();
    c.translate(hc[0], hc[1]); c.rotate(ha);
    drawHead(c, look, R, F, time, o);
    c.restore();

    arm(shF, elF, haF, false);
    if (look.knife) weapon(c, haF, p.aF + p.eF, 15, '#d1d5db', o.flash, false);
    if (look.khopesh) khopesh(c, haF, p.aF + p.eF, o.flash, look.bladeGlow);
    if (look.spear) spear(c, haF, p.aF + p.eF, o.flash);
    if (look.staff) staff(c, haF, p.aF + p.eF, o.flash);
    if (look.bow) bow(c, haF, p.aF + p.eF, o.flash);
    if (look.blades) weapon(c, haF, p.aF + p.eF, 28, '#67e8f9', o.flash, true);
    c.restore();
  }

  function weapon(c, at, a, len, color, flash, glow) {
    const v = dv(a), tip = add(at, v, len);
    c.save();
    if (glow && !flash) { c.shadowColor = color; c.shadowBlur = 12; }
    c.lineCap = 'round';
    c.strokeStyle = OUT; c.lineWidth = 6; c.beginPath(); c.moveTo(at[0], at[1]); c.lineTo(tip[0], tip[1]); c.stroke();
    c.strokeStyle = flash ? '#fff' : color; c.lineWidth = 3; c.beginPath(); c.moveTo(at[0], at[1]); c.lineTo(tip[0], tip[1]); c.stroke();
    c.restore();
  }

  function drawHead(c, look, R, F, time, o) {
    if (look.head === 'jackal') { jackalHead(c, look, R, F, time, o); return; }
    const hair = F(look.hair || '#222');
    // long hair / ponytail behind the head
    if (look.hairStyle === 'pony') {
      const sw = Math.sin(time * 7) * 3;
      c.lineCap = 'round';
      c.strokeStyle = OUT; c.lineWidth = 10;
      c.beginPath(); c.moveTo(-R + 3, -R * 0.5); c.quadraticCurveTo(-R - 12, -4, -R - 15 + sw, 10 + sw); c.stroke();
      c.strokeStyle = hair; c.lineWidth = 6.5; c.stroke();
    } else if (look.hairStyle === 'long') {
      c.beginPath(); c.moveTo(-R * 0.2, -R); c.quadraticCurveTo(-R - 8, -2, -R - 2, R + 14); c.lineTo(-R * 0.1, R * 0.6); c.closePath();
      c.fillStyle = hair; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
    }
    // face
    c.beginPath(); c.arc(0, 0, R, 0, TAU);
    c.fillStyle = F(look.skin); c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); c.arc(R * 0.95, 1.5, 2.5, -1.2, 1.2); c.fillStyle = F(look.skin); c.fill(); c.lineWidth = 1.6; c.stroke();
    c.beginPath(); c.arc(-2, 1.5, 2.8, 0, TAU); c.fillStyle = F(shade(look.skin, -0.18)); c.fill(); c.lineWidth = 1.4; c.stroke();
    // eyes
    if (look.eyes === 'visor') {
      c.save(); c.shadowColor = '#f43f5e'; c.shadowBlur = o.flash ? 0 : 10;
      c.fillStyle = F('#f43f5e'); c.fillRect(1, -4.5, R - 0.5, 4);
      c.restore();
    } else if (o.hurt) {
      c.strokeStyle = OUT; c.lineWidth = 1.8;
      c.beginPath(); c.moveTo(3.8, -3.6); c.lineTo(7.6, -0.4); c.moveTo(7.6, -3.6); c.lineTo(3.8, -0.4); c.stroke();
    } else {
      c.beginPath(); c.ellipse(5.8, -1.8, 2.8, 2.3, 0, 0, TAU); c.fillStyle = F('#fff'); c.fill();
      c.beginPath(); c.arc(6.8, -1.6, 1.4, 0, TAU); c.fillStyle = look.glowEyes ? F('#f43f5e') : OUT; c.fill();
      c.strokeStyle = OUT; c.lineWidth = 2;
      c.beginPath(); c.moveTo(2.4, -5.6); c.lineTo(8.8, -3.9); c.stroke();
    }
    c.strokeStyle = OUT; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(4.8, 6); c.lineTo(8.8, o.hurt ? 6.8 : 5.4); c.stroke();
    if (look.beard) {
      c.beginPath(); c.moveTo(-1, 2); c.quadraticCurveTo(1, R + 5, 9, R * 0.75); c.lineTo(10, 4); c.quadraticCurveTo(6, 8.5, 2, 3);
      c.closePath(); c.fillStyle = hair; c.fill(); c.lineWidth = 1.6; c.stroke();
    }
    // hair styles
    c.lineWidth = 2.2; c.strokeStyle = OUT; c.fillStyle = hair;
    switch (look.hairStyle) {
      case 'spiky': {
        c.beginPath(); c.moveTo(-R - 1, 3);
        const pts = [[-R - 7, -3], [-R + 1, -5], [-R - 3, -12], [-4, -R - 1], [-6, -R - 9], [1, -R - 1], [3, -R - 8], [6, -R + 1], [11, -R + 2], [R - 1, -4]];
        for (const [px, py] of pts) c.lineTo(px, py);
        c.quadraticCurveTo(2, -R * 0.45, -R * 0.4, -1); c.closePath(); c.fill(); c.stroke();
        break;
      }
      case 'pony': case 'long': {
        c.beginPath(); c.arc(0, -1, R + 1, Math.PI * 0.92, Math.PI * 1.9); c.quadraticCurveTo(2, -R * 0.5, -R * 0.55, 1); c.closePath(); c.fill(); c.stroke();
        break;
      }
      case 'mohawk': {
        c.beginPath(); c.moveTo(-8, -R + 4);
        for (let i = 0; i < 5; i++) { c.lineTo(-8 + i * 3.6, -R - 11 + (i % 2) * 4); c.lineTo(-6 + i * 3.6, -R + 1); }
        c.closePath(); c.fill(); c.stroke();
        break;
      }
      case 'bald': {
        c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 2;
        c.beginPath(); c.arc(0, 0, R * 0.72, Math.PI * 1.15, Math.PI * 1.45); c.stroke();
        break;
      }
      case 'cap': {
        c.beginPath(); c.arc(0, -1, R + 1, Math.PI, TAU); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(R - 2, -3); c.lineTo(R + 9, -1); c.lineTo(R - 2, 0); c.closePath(); c.fill(); c.stroke();
        break;
      }
      case 'bandana': {
        c.beginPath(); c.arc(0, -1, R + 1, Math.PI * 0.95, TAU + 0.05); c.closePath(); c.fill(); c.stroke();
        const w = Math.sin(time * 9) * 3;
        c.beginPath(); c.moveTo(-R, -3); c.lineTo(-R - 11, -6 + w); c.lineTo(-R - 9, 0 + w); c.closePath(); c.fill(); c.stroke();
        break;
      }
      case 'nemes': {
        // striped royal headcloth flowing behind the neck
        c.beginPath(); c.moveTo(R * 0.7, -R * 0.55); c.quadraticCurveTo(0, -R - 6, -R - 2, -R * 0.2);
        c.lineTo(-R - 5, R + 10); c.lineTo(-R * 0.25, R + 6); c.lineTo(-R * 0.3, 1); c.quadraticCurveTo(2, -R * 0.35, R * 0.7, -R * 0.55);
        c.closePath(); c.fillStyle = F(look.hair); c.fill(); c.stroke();
        c.save(); c.clip();
        c.strokeStyle = F(look.hair2 || '#facc15'); c.lineWidth = 2.6;
        for (let k = -3; k < 5; k++) { c.beginPath(); c.moveTo(-R * 1.6 + k * 6, -R * 1.4); c.lineTo(-R * 0.6 + k * 6, R * 1.6); c.stroke(); }
        c.restore();
        c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
        c.fillStyle = F('#facc15'); c.beginPath(); c.arc(R * 0.55, -R * 0.62, 2.6, 0, TAU); c.fill(); c.stroke();
        break;
      }
      case 'wrapped': {
        c.strokeStyle = 'rgba(80,60,30,.55)'; c.lineWidth = 1.4;
        for (let k = -2; k < 4; k++) { c.beginPath(); c.moveTo(-R, -R * 0.6 + k * 5); c.lineTo(R, -R * 0.2 + k * 5 + (k % 2) * 2); c.stroke(); }
        break;
      }
      case 'helmet': {
        const g = c.createLinearGradient(0, -R, 0, 2);
        g.addColorStop(0, F('#e5e7eb')); g.addColorStop(1, F('#6b7280'));
        c.fillStyle = g;
        c.beginPath(); c.arc(0, -1, R + 2.5, Math.PI * 0.95, TAU + 0.15); c.lineTo(R + 2, 2); c.lineTo(-R - 2, 2); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = F('#dc2626');
        c.beginPath(); c.moveTo(-8, -R - 1); c.quadraticCurveTo(0, -R - 16, 10, -R - 2); c.lineTo(4, -R + 1); c.closePath(); c.fill(); c.stroke();
        break;
      }
    }
    if (look.band) {
      const w = Math.sin(time * 9) * 2.5;
      c.lineCap = 'round';
      c.strokeStyle = OUT; c.lineWidth = 6.5;
      c.beginPath(); c.moveTo(-R + 0.5, -4.5); c.lineTo(R - 1, -6); c.stroke();
      c.strokeStyle = F(look.band); c.lineWidth = 3.5; c.stroke();
      c.lineWidth = 3;
      for (const k of [0, 1]) {
        c.strokeStyle = OUT; c.lineWidth = 5.5;
        c.beginPath(); c.moveTo(-R + 1, -4.5); c.quadraticCurveTo(-R - 8, -6 + k * 5 + w, -R - 16, -2 + k * 7 + w * 1.6); c.stroke();
        c.strokeStyle = F(look.band); c.lineWidth = 3; c.stroke();
      }
    }
  }

  // ---------- weapons & costume parts ----------
  function khopesh(c, at, a, flash, glow) {
    const v = dv(a), n = [v[1], -v[0]];
    const h1 = add(at, v, 9), mid = add(add(at, v, 24), n, 3), tip = add(add(at, v, 32), n, -9);
    c.save();
    if (glow && !flash) { c.shadowColor = glow; c.shadowBlur = 16; }
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = OUT; c.lineWidth = 9;
    c.beginPath(); c.moveTo(at[0], at[1]); c.lineTo(h1[0], h1[1]); c.quadraticCurveTo(mid[0], mid[1], tip[0], tip[1]); c.stroke();
    c.strokeStyle = flash ? '#fff' : (glow || '#e5e7eb'); c.lineWidth = 5;
    c.beginPath(); c.moveTo(h1[0], h1[1]); c.quadraticCurveTo(mid[0], mid[1], tip[0], tip[1]); c.stroke();
    c.strokeStyle = flash ? '#fff' : '#b45309'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(add(at, v, -3)[0], add(at, v, -3)[1]); c.lineTo(h1[0], h1[1]); c.stroke();
    c.restore();
  }
  function spear(c, at, a, flash) {
    const v = dv(a), back = add(at, v, -30), tip = add(at, v, 62), n = [v[1], -v[0]];
    c.lineCap = 'round';
    c.strokeStyle = OUT; c.lineWidth = 6; c.beginPath(); c.moveTo(back[0], back[1]); c.lineTo(tip[0], tip[1]); c.stroke();
    c.strokeStyle = flash ? '#fff' : '#8b5a2b'; c.lineWidth = 3; c.stroke();
    const t2 = add(tip, v, 14);
    c.beginPath(); c.moveTo(t2[0], t2[1]); c.lineTo(add(tip, n, 5)[0], add(tip, n, 5)[1]); c.lineTo(add(tip, n, -5)[0], add(tip, n, -5)[1]); c.closePath();
    c.fillStyle = flash ? '#fff' : '#facc15'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = OUT; c.stroke();
  }
  function staff(c, at, a, flash) {
    const v = dv(a + Math.PI * 0.5 * 0), up = [0, -1];
    const top = add(at, up, 60), bot = add(at, up, -36);
    c.lineCap = 'round';
    c.strokeStyle = OUT; c.lineWidth = 7; c.beginPath(); c.moveTo(bot[0], bot[1]); c.lineTo(top[0], top[1]); c.stroke();
    c.strokeStyle = flash ? '#fff' : '#facc15'; c.lineWidth = 3.5; c.stroke();
    c.save(); c.shadowColor = '#22d3ee'; c.shadowBlur = flash ? 0 : 14;
    c.beginPath(); c.ellipse(top[0], top[1] - 8, 6, 8, 0, 0, TAU); c.lineWidth = 3.5; c.strokeStyle = flash ? '#fff' : '#22d3ee'; c.stroke();
    c.beginPath(); c.moveTo(top[0] - 9, top[1]); c.lineTo(top[0] + 9, top[1]); c.stroke();
    c.restore();
    void v;
  }
  function bow(c, at, a, flash) {
    const v = dv(a), n = [v[1], -v[0]];
    const t1 = add(at, n, 24), t2 = add(at, n, -24), bend = add(at, v, 12);
    c.lineCap = 'round';
    c.strokeStyle = OUT; c.lineWidth = 6; c.beginPath(); c.moveTo(t1[0], t1[1]); c.quadraticCurveTo(bend[0] + v[0] * 10, bend[1] + v[1] * 10, t2[0], t2[1]); c.stroke();
    c.strokeStyle = flash ? '#fff' : '#a16207'; c.lineWidth = 3; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1; c.beginPath(); c.moveTo(t1[0], t1[1]); c.lineTo(t2[0], t2[1]); c.stroke();
  }
  function wraps(c, pts, w) {
    c.strokeStyle = 'rgba(90,70,40,.55)'; c.lineWidth = 1.4;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const len = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / len, ny = (bx - ax) / len;
      for (let t = 0.2; t < 1; t += 0.3) {
        const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        c.beginPath(); c.moveTo(x - nx * w * 0.5, y - ny * w * 0.5 - 2); c.lineTo(x + nx * w * 0.5, y + ny * w * 0.5 + 2); c.stroke();
      }
    }
  }
  function jackalHead(c, look, R, F, time, o) {
    const fur = F(look.skin);
    // ears
    for (const ex of [-5, 2]) {
      c.beginPath(); c.moveTo(ex - 4, -R + 3); c.lineTo(ex, -R - 17); c.lineTo(ex + 5, -R + 2); c.closePath();
      c.fillStyle = fur; c.fill(); c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
      c.beginPath(); c.moveTo(ex - 1.5, -R + 1); c.lineTo(ex + 0.5, -R - 11); c.lineTo(ex + 2.5, -R + 1); c.closePath();
      c.fillStyle = F('#b45309'); c.fill();
    }
    // skull + snout
    c.beginPath(); c.arc(-1, 0, R * 0.95, 0, TAU); c.fillStyle = fur; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); c.moveTo(4, -4); c.lineTo(R + 13, 1); c.lineTo(R + 12, 5); c.lineTo(3, 7); c.closePath();
    c.fill(); c.stroke();
    c.beginPath(); c.arc(R + 12.5, 2.5, 2.2, 0, TAU); c.fillStyle = OUT; c.fill();
    // eye
    c.save(); if (!o.flash) { c.shadowColor = look.eyeGlow || '#facc15'; c.shadowBlur = 8; }
    c.beginPath(); c.ellipse(5, -3, 2.8, 1.6, -0.2, 0, TAU); c.fillStyle = F(look.eyeGlow || '#facc15'); c.fill();
    c.restore();
    // gold headband
    if (look.hair2) { c.strokeStyle = F(look.hair2); c.lineWidth = 3.5; c.beginPath(); c.arc(-1, 0, R * 0.95, Math.PI * 1.05, Math.PI * 1.55); c.stroke(); }
    if (look.crown) {
      c.fillStyle = F('#facc15');
      c.beginPath(); c.moveTo(-9, -R + 2); c.lineTo(-4, -R - 6); c.lineTo(1, -R + 1); c.closePath(); c.fill(); c.lineWidth = 1.6; c.strokeStyle = OUT; c.stroke();
    }
    void time;
  }

  // ---------- tiles ----------
  const TS = 48;
  const THEMES = {
    nile: { top: '#f3d38f', side: '#d39c58', dark: '#9a6430', line: 'rgba(95,50,15,.35)', glyph: 'rgba(110,55,20,.38)', plat: '#c58744', liquid: ['#4fb3e0', '#1d6fa3'], spike: '#e5e7eb' },
    storm: { top: '#e7b56c', side: '#bd8040', dark: '#7d4f22', line: 'rgba(70,35,10,.4)', glyph: 'rgba(90,45,10,.38)', plat: '#a86b33', liquid: ['#d9a25a', '#8c5a26'], spike: '#e5e7eb' },
    tomb: { top: '#d4a73a', side: '#585770', dark: '#34334b', line: 'rgba(0,0,0,.4)', glyph: 'rgba(212,167,58,.42)', plat: '#7a6a4a', liquid: ['#d1ad62', '#7b5d2b'], spike: '#facc15' },
    abyss: { top: '#5eead4', side: '#352a4a', dark: '#1d162b', line: 'rgba(0,0,0,.45)', glyph: 'rgba(94,234,212,.42)', plat: '#4b3d63', liquid: ['#a3e635', '#3f6212'], spike: '#c4b5fd' },
  };
  const GLYPHS = [
    g => { g.beginPath(); g.ellipse(24, 26, 8, 4.5, 0, 0, TAU); g.stroke(); g.beginPath(); g.arc(24, 26, 2, 0, TAU); g.fill(); g.beginPath(); g.moveTo(20, 30); g.lineTo(18, 37); g.stroke(); },
    g => { g.beginPath(); g.ellipse(24, 18, 4, 5, 0, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(24, 23); g.lineTo(24, 38); g.moveTo(17, 27); g.lineTo(31, 27); g.stroke(); },
    g => { g.beginPath(); g.moveTo(15, 36); g.quadraticCurveTo(20, 16, 30, 20); g.lineTo(34, 18); g.moveTo(26, 30); g.lineTo(26, 38); g.moveTo(22, 31); g.lineTo(20, 38); g.stroke(); },
    g => { g.beginPath(); for (let i = 0; i < 4; i++) { g.moveTo(14 + i * 6, 34); g.lineTo(17 + i * 6, 22); g.lineTo(20 + i * 6, 34); } g.stroke(); },
    () => {},
  ];
  function tileCanvas(k, fn) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = Math.ceil(TS * k);
    const g = cv.getContext('2d'); g.scale(k, k); fn(g); return cv;
  }
  function blockBase(g, th, v) {
    const gr = g.createLinearGradient(0, 0, 0, TS);
    gr.addColorStop(0, th.side); gr.addColorStop(1, shade(th.side, -0.18));
    g.fillStyle = gr; g.fillRect(0, 0, TS, TS);
    g.fillStyle = th.line;
    g.fillRect(0, 23, TS, 2); g.fillRect(v % 2 ? 30 : 12, 0, 2, 23); g.fillRect(v % 2 ? 8 : 34, 25, 2, 23);
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, 0, TS, 2); g.fillRect(0, 25, TS, 1.5);
    g.strokeStyle = th.glyph; g.fillStyle = th.glyph; g.lineWidth = 1.6; g.lineCap = 'round';
    if (v < 3) GLYPHS[v](g);
  }
  function tileSprites(themeName, k) {
    const th = THEMES[themeName];
    const mids = [0, 1, 2, 3, 4, 4, 4].map(v => tileCanvas(k, g => blockBase(g, th, v)));
    const tops = [0, 1, 4, 4].map(v => tileCanvas(k, g => {
      blockBase(g, th, v);
      const gr = g.createLinearGradient(0, 0, 0, 12);
      gr.addColorStop(0, shade(th.top, 0.25)); gr.addColorStop(1, th.top);
      g.fillStyle = gr; g.fillRect(0, 0, TS, 11);
      g.fillStyle = shade(th.top, -0.35); g.fillRect(0, 11, TS, 2.5);
      if (themeName === 'tomb' || themeName === 'abyss') { g.fillStyle = 'rgba(0,0,0,.25)'; for (let x = 4; x < TS; x += 12) g.fillRect(x, 3, 6, 5); }
      else { g.fillStyle = 'rgba(255,255,255,.35)'; for (let x = 3; x < TS; x += 9) g.fillRect(x, 2, 3, 1.5); }
    }));
    const plat = tileCanvas(k, g => {
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(6, 14, 4, 18); g.fillRect(38, 14, 4, 18);
      const gr = g.createLinearGradient(0, 0, 0, 15);
      gr.addColorStop(0, shade(th.plat, 0.35)); gr.addColorStop(1, shade(th.plat, -0.2));
      g.fillStyle = gr; g.fillRect(0, 0, TS, 15);
      g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2; g.strokeRect(1, 1, TS - 2, 13);
      g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(16, 2, 2, 11); g.fillRect(32, 2, 2, 11);
    });
    const brk = tileCanvas(k, g => {
      const gr = g.createLinearGradient(0, 0, TS, TS);
      gr.addColorStop(0, '#d98b52'); gr.addColorStop(1, '#8f4a22');
      g.fillStyle = gr; g.fillRect(1, 1, TS - 2, TS - 2);
      g.strokeStyle = 'rgba(40,15,5,.7)'; g.lineWidth = 2.5; g.strokeRect(2, 2, TS - 4, TS - 4);
      g.lineWidth = 1.6; g.beginPath(); g.moveTo(10, 8); g.lineTo(20, 22); g.lineTo(14, 34); g.moveTo(20, 22); g.lineTo(34, 26); g.lineTo(40, 40); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(4, 4, TS - 8, 4);
    });
    const spike = tileCanvas(k, g => {
      for (let i = 0; i < 3; i++) {
        const x = i * 16;
        const gr = g.createLinearGradient(x, 0, x + 16, 0);
        gr.addColorStop(0, shade(th.spike, -0.45)); gr.addColorStop(0.5, th.spike); gr.addColorStop(1, shade(th.spike, -0.5));
        g.fillStyle = gr; g.beginPath(); g.moveTo(x + 1, TS); g.lineTo(x + 8, TS - 30); g.lineTo(x + 15, TS); g.closePath(); g.fill();
        g.strokeStyle = OUT; g.lineWidth = 1.5; g.stroke();
      }
    });
    return { mids, tops, plat, brk, spike };
  }
  function drawLiquid(c, theme, x, y, w, t, top) {
    const th = THEMES[theme];
    const gr = c.createLinearGradient(0, y, 0, y + TS);
    gr.addColorStop(0, th.liquid[0]); gr.addColorStop(1, th.liquid[1]);
    c.fillStyle = gr;
    c.beginPath(); c.moveTo(x, y + TS);
    if (top) for (let i = 0; i <= w; i += 6) c.lineTo(x + i, y + 8 + Math.sin((x + i) * 0.05 + t * 3) * 3);
    else { c.lineTo(x, y); c.lineTo(x + w, y); }
    c.lineTo(x + w, y + TS); c.closePath(); c.fill();
    if (top) {
      c.fillStyle = 'rgba(255,255,255,.3)';
      for (let i = 0; i < w; i += 22) c.fillRect(x + i + Math.sin(t * 2 + i) * 4, y + 9 + Math.sin((x + i) * 0.05 + t * 3) * 3, 8, 2);
    }
  }

  // ---------- backgrounds ----------
  function band(c, camX, f, y, color, amp, freq, seed) {
    c.fillStyle = color;
    c.beginPath(); c.moveTo(0, 540);
    for (let x = 0; x <= VW; x += 16) {
      const wx = x + camX * f;
      c.lineTo(x, y + Math.sin(wx * freq + seed) * amp + Math.sin(wx * freq * 2.7 + seed * 2) * amp * 0.4);
    }
    c.lineTo(VW, 540); c.closePath(); c.fill();
  }
  function repeat(camX, f, tw, fn) {
    const off = camX * f, first = Math.floor(off / tw), last = Math.floor((off + VW) / tw);
    for (let i = first; i <= last; i++) fn(i * tw - off, mulberry32(i * 7919 + tw), i);
  }
  function pyramid(c, x, base, w, h, lit, darkc) {
    c.fillStyle = lit; c.beginPath(); c.moveTo(x - w / 2, base); c.lineTo(x, base - h); c.lineTo(x + w / 2, base); c.closePath(); c.fill();
    c.fillStyle = darkc; c.beginPath(); c.moveTo(x, base - h); c.lineTo(x + w / 2, base); c.lineTo(x + w * 0.12, base); c.closePath(); c.fill();
  }
  function palm(c, x, y, s, col) {
    c.strokeStyle = col; c.fillStyle = col; c.lineCap = 'round';
    c.lineWidth = 7 * s; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 14 * s, y - 60 * s, x + 6 * s, y - 120 * s); c.stroke();
    const tx = x + 6 * s, ty = y - 120 * s;
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI + i * Math.PI / 5;
      c.lineWidth = 6 * s;
      c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo(tx + Math.cos(a) * 40 * s, ty - 26 * s, tx + Math.cos(a) * 70 * s, ty + 14 * s + Math.abs(Math.sin(a)) * 10 * s); c.stroke();
    }
  }
  function drawBG(c, theme, camX, camY, t) {
    if (theme === 'nile' || theme === 'storm') {
      const storm = theme === 'storm';
      const sky = c.createLinearGradient(0, 0, 0, 540);
      if (storm) { sky.addColorStop(0, '#6b3a1f'); sky.addColorStop(0.5, '#c2753a'); sky.addColorStop(1, '#e9b067'); }
      else { sky.addColorStop(0, '#2c1f5e'); sky.addColorStop(0.45, '#c2507a'); sky.addColorStop(0.75, '#ff9e5e'); sky.addColorStop(1, '#ffd08a'); }
      c.fillStyle = sky; c.fillRect(0, 0, VW, 540);
      const sx = 700 - camX * 0.02, sy = storm ? 150 : 300;
      const sg = c.createRadialGradient(sx, sy, 10, sx, sy, storm ? 120 : 220);
      sg.addColorStop(0, storm ? 'rgba(255,230,170,.75)' : 'rgba(255,245,200,.95)'); sg.addColorStop(0.3, storm ? 'rgba(255,200,120,.3)' : 'rgba(255,190,120,.5)'); sg.addColorStop(1, 'rgba(255,160,90,0)');
      c.fillStyle = sg; c.fillRect(0, 0, VW, 540);
      c.beginPath(); c.arc(sx, sy, storm ? 40 : 70, 0, TAU); c.fillStyle = storm ? 'rgba(255,236,190,.8)' : '#fff1c1'; c.fill();
      const by = 420 - camY * 0.2;
      repeat(camX, 0.06, 700, (x, r) => {
        pyramid(c, x + 200, by, 360, 210, storm ? '#a8683a' : '#b5627a', storm ? '#7d4a26' : '#7e3f63');
        pyramid(c, x + 470, by, 220, 130, storm ? '#9a5f33' : '#a3566f', storm ? '#6f4021' : '#6f3657');
        void r;
      });
      band(c, camX, 0.15, by - 10, storm ? '#b0713a' : '#c46d5c', 14, 0.006, 1);
      if (!storm) {
        c.fillStyle = '#4fa3c7'; c.fillRect(0, by + 8, VW, 30);
        c.fillStyle = 'rgba(255,240,200,.55)';
        for (let i = 0; i < 30; i++) c.fillRect(((i * 97 - camX * 0.25 + Math.sin(t + i) * 8) % VW + VW) % VW, by + 12 + (i % 4) * 6, 14, 2);
        repeat(camX, 0.3, 260, (x, r) => { if (r() < 0.7) palm(c, x + r() * 120, by + 18, 0.6 + r() * 0.3, '#3b1d3f'); });
      }
      band(c, camX, 0.3, by + 30, storm ? '#93582b' : '#8a3f52', 18, 0.004, 3);
      repeat(camX, 0.5, 420, (x, r) => {
        const cx = x + r() * 200;
        c.fillStyle = storm ? 'rgba(90,50,20,.55)' : 'rgba(60,24,50,.6)';
        for (let k = 0; k < 3; k++) c.fillRect(cx + k * 40, by - 60 + 20, 18, 140);
        c.fillRect(cx - 10, by - 50, 118, 14);
      });
      if (storm) {
        for (let i = 0; i < 60; i++) {
          const y = (i * 53) % 540, x = ((i * 131 - t * (500 + (i % 5) * 120) - camX * 0.6) % (VW + 200) + VW + 200) % (VW + 200) - 100;
          c.fillStyle = `rgba(255,220,160,${0.12 + (i % 4) * 0.05})`; c.fillRect(x, y, 40 + (i % 6) * 14, 2);
        }
        const haze = c.createLinearGradient(0, 0, 0, 540);
        haze.addColorStop(0, 'rgba(200,120,60,.15)'); haze.addColorStop(1, 'rgba(230,170,100,.35)');
        c.fillStyle = haze; c.fillRect(0, 0, VW, 540);
      }
    } else if (theme === 'tomb') {
      const g = c.createLinearGradient(0, 0, 0, 540);
      g.addColorStop(0, '#0f1224'); g.addColorStop(1, '#23223a');
      c.fillStyle = g; c.fillRect(0, 0, VW, 540);
      repeat(camX, 0.25, 300, (x, r) => {
        c.fillStyle = '#1b1c33'; c.fillRect(x + 10, 60, 280, 380);
        c.strokeStyle = 'rgba(212,167,58,.18)'; c.lineWidth = 2; c.strokeRect(x + 22, 72, 256, 356);
        c.fillStyle = 'rgba(212,167,58,.14)';
        for (let row = 0; row < 8; row++) for (let k = 0; k < 9; k++) if (r() < 0.6) c.fillRect(x + 34 + k * 27, 90 + row * 42, 12 + r() * 8, 18 + r() * 10);
      });
      repeat(camX, 0.45, 520, (x) => {
        // seated pharaoh statue silhouette
        c.fillStyle = '#121327';
        c.fillRect(x + 160, 250, 90, 230); c.fillRect(x + 140, 400, 130, 80);
        c.beginPath(); c.moveTo(x + 165, 250); c.lineTo(x + 205, 170); c.lineTo(x + 245, 250); c.closePath(); c.fill();
        c.beginPath(); c.arc(x + 205, 215, 24, 0, TAU); c.fill();
      });
      repeat(camX, 0.8, 380, (x, r, i) => {
        const tx = x + 150, ty = 220;
        const fl = 0.75 + 0.25 * Math.sin(t * 14 + i * 3) + 0.1 * Math.sin(t * 31 + i);
        const lg = c.createRadialGradient(tx, ty - 10, 4, tx, ty - 10, 180 * fl);
        lg.addColorStop(0, 'rgba(255,170,60,.35)'); lg.addColorStop(1, 'rgba(255,120,40,0)');
        c.fillStyle = lg; c.fillRect(tx - 200, ty - 210, 400, 400);
        c.fillStyle = '#3b2a1a'; c.fillRect(tx - 4, ty, 8, 34);
        c.fillStyle = '#facc15'; c.fillRect(tx - 9, ty - 4, 18, 6);
        c.fillStyle = '#fb923c'; c.beginPath(); c.moveTo(tx - 8, ty - 4); c.quadraticCurveTo(tx, ty - 34 * fl, tx + 8, ty - 4); c.fill();
        c.fillStyle = '#fde68a'; c.beginPath(); c.moveTo(tx - 4, ty - 4); c.quadraticCurveTo(tx, ty - 20 * fl, tx + 4, ty - 4); c.fill();
        void r;
      });
      for (let i = 0; i < 25; i++) {
        c.fillStyle = 'rgba(255,220,160,.25)';
        c.fillRect((i * 73 + Math.sin(t * 0.5 + i) * 30) % VW, (i * 41 + t * 8) % 540, 2, 2);
      }
    } else {
      const g = c.createLinearGradient(0, 0, 0, 540);
      g.addColorStop(0, '#0b0716'); g.addColorStop(0.6, '#1c1035'); g.addColorStop(1, '#0f2a24');
      c.fillStyle = g; c.fillRect(0, 0, VW, 540);
      repeat(camX, 0.2, 340, (x, r) => {
        for (let k = 0; k < 3; k++) {
          const cx = x + r() * 300, cy = 260 + r() * 200, hgt = 40 + r() * 90;
          c.save(); c.shadowColor = '#34d399'; c.shadowBlur = 18;
          c.fillStyle = `rgba(52,211,153,${0.25 + r() * 0.3})`;
          c.beginPath(); c.moveTo(cx - 12, cy); c.lineTo(cx, cy - hgt); c.lineTo(cx + 12, cy); c.closePath(); c.fill();
          c.restore();
        }
      });
      repeat(camX, 0.45, 160, (x, r) => {
        c.fillStyle = '#140c24';
        const h = 60 + r() * 120;
        c.beginPath(); c.moveTo(x, -camY * 0.3); c.lineTo(x + 40, h); c.lineTo(x + 80, -camY * 0.3); c.closePath(); c.fill();
      });
      const mist = c.createLinearGradient(0, 360, 0, 540);
      mist.addColorStop(0, 'rgba(132,204,22,0)'); mist.addColorStop(1, `rgba(132,204,22,${0.22 + 0.06 * Math.sin(t * 2)})`);
      c.fillStyle = mist; c.fillRect(0, 360, VW, 180);
      for (let i = 0; i < 30; i++) {
        c.fillStyle = 'rgba(190,255,200,.35)';
        c.fillRect((i * 89 + Math.sin(t + i) * 20) % VW, 540 - ((i * 37 + t * 30) % 540), 2, 2);
      }
    }
  }

  // ---------- creatures ----------
  function outline(c, w = 2.2) { c.lineWidth = w; c.strokeStyle = OUT; c.stroke(); }
  function drawScarab(c, x, y, face, t, flash) {
    c.save(); c.translate(x, y); c.scale(face, 1);
    c.strokeStyle = OUT; c.lineWidth = 2.5; c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const ph = Math.sin(t * 22 + i * 2) * 3;
      c.beginPath(); c.moveTo(-6 + i * 8, -6); c.lineTo(-10 + i * 8 + ph, 0); c.stroke();
    }
    c.beginPath(); c.ellipse(0, -11, 15, 10, 0, Math.PI, TAU); c.lineTo(15, -9); c.lineTo(-15, -9); c.closePath();
    const g = c.createLinearGradient(0, -21, 0, -9);
    g.addColorStop(0, flash ? '#fff' : '#34d399'); g.addColorStop(1, flash ? '#fff' : '#065f46');
    c.fillStyle = g; c.fill(); outline(c);
    c.beginPath(); c.moveTo(0, -21); c.lineTo(0, -9); c.stroke();
    c.beginPath(); c.arc(16, -10, 5, 0, TAU); c.fillStyle = flash ? '#fff' : '#064e3b'; c.fill(); outline(c, 1.8);
    c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(-6, -16, 5, 2, -0.3, 0, TAU); c.fill();
    c.restore();
  }
  function drawVulture(c, x, y, face, t, flash) {
    c.save(); c.translate(x, y); c.scale(face, 1);
    const flap = Math.sin(t * 11);
    const body = flash ? '#fff' : '#3f2a22', wing = flash ? '#fff' : '#2b1b16';
    for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(-6, -4);
      c.quadraticCurveTo(-20, -26 * flap * s - 4, -46, -14 * flap * s - 10 * s * 0);
      c.lineTo(-30, 2); c.closePath();
      c.fillStyle = s > 0 ? wing : shade('#3f2a22', 0.15); c.fill(); outline(c);
    }
    c.beginPath(); c.ellipse(0, 0, 20, 11, -0.1, 0, TAU); c.fillStyle = body; c.fill(); outline(c);
    c.beginPath(); c.moveTo(14, -6); c.quadraticCurveTo(24, -16, 28, -10); c.lineWidth = 5; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3; c.strokeStyle = flash ? '#fff' : '#f0a58a'; c.stroke();
    c.beginPath(); c.arc(29, -11, 5.5, 0, TAU); c.fillStyle = flash ? '#fff' : '#f0a58a'; c.fill(); outline(c, 1.8);
    c.beginPath(); c.moveTo(33, -12); c.lineTo(40, -8); c.lineTo(33, -8); c.closePath(); c.fillStyle = '#facc15'; c.fill(); outline(c, 1.4);
    c.beginPath(); c.arc(30, -13, 1.4, 0, TAU); c.fillStyle = OUT; c.fill();
    c.beginPath(); c.moveTo(-18, 4); c.lineTo(-30, 10); c.lineTo(-18, 9); c.closePath(); c.fillStyle = body; c.fill(); outline(c, 1.6);
    c.restore();
  }
  function drawCobra(c, x, y, face, rise, t, flash) {
    c.save(); c.translate(x, y); c.scale(face, 1);
    const sk = flash ? '#fff' : '#a3a83a', belly = flash ? '#fff' : '#f2e3a0';
    c.beginPath(); c.ellipse(-4, -7, 22, 8, 0, 0, TAU); c.fillStyle = sk; c.fill(); outline(c);
    const hy = -22 - rise * 26 + Math.sin(t * 3) * 2;
    c.lineCap = 'round';
    c.strokeStyle = OUT; c.lineWidth = 13; c.beginPath(); c.moveTo(4, -10); c.quadraticCurveTo(14, -14, 8, hy); c.stroke();
    c.strokeStyle = sk; c.lineWidth = 9; c.stroke();
    c.beginPath(); c.ellipse(8, hy + 2, 13, 17, 0, 0, TAU); c.fillStyle = sk; c.fill(); outline(c);
    c.beginPath(); c.ellipse(9, hy + 6, 6, 11, 0, 0, TAU); c.fillStyle = belly; c.fill();
    c.beginPath(); c.ellipse(13, hy - 10, 8, 6, 0.2, 0, TAU); c.fillStyle = sk; c.fill(); outline(c);
    c.beginPath(); c.arc(16, hy - 12, 1.8, 0, TAU); c.fillStyle = '#ef4444'; c.fill();
    if (rise > 0.6) { c.strokeStyle = '#ef4444'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(20, hy - 8); c.lineTo(26, hy - 6); c.lineTo(24, hy - 10); c.stroke(); }
    c.restore();
  }
  function drawScorpion(c, x, y, face, t, st, flash) {
    c.save(); c.translate(x, y); c.scale(face, 1);
    const shell = flash ? '#fff' : '#7f1d1d', shell2 = flash ? '#fff' : '#b91c1c', gold = flash ? '#fff' : '#f59e0b';
    c.lineCap = 'round'; c.lineJoin = 'round';
    // legs
    for (let i = 0; i < 4; i++) {
      const lx = -70 + i * 34, ph = Math.sin(t * (st.walk ? 12 : 2) + i * 1.3) * 6;
      for (const s of [0, 1]) {
        c.strokeStyle = OUT; c.lineWidth = 8;
        c.beginPath(); c.moveTo(lx, -34); c.lineTo(lx - 14 + ph + s * 8, -54 + s * 4); c.lineTo(lx - 24 + ph + s * 8, 0); c.stroke();
        c.strokeStyle = s ? shell : shell2; c.lineWidth = 4.5; c.stroke();
      }
    }
    // tail (5 segments arcing over the back)
    const raise = st.tail || 0;
    let px = -95, py = -46;
    const segs = [];
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI * 0.5 - (i + 1) * 0.42 * (1 - raise * 0.35) + raise * 0.9;
      px += Math.cos(a) * -24; py += Math.sin(a) * 24;
      segs.push([px, py]);
    }
    let lx = -95, ly = -46;
    segs.forEach(([sx, sy], i) => {
      c.strokeStyle = OUT; c.lineWidth = 22 - i * 2.2; c.beginPath(); c.moveTo(lx, ly); c.lineTo(sx, sy); c.stroke();
      c.strokeStyle = i % 2 ? shell : shell2; c.lineWidth = 17 - i * 2.2; c.stroke();
      lx = sx; ly = sy;
    });
    const [tx, ty] = segs[segs.length - 1];
    c.save(); if (!flash) { c.shadowColor = '#fde047'; c.shadowBlur = 12; }
    c.beginPath(); c.moveTo(tx - 8, ty); c.quadraticCurveTo(tx + 14, ty - 2, tx + 22, ty + 16); c.quadraticCurveTo(tx + 6, ty + 8, tx - 6, ty + 10); c.closePath();
    c.fillStyle = gold; c.fill(); c.restore(); outline(c);
    // body
    c.beginPath(); c.ellipse(-20, -40, 88, 30, 0, 0, TAU);
    const bg = c.createLinearGradient(0, -70, 0, -10);
    bg.addColorStop(0, flash ? '#fff' : '#dc2626'); bg.addColorStop(1, shell);
    c.fillStyle = bg; c.fill(); outline(c, 3);
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(-60 + i * 30, -40, 8, 26, 0, -Math.PI * 0.4, Math.PI * 0.4); c.stroke(); }
    // claws
    const snap = st.claw || 0;
    for (const s of [0, 1]) {
      const cy = -38 + s * 14, ext = 40 + snap * 70;
      c.strokeStyle = OUT; c.lineWidth = 14; c.beginPath(); c.moveTo(50, cy); c.lineTo(60 + ext * 0.5, cy - 18); c.lineTo(60 + ext, cy - 6); c.stroke();
      c.strokeStyle = s ? shell : shell2; c.lineWidth = 9; c.stroke();
      const hx = 60 + ext, hy = cy - 6, open = (1 - snap) * 0.6 + 0.15;
      c.fillStyle = s ? shell : shell2;
      c.beginPath(); c.moveTo(hx, hy); c.quadraticCurveTo(hx + 26, hy - 26 * open - 6, hx + 34, hy - 4); c.lineTo(hx + 8, hy - 2); c.closePath(); c.fill(); outline(c);
      c.beginPath(); c.moveTo(hx, hy + 2); c.quadraticCurveTo(hx + 26, hy + 22 * open + 6, hx + 32, hy + 4); c.lineTo(hx + 8, hy + 4); c.closePath(); c.fill(); outline(c);
    }
    // eyes
    c.save(); if (!flash) { c.shadowColor = '#fde047'; c.shadowBlur = 10; }
    c.fillStyle = flash ? '#fff' : '#fde047';
    c.beginPath(); c.arc(52, -52, 4.5, 0, TAU); c.arc(40, -56, 3.5, 0, TAU); c.fill();
    c.restore();
    c.restore();
    return segs;
  }
  function drawSerpent(c, bx, by, hx, hy, t, open, flash, alpha, face) {
    c.save(); c.globalAlpha *= alpha;
    const sk = flash ? '#fff' : '#4c1d95', sk2 = flash ? '#fff' : '#7c3aed', belly = flash ? '#fff' : '#c4b5fd';
    const mx = (bx + hx) / 2 + Math.sin(t * 1.3 + bx) * 50, my = (by + hy) / 2 + 40;
    c.lineCap = 'round';
    c.strokeStyle = OUT; c.lineWidth = 40; c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(mx, my, hx, hy); c.stroke();
    c.strokeStyle = sk; c.lineWidth = 33; c.stroke();
    c.strokeStyle = belly; c.lineWidth = 10; c.setLineDash([10, 9]); c.stroke(); c.setLineDash([]);
    c.translate(hx, hy); c.scale(face, 1);
    // hood
    c.beginPath(); c.ellipse(-6, 4, 34, 40, 0, 0, TAU); c.fillStyle = sk2; c.fill(); outline(c, 3);
    c.strokeStyle = 'rgba(250,204,21,.7)'; c.lineWidth = 3;
    c.beginPath(); c.ellipse(-6, 4, 24, 30, 0, 0, TAU); c.stroke();
    // head + jaw
    c.beginPath(); c.moveTo(-14, -10); c.quadraticCurveTo(10, -26, 40, -10 - open * 6); c.lineTo(42, -4 - open * 4); c.quadraticCurveTo(10, -2, -14, 6); c.closePath();
    c.fillStyle = sk; c.fill(); outline(c, 2.5);
    c.beginPath(); c.moveTo(-10, 6); c.quadraticCurveTo(14, 6 + open * 10, 38, 2 + open * 16); c.lineTo(36, 8 + open * 18); c.quadraticCurveTo(10, 16 + open * 6, -10, 12); c.closePath();
    c.fillStyle = sk; c.fill(); outline(c, 2.5);
    if (open > 0.2) {
      c.fillStyle = '#f1f5f9';
      c.beginPath(); c.moveTo(30, -6); c.lineTo(33, 6); c.lineTo(36, -6); c.fill();
      c.beginPath(); c.moveTo(22, 6 + open * 12); c.lineTo(25, -2 + open * 10); c.lineTo(28, 6 + open * 13); c.fill();
    }
    c.save(); if (!flash) { c.shadowColor = '#f43f5e'; c.shadowBlur = 14; }
    c.fillStyle = flash ? '#fff' : '#f43f5e'; c.beginPath(); c.ellipse(16, -12, 5, 3.2, -0.2, 0, TAU); c.fill();
    c.restore();
    c.restore();
  }

  // ---------- items & objects ----------
  function drawCoin(c, x, y, t) {
    const sx = Math.abs(Math.cos(t * 3)) * 0.85 + 0.15;
    c.save(); c.translate(x, y + Math.sin(t * 4) * 2); c.scale(sx, 1);
    c.beginPath(); c.arc(0, 0, 10, 0, TAU);
    const g = c.createRadialGradient(-3, -4, 1, 0, 0, 10);
    g.addColorStop(0, '#fff7c2'); g.addColorStop(0.5, '#facc15'); g.addColorStop(1, '#b45309');
    c.fillStyle = g; c.fill(); outline(c, 1.8);
    c.strokeStyle = '#92400e'; c.lineWidth = 1.8;
    c.beginPath(); c.ellipse(0, -3, 2.6, 3.2, 0, 0, TAU); c.moveTo(0, 0); c.lineTo(0, 6); c.moveTo(-4, 1.5); c.lineTo(4, 1.5); c.stroke();
    c.restore();
  }
  function drawLetter(c, x, y, ch, t) {
    c.save(); c.translate(x, y + Math.sin(t * 3) * 4);
    c.shadowColor = '#facc15'; c.shadowBlur = 18;
    c.beginPath(); c.moveTo(0, -20); c.lineTo(18, 0); c.lineTo(0, 20); c.lineTo(-18, 0); c.closePath();
    const g = c.createLinearGradient(0, -20, 0, 20);
    g.addColorStop(0, '#fff3b0'); g.addColorStop(1, '#d97706');
    c.fillStyle = g; c.fill(); c.shadowBlur = 0; outline(c, 2.2);
    c.font = '20px Cinzel, Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#4a1d05'; c.fillText(ch, 0, 1);
    c.restore();
  }
  const POTION_COL = { flame: '#f97316', storm: '#38bdf8', shield: '#facc15' };
  function drawPotion(c, x, y, type, t) {
    const col = POTION_COL[type];
    c.save(); c.translate(x, y + Math.sin(t * 3) * 3);
    c.shadowColor = col; c.shadowBlur = 16;
    c.beginPath(); c.moveTo(-4, -26); c.lineTo(4, -26); c.lineTo(4, -16); c.quadraticCurveTo(15, -10, 13, 2); c.quadraticCurveTo(10, 12, 0, 12); c.quadraticCurveTo(-10, 12, -13, 2); c.quadraticCurveTo(-15, -10, -4, -16); c.closePath();
    c.fillStyle = 'rgba(255,255,255,.25)'; c.fill(); c.shadowBlur = 0; outline(c, 2);
    c.beginPath(); c.moveTo(-12, -2); c.quadraticCurveTo(0, -6 + Math.sin(t * 6) * 2, 12, -2); c.quadraticCurveTo(10, 11, 0, 11); c.quadraticCurveTo(-10, 11, -12, -2); c.fillStyle = col; c.fill();
    c.fillStyle = '#92400e'; c.fillRect(-5, -31, 10, 6); c.strokeRect(-5, -31, 10, 6);
    c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(-6, -4, 2, 4, 0.3, 0, TAU); c.fill();
    c.restore();
  }
  function drawJar(c, x, y, t) {
    c.save(); c.translate(x, y + Math.sin(t * 3) * 2);
    c.beginPath(); c.moveTo(-6, -24); c.lineTo(6, -24); c.lineTo(5, -18); c.quadraticCurveTo(16, -12, 13, 4); c.quadraticCurveTo(8, 12, 0, 12); c.quadraticCurveTo(-8, 12, -13, 4); c.quadraticCurveTo(-16, -12, -5, -18); c.closePath();
    c.fillStyle = '#c2410c'; c.fill(); outline(c, 2);
    c.fillStyle = '#fde68a'; c.fillRect(-12, -6, 24, 4);
    c.fillStyle = '#ef4444'; c.font = '13px Georgia'; c.textAlign = 'center'; c.fillText('♥', 0, 8);
    c.restore();
  }
  function drawObelisk(c, x, y, lit, t) {
    c.save(); c.translate(x, y);
    c.beginPath(); c.moveTo(-14, 0); c.lineTo(-10, -100); c.lineTo(0, -116); c.lineTo(10, -100); c.lineTo(14, 0); c.closePath();
    const g = c.createLinearGradient(-14, 0, 14, 0);
    g.addColorStop(0, '#7c5a2a'); g.addColorStop(0.5, '#d9b26a'); g.addColorStop(1, '#6b4b20');
    c.fillStyle = g; c.fill(); outline(c, 2.2);
    c.fillStyle = 'rgba(70,40,10,.45)';
    for (let i = 0; i < 5; i++) c.fillRect(-4, -88 + i * 16, 8, 8);
    c.beginPath(); c.moveTo(-10, -100); c.lineTo(0, -116); c.lineTo(10, -100); c.closePath();
    c.fillStyle = lit ? '#fde047' : '#78716c'; c.fill();
    if (lit) {
      const r = 50 + Math.sin(t * 4) * 6;
      const lg = c.createRadialGradient(0, -106, 2, 0, -106, r);
      lg.addColorStop(0, 'rgba(253,224,71,.8)'); lg.addColorStop(1, 'rgba(253,224,71,0)');
      c.fillStyle = lg; c.fillRect(-r, -106 - r, r * 2, r * 2);
    }
    c.restore();
  }
  function drawGate(c, x, y, t) {
    c.save(); c.translate(x, y);
    const g = c.createLinearGradient(-60, 0, 60, 0);
    g.addColorStop(0, '#92400e'); g.addColorStop(0.5, '#facc15'); g.addColorStop(1, '#92400e');
    c.fillStyle = g;
    c.fillRect(-60, -150, 22, 150); c.fillRect(38, -150, 22, 150); c.fillRect(-70, -170, 140, 24);
    c.strokeStyle = OUT; c.lineWidth = 2.5; c.strokeRect(-60, -150, 22, 150); c.strokeRect(38, -150, 22, 150); c.strokeRect(-70, -170, 140, 24);
    const pg = c.createLinearGradient(0, -146, 0, 0);
    pg.addColorStop(0, `rgba(253,224,71,${0.5 + 0.2 * Math.sin(t * 3)})`); pg.addColorStop(1, 'rgba(251,146,60,.15)');
    c.fillStyle = pg; c.fillRect(-38, -146, 76, 146);
    c.fillStyle = '#7c2d12'; c.font = '18px Cinzel, Georgia'; c.textAlign = 'center'; c.fillText('☥', 0, -152);
    c.restore();
  }
  function drawPlatform(c, x, y, w, theme) {
    const th = THEMES[theme];
    const g = c.createLinearGradient(0, y, 0, y + 18);
    g.addColorStop(0, shade(th.plat, 0.4)); g.addColorStop(1, shade(th.plat, -0.25));
    c.fillStyle = g; c.fillRect(x - w / 2, y, w, 18);
    c.strokeStyle = OUT; c.lineWidth = 2.5; c.strokeRect(x - w / 2, y, w, 18);
    c.fillStyle = '#facc15'; c.fillRect(x - w / 2 + 6, y + 7, w - 12, 3);
  }
  function drawDisc(c, x, y, t) {
    c.save(); c.translate(x, y); c.rotate(t * 20);
    c.shadowColor = '#fde047'; c.shadowBlur = 18;
    c.beginPath();
    for (let i = 0; i <= 16; i++) { const a = i / 16 * TAU, r = i % 2 ? 11 : 17; i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    c.fillStyle = '#facc15'; c.fill(); c.shadowBlur = 0; outline(c, 1.8);
    c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.fillStyle = '#fff7c2'; c.fill();
    c.restore();
  }
  function drawArrow(c, x, y, dir) {
    c.save(); c.translate(x, y); c.scale(dir, 1);
    c.strokeStyle = OUT; c.lineWidth = 4.5; c.beginPath(); c.moveTo(-18, 0); c.lineTo(14, 0); c.stroke();
    c.strokeStyle = '#a16207'; c.lineWidth = 2.5; c.stroke();
    c.fillStyle = '#e5e7eb'; c.beginPath(); c.moveTo(20, 0); c.lineTo(12, -5); c.lineTo(12, 5); c.closePath(); c.fill(); outline(c, 1.2);
    c.fillStyle = '#ef4444'; c.fillRect(-20, -4, 6, 3); c.fillRect(-20, 1, 6, 3);
    c.restore();
  }
  function drawFireball(c, x, y, r, t, col1 = '#fff7c2', col2 = '#f97316') {
    const g = c.createRadialGradient(x, y, 1, x, y, r * 1.8);
    g.addColorStop(0, col1); g.addColorStop(0.4, col2); g.addColorStop(1, 'rgba(239,68,68,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 1.8 + Math.sin(t * 40) * 2, 0, TAU); c.fill();
  }
  function drawBolt(c, x, y, h, t, col = '#7dd3fc') {
    c.save(); c.shadowColor = col; c.shadowBlur = 16; c.strokeStyle = '#fff'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(x, y - h);
    for (let i = 1; i <= 6; i++) c.lineTo(x + Math.sin(t * 60 + i * 7) * 10, y - h + i * h / 6);
    c.stroke(); c.strokeStyle = col; c.lineWidth = 7; c.globalAlpha = 0.4; c.stroke();
    c.restore();
  }
  function drawBlob(c, x, y, r, col) {
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = col; c.fill(); outline(c, 1.8);
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, TAU); c.fill();
  }

  return { P, lerpPose, drawFighter, shade, OUT, THEMES, tileSprites, drawBG, drawLiquid, drawScarab, drawVulture, drawCobra, drawScorpion, drawSerpent, drawCoin, drawLetter, drawPotion, drawJar, drawObelisk, drawGate, drawPlatform, drawDisc, drawArrow, drawFireball, drawBolt, drawBlob, mulberry32 };
})();
