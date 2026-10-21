'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = { p1: freshPad(), p2: freshPad() };
const keys = new Set();

let save = loadSave();
let mode = 'race';
let race = null;
let resultsShown = false;
let paused = false;
let dpr = 1;
let last = performance.now();
let arcLen = 220;
let wipeArm = false;

const $ = id => document.getElementById(id);
const screens = ['menu', 'modes', 'tracks', 'garage', 'records', 'help'];

function freshPad() {
  return { gas: false, brake: false, back: false, fore: false, chute: false, nitro: false, jumpEdge: false, resetEdge: false };
}

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
}

function show(name) {
  for (const id of screens) {
    const el = $('scr-' + id);
    if (el) el.classList.toggle('hidden', id !== name);
  }
  $('pause').classList.add('hidden');
  if (name !== 'results') $('results').classList.add('hidden');
  document.body.classList.toggle('in-menu', name !== 'race');
}

function setAccent(track) {
  document.documentElement.style.setProperty('--accent', track ? track.accent : '#d6ff4a');
}

function bootDemo() {
  paused = false;
  resultsShown = false;
  const track = trackById('pine');
  setAccent(track);
  race = new Race({
    mode: 'demo', track, vehicle: vehicleById('cross'), name: 'RIDGE', ghost: [],
  });
  document.body.classList.remove('playing', 'duel', 'touching');
  $('hud').classList.add('hidden');
  $('touch').classList.add('hidden');
  show('menu');
  paintWallet();
}

function startRun() {
  Sound.init();
  Sound.musicStart();
  const track = trackById(modeTrack());
  const vehicle = vehicleById(save.vehicle);
  const ghost = (save.best[track.id] && save.best[track.id].ghost) || [];
  paused = false;
  resultsShown = false;
  wipeArm = false;
  setAccent(track);
  race = new Race({
    mode, track, vehicle, name: save.name || 'RIDER', ghost,
  });
  document.body.classList.add('playing');
  document.body.classList.toggle('duel', mode === 'duel');
  $('hud').classList.remove('hidden');
  const touchOn = wantTouch();
  $('touch').classList.toggle('hidden', !touchOn);
  document.body.classList.toggle('touching', touchOn);
  $('results').classList.add('hidden');
  $('pause').classList.add('hidden');
  for (const id of screens) $('scr-' + id).classList.add('hidden');
  $('hint').classList.remove('fade');
  setTimeout(() => { const h = $('hint'); if (h) h.classList.add('fade'); }, 5200);
  syncModeCopy();
  paintWallet();
}

function modeTrack() {
  const picked = document.querySelector('.tcard.selected');
  return picked ? picked.dataset.id : 'pine';
}

function wantTouch() {
  return window.matchMedia('(pointer: coarse)').matches || innerWidth < 900;
}

function paintWallet() {
  $('credits').textContent = money(save.credits);
  const name = $('rider-name');
  if (name && document.activeElement !== name) name.value = save.name;
}

function syncModeCopy() {
  const labels = { race: 'RACE', time: 'TIME TRIAL', free: 'FREERIDE', duel: 'DUEL' };
  $('mode-pill').textContent = labels[mode] || 'RACE';
  $('track-pill').textContent = race.track.name;
  $('best-line').textContent = '';
  const best = save.best[race.track.id];
  if (mode === 'time' && best && best.time) $('best-line').textContent = 'BEST ' + fmtTime(best.time);
  $('hud-guest').classList.toggle('hidden', mode !== 'duel');
  const hint = $('hint');
  hint.textContent = mode === 'duel'
    ? 'P1  D gas · A brake · W back · S nose · Space jump · Shift boost · E chute     P2  arrows · O jump · P chute · L boost'
    : 'D / → gas    A / ← brake    W / ↑ lean back    S / ↓ nose    Space jump    Shift boost    E chute    R reset';
}

function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (race && !paused && race.phase !== 'done') race.update(dt, input);
  if (race) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    race.draw(ctx, innerWidth, innerHeight);
  }
  if (race && document.body.classList.contains('playing')) {
    syncHud();
    const hear = race.phase === 'run' && !paused;
    Sound.engineSet(race.player.speed, input.p1.gas, race.player.nitroOn, hear);
  } else {
    Sound.engineSet(0, false, false, false);
  }
  if (race && race.phase === 'done' && race.mode !== 'demo' && !resultsShown) openResults();
  requestAnimationFrame(frame);
}

function syncHud() {
  const p = race.player;
  const total = race.riders.length;
  $('place').textContent = ordinal(p.livePlace);
  $('place-total').textContent = mode === 'race' ? 'of ' + total : mode === 'duel' ? 'of 2' : 'solo';
  $('timer').textContent = fmtTime(race.phase === 'countdown' ? 0 : race.time);
  $('gems').textContent = String(p.gems);
  $('score').textContent = String(p.score);
  $('combo').textContent = p.combo > 1 ? '×' + p.combo : '';
  $('combo').classList.toggle('on', p.combo > 1);
  const kmh = Math.max(0, Math.round(p.speed * 0.22));
  $('spd').textContent = String(kmh);
  const pct = clamp(p.speed / (p.vehicle.max * 1.15), 0, 1);
  $('spd-arc').style.strokeDashoffset = String(arcLen * (1 - pct));
  $('nitro-fill').style.width = p.boost + '%';
  $('chute-ind').classList.toggle('on', p.chute);
  $('air-ind').classList.toggle('on', !p.grounded && p.crashT <= 0);
  const prog = clamp(p.x / race.finishX, 0, 1);
  $('prog').style.width = (prog * 100) + '%';
  positionDots();
  if (mode === 'time') {
    const g = race.ghostAt(race.time);
    if (g) {
      const dx = Math.round((p.x - g.x) / 16);
      $('best-line').textContent = (dx >= 0 ? '+' : '') + dx + 'm vs best';
    }
  }
  if (race.guest) {
    $('guest-place').textContent = ordinal(race.guest.livePlace);
    $('guest-spd').textContent = Math.max(0, Math.round(race.guest.speed * 0.22)) + '';
  }
}

function positionDots() {
  const box = $('dots');
  const kids = box.children;
  if (kids.length !== race.riders.length) {
    box.innerHTML = '';
    race.riders.forEach(r => {
      const i = document.createElement('i');
      i.className = r.human ? (r.guest ? 'guest' : 'me') : '';
      i.title = r.name;
      box.appendChild(i);
    });
  }
  race.riders.forEach((r, i) => {
    kids[i].style.left = clamp(r.x / race.finishX, 0, 1) * 100 + '%';
  });
}

function openResults() {
  resultsShown = true;
  Sound.engineSet(0, false, false, false);
  const track = race.track;
  const p = race.player;
  const prev = save.best[track.id] || {};
  const firstClear = !save.cleared.includes(track.id);
  if (p.done && !save.cleared.includes(track.id)) save.cleared.push(track.id);

  let pay = 0;
  let medal = null;
  if (mode === 'race') {
    const mult = [1, 0.55, 0.32, 0.16][Math.min(3, (p.place || p.livePlace) - 1)];
    pay = Math.round(track.reward * mult + p.gems * 25 + p.score * 0.04);
  } else if (mode === 'time') {
    medal = medalFor(track, p.finishTime);
    const bonus = medal === 'gold' ? 300 : medal === 'silver' ? 150 : medal === 'bronze' ? 80 : 0;
    pay = Math.round(track.reward * 0.4 + bonus + p.gems * 25);
  } else if (mode === 'free') {
    pay = Math.round(p.gems * 40 + p.score * 0.08 + 40);
  } else if (mode === 'duel') {
    pay = (p.place || p.livePlace) === 1 ? 140 : 50;
  }
  save.credits += pay;

  let bestNote = '';
  if (p.finishTime != null && (mode === 'race' || mode === 'time' || mode === 'free')) {
    const better = prev.time == null || p.finishTime < prev.time;
    if (better) {
      save.best[track.id] = {
        time: p.finishTime,
        score: Math.max(prev.score || 0, p.score),
        gems: Math.max(prev.gems || 0, p.gems),
        ghost: mode === 'time' ? race.recording : prev.ghost,
      };
      bestNote = prev.time == null ? 'First mark on this ridge.' : 'New best, ' + fmtTime(prev.time - p.finishTime) + ' quicker.';
    } else {
      save.best[track.id] = Object.assign({}, prev, {
        score: Math.max(prev.score || 0, p.score),
        gems: Math.max(prev.gems || 0, p.gems),
      });
      bestNote = 'Best remains ' + fmtTime(prev.time) + '.';
    }
  }
  writeSave(save);
  paintWallet();
  $('credits').classList.add('pop');
  setTimeout(() => $('credits').classList.remove('pop'), 500);

  const place = p.place || p.livePlace;
  $('res-kicker').textContent = track.region + '  ·  ' + track.name;
  if (mode === 'time') {
    $('res-title').textContent = medal ? medal.toUpperCase() + ' RUN' : 'TIME SET';
  } else if (mode === 'free') {
    $('res-title').textContent = 'SESSION CLOSED';
  } else if (mode === 'duel') {
    $('res-title').textContent = place === 1 ? 'YOU TOOK THE DROP' : 'GUEST TOOK THE DROP';
  } else {
    $('res-title').textContent = place === 1 ? 'YOU TOOK THE RIDGE' : ordinal(place) + ' PLACE';
  }
  $('res-place').textContent = mode === 'free' || mode === 'time' ? fmtTime(p.finishTime) : ordinal(place);
  $('res-place-label').textContent = mode === 'free' || mode === 'time' ? 'Time' : 'Place';
  $('res-time').textContent = fmtTime(p.finishTime);
  $('res-score').textContent = String(p.score);
  $('res-gems').textContent = String(p.gems);
  $('res-pay').textContent = '+' + money(pay);
  $('res-note').textContent = bestNote || (firstClear ? 'Next ridge is open.' : '');
  const medalEl = $('res-medal');
  medalEl.className = 'medal ' + (medal || 'none');
  medalEl.textContent = medal ? medal[0].toUpperCase() : '–';

  const list = $('res-list');
  list.innerHTML = '';
  if (mode === 'race' || mode === 'duel') {
    const rows = race.riders.slice().sort((a, b) => a.livePlace - b.livePlace);
    for (const r of rows) {
      const li = document.createElement('li');
      const mark = r.finishTime ? fmtTime(r.finishTime) : Math.max(0, Math.round((race.finishX - r.x) / 16)) + 'm back';
      li.innerHTML = '<b>' + ordinal(r.livePlace) + '</b><span>' + r.name + '</span><em>' + mark + '</em>';
      if (r.human && !r.guest) li.classList.add('me');
      list.appendChild(li);
    }
  }
  $('results').classList.remove('hidden');
  Sound.fx.select();
}

function renderTracks() {
  const grid = $('track-grid');
  grid.innerHTML = '';
  TRACKS.forEach((t, i) => {
    const open = isUnlocked(save, t);
    const best = save.best[t.id];
    const card = document.createElement('button');
    card.className = 'tcard' + (open ? '' : ' lock') + (i === 0 ? ' selected' : '');
    card.dataset.id = t.id;
    card.disabled = !open;
    const medal = best && best.time ? medalFor(t, best.time) : null;
    card.innerHTML =
      '<div class="t-top"><span class="diff">' + '●'.repeat(t.diff) + '<i>' + '●'.repeat(5 - t.diff) + '</i></span>' +
      '<span class="km">' + (t.length / 2500).toFixed(1) + ' km</span></div>' +
      '<h3>' + t.name + '</h3><p>' + t.region + '</p>' +
      '<svg class="spark" viewBox="0 0 240 56" aria-hidden="true"><path d="' + elevationPath(t) + '"/></svg>' +
      '<div class="t-bot"><span class="medal-pip ' + (medal || '') + '">' + (medal ? medal : (open ? 'no medal' : 'locked')) + '</span>' +
      '<b>' + (best && best.time ? fmtTime(best.time) : '—') + '</b></div>';
    card.addEventListener('click', () => {
      if (!open) return;
      grid.querySelectorAll('.tcard').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      Sound.fx.click();
    });
    grid.appendChild(card);
  });
}

function elevationPath(track) {
  const terrain = buildTerrain(track);
  const w = 240, h = 56, pad = 4, N = 64;
  let min = Infinity, max = -Infinity;
  const ys = [];
  for (let i = 0; i <= N; i++) {
    const y = yAt(terrain, track.length * i / N);
    ys.push(y);
    if (y < min) min = y;
    if (y > max) max = y;
  }
  const span = Math.max(1, max - min);
  let d = '';
  ys.forEach((y, i) => {
    const x = pad + (w - pad * 2) * i / N;
    const yy = h - pad - ((y - min) / span) * (h - pad * 2);
    d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + yy.toFixed(1) + ' ';
  });
  return d;
}

function renderGarage() {
  const grid = $('garage-grid');
  grid.innerHTML = '';
  const maxes = { max: 0, accel: 0, grip: 0, air: 0, boost: 0 };
  VEHICLES.forEach(v => { for (const k in maxes) maxes[k] = Math.max(maxes[k], v[k]); });
  VEHICLES.forEach(v => {
    const owned = save.owned.includes(v.id);
    const equipped = save.vehicle === v.id;
    const card = document.createElement('article');
    card.className = 'vcard' + (equipped ? ' equipped' : '');
    const bars = [
      ['Speed', v.max / maxes.max],
      ['Pull', v.accel / maxes.accel],
      ['Grip', v.grip / maxes.grip],
      ['Air', v.air / maxes.air],
      ['Boost', v.boost / maxes.boost],
    ].map(([label, pct]) =>
      '<div class="bar"><span>' + label + '</span><i><b style="width:' + (pct * 100) + '%;background:' + v.color + '"></b></i></div>'
    ).join('');
    let action = 'BUY  ' + money(v.price);
    let disabled = false;
    if (equipped) { action = 'RIDING'; disabled = true; }
    else if (owned) action = 'RIDE THIS';
    else if (save.credits < v.price) { action = 'NEED  ' + money(v.price); disabled = true; }
    card.innerHTML =
      '<canvas class="preview" width="280" height="120"></canvas>' +
      '<div class="vbody"><div class="vtitle"><h3>' + v.name + '</h3><span>' + v.kind + '</span></div>' +
      '<p>' + v.blurb + '</p>' + bars +
      '<button class="btn ' + (disabled ? '' : 'primary') + '" ' + (disabled ? 'disabled' : '') + '>' + action + '</button></div>';
    const c = card.querySelector('canvas');
    paintPreview(c.getContext('2d'), v);
    card.querySelector('button').addEventListener('click', () => {
      if (!owned) {
        if (save.credits < v.price) return;
        save.credits -= v.price;
        save.owned.push(v.id);
        Sound.fx.buy();
      } else Sound.fx.select();
      save.vehicle = v.id;
      writeSave(save);
      paintWallet();
      renderGarage();
    });
    grid.appendChild(card);
  });
}

function paintPreview(g, v) {
  g.clearRect(0, 0, 280, 120);
  const bg = g.createLinearGradient(0, 0, 0, 120);
  bg.addColorStop(0, '#10202a');
  bg.addColorStop(1, '#070d12');
  g.fillStyle = bg;
  g.fillRect(0, 0, 280, 120);
  g.fillStyle = 'rgba(214,255,74,.15)';
  g.fillRect(0, 92, 280, 2);
  g.save();
  g.translate(140, 68);
  g.scale(1.35, 1.35);
  const fake = { vehicle: v, wheelSpin: 0.4, tuck: 0, nitroOn: false, speed: 400, angle: 0 };
  if (v.kind === 'atv') drawATV(g, fake, 0);
  else if (v.kind === 'boat') drawBoat(g, fake, 1);
  else drawBike(g, fake, 0);
  g.restore();
}

function renderRecords() {
  const list = $('records-list');
  list.innerHTML = '';
  TRACKS.forEach(t => {
    const best = save.best[t.id];
    const medal = best && best.time ? medalFor(t, best.time) : null;
    const li = document.createElement('li');
    li.innerHTML =
      '<div><b>' + t.name + '</b><span>' + t.region + '</span></div>' +
      '<em class="medal-pip ' + (medal || '') + '">' + (medal || '—') + '</em>' +
      '<strong>' + (best && best.time ? fmtTime(best.time) : '—') + '</strong>' +
      '<span>' + (best ? best.score + ' stunt' : '—') + '</span>' +
      '<span>' + (best ? best.gems + ' gems' : '—') + '</span>';
    list.appendChild(li);
  });
}

function togglePause() {
  if (!document.body.classList.contains('playing')) return;
  if (race && (race.phase === 'done' || race.phase === 'finish')) return;
  paused = !paused;
  $('pause').classList.toggle('hidden', !paused);
  if (paused) Sound.engineSet(0, false, false, false);
}

function readPads() {
  const duel = race && race.mode === 'duel' && document.body.classList.contains('playing');
  const p1 = input.p1;
  const p2 = input.p2;
  p1.gas = keys.has('d') || (!duel && keys.has('arrowright'));
  p1.brake = keys.has('a') || (!duel && keys.has('arrowleft'));
  p1.back = keys.has('w') || (!duel && keys.has('arrowup'));
  p1.fore = keys.has('s') || (!duel && keys.has('arrowdown'));
  p1.chute = keys.has('e');
  p1.nitro = keys.has('shift');
  p2.gas = duel && keys.has('arrowright');
  p2.brake = duel && keys.has('arrowleft');
  p2.back = duel && keys.has('arrowup');
  p2.fore = duel && keys.has('arrowdown');
  p2.chute = duel && keys.has('p');
  p2.nitro = duel && keys.has('l');
}

window.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea')) return;
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (e.repeat) return;
  keys.add(k);
  readPads();
  if (k === ' ' || k === 'q') input.p1.jumpEdge = true;
  if (k === 'r') input.p1.resetEdge = true;
  if (k === 'o') input.p2.jumpEdge = true;
  if (k === 'backspace') input.p2.resetEdge = true;
  if (k === 'escape') {
    if (!$('results').classList.contains('hidden')) return;
    if (document.body.classList.contains('playing')) togglePause();
  }
  if (k === 'm') toggleSound(false);
  if (k === 'enter' && ($('scr-menu') && !$('scr-menu').classList.contains('hidden'))) {
    document.querySelector('#scr-menu .btn.primary')?.click();
  }
});
window.addEventListener('keyup', e => {
  keys.delete(e.key.toLowerCase());
  readPads();
});
window.addEventListener('blur', () => { keys.clear(); readPads(); });

function bindTouch() {
  document.querySelectorAll('#touch [data-act]').forEach(btn => {
    const act = btn.dataset.act;
    const down = e => {
      e.preventDefault();
      if (act === 'jump') input.p1.jumpEdge = true;
      else if (act === 'reset') input.p1.resetEdge = true;
      else input.p1[act] = true;
    };
    const up = e => {
      e.preventDefault();
      if (act === 'gas' || act === 'brake' || act === 'back' || act === 'fore' || act === 'chute' || act === 'nitro') {
        input.p1[act] = false;
      }
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('pointercancel', up);
  });
}

function toggleSound(music) {
  Sound.init();
  if (music) {
    const on = Sound.toggleMusic();
    $('btn-music').classList.toggle('off', !on);
    $('btn-music').textContent = on ? '♪' : '♪';
  } else {
    const muted = Sound.toggleMute();
    $('btn-sound').classList.toggle('off', muted);
    $('btn-sound').textContent = muted ? '🔇' : '🔊';
  }
}

function wire() {
  document.body.addEventListener('pointerdown', () => { Sound.init(); Sound.musicStart(); }, { once: false });
  $('btn-sound').addEventListener('click', () => toggleSound(false));
  $('btn-music').addEventListener('click', () => toggleSound(true));
  $('btn-sound').classList.toggle('off', Sound.muted);
  $('btn-music').classList.toggle('off', !Sound.music);
  if (Sound.muted) $('btn-sound').textContent = '🔇';
  $('btn-full').addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  });
  document.querySelectorAll('[data-go]').forEach(btn => {
    btn.addEventListener('click', () => {
      Sound.init();
      Sound.fx.click();
      const go = btn.dataset.go;
      if (go === 'modes') show('modes');
      else if (go === 'menu') {
        if (document.body.classList.contains('playing')) bootDemo();
        else show('menu');
      } else if (go === 'garage') { renderGarage(); show('garage'); }
      else if (go === 'records') { renderRecords(); show('records'); }
      else if (go === 'help') show('help');
      else if (go === 'tracks') { renderTracks(); show('tracks'); }
    });
  });
  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      Sound.fx.select();
      renderTracks();
      show('tracks');
    });
  });
  $('btn-drop').addEventListener('click', () => {
    const card = document.querySelector('.tcard.selected');
    if (!card || card.disabled) return;
    Sound.fx.select();
    startRun();
  });
  $('btn-retry').addEventListener('click', () => { Sound.fx.click(); startRun(); });
  $('btn-again-tracks').addEventListener('click', () => {
    Sound.fx.click();
    bootDemo();
    renderTracks();
    show('tracks');
  });
  $('btn-resume').addEventListener('click', () => togglePause());
  $('btn-restart').addEventListener('click', () => { paused = false; startRun(); });
  $('btn-quit').addEventListener('click', () => bootDemo());
  $('btn-pause').addEventListener('click', () => togglePause());
  $('rider-name').addEventListener('change', () => {
    save.name = ($('rider-name').value || 'RIDER').trim().slice(0, 12) || 'RIDER';
    writeSave(save);
  });
  $('btn-wipe').addEventListener('click', () => {
    if (!wipeArm) {
      wipeArm = true;
      $('btn-wipe').textContent = 'Click again to wipe';
      setTimeout(() => { wipeArm = false; $('btn-wipe').textContent = 'Reset progress'; }, 2400);
      return;
    }
    save = defaultSave();
    writeSave(save);
    paintWallet();
    renderRecords();
    Sound.fx.wipe();
    wipeArm = false;
    $('btn-wipe').textContent = 'Reset progress';
  });
  bindTouch();
}

resize();
window.addEventListener('resize', resize);
wire();
paintWallet();
const arc = $('spd-arc');
arcLen = arc.getTotalLength() || 144.5;
if (arcLen < 20) arcLen = 144.5;
arc.style.strokeDasharray = String(arcLen);
arc.style.strokeDashoffset = String(arcLen);
bootDemo();
requestAnimationFrame(frame);

window.__RF = {
  get race() { return race; },
  get save() { return save; },
  input,
  start(m, id) { mode = m; renderTracks(); const card = document.querySelector('.tcard[data-id="' + id + '"]'); if (card) { document.querySelectorAll('.tcard').forEach(c => c.classList.remove('selected')); card.classList.add('selected'); } startRun(); },
};
