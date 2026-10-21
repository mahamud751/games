(() => {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const W = 960, H = 540;
  const KEY = 'crease-best';
  let best = Number(localStorage.getItem(KEY) || 0);
  const bestEl = document.getElementById('best');
  const showBest = () => { bestEl.textContent = best ? 'Best ' + best : ''; };
  showBest();

  let runs = 0, wickets = 0, balls = 0, target = 36, log = [];
  let phase = 'menu';
  let round = 0;
  let marker = 0, ballT = 0, shot = null, clock = 0;

  const menu = document.getElementById('menu');
  const end = document.getElementById('end');
  const meter = document.getElementById('meter');
  const mark = document.getElementById('mark');
  const call = document.getElementById('call');

  function start() {
    round++;
    runs = 0; wickets = 0; balls = 0; log = [];
    target = 30 + Math.floor(Math.random() * 15);
    phase = 'bowl';
    shot = null;
    ballT = 0;
    menu.hidden = true;
    end.hidden = true;
    meter.hidden = false;
    call.hidden = true;
    paintBug();
    paintDots();
  }

  function paintBug() {
    document.getElementById('line').textContent = runs + '/' + wickets;
    const over = Math.floor(balls / 6);
    const rem = balls % 6;
    document.getElementById('overs').textContent = over + '.' + rem + ' overs';
    const need = Math.max(0, target - runs);
    document.getElementById('target').textContent = runs >= target ? 'Target reached' : 'Need ' + need + ' off ' + (12 - balls);
  }

  function paintDots() {
    const box = document.getElementById('dots');
    box.innerHTML = log.map(item => '<i class="' + (item.out ? 'w' : item.runs ? 'b' : '') + '">' + (item.out ? 'W' : item.runs) + '</i>').join('');
  }

  function swing() {
    if (phase !== 'bowl' || shot) return;
    const off = Math.abs(marker - 0.5) * 2;
    let result;
    if (off < 0.07) result = { runs: 6, label: 'SIX' };
    else if (off < 0.16) result = { runs: 4, label: 'FOUR' };
    else if (off < 0.3) result = { runs: 2, label: 'TWO' };
    else if (off < 0.46) result = { runs: 1, label: 'ONE' };
    else if (off < 0.68) result = { runs: 0, label: 'DOT' };
    else if (Math.random() < 0.62) result = { out: true, runs: 0, label: 'OUT' };
    else result = { runs: 0, label: 'MISS' };
    resolve(result);
  }

  function resolve(result) {
    shot = result;
    phase = 'show';
    const id = round;
    balls += 1;
    if (result.out) wickets += 1;
    else runs += result.runs;
    log.push(result);
    call.hidden = false;
    call.textContent = result.label;
    call.style.color = result.out ? '#ff8d7a' : result.runs >= 4 ? '#f5d76e' : '#f4f7fb';
    paintBug();
    paintDots();
    if (runs > best) {
      best = runs;
      localStorage.setItem(KEY, String(best));
      showBest();
    }
    if (runs >= target || wickets >= 3 || balls >= 12) {
      setTimeout(() => { if (id === round) finish(); }, 900);
    } else {
      setTimeout(() => {
        if (id !== round || phase !== 'show') return;
        shot = null;
        ballT = 0;
        phase = 'bowl';
        call.hidden = true;
      }, 850);
    }
  }

  function finish() {
    phase = 'end';
    meter.hidden = true;
    const won = runs >= target;
    document.getElementById('endKicker').textContent = won ? 'Chase complete' : 'Innings over';
    document.getElementById('endTitle').textContent = won ? 'Target down' : (wickets >= 3 ? 'All out' : 'Short');
    document.getElementById('endText').textContent = runs + '/' + wickets + ' chasing ' + target + '.';
    end.hidden = false;
    call.hidden = true;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#10243a');
    sky.addColorStop(1, '#1b3d2a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(180 + i * 300, 70, 18, 0, 7);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,244,200,.08)';
      ctx.beginPath();
      ctx.moveTo(180 + i * 300, 88);
      ctx.lineTo(80 + i * 280, 240);
      ctx.lineTo(280 + i * 280, 240);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.8)';
    }
    ctx.fillStyle = '#1f7a3a';
    ctx.beginPath();
    ctx.moveTo(180, 250); ctx.lineTo(780, 250); ctx.lineTo(900, 500); ctx.lineTo(60, 500); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(430, 470); ctx.lineTo(530, 470);
    ctx.moveTo(480, 300); ctx.lineTo(480, 470);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.lineWidth = 3;
    ctx.strokeRect(466, 430, 8, 36);
    ctx.strokeRect(486, 430, 8, 36);
    ctx.beginPath(); ctx.moveTo(466, 430); ctx.lineTo(494, 430); ctx.stroke();

    const fly = shot ? Math.min(1, (clock % 1)) : ballT;
    const y = shot ? 420 - shot.runs * 28 - (shot.out ? 10 : fly * 40) : 210 + ballT * 200;
    const x = shot ? 480 + (shot.runs >= 4 ? 180 : shot.out ? -20 : 40) * Math.min(1, ballT) : 480;
    ctx.fillStyle = shot && shot.runs >= 4 ? '#f5d76e' : '#f4f7fb';
    ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill();

    ctx.fillStyle = '#f2d2b0';
    ctx.fillRect(458, 400, 18, 28);
    ctx.fillStyle = '#1d4e89';
    ctx.fillRect(450, 418, 34, 22);
    if (phase === 'show') {
      ctx.strokeStyle = '#f4f7fb';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(470, 410);
      ctx.lineTo(shot && shot.out ? 490 : 520, 390);
      ctx.stroke();
    }
  }

  let last = 0;
  function frame(t) {
    const dt = Math.min(0.033, (t - last) / 1000 || 0);
    last = t;
    clock += dt;
    if (phase === 'bowl') {
      ballT += dt / 1.05;
      const speed = 2.3 + balls * 0.12;
      marker = 0.5 + 0.5 * Math.sin(clock * speed);
      mark.style.left = (marker * 100) + '%';
      if (ballT >= 1 && !shot) resolve({ runs: 0, label: 'LEFT' });
    }
    draw();
    requestAnimationFrame(frame);
  }

  document.getElementById('play').onclick = start;
  document.getElementById('again').onclick = start;
  canvas.addEventListener('pointerdown', swing);
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!menu.hidden || !end.hidden) start();
      else swing();
    }
  });
  requestAnimationFrame(frame);
})();
