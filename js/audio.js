// Tiny synthesized sound kit (Web Audio). No audio files, all original.
let ctx = null;
let enabled = true;

export function setSound(on) { enabled = on; }

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, { dur = 0.12, type = 'triangle', vol = 0.15, at = 0, slide = 0 } = {}) {
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  click: () => tone(660, { dur: 0.05, type: 'square', vol: 0.06 }),
  spin: () => tone(220, { dur: 0.25, type: 'sawtooth', vol: 0.05, slide: 300 }),
  stop: (i = 0) => tone(140 + i * 18, { dur: 0.09, type: 'square', vol: 0.08 }),
  win: () => [523, 659, 784].forEach((f, i) => tone(f, { at: i * 0.08, dur: 0.16 })),
  bigWin: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, { at: i * 0.1, dur: 0.22, vol: 0.18 })),
  scatter: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, { at: i * 0.07, dur: 0.2, type: 'sine', vol: 0.2 })),
  levelUp: () => [440, 554, 659, 880].forEach((f, i) => tone(f, { at: i * 0.09, dur: 0.25, type: 'sine', vol: 0.2 })),
  coin: () => tone(1320, { dur: 0.06, type: 'sine', vol: 0.08 }),
  tick: () => tone(900, { dur: 0.03, type: 'square', vol: 0.04 }),
  gulp: () => [0, 0.28, 0.56].forEach((at) => tone(320, { at, dur: 0.14, type: 'sine', vol: 0.18, slide: -200 })),
  fart: (level = 1) => fart(level),
  clink: () => { tone(1568, { dur: 0.12, type: 'sine', vol: 0.18 }); tone(2093, { dur: 0.18, type: 'sine', vol: 0.1, at: 0.03 }); },
  crash: () => crash(),
  buzz: (dur = 1.4) => buzz(dur),
  boom: () => boom(),
  whoosh: () => whoosh(),
  thud: () => { tone(120, { dur: 0.25, type: 'sine', vol: 0.4, slide: -70 }); tone(700, { dur: 0.08, type: 'square', vol: 0.05, at: 0.01 }); },
  tinkle: (vol = 0.06) => tone(3000 + Math.random() * 2600, { dur: 0.06 + Math.random() * 0.05, type: 'sine', vol }),
  splat: () => { fart(3, 0.5); tone(90, { dur: 0.35, type: 'sine', vol: 0.3, slide: -50, at: 0.05 }); },
};

// A synthesized toot: a buzzy low oscillator with a wobbly pitch, plus
// filtered noise for the "air". Bigger level means longer, lower, louder.
function fart(level = 1, lenOverride) {
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  const now = c.currentTime;
  const dur = lenOverride ?? Math.min(2.2, 0.22 + level * 0.22);
  const vol = Math.min(0.5, 0.16 + level * 0.06);

  const o = c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(110 - level * 6, now);
  o.frequency.linearRampToValueAtTime(70 - level * 4, now + dur);
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 18 + Math.random() * 14;
  lfoGain.gain.value = 22;
  lfo.connect(lfoGain).connect(o.frequency);

  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const noise = c.createBufferSource();
  noise.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 180;
  bp.Q.value = 1.4;

  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 600;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(vol, now + 0.03);
  // sputter: a few dips in volume
  const steps = 2 + level;
  for (let i = 1; i <= steps; i++) {
    const at = now + (dur * i) / (steps + 1);
    g.gain.setValueAtTime(vol * (0.35 + Math.random() * 0.5), at);
    g.gain.linearRampToValueAtTime(vol, at + 0.04);
  }
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  o.connect(lp);
  noise.connect(bp).connect(lp);
  lp.connect(g).connect(c.destination);
  o.start(now); lfo.start(now); noise.start(now);
  o.stop(now + dur + 0.05); lfo.stop(now + dur + 0.05); noise.stop(now + dur + 0.05);
}

// Background music: three looping tracks that follow Daki's coffee meter.
// Toplo Vreme while he's sober-ish, Festivni Dan from cup 3, Festivno Kolo from cup 4.
const TRACKS = {
  toplo: 'assets/music/toplo-vreme.m4a',
  dan: 'assets/music/festivni-dan.m4a',
  kolo: 'assets/music/festivno-kolo.m4a',
};
let musicVol = 0.4; // 0..1, set from the settings slider
const FADE_MS = 1200;
export const trackForCups = (n) => (n >= 4 ? 'kolo' : n >= 3 ? 'dan' : 'toplo');
let musicOn = false;
let want = 'toplo';
const players = {};
function player(name) {
  if (!players[name]) {
    const a = new Audio(TRACKS[name]);
    a.loop = true; a.preload = 'auto'; a.volume = 0;
    players[name] = a;
  }
  return players[name];
}
// Fade a track's volume, pausing (and rewinding) it once it's silent.
function fade(a, to) {
  clearInterval(a._fade);
  const from = a.volume, t0 = performance.now();
  a._fade = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / FADE_MS);
    a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k >= 1) {
      clearInterval(a._fade);
      if (to === 0) { a.pause(); a.currentTime = 0; }
    }
  }, 40);
}
function syncMusic() {
  const audible = musicOn && !document.hidden;
  for (const name of Object.keys(TRACKS)) {
    const on = audible && name === want;
    if (!on && !players[name]) continue;
    const a = player(name);
    if (on) {
      if (a.paused) a.play().catch(() => {}); // blocked until the first click; retried below
      fade(a, musicVol);
    } else if (!a.paused) fade(a, 0);
  }
}
export const musicPlayers = players; // for the #debug console
export function setMusic(on) { musicOn = on; syncMusic(); }
// Volume slider: applies straight away to whatever is playing.
export function setMusicVolume(v) {
  musicVol = Math.max(0, Math.min(1, v));
  const a = players[want];
  if (a && !a.paused) { clearInterval(a._fade); a.volume = musicVol; }
}
export function setMusicTrack(name) { if (name !== want) { want = name; syncMusic(); } }
// Browsers only allow audio after the player has interacted with the page.
['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, () => {
  const a = players[want];
  if (musicOn && (!a || a.paused)) syncMusic();
}));
document.addEventListener('visibilitychange', syncMusic);

// Ceramic smash: a thud, a burst of bright filtered noise, a rattle of
// scattering pieces and a few high pings from the bigger shards.
function noiseBurst(c, t, { dur, freq, q = 0.8, type = 'bandpass', vol }) {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.5);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
}

function crash() {
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  tone(150, { dur: 0.22, type: 'sine', vol: 0.45, slide: -100 });          // impact thud
  noiseBurst(c, t, { dur: 0.45, freq: 3200, q: 0.6, vol: 0.55 });          // the smash
  noiseBurst(c, t + 0.005, { dur: 0.18, freq: 900, q: 1.2, vol: 0.35 });   // body of the crack
  for (let i = 0; i < 6; i++) {                                            // pieces rattling
    noiseBurst(c, t + 0.12 + i * 0.07 + Math.random() * 0.04, { dur: 0.05, freq: 4500 + Math.random() * 2000, q: 2, vol: 0.18 * (1 - i / 7) });
  }
  for (let i = 0; i < 9; i++) {                                            // bright pings
    tone(2400 + Math.random() * 3600, { at: 0.02 + Math.random() * 0.5, dur: 0.05 + Math.random() * 0.12, type: 'sine', vol: 0.05 + Math.random() * 0.06 });
  }
}

// Fastball: a fast rising swish of filtered noise.
function whoosh() {
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime, dur = 0.45;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.5;
  f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(4000, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
}

// Espresso machine explosion: deep boom, roaring rumble, crack, and metal
// bits clanging down afterwards.
function boom() {
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  tone(90, { dur: 1.1, type: 'sine', vol: 0.7, slide: -60 });               // the boom
  tone(55, { dur: 1.4, type: 'triangle', vol: 0.5, slide: -20 });
  noiseBurst(c, t, { dur: 1.6, freq: 500, q: 0.5, type: 'lowpass', vol: 0.9 }); // roar
  noiseBurst(c, t, { dur: 0.25, freq: 3000, q: 0.4, type: 'highpass', vol: 0.45 }); // crack
  crash();                                                                     // the mug too
  for (let i = 0; i < 7; i++) {                                                // clanging metal
    const at = 0.35 + i * 0.12 + Math.random() * 0.08;
    const f = 380 + Math.random() * 700;
    tone(f, { at, dur: 0.18, type: 'square', vol: 0.05 });
    tone(f * 2.76, { at, dur: 0.12, type: 'sine', vol: 0.04 });
  }
}

// Electric hair trimmer: a buzzing square wave with a fast wobble.
function buzz(dur) {
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 118;
  const lfo = c.createOscillator(); lfo.frequency.value = 9;
  const lg = c.createGain(); lg.gain.value = 0.05;
  const g = c.createGain();
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.9;
  lfo.connect(lg).connect(g.gain);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.05);
  g.gain.setValueAtTime(0.16, t + dur - 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(c.destination);
  o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
}
