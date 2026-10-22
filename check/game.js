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
  let aiGen = 0;

  const ROOK_HOP = { K: [63, 61], Q: [56, 59], k: [7, 5], q: [0, 3] };
  const START = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  let anim = null;

  function pieceSVG(p) {
    const side = p === p.toUpperCase() ? 'w' : 'b';
    return `<svg class="pc ${side}" viewBox="0 0 45 45" aria-hidden="true"><use href="#pc-${p.toLowerCase()}"/></svg>`;
  }

  const sound = (() => {
    let ctx = null;
    let on = true;
    function tone(freq, dur, type, gain, when = 0) {
      const t = ctx.currentTime + when;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + dur);
    }
    function knock(freq, gain, when = 0) {
      const t = ctx.currentTime + when;
      const len = Math.floor(ctx.sampleRate * 0.06);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
      const src = ctx.createBufferSource();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = buf;
      f.type = 'bandpass';
      f.frequency.value = freq;
      f.Q.value = 3;
      g.gain.value = gain;
      src.connect(f).connect(g).connect(ctx.destination);
      src.start(t);
      tone(freq / 4, 0.08, 'sine', gain * 0.5, when);
    }
    function play(kind) {
      if (!on) return;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
      } catch (e) { return; }
      if (kind === 'move') knock(1400, 0.9);
      else if (kind === 'capture') { knock(900, 1.1); knock(1600, 0.6, 0.05); }
      else if (kind === 'check') { knock(1400, 0.8); tone(880, 0.18, 'triangle', 0.12, 0.06); tone(1175, 0.25, 'triangle', 0.1, 0.16); }
      else if (kind === 'end') [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.6, 'triangle', 0.09, i * 0.11));
    }
    return { play, toggle() { on = !on; return on; } };
  })();

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
        const myTurn = !res && !thinking && (mode !== 'ai' || state.turn === human);
        if (myTurn && state.b[i] && Chess.sideOf(state.b[i]) === state.turn) btn.classList.add('mine');
        if (c === cols[0]) btn.insertAdjacentHTML('beforeend', `<span class="coord rank">${8 - r}</span>`);
        if (r === rows[7]) btn.insertAdjacentHTML('beforeend', `<span class="coord file">${'abcdefgh'[c]}</span>`);
        const p = state.b[i];
        const label = p
          ? (Chess.sideOf(p) === 'w' ? 'White ' : 'Black ') + NAMES[p.toUpperCase()]
          : 'Empty';
        btn.setAttribute('aria-label', Chess.sqName(i) + ', ' + label);
        btn.dataset.sq = String(i);
        if (p) btn.insertAdjacentHTML('beforeend', pieceSVG(p));
        if (dest.has(i)) {
          btn.classList.add(state.b[i] ? 'cap' : 'tgt');
          const dot = document.createElement('i');
          dot.className = 'dot';
          btn.appendChild(dot);
        }
        btn.addEventListener('click', () => onSquare(i));
        boardEl.appendChild(btn);
      }
    }
    renderLog();
    renderPlayers(res);
    runAnim();
    if (res === 'white') setEnd('Checkmate', 'White wins.');
    else if (res === 'black') setEnd('Checkmate', 'Black wins.');
    else if (res === 'draw') setEnd('Draw', check ? 'Stalemate.' : 'Nothing left but the kings.');
    else endEl.hidden = true;
    if (!res) {
      const who = state.turn === 'w' ? 'White' : 'Black';
      statusEl.textContent = thinking ? 'House is thinking…' : (who + ' to move' + (check ? ' · check!' : ''));
    }
    statusEl.classList.toggle('alert', !!check && !thinking);
  }

  function renderLog() {
    logEl.innerHTML = '';
    if (!log.length) {
      logEl.innerHTML = '<li class="empty">No moves yet — your opening.</li>';
      return;
    }
    for (let n = 0; n < log.length; n += 2) {
      const num = document.createElement('li');
      num.className = 'n';
      num.textContent = (n / 2 + 1) + '.';
      const w = document.createElement('li');
      w.textContent = log[n];
      const b = document.createElement('li');
      b.textContent = log[n + 1] || '';
      if (n === log.length - 1) w.className = 'cur';
      if (n + 1 === log.length - 1) b.className = 'cur';
      logEl.append(num, w, b);
    }
    logEl.scrollTop = logEl.scrollHeight;
  }

  function renderPlayers(res) {
    const counts = {};
    for (const p of state.b) if (p) counts[p] = (counts[p] || 0) + 1;
    const taken = { w: [], b: [] };
    let score = 0;
    for (const t of ['q', 'r', 'b', 'n', 'p']) {
      const lostB = Math.max(0, START[t] - (counts[t] || 0));
      const lostW = Math.max(0, START[t] - (counts[t.toUpperCase()] || 0));
      for (let k = 0; k < lostB; k++) taken.w.push(t);
      for (let k = 0; k < lostW; k++) taken.b.push(t.toUpperCase());
    }
    for (const p of state.b) if (p && VALUE[p.toLowerCase()]) score += (Chess.sideOf(p) === 'w' ? 1 : -1) * VALUE[p.toLowerCase()];
    const bottom = flip() ? 'b' : 'w';
    for (const [id, side] of [['pBot', bottom], ['pTop', bottom === 'w' ? 'b' : 'w']]) {
      const el = document.getElementById(id);
      const isHouse = mode === 'ai' && side !== human;
      const label = mode === 'ai' ? (isHouse ? 'The House' : 'You') : (side === 'w' ? 'White' : 'Black');
      el.querySelector('.avatar').className = 'avatar ' + side;
      el.querySelector('.name').innerHTML = label + (isHouse && thinking ? ' <span class="dots"><i></i><i></i><i></i></span>' : '');
      el.querySelector('.caps').innerHTML = taken[side].map(pieceSVG).join('');
      const lead = side === 'w' ? score : -score;
      el.querySelector('.adv').textContent = lead > 0 ? '+' + lead : '';
      el.classList.toggle('active', !res && state.turn === side);
    }
  }

  function squareEl(i) { return boardEl.querySelector(`[data-sq="${i}"]`); }

  function slide(from, to) {
    const a = squareEl(from);
    const b = squareEl(to);
    const pc = b && b.querySelector('.pc');
    if (!a || !pc) return;
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    pc.classList.add('moving');
    pc.style.transform = `translate(${ra.left - rb.left}px, ${ra.top - rb.top}px)`;
    pc.getBoundingClientRect();
    pc.style.transition = 'transform .24s cubic-bezier(.3, .7, .3, 1)';
    pc.style.transform = '';
    pc.addEventListener('transitionend', () => {
      pc.classList.remove('moving');
      pc.style.transition = '';
    }, { once: true });
  }

  function runAnim() {
    if (!anim) return;
    const m = anim;
    anim = null;
    slide(m.from, m.to);
    if (m.castle) slide(...ROOK_HOP[m.castle]);
  }

  function setEnd(title, text) {
    if (endEl.hidden) sound.play('end');
    endEl.hidden = false;
    const piece = document.getElementById('endPiece');
    const winner = text.startsWith('White') ? 'w' : text.startsWith('Black') ? 'b' : (state.turn);
    piece.setAttribute('class', 'end-piece pc ' + winner);
    document.getElementById('endKicker').textContent = mode === 'ai' && title === 'Checkmate'
      ? (winner === human ? 'You win' : 'The house wins') : 'Game over';
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
    const captured = !!state.b[m.to] || m.ep || (state.b[m.from].toLowerCase() === 'p' && (m.from & 7) !== (m.to & 7));
    state = Chess.apply(state, m);
    anim = m;
    sound.play(Chess.inCheck(state, state.turn) ? 'check' : captured ? 'capture' : 'move');
    history.push({ move: m, state: Chess.clone(state) });
    log.push(note);
    selected = -1;
    maybeAI();
    render();
  }

  function maybeAI() {
    if (mode !== 'ai' || state.turn === human || Chess.result(state)) return;
    const token = ++aiGen;
    thinking = 1;
    setTimeout(() => {
      if (token !== aiGen) return;
      const m = Chess.bestMove(state, 3);
      thinking = 0;
      if (!m) { render(); return; }
      play(m);
    }, 420);
  }

  function fresh() {
    aiGen++;
    state = Chess.startPos();
    history = [];
    log = [];
    selected = -1;
    thinking = 0;
    promoEl.hidden = true;
    endEl.hidden = true;
    maybeAI();
    render();
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
  document.getElementById('sound').onclick = (e) => {
    const on = sound.toggle();
    e.currentTarget.setAttribute('aria-pressed', String(on));
  };
  const fullBtn = document.getElementById('full');
  if (!document.documentElement.requestFullscreen) fullBtn.hidden = true;
  fullBtn.onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  };
  document.addEventListener('fullscreenchange', () => {
    fullBtn.classList.toggle('on', !!document.fullscreenElement);
  });
  document.getElementById('fresh').onclick = fresh;
  document.getElementById('endAgain').onclick = fresh;
  render();
  window.__check = { Chess, get state() { return state; }, play, fresh };
})();
