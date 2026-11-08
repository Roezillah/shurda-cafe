// Original symbol art, drawn as inline SVG in the same thick-outline cartoon
// style as Daki. Colours come from his outfit: magenta shirt, purple
// flowers, teal cuffs, blue jeans, espresso-brown beard.
const O = 'stroke="#2a1a12" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"';

const svg = (body) => `<svg viewBox="0 0 100 100" aria-hidden="true">${body}</svg>`;

export const SYMBOL_ART = {
  // Wild: Daki himself. The image is cropped to his head with CSS.
  JACK: `<div class="sym-jack"><img src="assets/java-jack.png" alt="" draggable="false"><span class="sym-tag">WILD</span></div>`,

  POT: svg(`
    <path d="M50 14 v8" ${O} fill="none"/>
    <path d="M34 26 h32 l6 12 H28 z" fill="#3fb8b0" ${O}/>
    <path d="M28 38 h44 c4 22 2 38 -6 46 H34 c-8 -8 -10 -24 -6 -46 z" fill="#c2338f" ${O}/>
    <path d="M72 46 c12 0 14 18 2 20" fill="none" ${O}/>
    <path d="M28 46 l-14 -6 l2 10 z" fill="#3fb8b0" ${O}/>
    <circle cx="50" cy="60" r="10" fill="#7b4fc9" ${O}/>
    <circle cx="50" cy="60" r="3.5" fill="#f5c518"/>
    <text x="50" y="97" text-anchor="middle" class="sym-label">FREE</text>`),

  TRIM: svg(`
    <g transform="rotate(-28 50 50)">
      <rect x="36" y="30" width="28" height="60" rx="12" fill="#3fb8b0" ${O}/>
      <rect x="32" y="12" width="36" height="20" rx="4" fill="#c9c2bb" ${O}/>
      <path d="M35 12 v-6 M41 12 v-6 M47 12 v-6 M53 12 v-6 M59 12 v-6 M65 12 v-6" stroke="#2a1a12" stroke-width="3.5" stroke-linecap="round"/>
      <rect x="44" y="46" width="12" height="20" rx="5" fill="#c2338f" ${O}/>
      <circle cx="50" cy="78" r="3.5" fill="#f5c518"/>
    </g>
    <path d="M14 30 l8 4 M12 44 l9 0 M80 22 l-7 5 M86 36 l-9 1" stroke="#2a1a12" stroke-width="3.5" stroke-linecap="round"/>
    <text x="50" y="97" text-anchor="middle" class="sym-label">SHAVE</text>`),

  CUP: svg(`
    <path d="M40 12 c-6 8 6 10 0 18 M56 10 c-6 8 6 10 0 18" fill="none" stroke="#8a6a55" stroke-width="4" stroke-linecap="round"/>
    <path d="M20 36 h56 l-6 44 c-1 6 -5 8 -10 8 H36 c-5 0 -9 -2 -10 -8 z" fill="#fff6e9" ${O}/>
    <path d="M76 44 c14 0 14 22 -2 22" fill="none" ${O}/>
    <ellipse cx="48" cy="36" rx="28" ry="6" fill="#5a3422" ${O}/>
    <g transform="translate(48 62)">
      <circle r="5" cy="-9" fill="#c2338f"/><circle r="5" cx="9" cy="-2" fill="#c2338f"/>
      <circle r="5" cx="5" cy="8" fill="#c2338f"/><circle r="5" cx="-5" cy="8" fill="#c2338f"/>
      <circle r="5" cx="-9" cy="-2" fill="#c2338f"/><circle r="4" fill="#f5c518"/>
    </g>`),

  DONUT: svg(`
    <circle cx="50" cy="52" r="36" fill="#e0a560" ${O}/>
    <path d="M18 46 c4 -22 24 -30 40 -28 c16 2 26 14 28 26 c-4 4 -8 2 -10 6 c-3 5 -8 2 -11 6 c-4 5 -9 0 -14 4 c-5 4 -9 -1 -13 2 c-5 3 -9 -2 -12 0 c-3 2 -6 -2 -8 -16 z" fill="#c2338f" ${O}/>
    <circle cx="50" cy="52" r="11" fill="#fff6e9" ${O}/>
    <path d="M32 34 l5 -3 M62 30 l4 4 M70 44 l5 -1 M40 26 l-1 5 M28 46 l4 2" stroke="#f5c518" stroke-width="4" stroke-linecap="round"/>
    <path d="M52 28 l2 5 M74 36 l-2 4" stroke="#3fb8b0" stroke-width="4" stroke-linecap="round"/>`),

  // Tiramisu: a layered slice, cocoa on top, cream and coffee-soaked sponge.
  CROISSANT: svg(`<g transform="translate(50 52) scale(1.18) translate(-50 -55)">
    <ellipse cx="50" cy="80" rx="44" ry="11" fill="#fff6e9" ${O}/>
    <path d="M16 40 h52 v40 h-52 z" fill="#fff3dc"/>
    <path d="M16 53 h52 v8 h-52 z M16 70 h52 v10 h-52 z" fill="#b5703c"/>
    <path d="M16 40 h52 v5 h-52 z" fill="#5a3422"/>
    <path d="M68 40 l16 -10 v40 l-16 10 z" fill="#f0dcbc"/>
    <path d="M68 53 l16 -10 v8 l-16 10 z M68 70 l16 -10 v10 l-16 10 z" fill="#8f5530"/>
    <path d="M68 40 l16 -10 v5 l-16 10 z" fill="#43261a"/>
    <path d="M16 40 l16 -10 h52 l-16 10 z" fill="#6b3d26"/>
    <path d="M16 40 l16 -10 h52 v40 l-16 10 h-52 z M16 40 h52 l16 -10 M68 40 v40" fill="none" ${O}/>
    <path d="M30 35 h2 M42 33 h2 M52 36 h2 M62 33 h2 M38 37 h2 M72 32 h2 M58 38 h1" stroke="#a0704e" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M44 30 c-2 -8 8 -12 12 -6 c3 5 -4 8 -6 4" fill="none" stroke="#2a1a12" stroke-width="4" stroke-linecap="round"/></g>`),

  STACHE: svg(`
    <path d="M50 46 c-6 -8 -18 -10 -26 -4 c-6 4 -10 14 -18 12 c4 12 18 16 30 10 c6 -3 10 -8 14 -8 c4 0 8 5 14 8 c12 6 26 2 30 -10 c-8 2 -12 -8 -18 -12 c-8 -6 -20 -4 -26 4 z" fill="#5a3422" ${O}/>
    <path d="M30 52 c6 -2 10 -2 14 0 M56 52 c4 -2 8 -2 14 0" fill="none" stroke="#8a5a3c" stroke-width="3" stroke-linecap="round"/>
    <path d="M14 54 c-6 -2 -8 -8 -6 -12 M86 54 c6 -2 8 -8 6 -12" fill="none" ${O}/>`),

  // Burek: a coiled filo pie, golden and flaky.
  FLOWER: svg(`
    <ellipse cx="50" cy="72" rx="47" ry="16" fill="#fff6e9" ${O}/>
    <ellipse cx="50" cy="54" rx="43" ry="32" fill="#d98d33" ${O}/>
    <ellipse cx="50" cy="49" rx="43" ry="29" fill="#eab055"/>
    <path d="M50 49 c6 -1 7 6 1 7 c-8 2 -14 -4 -11 -10 c4 -8 20 -8 24 1 c5 10 -5 19 -16 19 c-14 0 -26 -8 -25 -19 c1 -13 17 -21 33 -20 c17 1 30 11 28 23" fill="none" stroke="#a8601e" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M18 44 c3 -4 7 -5 11 -5 M68 34 c4 0 8 2 10 5 M38 69 c5 2 10 2 15 2 M74 61 c3 -1 5 -3 6 -6" stroke="#fbe2a8" stroke-width="3.5" stroke-linecap="round"/>
    <ellipse cx="50" cy="54" rx="43" ry="32" fill="none" ${O}/>`),

  BEAN: svg(`
    <path d="M4 58 c0 -19 21 -30 46 -30 c25 0 46 11 46 30 c0 16 -21 25 -46 25 c-25 0 -46 -9 -46 -25 z" fill="#f0c98a" ${O}/>
    <path d="M12 64 c10 9 26 12 38 12 c12 0 28 -3 38 -12" fill="none" stroke="#d29a52" stroke-width="3.5" stroke-linecap="round"/>
    <g transform="rotate(-8 50 52)">
      <rect x="14" y="30" width="54" height="15" rx="7.5" fill="#8c4a2a" ${O}/>
      <rect x="20" y="44" width="54" height="15" rx="7.5" fill="#97532f" ${O}/>
      <rect x="12" y="58" width="54" height="15" rx="7.5" fill="#8c4a2a" ${O}/>
      <path d="M22 35 h40 M28 49 h40 M20 63 h40" stroke="#c98a5e" stroke-width="3" stroke-linecap="round"/>
      <path d="M30 32 l-3 10 M44 32 l-3 10 M58 32 l-3 10 M36 46 l-3 10 M50 46 l-3 10 M64 46 l-3 10 M28 60 l-3 10 M42 60 l-3 10 M56 60 l-3 10" stroke="#4a2614" stroke-width="3" stroke-linecap="round"/>
    </g>
    <g stroke="#2a1a12" stroke-width="2.5" stroke-linejoin="round">
      <path d="M72 66 l9 -3 l3 7 l-9 3 z" fill="#fff"/><path d="M80 54 l8 1 l-1 8 l-8 -1 z" fill="#e7d4f7"/>
      <path d="M68 74 l8 -1 l1 7 l-8 1 z" fill="#fff"/><path d="M84 66 l7 2 l-2 7 l-7 -2 z" fill="#e7d4f7"/>
    </g>`),
};
