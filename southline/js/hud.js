// HUD: clock, weapon, health/armor, cash, wanted stars, the rotating radar,
// zone/vehicle/radio captions, subtitles, help box, big banners and the map.
import { paintRadar } from './city.js';
import { WEAPONS } from './player.js';

const $ = s => document.querySelector(s);
const pad8 = n => '$' + String(Math.max(0, Math.floor(n))).padStart(8, '0');
const ICONS = {
  fists: '<path d="M7 11V7a1.5 1.5 0 0 1 3 0v3M10 10V6a1.5 1.5 0 0 1 3 0v4M13 10V7a1.5 1.5 0 0 1 3 0v4M16 11V9a1.5 1.5 0 0 1 3 0v4a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2-4a1.5 1.5 0 0 1 2.5-1.6L7 13"/>',
  bat: '<path d="M4 20l3-3M7 17L19 5a2 2 0 0 1 3 3L10 20z"/>',
  pistol: '<path d="M3 8h15l1 3h-6l-1 2h-2l-1 6H5l1-6H3z"/>',
  smg: '<path d="M2 9h17v3h-5l-1 2h-2l-1 6H6l1-6H2zM19 10h3M9 14v3"/>',
  shotgun: '<path d="M1 10h18l3 1v2h-9l-2 2H6l-1 3H2l1-4H1z"/>'
};

const ZONES = [['Starfish Docks', 76, 150], ['Downtown', 300, 110], ['Midtown', 230, 380], ['Little Coral', 110, 610], ['Palm Heights', 380, 600], ['Ocean Strip', 494, 300], ['Ocean Beach', 585, 420]];

export class HUD {
  constructor() {
    this.el = {
      root: $('#hud'), clock: $('#clock'), wIcon: $('#wIcon'), ammo: $('#ammo'), hp: $('#hp'), armor: $('#armor'), armorRow: $('#armorRow'),
      cash: $('#cash'), stars: $('#stars'), timer: $('#timer'), timerLabel: $('#timerLabel'), timerVal: $('#timerVal'),
      zone: $('#zone'), vehicle: $('#vehicle'), radio: $('#radioName'), help: $('#help'), sub: $('#subtitle'),
      obj: $('#objective'), big: $('#big'), bigT: $('#bigTitle'), bigS: $('#bigSub'), cross: $('#cross'), tint: $('#tint')
    };
    this.radarCanvas = $('#radar');
    this.rg = this.radarCanvas.getContext('2d');
    this.map = paintRadar(1024);
    for (let i = 0; i < 6; i++) this.el.stars.insertAdjacentHTML('beforeend', '<i><svg viewBox="0 0 24 24"><path d="M12 2l3 7 7 .6-5.4 4.7L18.3 22 12 18l-6.3 4 1.7-7.7L2 9.6 9 9z"/></svg></i>');
    this.starEls = [...this.el.stars.children];
    this.last = {};
    this.timers = {};
    this.subs = [];
    this.displayCash = 0;
  }
  show(on) { this.el.root.hidden = !on; }
  set(key, val, fn) { if (this.last[key] !== val) { this.last[key] = val; fn(val); } }
  flash(el, cls, t) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); clearTimeout(this.timers[cls]); this.timers[cls] = setTimeout(() => el.classList.remove(cls), t); }
  zone(name) { if (this.last.zoneName === name) return; this.last.zoneName = name; this.el.zone.textContent = name; this.flash(this.el.zone, 'show', 3200); }
  vehicle(name) { this.el.vehicle.textContent = name; this.flash(this.el.vehicle, 'show', 2600); }
  radio(st) { this.el.radio.innerHTML = st.off ? 'Radio off' : `${st.name}<small>${st.tag}</small>`; this.flash(this.el.radio, 'show', 2600); }
  help(text, t = 6000) {
    this.el.help.innerHTML = text; this.el.help.hidden = !text;
    clearTimeout(this.timers.help);
    if (text) this.timers.help = setTimeout(() => { this.el.help.hidden = true; }, t);
  }
  say(lines) {
    this.subs = lines.map(l => (typeof l === 'string' ? { text: l } : l));
    this.subT = 0;
    this.nextSub();
  }
  nextSub() {
    const s = this.subs.shift();
    if (!s) { this.el.sub.hidden = true; return; }
    this.el.sub.innerHTML = s.who ? `<b>${s.who}:</b> ${s.text}` : s.text;
    this.el.sub.hidden = false;
    this.subT = s.t || Math.max(2.6, s.text.length * 0.055);
  }
  objective(text) { this.el.obj.innerHTML = text || ''; this.el.obj.hidden = !text; if (text) this.flash(this.el.obj, 'show', 400); }
  banner(title, sub, color = '#ffd36b', t = 4000) {
    this.el.bigT.textContent = title; this.el.bigS.innerHTML = sub || '';
    this.el.big.style.setProperty('--c', color);
    this.el.big.hidden = false;
    this.flash(this.el.big, 'show', t);
    clearTimeout(this.timers.banner);
    this.timers.banner = setTimeout(() => { this.el.big.hidden = true; }, t);
  }
  timer(label, secs) {
    if (secs == null) { this.el.timer.hidden = true; return; }
    this.el.timer.hidden = false;
    this.el.timerLabel.textContent = label;
    this.el.timerVal.textContent = typeof secs === 'string' ? secs : `${Math.floor(Math.max(0, secs) / 60)}:${String(Math.floor(Math.max(0, secs) % 60)).padStart(2, '0')}`;
    this.el.timerVal.classList.toggle('hot', typeof secs === 'number' && secs < 10);
  }
  hurt(k) { this.el.tint.style.opacity = Math.min(0.6, k); }
  update(dt, G) {
    const P = G.player, e = this.el;
    if (this.subs.length || !e.sub.hidden) { this.subT -= dt; if (this.subT <= 0) this.nextSub(); }
    const h = Math.floor(G.hour), m = Math.floor((G.hour % 1) * 60);
    this.set('clock', h * 100 + m, () => { e.clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; });
    this.set('weapon', P.weapon, w => { e.wIcon.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[w]}</svg>`; });
    const ammo = WEAPONS[P.weapon].melee ? '' : P.ammo[P.weapon];
    this.set('ammo', ammo, a => { e.ammo.textContent = a; });
    this.set('hp', Math.max(0, Math.ceil(P.hp)), v => { e.hp.textContent = v; e.hp.parentElement.classList.toggle('low', v < 30); });
    this.set('armor', Math.ceil(P.armor), v => { e.armor.textContent = v; e.armorRow.hidden = v <= 0; });
    this.displayCash += (G.save.cash - this.displayCash) * Math.min(1, dt * 6);
    if (Math.abs(G.save.cash - this.displayCash) < 1) this.displayCash = G.save.cash;
    this.set('cash', Math.round(this.displayCash), v => { e.cash.textContent = pad8(v); });
    const flash = G.starFlash && Math.floor(G.now * 4) % 2 === 0;
    this.set('stars', G.stars * 10 + (flash ? 1 : 0), () => this.starEls.forEach((s, i) => { s.classList.toggle('on', i < G.stars && !flash); s.classList.toggle('dim', i < G.stars && flash); }));
    this.set('cross', P.onFoot && !WEAPONS[P.weapon].melee, v => { e.cross.hidden = !v; });
    e.cross.classList.toggle('aim', !!P.aiming);
    this.drawRadar(G);
  }
  // world -> radar pixels, rotated so the camera's forward is up
  drawRadar(G) {
    const c = this.radarCanvas, g = this.rg;
    const dpr = Math.min(2, devicePixelRatio || 1), S = c.clientWidth * dpr || 180;
    if (c.width !== S) { c.width = c.height = S; }
    const P = G.player, px = P.x, pz = P.z;
    const range = 95 + Math.min(80, (P.car ? P.car.speed : 0) * 2.2);
    const s = (S / 2) / range, cy = G.cam.yaw, cs = Math.cos(cy), sn = Math.sin(cy);
    const k = this.map.canvas.width / this.map.span;
    const cx0 = S / 2, cy0 = S / 2;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath(); g.arc(cx0, cy0, S / 2 - 1, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#245a86'; g.fillRect(0, 0, S, S);
    const dx0 = this.map.x0 - px, dz0 = this.map.z0 - pz;
    g.setTransform(-s * cs / k, -s * sn / k, s * sn / k, -s * cs / k, cx0 + s * (-cs * dx0 + sn * dz0), cy0 + s * (-sn * dx0 - cs * dz0));
    g.drawImage(this.map.canvas, 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    const toR = (x, z) => { const dx = x - px, dz = z - pz; return [cx0 + s * (-dx * cs + dz * sn), cy0 + s * (-dx * sn - dz * cs)]; };
    for (const b of G.blips()) {
      let [x, y] = toR(b.x, b.z);
      const dx = x - cx0, dy = y - cy0, d = Math.hypot(dx, dy), lim = S / 2 - 9 * dpr;
      if (d > lim) { if (!b.edge) continue; x = cx0 + dx / d * lim; y = cy0 + dy / d * lim; }
      this.blip(g, x, y, b, dpr);
    }
    // player arrow
    const hx = -Math.sin(P.yaw) * cs + Math.cos(P.yaw) * sn, hy = -Math.sin(P.yaw) * sn - Math.cos(P.yaw) * cs;
    g.save(); g.translate(cx0, cy0); g.rotate(Math.atan2(hx, -hy));
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5 * dpr;
    g.beginPath(); g.moveTo(0, -8 * dpr); g.lineTo(6 * dpr, 7 * dpr); g.lineTo(0, 3 * dpr); g.lineTo(-6 * dpr, 7 * dpr); g.closePath(); g.fill(); g.stroke();
    g.restore();
    g.restore();
    // ring + north
    g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 4 * dpr;
    g.beginPath(); g.arc(cx0, cy0, S / 2 - 2 * dpr, 0, Math.PI * 2); g.stroke();
    const [nx, ny] = toR(px, pz - 1000);
    const nd = Math.hypot(nx - cx0, ny - cy0), nr = S / 2 - 9 * dpr;
    const qx = cx0 + (nx - cx0) / nd * nr, qy = cy0 + (ny - cy0) / nd * nr;
    g.fillStyle = '#111'; g.beginPath(); g.arc(qx, qy, 8 * dpr, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = `800 ${10 * dpr}px Rubik, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', qx, qy + 0.5);
  }
  blip(g, x, y, b, dpr) {
    const r = (b.size || 4) * dpr;
    g.lineWidth = 1.5 * dpr; g.strokeStyle = '#000';
    if (b.icon) {
      g.fillStyle = b.color; g.beginPath(); g.arc(x, y, 7.5 * dpr, 0, 7); g.fill(); g.stroke();
      g.fillStyle = b.ink || '#111'; g.font = `800 ${9 * dpr}px Rubik, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(b.icon, x, y + 0.5 * dpr);
    } else if (b.square) {
      g.fillStyle = b.color; g.fillRect(x - r, y - r, r * 2, r * 2); g.strokeRect(x - r, y - r, r * 2, r * 2);
    } else {
      g.fillStyle = b.color; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke();
    }
  }
  drawMap(canvas, G) {
    const g = canvas.getContext('2d');
    const S = canvas.width;
    g.drawImage(this.map.canvas, 0, 0, S, S);
    const k = S / this.map.span, X = x => (x - this.map.x0) * k, Z = z => (z - this.map.z0) * k;
    g.font = `italic 400 ${S / 34}px "Kaushan Script", cursive`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [name, x, z] of ZONES) {
      g.lineWidth = S / 260; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(name, X(x), Z(z));
      g.fillStyle = 'rgba(255,230,245,.92)'; g.fillText(name, X(x), Z(z));
    }
    for (const b of G.blips(true)) this.blip(g, X(b.x), Z(b.z), b, S / 600);
    const P = G.player;
    g.save(); g.translate(X(P.x), Z(P.z)); g.rotate(Math.atan2(Math.sin(P.yaw), -Math.cos(P.yaw)));
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -11); g.lineTo(8, 9); g.lineTo(0, 4); g.lineTo(-8, 9); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
}
