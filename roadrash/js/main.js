'use strict';
/* ---------- App shell: menus, career save, garage and the main loop ---------- */
(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  let k = 1;
  function resize() {
    const nk = Math.min(window.devicePixelRatio || 1, 1.5);
    if (nk === k && canvas.width === VW * nk) return;
    k = nk; canvas.width = VW * k; canvas.height = VH * k;
  }
  k = 0; resize();
  addEventListener('resize', resize);
  Input.init();

  /* ---------- save ---------- */
  const SAVE_KEY = 'roadfury_save_v1';
  const fresh = () => ({
    name: '', money: 500, level: 1, qualified: {}, bike: 'sparrow', owned: ['sparrow'], hp: { sparrow: 100 },
    best: {}, champion: false,
    stats: { races: 0, wins: 0, podiums: 0, kos: 0, busts: 0, wrecks: 0, earned: 0 },
  });
  const Save = {
    d: fresh(),
    load() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) this.d = Object.assign(fresh(), s); } catch (e) { } },
    store() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.d)); } catch (e) { } },
    reset() { this.d = fresh(); this.store(); },
    get bike() { return BIKES.find(b => b.id === this.d.bike) || BIKES[0]; },
    get hp() { return this.d.hp[this.d.bike] ?? 100; },
    set hp(v) { this.d.hp[this.d.bike] = Math.round(v); },
  };
  Save.load();
  const repairCost = () => Math.round((100 - Save.hp) / 100 * (300 + Save.bike.price * 0.1));

  /* ---------- screens ---------- */
  const overlay = $('overlay'), touch = $('touch');
  const isTouch = matchMedia('(pointer: coarse)').matches;
  let race = null, mode = 'menu', lastOpts = null, garageBack = 'menu';
  const quick = { track: 0, bike: 'ronin', level: 2 };

  function show(id) {
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    if (id) { $(id).classList.remove('hidden'); overlay.classList.remove('clear'); overlay.scrollTop = 0; }
    else overlay.classList.add('clear');
    touch.classList.toggle('hidden', !(isTouch && !id && mode === 'race'));
    const inCareer = ['p-career', 'p-garage'].includes(id) && Save.d.name;
    $('wallet').classList.toggle('hidden', !inCareer);
    $('wallet').textContent = U.money(Save.d.money);
  }

  function demo() {
    race = new Race({ track: U.pick(TRACKS), level: U.randInt(2, 5), bike: BIKES[U.randInt(3, 6)], mode: 'demo' });
  }

  function go(where) {
    Sound.fx.select();
    if (where === 'menu') { show('p-menu'); return; }
    if (where === 'career') { if (!Save.d.name) { show('p-name'); setTimeout(() => $('name-input').focus(), 50); } else { renderCareer(); show('p-career'); } return; }
    if (where === 'quick') { renderQuick(); show('p-quick'); return; }
    if (where === 'garage') { garageBack = $('p-career').classList.contains('hidden') ? 'menu' : 'career'; renderGarage(); show('p-garage'); return; }
    if (where === 'records') { renderRecords(); show('p-records'); return; }
    if (where === 'howto') show('p-howto');
  }
  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
  $('garage-back').addEventListener('click', () => go(garageBack));

  $('name-form').addEventListener('submit', e => {
    e.preventDefault();
    const n = $('name-input').value.trim().toUpperCase().slice(0, 12);
    if (!n) return;
    Save.d.name = n; Save.store();
    go('career');
  });

  /* ---------- track thumbnails, rendered with the real engine ---------- */
  const thumbs = {};
  function thumb(def) {
    if (thumbs[def.id]) return thumbs[def.id];
    const r = new Race({ track: def, level: 3, bike: BIKES[5], mode: 'demo' });
    const segs = r.track.segments;
    let i = r.track.startIndex + 300;
    while (i < segs.length - 400 && Math.abs(segs[i + 25].curve) < 2) i++;
    const z = i * ROAD.segLen, p = r.player;
    r.riders.forEach(o => { o.z = -1e6; });
    p.z = z; p.x = 0.15; p.lean = -0.12; p.speed = p.maxSpeed;
    r.rivals[0].z = z + 900; r.rivals[0].x = -0.45; r.rivals[0].attackT = 0.3; r.rivals[0].attackSide = 1;
    r.rivals[1].z = z + 2600; r.rivals[1].x = 0.5;
    r.camX = p.x * ROAD.width; r.lastZ = z;
    const big = document.createElement('canvas'); big.width = VW; big.height = VH;
    r.render(big.getContext('2d'));
    const sm = document.createElement('canvas'); sm.width = 400; sm.height = 225;
    sm.getContext('2d').drawImage(big, 0, 0, 400, 225);
    return (thumbs[def.id] = sm.toDataURL('image/jpeg', 0.82));
  }

  function trackCard(def, { badge, ok, best, sel, disabled }) {
    const b = document.createElement('button');
    b.className = 'track' + (sel ? ' sel' : '');
    b.style.setProperty('--art', `url(${thumb(def)}) center/cover`);
    b.innerHTML = `${badge ? `<span class="badge ${ok ? 'ok' : ''}">${badge}</span>` : ''}
      <h3>${def.name}</h3><p>${def.desc}</p>${best ? `<span class="best">🏆 ${U.formatTime(best)}</span>` : ''}`;
    if (disabled) b.disabled = true;
    return b;
  }

  /* ---------- career hub ---------- */
  function renderCareer() {
    const d = Save.d, bike = Save.bike, hp = Save.hp;
    $('hub-level').textContent = d.level;
    $('hub-name').textContent = d.champion ? `${d.name} · 👑 CHAMPION` : d.name;
    $('hub-pips').innerHTML = LEVELS.map(l => `<i class="${l.n <= d.level ? 'on' : ''}"></i>`).join('');
    $('hub-money').textContent = U.money(d.money);
    $('hub-bike').textContent = bike.name;
    $('hub-hp').textContent = hp + '%';
    $('hub-hp').style.color = hp < 35 ? 'var(--hot)' : hp < 70 ? 'var(--gold)' : 'var(--green)';
    const cost = repairCost();
    $('hub-repair').classList.toggle('hidden', hp >= 100);
    if (hp < 100) {
      const can = d.money >= cost;
      $('repair-text').textContent = hp <= 0 ? `Your ${bike.name} is wrecked. Repair it before racing.` : `Bike condition ${hp}%. Fix it up so it survives more crashes.`;
      $('btn-repair').textContent = can ? `REPAIR ${U.money(cost)}` : `REPAIR (ALL CASH ${U.money(d.money)})`;
    }
    const grid = $('career-tracks'); grid.innerHTML = '';
    TRACKS.forEach(t => {
      const q = !!d.qualified[t.id];
      const card = trackCard(t, { badge: q ? '✓ QUALIFIED' : 'TOP 3 NEEDED', ok: q, best: d.best[t.id], disabled: hp <= 0 });
      card.addEventListener('click', () => startRace({ track: t, level: d.level, bike: Save.bike, mode: 'career', bikeHP: Save.hp, name: d.name }));
      grid.appendChild(card);
    });
    $('wallet').textContent = U.money(d.money);
  }
  $('btn-repair').addEventListener('click', () => {
    const cost = Math.min(repairCost(), Save.d.money);
    Save.d.money -= cost; Save.hp = 100; Save.store();
    Sound.fx.cash(); renderCareer();
  });

  /* ---------- quick race ---------- */
  function renderQuick() {
    const grid = $('quick-tracks'); grid.innerHTML = '';
    TRACKS.forEach((t, i) => {
      const c = trackCard(t, { sel: i === quick.track, best: Save.d.best[t.id] });
      c.addEventListener('click', () => { quick.track = i; Sound.fx.click(); renderQuick(); });
      grid.appendChild(c);
    });
    const sel = $('quick-bike');
    sel.innerHTML = BIKES.map(b => `<option value="${b.id}" ${b.id === quick.bike ? 'selected' : ''}>${b.name}${b.nitro ? ' ⚡' : ''}</option>`).join('');
    $('quick-level').innerHTML = LEVELS.map(l => `<button role="radio" aria-checked="${l.n === quick.level}" class="${l.n === quick.level ? 'on' : ''}" data-l="${l.n}">LV ${l.n}</button>`).join('');
    $('quick-level').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { quick.level = +b.dataset.l; Sound.fx.click(); renderQuick(); }));
  }
  $('quick-bike').addEventListener('change', e => { quick.bike = e.target.value; });
  $('btn-quick-go').addEventListener('click', () => startRace({
    track: TRACKS[quick.track], level: quick.level, bike: BIKES.find(b => b.id === quick.bike), mode: 'quick', bikeHP: 100, name: Save.d.name || 'YOU',
  }));

  /* ---------- garage ---------- */
  function renderGarage() {
    const d = Save.d, wrap = $('bikes');
    $('garage-money').textContent = U.money(d.money);
    wrap.innerHTML = '';
    const norm = (v, a, b) => Math.round(U.clamp((v - a) / (b - a), 0.05, 1) * 100) + '%';
    BIKES.forEach(b => {
      const owned = d.owned.includes(b.id), cur = d.bike === b.id;
      const el = document.createElement('div');
      el.className = 'bike' + (cur ? ' current' : '') + (owned ? '' : ' locked');
      const cv = document.createElement('canvas'); cv.width = 380; cv.height = 220;
      cv.getContext('2d').drawImage(Sprites.bikeSide(b).c, 0, 0);
      el.appendChild(cv);
      el.insertAdjacentHTML('beforeend', `
        <h3>${b.name} <small>${b.cls}${b.nitro ? ` · ${b.nitro}× N₂O` : ''}</small></h3>
        <p>${b.blurb}</p>
        <div class="stats">
          <span>Top speed</span><i style="--v:${norm(b.top, 0.72, 1.1)}"></i>
          <span>Accel</span><i style="--v:${norm(b.accel, 0.72, 1.07)}"></i>
          <span>Handling</span><i style="--v:${norm(b.handling, 0.8, 1.02)}"></i>
          <span>Armor</span><i style="--v:${norm(b.armor, 0.7, 1.32)}"></i>
        </div>`);
      const btn = document.createElement('button');
      btn.className = 'btn btn-small' + (!owned && d.money >= b.price ? ' btn-primary' : '');
      if (cur) { btn.textContent = `RIDING · ${Save.hp}%`; btn.disabled = true; }
      else if (owned) { btn.textContent = 'SELECT'; btn.onclick = () => { d.bike = b.id; Save.store(); Sound.fx.select(); renderGarage(); }; }
      else {
        btn.textContent = `BUY ${U.money(b.price)}`;
        btn.disabled = d.money < b.price || !d.name;
        if (!d.name) btn.title = 'Start a career first';
        btn.onclick = () => { d.money -= b.price; d.owned.push(b.id); d.bike = b.id; d.hp[b.id] = 100; Save.store(); Sound.fx.cash(); renderGarage(); };
      }
      el.appendChild(btn);
      wrap.appendChild(el);
    });
    $('wallet').textContent = U.money(d.money);
  }

  /* ---------- records ---------- */
  function renderRecords() {
    const d = Save.d, s = d.stats;
    const rows = TRACKS.map(t => `<div class="rec"><span>${t.name}</span><b>${d.best[t.id] ? U.formatTime(d.best[t.id]) : '--:--.--'}</b></div>`).join('');
    const st = [['Rider', d.name || '—'], ['Level', d.level + (d.champion ? ' 👑' : '')], ['Races', s.races], ['Wins', s.wins], ['Podiums', s.podiums], ['Knockouts', s.kos], ['Busted', s.busts], ['Bikes wrecked', s.wrecks], ['Total earned', U.money(s.earned)]]
      .map(([a, b]) => `<div class="rec"><span>${a}</span><b>${b}</b></div>`).join('');
    $('records').innerHTML = `<h3>BEST TIMES</h3>${rows}<h3>CAREER</h3>${st}`;
  }
  $('btn-reset').addEventListener('click', () => {
    if ($('btn-reset').dataset.confirm) { Save.reset(); delete $('btn-reset').dataset.confirm; $('btn-reset').textContent = 'RESET CAREER'; renderRecords(); return; }
    $('btn-reset').dataset.confirm = '1'; $('btn-reset').textContent = 'TAP AGAIN TO CONFIRM';
  });

  /* ---------- race flow ---------- */
  function startRace(opts) {
    Sound.init(); Sound.fx.select();
    lastOpts = opts;
    race = new Race(opts);
    mode = 'race';
    show(null);
    Sound.engineStart(); Sound.musicStart();
  }
  function pause() {
    if (mode !== 'race') return;
    mode = 'paused'; Sound.engineStop(); Sound.sirenSet(0);
    show('p-pause');
  }
  function resume() { mode = 'race'; show(null); Sound.engineStart(); }
  function quit() {
    Sound.engineStop(); Sound.sirenSet(0);
    mode = 'menu';
    const wasCareer = lastOpts && lastOpts.mode === 'career';
    demo();
    if (wasCareer) { renderCareer(); show('p-career'); } else show('p-menu');
  }
  $('btn-resume').addEventListener('click', resume);
  $('btn-restart').addEventListener('click', () => {
    if (lastOpts.mode === 'career') lastOpts.bikeHP = Save.hp;
    startRace(lastOpts);
  });
  $('btn-quit').addEventListener('click', quit);
  $('t-pause').addEventListener('click', pause);

  function applyCareer(res, def) {
    const d = Save.d, lines = [];
    d.stats.races++; d.stats.kos += res.kos;
    if (res.earned) lines.push(['Prize & KO bonuses', res.earned]);
    d.money += res.earned; d.stats.earned += res.earned;
    if (res.kind === 'busted') { const f = Math.min(d.money, res.fine); d.money -= f; lines.push(['Police fine', -f]); d.stats.busts++; }
    if (res.kind === 'wrecked') d.stats.wrecks++;
    Save.hp = res.bikeHP;
    let levelUp = null;
    if (res.kind === 'finished') {
      if (res.place === 1) d.stats.wins++;
      if (res.place <= 3) { d.stats.podiums++; d.qualified[def.id] = true; }
      if (res.time && (!d.best[def.id] || res.time < d.best[def.id])) d.best[def.id] = res.time;
      if (TRACKS.every(t => d.qualified[t.id])) {
        const bonus = 2500 * d.level;
        d.money += bonus; lines.push([`Level ${d.level} complete bonus`, bonus]);
        if (d.level < LEVELS.length) { d.level++; d.qualified = {}; levelUp = `🏁 LEVEL ${d.level} UNLOCKED: faster rivals, more traffic${LEVELS[d.level - 1].cops > LEVELS[d.level - 2].cops ? ', more cops' : ''}`; }
        else { d.champion = true; d.qualified = {}; levelUp = '👑 YOU ARE THE CHAMPION OF THE ROAD 👑'; }
      }
    }
    Save.store();
    return { lines, levelUp };
  }

  function showResults(res) {
    mode = 'results';
    Sound.engineStop(); Sound.sirenSet(0);
    const career = lastOpts.mode === 'career';
    if (!career && res.kind === 'finished' && res.time && (!Save.d.best[lastOpts.track.id] || res.time < Save.d.best[lastOpts.track.id])) {
      Save.d.best[lastOpts.track.id] = res.time; Save.store();
    }
    const out = career ? applyCareer(res, lastOpts.track) : { lines: [], levelUp: null };
    const title = $('res-title');
    title.classList.toggle('bad', res.kind !== 'finished');
    title.textContent = res.kind === 'busted' ? 'BUSTED!' : res.kind === 'wrecked' ? 'WRECKED' : `${res.place}${U.ordinal(res.place)} PLACE`;
    $('res-sub').textContent = res.kind === 'finished'
      ? `${lastOpts.track.name} · ${U.formatTime(res.time)} · ${res.kos} KO${res.kos === 1 ? '' : 's'}${career ? (res.place <= 3 ? ' · Qualified ✓' : ' · Not qualified') : ''}`
      : res.kind === 'busted' ? 'The cops caught you on the ground.' : 'Your bike is scrap. Repair it in the career hub.';
    $('res-table').innerHTML = res.rows.map(r => `<li class="${r.isPlayer ? 'me' : ''}"><span class="dot" style="background:${r.color}"></span><span>${r.name}</span><span class="t">${r.time ? U.formatTime(r.time) : '—'}</span></li>`).join('');
    const total = out.lines.reduce((a, l) => a + l[1], 0);
    $('res-money').innerHTML = career ? out.lines.map(([a, b]) => `<div><span>${a}</span><span class="${b < 0 ? 'neg' : ''}">${b < 0 ? '-' : '+'}${U.money(Math.abs(b))}</span></div>`).join('')
      + `<div class="total"><span>Cash</span><span>${U.money(Save.d.money)} <small>(${total >= 0 ? '+' : '-'}${U.money(Math.abs(total))})</small></span></div>` : '';
    $('res-levelup').classList.toggle('hidden', !out.levelUp);
    $('res-levelup').textContent = out.levelUp || '';
    $('btn-retry').disabled = career && Save.hp <= 0;
    if (out.levelUp) Sound.fx.ko();
    show('p-results');
  }
  $('btn-continue').addEventListener('click', () => {
    const career = lastOpts.mode === 'career';
    mode = 'menu'; demo();
    if (career) { renderCareer(); show('p-career'); } else { renderQuick(); show('p-quick'); }
  });
  $('btn-retry').addEventListener('click', () => {
    if (lastOpts.mode === 'career') { lastOpts.level = Save.d.level; lastOpts.bike = Save.bike; lastOpts.bikeHP = Save.hp; }
    startRace(lastOpts);
  });

  /* ---------- top bar ---------- */
  const syncIcons = () => {
    $('btn-sound').textContent = Sound.muted ? '🔇' : '🔊';
    $('btn-music').classList.toggle('off', !Sound.music);
  };
  $('btn-sound').addEventListener('click', () => { Sound.init(); Sound.toggleMute(); syncIcons(); });
  $('btn-music').addEventListener('click', () => { Sound.init(); if (Sound.toggleMusic()) Sound.musicStart(); syncIcons(); });
  const toggleFull = () => {
    const st = $('stage');
    if (document.fullscreenElement) document.exitFullscreen();
    else if (st.requestFullscreen) st.requestFullscreen().catch(() => { });
  };
  $('btn-full').addEventListener('click', toggleFull);
  syncIcons();

  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'KeyP' || e.code === 'Escape') { if (mode === 'race') pause(); else if (mode === 'paused') resume(); }
    if (e.code === 'KeyM') { Sound.init(); Sound.toggleMute(); syncIcons(); }
    if (e.code === 'KeyF') toggleFull();
  });
  const unlock = () => { Sound.init(); Sound.musicStart(); removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock); };
  addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
  addEventListener('blur', () => { if (mode === 'race') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'race') pause(); });

  /* ---------- main loop ---------- */
  const STEP = 1 / 60;
  let acc = 0, last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (race && mode !== 'paused' && mode !== 'results') {
      acc += dt; let n = 0;
      while (acc >= STEP && n < 6) { race.update(STEP); acc -= STEP; n++; }
      if (n) Input.endFrame();
      if (acc > STEP * 6) acc = 0;
    }
    if (race) { ctx.setTransform(k, 0, 0, k, 0, 0); race.render(ctx); }
    if (mode === 'race') { const res = race.finishedResult; if (res) showResults(res); }
    requestAnimationFrame(frame);
  }

  window.RF = { get race() { return race; }, Save };
  demo();
  show('p-menu');
  requestAnimationFrame(frame);
})();
