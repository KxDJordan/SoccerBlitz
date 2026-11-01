'use strict';
// ── RENDERER: the broadcast ───────────────────────────────────────
// A cached stadium layer (grass, lines, ad boards, a crowd in club colours) under a camera that follows the
// ball. Players are drawn top-down: legs that stride, arms that pump, shirts in the club's pattern, a head of
// hair from their portrait. On top: floodlight shadows, weather, curl trails, fire, impact text and the
// Blitz camera — shake, hit-stop on big hits, slow motion on goals.

const Render = (() => {
  const LAYER_PX = 8;
  const PS = 2.15; // players are drawn this much bigger than life so you can read them on a phone
  const HIT_WORDS = ['WHAM!', 'BOOM!', 'CRUNCH!', 'SMASH!', 'POW!', 'THUD!', 'KA-BLAM!', 'WALLOP!'];
  const BEATEN_WORDS = ['SKINNED!', 'BEATEN!', 'TWISTED!', 'SOLD!', 'GONE!', 'OLÉ!'];
  const FLAIR_COLS = ['#f0abfc', '#fde047', '#67e8f9', '#ffffff'];

  // pitch styles the player can choose in Settings
  const PITCH_STYLES = {
    stripes: { name: 'Classic stripes', g1: '#2e8e4c', g2: '#277f43' },
    checker: { name: 'Checkerboard', g1: '#2f904e', g2: '#287f44' },
    diagonal: { name: 'Diagonal cut', g1: '#2d8b4a', g2: '#267c42' },
    neon: { name: 'Neon arcade', g1: '#0b1f2e', g2: '#0d2536', line: '#5ef3ff', neon: true },
  };
  const pitchStyle = () => { try { return PITCH_STYLES[localStorage.getItem('soccerblitz.pitch')] ? localStorage.getItem('soccerblitz.pitch') : 'stripes'; } catch (e) { return 'stripes'; } };

  function buildLayer(cfg, home, away, five, night, fill = 0.9) {
    const cap = (home.stadium && home.stadium.cap) || 30000, biz = home.biz || {};
    const third = !five && cap >= 55000;
    const SUR = five ? 7 : third ? 18 : 14;
    const Wm = cfg.L + SUR * 2, Hm = cfg.W + SUR * 2;
    const cv = document.createElement('canvas');
    cv.width = Math.round(Wm * LAYER_PX); cv.height = Math.round(Hm * LAYER_PX);
    const c = cv.getContext('2d');
    c.scale(LAYER_PX, LAYER_PX);
    c.translate(SUR, SUR);
    const rnd = new Rng(U.hash(`${home.id}:${away.id}:${five}`));
    const style = PITCH_STYLES[pitchStyle()];
    // ── the bowl ──
    c.fillStyle = night ? '#04060c' : '#0d121c';
    c.fillRect(-SUR, -SUR, Wm, Hm);
    if (!five) {
      // concrete tiers with seat rows, then the crowd on top
      // a small ground has one tier; bigger ones a second (round the sides only below 35,000), the giants a third
      const tiers = [[5.2, 9.2]];
      if (cap >= 22000) tiers.push([9.8, 13.6]);
      if (third) tiers.push([14.2, 17.4]);
      const sidesOnly = cap < 35000;
      // open terraces where there's no stand: grass banks and a fence
      c.fillStyle = night ? '#0a1410' : '#16261c';
      if (cap < 22000) { c.fillRect(-13.6, -13.6, cfg.L + 27.2, 4.4); c.fillRect(-13.6, cfg.W + 9.2, cfg.L + 27.2, 4.4); c.fillRect(-13.6, -9.2, 4.4, cfg.W + 18.4); c.fillRect(cfg.L + 9.2, -9.2, 4.4, cfg.W + 18.4); }
      else if (sidesOnly) { c.fillRect(-13.6, -9.2, 4.4, cfg.W + 18.4); c.fillRect(cfg.L + 9.2, -9.2, 4.4, cfg.W + 18.4); }
      for (const [r0, r1] of tiers) {
        const ends = !(sidesOnly && r0 > 9);
        c.fillStyle = night ? '#121826' : '#1b2232';
        c.fillRect(-r1, -r1, cfg.L + 2 * r1, r1 - r0); c.fillRect(-r1, cfg.W + r0, cfg.L + 2 * r1, r1 - r0);
        if (ends) { c.fillRect(-r1, -r0, r1 - r0, cfg.W + 2 * r0); c.fillRect(cfg.L + r0, -r0, r1 - r0, cfg.W + 2 * r0); }
      }
      const homeCols = [home.kit.c1, home.kit.c1, home.kit.c2, home.kit.c1, '#e2e8f0', '#94a3b8', '#475569'];
      const awayCols = [away.kit.c1, away.kit.c2, away.kit.c1];
      // empty seats when the gate is down (the away end fills regardless)
      const seat = (x, y, ring) => {
        if (rnd.chance(0.1 + Math.max(0, 0.95 - fill) * 0.95) && !(x > cfg.L * 0.72 && y > cfg.W + 4)) return;
        // behind each goal a tifo block in club colours; one corner for the travelling fans
        const behindGoal = (x < -4 || x > cfg.L + 4) && Math.abs(y - cfg.W / 2) < cfg.W * 0.32;
        const awayEnd = x > cfg.L * 0.72 && y > cfg.W + 4;
        let col;
        if (behindGoal && x < 0) col = Math.floor((y + ring * 3) / 2.4) % 2 ? home.kit.c1 : home.kit.c2;
        else if (awayEnd) col = rnd.pick(awayCols);
        else col = rnd.pick(homeCols);
        c.fillStyle = col;
        c.globalAlpha = 0.6 + rnd.next() * 0.4;
        c.beginPath(); c.arc(x, y, 0.21, 0, 7); c.fill();
      };
      for (const [r0, r1] of tiers) for (let ring = r0 + 0.35; ring < r1; ring += 0.55) {
        const ends = !(sidesOnly && r0 > 9);
        for (let x = -ring; x <= cfg.L + ring; x += 0.55) { seat(x, -ring, ring); seat(x, cfg.W + ring, ring); }
        if (ends) for (let y = -ring + 0.55; y < cfg.W + ring; y += 0.55) { seat(-ring, y, ring); seat(cfg.L + ring, y, ring); }
      }
      c.globalAlpha = 1;
      // aisles and the roof's shadow on the upper tier
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 0.25;
      for (let x = 8; x < cfg.L; x += 12) { c.beginPath(); c.moveTo(x, -5); c.lineTo(x, -13.6); c.moveTo(x, cfg.W + 5); c.lineTo(x, cfg.W + 13.6); c.stroke(); }
      const roof = (x, y, w, h, vert, dir) => { const g = vert ? c.createLinearGradient(x + (dir > 0 ? 0 : w), 0, x + (dir > 0 ? w : 0), 0) : c.createLinearGradient(0, y + (dir > 0 ? 0 : h), 0, y + (dir > 0 ? h : 0)); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)'); c.fillStyle = g; c.fillRect(x, y, w, h); };
      // a roof over the stands once the ground is big enough (over the top tier on the giants)
      if (cap >= 40000) {
        const R = third ? 18 : 14, d = third ? 4 : 5;
        roof(-R, -R, cfg.L + 2 * R, d, false, -1); roof(-R, cfg.W + R - d, cfg.L + 2 * R, d, false, 1);
        roof(-R, -(R - d), d, cfg.W + 2 * (R - d), true, -1); roof(cfg.L + R - d, -(R - d), d, cfg.W + 2 * (R - d), true, 1);
      }
      // hospitality boxes: a glass strip along the main stand, more of it lit with each level
      if (biz.boxes && cap >= 22000) {
        const n = 6 + biz.boxes * 6, w = (cfg.L * 0.8) / n;
        for (let i = 0; i < n; i++) {
          const x = cfg.L * 0.1 + i * w;
          c.fillStyle = '#0b1220'; c.fillRect(x, cfg.W + 9.22, w - 0.15, 0.56);
          c.fillStyle = night ? 'rgba(254,240,138,.85)' : 'rgba(186,230,253,.65)'; c.fillRect(x + 0.1, cfg.W + 9.3, w - 0.35, 0.4);
        }
      }
      // big screens in the corners of the stands behind the goals
      if (biz.screen) {
        const sc = [[-11.8, cfg.W / 2 - 13]];
        if (biz.screen >= 2) sc.push([cfg.L + 7.2, cfg.W / 2 + 6]);
        for (const [x, y] of sc) {
          c.fillStyle = '#05070d'; c.fillRect(x, y, 4.6, 7);
          const g = c.createLinearGradient(x, y, x + 4.6, y + 7); g.addColorStop(0, home.kit.c1); g.addColorStop(1, home.kit.c2);
          c.fillStyle = g; c.globalAlpha = 0.85; c.fillRect(x + 0.35, y + 0.35, 3.9, 6.3); c.globalAlpha = 1;
          // LED rows (no lettering: the layer is turned and flipped for portrait screens)
          c.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 3; i++) c.fillRect(x + 1 + i * 1.1, y + 1, 0.35, 5);
        }
      }
      // floodlight pylons in the corners
      const fl = third ? 16.5 : 12.5;
      for (const [x, y] of [[-fl, -fl], [cfg.L + fl, -fl], [-fl, cfg.W + fl], [cfg.L + fl, cfg.W + fl]]) {
        c.fillStyle = '#2a3346'; c.fillRect(x - 1.6, y - 1.6, 3.2, 3.2);
        c.fillStyle = night ? '#fff7d6' : '#cbd5e1';
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c.fillRect(x - 1.25 + i * 0.9, y - 1.25 + j * 0.9, 0.65, 0.65);
      }
    } else {
      // academy ground: a fence and a handful of parents and scouts
      for (let i = 0; i < 70; i++) {
        const side = rnd.int(0, 3), t = rnd.next();
        const x = side < 2 ? t * cfg.L : side === 2 ? -4 - rnd.next() * 2 : cfg.L + 4 + rnd.next() * 2;
        const y = side === 0 ? -4 - rnd.next() * 2 : side === 1 ? cfg.W + 4 + rnd.next() * 2 : t * cfg.W;
        c.fillStyle = rnd.pick(['#e2e8f0', '#64748b', home.kit.c1, '#f59e0b', '#38bdf8']);
        c.beginPath(); c.arc(x, y, 0.35, 0, 7); c.fill();
      }
    }
    // the apron: darker grass with a running track feel
    const ap = five ? 3 : 4.6;
    c.fillStyle = style.neon ? '#071019' : five ? '#1d4f3a' : '#1b5631';
    c.fillRect(-ap, -ap, cfg.L + ap * 2, cfg.W + ap * 2);
    if (five) {
      c.fillStyle = '#e2e8f0';
      c.fillRect(-1.6, -1.6, cfg.L + 3.2, 0.6); c.fillRect(-1.6, cfg.W + 1, cfg.L + 3.2, 0.6);
      c.fillRect(-1.6, -1.6, 0.6, cfg.W + 3.2); c.fillRect(cfg.L + 1, -1.6, 0.6, cfg.W + 3.2);
    } else {
      // dugouts with benches
      for (const dx of [cfg.L / 2 - 15, cfg.L / 2 + 6]) { c.fillStyle = '#0b1220'; c.fillRect(dx, cfg.W + 1.3, 9, 1.8); c.fillStyle = 'rgba(148,163,184,.4)'; c.fillRect(dx + 0.3, cfg.W + 1.5, 8.4, 0.5); c.fillStyle = home.kit.c1; c.fillRect(dx, cfg.W + 1.3, 9, 0.2); }
    }
    // ── grass ──
    const g1 = style.g1, g2 = style.g2;
    c.fillStyle = g1; c.fillRect(0, 0, cfg.L, cfg.W);
    c.save(); c.beginPath(); c.rect(0, 0, cfg.L, cfg.W); c.clip();
    const n = five ? 10 : 18;
    c.fillStyle = g2;
    if (pitchStyle() === 'checker') { for (let i = 0; i < n; i++) for (let j = 0; j < 10; j++) if ((i + j) % 2) c.fillRect((i * cfg.L) / n, (j * cfg.W) / 10, cfg.L / n, cfg.W / 10); }
    else if (pitchStyle() === 'diagonal') { for (let k = -cfg.W; k < cfg.L + cfg.W; k += 10) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k + 5, 0); c.lineTo(k + 5 - cfg.W * 0.6, cfg.W); c.lineTo(k - cfg.W * 0.6, cfg.W); c.fill(); } }
    else if (style.neon) { c.strokeStyle = 'rgba(94,243,255,.07)'; c.lineWidth = 0.08; for (let x = 0; x < cfg.L; x += 3) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, cfg.W); c.stroke(); } for (let y = 0; y < cfg.W; y += 3) { c.beginPath(); c.moveTo(0, y); c.lineTo(cfg.L, y); c.stroke(); } }
    else for (let i = 0; i < n; i++) if (i % 2) c.fillRect((i * cfg.L) / n, 0, cfg.L / n, cfg.W);
    // blades of grass, and the light falling off toward the corners
    if (!style.neon) {
      for (let i = 0; i < 9000; i++) {
        const x = rnd.next() * cfg.L, y = rnd.next() * cfg.W, a = rnd.range(-0.5, 0.5);
        c.strokeStyle = rnd.chance(0.5) ? 'rgba(0,0,0,.07)' : 'rgba(190,255,160,.06)';
        c.lineWidth = 0.06;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.sin(a) * 0.35, y - Math.cos(a) * 0.35); c.stroke();
      }
      for (const gx of [0, cfg.L]) { const gr = c.createRadialGradient(gx, cfg.W / 2, 0, gx, cfg.W / 2, five ? 4 : 8); gr.addColorStop(0, 'rgba(130,105,60,.38)'); gr.addColorStop(1, 'rgba(130,105,60,0)'); c.fillStyle = gr; c.fillRect(gx - 9, cfg.W / 2 - 9, 18, 18); }
      const cg = c.createRadialGradient(cfg.L / 2, cfg.W / 2, 2, cfg.L / 2, cfg.W / 2, 3); cg.addColorStop(0, 'rgba(130,105,60,.25)'); cg.addColorStop(1, 'rgba(130,105,60,0)'); c.fillStyle = cg; c.fillRect(cfg.L / 2 - 3, cfg.W / 2 - 3, 6, 6);
    }
    const light = c.createRadialGradient(cfg.L / 2, cfg.W / 2, cfg.W * 0.2, cfg.L / 2, cfg.W / 2, cfg.L * 0.62);
    light.addColorStop(0, 'rgba(255,255,255,.06)'); light.addColorStop(1, 'rgba(0,0,0,.22)');
    c.fillStyle = light; c.fillRect(0, 0, cfg.L, cfg.W);
    c.restore();
    // ── lines: a soft glow under a crisp stroke ──
    const lineCol = style.line || '#ffffff';
    const drawLines = () => {
      c.strokeRect(0, 0, cfg.L, cfg.W);
      c.beginPath(); c.moveTo(cfg.L / 2, 0); c.lineTo(cfg.L / 2, cfg.W); c.stroke();
      c.beginPath(); c.arc(cfg.L / 2, cfg.W / 2, cfg.CIRCLE, 0, Math.PI * 2); c.stroke();
      for (const side of [0, 1]) {
        const x0 = side === 0 ? 0 : cfg.L, dir = side === 0 ? 1 : -1, spot = x0 + dir * cfg.PEN;
        c.strokeRect(side === 0 ? 0 : cfg.L - cfg.BOX_D, (cfg.W - cfg.BOX_W) / 2, cfg.BOX_D, cfg.BOX_W);
        c.strokeRect(side === 0 ? 0 : cfg.L - cfg.SIX_D, (cfg.W - cfg.SIX_W) / 2, cfg.SIX_D, cfg.SIX_W);
        const ang = Math.acos(Math.min(1, (cfg.BOX_D - cfg.PEN) / cfg.CIRCLE));
        c.beginPath();
        if (side === 0) c.arc(spot, cfg.W / 2, cfg.CIRCLE, -ang, ang); else c.arc(spot, cfg.W / 2, cfg.CIRCLE, Math.PI - ang, Math.PI + ang);
        c.stroke();
      }
      for (const [x, y, a0] of [[0, 0, 0], [cfg.L, 0, Math.PI / 2], [cfg.L, cfg.W, Math.PI], [0, cfg.W, -Math.PI / 2]]) { c.beginPath(); c.arc(x, y, 1, a0, a0 + Math.PI / 2); c.stroke(); }
    };
    c.strokeStyle = U.rgba(lineCol, style.neon ? 0.35 : 0.14); c.lineWidth = style.neon ? 0.7 : 0.4; drawLines();
    c.strokeStyle = U.rgba(lineCol, style.neon ? 0.95 : 0.9); c.lineWidth = 0.13; drawLines();
    c.fillStyle = U.rgba(lineCol, 0.95);
    c.beginPath(); c.arc(cfg.L / 2, cfg.W / 2, 0.25, 0, 7); c.fill();
    for (const side of [0, 1]) { c.beginPath(); c.arc(side === 0 ? cfg.PEN : cfg.L - cfg.PEN, cfg.W / 2, 0.22, 0, 7); c.fill(); }
    // corner flags
    for (const [x, y] of [[0, 0], [cfg.L, 0], [0, cfg.W], [cfg.L, cfg.W]]) { c.fillStyle = '#f8fafc'; c.beginPath(); c.arc(x, y, 0.18, 0, 7); c.fill(); c.fillStyle = home.kit.c1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 0.9, y - 0.3); c.lineTo(x + 0.2, y - 0.7); c.fill(); }
    return { cv, SUR };
  }

  class Pitch {
    constructor(canvas, match, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.m = match;
      this.cfg = match.cfg;
      this.five = match.five;
      this.opts = opts;
      const h = opts.home, a = opts.away;
      this.kits = opts.kits || [h.kit, a.kit];
      this.gk = [Art.gkKit(this.kits[0], this.kits[1]), Art.gkKit(this.kits[1], this.kits[0])];
      const wxBase = match.weather;
      this.ko = opts.ko || 'day';
      this.night = this.ko === 'night';
      this.gloom = Math.min(0.5, (wxBase.gloom || 0) + (DATA.KICKOFF.find(k => k.id === this.ko) || { gloom: 0 }).gloom);
      this.layer = buildLayer(this.cfg, h, a, this.five, this.night || this.ko === 'dusk', opts.fill);
      this.camera = opts.camera || 'follow';
      this.cam = { x: this.cfg.L / 2, y: this.cfg.W / 2, zoom: 1 };
      this.particles = []; this.floaters = []; this.rings = []; this.trail = []; this.drops = []; this.clouds = [];
      this.fxSeen = match.fxTotal;
      this.shakeUntil = 0; this.shakeAmp = 0; this.flashUntil = 0; this.flashColor = '#fff';
      this.slowUntil = 0; this.slowK = 1; this.hitStopUntil = 0;
      this.banner = null; this.net = [null, null];
      this.roll = 0; this.now = performance.now(); this.lightning = 0; this.nextBolt = performance.now() + 4000;
      this.highlight = opts.highlight != null ? opts.highlight : 0;
      this.onSound = opts.onSound || null;
      for (let i = 0; i < 5; i++) this.clouds.push({ x: Math.random() * this.cfg.L, y: Math.random() * this.cfg.W, r: 14 + Math.random() * 18, v: 0.6 + Math.random() * 0.8 });
      this.resize();
    }
    resize() {
      const r = this.canvas.getBoundingClientRect();
      this.dpr = Math.min(2.5, window.devicePixelRatio || 1);
      this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
      this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
      this.vertical = this.h > this.w * 1.05;
      this.vig = this.ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.38, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.78);
      this.vig.addColorStop(0, 'rgba(0,0,0,0)'); this.vig.addColorStop(1, 'rgba(0,0,0,.5)');
      this.drops = [];
    }
    // ── instant replay: draw a recorded copy of the match (same shape as the live one) with a tight camera ──
    // focus = the points that must stay in shot: the goalmouth and the keeper (the ball is added every frame)
    startReplay(R, focus) {
      this.replay = { live: this.m, focus, born: performance.now() };
      this.m = R;
      this.fxSeen = R.fxTotal;
      this.particles = []; this.floaters = []; this.rings = []; this.trail = [];
      this.banner = null; this.slowUntil = 0; this.hitStopUntil = 0; this.shakeUntil = 0;
      this.flash('#ffffff', 220);
    }
    endReplay() {
      if (!this.replay) return;
      const live = this.replay.live;
      this.replay = null;
      this.m = live;
      this.fxSeen = live.fxTotal;
      this.particles = []; this.floaters = []; this.rings = []; this.trail = [];
      this.flash('#ffffff', 220);
    }
    // sim speed multiplier the UI should apply right now (hit-stop and goal slow-mo)
    timeScale() {
      const t = performance.now();
      if (t < this.hitStopUntil) return 0.08;
      if (t < this.slowUntil) return this.slowK;
      return 1;
    }

    // ── transforms ──
    tx(p) {
      const { s, cam } = this;
      const cy = this.cy();
      return this.vertical ? { x: this.w / 2 + (p.y - cam.y) * s + this.shx, y: cy - (p.x - cam.x) * s + this.shy } : { x: this.w / 2 + (p.x - cam.x) * s + this.shx, y: cy + (p.y - cam.y) * s + this.shy };
    }
    sAng(a) { return this.vertical ? a - Math.PI / 2 : a; }
    // HUD overlays (scoreboard on top, controls at the bottom) in CSS px: the camera frames the space between them
    setInsets(top, bottom) { this.inset = { top: Math.max(0, top || 0), bottom: Math.max(0, bottom || 0) }; }
    visH() { const i = this.inset || { top: 0, bottom: 0 }; return Math.max(60, this.h - i.top - i.bottom); }
    cy() { const i = this.inset || { top: 0, bottom: 0 }; return i.top + this.visH() / 2; }
    world() {
      const { s, cam, dpr } = this, k = s * dpr;
      const cy = this.cy();
      if (this.vertical) this.ctx.setTransform(0, -k, k, 0, (this.w / 2 - cam.y * s + this.shx) * dpr, (cy + cam.x * s + this.shy) * dpr);
      else this.ctx.setTransform(k, 0, 0, k, (this.w / 2 - cam.x * s + this.shx) * dpr, (cy - cam.y * s + this.shy) * dpr);
    }
    screen() { this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); }

    updateCamera(ball, dt) {
      const c = this.cfg, along = c.L + 8, across = c.W + 8;
      const [ws, hs] = this.vertical ? [across, along] : [along, across];
      const base = Math.min(this.w / ws, this.visH() / hs);
      if (this.replay) return this.replayCamera(ball, dt, base);
      const follow = this.camera === 'follow';
      const zt = follow ? (this.five ? 1.45 : this.vertical ? 2.05 : 2.3) : 1;
      this.cam.zoom += (zt - this.cam.zoom) * Math.min(1, dt * 3);
      this.s = base * this.cam.zoom;
      let tx = c.L / 2, ty = c.W / 2;
      if (follow) {
        const b = this.m.ball;
        tx = ball.x + U.clamp(b.vel.x * 0.35, -8, 8);
        ty = ball.y + U.clamp(b.vel.y * 0.35, -6, 6);
        // keep the camera inside the stadium
        // the visible window may run 7m past each goal line, so the net and the area behind it stay in shot
        const halfX = (this.vertical ? this.visH() : this.w) / 2 / this.s, halfY = (this.vertical ? this.w : this.visH()) / 2 / this.s;
        tx = U.clamp(tx, Math.min(c.L / 2, halfX - 7), Math.max(c.L / 2, c.L - halfX + 7));
        ty = U.clamp(ty, Math.min(c.W / 2, halfY - 6), Math.max(c.W / 2, c.W - halfY + 6));
      }
      const k = Math.min(1, dt * (follow ? 2.8 : 4));
      this.cam.x += (tx - this.cam.x) * k;
      this.cam.y += (ty - this.cam.y) * k;
    }

    // zoom in as far as possible while the ball, the goalmouth and the keeper all stay in the frame
    replayCamera(ball, dt, base) {
      const c = this.cfg, f = this.replay.focus, kp = f.keeper != null ? this.m.players[f.keeper] : null;
      const pts = [ball, ...f.goal];
      if (kp && this.m.onPitch.includes(kp)) pts.push(kp.pos);
      const tr = f.track != null ? this.m.players[f.track] : null;
      if (tr && this.m.onPitch.includes(tr)) pts.push(tr.pos, { x: tr.pos.x + 4, y: tr.pos.y + 3 }, { x: tr.pos.x - 4, y: tr.pos.y - 3 });
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
      const mx = 5, my = 4; // breathing room round the edges
      const spanX = x1 - x0 + mx * 2, spanY = y1 - y0 + my * 2;
      const [vw, vh] = this.vertical ? [this.w, this.visH()] : [this.w, this.visH()];
      const [sw, sh] = this.vertical ? [spanY, spanX] : [spanX, spanY];
      const fit = Math.min(vw / (sw * base), vh / (sh * base));
      const zt = U.clamp(fit, 1, this.five ? 3.2 : 4.2);
      const first = performance.now() - this.replay.born < 60;
      const kz = first ? 1 : Math.min(1, dt * 2.5);
      this.cam.zoom += (zt - this.cam.zoom) * kz;
      this.s = base * this.cam.zoom;
      const tx = (x0 + x1) / 2, ty = (y0 + y1) / 2;
      this.cam.x += (tx - this.cam.x) * kz;
      this.cam.y += (ty - this.cam.y) * kz;
      void c;
    }
    // broadcast dressing: letterbox bars, a REPLAY bug and the slow-motion tag
    drawReplayHud(now) {
      const ctx = this.ctx, i = this.inset || { top: 0, bottom: 0 }, t = now - this.replay.born;
      const bar = Math.min(1, t / 250) * Math.min(34, this.h * 0.04);
      ctx.fillStyle = 'rgba(0,0,0,.85)';
      ctx.fillRect(0, i.top - 10, this.w, bar);
      ctx.fillRect(0, this.h - i.bottom - bar, this.w, bar);
      const y = i.top - 10 + bar + 22;
      ctx.font = '900 15px Oswald, Impact, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      const label = this.replay.focus.label || 'INSTANT REPLAY', w = ctx.measureText(label).width + 34;
      ctx.fillStyle = 'rgba(8,12,22,.85)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(12, y - 13, w, 26, 6) : ctx.rect(12, y - 13, w, 26); ctx.fill();
      ctx.fillStyle = Math.floor(now / 500) % 2 ? '#ef4444' : '#7f1d1d'; ctx.beginPath(); ctx.arc(25, y, 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(label, 36, y + 1);
      ctx.font = '700 11px Inter, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillText(this.replay.slow ? 'SLOW MOTION' : '', 16 + w, y + 1);
    }
    // ── main ──
    render(alpha) {
      const m = this.m, ctx = this.ctx;
      const now = performance.now(), dt = Math.min(0.05, (now - this.now) / 1000);
      this.now = now;
      const b = m.ball;
      const ball = V.lerp(b.prevPos, b.pos, alpha), bz = b.prevZ + (b.z - b.prevZ) * alpha;
      this.consumeFx(now);
      this.updateCamera(ball, dt);
      const shaking = now < this.shakeUntil;
      const amp = shaking ? this.shakeAmp * ((this.shakeUntil - now) / 400) : 0;
      this.shx = shaking ? (Math.random() - 0.5) * amp : 0;
      this.shy = shaking ? (Math.random() - 0.5) * amp : 0;

      this.screen();
      ctx.fillStyle = '#05070d';
      ctx.fillRect(0, 0, this.w, this.h);
      this.world();
      const SUR = this.layer.SUR;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.layer.cv, -SUR, -SUR, this.cfg.L + SUR * 2, this.cfg.W + SUR * 2);
      this.drawClouds(dt);
      this.drawBoards(performance.now());
      this.drawGoals(now, 'back');
      this.drawWall();
      // players, painted back-to-front on screen
      const ps = m.onPitch.map(p => ({ p, pos: V.lerp(p.prevPos, p.pos, alpha) }));
      for (const it of ps) it.sp = this.tx(it.pos);
      ps.sort((a, c) => a.sp.y - c.sp.y);
      this.screen();
      for (const it of ps) this.shadow(it.p, it.sp);
      this.ballShadow(ball, bz);
      for (const it of ps) this.player(it.p, it.sp, alpha, now, dt);
      this.drawTrail(ball, bz);
      this.drawBall(ball, bz, dt);
      this.world();
      this.drawGoals(now, 'front');
      this.screen();
      this.updateParticles(dt);
      this.drawParticles();
      this.drawRings(now);
      this.drawFloaters(now);
      const carrier = b.owner != null ? m.players[b.owner] : null;
      if (carrier) this.tag(carrier, this.tx(V.lerp(carrier.prevPos, carrier.pos, alpha)));
      this.drawLight();
      this.drawWeather(dt, now);
      ctx.fillStyle = this.vig; ctx.fillRect(0, 0, this.w, this.h);
      if (now < this.flashUntil) { ctx.globalAlpha = ((this.flashUntil - now) / 260) * 0.55; ctx.fillStyle = this.flashColor; ctx.fillRect(0, 0, this.w, this.h); ctx.globalAlpha = 1; }
      this.drawBanner(now);
      if (this.replay) this.drawReplayHud(now);
    }

    // ── pitch furniture ──
    drawGoals(now, layer) {
      const ctx = this.ctx, c = this.cfg, depth = this.five ? 1.2 : 2;
      for (const side of [0, 1]) {
        const x = side === 0 ? 0 : c.L, dir = side === 0 ? -1 : 1;
        const rip = this.net[side] && now < this.net[side].until ? (this.net[side].until - now) / 1200 : 0;
        if (layer === 'back') {
          ctx.fillStyle = 'rgba(0,0,0,.25)';
          ctx.fillRect(side === 0 ? x - depth - 0.3 : x, c.GY0 - 0.2, depth + 0.3, c.GW + 0.4);
          ctx.strokeStyle = 'rgba(255,255,255,.42)';
          ctx.lineWidth = 0.05;
          const bulge = t => rip * Math.sin(t * Math.PI) * 1.4 * Math.sin(now / 60);
          for (let i = 0; i <= 10; i++) {
            const y = c.GY0 + (c.GW * i) / 10;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dir * (depth + bulge(i / 10)), y); ctx.stroke();
          }
          for (let j = 1; j <= 4; j++) {
            const d = (depth * j) / 4;
            ctx.beginPath();
            for (let i = 0; i <= 10; i++) { const y = c.GY0 + (c.GW * i) / 10; const xx = x + dir * (d + bulge(i / 10) * (j / 4)); i ? ctx.lineTo(xx, y) : ctx.moveTo(xx, y); }
            ctx.stroke();
          }
        } else {
          // posts and crossbar (seen from above: a bar between two posts)
          ctx.fillStyle = 'rgba(0,0,0,.3)';
          ctx.fillRect(x - 0.1 + 0.25, c.GY0 + 0.25, 0.22, c.GW);
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(x - 0.11, c.GY0 - 0.11, 0.22, c.GW + 0.22);
          ctx.beginPath(); ctx.arc(x, c.GY0, 0.17, 0, 7); ctx.arc(x, c.GY1, 0.17, 0, 7); ctx.fill();
        }
      }
    }
    drawWall() {
      const w = this.m.wall;
      if (!w) return;
      // nothing extra: the players themselves are the wall; a faint 9.15m arc helps read it
      const r = this.m.restart;
      if (!r) return;
      const ctx = this.ctx;
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 0.08; ctx.setLineDash([0.5, 0.5]);
      ctx.beginPath(); ctx.arc(r.pos.x, r.pos.y, this.cfg.CIRCLE, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    }
    drawClouds(dt) {
      const wx = this.m.weather;
      if (!wx.clouds) return;
      const ctx = this.ctx;
      for (const c of this.clouds) {
        c.x += c.v * dt; if (c.x > this.cfg.L + c.r) c.x = -c.r;
        const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
        g.addColorStop(0, `rgba(0,0,0,${0.16 * wx.clouds})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
      }
    }

    // LED advertising boards: they scroll, and flash the club's colours after a goal
    drawBoards(now) {
      if (this.five) return;
      const ctx = this.ctx, c = this.cfg, home = this.opts.home;
      const ads = ['SOCCER BLITZ', 'VOLTA ENERGY', 'KRAKEN', 'NOVA AIR', 'GOALLINE', 'APEX', 'TURBO COLA', 'SKYLINE', home.abbr, 'ORBIT BANK', 'NITRO'];
      const party = this.banner && now - this.banner.born < 2200;
      const phase = Math.floor(now / 6000) % 3;
      const bg = party ? (Math.floor(now / 160) % 2 ? home.kit.c1 : '#0b0f17') : phase === 0 ? '#0b1220' : phase === 1 ? home.kit.c1 : '#111827';
      const fg = party ? '#ffffff' : phase === 1 ? U.onColor(home.kit.c1) : phase === 0 ? '#e2e8f0' : '#fde047';
      const text = (party ? 'GOAL!   GOAL!   GOAL!   ' : ads.join('   •   ') + '   •   ').repeat(3);
      const strip = (x, y, w, h, vert) => {
        ctx.save();
        ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(x, y, w, (vert ? w : h) * 0.18 * (vert ? 1 : 1));
        ctx.fillStyle = fg;
        ctx.font = '700 0.72px Oswald, Impact, sans-serif';
        ctx.textBaseline = 'middle';
        const len = vert ? h : w, off = ((now / 1000) * 2.4) % 60;
        ctx.translate(x + w / 2, y + h / 2);
        if (vert) ctx.rotate(Math.PI / 2);
        ctx.fillText(text, -len / 2 - off, 0.04);
        ctx.restore();
      };
      strip(-1, -3.6, c.L + 2, 0.9, false);
      strip(-1, c.W + 2.7, c.L + 2, 0.9, false);
      strip(-3.6, -1, 0.9, c.W / 2 - 4.6, true); strip(-3.6, c.W / 2 + 3.6, 0.9, c.W / 2 - 4.6, true);
      strip(c.L + 2.7, -1, 0.9, c.W / 2 - 4.6, true); strip(c.L + 2.7, c.W / 2 + 3.6, 0.9, c.W / 2 - 4.6, true);
      // photographers' flashes in the crowd under the lights (and a storm of them after a goal)
      const flashes = party ? 14 : this.night ? 2 : 0;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < flashes; i++) {
        if (Math.random() > 0.5) continue;
        const side = Math.floor(Math.random() * 4), t = Math.random(), r = 5.5 + Math.random() * 7.5;
        const x = side < 2 ? t * c.L : side === 2 ? -r : c.L + r, y = side === 0 ? -r : side === 1 ? c.W + r : t * c.W;
        ctx.globalAlpha = 0.5 + Math.random() * 0.5;
        ctx.beginPath(); ctx.arc(x, y, 0.28, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // ── players ──
    kitOf(p) { return p.isGK ? this.gk[p.team] : this.kits[p.team]; }
    shadow(p, sp) {
      const ctx = this.ctx, s = this.s * PS, z = p.z || 0;
      const lifts = 1 + z * 2.6;
      const dirs = this.night ? [[1, 1], [-1, 1], [1, -1], [-1, -1]] : [[0.7, 0.9]];
      ctx.fillStyle = `rgba(0,0,0,${(this.night ? 0.13 : 0.3) * (1 - Math.min(0.5, z * 0.5))})`;
      for (const [dx, dy] of dirs) {
        ctx.beginPath();
        ctx.ellipse(sp.x + dx * s * 0.22 * lifts, sp.y + dy * s * 0.22 * lifts, s * 0.5 / (1 + z * 0.7), s * 0.38 / (1 + z * 0.7), 0, 0, 7);
        ctx.fill();
      }
    }
    player(p, sp, alpha, now, dt) {
      const ctx = this.ctx, k = this.kitOf(p), lk = Art.look(p.data);
      const z = p.z || 0, s = this.s * PS * (1 + z * 0.45);
      let a = p.prevAng + (((p.ang - p.prevAng + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * alpha;
      const sa = this.sAng(a);
      const speed = V.len(p.vel);
      const down = p.down > 0 || (p.dive > 0);
      const lift = z * this.s * 0.9;
      const air = z > 0.06 && !down && p.slide <= 0 ? (p.air || (p.isGK ? 'catch' : 'head')) : null;
      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.translate(sp.x, sp.y - lift);
      // fire aura
      if (this.m.time < p.fire) {
        const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.2);
        gl.addColorStop(0, 'rgba(255,170,40,.55)'); gl.addColorStop(1, 'rgba(255,80,0,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, s * 1.2, 0, 7); ctx.fill();
        if (Math.random() < 0.6) this.spawn(p.pos, 'flame');
      }
      // ball-carrier ring
      if (this.m.ball.owner === p.id) {
        ctx.strokeStyle = U.rgba(k.c1 === '#F4F5F7' ? '#38bdf8' : '#fde047', 0.9);
        ctx.lineWidth = Math.max(1.5, s * 0.07);
        ctx.beginPath(); ctx.ellipse(0, 0, s * 0.72, s * 0.72, 0, 0, 7); ctx.stroke();
      }
      ctx.rotate(sa + (down ? p.spinAng || 0 : 0) + (p.twirl || 0) + (p.stun > 0 ? Math.sin(now / 55) * 0.3 : 0));
      ctx.scale(s, s);
      ctx.lineCap = 'round';
      const skin = lk.skin, sock = k.c3 || k.c1, shorts = k.c3 === k.c1 ? U.mix(k.c1, '#000', 0.35) : k.c3 || '#111827';
      if (down || p.slide > 0) this.bodyDown(ctx, p, k, lk, shorts, sock, skin);
      else {
        // stride: legs swing with distance travelled; arms counter-swing
        const ph = p.stride * 2.4, amp = air ? 0 : Math.min(1, speed / 6.5) * 0.42;
        const lf = Math.sin(ph) * amp, cel = p.celebrate > 0;
        // legs (tucked up behind him in the air)
        for (const side of [-1, 1]) {
          const fx = air ? -0.2 : side * lf, fy = side * (air ? 0.12 : 0.17);
          ctx.strokeStyle = sock; ctx.lineWidth = 0.17;
          ctx.beginPath(); ctx.moveTo(0, side * 0.15); ctx.lineTo(fx, fy); ctx.stroke();
          ctx.fillStyle = '#0b0f17'; ctx.beginPath(); ctx.ellipse(fx + 0.06, fy, 0.11, 0.08, 0, 0, 7); ctx.fill();
        }
        // shorts
        ctx.fillStyle = shorts; ctx.beginPath(); ctx.ellipse(-0.02, 0, 0.17, 0.3, 0, 0, 7); ctx.fill();
        // arms
        for (const side of [-1, 1]) {
          // in the air: a header flings the arms out wide for balance, a keeper reaches up and forward with both gloves
          const hx = air === 'catch' ? 0.62 : air ? -0.08 : cel ? 0.32 : -side * lf * 0.6, hy = side * (air === 'catch' ? 0.16 : air ? 0.72 : cel ? 0.62 : 0.46);
          ctx.strokeStyle = k.c1; ctx.lineWidth = 0.14;
          ctx.beginPath(); ctx.moveTo(0, side * 0.36); ctx.lineTo(hx * 0.5, side * 0.42); ctx.stroke();
          ctx.strokeStyle = skin; ctx.lineWidth = 0.11;
          ctx.beginPath(); ctx.moveTo(hx * 0.5, side * 0.42); ctx.lineTo(hx, hy); ctx.stroke();
          if (p.isGK) { ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(hx, hy, 0.09, 0, 7); ctx.fill(); }
        }
        this.torso(ctx, p, k);
        // the head thrown forward to attack the ball
        if (air === 'head') { ctx.save(); ctx.translate(0.12 * Math.min(1, z * 3), 0); this.head(ctx, lk, k); ctx.restore(); }
        else this.head(ctx, lk, k);
      }
      ctx.restore();
      if (p.slide > 0 && Math.random() < 0.7) this.spawn(p.pos, 'dust');
      if (p.skill && Math.random() < 0.75) this.spawn(p.pos, p.skill.kind === 'dash' ? 'streak' : 'swish', 0, p.skill.kind === 'dash' ? ['#fde047', '#ffffff'] : [k.c1, '#ffffff', k.c2], 0.6);
      if (p.stun > 0) {
        ctx.save(); ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        const cy = sp.y - lift - s * 0.62;
        ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = Math.max(1.2, s * 0.06);
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) { const an = now / 90 + i * 0.5, r = s * 0.05 + i * s * 0.012; const x = sp.x + Math.cos(an) * r, y = cy + Math.sin(an) * r * 0.45; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.stroke();
        ctx.restore();
      }
      // dizzy stars over a flattened player
      if (p.down > 0.5 && !p.isGK) {
        ctx.save(); ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.fillStyle = '#fde047';
        for (let i = 0; i < 3; i++) { const an = now / 180 + (i * Math.PI * 2) / 3; ctx.font = `${Math.max(8, s * 0.32)}px sans-serif`; ctx.fillText('★', sp.x + Math.cos(an) * s * 0.45 - s * 0.1, sp.y - lift - s * 0.55 + Math.sin(an) * s * 0.15); }
        ctx.restore();
      }
    }
    torso(ctx, p, k) {
      ctx.save();
      ctx.beginPath(); ctx.ellipse(0, 0, 0.27, 0.48, 0, 0, 7);
      ctx.fillStyle = k.c1; ctx.fill();
      ctx.clip();
      ctx.fillStyle = k.c2;
      switch (k.style) {
        case 'stripes': for (let y = -0.45; y < 0.5; y += 0.22) ctx.fillRect(-0.3, y, 0.6, 0.09); break;
        case 'hoops': for (let x = -0.3; x < 0.3; x += 0.18) ctx.fillRect(x, -0.5, 0.07, 1); break;
        case 'halves': ctx.fillRect(-0.3, 0, 0.6, 0.5); break;
        case 'sash': ctx.beginPath(); ctx.moveTo(-0.3, -0.5); ctx.lineTo(-0.1, -0.5); ctx.lineTo(0.3, 0.4); ctx.lineTo(0.1, 0.5); ctx.fill(); break;
        case 'band': ctx.fillRect(-0.07, -0.5, 0.14, 1); break;
        case 'chevron': ctx.beginPath(); ctx.moveTo(0.05, -0.5); ctx.lineTo(-0.15, 0); ctx.lineTo(0.05, 0.5); ctx.lineTo(-0.05, 0.5); ctx.lineTo(-0.25, 0); ctx.lineTo(-0.05, -0.5); ctx.fill(); break;
        case 'pin': ctx.globalAlpha = 0.7; for (let y = -0.45; y < 0.5; y += 0.12) ctx.fillRect(-0.3, y, 0.6, 0.02); break;
        case 'quarters': ctx.fillRect(-0.3, -0.5, 0.3, 0.5); ctx.fillRect(0, 0, 0.3, 0.5); break;
        case 'fade': for (let i = 0; i < 5; i++) { ctx.globalAlpha = (i + 1) / 5; ctx.fillRect(-0.3 + i * 0.12, -0.5, 0.12, 1); } break;
        case 'goldpin': ctx.fillStyle = '#fbbf24'; for (let y = -0.4; y < 0.5; y += 0.16) ctx.fillRect(-0.3, y, 0.6, 0.025); break;
        case 'starband': ctx.fillRect(-0.3, -0.07, 0.6, 0.14); ctx.fillStyle = '#fbbf24'; for (const y of [-0.3, 0, 0.3]) { ctx.beginPath(); ctx.arc(0.05, y, 0.045, 0, 7); ctx.fill(); } break;
        default: break;
      }
      ctx.globalAlpha = 1;
      const sh = ctx.createRadialGradient(0.1, -0.12, 0.02, 0, 0, 0.55);
      sh.addColorStop(0, 'rgba(255,255,255,.28)'); sh.addColorStop(0.55, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.35)');
      ctx.fillStyle = sh; ctx.fillRect(-0.3, -0.5, 0.6, 1);
      ctx.restore();
      ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 0.04;
      ctx.beginPath(); ctx.ellipse(0, 0, 0.27, 0.48, 0, 0, 7); ctx.stroke();
      // number on the back
      if (this.s * PS > 15 && p.data.num) {
        ctx.save(); ctx.rotate(Math.PI / 2);
        ctx.fillStyle = U.onColor(k.c1); ctx.font = '700 0.3px Oswald, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(p.data.num, 0, 0.12);
        ctx.restore();
      }
    }
    head(ctx, lk, k) {
      ctx.fillStyle = lk.skin;
      ctx.beginPath(); ctx.arc(0.03, 0, 0.2, 0, 7); ctx.fill();
      ctx.fillStyle = lk.hair;
      const st = lk.style;
      if (st === 'afro') { ctx.beginPath(); ctx.arc(-0.02, 0, 0.27, 0, 7); ctx.fill(); }
      else if (st === 'bald') { /* nothing */ }
      else if (st === 'mohawk') { ctx.fillRect(-0.2, -0.05, 0.36, 0.1); }
      else if (st === 'long') { ctx.beginPath(); ctx.ellipse(-0.08, 0, 0.26, 0.21, 0, 0, 7); ctx.fill(); }
      else if (st === 'bun') { ctx.beginPath(); ctx.arc(-0.02, 0, 0.2, Math.PI / 2, Math.PI * 1.5); ctx.fill(); ctx.beginPath(); ctx.arc(-0.24, 0, 0.09, 0, 7); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(0.0, 0, st === 'buzz' ? 0.19 : 0.21, Math.PI * 0.42, Math.PI * 1.58); ctx.fill(); }
      if (lk.band) { ctx.strokeStyle = k.c2; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.arc(0.03, 0, 0.2, Math.PI * 0.3, Math.PI * 1.7); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 0.03;
      ctx.beginPath(); ctx.arc(0.03, 0, 0.2, 0, 7); ctx.stroke();
    }
    bodyDown(ctx, p, k, lk, shorts, sock, skin) {
      // flat on the turf: legs trailing, arms splayed (a slide stretches one leg at the ball)
      const sliding = p.slide > 0, diving = p.dive > 0;
      ctx.save();
      if (diving) ctx.rotate(p.diveDir ? -p.diveDir * Math.PI / 2 : 0);
      ctx.strokeStyle = sock; ctx.lineWidth = 0.17;
      ctx.beginPath(); ctx.moveTo(-0.1, -0.12); ctx.lineTo(sliding ? 0.75 : -0.7, sliding ? -0.05 : -0.22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-0.1, 0.12); ctx.lineTo(sliding ? -0.35 : -0.72, sliding ? 0.3 : 0.24); ctx.stroke();
      ctx.fillStyle = '#0b0f17';
      ctx.beginPath(); ctx.arc(sliding ? 0.8 : -0.74, sliding ? -0.05 : -0.22, 0.1, 0, 7); ctx.fill();
      ctx.fillStyle = shorts; ctx.beginPath(); ctx.ellipse(-0.18, 0, 0.2, 0.28, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = skin; ctx.lineWidth = 0.11;
      const reach = diving ? 0.85 : 0.55;
      ctx.beginPath(); ctx.moveTo(0.1, -0.36); ctx.lineTo(0.32 + (diving ? 0.3 : 0), -reach); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0.1, 0.36); ctx.lineTo(0.32 + (diving ? 0.3 : 0), reach); ctx.stroke();
      if (p.isGK) { ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(0.32 + (diving ? 0.3 : 0), -reach, 0.1, 0, 7); ctx.arc(0.32 + (diving ? 0.3 : 0), reach, 0.1, 0, 7); ctx.fill(); }
      ctx.translate(0.05, 0); ctx.scale(1.15, 1);
      this.torso(ctx, p, k);
      ctx.translate(0.24, 0);
      this.head(ctx, lk, k);
      ctx.restore();
    }
    tag(p, sp) {
      const ctx = this.ctx, txt = `${p.data.num || ''} ${p.data.ln}`.trim();
      ctx.font = '600 11px Inter, sans-serif';
      const w = ctx.measureText(txt).width + 12, y = sp.y - this.s * PS * 0.95 - 16 - (p.z || 0) * this.s * 0.5;
      ctx.fillStyle = 'rgba(8,12,22,.78)';
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(sp.x - w / 2, y, w, 16, 8) : ctx.rect(sp.x - w / 2, y, w, 16); ctx.fill();
      ctx.fillStyle = this.kits[p.team].c1 === '#15181E' ? '#e2e8f0' : this.kits[p.team].c1;
      ctx.fillRect(sp.x - w / 2 + 5, y + 5, 3, 6);
      ctx.fillStyle = '#f8fafc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, sp.x + 3, y + 8.5);
    }

    // ── ball ──
    ballShadow(ball, z) {
      const ctx = this.ctx, sp = this.tx(ball), r = 0.3 * this.s * 1.4;
      ctx.fillStyle = `rgba(0,0,0,${Math.max(0.08, 0.35 - z * 0.04)})`;
      ctx.beginPath(); ctx.ellipse(sp.x + z * this.s * 0.25, sp.y + z * this.s * 0.15, r * (1 + z * 0.05), r * 0.75 * (1 + z * 0.05), 0, 0, 7); ctx.fill();
    }
    drawBall(ball, z, dt) {
      const ctx = this.ctx, b = this.m.ball, sp = this.tx(ball);
      const r = 0.24 * this.s * 1.5 * (1 + z * 0.09), y = sp.y - z * this.s * 0.55;
      this.roll += (V.len(b.vel) + (b.owner != null ? b.tw || 0 : 0)) * dt * 2.2;
      ctx.save();
      ctx.translate(sp.x, y);
      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#cbd5e1');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.clip();
      ctx.rotate(this.roll);
      ctx.fillStyle = '#111827';
      for (let i = 0; i < 5; i++) { const an = (i * Math.PI * 2) / 5; const px = Math.cos(an) * r * 0.62, py = Math.sin(an) * r * 0.62 + Math.sin(this.roll) * r * 0.3; ctx.beginPath(); ctx.arc(px, py, r * 0.22, 0, 7); ctx.fill(); }
      ctx.beginPath(); ctx.arc(0, Math.sin(this.roll) * r * 0.3, r * 0.26, 0, 7); ctx.fill();
      ctx.restore();
      const gl = ctx.createRadialGradient(-r * 0.4, -r * 0.45, 0, -r * 0.4, -r * 0.45, r * 0.6);
      gl.addColorStop(0, 'rgba(255,255,255,.95)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
      ctx.restore();
      // the trail remembers where the ball has been in screen space (with height)
      if (b.owner == null && V.len(b.vel) > 6) {
        this.trail.push({ x: ball.x, y: ball.y, z, curl: b.curl !== 0, power: b.power, flair: !!b.flair, t: performance.now() });
        if (b.flair && Math.random() < 0.6) this.spawn(ball, 'spark', z, FLAIR_COLS, 1.5);
        if (b.power >= 1) { this.spawn(ball, 'flame', z); this.spawn(ball, 'flame', z); }
      }
      if (this.trail.length > 26) this.trail.shift();
    }
    drawTrail() {
      const ctx = this.ctx, now = performance.now();
      this.trail = this.trail.filter(p => now - p.t < 380);
      if (this.trail.length < 2) return;
      for (let i = 1; i < this.trail.length; i++) {
        const a = this.trail[i - 1], c = this.trail[i];
        const pa = this.tx(a), pc = this.tx(c);
        const f = 1 - (now - c.t) / 380;
        ctx.strokeStyle = c.power >= 1 ? `rgba(255,140,30,${0.75 * f})` : c.flair ? `rgba(240,171,252,${0.8 * f})` : c.curl ? `rgba(94,234,212,${0.7 * f})` : `rgba(255,255,255,${0.42 * f})`;
        ctx.lineWidth = Math.max(1, this.s * 0.25 * f * (c.power >= 1 ? 2 : 1));
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y - a.z * this.s * 0.55); ctx.lineTo(pc.x, pc.y - c.z * this.s * 0.55); ctx.stroke();
      }
    }

    // ── effects ──
    consumeFx(now) {
      const m = this.m;
      const n = m.fxTotal - this.fxSeen;
      if (n <= 0) return;
      const list = m.fx.slice(-Math.min(n, m.fx.length));
      this.fxSeen = m.fxTotal;
      for (const f of list) this.spawnFx(f, now);
    }
    spawnFx(f, now) {
      const at = { x: f.x, y: f.y }, col = this.kits[f.team] ? this.kits[f.team].c1 : '#fff';
      const sound = this.onSound || (() => {});
      switch (f.type) {
        case 'goal': {
          const side = f.team === 0 ? 1 : 0;
          this.net[side] = { until: now + 1200 };
          if (this.replay) { this.burst(at, 30, [this.kits[f.team].c1, this.kits[f.team].c2, '#fde047'], 10, 'confetti'); this.rings.push({ x: at.x, y: at.y, born: now, life: 900, color: '#fde047', max: 8 }); sound('post'); break; }
          this.burst(at, 70, [this.kits[f.team].c1, this.kits[f.team].c2, '#fde047', '#ffffff'], 14, 'confetti');
          this.rings.push({ x: at.x, y: at.y, born: now, life: 900, color: '#fde047', max: 12 });
          this.shake(14, 600); this.flash('#ffffff', 260);
          this.slowUntil = now + 1500; this.slowK = 0.3;
          const p = f.pid ? this.m.players.find(q => q.data.id === f.pid) : null;
          this.banner = { text: 'GOAL!', sub: p ? `${p.data.fn[0]}. ${p.data.ln}` : 'Own goal', color: this.kits[f.team].c1, color2: this.kits[f.team].c2, born: now };
          sound('goal');
          break;
        }
        case 'hit': {
          const big = f.power > 0.6;
          this.burst(at, big ? 26 : 12, ['#fde047', '#ffffff', '#fb923c'], big ? 9 : 6, 'spark');
          this.rings.push({ x: at.x, y: at.y, born: now, life: 380, color: '#ffffff', max: big ? 4.5 : 2.5 });
          if (f.kind !== 'aerial' || big) this.floaters.push({ x: at.x, y: at.y, born: now, text: U.pick(HIT_WORDS), kind: 'impact', size: big ? 1.35 : 1 });
          if (big) { this.shake(10, 350); this.hitStopUntil = now + 110; }
          else this.shake(4, 180);
          this.burst(at, 8, ['#a3e635', '#4d7c0f'], 4, 'dust');
          sound(big ? 'bighit' : 'hit');
          break;
        }
        case 'slide': this.burst(at, 10, ['#a3e635', '#65a30d', '#d9f99d'], 4, 'dust'); sound('slide'); break;
        case 'tackle': this.burst(at, 6, ['#d9f99d', '#84cc16'], 3, 'dust'); sound('tackle'); break;
        case 'whiff': this.floaters.push({ x: at.x, y: at.y, born: now, text: 'WHIFF', kind: 'small' }); break;
        case 'foul': this.floaters.push({ x: at.x, y: at.y, born: now, text: 'FOUL', kind: 'small' }); sound('whistle'); break;
        case 'card': this.floaters.push({ x: at.x, y: at.y, born: now, text: '', kind: 'card', red: f.red }); if (f.red) this.shake(6, 300); break;
        case 'save': this.burst(at, 16, ['#ffffff', '#93c5fd'], 6, 'spark'); this.floaters.push({ x: at.x, y: at.y, born: now, text: 'SAVE!', kind: 'pill', color: col }); sound('save'); if (f.power) this.shake(8, 260); break;
        case 'post': this.burst(at, 20, ['#ffffff', '#e2e8f0', '#fde047'], 8, 'spark'); this.floaters.push({ x: at.x, y: at.y, born: now, text: 'CLANG!', kind: 'impact', size: 1.2 }); this.shake(9, 300); sound('post'); break;
        case 'block': this.burst(at, 10, ['#ffffff'], 5, 'spark'); this.floaters.push({ x: at.x, y: at.y, born: now, text: 'BLOCKED', kind: 'small' }); sound('block'); break;
        case 'special': this.floaters.push({ x: at.x, y: at.y, born: now, text: f.label.toUpperCase(), kind: 'pill', color: col }); sound('special'); break;
        case 'skill': {
          // the move's name pops up, with a swirl of dust where he plants his foot (a dash kicks up a spray)
          this.floaters.push({ x: at.x, y: at.y, born: now, text: f.label.toUpperCase(), kind: 'pill', color: col });
          this.rings.push({ x: at.x, y: at.y, born: now, life: 420, color: col, max: f.kind === 'dash' ? 3.5 : 2.2 });
          this.burst(at, f.kind === 'dash' ? 14 : 8, ['#d9f99d', '#a3e635', '#ffffff'], f.kind === 'dash' ? 6 : 3, 'dust');
          sound('special');
          break;
        }
        case 'stun': this.floaters.push({ x: at.x, y: at.y, born: now, text: U.pick(BEATEN_WORDS), kind: 'small', color: '#38bdf8' }); this.rings.push({ x: at.x, y: at.y, born: now, life: 500, color: '#38bdf8', max: 1.8 }); break;
        case 'read': this.floaters.push({ x: at.x, y: at.y, born: now, text: f.soft ? 'NOT TODAY' : 'READ IT!', kind: 'small', color: '#fca5a5' }); if (!f.soft) sound('tackle'); break;
        case 'flair': this.floaters.push({ x: at.x, y: at.y, born: now, text: f.label.toUpperCase(), kind: 'pill', color: '#f0abfc' }); this.burst(at, 14, FLAIR_COLS, 4, 'spark'); sound('special'); break;
        case 'fire': this.burst(at, 40, ['#fb923c', '#f97316', '#fde047', '#ef4444'], 9, 'flame'); this.floaters.push({ x: at.x, y: at.y, born: now, text: "HE'S ON FIRE!", kind: 'impact', size: 1.3, color: '#fb923c' }); sound('fire'); break;
        case 'shot': if (f.power) { this.shake(5, 200); sound('rocket'); } else sound('kick'); break;
        case 'header': sound('header'); break;
        case 'bounce': if (f.v > 3) this.burst(at, 4, ['#d9f99d'], 2, 'dust'); break;
        case 'injury': this.floaters.push({ x: at.x, y: at.y, born: now, text: '✚ INJURED', kind: 'small', color: '#ef4444' }); break;
        case 'pass': if (f.curve) sound('kick'); else sound('pass'); break;
        case 'whistle': sound('whistle'); break;
        default: break;
      }
    }
    shake(a, ms) { this.shakeAmp = Math.max(this.shakeAmp * (performance.now() < this.shakeUntil ? 1 : 0), a); this.shakeUntil = performance.now() + ms; }
    flash(c, ms) { this.flashColor = c; this.flashUntil = performance.now() + ms; }
    burst(at, n, colors, speed, kind) { for (let i = 0; i < n; i++) this.spawn(at, kind, 0, colors, speed); }
    spawn(at, kind, z = 0, colors, speed = 3) {
      if (this.particles.length > 420) return;
      const an = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random() * 0.9);
      const flame = kind === 'flame';
      this.particles.push({
        x: at.x + (flame ? (Math.random() - 0.5) * 0.6 : 0), y: at.y + (flame ? (Math.random() - 0.5) * 0.6 : 0), z: z + (kind === 'confetti' ? 1 + Math.random() * 3 : 0),
        vx: Math.cos(an) * v * (flame ? 0.2 : 1), vy: Math.sin(an) * v * (flame ? 0.2 : 1), vz: kind === 'confetti' ? 2 + Math.random() * 5 : flame ? 1.5 + Math.random() * 2 : kind === 'spark' ? Math.random() * 3 : 0.6,
        life: 0, max: kind === 'confetti' ? 2.6 : flame ? 0.55 : kind === 'dust' ? 0.6 : kind === 'swish' || kind === 'streak' ? 0.3 : 0.45,
        color: colors ? U.pick(colors) : flame ? U.pick(['#fb923c', '#f97316', '#fde047', '#ef4444']) : '#d9f99d', kind, spin: Math.random() * 6,
      });
    }
    updateParticles(dt) {
      for (const p of this.particles) {
        p.life += dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= Math.exp(-2 * dt); p.vy *= Math.exp(-2 * dt);
        if (p.kind === 'confetti') { p.vz -= 6 * dt; p.z = Math.max(0, p.z + p.vz * dt); p.vx += Math.sin(p.life * 6 + p.spin) * 0.4 * dt * 10; }
        else if (p.kind === 'flame') p.z += p.vz * dt;
        else if (p.kind === 'swish' || p.kind === 'streak') { p.vx *= 0.9; p.vy *= 0.9; }
        else { p.vz -= 9 * dt; p.z = Math.max(0, p.z + p.vz * dt); }
      }
      this.particles = this.particles.filter(p => p.life < p.max);
    }
    drawParticles() {
      const ctx = this.ctx;
      for (const p of this.particles) {
        const sp = this.tx(p), f = 1 - p.life / p.max, y = sp.y - p.z * this.s * 0.55;
        ctx.globalAlpha = Math.max(0, f);
        ctx.fillStyle = p.color;
        const r = Math.max(1, this.s * (p.kind === 'confetti' ? 0.22 : p.kind === 'flame' ? 0.28 * f + 0.05 : p.kind === 'swish' ? 0.3 * f + 0.06 : p.kind === 'streak' ? 0.18 : 0.12));
        if (p.kind === 'swish' || p.kind === 'streak') ctx.globalAlpha = Math.max(0, f) * 0.55;
        if (p.kind === 'confetti') { ctx.save(); ctx.translate(sp.x, y); ctx.rotate(p.life * 8 + p.spin); ctx.fillRect(-r, -r * 0.5, r * 2, r); ctx.restore(); }
        else { ctx.beginPath(); ctx.arc(sp.x, y, r, 0, 7); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
    }
    drawRings(now) {
      const ctx = this.ctx;
      this.rings = this.rings.filter(r => now - r.born < r.life);
      for (const r of this.rings) {
        const f = (now - r.born) / r.life, sp = this.tx(r);
        ctx.strokeStyle = r.color; ctx.globalAlpha = 1 - f; ctx.lineWidth = 3 * (1 - f) + 1;
        ctx.beginPath(); ctx.arc(sp.x, sp.y, r.max * f * this.s, 0, 7); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    drawFloaters(now) {
      const ctx = this.ctx;
      this.floaters = this.floaters.filter(f => now - f.born < 1300);
      for (const f of this.floaters) {
        const t = (now - f.born) / 1300, sp = this.tx(f);
        const y = sp.y - this.s * 1.6 - t * 34;
        const pop = t < 0.12 ? 0.5 + (t / 0.12) * 0.7 : t < 0.2 ? 1.2 - ((t - 0.12) / 0.08) * 0.2 : 1;
        ctx.globalAlpha = t > 0.75 ? (1 - t) / 0.25 : 1;
        ctx.save(); ctx.translate(sp.x, y); ctx.scale(pop, pop);
        if (f.kind === 'impact') {
          ctx.rotate(-0.12);
          ctx.font = `900 ${Math.round(24 * (f.size || 1))}px Oswald, Impact, sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 6; ctx.strokeStyle = '#111827'; ctx.strokeText(f.text, 0, 0);
          ctx.fillStyle = f.color || '#fde047'; ctx.fillText(f.text, 0, 0);
        } else if (f.kind === 'pill') {
          ctx.font = '800 12px Inter, sans-serif';
          const w = ctx.measureText(f.text).width + 18;
          ctx.fillStyle = 'rgba(8,12,22,.85)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-w / 2, -11, w, 22, 11) : ctx.rect(-w / 2, -11, w, 22); ctx.fill();
          ctx.strokeStyle = f.color || '#fde047'; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(f.text, 0, 1);
        } else if (f.kind === 'card') {
          ctx.rotate(0.15); ctx.fillStyle = f.red ? '#ef4444' : '#facc15'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
          ctx.fillRect(-8, -12, 16, 22); ctx.strokeRect(-8, -12, 16, 22);
        } else {
          ctx.font = '800 11px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(f.text, 0, 0);
          ctx.fillStyle = f.color || '#fff'; ctx.fillText(f.text, 0, 0);
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    drawBanner(now) {
      const b = this.banner;
      if (!b) return;
      const t = (now - b.born) / 2200;
      if (t > 1) { this.banner = null; return; }
      const ctx = this.ctx, cx = this.w / 2, cy = this.h * 0.42;
      const inT = Math.min(1, t / 0.12), outT = t > 0.8 ? (t - 0.8) / 0.2 : 0;
      ctx.save();
      ctx.globalAlpha = 1 - outT;
      // a slanted ribbon in club colours
      ctx.translate(cx, cy); ctx.rotate(-0.06);
      const w = this.w * 1.2 * inT;
      ctx.fillStyle = b.color; ctx.fillRect(-w / 2, -42, w, 84);
      ctx.fillStyle = b.color2; ctx.fillRect(-w / 2, 34, w, 8); ctx.fillRect(-w / 2, -42, w, 6);
      const sc = 1 + Math.max(0, 0.4 - t * 3);
      ctx.scale(sc, sc);
      ctx.font = '900 64px Oswald, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 10; ctx.strokeStyle = '#0b0f17'; ctx.strokeText(b.text, 0, -6);
      ctx.fillStyle = '#ffffff'; ctx.fillText(b.text, 0, -6);
      ctx.font = '700 15px Inter, sans-serif'; ctx.fillStyle = U.onColor(b.color); ctx.fillText(b.sub.toUpperCase(), 0, 26);
      ctx.restore();
    }

    // ── light & weather ──
    drawLight() {
      const ctx = this.ctx, g = this.gloom;
      if (g <= 0.02) return;
      // the stands fall into darkness, the pitch stays lit
      const a = this.tx({ x: 0, y: 0 }), b = this.tx({ x: this.cfg.L, y: this.cfg.W });
      const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y), x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
      ctx.fillStyle = `rgba(2,6,20,${g * 1.25})`;
      ctx.beginPath(); ctx.rect(0, 0, this.w, this.h); ctx.rect(x1, y0, x0 - x1, y1 - y0); ctx.fill('evenodd');
      ctx.fillStyle = `rgba(2,6,20,${g * 0.35})`; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      if (this.night) {
        ctx.globalCompositeOperation = 'lighter';
        for (const c of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
          const r = Math.max(this.w, this.h) * 0.22;
          const gr = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], r);
          gr.addColorStop(0, 'rgba(255,250,220,.22)'); gr.addColorStop(1, 'rgba(255,250,220,0)');
          ctx.fillStyle = gr; ctx.fillRect(c[0] - r, c[1] - r, r * 2, r * 2);
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    drawWeather(dt, now) {
      const wx = this.m.weather, ctx = this.ctx;
      const wind = this.m.wind || { x: 0, y: 0 };
      const ws = this.vertical ? { x: wind.y, y: -wind.x } : wind;
      if (wx.rain) {
        const n = Math.round(160 * wx.rain);
        while (this.drops.length < n) this.drops.push({ x: Math.random() * this.w, y: Math.random() * this.h, v: 600 + Math.random() * 400 });
        ctx.strokeStyle = 'rgba(200,220,255,.35)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (const d of this.drops) {
          d.y += d.v * dt; d.x += (ws.x * 30 - 60) * dt;
          if (d.y > this.h) { d.y = -10; d.x = Math.random() * this.w; }
          if (d.x < 0) d.x += this.w;
          ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 4 + ws.x * 2, d.y - 14);
        }
        ctx.stroke();
      }
      if (wx.snow) {
        while (this.drops.length < 140) this.drops.push({ x: Math.random() * this.w, y: Math.random() * this.h, v: 30 + Math.random() * 50, r: 1 + Math.random() * 2.2, ph: Math.random() * 6 });
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        for (const d of this.drops) {
          d.y += d.v * dt; d.x += (Math.sin(now / 700 + d.ph) * 20 + ws.x * 15) * dt;
          if (d.y > this.h) { d.y = -5; d.x = Math.random() * this.w; }
          ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill();
        }
      }
      if (wx.fog) {
        const g = ctx.createLinearGradient(0, 0, 0, this.h);
        g.addColorStop(0, `rgba(200,210,220,${wx.fog * 0.55})`); g.addColorStop(0.5, `rgba(200,210,220,${wx.fog * 0.25})`); g.addColorStop(1, `rgba(200,210,220,${wx.fog * 0.5})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, this.w, this.h);
      }
      if (wx.heat) { ctx.fillStyle = `rgba(255,170,60,${0.06 + 0.03 * Math.sin(now / 400)})`; ctx.fillRect(0, 0, this.w, this.h); }
      if (wx.lightning) {
        if (now > this.nextBolt) { this.lightning = now; this.nextBolt = now + 5000 + Math.random() * 9000; this.onSound && this.onSound('thunder'); }
        const t = now - this.lightning;
        if (t < 350) { ctx.fillStyle = `rgba(230,235,255,${(t < 80 ? 0.6 : t < 160 ? 0.15 : t < 230 ? 0.45 : 0.1) * (1 - t / 350)})`; ctx.fillRect(0, 0, this.w, this.h); }
      }
    }
  }

  return { Pitch, PITCH_STYLES };
})();
