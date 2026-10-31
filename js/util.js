'use strict';
// ── UTILITIES ─────────────────────────────────────────────────────

const U = {
  rand(a = 0, b = 1) { return a + Math.random() * (b - a); },
  ri(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
  pick(a) { return a[Math.floor(Math.random() * a.length)]; },
  chance(p) { return Math.random() < p; },
  clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },
  lerp(a, b, t) { return a + (b - a) * t; },
  gauss(m = 0, s = 1) {
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  },
  shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },
  wpick(items, wfn) {
    const ws = items.map(wfn);
    const tot = ws.reduce((x, y) => x + y, 0);
    let r = Math.random() * tot;
    for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  },
  sum(a) { return a.reduce((x, y) => x + y, 0); },
  avg(a) { return a.length ? U.sum(a) / a.length : 0; },
  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  ord(n) {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  },
  fill(tpl, vars) { return tpl.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m)); },
  // stable 32-bit hash of a string or number (faces, crowd colours, anything derived from an id)
  hash(x) {
    let h = 2166136261 >>> 0;
    const s = String(x);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return h >>> 0;
  },

  // money: transfer sums in $M, wages in $K per week
  money(m) {
    const a = Math.abs(m), s = m < 0 ? '-' : '';
    if (a >= 1) return `${s}$${a >= 100 ? a.toFixed(0) : a.toFixed(1)}M`;
    return `${s}$${Math.round(a * 1000)}K`;
  },
  wage(k) { return k >= 1000 ? `$${(k / 1000).toFixed(2)}M/wk` : `$${Math.round(k)}K/wk`; },

  // colour helpers
  hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },
  rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.round(U.clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  },
  mix(a, b, t) {
    const A = U.hexToRgb(a), B = U.hexToRgb(b);
    return U.rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  },
  rgba(h, a) { const [r, g, b] = U.hexToRgb(h); return `rgba(${r},${g},${b},${a})`; },
  lum(h) {
    const c = U.hexToRgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  },
  onColor(h) { return U.lum(h) > 0.22 ? '#0b0f17' : '#ffffff'; },
  cdist(a, b) { const A = U.hexToRgb(a), B = U.hexToRgb(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); },
  ovrClass(o) { return o >= 85 ? 'o-elite' : o >= 75 ? 'o-good' : o >= 65 ? 'o-mid' : o >= 55 ? 'o-low' : 'o-bad'; },
  potGrade(p) {
    return p >= 90 ? 'A+' : p >= 85 ? 'A' : p >= 81 ? 'A-' : p >= 77 ? 'B+' : p >= 73 ? 'B' : p >= 69 ? 'B-' : p >= 65 ? 'C+' : p >= 60 ? 'C' : 'D';
  },
  vibrate(ms = 12) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* unsupported */ } },
};

// Seeded RNG (mulberry32). The match engine only ever draws from one of these, so a match
// replays identically from its seed — that's how academy games can be watched after the fact.
class Rng {
  constructor(seed) { this.s = (seed >>> 0) || 1; }
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + this.next() * (b - a); }
  int(a, b) { return Math.floor(a + this.next() * (b - a + 1)); }
  chance(p) { return this.next() < p; }
  pick(a) { return a[Math.floor(this.next() * a.length)]; }
  gauss() {
    let u = 0, v = 0;
    while (!u) u = this.next();
    while (!v) v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  poisson(l) {
    const L = Math.exp(-l);
    let k = 0, p = 1;
    do { k++; p *= this.next(); } while (p > L && k < 20);
    return k - 1;
  }
}

// 2D vector helpers (plain {x, y} objects)
const V = {
  v: (x = 0, y = 0) => ({ x, y }),
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
  scale: (a, s) => ({ x: a.x * s, y: a.y * s }),
  dot: (a, b) => a.x * b.x + a.y * b.y,
  len: a => Math.sqrt(a.x * a.x + a.y * a.y),
  dist: (a, b) => { const dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); },
  norm(a) { const l = Math.sqrt(a.x * a.x + a.y * a.y); return l > 1e-9 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 }; },
  rot(a, r) { const c = Math.cos(r), s = Math.sin(r); return { x: a.x * c - a.y * s, y: a.x * s + a.y * c }; },
  lerp: (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }),
};
