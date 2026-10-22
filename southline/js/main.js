import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildCity, PLACES, zoneName, groundHeight, solidAt, nodePos, nearestNode, neighbors, NX, NZ, BEACH_X, clamp, collideCircle } from './city.js';
import { Sky } from './sky.js';
import { FX } from './fx.js';
import { Sound } from './audio.js';
import { Input } from './input.js';
import { HUD } from './hud.js';
import { Vehicle, collideCars, driveTraffic, driveCop, spawnTraffic, randomType, wrap } from './vehicles.js';
import { Person, walkerSpot } from './people.js';
import { Player, WEAPONS } from './player.js';
import { Missions, STORY_COUNT } from './missions.js';
import { Venues } from './venues.js';
import { buildHeli, HEAD_MAT, paint } from './models.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const money = n => '$' + Math.round(n).toLocaleString('en-US');
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const wait = ms => new Promise(r => setTimeout(r, ms));
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

// ---------- save ----------
const KEY = 'southline.save.v2';
const defaults = () => ({
  cash: 250, story: 0, shells: [], has: {}, ammo: {}, armor: 0, hour: 19, started: false, props: {},
  quality: matchMedia('(pointer: coarse)').matches ? 'low' : 'high', sens: 1, invert: false,
  stats: { kills: 0, cops: 0, wrecked: 0, fares: 0, stunts: 0, bestStunt: 0, busted: 0, wasted: 0, time: 0 }
});
let save = defaults();
try {
  const s = JSON.parse(localStorage.getItem(KEY));
  if (s) save = { ...defaults(), ...s, stats: { ...defaults().stats, ...(s.stats || {}) } };
} catch (e) {}

// ---------- renderer ----------
const canvas = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.2, 3000);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.4, 0.86);
composer.addPass(bloom);
composer.addPass(new OutputPass());
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

const input = new Input(canvas);
const hud = new HUD();
const G = {
  scene, camera, save, audio: Sound, hud, input,
  cars: [], peds: [], walkers: [], heli: null,
  heat: 0, stars: 0, lastSeen: 0, starFlash: false, now: 0, hour: 19.2, night: 0,
  cam: { yaw: Math.PI / 2, pitch: 0.3, idle: 0, shake: 0 },
  target: { x: 545, z: 260, vx: 0, vz: 0, onFoot: true, speed: 0 },
  mode: 'loading', paused: false, slow: 1, bustT: 0, copT: 0, copT2: 0, heliT: 0, hurtFlash: 0
};
let player, missions, venues, sky, fx, city, headlight;

function persist() {
  if (player) { save.has = { ...player.has }; save.ammo = { ...player.ammo }; save.armor = Math.round(player.armor); }
  save.hour = G.hour;
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {}
}
G.persist = persist;

// ---------- wanted level ----------
const THRESH = [0, 30, 120, 300, 600, 1000];
G.setStars = n => {
  n = clamp(n, 0, 5);
  const up = n > G.stars;
  G.heat = n ? THRESH[n] + 5 : 0; G.stars = n; G.lastSeen = G.now;
  if (up) Sound.star();
};
G.raiseStars = n => { if (G.stars < n) G.setStars(n); };
G.addHeat = n => {
  if (G.mode !== 'play' || n <= 0) return;
  const before = G.stars;
  G.heat = Math.min(1400, G.heat + n);
  let s = 0;
  while (s < 5 && G.heat >= THRESH[s + 1]) s++;
  G.stars = Math.max(G.stars, s);
  G.lastSeen = G.now;
  if (G.stars > before) Sound.star();
};
const isCop = p => p.kind === 'cop' || p.kind === 'swat';
function copsNear(x, z, r) {
  for (const p of G.peds) if (isCop(p) && !p.dead && Math.abs(p.x - x) < r && Math.abs(p.z - z) < r) return true;
  for (const c of G.cars) if (c.t.police && !c.dead && c.driver === 'ai' && Math.abs(c.x - x) < r && Math.abs(c.z - z) < r) return true;
  return false;
}
G.addCash = n => { save.cash = Math.max(0, Math.round(save.cash + n)); };

// ---------- events from the world ----------
const byPlayer = from => from === player || (from && from.driver === 'player') || from === 'player';
G.onGunfire = (x, z) => {
  for (const p of G.peds) if (p.kind === 'civ' && !p.dead && Math.abs(p.x - x) < 35 && Math.abs(p.z - z) < 35) p.scare(x, z, 8);
  for (const c of G.cars) if (c.ai?.mode === 'traffic' && Math.abs(c.x - x) < 45 && Math.abs(c.z - z) < 45) c.ai.panic = 5;
  if (copsNear(x, z, 45)) G.addHeat(8);
};
G.onPedHurt = (p, dmg, from) => {
  if (!byPlayer(from) || p.dead) return;
  if (isCop(p)) G.addHeat(25);
  else if (p.kind === 'civ' && copsNear(p.x, p.z, 40)) G.addHeat(8);
};
G.onPedDeath = (p, from) => {
  if (byPlayer(from)) {
    save.stats.kills++;
    if (isCop(p)) { save.stats.cops++; G.addHeat(p.kind === 'swat' ? 170 : 130); }
    else if (p.kind === 'civ') G.addHeat(copsNear(p.x, p.z, 60) ? 45 : 28);
  }
  if (p.kind === 'cop' && Math.random() < 0.6) missions.spawnPickup('pistol', p.x + 0.6, p.z, { once: true, ammo: 12, life: 30 });
  else if (p.kind === 'swat') missions.spawnPickup('smg', p.x + 0.6, p.z, { once: true, ammo: 40, life: 30 });
  else if (p.cash && p.state !== 'ride') missions.dropCash(p.x, p.z, p.cash);
  for (const q of G.peds) if (q.kind === 'civ' && !q.dead && Math.abs(q.x - p.x) < 25 && Math.abs(q.z - p.z) < 25) q.scare(p.x, p.z, 8);
};
G.npcShoot = (s, d) => {
  const P = player, inCar = !!P.car;
  const fx0 = Math.sin(s.yaw), fz0 = Math.cos(s.yaw);
  const gx = s.x + fx0 * 0.5 - fz0 * 0.3, gy = s.y + 1.42, gz = s.z + fz0 * 0.5 + fx0 * 0.3;
  let chance = clamp(0.68 - d * 0.017 - P.speed * 0.02, 0.08, 0.75) + (s.kind === 'swat' ? 0.08 : 0);
  if (G.mode !== 'play') chance = 0;
  const hit = Math.random() < chance;
  let ex = P.x, ey = inCar ? P.car.y + 1 : P.y + 1.2, ez = P.z;
  if (!hit) { ex += (Math.random() - 0.5) * 3; ey += (Math.random() - 0.5) * 1.5; ez += (Math.random() - 0.5) * 3; }
  fx.tracer(gx, gy, gz, ex, ey, ez, [2.2, 1.1, 0.5]);
  fx.muzzle(gx, gy, gz);
  Sound.gun(s.weapon, s.x, s.z);
  if (hit) { if (inCar) P.car.damage(s.weapon === 'smg' ? 3 : 5, G); else G.hurtPlayer(s.weapon === 'smg' ? 5 : 8); }
};
G.hurtPlayer = n => {
  if (G.mode !== 'play' || n <= 0) return;
  const a = Math.min(player.armor, n);
  player.armor -= a; n -= a;
  if (G.fed > 0) n *= 0.7;
  player.hp -= n;
  G.hurtFlash = Math.min(0.7, G.hurtFlash + 0.25 + n * 0.01);
  if (player.hp <= 0) goDown('wasted');
};
G.tryBust = (cop, dt) => {
  if (G.mode !== 'play' || G.stars === 0) return;
  G.bustT += dt * 2.2;
  if (G.bustT > 1.4) goDown('busted');
};
G.explosion = (x, y, z, src) => {
  fx.explosion(x, y, z);
  Sound.explosion(x, z);
  const dd = Math.hypot(x - camera.position.x, z - camera.position.z);
  G.cam.shake = Math.max(G.cam.shake, clamp(1.4 - dd / 60, 0, 1.2));
  const R = 9, by = src && src.lastHitBy === 'player' ? player : src;
  for (const p of G.peds) {
    if (p.removed || p.state === 'ride') continue;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < R) { const k = 1 - d / R, nx = (p.x - x) / (d || 1), nz = (p.z - z) / (d || 1); p.knock(G, nx * 12 * k, nz * 12 * k, 6 * k + 2, 220 * k, by); }
  }
  for (const c of G.cars) {
    if (c === src || c.removed || c.dead) continue;
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < 8) { const k = 1 - d / 8; c.damage(75 * k, G, src?.lastHitBy); c.vx += (c.x - x) / (d || 1) * 8 * k; c.vz += (c.z - z) / (d || 1) * 8 * k; }
  }
  if (G.mode === 'play') {
    if (player.car && player.car === src) goDown('wasted');
    else if (!player.car) {
      const d = Math.hypot(player.x - x, player.z - z);
      if (d < R) { const k = 1 - d / R; G.hurtPlayer(110 * k); player.vx += (player.x - x) / (d || 1) * 9 * k; player.vz += (player.z - z) / (d || 1) * 9 * k; player.vy = 5 * k; player.grounded = false; }
    }
  }
  if (G.heli && !G.heli.dead && Math.hypot(G.heli.x - x, G.heli.z - z) < 10 && G.heli.y < 12) G.heli.hp -= 200;
  if (src?.lastHitBy === 'player' && src.t) { save.stats.wrecked++; G.addHeat(src.t.police ? 150 : 40); }
  for (const q of G.peds) if (q.kind === 'civ' && !q.dead && Math.abs(q.x - x) < 45 && Math.abs(q.z - z) < 45) q.scare(x, z, 10);
};
G.onCrash = (car, impact) => {
  Sound.crash(impact, car.x, car.z);
  if (car === player?.car) G.cam.shake = Math.max(G.cam.shake, Math.min(0.6, impact / 40));
  fx.spark(car.x, car.y + 0.6, car.z, 4);
};
G.onCarHit = (a, b, hit) => {
  Sound.crash(hit, a.x, a.z);
  const mine = a.driver === 'player' ? b : b.driver === 'player' ? a : null;
  if (mine) {
    G.cam.shake = Math.max(G.cam.shake, Math.min(0.5, hit / 40));
    if (mine.t.police && hit > 6 && mine.driver === 'ai') G.addHeat(15);
    else if (mine.ai?.mode === 'traffic' && hit > 6) { mine.ai.panic = 3; G.audio.horn(mine.x, mine.z); }
  }
};
G.onLand = (car, air) => {
  if (car !== player?.car || G.mode !== 'play' || air < 1.1) return;
  const pay = Math.round(air * air * 45 / 10) * 10;
  G.addCash(pay); save.stats.stunts++;
  save.stats.bestStunt = Math.max(save.stats.bestStunt, Math.round(air * 10) / 10);
  Sound.stunt();
  hud.banner(air > 2 ? 'Insane stunt bonus' : 'Stunt bonus', `${air.toFixed(1)}s airtime · ${money(pay)}`, '#21e6ff', 2600);
};
G.onCarjack = (car, cop) => { if (cop) G.addHeat(60); else if (copsNear(car.x, car.z, 40)) G.addHeat(30); };
G.onEnterCar = c => {
  hud.vehicle(c.t.name);
  Sound.door();
  Sound.radio(true);
  hud.radio(Sound.STATIONS[Sound.station]);
  G.cam.idle = 2;
  if (!missions.busy) {
    if (c.t.taxi) hud.help('Press <kbd>J</kbd> to pick up taxi fares.', 5000);
    else if (c.t.police) hud.help('Press <kbd>J</kbd> for vigilante jobs. <kbd>G</kbd> toggles the siren.', 5000);
  }
};
G.onExitCar = () => { Sound.radio(false); Sound.door(); };
G.onHorn = c => {
  const fx0 = Math.sin(c.yaw), fz0 = Math.cos(c.yaw);
  for (const p of G.peds) if (p.kind === 'civ' && !p.dead && dist(p, c) < 14 && ((p.x - c.x) * fx0 + (p.z - c.z) * fz0) > 0) p.scare(c.x, c.z, 3);
};
G.nextStation = () => hud.radio(Sound.nextStation());
G.drown = () => {
  if (G.mode !== 'play') return;
  Sound.splash(); fx.splash(player.x, player.z);
  goDown('drowned');
};
G.putInCar = car => {
  if (player.car) player.exitCar(G);
  player.car = car; player.lastCar = car;
  car.driver = 'player'; car.ai = null;
  player.m.root.visible = false;
  player.x = car.x; player.z = car.z;
  G.cam.yaw = car.yaw;
  G.onEnterCar(car);
};
G.inView = (x, z) => {
  _p.set(x, 2, z).project(camera);
  return _p.z < 1 && Math.abs(_p.x) < 1.15 && Math.abs(_p.y) < 1.2;
};
const _p = new THREE.Vector3();
G.blips = full => {
  const out = missions.blips(full).concat(venues.blips());
  if (G.stars > 0) {
    const blink = Math.floor(G.now * 3) % 2 ? '#ff3b3b' : '#3d8bff';
    for (const c of G.cars) if (c.ai?.mode === 'cop' && !c.dead) out.push({ x: c.x, z: c.z, color: blink, size: 4 });
    for (const p of G.peds) if (isCop(p) && !p.dead && p.state === 'attack') out.push({ x: p.x, z: p.z, color: blink, size: 3 });
    if (G.heli && !G.heli.dead) out.push({ x: G.heli.x, z: G.heli.z, color: blink, size: 5, square: true });
  }
  for (const p of G.peds) if (p.mission && !p.dead && (p.kind === 'thug' || p.kind === 'swat')) out.push({ x: p.x, z: p.z, color: '#ff3b3b', size: 3 });
  return out;
};

// ---------- places: shop, spray, safehouse ----------
G.openShop = () => {
  if (G.mode !== 'play') return;
  G.shopOpen = true; G.paused = true;
  input.enabled = false; input.unlock();
  renderShop();
  $('#shop').classList.add('show');
};
function closeShop() {
  $('#shop').classList.remove('show');
  G.shopOpen = false; G.paused = false; input.enabled = true;
  lockPointer();
}
function renderShop() {
  const items = [
    { id: 'bat', name: 'Baseball bat', price: 60, note: 'Melee' },
    { id: 'pistol', name: 'Pistol', price: 250, note: '+36 rounds' },
    { id: 'smg', name: 'SMG', price: 700, note: '+150 rounds' },
    { id: 'shotgun', name: 'Shotgun', price: 1000, note: '+20 shells' },
    { id: 'armor', name: 'Body armor', price: 200, note: 'Full vest' }
  ];
  $('#shopCash').textContent = money(save.cash);
  $('#shopList').innerHTML = items.map(it => {
    const owned = it.id !== 'armor' && player.has[it.id];
    const label = it.id === 'armor' ? (player.armor >= 100 ? 'Full' : 'Buy') : owned ? (WEAPONS[it.id].melee ? 'Owned' : 'Ammo') : 'Buy';
    const price = owned && !WEAPONS[it.id].melee ? Math.round(it.price * 0.4) : it.price;
    const off = save.cash < price || label === 'Full' || label === 'Owned';
    return `<div class="item"><div><b>${it.name}</b><small>${owned && !WEAPONS[it.id].melee ? 'Ammo refill · ' + it.note : it.note}</small></div><button data-buy="${it.id}" data-price="${price}" ${off ? 'disabled' : ''}>${label} · ${money(price)}</button></div>`;
  }).join('');
}
$('#shopList').addEventListener('click', e => {
  const b = e.target.closest('[data-buy]');
  if (!b || b.disabled) return;
  const id = b.dataset.buy, price = Number(b.dataset.price);
  if (save.cash < price) return;
  G.addCash(-price);
  if (id === 'armor') player.armor = 100;
  else player.give(id, WEAPONS[id].pack || 0);
  Sound.cash();
  persist();
  renderShop();
});
$('#shopClose').addEventListener('click', closeShop);

// generic venue menus (drinks, food, property office)
let panelBuilder = null, panelItems = [];
G.openPanel = builder => {
  if (G.mode !== 'play') return;
  panelBuilder = builder;
  G.panelOpen = true; G.paused = true;
  input.enabled = false; input.unlock();
  renderPanel();
  $('#panel').classList.add('show');
};
function renderPanel() {
  const s = panelBuilder();
  $('#panelKicker').textContent = s.kicker;
  $('#panelTitle').textContent = s.title;
  $('#panelNote').textContent = s.note || '';
  $('#panelNote').hidden = !s.note;
  $('#panelCash').textContent = money(save.cash);
  panelItems = s.items;
  $('#panelList').innerHTML = s.items.map((it, i) => `<div class="item"><div><b>${it.name}</b><small>${it.desc}</small></div><button data-i="${i}" ${it.off || save.cash < it.price ? 'disabled' : ''}>${it.label}${it.price ? ' · ' + money(it.price) : ''}</button></div>`).join('');
}
function closePanel() {
  $('#panel').classList.remove('show');
  G.panelOpen = false; G.paused = false; input.enabled = true;
  lockPointer();
}
$('#panelList').addEventListener('click', e => {
  const b = e.target.closest('[data-i]');
  if (!b || b.disabled) return;
  const it = panelItems[Number(b.dataset.i)];
  if (save.cash < it.price) return;
  if (it.act()) closePanel(); else renderPanel();
});
$('#panelClose').addEventListener('click', closePanel);
addEventListener('keydown', e => {
  if (e.code !== 'Escape') return;
  if (G.panelOpen) closePanel();
  else if (G.shopOpen) closeShop();
});

G.saveAtSafehouse = () => {
  if (G.stars > 0) { hud.help('You can’t lie low with cops on your tail.', 3000); return; }
  player.hp = 100;
  persist();
  Sound.pickup();
  hud.banner('Game saved', 'Ocean View Hotel', '#21e6ff', 2400);
};
G.sprayCar = () => {
  const c = player.car;
  if (!c) return;
  if (G.stars === 0 && c.hp >= c.t.hp * 0.98) { hud.help('Spray & Go: nothing to fix, come back with a problem.', 3000); return; }
  const cost = save.story === 0 ? 0 : 100;
  if (save.cash < cost) { hud.help('Spray & Go: $100 a job. Come back with cash.', 3000); return; }
  G.addCash(-cost);
  fade(0.6);
  setTimeout(() => {
    const cols = c.t.colors.length > 1 ? c.t.colors.filter(x => x !== c.color) : ['#f6b7c9', '#a8e6cf', '#ffd3a5', '#9fd8f0', '#1d1d1d'];
    c.color = cols[Math.floor(Math.random() * cols.length)];
    if (c.bodyMesh && !c.t.police) c.bodyMesh.material = paint(c.color, 0.32, 0.45);
    c.hp = c.t.hp; c.burn = 0;
    G.setStars(0);
    Sound.cash();
    hud.banner('Fresh paint', cost ? 'Spray & Go · $100' : 'First one’s free', '#ff5edb', 2600);
  }, 450);
};
G.fade = t => fade(t);
function fade(t) { const f = $('#fade'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), t * 1000 + 300); }

// ---------- down: wasted / busted / drowned ----------
function goDown(kind) {
  if (G.mode !== 'play') return;
  G.mode = 'down'; G.downT = 0; G.downKind = kind;
  if (player.car) player.exitCar(G);
  player.enter = null;
  missions.fail(kind === 'busted' ? 'You got busted.' : 'You died.');
  if (kind === 'busted') save.stats.busted++; else save.stats.wasted++;
  G.slow = 0.35;
  Sound.wasted();
  Sound.radio(false);
  const m = player.m;
  if (kind === 'busted') { m.armL.rotation.x = m.armR.rotation.x = -Math.PI * 0.95; m.legL.rotation.x = m.legR.rotation.x = 0; m.body.position.y = 0; }
  else { m.body.rotation.x = -Math.PI / 2; m.body.position.y = 0.16; }
  $('#down').className = 'show ' + kind;
  $('#downTitle').textContent = kind === 'busted' ? 'Busted' : kind === 'drowned' ? 'Drowned' : 'Flatlined';
  $('#downSub').textContent = kind === 'busted' ? 'Weapons confiscated' : 'Weapons lost';
}
function respawn() {
  const kind = G.downKind;
  $('#down').className = '';
  let at = PLACES.police;
  if (kind !== 'busted') at = dist(PLACES.hospital, player) < dist(PLACES.hospital2, player) ? PLACES.hospital : PLACES.hospital2;
  venues.reset();
  clearWorld(true);
  const off = at.side === 'e' ? [1.5, 0] : at.side === 'w' ? [-1.5, 0] : at.side === 'n' ? [0, -1.5] : [0, 1.5];
  player.place(at.x + off[0], at.z + off[1], Math.atan2(off[0], off[1]));
  player.m.body.rotation.x = 0; player.m.body.position.y = 0;
  player.hp = 100; player.stripWeapons();
  if (kind === 'busted') player.armor = 0;
  const bill = Math.min(save.cash, 100);
  G.addCash(-bill);
  G.setStars(0); G.bustT = 0; G.slow = 1;
  G.cam.yaw = player.yaw;
  G.mode = 'play';
  hud.help(kind === 'busted' ? `Your lawyer got you out. Bail: ${money(bill)}.` : `${at.name} patched you up. Bill: ${money(bill)}.`, 4500);
  persist();
}

// ---------- police response ----------
function spawnCop() {
  const T = G.target;
  for (let tries = 0; tries < 20; tries++) {
    const i = Math.floor(Math.random() * (NX + 1)), j = Math.floor(Math.random() * (NZ + 1));
    const p = nodePos(i, j), d = dist(p, T);
    if (d < 90 || d > 180 || G.inView(p.x, p.z) && d < 140) continue;
    if (G.cars.some(c => Math.abs(c.x - p.x) < 8 && Math.abs(c.z - p.z) < 8)) continue;
    const type = G.stars >= 4 && Math.random() < 0.45 ? 'swat' : 'police';
    const v = new Vehicle(G, type, p.x, p.z, Math.atan2(T.x - p.x, T.z - p.z));
    v.driver = 'ai'; v.ai = { mode: 'cop' }; v.crew = 2; v.keep = true; v.siren = true;
    v.topMul = 1 + G.stars * 0.05;
    G.cars.push(v);
    return;
  }
}
function deploy(c) {
  const fx0 = Math.sin(c.yaw), fz0 = Math.cos(c.yaw);
  for (let k = 0; k < c.crew; k++) {
    const side = k ? -1 : 1;
    const x = c.x + fz0 * side * (c.t.W / 2 + 0.7), z = c.z - fx0 * side * (c.t.W / 2 + 0.7);
    const p = new Person(G, c.type === 'swat' ? 'swat' : 'cop', x, z, { state: 'attack', yaw: c.yaw });
    G.peds.push(p);
  }
  c.crew = 0; c.driver = null; c.ai = null; c.keep = false;
}
function manageCops(dt) {
  const T = G.target;
  let n = 0, seen = false;
  for (const c of G.cars) {
    if (c.removed) continue;
    if (c.t.police && c.ai?.mode === 'traffic' && G.stars > 0 && dist(c, T) < 90) { c.ai = { mode: 'cop' }; c.crew = 2; c.keep = true; }
    if (c.ai?.mode !== 'cop') continue;
    if (c.dead) { c.ai = null; c.driver = null; continue; }
    if (G.stars === 0) {
      const a = nearestNode(c.x, c.z);
      c.siren = false; c.keep = false;
      c.ai = { mode: 'traffic', a, b: neighbors(a.i, a.j)[0], wp: [], cruise: 12, panic: 0 };
      continue;
    }
    n++;
    const d = dist(c, T);
    if ((d < 60 && c.ai.los) || d < 25) seen = true;
    if (c.ai.deploy && c.crew > 0) deploy(c);
  }
  for (const p of G.peds) if (isCop(p) && !p.dead && p.state === 'attack' && p.los && dist(p, T) < 50) seen = true;
  if (G.heli && !G.heli.dead && dist(G.heli, T) < 120) seen = true;
  if (G.stars > 0) {
    if (seen) G.lastSeen = G.now;
    G.copT -= dt; G.copT2 -= dt;
    if (n < G.stars && G.copT <= 0) { G.copT = 2.5; spawnCop(); }
    const foot = G.peds.filter(p => isCop(p) && !p.dead && p.state === 'attack').length;
    if (player.onFoot && foot < Math.min(1 + G.stars, 6) && G.copT2 <= 0) {
      G.copT2 = 2.5;
      const s = walkerSpot(T, 35, 75, G.inView);
      if (s) G.peds.push(new Person(G, G.stars >= 4 ? 'swat' : 'cop', s.x, s.z, { state: 'attack' }));
    }
    if (G.stars >= 3 && !G.heli && (G.heliT -= dt) <= 0) spawnHeli();
    const hide = 8 + G.stars * 2.5;
    G.starFlash = G.now - G.lastSeen > 2.5;
    if (G.now - G.lastSeen > hide) G.setStars(G.stars - 1);
  } else G.starFlash = false;
  G.bustT = Math.max(0, G.bustT - dt);
}

// ---------- helicopter ----------
function spawnHeli() {
  const m = buildHeli();
  scene.add(m.group);
  const a = Math.random() * Math.PI * 2;
  const light = new THREE.SpotLight(0xdfe9ff, 0, 140, 0.2, 0.6, 1);
  scene.add(light, light.target);
  G.heli = { m, light, x: G.target.x + Math.cos(a) * 220, z: G.target.z + Math.sin(a) * 220, y: 70, vx: 0, vz: 0, vy: 0, yaw: 0, hp: 450, fireCd: 3, burst: 0, dead: false, t: 0 };
}
function removeHeli() {
  const h = G.heli;
  if (!h) return;
  scene.remove(h.m.group, h.light, h.light.target);
  G.heli = null;
}
function updateHeli(dt) {
  const h = G.heli;
  if (!h) { Sound.rotor(0); return; }
  h.t += dt;
  const T = G.target;
  if (h.dead) {
    h.vy -= 14 * dt; h.y += h.vy * dt; h.x += h.vx * dt; h.z += h.vz * dt; h.yaw += dt * 5;
    fx.smoke(h.x, h.y, h.z, true); fx.fire(h.x, h.y, h.z);
    if (h.y <= groundHeight(h.x, h.z) + 1 || solidAt(h.x, h.y, h.z)) { G.explosion(h.x, Math.max(1, h.y), h.z, null); removeHeli(); G.heliT = 45; return; }
  } else if (h.hp <= 0) {
    h.dead = true; h.vy = 0;
    fx.explosion(h.x, h.y, h.z); Sound.explosion(h.x, h.z);
    if (G.mode === 'play') { G.addHeat(150); hud.help('Chopper down!', 2500); }
  } else {
    const leaving = G.stars < 2 || G.mode !== 'play';
    let tx, tz, ty;
    if (leaving) { tx = h.x + (h.x - T.x); tz = h.z + (h.z - T.z); ty = 120; if (dist(h, T) > 400) { removeHeli(); return; } }
    else { const a = h.t * 0.22; tx = T.x + Math.cos(a) * 24 + T.vx * 1.2; tz = T.z + Math.sin(a) * 24 + T.vz * 1.2; ty = 27; }
    h.vx += ((tx - h.x) * 0.7 - h.vx * 1.1) * dt; h.vz += ((tz - h.z) * 0.7 - h.vz * 1.1) * dt;
    const sp = Math.hypot(h.vx, h.vz);
    if (sp > 48) { h.vx *= 48 / sp; h.vz *= 48 / sp; }
    h.x += h.vx * dt; h.z += h.vz * dt;
    h.y += (ty - h.y) * Math.min(1, dt * 0.8);
    h.yaw += wrap(Math.atan2(T.x - h.x, T.z - h.z) - h.yaw) * Math.min(1, dt * 1.5);
    if (!leaving && G.stars >= 3 && dist(h, T) < 75) {
      h.fireCd -= dt;
      if (h.fireCd <= 0) {
        if (h.burst <= 0) h.burst = 7;
        h.burst--; h.fireCd = h.burst > 0 ? 0.11 : 2.4;
        const hit = Math.random() < 0.3;
        const ex = T.x + (hit ? 0 : (Math.random() - 0.5) * 4), ez = T.z + (hit ? 0 : (Math.random() - 0.5) * 4);
        fx.tracer(h.x, h.y - 1.2, h.z, ex, 0.8, ez, [2.4, 1.2, 0.5]);
        fx.dust(ex, 0.2, ez, 1, [0.6, 0.6, 0.6]);
        Sound.gun('smg', h.x, h.z);
        if (hit) { if (player.car) player.car.damage(4, G); else G.hurtPlayer(6); }
      }
    }
  }
  const g = h.m.group;
  g.position.set(h.x, h.y, h.z);
  g.rotation.set(0, h.yaw, 0);
  g.rotateX(clamp((h.vx * Math.sin(h.yaw) + h.vz * Math.cos(h.yaw)) * 0.008, -0.25, 0.25));
  h.m.rotor.rotation.y += dt * 40; h.m.tail.rotation.x += dt * 50;
  h.m.beacon.visible = Math.floor(h.t * 2) % 2 === 0;
  h.light.position.set(h.x, h.y - 1.5, h.z);
  h.light.target.position.set(T.x, 0, T.z);
  h.light.intensity = h.dead ? 0 : G.night * 140;
  Sound.rotor(clamp(1 - dist(h, camera.position) / 220, 0, 1));
}

// ---------- traffic, people, parked cars ----------
let popT = 0;
function populate(focus, dt) {
  popT -= dt;
  if (popT > 0) return;
  popT = 0.25;
  const hi = save.quality === 'high';
  const NP = hi ? 36 : 20, NC = hi ? 22 : 13;
  for (const p of G.peds) {
    const d = dist(p, focus);
    if ((!p.keep && (d > 150 || (p.dead && p.fade > 30) || p.removeMe)) || (p.dead && p.fade > 60)) p.remove(G);
  }
  G.peds = G.peds.filter(p => !p.removed);
  for (const c of G.cars) {
    if (c === player?.car) continue;
    const d = dist(c, focus);
    if (c === player?.lastCar && (d < 300 || G.inside)) continue;
    if ((c.keep && !c.dead) || c.mission) continue;
    if (d > 210 || (c.dead && d > 90) || (c.sunk && c.flood > 8)) c.remove(G);
  }
  G.cars = G.cars.filter(c => !c.removed);
  if (G.peds.filter(p => p.kind === 'civ' && !p.dead).length < NP) {
    const s = walkerSpot(focus, 30, 120, G.inView);
    if (s) G.peds.push(new Person(G, Math.random() < 0.06 ? 'cop' : 'civ', s.x, s.z));
  }
  if (G.cars.filter(c => c.ai?.mode === 'traffic').length < NC) spawnTraffic(G, focus, 70, 175, null, G.inView);
  for (const s of city.parking) {
    if (s.car && s.car.removed) s.car = null;
    if (s.car) continue;
    const d = dist(s, focus);
    if (d < 150 && d > 35 && !(d < 100 && G.inView(s.x, s.z))) {
      let type = s.lot === 'showroom' ? ['sports', 'convertible', 'muscle'][Math.floor(Math.random() * 3)] : randomType();
      if (type === 'police') type = 'sedan';
      const v = new Vehicle(G, type, s.x, s.z, s.yaw);
      v.ctrl.hb = true;
      G.cars.push(v);
      s.car = v;
    }
  }
}

function carHits() {
  for (const c of G.cars) {
    if (c.removed) continue;
    const sp = c.speed;
    const fx0 = Math.sin(c.yaw), fz0 = Math.cos(c.yaw);
    for (const p of G.walkers) {
      if (Math.abs(p.x - c.x) > 4 || Math.abs(p.z - c.z) > 4 || Math.abs(p.y - c.y) > 1.4) continue;
      const dx = p.x - c.x, dz = p.z - c.z;
      const lx = dx * fz0 - dz * fx0, lz = dx * fx0 + dz * fz0;
      const hw = c.t.W / 2 + 0.35, hl = c.t.L / 2 + 0.35;
      if (Math.abs(lx) >= hw || Math.abs(lz) >= hl) continue;
      if (p === player) {
        if (player.enter || p.y > c.y + c.t.H - 0.4) continue;
        if (sp > 5) {
          G.hurtPlayer(sp * 1.6);
          player.vx = c.vx * 0.9 + fz0 * Math.sign(lx) * 3; player.vz = c.vz * 0.9 - fx0 * Math.sign(lx) * 3;
          player.vy = 4; player.grounded = false;
          Sound.hitPed();
        }
        continue;
      }
      if (sp > 3) {
        const side = Math.sign(lx) || 1;
        p.knock(G, c.vx * 1.05 + fz0 * side * 2, c.vz * 1.05 - fx0 * side * 2, 2.5 + sp * 0.18, sp * 8, c);
        Sound.hitPed();
        c.vx *= 0.94; c.vz *= 0.94;
      } else {
        const px = hw - Math.abs(lx), pz = hl - Math.abs(lz);
        let nlx = 0, nlz = 0;
        if (px < pz) nlx = Math.sign(lx) * px; else nlz = Math.sign(lz) * pz;
        p.x += nlx * fz0 + nlz * fx0; p.z += -nlx * fx0 + nlz * fz0;
      }
    }
  }
}

function clearWorld(keepPlayerCar) {
  for (const c of G.cars) if (!(keepPlayerCar && c === player?.lastCar) && !c.mission) c.remove(G);
  for (const p of G.peds) if (!p.mission) p.remove(G);
  G.cars = G.cars.filter(c => !c.removed);
  G.peds = G.peds.filter(p => !p.removed);
  for (const s of city.parking) if (s.car?.removed) s.car = null;
  removeHeli();
}

// ---------- camera ----------
const _fwd = new THREE.Vector3();
function updateCamera(dt) {
  const cam = G.cam, P = player;
  const look = input.look();
  const sens = 0.0024 * (save.sens || 1);
  if (look.dx || look.dy) cam.idle = 0; else cam.idle += dt;
  cam.yaw = wrap(cam.yaw - look.dx * sens);
  cam.pitch = clamp(cam.pitch + look.dy * sens * (save.invert ? -1 : 1), -0.4, 1.25);
  let tx, ty, tz, d, k;
  if (P.car) {
    const c = P.car;
    if (cam.idle > 1.2 && c.speed > 2 && c.fwd > -1) {
      cam.yaw = wrap(cam.yaw + wrap(c.yaw - cam.yaw) * Math.min(1, dt * 2.6));
      cam.pitch += (0.2 - cam.pitch) * Math.min(1, dt * 2);
    }
    tx = c.x; ty = c.y + c.t.H + 0.5; tz = c.z;
    d = 5.2 + c.t.L * 0.45 + Math.min(c.speed * 0.05, 2.5) + (c.t.van ? 1.2 : 0);
    k = 1 - Math.exp(-dt * 14);
  } else {
    const aim = P.aiming;
    const sh = aim ? 0.75 : 0.45;
    tx = P.x - Math.cos(cam.yaw) * sh; ty = P.y + (aim ? 1.6 : 1.55); tz = P.z + Math.sin(cam.yaw) * sh;
    d = aim ? 2.6 : 4.3;
    k = 1 - Math.exp(-dt * 30);
    if (G.mode === 'down') { cam.yaw += dt * 0.3; cam.pitch += (0.75 - cam.pitch) * dt; d = 7; }
  }
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const dx = -Math.sin(cam.yaw) * cp, dy = sp, dz = -Math.cos(cam.yaw) * cp;
  let best = d;
  for (let s = 0.6; s < d; s += 0.35) if (solidAt(tx + dx * s, ty + dy * s, tz + dz * s)) { best = Math.max(0.8, s - 0.4); break; }
  cam.dist = cam.dist === undefined ? best : best < cam.dist ? best : cam.dist + (best - cam.dist) * Math.min(1, dt * 3);
  let px = tx + dx * cam.dist, py = ty + dy * cam.dist, pz = tz + dz * cam.dist;
  py = Math.max(py, groundHeight(px, pz) + 0.35);
  if (cam.shake > 0) {
    px += (Math.random() - 0.5) * cam.shake; py += (Math.random() - 0.5) * cam.shake * 0.6; pz += (Math.random() - 0.5) * cam.shake;
    cam.shake = Math.max(0, cam.shake - dt * 2.2);
  }
  if (cam.snap) { camera.position.set(px, py, pz); cam.snap = false; }
  else camera.position.lerp(_fwd.set(px, py, pz), k);
  camera.lookAt(tx, ty, tz);
  if (G.drunk > 0.02) { camera.rotateZ(Math.sin(G.now * 0.9) * 0.09 * G.drunk); camera.rotateX(Math.sin(G.now * 1.7) * 0.025 * G.drunk); }
  const fov = 62 + (P.car ? Math.min(14, P.car.speed * 0.28) : 0) - (P.aiming ? 8 : 0);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); }
}

// ---------- the world step ----------
function worldStep(dt, focus) {
  G.walkers = G.peds.filter(p => !p.dead && !p.removed && p.state !== 'ride' && p.state !== 'fly');
  if (G.mode === 'play' && player.onFoot) G.walkers.push(player);
  for (const c of G.cars) {
    if (c.removed) continue;
    if (c.driver === 'ai' && c.ai && !c.dead) {
      if (c.burn > 0) {
        const door = c.door(1);
        const p = new Person(G, c.t.police ? 'cop' : 'civ', door.x, door.z, { state: c.t.police ? 'attack' : 'flee' });
        p.flee.t = 8; p.flee.x = c.x; p.flee.z = c.z;
        G.peds.push(p);
        c.driver = null; c.ai = null;
      } else if (c.ai.mode === 'traffic') driveTraffic(c, G, dt);
      else if (c.ai.mode === 'cop') driveCop(c, G, dt);
      else if (c.ai.mode === 'script') c.ai.fn(c, G, dt);
    }
    c.step(dt, G);
  }
  collideCars(G.cars, G);
  carHits();
  for (const p of G.peds) p.update(dt, G);
  updateHeli(dt);
  populate(focus, dt);
  fx.update(dt, camera.position);
  for (const c of G.cars) c.sync(dt, G.night);
}

function updateTarget() {
  const T = G.target;
  if (player.car) { const c = player.car; T.x = c.x; T.z = c.z; T.vx = c.vx; T.vz = c.vz; T.onFoot = false; T.speed = c.speed; }
  else { T.x = player.x; T.z = player.z; T.vx = player.vx; T.vz = player.vz; T.onFoot = true; T.speed = Math.hypot(player.vx, player.vz); }
}

let zoneT = 0;
function tick(dt) {
  G.now += dt;
  save.stats.time += dt;
  G.hour = (G.hour + dt / 50) % 24;
  if ((G.saveT = (G.saveT || 0) + dt) > 20 && G.mode === 'play' && !missions.active) { G.saveT = 0; persist(); }
  if (G.mode === 'play') {
    if (input.hit('Escape') || input.hit('KeyP')) { openPause('map'); return; }
    if (input.hit('KeyM')) { openPause('map'); return; }
    if (input.hit('KeyJ')) {
      if (missions.side) missions.endSide();
      else if (player.car?.t.taxi) missions.startSide('taxi');
      else if (player.car?.t.police) missions.startSide('vigilante');
    }
    if (!G.activity) player.update(dt, G, input);
    else player.sync(dt);
  } else if (G.mode === 'down') {
    G.downT += dt;
    if (G.downT > 1.6) G.slow = 1;
    if (G.downT > 4.2) respawn();
  }
  updateTarget();
  worldStep(dt, G.inside && venues.back ? venues.back : G.target);
  if (G.mode === 'play') { manageCops(dt); missions.update(dt); }
  else updateHeli(0);
  venues.update(dt);
  if (G.mode === 'down') { player.m.root.position.set(player.x, player.y, player.z); }
  updateCamera(dt);
  envUpdate(dt);
  // audio
  const c = player.car;
  if (c && G.mode === 'play') {
    Sound.engine(!c.dead, c.fwd, Math.max(0, c.ctrl.throttle), c.t.top);
    const slip = Math.abs(c.vx * -Math.cos(c.yaw) + c.vz * Math.sin(c.yaw));
    Sound.skid(c.grounded && slip > 4 ? (slip - 4) / 8 : 0);
  } else { Sound.engine(false, 0, 0, 1); Sound.skid(0); }
  let sv = 0;
  for (const v of G.cars) if (v.siren && !v.dead && v.driver === 'ai') sv = Math.max(sv, 1 - dist(v, camera.position) / 160);
  Sound.siren(clamp(sv, 0, 1));
  Sound.setListener(camera.position.x, camera.position.z);
  Sound.ambience(player.onFoot ? clamp((player.x - BEACH_X + 40) / 60, 0, 1) : 0, player.onFoot ? 1 : 0);
  // hud
  G.hurtFlash = Math.max(0, G.hurtFlash - dt * 0.8);
  hud.hurt(G.hurtFlash + (player.hp < 25 ? 0.12 + Math.sin(G.now * 6) * 0.06 : 0));
  hud.update(dt, G);
  zoneT -= dt;
  if (zoneT <= 0) { zoneT = 0.5; hud.zone(G.inside ? venues.v[G.inside].name : zoneName(player.x, player.z)); }
  const blur = G.drunk > 0.3 ? `blur(${((G.drunk - 0.3) * 2.2).toFixed(1)}px) saturate(${(1 + G.drunk * 0.6).toFixed(2)})` : '';
  if (canvas.style.filter !== blur) canvas.style.filter = blur;
}

function envUpdate(dt) {
  G.night = sky.update(G.hour, G.target, camera, G.now);
  city.setNight(G.night);
  HEAD_MAT.color.setRGB(1 + G.night * 2.2, 1 + G.night * 2.1, 0.9 + G.night * 1.8);
  bloom.strength = 0.3 + G.night * 0.32;
  const c = player?.car;
  if (c && G.night > 0.2) {
    const fx0 = Math.sin(c.yaw), fz0 = Math.cos(c.yaw);
    headlight.intensity = G.night * 45;
    headlight.position.set(c.x + fx0 * (c.t.L / 2), c.y + 0.8, c.z + fz0 * (c.t.L / 2));
    headlight.target.position.set(c.x + fx0 * 30, c.y, c.z + fz0 * 30);
  } else headlight.intensity = 0;
}

// ---------- title screen camera ----------
const TITLE_FOCUS = { x: 548, z: 262 };
function titleTick(dt) {
  G.now += dt;
  G.hour = 19.25;
  const a = G.now * 0.035;
  camera.position.set(TITLE_FOCUS.x + Math.cos(a) * 95, 26 + Math.sin(a * 0.7) * 7, TITLE_FOCUS.z + Math.sin(a) * 95);
  camera.lookAt(TITLE_FOCUS.x - 15, 9, TITLE_FOCUS.z);
  G.target.x = TITLE_FOCUS.x; G.target.z = TITLE_FOCUS.z;
  worldStep(dt, TITLE_FOCUS);
  envUpdate(dt);
}

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.mode === 'loading') return;
  if (!G.paused) {
    if (G.mode === 'title') titleTick(dt);
    else tick(dt * (G.slow || 1));
  }
  if (save.quality === 'high') composer.render();
  else renderer.render(scene, camera);
  input.endFrame();
}

// ---------- menus ----------
function lockPointer() {
  if (input.touch) return;
  try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
}
function showScreen(id) {
  for (const s of $$('.screen')) s.classList.toggle('show', s.id === id);
}
function titleLine() {
  if (!save.started) return 'A neon beach city, 1986.';
  return `${money(save.cash)} · ${save.story}/${STORY_COUNT} story missions · ${save.shells.length} seashells`;
}
function openTitle() {
  G.mode = 'title'; G.paused = false;
  input.enabled = false; input.unlock();
  hud.show(false);
  $('#touch')?.classList.remove('show');
  if (player) { player.m.root.visible = false; if (player.car) { player.car.driver = null; player.car = null; } }
  missions?.clear();
  venues?.reset();
  G.drunk = 0; G.fed = 0; canvas.style.filter = '';
  G.setStars(0);
  clearWorld(false);
  Sound.radio(false); Sound.silenceLoops();
  $('#btnContinue').hidden = !save.started;
  $('#btnNew').classList.toggle('primary', !save.started);
  $('#btnContinue').classList.toggle('primary', save.started);
  $('#saveLine').textContent = titleLine();
  showScreen('title');
}
function startGame(fresh) {
  Sound.unlock();
  if (fresh) {
    const keep = { quality: save.quality, sens: save.sens, invert: save.invert };
    save = Object.assign(defaults(), keep);
    G.save = save;
    player.stripWeapons(); player.armor = 0;
  } else {
    player.has = { fists: true, bat: false, pistol: false, smg: false, shotgun: false, ...save.has };
    player.ammo = { pistol: 0, smg: 0, shotgun: 0, ...save.ammo };
    player.armor = save.armor || 0;
    player.weapon = 'fists';
  }
  save.started = true;
  clearWorld(false);
  const sh = PLACES.safehouse;
  player.place(sh.x + 2.5, sh.z + 3, Math.PI / 2);
  player.m.body.rotation.x = 0; player.m.body.position.y = 0;
  player.hp = 100; player.car = null; player.lastCar = null;
  G.hour = fresh ? 19 : save.hour ?? 19;
  G.cam.yaw = -Math.PI / 2 + 0.6; G.cam.pitch = 0.25; G.cam.snap = true;
  G.setStars(0); G.slow = 1; G.bustT = 0;
  G.mode = 'play';
  missions.reset();
  venues.reset();
  G.drunk = 0; G.fed = 0;
  showScreen(null);
  hud.show(true);
  input.enabled = true;
  if (input.touch) $('#touch')?.classList.add('show');
  lockPointer();
  persist();
  if (fresh || save.story === 0) {
    hud.banner('Coral Bay', '1986', '#ff4fb3', 3600);
    setTimeout(() => hud.help('Sonny Reyes wants to meet you. Walk to the pink <b>S</b> marker at the <b>Starfish Club</b>, two blocks north on Ocean Drive.<br><kbd>WASD</kbd> move · <kbd>Mouse</kbd> look · <kbd>Shift</kbd> sprint · <kbd>F</kbd> steal a car', 11000), 1500);
  } else hud.help('Welcome back to Coral Bay.', 3000);
}
function openPause(tab) {
  if (G.mode !== 'play' && G.mode !== 'down') return;
  G.paused = true;
  input.enabled = false; input.unlock();
  Sound.silenceLoops(); Sound.radio(false);
  showTab(tab || 'map');
  showScreen('pause');
}
function resume() {
  G.paused = false;
  showScreen(null);
  input.enabled = true;
  lockPointer();
  if (player.car || G.inside) Sound.radio(true);
}
function showTab(tab) {
  for (const b of $$('#pause .tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
  for (const p of $$('#pause .pane')) p.classList.toggle('show', p.id === 'pane-' + tab);
  if (tab === 'map') hud.drawMap($('#mapCanvas'), G);
  if (tab === 'stats') {
    const st = save.stats, rows = [
      ['Story', `${save.story} / ${STORY_COUNT}`], ['Cash', money(save.cash)], ['Seashells', `${save.shells.length} / ${missions.shells.length}`],
      ['People down', st.kills], ['Cops down', st.cops], ['Cars wrecked', st.wrecked], ['Taxi fares', st.fares],
      ['Properties', `${Object.values(save.props || {}).filter(p => p.owned).length} / 4`], ['Best dance score', (st.bestDance || 0).toLocaleString('en-US')],
      ['Stunt jumps', st.stunts], ['Best airtime', st.bestStunt + 's'], ['Times busted', st.busted], ['Times flatlined', st.wasted],
      ['Time on the island', `${Math.floor(st.time / 3600)}h ${Math.floor(st.time / 60) % 60}m`]
    ];
    $('#statsList').innerHTML = rows.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
  }
  if (tab === 'settings') syncSettings();
}
input.onUnlock = () => { if (G.mode === 'play' && !G.paused && !G.shopOpen && !G.panelOpen) openPause('map'); };
$$('#pause .tabs button').forEach(b => b.addEventListener('click', () => { Sound.ui(); showTab(b.dataset.tab); }));
$('#resume').addEventListener('click', resume);
$('#toTitle').addEventListener('click', () => { persist(); openTitle(); });
$('#btnNew').addEventListener('click', () => {
  if (save.started && !confirmNew()) return;
  startGame(true);
});
let confirmArmed = false;
function confirmNew() {
  if (confirmArmed) return true;
  confirmArmed = true;
  $('#btnNew').textContent = 'Erase save and start over?';
  setTimeout(() => { confirmArmed = false; $('#btnNew').textContent = 'New game'; }, 3000);
  return false;
}
$('#btnContinue').addEventListener('click', () => startGame(false));
$$('[data-panel]').forEach(b => b.addEventListener('click', () => {
  const id = b.dataset.panel;
  for (const p of $$('#title .panel')) p.classList.toggle('show', p.id === id && !p.classList.contains('show'));
  if (id === 'panelSettings') syncSettings();
}));
$$('.panel .close').forEach(b => b.addEventListener('click', () => b.closest('.panel').classList.remove('show')));
$('#hudPause')?.addEventListener('click', () => openPause('map'));

// settings
function syncSettings() {
  const v = Sound.volumes;
  for (const el of $$('[data-set="quality"]')) el.value = save.quality;
  for (const el of $$('[data-set="sens"]')) el.value = save.sens;
  for (const el of $$('[data-set="invert"]')) el.checked = !!save.invert;
  for (const el of $$('[data-set="music"]')) el.value = v.music;
  for (const el of $$('[data-set="sfx"]')) el.value = v.sfx;
}
document.addEventListener('input', e => {
  const k = e.target.dataset?.set;
  if (!k) return;
  if (k === 'quality') { save.quality = e.target.value; applyQuality(); }
  if (k === 'sens') save.sens = Number(e.target.value);
  if (k === 'invert') save.invert = e.target.checked;
  if (k === 'music' || k === 'sfx') {
    const v = Sound.volumes;
    Sound.setVolumes(k === 'sfx' ? Number(e.target.value) : v.sfx, k === 'music' ? Number(e.target.value) : v.music);
  }
  syncSettings();
  persist();
});
function applyQuality() {
  const hi = save.quality === 'high';
  renderer.setPixelRatio(hi ? Math.min(devicePixelRatio, 2) : Math.min(devicePixelRatio, 1));
  composer.setPixelRatio(hi ? Math.min(devicePixelRatio, 2) : Math.min(devicePixelRatio, 1));
  if (sky) { sky.sun.castShadow = hi; sky.sun.shadow.mapSize.set(hi ? 2048 : 1024, hi ? 2048 : 1024); sky.sun.shadow.map?.dispose(); sky.sun.shadow.map = null; }
  resize();
}

// ---------- boot ----------
function setLoad(p, text) { $('#loadFill').style.width = Math.round(p * 100) + '%'; $('#loadText').textContent = text; }
async function init() {
  setLoad(0.08, 'Tuning the radio…');
  try { await Promise.race([Promise.all([document.fonts.load('64px "Kaushan Script"'), document.fonts.load('800 16px Rubik')]), wait(2500)]); } catch (e) {}
  await nextFrame();
  setLoad(0.25, 'Paving Ocean Drive…');
  await nextFrame();
  city = buildCity(scene, save.quality);
  G.city = city;
  setLoad(0.6, 'Planting palm trees…');
  await nextFrame();
  sky = new Sky(scene);
  fx = new FX(scene); G.fx = fx;
  headlight = new THREE.SpotLight(0xfff1d6, 0, 70, 0.55, 0.6, 1.2);
  scene.add(headlight, headlight.target);
  player = new Player(G, save); G.player = player;
  player.m.root.visible = false;
  missions = new Missions(G); G.missions = missions;
  G.sky = sky;
  venues = new Venues(G); G.venues = venues;
  applyQuality();
  setLoad(0.85, 'Waiting for sunset…');
  await nextFrame();
  G.mode = 'title';
  for (let k = 0; k < 40; k++) populate(TITLE_FOCUS, 1);
  titleTick(0.016);
  renderer.compile(scene, camera);
  setLoad(1, 'Ready');
  await wait(150);
  $('#loading').classList.remove('show');
  openTitle();
  window.__southline = { G, renderer, Person, Vehicle, startGame, fastForward: s => { for (let t = 0; t < s; t += 1 / 30) { (G.mode === 'title' ? titleTick : tick)(1 / 30); input.endFrame(); } } };
}
requestAnimationFrame(frame);
init().catch(err => { console.error(err); setLoad(1, 'Something went wrong: ' + err.message); });
