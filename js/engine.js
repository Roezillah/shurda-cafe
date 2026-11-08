// Pure game math: machines, spins, payouts, progression.
// No DOM here, so tools/sim.js can run it in Node to tune the numbers.

export const SYMBOLS = {
  JACK: { name: 'Daki', kind: 'wild' },
  POT: { name: 'Coffee Pot', kind: 'scatter' },
  TRIM: { name: 'Hair Trimmer', kind: 'feature' }, // 3 anywhere: moustache shaved; 5: beard too
  CUP: { name: 'Flower Mug', kind: 'high' },
  DONUT: { name: 'Donut', kind: 'high' },
  CROISSANT: { name: 'Tiramisu', kind: 'mid' }, // ids kept from the old art (croissant, flower, bean)
  STACHE: { name: 'Mustache', kind: 'mid' },
  FLOWER: { name: 'Burek', kind: 'low' },
  BEAN: { name: 'Ćevapi', kind: 'low' },
};

// Rows are 0 (top), 1 (middle), 2 (bottom), one entry per reel.
export const PAYLINES = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [1, 0, 1, 2, 1],
  [1, 2, 1, 0, 1], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2], [0, 1, 1, 1, 0], [2, 1, 1, 1, 2],
  [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 2, 0, 2, 0], [2, 0, 2, 0, 2], [0, 2, 2, 2, 0],
  [2, 0, 0, 0, 2], [0, 0, 2, 0, 0], [2, 2, 0, 2, 2], [1, 0, 2, 0, 1], [1, 2, 0, 2, 1],
];

export const REELS = 5;
export const ROWS = 3;

// pays: multiplier of the line bet (total bet / lines) for 3, 4, 5 in a row.
// scatterPays: multiplier of the total bet for 3, 4, 5 pots anywhere.
// Tuned with tools/sim.js to land near a 96% return.
export const MACHINES = [
  {
    id: 'morning-rush',
    payScale: 1.17,
    name: 'Morning Rush',
    tagline: 'Easy wins to start the day',
    unlockLevel: 1,
    lines: 10,
    theme: 'rush',
    weights: { JACK: 2, POT: 2, TRIM: 2, CUP: 4, DONUT: 5, CROISSANT: 7, STACHE: 9, FLOWER: 12, BEAN: 14 },
    pays: {
      JACK: [50, 250, 1000], CUP: [25, 100, 400], DONUT: [20, 75, 250], CROISSANT: [10, 45, 130],
      STACHE: [8, 28, 90], FLOWER: [5, 16, 55], BEAN: [4, 13, 45],
    },
    scatterPays: [2, 10, 50],
    freeSpins: [8, 12, 20],
    freeSpinMultiplier: 2,
  },
  {
    id: 'espresso-express',
    payScale: 1.17,
    name: 'Espresso Express',
    tagline: 'Fewer wins, bigger shots',
    unlockLevel: 3,
    lines: 20,
    theme: 'espresso',
    weights: { JACK: 2, POT: 2, TRIM: 2, CUP: 3, DONUT: 4, CROISSANT: 6, STACHE: 10, FLOWER: 13, BEAN: 15 },
    pays: {
      JACK: [60, 300, 1600], CUP: [25, 130, 520], DONUT: [20, 80, 320], CROISSANT: [10, 40, 130],
      STACHE: [6, 20, 65], FLOWER: [3, 13, 40], BEAN: [3, 10, 32],
    },
    scatterPays: [2, 15, 100],
    freeSpins: [10, 15, 25],
    freeSpinMultiplier: 2,
  },
  {
    id: 'midnight-roast',
    payScale: 1.18,
    name: 'Midnight Roast',
    tagline: 'Daki stretches to fill the reel',
    unlockLevel: 6,
    lines: 25,
    theme: 'midnight',
    expandingWilds: true, // a Daki (wild) on reels 2-4 fills its whole reel
    weights: { JACK: 1, POT: 2, TRIM: 2, CUP: 3, DONUT: 4, CROISSANT: 7, STACHE: 10, FLOWER: 13, BEAN: 15 },
    pays: {
      JACK: [70, 360, 1800], CUP: [27, 135, 540], DONUT: [18, 90, 360], CROISSANT: [9, 36, 135],
      STACHE: [5, 18, 68], FLOWER: [4, 11, 36], BEAN: [3, 9, 27],
    },
    scatterPays: [3, 15, 100],
    freeSpins: [8, 12, 20],
    freeSpinMultiplier: 3,
  },
];

export const BET_LADDER = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

export function machineById(id) {
  return MACHINES.find((m) => m.id === id);
}

function weightTable(machine) {
  if (machine._table) return machine._table;
  const entries = Object.entries(machine.weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  machine._table = { entries, total };
  return machine._table;
}

export function randomSymbol(machine, rng = Math.random) {
  const { entries, total } = weightTable(machine);
  let r = rng() * total;
  for (const [sym, w] of entries) {
    if ((r -= w) < 0) return sym;
  }
  return entries[entries.length - 1][0];
}

// grid[reel][row]
export function randomGrid(machine, rng = Math.random) {
  const grid = [];
  for (let r = 0; r < REELS; r++) {
    const col = [];
    for (let row = 0; row < ROWS; row++) col.push(randomSymbol(machine, rng));
    grid.push(col);
  }
  return grid;
}

export function applyExpandingWilds(machine, grid) {
  if (!machine.expandingWilds) return { grid, expanded: [] };
  const expanded = [];
  const out = grid.map((col, r) => {
    if (r >= 1 && r <= 3 && col.includes('JACK')) {
      expanded.push(r);
      return col.map(() => 'JACK');
    }
    return col;
  });
  return { grid: out, expanded };
}

// Evaluates one line left to right. Daki (wild) substitutes for everything but the pot.
// Returns the best of "pure wild run" vs "wild-assisted symbol run".
function evaluateLine(machine, symbols) {
  let wildRun = 0;
  while (wildRun < REELS && symbols[wildRun] === 'JACK') wildRun++;

  let best = null;
  if (wildRun >= 3) {
    best = { symbol: 'JACK', count: wildRun, mult: machine.pays.JACK[wildRun - 3] };
  }

  const target = symbols.find((s) => s !== 'JACK');
  if (target && target !== 'POT') {
    let count = 0;
    while (count < REELS && (symbols[count] === target || symbols[count] === 'JACK')) count++;
    if (count >= 3 && machine.pays[target]) {
      const mult = machine.pays[target][count - 3];
      if (!best || mult > best.mult) best = { symbol: target, count, mult };
    }
  }
  return best;
}

export function evaluate(machine, grid, totalBet, { freeSpin = false } = {}) {
  const lineBet = totalBet / machine.lines;
  // payScale makes up for the trimmer cells, which pay nothing and break lines
  const multiplier = (freeSpin ? machine.freeSpinMultiplier : 1) * (machine.payScale || 1);
  const lineWins = [];
  let lineTotal = 0;

  for (let i = 0; i < machine.lines; i++) {
    const line = PAYLINES[i];
    const symbols = line.map((row, reel) => grid[reel][row]);
    const hit = evaluateLine(machine, symbols);
    if (hit) {
      const pay = hit.mult * lineBet * multiplier;
      lineTotal += pay;
      lineWins.push({ line: i, symbol: hit.symbol, count: hit.count, pay: Math.round(pay) });
    }
  }

  const scatterCells = [];
  grid.forEach((col, reel) => col.forEach((s, row) => { if (s === 'POT') scatterCells.push([reel, row]); }));
  const scatterCount = scatterCells.length;
  let scatterPay = 0;
  let freeSpinsWon = 0;
  if (scatterCount >= 3) {
    const k = Math.min(scatterCount, 5) - 3;
    scatterPay = machine.scatterPays[k] * totalBet * multiplier;
    freeSpinsWon = machine.freeSpins[k];
  }

  // Hair trimmers pay nothing; they count anywhere and shave Daki (3 = moustache, 5 = beard too).
  const trimCells = [];
  grid.forEach((col, reel) => col.forEach((s, row) => { if (s === 'TRIM') trimCells.push([reel, row]); }));
  const shave = trimCells.length >= 5 ? 'full' : trimCells.length >= 3 ? 'stache' : null;

  const totalWin = Math.round(lineTotal + scatterPay);
  return { lineWins, scatterCells, scatterPay: Math.round(scatterPay), freeSpinsWon, totalWin, trimCells, shave };
}

export function spin(machine, totalBet, { rng = Math.random, freeSpin = false } = {}) {
  const raw = randomGrid(machine, rng);
  const { grid, expanded } = applyExpandingWilds(machine, raw);
  const result = evaluate(machine, grid, totalBet, { freeSpin });
  return { raw, grid, expanded, ...result };
}

// ---- Progression ----

export const ECONOMY = {
  welcomeCoins: 10000,
  bonusIntervalMs: 2 * 60 * 60 * 1000, // free coins every 2 hours
  bonusBase: 2000,
  bonusPerLevel: 250,
  wheel: [1, 2, 1, 3, 1, 5, 2, 10], // multipliers on the bonus base
  topUpCoins: 1500,
  topUpCooldownMs: 10 * 60 * 1000,
  winTiers: [ // multiples of the total bet
    { at: 50, name: 'EPIC BREW!' },
    { at: 25, name: 'MEGA BREW!' },
    { at: 10, name: 'BIG BREW!' },
  ],
};

// XP needed to go from level n to n + 1.
export function xpForLevel(n) {
  return Math.round((200 * Math.pow(n, 1.35)) / 10) * 10;
}

export function levelReward(n) {
  return 500 + 250 * n;
}

export function xpForSpin(totalBet) {
  return Math.max(1, Math.round(totalBet / 2));
}

// How far up the bet ladder the player may go at a level.
export function maxBetIndex(level) {
  return Math.min(BET_LADDER.length - 1, 2 + Math.floor(level / 2));
}

export function bonusAmount(level, wheelMult = 1) {
  return (ECONOMY.bonusBase + ECONOMY.bonusPerLevel * level) * wheelMult;
}

export function winTier(totalWin, totalBet) {
  const x = totalWin / totalBet;
  return ECONOMY.winTiers.find((t) => x >= t.at) || null;
}
