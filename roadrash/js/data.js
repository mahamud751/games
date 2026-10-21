'use strict';
/* ---------- Static game data ---------- */

// top / accel / handling are multipliers on the base bike; armor scales damage taken.
const BIKES = [
  { id: 'sparrow', name: 'Sparrow 250', cls: 'Rat', price: 0, top: 0.80, accel: 0.82, handling: 0.88, armor: 0.85, nitro: 0, color: '#cbd5e1', accent: '#475569', blurb: 'Rusty, loud and yours. Every legend starts somewhere.' },
  { id: 'viper', name: 'Viper 400', cls: 'Rat', price: 4000, top: 0.86, accel: 0.88, handling: 0.92, armor: 0.9, nitro: 0, color: '#22c55e', accent: '#14532d', blurb: 'Light and twitchy. Great for weaving through traffic.' },
  { id: 'ronin', name: 'Ronin 600', cls: 'Sport', price: 9500, top: 0.91, accel: 0.93, handling: 0.97, armor: 0.95, nitro: 0, color: '#ef4444', accent: '#7f1d1d', blurb: 'A proper sport bike. Sharp in the corners.' },
  { id: 'kraken', name: 'Kraken 750', cls: 'Sport', price: 17000, top: 0.95, accel: 0.95, handling: 0.92, armor: 1.15, nitro: 0, color: '#0ea5e9', accent: '#0c4a6e', blurb: 'Heavy frame. Shrugs off hits that floor lighter bikes.' },
  { id: 'tempest', name: 'Tempest 900 N', cls: 'Super', price: 28000, top: 0.98, accel: 0.99, handling: 0.98, armor: 1.0, nitro: 3, color: '#a855f7', accent: '#3b0764', blurb: 'First bike with nitrous. Three bottles of pure speed.' },
  { id: 'banshee', name: 'Banshee 1000 N', cls: 'Super', price: 42000, top: 1.03, accel: 1.02, handling: 1.0, armor: 1.05, nitro: 4, color: '#f97316', accent: '#7c2d12', blurb: 'Screams like its name. Four nitro bottles.' },
  { id: 'goliath', name: 'Goliath 1300 N', cls: 'Super', price: 65000, top: 1.08, accel: 1.05, handling: 0.96, armor: 1.3, nitro: 5, color: '#facc15', accent: '#713f12', blurb: 'The king of the road. Nothing catches it, nothing knocks it down.' },
];

const WEAPONS = {
  fist: { name: 'Fist', dmg: 11, reach: 0.42, icon: '👊' },
  club: { name: 'Club', dmg: 17, reach: 0.52, icon: '🏏' },
  chain: { name: 'Chain', dmg: 23, reach: 0.64, icon: '⛓️' },
  baton: { name: 'Baton', dmg: 20, reach: 0.55, icon: '🚔' },
};

const RIVALS = [
  { name: 'Natasha', jacket: '#db2777', helmet: '#f9a8d4', bike: '#831843', skill: 0.98, aggro: 0.7, weapon: 'chain' },
  { name: 'Slater', jacket: '#1f2937', helmet: '#ef4444', bike: '#111827', skill: 1.0, aggro: 0.9, weapon: 'club' },
  { name: 'Rude Boy', jacket: '#16a34a', helmet: '#fde047', bike: '#14532d', skill: 0.95, aggro: 0.95, weapon: 'fist' },
  { name: 'Medusa', jacket: '#0d9488', helmet: '#5eead4', bike: '#134e4a', skill: 0.97, aggro: 0.6, weapon: 'chain' },
  { name: 'Axle', jacket: '#ea580c', helmet: '#fed7aa', bike: '#9a3412', skill: 0.93, aggro: 0.5, weapon: 'fist' },
  { name: 'Duke', jacket: '#7c3aed', helmet: '#ddd6fe', bike: '#4c1d95', skill: 0.99, aggro: 0.4, weapon: 'club' },
  { name: 'Raven', jacket: '#0f172a', helmet: '#94a3b8', bike: '#334155', skill: 1.01, aggro: 0.75, weapon: 'chain' },
  { name: 'Lola', jacket: '#e11d48', helmet: '#ffffff', bike: '#9f1239', skill: 0.94, aggro: 0.55, weapon: 'fist' },
  { name: 'Hammer', jacket: '#78350f', helmet: '#f59e0b', bike: '#451a03', skill: 0.96, aggro: 1.0, weapon: 'club' },
  { name: 'Jinx', jacket: '#2563eb', helmet: '#bfdbfe', bike: '#1e3a8a', skill: 0.97, aggro: 0.65, weapon: 'fist' },
];

const LEVELS = [
  { n: 1, segs: 3200, rival: 0.80, traffic: 0.8, cops: 0, prize: 1 },
  { n: 2, segs: 3800, rival: 0.86, traffic: 1.0, cops: 1, prize: 1.7 },
  { n: 3, segs: 4400, rival: 0.91, traffic: 1.2, cops: 1, prize: 2.6 },
  { n: 4, segs: 5000, rival: 0.96, traffic: 1.4, cops: 2, prize: 3.8 },
  { n: 5, segs: 5600, rival: 1.01, traffic: 1.6, cops: 2, prize: 5.2 },
];

const PRIZES = [1500, 1000, 700, 450, 250, 120, 60, 0];

const THEMES = {
  coast: {
    sky: ['#1e1b4b', '#7c3aed', '#f472b6', '#fb923c', '#fde68a'], sun: '#fff7ae', sunY: 0.62, sunR: 70,
    far: '#6d28d9', near: '#9d174d', fog: '#f9a8d4',
    grass: ['#e6c08b', '#d9b07a'], rumble: ['#ffffff', '#ef4444'], road: ['#4b5563', '#475161'], lane: '#f8fafc',
    sea: true,
    scenery: [['palm', 6], ['bush', 2], ['billboard', 0.6], ['rock', 1]],
  },
  forest: {
    sky: ['#0c4a6e', '#0284c7', '#7dd3fc', '#e0f2fe'], sun: '#fffbea', sunY: 0.3, sunR: 40, clouds: true,
    far: '#3f6c8f', near: '#166534', fog: '#bae6fd',
    grass: ['#3f9b3a', '#368a32'], rumble: ['#ffffff', '#64748b'], road: ['#525866', '#4c5260'], lane: '#fef3c7',
    scenery: [['pine', 7], ['oak', 4], ['bush', 2], ['billboard', 0.4], ['rock', 0.8]],
  },
  desert: {
    sky: ['#7c2d12', '#ea580c', '#fdba74', '#fef3c7'], sun: '#fffbeb', sunY: 0.4, sunR: 55,
    far: '#b45309', near: '#9a3412', fog: '#fed7aa',
    grass: ['#e8a35c', '#dd9550'], rumble: ['#fef3c7', '#b91c1c'], road: ['#6b5b52', '#64554c'], lane: '#fef9c3',
    scenery: [['cactus', 6], ['rock', 4], ['billboard', 0.5], ['bush', 1]],
  },
  city: {
    sky: ['#020617', '#1e1b4b', '#4c1d95', '#be185d'], sun: null, stars: true, night: true,
    far: '#1e1b4b', near: '#0f0a2a', fog: '#3b0764', skyline: true,
    grass: ['#1e1b2e', '#1a1728'], rumble: ['#e879f9', '#22d3ee'], road: ['#2a2838', '#262434'], lane: '#fde047',
    scenery: [['building', 6], ['lamp', 4], ['billboard', 1.4]],
  },
  snow: {
    sky: ['#1e3a5f', '#5b8bb5', '#c7dcef', '#f1f5f9'], sun: '#ffffff', sunY: 0.35, sunR: 34, clouds: true,
    far: '#94a3b8', near: '#e2e8f0', fog: '#e2e8f0', snowcaps: true,
    grass: ['#f8fafc', '#e8eef5'], rumble: ['#ef4444', '#ffffff'], road: ['#5b6170', '#555b69'], lane: '#fbbf24',
    scenery: [['snowpine', 8], ['rock', 2], ['billboard', 0.3]],
  },
};

const TRACKS = [
  { id: 'coast', name: 'Sunset Coast', theme: 'coast', seed: 1101, curvy: 0.7, hilly: 0.45, traffic: 1.0, desc: 'Palm-lined ocean highway at golden hour. Wide sweeping bends.' },
  { id: 'forest', name: 'Redwood Valley', theme: 'forest', seed: 2207, curvy: 0.9, hilly: 0.8, traffic: 0.9, desc: 'Rolling hills and tight forest bends. Watch the trees.' },
  { id: 'desert', name: 'Desert Canyon', theme: 'desert', seed: 3313, curvy: 0.55, hilly: 0.6, traffic: 0.8, desc: 'Long hot straights through red rock. Flat-out speed.' },
  { id: 'city', name: 'Neon Downtown', theme: 'city', seed: 4421, curvy: 0.8, hilly: 0.3, traffic: 1.6, desc: 'Midnight streets packed with traffic. Cops love this part of town.' },
  { id: 'snow', name: 'Alpine Pass', theme: 'snow', seed: 5527, curvy: 1.0, hilly: 1.0, traffic: 0.8, desc: 'Steep climbs, blind crests and snowy hairpins.' },
];

const CAR_COLORS = ['#e11d48', '#2563eb', '#f8fafc', '#facc15', '#16a34a', '#0f172a', '#9333ea', '#f97316', '#64748b', '#0891b2'];
