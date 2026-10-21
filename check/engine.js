/* Full chess rules: moves, castling, en passant, promotion, check, mate, stalemate. */
const Chess = (() => {
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

  function startPos() {
    const b = new Array(64).fill(null);
    const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    for (let i = 0; i < 8; i++) {
      b[i] = back[i];
      b[8 + i] = 'p';
      b[48 + i] = 'P';
      b[56 + i] = back[i].toUpperCase();
    }
    return { b, turn: 'w', castle: 'KQkq', ep: -1 };
  }

  function clone(s) {
    return { b: s.b.slice(), turn: s.turn, castle: s.castle, ep: s.ep };
  }

  function sideOf(p) { return p === p.toUpperCase() ? 'w' : 'b'; }
  function on(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

  function isAttacked(b, sq, by) {
    const r = sq >> 3;
    const c = sq & 7;
    const pr = by === 'w' ? r + 1 : r - 1;
    for (const dc of [-1, 1]) {
      if (!on(pr, c + dc)) continue;
      const p = b[pr * 8 + c + dc];
      if (p && sideOf(p) === by && p.toLowerCase() === 'p') return true;
    }
    for (const [dr, dc] of KNIGHT) {
      if (!on(r + dr, c + dc)) continue;
      const p = b[(r + dr) * 8 + c + dc];
      if (p && sideOf(p) === by && p.toLowerCase() === 'n') return true;
    }
    for (const [dr, dc] of KING) {
      if (!on(r + dr, c + dc)) continue;
      const p = b[(r + dr) * 8 + c + dc];
      if (p && sideOf(p) === by && p.toLowerCase() === 'k') return true;
    }
    const rays = [
      [-1, 0, 'rq'], [1, 0, 'rq'], [0, -1, 'rq'], [0, 1, 'rq'],
      [-1, -1, 'bq'], [-1, 1, 'bq'], [1, -1, 'bq'], [1, 1, 'bq']
    ];
    for (const [dr, dc, kinds] of rays) {
      let rr = r + dr;
      let cc = c + dc;
      while (on(rr, cc)) {
        const p = b[rr * 8 + cc];
        if (p) {
          if (sideOf(p) === by && kinds.includes(p.toLowerCase())) return true;
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
    return false;
  }

  function kingSquare(b, side) {
    return b.indexOf(side === 'w' ? 'K' : 'k');
  }

  function inCheck(s, side) {
    const k = kingSquare(s.b, side);
    if (k < 0) return false;
    return isAttacked(s.b, k, side === 'w' ? 'b' : 'w');
  }

  function pushRay(moves, b, i, side, dr, dc) {
    const r = i >> 3;
    const c = i & 7;
    let rr = r + dr;
    let cc = c + dc;
    while (on(rr, cc)) {
      const to = rr * 8 + cc;
      const occ = b[to];
      if (!occ) moves.push({ from: i, to });
      else {
        if (sideOf(occ) !== side) moves.push({ from: i, to });
        break;
      }
      rr += dr;
      cc += dc;
    }
  }

  function pseudo(s) {
    const moves = [];
    const b = s.b;
    const side = s.turn;
    const fwd = side === 'w' ? -1 : 1;
    const home = side === 'w' ? 6 : 1;
    const last = side === 'w' ? 0 : 7;
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p || sideOf(p) !== side) continue;
      const r = i >> 3;
      const c = i & 7;
      const t = p.toLowerCase();
      if (t === 'p') {
        const r1 = r + fwd;
        if (on(r1, c) && !b[r1 * 8 + c]) {
          const to = r1 * 8 + c;
          if (r1 === last) for (const promo of ['q', 'r', 'b', 'n']) moves.push({ from: i, to, promo });
          else moves.push({ from: i, to });
          if (r === home) {
            const r2 = r + fwd * 2;
            const to2 = r2 * 8 + c;
            if (!b[to2]) moves.push({ from: i, to: to2, double: true });
          }
        }
        for (const dc of [-1, 1]) {
          if (!on(r + fwd, c + dc)) continue;
          const to = (r + fwd) * 8 + c + dc;
          if ((b[to] && sideOf(b[to]) !== side) || to === s.ep) {
            const extra = { ep: to === s.ep };
            if (r + fwd === last) for (const promo of ['q', 'r', 'b', 'n']) moves.push(Object.assign({ from: i, to, promo }, extra));
            else moves.push(Object.assign({ from: i, to }, extra));
          }
        }
      } else if (t === 'n') {
        for (const [dr, dc] of KNIGHT) {
          if (!on(r + dr, c + dc)) continue;
          const to = (r + dr) * 8 + (c + dc);
          if (!b[to] || sideOf(b[to]) !== side) moves.push({ from: i, to });
        }
      } else if (t === 'k') {
        for (const [dr, dc] of KING) {
          if (!on(r + dr, c + dc)) continue;
          const to = (r + dr) * 8 + (c + dc);
          if (!b[to] || sideOf(b[to]) !== side) moves.push({ from: i, to });
        }
        if (side === 'w' && i === 60 && !inCheck(s, 'w')) {
          if (s.castle.includes('K') && !b[61] && !b[62] && !isAttacked(b, 61, 'b') && !isAttacked(b, 62, 'b')) {
            moves.push({ from: i, to: 62, castle: 'K' });
          }
          if (s.castle.includes('Q') && !b[59] && !b[58] && !b[57] && !isAttacked(b, 59, 'b') && !isAttacked(b, 58, 'b')) {
            moves.push({ from: i, to: 58, castle: 'Q' });
          }
        }
        if (side === 'b' && i === 4 && !inCheck(s, 'b')) {
          if (s.castle.includes('k') && !b[5] && !b[6] && !isAttacked(b, 5, 'w') && !isAttacked(b, 6, 'w')) {
            moves.push({ from: i, to: 6, castle: 'k' });
          }
          if (s.castle.includes('q') && !b[3] && !b[2] && !b[1] && !isAttacked(b, 3, 'w') && !isAttacked(b, 2, 'w')) {
            moves.push({ from: i, to: 2, castle: 'q' });
          }
        }
      } else if (t === 'b') {
        for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) pushRay(moves, b, i, side, dr, dc);
      } else if (t === 'r') {
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) pushRay(moves, b, i, side, dr, dc);
      } else {
        for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]) pushRay(moves, b, i, side, dr, dc);
      }
    }
    return moves;
  }

  function apply(s, m) {
    const n = clone(s);
    const p = n.b[m.from];
    n.b[m.from] = null;
    let placed = p;
    if (m.promo) placed = n.turn === 'w' ? m.promo.toUpperCase() : m.promo;
    n.b[m.to] = placed;
    if (m.ep) n.b[n.turn === 'w' ? m.to + 8 : m.to - 8] = null;
    if (m.castle === 'K') { n.b[63] = null; n.b[61] = 'R'; }
    if (m.castle === 'Q') { n.b[56] = null; n.b[59] = 'R'; }
    if (m.castle === 'k') { n.b[7] = null; n.b[5] = 'r'; }
    if (m.castle === 'q') { n.b[0] = null; n.b[3] = 'r'; }
    let castle = n.castle;
    const drop = (ch) => { castle = castle.replace(ch, ''); };
    if (p === 'K') { drop('K'); drop('Q'); }
    if (p === 'k') { drop('k'); drop('q'); }
    if (m.from === 63 || m.to === 63) drop('K');
    if (m.from === 56 || m.to === 56) drop('Q');
    if (m.from === 7 || m.to === 7) drop('k');
    if (m.from === 0 || m.to === 0) drop('q');
    n.castle = castle;
    n.ep = m.double ? (m.from + m.to) >> 1 : -1;
    n.turn = n.turn === 'w' ? 'b' : 'w';
    return n;
  }

  function legal(s) {
    const out = [];
    for (const m of pseudo(s)) {
      const n = apply(s, m);
      if (!inCheck(n, s.turn)) out.push(m);
    }
    return out;
  }

  function bareKings(s) {
    for (let i = 0; i < 64; i++) {
      const p = s.b[i];
      if (p && p.toLowerCase() !== 'k') return false;
    }
    return true;
  }

  function result(s) {
    if (bareKings(s)) return 'draw';
    const moves = legal(s);
    if (moves.length) return null;
    if (inCheck(s, s.turn)) return s.turn === 'w' ? 'black' : 'white';
    return 'draw';
  }

  function pst(piece, sq) {
    const r = sq >> 3;
    const c = sq & 7;
    const center = (3.5 - Math.abs(c - 3.5)) + (3.5 - Math.abs(r - 3.5));
    const t = piece.toLowerCase();
    if (t === 'p') {
      const adv = piece === 'P' ? (7 - r) : r;
      return adv * 6 + center;
    }
    if (t === 'n' || t === 'b') return center * 8;
    if (t === 'k') return (piece === 'K' ? r : 7 - r) * 3;
    return center * 2;
  }

  function evaluate(s) {
    let sc = 0;
    for (let i = 0; i < 64; i++) {
      const p = s.b[i];
      if (!p) continue;
      const v = VAL[p.toLowerCase()] + pst(p, i);
      sc += p === p.toUpperCase() ? v : -v;
    }
    return sc;
  }

  function ordered(s) {
    return legal(s).sort((a, b) => scoreMove(s, b) - scoreMove(s, a));
  }

  function scoreMove(s, m) {
    let sc = 0;
    const victim = s.b[m.to];
    if (victim) sc += 10 * VAL[victim.toLowerCase()] - VAL[s.b[m.from].toLowerCase()];
    if (m.promo === 'q') sc += 900;
    else if (m.promo) sc += 200;
    if (m.castle) sc += 40;
    return sc;
  }

  function search(s, depth, alpha, beta) {
    if (depth === 0) return (s.turn === 'w' ? 1 : -1) * evaluate(s);
    const moves = ordered(s);
    if (!moves.length) {
      if (inCheck(s, s.turn)) return -100000 - depth;
      return 0;
    }
    let best = -Infinity;
    for (const m of moves) {
      const sc = -search(apply(s, m), depth - 1, -beta, -alpha);
      if (sc > best) best = sc;
      if (sc > alpha) alpha = sc;
      if (alpha >= beta) break;
    }
    return best;
  }

  function bestMove(s, depth) {
    const moves = ordered(s);
    let best = null;
    let bestSc = -Infinity;
    let alpha = -Infinity;
    for (const m of moves) {
      const sc = -search(apply(s, m), depth - 1, -Infinity, -alpha);
      if (sc > bestSc) { bestSc = sc; best = m; }
      if (sc > alpha) alpha = sc;
    }
    return best;
  }

  function sqName(i) {
    return 'abcdefgh'[i & 7] + (8 - (i >> 3));
  }

  function notation(s, m) {
    const piece = s.b[m.from];
    const cap = s.b[m.to] || m.ep ? 'x' : '';
    if (m.castle === 'K' || m.castle === 'k') return 'O-O';
    if (m.castle === 'Q' || m.castle === 'q') return 'O-O-O';
    const letter = piece.toLowerCase() === 'p' ? (cap ? sqName(m.from)[0] : '') : piece.toUpperCase();
    return letter + cap + sqName(m.to) + (m.promo ? '=' + m.promo.toUpperCase() : '');
  }

  return { startPos, clone, legal, apply, inCheck, result, evaluate, bestMove, sideOf, sqName, notation };
})();

globalThis.Chess = Chess;
