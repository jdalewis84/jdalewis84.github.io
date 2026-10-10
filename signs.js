/* Road Code Quest — inline SVG road signs and markings (no network needed). */
(function () {
  const F = 'font-family="Arial, Helvetica, sans-serif" font-weight="700"';
  const wrap = (inner, vb = '0 0 120 120') =>
    `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">${inner}</svg>`;

  const octagon = (cx, cy, r) => {
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
    }
    return pts.join(' ');
  };

  const diamond = (fill, inner) => wrap(
    `<rect x="22" y="22" width="76" height="76" rx="6" transform="rotate(45 60 60)" fill="${fill}" stroke="#111" stroke-width="3"/>${inner}`
  );

  const speed = (n) => wrap(
    `<circle cx="60" cy="60" r="54" fill="#fff" stroke="#d71920" stroke-width="12"/>
     <text x="60" y="${n >= 100 ? 74 : 76}" text-anchor="middle" font-size="${n >= 100 ? 38 : 46}" ${F} fill="#111">${n}</text>`
  );

  const noTurn = (d) => wrap(
    `<circle cx="60" cy="60" r="54" fill="#fff" stroke="#d71920" stroke-width="10"/>
     <path d="${d}" stroke="#111" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
     <path d="M24 24 L96 96" stroke="#d71920" stroke-width="10" stroke-linecap="round"/>`
  );

  const lights = (state) => {
    const lamp = (cy, on, color, arrow) => {
      const fill = on ? color : '#3a3a3a';
      if (arrow && on) {
        return `<circle cx="60" cy="${cy}" r="15" fill="#1a1a1a"/>
          <path d="M70 ${cy} H52 M58 ${cy - 8} L50 ${cy} L58 ${cy + 8}" stroke="${color}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
      return `<circle cx="60" cy="${cy}" r="15" fill="${fill}"${on ? ` style="filter:drop-shadow(0 0 6px ${color})"` : ''}/>`;
    };
    return wrap(
      `<rect x="36" y="6" width="48" height="108" rx="10" fill="#111"/>
       ${lamp(30, state === 'red' || state === 'redarrow', '#ff3b30', state === 'redarrow')}
       ${lamp(60, state === 'yellow', '#ffcc00')}
       ${lamp(90, state === 'greenarrow', '#34c759', state === 'greenarrow')}`
    );
  };

  const SIGNS = {
    stop: () => wrap(
      `<polygon points="${octagon(60, 60, 56)}" fill="#fff"/>
       <polygon points="${octagon(60, 60, 51)}" fill="#d71920"/>
       <text x="60" y="72" text-anchor="middle" font-size="31" ${F} fill="#fff">STOP</text>`
    ),
    giveway: () => wrap(
      `<polygon points="6,14 114,14 60,108" fill="#d71920" stroke-linejoin="round"/>
       <polygon points="24,24 96,24 60,88" fill="#fff"/>
       <text x="60" y="44" text-anchor="middle" font-size="14" ${F} fill="#111">GIVE</text>
       <text x="60" y="60" text-anchor="middle" font-size="14" ${F} fill="#111">WAY</text>`
    ),
    speed30: () => speed(30),
    speed50: () => speed(50),
    speed100: () => speed(100),
    speed40: () => speed(40),
    speed60: () => speed(60),
    speed80: () => speed(80),
    speed110: () => speed(110),
    noright: () => noTurn('M48 92 V54 Q48 40 62 40 H78 M70 30 L82 40 L70 50'),
    noleft: () => noTurn('M72 92 V54 Q72 40 58 40 H42 M50 30 L38 40 L50 50'),
    nouturn: () => noTurn('M44 92 V52 Q44 32 62 32 Q78 32 78 52 V70 M68 62 L78 74 L88 62'),
    noentry: () => wrap(
      `<circle cx="60" cy="60" r="56" fill="#d71920"/>
       <rect x="20" y="50" width="80" height="20" rx="3" fill="#fff"/>`
    ),
    keepleft: () => wrap(
      `<circle cx="60" cy="60" r="56" fill="#0b5fae"/>
       <circle cx="60" cy="60" r="52" fill="none" stroke="#fff" stroke-width="3"/>
       <path d="M80 36 L42 78 M42 54 V80 H66" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    ),
    curve: () => wrap(
      `<rect x="26" y="14" width="68" height="68" rx="6" transform="rotate(45 60 48)" fill="#ffd200" stroke="#111" stroke-width="3"/>
       <path d="M50 78 C50 56 72 54 72 34" stroke="#111" stroke-width="8" fill="none" stroke-linecap="round"/>
       <path d="M62 34 L72 22 L82 34 Z" fill="#111"/>
       <rect x="38" y="104" width="44" height="30" rx="3" fill="#ffd200" stroke="#111" stroke-width="3"/>
       <text x="60" y="127" text-anchor="middle" font-size="22" ${F} fill="#111">35</text>`,
      '0 -4 120 142'
    ),
    roadworks: () => diamond('#f57c00',
      `<circle cx="54" cy="38" r="6" fill="#111"/>
       <path d="M54 46 L50 66 L42 82 M50 66 L60 80 M52 52 L68 60" stroke="#111" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
       <path d="M68 60 L76 78" stroke="#111" stroke-width="4" stroke-linecap="round"/>
       <path d="M70 84 Q78 70 88 84 Z" fill="#111"/>`
    ),
    roundabout: () => diamond('#ffd200',
      `<g fill="none" stroke="#111" stroke-width="6" stroke-linecap="round">
         <path d="M46 52 A16 16 0 0 1 70 46"/><path d="M76 60 A16 16 0 0 1 64 76"/><path d="M52 74 A16 16 0 0 1 44 60"/>
       </g>
       <g fill="#111"><path d="M68 39 L78 47 L66 52 Z"/><path d="M68 70 L58 80 L58 68 Z"/><path d="M38 64 L44 52 L50 63 Z"/></g>`
    ),
    railway: () => wrap(
      `<g transform="rotate(35 60 60)"><rect x="4" y="48" width="112" height="24" rx="3" fill="#fff" stroke="#d71920" stroke-width="5"/></g>
       <g transform="rotate(-35 60 60)"><rect x="4" y="48" width="112" height="24" rx="3" fill="#fff" stroke="#d71920" stroke-width="5"/></g>
       <text x="31" y="64" text-anchor="middle" font-size="10" ${F} fill="#111" transform="rotate(-35 60 60)">RAILWAY</text>
       <text x="89" y="64" text-anchor="middle" font-size="10" ${F} fill="#111" transform="rotate(35 60 60)">CROSSING</text>`
    ),
    onelane: () => wrap(
      `<circle cx="60" cy="60" r="54" fill="#fff" stroke="#d71920" stroke-width="10"/>
       <path d="M48 26 V88 M34 74 L48 92 L62 74" stroke="#111" stroke-width="9" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
       <path d="M76 84 V50 M68 60 L76 46 L84 60" stroke="#d71920" stroke-width="6" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`
    ),
    motorway: () => wrap(
      `<rect x="6" y="18" width="108" height="84" rx="8" fill="#0a7a3c" stroke="#fff" stroke-width="3"/>
       <path d="M38 92 L54 40 M82 92 L66 40" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
       <path d="M60 46 V56 M60 64 V74 M60 82 V92" stroke="#fff" stroke-width="4"/>
       <rect x="26" y="34" width="68" height="8" rx="2" fill="#fff"/>`
    ),
    nopassing: () => wrap(
      `<rect x="0" y="0" width="120" height="120" rx="12" fill="#6b7280"/>
       <rect x="14" y="0" width="92" height="120" fill="#3f3f46"/>
       <path d="M18 0 V120 M102 0 V120" stroke="#fff" stroke-width="2.5"/>
       <path d="M62 0 V120" stroke="#fff" stroke-width="3" stroke-dasharray="12 10"/>
       <path d="M56 0 V120" stroke="#ffd200" stroke-width="4"/>
       <g transform="translate(26 66)"><rect width="20" height="34" rx="5" fill="#0ea5e9"/><rect x="3" y="6" width="14" height="8" rx="2" fill="#bae6fd"/></g>
       <g transform="translate(26 14)"><rect width="20" height="34" rx="5" fill="#f59e0b"/><rect x="3" y="6" width="14" height="8" rx="2" fill="#fde68a"/></g>
       <path d="M36 62 V56" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`
    ),
    flushmedian: () => wrap(
      `<rect x="0" y="0" width="120" height="120" rx="12" fill="#6b7280"/>
       <rect x="8" y="0" width="104" height="120" fill="#3f3f46"/>
       <defs><clipPath id="fm"><rect x="48" y="0" width="24" height="120"/></clipPath></defs>
       <g clip-path="url(#fm)" stroke="#fff" stroke-width="3">
         ${Array.from({ length: 10 }, (_, i) => `<path d="M40 ${i * 16 - 10} L80 ${i * 16 + 20}"/>`).join('')}
       </g>
       <path d="M48 0 V120 M72 0 V120" stroke="#fff" stroke-width="3"/>
       <g transform="translate(51 54)"><rect width="18" height="30" rx="5" fill="#0ea5e9"/><rect x="3" y="4" width="12" height="7" rx="2" fill="#bae6fd"/></g>
       <path d="M60 50 Q60 38 74 34" stroke="#facc15" stroke-width="3" fill="none" stroke-dasharray="4 4"/>`
    ),
    'light-yellow': () => lights('yellow'),
    'light-red': () => lights('red'),
    'light-redarrow': () => lights('redarrow'),
    'light-greenarrow': () => lights('greenarrow'),
  };

  window.RQ_SIGN = (key) => (SIGNS[key] ? SIGNS[key]() : '');
})();
