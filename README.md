# Shurda Café

A free-play slots game for the browser, starring Daki. Coins have no cash value.

**Play it online: https://roezillah.github.io/shurda-cafe/**

## Play

```bash
node tools/serve.js
```

Then open http://localhost:5174. Progress saves in your browser.

## What's in it

- 3 original machines: **Morning Rush** (level 1), **Espresso Express** (level 3), and **Midnight Roast** (level 6, with "Stretchy Daki" expanding wilds)
- Daki is the wild symbol; 3+ coffee pots start free spins with multiplied wins
- Levels and XP, bets that unlock as you level up, a free coin wheel every 2 hours, and a free top-up when you're out of coins
- Daki stands beside the reels and cheers every win, using sprites generated with OpenArt from the original drawing
- **Coffee meter:** every spin where a coffee cup lands on the reels, Daki drinks one. Each cup makes his
  belly worse (and gassier). On the 5th cup he has an accident: he turns around to show the brown seat of
  his jeans, runs off to change, comes back in fresh pants, and starts the Cup Toss bonus. The meter then resets.
- **Hair Trimmers** pay nothing but count anywhere on the reels: 3 shave off Daki's moustache, 5 shave
  his beard too (a buzzing trimmer flies in, hair falls). It grows back after 30 spins; the side panel
  counts down. Shaved versions of every sprite live next to the originals as `*-m.png` (no moustache)
  and `*-f.png` (clean shaven). Line pays were scaled up (`payScale`) to keep the return the same.
- **Cup Toss bonus** after every accident: aim with ↑/↓, hold Space to wind up (the power meter swings,
  so time the release), let go to throw. Land the cup on the espresso machine's drip tray for 10× your
  bet, or right under the spout for 25×. Release at the very top of the meter (it flashes MAX!) and
  Daki pitches a fastball that blows the machine up for 15×; a new one drops in. Three throws. Phones
  get on-screen buttons.
- **Music follows the coffee meter:** *Toplo Vreme* plays at 0–2 cups, *Festivni Dan* from the 3rd cup, and
  *Festivno Kolo* from the 4th; it crossfades back to *Toplo Vreme* after the accident. Tracks live in
  `assets/music/` (Settings → Café music switch and Music volume slider). Browsers only start music after your first click or key press.
- Big-win celebration with Daki sprinting across the screen, autospin, fast spins and sound effects

## Files

| path | what |
| --- | --- |
| `js/engine.js` | all game math: machines, paytables, payouts, levels, economy |
| `js/app.js` | the UI: lobby, reels, modals, bonus wheel, saving |
| `js/cuptoss.js` | the Cup Toss bonus mini-game (canvas, physics, scoring) |
| `assets/toss/` | Cup Toss sprites: wind-up, throw, pitcher leg kick and follow-through, 7 tumbling-cup frames, espresso machine |
| `js/daki.js` | Daki's side panel: cheering, coffee meter, gas, the accident |
| `js/symbols.js` | symbol art (inline SVG) |
| `js/audio.js` | synthesized sound effects, and the music player that picks a track by coffee cups |
| `assets/music/` | the three background music tracks |
| `css/style.css` | the look; palette taken from Jack's outfit |
| `assets/java-jack.png` | your original Daki drawing, background made transparent |
| `assets/daki/` | Daki's poses plus in-between frames (blink, mug raise, crouch, side turn, second cramp, waddle, second run stride), all aligned to one floor line |
| `tools/sim.js` | return-to-player simulator: `node tools/sim.js 1000000` |
| `tools/serve.js` | tiny local web server |

## Tuning

Edit `MACHINES` and `ECONOMY` in `js/engine.js`, then run `node tools/sim.js` to check each
machine's return (aim for 92–98%). Add `#debug` to the URL for test helpers in the console
(`__jj.pots()` forces a free-spins spin, `__jj.cups()` forces a coffee-cup spin, `__jj.toss()` opens Cup Toss, `__jj.trims(3)` or `__jj.trims(5)` forces hair trimmers).
