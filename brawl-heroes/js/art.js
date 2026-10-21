'use strict';
// Procedural art: posable cartoon fighters, parallax stages, items and props.
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
      const [t0, t1] = toe(ft, a);
      limb(c, [t0, t1], 8, [cf(look.shoes)]);
    }
    function arm(shp, el, ha, isBack) {
      const cf = isBack ? back : F;
      limb(c, [shp, el, ha], armW, [cf(sleeve[0]), cf(sleeve[1])]);
      blob(c, ha[0], ha[1], 5.5 * Math.sqrt(bulk), cf(look.gloves || look.skin));
    }

    // back arm + weapons
    arm(shB, elB, haB, true);
    if (look.blades) weapon(c, haB, p.aB + p.eB, 26, '#67e8f9', o.flash, true);
    leg(hipB, knB, ftB, p.tB + p.kB, true);
    leg(hipF, knF, ftF, p.tF + p.kF, false);

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

  // ---------- stages ----------
  function tiles(c, camX, f, tw, seed, fn) {
    const off = camX * f, first = Math.floor(off / tw), last = Math.floor((off + VW) / tw);
    for (let i = first; i <= last; i++) fn(i * tw - off, mulberry32(i * 7919 + seed), i);
  }
  function windows(c, x, y, w, h, rnd, lit, dark) {
    const cols = Math.max(1, Math.floor(w / 18)), rows = Math.max(1, Math.floor(h / 22));
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      c.fillStyle = rnd() < 0.35 ? lit : dark;
      c.fillRect(x + 6 + k * (w - 8) / cols, y + 8 + r * 22, 8, 11);
    }
  }
  function neon(c, x, y, text, color, t, size = 22) {
    c.save();
    c.font = `${size}px Bangers, Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const flick = Math.sin(t * 13 + x) > -0.95 ? 1 : 0.3;
    c.shadowColor = color; c.shadowBlur = 16 * flick;
    c.fillStyle = flick > 0.5 ? '#fff' : color;
    c.strokeStyle = color; c.lineWidth = 3;
    c.strokeText(text, x, y); c.fillText(text, x, y);
    c.restore();
  }

  const SIGNS = ['ARCADE', 'NOODLES', 'GYM', 'BAR', 'HOTEL', 'PIZZA', 'DOJO', 'KARAOKE', 'GARAGE', '24/7'];
  const NEONS = ['#f472b6', '#22d3ee', '#facc15', '#a78bfa', '#4ade80', '#fb7185'];

  function downtown(c, camX, t) {
    const sky = c.createLinearGradient(0, 0, 0, GT);
    sky.addColorStop(0, '#1d1340'); sky.addColorStop(0.5, '#7a2f72'); sky.addColorStop(0.85, '#f2735a'); sky.addColorStop(1, '#ffb36b');
    c.fillStyle = sky; c.fillRect(0, 0, VW, GT);
    // synth sun
    const sx = 640 - camX * 0.02, sy = 215;
    const sg = c.createLinearGradient(0, sy - 100, 0, sy + 100);
    sg.addColorStop(0, '#fff3a0'); sg.addColorStop(1, '#ff4f8b');
    c.save(); c.beginPath(); c.arc(sx, sy, 100, 0, TAU); c.clip();
    c.fillStyle = sg; c.fillRect(sx - 100, sy - 100, 200, 200);
    c.fillStyle = '#f2735a';
    for (let i = 0; i < 7; i++) c.fillRect(sx - 100, sy + 10 + i * 13, 200, 2 + i * 1.2);
    c.restore();
    tiles(c, camX, 0.15, 480, 11, (x, rnd) => {
      for (let k = 0; k < 6; k++) {
        const w = 50 + rnd() * 50, h = 70 + rnd() * 140, bx = x + k * 80 + rnd() * 20;
        c.fillStyle = '#3a2160'; c.fillRect(bx, GT - h, w, h);
        windows(c, bx, GT - h, w, h, rnd, 'rgba(255,200,120,.5)', 'rgba(0,0,0,0)');
      }
    });
    tiles(c, camX, 0.4, 420, 23, (x, rnd) => {
      for (let k = 0; k < 4; k++) {
        const w = 70 + rnd() * 60, h = 120 + rnd() * 120, bx = x + k * 105 + rnd() * 15;
        c.fillStyle = '#26163f'; c.fillRect(bx, GT - h, w, h);
        if (rnd() < 0.5) { c.fillRect(bx + w / 2 - 2, GT - h - 26, 4, 26); c.fillStyle = '#ff5c7a'; c.fillRect(bx + w / 2 - 3, GT - h - 28, 6, 4); }
        windows(c, bx, GT - h, w, h, rnd, 'rgba(255,214,140,.75)', 'rgba(20,10,40,.6)');
      }
    });
    // storefront facade
    tiles(c, camX, 1, 320, 37, (x, rnd, i) => {
      const brick = ['#6e3240', '#5b3a4f', '#47406b', '#7a4636'][Math.floor(rnd() * 4)];
      const top = 70 + rnd() * 50;
      c.fillStyle = brick; c.fillRect(x, top, 320, GT - top);
      c.fillStyle = 'rgba(0,0,0,.14)';
      for (let yy = top + 6; yy < GT - 90; yy += 10) c.fillRect(x, yy, 320, 1.5);
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x, top, 320, 8); c.fillRect(x + 316, top, 4, GT - top);
      windows(c, x + 10, top + 20, 300, 110, rnd, 'rgba(255,215,150,.85)', 'rgba(25,15,40,.85)');
      // shop
      const lit = rnd() < 0.7;
      const wg = c.createLinearGradient(0, GT - 88, 0, GT - 10);
      wg.addColorStop(0, lit ? '#ffd88a' : '#2b2440'); wg.addColorStop(1, lit ? '#ff8f5a' : '#141024');
      c.fillStyle = '#1a1325'; c.fillRect(x + 14, GT - 96, 292, 90);
      c.fillStyle = wg; c.fillRect(x + 20, GT - 90, 190, 78);
      c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.moveTo(x + 40, GT - 90); c.lineTo(x + 70, GT - 90); c.lineTo(x + 30, GT - 12); c.lineTo(x + 20, GT - 12); c.closePath(); c.fill();
      c.fillStyle = '#2d2238'; c.fillRect(x + 226, GT - 86, 64, 80);
      c.fillStyle = '#e6b35a'; c.fillRect(x + 278, GT - 48, 5, 5);
      // awning
      const aw = NEONS[Math.floor(rnd() * NEONS.length)];
      for (let k = 0; k < 10; k++) { c.fillStyle = k % 2 ? '#f5f5f5' : aw; c.fillRect(x + 14 + k * 29.2, GT - 112, 29.2, 16); }
      c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x + 14, GT - 96, 292, 4);
      neon(c, x + 160, GT - 132, SIGNS[(i % SIGNS.length + SIGNS.length) % SIGNS.length], aw, t);
      // fire escape
      if (rnd() < 0.5) {
        c.strokeStyle = '#1b1424'; c.lineWidth = 3;
        for (let k = 0; k < 2; k++) { const yy = top + 40 + k * 48; c.strokeRect(x + 40, yy, 110, 6); c.beginPath(); c.moveTo(x + 50, yy + 6); c.lineTo(x + 140, yy + 48); c.stroke(); }
      }
      // street lamp
      if (i % 2 === 0) {
        c.fillStyle = '#1b1424'; c.fillRect(x + 300, GT - 175, 6, 175); c.fillRect(x + 284, GT - 178, 30, 6);
        const lg = c.createRadialGradient(x + 290, GT - 168, 2, x + 290, GT - 168, 70);
        lg.addColorStop(0, 'rgba(255,230,160,.85)'); lg.addColorStop(1, 'rgba(255,230,160,0)');
        c.fillStyle = lg; c.fillRect(x + 220, GT - 240, 140, 140);
      }
    });
    // street
    c.fillStyle = '#8d88a6'; c.fillRect(0, GT, VW, 44);
    c.fillStyle = 'rgba(0,0,0,.18)';
    tiles(c, camX, 1, 64, 5, x => { c.fillRect(x, GT, 2, 44); });
    c.fillStyle = '#d5d2e3'; c.fillRect(0, GT + 44, VW, 7);
    const road = c.createLinearGradient(0, GT + 51, 0, 540);
    road.addColorStop(0, '#3a3450'); road.addColorStop(1, '#2a2540');
    c.fillStyle = road; c.fillRect(0, GT + 51, VW, 540 - GT - 51);
    tiles(c, camX, 1, 160, 9, (x, rnd) => {
      c.fillStyle = '#f2c94c'; c.fillRect(x + 20, 460, 70, 6);
      c.fillStyle = 'rgba(255,255,255,.05)';
      for (let k = 0; k < 6; k++) c.fillRect(x + rnd() * 160, GT + 60 + rnd() * 140, 3 + rnd() * 6, 2);
    });
  }

  function harbor(c, camX, t) {
    const sky = c.createLinearGradient(0, 0, 0, GT);
    sky.addColorStop(0, '#070b24'); sky.addColorStop(0.6, '#182657'); sky.addColorStop(1, '#3b4a8a');
    c.fillStyle = sky; c.fillRect(0, 0, VW, GT);
    const srnd = mulberry32(3);
    for (let i = 0; i < 90; i++) {
      const x = (srnd() * VW * 2 - camX * 0.03) % VW, y = srnd() * 200;
      c.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * Math.abs(Math.sin(t * 2 + i))})`; c.fillRect((x + VW) % VW, y, 2, 2);
    }
    const mx = 220 - camX * 0.02;
    const mg = c.createRadialGradient(mx, 80, 10, mx, 80, 110);
    mg.addColorStop(0, 'rgba(220,230,255,.35)'); mg.addColorStop(1, 'rgba(220,230,255,0)');
    c.fillStyle = mg; c.fillRect(mx - 110, -30, 220, 220);
    c.beginPath(); c.arc(mx, 80, 34, 0, TAU); c.fillStyle = '#eef2ff'; c.fill();
    c.beginPath(); c.arc(mx + 12, 72, 30, 0, TAU); c.fillStyle = '#182657'; c.globalAlpha = 0.25; c.fill(); c.globalAlpha = 1;
    // distant cranes + ships
    tiles(c, camX, 0.2, 520, 41, (x, rnd) => {
      c.fillStyle = '#0f1736';
      c.fillRect(x + 60, 150, 10, 110); c.fillRect(x + 20, 150, 170, 8);
      c.beginPath(); c.moveTo(x + 65, 120); c.lineTo(x + 70, 150); c.lineTo(x + 60, 150); c.fill();
      c.fillRect(x + 300, 230, 160, 30); c.fillRect(x + 340, 205, 60, 25); c.fillRect(x + 360, 185, 10, 20);
      c.fillStyle = 'rgba(255,220,140,.8)';
      for (let k = 0; k < 6; k++) c.fillRect(x + 310 + k * 24, 240, 6, 5);
      c.fillStyle = '#ff4d6d'; c.fillRect(x + 186, 150, 4, 4);
    });
    // sea
    c.fillStyle = '#0d1a40'; c.fillRect(0, 258, VW, GT - 258);
    for (let i = 0; i < 26; i++) {
      const y = 262 + (i * 37 % 66), x = ((i * 173 - camX * 0.5 + Math.sin(t + i) * 12) % VW + VW) % VW;
      c.fillStyle = 'rgba(160,190,255,.25)'; c.fillRect(x, y, 30 + (i % 5) * 10, 2);
    }
    // containers
    tiles(c, camX, 1, 300, 53, (x, rnd, i) => {
      const cols = ['#b5302f', '#1f6f8b', '#2f7d4a', '#c27c0e', '#6b3fa0'];
      if (i % 3 === 2) {
        c.fillStyle = '#2a1d16'; c.fillRect(x + 40, GT - 36, 10, 36); c.fillRect(x + 250, GT - 36, 10, 36);
        c.fillStyle = '#1b130e'; c.fillRect(x + 30, GT - 40, 240, 6);
        return;
      }
      const stack = 1 + Math.floor(rnd() * 2);
      for (let s = 0; s < stack; s++) {
        const w = 250, h = 62, bx = x + 20 + (s ? rnd() * 30 : 0), by = GT - h * (s + 1) - 2;
        const col = cols[Math.floor(rnd() * cols.length)];
        c.fillStyle = col; c.fillRect(bx, by, w, h);
        c.fillStyle = 'rgba(0,0,0,.22)';
        for (let k = 0; k < w; k += 12) c.fillRect(bx + k, by + 4, 4, h - 8);
        c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(bx, by, w, 4);
        c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 2; c.strokeRect(bx, by, w, h);
        c.fillStyle = 'rgba(255,255,255,.7)'; c.font = '16px Bangers, Impact, sans-serif'; c.fillText(['OCEANIC', 'KAIJU LINE', 'MERIDIAN', 'TIDEWAY'][Math.floor(rnd() * 4)], bx + 14, by + 24);
      }
      // lamp
      c.fillStyle = '#121212'; c.fillRect(x + 285, GT - 200, 5, 200);
      const lg = c.createRadialGradient(x + 287, GT - 196, 3, x + 287, GT - 160, 120);
      lg.addColorStop(0, 'rgba(255,214,130,.7)'); lg.addColorStop(1, 'rgba(255,214,130,0)');
      c.fillStyle = lg; c.beginPath(); c.moveTo(x + 287, GT - 196); c.lineTo(x + 220, GT); c.lineTo(x + 354, GT); c.closePath(); c.fill();
    });
    // pier planks
    const pl = c.createLinearGradient(0, GT, 0, 540);
    pl.addColorStop(0, '#5d4232'); pl.addColorStop(1, '#3f2b20');
    c.fillStyle = pl; c.fillRect(0, GT, VW, 540 - GT);
    for (let y = GT + 12, row = 0; y < 540; y += 14 + row * 0.6, row++) {
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, y, VW, 2);
      tiles(c, camX, 1, 140 + row * 4, 61 + row, x => { c.fillRect(x + (row % 2) * 40, y - 12 - row * 0.6, 2, 13 + row * 0.6); });
    }
    c.fillStyle = '#2a1d16'; c.fillRect(0, GT, VW, 5);
  }

  function fortress(c, camX, t) {
    c.fillStyle = '#14141c'; c.fillRect(0, 0, VW, GT);
    tiles(c, camX, 0.5, 200, 71, (x, rnd) => {
      c.fillStyle = '#1d1e2a'; c.fillRect(x + 2, 0, 196, GT);
      c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = 2; c.strokeRect(x + 8, 20, 184, GT - 40);
      c.fillStyle = 'rgba(255,255,255,.08)';
      for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(x + 14 + k * 34, 26, 2, 0, TAU); c.fill(); }
      if (rnd() < 0.6) {
        const g = c.createLinearGradient(0, 80, 0, 180);
        g.addColorStop(0, 'rgba(34,211,238,.6)'); g.addColorStop(1, 'rgba(34,211,238,.1)');
        c.fillStyle = g; c.fillRect(x + 40, 80, 120, 80);
        c.strokeStyle = 'rgba(34,211,238,.8)'; c.strokeRect(x + 40, 80, 120, 80);
        c.fillStyle = 'rgba(255,255,255,.6)';
        for (let k = 0; k < 4; k++) c.fillRect(x + 50, 92 + k * 15, 30 + rnd() * 70, 3);
      }
    });
    // pipes
    for (const [y, r, colr] of [[54, 14, '#3b3f52'], [100, 9, '#4b3a3a']]) {
      const g = c.createLinearGradient(0, y - r, 0, y + r);
      g.addColorStop(0, shade(colr, 0.4)); g.addColorStop(0.5, colr); g.addColorStop(1, shade(colr, -0.5));
      c.fillStyle = g; c.fillRect(0, y - r, VW, r * 2);
      tiles(c, camX, 0.7, 180, 3, x => { c.fillStyle = shade(colr, -0.3); c.fillRect(x, y - r - 3, 12, r * 2 + 6); });
    }
    // pillars + alarm lights
    tiles(c, camX, 1, 360, 83, (x, rnd, i) => {
      const g = c.createLinearGradient(x, 0, x + 60, 0);
      g.addColorStop(0, '#2e3140'); g.addColorStop(0.5, '#4a4e63'); g.addColorStop(1, '#23252f');
      c.fillStyle = g; c.fillRect(x, 0, 60, GT);
      c.fillStyle = 'rgba(0,0,0,.3)';
      for (let y = 30; y < GT; y += 60) c.fillRect(x, y, 60, 4);
      const on = Math.sin(t * 4 + i) > 0;
      c.save(); c.shadowColor = '#ef4444'; c.shadowBlur = on ? 25 : 0;
      c.fillStyle = on ? '#ff4d4d' : '#5a1a1a'; c.beginPath(); c.arc(x + 30, 150, 9, 0, TAU); c.fill(); c.restore();
      if (on) {
        const rg = c.createRadialGradient(x + 30, 150, 5, x + 30, 150, 160);
        rg.addColorStop(0, 'rgba(255,60,60,.25)'); rg.addColorStop(1, 'rgba(255,60,60,0)');
        c.fillStyle = rg; c.fillRect(x - 130, -10, 320, 320);
      }
      neon(c, x + 210, 230, ['DANGER', 'SECTOR 9', 'NO ENTRY', 'REACTOR'][((i % 4) + 4) % 4], '#f43f5e', t, 26);
    });
    // hazard stripe
    c.save(); c.beginPath(); c.rect(0, GT - 22, VW, 22); c.clip();
    c.fillStyle = '#facc15'; c.fillRect(0, GT - 22, VW, 22);
    c.fillStyle = '#111';
    const o = -(camX % 40);
    for (let x = o - 40; x < VW + 40; x += 40) { c.beginPath(); c.moveTo(x, GT); c.lineTo(x + 20, GT); c.lineTo(x + 42, GT - 22); c.lineTo(x + 22, GT - 22); c.closePath(); c.fill(); }
    c.restore();
    // metal floor
    const fl = c.createLinearGradient(0, GT, 0, 540);
    fl.addColorStop(0, '#3a3e4e'); fl.addColorStop(1, '#22242f');
    c.fillStyle = fl; c.fillRect(0, GT, VW, 540 - GT);
    tiles(c, camX, 1, 96, 19, x => {
      c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x, GT); c.lineTo(x - 40, 540); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.05)';
      for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(x + 10 + k * 18, GT + 20); c.lineTo(x + 20 + k * 18, GT + 30); c.stroke(); }
    });
    for (const y of [GT + 60, GT + 130]) { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, y, VW, 3); }
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    c.fillStyle = `rgba(34,211,238,${0.25 + pulse * 0.3})`; c.fillRect(0, GT + 2, VW, 3);
  }

  const STAGE_FN = { downtown, harbor, fortress };
  function drawStage(c, theme, camX, t) {
    STAGE_FN[theme](c, camX, t);
    const vg = c.createRadialGradient(VW / 2, 300, 200, VW / 2, 300, 640);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)');
    c.fillStyle = vg; c.fillRect(0, 0, VW, 540);
  }

  // ---------- items & props ----------
  function drawItem(c, type, x, y, t) {
    const b = Math.sin(t * 4) * 2;
    c.save(); c.translate(x, y - 8 + b);
    c.lineWidth = 2.2; c.strokeStyle = OUT;
    switch (type) {
      case 'apple':
        c.beginPath(); c.arc(0, -8, 9, 0, TAU); c.fillStyle = '#ef4444'; c.fill(); c.stroke();
        c.fillStyle = '#22c55e'; c.beginPath(); c.ellipse(4, -19, 5, 2.5, -0.5, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(-3, -11, 2.5, 0, TAU); c.fill();
        break;
      case 'burger':
        c.fillStyle = '#e8a33d'; c.beginPath(); c.ellipse(0, -14, 14, 8, 0, Math.PI, TAU); c.fill(); c.stroke();
        c.fillStyle = '#4ade80'; c.fillRect(-14, -14, 28, 3);
        c.fillStyle = '#7c2d12'; c.fillRect(-13, -11, 26, 5); c.strokeRect(-13, -11, 26, 5);
        c.fillStyle = '#e8a33d'; c.beginPath(); c.roundRect ? c.roundRect(-13, -6, 26, 6, 3) : c.rect(-13, -6, 26, 6); c.fill(); c.stroke();
        break;
      case 'chicken':
        c.fillStyle = '#c2410c'; c.beginPath(); c.ellipse(-3, -10, 12, 9, -0.4, 0, TAU); c.fill(); c.stroke();
        c.strokeStyle = OUT; c.lineWidth = 6; c.beginPath(); c.moveTo(6, -6); c.lineTo(15, 0); c.stroke();
        c.strokeStyle = '#f5f5f4'; c.lineWidth = 3.5; c.stroke();
        c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-6, -14, 4, 2, -0.4, 0, TAU); c.fill();
        break;
      case 'roast':
        c.fillStyle = '#e5e7eb'; c.beginPath(); c.ellipse(0, -2, 22, 5, 0, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = '#b45309'; c.beginPath(); c.ellipse(0, -11, 16, 11, 0, Math.PI, TAU); c.lineTo(16, -4); c.lineTo(-16, -4); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.ellipse(-5, -16, 5, 2.5, 0, 0, TAU); c.fill();
        break;
      case 'coin':
        c.scale(Math.abs(Math.cos(t * 3)) * 0.8 + 0.2, 1);
        c.beginPath(); c.arc(0, -10, 9, 0, TAU); c.fillStyle = '#facc15'; c.fill(); c.stroke();
        c.fillStyle = '#a16207'; c.font = '12px Bangers, Impact'; c.textAlign = 'center'; c.fillText('$', 0, -6);
        break;
      case 'gem':
        c.save(); c.shadowColor = '#22d3ee'; c.shadowBlur = 14;
        c.beginPath(); c.moveTo(0, -24); c.lineTo(11, -14); c.lineTo(0, 0); c.lineTo(-11, -14); c.closePath();
        c.fillStyle = '#22d3ee'; c.fill(); c.restore(); c.stroke();
        c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.moveTo(0, -24); c.lineTo(4, -14); c.lineTo(-4, -14); c.closePath(); c.fill();
        break;
    }
    c.restore();
  }

  function drawProp(c, type, x, y, dmg) {
    c.save(); c.translate(x, y);
    c.lineWidth = 2.5; c.strokeStyle = OUT;
    if (dmg) c.rotate(Math.sin(dmg * 9) * 0.04);
    if (type === 'barrel') {
      const g = c.createLinearGradient(-20, 0, 20, 0);
      g.addColorStop(0, '#5b3416'); g.addColorStop(0.45, '#a2622b'); g.addColorStop(1, '#4a2a12');
      c.fillStyle = g; c.beginPath(); c.ellipse(0, -30, 21, 30, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#3f3f46'; c.fillRect(-21, -46, 42, 4); c.fillRect(-21, -18, 42, 4);
      c.beginPath(); c.ellipse(0, -58, 15, 4, 0, 0, TAU); c.fillStyle = '#7c4a1e'; c.fill(); c.stroke();
    } else if (type === 'crate') {
      c.fillStyle = '#b7853f'; c.fillRect(-26, -52, 52, 52); c.strokeRect(-26, -52, 52, 52);
      c.strokeStyle = '#6b4a1f'; c.lineWidth = 5;
      c.beginPath(); c.moveTo(-22, -48); c.lineTo(22, -4); c.moveTo(22, -48); c.lineTo(-22, -4); c.stroke();
      c.strokeStyle = OUT; c.lineWidth = 2.5; c.strokeRect(-22, -48, 44, 44);
    } else {
      const g = c.createLinearGradient(-20, 0, 20, 0);
      g.addColorStop(0, '#7f1d1d'); g.addColorStop(0.45, '#dc2626'); g.addColorStop(1, '#5f1515');
      c.fillStyle = g; c.fillRect(-19, -60, 38, 60); c.strokeRect(-19, -60, 38, 60);
      c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(-19, -42, 38, 3); c.fillRect(-19, -20, 38, 3);
      c.fillStyle = '#facc15'; c.beginPath(); c.moveTo(0, -36); c.lineTo(8, -24); c.lineTo(-8, -24); c.closePath(); c.fill();
      c.beginPath(); c.ellipse(0, -60, 19, 5, 0, 0, TAU); c.fillStyle = '#991b1b'; c.fill(); c.stroke();
    }
    if (dmg) {
      c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-8, -44); c.lineTo(0, -30); c.lineTo(-4, -20); c.moveTo(0, -30); c.lineTo(10, -26); c.stroke();
    }
    c.restore();
  }

  return { P, lerpPose, drawFighter, drawStage, drawItem, drawProp, shade, OUT };
})();
