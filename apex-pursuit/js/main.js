import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildTrack, LANES } from './track.js';
import { World } from './world.js';
import { makeCar, makeTruck, TRAFFIC_SHAPE } from './cars.js';
import { CARS, PAINTS, LOCATIONS, RIVALS, carById, locById, createGame, update, HEAT_COLORS } from './sim.js';
import { Sound } from './audio.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const fmt = n => Math.round(n).toLocaleString('en-US');
const money = n => '$' + fmt(n);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const kmh = v => Math.round(Math.abs(v) * 3.6);
const LOC_SWATCH = { coast: '#ff9a5c', canyon: '#ff6b3d', alpine: '#8fb7ff' };

// ---------- save ----------
const KEY = 'apexpursuit.save.v1';
const defaults = () => ({ cash: 2500, career: 0, owned: ['kestrel'], car: 'kestrel', paint: { kestrel: 'ember' }, beaten: [], loc: 'coast', quality: 'high', cam: 0 });
let save = defaults();
try { save = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} };
const paintOf = id => (PAINTS.find(p => p.id === save.paint[id]) || PAINTS[0]);

// ---------- renderer ----------
const canvas = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const world = new World(renderer);
const scene = world.scene;
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.3, 6000);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.32, 0.4, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function applyQuality() {
  const high = save.quality === 'high';
  const pr = high ? Math.min(devicePixelRatio, 2) : Math.min(devicePixelRatio, 1);
  renderer.setPixelRatio(pr);
  composer.setPixelRatio(pr);
  bloom.enabled = high;
  if (world.sun) world.sun.castShadow = high;
  $('#bQuality').textContent = 'Graphics: ' + (high ? 'High' : 'Performance');
  resize();
}
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ---------- particles ----------
function softTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,255,255,.9)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
class Particles {
  constructor(count, additive) {
    this.list = [];
    const tex = softTexture();
    for (let i = 0; i < count; i++) {
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
      const s = new THREE.Sprite(m);
      s.visible = false;
      scene.add(s);
      this.list.push({ s, life: 0, max: 1, v: new THREE.Vector3(), a: 0, b: 1, o: 1 });
    }
    this.i = 0;
  }
  spawn(pos, vel, life, size0, size1, color, opacity) {
    const p = this.list[this.i++ % this.list.length];
    p.s.position.copy(pos); p.v.copy(vel); p.life = life; p.max = life; p.a = size0; p.b = size1; p.o = opacity;
    p.s.material.color.set(color);
    p.s.visible = true;
  }
  update(dt) {
    for (const p of this.list) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; continue; }
      const t = 1 - p.life / p.max;
      p.s.position.addScaledVector(p.v, dt);
      p.v.multiplyScalar(1 - dt * 1.2);
      p.s.scale.setScalar(p.a + (p.b - p.a) * t);
      p.s.material.opacity = p.o * (1 - t) * Math.min(1, t * 6);
    }
  }
  clear() { for (const p of this.list) { p.life = 0; p.s.visible = false; } }
}
const smoke = new Particles(140, false);
const sparks = new Particles(80, true);

// ---------- world / meshes ----------
let track = null, builtLoc = null;
let game = null, session = null;
let player = null; // player car mesh
const meshes = new Map();
const pool = new Map();
const tmp = {}, V = new THREE.Vector3(), V2 = new THREE.Vector3();

function setLoad(p, text) {
  $('#loadFill').style.width = (p * 100) + '%';
  if (text) $('#loadText').textContent = text;
}
const nextFrame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

async function ensureWorld(locId) {
  if (builtLoc === locId) return;
  const loc = locById(locId);
  show('loading');
  setLoad(0.15, 'Paving ' + loc.name + '…');
  await nextFrame();
  track = buildTrack(loc);
  setLoad(0.45, 'Raising the ' + (loc.id === 'coast' ? 'cliffs' : loc.id === 'canyon' ? 'mesas' : 'peaks') + '…');
  await nextFrame();
  clearEntities();
  world.build(loc, track, save.quality);
  applyQuality();
  setLoad(0.85, 'Waking up dispatch…');
  await nextFrame();
  builtLoc = locId;
  renderer.compile(scene, camera);
  setLoad(1);
}

function poolGet(key, make) {
  const list = pool.get(key);
  if (list && list.length) { const m = list.pop(); m.root.visible = true; return m; }
  const m = make();
  m.key = key;
  return m;
}
function poolPut(m) {
  world.dyn.remove(m.root);
  if (!pool.has(m.key)) pool.set(m.key, []);
  pool.get(m.key).push(m);
}
function clearEntities() {
  for (const m of meshes.values()) poolPut(m);
  meshes.clear();
  smoke.clear(); sparks.clear();
}

function makePlayerMesh() {
  if (player) world.dyn.remove(player.root);
  const spec = carById(save.car);
  player = makeCar(spec.shape, paintOf(spec.id).hex);
  world.dyn.add(player.root);
}

function entityMesh(e) {
  let key, make;
  if (e.kind === 'traffic') {
    key = e.type + e.color;
    make = () => e.type === 'truck' ? makeTruck(e.color) : makeCar(TRAFFIC_SHAPE[e.type], e.color);
  } else if (e.kind === 'cop' || e.kind === 'block') {
    key = 'cop';
    make = () => makeCar('police', '#0d1017', { police: true });
  } else {
    key = 'rival' + e.info.rank;
    make = () => makeCar(e.spec.shape, e.info.paint);
  }
  let m = meshes.get(e.id);
  if (m && m.key !== key) { poolPut(m); meshes.delete(e.id); m = null; }
  if (!m) {
    m = poolGet(key, make);
    m.key = key;
    m.root.rotation.order = 'YXZ';
    m.tilt.rotation.set(0, 0, 0);
    world.dyn.add(m.root);
    meshes.set(e.id, m);
  }
  return m;
}

function headingAI(e, smp) {
  const off = Math.atan2(e.vx || 0, Math.abs(e.v) + 1);
  return e.v >= -0.5 ? smp.a - off : smp.a + Math.PI + off;
}

function placeEntity(m, s, x, heading, back = false) {
  track.world(s, x, tmp);
  m.root.position.set(tmp.x, tmp.y + 0.04, tmp.z);
  m.root.rotation.order = 'YXZ';
  m.root.rotation.y = heading;
  m.root.rotation.x = (back ? 1 : -1) * Math.atan(tmp.g);
}

// ---------- camera ----------
const CAMS = [
  { name: 'Chase', dist: 7.4, h: 2.35, look: 1.25, ahead: 5 },
  { name: 'Far', dist: 11.5, h: 3.7, look: 1.4, ahead: 6 },
  { name: 'Hood', dist: -0.6, h: 1.25, look: 1.0, ahead: 30 },
];
const cam = { yaw: 0, pos: new THREE.Vector3(), look: new THREE.Vector3(), shake: 0, fov: 62, init: false };

// ---------- input ----------
const keys = new Set();
const touch = { left: false, right: false, gas: false, brake: false, nitro: false, drift: false };
const GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
addEventListener('keydown', e => {
  if (GAME_KEYS.includes(e.code) && (mode === 'race' || mode === 'count')) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (mode === 'race') pause(true);
    else if (mode === 'paused') pause(false);
  }
  if (e.code === 'KeyC' && (mode === 'race' || mode === 'count')) cycleCam();
  if (e.code === 'KeyR' && mode === 'race') resetCar();
  if (e.code === 'KeyM') toggleMusic();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); if (mode === 'race') pause(true); });
const anyKey = (...c) => c.some(k => keys.has(k));

for (const b of $$('#touch button')) {
  const k = b.dataset.k;
  const on = v => e => { e.preventDefault(); touch[k] = v; b.classList.toggle('on', v); };
  b.addEventListener('pointerdown', on(true));
  b.addEventListener('pointerup', on(false));
  b.addEventListener('pointercancel', on(false));
  b.addEventListener('pointerleave', on(false));
}
if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touchy');
addEventListener('touchstart', () => document.body.classList.add('touchy'), { once: true, passive: true });

function readInput() {
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
  let steer = (anyKey('ArrowRight', 'KeyD') || touch.right ? 1 : 0) - (anyKey('ArrowLeft', 'KeyA') || touch.left ? 1 : 0);
  let throttle = anyKey('ArrowUp', 'KeyW') || touch.gas ? 1 : 0;
  let brake = anyKey('ArrowDown', 'KeyS') || touch.brake ? 1 : 0;
  let nitro = anyKey('ShiftLeft', 'ShiftRight', 'KeyN') || touch.nitro;
  let handbrake = anyKey('Space') || touch.drift;
  if (gp) {
    const ax = gp.axes[0] || 0;
    if (Math.abs(ax) > 0.15) steer = ax;
    throttle = Math.max(throttle, gp.buttons[7]?.value || 0);
    brake = Math.max(brake, gp.buttons[6]?.value || 0);
    nitro = nitro || gp.buttons[0]?.pressed || gp.buttons[1]?.pressed;
    handbrake = handbrake || gp.buttons[2]?.pressed || gp.buttons[5]?.pressed;
    if (gp.buttons[9]?.pressed && mode === 'race' && !readInput.startHeld) pause(true);
    readInput.startHeld = gp.buttons[9]?.pressed;
  }
  return { steer, throttle, brake, nitro, handbrake };
}

// ---------- screens ----------
let mode = 'loading';
function show(id) {
  for (const s of ['loading', 'menu', 'hud']) $('#' + s).classList.toggle('show', s === id || (id === 'race' && s === 'hud'));
}

// ---------- menu ----------
let tab = 'play';
let garageSel = save.car;
function setTab(t) {
  tab = t;
  $$('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $$('.pane').forEach(p => p.classList.toggle('show', p.id === 'pane-' + t));
  if (t === 'garage') { garageSel = save.car; renderGarage(); }
  if (t === 'wanted') renderRivals();
  if (t === 'play') previewCar(save.car);
  Sound.play('click');
}
$$('.tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
$$('[data-tab-go]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tabGo)));

function renderWallet() {
  $('#cash').textContent = money(save.cash);
  $('#career').textContent = fmt(save.career);
}
function renderLocs() {
  $('#locs').innerHTML = LOCATIONS.map(l => `<button class="loc${l.id === save.loc ? ' on' : ''}" data-loc="${l.id}" style="--sw:${LOC_SWATCH[l.id]}"><b>${l.short}</b><span>${l.blurb}</span></button>`).join('');
  $('#heroLoc').textContent = locById(save.loc).name;
  $$('.loc').forEach(b => b.addEventListener('click', async () => {
    if (save.loc === b.dataset.loc) return;
    save.loc = b.dataset.loc; persist();
    Sound.play('click');
    renderLocs();
    await ensureWorld(save.loc);
    enterMenu();
  }));
}
function statRows(spec, cls) {
  const rows = [
    ['Top speed', spec.top / 85, Math.round(spec.top * 3.6 * 1.2) + ''],
    ['Acceleration', spec.accel / 18.5, (100 / 3.6 / spec.accel * 1.7).toFixed(1) + 's'],
    ['Handling', spec.grip / 23, Math.round(spec.grip / 23 * 100) + ''],
    ['Nitro', spec.nitro / 1.3, Math.round(spec.nitro * 100) + '']
  ];
  return `<div class="${cls}">` + rows.map(([n, v, t]) => `<div>${n}<i style="--v:${Math.round(v * 100)}%"></i><b>${t}</b></div>`).join('') + '</div>';
}
function renderPlate() {
  const spec = carById(save.car);
  $('#plate').innerHTML = `<div class="p-cls">${spec.cls} class · ${paintOf(spec.id).name}</div><div class="p-name">${spec.name}</div>` + statRows(spec, 'mini-stats');
}
function rivalState(r) {
  if (save.beaten.includes(r.rank)) return 'done';
  const next = Math.max(0, ...RIVALS.filter(x => !save.beaten.includes(x.rank)).map(x => x.rank));
  if (r.rank !== next) return 'locked';
  return save.career >= r.need ? 'next' : 'need';
}
function renderRivals() {
  $('#rivals').innerHTML = RIVALS.map(r => {
    const st = rivalState(r);
    const spec = carById(r.car);
    const act = st === 'done' ? 'Beaten' : st === 'next' ? 'Challenge' : st === 'need' ? 'Bounty ' + fmt(r.need) : 'Locked';
    return `<button class="rival ${st === 'need' ? 'locked' : st}" data-rank="${r.rank}" ${st === 'next' ? '' : 'aria-disabled="true"'}>
      <span class="rk">#${r.rank}</span>
      <span><span class="nm"><i style="--c:${r.paint}"></i>${r.name}</span><span class="meta">${r.tag} · ${spec.name} · ${locById(r.loc).short}${r.laps > 1 ? ' · ' + r.laps + ' laps' : ''}</span></span>
      <span class="act">${act}</span></button>`;
  }).join('');
  $$('.rival').forEach(b => b.addEventListener('click', () => {
    const r = RIVALS.find(x => x.rank === +b.dataset.rank);
    if (rivalState(r) !== 'next') { Sound.play('hover'); return; }
    Sound.play('click');
    startSession('race', r);
  }));
}
function renderGarage() {
  const spec = carById(garageSel);
  $('#gName').textContent = spec.name;
  $('#gCls').textContent = spec.cls;
  $('#carList').innerHTML = CARS.map(c => {
    const own = save.owned.includes(c.id);
    const tag = c.id === save.car ? '<span class="tag own">Driving</span>' : own ? '<span class="tag own">Owned</span>' : `<span class="tag price">${money(c.price)}</span>`;
    return `<button class="car-row${c.id === garageSel ? ' on' : ''}" data-car="${c.id}"><span><b>${c.name}</b><small>${c.cls} · ${Math.round(c.top * 3.6 * 1.2)} km/h</small></span>${tag}</button>`;
  }).join('');
  $$('.car-row').forEach(b => b.addEventListener('click', () => { garageSel = b.dataset.car; Sound.play('click'); renderGarage(); previewCar(garageSel); }));
  $('#gStats').outerHTML = statRows(spec, 'stats').replace('class="stats"', 'class="stats" id="gStats"');
  const cur = paintOf(spec.id);
  $('#paintName').textContent = cur.name;
  $('#paints').innerHTML = PAINTS.map(p => `<button class="sw${p.id === cur.id ? ' on' : ''}" style="--c:${p.hex}" data-paint="${p.id}" title="${p.name}" aria-label="${p.name}"></button>`).join('');
  $$('.sw').forEach(b => b.addEventListener('click', () => {
    save.paint[garageSel] = b.dataset.paint; persist();
    Sound.play('click');
    renderGarage(); renderPlate();
    if (showroomCar) showroomCar.setPaint(paintOf(garageSel).hex);
  }));
  const own = save.owned.includes(spec.id);
  const btn = $('#gAction');
  btn.disabled = false;
  if (spec.id === save.car) { btn.innerHTML = '<span>Driving this one</span>'; btn.disabled = true; }
  else if (own) btn.innerHTML = '<span>Drive this car</span>';
  else if (save.cash >= spec.price) btn.innerHTML = `<span>Buy · ${money(spec.price)}</span>`;
  else { btn.innerHTML = `<span>Need ${money(spec.price - save.cash)} more</span>`; btn.disabled = true; }
}
$('#gAction').addEventListener('click', () => {
  const spec = carById(garageSel);
  if (!save.owned.includes(spec.id)) {
    if (save.cash < spec.price) return;
    save.cash -= spec.price;
    save.owned.push(spec.id);
    Sound.play('buy');
  } else Sound.play('click');
  save.car = spec.id;
  if (!save.paint[spec.id]) save.paint[spec.id] = 'ember';
  persist();
  makePlayerMesh();
  renderGarage(); renderPlate(); renderWallet();
  previewCar(save.car);
});

// showroom
let showroomCar = null, showroomId = null;
const orbit = { a: 0.7, drag: false, lastX: 0, vel: 0, offset: 0 };
function previewCar(id) {
  if (showroomId === id && showroomCar) { showroomCar.setPaint(paintOf(id).hex); return; }
  if (showroomCar && showroomCar !== player) world.dyn.remove(showroomCar.root);
  if (id === save.car) {
    if (!player) makePlayerMesh();
    showroomCar = player;
  } else {
    const spec = carById(id);
    showroomCar = makeCar(spec.shape, paintOf(id).hex);
    world.dyn.add(showroomCar.root);
  }
  if (player) player.root.visible = showroomCar === player;
  showroomCar.root.visible = true;
  showroomId = id;
}
function enterMenu() {
  mode = 'menu';
  show('menu');
  clearEntities();
  if (!player) makePlayerMesh();
  previewCar(tab === 'garage' ? garageSel : save.car);
  renderWallet(); renderLocs(); renderPlate();
  if (tab === 'wanted') renderRivals();
  if (tab === 'garage') renderGarage();
  $('#fx-cops').style.opacity = 0;
  $('#fx-speed').style.opacity = 0;
  Sound.musicIntensity(0.2);
}
const menuEl = $('#menu');
menuEl.addEventListener('pointerdown', e => {
  if (e.target.closest('button, a, .side-panel, .hero, .plate')) return;
  orbit.drag = true; orbit.lastX = e.clientX;
  menuEl.setPointerCapture(e.pointerId);
});
menuEl.addEventListener('pointermove', e => {
  if (!orbit.drag) return;
  const dx = e.clientX - orbit.lastX;
  orbit.lastX = e.clientX;
  orbit.a -= dx * 0.008;
  orbit.vel = -dx * 0.008;
});
menuEl.addEventListener('pointerup', () => { orbit.drag = false; });

function showroom(dt) {
  if (!showroomCar) return;
  const s = 60;
  track.world(s, 2, tmp);
  const car = showroomCar;
  car.root.position.set(tmp.x, tmp.y + 0.04, tmp.z);
  car.root.rotation.set(-Math.atan(tmp.g), tmp.a, 0, 'YXZ');
  car.tilt.rotation.set(0, 0, 0);
  car.animate(dt, 0, Math.sin(T * 0.6) * 0.5, false, T);
  if (!orbit.drag) { orbit.a += dt * 0.16 + orbit.vel; orbit.vel *= 0.92; }
  const portrait = innerWidth / innerHeight < 1;
  const dist = (tab === 'garage' ? 6.4 : 7.4) * (portrait ? Math.min(2.2, Math.pow(innerHeight / innerWidth, 0.9)) : 1);
  const ca = tmp.a + orbit.a;
  const target = new THREE.Vector3(tmp.x, tmp.y + 0.75, tmp.z);
  camera.position.set(target.x + Math.sin(ca) * dist, target.y + 1.0 + Math.sin(T * 0.3) * 0.15, target.z + Math.cos(ca) * dist);
  // slide the car to the side the UI isn't covering
  const want = innerWidth < 720 ? 0 : tab === 'play' ? -2.2 : 2.4;
  orbit.offset += (want - orbit.offset) * Math.min(1, dt * 3);
  const right = new THREE.Vector3().subVectors(target, camera.position).cross(camera.up).normalize();
  if (portrait) target.y -= tab === 'play' ? 2.4 : 0.6;
  camera.lookAt(target.addScaledVector(right, orbit.offset));
  camera.fov = 42; camera.updateProjectionMatrix();
  world.update(target, T, camera);
}

// ---------- HUD ----------
const hud = {
  speed: $('#speed'), gear: $('#gear'), rpm: $('#rpmArc'), bounty: $('#bounty'), status: $('#status'), statusText: $('#statusText'),
  meter: $('#meter'), bust: $('#bustFill'), evade: $('#evadeFill'), meterText: $('#meterText'), heatBars: $('#heatBars'),
  cells: $('#nitroCells'), feed: $('#feed'), alert: $('#alert'), map: $('#minimap'), pos: $('#pos'), gap: $('#gap'),
  progFill: $('#progFill'), mkYou: $('#mkYou'), mkRiv: $('#mkRiv'), progLeft: $('#progLeft')
};
(function buildDial() {
  const g = $('#ticks');
  let out = '';
  for (let i = 0; i <= 30; i++) {
    const th = (i / 30) * 1.5 * Math.PI;
    const r1 = i % 5 === 0 ? 72 : 77, r2 = 82;
    out += `<line ${i > 25 ? 'class="red"' : ''} x1="${110 + r1 * Math.cos(th)}" y1="${110 + r1 * Math.sin(th)}" x2="${110 + r2 * Math.cos(th)}" y2="${110 + r2 * Math.sin(th)}"/>`;
  }
  g.innerHTML = out;
  hud.cells.innerHTML = '<i></i>'.repeat(12);
})();
const last = {};
function setText(el, key, v) { if (last[key] !== v) { last[key] = v; el.textContent = v; } }

function feed(label, value, color = '#ffb21f') {
  const c = document.createElement('div');
  c.className = 'chip';
  c.style.setProperty('--cc', color);
  c.innerHTML = (value ? `<b>${value}</b>` : '') + label;
  hud.feed.prepend(c);
  setTimeout(() => c.remove(), 2700);
  while (hud.feed.children.length > 4) hud.feed.lastChild.remove();
}
function alertMsg(kick, text, color = '#ffb21f') {
  const a = hud.alert;
  a.classList.remove('show');
  void a.offsetWidth;
  a.style.setProperty('--ac', color);
  $('#alertKick').textContent = kick;
  $('#alertText').textContent = text;
  a.classList.add('show');
}
function bumpBounty() {
  hud.bounty.classList.remove('bump');
  void hud.bounty.offsetWidth;
  hud.bounty.classList.add('bump');
}
let hitFlash = 0;

function updateHUD() {
  const g = game, p = g.player;
  setText(hud.speed, 'spd', String(kmh(p.v)));
  setText(hud.gear, 'gear', p.gear === 0 ? 'R' : Math.abs(p.v) < 0.5 ? 'N' : String(p.gear));
  hud.rpm.style.strokeDasharray = `${(p.rpm * 75).toFixed(1)} 100`;
  const on = Math.ceil(p.nitro * 12 - 0.01);
  if (last.nitro !== on) {
    last.nitro = on;
    [...hud.cells.children].forEach((c, i) => c.classList.toggle('on', i < on));
  }
  hud.cells.classList.toggle('burn', p.nitroOn);
  if (g.mode === 'pursuit') {
    setText(hud.bounty, 'bounty', fmt(g.bounty));
    if (last.heat !== g.heat) {
      last.heat = g.heat;
      hud.heatBars.style.setProperty('--hc', HEAT_COLORS[g.heat]);
      [...hud.heatBars.children].forEach((b, i) => b.classList.toggle('on', i < g.heat));
    }
    const live = g.cops.filter(c => !c.wrecked && c.mode !== 'patrol').length;
    let st = 'idle', txt = 'Cruising';
    if (g.pursuit) {
      if (g.evade > 0.02) { st = 'cool'; txt = 'Evading'; }
      else { st = 'chase'; txt = 'Pursuit · ' + live + (live === 1 ? ' unit' : ' units'); }
    }
    hud.status.className = 'status' + (st === 'idle' ? '' : ' ' + st);
    setText(hud.statusText, 'status', txt);
    hud.meter.hidden = !g.pursuit;
    hud.bust.style.width = (g.busted * 50) + '%';
    hud.evade.style.width = (g.evade * 50) + '%';
    setText(hud.meterText, 'mt', g.busted > 0.05 ? 'Get moving!' : g.evade > 0.02 ? 'Lose them' : 'Pursuit');
  } else {
    const r = g.rival;
    const ahead = p.dist >= r.dist;
    setText(hud.pos, 'pos', ahead ? '1' : '2');
    if (last.posSuf !== ahead) { last.posSuf = ahead; hud.pos.innerHTML = (ahead ? '1<small>st</small>' : '2<small>nd</small>'); }
    const gapS = (p.dist - r.dist) / Math.max(20, Math.abs(p.v));
    setText(hud.gap, 'gap', (gapS >= 0 ? '+' : '−') + Math.abs(gapS).toFixed(1) + 's');
    hud.gap.classList.toggle('behind', gapS < 0);
    const fp = clamp(p.dist / g.goal, 0, 1), fr = clamp(r.dist / g.goal, 0, 1);
    hud.progFill.style.width = (fp * 100) + '%';
    hud.mkYou.style.left = (fp * 100) + '%';
    hud.mkRiv.style.left = (fr * 100) + '%';
    setText(hud.progLeft, 'left', Math.max(0, (g.goal - p.dist) / 1000).toFixed(1) + ' km to go');
    const lap = Math.min(r.info.laps, 1 + Math.floor(Math.max(0, p.dist) / track.length));
    setText(hud.statusText, 'status', r.info.laps > 1 ? `Sprint · Lap ${lap}/${r.info.laps}` : 'Sprint race');
  }
}

function drawMap() {
  const cv = hud.map, ctx = cv.getContext('2d'), W = cv.width, c = W / 2, R = W / 2 - 6;
  const p = game.player;
  track.sample(p.s, tmp);
  const px = tmp.x + -Math.cos(tmp.a) * p.x, pz = tmp.z + Math.sin(tmp.a) * p.x;
  const h = tmp.a - p.psi;
  const fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
  const sc = R / 380;
  const P = (wx, wz) => { const dx = wx - px, dz = wz - pz; return [c + (dx * rx + dz * rz) * sc, c - (dx * fx + dz * fz) * sc]; };
  ctx.clearRect(0, 0, W, W);
  ctx.save();
  ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.clip();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= track.n; i += 4) {
    const k = i % track.n;
    const [x, y] = P(track.X[k], track.Z[k]);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 16; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 5; ctx.stroke();
  const [sx, sy] = P(track.X[0], track.Z[0]);
  ctx.fillStyle = '#fff'; ctx.fillRect(sx - 6, sy - 2, 12, 4);
  const dot = (e, col, r) => {
    const w = track.world(e.s, e.x, {});
    const [x, y] = P(w.x, w.z);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
  };
  for (const t of game.traffic) if (Math.abs(track.delta(p.s, t.s)) < 450) dot(t, 'rgba(255,255,255,.35)', 3);
  for (const b of game.blocks) dot(b, '#ff2a3d', 5);
  const flash = Math.floor(T * 6) % 2;
  for (const cop of game.cops) dot(cop, cop.wrecked ? 'rgba(160,160,160,.6)' : (flash ^ (cop.id & 1)) ? '#ff2a3d' : '#3a6bff', 6);
  if (game.rival) dot(game.rival, game.rival.info.paint, 7);
  ctx.restore();
  // player arrow
  ctx.save();
  ctx.translate(c, c);
  ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(9, 10); ctx.lineTo(0, 5); ctx.lineTo(-9, 10); ctx.closePath();
  ctx.fillStyle = '#ffb21f'; ctx.shadowColor = '#ff7a1f'; ctx.shadowBlur = 12; ctx.fill();
  ctx.restore();
}

// ---------- session ----------
let countT = 0, overT = 0, hintT = 0, resetT = 0;
async function startSession(kind, rival = null) {
  Sound.unlock();
  const locId = kind === 'race' ? rival.loc : save.loc;
  await ensureWorld(locId);
  clearEntities();
  if (showroomCar && showroomCar !== player) { world.dyn.remove(showroomCar.root); }
  showroomCar = null; showroomId = null;
  makePlayerMesh();
  session = { kind, rival };
  game = createGame({ track, mode: kind, car: carById(save.car), rival, seed: (Math.random() * 1e9) | 0 });
  for (const k in last) delete last[k];
  $('#heatBox').hidden = kind !== 'pursuit';
  $('.bounty').hidden = kind !== 'pursuit';
  $('#racePos').hidden = kind !== 'race';
  $('#progress').hidden = kind !== 'race';
  hud.meter.hidden = true;
  if (rival) {
    $('#rivalName').textContent = 'vs ' + rival.name;
    hud.mkRiv.style.setProperty('--rc', rival.paint);
  }
  hud.feed.innerHTML = '';
  hud.status.className = 'status';
  $('#hint').classList.remove('fade');
  hintT = 0;
  cam.init = false;
  mode = 'count';
  countT = 0;
  show('race');
  $('#result').classList.remove('show');
  $('#pause').classList.remove('show');
  Sound.engineStart();
  Sound.musicStart(0.35);
  Sound.musicIntensity(0.35);
}

function cycleCam() {
  save.cam = (save.cam + 1) % CAMS.length;
  persist();
  $('#pCam').textContent = 'Camera: ' + CAMS[save.cam].name;
  feed('Camera · ' + CAMS[save.cam].name, '', '#9aa1ad');
}
function resetCar() {
  if (resetT > 0) return;
  const p = game.player;
  resetT = 2;
  p.x = LANES.reduce((b, l) => Math.abs(l - p.x) < Math.abs(b - p.x) ? l : b, 2);
  p.psi = 0; p.drift = 0;
  p.v = Math.max(p.v, 8);
}

function pause(on) {
  if (on && mode === 'race') {
    mode = 'paused';
    $('#pause').classList.add('show');
    Sound.engine(0.1, 0, 0, 0, false);
    Sound.siren(0, T);
  } else if (!on && mode === 'paused') {
    mode = 'race';
    $('#pause').classList.remove('show');
  }
}
$('#bPause').addEventListener('click', () => pause(true));
$('#pResume').addEventListener('click', () => pause(false));
$('#pRestart').addEventListener('click', () => { Sound.sirenStop(); startSession(session.kind, session.rival); });
$('#pCam').addEventListener('click', cycleCam);
$('#pQuit').addEventListener('click', quitToMenu);
$('#rAgain').addEventListener('click', () => {
  if (session.kind === 'race' && save.beaten.includes(session.rival.rank)) { quitToMenu(); setTab('wanted'); return; }
  startSession(session.kind, session.rival);
});
$('#rMenu').addEventListener('click', quitToMenu);

async function quitToMenu() {
  Sound.engineStop();
  Sound.sirenStop();
  $('#pause').classList.remove('show');
  $('#result').classList.remove('show');
  game = null;
  if (builtLoc !== save.loc) await ensureWorld(save.loc);
  enterMenu();
}

function handleEvents() {
  const g = game;
  for (const e of g.events) {
    switch (e.type) {
      case 'pursuit':
        alertMsg('Dispatch', 'Pursuit initiated', '#ff2a3d');
        Sound.play('radio'); Sound.musicIntensity(0.85);
        break;
      case 'heat':
        alertMsg('Heat level ' + e.heat, e.heat >= 5 ? 'Maximum heat' : e.heat >= 3 ? 'Escalating' : 'Heat rising', HEAT_COLORS[e.heat]);
        Sound.play('heat');
        break;
      case 'roadblock': alertMsg('Dispatch', 'Roadblock ahead', '#ff2a3d'); Sound.play('radio'); break;
      case 'spiked': alertMsg('Tires shredded', 'Spike strip!', '#ff2a3d'); Sound.play('spikes'); hitFlash = 1; cam.shake = 1; break;
      case 'takedown':
        feed('Cop takedown', '+' + fmt(e.gain), '#ff5a1f'); bumpBounty();
        alertMsg('+' + fmt(e.gain), 'Takedown', '#ff5a1f');
        Sound.play('takedown'); cam.shake = Math.max(cam.shake, 0.6);
        { const c = g.cops.find(x => x.id === e.id); if (c) burstAt(c, 22, '#3a3a3a'); }
        break;
      case 'near': feed(e.oncoming ? 'Oncoming near miss' : 'Near miss', '+' + fmt(e.gain), '#59b2ff'); Sound.play('near'); if (g.mode === 'pursuit') bumpBounty(); break;
      case 'dodge': feed('Roadblock evaded', '+1,500', '#3ee08f'); bumpBounty(); break;
      case 'crash':
        Sound.play('crash', e.power);
        cam.shake = Math.max(cam.shake, Math.min(1, e.power / 20));
        if (e.power > 10) hitFlash = Math.min(1, e.power / 25);
        sparkAt(g.player, Math.min(20, e.power | 0));
        break;
      case 'wall': Sound.play('wall'); cam.shake = Math.max(cam.shake, 0.3); sparkAt(g.player, 10); break;
      case 'uturn': break;
      case 'busted': case 'escaped': case 'win': case 'lose':
        overT = 0;
        break;
    }
  }
  g.events.length = 0;
}

function sparkAt(e, n) {
  track.world(e.s, e.x, tmp);
  for (let i = 0; i < n; i++) {
    V.set(tmp.x + (Math.random() - 0.5) * 2, tmp.y + 0.5, tmp.z + (Math.random() - 0.5) * 2);
    V2.set((Math.random() - 0.5) * 12, 2 + Math.random() * 5, (Math.random() - 0.5) * 12);
    sparks.spawn(V, V2, 0.35 + Math.random() * 0.3, 0.25, 0.05, Math.random() < 0.5 ? '#ffb347' : '#ffdd88', 1);
  }
}
function burstAt(e, n, color) {
  track.world(e.s, e.x, tmp);
  for (let i = 0; i < n; i++) {
    V.set(tmp.x + (Math.random() - 0.5) * 2, tmp.y + 0.8, tmp.z + (Math.random() - 0.5) * 2);
    V2.set((Math.random() - 0.5) * 6, 2 + Math.random() * 3, (Math.random() - 0.5) * 6);
    smoke.spawn(V, V2, 1.5 + Math.random(), 1.2, 5, color, 0.55);
  }
  sparkAt(e, 18);
}

function finish() {
  const g = game, kind = session.kind;
  const box = $('#result .sheet');
  const res = g.over;
  let title, kick, sub, prize = '', win = res === 'escaped' || res === 'win';
  const t = g.t;
  const time = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  let stats;
  if (kind === 'pursuit') {
    kick = 'Pursuit over';
    title = res === 'escaped' ? 'Escaped' : 'Busted';
    if (res === 'escaped') {
      save.cash += g.bounty; save.career += g.bounty;
      sub = 'You slipped the net. Every dollar of bounty is yours.';
      prize = `<div class="r-prize"><span>Bounty banked</span><b>+${money(g.bounty)}</b></div>`;
    } else {
      sub = 'They boxed you in. The bounty goes back to the city.';
      prize = `<div class="r-prize lost"><span>Bounty lost</span><b>${money(g.bounty)}</b></div>`;
    }
    stats = [['Time', time], ['Top speed', kmh(g.stats.top) + ' km/h'], ['Heat', g.heat + ' / 5'], ['Takedowns', g.stats.takedowns], ['Near misses', g.stats.near], ['Roadblocks', g.stats.blocks]];
  } else {
    const r = session.rival;
    kick = `Wanted List · #${r.rank} ${r.name}`;
    title = res === 'win' ? 'Victory' : 'Defeated';
    if (res === 'win') {
      const first = !save.beaten.includes(r.rank);
      if (first) {
        save.beaten.push(r.rank);
        save.cash += r.prize;
        const gotCar = !save.owned.includes(r.car);
        if (gotCar) { save.owned.push(r.car); save.paint[r.car] = (PAINTS.find(p => p.hex === r.paint) || PAINTS[0]).id; }
        sub = gotCar ? `${r.name} hands over the keys.` : `${r.name} is off the list.`;
        prize = `<div class="r-prize slip"><span>${gotCar ? 'Pink slip · ' + carById(r.car).name : 'Prize money'}</span><b>+${money(r.prize)}</b></div>`;
      } else sub = 'Same result, second time.';
      if (r.rank === 1 && first) sub = 'Number one. The whole coast knows your name.';
    } else {
      sub = `${r.name} crossed the line first. Run it back.`;
      prize = '';
    }
    stats = [['Time', time], ['Top speed', kmh(g.stats.top) + ' km/h'], ['Near misses', g.stats.near], ['Crashes', g.stats.crashes], ['Gap', Math.abs((g.player.dist - g.rival.dist) / Math.max(20, Math.abs(g.player.v))).toFixed(1) + 's'], ['Car', carById(save.car).name]];
  }
  persist();
  box.className = 'sheet result ' + (win ? 'win' : 'lose');
  $('#rKick').textContent = kick;
  $('#rTitle').textContent = title;
  $('#rSub').textContent = sub;
  $('#rPrize').outerHTML = (prize || '<div id="rPrize"></div>').replace('class="r-prize', 'id="rPrize" class="r-prize');
  $('#rStats').innerHTML = stats.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  $('#rAgain span').textContent = kind === 'race' && res === 'win' ? 'Back to the list' : 'Run it back';
  $('#result').classList.add('show');
  Sound.engineStop();
  Sound.sirenStop();
  Sound.play(win ? 'win' : res === 'busted' ? 'busted' : 'lose');
  Sound.musicIntensity(0.2);
  mode = 'result';
}

// ---------- per-frame scene sync ----------
let prevNitro = false;
function syncScene(dt, input) {
  const g = game, p = g.player;
  const smp = track.sample(p.s);
  // player
  const heading = smp.a - p.psi;
  placeEntity(player, p.s, p.x, heading + p.drift);
  player.root.rotation.x = -Math.atan(smp.g);
  const lat = clamp(p.steer * Math.abs(p.v) / 60, -1, 1);
  player.tilt.rotation.z += (lat * 0.05 - player.tilt.rotation.z) * Math.min(1, dt * 6);
  const pitch = (input.brake && p.v > 2 ? 0.025 : input.throttle ? -0.012 : 0) * (mode === 'race' ? 1 : 0);
  player.tilt.rotation.x += (pitch - player.tilt.rotation.x) * Math.min(1, dt * 5);
  player.animate(dt, p.v, p.steer, input.brake > 0 && p.v > 1, T, p.nitroOn);
  if (p.nitroOn && !prevNitro) Sound.play('nitro');
  prevNitro = p.nitroOn;

  // drift / scrape smoke
  if ((Math.abs(p.drift) > 0.3 && Math.abs(p.v) > 15) || p.spiked && Math.abs(p.v) > 8) {
    for (const sx of [-0.8, 0.8]) {
      V.set(sx, 0.3, -1.4).applyEuler(player.root.rotation).add(player.root.position);
      V2.set((Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 2);
      if (Math.random() < 0.7) smoke.spawn(V, V2, 1.2, 0.8, 4, p.spiked ? '#5a5a5a' : '#d8d8d8', 0.35);
    }
  }
  if (p.scrape > 0.2 && Math.random() < p.scrape) {
    const side = Math.sign(p.x);
    V.set(side * 1, 0.5, 0).applyEuler(player.root.rotation).add(player.root.position);
    V2.set((Math.random() - 0.5) * 6, 2 + Math.random() * 3, (Math.random() - 0.5) * 6);
    sparks.spawn(V, V2, 0.3, 0.22, 0.05, '#ffc46b', 1);
  }

  const live = new Set();
  const sync = (e, extra) => {
    const m = entityMesh(e);
    live.add(e.id);
    const es = track.sample(e.s);
    const hd = e.kind === 'block' ? es.a + e.yaw : headingAI(e, es) + (e.wrecked ? e.yaw : 0);
    placeEntity(m, e.s, e.x, hd, e.v < -0.5);
    m.animate(dt, Math.abs(e.v), 0, e.kind === 'traffic' && Math.abs(e.v) < Math.abs(e.cruise) - 2, T + e.id * 0.13, !!e.nitroOn);
    if (extra) extra(m);
  };
  for (const c of g.traffic) {
    if (Math.abs(track.delta(p.s, c.s)) > 900) continue;
    sync(c);
  }
  for (const c of g.cops) {
    sync(c, m => {
      if (c.wrecked) {
        m.tilt.rotation.z += ((c.flip ? Math.PI : 0.25) - m.tilt.rotation.z) * Math.min(1, dt * 3);
        m.tilt.position.y = c.flip ? 1.4 : 0;
        if (Math.random() < 0.3) {
          V.copy(m.root.position); V.y += 1.2;
          V2.set((Math.random() - 0.5), 2 + Math.random() * 2, (Math.random() - 0.5));
          smoke.spawn(V, V2, 2.2, 1, 5, '#2b2b2b', 0.5);
        }
      } else { m.tilt.rotation.z = 0; m.tilt.position.y = 0; }
    });
  }
  for (const b of g.blocks) sync(b);
  if (g.rival) sync(g.rival);
  for (const [id, m] of meshes) if (!live.has(id)) { poolPut(m); meshes.delete(id); }

  // camera
  const C = CAMS[save.cam];
  const spd = Math.abs(p.v);
  const camYawTarget = heading + (p.v < -1 ? Math.PI : 0);
  if (!cam.init) { cam.yaw = camYawTarget; cam.init = true; cam.placed = false; }
  let dy = camYawTarget - cam.yaw;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  cam.yaw += dy * Math.min(1, dt * (C.dist < 0 ? 12 : 4.5));
  const pos = player.root.position;
  const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
  let dist = C.dist, h = C.h;
  if (mode === 'count') {
    const k = clamp(countT / 3.2, 0, 1);
    const e = 1 - Math.pow(1 - k, 3);
    const ang = Math.PI * (1 - e) * 0.9;
    const d = 9 - e * (9 - C.dist);
    camera.position.set(pos.x - Math.sin(cam.yaw + ang) * d, pos.y + h + 0.8 * (1 - e), pos.z - Math.cos(cam.yaw + ang) * d);
  } else {
    dist += spd * 0.012 + (p.nitroOn ? 0.6 : 0);
    const target = V.set(pos.x - fx * dist, pos.y + h, pos.z - fz * dist);
    if (C.dist < 0 || !cam.placed) { camera.position.copy(target); cam.placed = true; }
    else camera.position.lerp(target, Math.min(1, dt * 9));
    const minY = pos.y + 0.6;
    if (camera.position.y < minY) camera.position.y = minY;
  }
  cam.look.set(pos.x + fx * C.ahead, pos.y + C.look, pos.z + fz * C.ahead);
  if (cam.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * cam.shake * 0.5;
    camera.position.y += (Math.random() - 0.5) * cam.shake * 0.35;
    cam.shake = Math.max(0, cam.shake - dt * 2.2);
  }
  if (spd > 50) camera.position.y += (Math.random() - 0.5) * (spd - 50) * 0.0015;
  camera.lookAt(cam.look);
  const fov = 60 + clamp(spd / 80, 0, 1) * 12 + (p.nitroOn ? 8 : 0);
  cam.fov += (fov - cam.fov) * Math.min(1, dt * 3);
  camera.fov = cam.fov;
  camera.updateProjectionMatrix();
  world.update(pos, T, camera);

  // screen effects + sound
  let nearest = Infinity;
  for (const c of g.cops) if (!c.wrecked && c.mode !== 'patrol') nearest = Math.min(nearest, Math.abs(track.delta(p.s, c.s)));
  const copFx = g.pursuit ? clamp(1 - nearest / 45, 0, 1) * 0.55 : 0;
  const fxc = $('#fx-cops');
  fxc.style.opacity = copFx.toFixed(2);
  fxc.classList.toggle('flip', Math.floor(T * 3.5) % 2 === 0);
  $('#fx-speed').style.opacity = (p.nitroOn ? 0.16 : clamp((spd - 55) / 40, 0, 1) * 0.06).toFixed(2);
  hitFlash = Math.max(0, hitFlash - dt * 2);
  $('#fx-hit').style.opacity = hitFlash.toFixed(2);
  if (mode === 'race' || mode === 'count') {
    const slip = clamp(Math.abs(p.drift) * 2 + p.scrape * 0.6 + (input.brake && spd > 20 ? 0.4 : 0) + (p.spiked ? 0.3 : 0), 0, 1);
    Sound.engine(p.rpm, input.throttle, spd, slip, p.nitroOn);
    if (g.pursuit && nearest < Infinity) Sound.siren(clamp(1 - nearest / 320, 0.12, 1), T);
    else Sound.siren(0, T);
  }
}

// ---------- loop ----------
let T = 0, lastNow = performance.now(), acc = 0, fpsAcc = 0, fpsN = 0, fpsT = 0;
const STEP = 1 / 60;
const idle = { steer: 0, throttle: 0, brake: 0, nitro: false, handbrake: false };
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  T += dt;
  if (mode === 'menu' && track) showroom(dt);
  else if (game && track) {
    let input = idle;
    if (mode === 'race') {
      input = readInput();
      const scale = game.over ? 0.35 : 1;
      acc += dt * scale;
      let n = 0;
      while (acc >= STEP && n < 5) { update(game, input, STEP); acc -= STEP; n++; }
      handleEvents();
      resetT = Math.max(0, resetT - dt);
      hintT += dt;
      if (hintT > 7) $('#hint').classList.add('fade');
      if (game.over) {
        if (overT === 0) {
          const o = game.over;
          alertMsg(o === 'busted' ? 'Dispatch' : o === 'escaped' ? 'Clean getaway' : 'Finish', o === 'busted' ? 'Busted' : o === 'escaped' ? 'Escaped' : o === 'win' ? 'You win' : 'Too slow', o === 'busted' || o === 'lose' ? '#ff2a3d' : '#3ee08f');
        }
        overT += dt;
        if (overT > 1.6) finish();
      }
      // auto-drop graphics if we can't hold frame rate
      fpsAcc += dt; fpsN++; fpsT += dt;
      if (fpsT > 4) {
        if (save.quality === 'high' && fpsN / fpsAcc < 32) {
          save.quality = 'low'; persist(); applyQuality();
          feed('Graphics set to performance', '', '#9aa1ad');
        }
        fpsAcc = 0; fpsN = 0; fpsT = 0;
      }
    } else if (mode === 'count') {
      input = readInput();
      game.player.rpm = clamp(game.player.rpm + (input.throttle ? dt * 3 : -dt * 2), 0.12, 0.95);
      const prev = Math.ceil(3 - countT);
      countT += dt;
      const cur = Math.ceil(3 - countT);
      if (cur !== prev || countT === dt) {
        const el = $('#countNum');
        $('#count').classList.add('show');
        el.textContent = cur > 0 ? cur : 'GO';
        el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
        Sound.play(cur > 0 ? 'count' : 'go');
      }
      if (countT >= 3) {
        mode = 'race';
        setTimeout(() => $('#count').classList.remove('show'), 700);
      }
    }
    if (mode !== 'result' || game) {
      syncScene(dt, mode === 'race' || mode === 'count' ? input : idle);
      if (mode === 'race' || mode === 'count' || mode === 'paused') { updateHUD(); drawMap(); }
    }
  }
  smoke.update(dt);
  sparks.update(dt);
  if (track) {
    if (bloom.enabled) composer.render(); else renderer.render(scene, camera);
  }
}

// ---------- top-bar buttons ----------
function toggleMusic() {
  const on = Sound.toggleMusic();
  $('#bMusic').classList.toggle('off', !on);
  if (on) Sound.musicStart(mode === 'menu' ? 0.2 : 0.5);
}
$('#bMusic').addEventListener('click', toggleMusic);
$('#bSfx').addEventListener('click', () => $('#bSfx').classList.toggle('off', !Sound.toggleSfx()));
$('#bMusic').classList.toggle('off', !Sound.music);
$('#bSfx').classList.toggle('off', !Sound.sfx);
$('#bFull').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
});
$('#bQuality').addEventListener('click', () => {
  save.quality = save.quality === 'high' ? 'low' : 'high';
  persist(); applyQuality();
});
$('#startPursuit').addEventListener('click', () => startSession('pursuit'));
$('#pCam').textContent = 'Camera: ' + CAMS[save.cam].name;
// first interaction unlocks audio + menu music
addEventListener('pointerdown', () => { Sound.unlock(); if (Sound.music) Sound.musicStart(mode === 'menu' ? 0.2 : 0.4); }, { once: true });
addEventListener('keydown', () => { Sound.unlock(); if (Sound.music) Sound.musicStart(0.2); }, { once: true });

(async function boot() {
  applyQuality();
  requestAnimationFrame(frame);
  try {
    await ensureWorld(save.loc);
  } catch (e) {
    console.error(e);
    setLoad(1, 'Could not start WebGL — try another browser.');
    return;
  }
  enterMenu();
})();

// debug hook for headless screenshots: run the sim forward with a simple lane-keeping driver
function fastForward(sec, nitro = true) {
  mode = 'race';
  $('#count').classList.remove('show');
  for (let i = 0; i < sec * 60 && !game.over; i++) {
    const p = game.player;
    let tx = p.x > 4 ? 6 : 2;
    for (const c of game.traffic) { const d = track.delta(p.s, c.s); if (d > 0 && d < 50 && Math.abs(c.x - tx) < 2.5) tx = tx === 2 ? 6 : 2; }
    const steer = clamp((clamp((tx - p.x) * 0.08, -0.3, 0.3) - p.psi) * 4, -1, 1);
    update(game, { throttle: 1, brake: 0, steer, nitro: nitro && p.nitro > 0.4, handbrake: false }, STEP);
  }
  game.events.length = 0;
  cam.init = false;
}
window.__apex = { get game() { return game; }, startSession, fastForward, RIVALS, get mode() { return mode; }, save };
