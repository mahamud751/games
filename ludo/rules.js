/* Classic 52-square ludo. A six leaves the yard, three sixes burn the turn, landing is exact. */
const Ludo = (() => {
  const TRACK = [
    [13, 6], [14, 6], [14, 7], [14, 8],
    [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
    [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
    [7, 14], [6, 14],
    [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
    [5, 8], [4, 8], [3, 8], [2, 8], [1, 8],
    [0, 8], [0, 7], [0, 6],
    [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
    [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
    [7, 0], [8, 0],
    [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
    [9, 6], [10, 6], [11, 6], [12, 6]
  ];
  const START = [0, 13, 26, 39];
  const SAFE = new Set([0, 13, 26, 39, 5, 18, 31, 44]);
  const FINISH = 55;
  const HOME = [
    [[11, 7], [10, 7], [9, 7], [8, 7], [7, 7]],
    [[7, 11], [7, 10], [7, 9], [7, 8], [7, 7]],
    [[3, 7], [4, 7], [5, 7], [6, 7], [7, 7]],
    [[7, 3], [7, 4], [7, 5], [7, 6], [7, 7]]
  ];
  const YARDS = [
    [[11, 2], [11, 4], [13, 2], [13, 4]],
    [[11, 10], [11, 12], [13, 10], [13, 12]],
    [[1, 10], [1, 12], [3, 10], [3, 12]],
    [[1, 2], [1, 4], [3, 2], [3, 4]]
  ];
  const COLORS = [
    { name: 'Red', fill: '#e23d4a', ink: '#fffaf7' },
    { name: 'Blue', fill: '#2f6fe0', ink: '#f4f8ff' },
    { name: 'Gold', fill: '#e2a412', ink: '#3a2a08' },
    { name: 'Green', fill: '#1f9a4a', ink: '#f3fff6' }
  ];

  function cellOf(player, pos) {
    if (pos <= 50) return TRACK[(START[player] + pos) % 52];
    return HOME[player][pos - 51];
  }

  function key(player, pos) {
    const cell = cellOf(player, pos);
    return cell[0] + ',' + cell[1];
  }

  function blocked(tokens, player, pos) {
    if (pos > 50) return false;
    const here = key(player, pos);
    for (let other = 0; other < 4; other++) {
      if (other === player) continue;
      let count = 0;
      for (const pos2 of tokens[other]) {
        if (pos2 >= 0 && pos2 <= 50 && key(other, pos2) === here) count++;
      }
      if (count >= 2) return true;
    }
    return false;
  }

  function legalMoves(tokens, player, dice) {
    const mine = tokens[player];
    const moves = [];
    for (let token = 0; token < 4; token++) {
      const from = mine[token];
      if (from >= FINISH) continue;
      if (from < 0) {
        if (dice === 6 && !blocked(tokens, player, 0)) moves.push({ token, from, to: 0 });
        continue;
      }
      const to = from + dice;
      if (to > FINISH) continue;
      if (to <= 50 && blocked(tokens, player, to)) continue;
      moves.push({ token, from, to });
    }
    return moves;
  }

  function captured(tokens, player, pos) {
    if (pos < 0 || pos > 50) return [];
    if (SAFE.has((START[player] + pos) % 52)) return [];
    const here = key(player, pos);
    const hits = [];
    for (let other = 0; other < 4; other++) {
      if (other === player) continue;
      const mine = [];
      tokens[other].forEach((pos2, token) => {
        if (pos2 >= 0 && pos2 <= 50 && key(other, pos2) === here) mine.push(token);
      });
      if (mine.length >= 2) continue;
      for (const token of mine) hits.push({ player: other, token });
    }
    return hits;
  }

  return { TRACK, START, SAFE, FINISH, HOME, YARDS, COLORS, cellOf, legalMoves, captured, blocked };
})();

globalThis.Ludo = Ludo;
