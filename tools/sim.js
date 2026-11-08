// RTP simulator. Run: node tools/sim.js [spins]
// Plays each machine for N paid spins (free spins included in the return)
// and prints return to player, hit rate, bonus frequency and win tiers.
import { MACHINES, spin, winTier } from '../js/engine.js';

const N = Number(process.argv[2] || 1_000_000);
const BET = 100;

for (const m of MACHINES) {
  let wagered = 0, won = 0, hits = 0, bonuses = 0, freeSpinsPlayed = 0, maxWin = 0;
  const tiers = {};
  let fsWon = 0;
  for (let i = 0; i < N; i++) {
    wagered += BET;
    const r = spin(m, BET);
    let roundWin = r.totalWin;
    let pending = r.freeSpinsWon;
    if (pending) bonuses++;
    let guard = 0;
    while (pending > 0 && guard++ < 500) {
      pending--; freeSpinsPlayed++;
      const f = spin(m, BET, { freeSpin: true });
      roundWin += f.totalWin;
      pending += f.freeSpinsWon;
      fsWon += f.totalWin;
    }
    won += roundWin;
    if (roundWin > 0) hits++;
    if (roundWin > maxWin) maxWin = roundWin;
    const t = winTier(roundWin, BET);
    if (t) tiers[t.name] = (tiers[t.name] || 0) + 1;
  }
  const pct = (x) => (100 * x).toFixed(2) + '%';
  console.log(`\n${m.name} (${m.lines} lines)`);
  console.log(`  RTP              ${pct(won / wagered)}   (free spins share ${pct(fsWon / wagered)})`);
  console.log(`  hit rate         ${pct(hits / N)}`);
  console.log(`  bonus every      ${(N / Math.max(1, bonuses)).toFixed(0)} spins`);
  console.log(`  avg free spins   ${(freeSpinsPlayed / Math.max(1, bonuses)).toFixed(1)}`);
  console.log(`  biggest win      ${(maxWin / BET).toFixed(0)}x bet`);
  for (const [k, v] of Object.entries(tiers)) console.log(`  ${k.padEnd(16)} 1 in ${(N / v).toFixed(0)}`);
}
