(() => {
  const { TRACK, START, SAFE, FINISH, HOME, YARDS, COLORS, cellOf, legalMoves, captured } = Ludo;
  const board = document.getElementById('board');
  const note = document.getElementById('note');
  const who = document.getElementById('who');
  const die = document.getElementById('die');
  const end = document.getElementById('end');

  let mode = 'house';
  let seats = [0, 1, 2, 3];
  let turnIndex = 0;
  let tokens = seats.map(() => [-1, -1, -1, -1]);
  let dice = 1;
  let sixes = 0;
  let pending = [];
  let busy = false;
  let winner = null;
  let cpuTimer = 0;
  let alive = 0;

  function turn() { return seats[turnIndex]; }
  function cpu() { return mode === 'house' && turn() !== 0; }
  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  function buildBoard() {
    const track = new Set(TRACK.map(([r, c]) => r + ',' + c));
    const home = new Map();
    HOME.forEach((cells, p) => cells.forEach(([r, c]) => {
      if (!(r === 7 && c === 7)) home.set(r + ',' + c, p);
    }));
    const starts = {};
    START.forEach((idx, p) => { starts[TRACK[idx].join(',')] = p; });
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const cell = document.createElement('div');
        const key = r + ',' + c;
        cell.className = 'cell';
        cell.dataset.rc = key;
        if (r === 7 && c === 7) cell.classList.add('center');
        else if (home.has(key)) cell.classList.add('home', 'h' + home.get(key));
        else if (track.has(key)) {
          cell.classList.add('track');
          if (starts[key] !== undefined) cell.classList.add('start', 's' + starts[key]);
          const idx = TRACK.findIndex(([rr, cc]) => rr === r && cc === c);
          if (SAFE.has(idx)) cell.classList.add('safe');
        } else if (r >= 9 && c <= 5) cell.classList.add('yard', 'y0');
        else if (r >= 9 && c >= 9) cell.classList.add('yard', 'y1');
        else if (r <= 5 && c >= 9) cell.classList.add('yard', 'y2');
        else if (r <= 5 && c <= 5) cell.classList.add('yard', 'y3');
        board.appendChild(cell);
      }
    }
  }

  function place(player, pos, token) {
    if (pos < 0) return YARDS[player][token];
    return cellOf(player, pos);
  }

  function paintDice() {
    die.innerHTML = '';
    const on = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 3, 6, 2, 5, 8] }[dice];
    for (let i = 0; i < 9; i++) {
      const pip = document.createElement('i');
      if (on.includes(i)) pip.className = 'on';
      die.appendChild(pip);
    }
    die.disabled = busy || pending.length > 0 || winner !== null || cpu();
  }

  function paint() {
    board.querySelectorAll('.token').forEach(n => n.remove());
    const piles = new Map();
    for (const p of seats) {
      tokens[p].forEach((pos, i) => {
        const [r, c] = place(p, pos, i);
        const key = r + ',' + c;
        const cell = board.querySelector('[data-rc="' + key + '"]');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'token';
        btn.style.background = COLORS[p].fill;
        btn.style.color = COLORS[p].ink;
        const ready = pending.some(m => m.token === i) && p === turn();
        if (ready) btn.classList.add('ready');
        btn.setAttribute('aria-label', COLORS[p].name + ' token ' + (i + 1));
        btn.addEventListener('click', () => { if (p === turn()) choose(i); });
        cell.appendChild(btn);
        piles.set(key, (piles.get(key) || 0) + 1);
      });
    }
    who.innerHTML = seats.map(p => {
      const home = tokens[p].filter(pos => pos === FINISH).length;
      return '<div class="seat' + (p === turn() ? ' on' : '') + '"><i class="swatch" style="background:' + COLORS[p].fill + '"></i><span>' + COLORS[p].name + (mode === 'house' && p !== 0 ? ' · house' : '') + '</span><b style="margin-left:auto">' + home + '/4</b></div>';
    }).join('');
    paintDice();
  }

  function say(text) { note.textContent = text; }

  function pass() {
    turnIndex = (turnIndex + 1) % seats.length;
    sixes = 0;
    say(COLORS[turn()].name + ' to roll');
  }

  function poke() {
    clearTimeout(cpuTimer);
    if (!cpu() || winner !== null) return;
    cpuTimer = setTimeout(() => { void takeTurn(); }, 520);
  }

  async function spin() {
    let value = 1 + Math.floor(Math.random() * 6);
    for (let i = 0; i < 8; i++) {
      dice = 1 + Math.floor(Math.random() * 6);
      paintDice();
      await wait(60);
    }
    dice = value;
    paintDice();
    return value;
  }

  function pick(moves) {
    return moves.slice().sort((a, b) => rank(b) - rank(a))[0];
  }

  function rank(move) {
    let score = move.to;
    if (move.to === FINISH) score += 70;
    if (move.from < 0) score += 22;
    if (captured(tokens, turn(), move.to).length) score += 48;
    return score;
  }

  async function playMove(move) {
    const steps = [];
    if (move.from < 0) steps.push(0);
    else for (let pos = move.from + 1; pos <= move.to; pos++) steps.push(pos);
    for (const pos of steps) {
      tokens[turn()][move.token] = pos;
      paint();
      await wait(90);
      if (alive !== session) return;
    }
    const hits = captured(tokens, turn(), move.to);
    if (hits.length) {
      for (const hit of hits) tokens[hit.player][hit.token] = -1;
      say(COLORS[turn()].name + ' sends one home');
      paint();
      await wait(280);
    }
    if (tokens[turn()].every(pos => pos === FINISH)) winner = turn();
  }

  let session = 0;

  async function takeTurn() {
    if (busy || pending.length || winner !== null) return;
    const id = alive;
    busy = true;
    pending = [];
    paint();
    const value = await spin();
    if (id !== alive) return;
    if (value === 6) sixes += 1;
    else sixes = 0;
    if (value === 6 && sixes >= 3) {
      say('Three sixes. The turn is burned.');
      pass();
      busy = false;
      paint();
      poke();
      return;
    }
    const moves = legalMoves(tokens, turn(), value);
    if (!moves.length) {
      say('No move on a ' + value);
      pass();
      busy = false;
      paint();
      poke();
      return;
    }
    if (cpu() || moves.length === 1) {
      const move = cpu() ? pick(moves) : moves[0];
      await playMove(move);
      if (id !== alive) return;
      finishStep(value);
      return;
    }
    pending = moves;
    say('Tap a highlighted ' + COLORS[turn()].name.toLowerCase() + ' token');
    busy = false;
    paint();
  }

  function finishStep(value) {
    if (winner !== null) {
      busy = false;
      pending = [];
      say(COLORS[winner].name + ' is home');
      document.getElementById('endTitle').textContent = COLORS[winner].name + ' wins';
      end.hidden = false;
      paint();
      return;
    }
    if (value === 6 && sixes < 3) {
      say(COLORS[turn()].name + ' rolled a six. Roll again.');
      busy = false;
      paint();
      poke();
      return;
    }
    pass();
    busy = false;
    paint();
    poke();
  }

  function choose(index) {
    const move = pending.find(m => m.token === index);
    if (!move || busy) return;
    pending = [];
    busy = true;
    const value = dice;
    const id = alive;
    paint();
    void playMove(move).then(() => { if (id === alive) finishStep(value); });
  }

  function start(next) {
    clearTimeout(cpuTimer);
    alive++;
    session = alive;
    mode = next;
    seats = mode === 'two' ? [0, 2] : [0, 1, 2, 3];
    turnIndex = 0;
    tokens = [0, 1, 2, 3].map(() => [-1, -1, -1, -1]);
    dice = 1;
    sixes = 0;
    pending = [];
    busy = false;
    winner = null;
    end.hidden = true;
    say('Red to roll');
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
    paint();
  }

  die.addEventListener('click', () => { void takeTurn(); });
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => start(b.dataset.mode)));
  document.getElementById('again').addEventListener('click', () => start(mode));
  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' && document.activeElement === die) return;
    if (e.key === ' ' || e.key === 'Enter') {
      if (end.hidden) { e.preventDefault(); void takeTurn(); }
    }
  });

  buildBoard();
  start('house');
  window.__ludo = { legalMoves, captured, get tokens() { return tokens; }, Ludo };
})();
