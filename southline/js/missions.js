// Story missions for Sonny Reyes, taxi and vigilante side jobs, pickups,
// hidden seashells, and the shop, spray and safehouse interactions.
import { PLACES, PITCH, NX, NZ, BEACH_X, SHORE, CITY_H, blockRect, nodePos, laneSpot, rng, sidewalkCorner } from './city.js';
import { Vehicle, driveTo, driveRoute, spawnTraffic } from './vehicles.js';
import { Person, walkerSpot } from './people.js';
import { pickupMesh } from './models.js';
import { WEAPONS } from './player.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const money = n => '$' + Math.round(n).toLocaleString('en-US');
const SONNY = 'Sonny';

// ---------- story ----------
const STORY = [
  {
    title: 'Fresh Off the Boat', reward: 500,
    intro: [{ who: SONNY, text: 'So you’re the kid from up north. Welcome to Coral Bay.' }, { who: SONNY, text: 'First lesson: nobody walks in this town. Get yourself some wheels.' }, { who: SONNY, text: 'Then go see Rudy at Bullet Bay. Tell him I sent you.' }],
    setup(M) { M.objective('Get a car.'); },
    update(M) {
      const P = M.G.player;
      if (M.stage === 0 && P.car) { M.stage = 1; M.objective('Drive to <b>Bullet Bay</b>.'); M.goto(PLACES.gunshop, '#ff8a1f'); }
      if (M.stage === 1 && M.at(PLACES.gunshop, 4)) {
        M.stage = 2; M.clearMarks();
        M.say([{ who: 'Rudy', text: 'Sonny’s new guy? Here. On the house. Don’t point it at me.' }]);
        P.give('pistol', 48); M.G.audio.pickup();
        M.G.hud.help('You got a <b>Pistol</b>. Hold <kbd>Right mouse</kbd> to aim, <kbd>Left mouse</kbd> to fire. <kbd>Q</kbd>/<kbd>E</kbd> or the wheel switches weapons.', 9000);
        M.objective('Go back to the <b>Starfish Club</b>.'); M.goto(PLACES.club, '#ff4fb3');
      }
      if (M.stage === 2 && M.at(PLACES.club, 4)) return 'pass';
    }
  },
  {
    title: 'Beach Pickup', reward: 1500,
    intro: [{ who: SONNY, text: 'A boat dumped three packages before the coast guard showed up.' }, { who: SONNY, text: 'One on the beach, one in Palm Park, one in Little Coral. Get them before anyone else does.' }, { who: SONNY, text: 'Then take them to Dock 9. You got three and a half minutes.' }],
    setup(M) {
      const park = blockRect(4, 4), lc = blockRect(1, 7);
      M.data.pk = [{ x: 600, z: 420 }, { x: park.cx, z: park.z0 + 9 }, { x: lc.x0 + 2.2, z: lc.cz }].map(p => M.pickup('package', p.x, p.z));
      M.data.left = 3; M.timer = 210;
      M.objective('Collect the <b>packages</b> (3 left).');
    },
    update(M) {
      if (M.stage === 0) {
        for (const p of M.data.pk) if (!p.taken && M.near(p, M.G.player.car ? 3 : 1.6)) {
          p.taken = true; p.remove(); M.data.left--; M.G.audio.pickup();
          M.objective(M.data.left ? `Collect the <b>packages</b> (${M.data.left} left).` : 'Take the packages to <b>Dock 9</b>.');
        }
        if (!M.data.left) { M.stage = 1; M.goto(PLACES.dock9, '#3dff9e'); }
      }
      if (M.stage === 1 && M.at(PLACES.dock9, 4)) return 'pass';
      if (M.timer <= 0) return 'You ran out of time.';
    }
  },
  {
    title: 'Showroom Job', reward: 2500,
    intro: [{ who: SONNY, text: 'Sunrise Autos has a red Stiletto in the lot. A buyer wants it tonight.' }, { who: SONNY, text: 'The owner pays some muscle to watch it. Not my problem, yours.' }, { who: SONNY, text: 'Bring it to Dock 9. Scratch it and you pay for the paint.' }],
    setup(M) {
      const spot = M.G.city.parking.find(p => p.lot === 'showroom');
      const old = spot.car; if (old && !old.removed && old.driver !== 'player') { old.remove(M.G); spot.car = null; }
      const car = M.car('sports', spot.x, spot.z + 4, spot.yaw, '#e0222f');
      car.locked = false; M.data.car = car;
      M.arrow(car, '#ffd23f'); M.blip(car, '#ffd23f');
      const r = blockRect(4, 2);
      M.data.guards = [[r.x0 + 6, r.z0 + 8], [r.x0 + 15, r.z0 + 30], [r.x0 + 6, r.z0 + 46]].map(([x, z]) => M.ped('thug', x, z, { state: 'idle' }));
      M.objective('Steal the <b>red Stiletto</b> from Sunrise Autos.');
    },
    update(M) {
      const car = M.data.car, P = M.G.player;
      if (car.dead) return 'The Stiletto got wrecked.';
      if (M.stage === 0 && P.car === car) {
        M.stage = 1; M.clearArrows(); M.blips.length = 0;
        M.G.raiseStars(1);
        for (const g of M.data.guards) g.alert = true;
        M.objective('Take the Stiletto to <b>Dock 9</b> in one piece.'); M.goto(PLACES.dock9, '#3dff9e');
      }
      if (M.stage === 1 && P.car !== car) M.objective('Get back in the <b>Stiletto</b>.');
      else if (M.stage === 1) M.objective(`Take the Stiletto to <b>Dock 9</b>. Condition ${Math.round(car.hp / car.t.hp * 100)}%`);
      if (M.stage === 1 && P.car === car && M.at(PLACES.dock9, 5)) {
        if (car.hp < car.t.hp * 0.4) return 'The buyer won’t take a wreck.';
        car.keep = false; car.mission = false;
        return 'pass';
      }
    }
  },
  {
    title: 'The Rat', reward: 3500,
    intro: [{ who: SONNY, text: 'Nico Dutra is driving to the police station right now to sing about me.' }, { who: SONNY, text: 'He’s in a grey Marquis. He doesn’t get there. Understand?' }],
    setup(M) {
      const s = laneSpot({ i: 6, j: 9 }, { i: 6, j: 8 }, 0.4);
      const car = M.car('sedan', s.x, s.z, s.yaw, '#5a5f66');
      car.driver = 'ai'; car.locked = true;
      car.ai = { mode: 'script', fn: (v, G, dt) => driveTo(v, G, dt, PLACES.police.x - 10, PLACES.police.z, M.data.panic ? 30 : 17) };
      M.data.car = car; M.arrow(car, '#ff3b3b'); M.blip(car, '#ff3b3b');
      M.objective('Stop <b>Nico</b> before he reaches the cops.');
    },
    update(M) {
      const car = M.data.car, P = M.G.player;
      if (car.dead) { M.G.raiseStars(2); return 'pass'; }
      if (dist(car, P) < 45) M.data.panic = true;
      if (dist(car, PLACES.police) < 20) return 'Nico made it to the cops.';
    }
  },
  {
    title: 'Sunset Sprint', reward: 3000,
    intro: [{ who: SONNY, text: 'Rich kids race the whole island every evening. Winner takes the pot.' }, { who: SONNY, text: 'I put your name down. Don’t embarrass me.' }],
    setup(M) {
      const G = M.G, P = G.player;
      const route = [[7, 0], [3, 0], [3, 4], [0, 4], [0, 9], [4, 9], [7, 9], [7, 5]].map(([i, j]) => nodePos(i, j));
      route.push({ x: 7 * PITCH, z: PLACES.club.z + 20 });
      M.data.route = route;
      if (P.car) P.exitCar(G);
      const grid = [[3.8, 0], [-3.8, 0], [3.8, 9], [-3.8, 9]];
      const startZ = PLACES.club.z + 30;
      const mine = M.car('sports', 7 * PITCH + grid[0][0], startZ + grid[0][1], Math.PI, '#ff4fa3');
      G.putInCar(mine);
      M.data.car = mine;
      M.data.racers = grid.slice(1).map(([dx, dz], i) => {
        const v = M.car(['sports', 'muscle', 'convertible'][i], 7 * PITCH + dx, startZ + dz, Math.PI);
        v.driver = 'ai'; v.locked = true;
        v.ai = { mode: 'script', idx: 0, fn: (c, G2, dt) => { if (M.data.go) driveRoute(c, G2, dt, route); else { c.ctrl.throttle = 0; c.ctrl.hb = true; } } };
        M.blip(v, '#5fd0ff', null, false);
        return v;
      });
      M.data.cp = 0; M.data.count = 3.5; M.data.go = false;
      M.objective('Get ready…');
      M.data.mark = M.marker(route[0].x, route[0].z, '#ffd23f', 6, 6);
      M.blip(route[0], '#ffd23f');
    },
    update(M, dt) {
      const G = M.G, P = G.player, d = M.data;
      if (d.car.dead) return 'You wrecked your car.';
      if (!d.go) {
        d.count -= dt;
        d.car.vx = d.car.vz = 0;
        const n = Math.ceil(d.count - 0.5);
        if (n !== d.shown) { d.shown = n; G.hud.banner(n > 0 ? String(n) : 'GO!', '', '#ffd23f', 900); G.audio.ui(); }
        if (d.count <= 0.5) { d.go = true; M.objective('Win the race. Hit every checkpoint.'); }
        return;
      }
      if (P.car !== d.car) { d.out = (d.out || 0) + dt; M.objective('Get back in your car!'); if (d.out > 10) return 'You left the race.'; }
      else d.out = 0;
      const route = d.route;
      if (dist(P, route[d.cp]) < 12) {
        d.cp++; G.audio.pickup();
        d.mark.remove(); M.blips.length = 0;
        for (const v of d.racers) M.blip(v, '#5fd0ff', null, false);
        if (d.cp >= route.length) {
          const ahead = d.racers.filter(v => v.ai.idx >= route.length).length;
          return ahead ? `You came in ${['2nd', '3rd', '4th'][ahead - 1]}.` : 'pass';
        }
        d.mark = M.marker(route[d.cp].x, route[d.cp].z, d.cp === route.length - 1 ? '#3dff9e' : '#ffd23f', 6, 6);
        M.blip(route[d.cp], '#ffd23f');
      }
      // position and rubber band
      const prog = v => v.ai.idx * 10000 - dist(v, route[Math.min(v.ai.idx, route.length - 1)]);
      const mine = d.cp * 10000 - dist(P, route[Math.min(d.cp, route.length - 1)]);
      let pos = 1;
      for (const v of d.racers) {
        const pr = prog(v);
        if (pr > mine) pos++;
        v.topMul = pr > mine + 150 ? 0.86 : pr < mine - 150 ? 1.08 : 0.97;
      }
      M.timerText = `${pos}/4`; M.timerLabel = 'Position';
      M.objective(`Checkpoint ${d.cp + 1}/${route.length}`);
    }
  },
  {
    title: 'Bank Night', reward: 15000,
    intro: [{ who: SONNY, text: 'Coral Federal keeps the casino money in the vault on Friday nights.' }, { who: SONNY, text: 'You go in, you hold the place while my guy cracks it, you come back here.' }, { who: SONNY, text: 'After tonight, nobody in this town forgets your name.' }],
    setup(M) { M.objective('Go to <b>Coral Federal</b>.'); M.goto(PLACES.bank, '#ffd36b'); },
    update(M, dt) {
      const G = M.G, P = G.player, d = M.data;
      if (M.stage === 0 && M.at(PLACES.bank, 4)) {
        M.stage = 1; d.hold = 12; M.manualTimer = true;
        const b = PLACES.bank;
        d.guards = [[-14, 6], [14, 6], [-20, 18], [20, 18], [0, 24]].map(([dx, dz], i) => {
          const g = M.ped(i < 2 ? 'swat' : 'thug', b.x + dx, b.z + dz, { state: 'attack' });
          return g;
        });
        M.say([{ who: 'Safecracker', text: 'Give me twelve seconds. Keep them off me.' }]);
      }
      if (M.stage === 1) {
        if (M.near(PLACES.bank, 7)) d.hold -= dt;
        M.timerLabel = 'Vault'; M.timer = d.hold;
        M.objective(M.near(PLACES.bank, 7) ? 'Hold the bank entrance!' : 'Get back to the <b>bank entrance</b>!');
        if (d.hold <= 0) {
          M.stage = 2; M.timer = null; M.clearMarks();
          G.raiseStars(4); G.audio.cash();
          M.say([{ who: 'Safecracker', text: 'Got it! Alarms are going, move!' }]);
          M.objective('Lose the cops.');
        }
      }
      if (M.stage === 2 && G.stars === 0) { M.stage = 3; M.objective('Bring the money to the <b>Starfish Club</b>.'); M.goto(PLACES.club, '#ff4fb3'); }
      if (M.stage === 3 && G.stars > 0) { M.stage = 2; M.clearMarks(); M.objective('Lose the cops first.'); }
      if (M.stage === 3 && M.at(PLACES.club, 4)) return 'pass';
    }
  }
];
export const STORY_COUNT = STORY.length;

// ---------- pickups ----------
function pickupSpots() {
  const R = rng(77), list = [];
  const park = blockRect(4, 4), park2 = blockRect(1, 8), docks = blockRect(1, 0), hc = blockRect(0, 7);
  list.push({ kind: 'pistol', x: blockRect(2, 4).x1 - 2, z: blockRect(2, 4).z0 + 6, ammo: 24 });
  list.push({ kind: 'bat', x: park.cx + 12, z: park.cz + 3 });
  list.push({ kind: 'smg', x: docks.x0 + 30, z: docks.z0 + 30, ammo: 90 });
  list.push({ kind: 'shotgun', x: hc.x0 + 2.2, z: hc.z0 + 30, ammo: 12 });
  list.push({ kind: 'health', x: PLACES.hospital.x + 4, z: PLACES.hospital.z });
  list.push({ kind: 'health', x: PLACES.hospital2.x, z: PLACES.hospital2.z + 4 });
  list.push({ kind: 'health', x: park2.cx + 10, z: park2.cz });
  list.push({ kind: 'armor', x: PLACES.police.x, z: PLACES.police.z + 6 });
  list.push({ kind: 'armor', x: 610, z: 260 });
  for (const [i, j] of [[2, 2], [5, 5], [1, 7], [6, 7], [3, 3]]) { const r = blockRect(i, j); list.push({ kind: 'star', x: r.x0 + 2.2, z: r.z0 + 2.2 }); }
  for (let n = 0; n < 4; n++) list.push({ kind: 'health', x: BEACH_X + 20 + R() * 60, z: 40 + R() * (CITY_H - 80) });
  return list;
}
function shellSpots() {
  const R = rng(4242), out = [];
  for (let n = 0; n < 8; n++) out.push({ x: BEACH_X + 12 + R() * (SHORE - BEACH_X - 16), z: 20 + R() * (CITY_H - 40) });
  for (let n = 0; n < 16; n++) {
    const bx = Math.floor(R() * NX), bz = Math.floor(R() * NZ), c = sidewalkCorner(bx, bz, Math.floor(R() * 4));
    out.push({ x: c.x, z: c.z });
  }
  return out;
}

// ---------- mission context ----------
class Ctx {
  constructor(G, def) {
    this.G = G; this.def = def; this.stage = 0; this.data = {};
    this.marks = []; this.arrows = []; this.blips = []; this.cars = []; this.peds = []; this.pickups = [];
    this.timer = null; this.timerLabel = 'Time'; this.timerText = null;
  }
  objective(t) { this.G.hud.objective(t); }
  say(l) { this.G.hud.say(l); }
  near(p, r) { return dist(this.G.player, p) < r; }
  at(p, r) { const P = this.G.player; return dist(P, p) < r && (!P.car || P.car.speed < 4); }
  marker(x, z, col, r = 1.6, h = 3) { const m = this.G.fx.marker(x, z, col, r, h); this.marks.push(m); return m; }
  goto(p, col) { this.clearMarks(); this.marker(p.x, p.z, col, 2.2, 3.5); this.blips.length = 0; this.blip(p, col); }
  clearMarks() { for (const m of this.marks) m.remove(); this.marks = []; this.blips = this.blips.filter(b => b.obj.removed !== undefined); }
  arrow(obj, col) { const a = this.G.fx.arrow(col); a.follow = obj; this.arrows.push(a); }
  clearArrows() { for (const a of this.arrows) a.remove(); this.arrows = []; }
  blip(obj, color, icon, edge = true) { this.blips.push({ obj, color, icon, edge }); }
  car(type, x, z, yaw, color) {
    const v = new Vehicle(this.G, type, x, z, yaw, color);
    v.keep = true; v.mission = true;
    this.G.cars.push(v); this.cars.push(v);
    return v;
  }
  ped(kind, x, z, opts = {}) {
    const p = new Person(this.G, kind, x, z, { ...opts, keep: true, mission: true });
    this.G.peds.push(p); this.peds.push(p);
    return p;
  }
  pickup(kind, x, z) { const p = this.G.missions.spawnPickup(kind, x, z, { once: true }); this.pickups.push(p); return p; }
  cleanup() {
    this.clearMarks(); this.clearArrows();
    for (const p of this.pickups) p.remove();
    for (const v of this.cars) { v.keep = false; v.mission = false; v.locked = false; if (v.ai?.mode === 'script') { v.ai = null; v.driver = null; } }
    for (const p of this.peds) p.keep = false;
    this.G.hud.objective(''); this.G.hud.timer(null);
  }
}

export class Missions {
  constructor(G) {
    this.G = G;
    this.list = []; this.active = null; this.side = null;
    this.contact = null; this.places = {};
    this.pickupDefs = pickupSpots();
    this.shells = shellSpots();
  }
  get busy() { return !!(this.active || this.side); }
  clear() {
    for (const p of this.list) p.remove(true);
    this.list = [];
    if (this.active) { this.active.cleanup(); this.active = null; }
    if (this.side) this.endSide(true);
    for (const k of Object.keys(this.places)) this.places[k].remove();
    this.places = {};
    if (this.contact) { this.contact.remove(); this.contact = null; }
  }
  reset() {
    this.clear();
    for (const d of this.pickupDefs) this.spawnPickup(d.kind, d.x, d.z, { def: d });
    const found = new Set(this.G.save.shells);
    this.shells.forEach((s, i) => { if (!found.has(i)) this.spawnPickup('shell', s.x, s.z, { once: true, shell: i }); });
    for (const k of ['gunshop', 'safehouse', 'spray', 'spray2']) {
      const p = PLACES[k];
      this.places[k] = this.G.fx.marker(p.x, p.z, k.startsWith('spray') ? '#ff5edb' : k === 'gunshop' ? '#ff8a1f' : '#21e6ff', k.startsWith('spray') ? 3 : 1.1, k.startsWith('spray') ? 1.4 : 1.6);
    }
    this.refreshContact();
  }
  refreshContact() {
    if (this.contact) { this.contact.remove(); this.contact = null; }
    if (!this.active && this.G.save.story < STORY.length) this.contact = this.G.fx.marker(PLACES.club.x, PLACES.club.z, '#ff4fb3', 1.5, 4);
  }
  spawnPickup(kind, x, z, opt = {}) {
    const G = this.G;
    const mesh = pickupMesh(kind);
    mesh.position.set(x, 1, z);
    G.scene.add(mesh);
    const p = {
      kind, x, z, mesh, taken: false, respawn: 0, ...opt,
      remove: (force) => { G.scene.remove(mesh); p.removed = true; if (force !== true) this.list = this.list.filter(q => q !== p); }
    };
    this.list.push(p);
    return p;
  }
  dropCash(x, z, amount) {
    const p = this.spawnPickup('cash', x + (Math.random() - 0.5), z + (Math.random() - 0.5), { once: true, amount, life: 30 });
    p.mesh.scale.setScalar(0.7);
  }
  collect(p) {
    const G = this.G, P = G.player;
    const k = p.kind;
    if (k === 'package') return;
    if (k === 'health') { if (P.hp >= 100) return; P.hp = 100; G.hud.help('Health restored.', 2000); }
    else if (k === 'armor') { if (P.armor >= 100) return; P.armor = 100; G.hud.help('Body armor.', 2000); }
    else if (k === 'star') { if (G.stars === 0) return; G.setStars(G.stars - 1); G.hud.help('Bribe: one star off.', 2000); }
    else if (k === 'cash') { G.addCash(p.amount); G.audio.cash(); }
    else if (k === 'shell') {
      G.save.shells.push(p.shell);
      const n = G.save.shells.length;
      G.addCash(100);
      G.hud.banner('Seashell', `${n} of ${this.shells.length} found · $100`, '#ffb3d9', 2600);
      if (n === this.shells.length) { G.addCash(10000); G.hud.banner('All seashells!', '$10,000 bonus', '#ffb3d9', 5000); }
      G.persist();
    } else if (WEAPONS[k]) {
      if (P.car) return;
      P.give(k, p.ammo || 0);
      G.hud.help(`Picked up <b>${WEAPONS[k].name}</b>.`, 2200);
    }
    if (k !== 'cash' && k !== 'shell') G.audio.pickup();
    p.taken = true; p.mesh.visible = false;
    if (p.once) p.remove(); else p.respawn = 60;
  }
  start(i) {
    const G = this.G, def = STORY[i];
    if (this.side) this.endSide();
    this.active = new Ctx(G, def);
    this.active.index = i;
    this.refreshContact();
    G.hud.banner(def.title, '', '#ff4fb3', 3400);
    G.audio.ui();
    this.active.say(def.intro);
    def.setup(this.active);
  }
  finish(result) {
    const G = this.G, M = this.active;
    if (!M) return;
    M.cleanup();
    this.active = null;
    this.armed = false;
    if (result === 'pass') {
      const r = M.def.reward;
      G.addCash(r);
      G.save.story = Math.max(G.save.story, M.index + 1);
      G.audio.passed();
      G.hud.banner('Mission passed!', money(r), '#ffd36b', 4500);
      if (G.save.story >= STORY.length) setTimeout(() => G.hud.banner('Coral Bay is yours', 'Story complete. The city is still open.', '#ff4fb3', 6000), 4800);
      G.persist();
    } else {
      G.audio.failed();
      G.hud.banner('Mission failed!', result || '', '#ff3b5c', 4000);
    }
    this.refreshContact();
  }
  fail(reason) { if (this.active) this.finish(reason); if (this.side) this.endSide(); }
  // ---------- side jobs ----------
  startSide(kind) {
    const G = this.G;
    if (this.active || this.side) return;
    this.side = { kind, level: 0, t: 0, fares: 0, total: 0 };
    G.audio.ui();
    if (kind === 'taxi') { G.hud.banner('Taxi', 'Pick up fares. Press J to stop.', '#ffd23f', 2600); this.nextFare(); }
    else { G.hud.banner('Vigilante', 'Take out the suspect. Press J to stop.', '#5fb0ff', 2600); this.nextSuspect(); }
  }
  endSide(silent) {
    const s = this.side, G = this.G;
    if (!s) return;
    if (s.mark) s.mark.remove();
    if (s.arrow) s.arrow.remove();
    if (s.fare) { s.fare.keep = false; if (s.fare.state === 'ride' || s.fare.state === 'idle') { s.fare.state = 'walk'; s.fare.m.root.visible = true; s.fare.joinSidewalk(); } }
    if (s.suspect) { s.suspect.keep = false; s.suspect.mission = false; }
    this.side = null;
    G.hud.objective(''); G.hud.timer(null);
    if (!silent) G.hud.banner(s.kind === 'taxi' ? 'Taxi job over' : 'Vigilante over', s.kind === 'taxi' ? `${s.fares} fares · ${money(s.total)}` : `Level ${s.level} · ${money(s.total)}`, '#ffd23f', 3200);
  }
  nextFare() {
    const G = this.G, s = this.side;
    const spot = walkerSpot(G.player, 50, 170);
    if (!spot) { s.wait = 1; return; }
    const p = new Person(G, 'civ', spot.x, spot.z, { state: 'idle', keep: true });
    G.peds.push(p);
    s.fare = p; s.phase = 'pickup'; s.t = 60;
    if (s.mark) s.mark.remove(); s.mark = null;
    G.hud.objective('Pick up the <b>fare</b>.');
  }
  nextSuspect() {
    const G = this.G, s = this.side;
    const v = spawnTraffic(G, G.player, 110, 220, ['muscle', 'sports', 'sedan'][Math.floor(Math.random() * 3)]);
    if (!v) { s.wait = 1; return; }
    v.ai.cruise = 22 + s.level * 2; v.ai.panic = 0; v.keep = true; v.mission = true; v.locked = true;
    v.hp = v.t.hp * (1 + s.level * 0.2);
    s.suspect = v; s.t = 150;
    if (s.arrow) s.arrow.remove();
    s.arrow = G.fx.arrow('#ff3b3b'); s.arrow.follow = v;
    G.hud.objective(`Level ${s.level + 1}: destroy the <b>suspect's car</b>.`);
  }
  updateSide(dt) {
    const G = this.G, s = this.side, P = G.player;
    if (s.wait > 0) { s.wait -= dt; if (s.wait <= 0) s.kind === 'taxi' ? this.nextFare() : this.nextSuspect(); return; }
    const wantType = s.kind === 'taxi' ? (c => c.t.taxi) : (c => c.t.police);
    if (!P.car || !wantType(P.car)) { s.away = (s.away || 0) + dt; G.hud.objective(s.kind === 'taxi' ? 'Get back in your <b>cab</b>.' : 'Get back in the <b>cruiser</b>.'); if (s.away > 8) this.endSide(); return; }
    s.away = 0;
    s.t -= dt;
    G.hud.timer(s.kind === 'taxi' ? 'Fare' : 'Time', s.t);
    if (s.kind === 'taxi') {
      const f = s.fare;
      if (!f || f.dead || f.removed) { this.nextFare(); return; }
      if (s.phase === 'pickup') {
        if (dist(P, f) < 7 && P.car.speed < 2) {
          f.state = 'ride'; f.m.root.visible = false;
          const opts = Object.values(PLACES).filter(p => dist(p, P) > 160);
          const dst = opts[Math.floor(Math.random() * opts.length)] || PLACES.club;
          s.dest = dst; s.phase = 'ride'; s.d0 = dist(P, dst); s.t = s.d0 / 10 + 15;
          s.mark = G.fx.marker(dst.x, dst.z, '#ffd23f', 2.5, 3);
          G.hud.objective(`Take the fare to <b>${dst.name}</b>.`);
          G.audio.door();
        } else if (s.t <= 0) { f.keep = false; f.state = 'walk'; f.joinSidewalk(); this.nextFare(); }
      } else if (s.phase === 'ride') {
        f.x = P.x; f.z = P.z;
        if (dist(P, s.dest) < 7 && P.car.speed < 2) {
          const pay = Math.round(15 + s.d0 * 0.12 + Math.max(0, s.t) * 1.5);
          s.fares++; s.total += pay; G.addCash(pay); G.audio.cash();
          G.save.stats.fares++;
          f.state = 'walk'; f.m.root.visible = true; const door = P.car.door(1); f.x = door.x; f.z = door.z; f.keep = false; f.joinSidewalk();
          let msg = `Fare paid ${money(pay)}`;
          if (s.fares % 5 === 0) { const b = 100 * s.fares; G.addCash(b); s.total += b; msg += ` · ${s.fares} in a row bonus ${money(b)}`; }
          G.hud.help(msg, 3000);
          s.mark.remove(); s.mark = null; s.fare = null;
          this.nextFare();
        } else if (s.t <= 0) { G.hud.help('The fare got out. Too slow.', 3000); f.state = 'walk'; f.m.root.visible = true; f.x = P.x + 3; f.z = P.z; f.keep = false; f.joinSidewalk(); this.endSide(); }
      }
    } else {
      const v = s.suspect;
      if (!v || v.removed) { this.nextSuspect(); return; }
      if (v.dead) {
        s.level++;
        const pay = 250 * s.level; s.total += pay; G.addCash(pay); G.audio.cash();
        G.hud.help(`Suspect down. ${money(pay)}`, 3000);
        v.keep = false; v.mission = false; s.suspect = null;
        if (s.arrow) { s.arrow.remove(); s.arrow = null; }
        s.wait = 2;
        return;
      }
      if (dist(v, P) < 60) v.ai.panic = 1;
      if (s.t <= 0) { G.hud.help('The suspect got away.', 3000); this.endSide(); }
    }
  }
  // ---------- frame ----------
  update(dt) {
    const G = this.G, P = G.player;
    // pickups
    const t = G.now;
    for (const p of this.list) {
      if (p.removed) continue;
      if (p.taken) { if (p.respawn > 0 && (p.respawn -= dt) <= 0) { p.taken = false; p.mesh.visible = true; } continue; }
      p.mesh.rotation.y = t * 2;
      p.mesh.position.y = 1 + Math.sin(t * 3 + p.x) * 0.15;
      if (p.life !== undefined && (p.life -= dt) <= 0) { p.remove(); continue; }
      if (Math.abs(p.x - P.x) < 3 && Math.abs(p.z - P.z) < 3 && dist(P, p) < (P.car ? 2.6 : 1.4)) this.collect(p);
    }
    this.list = this.list.filter(p => !p.removed);
    // places
    const near = (pl, r) => dist(P, pl) < r;
    if (P.onFoot && near(PLACES.gunshop, 1.8)) { if (!this.inShop) { this.inShop = true; G.openShop(); } } else this.inShop = false;
    if (P.onFoot && near(PLACES.safehouse, 1.6)) { if (!this.inSafe) { this.inSafe = true; G.saveAtSafehouse(); } } else this.inSafe = false;
    const sp = P.car && (near(PLACES.spray, 4) || near(PLACES.spray2, 4));
    if (sp) { if (!this.inSpray) { this.inSpray = true; G.sprayCar(); } } else this.inSpray = false;
    // contact
    if (!near(PLACES.club, 5)) this.armed = true;
    if (this.armed && !this.active && G.save.story < STORY.length && near(PLACES.club, 2.2) && (!P.car || P.car.speed < 3)) {
      this.armed = false; this.start(G.save.story);
    }
    if (this.active) {
      const M = this.active;
      if (typeof M.timer === 'number') { if (!M.manualTimer) M.timer -= dt; G.hud.timer(M.timerLabel, M.timer); }
      else if (M.timerText) G.hud.timer(M.timerLabel, M.timerText);
      else G.hud.timer(null);
      const r = M.def.update(M, dt);
      if (r) this.finish(r);
    } else if (this.side) this.updateSide(dt);
  }
  blips(full) {
    const out = [];
    const sv = this.G.save;
    if (!this.active && sv.story < STORY.length) out.push({ x: PLACES.club.x, z: PLACES.club.z, color: '#ff4fb3', icon: 'S', edge: true });
    out.push({ x: PLACES.safehouse.x, z: PLACES.safehouse.z, color: '#21e6ff', icon: 'H', edge: full });
    out.push({ x: PLACES.gunshop.x, z: PLACES.gunshop.z, color: '#ff8a1f', icon: 'G' });
    out.push({ x: PLACES.spray.x, z: PLACES.spray.z, color: '#ff5edb', icon: 'P' });
    out.push({ x: PLACES.spray2.x, z: PLACES.spray2.z, color: '#ff5edb', icon: 'P' });
    if (full) {
      out.push({ x: PLACES.hospital.x, z: PLACES.hospital.z, color: '#ffffff', icon: '+', ink: '#e23' });
      out.push({ x: PLACES.hospital2.x, z: PLACES.hospital2.z, color: '#ffffff', icon: '+', ink: '#e23' });
      out.push({ x: PLACES.police.x, z: PLACES.police.z, color: '#3d8bff', icon: 'P', ink: '#fff' });
    }
    if (this.active) for (const b of this.active.blips) if (!b.obj.removed) out.push({ x: b.obj.x, z: b.obj.z, color: b.color, edge: b.edge, size: 5 });
    const s = this.side;
    if (s?.kind === 'taxi') {
      if (s.phase === 'pickup' && s.fare) out.push({ x: s.fare.x, z: s.fare.z, color: '#ffd23f', edge: true, size: 5 });
      if (s.phase === 'ride' && s.dest) out.push({ x: s.dest.x, z: s.dest.z, color: '#ffd23f', edge: true, size: 5, square: true });
    }
    if (s?.kind === 'vigilante' && s.suspect) out.push({ x: s.suspect.x, z: s.suspect.z, color: '#ff3b3b', edge: true, size: 5 });
    return out;
  }
}
