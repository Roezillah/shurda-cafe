// Cup Toss: the bonus mini-game after Daki's accident.
// Aim with Up/Down, hold Space to wind up power (the meter swings, so time
// the release), let go to throw. Land the cup on the espresso machine's drip
// tray under the pouring coffee. 3 throws.
import { sfx } from './audio.js';

const W = 960, H = 540;          // logical canvas size
const FLOOR = 486;               // where shoes touch the floor
const G = 1500;                  // gravity, px/s²
const THROWS = 3;
const SCALE = 300 / 930;         // Daki sprite scale (wind-up image is 930px tall)
const RELEASE = { x: 366, y: 356 };
const DAKI_FLOOR = 526;          // Daki stands a bit forward on the tiles
const FOOT_GAP = { windup: 8, throw: 25 }; // empty pixels under the shoes in each image
const MACHINE_BASE = 366 / 386;  // where the machine's feet are inside its image
const POWER_PERIOD = 3.6;        // seconds for the power meter to swing up and back
const HIT_MS = 70;                // mug squashes on contact this long before it shatters
const MAX_POWER = 0.93;          // release at the top of the meter for Daki's fastball
const PITCH_H = { pitch: 305, pitch2: 290 }; // drawn heights of the pitcher sprites (trimmed to the figure)
const MACHINE = 230;             // drawn size of the espresso machine
const COUNTER_TOP = 352;          // front edge of the countertop
const COUNTER_DEPTH = 46;        // how far the countertop recedes toward the wall

const IMG = {
  windup: 'assets/toss/windup.png',
  throw: 'assets/toss/throw.png',
  machine: 'assets/toss/machine.png',
  pitch: 'assets/toss/pitch.png',     // full wind-up: pitcher's leg kick
  pitch2: 'assets/toss/pitch2.png',   // fastball follow-through
  cups: [0, 1, 2, 3, 4, 5, 6].map((i) => `assets/toss/cup${i}.png`),
};

function loadImage(src) {
  return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}
const cache = {};
// shave: 'none' | 'stache' | 'full' picks Daki's matching shaved sprites.
async function loadAll(shave = 'none') {
  if (cache[shave]) return cache[shave];
  const v = shave === 'full' ? '-f' : shave === 'stache' ? '-m' : '';
  const daki = (p) => p.replace('.png', `${v}.png`);
  const [windup, thr, machine, pitch, pitch2, ...cups] = await Promise.all([daki(IMG.windup), daki(IMG.throw), IMG.machine, daki(IMG.pitch), daki(IMG.pitch2), ...IMG.cups].map(loadImage));
  cache[shave] = { windup, throw: thr, machine, pitch, pitch2, cups };
  return cache[shave];
}

const LINES = {
  start: ['Shurda! Fresh pants, steady hands.', 'Shurda, let me make it up to you!', 'Watch this, shurda!'],
  perfect: ['SHURDA! Bullseye!', 'Right under the spout! Shurda!', 'Barista of the year, shurda!'],
  good: ['Shurda, it landed!', 'Nice! Fill her up!', 'Smooth, shurda.'],
  boom: ['SHURDA! STRIIIKE!', 'Fastball, shurda! Sorry, machine.', 'Shurda... I think I owe them a new machine.'],
  miss: ['Shurda... butterfingers.', 'Oops! Shurda, that was the good mug.', 'Shurda! Too much coffee, shaky hands.'],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const fmt = (n) => Math.round(n).toLocaleString('en-US');

export async function cupToss({ bet = 10, fast = false, shave = 'none' } = {}) {
  const img = await loadAll(shave);
  const payGood = bet * 10;
  const payPerfect = bet * 25;
  const payBoom = bet * 15;

  // ---------- DOM ----------
  const root = document.createElement('div');
  root.className = 'toss-root';
  root.innerHTML = `
    <div class="toss-card" role="dialog" aria-label="Cup Toss bonus game">
      <div class="toss-head">
        <div><div class="toss-title">BONUS: Cup Toss</div>
          <div class="toss-sub">Land the cup on the espresso machine's tray. Under the spout pays double!</div></div>
        <div class="toss-score"><span class="toss-throws"></span><b class="toss-won">0</b></div>
      </div>
      <div class="toss-stage">
        <canvas class="toss-canvas" width="${W}" height="${H}"></canvas>
        <div class="toss-bubble"></div>
        <div class="toss-msg"></div>
      </div>
      <div class="toss-controls">
        <span class="toss-help"><kbd>↑</kbd><kbd>↓</kbd> aim · hold <kbd>Space</kbd> for power, release to throw</span>
        <div class="toss-touch">
          <button class="toss-btn" data-t="up" aria-label="Aim higher">▲</button>
          <button class="toss-btn" data-t="down" aria-label="Aim lower">▼</button>
          <button class="toss-btn toss-hold" data-t="hold">HOLD TO THROW</button>
        </div>
        <button class="toss-skip" data-t="skip">Skip</button>
      </div>
    </div>`;
  document.body.appendChild(root);
  document.body.dataset.minigame = '1';
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bubble = root.querySelector('.toss-bubble');
  const msg = root.querySelector('.toss-msg');
  const wonEl = root.querySelector('.toss-won');
  const throwsEl = root.querySelector('.toss-throws');

  let bubbleTimer;
  const say = (text, ms = 1800) => {
    bubble.textContent = text; bubble.classList.add('show');
    clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => bubble.classList.remove('show'), ms);
  };
  let msgTimer;
  const flash = (text, cls = '') => {
    msg.textContent = text; msg.className = `toss-msg show ${cls}`;
    clearTimeout(msgTimer); msgTimer = setTimeout(() => { msg.className = 'toss-msg'; }, 1300);
  };

  // ---------- State ----------
  const S = {
    angle: 45, power: 0, charging: false, chargeT: 0,
    throwsLeft: THROWS, results: [], won: 0,
    phase: 'aim',                // aim | flying | landed | crashed | done
    cup: null, pose: 'windup', poseUntil: 0,
    machineX: 0, shards: [], burst: null, shakeUntil: 0, shakeAmp: 1,
    machineGone: false, dropAt: 0, boom: null, debris: [], maxed: false, fill: 0, landedAt: 0, nextAt: 0,
    keys: { up: false, down: false },
  };

  if (location.hash === '#debug') window.__tossState = S;

  function placeMachine() {
    S.machineX = 650 + Math.round(Math.random() * 90); // moves a little each throw
  }
  placeMachine();
  const geo = () => {
    const mx = S.machineX, my = COUNTER_TOP - 10 - MACHINE * MACHINE_BASE; // stands on the countertop surface
    return {
      mx, my,
      // the machine is drawn mirrored so it faces Daki; these are mirrored too
      trayL: mx + 0.20 * MACHINE, trayR: mx + 0.76 * MACHINE, trayY: my + 0.735 * MACHINE,
      spoutX: mx + 0.51 * MACHINE, spoutY: my + 0.575 * MACHINE,
      counterL: mx - 30,
    };
  };

  function renderHud() {
    throwsEl.innerHTML = Array.from({ length: THROWS }, (_, i) => {
      const r = S.results[i];
      return `<i class="${r === 'perfect' ? 'p' : r === 'good' ? 'g' : r === 'boom' ? 'b' : r === 'miss' ? 'm' : ''}"></i>`;
    }).join('');
    wonEl.textContent = fmt(S.won);
  }
  renderHud();

  // ---------- Input ----------
  const startCharge = () => {
    if (S.phase !== 'aim' || S.charging) return;
    S.charging = true; S.chargeT = 0;
  };
  const release = () => {
    if (!S.charging) return;
    S.charging = false;
    launch();
  };
  const onKey = (e) => {
    const down = e.type === 'keydown';
    if (['ArrowUp', 'ArrowDown', ' ', 'Spacebar'].includes(e.key) || e.code === 'Space') { e.preventDefault(); e.stopPropagation(); }
    if (e.key === 'ArrowUp') S.keys.up = down;
    if (e.key === 'ArrowDown') S.keys.down = down;
    if (e.code === 'Space') { if (down && !e.repeat) startCharge(); if (!down) release(); }
    if (e.key === 'Escape' && down) finish();
  };
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', onKey, true);
  const onPointer = (e) => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    const t = b.dataset.t;
    const down = e.type === 'pointerdown';
    if (t === 'up') S.keys.up = down;
    if (t === 'down') S.keys.down = down;
    if (t === 'hold') { if (down) startCharge(); else release(); }
    if (t === 'skip' && down) finish();
    if (down) e.preventDefault();
  };
  root.addEventListener('pointerdown', onPointer);
  root.addEventListener('pointerup', onPointer);
  root.addEventListener('pointercancel', onPointer);
  root.addEventListener('pointerleave', (e) => { if (e.target === root) { S.keys.up = S.keys.down = false; release(); } });

  // ---------- Throw physics ----------
  function launch() {
    if (S.power >= MAX_POWER) return fastball();
    const speed = 380 + S.power * 820;
    const a = (S.angle * Math.PI) / 180;
    S.cup = { x: RELEASE.x, y: RELEASE.y, vx: Math.cos(a) * speed, vy: -Math.sin(a) * speed, t: 0, frame: 0 };
    S.phase = 'flying';
    S.pose = 'throw'; S.poseUntil = performance.now() + 650;
    sfx.spin();
  }

  // Full wind-up: Daki pitches it like a baseball, dead straight at the machine.
  function fastball() {
    const g = geo();
    const from = { x: RELEASE.x + 10, y: RELEASE.y - 40 };
    const to = { x: g.mx + MACHINE * 0.5, y: g.my + MACHINE * 0.42 };
    const d = Math.hypot(to.x - from.x, to.y - from.y);
    const speed = 1700;
    S.cup = { x: from.x, y: from.y, vx: ((to.x - from.x) / d) * speed, vy: ((to.y - from.y) / d) * speed, t: 0, fast: true, trail: [] };
    S.phase = 'flying';
    S.pose = 'pitch2'; S.poseUntil = performance.now() + 1100;
    sfx.whoosh();
    say('SHURDAAA!!', 900);
  }

  // The machine blows up: flash, fireball, smoke, flying metal and coffee.
  function explode() {
    const g = geo();
    const now = performance.now();
    const cx = g.mx + MACHINE * 0.5, cy = g.my + MACHINE * 0.5;
    S.machineGone = true;
    S.boom = { x: cx, y: cy, t: now };
    S.shakeUntil = now + 750; S.shakeAmp = 2.6;
    const deb = [];
    const add = (kind, n, size, spd) => {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.7;
        const v = spd * (0.5 + Math.random() * 0.7);
        const pts = [];
        const k = 4 + Math.floor(Math.random() * 3);
        for (let j = 0; j < k; j++) {
          const aa = (j / k) * Math.PI * 2 + Math.random() * 0.6;
          const r = size * (0.6 + Math.random() * 0.5);
          pts.push([Math.cos(aa) * r, Math.sin(aa) * r]);
        }
        deb.push({
          kind, size, pts, x: cx + (Math.random() - 0.5) * MACHINE * 0.6, y: cy + (Math.random() - 0.5) * MACHINE * 0.5,
          vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 18,
          rest: false, born: now, life: kind === 'fire' ? 450 + Math.random() * 350 : kind === 'smoke' ? 1400 + Math.random() * 900 : 0,
        });
      }
    };
    add('metal', 9, 22, 820);
    add('gauge', 2, 17, 700);
    add('handle', 1, 18, 760);
    add('coffee', 26, 5, 900);
    add('fire', 22, 26, 360);
    add('smoke', 12, 34, 160);
    S.debris = deb;
  }

  // Break the mug into pieces: a few big chunks (one is the handle), lots of
  // small chips, a puff of dust, and an impact flash. The screen shakes.
  function smash(x, y, floor, vx0 = 0) {
    const now = performance.now();
    const pieces = [];
    const push = (kind, size, n) => {
      for (let i = 0; i < n; i++) {
        const pts = [];
        const k = 3 + Math.floor(Math.random() * 3);
        for (let j = 0; j < k; j++) {
          const a = (j / k) * Math.PI * 2 + Math.random() * 0.8;
          const r = size * (0.55 + Math.random() * 0.6);
          pts.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;  // mostly upward fan
        const sp = (kind === 'chip' ? 260 : 170) + Math.random() * 260;
        pieces.push({
          kind, pts, size, x: x + (Math.random() - 0.5) * 16, y: y - 6,
          vx: Math.cos(ang) * sp + vx0 * 0.15, vy: Math.sin(ang) * sp - 80,
          rot: Math.random() * 6, spin: (Math.random() - 0.5) * 22, floor, rest: false, bounces: 0,
        });
      }
    };
    push('chunk', 17, 4);
    push('handle', 12, 1);
    push('chip', 7, 10);
    push('dust', 3.5, 10);
    S.shards = pieces;
    S.burst = { x, y, t: now + HIT_MS, floor, broken: false }; // mug squashes on contact, then shatters
  }

  function land(kind) {
    const g = geo();
    S.results.push(kind);
    S.throwsLeft--;
    if (kind === 'boom') {
      S.phase = 'crashed';
      S.won += payBoom;
      explode();
      sfx.boom();
      flash(`KA-BOOM! +${fmt(payBoom)}`, 'boom');
      setTimeout(() => say(pick(LINES.boom), 2000), 450);
    } else if (kind === 'miss') {
      S.phase = 'crashed';
      // the sound, CRASH! text and Daki's line fire in drawSmash, on the frame the mug visibly breaks
      smash(S.cup.x, S.cup.y, S.cup.y >= FLOOR - 12 ? FLOOR - 2 : COUNTER_TOP - COUNTER_DEPTH / 2 + 2, S.cup.vx);
    } else {
      S.phase = 'landed';
      S.cup.x = Math.min(g.trayR - 26, Math.max(g.trayL + 26, S.cup.x));
      S.cup.y = g.trayY;
      S.landedAt = performance.now();
      S.fill = 0;
      const pay = kind === 'perfect' ? payPerfect : payGood;
      S.won += pay;
      sfx.clink();
      if (kind === 'perfect') { sfx.bigWin(); flash(`PERFECT! +${fmt(pay)}`, 'good'); say(pick(LINES.perfect)); } else { sfx.win(); flash(`NICE! +${fmt(pay)}`, 'good'); say(pick(LINES.good)); }
    }
    renderHud();
    S.nextAt = performance.now() + (kind === 'boom' ? (fast ? 2000 : 2800) : (fast ? 1300 : 2000)); // handled by the animation loop
  }

  function nextThrow() {
    if (S.phase === 'done') return;
    if (S.throwsLeft <= 0) return endScreen();
    S.cup = null; S.shards = []; S.burst = null; S.phase = 'aim'; S.pose = 'windup'; S.power = 0;
    placeMachine();
    if (S.machineGone) { S.machineGone = false; S.debris = []; S.boom = null; S.dropAt = performance.now(); } // a new machine drops in
  }

  // ---------- Drawing ----------
  function drawScene(now) {
    const g = geo();
    // wall
    for (let x = 0; x < W; x += 36) { ctx.fillStyle = (x / 36) % 2 ? '#f6dcbb' : '#fbe7cc'; ctx.fillRect(x, 0, 36, FLOOR - 40); }
    // menu board on the wall
    ctx.fillStyle = '#3b2317'; roundRect(70, 40, 240, 110, 12); ctx.fill();
    ctx.fillStyle = '#fff6e9'; ctx.font = '26px "Lilita One", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('SHURDA CAFÉ', 190, 82);
    ctx.font = '700 15px Nunito, sans-serif'; ctx.fillText('Espresso · Latte · Regret', 190, 112);
    ctx.fillText('No refunds on pants', 190, 134);
    // skirting
    ctx.fillStyle = '#7a4a30'; ctx.fillRect(0, FLOOR - 52, W, 14);
    ctx.fillStyle = '#2a1a12'; ctx.fillRect(0, FLOOR - 54, W, 3); ctx.fillRect(0, FLOOR - 38, W, 3);
    // checker floor in true perspective: tile edges run to one vanishing point
    const top = FLOOR - 38;
    const vx = W / 2, vy = top - 520;               // vanishing point above the wall
    const tile = 70;                                  // tile width at the bottom edge
    const rowsY = [];
    for (let r = 0; r <= 6; r++) rowsY.push(top + (H - top) * (1 - Math.pow(1 - r / 6, 1.6)));
    const xAt = (bx, y) => vx + (bx - vx) * (y - vy) / (H - vy);
    for (let r = 0; r < 6; r++) {
      const y0 = rowsY[r], y1 = rowsY[r + 1];
      for (let c = -12; c <= 12; c++) {
        const b0 = vx + c * tile, b1 = b0 + tile;
        ctx.fillStyle = (r + c + 100) % 2 ? '#3b2317' : '#fff6e9';
        ctx.beginPath();
        ctx.moveTo(xAt(b0, y0), y0); ctx.lineTo(xAt(b1, y0), y0);
        ctx.lineTo(xAt(b1, y1), y1); ctx.lineTo(xAt(b0, y1), y1);
        ctx.closePath(); ctx.fill();
      }
    }
    const shade = ctx.createLinearGradient(0, top, 0, top + 40);
    shade.addColorStop(0, 'rgba(42,26,18,.45)'); shade.addColorStop(1, 'rgba(42,26,18,0)');
    ctx.fillStyle = shade; ctx.fillRect(0, top, W, 40);
    // counter, drawn in the same three-quarter view as the machine:
    // a top surface that recedes toward the wall, a front lip, and the cabinet
    const L = g.counterL - 12, D = COUNTER_DEPTH;
    ctx.fillStyle = '#8a5a3c'; ctx.fillRect(L + 8, COUNTER_TOP + 14, W - L, FLOOR - COUNTER_TOP - 10);
    ctx.fillStyle = '#6b3d26';
    for (let x = L + 34; x < W; x += 48) ctx.fillRect(x, COUNTER_TOP + 24, 4, FLOOR - COUNTER_TOP - 30);
    ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    ctx.strokeRect(L + 8, COUNTER_TOP + 14, W - L, FLOOR - COUNTER_TOP - 12);
    ctx.fillStyle = '#c98557';
    ctx.beginPath();
    ctx.moveTo(L, COUNTER_TOP); ctx.lineTo(W + 10, COUNTER_TOP);
    ctx.lineTo(W + 10, COUNTER_TOP - D); ctx.lineTo(L + 30, COUNTER_TOP - D); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(122,74,48,.45)'; ctx.lineWidth = 2;  // wood grain
    for (let i = 1; i < 4; i++) {
      const y = COUNTER_TOP - (D * i) / 4;
      ctx.beginPath(); ctx.moveTo(L + 30 * (i / 4) + 6, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.fillStyle = '#a86b45'; ctx.fillRect(L, COUNTER_TOP, W - L + 10, 14);          // front lip
    ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 4;
    ctx.strokeRect(L, COUNTER_TOP, W - L + 12, 14);
    // machine, mirrored so its front turns toward Daki
    if (S.machineGone) return; // blown up: drawBoom paints the aftermath on top
    let drop = 0, squash = 1;
    if (S.dropAt) { // a replacement machine falls onto the counter and settles
      const k = Math.min(1, (performance.now() - S.dropAt) / 520);
      if (k < 0.7) drop = -(1 - (k / 0.7) ** 2) * 420;
      else squash = 1 - Math.sin(((k - 0.7) / 0.3) * Math.PI) * 0.08;
      if (k >= 1) S.dropAt = 0;
      if (k >= 0.7 && !S.dropThud) { S.dropThud = true; sfx.thud(); }
    } else S.dropThud = false;
    if (img.machine) {
      ctx.save();
      ctx.translate(g.mx + MACHINE, g.my + drop + MACHINE * MACHINE_BASE); ctx.scale(-1, squash);
      ctx.drawImage(img.machine, 0, -MACHINE * MACHINE_BASE, MACHINE, MACHINE);
      ctx.restore();
    }
    if (drop < 0) return;
    // pouring coffee stream (wobbly)
    const sx = g.spoutX, sy = g.spoutY;
    const endY = S.phase === 'landed' ? g.trayY - 30 : g.trayY - 2;
    ctx.strokeStyle = '#5a3422'; ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      ctx.lineWidth = 6 - i * 3; ctx.strokeStyle = i ? '#8a5a3c' : '#4a2a18';
      ctx.beginPath(); ctx.moveTo(sx, sy);
      for (let y = sy; y <= endY; y += 6) ctx.lineTo(sx + Math.sin(now / 90 + y / 9) * 1.6, y);
      ctx.stroke();
    }
    // splash puddle on the tray while no cup is there
    if (S.phase !== 'landed') {
      ctx.fillStyle = 'rgba(74,42,24,.85)';
      ctx.beginPath(); ctx.ellipse(sx, g.trayY - 1, 12 + Math.sin(now / 120) * 2, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
    // target hint: glowing zone on the tray
    if (S.phase === 'aim') {
      ctx.fillStyle = `rgba(245,197,24,${0.25 + 0.15 * Math.sin(now / 200)})`;
      ctx.beginPath(); ctx.ellipse(sx, g.trayY, 24, 6, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawDaki(now) {
    const usingThrow = (S.pose === 'throw' || S.pose === 'pitch2') && now < S.poseUntil;
    if (!usingThrow) S.pose = 'windup';
    const maxed = !usingThrow && S.charging && S.power >= MAX_POWER;
    let key = usingThrow ? S.pose : maxed ? 'pitch' : 'windup';
    if (!img[key]) key = key === 'pitch2' ? 'throw' : 'windup'; // sprites missing: fall back
    const im = img[key];
    if (!im) return;
    const sc = PITCH_H[key] ? PITCH_H[key] / im.height : SCALE;
    const w = im.width * sc, h = im.height * sc;
    const feet = (FOOT_GAP[key] || 0) * sc;      // trim the empty margin under his shoes
    const x = 72, cx = x + w * 0.42;
    // contact shadow on the tiles
    ctx.fillStyle = 'rgba(42,26,18,.5)';
    ctx.beginPath(); ctx.ellipse(cx, DAKI_FLOOR + 1, w * (usingThrow ? 0.5 : 0.4), 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(cx, DAKI_FLOOR + feet);
    if (maxed) ctx.translate((Math.random() - 0.5) * 3, 0);           // trembling with power
    else if (!usingThrow && S.charging) ctx.rotate(-S.power * 0.12);  // lean back while winding up
    else if (!usingThrow) ctx.scale(1, 1 + Math.sin(now / 600) * 0.012); // breathe, feet stay planted
    ctx.drawImage(im, x - cx, -h, w, h);
    ctx.restore();
  }

  function drawAim(now) {
    if (S.phase !== 'aim') return;
    const a = (S.angle * Math.PI) / 180;
    // short dotted preview of the arc at mid power, so aiming needs judgement
    const speed = 380 + 0.5 * 820;
    ctx.fillStyle = 'rgba(42,26,18,.55)';
    for (let i = 1; i <= 9; i++) {
      const t = i * 0.035;
      const x = RELEASE.x + Math.cos(a) * speed * t;
      const y = RELEASE.y - Math.sin(a) * speed * t + 0.5 * G * t * t;
      ctx.beginPath(); ctx.arc(x, y, 4 - i * 0.25, 0, Math.PI * 2); ctx.fill();
    }
    // angle readout
    ctx.fillStyle = '#2a1a12'; ctx.font = '22px "Lilita One", sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(S.angle)}°`, RELEASE.x + 18, RELEASE.y - 26);
    // power meter
    const mx = 26, my = 120, mh = 250;
    ctx.fillStyle = '#fff6e9'; ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 4;
    roundRect(mx, my, 26, mh, 10); ctx.fill(); ctx.stroke();
    const grad = ctx.createLinearGradient(0, my + mh, 0, my);
    grad.addColorStop(0, '#8fd14f'); grad.addColorStop(0.55, '#f5c518'); grad.addColorStop(1, '#b5371f');
    ctx.fillStyle = grad;
    const ph = (mh - 8) * S.power;
    roundRect(mx + 4, my + mh - 4 - ph, 18, Math.max(2, ph), 6); ctx.fill();
    if (S.charging && S.power >= MAX_POWER) { // top of the meter: fastball ready
      if (!S.maxed) { S.maxed = true; sfx.tick(); }
      const pulse = 0.5 + 0.5 * Math.sin(now / 45);
      ctx.save();
      ctx.shadowColor = '#ff7a1a'; ctx.shadowBlur = 18 + pulse * 14;
      ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = 5;
      roundRect(mx - 2, my - 2, 30, mh + 4, 12); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = pulse > 0.5 ? '#ff7a1a' : '#f5c518'; ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 4;
      ctx.font = '24px "Lilita One", sans-serif'; ctx.textAlign = 'center';
      ctx.strokeText('MAX!', mx + 13, my - 12); ctx.fillText('MAX!', mx + 13, my - 12);
    } else S.maxed = false;
    ctx.fillStyle = '#2a1a12'; ctx.font = '16px "Lilita One", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('POWER', mx + 13, my + mh + 22);
  }

  function drawCup(now) {
    const c = S.cup;
    if (!c) return;
    const size = 58;
    if (S.phase === 'flying' && c.fast) { // fireball trail behind the fastball
      c.trail.forEach((p, i) => {
        const k = i / c.trail.length;
        ctx.fillStyle = `rgba(${255},${Math.round(120 + 100 * k)},${Math.round(30 * k)},${0.15 + k * 0.55})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 6 + k * 16, 0, Math.PI * 2); ctx.fill();
      });
      ctx.strokeStyle = 'rgba(42,26,18,.6)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(c.x - 40, c.y + i * 14); ctx.lineTo(c.x - 95 - Math.random() * 30, c.y + i * 16); ctx.stroke();
      }
    }
    if (S.phase === 'flying') {
      const im = img.cups[Math.floor(c.t / (c.fast ? 0.035 : 0.07)) % 6];
      if (im) ctx.drawImage(im, c.x - size / 2, c.y - size / 2, size, size);
    } else if (S.phase === 'landed') {
      const im = img.cups[6]; // upright
      const y = c.y - size * 0.78;
      if (im) ctx.drawImage(im, c.x - size / 2, y, size, size);
      // coffee filling up inside the mug
      const k = Math.min(1, (now - S.landedAt) / 900);
      ctx.fillStyle = '#4a2a18';
      ctx.beginPath(); ctx.ellipse(c.x + 3, y + size * 0.36 + (1 - k) * 10, size * 0.27 * (0.6 + 0.4 * k), 5, 0, 0, Math.PI * 2); ctx.fill();
      if (k > 0.6) { // steam
        ctx.strokeStyle = 'rgba(138,106,85,.8)'; ctx.lineWidth = 3;
        for (let i = -1; i <= 1; i += 2) {
          ctx.beginPath(); ctx.moveTo(c.x + i * 8, y + 4);
          ctx.quadraticCurveTo(c.x + i * 8 + Math.sin(now / 200) * 6, y - 10, c.x + i * 8, y - 24); ctx.stroke();
        }
      }
    }
    drawSmash(now);
  }

  function drawBoom() {
    const b = S.boom;
    if (!b) return;
    const now = performance.now();
    const age = (now - b.t) / 1000;
    // scorch mark where the machine stood
    ctx.fillStyle = 'rgba(42,26,18,.55)';
    ctx.beginPath(); ctx.ellipse(b.x, COUNTER_TOP - COUNTER_DEPTH / 2, MACHINE * 0.42, 16, 0, 0, Math.PI * 2); ctx.fill();
    // smoke behind everything
    for (const d of S.debris) {
      if (d.kind !== 'smoke') continue;
      const k = (now - d.born) / d.life;
      if (k >= 1) continue;
      ctx.fillStyle = `rgba(90,80,76,${0.55 * (1 - k)})`;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2); ctx.fill();
    }
    // fireball: grows fast, then burns out
    if (age < 0.75) {
      const grow = Math.min(1, age / 0.16), fade = age < 0.3 ? 1 : 1 - (age - 0.3) / 0.45;
      const r = 40 + grow * 120;
      ctx.save(); ctx.globalAlpha = Math.max(0, fade);
      [['#b5371f', 1], ['#ff7a1a', 0.78], ['#f5c518', 0.55], ['#fff6c8', 0.3]].forEach(([col, f]) => {
        ctx.fillStyle = col; ctx.beginPath();
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * Math.PI * 2;
          const rr = r * f * (i % 2 ? 0.82 : 1.05 + Math.sin(i * 7 + age * 30) * 0.08);
          ctx.lineTo(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr * 0.85);
        }
        ctx.closePath(); ctx.fill();
      });
      ctx.restore();
    }
    // shockwave ring
    if (age < 0.5) {
      const k = age / 0.5;
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#fff6e9'; ctx.lineWidth = 10 * (1 - k) + 2;
      ctx.beginPath(); ctx.ellipse(b.x, b.y, 60 + k * 300, 40 + k * 190, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    for (const d of S.debris) {
      if (d.kind === 'smoke') continue;
      if (d.kind === 'fire') {
        const k = (now - d.born) / d.life;
        if (k >= 1) continue;
        ctx.fillStyle = k < 0.4 ? '#f5c518' : '#ff7a1a';
        ctx.globalAlpha = 1 - k;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.size * (1 - k * 0.6), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        continue;
      }
      ctx.save(); ctx.translate(d.x, d.y);
      if (d.kind === 'coffee') {
        ctx.fillStyle = '#5a3422';
        if (d.splat) { ctx.beginPath(); ctx.ellipse(0, 0, d.size * 2.2, d.size * 0.7, 0, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.beginPath(); ctx.arc(0, 0, d.size, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore(); continue;
      }
      ctx.rotate(d.rot);
      ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 3;
      if (d.kind === 'gauge') {
        ctx.fillStyle = '#fff6e9'; ctx.beginPath(); ctx.arc(0, 0, d.size, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#b5371f'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(d.size * 0.7, -d.size * 0.3); ctx.stroke();
      } else if (d.kind === 'handle') {
        ctx.fillStyle = '#6b3d26'; roundRect(-d.size * 1.6, -6, d.size * 3.2, 12, 6); ctx.fill(); ctx.stroke();
      } else {
        ctx.fillStyle = '#8d8781';
        ctx.beginPath(); d.pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#b9b3ac';
        ctx.beginPath(); ctx.moveTo(d.pts[0][0] * 0.6, d.pts[0][1] * 0.6); ctx.lineTo(d.pts[1][0] * 0.6, d.pts[1][1] * 0.6); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    // white flash on the first frames
    if (age < 0.12) { ctx.fillStyle = `rgba(255,250,235,${0.85 * (1 - age / 0.12)})`; ctx.fillRect(-40, -40, W + 80, H + 80); }
  }

  function drawSmash(now) {
    const b = S.burst;
    if (b && performance.now() < b.t) { // contact frames: the mug squashes before it breaks
      const im = img.cups[Math.floor(S.cup.t / 0.07) % 6];
      if (im) {
        ctx.save(); ctx.translate(b.x, b.y + 12); ctx.scale(1.18, 0.78);
        ctx.drawImage(im, -29, -41, 58, 58);
        ctx.restore();
      }
      return;
    }
    if (b && !b.broken) { // the moment it breaks: sound and text land together
      b.broken = true;
      sfx.crash();
      flash('CRASH!', 'bad');
      say(pick(LINES.miss));
      S.shakeUntil = performance.now() + 320;
    }
    if (b) {
      const age = Math.max(0, (now - b.t) / 1000);
      // impact flash: a jagged star and an expanding ring
      if (age < 0.22) {
        const k = age / 0.22;
        ctx.save(); ctx.translate(b.x, b.y - 6);
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = '#fff6c8'; ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < 16; i++) {
          const r = (i % 2 ? 14 : 38) * (0.6 + k * 0.7);
          const a = (i / 16) * Math.PI * 2;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.8);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      if (age < 0.45) {
        const k = age / 0.45;
        ctx.save();
        ctx.globalAlpha = (1 - k) * 0.8; ctx.strokeStyle = '#fff6e9'; ctx.lineWidth = 4 * (1 - k) + 1;
        ctx.beginPath(); ctx.ellipse(b.x, b.floor - 2, 20 + k * 70, 6 + k * 14, 0, 0, Math.PI * 2); ctx.stroke();
        // speed lines shooting out
        ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        for (let i = 0; i < 7; i++) {
          const a = Math.PI + (i / 6) * Math.PI;
          const r0 = 26 + k * 60, r1 = r0 + 18 * (1 - k);
          ctx.beginPath(); ctx.moveTo(b.x + Math.cos(a) * r0, b.y - 6 + Math.sin(a) * r0 * 0.8);
          ctx.lineTo(b.x + Math.cos(a) * r1, b.y - 6 + Math.sin(a) * r1 * 0.8); ctx.stroke();
        }
        ctx.restore();
      }
      // dust cloud rising and fading
      if (age < 0.9) {
        const k = age / 0.9;
        ctx.save(); ctx.globalAlpha = 0.45 * (1 - k); ctx.fillStyle = '#d9c3a8';
        for (let i = 0; i < 5; i++) {
          const dx = (i - 2) * (12 + k * 18);
          ctx.beginPath(); ctx.arc(b.x + dx, b.floor - 10 - k * 22 - Math.abs(i - 2) * 3, 10 + k * 16, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
    }
    for (const s of S.shards) {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot);
      if (s.kind === 'dust') {
        ctx.fillStyle = '#fff6e9'; ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, s.size, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else if (s.kind === 'handle') { // the mug's handle, still in one piece
        ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 10; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, 0, 12, Math.PI * 0.6, Math.PI * 1.6); ctx.stroke();
        ctx.strokeStyle = '#fff6e9'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, 0, 12, Math.PI * 0.6, Math.PI * 1.6); ctx.stroke();
      } else {
        ctx.fillStyle = '#fff6e9'; ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = s.kind === 'chunk' ? 3 : 2;
        ctx.beginPath(); s.pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath();
        ctx.fill(); ctx.stroke();
        if (s.kind === 'chunk') { // a sliver of the grey inside of the mug
          ctx.fillStyle = '#c9c2bb';
          ctx.beginPath(); ctx.moveTo(s.pts[0][0] * 0.5, s.pts[0][1] * 0.5); ctx.lineTo(s.pts[1][0] * 0.5, s.pts[1][1] * 0.5); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  // ---------- Loop ----------
  let last = performance.now();
  let raf;
  function step(now) {
    const frameDt = Math.min(0.25, (now - last) / 1000);
    last = now;
    // fixed small sub-steps keep the physics the same at any frame rate
    const steps = Math.max(1, Math.ceil(frameDt / (1 / 120)));
    for (let i = 0; i < steps; i++) simulate(frameDt / steps);
    render(now);
    if (S.nextAt && now >= S.nextAt) { S.nextAt = 0; nextThrow(); }
    if (S.phase !== 'done') raf = requestAnimationFrame(step);
  }

  function simulate(dt) {
    if (S.phase === 'aim') {
      if (S.keys.up) S.angle = Math.min(78, S.angle + 55 * dt);
      if (S.keys.down) S.angle = Math.max(8, S.angle - 55 * dt);
      if (S.charging) { // power swings up and down: time the release
        S.chargeT += dt;
        const period = POWER_PERIOD;
        const ph = (S.chargeT % period) / period;
        S.power = ph < 0.5 ? ph * 2 : 2 - ph * 2;
      }
    }
    if (S.phase === 'flying') {
      const c = S.cup;
      const g = geo();
      const prevY = c.y;
      if (c.fast) { // straight line, no drop
        c.t += dt; c.x += c.vx * dt; c.y += c.vy * dt;
        c.trail.push({ x: c.x, y: c.y }); if (c.trail.length > 14) c.trail.shift();
        if (c.x >= g.mx + MACHINE * 0.2) land('boom');
        return;
      }
      c.t += dt; c.vy += G * dt; c.x += c.vx * dt; c.y += c.vy * dt;
      if (c.vy > 0 && prevY <= g.trayY && c.y >= g.trayY && c.x >= g.trayL && c.x <= g.trayR) {
        land(Math.abs(c.x - g.spoutX) <= 22 ? 'perfect' : 'good');
      } else if (c.x >= g.counterL - 12 && c.y >= COUNTER_TOP - COUNTER_DEPTH / 2 && c.vy > 0) {
        c.y = COUNTER_TOP - COUNTER_DEPTH / 2;
        land('miss'); // smacked the counter
      } else if (c.y >= FLOOR - 10 || c.x > W + 60) {
        c.y = Math.min(c.y, FLOOR - 10);
        land('miss');
      }
    }
    for (const d of S.debris) {
      if (d.rest) continue;
      if (d.kind === 'fire') { d.vy -= 300 * dt; d.vx *= 0.97; d.x += d.vx * dt; d.y += d.vy * dt; continue; }
      if (d.kind === 'smoke') { d.vy -= 40 * dt; d.vx *= 0.98; d.x += d.vx * dt; d.y += d.vy * dt; d.size += 22 * dt; continue; }
      d.vy += G * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.spin * dt;
      const g = geo();
      const onCounter = d.x >= g.counterL - 12 && d.y < COUNTER_TOP;
      const fl = (onCounter ? COUNTER_TOP - COUNTER_DEPTH / 2 : FLOOR) - (d.kind === 'coffee' ? 1 : d.size * 0.4);
      if (d.y >= fl && d.vy > 0) {
        d.y = fl;
        if (d.kind === 'coffee') { d.rest = true; d.splat = true; continue; }
        d.vy = -d.vy * 0.35; d.vx *= 0.6; d.spin *= 0.5;
        if (Math.abs(d.vy) < 70) { d.vy = 0; d.rest = true; }
      }
    }
    const frozen = S.burst && performance.now() < S.burst.t;
    for (const s of S.shards) {
      if (s.rest || frozen) continue;
      s.vy += G * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.spin * dt;
      const fl = s.floor - (s.kind === 'dust' ? 0 : s.size * 0.35);
      if (s.y >= fl && s.vy > 0) { // bounce, lose energy, then settle
        s.y = fl;
        if (s.vy > 160 && s.bounces < 2 && s.kind !== 'dust' && Math.random() < 0.5) sfx.tinkle(0.025 + Math.min(0.05, s.vy / 12000));
        s.vy = -s.vy * (s.kind === 'chip' ? 0.42 : 0.32);
        s.vx *= 0.62; s.spin *= 0.5; s.bounces++;
        if (Math.abs(s.vy) < 60) { s.vy = 0; s.rest = true; }
      }
    }
  }

  function render(now) {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (S.shakeUntil > now) { // short, decaying shake on a smash
      const k = Math.min(1, (S.shakeUntil - now) / 320);
      ctx.translate((Math.random() - 0.5) * 14 * k * S.shakeAmp, (Math.random() - 0.5) * 10 * k * S.shakeAmp);
    } else S.shakeAmp = 1;
    drawScene(now);
    drawDaki(now);
    drawAim(now);
    drawCup(now);
    if (S.machineGone) drawBoom();
    ctx.restore();
  }

  // ---------- End ----------
  let resolveGame;
  const done = new Promise((r) => { resolveGame = r; });
  function endScreen() {
    S.phase = 'end';
    const hits = S.results.filter((r) => r !== 'miss').length;
    const end = document.createElement('div');
    end.className = 'toss-end';
    end.innerHTML = `
      <div class="toss-end-title">${hits === THROWS ? 'SHURDA! Perfect barista!' : hits ? 'Nice tossing, shurda!' : 'Shurda... all butterfingers.'}</div>
      <div class="toss-end-sub">${hits} of ${THROWS} cups landed</div>
      <div class="toss-end-won">+${fmt(S.won)}</div>
      <button class="btn toss-collect">${S.won ? 'Collect' : 'Back to the café'}</button>`;
    root.querySelector('.toss-stage').appendChild(end);
    end.querySelector('.toss-collect').addEventListener('click', finish);
    end.querySelector('.toss-collect').focus();
    if (S.won) sfx.bigWin();
  }
  function finish() {
    if (S.phase === 'done') return;
    S.phase = 'done';
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('keyup', onKey, true);
    delete document.body.dataset.minigame;
    root.remove();
    resolveGame(S.won);
  }

  say(pick(LINES.start), 2400);
  raf = requestAnimationFrame(step);
  return done;
}
