// Daki's side panel. He stands idle beside the reels, cheers on wins, drinks a
// coffee every spin a cup lands on the reels, gets gassier with each cup, and
// on cup 5 turns around to reveal the damage, runs off, and comes back clean.
// Poses are sprites generated with OpenArt from the original Daki drawing.
import { sfx, setMusicTrack, trackForCups } from './audio.js';
import { SYMBOL_ART } from './symbols.js';

export const CUP_LIMIT = 5;

const POSES = {
  idle: 'assets/daki/idle.png',
  cheer: 'assets/daki/cheer.png',
  drink: 'assets/daki/drink.png',
  ache: 'assets/daki/ache.png',
  shock: 'assets/daki/shock.png',
  back: 'assets/daki/back.png',
  oops: 'assets/daki/oops.png',
  run: 'assets/daki/run.png',
  // in-between frames for smoother motion
  blink: 'assets/daki/blink.png',
  raise: 'assets/daki/raise.png',
  crouch: 'assets/daki/crouch.png',
  side: 'assets/daki/side.png',
  ache2: 'assets/daki/ache2.png',
  run2: 'assets/daki/run2.png',
  oops2: 'assets/daki/oops2.png',
};
// Shaved looks: '-m' has no moustache, '-f' has no facial hair at all. From
// behind you can't see the moustache, so those poses only have a '-f' file.
let shave = 'none'; // none | stache | full
const BACK_POSES = ['back']; // the only pose with no face showing
const src = (name) => {
  const base = POSES[name];
  if (shave === 'full') return base.replace('.png', '-f.png');
  if (shave === 'stache' && !BACK_POSES.includes(name)) return base.replace('.png', '-m.png');
  return base;
};
// Preload so pose swaps never flash.
Object.entries(POSES).forEach(([name, p]) => ['', '-m', '-f'].forEach((v) => {
  if (v === '-m' && BACK_POSES.includes(name)) return; // no '-m' file for poses facing away
  const i = new Image(); i.src = p.replace('.png', `${v}.png`);
}));

const $ = (s, el = document) => el.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (a) => a[Math.floor(Math.random() * a.length)];

let fast = false;
export function setFast(on) { fast = on; }
const t = (ms) => (fast ? ms * 0.6 : ms);

const CHEERS = ['Shurda! Woo-hoo!', 'Brewtiful!', 'Ka-ching! Shurda!', "Shurda, that's the stuff!", 'Yeah, baby!', 'Hot streak, shurda!'];
const BIG_CHEERS = ['SHURDA!! JACKPOT!', 'Shurda, I can taste it!', 'BEST. DAY. EVER! Shurda!'];
const SIPS = ['*gulp gulp gulp*', '*slurp* Ahh, shurda!', 'Mmm, one more cup...', '*gulp* Shurda, strong stuff!'];
// What he says right after each fart, by cup count.
const BELLY = [
  { status: 'Happy belly', lines: [] },
  { status: 'A little gassy', lines: ['Ooh... *rumble*', 'Shurda... that one snuck out!'] },
  { status: 'Rumbly tummy', lines: ['Shurda! Excuse me!', 'Uh-oh. Gassy, shurda.'] },
  { status: 'Very rumbly', lines: ['Shurda! My belly... 😣', 'Oof. Shurda, not good...'] },
  { status: '⚠️ DANGER ZONE', lines: ['Shurda! Bout to crap my pants!', 'Code brown incoming! SHURDA!'] },
  { status: 'Too late...', lines: [] },
];
const FART_WORDS = ['pfft', 'PFFRT!', 'BRAAP!', 'BRRRAAAPP!!', 'BRRRRRAAAAPPP!!!'];

let el = {};

export function mountDaki(root) {
  root.innerHTML = `
    <div class="daki-say"><div class="daki-bubble"></div></div>
    <div class="daki-stage">
      <div class="daki-floor" aria-hidden="true"></div>
      <div class="daki-figure">
        <img class="daki-sprite" src="${POSES.idle}" alt="Daki" draggable="false">
        <div class="puffs" aria-hidden="true"></div>
      </div>
      <div class="daki-shadow" aria-hidden="true"></div>
      <div class="fart-word" aria-hidden="true"></div>
    </div>
    <div class="cup-meter">
      <div class="cup-meter-head"><span>Coffee meter</span><b class="cup-count">0 / ${CUP_LIMIT}</b></div>
      <div class="cup-row">${Array.from({ length: CUP_LIMIT }, () => `<span class="cup-slot">${SYMBOL_ART.CUP}</span>`).join('')}</div>
      <div class="belly"><span class="belly-label">Belly:</span><span class="belly-status">Happy belly</span></div>
      <div class="belly-bar"><span></span></div>
      <p class="cup-hint">Every time a coffee cup lands on the reels, Daki drinks one.</p>
      <div class="shave-status" hidden></div>
    </div>`;
  el = {
    root,
    figure: $('.daki-figure', root),
    sprite: $('.daki-sprite', root),
    bubble: $('.daki-bubble', root),
    puffs: $('.puffs', root),
    word: $('.fart-word', root),
    count: $('.cup-count', root),
    slots: [...root.querySelectorAll('.cup-slot')],
    status: $('.belly-status', root),
    bar: $('.belly-bar span', root),
    shave: $('.shave-status', root),
  };
  root.dataset.pose = 'idle';
  scheduleBlink();
}

function pose(name) {
  el.sprite.src = src(name);
  el.root.dataset.pose = name;
}

// Flipbook player. A new sequence cancels any running one.
let animId = 0;
async function frames(seq, { loop = false } = {}) {
  const id = ++animId;
  do {
    for (const [name, ms] of seq) {
      if (id !== animId) return;
      pose(name);
      await sleep(t(ms));
    }
  } while (loop && id === animId);
}
const stopFrames = () => { animId++; };

// Idle blink every few seconds.
function scheduleBlink() {
  setTimeout(async () => {
    if (el.root && el.root.dataset.pose === 'idle' && !busy()) {
      pose('blink');
      await sleep(130);
      if (el.root.dataset.pose === 'blink') pose('idle');
    }
    scheduleBlink();
  }, 2500 + Math.random() * 3500);
}

export function setCups(n) {
  setMusicTrack(trackForCups(n));
  if (!el.root) return;
  el.count.textContent = `${n} / ${CUP_LIMIT}`;
  el.slots.forEach((s, i) => s.classList.toggle('full', i < n));
  el.status.textContent = BELLY[Math.min(n, CUP_LIMIT)].status;
  el.bar.style.width = `${(100 * Math.min(n, CUP_LIMIT)) / CUP_LIMIT}%`;
  el.root.dataset.cups = n;
}

let bubbleTimer;
function say(text, ms = 1600) {
  el.bubble.textContent = text;
  el.bubble.classList.add('show');
  el.bubble.classList.remove('pop'); void el.bubble.offsetWidth; el.bubble.classList.add('pop');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => { el.bubble.classList.remove('show'); }, t(ms));
}

function play(cls, ms) {
  el.root.classList.remove(cls); void el.root.offsetWidth;
  el.root.classList.add(cls);
  return sleep(t(ms)).then(() => el.root.classList.remove(cls));
}

const busy = () => el.root.classList.contains('accident') || el.root.classList.contains('away');

export async function celebrate(big = false) {
  if (!el.root || busy()) return;
  say(big ? pick(BIG_CHEERS) : pick(CHEERS), big ? 2200 : 1300);
  await frames([['crouch', 120]]);
  pose('cheer');
  await play(big ? 'party' : 'cheer', big ? 1500 : 650);
  await frames([['crouch', 110]]);
  if (!busy()) pose('idle');
}

function puff(count, size) {
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    const s = size * (0.7 + Math.random() * 0.6);
    p.style.width = p.style.height = `${s}px`;
    p.style.setProperty('--dx', `${-30 - Math.random() * 60}px`);
    p.style.setProperty('--dy', `${-10 - Math.random() * 50}px`);
    p.style.animationDelay = `${i * 70}ms`;
    el.puffs.appendChild(p);
    setTimeout(() => p.remove(), 1800 + i * 70);
  }
}

function fartWord(text, level) {
  el.word.textContent = text;
  el.word.style.setProperty('--size', `${16 + level * 5}px`);
  el.word.classList.remove('show'); void el.word.offsetWidth; el.word.classList.add('show');
}

async function fart(level) {
  sfx.fart(level);
  puff(2 + level * 2, 16 + level * 6);
  fartWord(FART_WORDS[Math.min(level, FART_WORDS.length) - 1], level);
  frames([['ache', 170], ['ache2', 170]], { loop: true });
  await play('rumble', 500 + level * 120);
  stopFrames();
}

// Daki drinks cup number n (1-based). Resolves after his belly reacts.
export async function drink(n) {
  if (!el.root) return;
  say(pick(SIPS), 1200);
  sfx.gulp();
  await frames([['raise', 170]]);
  pose('drink');
  await play('sip', 800);
  await frames([['raise', 150]]);
  setCups(n);
  el.slots[n - 1]?.classList.add('just');
  setTimeout(() => el.slots[n - 1]?.classList.remove('just'), 900);
  if (n >= CUP_LIMIT) return;
  pose('ache');
  const farting = fart(n);
  await sleep(t(280)); // the line comes right after the toot
  say(pick(BELLY[n].lines), 2000);
  await farting;
  pose('ache');
  await sleep(t(300));
  pose('idle');
}

// Turn around in steps: three-quarter front, side profile, back.
async function turn() {
  await frames([['side', 150], ['back', 150]]);
}

// The big one. Resolves once he's back in clean pants.
export async function accident() {
  if (!el.root) return;
  pose('shock');
  say('SHURDA!! Too much coffee!', 2000);
  sfx.fart(6);
  puff(14, 46);
  fartWord('BRRRRRRRAAAAAAPPP!!!', 6);
  await play('rumble', 1100);
  await turn();
  sfx.splat();
  el.root.classList.add('accident');
  frames([['oops', 380], ['oops2', 380]], { loop: true }); // embarrassed waddle
  say("*squish* ...shurda, don't look!", 2400);
  await sleep(t(2600));
  say('Shurda! BRB, restroom!!', 1400);
  el.root.classList.remove('accident');
  frames([['run', 110], ['run2', 110]], { loop: true }); // run cycle
  el.root.classList.add('away');
  await sleep(t(1000));
  setCups(0);
  await sleep(t(700));
  el.root.classList.remove('away');
  el.root.classList.add('back');
  await sleep(t(900));
  el.root.classList.remove('back');
  stopFrames();
  await frames([['crouch', 110]]);
  pose('cheer');
  say('Fresh pants! Shurda, back to it 😅', 2000);
  sfx.levelUp();
  await play('cheer', 650);
  await frames([['crouch', 110]]);
  pose('idle');
}

// ---------- Hair trimmers ----------
const SHAVE_LINES = {
  stache: ['SHURDA! My moustache!!', 'Noooo! Not the moustache, shurda!', 'I feel... naked. Shurda.'],
  full: ['SHURDA!! MY BEARD! MY BEAUTIFUL BEARD!', 'I look like a baby! Shurda!', 'Who is this man?! SHURDA!'],
};
const RANK = { none: 0, stache: 1, full: 2 };

// Show the current look and how long until it grows back.
export function setShave(level, spinsLeft = 0) {
  shave = level;
  if (!el.root) return;
  el.sprite.src = src(el.root.dataset.pose || 'idle');
  el.shave.hidden = level === 'none';
  el.shave.innerHTML = level === 'none' ? ''
    : `<span>${level === 'full' ? 'Clean shaven' : 'No moustache'}</span><b>grows back in ${spinsLeft} spin${spinsLeft === 1 ? '' : 's'}</b>`;
}

function hairBits(count) {
  for (let i = 0; i < count; i++) {
    const b = document.createElement('i');
    b.className = 'hair-bit';
    b.style.left = `${46 + Math.random() * 24}%`;
    b.style.top = `${18 + Math.random() * 14}%`;
    b.style.setProperty('--dx', `${(Math.random() - 0.5) * 70}px`);
    b.style.setProperty('--rot', `${(Math.random() - 0.5) * 540}deg`);
    b.style.animationDelay = `${i * 45}ms`;
    el.figure.appendChild(b);
    setTimeout(() => b.remove(), 1700 + i * 45);
  }
}

// The trimmer flies in and buzzes over his face. Resolves once he's shaved.
export async function shaveAnim(level, spinsLeft) {
  if (!el.root) return;
  stopFrames();
  const target = RANK[level] > RANK[shave] ? level : shave; // never grows hair back by shaving
  pose('shock');
  say("Hey! What's that buzzing?", 1200);
  const tool = document.createElement('div');
  tool.className = 'trimmer';
  tool.innerHTML = SYMBOL_ART.TRIM;
  el.figure.appendChild(tool);
  await sleep(t(450));
  sfx.buzz(level === 'full' ? 2.0 : 1.3);
  tool.classList.add('buzzing', level === 'full' ? 'wide' : 'narrow');
  el.root.classList.add('shaving');
  const steps = level === 'full' ? 6 : 3;
  for (let i = 0; i < steps; i++) { hairBits(level === 'full' ? 9 : 6); await sleep(t(300)); }
  setShave(target, spinsLeft);
  pose('shock');
  el.root.classList.remove('shaving');
  tool.classList.add('gone');
  setTimeout(() => tool.remove(), 500);
  say(pick(SHAVE_LINES[level]), 2600);
  await play('rumble', 600);
  await sleep(t(900));
  pose('idle');
}

// Hair's back: a happy little cheer.
export async function regrow() {
  if (!el.root) return;
  puff(6, 30);
  setShave('none');
  await frames([['crouch', 110]]);
  pose('cheer');
  say(pick(['Shurda! My glorious beard is back!', 'The moustache returns! Shurda!']), 2200);
  sfx.levelUp();
  await play('cheer', 650);
  await frames([['crouch', 110]]);
  pose('idle');
}
