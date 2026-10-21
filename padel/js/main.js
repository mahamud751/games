import * as THREE from 'three';
import { World } from './world.js';
import { createMatch, updateMatch, pointLabel } from './sim.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.random() * a.length | 0];

// ---------- content ----------
const CLUBS = [
  { id: 'hyde', name: 'Hyde Park Club', short: 'HYDE PARK', area: 'Westminster', time: 'day', turf: '#2b7a52', ground: '#3f6b3a', apron: '#5b6b5e', stand: '#2b3440', frame: '#1f2937', accent: '#d9f99d', accent2: '#38bdf8', crowd: 0.55, skill: 'easy', games: 3, reward: 120 },
  { id: 'thames', name: 'Thames Riverside', short: 'THAMES', area: 'Southbank', time: 'sunset', turf: '#1d5fd1', ground: '#2c2a3a', apron: '#3b3a4a', stand: '#2a2238', frame: '#111827', accent: '#fdba74', accent2: '#f472b6', crowd: 0.7, skill: 'medium', games: 3, reward: 180, river: true },
  { id: 'shoreditch', name: 'Shoreditch Neon', short: 'SHOREDITCH', area: 'East London', time: 'night', turf: '#6d28d9', ground: '#0b0b16', apron: '#17172b', stand: '#15122b', frame: '#0f0f1a', accent: '#f0abfc', accent2: '#22d3ee', crowd: 0.75, skill: 'medium', games: 4, reward: 240 },
  { id: 'camden', name: 'Camden Rooftop', short: 'CAMDEN', area: 'North London', time: 'rain', turf: '#0e7490', ground: '#1c232c', apron: '#29323c', stand: '#1d2530', frame: '#111827', accent: '#fde047', accent2: '#60a5fa', crowd: 0.6, skill: 'hard', games: 4, reward: 320 },
  { id: 'royal', name: 'Royal Arena', short: 'ROYAL ARENA', area: 'Greenwich', time: 'indoor', turf: '#1e3a8a', ground: '#0a0b14', apron: '#141830', stand: '#161a33', frame: '#0b0d18', accent: '#facc15', accent2: '#38bdf8', crowd: 0.92, skill: 'pro', games: 4, reward: 500 },
];
const RACKETS = [
  { id: 'classic', name: 'Club Classic', pace: 1, control: 1, price: 0, face: '#facc15', accent: '#f97316', frame: '#111827', grip: '#f8fafc' },
  { id: 'viper', name: 'Viper Control', pace: 0.97, control: 1.25, price: 300, face: '#22d3ee', accent: '#0e7490', frame: '#0f172a', grip: '#0f172a' },
  { id: 'thunder', name: 'Thunder Power', pace: 1.12, control: 0.92, price: 450, face: '#ef4444', accent: '#7f1d1d', frame: '#111827', grip: '#f8fafc' },
  { id: 'carbon', name: 'Carbon Elite', pace: 1.1, control: 1.15, price: 900, face: '#1f2937', accent: '#a3e635', frame: '#0b0b0b', grip: '#a3e635' },
  { id: 'royal', name: 'Royal Gold', pace: 1.15, control: 1.22, price: 1600, face: '#fde047', accent: '#b45309', frame: '#78350f', grip: '#111827' },
];
const KITS = [
  { id: 'court', name: 'Court Blue', shirt: '#2563eb', shorts: '#0f172a', accent: '#f8fafc', shoes: '#f8fafc', price: 0 },
  { id: 'lime', name: 'Lime Rush', shirt: '#a3e635', shorts: '#14532d', accent: '#14532d', shoes: '#f8fafc', price: 150 },
  { id: 'sunset', name: 'Sunset', shirt: '#f97316', shorts: '#7c2d12', accent: '#fde047', shoes: '#111827', price: 200 },
  { id: 'midnight', name: 'Midnight', shirt: '#111827', shorts: '#111827', accent: '#f0abfc', shoes: '#f0abfc', price: 250 },
  { id: 'union', name: 'Union', shirt: '#f8fafc', shorts: '#1e3a8a', accent: '#dc2626', shoes: '#1e3a8a', price: 400 },
  { id: 'champ', name: 'Champion Gold', shirt: '#facc15', shorts: '#111827', accent: '#111827', shoes: '#facc15', price: 800 },
];
const STYLES = [
  { name: 'Ace', skin: '#f0c29a', hair: '#3b2416', hairStyle: 'short' },
  { name: 'Nova', skin: '#c98d63', hair: '#1c1917', hairStyle: 'pony' },
  { name: 'Max', skin: '#e8b48a', hair: '#facc15', hairStyle: 'cap' },
  { name: 'Leo', skin: '#8a5536', hair: '#111111', hairStyle: 'bald', beard: true },
  { name: 'Zoe', skin: '#f3d1b5', hair: '#b91c1c', hairStyle: 'bun' },
  { name: 'Kai', skin: '#a46a43', hair: '#111827', hairStyle: 'short', band: '#f8fafc' },
];
const RIVALS = ['HART', 'QUINN', 'OKAFOR', 'SILVA', 'MOREAU', 'BIANCHI', 'NAKAMURA', 'DUARTE', 'HADDAD', 'LINDQVIST', 'ROJAS', 'KOWALSKI', 'PEREIRA', 'CASTRO', 'VANCE', 'ABARA'];
const RIVAL_KITS = [['#111827', '#111827', '#ef4444'], ['#dc2626', '#f8fafc', '#111827'], ['#0f766e', '#111827', '#5eead4'], ['#7c3aed', '#1e1b4b', '#fde047'], ['#f8fafc', '#111827', '#22c55e'], ['#ea580c', '#1c1917', '#fde68a']];
const CUPS = [
  { id: 'bronze', name: 'Bronze Cup', skills: ['easy', 'easy', 'medium'], prize: 400, clubs: ['hyde', 'thames', 'shoreditch'] },
  { id: 'silver', name: 'Silver Cup', skills: ['medium', 'medium', 'hard'], prize: 800, clubs: ['thames', 'shoreditch', 'camden'] },
  { id: 'gold', name: 'Gold Cup', skills: ['hard', 'hard', 'pro'], prize: 1500, clubs: ['shoreditch', 'camden', 'royal'] },
];
const ROUNDS = ['Quarter-final', 'Semi-final', 'Final'];
const clubById = id => CLUBS.find(c => c.id === id);

// ---------- save ----------
const KEY = 'padelrush.save.v2';
function defaults() { return { coins: 150, xp: 0, tour: 0, stars: {}, rackets: ['classic'], racket: 'classic', kits: ['court'], kit: 'court', style: 0, assist: 'light', played: 0, wins: 0, trainBest: 0, cups: {} }; }
let save = defaults();
try { save = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} }
const level = xp => Math.floor(Math.sqrt(xp / 120)) + 1;
const lvlXp = l => 120 * (l - 1) * (l - 1);

function myLook() {
  const st = STYLES[save.style], kit = KITS.find(k => k.id === save.kit), rk = RACKETS.find(r => r.id === save.racket);
  return Object.assign({}, st, { shirt: kit.shirt, shorts: kit.shorts, accent: kit.accent, shoes: kit.shoes, racket: rk });
}
function partnerLook() {
  const st = STYLES[(save.style + 3) % STYLES.length], kit = KITS.find(k => k.id === save.kit);
  return Object.assign({}, st, { shirt: kit.shirt, shorts: kit.shorts, accent: kit.accent, shoes: kit.shoes, racket: RACKETS[1] });
}
function rivalLooks() {
  const [shirt, shorts, accent] = pick(RIVAL_KITS);
  const a = pick(STYLES), b = pick(STYLES.filter(s => s !== a));
  const rk = { face: '#e5e7eb', accent: accent, frame: '#111827', grip: '#111827' };
  return [a, b].map(s => Object.assign({}, s, { shirt, shorts, accent, shoes: '#f8fafc', racket: rk }));
}

// ---------- renderer & world ----------
const canvas = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const world = new World(renderer);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  world.camera.aspect = innerWidth / innerHeight;
  world.camera.fov = innerWidth / innerHeight < 1 ? 62 : 46;
  world.camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

let menuClub = null;
function showClub(club) { if (menuClub === club && world.scene) return; menuClub = club; world.build(club); }

// ---------- input ----------
const keys = new Set();
const edge = { hit: false, lob: false };
const touch = { mx: 0, mz: 0 };
const HIT = ['Space', 'KeyJ', 'Enter', 'NumpadEnter'], LOB = ['ShiftLeft', 'ShiftRight', 'KeyK'];
addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  Sound.ensure();
  if (!e.repeat) {
    if (HIT.includes(e.code)) edge.hit = true;
    if (LOB.includes(e.code)) edge.lob = true;
    if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  }
  keys.add(e.code);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
canvas.addEventListener('mousedown', e => { Sound.ensure(); if (app.state !== 'match') return; if (e.button === 0) edge.hit = true; if (e.button === 2) edge.lob = true; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
let padPrev = {};
function readInput() {
  let mx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  let mz = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  mx += touch.mx; mz += touch.mz;
  let hit = edge.hit, lob = edge.lob;
  const pad = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
  if (pad) {
    const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
    if (Math.abs(ax) > 0.2) mx += ax; if (Math.abs(ay) > 0.2) mz -= ay;
    const b = i => pad.buttons[i] && pad.buttons[i].pressed;
    if (b(0) && !padPrev[0]) hit = true;
    if ((b(1) || b(2)) && !padPrev[1]) lob = true;
    if (b(9) && !padPrev[9]) togglePause();
    padPrev = { 0: b(0), 1: b(1) || b(2), 9: b(9) };
  }
  edge.hit = edge.lob = false;
  const m = Math.hypot(mx, mz);
  if (m > 1) { mx /= m; mz /= m; }
  return { mx, mz, hit, lob };
}
// touch controls
(() => {
  const zone = $('#stickZone'), knob = $('#knob'), base = $('#stickBase');
  let id = null, cx = 0, cy = 0;
  zone.addEventListener('pointerdown', e => { id = e.pointerId; zone.setPointerCapture(id); cx = e.clientX; cy = e.clientY; base.style.left = cx + 'px'; base.style.top = cy + 'px'; base.classList.add('on'); Sound.ensure(); });
  zone.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return;
    let dx = e.clientX - cx, dy = e.clientY - cy; const l = Math.hypot(dx, dy), max = 56;
    if (l > max) { dx *= max / l; dy *= max / l; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    touch.mx = dx / max; touch.mz = -dy / max;
  });
  const end = e => { if (e.pointerId !== id) return; id = null; touch.mx = touch.mz = 0; knob.style.transform = ''; base.classList.remove('on'); };
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  $('#tHit').addEventListener('pointerdown', e => { e.preventDefault(); Sound.ensure(); edge.hit = true; });
  $('#tLob').addEventListener('pointerdown', e => { e.preventDefault(); Sound.ensure(); edge.lob = true; });
})();
const isTouch = matchMedia('(pointer: coarse)').matches;

// ---------- app ----------
const app = { state: 'menu', screen: 'home', M: null, ctx: null, hint: null, hintT: 0, shake: 0 };

function showScreen(id) {
  app.screen = id;
  $$('.screen').forEach(s => s.classList.toggle('show', s.id === id));
  $('#topbar').classList.toggle('hidden', app.state !== 'menu');
}
function refreshTop() {
  const l = level(save.xp), a = lvlXp(l), b = lvlXp(l + 1);
  $('#tbLevel').textContent = l;
  $('#tbXp').style.width = ((save.xp - a) / (b - a) * 100).toFixed(1) + '%';
  $('#tbCoins').textContent = save.coins.toLocaleString();
  $('#tbName').textContent = STYLES[save.style].name.toUpperCase();
  $('#tbAvatar').textContent = STYLES[save.style].name[0];
  $('#tbAvatar').style.background = KITS.find(k => k.id === save.kit).shirt;
}

function toMenu(screen = 'home') {
  app.state = 'menu'; app.M = null;
  world.setPlayers([]); world.setShowcase(null); world.syncTargets && world.scene && world.syncTargets(null);
  $('#hud').classList.add('hidden'); $('#touchUI').classList.add('hidden');
  $$('.ov').forEach(o => o.classList.remove('show'));
  showClub(clubById(screen === 'locker' ? 'royal' : CLUBS[Math.min(save.tour, 4)].id));
  if (screen === 'locker') world.setShowcase(myLook());
  refreshTop();
  buildScreens();
  showScreen(screen);
  Sound.music('title');
}

// ---------- screens ----------
function stars(n) { return '★★★'.slice(0, n) + '<i>' + '★★★'.slice(0, 3 - n) + '</i>'; }
function buildScreens() {
  // tour
  const tour = $('#tourCards'); tour.innerHTML = '';
  CLUBS.forEach((c, i) => {
    const locked = i > save.tour, done = save.stars[c.id] > 0;
    const el = document.createElement('button');
    el.className = 'club' + (locked ? ' locked' : '') + (i === save.tour ? ' next' : '');
    el.style.setProperty('--turf', c.turf); el.style.setProperty('--acc', c.accent);
    el.innerHTML = `<div class="cimg ${c.time}"><span class="ctime">${{ day: 'DAY', sunset: 'SUNSET', night: 'NIGHT', rain: 'RAIN', indoor: 'INDOOR' }[c.time]}</span><span class="cnum">${i + 1}</span></div>
      <div class="cbody"><div class="cname">${c.name}</div><div class="carea">${c.area}</div>
      <div class="cmeta"><span class="diff d-${c.skill}">${c.skill.toUpperCase()}</span><span class="stars">${stars(save.stars[c.id] || 0)}</span></div>
      <div class="creward">${locked ? '🔒 Win the previous club' : done ? 'Replay · ' + c.reward + ' coins' : 'Win · ' + c.reward + ' coins'}</div></div>`;
    el.addEventListener('mouseenter', () => !locked && showClub(c));
    el.addEventListener('click', () => { if (locked) return Sound.play('groan'); startMatch({ mode: 'tour', club: c, skill: c.skill, games: c.games }); });
    tour.appendChild(el);
  });
  // single
  const sc = $('#singleClubs'); sc.innerHTML = '';
  CLUBS.forEach(c => {
    const b = document.createElement('button');
    b.className = 'chip' + (single.club === c.id ? ' on' : '');
    b.style.setProperty('--acc', c.accent);
    b.innerHTML = `<span class="dot" style="background:${c.turf}"></span>${c.name}`;
    b.addEventListener('click', () => { single.club = c.id; showClub(c); buildScreens(); Sound.play('pop', 0.3); });
    sc.appendChild(b);
  });
  // tournaments
  const tc = $('#cupCards'); tc.innerHTML = '';
  CUPS.forEach((cup, i) => {
    const won = save.cups[cup.id], locked = i > 0 && level(save.xp) < i * 3;
    const b = document.createElement('button');
    b.className = 'cup ' + cup.id + (locked ? ' locked' : '');
    b.innerHTML = `<div class="trophy">🏆</div><div class="cupn">${cup.name}</div><div class="cupd">3 rounds · ${cup.skills.map(s => s[0].toUpperCase() + s.slice(1)).join(' → ')}</div>
      <div class="cupp">${locked ? '🔒 Reach level ' + i * 3 : 'Prize ' + cup.prize + ' coins'}${won ? ' · <b>WON ×' + won + '</b>' : ''}</div>`;
    b.addEventListener('click', () => { if (locked) return Sound.play('groan'); openBracket(cup); });
    tc.appendChild(b);
  });
  $('#trainBest').textContent = save.trainBest ? `Best score ${save.trainBest}` : 'Hit the glowing targets in 60 seconds';
  buildLocker();
  $$('#assistSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === save.assist));
}
const single = { club: 'hyde', skill: 'medium', games: 4 };

let lockerTab = 'rackets';
function buildLocker() {
  $$('#lockerTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === lockerTab));
  const grid = $('#lockerGrid'); grid.innerHTML = '';
  const items = lockerTab === 'rackets' ? RACKETS : lockerTab === 'kits' ? KITS : STYLES.map((s, i) => Object.assign({ id: String(i), price: 0 }, s));
  items.forEach(it => {
    const owned = lockerTab === 'style' || (lockerTab === 'rackets' ? save.rackets : save.kits).includes(it.id);
    const equipped = lockerTab === 'rackets' ? save.racket === it.id : lockerTab === 'kits' ? save.kit === it.id : String(save.style) === it.id;
    const el = document.createElement('button');
    el.className = 'item' + (equipped ? ' eq' : '') + (owned ? '' : ' buy');
    let vis = '', stats = '';
    if (lockerTab === 'rackets') {
      vis = `<div class="rk" style="--f:${it.face};--a:${it.accent};--fr:${it.frame}"><i></i></div>`;
      stats = `<div class="st"><span>Power</span><div class="bar"><i style="width:${(it.pace - 0.8) / 0.4 * 100}%"></i></div><span>Control</span><div class="bar"><i style="width:${(it.control - 0.8) / 0.5 * 100}%"></i></div></div>`;
    } else if (lockerTab === 'kits') {
      vis = `<div class="kit"><div class="sh" style="background:${it.shirt};--a:${it.accent}"></div><div class="sr" style="background:${it.shorts}"></div></div>`;
    } else vis = `<div class="face" style="--s:${it.skin};--h:${it.hair}"><span>${it.name[0]}</span></div>`;
    el.innerHTML = `${vis}<div class="in">${it.name}</div>${stats}<div class="ip">${equipped ? 'EQUIPPED' : owned ? 'EQUIP' : '🪙 ' + it.price}</div>`;
    el.addEventListener('click', () => {
      if (equipped) return;
      if (!owned) {
        if (save.coins < it.price) { Sound.play('groan'); toast('Not enough coins'); return; }
        save.coins -= it.price; (lockerTab === 'rackets' ? save.rackets : save.kits).push(it.id);
        Sound.play('cheer', 0.5); toast(`${it.name} unlocked!`);
      }
      if (lockerTab === 'rackets') save.racket = it.id; else if (lockerTab === 'kits') save.kit = it.id; else save.style = +it.id;
      Sound.play('pop', 0.5);
      persist(); refreshTop(); buildLocker(); world.setShowcase(myLook());
    });
    grid.appendChild(el);
  });
}

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); }

// ---------- tournament bracket ----------
function openBracket(cup) {
  const names = [...RIVALS].sort(() => Math.random() - 0.5);
  const teams = [{ name: 'YOU', you: true }];
  for (let i = 0; i < 7; i++) teams.push({ name: `${names[i * 2]} / ${names[i * 2 + 1]}` });
  app.cup = { cup, round: 0, teams, alive: true };
  drawBracket();
  showScreen('bracket');
}
function drawBracket() {
  const C = app.cup, el = $('#bracketGrid');
  $('#bracketTitle').textContent = C.cup.name;
  const r = C.round;
  const col = (label, pairs, idx) => `<div class="col ${idx === r ? 'cur' : ''}"><div class="ch">${label}</div>${pairs.map(p => `<div class="match">${p.map(t => `<div class="tm ${t.you ? 'you' : ''} ${t.out ? 'out' : ''}">${t.name}</div>`).join('')}</div>`).join('')}</div>`;
  const T = C.teams;
  const qf = [[T[0], T[1]], [T[2], T[3]], [T[4], T[5]], [T[6], T[7]]];
  const sf = r >= 1 ? [[T[0], T[2]], [T[4], T[6]]] : [[{ name: '—' }, { name: '—' }], [{ name: '—' }, { name: '—' }]];
  const fi = r >= 2 ? [[T[0], T[4]]] : [[{ name: '—' }, { name: '—' }]];
  el.innerHTML = col('Quarter-final', qf, 0) + col('Semi-final', sf, 1) + col('Final', fi, 2);
  const club = clubById(C.cup.clubs[Math.min(r, 2)]);
  $('#bracketPlay').textContent = C.alive && r < 3 ? `Play ${ROUNDS[r]} · ${club.name}` : 'Back';
  showClub(club);
}
function rivalNamesFromCup() { const C = app.cup, opp = [1, 2, 4][C.round]; return C.teams[opp].name.split(' / '); }

// ---------- match ----------
function startMatch(ctx) {
  Sound.ensure();
  app.ctx = ctx;
  const club = ctx.club;
  showClub(club);
  world.setShowcase(null);
  const rk = RACKETS.find(r => r.id === save.racket);
  const M = createMatch({ skill: ctx.skill, games: ctx.games || 4, assist: save.assist, racket: { pace: rk.pace, control: rk.control }, training: ctx.mode === 'training' });
  M.excite = 0.2;
  app.M = M;
  const rivals = rivalLooks();
  const rn = ctx.rivalNames || [RIVALS[Math.random() * RIVALS.length | 0], RIVALS[Math.random() * RIVALS.length | 0]];
  const list = [{ look: myLook(), human: true, ring: '#38bdf8', num: 10 }];
  if (!M.training) list.push({ look: partnerLook(), ring: '#4ade80', num: 4 }, { look: rivals[0], ring: '#f87171', num: 7 }, { look: rivals[1], ring: '#f87171', num: 9 });
  world.setPlayers(list);
  app.names = ['YOU', STYLES[(save.style + 3) % STYLES.length].name.toUpperCase(), rn[0], rn[1]];
  app.state = 'match';
  $$('.screen').forEach(s => s.classList.remove('show'));
  $$('.ov').forEach(o => o.classList.remove('show'));
  $('#topbar').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  $('#board').classList.toggle('hidden', M.training);
  $('#trainHud').classList.toggle('hidden', !M.training);
  $('#touchUI').classList.toggle('hidden', !isTouch);
  $('#keysHint').classList.toggle('hidden', isTouch);
  $('#bVenue').textContent = `${club.short} · ${ctx.mode === 'tour' ? 'CLUB TOUR' : ctx.mode === 'cup' ? app.cup.cup.name.toUpperCase() + ' · ' + ROUNDS[app.cup.round].toUpperCase() : ctx.mode === 'training' ? 'TRAINING' : 'SINGLE MATCH'}`;
  $('#bN0').textContent = `YOU / ${app.names[1]}`;
  $('#bN1').textContent = `${app.names[2]} / ${app.names[3]}`;
  const title = ctx.mode === 'training' ? 'Training' : ctx.mode === 'cup' ? ROUNDS[app.cup.round] : club.name;
  banner(title, ctx.mode === 'training' ? 'Hit the glowing targets!' : `First to ${M.games} games · ${ctx.skill.toUpperCase()}`, '#d9f99d', 2.4);
  world.drawJumbo(app.names[2] + ' vs YOU', club.name.toUpperCase());
  if (M.training) { world.trainTargets = null; }
  Sound.music('match');
  Sound.play('whistle');
  updateHud(true);
}

function banner(text, sub, color, time = 1.6) {
  const b = $('#banner');
  $('#bnT').textContent = text; $('#bnS').textContent = sub || '';
  b.style.setProperty('--c', color);
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  b.style.animationDuration = time + 's';
}
function popup(x, y, z, text, color, big) {
  const [sx, sy, ok] = world.project(x, y, z, innerWidth, innerHeight);
  if (!ok) return;
  const el = document.createElement('div');
  el.className = 'pop' + (big ? ' big' : '');
  el.textContent = text; el.style.left = sx + 'px'; el.style.top = sy + 'px'; el.style.color = color;
  $('#pops').appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function handleEvents(M) {
  for (const e of M.ev) {
    switch (e.t) {
      case 'hit': {
        const p = e.type === 'smash' || e.type === 'power' ? 1 : e.type === 'lob' ? 0.2 : 0.6;
        Sound.play('pop', p);
        world.flash(e.x, e.y, e.z, e.perfect ? '#d9f99d' : '#fff7d6', e.perfect ? 1.6 : 0.9);
        if (e.p.human) {
          if (e.perfect) { Sound.play('perfect'); popup(e.x, e.y, e.z + 0.6, 'PERFECT!', '#d9f99d', true); app.hint = 'perfect'; app.hintT = 0.4; }
          else if (e.quality < 0.3) popup(e.x, e.y, e.z + 0.5, 'LATE', '#fca5a5');
        }
        if (e.kill) { popup(e.x, e.y, e.z + 0.8, 'KILL SMASH!', '#f9a8d4', true); app.shake = 0.5; M.excite = 1; }
        else if (e.type === 'smash' || e.type === 'power') { popup(e.x, e.y, e.z + 0.6, e.type === 'power' ? 'POWER!' : 'SMASH!', '#f9a8d4'); app.shake = 0.25; M.excite = Math.min(1, M.excite + 0.3); }
        break;
      }
      case 'swing': Sound.play('whoosh'); break;
      case 'bounce': Sound.play('bounce', e.v); break;
      case 'glass': Sound.play('glass', e.v); world.ripple(e.x, e.y, e.z, '#bae6fd'); break;
      case 'fence': Sound.play('fence', e.v); world.ripple(e.x, e.y, e.z, '#e2e8f0'); break;
      case 'net': Sound.play('netHit'); break;
      case 'point': {
        Sound.play('whistle');
        Sound.play(e.winner === 0 ? 'cheer' : 'groan', e.big ? 1.2 : 0.7);
        M.excite = e.winner === 0 ? 1 : 0.45;
        const golden = M.points[0] === 3 && M.points[1] === 3;
        const sub = e.game !== null ? `GAME ${e.game === 0 ? 'YOU' : 'RIVALS'} · ${M.gamesWon[0]}–${M.gamesWon[1]}` : golden ? 'GOLDEN POINT' : `${pointLabel(M.points[0])} – ${pointLabel(M.points[1])}`;
        banner(e.label, sub + (e.hits > 6 ? `  ·  ${e.hits}-shot rally` : ''), e.winner === 0 ? '#4ade80' : '#f87171');
        world.drawJumbo(`${M.gamesWon[0]} – ${M.gamesWon[1]}`, e.label);
        updateHud();
        break;
      }
      case 'target':
        if (e.pts) { popup(e.x, e.y, 0.6, `+${e.pts}${e.combo > 1 ? ' ×' + e.combo : ''}`, e.hit ? '#fde047' : '#e2e8f0', e.hit); Sound.play(e.hit ? 'perfect' : 'bounce', 4); if (e.hit) { world.flash(e.x, e.y, 0.2, '#fde047', 3); M.excite = 1; } }
        else popup(M.players[0].x + 2, M.players[0].y, 1.6, e.miss, '#fca5a5');
        break;
      case 'over': finishMatch(e); break;
    }
  }
  M.ev.length = 0;
}

function updateHud(force) {
  const M = app.M; if (!M) return;
  if (M.training) {
    const T = M.training;
    $('#trTime').textContent = Math.ceil(T.left);
    $('#trScore').textContent = T.score;
    $('#trCombo').textContent = T.combo > 1 ? `COMBO ×${T.combo}` : '';
    return;
  }
  $('#bG0').textContent = M.gamesWon[0]; $('#bG1').textContent = M.gamesWon[1];
  $('#bP0').textContent = pointLabel(M.points[0]); $('#bP1').textContent = pointLabel(M.points[1]);
  $('#bSv0').classList.toggle('on', M.serveTeam === 0); $('#bSv1').classList.toggle('on', M.serveTeam === 1);
  $('#bFoot').textContent = M.points[0] === 3 && M.points[1] === 3 ? 'GOLDEN POINT' : `FIRST TO ${M.games}`;
  void force;
}

function finishMatch(e) {
  const M = app.M, ctx = app.ctx;
  app.state = 'result';
  $('#touchUI').classList.add('hidden');
  let coins = 0, xp = 0, title = '', sub = '', won = false, next = null;
  if (M.training) {
    const T = M.training;
    coins = Math.round(T.score / 20); xp = Math.round(T.score / 8);
    title = 'TRAINING DONE'; sub = `${T.score} points · ${T.hitsOk} targets · best combo ×${T.best}`;
    if (T.score > save.trainBest) { save.trainBest = T.score; sub += ' · NEW BEST!'; }
    won = true;
  } else {
    won = e.winner === 0;
    const margin = M.gamesWon[0] - M.gamesWon[1];
    save.played++; if (won) save.wins++;
    xp = M.stats.pointsWon * 4 + (won ? 120 : 40);
    if (ctx.mode === 'tour') {
      coins = won ? ctx.club.reward + margin * 20 : Math.round(ctx.club.reward * 0.2);
      if (won) {
        const st = margin >= M.games ? 3 : margin >= 2 ? 2 : 1;
        save.stars[ctx.club.id] = Math.max(save.stars[ctx.club.id] || 0, st);
        const i = CLUBS.indexOf(ctx.club);
        if (i === save.tour && i < CLUBS.length - 1) { save.tour = i + 1; sub = `${CLUBS[i + 1].name} unlocked!`; }
        if (i < CLUBS.length - 1) next = () => startMatch({ mode: 'tour', club: CLUBS[i + 1], skill: CLUBS[i + 1].skill, games: CLUBS[i + 1].games });
        else sub = 'You conquered every club in London!';
      }
    } else if (ctx.mode === 'cup') {
      const C = app.cup;
      if (won) {
        C.teams[[1, 2, 4][C.round]].out = true;
        C.round++;
        if (C.round >= 3) { coins = C.cup.prize; save.cups[C.cup.id] = (save.cups[C.cup.id] || 0) + 1; sub = `${C.cup.name} champions!`; xp += 200; }
        else { coins = 80 * C.round; next = () => { drawBracket(); app.state = 'menu'; $('#hud').classList.add('hidden'); world.setPlayers([]); app.M = null; showScreen('bracket'); }; sub = `Through to the ${ROUNDS[C.round]}`; }
      } else { C.alive = false; C.teams[0].out = true; coins = 30; sub = `Knocked out in the ${ROUNDS[C.round]}`; }
    } else coins = won ? 80 + margin * 15 : 20;
    title = won ? (ctx.mode === 'cup' && app.cup.round >= 3 ? 'CHAMPIONS!' : 'VICTORY!') : 'DEFEAT';
  }
  const before = level(save.xp);
  save.coins += coins; save.xp += xp;
  persist();
  const after = level(save.xp);
  $('#rTitle').textContent = title;
  $('#rTitle').className = 'rtitle ' + (won ? 'win' : 'lose');
  $('#rSub').textContent = sub;
  $('#rScore').innerHTML = M.training ? `<b>${M.training.score}</b>` : `<b class="s0">${M.gamesWon[0]}</b><i>–</i><b class="s1">${M.gamesWon[1]}</b>`;
  $('#rStats').innerHTML = M.training ? '' : `<div><b>${M.stats.pointsWon}</b><span>Points won</span></div><div><b>${M.stats.winners}</b><span>Winners</span></div><div><b>${M.stats.perfect}</b><span>Perfect hits</span></div><div><b>${M.stats.longest}</b><span>Longest rally</span></div>`;
  $('#rRewards').innerHTML = `<span class="coin">🪙 +${coins}</span><span class="xp">XP +${xp}</span>${after > before ? `<span class="lvl">LEVEL ${after}!</span>` : ''}`;
  $('#rTrophy').classList.toggle('hidden', !won || M.training);
  $('#rNext').classList.toggle('hidden', !next);
  app.next = next;
  Sound.music(won ? 'win' : 'title');
  Sound.play(won ? 'cheer' : 'groan', 1.3);
  setTimeout(() => $('#result').classList.add('show'), 900);
}

function togglePause() {
  if (app.state === 'match') { app.state = 'paused'; $('#pause').classList.add('show'); }
  else if (app.state === 'paused') { app.state = 'match'; $('#pause').classList.remove('show'); }
}

// ---------- wiring ----------
$$('[data-go]').forEach(b => b.addEventListener('click', () => {
  Sound.ensure(); Sound.play('pop', 0.3);
  const g = b.dataset.go;
  if (g === 'training') return startMatch({ mode: 'training', club: clubById('hyde'), skill: 'easy' });
  if (g === 'locker') { toMenu('locker'); return; }
  if (g === 'home') { toMenu('home'); return; }
  if (g === 'single') showClub(clubById(single.club));
  showScreen(g);
}));
$$('#singleSkill button, #singleLen button').forEach(b => b.addEventListener('click', () => {
  const seg = b.parentElement; seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  if (seg.id === 'singleSkill') single.skill = b.dataset.v; else single.games = +b.dataset.v;
  Sound.play('pop', 0.3);
}));
$('#singlePlay').addEventListener('click', () => { const c = clubById(single.club); startMatch({ mode: 'single', club: c, skill: single.skill, games: single.games }); });
$('#bracketPlay').addEventListener('click', () => {
  const C = app.cup;
  if (!C.alive || C.round >= 3) return toMenu('cups');
  startMatch({ mode: 'cup', club: clubById(C.cup.clubs[C.round]), skill: C.cup.skills[C.round], games: C.round === 2 ? 4 : 3, rivalNames: rivalNamesFromCup() });
});
$$('#lockerTabs button').forEach(b => b.addEventListener('click', () => { lockerTab = b.dataset.t; buildLocker(); Sound.play('pop', 0.3); }));
$$('#assistSeg button').forEach(b => b.addEventListener('click', () => { save.assist = b.dataset.v; persist(); buildScreens(); Sound.play('pop', 0.3); }));
$('#rNext').addEventListener('click', () => { $('#result').classList.remove('show'); app.next && app.next(); });
$('#rAgain').addEventListener('click', () => { $('#result').classList.remove('show'); if (app.ctx.mode === 'cup') { openBracket(app.cup.cup); toMenuKeep(); } else startMatch(app.ctx); });
$('#rMenu').addEventListener('click', () => toMenu(app.ctx && app.ctx.mode === 'tour' ? 'tour' : app.ctx && app.ctx.mode === 'cup' ? 'cups' : 'home'));
function toMenuKeep() { app.state = 'menu'; app.M = null; world.setPlayers([]); $('#hud').classList.add('hidden'); showScreen('bracket'); }
$('#pResume').addEventListener('click', togglePause);
$('#pQuit').addEventListener('click', () => { $('#pause').classList.remove('show'); toMenu('home'); });
$('#pauseBtn').addEventListener('click', togglePause);
const syncAudio = () => { $('#sMusic').classList.toggle('off', !Sound.musicOn); $('#sSfx').classList.toggle('off', !Sound.sfxOn); };
$('#sMusic').addEventListener('click', () => { Sound.ensure(); Sound.toggleMusic(); syncAudio(); });
$('#sSfx').addEventListener('click', () => { Sound.ensure(); Sound.toggleSfx(); syncAudio(); });
syncAudio();
addEventListener('pointerdown', () => { if (Sound.ensure() && app.state === 'menu') Sound.music('title'); }, { once: true });

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  let mode = 'menu';
  const M = app.M;
  if (app.state === 'match' && M) {
    const inp = readInput();
    updateMatch(M, dt * 0.82, inp);
    M.excite = Math.max(0.15, (M.excite || 0) - dt * 0.35);
    handleEvents(M);
    if (M.training) updateHud();
    world.syncTargets(M.training ? M.training.targets : null);
    mode = M.state === 'intro' ? 'intro' : 'match';
    // timing cue: the ring under you lights up as the ball comes into reach
    if (app.hintT > 0) app.hintT -= dt; else app.hint = null;
    const me = M.players[0], b = M.ball;
    if (!app.hint && M.rally && M.rally.team === 1 && b.live && Math.sign(b.x) <= 0 && Math.hypot(b.x - me.x, b.y - me.y) < 2.4) app.hint = 'ready';
  } else if (app.state === 'paused' || app.state === 'result') mode = M && !M.training ? 'match' : M ? 'match' : 'menu';
  else if (app.screen === 'locker') mode = 'locker';
  if (app.state === 'paused') { world.render(); requestAnimationFrame(frame); return; }
  world.update(dt, app.state === 'menu' ? null : M, mode, app.hint);
  if (app.shake > 0) { app.shake -= dt; world.camera.position.x += (Math.random() - 0.5) * app.shake * 0.6; world.camera.position.y += (Math.random() - 0.5) * app.shake * 0.4; }
  world.render();
  if (app.hint === 'ready') app.hint = null;
  requestAnimationFrame(frame);
}

resize();
toMenu('home');
requestAnimationFrame(frame);
window.__padel = { app, get M() { return app.M; }, startMatch, CLUBS, save, toMenu, world };
