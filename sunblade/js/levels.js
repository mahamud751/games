'use strict';
// Levels are stitched together from 12-row chunks.
// Legend: # solid  = one-way ledge  B breakable  ^ spikes  ~ deadly liquid
//         C coin  ? letter slot  H health jar  P potion  K checkpoint  M moving ledge
//         @ start  F exit gate  X boss arena  m/j/a/v/x/c enemies (mapped per level)
window.LEVELS = (() => {
  const E = '....................................';
  const row = (w, s = '') => (s + E).slice(0, w);
  const chunk = (w, rows) => { const out = []; for (let i = 0; i < 12; i++) out.push(row(w, rows[i] || '')); return out; };
  const ground = w => '#'.repeat(w);

  const C = {
    start: chunk(16, { 6: '.........CCC', 8: '.........===', 9: '..@', 10: ground(16), 11: ground(16) }),
    flat: chunk(20, { 4: '.......?', 6: '......====....CCC', 9: '...m.........m', 10: ground(20), 11: ground(20) }),
    gap: chunk(14, { 5: '.....CCC', 6: '....C...C', 10: '#####...######', 11: '#####...######' }),
    steps: chunk(20, { 3: '.............?', 4: '............###', 6: '........###......C', 7: '........###......C', 8: '....###.###', 9: '....###.###..m', 10: ground(20), 11: ground(20) }),
    spikes: chunk(18, { 5: '......CC?CC', 7: '......======', 9: '...^^^^^^^^^^^^', 10: ground(18), 11: ground(18) }),
    pitPlats: chunk(24, { 3: '..........?', 6: '.........====', 7: '...===...........===', 8: '..................C', 10: '###....................#', 11: '###....................#' }),
    movers: chunk(22, { 5: '.......CCCCCCC', 8: '.....M........M', 10: '###..................#', 11: '###..................#' }),
    tower: chunk(20, { 2: '.............a', 3: '............####', 6: '.......===', 8: '...C.C.C.....H', 9: '.........x......x', 10: ground(20), 11: ground(20) }),
    birds: chunk(20, { 1: '.......v.......v', 4: '...........?', 5: '..........===', 7: '....===.........CC', 10: ground(20), 11: ground(20) }),
    check: chunk(10, { 9: '....K', 10: ground(10), 11: ground(10) }),
    potion: chunk(14, { 4: '.....BBB', 6: '......P', 7: '.....###', 10: ground(14), 11: ground(14) }),
    breaks: chunk(16, { 7: '..........BB', 8: '....BBB...BB', 9: '....BBB.C.BB.?', 10: ground(16), 11: ground(16) }),
    cobra: chunk(18, { 3: '......?', 5: '......====', 7: '.............c', 8: '.........#######', 9: '.........#######', 10: '####....##########', 11: '####....##########' }),
    scarabs: chunk(20, { 5: '.........?', 6: '........CCCC', 8: '.......======', 9: '..x.......x.....x', 10: ground(20), 11: ground(20) }),
    high: chunk(24, { 1: '................?', 2: '...............===', 4: '..........===', 6: '.....===', 8: '..===........CCC', 9: '.............m', 10: ground(24), 11: ground(24) }),
    end: chunk(14, { 9: '.......F', 10: ground(14), 11: ground(14) }),
    arena: chunk(20, { 0: 'X', 7: '...===........===', 10: ground(20), 11: ground(20) }),
    arenaPit: chunk(20, { 0: 'X', 6: '.....===....===', 9: '..===..........===', 10: '####~~~~~~~~~~~~####', 11: '####~~~~~~~~~~~~####' }),
    wall: chunk(2, Object.fromEntries([...Array(12)].map((_, i) => [i, '##']))),
  };

  function build(parts) {
    const rows = Array.from({ length: 12 }, () => '');
    for (const p of parts) { const ch = C[p]; for (let i = 0; i < 12; i++) rows[i] += ch[i]; }
    // pick 8 letter slots spread across the level, the rest become coins
    const slots = [];
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === '?') slots.push([x, y]); });
    slots.sort((a, b) => a[0] - b[0]);
    const keep = new Set();
    for (let i = 0; i < 8 && slots.length; i++) keep.add(Math.round(i * (slots.length - 1) / 7));
    const grid = rows.map(r => r.split(''));
    slots.forEach(([x, y], i) => { grid[y][x] = keep.has(i) ? 'L' : 'C'; });
    return grid.map(r => r.join(''));
  }

  return [
    {
      name: 'Village of the Nile', sub: 'Chapter I', theme: 'nile', song: 'l1', boss: 'scorpion', potion: 'flame',
      enemies: { m: 'jackal', x: 'scarab', a: 'archer', v: 'vulture', c: 'cobra' },
      map: build(['start', 'flat', 'gap', 'steps', 'check', 'birds', 'potion', 'tower', 'spikes', 'check', 'pitPlats', 'flat', 'breaks', 'high', 'check', 'arena', 'wall']),
    },
    {
      name: 'Sandstorm Run', sub: 'Chapter II', theme: 'storm', song: 'l2', chase: 215, potion: 'shield',
      enemies: { m: 'jackal', x: 'scarab', a: 'archer', v: 'vulture', c: 'cobra' },
      map: build(['start', 'gap', 'scarabs', 'spikes', 'steps', 'check', 'gap', 'birds', 'pitPlats', 'scarabs', 'check', 'movers', 'flat', 'high', 'gap', 'end']),
    },
    {
      name: 'Tomb of the Jackal', sub: 'Chapter III', theme: 'tomb', song: 'l3', boss: 'jackalgod', potion: 'storm',
      enemies: { m: 'mummy', x: 'scarab', a: 'archer', v: 'vulture', c: 'cobra' },
      map: build(['start', 'flat', 'breaks', 'tower', 'check', 'potion', 'cobra', 'steps', 'movers', 'check', 'high', 'flat', 'spikes', 'birds', 'check', 'arena', 'wall']),
    },
    {
      name: "Serpent's Abyss", sub: 'Chapter IV', theme: 'abyss', song: 'l4', boss: 'apep', potion: 'flame',
      enemies: { m: 'mummy', x: 'scarab', a: 'archer', v: 'vulture', c: 'cobra' },
      map: build(['start', 'cobra', 'pitPlats', 'birds', 'check', 'movers', 'tower', 'potion', 'spikes', 'check', 'high', 'steps', 'pitPlats', 'scarabs', 'check', 'arenaPit', 'wall']),
    },
  ];
})();
