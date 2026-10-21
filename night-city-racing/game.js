import * as THREE from './vendor/three.module.js';

const $ = id => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const cars = [
  { name: 'VELOCITY GT', class: 'STREET SERIES / 01', max: 76, accel: 21, handling: 1, price: 0 },
  { name: 'PHANTOM R', class: 'SPORT SERIES / 02', max: 86, accel: 24, handling: 1.12, price: 1800 },
  { name: 'APEX RS', class: 'HYPER SERIES / 03', max: 98, accel: 28, handling: 1.23, price: 4200 }
];
const paints = [{ name: 'Arctic mint', value: '#bcebe0' }, { name: 'Acid green', value: '#caff78' }, { name: 'Solar orange', value: '#fa794b' }, { name: 'Electric violet', value: '#ac91ff' }, { name: 'Glacier blue', value: '#72c9fa' }];
let saved;
try { saved = JSON.parse(localStorage.getItem('nightshift-v1') || '{}'); } catch { saved = {}; }
const save = { credits: Math.max(0, Number(saved.credits) || 0), owned: Array.isArray(saved.owned) ? saved.owned.filter(x => [0, 1, 2].includes(x)) : [0], car: 0, paint: clamp(Number(saved.paint) || 0, 0, 4), records: saved.records || {} };
if (!save.owned.includes(0)) save.owned.push(0);
save.car = save.owned.includes(saved.car) ? saved.car : 0;
function persist() { try { localStorage.setItem('nightshift-v1', JSON.stringify(save)); } catch {} $('credits').textContent = save.credits.toLocaleString(); }
persist();
let mode = 'race', trackId = 0, running = false, paused = false, finished = false, race, cameraMode = 0, soundOn = false;
const keys = new Set();
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: true, powerPreference: 'high-performance' }); }
catch { $('loading').textContent = 'WebGL is unavailable. Please enable hardware acceleration and reload.'; throw new Error('WebGL unavailable'); }
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setClearColor(0x0b1020);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1500);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c1122);
scene.fog = new THREE.FogExp2(0x10172b, 0.0026);
scene.add(new THREE.HemisphereLight(0xadc9ff, 0x293d49, 2.4));
const moon = new THREE.DirectionalLight(0xc4d6ff, 2.7); moon.position.set(80, 140, 90); scene.add(moon);
const pinkLight = new THREE.DirectionalLight(0x9560ff, 1.4); pinkLight.position.set(-80, 35, -90); scene.add(pinkLight);
const world = new THREE.Group(); scene.add(world);
const showroom = new THREE.Group(); scene.add(showroom);
function mat(color, metalness = 0, roughness = .6, glow) { return new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive: glow || 0, emissiveIntensity: glow ? 2 : 0 }); }
const asphalt = mat(0x171f2d, .25, .7), curbMat = mat(0x343e50), railMat = mat(0x779aa6, .5, .4);
const darkMat = mat(0x101621, .45, .35), glassMat = mat(0x132936, .65, .16), wheelMat = mat(0x0a0d13, .05, .8), rimMat = mat(0x78858e, .9, .3);
const whiteLight = mat(0xffffff, .2, .25, 0xcdf5ff), redLight = mat(0xff303f, .2, .3, 0xff162d);
function box(group, x, y, z, w, h, d, material) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); mesh.position.set(x, y, z); group.add(mesh); return mesh; }
function taperedBox(group, bottomW, topW, bottomD, topD, height, y, z, material) {
  const g = new THREE.BoxGeometry(1, 1, 1); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const top = p.getY(i) > 0; p.setXYZ(i, p.getX(i) * (top ? topW : bottomW), p.getY(i) * height, p.getZ(i) * (top ? topD : bottomD)); }
  g.computeVertexNormals(); const m = new THREE.Mesh(g, material); m.position.set(0, y, z); group.add(m); return m;
}
function makeCar(color, type = 0) {
  const group = new THREE.Group(); group.userData.dynamic = true; const bodyMat = mat(color, .65, .29);
  taperedBox(group, 2.17, 2.04, 4.85, 4.37, .63, .78, 0, bodyMat);
  taperedBox(group, 2.03, 1.5, 2.35, 1.5, .64, 1.35, -.26, glassMat);
  box(group, 0, 1.69, -.36, 1.5, .07, 1.48, bodyMat);
  box(group, 0, 1.12, 1.5, 1.95, .13, 1.45, bodyMat);
  box(group, 0, .5, 2.32, 2.18, .15, .24, darkMat);
  box(group, 0, .57, -2.39, 2.16, .22, .18, darkMat);
  box(group, 0, .78, 2.42, .92, .19, .025, darkMat);
  for (const side of [-1, 1]) {
    box(group, side * .76, .94, 2.35, .56, .12, .11, whiteLight);
    box(group, side * .7, 1, -2.35, .65, .11, .1, redLight);
    box(group, side * 1.13, 1.25, .45, .27, .14, .3, bodyMat);
    box(group, side * 1.08, .45, 0, .12, .14, 3.7, darkMat);
    for (const z of [-1.52, 1.45]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, .32, 16), wheelMat); wheel.rotation.z = Math.PI / 2; wheel.position.set(side * 1.04, .48, z); group.add(wheel);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .33, 10), rimMat); rim.rotation.z = Math.PI / 2; rim.position.copy(wheel.position); group.add(rim);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .35, 8), darkMat); hub.rotation.z = Math.PI / 2; hub.position.copy(wheel.position); group.add(hub);
    }
    if (type > 0) box(group, side * .75, 1.35, -1.98, .1, .7, .13, darkMat);
  }
  if (type > 0) box(group, 0, 1.69, -2.03, 2.4, .1, .5, darkMat);
  if (type === 2) { box(group, 0, 1.21, 1.45, .25, .02, 1.2, darkMat); box(group, 0, 1.74, -.36, .25, .02, 1.4, darkMat); }
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 5.8), new THREE.MeshBasicMaterial({ color: 0x75ffe1, transparent: true, opacity: .1, depthWrite: false })); glow.rotation.x = -Math.PI / 2; glow.position.y = .04; group.add(glow);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.3), new THREE.MeshBasicMaterial({ color: 0x020409, transparent: true, opacity: .5, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .06; group.add(shadow);
  const flames = new THREE.Group();
  for (const x of [-.68, .68]) { const flame = new THREE.Mesh(new THREE.ConeGeometry(.22, 1.65, 8), new THREE.MeshBasicMaterial({ color: 0x72eaff })); flame.rotation.x = -Math.PI / 2; flame.position.set(x, .53, -3.05); flames.add(flame); }
  flames.visible = false; group.add(flames); group.userData.flames = flames; group.userData.body = bodyMat;
  return group;
}
const floor = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), mat(0x101c28, .15, .9)); floor.rotation.x = -Math.PI / 2; floor.position.y = -.13; scene.add(floor);
const grid = new THREE.GridHelper(180, 36, 0x344756, 0x203440); grid.position.y = -.05; showroom.add(grid);
const platform = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.4, .16, 64), mat(0x24313a, .7, .3)); platform.position.y = -.02; showroom.add(platform);
const ring = new THREE.Mesh(new THREE.TorusGeometry(6.25, .022, 6, 100), new THREE.MeshBasicMaterial({ color: 0xb8e8db })); ring.rotation.x = Math.PI / 2; ring.position.y = .075; showroom.add(ring);
let displayCar = makeCar(paints[save.paint].value, save.car); showroom.add(displayCar);
let player = makeCar(paints[save.paint].value, save.car); scene.add(player); player.visible = false;
const city = new THREE.Group(); scene.add(city);
let seed = 73;
function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
const buildingMats = [0x172236, 0x1d293c, 0x212d43, 0x121e2e].map(c => mat(c, .35, .65));
const winGeometry = new THREE.BoxGeometry(1.25, 1.8, .04);
const windowMaterial = new THREE.MeshBasicMaterial({ color: 0x90c9df, transparent: true, opacity: .65 });
const windowMatrices = [];
const dummy = new THREE.Object3D();
for (let i = 0; i < 125; i++) {
  const angle = rand() * Math.PI * 2, radius = 340 + rand() * 240;
  const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
  const w = 13 + rand() * 25, d = 13 + rand() * 24, h = 20 + rand() * 105;
  box(city, x, h / 2, z, w, h, d, buildingMats[i % 4]);
  if (i % 4 === 0) { const neon = mat(0x675b9a, 0, .5, i % 8 === 0 ? 0x4b598f : 0x75426f); box(city, x, h, z, w + .3, .45, d + .3, neon); }
  for (let y = 6; y < h - 3; y += 5) for (let a = -w / 2 + 3; a < w / 2 - 2; a += 4) if (rand() > .3) {
    for (const side of [-1, 1]) { dummy.position.set(x + a, y, z + side * (d / 2 + .04)); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); windowMatrices.push(dummy.matrix.clone()); }
  }
}
const windows = new THREE.InstancedMesh(winGeometry, windowMaterial, windowMatrices.length); windowMatrices.forEach((m, i) => windows.setMatrixAt(i, m)); city.add(windows);
const garageWindowMat = mat(0x668a9b, 0, 1, 0x2c4452);
const garageNeonMat = mat(0xaa64ce, 0, 1, 0x673b8c);
// A closer skyline gives the garage its own architectural backdrop.
for (let i = 0; i < 26; i++) {
  const x = -100 + i * 8, z = -45 - rand() * 35, h = 8 + rand() * 35, w = 4 + rand() * 4;
  box(showroom, x, h / 2, z, w, h, 7, buildingMats[i % 4]);
  for (let y = 3; y < h; y += 3) for (let dx = -w / 2 + 1; dx < w / 2; dx += 2) if (rand() > .3) box(showroom, x + dx, y, z + 3.52, .6, 1.2, .02, garageWindowMat);
  if (i % 4 === 0) box(showroom, x + w / 2, h / 2, z + 3.55, .12, h, .08, garageNeonMat);
}
// Batch static box architecture into GPU instances to keep mobile draw calls low.
function batchBoxes(root) {
  root.updateMatrixWorld(true);
  const batches = new Map(), inverse = root.matrixWorld.clone().invert();
  function visit(node) {
    if (node.userData.dynamic) return;
    if (node.isMesh && node.geometry.type === 'BoxGeometry') {
      if (!batches.has(node.material)) batches.set(node.material, []);
      batches.get(node.material).push(node);
    }
    node.children.forEach(visit);
  }
  visit(root);
  for (const [material, meshes] of batches) {
    const instance = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, meshes.length);
    meshes.forEach((mesh, i) => {
      const p = mesh.geometry.parameters;
      const matrix = inverse.clone().multiply(mesh.matrixWorld).scale(new THREE.Vector3(p.width, p.height, p.depth));
      instance.setMatrixAt(i, matrix); mesh.removeFromParent(); mesh.geometry.dispose();
    });
    root.add(instance);
  }
}
batchBoxes(city); batchBoxes(showroom);
const tracks = [
  { name: 'Downtown Circuit', length: 2400, points: [[0, 220], [165, 190], [240, 70], [190, -100], [40, -220], [-140, -190], [-220, -60], [-120, 15], [-155, 145]] },
  { name: 'Neon Harbor', length: 3100, points: [[0, 235], [210, 175], [285, 10], [205, -180], [0, -245], [-225, -165], [-285, 35], [-185, 195]] }
];
let curve, trackLength, samples = [], opponents = [];
function ribbon(offset, width, material, y = 0) {
  const positions = [], indices = [], n = 650;
  for (let i = 0; i <= n; i++) { const t = i / n, p = curve.getPointAt(t), v = curve.getTangentAt(t), side = new THREE.Vector3(v.z, 0, -v.x); for (const off of [offset - width / 2, offset + width / 2]) { const q = p.clone().addScaledVector(side, off); positions.push(q.x, y, q.z); } if (i < n) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals(); const mesh = new THREE.Mesh(g, material); world.add(mesh);
}
function disposeGroup(group) { const geos = new Set(); group.traverse(o => { if (o.geometry) geos.add(o.geometry); }); geos.forEach(g => g.dispose()); group.clear(); }
function buildTrack() {
  disposeGroup(world);
  curve = new THREE.CatmullRomCurve3(tracks[trackId].points.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'catmullrom', .5);
  trackLength = curve.getLength(); samples = Array.from({ length: 160 }, (_, i) => curve.getPointAt(i / 159));
  ribbon(0, 23, curbMat, -.04); ribbon(0, 20, asphalt, 0);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xa1b5bd });
  ribbon(-9.3, .13, lineMat, .02); ribbon(9.3, .13, lineMat, .02);
  ribbon(-11.4, .18, railMat, .75); ribbon(11.4, .18, railMat, .75);
  const poleMat = mat(0x344253, .5, .5), glowMat = new THREE.MeshBasicMaterial({ color: 0xa4eddf });
  for (let i = 0; i < 160; i++) {
    const t = i / 160, p = curve.getPointAt(t), tangent = curve.getTangentAt(t), angle = Math.atan2(tangent.x, tangent.z), side = new THREE.Vector3(tangent.z, 0, -tangent.x);
    for (const x of [-3.3, 3.3]) { const marker = box(world, p.x + side.x * x, .025, p.z + side.z * x, .12, .025, 3, lineMat); marker.rotation.y = angle; }
    if (i % 4 === 0) for (const s of [-1, 1]) {
      const post = new THREE.Group(); post.position.copy(p).addScaledVector(side, s * 12); post.rotation.y = angle; world.add(post);
      box(post, 0, 4.5, 0, .17, 9, .17, poleMat); box(post, -s * 1.8, 8.9, 0, 3.7, .15, .18, poleMat); box(post, -s * 2.7, 8.8, 0, 1.7, .09, .45, glowMat);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), new THREE.MeshBasicMaterial({ color: 0x99dcca, transparent: true, opacity: .035, depthWrite: false })); pool.rotation.x = -Math.PI / 2; pool.position.set(p.x, .035, p.z); world.add(pool);
    }
  }
  const start = curve.getPointAt(0), tangent = curve.getTangentAt(0), angle = Math.atan2(tangent.x, tangent.z);
  const gate = new THREE.Group(); gate.position.copy(start); gate.rotation.y = angle; world.add(gate);
  for (const x of [-11, 11]) box(gate, x, 5, 0, .45, 10, .45, poleMat);
  box(gate, 0, 9.7, 0, 23, 1.5, .5, darkMat); box(gate, 0, 8.95, 0, 22, .09, .55, glowMat);
  const signCanvas = document.createElement('canvas'); signCanvas.width = 1024; signCanvas.height = 128; const cx = signCanvas.getContext('2d'); cx.fillStyle = '#121b26'; cx.fillRect(0, 0, 1024, 128); cx.fillStyle = '#d0ff88'; cx.font = 'bold 57px Arial'; cx.textAlign = 'center'; cx.fillText('N I G H T S H I F T', 512, 86);
  const texture = new THREE.CanvasTexture(signCanvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(17, 1.35), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })); sign.position.set(0, 9.7, -.27); gate.add(sign);
  for (let x = -10; x < 10; x += 1) for (let z = 0; z < 2; z++) box(gate, x + .5, .035, z - 1, 1, .02, 1, (x + z) % 2 === 0 ? lineMat : darkMat);
  batchBoxes(world); world.visible = false;
}
buildTrack();
function placeCar(car, distance, lateral) {
  const t = ((distance / trackLength) % 1 + 1) % 1, p = curve.getPointAt(t), tangent = curve.getTangentAt(t);
  car.position.set(p.x + tangent.z * lateral, .05, p.z - tangent.x * lateral); car.rotation.y = Math.atan2(tangent.x, tangent.z);
  return tangent;
}
let audioCtx, oscillator, gain;
function initAudio() { if (audioCtx) { audioCtx.resume().catch(() => {}); return; } try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); oscillator = audioCtx.createOscillator(); gain = audioCtx.createGain(); oscillator.type = 'sawtooth'; const filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 300; oscillator.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination); gain.gain.value = 0; oscillator.start(); } catch {} }
function updateAudio() { if (!gain) return; const on = running && !paused && !finished && soundOn; gain.gain.setTargetAtTime(on ? .035 : 0, audioCtx.currentTime, .1); oscillator.frequency.setTargetAtTime(35 + (race?.speed || 0) * 1.3, audioCtx.currentTime, .08); }
function setTab(tab) { document.querySelectorAll('.nav').forEach(b => b.classList.toggle('active', b.dataset.tab === tab)); $('garage-panel').hidden = tab !== 'garage'; $('records-panel').hidden = tab !== 'records'; if (tab === 'garage') renderGarage(); if (tab === 'records') renderRecords(); }
function renderGarage() {
  $('cars').innerHTML = cars.map((c, i) => `<button class="car-option ${save.car === i ? 'selected' : ''}" data-car="${i}"><b>${c.name}</b><small>${Math.round(c.max * 3.6)} km/h · ${i === 0 ? 'Balanced' : i === 1 ? 'Agile' : 'Extreme'}<br>${save.owned.includes(i) ? (save.car === i ? 'SELECTED ✓' : 'SELECT CAR ↗') : `UNLOCK ◈ ${c.price.toLocaleString()}`}</small></button>`).join('');
  $('paints').innerHTML = paints.map((p, i) => `<button class="paint ${save.paint === i ? 'selected' : ''}" style="background:${p.value}" data-paint="${i}" aria-label="${p.name}" title="${p.name}"></button>`).join(''); $('paint-name').textContent = paints[save.paint].name;
}
function updateCar() { displayCar.userData.body.color.set(paints[save.paint].value); scene.remove(player); showroom.remove(displayCar); disposeGroup(player); disposeGroup(displayCar); displayCar = makeCar(paints[save.paint].value, save.car); showroom.add(displayCar); player = makeCar(paints[save.paint].value, save.car); player.visible = false; scene.add(player); $('car-name').textContent = cars[save.car].name; $('car-class').textContent = cars[save.car].class; persist(); renderGarage(); }
function formatTime(t) { return `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(1).padStart(4, '0')}`; }
function renderRecords() { $('records').innerHTML = tracks.map((t, i) => `<div><span>${t.name}<br><small>Street race / Time attack</small></span><b>${save.records[`${i}-race`] ? formatTime(save.records[`${i}-race`]) : '—'} / ${save.records[`${i}-time`] ? formatTime(save.records[`${i}-time`]) : '—'}</b></div>`).join(''); }
function updateSelection() {
  document.querySelectorAll('.mode').forEach(b => b.classList.toggle('active', b.dataset.mode === mode)); document.querySelectorAll('.track').forEach(b => b.classList.toggle('active', Number(b.dataset.track) === trackId));
  $('run-title').textContent = tracks[trackId].name; $('scene-track').textContent = trackId === 0 ? 'DOWNTOWN' : 'NEON HARBOR';
  $('run-sub').textContent = mode === 'race' ? '3 laps · 4 rivals · Midnight' : mode === 'time' ? '1 lap · Personal best · Midnight' : 'Unlimited laps · No rivals · Midnight';
  $('start').innerHTML = `${mode === 'race' ? 'LET’S RACE' : mode === 'time' ? 'BEAT THE CLOCK' : 'LET’S CRUISE'} <span>↗</span>`;
}
function startRace() {
  initAudio(); keys.clear(); running = true; paused = false; finished = false; cameraMode = 0;
  race = { distance: 0, lateral: 0, speed: 0, time: 0, nitro: 100, countdown: 3.4, laps: mode === 'time' ? 1 : 3, hits: 0, collisionCooldown: 0, boost: false };
  opponents.forEach(o => { scene.remove(o.mesh); disposeGroup(o.mesh); }); opponents = [];
  if (mode === 'race') [0xff784b, 0xab90ff, 0x78c6ff, 0xffd37b].forEach((c, i) => { const mesh = makeCar(c, i % 3); scene.add(mesh); opponents.push({ mesh, distance: 12 + i * 10, lateral: [-5, 4, -3, 5][i], speed: 0, target: cars[save.car].max * (.77 + i * .025), phase: i * 1.6 }); placeCar(mesh, 12 + i * 10, [-5, 4, -3, 5][i]); });
  showroom.visible = false; world.visible = true; player.visible = true; $('showroom').hidden = true; $('hud').hidden = false; $('dialog').hidden = true; $('stage').classList.add('racing'); document.body.classList.add('race-active');
  if (!document.fullscreenElement && $('stage').requestFullscreen) $('stage').requestFullscreen().catch(() => {});
  $('notice').style.fontSize = '75px'; $('speed').textContent = '000'; $('time').textContent = '00:00.0'; $('nitro-fill').style.width = '100%'; $('progress-fill').style.width = '0%';
  $('position').innerHTML = mode === 'race' ? '5<small>/ 5</small>' : mode === 'time' ? 'SOLO' : 'CRUISE'; $('lap').innerHTML = mode === 'free' ? '0.0<small>km</small>' : `1<small>/ ${race.laps}</small>`;
  $('position-label').textContent = mode === 'race' ? 'POSITION' : 'MODE'; $('lap-label').textContent = mode === 'free' ? 'DISTANCE' : 'LAP';
  document.querySelectorAll('[data-mode],[data-track],.nav').forEach(b => b.disabled = true);
  placeCar(player, 0, 0); drawMap(); updateCamera(1, true); resize();
}
function endRace() {
  finished = true; race.boost = false; player.userData.flames.visible = false;
  const position = 1 + opponents.filter(o => o.distance > race.distance).length;
  const reward = mode === 'race' ? [1500, 1000, 700, 450, 300][position - 1] : 450;
  const key = `${trackId}-${mode}`, best = !save.records[key] || race.time < save.records[key];
  if (best) save.records[key] = race.time; save.credits += reward; persist();
  $('dialog-tag').textContent = best ? 'A NEW PERSONAL BEST' : 'ANOTHER NIGHT. ANOTHER RUN.';
  $('dialog-title').textContent = mode === 'race' ? `${['1st', '2nd', '3rd', '4th', '5th'][position - 1]} across the line.` : 'Time well spent.';
  $('dialog-body').textContent = `${formatTime(race.time)} · +${reward.toLocaleString()} credits earned. ${position === 1 && mode === 'race' ? 'The city is yours tonight.' : 'Your next run is waiting.'}`;
  $('resume').hidden = true; $('restart').textContent = 'Race again ↗'; $('dialog').hidden = false; keys.clear();
}
function togglePause() { if (!running || finished) return; paused = !paused; keys.clear(); $('dialog').hidden = !paused; $('resume').hidden = false; $('dialog-tag').textContent = 'TAKE A BREATHER'; $('dialog-title').textContent = 'Race paused.'; $('dialog-body').textContent = 'The city can wait.'; $('restart').textContent = 'Restart run'; }
function exitRace() { running = false; paused = false; finished = false; keys.clear(); showroom.visible = true; world.visible = false; player.visible = false; opponents.forEach(o => o.mesh.visible = false); $('showroom').hidden = false; $('hud').hidden = true; $('dialog').hidden = true; $('stage').classList.remove('racing'); document.body.classList.remove('race-active'); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); document.querySelectorAll('[data-mode],[data-track],.nav').forEach(b => b.disabled = false); renderGarage(); renderRecords(); }
function updateRace(dt) {
  if (paused || finished) return;
  if (race.countdown > 0) { race.countdown -= dt; $('notice').textContent = race.countdown > .4 ? Math.ceil(race.countdown - .4) : 'GO'; return; }
  race.time += dt; race.collisionCooldown = Math.max(0, race.collisionCooldown - dt);
  const car = cars[save.car], gas = keys.has('KeyW') || keys.has('ArrowUp'), brake = keys.has('KeyS') || keys.has('ArrowDown');
  const steer = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  const drift = keys.has('Space') && steer !== 0 && race.speed > 25;
  race.boost = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && race.nitro > 1 && gas && race.speed > 10;
  race.nitro = clamp(race.nitro + (race.boost ? -27 : 9) * dt, 0, 100);
  race.speed += ((gas ? car.accel * (race.boost ? 1.65 : 1) : -8) - (brake ? 43 : 0) - (drift ? 9 : 0)) * dt;
  const max = car.max * (race.boost ? 1.35 : 1); if (race.speed > max) race.speed -= 25 * dt;
  race.speed = clamp(race.speed, 0, car.max * 1.36);
  const t = (race.distance / trackLength) % 1, tangent = curve.getTangentAt(t), next = curve.getTangentAt((t + .004) % 1);
  const bend = Math.atan2(tangent.z * next.x - tangent.x * next.z, tangent.dot(next));
  race.lateral += steer * (2 + race.speed * .085) * car.handling * (drift ? 1.55 : 1) * dt - bend * race.speed * .15 * dt;
  if (Math.abs(race.lateral) > 9.2) race.speed = Math.max(0, race.speed - 33 * dt);
  if (Math.abs(race.lateral) > 10.5) { race.lateral = clamp(race.lateral, -10.5, 10.5); race.speed *= Math.pow(.6, dt); }
  race.distance += race.speed * dt;
  placeCar(player, race.distance, race.lateral); player.rotation.y += steer * (drift ? .24 : .06) * Math.min(race.speed / 30, 1); player.rotation.z = -steer * Math.min(race.speed / 80, 1) * .025; player.userData.flames.visible = race.boost;
  for (const o of opponents) {
    o.speed = Math.min(o.target, o.speed + car.accel * .83 * dt); o.distance += o.speed * dt;
    const lane = o.lateral + Math.sin(race.time * .6 + o.phase) * .7;
    placeCar(o.mesh, o.distance, lane);
    let gap = ((o.distance - race.distance) % trackLength + trackLength) % trackLength; if (gap > trackLength / 2) gap -= trackLength;
    if (Math.abs(gap) < 4.7 && Math.abs(lane - race.lateral) < 2.05 && !race.collisionCooldown) { race.speed *= .67; race.lateral = clamp(race.lateral + (race.lateral > lane ? 1.4 : -1.4), -10.5, 10.5); race.collisionCooldown = 1.1; race.hits++; }
  }
  $('notice').textContent = race.collisionCooldown > .8 ? 'CONTACT' : drift ? 'DRIFT' : race.boost ? 'NITRO' : race.time < .7 ? 'GO' : '';
  $('notice').style.fontSize = race.time < .7 ? '75px' : '26px';
  const position = 1 + opponents.filter(o => o.distance > race.distance).length;
  $('position').innerHTML = mode === 'race' ? `${position}<small>/ 5</small>` : mode === 'time' ? 'SOLO' : 'CRUISE';
  $('lap').innerHTML = mode === 'free' ? `${(race.distance / trackLength * tracks[trackId].length / 1000).toFixed(1)}<small>km</small>` : `${Math.min(race.laps, Math.floor(race.distance / trackLength) + 1)}<small>/ ${race.laps}</small>`;
  $('time').textContent = mode === 'free' ? '—' : formatTime(race.time); $('speed').textContent = String(Math.round(race.speed * 3.6)).padStart(3, '0'); $('nitro-fill').style.width = `${race.nitro}%`;
  $('progress-fill').style.width = `${mode === 'free' ? (race.distance / trackLength % 1) * 100 : clamp(race.distance / (trackLength * race.laps), 0, 1) * 100}%`;
  drawMap();
  if (mode !== 'free' && race.distance >= trackLength * race.laps) endRace();
}
const desiredCamera = new THREE.Vector3(), look = new THREE.Vector3();
function updateCamera(dt, snap = false) {
  if (!running) {
    const width = $('stage').clientWidth;
    displayCar.rotation.y = -.43 + Math.sin(performance.now() * .00012) * .13;
    const narrow = width < 500;
    camera.fov = narrow ? 48 : 43; camera.position.set(10, 5.6, 12.3);
    camera.lookAt(narrow ? -1.6 : -2.9, narrow ? 1.8 : .8, 0);
    // Shift the car into the clear space to the right of the typography.
    displayCar.position.set(narrow ? .4 : 1.2, .1, 0); displayCar.scale.setScalar(narrow ? 1.1 : 1.15);
  } else {
    const tangent = curve.getTangentAt((race.distance / trackLength) % 1);
    desiredCamera.copy(player.position).addScaledVector(tangent, cameraMode === 1 ? -6 : -11.5); desiredCamera.y += cameraMode === 1 ? 2.8 : 5.3;
    camera.position.lerp(desiredCamera, snap ? 1 : 1 - Math.exp(-dt * 8));
    look.copy(player.position).addScaledVector(tangent, 13); look.y += 1;
    camera.lookAt(look); camera.fov = 55 + race.speed * .12 + (race.boost ? 4 : 0);
  }
  camera.updateProjectionMatrix();
}
function drawMap() {
  const ctx = $('minimap').getContext('2d'); ctx.clearRect(0, 0, 160, 140);
  const scale = trackId === 0 ? .23 : .2;
  const point = p => [80 + p.x * scale, 70 + p.z * scale];
  ctx.beginPath(); samples.forEach((p, i) => { const [x, y] = point(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.strokeStyle = '#536471'; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = '#17232c'; ctx.lineWidth = 3; ctx.stroke();
  opponents.forEach(o => { const [x, y] = point(o.mesh.position); ctx.fillStyle = '#ff936e'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); });
  const [x, y] = point(player.position); ctx.fillStyle = '#caff78'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
}
function resize() { const w = $('stage').clientWidth, h = $('stage').clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe($('stage')); resize();
$('start').addEventListener('click', startRace); $('pause').addEventListener('click', togglePause); $('resume').addEventListener('click', togglePause); $('restart').addEventListener('click', startRace); $('exit').addEventListener('click', exitRace);
$('sound').addEventListener('click', () => { soundOn = !soundOn; initAudio(); $('sound').textContent = soundOn ? '♫' : '♪'; $('sound').style.color = soundOn ? '#caff78' : ''; $('sound').setAttribute('aria-label', soundOn ? 'Mute sound' : 'Enable sound'); });
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($('stage').requestFullscreen) await $('stage').requestFullscreen();
  } catch { /* The viewport-sized racing layout remains available. */ }
}
$('fullscreen').addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
  const active = !!document.fullscreenElement;
  $('fullscreen').setAttribute('aria-label', active ? 'Exit fullscreen' : 'Fullscreen');
  $('fullscreen').title = active ? 'Exit fullscreen (F)' : 'Fullscreen (F)';
  resize();
});
$('help').addEventListener('click', () => { $('tips').hidden = !$('tips').hidden; });
document.querySelectorAll('.nav').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
document.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; updateSelection(); }));
document.querySelectorAll('.track').forEach(b => b.addEventListener('click', () => { if (trackId !== Number(b.dataset.track)) { trackId = Number(b.dataset.track); buildTrack(); } updateSelection(); }));
$('cars').addEventListener('click', e => { const b = e.target.closest('[data-car]'); if (!b || running) return; const id = Number(b.dataset.car); if (!save.owned.includes(id)) { if (save.credits < cars[id].price) { b.querySelector('small').textContent = `Earn ${(cars[id].price - save.credits).toLocaleString()} more credits by racing.`; return; } save.credits -= cars[id].price; save.owned.push(id); } save.car = id; updateCar(); });
$('paints').addEventListener('click', e => { const b = e.target.closest('[data-paint]'); if (b && !running) { save.paint = Number(b.dataset.paint); updateCar(); } });
const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight'];
window.addEventListener('keydown', e => { if (!running) return; if (gameKeys.includes(e.code)) { e.preventDefault(); keys.add(e.code); } if (e.repeat) return; if (e.code === 'KeyF') toggleFullscreen(); if (e.code === 'Escape' || e.code === 'KeyP') togglePause(); if (e.code === 'KeyC') cameraMode = (cameraMode + 1) % 2; if (e.code === 'KeyR' && !paused && !finished) { race.lateral = 0; race.speed = 0; } });
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); if (running && !paused && !finished) togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused && !finished) togglePause(); });
document.querySelectorAll('[data-key]').forEach(b => { b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); keys.add(b.dataset.key); }); for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(event, () => keys.delete(b.dataset.key)); });
let last = performance.now();
function frame(now) { const dt = Math.min((now - last) / 1000, .05); last = now; if (running) updateRace(dt); updateCamera(dt); updateAudio(); renderer.render(scene, camera); requestAnimationFrame(frame); }
updateSelection(); updateCar(); $('loading').hidden = true; requestAnimationFrame(frame);
// Small read-only diagnostics for automated browser checks.
window.nightshift = { get state() { return { running, paused, finished, mode, trackId, car: save.car, paint: save.paint, credits: save.credits, race: race ? { ...race } : null }; } };
