(() => {
  const boardEl = document.getElementById('board');
  const statusEl = document.getElementById('status');
  const logEl = document.getElementById('log');
  const promoEl = document.getElementById('promo');
  const promoChoices = document.getElementById('promoChoices');
  const endEl = document.getElementById('end');
  const NAMES = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' };

  let mode = 'ai';
  let human = 'w';
  let state = Chess.startPos();
  let history = [];
  let log = [];
  let selected = -1;
  let thinking = 0;

  function pieceSVG(p) {
    const white = p === p.toUpperCase();
    const fill = white ? '#fbf6ee' : '#1b140f';
    const stroke = white ? '#2a2118' : '#f3e6d4';
    const t = p.toLowerCase();
    const body = {
      p: '<circle cx="16" cy="11" r="4.2"/><path d="M11 27.5h10l-1.6-10h-6.8z"/>',
      r: '<path d="M8 9h3.2v3.2h2.4V9h4.8v3.2h2.4V9H24v18.5H8z"/>',
      n: '<path d="M9 28l2.2-12  -2.4-2.2 5.2-6.2 2.6 4.6 4.2-2.4-2.2 7.2 2.2 11z"/>',
      b: '<circle cx="16" cy="8" r="2.4"/><path d="M16 11.2 22.2 28H9.8z"/>',
      q: '<path d="M6.5 28 8.2 13l4 5.2L16 7.5l3.8 10.7 4-5.2L25.5 28z"/>',
      k: '<path d="M14 3.5h4v3.6h3.6v3.6H18v2.2h5.6L21.6 28H10.4L8.4 12.9H14V10.7H10.4V7.1H14z"/>'
    }[t];
    return `<svg viewBox="0 0 32 32" aria-hidden="true"><g fill="${fill}" stroke="${stroke}" stroke-width="1.15" stroke-linejoin="round">${body}</g></svg>`;
  }

  function flip() { return mode === 'ai' && human === 'b'; }

  function targetsFrom(sq) {
    return Chess.legal(state).filter(m => m.from === sq);
  }

  function render() {
    const rows = flip() ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
    const cols = flip() ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
    const moves = selected >= 0 ? targetsFrom(selected) : [];
    const dest = new Map();
    for (const m of moves) dest.set(m.to, m);
    const last = history.length ? history[history.length - 1].move : null;
    const res = Chess.result(state);
    const king = state.b.indexOf(state.turn === 'w' ? 'K' : 'k');
    const check = Chess.inCheck(state, state.turn);
    boardEl.innerHTML = '';
    for (const r of rows) {
      for (const c of cols) {
        const i = r * 8 + c;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sq' + ((r + c) % 2 ? ' dark' : '');
        if (last && (i === last.from || i === last.to)) btn.classList.add('last');
        if (i === selected) btn.classList.add('sel');
        if (check && i === king) btn.classList.add('check');
        const p = state.b[i];
        const label = p
          ? (Chess.sideOf(p) === 'w' ? 'White ' : 'Black ') + NAMES[p.toUpperCase()]
          : 'Empty';
        btn.setAttribute('aria-label', Chess.sqName(i) + ', ' + label);
        btn.dataset.sq = String(i);
        if (p) btn.innerHTML = pieceSVG(p);
        if (dest.has(i)) {
          btn.classList.add(state.b[i] ? 'cap' : 'hint');
          const dot = document.createElement('i');
          dot.className = 'dot';
          btn.appendChild(dot);
        }
        btn.addEventListener('click', () => onSquare(i));
        boardEl.appendChild(btn);
      }
    }
    logEl.innerHTML = '';
    for (let n = 0; n < log.length; n += 2) {
      const num = document.createElement('li');
      num.className = 'n';
      num.textContent = (n / 2 + 1) + '.';
      const w = document.createElement('li');
      w.textContent = log[n];
      const b = document.createElement('li');
      b.textContent = log[n + 1] || '';
      logEl.append(num, w, b);
    }
    if (res === 'white') setEnd('Checkmate', 'White wins.');
    else if (res === 'black') setEnd('Checkmate', 'Black wins.');
    else if (res === 'draw') setEnd('Draw', check ? 'Stalemate.' : 'Nothing left but the kings.');
    else endEl.hidden = true;
    if (!res) {
      const who = state.turn === 'w' ? 'White' : 'Black';
      statusEl.textContent = thinking ? 'House is thinking…' : (who + ' to move' + (check ? ' · check' : ''));
    }
  }

  function setEnd(title, text) {
    endEl.hidden = false;
    document.getElementById('endTitle').textContent = title;
    document.getElementById('endText').textContent = text;
    statusEl.textContent = title;
  }

  function onSquare(i) {
    if (thinking || Chess.result(state)) return;
    if (mode === 'ai' && state.turn !== human) return;
    const moves = selected >= 0 ? targetsFrom(selected) : [];
    const here = moves.filter(m => m.to === i);
    if (here.length) {
      if (here.some(m => m.promo)) askPromo(here);
      else play(here[0]);
      return;
    }
    const piece = state.b[i];
    if (piece && Chess.sideOf(piece) === state.turn && targetsFrom(i).length) selected = i;
    else selected = -1;
    render();
  }

  function askPromo(options) {
    promoEl.hidden = false;
    promoChoices.innerHTML = '';
    const seen = new Set();
    for (const m of options) {
      if (seen.has(m.promo)) continue;
      seen.add(m.promo);
      const b = document.createElement('button');
      b.type = 'button';
      const glyph = state.turn === 'w' ? m.promo.toUpperCase() : m.promo;
      b.innerHTML = pieceSVG(glyph);
      b.addEventListener('click', () => {
        promoEl.hidden = true;
        play(options.find(x => x.promo === m.promo));
      });
      promoChoices.appendChild(b);
    }
  }

  function play(m) {
    const note = Chess.notation(state, m);
    state = Chess.apply(state, m);
    history.push({ move: m, state: Chess.clone(state) });
    log.push(note);
    selected = -1;
    render();
    maybeAI();
  }

  function maybeAI() {
    if (mode !== 'ai' || state.turn === human || Chess.result(state)) return;
    const token = ++thinking;
    statusEl.textContent = 'House is thinking…';
    setTimeout(() => {
      if (token !== thinking) return;
      const m = Chess.bestMove(state, 3);
      thinking = 0;
      if (!m) { render(); return; }
      play(m);
    }, 160);
  }

  function fresh() {
    thinking++;
    state = Chess.startPos();
    history = [];
    log = [];
    selected = -1;
    thinking = 0;
    promoEl.hidden = true;
    endEl.hidden = true;
    render();
    maybeAI();
  }

  function undo() {
    if (thinking || !history.length) return;
    const steps = mode === 'ai' ? 2 : 1;
    for (let i = 0; i < steps && history.length; i++) {
      history.pop();
      log.pop();
    }
    state = history.length ? Chess.clone(history[history.length - 1].state) : Chess.startPos();
    selected = -1;
    endEl.hidden = true;
    render();
  }

  document.getElementById('modeAi').onclick = () => {
    mode = 'ai';
    document.getElementById('modeAi').classList.add('on');
    document.getElementById('modeHot').classList.remove('on');
    document.getElementById('colors').style.display = '';
    fresh();
  };
  document.getElementById('modeHot').onclick = () => {
    mode = 'hot';
    human = 'w';
    document.getElementById('modeHot').classList.add('on');
    document.getElementById('modeAi').classList.remove('on');
    document.getElementById('colors').style.display = 'none';
    fresh();
  };
  document.querySelectorAll('[data-color]').forEach(btn => {
    btn.onclick = () => {
      human = btn.dataset.color;
      document.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('on', b === btn));
      fresh();
    };
  });
  document.getElementById('undo').onclick = undo;
  document.getElementById('fresh').onclick = fresh;
  document.getElementById('endAgain').onclick = fresh;
  render();
  window.__check = { Chess, get state() { return state; }, play, fresh };
})();
