'use strict';
// ── ART: crests, kits and player portraits, all generated SVG ─────
// Nothing is loaded from disk: every badge, shirt and face is drawn from the club's colours or the player's id,
// so a portrait never changes between sessions and the save never has to store an image.

const Art = (() => {
  let uid = 0;
  const SHAPES = {
    shield: 'M50 4 L90 14 V46 C90 72 73 88 50 97 C27 88 10 72 10 46 V14 Z',
    crest: 'M26 6 H74 Q92 6 92 24 V60 Q92 84 50 97 Q8 84 8 60 V24 Q8 6 26 6 Z',
    hex: 'M50 3 L91 26 V74 L50 97 L9 74 V26 Z',
    diamond: 'M50 2 L97 50 L50 98 L3 50 Z',
    pennant: 'M10 6 H90 V66 L50 96 L10 66 Z',
    badge: 'M50 3 L62 12 L78 9 L83 24 L96 33 L90 49 L96 65 L83 74 L78 90 L62 87 L50 97 L38 87 L22 90 L17 74 L4 65 L10 49 L4 33 L17 24 L22 9 L38 12 Z',
  };
  const shapeEl = (key, attrs) => (key === 'circle' ? `<circle cx="50" cy="50" r="46" ${attrs}/>` : `<path d="${SHAPES[key] || SHAPES.shield}" ${attrs}/>`);
  function star(cx, cy, R, r, n = 5) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n, rad = i % 2 ? r : R; pts.push(`${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad).toFixed(1)}`); }
    return pts.join(' ');
  }
  // icons in a 100×100 box: c = fill, k = outline
  const ICONS = {
    ball: (c, k) => `<circle cx="50" cy="50" r="36" fill="${c}" stroke="${k}" stroke-width="4"/><path d="M50 30 L62 39 L58 53 L42 53 L38 39 Z" fill="${k}"/><path d="M50 30 V16 M62 39 L76 34 M58 53 L66 66 M42 53 L34 66 M38 39 L24 34" stroke="${k}" stroke-width="3.5"/>`,
    lion: (c, k) => `<path d="M50 12 C70 12 84 28 82 48 C88 54 86 66 78 70 C74 84 62 92 50 92 C38 92 26 84 22 70 C14 66 12 54 18 48 C16 28 30 12 50 12 Z" fill="${c}" stroke="${k}" stroke-width="4"/><path d="M36 44 Q40 40 44 44 M56 44 Q60 40 64 44" stroke="${k}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M44 60 L50 66 L56 60 Z" fill="${k}"/><path d="M50 66 V74 M42 76 Q50 82 58 76" stroke="${k}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
    star: (c, k) => `<polygon points="${star(50, 53, 42, 18)}" fill="${c}" stroke="${k}" stroke-width="4" stroke-linejoin="round"/>`,
    crown: (c, k) => `<path d="M16 70 L12 30 L33 48 L50 20 L67 48 L88 30 L84 70 Z" fill="${c}" stroke="${k}" stroke-width="4" stroke-linejoin="round"/><rect x="16" y="74" width="68" height="10" rx="3" fill="${c}" stroke="${k}" stroke-width="4"/><circle cx="50" cy="56" r="6" fill="${k}"/>`,
    eagle: (c, k) => `<path d="M50 22 C56 22 60 28 58 34 L72 30 C84 28 94 36 96 46 C86 42 78 44 70 50 C78 52 82 58 82 64 C74 60 66 60 60 64 L58 86 L50 78 L42 86 L40 64 C34 60 26 60 18 64 C18 58 22 52 30 50 C22 44 14 42 4 46 C6 36 16 28 28 30 L42 34 C40 28 44 22 50 22 Z" fill="${c}" stroke="${k}" stroke-width="3.5" stroke-linejoin="round"/><circle cx="53" cy="30" r="2.6" fill="${k}"/>`,
    tower: (c, k) => `<path d="M26 90 V42 H20 V22 H30 V30 H40 V22 H60 V30 H70 V22 H80 V42 H74 V90 Z" fill="${c}" stroke="${k}" stroke-width="4" stroke-linejoin="round"/><path d="M42 90 V68 Q50 58 58 68 V90" fill="${k}"/><rect x="45" y="46" width="10" height="12" rx="5" fill="${k}"/>`,
    anchor: (c, k) => `<g fill="none" stroke="${k}" stroke-width="15" stroke-linecap="round"><circle cx="50" cy="18" r="8"/><path d="M50 26 V84 M32 40 H68 M20 60 C22 82 78 82 80 60"/></g><g fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round"><circle cx="50" cy="18" r="8"/><path d="M50 26 V84 M32 40 H68 M20 60 C22 82 78 82 80 60"/></g>`,
    bolt: (c, k) => `<path d="M60 8 L26 56 H46 L36 92 L76 40 H55 L66 8 Z" fill="${c}" stroke="${k}" stroke-width="4" stroke-linejoin="round"/>`,
    flame: (c, k) => `<path d="M50 6 C60 26 80 36 77 62 C75 80 63 92 50 92 C35 92 23 81 23 64 C23 50 32 42 35 30 C42 40 42 48 46 52 C48 38 43 22 50 6 Z" fill="${c}" stroke="${k}" stroke-width="4" stroke-linejoin="round"/><path d="M50 50 C56 60 64 66 62 76 C61 84 56 88 50 88 C43 88 38 83 38 76 C38 68 44 64 46 58 C48 62 49 64 50 50 Z" fill="${k}" opacity=".55"/>`,
    wolf: (c, k) => `<path d="M22 14 L36 34 H64 L78 14 L80 46 C84 56 82 66 74 74 L58 90 H42 L26 74 C18 66 16 56 20 46 Z" fill="${c}" stroke="${k}" stroke-width="4" stroke-linejoin="round"/><path d="M36 52 L44 56 M64 52 L56 56" stroke="${k}" stroke-width="4" stroke-linecap="round"/><path d="M44 72 L50 78 L56 72 Z" fill="${k}"/>`,
    oak: (c, k) => `<path d="M50 10 C64 10 72 20 70 30 C82 30 90 40 86 52 C92 62 84 74 72 72 C68 80 58 82 50 78 C42 82 32 80 28 72 C16 74 8 62 14 52 C10 40 18 30 30 30 C28 20 36 10 50 10 Z" fill="${c}" stroke="${k}" stroke-width="4"/><path d="M50 78 V94 M50 60 L40 50 M50 66 L60 54" stroke="${k}" stroke-width="5" stroke-linecap="round"/>`,
    ship: (c, k) => `<path d="M48 10 V64 H18 Z" fill="${c}" stroke="${k}" stroke-width="3.5" stroke-linejoin="round"/><path d="M54 18 L82 64 H54 Z" fill="${c}" stroke="${k}" stroke-width="3.5" stroke-linejoin="round"/><path d="M10 70 H90 L80 86 H20 Z" fill="${k}"/>`,
    sun: (c, k) => `<circle cx="50" cy="50" r="20" fill="${c}" stroke="${k}" stroke-width="4"/>${Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6; return `<path d="M${50 + Math.cos(a) * 27} ${50 + Math.sin(a) * 27} L${50 + Math.cos(a) * 42} ${50 + Math.sin(a) * 42}" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`; }).join('')}`,
    key: (c, k) => `<circle cx="34" cy="34" r="20" fill="none" stroke="${k}" stroke-width="14"/><circle cx="34" cy="34" r="20" fill="none" stroke="${c}" stroke-width="7"/><path d="M48 48 L86 86 M70 70 L80 60 M78 78 L88 68" stroke="${k}" stroke-width="13" stroke-linecap="round"/><path d="M48 48 L86 86 M70 70 L80 60 M78 78 L88 68" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`,
    stag: (c, k) => `<path d="M40 40 L30 12 M30 24 L18 18 M34 30 L22 32 M60 40 L70 12 M70 24 L82 18 M66 30 L78 32" stroke="${c}" stroke-width="6" stroke-linecap="round"/><path d="M36 40 H64 L62 64 L50 86 L38 64 Z" fill="${c}" stroke="${k}" stroke-width="4" stroke-linejoin="round"/><circle cx="44" cy="54" r="3" fill="${k}"/><circle cx="56" cy="54" r="3" fill="${k}"/>`,
    cross: (c, k) => `<path d="M38 8 H62 V38 H92 V62 H62 V92 H38 V62 H8 V38 H38 Z" fill="${c}" stroke="${k}" stroke-width="4" stroke-linejoin="round"/>`,
  };

  function crest(t, size = 40, extra = '') {
    const id = 'cr' + (uid++);
    const c = t.crest || { shape: 'shield', icon: 'ball', c1: '#334155', c2: '#e2e8f0' };
    const p = c.c1, s = c.c2, dark = U.mix(p, '#000000', 0.55);
    const shape = c.shape;
    const stars = (t.trophies || []).filter(x => DATA.NATIONS.some(n => n.tiers[0] === x.name) || x.name === DATA.CONTINENTAL).length;
    const starRow = stars ? `<g>${Array.from({ length: Math.min(3, stars) }, (_, i) => `<polygon points="${star(50 + (i - (Math.min(3, stars) - 1) / 2) * 11, -1, 5, 2.2)}" fill="#fbbf24" stroke="#78350f" stroke-width=".8"/>`).join('')}</g>` : '';
    // a band of the secondary colour behind the icon for some badges, varied by club
    const deco = U.hash(t.id) % 3;
    const band = deco === 1 ? `<path d="M0 40 H100 V58 H0 Z" fill="${s}" opacity=".9" clip-path="url(#${id}c)"/>` : deco === 2 ? `<path d="M0 0 L100 100 V70 L30 0 Z" fill="${s}" opacity=".35" clip-path="url(#${id}c)"/>` : '';
    return `<svg class="crest" viewBox="0 ${stars ? -8 : 0} 100 ${stars ? 108 : 100}" width="${size}" height="${size}" aria-hidden="true" ${extra}>
<defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient><clipPath id="${id}c">${shapeEl(shape, '')}</clipPath></defs>
${starRow}${shapeEl(shape, `fill="${s}"`)}
<g transform="translate(50 50) scale(.86) translate(-50 -50)">${shapeEl(shape, `fill="${p}"`)}${band}</g>
<g transform="translate(50 50) scale(.48) translate(-50 -50)">${(ICONS[c.icon] || ICONS.ball)(s, dark)}</g>
${shapeEl(shape, `fill="url(#${id}g)"`)}
</svg>`;
  }

  // a shirt in any of the kit styles
  function kitPattern(kit, id) {
    const c2 = kit.c2;
    switch (kit.style) {
      case 'stripes': return [12, 28, 44, 60].map(x => `<rect x="${x}" y="0" width="8" height="64" fill="${c2}"/>`).join('');
      case 'hoops': return [20, 34, 48].map(y => `<rect x="0" y="${y}" width="64" height="7" fill="${c2}"/>`).join('');
      case 'halves': return `<rect x="32" y="0" width="32" height="64" fill="${c2}"/>`;
      case 'sash': return `<path d="M10 4 L22 4 L56 64 L44 64 Z" fill="${c2}"/>`;
      case 'pin': return [16, 24, 32, 40, 48].map(x => `<rect x="${x}" y="0" width="1.6" height="64" fill="${c2}" opacity=".8"/>`).join('');
      case 'chevron': return `<path d="M8 22 L32 40 L56 22 L56 30 L32 48 L8 30 Z" fill="${c2}"/>`;
      case 'band': return `<rect x="0" y="26" width="64" height="9" fill="${c2}"/>`;
      default: return '';
    }
  }
  function kit(k, size = 40, num) {
    const id = 'kt' + (uid++);
    const txt = U.onColor(k.c1);
    return `<svg class="kit" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">
<defs><clipPath id="${id}"><path d="M21 6 L28 9 Q32 12 36 9 L43 6 L58 14 L54 29 L47 27 V58 H17 V27 L10 29 L6 14 Z"/></clipPath></defs>
<g clip-path="url(#${id})"><rect width="64" height="64" fill="${k.c1}"/>${kitPattern(k, id)}</g>
<path d="M21 6 L28 9 Q32 12 36 9 L43 6 L58 14 L54 29 L47 27 V58 H17 V27 L10 29 L6 14 Z" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M28 9 Q32 15 36 9" fill="none" stroke="${k.c3 || k.c2}" stroke-width="2.4"/>
${num != null ? `<text x="32" y="44" text-anchor="middle" font-family="Oswald, Impact, sans-serif" font-weight="700" font-size="${num >= 10 ? 18 : 21}" fill="${txt}" stroke="${k.c2}" stroke-width="1" paint-order="stroke">${num}</text>` : ''}
</svg>`;
  }

  // ── faces ──
  const SKINS = ['#f6d7c3', '#eec1a1', '#e0ac85', '#c68c63', '#a8714b', '#8a5634', '#6b3f24', '#4d2c18'];
  const HAIRC = ['#1b1512', '#2b1d14', '#3d2a1b', '#5a3b22', '#8a5a2c', '#b98a4e', '#d8b46a', '#a3412a', '#e8e1d0'];
  const SKIN_BY_NAT = {
    Kwenda: [5, 6, 7, 7, 6], Brazilia: [2, 3, 4, 5, 6, 3], Pampas: [1, 2, 2, 3], Maghreb: [2, 3, 3, 4], Kaiyo: [0, 1, 1, 2], Nordvik: [0, 0, 1], Slavonia: [0, 1, 1],
    Iberica: [1, 2, 2, 3, 5], Valtoria: [1, 1, 2, 3, 6], Albion: [0, 0, 1, 2, 5, 6], Rheinmark: [0, 1, 1, 2, 6],
  };
  function look(p) {
    // every trait gets its own hash (shifting one 32-bit hash runs out of bits for the later traits)
    const r = n => (U.hash(`f${p.id}:${n}`) % 10007) / 10007;
    const skins = SKIN_BY_NAT[p.nat] || [0, 1, 2, 3, 4, 5, 6];
    const skin = skins[Math.floor(r(1) * skins.length)];
    const dark = skin >= 5;
    let hc = dark ? (r(2) < 0.85 ? 0 : 1) : p.nat === 'Nordvik' ? 4 + Math.floor(r(2) * 3) : Math.floor(r(2) * 6);
    if (r(3) < 0.04) hc = 7;
    if (p.age >= 33 && r(4) < 0.5) hc = 8;
    const styles = dark ? ['buzz', 'afro', 'twists', 'fade', 'bald', 'flat', 'braids'] : ['short', 'swept', 'fade', 'long', 'curly', 'buzz', 'bun', 'mohawk', 'bald', 'quiff'];
    return {
      skin: SKINS[skin], hair: HAIRC[hc], style: styles[Math.floor(r(5) * styles.length)],
      beard: r(6) < (p.age > 25 ? 0.4 : 0.15) ? (r(7) < 0.5 ? 'stubble' : 'full') : r(7) < 0.08 ? 'tache' : null,
      brow: r(8) < 0.5 ? 0 : 1, band: r(11) < 0.07, eyes: r(9) < 0.5 ? 0 : 1, jaw: r(10) < 0.5 ? 0 : 1,
    };
  }
  function hairSVG(lk) {
    const c = lk.hair;
    switch (lk.style) {
      case 'buzz': return `<path d="M30 40 Q32 20 50 19 Q68 20 70 40 Q66 30 50 29 Q34 30 30 40 Z" fill="${c}" opacity=".85"/>`;
      case 'afro': return `<path d="M24 46 Q18 22 36 14 Q50 6 64 14 Q82 22 76 46 Q72 34 68 32 Q50 28 32 32 Q28 34 24 46 Z" fill="${c}"/>`;
      case 'twists': return `<path d="M28 44 Q26 22 50 17 Q74 22 72 44 Q68 30 50 28 Q32 30 28 44 Z" fill="${c}"/>${[34, 42, 50, 58, 66].map(x => `<circle cx="${x}" cy="${20 + Math.abs(x - 50) * 0.25}" r="4.2" fill="${c}"/>`).join('')}`;
      case 'braids': return `<path d="M29 44 Q28 20 50 18 Q72 20 71 44 Q67 30 50 28 Q33 30 29 44 Z" fill="${c}"/>${[36, 43, 50, 57, 64].map(x => `<path d="M${x} 20 V30" stroke="#000" stroke-opacity=".25" stroke-width="1.5"/>`).join('')}`;
      case 'fade': return `<path d="M30 40 Q30 18 50 16 Q70 18 70 40 L66 34 Q60 24 50 24 Q40 24 34 34 Z" fill="${c}"/>`;
      case 'flat': return `<path d="M30 40 V20 H70 V40 L66 30 H34 Z" fill="${c}"/>`;
      case 'swept': return `<path d="M29 42 Q26 18 52 15 Q76 17 72 40 Q70 26 60 24 Q46 30 36 28 Q31 32 29 42 Z" fill="${c}"/>`;
      case 'long': return `<path d="M27 58 Q22 20 50 15 Q78 20 73 58 L69 58 Q70 32 62 26 Q50 30 38 26 Q30 32 31 58 Z" fill="${c}"/>`;
      case 'curly': return `<path d="M28 42 Q26 18 50 15 Q74 18 72 42 Q68 28 50 27 Q32 28 28 42 Z" fill="${c}"/>${[32, 40, 48, 56, 64, 68].map((x, i) => `<circle cx="${x}" cy="${21 + (i % 2) * 3}" r="5" fill="${c}"/>`).join('')}`;
      case 'bun': return `<circle cx="50" cy="12" r="7" fill="${c}"/><path d="M29 42 Q28 18 50 17 Q72 18 71 42 Q67 28 50 26 Q33 28 29 42 Z" fill="${c}"/>`;
      case 'mohawk': return `<path d="M44 34 Q44 10 50 8 Q56 10 56 34 Z" fill="${c}"/><path d="M30 40 Q32 26 44 24 V30 Q36 32 30 40 Z M70 40 Q68 26 56 24 V30 Q64 32 70 40 Z" fill="${c}" opacity=".45"/>`;
      case 'quiff': return `<path d="M29 42 Q28 22 44 14 Q60 6 70 20 Q74 30 71 42 Q68 28 56 26 Q44 28 34 30 Q30 34 29 42 Z" fill="${c}"/>`;
      default: return '';
    }
  }
  function face(p, size = 44, t) {
    const id = 'fc' + (uid++);
    const lk = look(p);
    const tm = t || (p.tid >= 0 && G && G.teams[p.tid]) || null;
    const k = tm ? tm.kit : { c1: '#475569', c2: '#cbd5e1', style: 'plain' };
    const bg1 = tm ? tm.crest.c1 : '#334155', bg2 = U.mix(bg1, '#000000', 0.5);
    const skinD = U.mix(lk.skin, '#000000', 0.18);
    const jaw = lk.jaw ? 'M32 48 Q32 74 50 78 Q68 74 68 48' : 'M31 48 Q33 72 50 77 Q67 72 69 48';
    const beard = lk.beard === 'full' ? `<path d="M33 56 Q36 78 50 80 Q64 78 67 56 Q62 66 50 67 Q38 66 33 56 Z" fill="${lk.hair}" opacity=".92"/>` : lk.beard === 'stubble' ? `<path d="M33 56 Q36 78 50 80 Q64 78 67 56 Q62 66 50 67 Q38 66 33 56 Z" fill="${lk.hair}" opacity=".32"/>` : lk.beard === 'tache' ? `<path d="M42 64 Q50 60 58 64 Q50 63 42 64 Z" fill="${lk.hair}" stroke="${lk.hair}" stroke-width="2"/>` : '';
    const eyes = lk.eyes ? `<ellipse cx="42" cy="50" rx="2.6" ry="2.2" fill="#1b1512"/><ellipse cx="58" cy="50" rx="2.6" ry="2.2" fill="#1b1512"/>` : `<path d="M39 50 Q42 48 45 50" stroke="#1b1512" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M55 50 Q58 48 61 50" stroke="#1b1512" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    return `<svg class="face" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
<defs><radialGradient id="${id}b" cx=".5" cy=".35" r=".75"><stop offset="0" stop-color="${U.mix(bg1, '#ffffff', 0.15)}"/><stop offset="1" stop-color="${bg2}"/></radialGradient><clipPath id="${id}c"><circle cx="50" cy="50" r="50"/></clipPath><clipPath id="${id}s"><path d="M8 100 Q10 80 30 76 L50 84 L70 76 Q90 80 92 100 Z"/></clipPath></defs>
<g clip-path="url(#${id}c)">
<rect width="100" height="100" fill="url(#${id}b)"/>
<path d="M42 66 H58 V80 H42 Z" fill="${skinD}"/>
<g clip-path="url(#${id}s)"><rect width="100" height="100" fill="${k.c1}"/><g transform="translate(18 66) scale(1)">${kitPattern(k, id).replace(/height="64"/g, 'height="40"')}</g></g>
<path d="M40 77 L50 86 L60 77" fill="none" stroke="${k.c3 || k.c2}" stroke-width="3.5"/>
<ellipse cx="31" cy="51" rx="4" ry="6" fill="${skinD}"/><ellipse cx="69" cy="51" rx="4" ry="6" fill="${skinD}"/>
<path d="${jaw} Q68 24 50 24 Q32 24 32 48 Z" fill="${lk.skin}"/>
${beard}
${hairSVG(lk)}
${lk.band ? `<path d="M30 36 Q50 30 70 36 L70 41 Q50 35 30 41 Z" fill="${k.c2}"/>` : ''}
<path d="M37 ${44 - lk.brow} Q42 ${41 - lk.brow} 47 44 M53 44 Q58 ${41 - lk.brow} 63 ${44 - lk.brow}" stroke="${U.mix(lk.hair, '#000', 0.2)}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
${eyes}
<path d="M50 52 Q47 59 49 61 Q51 62 53 60" stroke="${U.mix(lk.skin, '#000', 0.3)}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
<path d="M44 67 Q50 70 56 67" stroke="${U.mix(lk.skin, '#5a1d1d', 0.5)}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
</g></svg>`;
  }
  // coach portrait: same face machinery, a suit instead of a kit
  function coachFace(c, size = 44) {
    const tm = c.tid >= 0 && G.teams[c.tid] ? G.teams[c.tid] : null;
    const fake = { id: `c${c.id}`, nat: c.nat, age: c.age, tid: -1 };
    return face(fake, size, { kit: { c1: '#1e293b', c2: '#334155', c3: '#f8fafc', style: 'plain' }, crest: tm ? tm.crest : { c1: '#334155' } });
  }
  function flag(nat, size = 16) {
    const f = DATA.NAT_FLAG[nat] || ['#64748b', '#cbd5e1', '#64748b'];
    return `<svg class="flag" viewBox="0 0 30 20" width="${size}" height="${Math.round(size * 0.67)}" aria-hidden="true"><rect width="10" height="20" fill="${f[0]}"/><rect x="10" width="10" height="20" fill="${f[1]}"/><rect x="20" width="10" height="20" fill="${f[2]}"/><rect width="30" height="20" fill="none" stroke="rgba(0,0,0,.25)"/></svg>`;
  }
  // the colour a club plays in against another: home kit unless it clashes
  function kitsFor(home, away) {
    const hk = home.kit;
    let ak = away.kit;
    if (U.cdist(hk.c1, ak.c1) < 140) ak = away.away;
    if (U.cdist(hk.c1, ak.c1) < 140) ak = { style: 'plain', c1: U.lum(hk.c1) > 0.4 ? '#15181E' : '#F4F5F7', c2: hk.c1, c3: '#888' };
    return [hk, ak];
  }
  const GK_KITS = ['#22c55e', '#facc15', '#f472b6', '#fb923c', '#a78bfa', '#2dd4bf', '#0f172a'];
  function gkKit(k, other) {
    const c = GK_KITS.find(x => U.cdist(x, k.c1) > 150 && U.cdist(x, other.c1) > 150) || '#22c55e';
    return { style: 'plain', c1: c, c2: U.mix(c, '#000', 0.4), c3: c };
  }

  return { crest, kit, face, coachFace, flag, look, kitsFor, gkKit, ICONS, SHAPES };
})();
