'use strict';
(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const cv = $('#game'), ctx = cv.getContext('2d');
  const VW = 960, VH = 540, GT = 330, ZMAX = 196, GRAV = 1500;
  const P = Art.P;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.random() * a.length | 0];
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // ---------- data ----------
  const HEROES = [
    {
      id: 'rex', name: 'REX', title: 'The Street Brawler', hp: 120, spd: 175, power: 1, stats: [4, 3, 3],
      look: { skin: '#f0b98d', hair: '#3b2416', hairStyle: 'spiky', top: '#d62839', topStyle: 'jacket', inner: '#f8fafc', sleeves: 'long', pants: '#273c75', shoes: '#f5f5f5', gloves: '#1f2937', band: '#fbbf24', belt: '#111827', scale: 1, bulk: 1 },
      combo: ['jab', 'jab', 'hook', 'uppercut'], air: 'jumpKick', dash: 'dashPunch', special: 'lariat', specialName: 'Tornado Lariat',
    },
    {
      id: 'nova', name: 'NOVA', title: 'The Lightning Kicker', hp: 100, spd: 210, power: 0.85, stats: [3, 5, 2],
      look: { skin: '#c98d63', hair: '#7c3aed', hairStyle: 'pony', top: '#0ea5a4', topStyle: 'tank', sleeves: 'none', pants: '#111827', shoes: '#f472b6', gloves: '#f472b6', belt: '#f472b6', scale: 0.96, bulk: 0.85 },
      combo: ['jab', 'kickLow', 'kickHigh', 'kickHigh2', 'spinHeel'], air: 'jumpKick', dash: 'dashKick', special: 'cyclone', specialName: 'Cyclone Kick',
    },
    {
      id: 'brutus', name: 'BRUTUS', title: 'The Iron Wall', hp: 150, spd: 148, power: 1.3, stats: [5, 2, 5],
      look: { skin: '#8a5536', hair: '#1c1917', hairStyle: 'bald', beard: true, top: '#3f6212', topStyle: 'tank', sleeves: 'none', pants: '#57534e', shoes: '#292524', gloves: '#b45309', belt: '#78350f', scale: 1.12, bulk: 1.4 },
      combo: ['hammer', 'hammer2', 'headbutt'], air: 'jumpKick', dash: 'dashPunch', special: 'pound', specialName: 'Earthquake Slam',
    },
  ];

  const MOVES = {
    // heroes
    jab: { pose: 'jab', su: 0.05, ac: 0.07, rc: 0.11, dmg: 6, rx: [8, 56], ry: [55, 90] },
    hook: { pose: 'hook', su: 0.07, ac: 0.07, rc: 0.14, dmg: 8, rx: [8, 58], ry: [50, 90] },
    uppercut: { pose: 'uppercut', pre: 'crouchPre', su: 0.1, ac: 0.09, rc: 0.28, dmg: 14, kd: 1, launch: 1.3, rx: [4, 56], ry: [45, 120], big: 1 },
    kickLow: { pose: 'kickLow', su: 0.06, ac: 0.07, rc: 0.12, dmg: 6, rx: [14, 66], ry: [10, 55], sfx: 'kick' },
    kickHigh: { pose: 'kickHigh', pre: 'windup', su: 0.08, ac: 0.08, rc: 0.14, dmg: 7, rx: [14, 72], ry: [50, 100], sfx: 'kick' },
    kickHigh2: { pose: 'kickHigh', pre: 'windup', su: 0.08, ac: 0.08, rc: 0.14, dmg: 8, rx: [14, 72], ry: [50, 100], sfx: 'kick' },
    spinHeel: { pose: 'roundhouse', pre: 'windup', su: 0.1, ac: 0.1, rc: 0.3, dmg: 13, kd: 1, rx: [10, 80], ry: [45, 110], sfx: 'kick', big: 1 },
    hammer: { pose: 'hammer', pre: 'hammerUp', su: 0.12, ac: 0.08, rc: 0.18, dmg: 11, rx: [8, 62], ry: [40, 100] },
    hammer2: { pose: 'cross', pre: 'windup', su: 0.09, ac: 0.08, rc: 0.18, dmg: 11, rx: [8, 66], ry: [45, 95] },
    headbutt: { pose: 'headbutt', pre: 'headbuttPre', su: 0.16, ac: 0.09, rc: 0.32, dmg: 20, kd: 1, rx: [4, 56], ry: [60, 115], big: 1 },
    jumpKick: { pose: 'jumpKick', su: 0.04, dmg: 12, kd: 1, rx: [4, 64], ry: [-10, 70], sfx: 'kick' },
    dashPunch: { pose: 'dashPunch', su: 0.04, ac: 0.2, rc: 0.25, dmg: 14, kd: 1, lunge: 330, rx: [4, 60], ry: [40, 100], big: 1 },
    dashKick: { pose: 'kickHigh', su: 0.04, ac: 0.2, rc: 0.25, dmg: 12, kd: 1, lunge: 360, rx: [8, 74], ry: [40, 100], sfx: 'kick' },
    knee: { pose: 'knee', dmg: 8, rx: [0, 60], ry: [20, 80], sfx: 'kick' },
    throwAnim: { pose: 'throwP', pre: 'grabHold', su: 0.08, ac: 0.12, rc: 0.25, noHit: 1 },
    lariat: { pose: 'lariat', su: 0.06, ac: 0.65, rc: 0.18, dmg: 9, kd: 1, around: 1, multi: 0.15, rx: [0, 76], ry: [40, 105], spin: 1, special: 1, steer: 90 },
    cyclone: { pose: 'cyclone', su: 0.06, ac: 0.7, rc: 0.18, dmg: 7, kd: 1, around: 1, multi: 0.11, rx: [0, 74], ry: [0, 95], spin: 1, special: 1, lunge: 210, lift: 34, sfx: 'kick' },
    pound: { pose: 'slam', pre: 'poundUp', su: 0.36, ac: 0.12, rc: 0.34, dmg: 20, kd: 1, around: 1, rx: [0, 98], ry: [-20, 70], special: 1, jumpArc: 75, waves: 1, big: 1 },
    // enemies
    eJab: { pose: 'jab', pre: 'windup', su: 0.18, ac: 0.07, rc: 0.28, dmg: 5, rx: [8, 56], ry: [55, 90] },
    eHook: { pose: 'hook', pre: 'windup', su: 0.26, ac: 0.08, rc: 0.36, dmg: 8, kd: 1, rx: [8, 60], ry: [50, 95] },
    slash: { pose: 'slash', pre: 'slashUp', su: 0.22, ac: 0.1, rc: 0.36, dmg: 9, lunge: 200, rx: [8, 74], ry: [30, 100], sfx: 'slash' },
    heavy: { pose: 'hammer', pre: 'hammerUp', su: 0.38, ac: 0.1, rc: 0.45, dmg: 13, kd: 1, rx: [8, 74], ry: [30, 110], big: 1 },
    eKick: { pose: 'kickHigh', pre: 'windup', su: 0.22, ac: 0.1, rc: 0.34, dmg: 8, rx: [12, 76], ry: [45, 100], sfx: 'kick' },
    eJumpKick: { pose: 'crouchPre', su: 0.2, ac: 0.01, rc: 0.01, noHit: 1, leap: { mv: 'jumpKick', vh: 390, vx: 260 } },
    bossSmash: { pose: 'slam', pre: 'poundUp', su: 0.55, ac: 0.12, rc: 0.6, dmg: 16, kd: 1, around: 1, rx: [0, 92], ry: [-20, 70], jumpArc: 90, waves: 1, big: 1 },
    dashSlash: { pose: 'slash', pre: 'slashUp', su: 0.38, ac: 0.42, rc: 0.45, dmg: 13, kd: 1, lunge: 560, rx: [0, 64], ry: [30, 100], ghost: 1, sfx: 'slash' },
    knives: { pose: 'cross', pre: 'windup', su: 0.3, ac: 0.06, rc: 0.4, noHit: 1, spawn: 'knives', ranged: 1 },
    fire: { pose: 'blast', pre: 'windup', su: 0.45, ac: 0.1, rc: 0.5, noHit: 1, spawn: 'fire', ranged: 1 },
  };

  const SKINS = ['#f0c29a', '#d49a6a', '#a46a43', '#7a4a2e', '#e8b48a'];
  const HAIRS = ['#1c1917', '#78350f', '#facc15', '#dc2626', '#e5e7eb', '#2563eb'];
  const ENEMIES = {
    thug: {
      name: 'Thug', hp: 55, spd: 100, reach: 54, moves: ['eJab', 'eJab', 'eHook'], score: 100,
      look: () => ({ skin: pick(SKINS), hair: pick(HAIRS), hairStyle: pick(['mohawk', 'cap', 'spiky', 'bald']), top: pick(['#4b5563', '#7c2d12', '#1e3a8a', '#365314', '#581c87']), topStyle: 'vest', sleeves: 'none', pants: pick(['#1f2937', '#3f3f46', '#1e293b', '#422006']), shoes: '#111', belt: '#111', scale: rand(0.95, 1.05), bulk: rand(1, 1.15) }),
    },
    slasher: {
      name: 'Slasher', hp: 45, spd: 150, reach: 64, moves: ['slash'], score: 150,
      look: () => ({ skin: pick(SKINS), hair: pick(['#dc2626', '#2563eb', '#16a34a', '#f59e0b']), hairStyle: 'bandana', top: '#111827', topStyle: 'tank', sleeves: 'none', pants: '#374151', shoes: '#111', belt: '#7f1d1d', knife: true, scale: 0.96, bulk: 0.85 }),
    },
    bruiser: {
      name: 'Bruiser', hp: 140, spd: 72, reach: 62, moves: ['heavy', 'eHook'], score: 300, charge: 330, heavyBody: true,
      look: () => ({ skin: pick(SKINS), hair: '#1c1917', hairStyle: pick(['bald', 'mohawk']), beard: Math.random() < 0.6, top: pick(['#7f1d1d', '#1f2937', '#713f12']), topStyle: 'tank', sleeves: 'none', pants: '#1c1917', shoes: '#111', gloves: '#44403c', belt: '#111', scale: 1.24, bulk: 1.6 }),
    },
    kicker: {
      name: 'Kicker', hp: 65, spd: 125, reach: 70, moves: ['eKick', 'eKick', 'eJumpKick'], score: 180,
      look: () => ({ skin: pick(SKINS), hair: pick(HAIRS), hairStyle: 'spiky', band: pick(['#ef4444', '#3b82f6', '#22c55e']), top: '#f5f5f4', topStyle: 'gi', sleeves: 'short', pants: '#f5f5f4', shoes: '#e7c4a0', belt: '#111', scale: 1, bulk: 0.95 }),
    },
    brick: {
      boss: true, name: 'BRICK', title: 'The Wrecking Ball', hp: 620, spd: 88, reach: 74, moves: ['heavy', 'eHook', 'bossSmash'], score: 5000, charge: 420, poise: 55, heavyBody: true,
      look: () => ({ skin: '#d49a6a', hair: '#f97316', hairStyle: 'mohawk', beard: true, top: '#1f2937', topStyle: 'vest', sleeves: 'none', pants: '#3f3f46', shoes: '#111', gloves: '#525252', pads: '#9ca3af', belt: '#7f1d1d', scale: 1.5, bulk: 1.7 }),
    },
    viper: {
      boss: true, name: 'VIPER', title: 'Twin Blade Assassin', hp: 540, spd: 175, reach: 72, moves: ['slash', 'slash', 'dashSlash', 'knives'], score: 6000, poise: 38, evade: true,
      look: () => ({ skin: '#e0b48c', hair: '#0f172a', hairStyle: 'long', top: '#4c1d95', topStyle: 'gi', sleeves: 'long', pants: '#1e1b4b', shoes: '#111', band: '#a855f7', blades: true, eyes: 'visor', belt: '#a855f7', scale: 1.06, bulk: 0.95 }),
    },
    warlord: {
      boss: true, name: 'WARLORD', title: 'Lord of the Neon Fortress', hp: 820, spd: 96, reach: 78, moves: ['heavy', 'fire', 'bossSmash', 'eHook'], score: 9000, poise: 70, summon: true, heavyBody: true,
      look: () => ({ skin: '#b08968', hair: '#e5e7eb', hairStyle: 'helmet', beard: true, top: '#374151', topStyle: 'armor', sleeves: 'long', pants: '#1f2937', shoes: '#111', gloves: '#111827', cape: '#991b1b', pads: '#6b7280', glowEyes: true, belt: '#b91c1c', scale: 1.4, bulk: 1.35 }),
    },
  };

  const STAGES = [
    {
      name: 'Downtown Dusk', theme: 'downtown', song: 's1', bossAt: 2900, boss: 'brick',
      props: [[560, 'barrel', 'apple'], [1240, 'crate', 'coin'], [1960, 'drum', 'burger'], [2620, 'crate', 'chicken'], [2700, 'barrel', 'gem']],
      waves: [{ at: 250, list: ['thug', 'thug'] }, { at: 850, list: ['thug', 'thug', 'slasher'] }, { at: 1500, list: ['thug', 'bruiser', 'thug'] }, { at: 2200, list: ['slasher', 'thug', 'slasher', 'thug'] }],
    },
    {
      name: 'Harbor Night', theme: 'harbor', song: 's2', bossAt: 2950, boss: 'viper',
      props: [[420, 'crate', 'apple'], [1100, 'barrel', 'burger'], [1800, 'crate', 'coin'], [2500, 'drum', 'chicken'], [2620, 'crate', 'gem']],
      waves: [{ at: 200, list: ['slasher', 'thug', 'kicker'] }, { at: 850, list: ['kicker', 'kicker', 'thug'] }, { at: 1500, list: ['bruiser', 'slasher', 'slasher'] }, { at: 2200, list: ['kicker', 'bruiser', 'thug', 'slasher'] }],
    },
    {
      name: 'Neon Fortress', theme: 'fortress', song: 's3', bossAt: 3300, boss: 'warlord',
      props: [[380, 'drum', 'burger'], [1050, 'crate', 'apple'], [1750, 'drum', 'chicken'], [2450, 'crate', 'coin'], [3000, 'drum', 'roast']],
      waves: [{ at: 200, list: ['kicker', 'slasher', 'thug', 'thug'] }, { at: 850, list: ['bruiser', 'kicker', 'kicker'] }, { at: 1550, list: ['slasher', 'slasher', 'bruiser', 'thug'] }, { at: 2300, list: ['bruiser', 'bruiser', 'kicker'] }, { at: 2900, list: ['kicker', 'slasher', 'thug', 'kicker'] }],
    },
  ];

  const DIFF = {
    easy: { eHp: 0.8, eDmg: 0.6, tokens: 1, agg: 0.7, lives: 4 },
    normal: { eHp: 1, eDmg: 1, tokens: 2, agg: 1, lives: 3 },
    hard: { eHp: 1.25, eDmg: 1.35, tokens: 3, agg: 1.35, lives: 2 },
  };
  const ITEMS = { apple: { heal: 15 }, burger: { heal: 30 }, chicken: { heal: 55 }, roast: { heal: 999 }, coin: { score: 500 }, gem: { score: 2000 } };

  // ---------- run state ----------
  const app = { state: 'title', prev: null, players: 1, diff: 'normal', picks: [0, 1], titleCam: 0, time: 0 };
  let G = null;
  let uid = 0;

  function newFighter(kind, look, x, z) {
    const sc = look.scale || 1;
    return {
      id: uid++, kind, look, x, z, h: 0, vx: 0, vz: 0, vh: 0, face: 1, state: 'idle', st: 0,
      w: 18 * sc * Math.sqrt(look.bulk || 1), tall: 96 * sc, invul: 0, flashT: 0, walkT: 0, mv: null, hitSet: null,
    };
  }

  function makePlayer(i, hero) {
    const p = newFighter('player', hero.look, 0, 0);
    Object.assign(p, {
      idx: i, hero, maxHp: hero.hp, hp: hero.hp, power: 0, lives: DIFF[app.diff].lives, score: 0,
      comboIdx: -1, connected: false, buffered: false, lastAtkEnd: -9, tapL: -9, tapR: -9, running: false,
      airMv: null, airUsed: false, grabbed: null, grabT: 0, kneeT: 0, knees: 0,
      combo: 0, comboT: 0, recent: [], out: false, respawnT: 0, lastTarget: null, lastTargetT: 0,
    });
    return p;
  }

  function makeEnemy(type, x, z) {
    const def = ENEMIES[type], D = DIFF[app.diff];
    const e = newFighter('enemy', def.look(), x, z);
    const coop = app.players === 2 ? 1.3 : 1;
    Object.assign(e, {
      type, def, boss: !!def.boss, maxHp: Math.round(def.hp * D.eHp * coop), token: false,
      cd: rand(0.4, 1.2), zOff: rand(-60, 60), hoverOff: rand(0, 70), poise: def.poise || 0, recent: [],
      enter: true, summoned: [false, false],
    });
    e.hp = e.maxHp;
    return e;
  }

  function newRun() {
    G = {
      stageIdx: 0, players: [], enemies: [], props: [], items: [], projs: [], fx: [], ghosts: [],
      camX: 0, locked: false, waveIdx: 0, queue: [], boss: null, bossPhase: 'none', time: 0,
      freeze: 0, shake: 0, flash: 0, goT: 0, slow: 0, continues: 3, stageTime: 0, superT: 0,
    };
    for (let i = 0; i < app.players; i++) G.players.push(makePlayer(i, HEROES[app.picks[i]]));
  }

  function startStage(idx) {
    const st = STAGES[idx];
    G.stageIdx = idx; G.stage = st;
    G.enemies = []; G.items = []; G.projs = []; G.fx = []; G.ghosts = [];
    G.camX = 0; G.locked = false; G.waveIdx = 0; G.queue = []; G.boss = null; G.bossPhase = 'none';
    G.stageTime = 0; G.goT = 0; G.slow = 0; G.freeze = 0; G.superT = 0;
    G.props = st.props.map(([x, type, item]) => ({ kind: 'prop', type, item, x, z: rand(10, 60), h: 0, hp: 2, w: 24, tall: 62, dmgT: 0 }));
    G.players.forEach((p, i) => {
      if (p.out && p.lives < 0) return;
      Object.assign(p, { x: 90 + i * 40, z: 70 + i * 60, h: 0, vx: 0, vh: 0, state: 'idle', st: 0, face: 1, invul: 1, mv: null, grabbed: null });
    });
    $('#stageName').textContent = `STAGE ${idx + 1} · ${st.name.toUpperCase()}`;
    showCard(`Stage ${idx + 1}`, st.name.toUpperCase(), idx === 2 ? 'The final showdown' : 'Clean up the streets!');
    Sound.music(st.song);
    app.state = 'play';
    refreshHudStatic();
  }

  // ---------- helpers ----------
  const alivePlayers = () => G.players.filter(p => !p.out);
  const nearestPlayer = e => {
    let best = null, bd = Infinity;
    for (const p of alivePlayers()) {
      if (p.state === 'dead') continue;
      const d = Math.abs(p.x - e.x) + Math.abs(p.z - e.z) * 1.5;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  };
  const NOHIT = new Set(['fall', 'down', 'getup', 'dying', 'dead', 'thrown', 'respawn']);
  function canHit(t) {
    if (t.kind === 'prop') return t.hp > 0;
    if (t.invul > 0 || NOHIT.has(t.state)) return false;
    if (t.out) return false;
    return true;
  }

  function addFx(o) { G.fx.push(Object.assign({ t: 0 }, o)); }
  function spark(x, y, big) {
    addFx({ k: 'spark', x, y, life: big ? 0.28 : 0.18, big, rot: rand(0, 6) });
    for (let i = 0; i < (big ? 10 : 5); i++) {
      const a = rand(0, Math.PI * 2), v = rand(120, big ? 420 : 260);
      addFx({ k: 'bit', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.15, 0.35), color: pick(['#fff7c2', '#fde047', '#fb923c']), r: rand(1.5, 3.5) });
    }
  }
  function dust(x, z, n = 6) {
    for (let i = 0; i < n; i++) addFx({ k: 'dust', x: x + rand(-20, 20), z, vx: rand(-60, 60), life: rand(0.35, 0.6), r: rand(6, 13) });
  }
  function popText(x, y, text, color = '#fde047', size = 22) { addFx({ k: 'text', x, y, text, color, size, life: 0.9 }); }

  // ---------- combat ----------
  function doHits(a, mv) {
    const targets = a.kind === 'player' ? G.enemies.concat(G.props) : G.players;
    const sc = a.look ? (a.look.scale || 1) : 1;
    for (const t of targets) {
      if (!canHit(t)) continue;
      if (Math.abs(t.z - a.z) > 20 * Math.max(1, sc * 0.9)) continue;
      const rel = (t.x - a.x) * a.face;
      const x1 = mv.rx[1] * sc, x0 = mv.rx[0] * sc;
      if (mv.around) { if (Math.abs(t.x - a.x) > x1 + t.w) continue; }
      else if (rel < x0 - t.w || rel > x1 + t.w) continue;
      const ay0 = a.h + mv.ry[0] * sc, ay1 = a.h + mv.ry[1] * sc;
      if (ay1 < t.h || ay0 > t.h + t.tall) continue;
      const last = a.hitSet.get(t);
      if (last !== undefined && (!mv.multi || G.time - last < mv.multi)) continue;
      a.hitSet.set(t, G.time);
      if (t.kind === 'prop') hitProp(a, t);
      else applyHit(a, t, mv);
    }
  }

  function hitProp(a, t) {
    t.hp--; t.dmgT = 0.3;
    Sound.play('crash');
    spark(t.x + rand(-10, 10), GT + t.z - 35, false);
    G.shake = Math.max(G.shake, 3);
    if (t.hp <= 0) {
      for (let i = 0; i < 12; i++) addFx({ k: 'debris', x: t.x, y: GT + t.z - 30, vx: rand(-260, 260), vy: rand(-420, -120), rot: rand(0, 6), vr: rand(-12, 12), life: rand(0.6, 1.1), color: t.type === 'drum' ? '#b91c1c' : '#9a6b33', floor: GT + t.z });
      G.items.push({ type: t.item || 'apple', x: t.x, z: t.z, t: 0 });
      a.score += 50;
    }
  }

  function applyHit(a, t, mv, dmgOverride) {
    const D = DIFF[app.diff];
    let dmg = dmgOverride ?? mv.dmg * (a.kind === 'player' ? a.hero.power : 1);
    if (a.kind === 'enemy' || a.kind === 'proj') dmg *= D.eDmg;
    if (t.kind === 'player') dmg = Math.round(dmg);
    t.hp -= dmg;
    t.flashT = 0.1;
    const dir = Math.sign(t.x - a.x) || a.face || 1;
    const sc = a.look ? (a.look.scale || 1) : 1;
    const hy = a.h + (mv.ry ? (mv.ry[0] + mv.ry[1]) / 2 * sc : 50);
    spark(t.x - dir * t.w * 0.5, GT + t.z - Math.min(hy, t.h + t.tall * 0.9), mv.big || mv.kd);
    Sound.play(mv.sfx || 'punch', !!(mv.big || mv.kd));
    G.freeze = Math.max(G.freeze, mv.kd ? 0.085 : 0.045);
    G.shake = Math.max(G.shake, mv.kd ? 7 : 3);

    const owner = a.kind === 'proj' ? a.owner : a;
    if (owner && owner.kind === 'player') {
      owner.power = Math.min(100, owner.power + dmg * 0.7);
      owner.score += Math.round(dmg * 10);
      owner.combo++; owner.comboT = 1.2;
      owner.lastTarget = t; owner.lastTargetT = 2.5;
      owner.connected = true;
    }
    if (t.kind === 'player') { t.power = Math.min(100, t.power + dmg * 0.4); Sound.play('hurt'); }
    if (t.state === 'held' && t.holder) releaseGrab(t.holder, false);
    if (t.kind === 'player' && t.state === 'grab' && t.grabbed) releaseGrab(t, false);

    const dead = t.hp <= 0;
    let kd = !!mv.kd || dead;
    if (t.kind === 'player') {
      t.recent = t.recent.filter(x => G.time - x < 1.3);
      t.recent.push(G.time);
      if (t.recent.length >= 3) { kd = true; t.recent = []; }
    }
    if (t.boss && !dead) {
      t.poise -= dmg * (mv.kd ? 1.6 : 1);
      if (t.poise > 0) {
        if (t.state !== 'attack' && t.state !== 'charge') setHurt(t, 0.14, dir, 0.3);
        if (t.def.evade && t.state !== 'attack') {
          t.recent = t.recent.filter(x => G.time - x < 1.2); t.recent.push(G.time);
          if (t.recent.length >= 4) { t.recent = []; backflip(t); }
        }
        return;
      }
      t.poise = t.def.poise; kd = true;
    }
    if (kd) knockDown(t, dir, mv.launch || 1);
    else setHurt(t, mv.stun || 0.3, dir, mv.push || 1);
  }

  function endMove(e) {
    e.mv = null;
    if (e.kind === 'enemy') { if (!e.boss) e.token = false; e.cd = (e.boss ? rand(0.35, 0.9) : rand(0.7, 1.7)) / DIFF[app.diff].agg; }
  }
  function setHurt(t, dur, dir, push) {
    endMove(t);
    t.state = 'hurt'; t.st = 0; t.dur = dur; t.vx = dir * 90 * push; t.face = -dir;
    t.hurtPose = Math.random() < 0.5 ? 'hurt' : 'hurt2';
  }
  function knockDown(t, dir, launch) {
    endMove(t);
    t.state = 'fall'; t.st = 0; t.vh = 330 * launch; t.vx = dir * 190; t.h = Math.max(t.h, 2); t.face = -dir; t.bounced = false;
    if (t.kind === 'enemy') t.token = false;
  }
  function backflip(e) {
    endMove(e);
    e.state = 'flip'; e.st = 0; e.vh = 420; e.vx = -e.face * 300; e.h = 2; e.invul = 0.6;
    Sound.play('jump');
  }

  function startMove(e, name) {
    const mv = MOVES[name];
    e.state = 'attack'; e.st = 0; e.mv = mv; e.mvName = name; e.hitSet = new Map(); e.acted = false; e.landed = false;
    if (e.kind === 'player') e.connected = false;
    if (mv.special && e.kind === 'player') e.invul = Math.max(e.invul, mv.su + mv.ac);
  }

  function updateAttack(e, dt, mx) {
    const mv = e.mv;
    e.st += dt;
    const t = e.st, acEnd = mv.su + mv.ac, end = acEnd + mv.rc;
    if (mv.jumpArc) {
      if (t < mv.su) e.h = Math.sin(t / mv.su * Math.PI * 0.5) * mv.jumpArc;
      else if (!e.landed) {
        e.h = 0; e.landed = true;
        Sound.play('shock'); G.shake = Math.max(G.shake, 11); dust(e.x, e.z, 14);
        addFx({ k: 'ring', x: e.x, y: GT + e.z, life: 0.45, r: 110 * (e.look.scale || 1), color: e.kind === 'player' ? '#fde047' : '#f43f5e' });
        if (mv.waves) for (const d of [-1, 1]) G.projs.push({ type: 'wave', x: e.x + d * 30, z: e.z, h: 0, vx: d * 430, life: 0.55, dmg: mv.dmg * 0.6, kd: 1, side: e.kind, owner: e, hit: new Set(), w: 26 });
      }
    }
    if (mv.lift) e.h = Math.sin(clamp(t / acEnd, 0, 1) * Math.PI) * mv.lift;
    if (t >= mv.su && !e.acted) {
      e.acted = true;
      if (!mv.noHit) Sound.play(mv.sfx === 'slash' ? 'slash' : 'swing');
      if (mv.special) Sound.play('special');
      if (mv.spawn) spawnProj(e, mv.spawn);
      if (mv.leap) {
        e.state = 'air'; e.airMv = MOVES[mv.leap.mv]; e.airSt = mv.su; e.vh = mv.leap.vh; e.vx = e.face * mv.leap.vx; e.h = 1; e.mv = null;
        Sound.play('jump');
        return;
      }
    }
    if (t >= mv.su && t < acEnd) {
      if (mv.lunge) e.x += e.face * mv.lunge * dt * (1 - (t - mv.su) / mv.ac * 0.5);
      if (mv.steer && mx) e.x += mx * mv.steer * dt;
      if (mv.ghost && Math.random() < 0.5) addGhost(e);
      if (!mv.noHit) doHits(e, mv);
    }
    if (t >= end) {
      e.h = 0;
      const p = e;
      endMove(e);
      e.state = 'idle'; e.st = 0;
      if (p.kind === 'player') onPlayerMoveEnd(p);
    }
  }

  function addGhost(e) { G.ghosts.push({ x: e.x, z: e.z, h: e.h, face: e.face, look: e.look, pose: poseOf(e), t: 0, life: 0.25 }); }

  function spawnProj(e, kind) {
    const sc = e.look.scale || 1;
    if (kind === 'knives') {
      Sound.play('knife');
      for (const dz of [-26, 0, 26]) G.projs.push({ type: 'knife', x: e.x + e.face * 30, z: clamp(e.z + dz, 0, ZMAX), h: 70 * sc, vx: e.face * 540, life: 2, dmg: 8, kd: 0, side: 'enemy', owner: e, hit: new Set(), w: 14 });
    } else if (kind === 'fire') {
      Sound.play('fire');
      G.projs.push({ type: 'fire', x: e.x + e.face * 50, z: e.z, h: 40, vx: e.face * 340, life: 3, dmg: 14, kd: 1, side: 'enemy', owner: e, hit: new Set(), w: 30 });
    }
  }

  function updateProjs(dt) {
    for (let i = G.projs.length - 1; i >= 0; i--) {
      const pr = G.projs[i];
      pr.x += pr.vx * dt; pr.life -= dt;
      if (pr.type === 'fire' && Math.random() < 0.6) addFx({ k: 'ember', x: pr.x, y: GT + pr.z - pr.h + rand(-14, 14), vx: -pr.vx * 0.2 + rand(-30, 30), vy: rand(-90, -20), life: 0.4, r: rand(3, 7) });
      if (pr.type === 'wave' && Math.random() < 0.7) dust(pr.x, pr.z, 1);
      const targets = pr.side === 'player' ? G.enemies : G.players;
      let gone = false;
      for (const t of targets) {
        if (!canHit(t) || pr.hit.has(t)) continue;
        if (Math.abs(t.z - pr.z) > 20 || Math.abs(t.x - pr.x) > t.w + pr.w) continue;
        if (pr.h > t.h + t.tall || pr.h + 30 < t.h) continue;
        pr.hit.add(t);
        const fake = { kind: 'proj', owner: pr.owner, x: pr.x - Math.sign(pr.vx) * 10, z: pr.z, h: 0, face: Math.sign(pr.vx), look: { scale: 1 } };
        applyHit(fake, t, { dmg: pr.dmg, kd: pr.kd, ry: [pr.h, pr.h + 10], sfx: pr.type === 'knife' ? 'slash' : 'punch', big: pr.type === 'fire' });
        if (pr.type !== 'wave') { gone = true; break; }
      }
      if (gone || pr.life <= 0 || pr.x < G.camX - 200 || pr.x > G.camX + VW + 200) G.projs.splice(i, 1);
    }
  }

  // ---------- grab & throw ----------
  function tryGrab(p, mx) {
    for (const e of G.enemies) {
      if (e.boss || e.h > 0 || !['idle', 'walk', 'hurt'].includes(e.state)) continue;
      if (Math.abs(e.z - p.z) > 12) continue;
      const dx = e.x - p.x;
      if (dx * mx <= 0 || Math.abs(dx) > 38) continue;
      endMove(e);
      p.state = 'grab'; p.st = 0; p.grabbed = e; p.grabT = 0; p.knees = 0; p.kneeT = 0; p.face = Math.sign(dx);
      e.state = 'held'; e.holder = p; e.st = 0;
      Sound.play('grab');
      return true;
    }
    return false;
  }
  function releaseGrab(p, push = true) {
    const e = p.grabbed;
    p.grabbed = null;
    if (p.state === 'grab') { p.state = 'idle'; p.st = 0; }
    if (e && e.state === 'held') { e.holder = null; if (push) setHurt(e, 0.25, p.face, 1.5); else { e.state = 'idle'; } }
  }
  function throwEnemy(p, dir) {
    const e = p.grabbed;
    p.grabbed = null;
    p.face = dir;
    startMove(p, 'throwAnim');
    e.holder = null;
    Object.assign(e, { state: 'thrown', st: 0, x: p.x + dir * 12, h: 30, vx: dir * 420, vh: 300, face: -dir, thrower: p, bounced: false });
    e.token = false;
    Sound.play('throwIt');
  }

  // ---------- players ----------
  function onPlayerMoveEnd(p) {
    p.lastAtkEnd = G.time;
    const hero = p.hero;
    const inCombo = hero.combo.includes(p.mvName) && p.comboIdx >= 0;
    if (p.buffered && inCombo) {
      p.buffered = false;
      const next = p.connected && p.comboIdx + 1 < hero.combo.length ? p.comboIdx + 1 : 0;
      p.comboIdx = next;
      startMove(p, hero.combo[next]);
      return;
    }
    p.buffered = false;
    if (p.comboIdx === hero.combo.length - 1) p.comboIdx = -1;
  }

  function updatePlayer(p, dt) {
    const inp = Input.get(p.idx);
    const c = inp.cur, hit = inp.hit;
    const mx = (c.right ? 1 : 0) - (c.left ? 1 : 0), mz = (c.down ? 1 : 0) - (c.up ? 1 : 0);
    p.st += dt;
    if (p.invul > 0) p.invul -= dt;
    if (p.comboT > 0) { p.comboT -= dt; if (p.comboT <= 0) p.combo = 0; }
    if (p.lastTargetT > 0) p.lastTargetT -= dt;
    if (hit.left) { if (G.time - p.tapL < 0.26) p.running = true; p.tapL = G.time; }
    if (hit.right) { if (G.time - p.tapR < 0.26) p.running = true; p.tapR = G.time; }
    if (!mx) p.running = false;

    switch (p.state) {
      case 'idle': case 'walk': case 'run': {
        if (hit.spc) { doSpecial(p); break; }
        if (hit.jump) {
          p.state = 'air'; p.st = 0; p.vh = 440; p.h = 1; p.airMv = null; p.airUsed = false;
          p.vx = mx * p.hero.spd * (p.running ? 1.45 : 1); p.vz = mz * p.hero.spd * 0.5;
          Sound.play('jump');
          break;
        }
        if (hit.atk) {
          if (p.running) { p.running = false; startMove(p, p.hero.dash); break; }
          const cont = G.time - p.lastAtkEnd < 0.4 && p.connected && p.comboIdx >= 0 && p.comboIdx + 1 < p.hero.combo.length;
          p.comboIdx = cont ? p.comboIdx + 1 : 0;
          startMove(p, p.hero.combo[p.comboIdx]);
          break;
        }
        if (mx && tryGrab(p, mx)) break;
        const sp = p.hero.spd * (p.running ? 1.75 : 1);
        p.x += mx * sp * dt; p.z += mz * sp * 0.62 * dt;
        if (mx) p.face = mx;
        p.state = mx || mz ? (p.running ? 'run' : 'walk') : 'idle';
        if (p.state !== 'idle') p.walkT += dt;
        if (p.running && Math.random() < 0.15) dust(p.x - p.face * 10, p.z, 1);
        break;
      }
      case 'attack':
        if (hit.atk && p.st > p.mv.su * 0.5) p.buffered = true;
        updateAttack(p, dt, mx);
        break;
      case 'air': updateAir(p, dt, hit.atk); break;
      case 'grab': {
        const e = p.grabbed;
        if (!e || e.state !== 'held') { releaseGrab(p); break; }
        p.grabT += dt;
        if (p.kneeT > 0) p.kneeT -= dt;
        e.x = p.x + p.face * 32; e.z = p.z; e.face = -p.face;
        if (hit.jump || (hit.atk && mx === -p.face)) { throwEnemy(p, mx === -p.face ? -p.face : p.face); break; }
        if (hit.atk && p.kneeT <= 0) {
          p.kneeT = 0.18; p.knees++;
          Sound.play('kick');
          applyHitHeld(p, e, MOVES.knee);
          if (e.hp <= 0) break;
          if (p.knees >= 3) throwEnemy(p, p.face);
          break;
        }
        if (p.grabT > 1.8) releaseGrab(p);
        break;
      }
      default: updateCommon(p, dt);
    }
    // keep inside the screen and the street
    p.z = clamp(p.z, 0, ZMAX);
    p.x = clamp(p.x, G.camX + 24, G.camX + VW - 24);
  }

  // knees on a held enemy: damage without breaking the hold unless they drop
  function applyHitHeld(p, e, mv) {
    let dmg = mv.dmg * p.hero.power;
    e.hp -= dmg; e.flashT = 0.1;
    p.power = Math.min(100, p.power + dmg * 0.7); p.score += Math.round(dmg * 10);
    p.combo++; p.comboT = 1.2; p.lastTarget = e; p.lastTargetT = 2.5;
    spark(e.x - p.face * 6, GT + e.z - 50, false);
    G.freeze = Math.max(G.freeze, 0.05); G.shake = Math.max(G.shake, 3);
    if (e.hp <= 0) { p.grabbed = null; p.state = 'idle'; e.holder = null; knockDown(e, p.face, 1); }
  }

  function doSpecial(p) {
    if (p.power >= 100) { doSuper(p); return; }
    const cost = Math.round(p.maxHp * 0.06);
    if (p.hp <= cost + 1) { popText(p.x, GT + p.z - 110, 'LOW HP!', '#f87171', 16); return; }
    p.hp -= cost;
    startMove(p, p.hero.special);
  }

  function doSuper(p) {
    p.power = 0;
    G.superT = 1.1; G.superBy = p; G.flash = 1;
    p.state = 'attack'; startMove(p, 'throwAnim'); p.mv = Object.assign({}, MOVES.throwAnim, { pose: 'victory', su: 0.2, ac: 0.6, rc: 0.3 });
    p.invul = 2;
    Sound.play('superMove');
    popText(p.x, GT + p.z - 130, 'SUPER!', '#f472b6', 40);
  }
  function superStrike() {
    const p = G.superBy;
    for (const e of G.enemies) {
      if (!canHit(e) || e.x < G.camX - 20 || e.x > G.camX + VW + 20) continue;
      e.poise = 0;
      applyHit(p, e, { dmg: e.boss ? 40 : 60, kd: 1, launch: 1.4, ry: [40, 90], big: 1 });
    }
    G.shake = 16;
    for (let i = 0; i < 6; i++) addFx({ k: 'ring', x: G.camX + rand(100, VW - 100), y: GT + rand(20, 180), life: 0.5, r: rand(80, 160), color: pick(['#f472b6', '#38bdf8', '#fde047']) });
  }

  function updateAir(e, dt, atkHit) {
    e.st += dt;
    e.h += e.vh * dt; e.vh -= GRAV * dt;
    e.x += e.vx * dt; e.z = clamp(e.z + (e.vz || 0) * dt, 0, ZMAX);
    if (e.kind === 'player' && atkHit && !e.airUsed) { e.airUsed = true; e.airMv = MOVES[e.hero.air]; e.airSt = 0; e.hitSet = new Map(); Sound.play('swing'); }
    if (e.airMv) {
      e.airSt = (e.airSt || 0) + dt;
      if (e.airSt >= e.airMv.su) doHits(e, e.airMv);
    }
    if (e.h <= 0 && e.vh < 0) {
      e.h = 0; e.vh = 0; e.vx = 0; e.vz = 0; e.airMv = null;
      e.state = 'idle'; e.st = 0;
      dust(e.x, e.z, 3); Sound.play('land');
      if (e.kind === 'enemy') endMove(e);
    }
  }

  // states shared by players and enemies
  function updateCommon(e, dt) {
    switch (e.state) {
      case 'hurt':
        e.st += dt; e.x += e.vx * dt; e.vx *= 1 - 8 * dt;
        if (e.st > e.dur) { e.state = 'idle'; e.st = 0; }
        break;
      case 'fall': case 'thrown': case 'flip': {
        e.st += dt;
        e.h += e.vh * dt; e.vh -= GRAV * dt; e.x += e.vx * dt;
        if (e.state === 'thrown') {
          for (const o of G.enemies) {
            if (o === e || !canHit(o) || Math.abs(o.z - e.z) > 22 || Math.abs(o.x - e.x) > 40 || e.h > 90) continue;
            applyHit({ kind: 'proj', owner: e.thrower, x: e.x - Math.sign(e.vx) * 5, z: e.z, h: 0, face: Math.sign(e.vx), look: { scale: 1 } }, o, { dmg: 15, kd: 1, ry: [20, 60], big: 1 });
          }
        }
        if (e.h <= 0 && e.vh < 0) {
          e.h = 0;
          if (e.state === 'flip') { e.state = 'idle'; e.st = 0; e.vx = 0; dust(e.x, e.z, 4); break; }
          if (!e.bounced && e.vh < -250) {
            e.bounced = true; e.vh = -e.vh * 0.3; e.vx *= 0.5; e.h = 1;
            Sound.play('thud'); dust(e.x, e.z, 8); G.shake = Math.max(G.shake, 4);
            if (e.state === 'thrown') {
              const thr = e.thrower;
              e.hp -= 22 * (thr ? thr.hero.power : 1);
              if (thr) { thr.score += 220; thr.power = Math.min(100, thr.power + 14); thr.lastTarget = e; thr.lastTargetT = 2.5; }
              e.state = 'fall';
            }
          } else {
            e.vh = 0; e.vx = 0; e.state = 'down'; e.st = 0;
          }
        }
        break;
      }
      case 'down':
        e.st += dt;
        if (e.st > (e.kind === 'player' ? 0.6 : 0.8)) {
          if (e.hp <= 0) { e.state = e.kind === 'player' ? 'dead' : 'dying'; e.st = 0; if (e.kind === 'enemy') onEnemyKO(e); else onPlayerKO(e); }
          else { e.state = 'getup'; e.st = 0; }
        }
        break;
      case 'getup':
        e.st += dt;
        if (e.st > 0.4) { e.state = 'idle'; e.st = 0; e.invul = e.kind === 'player' ? 1.1 : 0.3; }
        break;
      case 'dying':
        e.st += dt;
        break;
      case 'dead':
        e.st += dt;
        if (e.st > 1.2) respawn(e);
        break;
      case 'respawn':
        e.h += e.vh * dt; e.vh -= GRAV * dt;
        if (e.h <= 0) { e.h = 0; e.state = 'idle'; e.st = 0; dust(e.x, e.z, 10); Sound.play('land'); }
        break;
      case 'held':
        if (!e.holder) { e.state = 'idle'; e.st = 0; }
        break;
      case 'victory':
        e.st += dt;
        break;
    }
  }

  function onPlayerKO(p) {
    p.lives--;
    Sound.play('ko');
  }
  function respawn(p) {
    if (p.lives < 0) {
      p.out = true;
      if (!alivePlayers().length) showContinue();
      return;
    }
    Object.assign(p, { hp: p.maxHp, state: 'respawn', st: 0, h: 380, vh: 0, x: G.camX + 160 + p.idx * 60, z: 90, invul: 2.5, recent: [] });
  }

  // ---------- enemies ----------
  function tryToken(e) {
    if (e.token || e.boss) return true;
    if (e.cd > 0) return false;
    const n = G.enemies.filter(o => o.token && !o.boss).length;
    if (n < DIFF[app.diff].tokens + (app.players === 2 ? 1 : 0)) { e.token = true; return true; }
    return false;
  }

  function updateEnemy(e, dt) {
    if (e.invul > 0) e.invul -= dt;
    if (e.state === 'attack') { updateAttack(e, dt, 0); return; }
    if (e.state === 'air') { updateAir(e, dt, false); return; }
    if (e.state === 'charge') { updateCharge(e, dt); return; }
    if (e.state === 'telegraph') {
      e.st += dt;
      if (e.st > 0.55) { e.state = 'charge'; e.st = 0; Sound.play('roar'); }
      return;
    }
    if (!['idle', 'walk'].includes(e.state)) { updateCommon(e, dt); return; }

    // boss walks in during its intro
    if (e.boss && G.bossPhase === 'intro') {
      const tx = G.camX + VW - 200;
      if (e.x > tx) { e.x -= 90 * dt; e.state = 'walk'; e.walkT += dt; e.face = -1; } else { e.state = 'idle'; e.face = -1; }
      return;
    }
    const tgt = nearestPlayer(e);
    if (!tgt) { e.state = 'idle'; return; }
    e.cd -= dt;
    const dx = tgt.x - e.x, dz = tgt.z - e.z, adx = Math.abs(dx);
    const def = e.def;
    e.face = dx >= 0 ? 1 : -1;

    if (e.boss) bossThink(e, tgt, dt);
    if (e.state !== 'idle' && e.state !== 'walk') return;

    if (def.charge && e.cd <= 0 && adx > 230 && Math.abs(dz) < 50 && Math.random() < dt * (e.boss ? 1.2 : 0.5)) {
      e.state = 'telegraph'; e.st = 0; e.token = true;
      popText(e.x, GT + e.z - e.tall - 20, '!', '#f87171', 34);
      return;
    }
    const side = e.x < tgt.x ? -1 : 1;
    const engage = tryToken(e);
    const wantX = engage ? tgt.x + side * def.reach * 0.8 * (e.look.scale || 1) : tgt.x + side * (150 + e.hoverOff);
    const wantZ = engage ? tgt.z : clamp(tgt.z + e.zOff, 0, ZMAX);
    let mx = wantX - e.x, mz = wantZ - e.z;
    const dist = Math.hypot(mx, mz);
    const spd = def.spd * (engage ? 1 : 0.7);
    if (dist > 6) {
      e.x += mx / dist * spd * dt; e.z += mz / dist * spd * 0.7 * dt;
      e.state = 'walk'; e.walkT += dt;
    } else e.state = 'idle';
    // gentle separation so enemies don't stack
    for (const o of G.enemies) {
      if (o === e || o.state === 'dying') continue;
      const sx = e.x - o.x, sz = e.z - o.z;
      if (Math.abs(sx) < 30 && Math.abs(sz) < 14) { e.z += (sz >= 0 ? 1 : -1) * 40 * dt; e.x += (sx >= 0 ? 1 : -1) * 20 * dt; }
    }
    e.z = clamp(e.z, 0, ZMAX);
    const reach = def.reach * (e.look.scale || 1);
    if (engage && e.cd <= 0 && adx < reach + 12 && Math.abs(dz) < 14 && !NOHIT.has(tgt.state)) {
      const melee = def.moves.filter(m => !MOVES[m].ranged);
      startMove(e, pick(melee));
    }
  }

  function bossThink(e, tgt, dt) {
    const def = e.def, adx = Math.abs(tgt.x - e.x), dz = Math.abs(tgt.z - e.z);
    if (def.summon) {
      const r = e.hp / e.maxHp;
      if (r < 0.66 && !e.summoned[0]) { e.summoned[0] = true; summon(['thug', 'slasher']); }
      if (r < 0.33 && !e.summoned[1]) { e.summoned[1] = true; summon(['kicker', 'bruiser']); }
    }
    if (e.cd > 0) return;
    if (def.moves.includes('knives') && adx > 180 && Math.random() < dt * 1.5) { e.face = Math.sign(tgt.x - e.x) || 1; startMove(e, 'knives'); return; }
    if (def.moves.includes('fire') && adx > 200 && dz < 30 && Math.random() < dt * 1.3) { e.face = Math.sign(tgt.x - e.x) || 1; startMove(e, 'fire'); return; }
    if (def.moves.includes('dashSlash') && adx > 140 && adx < 420 && dz < 16 && Math.random() < dt * 1.1) { e.face = Math.sign(tgt.x - e.x) || 1; startMove(e, 'dashSlash'); return; }
    if (def.moves.includes('bossSmash') && adx < 120 && dz < 40 && Math.random() < dt * 0.7) { startMove(e, 'bossSmash'); }
  }

  function summon(types) {
    Sound.play('roar');
    types.forEach((t, i) => {
      const e = makeEnemy(t, i ? G.camX + VW + 60 : G.camX - 60, rand(20, ZMAX - 20));
      G.enemies.push(e);
    });
  }

  function updateCharge(e, dt) {
    e.st += dt;
    const sp = e.def.charge;
    e.x += e.face * sp * dt; e.walkT += dt * 1.5;
    if (Math.random() < 0.4) dust(e.x - e.face * 20, e.z, 1);
    if (!e.hitSet || e.st < dt * 1.5) e.hitSet = new Map();
    doHits(e, { rx: [-10, 50], ry: [10, 100], dmg: 14, kd: 1, big: 1 });
    const edge = e.face > 0 ? e.x > G.camX + VW - 40 : e.x < G.camX + 40;
    if (e.st > 1.6 || edge) {
      e.state = 'idle'; e.st = 0; e.token = false; e.cd = rand(0.8, 1.6);
      if (edge) { G.shake = Math.max(G.shake, 6); Sound.play('thud'); setHurt(e, 0.6, -e.face, 0.3); }
    }
  }

  function onEnemyKO(e) {
    const killer = G.players.find(p => p.lastTarget === e) || G.players[0];
    if (killer) killer.score += e.def.score;
    popText(e.x, GT + e.z - 60, '+' + e.def.score, '#fde047', 20);
    if (!e.boss && Math.random() < 0.14) G.items.push({ type: pick(['apple', 'apple', 'burger', 'coin']), x: e.x, z: e.z, t: 0 });
    if (e.boss) bossDefeated(e);
  }

  // ---------- waves, camera, boss ----------
  function updateDirector(dt) {
    const st = G.stage, pl = alivePlayers().filter(p => p.state !== 'dead');
    G.enemies = G.enemies.filter(e => !(e.state === 'dying' && e.st > 0.9));
    if (!G.locked && G.bossPhase === 'none' && pl.length) {
      const wave = st.waves[G.waveIdx];
      const maxCam = wave ? wave.at : st.bossAt;
      const avg = pl.reduce((s, p) => s + p.x, 0) / pl.length;
      const minX = Math.min(...pl.map(p => p.x));
      let target = Math.min(avg - VW * 0.42, minX - 40, maxCam);
      if (target > G.camX) G.camX += (target - G.camX) * Math.min(1, dt * 5);
      if (G.camX >= maxCam - 2) {
        G.camX = maxCam;
        if (wave) {
          G.locked = true;
          G.queue = wave.list.slice();
          if (app.players === 2) G.queue.push(pick(['thug', 'slasher']));
          G.goT = 0;
        } else startBoss();
      }
    }
    if (G.locked && G.bossPhase === 'none') {
      const alive = G.enemies.filter(e => e.state !== 'dying').length;
      const maxAlive = app.players === 2 ? 4 : 3;
      if (G.queue.length && alive < maxAlive) {
        const type = G.queue.shift();
        const fromLeft = Math.random() < 0.35;
        G.enemies.push(makeEnemy(type, fromLeft ? G.camX - 50 : G.camX + VW + 50, rand(10, ZMAX - 10)));
      }
      if (!G.queue.length && !alive) {
        G.locked = false; G.waveIdx++; G.goT = 3;
        Sound.play('go');
      }
    }
    if (G.goT > 0) G.goT -= dt;
    if (G.bossPhase === 'intro') {
      G.bossIntroT -= dt;
      if (G.bossIntroT <= 0) G.bossPhase = 'fight';
    }
  }

  function startBoss() {
    G.locked = true; G.bossPhase = 'intro'; G.bossIntroT = 2.6;
    const b = makeEnemy(G.stage.boss, G.camX + VW + 80, ZMAX / 2);
    b.face = -1;
    G.boss = b; G.enemies.push(b);
    Sound.music('boss'); Sound.play('roar');
    showCard('Boss', b.def.name, b.def.title, true);
    $('#bossName').textContent = b.def.name; $('#bossTitle').textContent = b.def.title;
    $('#bossBar').classList.remove('hidden');
    G.shake = 8;
  }

  function bossDefeated(b) {
    G.bossPhase = 'dead';
    for (const e of G.enemies) if (e !== b && e.state !== 'dying') { e.hp = 0; knockDown(e, Math.sign(e.x - b.x) || 1, 1); }
    G.slow = 1.6;
    G.flash = 0.8;
    setTimeout(() => {
      if (!G || G.bossPhase !== 'dead') return;
      for (const p of alivePlayers()) if (p.state !== 'dead') { p.state = 'victory'; p.st = 0; }
      Sound.stopMusic(); Sound.play('clear');
    }, 1300);
    setTimeout(showClear, 3200);
  }

  // ---------- items ----------
  function updateItems(dt) {
    for (let i = G.items.length - 1; i >= 0; i--) {
      const it = G.items[i];
      it.t += dt;
      for (const p of alivePlayers()) {
        if (p.h > 4 || NOHIT.has(p.state) || Math.abs(p.x - it.x) > 28 || Math.abs(p.z - it.z) > 16) continue;
        const d = ITEMS[it.type];
        if (d.heal) {
          const before = p.hp; p.hp = Math.min(p.maxHp, p.hp + d.heal);
          popText(it.x, GT + it.z - 50, `+${Math.round(p.hp - before)} HP`, '#4ade80', 20);
          Sound.play('pickup');
        } else {
          p.score += d.score; popText(it.x, GT + it.z - 50, '+' + d.score, '#fde047', 20);
          Sound.play('coin');
        }
        G.items.splice(i, 1);
        break;
      }
    }
  }

  // ---------- poses ----------
  function attackPose(e) {
    const mv = e.mv, t = e.st, acEnd = mv.su + mv.ac;
    const strike = P[mv.pose], pre = P[mv.pre || 'idle'];
    if (t < mv.su) {
      const k = t / mv.su;
      if (!mv.pre) return Art.lerpPose(P.idle, strike, k);
      return k < 0.6 ? Art.lerpPose(P.idle, pre, k / 0.6) : Art.lerpPose(pre, strike, (k - 0.6) / 0.4);
    }
    if (t < acEnd) return strike;
    return Art.lerpPose(strike, P.idle, clamp((t - acEnd) / mv.rc, 0, 1));
  }

  function poseOf(e) {
    switch (e.state) {
      case 'idle': { const p = Object.assign({}, P.idle); p.hipY += Math.sin(G.time * 3 + e.id) * 1.2; p.aF += Math.sin(G.time * 3 + e.id) * 0.04; return p; }
      case 'walk': return Art.lerpPose(P.walkA, P.walkB, (Math.sin(e.walkT * 10) + 1) / 2);
      case 'run': return Art.lerpPose(P.runA, P.runB, (Math.sin(e.walkT * 16) + 1) / 2);
      case 'charge': return Art.lerpPose(P.charge, P.runB, (Math.sin(e.walkT * 18) + 1) / 4);
      case 'telegraph': return P.taunt;
      case 'attack': return attackPose(e);
      case 'air': return e.airMv ? (e.airSt < e.airMv.su ? Art.lerpPose(P.jump, P[e.airMv.pose], e.airSt / e.airMv.su) : P[e.airMv.pose]) : P.jump;
      case 'respawn': return P.jump;
      case 'flip': { const p = Object.assign({}, P.jump); p.rot = -e.st * 11; p.air = 1; return p; }
      case 'hurt': return P[e.hurtPose || 'hurt'];
      case 'held': return P.hurt2;
      case 'fall': return P.fall;
      case 'thrown': { const p = Object.assign({}, P.fall); p.rot = -e.st * 13; return p; }
      case 'down': case 'dying': case 'dead': return P.down;
      case 'getup': return Art.lerpPose(P.getup, P.idle, clamp(e.st / 0.4, 0, 1) * 0.5);
      case 'grab': return e.kneeT > 0 ? P.knee : P.grabHold;
      case 'victory': return Art.lerpPose(P.idle, P.victory, clamp(e.st / 0.3, 0, 1));
    }
    return P.idle;
  }

  // ---------- update ----------
  function update(dt) {
    app.time += dt;
    if (app.state === 'title' || app.state === 'select') { app.titleCam += dt * 40; return; }
    if (app.state !== 'play') return;
    if (Input.anyHit('start') && !app.eat) { pause(); return; }

    if (G.slow > 0) { G.slow -= dt; dt *= 0.3; }
    G.time += dt;
    if (G.flash > 0) G.flash -= dt * 2;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 40);
    updateFx(dt);

    if (G.superT > 0) {
      const before = G.superT;
      G.superT -= dt;
      if (before > 0.5 && G.superT <= 0.5) superStrike();
      if (G.superBy) updateAttack(G.superBy, dt, 0);
      return;
    }
    if (G.freeze > 0) { G.freeze -= dt; return; }

    G.stageTime += dt;
    for (const p of G.players) if (!p.out) updatePlayer(p, dt);
    for (const e of G.enemies) {
      if (e.flashT > 0) e.flashT -= dt;
      updateEnemy(e, dt);
      const lo = G.locked ? G.camX + 20 : G.camX - 140, hi = G.locked ? G.camX + VW - 20 : G.camX + VW + 140;
      if (!e.enter) e.x = clamp(e.x, lo, hi);
      else if (e.x > G.camX + 30 && e.x < G.camX + VW - 30) e.enter = false;
    }
    for (const p of G.players) if (p.flashT > 0) p.flashT -= dt;
    for (const pr of G.props) if (pr.dmgT > 0) pr.dmgT -= dt;
    G.props = G.props.filter(pr => pr.hp > 0);
    updateProjs(dt);
    updateItems(dt);
    updateDirector(dt);
    updateHud();
  }

  function updateFx(dt) {
    for (let i = G.fx.length - 1; i >= 0; i--) {
      const f = G.fx[i];
      f.t += dt;
      if (f.k === 'bit' || f.k === 'ember') { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 1 - 5 * dt; f.vy *= 1 - 5 * dt; }
      else if (f.k === 'debris') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 1400 * dt; f.rot += f.vr * dt; if (f.y > f.floor) { f.y = f.floor; f.vy *= -0.3; f.vx *= 0.6; } }
      else if (f.k === 'dust') { f.x += f.vx * dt; }
      if (f.t > f.life) G.fx.splice(i, 1);
    }
    for (let i = G.ghosts.length - 1; i >= 0; i--) { G.ghosts[i].t += dt; if (G.ghosts[i].t > G.ghosts[i].life) G.ghosts.splice(i, 1); }
  }

  // ---------- render ----------
  let K = 1;
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const s = Math.min(innerWidth / VW, innerHeight / VH);
    const w = Math.floor(VW * s), h = Math.floor(VH * s);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    K = cv.width / VW;
    // keep the HUD inside the letterboxed game area
    const left = (innerWidth - w) / 2 + 'px', top = (innerHeight - h) / 2 + 'px';
    Object.assign($('#hud').style, { left, top, width: w + 'px', right: 'auto' });
    Object.assign($('#btns').style, { right: `calc(${left} + 14px)`, bottom: `calc(${top} + 12px)` });
    Object.assign($('#bossBar').style, { bottom: `calc(${top} + 22px)` });
  }

  function drawShadow(x, z, h, r) {
    const k = Math.max(0.4, 1 - h / 300);
    ctx.fillStyle = `rgba(0,0,0,${0.35 * k})`;
    ctx.beginPath(); ctx.ellipse(x, GT + z, r * k, r * 0.32 * k, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawEntity(e, cam) {
    const sx = e.x - cam, sy = GT + e.z - e.h;
    if (e.kind === 'prop') { Art.drawProp(ctx, e.type, sx, sy, e.dmgT > 0 ? e.dmgT : 0); return; }
    if (e.state === 'dying' && Math.floor(e.st * 14) % 2) return;
    let face = e.face;
    const mv = e.mv;
    if (e.state === 'attack' && mv && mv.spin && e.st >= mv.su && e.st < mv.su + mv.ac) face *= Math.floor(e.st / 0.06) % 2 ? -1 : 1;
    const o = { flash: e.flashT > 0, t: G ? G.time : app.time, hurt: ['hurt', 'held', 'fall', 'thrown', 'down', 'dying', 'dead'].includes(e.state) };
    if (e.kind === 'player' && e.invul > 0 && e.state !== 'attack' && Math.floor(G.time * 18) % 2) o.alpha = 0.4;
    const pose = poseOf(e);
    if (e.state === 'attack' && mv && mv.spin && e.st >= mv.su && e.st < mv.su + mv.ac) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = e.kind === 'player' ? '#fde047' : '#f43f5e';
      ctx.lineWidth = 6;
      const r = mv.rx[1] * (e.look.scale || 1);
      ctx.beginPath(); ctx.ellipse(sx, sy - 70, r, r * 0.28, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    Art.drawFighter(ctx, sx, sy, e.look, pose, face, o);
    if (e.kind === 'player' && app.players === 2 && e.state !== 'dead') {
      ctx.font = '16px Bangers, Impact'; ctx.textAlign = 'center';
      ctx.fillStyle = e.idx ? '#fb7185' : '#38bdf8';
      ctx.fillText(e.idx ? 'P2' : 'P1', sx, sy - e.tall - 18);
    }
    if (e.state === 'telegraph') {
      ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(G.time * 30);
      ctx.fillStyle = '#ef4444'; ctx.font = '36px Bangers, Impact'; ctx.textAlign = 'center';
      ctx.fillText('!', sx, sy - e.tall - 30); ctx.restore();
    }
  }

  function drawProj(pr, cam) {
    const sx = pr.x - cam, sy = GT + pr.z - pr.h;
    drawShadow(sx, pr.z, pr.h, pr.w * 0.8);
    if (pr.type === 'knife') {
      ctx.save(); ctx.translate(sx, sy); ctx.scale(Math.sign(pr.vx), 1); ctx.rotate(G.time * 30);
      ctx.strokeStyle = '#140d1c'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
      ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
    } else if (pr.type === 'fire') {
      const g = ctx.createRadialGradient(sx, sy, 4, sx, sy, 40);
      g.addColorStop(0, '#fff7c2'); g.addColorStop(0.35, '#fb923c'); g.addColorStop(1, 'rgba(239,68,68,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, 40 + Math.sin(G.time * 30) * 4, 0, Math.PI * 2); ctx.fill();
    } else if (pr.type === 'wave') {
      ctx.save(); ctx.globalAlpha = pr.life / 0.55;
      const g = ctx.createLinearGradient(sx, sy - 50, sx, sy);
      g.addColorStop(0, 'rgba(253,224,71,0)'); g.addColorStop(1, pr.side === 'player' ? 'rgba(253,224,71,.85)' : 'rgba(244,63,94,.85)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(sx - 26, sy); ctx.quadraticCurveTo(sx, sy - 60, sx + 26, sy); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function drawFx(cam, layer) {
    for (const f of G.fx) {
      const k = f.t / f.life;
      if (layer === 'ground' && f.k !== 'dust' && f.k !== 'ring') continue;
      if (layer === 'top' && (f.k === 'dust' || f.k === 'ring')) continue;
      const x = f.x - cam;
      switch (f.k) {
        case 'dust':
          ctx.fillStyle = `rgba(220,210,230,${0.35 * (1 - k)})`;
          ctx.beginPath(); ctx.ellipse(x, GT + f.z - 6 - k * 10, f.r * (1 + k), f.r * 0.6 * (1 + k), 0, 0, Math.PI * 2); ctx.fill();
          break;
        case 'ring':
          ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.color; ctx.lineWidth = 6 * (1 - k) + 1;
          ctx.beginPath(); ctx.ellipse(x, f.y, f.r * (0.3 + k), f.r * 0.3 * (0.3 + k), 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
          break;
        case 'spark': {
          ctx.save(); ctx.translate(x, f.y); ctx.rotate(f.rot);
          const r = (f.big ? 38 : 24) * (0.6 + k * 0.6);
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = f.big ? '#fde047' : '#fff';
          ctx.beginPath();
          for (let i = 0; i <= 16; i++) {
            const a = i / 16 * Math.PI * 2, rr = i % 2 ? r * 0.35 : r;
            i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          ctx.fill();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          break;
        }
        case 'bit': case 'ember':
          ctx.globalAlpha = 1 - k; ctx.fillStyle = f.k === 'ember' ? pick(['#fb923c', '#fde047', '#ef4444']) : f.color;
          ctx.beginPath(); ctx.arc(x, f.y, f.r * (f.k === 'ember' ? 1 - k : 1), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
          break;
        case 'debris':
          ctx.save(); ctx.translate(x, f.y); ctx.rotate(f.rot); ctx.globalAlpha = Math.min(1, (1 - k) * 2);
          ctx.fillStyle = f.color; ctx.fillRect(-6, -3, 12, 6); ctx.strokeStyle = '#140d1c'; ctx.lineWidth = 1.5; ctx.strokeRect(-6, -3, 12, 6);
          ctx.restore();
          break;
        case 'text':
          ctx.save(); ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
          ctx.font = `${f.size}px Bangers, Impact`; ctx.textAlign = 'center';
          ctx.lineWidth = 4; ctx.strokeStyle = '#140d1c'; ctx.strokeText(f.text, x, f.y - k * 40);
          ctx.fillStyle = f.color; ctx.fillText(f.text, x, f.y - k * 40);
          ctx.restore();
          break;
      }
    }
  }

  function render() {
    ctx.setTransform(K, 0, 0, K, 0, 0);
    if (app.state === 'title' || app.state === 'select' || !G) { renderTitle(); return; }
    const cam = Math.round(G.camX);
    const sh = G.shake;
    ctx.save();
    if (sh) ctx.translate(rand(-sh, sh), rand(-sh, sh) * 0.6);
    Art.drawStage(ctx, G.stage.theme, cam, G.time);
    drawFx(cam, 'ground');

    const ents = [];
    for (const p of G.players) if (!p.out) ents.push(p);
    for (const e of G.enemies) ents.push(e);
    for (const pr of G.props) ents.push(pr);
    for (const e of ents) if (e.kind !== 'prop') drawShadow(e.x - cam, e.z, e.h, e.w * 1.4);
    for (const pr of G.props) drawShadow(pr.x - cam, pr.z, 0, 30);
    for (const it of G.items) { drawShadow(it.x - cam, it.z, 0, 14); }
    for (const it of G.items) Art.drawItem(ctx, it.type, it.x - cam, GT + it.z, it.t);
    for (const g of G.ghosts) Art.drawFighter(ctx, g.x - cam, GT + g.z - g.h, g.look, g.pose, g.face, { alpha: 0.35 * (1 - g.t / g.life), t: G.time });
    ents.sort((a, b) => a.z - b.z);
    for (const e of ents) drawEntity(e, cam);
    for (const pr of G.projs) drawProj(pr, cam);
    drawFx(cam, 'top');

    // GO arrow
    if (G.goT > 0 && !G.locked && Math.floor(G.time * 3) % 2) {
      ctx.save();
      ctx.font = '54px Bangers, Impact'; ctx.textAlign = 'right';
      ctx.lineWidth = 6; ctx.strokeStyle = '#140d1c'; ctx.fillStyle = '#fde047';
      ctx.strokeText('GO ➜', VW - 30, 200); ctx.fillText('GO ➜', VW - 30, 200);
      ctx.restore();
    }
    ctx.restore();

    if (G.superT > 0) {
      const k = G.superT;
      ctx.fillStyle = `rgba(20,0,40,${Math.min(0.6, k)})`; ctx.fillRect(0, 0, VW, VH);
      if (G.superBy) drawEntity(G.superBy, cam);
      ctx.save();
      ctx.font = '96px Bangers, Impact'; ctx.textAlign = 'center';
      ctx.lineWidth = 8; ctx.strokeStyle = '#140d1c';
      const g = ctx.createLinearGradient(0, 220, 0, 300); g.addColorStop(0, '#fef08a'); g.addColorStop(1, '#f43f5e');
      ctx.fillStyle = g;
      const txt = 'SUPER ' + (G.superBy ? G.superBy.hero.name : '') + '!';
      ctx.globalAlpha = Math.min(1, (1.1 - k) * 5);
      ctx.strokeText(txt, VW / 2, 290); ctx.fillText(txt, VW / 2, 290);
      ctx.restore();
    }
    if (G.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, G.flash)})`; ctx.fillRect(0, 0, VW, VH); }
  }

  function renderTitle() {
    Art.drawStage(ctx, 'downtown', app.titleCam, app.time);
    if (app.state === 'title') {
      const xs = [330, 480, 630];
      HEROES.forEach((h, i) => {
        const pose = i === 1 ? Art.lerpPose(P.idle, P.victory, (Math.sin(app.time * 2) + 1) / 2) : Object.assign({}, P.idle, { hipY: Math.sin(app.time * 3 + i) * 1.5 });
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(xs[i], 505, 40, 12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.translate(xs[i], 505); ctx.scale(1.35, 1.35);
        Art.drawFighter(ctx, 0, 0, h.look, pose, i === 0 ? 1 : i === 2 ? -1 : 1, { t: app.time });
        ctx.restore();
      });
    }
  }

  // ---------- HUD ----------
  function drawFace(canvas, look) {
    const d = Math.min(2, devicePixelRatio || 1), w = 52;
    canvas.width = canvas.height = w * d;
    const c = canvas.getContext('2d');
    c.setTransform(d, 0, 0, d, 0, 0);
    c.save(); c.translate(22, 196); c.scale(1.7 / (look.scale || 1), 1.7 / (look.scale || 1));
    Art.drawFighter(c, 0, 0, look, P.idle, 1, { t: 0 });
    c.restore();
  }

  function refreshHudStatic() {
    for (let i = 0; i < 2; i++) {
      const el = $('#ph' + i), p = G.players[i];
      el.classList.toggle('hidden', !p);
      if (!p) continue;
      el.querySelector('.nm').textContent = p.hero.name;
      drawFace(el.querySelector('.face'), p.hero.look);
    }
  }
  const hudCache = {};
  function setW(el, key, v) { if (hudCache[key] !== v) { hudCache[key] = v; el.style.width = v; } }
  function setT(el, key, v) { if (hudCache[key] !== v) { hudCache[key] = v; el.textContent = v; } }
  function updateHud() {
    G.players.forEach((p, i) => {
      const el = $('#ph' + i);
      const hp = Math.max(0, p.hp / p.maxHp);
      const fill = el.querySelector('.hp .fill');
      setW(fill, 'hp' + i, (hp * 100).toFixed(1) + '%');
      setW(el.querySelector('.hp .lag'), 'lag' + i, (hp * 100).toFixed(1) + '%');
      fill.classList.toggle('low', hp < 0.25);
      setW(el.querySelector('.pw i'), 'pw' + i, p.power.toFixed(0) + '%');
      el.querySelector('.pw').classList.toggle('full', p.power >= 100);
      setT(el.querySelector('.sc'), 'sc' + i, String(p.score).padStart(6, '0'));
      setT(el.querySelector('.lives'), 'lv' + i, p.out ? 'OUT' : '♥'.repeat(Math.max(0, p.lives)));
      const cb = el.querySelector('.combo');
      const txt = p.combo >= 2 ? `${p.combo} HITS!` : '';
      if (hudCache['cb' + i] !== txt) { hudCache['cb' + i] = txt; cb.textContent = txt; cb.classList.remove('on'); if (txt) { void cb.offsetWidth; cb.classList.add('on'); } }
      const tg = el.querySelector('.tgt'), t = p.lastTarget;
      const show = t && p.lastTargetT > 0 && !t.boss;
      tg.classList.toggle('on', !!show);
      if (show) {
        setT(tg.querySelector('.tn'), 'tn' + i, t.def.name);
        setW(tg.querySelector('.tbar i'), 'tb' + i, (Math.max(0, t.hp / t.maxHp) * 100).toFixed(0) + '%');
      }
    });
    if (G.boss) {
      const r = Math.max(0, G.boss.hp / G.boss.maxHp) * 100;
      setW($('#bossBar .fill'), 'bhp', r.toFixed(1) + '%');
      setW($('#bossBar .lag'), 'blag', r.toFixed(1) + '%');
    }
  }

  function showCard(k, t, s, boss) {
    const el = $('#card');
    $('#cardK').textContent = k; $('#cardT').textContent = t; $('#cardS').textContent = s;
    el.classList.toggle('boss', !!boss);
    el.classList.remove('hidden');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  }

  // ---------- screens ----------
  function showOnly(id) {
    $$('.ov').forEach(o => o.classList.toggle('show', o.id === id));
  }

  function toTitle() {
    app.state = 'title'; G = null;
    showOnly('title');
    $('#hud').classList.add('hidden'); $('#bossBar').classList.add('hidden'); $('#card').classList.add('hidden');
    Sound.music('title');
    const hi = loadHi();
    $('#hiScore').textContent = hi ? `HIGH SCORE  ${String(hi).padStart(6, '0')}` : '';
  }

  function toSelect(players) {
    app.players = players; Input.setPlayers(players);
    app.state = 'select';
    if (players === 1) app.picks = [app.picks[0], app.picks[1]];
    showOnly('select');
    buildSelect();
  }

  function buildSelect() {
    const box = $('#heroes');
    box.innerHTML = '';
    HEROES.forEach((h, i) => {
      const card = document.createElement('div');
      card.className = 'hero';
      card.innerHTML = `<div class="tags"><span class="tag1">P1</span><span class="tag2">P2</span></div>
        <canvas></canvas><div class="hn">${h.name}</div><div class="ht">${h.title}</div>
        <div class="st"><span>Power</span><div class="bar"><i style="width:${h.stats[0] * 20}%"></i></div>
        <span>Speed</span><div class="bar"><i style="width:${h.stats[1] * 20}%"></i></div>
        <span>Health</span><div class="bar"><i style="width:${h.stats[2] * 20}%"></i></div></div>
        <div class="sp">Special: ${h.specialName}</div>
        ${app.players === 2 ? '<div class="pick2"><button class="b1">P1</button><button class="b2">P2</button></div>' : ''}`;
      card.addEventListener('click', ev => {
        Sound.ensure(); Sound.play('select');
        const p2 = ev.target.classList.contains('b2');
        app.picks[p2 ? 1 : 0] = i;
        markSelect();
      });
      box.appendChild(card);
    });
    markSelect();
  }
  function markSelect() {
    $$('.hero').forEach((c, i) => {
      c.classList.toggle('p1', app.picks[0] === i);
      c.classList.toggle('p2', app.players === 2 && app.picks[1] === i);
    });
  }
  function drawSelectPortraits() {
    $$('.hero canvas').forEach((c, i) => {
      const d = Math.min(2, devicePixelRatio || 1), w = c.clientWidth || 200, h = c.clientHeight || 210;
      if (c.width !== Math.round(w * d)) { c.width = Math.round(w * d); c.height = Math.round(h * d); }
      const g = c.getContext('2d');
      g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, h);
      const sel = app.picks[0] === i || (app.players === 2 && app.picks[1] === i);
      const hero = HEROES[i];
      const pose = sel ? Art.lerpPose(P.idle, P.victory, (Math.sin(app.time * 3) + 1) / 2) : Object.assign({}, P.idle, { hipY: Math.sin(app.time * 3 + i) });
      const k = h / 150 / (hero.look.scale || 1);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(w / 2, h - 14, 46, 10, 0, 0, Math.PI * 2); g.fill();
      g.save(); g.translate(w / 2, h - 14); g.scale(k, k);
      Art.drawFighter(g, 0, 0, hero.look, pose, 1, { t: app.time });
      g.restore();
    });
  }

  function beginGame() {
    Sound.ensure(); Sound.play('confirm');
    newRun();
    showOnly(null);
    $('#hud').classList.remove('hidden');
    $('#bossBar').classList.add('hidden');
    startStage(0);
  }

  function pause() {
    if (app.state !== 'play') return;
    app.state = 'paused';
    $('#pause').classList.add('show');
  }
  function resume() {
    if (app.state !== 'paused') return;
    app.state = 'play';
    $('#pause').classList.remove('show');
  }

  function showClear() {
    if (!G || G.bossPhase !== 'dead') return;
    app.state = 'clear';
    const timeBonus = Math.max(0, Math.round((240 - G.stageTime) * 20));
    let rows = '';
    G.players.forEach(p => {
      const hpBonus = p.out ? 0 : Math.round(p.hp * 30);
      p.score += timeBonus + hpBonus;
      rows += `<span>${p.hero.name} health bonus</span><span>${hpBonus}</span>`;
    });
    rows = `<span>Time bonus</span><span>${timeBonus}</span>` + rows;
    G.players.forEach(p => { rows += `<span class="tot">${p.hero.name} score</span><span>${p.score}</span>`; });
    $('#tally').innerHTML = rows;
    $('#btnNext').textContent = G.stageIdx === STAGES.length - 1 ? 'Finish' : 'Next stage';
    $('#bossBar').classList.add('hidden');
    showOnly('clear');
  }

  function nextStage() {
    if (G.stageIdx === STAGES.length - 1) { showEnding(true); return; }
    showOnly(null);
    G.players.forEach(p => { if (!p.out) { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.4); } });
    startStage(G.stageIdx + 1);
  }

  let contTimer = null;
  function showContinue() {
    app.state = 'continue';
    if (G.continues <= 0) { showEnding(false); return; }
    let n = 9;
    $('#contCount').textContent = n;
    $('#contLeft').textContent = `${G.continues} credit${G.continues === 1 ? '' : 's'} left`;
    showOnly('cont');
    Sound.stopMusic(); Sound.play('lose');
    clearInterval(contTimer);
    contTimer = setInterval(() => {
      n--;
      $('#contCount').textContent = n;
      Sound.play('select');
      if (n <= 0) { clearInterval(contTimer); showEnding(false); }
    }, 1000);
  }
  function doContinue() {
    if (app.state !== 'continue') return;
    clearInterval(contTimer);
    G.continues--;
    G.players.forEach(p => {
      p.out = false; p.lives = 2; p.score = Math.floor(p.score / 2);
      respawn(p);
    });
    showOnly(null);
    app.state = 'play';
    Sound.music(G.bossPhase === 'fight' || G.bossPhase === 'intro' ? 'boss' : G.stage.song);
  }

  function showEnding(win) {
    clearInterval(contTimer);
    app.state = 'over';
    const total = G.players.reduce((s, p) => s + p.score, 0);
    const hi = loadHi();
    if (total > hi) saveHi(total);
    $('#overT').textContent = win ? 'VICTORY!' : 'GAME OVER';
    $('#overT').classList.toggle('red', !win);
    $('#overS').textContent = win ? 'The Warlord has fallen and the city is safe again. Heroes!' : 'The streets win this time. Train harder and come back!';
    $('#overScore').innerHTML = G.players.map(p => `<span>${p.hero.name}</span><span>${p.score}</span>`).join('') + `<span class="tot">Total</span><span>${total}${total > hi ? ' ★ NEW BEST' : ''}</span>`;
    $('#bossBar').classList.add('hidden');
    showOnly('over');
    Sound.stopMusic(); Sound.play(win ? 'clear' : 'lose');
  }

  function loadHi() { try { return +localStorage.getItem('brawl.hi') || 0; } catch (e) { return 0; } }
  function saveHi(v) { try { localStorage.setItem('brawl.hi', String(v)); } catch (e) {} }

  // ---------- menu wiring ----------
  $$('[data-players]').forEach(b => b.addEventListener('click', () => { Sound.ensure(); Sound.play('confirm'); toSelect(+b.dataset.players); }));
  $('#diffSeg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    Sound.ensure(); Sound.play('select');
    app.diff = b.dataset.v;
    $$('#diffSeg button').forEach(x => x.classList.toggle('on', x === b));
  });
  $('#btnBack').addEventListener('click', () => { Sound.play('select'); toTitle(); });
  $('#btnFight').addEventListener('click', beginGame);
  $('#btnResume').addEventListener('click', resume);
  $('#btnRestart').addEventListener('click', () => {
    $('#pause').classList.remove('show');
    G.players.forEach(p => { p.hp = p.maxHp; p.out = false; });
    $('#bossBar').classList.add('hidden');
    startStage(G.stageIdx);
  });
  $('#btnQuit').addEventListener('click', toTitle);
  $('#btnNext').addEventListener('click', () => { Sound.play('confirm'); nextStage(); });
  $('#btnCont').addEventListener('click', doContinue);
  $('#btnGiveUp').addEventListener('click', () => showEnding(false));
  $('#btnTitle').addEventListener('click', toTitle);
  $('#btnPause').addEventListener('click', pause);
  const syncAudioBtns = () => { $('#btnMusic').classList.toggle('off', !Sound.musicOn); $('#btnSfx').classList.toggle('off', !Sound.sfxOn); };
  $('#btnMusic').addEventListener('click', () => { Sound.ensure(); Sound.toggleMusic(); syncAudioBtns(); });
  $('#btnSfx').addEventListener('click', () => { Sound.ensure(); Sound.toggleSfx(); syncAudioBtns(); });
  syncAudioBtns();
  addEventListener('keydown', e => {
    Sound.ensure();
    if (e.code === 'Escape' || e.code === 'KeyP') { app.state === 'paused' ? resume() : pause(); }
    if (e.code === 'KeyM') { Sound.toggleMusic(); syncAudioBtns(); }
  });
  addEventListener('pointerdown', () => { if (Sound.ensure() && app.state === 'title') Sound.music('title'); }, { once: true });

  // keyboard navigation for menus
  function menuKeys() {
    const i0 = Input.get(0), i1 = Input.get(1), before = app.state;
    app.eat = false;
    if (app.state === 'title') {
      if (i0.hit.atk || i0.hit.start) { Sound.ensure(); Sound.play('confirm'); toSelect(1); }
    } else if (app.state === 'select') {
      if (i0.hit.left) { app.picks[0] = (app.picks[0] + 2) % 3; Sound.play('select'); markSelect(); }
      if (i0.hit.right) { app.picks[0] = (app.picks[0] + 1) % 3; Sound.play('select'); markSelect(); }
      if (app.players === 2) {
        if (i1.hit.left) { app.picks[1] = (app.picks[1] + 2) % 3; Sound.play('select'); markSelect(); }
        if (i1.hit.right) { app.picks[1] = (app.picks[1] + 1) % 3; Sound.play('select'); markSelect(); }
      }
      if (i0.hit.start || i0.hit.atk) beginGame();
    } else if (app.state === 'clear') {
      if (i0.hit.start) nextStage();
    } else if (app.state === 'continue') {
      if (Input.anyHit('atk') || Input.anyHit('start')) doContinue();
    } else if (app.state === 'paused') {
      if (Input.anyHit('start')) resume();
    }
    // a key that just changed screens shouldn't also act on the new one
    if (app.state !== before) app.eat = true;
  }

  // ---------- touch ----------
  if (matchMedia('(pointer: coarse)').matches) {
    $('#touch').classList.remove('hidden');
    const stick = $('#stick'), knob = $('#knob');
    let sid = null;
    const setStick = (e) => {
      const r = stick.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy), max = r.width / 2 - 20;
      if (len > max) { dx *= max / len; dy *= max / len; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      const T = Input.touch, th = 14;
      const wasL = T.left, wasR = T.right;
      T.left = dx < -th; T.right = dx > th; T.up = dy < -th; T.down = dy > th;
      if (T.left && !wasL) Input.touchHits.add('left');
      if (T.right && !wasR) Input.touchHits.add('right');
    };
    stick.addEventListener('pointerdown', e => { sid = e.pointerId; stick.setPointerCapture(sid); setStick(e); Sound.ensure(); });
    stick.addEventListener('pointermove', e => { if (e.pointerId === sid) setStick(e); });
    const endStick = e => { if (e.pointerId !== sid) return; sid = null; knob.style.transform = ''; Object.assign(Input.touch, { left: false, right: false, up: false, down: false }); };
    stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);
    $$('#tbtns .tb').forEach(b => {
      const k = b.dataset.b;
      b.addEventListener('pointerdown', e => { e.preventDefault(); Sound.ensure(); Input.touch[k] = true; Input.touchHits.add(k); b.classList.add('down'); });
      const up = () => { Input.touch[k] = false; b.classList.remove('down'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    });
  }

  // ---------- loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    Input.poll();
    menuKeys();
    update(dt);
    render();
    if (app.state === 'select') drawSelectPortraits();
    requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  resize();
  toTitle();
  requestAnimationFrame(frame);

  // debug hook for automated testing
  window.__brawl = { app, get G() { return G; }, beginGame, toSelect, startStage: i => startStage(i) };
})();
