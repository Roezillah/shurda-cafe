import {
  MACHINES, SYMBOLS, PAYLINES, REELS, ROWS, BET_LADDER, ECONOMY,
  machineById, randomSymbol, spin, xpForLevel, levelReward, xpForSpin,
  maxBetIndex, bonusAmount, winTier, applyExpandingWilds, evaluate,
} from './engine.js';
import { SYMBOL_ART } from './symbols.js';
import { sfx, setSound, setMusic, setMusicVolume } from './audio.js';
import { mountDaki, setCups, celebrate, drink, accident, setFast, CUP_LIMIT, setShave, shaveAnim, regrow } from './daki.js';

const SHAVE_SPINS = 30; // spins until Daki's hair grows back
import { cupToss } from './cuptoss.js';

// ---------- State ----------
const SAVE_KEY = 'javajack.v1';
const defaults = () => ({
  coins: 0, xp: 0, level: 1,
  lastBonusAt: 0, lastTopUpAt: 0,
  betIndex: 0, machineId: null, welcomed: false, cups: 0,
  shave: 'none', shaveSpins: 0, // hair trimmers: 'stache' or 'full', grows back after SHAVE_SPINS
  settings: { sound: true, music: true, musicVol: 40, fast: false, musicV2: true },
  stats: { spins: 0, biggestWin: 0, totalWon: 0, bonuses: 0, accidents: 0 },
});

let storageOk = true;
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaults();
    const s = JSON.parse(raw);
    const d = defaults();
    const settings = { ...d.settings, ...s.settings };
    // Real music arrived: switch it on once for older saves that had the old synth loop off.
    if (!s.settings || !s.settings.musicV2) { settings.music = true; settings.musicV2 = true; }
    return { ...d, ...s, settings, stats: { ...d.stats, ...s.stats } };
  } catch {
    storageOk = false;
    return defaults();
  }
}
function save() {
  if (!storageOk) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { storageOk = false; }
}

const state = load();
const run = { spinning: false, auto: 0, freeSpins: 0, freeWon: 0, freeBet: 0, lineTimer: null, skip: false };

// Crypto-backed randomness for real play; the sim uses Math.random.
const rng = () => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 4294967296;
};

// ---------- DOM helpers ----------
const $ = (s, el = document) => el.querySelector(s);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function countUp(el, from, to, ms = 700, onTick) {
  return new Promise((resolve) => {
    const start = performance.now();
    let lastTick = 0;
    const frame = (now) => {
      const t = Math.min(1, (now - start) / ms);
      const v = from + (to - from) * (1 - Math.pow(1 - t, 3));
      el.textContent = fmt(v);
      if (onTick && now - lastTick > 70 && t < 1) { onTick(); lastTick = now; }
      if (t < 1 && !run.skip) requestAnimationFrame(frame);
      else { el.textContent = fmt(to); resolve(); }
    };
    requestAnimationFrame(frame);
  });
}

let toastTimer;
function toast(msg, ms = 2400) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

// ---------- Top bar ----------
let shownCoins = 0;
function renderTopbar({ animateCoins = false } = {}) {
  const el = $('#coin-count');
  if (animateCoins && state.coins > shownCoins) {
    countUp(el, shownCoins, state.coins, 600);
    $('.coins').classList.remove('bump'); void $('.coins').offsetWidth; $('.coins').classList.add('bump');
  } else {
    el.textContent = fmt(state.coins);
  }
  shownCoins = state.coins;
  $('#level-num').textContent = state.level;
  $('#xp-fill').style.width = `${Math.min(100, (100 * state.xp) / xpForLevel(state.level))}%`;
  $('.level').title = `Level ${state.level} · ${fmt(state.xp)} / ${fmt(xpForLevel(state.level))} XP`;
  renderBonusButton();
}

function bonusReadyIn() {
  const now = Date.now();
  if (state.lastBonusAt > now) state.lastBonusAt = now; // clock moved back
  return Math.max(0, state.lastBonusAt + ECONOMY.bonusIntervalMs - now);
}
function renderBonusButton() {
  const btn = $('#bonus-btn');
  const left = bonusReadyIn();
  btn.classList.toggle('ready', left === 0);
  btn.disabled = left > 0;
  if (left === 0) {
    $('#bonus-label').textContent = 'Free coins!';
  } else {
    const h = Math.floor(left / 3600000), m = Math.floor((left % 3600000) / 60000), s = Math.floor((left % 60000) / 1000);
    $('#bonus-label').textContent = h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}:${String(s).padStart(2, '0')}`;
  }
}
setInterval(renderBonusButton, 1000);

// ---------- Lobby ----------
const GREETINGS = [
  "Mornin'! Grab a machine, the coffee's on me.",
  'Fresh pot, fresh spins. Let\'s go!',
  "Three coffee pots means free refills. That's the house rule.",
  "Spot my face on the reels? I'm wild. I count as anything.",
  'Never run out of steam: free coins every couple of hours.',
  "Fair warning: every time a cup lands, I drink it. Five cups and... well. Bring spare pants.",
  'Welcome to Shurda Café, where the coffee is strong and so are the consequences.',
  'Shurda! You made it. Grab a seat and a spin.',
];

function renderLobby() {
  $('#greeting').textContent = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
  const grid = $('#machine-grid');
  grid.innerHTML = '';
  for (const m of MACHINES) {
    const locked = state.level < m.unlockLevel;
    const tile = document.createElement('button');
    tile.className = 'tile';
    tile.dataset.theme = m.theme;
    tile.disabled = locked;
    tile.dataset.action = 'open';
    tile.dataset.id = m.id;
    const syms = ['JACK', 'CUP', 'DONUT', 'POT'].map((s) => `<div>${SYMBOL_ART[s]}</div>`).join('');
    tile.innerHTML = `
      <span class="tile-name">${m.name}</span>
      <span class="tile-tag">${m.tagline}</span>
      <span class="tile-syms">${syms}</span>
      <span class="tile-meta">
        <span class="tag">${m.lines} lines</span>
        <span class="tag">Free spins ×${m.freeSpinMultiplier}</span>
        ${m.expandingWilds ? '<span class="tag">Stretchy Daki</span>' : ''}
      </span>
      <span class="tile-play">PLAY</span>
      ${locked ? `<span class="lock">🔒 Level ${m.unlockLevel}</span>` : ''}`;
    grid.appendChild(tile);
  }
}

function showView(id) {
  $('#lobby').hidden = id !== 'lobby';
  $('#machine').hidden = id !== 'machine';
  window.scrollTo({ top: 0 });
}

// ---------- Machine ----------
let machine = null;
const cellHTML = (sym) => `<div class="cell" data-sym="${sym}">${SYMBOL_ART[sym]}</div>`;

function openMachine(id) {
  machine = machineById(id);
  if (!machine || state.level < machine.unlockLevel) return;
  state.machineId = id;
  $('#machine').dataset.theme = machine.theme;
  $('#machine-name').textContent = machine.name;
  const reels = $('#reels');
  reels.innerHTML = '';
  for (let r = 0; r < REELS; r++) {
    const reel = document.createElement('div');
    reel.className = 'reel';
    const strip = document.createElement('div');
    strip.className = 'strip';
    strip.innerHTML = Array.from({ length: ROWS }, () => cellHTML(randomSymbol(machine))).join('');
    reel.appendChild(strip);
    reels.appendChild(reel);
  }
  clearWins();
  $('#win-amount').textContent = '0';
  clampBet();
  renderControls();
  showView('machine');
  save();
}

function currentBet() { return run.freeSpins > 0 ? run.freeBet : BET_LADDER[state.betIndex]; }

function clampBet() {
  state.betIndex = Math.max(0, Math.min(state.betIndex, maxBetIndex(state.level)));
}

function renderControls() {
  const busy = run.spinning || run.freeSpins > 0;
  $('#bet-value').textContent = fmt(currentBet());
  $('#bet-down').disabled = busy || run.auto > 0 || state.betIndex === 0;
  $('#bet-up').disabled = busy || run.auto > 0 || state.betIndex >= maxBetIndex(state.level);
  $('#bet-max').disabled = busy || run.auto > 0 || state.betIndex >= maxBetIndex(state.level);
  const spinBtn = $('#spin-btn');
  spinBtn.classList.toggle('stop', run.auto > 0);
  spinBtn.textContent = run.auto > 0 ? 'STOP' : 'SPIN';
  spinBtn.disabled = run.freeSpins > 0 || (run.spinning && run.auto === 0);
  document.querySelectorAll('[data-action="auto"]').forEach((b) => {
    b.disabled = busy || run.auto > 0;
  });
  $('#auto-status').textContent = run.auto > 0 ? `${run.auto} spins left` : '';
  const fs = $('#fs-banner');
  fs.hidden = run.freeSpins <= 0;
  $('#fs-left').textContent = run.freeSpins;
  $('#fs-won').textContent = fmt(run.freeWon);
}

function clearWins() {
  clearInterval(run.lineTimer);
  $('#lines').innerHTML = '';
  document.querySelectorAll('.cell.win, .cell.dim').forEach((c) => c.classList.remove('win', 'dim'));
  document.querySelectorAll('.reel.expanded, .reel.anticipate').forEach((r) => r.classList.remove('expanded', 'anticipate'));
  $('#win-display').classList.remove('hot');
}

const ease = (t) => { // ease-out with a small settle bounce
  const c1 = 1.2, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

function animateReels(result) {
  const fast = state.settings.fast;
  const reels = [...document.querySelectorAll('.reel')];
  const cellH = reels[0].clientHeight / ROWS;
  let scattersSoFar = 0;
  return new Promise((resolve) => {
    let done = 0;
    let extra = 0;
    reels.forEach((reel, r) => {
      const strip = reel.querySelector('.strip');
      const prev = [...strip.querySelectorAll('.cell')].slice(-ROWS).map((c) => c.dataset.sym);
      const fillers = Array.from({ length: (fast ? 8 : 14) + r * (fast ? 2 : 4) }, () => randomSymbol(machine));
      const order = [...result.raw[r], ...fillers, ...prev];
      strip.innerHTML = order.map(cellHTML).join('');
      const distance = (order.length - ROWS) * cellH;
      strip.style.transform = `translateY(${-distance}px)`;

      // Two pots already showing? Slow the rest down for suspense.
      if (r >= 2 && scattersSoFar >= 2) { extra += fast ? 300 : 650; reel.classList.add('anticipate'); }
      scattersSoFar += result.raw[r].filter((s) => s === 'POT').length;
      const duration = (fast ? 380 : 750) + r * (fast ? 110 : 210) + extra;

      const start = performance.now();
      const frame = (now) => {
        const t = run.skip ? 1 : Math.min(1, (now - start) / duration);
        strip.style.transform = `translateY(${-distance * (1 - ease(t))}px)`;
        if (t < 1) requestAnimationFrame(frame);
        else {
          strip.innerHTML = result.raw[r].map(cellHTML).join('');
          strip.style.transform = 'translateY(0)';
          reel.classList.remove('anticipate');
          sfx.stop(r);
          if (++done === REELS) resolve();
        }
      };
      requestAnimationFrame(frame);
    });
  });
}

async function showExpandedWilds(result) {
  if (!result.expanded.length) return;
  const reels = [...document.querySelectorAll('.reel')];
  for (const r of result.expanded) {
    reels[r].classList.add('expanded');
    reels[r].querySelector('.strip').innerHTML = result.grid[r].map(cellHTML).join('');
    sfx.coin();
    await sleep(state.settings.fast ? 120 : 260);
  }
}

const LINE_COLORS = ['#c2338f', '#2f5fc4', '#23857f', '#7b4fc9', '#e07a16', '#d6336c', '#1c7ed6', '#2b8a3e'];

function cellEl(reel, row) {
  return document.querySelectorAll('.reel')[reel].querySelectorAll('.cell')[row];
}

function showWins(result) {
  clearInterval(run.lineTimer);
  const svg = $('#lines');
  svg.innerHTML = '';
  const wins = result.lineWins;
  const allCells = document.querySelectorAll('.reel .cell');
  if (!wins.length && !result.scatterCells.length) return;

  allCells.forEach((c) => c.classList.add('dim'));
  const lit = (reel, row) => { const c = cellEl(reel, row); c.classList.remove('dim'); c.classList.add('win'); };
  const polyFor = (w, i) => {
    const pts = PAYLINES[w.line].map((row, reel) => `${reel * 100 + 50},${row * 100 + 50}`).join(' ');
    return `<polyline points="${pts}" stroke="${LINE_COLORS[i % LINE_COLORS.length]}"/>`;
  };

  // First: everything at once.
  svg.innerHTML = wins.map(polyFor).join('');
  wins.forEach((w) => PAYLINES[w.line].slice(0, w.count).forEach((row, reel) => lit(reel, row)));
  result.scatterCells.forEach(([reel, row]) => lit(reel, row));

  // Then: cycle through each line.
  if (wins.length > 1) {
    let i = 0;
    run.lineTimer = setInterval(() => {
      allCells.forEach((c) => { c.classList.remove('win'); c.classList.add('dim'); });
      const w = wins[i % wins.length];
      svg.innerHTML = polyFor(w, i % wins.length);
      PAYLINES[w.line].slice(0, w.count).forEach((row, reel) => lit(reel, row));
      i++;
    }, 1100);
  }
}

async function doSpin() {
  if (run.spinning || !machine) return;
  const free = run.freeSpins > 0;
  const bet = currentBet();

  if (!free && state.coins < bet) {
    run.auto = 0;
    renderControls();
    outOfCoins();
    return;
  }

  run.spinning = true;
  run.skip = false;
  clearWins();
  $('#win-amount').textContent = '0';
  if (free) {
    run.freeSpins--;
  } else {
    state.coins -= bet;
    state.stats.spins++;
    renderTopbar();
  }
  renderControls();
  sfx.spin();

  let result = spin(machine, bet, { rng, freeSpin: free });
  if (run.forced) { // debug only: #debug in the URL
    const raw = run.forced; run.forced = null;
    const { grid, expanded } = applyExpandingWilds(machine, raw);
    result = { raw, grid, expanded, ...evaluate(machine, grid, bet, { freeSpin: free }) };
  }
  await animateReels(result);
  await showExpandedWilds(result);

  let cheer = Promise.resolve();
  if (result.totalWin > 0) {
    showWins(result);
    $('#win-display').classList.add('hot');
    const tier = winTier(result.totalWin, bet);
    cheer = celebrate(!!tier);
    if (tier) await bigWin(tier, result.totalWin);
    else { sfx.win(); await countUp($('#win-amount'), 0, result.totalWin, 500, sfx.tick); }
    $('#win-amount').textContent = fmt(result.totalWin);
    state.coins += result.totalWin;
    state.stats.totalWon += result.totalWin;
    state.stats.biggestWin = Math.max(state.stats.biggestWin, result.totalWin);
    if (free) run.freeWon += result.totalWin;
    renderTopbar({ animateCoins: true });
    renderControls();
  }

  // Hair trimmers: 3 anywhere shave his moustache, 5 shave the beard too.
  if (result.shave) {
    result.trimCells.forEach(([reel, row]) => { const c = cellEl(reel, row); c.classList.remove('dim'); c.classList.add('win', 'trim-hit'); });
    await cheer;
    const level = result.shave === 'full' || state.shave === 'full' ? 'full' : 'stache';
    state.shave = level;
    state.shaveSpins = SHAVE_SPINS;
    state.stats.shaves = (state.stats.shaves || 0) + 1;
    save();
    toast(result.shave === 'full' ? '✂️ 5 trimmers! Daki gets the full shave!' : '✂️ 3 trimmers! Bye-bye moustache!', 2600);
    await shaveAnim(result.shave, SHAVE_SPINS);
    document.querySelectorAll('.trim-hit').forEach((c) => c.classList.remove('trim-hit'));
  } else if (state.shave !== 'none') { // growing back, one spin at a time
    state.shaveSpins = Math.max(0, state.shaveSpins - 1);
    if (state.shaveSpins === 0) {
      state.shave = 'none';
      save();
      await cheer;
      await regrow();
    } else setShave(state.shave, state.shaveSpins);
    save();
  }

  // Daki drinks a cup on every spin where a coffee cup lands on the reels.
  if (result.grid.some((col) => col.includes('CUP'))) {
    state.cups = Math.min(CUP_LIMIT, state.cups + 1);
    save();
    await cheer;
    await drink(state.cups);
    if (state.cups >= CUP_LIMIT) {
      await accident();
      state.cups = 0;
      state.stats.accidents++;
      save();
      // Bonus mini-game: Daki tosses cups at the espresso machine.
      if (run.auto > 0) { run.auto = 0; renderControls(); }
      const won = await cupToss({ bet, fast: state.settings.fast, shave: state.shave });
      if (won > 0) {
        state.coins += won;
        state.stats.totalWon += won;
        renderTopbar({ animateCoins: true });
        toast(`Shurda! Cup Toss bonus: +${fmt(won)} coins`, 3000);
      }
      save();
    }
  }

  if (!free) await addXp(xpForSpin(bet));

  if (result.freeSpinsWon) {
    sfx.scatter();
    const first = run.freeSpins === 0 && !free;
    if (first) { run.freeBet = bet; run.freeWon = 0; }
    run.freeSpins += result.freeSpinsWon;
    await modal({
      title: first ? 'FREE REFILLS!' : 'MORE REFILLS!',
      jack: true,
      body: `<p class="big-number">${result.freeSpinsWon} free spins</p>
             <p>Every win pays ×${machine.freeSpinMultiplier} during free spins.</p>`,
      actions: [{ label: "Let's brew", primary: true }],
      autoCloseMs: run.auto > 0 ? 2500 : 0,
    });
  }

  run.spinning = false;
  save();

  if (run.freeSpins > 0) {
    renderControls();
    await sleep(state.settings.fast ? 350 : 700);
    return doSpin();
  }
  if (free) { // the free spins just ended
    renderControls();
    await modal({
      title: 'Refills done!',
      body: `<p>Your free spins brewed up</p><p class="big-number">${fmt(run.freeWon)}</p>`,
      actions: [{ label: 'Collect', primary: true }],
      autoCloseMs: run.auto > 0 ? 2500 : 0,
    });
    run.freeWon = 0;
  }

  if (run.auto > 0) {
    run.auto--;
    const stopForBigWin = result.totalWin >= bet * ECONOMY.winTiers[ECONOMY.winTiers.length - 1].at;
    if (run.auto > 0 && !stopForBigWin) {
      renderControls();
      await sleep(state.settings.fast ? 250 : 500);
      if (run.auto > 0) return doSpin();
    } else if (stopForBigWin && run.auto > 0) {
      toast('Autospin paused for your big win');
      run.auto = 0;
    }
  }
  renderControls();
}

async function addXp(amount) {
  state.xp += amount;
  while (state.xp >= xpForLevel(state.level)) {
    state.xp -= xpForLevel(state.level);
    state.level++;
    const reward = levelReward(state.level);
    state.coins += reward;
    const unlocked = MACHINES.filter((m) => m.unlockLevel === state.level);
    const betUp = maxBetIndex(state.level) > maxBetIndex(state.level - 1);
    sfx.levelUp();
    renderTopbar({ animateCoins: true });
    await modal({
      title: `Level ${state.level}!`,
      jack: true,
      body: `<p>Here's a fresh cup on the house:</p>
             <p class="big-number">+${fmt(reward)}</p>
             ${unlocked.map((m) => `<p>🔓 New machine unlocked: <b>${m.name}</b></p>`).join('')}
             ${betUp ? `<p>Max bet raised to <b>${fmt(BET_LADDER[maxBetIndex(state.level)])}</b></p>` : ''}`,
      actions: [{ label: 'Thanks, Daki!', primary: true }],
      autoCloseMs: run.auto > 0 ? 2500 : 0,
    });
  }
  renderTopbar();
  renderControls();
}

// ---------- Big win ----------
function bigWin(tier, amount) {
  return new Promise((resolve) => {
    const el = $('#bigwin');
    $('#bigwin-tier').textContent = tier.name;
    $('#bigwin-amount').textContent = '0';
    const conf = $('#confetti');
    conf.innerHTML = '';
    const colors = ['#f5c518', '#c2338f', '#3fb8b0', '#7b4fc9', '#2f5fc4'];
    for (let i = 0; i < 40; i++) {
      const c = document.createElement('i');
      c.style.left = `${Math.random() * 100}%`;
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = `${1.8 + Math.random() * 2.2}s`;
      c.style.animationDelay = `${Math.random() * 1.2}s`;
      conf.appendChild(c);
    }
    el.hidden = false;
    sfx.bigWin();
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      run.skip = true;
      el.hidden = true;
      el.removeEventListener('click', close);
      setTimeout(() => { run.skip = false; }, 50);
      resolve();
    };
    el.addEventListener('click', close);
    countUp($('#bigwin-amount'), 0, amount, 2200, sfx.coin).then(() => {
      setTimeout(close, run.auto > 0 ? 1200 : 2600);
    });
  });
}

// ---------- Modals ----------
let modalResolve = null;
function modal({ title, body = '', actions = [{ label: 'OK', primary: true }], jack = false, wide = false, closable = true, autoCloseMs = 0, onOpen }) {
  return new Promise((resolve) => {
    const root = $('#modal-root');
    root.innerHTML = `
      <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${title}">
        ${closable ? '<button class="icon-btn close-x" data-modal="close" aria-label="Close">×</button>' : ''}
        ${jack ? '<img class="modal-jack" src="assets/java-jack.png" alt="">' : ''}
        <h3>${title}</h3>
        <div class="modal-body">${body}</div>
        <div class="modal-actions">
          ${actions.map((a, i) => `<button class="btn ${a.primary ? '' : 'secondary'} ${a.danger ? 'danger' : ''}" data-modal="${i}">${a.label}</button>`).join('')}
        </div>
      </div>`;
    root.hidden = false;
    let timer;
    const finish = (value) => {
      clearTimeout(timer);
      root.hidden = true;
      root.innerHTML = '';
      modalResolve = null;
      resolve(value);
    };
    modalResolve = finish;
    root.onclick = (e) => {
      const b = e.target.closest('[data-modal]');
      if (b) {
        sfx.click();
        const v = b.dataset.modal;
        if (v === 'close') return finish(null);
        const a = actions[Number(v)];
        if (a.onClick && a.onClick(root) === false) return; // handler keeps the modal open
        return finish(a.value ?? Number(v));
      }
      if (e.target === root && closable) finish(null);
    };
    root.querySelector('.modal-actions .btn')?.focus({ preventScroll: true });
    if (onOpen) onOpen(root);
    if (autoCloseMs) timer = setTimeout(() => finish(0), autoCloseMs);
  });
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalResolve) modalResolve(null);
});

// ---------- Bonus wheel ----------
function wheelSVG() {
  const segs = ECONOMY.wheel;
  const n = segs.length;
  const colors = ['#c2338f', '#3fb8b0', '#7b4fc9', '#f5c518', '#2f5fc4', '#e07a16', '#23857f', '#92206a'];
  let paths = '';
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * 2 * Math.PI - Math.PI / 2 - Math.PI / n;
    const a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2 - Math.PI / n;
    const x0 = 100 + 96 * Math.cos(a0), y0 = 100 + 96 * Math.sin(a0);
    const x1 = 100 + 96 * Math.cos(a1), y1 = 100 + 96 * Math.sin(a1);
    const am = (a0 + a1) / 2;
    const tx = 100 + 68 * Math.cos(am), ty = 100 + 68 * Math.sin(am);
    paths += `<path d="M100 100 L${x0} ${y0} A96 96 0 0 1 ${x1} ${y1} Z" fill="${colors[i]}" stroke="#2a1a12" stroke-width="3"/>
      <text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="central" transform="rotate(${(am * 180) / Math.PI + 90} ${tx} ${ty})"
        font-family="Lilita One, sans-serif" font-size="22" fill="#fff6e9" stroke="#2a1a12" stroke-width="4" paint-order="stroke">×${segs[i]}</text>`;
  }
  return `<svg class="wheel" id="wheel" viewBox="0 0 200 200"><circle cx="100" cy="100" r="98" fill="#2a1a12"/>${paths}</svg>`;
}

async function openBonus() {
  if (bonusReadyIn() > 0) {
    toast('Daki is still brewing your next free coins');
    return;
  }
  const base = bonusAmount(state.level);
  let landed = null;
  let spun = false;
  await modal({
    title: 'Free coins!',
    closable: false,
    body: `<p>Base bonus <b>${fmt(base)}</b>. Spin for a multiplier!</p>
           <div class="wheel-wrap">${wheelSVG()}<div class="wheel-pointer"></div><div class="wheel-hub"><img src="assets/java-jack.png" alt=""></div></div>
           <p id="wheel-result">&nbsp;</p>`,
    actions: [{
      label: 'SPIN THE WHEEL', primary: true,
      onClick: (root) => {
        const btn = root.querySelector('.modal-actions .btn');
        if (!spun) {
          spun = true;
          btn.disabled = true;
          const n = ECONOMY.wheel.length;
          landed = Math.floor(rng() * n);
          const turns = 5 * 360 + (360 - (landed * 360) / n);
          root.querySelector('#wheel').style.transform = `rotate(${turns}deg)`;
          sfx.spin();
          setTimeout(() => {
            const mult = ECONOMY.wheel[landed];
            root.querySelector('#wheel-result').innerHTML = `<span class="big-number">×${mult} = ${fmt(bonusAmount(state.level, mult))}</span>`;
            sfx.scatter();
            btn.textContent = 'COLLECT';
            btn.disabled = false;
          }, 4100);
          return false;
        }
        return true;
      },
    }],
  });
  const amount = bonusAmount(state.level, ECONOMY.wheel[landed ?? 0]);
  state.coins += amount;
  state.lastBonusAt = Date.now();
  state.stats.bonuses++;
  sfx.win();
  renderTopbar({ animateCoins: true });
  save();
}

// ---------- Out of coins ----------
async function outOfCoins() {
  const lowest = BET_LADDER[0];
  if (state.coins >= lowest) {
    const fit = BET_LADDER.findLastIndex((b) => b <= state.coins);
    const choice = await modal({
      title: 'Running low!',
      jack: true,
      body: `<p>You've got <b>${fmt(state.coins)}</b> coins, not enough for a ${fmt(currentBet())} bet.</p>`,
      actions: [{ label: `Bet ${fmt(BET_LADDER[fit])} instead`, primary: true, value: 'lower' }, { label: 'Not now', value: 'no' }],
    });
    if (choice === 'lower') { state.betIndex = Math.min(fit, maxBetIndex(state.level)); renderControls(); save(); }
    return;
  }
  const wait = Math.max(0, state.lastTopUpAt + ECONOMY.topUpCooldownMs - Date.now());
  if (bonusReadyIn() === 0) {
    const go = await modal({
      title: 'Out of beans!',
      jack: true,
      body: '<p>Your free coin bonus is ready. Go grab it!</p>',
      actions: [{ label: 'Get free coins', primary: true, value: 'bonus' }],
    });
    if (go === 'bonus') openBonus();
    return;
  }
  if (wait === 0) {
    await modal({
      title: 'Out of beans!',
      jack: true,
      body: `<p>Daki slides you a refill to keep you going.</p><p class="big-number">+${fmt(ECONOMY.topUpCoins)}</p>`,
      actions: [{ label: 'Thanks, Daki!', primary: true }],
    });
    state.coins += ECONOMY.topUpCoins;
    state.lastTopUpAt = Date.now();
    state.betIndex = Math.min(state.betIndex, BET_LADDER.findLastIndex((b) => b <= state.coins));
    renderTopbar({ animateCoins: true });
    renderControls();
    save();
    return;
  }
  await modal({
    title: 'Out of beans!',
    jack: true,
    body: `<p>The next refill is ready in <b>${Math.ceil(wait / 60000)} min</b>, or grab your free coin bonus when the timer runs out.</p>`,
    actions: [{ label: 'OK', primary: true }],
  });
}

// ---------- Paytable ----------
function openPaytable() {
  const m = machine;
  const lineBet = currentBet() / m.lines;
  const order = ['JACK', 'CUP', 'DONUT', 'CROISSANT', 'STACHE', 'FLOWER', 'BEAN'];
  const rows = order.map((s) => `
    <div class="pay-row">
      <div class="art">${SYMBOL_ART[s]}</div>
      <div><div class="pay-name">${SYMBOLS[s].name}${s === 'JACK' ? ' · WILD' : ''}</div>
        <div class="pay-vals">${m.pays[s].map((p, i) => `<span>${i + 3}× <b>${fmt(p * lineBet)}</b></span>`).join('')}</div></div>
    </div>`).join('');
  const scatter = `
    <div class="pay-row">
      <div class="art">${SYMBOL_ART.POT}</div>
      <div><div class="pay-name">Coffee Pot · SCATTER</div>
        <div class="pay-vals">${m.scatterPays.map((p, i) => `<span>${i + 3}× <b>${fmt(p * currentBet())}</b> + ${m.freeSpins[i]} free</span>`).join('')}</div></div>
    </div>`;
  modal({
    title: `${m.name}: how it pays`,
    wide: true,
    body: `<p>Payouts at your current bet of <b>${fmt(currentBet())}</b>.</p>
      <div class="pay-list">${scatter}${rows}</div>
      <ul class="rules">
        <li>${m.lines} paylines, paying left to right from the first reel.</li>
        <li><b>Daki is wild</b>: he stands in for every symbol except the Coffee Pot.</li>
        ${m.expandingWilds ? '<li><b>Stretchy Daki:</b> a Daki on reels 2, 3 or 4 fills the whole reel.</li>' : ''}
        <li><b>Hair Trimmers</b> anywhere: 3 shave off Daki's moustache, 5 shave his beard too. It grows back after ${SHAVE_SPINS} spins.</li>
        <li>3 or more <b>Coffee Pots</b> anywhere start free spins. Wins during free spins pay ×${m.freeSpinMultiplier}, and pots can retrigger more.</li>
        <li>Only the best win on each line pays. Line wins and scatter wins add together.</li>
        <li>This is a free-play game. Coins have no cash value.</li>
      </ul>`,
    actions: [{ label: 'Got it', primary: true }],
  });
}

// ---------- Settings ----------
function openSettings() {
  const sw = (key, label) => `
    <div class="setting"><span>${label}</span>
      <button class="switch" role="switch" aria-checked="${state.settings[key]}" data-setting="${key}" aria-label="${label}"></button></div>`;
  modal({
    title: 'Settings',
    wide: true,
    body: `
      ${sw('sound', 'Sound effects')}
      ${sw('music', 'Café music')}
      <div class="setting volume"><label for="music-vol">Music volume</label>
        <input type="range" id="music-vol" class="vol-slider" min="0" max="100" step="1" value="${state.settings.musicVol}" aria-label="Music volume">
        <b class="vol-num">${state.settings.musicVol}%</b></div>
      ${sw('fast', 'Fast spins')}
      <div class="stats">
        <div class="stat">Spins<b>${fmt(state.stats.spins)}</b></div>
        <div class="stat">Biggest win<b>${fmt(state.stats.biggestWin)}</b></div>
        <div class="stat">Total won<b>${fmt(state.stats.totalWon)}</b></div>
        <div class="stat">Bonuses<b>${fmt(state.stats.bonuses)}</b></div>
        <div class="stat">Coffees drunk<b>${state.cups} / ${CUP_LIMIT}</b></div>
        <div class="stat">Accidents 💩<b>${fmt(state.stats.accidents)}</b></div>
      </div>
      ${storageOk ? '' : "<p>⚠️ Your browser is blocking storage, so progress won't be saved.</p>"}
      <p class="fineprint">Free play only. Coins have no cash value and can't be bought or cashed out.</p>`,
    actions: [{ label: 'Done', primary: true }, { label: 'Reset progress', danger: true, value: 'reset' }],
    onOpen: (root) => {
      root.querySelectorAll('[data-setting]').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.setting;
        state.settings[k] = !state.settings[k];
        b.setAttribute('aria-checked', state.settings[k]);
        applySettings();
        sfx.click();
        save();
      }));
      const vol = root.querySelector('#music-vol');
      const paint = () => { vol.style.setProperty('--fill', `${vol.value}%`); root.querySelector('.vol-num').textContent = `${vol.value}%`; };
      paint();
      vol.addEventListener('input', () => { state.settings.musicVol = Number(vol.value); setMusicVolume(vol.value / 100); paint(); });
      vol.addEventListener('change', save);
    },
  }).then(async (v) => {
    if (v !== 'reset') return;
    const sure = await modal({
      title: 'Start over?',
      body: '<p>This wipes your coins, level and stats. It cannot be undone.</p>',
      actions: [{ label: 'Keep playing', primary: true, value: 'no' }, { label: 'Yes, reset', danger: true, value: 'yes' }],
    });
    if (sure === 'yes') {
      try { localStorage.removeItem(SAVE_KEY); } catch {}
      location.reload();
    }
  });
}

function applySettings() {
  setFast(state.settings.fast);
  setSound(state.settings.sound);
  setMusicVolume(state.settings.musicVol / 100);
  setMusic(state.settings.music && state.settings.sound);
}

// ---------- Events ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const a = el.dataset.action;
  if (a !== 'spin') sfx.click();
  switch (a) {
    case 'home':
      if (run.spinning || run.freeSpins > 0) { toast('Finish this spin first'); return; }
      run.auto = 0;
      clearWins();
      renderLobby();
      showView('lobby');
      break;
    case 'open': openMachine(el.dataset.id); break;
    case 'spin':
      if (run.auto > 0) { run.auto = 0; renderControls(); return; }
      doSpin();
      break;
    case 'bet-down': state.betIndex = Math.max(0, state.betIndex - 1); renderControls(); save(); break;
    case 'bet-up': state.betIndex = Math.min(maxBetIndex(state.level), state.betIndex + 1); renderControls(); save(); break;
    case 'bet-max': state.betIndex = maxBetIndex(state.level); renderControls(); save(); break;
    case 'auto':
      run.auto = Number(el.dataset.n);
      renderControls();
      doSpin();
      break;
    case 'bonus': openBonus(); break;
    case 'paytable': openPaytable(); break;
    case 'settings': openSettings(); break;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !document.body.dataset.minigame && !$('#machine').hidden && $('#modal-root').hidden && $('#bigwin').hidden) {
    e.preventDefault();
    if (run.spinning) { run.skip = true; return; }
    if (run.auto > 0) { run.auto = 0; renderControls(); return; }
    doSpin();
  }
});

// ---------- Boot ----------
async function boot() {
  mountDaki($('#daki-panel'));
  setCups(state.cups);
  setShave(state.shave, state.shaveSpins);
  applySettings();
  renderTopbar();
  renderLobby();
  showView('lobby');
  if (!storageOk) toast("Your browser is blocking storage, so progress won't be saved", 4000);
  if (!state.welcomed) {
    await modal({
      title: 'Welcome to Shurda Café!',
      jack: true,
      closable: false,
      body: `<p>I'm Daki. Welcome to Shurda Café! Here's a welcome cup to get you spinning:</p>
             <p class="big-number">${fmt(ECONOMY.welcomeCoins)} coins</p>
             <p>Free play only. Coins have no cash value.</p>`,
      actions: [{ label: 'Collect', primary: true }],
    });
    state.coins += ECONOMY.welcomeCoins;
    state.welcomed = true;
    sfx.win();
    renderTopbar({ animateCoins: true });
    save();
  }
}
boot();

// Debug helpers for testing, only with #debug in the URL.
if (location.hash === '#debug') {
  window.__jj = {
    state, run,
    force: (grid) => { run.forced = grid; },
    cups: () => { run.forced = [['CUP', 'BEAN', 'FLOWER'], ['CUP', 'STACHE', 'BEAN'], ['CUP', 'FLOWER', 'DONUT'], ['BEAN', 'DONUT', 'FLOWER'], ['STACHE', 'BEAN', 'CROISSANT']]; },
    toss: () => cupToss({ bet: BET_LADDER[state.betIndex], shave: state.shave }),
    trims: (n = 3) => { // n trimmers on the next spin
      const g = [['BEAN', 'FLOWER', 'DONUT'], ['STACHE', 'BEAN', 'FLOWER'], ['CROISSANT', 'FLOWER', 'BEAN'], ['FLOWER', 'DONUT', 'STACHE'], ['BEAN', 'CROISSANT', 'FLOWER']];
      for (let i = 0; i < n; i++) g[i][1] = 'TRIM';
      run.forced = g;
    },
    pots: () => { run.forced = [['POT', 'BEAN', 'CUP'], ['FLOWER', 'POT', 'BEAN'], ['CUP', 'STACHE', 'POT'], ['BEAN', 'CUP', 'FLOWER'], ['DONUT', 'BEAN', 'STACHE']]; },
  };
}
