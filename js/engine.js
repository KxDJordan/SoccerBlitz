'use strict';
// ── MATCH ENGINE ──────────────────────────────────────────────────
// A real-time, deterministic (seeded) simulation. Every player thinks for himself each tick: where his
// formation and role want him, who to mark, whether to press, run, pass, cross, dribble or shoot — scored as
// utility (chance it works × what it's worth). Attributes, roles, the in/out-of-possession shapes and team
// instructions all feed those numbers, so the tactics screen is the match.
// On top of that sits the Blitz layer: hits that send players flying, slide tackles, keeper dives, curled
// passes and shots, a real 3D ball, thunderbolts, woodwork, and players who catch fire.

const Engine = (() => {
  const TICK = 0.05;
  const GROUND_K = 0.9, AIR_K = 0.12, SHOT_K = 0.3, LOFT_ARRIVE = 16, LANDING_DAMP = 0.35, GRAV = 9.8;
  const CONTROL_RADIUS = 1.2;
  const CURL_ANGLE = 0.35;
  const TRANSITION_SECONDS = 5, TRANSITION_SURGE = 7;
  const KEEPER_HOLD_MIN = 1.2, KEEPER_HOLD_MAX = 4;
  const FIRE_SECS = 150;
  const RESTART_TIME = { kickoff: 1.5, throwin: 1.2, goalkick: 1.6, corner: 1.8, freekick: 1.8, penalty: 2.2 };
  const SUPPORT = [[0, 0], [6, 0], [-6, 0], [0, 6], [0, -6], [4, 4], [4, -4], [-4, 4], [-4, -4]];
  const AK = DATA.AK;
  const { add, sub, scale, dot, len, dist, norm, rot } = V;
  const vec = V.v;
  const clamp = U.clamp;

  function pitch(five) {
    const L = five ? 60 : 105, W = five ? 38 : 68, GW = five ? 5 : 7.32;
    return {
      L, W, GW, GY0: (W - GW) / 2, GY1: (W + GW) / 2, GH: five ? 2 : 2.44,
      BOX_D: five ? 9 : 16.5, BOX_W: five ? 22 : 40.32, SIX_D: five ? 3 : 5.5, SIX_W: five ? 10 : 18.32,
      PEN: five ? 7 : 11, CIRCLE: five ? 4.5 : 9.15, k: L / 105,
    };
  }
  const kickSpeed = (d, lofted, groundK = GROUND_K, arrive = 0) => (lofted ? Math.min(32, AIR_K * d + LOFT_ARRIVE) : Math.min(28 + arrive, groundK * d + 6 + arrive));
  // seconds a ball takes to travel d with exponential drag k from speed v0
  const travelTime = (d, v0, k) => (k * d >= v0 - 0.01 ? 3 : -Math.log(1 - (k * d) / v0) / k);

  class Match {
    constructor(home, away, opts = {}) {
      this.opts = opts;
      this.five = !!opts.five;
      this.cfg = pitch(this.five);
      this.halfSecs = opts.halfSecs || (this.five ? 150 : 420);
      this.halfMins = opts.halfMins || (this.five ? 20 : 45);
      this.knockout = !!opts.knockout;
      this.weather = opts.weather || DATA.WEATHER.clear;
      this.wind = opts.wind || { x: 0, y: 0 };
      this.groundK = GROUND_K * this.weather.groundK;
      this.rng = new Rng(opts.seed || 1);
      this.teams = [home, away];
      this.players = [];
      this.onPitch = [];
      this.time = 0;
      this.half = 1;
      this.score = [0, 0];
      this.pens = null;
      this.phase = 'restart';
      this.restart = null;
      this.stats = [this.emptyStats(), this.emptyStats()];
      this.events = [];
      this.fx = [];
      this.fxTotal = 0;
      this.possession = 0;
      this.subsUsed = [0, 0];
      this.maxSubs = this.five ? 9 : 5;
      this.momentum = 0;
      this.momSeries = [];
      this.lastSubAt = [-99, -99];
      this.lostBallAt = [-99, -99];
      this.regainAt = [-99, -99];
      this.possStart = [0, 0];
      this.chasers = [-1, -1];
      this.chasePoint = [vec(), vec()];
      this.pressers = new Set();
      this.oppLine = [1, 1];
      this.blocker = -1;
      this.blockPoint = vec();
      this.boxRuns = new Map();
      this.marks = new Map();
      this.interceptors = new Map();
      this.reset = null;
      this.wall = null;
      this.goalsBy = new Map();
      const c = this.cfg, center = vec(c.L / 2, c.W / 2);
      this.ball = {
        pos: { ...center }, prevPos: { ...center }, vel: vec(), z: 0, vz: 0, prevZ: 0, spin: 0,
        owner: null, lastTeam: 0, receiver: null, passer: null, noTouchTimer: 0, fumbler: null,
        lofted: false, loftFrom: vec(), loftDist: 0, cross: false, crossQuality: 0, threaded: false,
        curl: 0, curlTarget: vec(), shot: null, power: 0,
      };
      for (const t of [0, 1]) {
        const tac = this.teams[t].tac;
        tac.lineup.forEach((pid, slot) => { if (pid != null) this.players.push(this.makeSim(t, slot, this.findPlayer(t, pid))); });
      }
      this.refreshOnPitch();
      this.setRestart('kickoff', 0, center);
      this.emit('kickoff', 0, 'Kick-off!');
    }

    emptyStats() {
      return { poss: 0, passes: 0, passesOk: 0, shots: 0, onTarget: 0, xg: 0, corners: 0, fouls: 0, yellows: 0, reds: 0, tackles: 0, tacklesWon: 0, interceptions: 0, saves: 0, blocks: 0, crosses: 0, hits: 0, woodwork: 0, offsides: 0, takeOns: 0, throwIns: 0, goalKicks: 0 };
    }
    emptyPS() {
      return { goals: 0, assists: 0, shots: 0, onTarget: 0, passes: 0, passesOk: 0, keyPasses: 0, tackles: 0, tacklesWon: 0, interceptions: 0, blocks: 0, saves: 0, aerials: 0, fouls: 0, yellow: 0, red: 0, hits: 0, dribbles: 0, takeOns: 0, offsides: 0, conceded: 0 };
    }

    // ── public API ──
    get minute() { return Math.min(this.half * this.halfMins, Math.floor((this.time / this.halfSecs) * this.halfMins) + 1); }
    tac(t) { return this.teams[t].tac; }
    isFinished() { return this.phase === 'fulltime'; }
    runToBreak() { let n = 0; while (this.phase !== 'halftime' && this.phase !== 'fulltime' && n++ < 40000) this.step(); }
    simulateFull() {
      this.runToBreak();
      if (this.phase === 'halftime') { this.startSecondHalf(); this.runToBreak(); }
    }
    startSecondHalf() {
      if (this.phase !== 'halftime') return;
      for (const t of [0, 1]) if (this.teams[t].ai) this.aiHalftime(t);
      for (const p of this.onPitch) p.stamina = Math.min(1, p.stamina + 0.06);
      this.half = 2;
      this.time = this.halfSecs;
      this.setRestart('kickoff', 1, vec(this.cfg.L / 2, this.cfg.W / 2));
    }
    minutesPlayed(p) { const end = p.offAt ?? this.time; return Math.round(((end - p.onAt) / this.halfSecs) * this.halfMins); }

    step() {
      if (this.phase === 'halftime' || this.phase === 'fulltime') return;
      for (const p of this.onPitch) { p.prevPos = { ...p.pos }; p.prevAng = p.ang; }
      this.ball.prevPos = { ...this.ball.pos };
      this.ball.prevZ = this.ball.z;
      if (this.phase === 'restart') this.stepRestart();
      else this.stepPlay();
      this.stepBallZ();
      this.time += TICK;
      // once a sim second: momentum, AI substitutions
      if (Math.floor(this.time) !== Math.floor(this.time - TICK)) this.secondTick();
      const end = this.half * this.halfSecs;
      if (this.time >= end && !this.ball.shot && (!this.restart || this.restart.type !== 'penalty')) this.endHalf();
    }

    // ── setup ──
    findPlayer(t, id) {
      const p = this.teams[t].squad.find(q => q.id === id);
      if (!p) throw new Error(`Player ${id} not in squad of ${this.teams[t].name}`);
      return p;
    }
    makeSim(team, slot, data) {
      const tac = this.teams[team].tac;
      const fo = TAC.formation(tac.oop);
      const start = this.fromUV(team, 0.3, fo.slots[slot].v);
      const ipPos = TAC.formation(tac.ip).slots[tac.map[slot]].pos;
      const side = this.teams[team];
      const stam = data.fit != null ? data.fit / 100 : 1;
      const pers = data.pers || 'steady';
      return {
        id: this.players.length, team, slot, data, pers,
        rIP: TAC.ROLES[tac.rIP[slot]] || TAC.ROLES[TAC.defaultRole(ipPos)],
        rOOP: TAC.ROLES[tac.rOOP[slot]] || TAC.ROLES[TAC.defaultRole(fo.slots[slot].pos)],
        instr: tac.instr[slot] || TAC.defaultInstr(),
        fam: (TAC.fam(data, fo.slots[slot].pos) * 0.82 + TAC.fam(data, ipPos) * 0.18),
        boost: side.boost || 1,
        isGK: slot === 0, active: true, sentOff: false,
        pos: { ...start }, prevPos: { ...start }, vel: vec(), target: { ...start }, ang: team === 0 ? 0 : Math.PI, prevAng: 0,
        urgency: 0.5, action: 'position', stamina: clamp(stam, 0.4, 1),
        decisionCd: 0, tackleCd: 0, runTimer: 0, runTarget: null, supportTarget: null, supportTimer: 0, dribbleTarget: null,
        mustPass: false, yellows: 0, receivedFrom: null, receivedAt: -99, gotBallAt: 0,
        burstUntil: -99, cutUntil: -99, fire: -99,
        down: 0, z: 0, vz: 0, spin: 0, spinAng: 0, slide: 0, dive: 0, diveDir: 0, bumpCd: 0, celebrate: 0, stride: 0,
        injured: 0, onAt: this.time, offAt: null, ps: this.emptyPS(),
      };
    }
    refreshOnPitch() { this.onPitch = this.players.filter(p => p.active); }
    emit(type, team, text, extra) { this.events.push({ min: this.minute, half: this.half, t: this.time, type, team, text, ...(extra || {}) }); }
    effect(type, at, team, extra = {}) {
      this.fx.push({ type, time: this.time, x: at.x, y: at.y, team, ...extra });
      this.fxTotal++;
      if (this.fx.length > 200) this.fx.splice(0, this.fx.length - 200);
    }

    // ── geometry ──
    toU(t, x) { return t === 0 ? x / this.cfg.L : 1 - x / this.cfg.L; }
    toV(t, y) { return t === 0 ? y / this.cfg.W : 1 - y / this.cfg.W; }
    fromUV(t, u, v) { const c = this.cfg; return t === 0 ? { x: u * c.L, y: v * c.W } : { x: (1 - u) * c.L, y: (1 - v) * c.W }; }
    attackGoal(t) { return t === 0 ? vec(this.cfg.L, this.cfg.W / 2) : vec(0, this.cfg.W / 2); }
    ownGoal(t) { return this.attackGoal(1 - t); }
    keeper(t) { return this.onPitch.find(p => p.team === t && p.isGK); }
    teamOn(t) { return this.onPitch.filter(p => p.team === t); }
    inAttackingBox(att, pos) { const c = this.cfg; return this.toU(att, pos.x) * c.L > c.L - c.BOX_D && Math.abs(pos.y - c.W / 2) < c.BOX_W / 2; }
    // a pass target: on the pitch, and never into the opposition goalmouth (where an untouched ball rolls in)
    aimClamp(t, v) {
      const c = this.cfg, a = this.clampPitch(v), lim = 3.5 * c.k + 1;
      if (Math.abs(a.y - c.W / 2) < c.GW / 2 + 3) { if (t === 0) a.x = Math.min(a.x, c.L - lim); else a.x = Math.max(a.x, lim); }
      return a;
    }
    clampPitch(v) { const c = this.cfg; return { x: clamp(v.x, 0.5, c.L - 0.5), y: clamp(v.y, 0.5, c.W - 0.5) }; }
    segDist(p, a, b) {
      const ab = sub(b, a), l2 = dot(ab, ab);
      const t = l2 < 1e-9 ? 0 : clamp(dot(sub(p, a), ab) / l2, 0, 1);
      return { d: dist(p, add(a, scale(ab, t))), t };
    }
    nearestDist(pt, players) { let m = Infinity; for (const o of players) m = Math.min(m, dist(o.pos, pt)); return m; }
    pressureOn(p) {
      let s = 0;
      for (const o of this.onPitch) {
        if (o.team === p.team || o.down > 0) continue;
        const d = dist(o.pos, p.pos);
        if (d < 4) s += 1 - d / 4;
      }
      return Math.min(1.5, s);
    }

    // ── attributes ──
    attr(p, k) {
      const i = AK[k];
      const fire = this.time < p.fire ? 1.1 : 1;
      const late = p.pers === 'clutch' && (this.time > this.halfSecs * 1.65 || this.opts.cup) ? 1.06 : 1;
      return p.data.a[i] * (DATA.PHYSICAL.has(i) ? 1 : p.fam * p.boost * fire * late) * (0.8 + 0.2 * p.stamina);
    }
    raw(p, k) { return p.data.a[AK[k]]; }
    // hallmarks: 0 none, 1 has it, 2 elite
    hm(p, id) { const h = p.data.hm; return (h && h[id]) || 0; }
    maxSpeed(p) {
      const burst = this.time < p.burstUntil ? 1.15 : 1, fire = this.time < p.fire ? 1.06 : 1;
      return (5.2 + (3.3 * this.raw(p, 'pace')) / 99) * (0.68 + 0.32 * p.stamina) * this.weather.footing * burst * fire * (1 + 0.035 * this.hm(p, 'afterburner'));
    }
    accel(p) { return (5 + (6 * this.raw(p, 'accel')) / 99) * this.weather.footing * (this.time < p.burstUntil ? 1.3 : 1) * (1 + 0.1 * this.hm(p, 'jetstart')); }
    aerialScore(p) { const w = this.possession === p.team ? p.rIP.w.aerial : p.rOOP.w.aerial; return 0.6 * this.attr(p, 'heading') + 0.4 * this.attr(p, 'strength') + 15 * (w - 1) + 6 * this.hm(p, 'tower'); }
    flair(p) { return (p.pers === 'flair' ? 1.6 : 1) * (this.teams[p.team].blitz ? 1.3 : 1); }

    angleXg(t, pos) {
      const c = this.cfg, gx = t === 0 ? c.L : 0;
      const dx = Math.max(0.5, Math.abs(gx - pos.x));
      const angle = Math.abs(Math.atan2(c.GY1 - pos.y, dx) - Math.atan2(c.GY0 - pos.y, dx));
      return Math.min(0.7, 0.75 * angle * angle * (this.five ? 0.75 : 1));
    }
    // one xG for both the decision and the outcome: angle/distance, pressure, bodies in the way, headers
    shotXg(p, pressure, header, crowd = 0) {
      // angleXg is a threat measure; ×0.8 puts shots near real-world xG (pen spot ~0.25, 20 m ~0.08)
      let xg = this.angleXg(p.team, p.pos) * 0.8;
      xg *= 1 - 0.5 * Math.min(1, pressure) * (1.2 - (0.6 * this.attr(p, 'composure')) / 99) * (1 - 0.35 * this.hm(p, 'icevein'));
      xg *= Math.pow(0.85, crowd);
      if (header) xg *= 0.6 * (1 + 0.08 * this.hm(p, 'powerhead'));
      return clamp(xg, 0.005, 0.8);
    }
    // ~1 for an average (70) finisher, ~1.25 for an elite one
    finishMult(p, header) { return 0.3 + this.attr(p, header ? 'heading' : 'finishing') / 100 + (header ? 0.04 * this.hm(p, 'powerhead') : 0); }
    // ~1 against an average (70) keeper; elite keepers shave ~20% off, poor ones concede ~20% more
    keeperMult(kp, close = false) {
      if (!kp || kp.down > 0.5) return 1.6;
      const q = 0.7 * this.attr(kp, 'goalkeeping') + 0.15 * this.attr(kp, 'positioning') + 0.15 * this.attr(kp, 'composure') + (close ? 6 * this.hm(kp, 'reflexes') : 0);
      return 1.5 - q / 140;
    }
    blockers(p) {
      const g = this.attackGoal(p.team);
      let n = 0;
      for (const o of this.onPitch) {
        if (o.team === p.team || o.isGK || o.down > 0) continue;
        const { d, t } = this.segDist(o.pos, p.pos, g);
        if (t > 0.03 && t < 0.95 && d < 1.3) n++;
      }
      return n;
    }
    // defenders in the cone between the shooter and the goal
    congestion(p) {
      const c = this.cfg, gx = p.team === 0 ? c.L : 0;
      let n = 0;
      for (const o of this.onPitch) {
        if (o.team === p.team || o.isGK || o.down > 0) continue;
        const { d, t } = this.segDist(o.pos, p.pos, { x: gx, y: c.W / 2 });
        if (t > 0.08 && t < 0.97 && d < 1 + t * c.GW * 0.45) n++;
      }
      return Math.min(4, n);
    }
    // ── offside ──
    // the second-last defender (keeper counts), in team t's attacking u
    offsideLineU(t) {
      let a = -1, b2 = -1;
      for (const o of this.onPitch) {
        if (o.team === t) continue;
        const u = this.toU(t, o.pos.x);
        if (u > a) { b2 = a; a = u; } else if (u > b2) b2 = u;
      }
      return b2 < 0 ? 1 : b2;
    }
    // is team-mate m in an offside position for a ball played from ballX? (0.3 m benefit of the doubt)
    offsidePos(m, ballX, lineU) {
      if (this.five) return false; // academy 5-a-side plays without offside
      const t = m.team, u = this.toU(t, m.pos.x), tol = 0.3 / this.cfg.L;
      return !m.isGK && u > 0.5 && u > this.toU(t, ballX) + tol && u > lineU + tol;
    }
    // how the passer reads it: clearly-off runners are seen, the tight calls are often missed
    offsideSeen(m, ballX, lineU, vision) {
      if (!this.offsidePos(m, ballX, lineU)) return false;
      const t = m.team, margin = (this.toU(t, m.pos.x) - Math.max(lineU, this.toU(t, ballX))) * this.cfg.L;
      return margin > this.rng.range(0, 3.5 * (1.2 - vision));
    }
    // freeze who was offside the moment the ball was played forward by p's side
    markOffside(p) {
      const b = this.ball;
      if (this.freeRestart === p.id) { this.freeRestart = null; b.offside = null; return; }
      this.freeRestart = null;
      const line = this.offsideLineU(p.team), ids = [];
      for (const m of this.onPitch) if (m.team === p.team && m.id !== p.id && m.down <= 0.5 && this.offsidePos(m, p.pos.x, line)) ids.push(m.id);
      b.offside = ids.length ? { team: p.team, ids } : null;
    }
    // p is about to play the ball: whistle if he was offside when it was played; any touch ends the phase
    offsideCheck(p) {
      const b = this.ball, off = b.offside;
      if (!off) return false;
      b.offside = null;
      if (p.team !== off.team || !off.ids.includes(p.id)) return false;
      this.stats[p.team].offsides++;
      p.ps.offsides++;
      this.emit('offside', p.team, `Offside! ${p.data.ln} is flagged`, { pid: p.data.id });
      this.effect('special', p.pos, p.team, { label: 'Offside', pid: p.data.id });
      this.setRestart('freekick', 1 - p.team, this.clampPitch(p.pos));
      return true;
    }
    threat(t, pos) { const u = this.toU(t, pos.x); return 0.15 + 0.6 * u * u + 3 * this.angleXg(t, pos); }
    inTransition(t) { return this.time - this.regainAt[t] < TRANSITION_SECONDS; }

    // ── shape: where a player wants to stand ──
    slotFor(p, inPoss) {
      const tac = this.tac(p.team);
      return inPoss ? TAC.formation(tac.ip).slots[tac.map[p.slot]] : TAC.formation(tac.oop).slots[p.slot];
    }
    formationTarget(p, ball, inPoss, oppLineU) {
      const ti = this.tac(p.team).team, slot = this.slotFor(p, inPoss), role = inPoss ? p.rIP : p.rOOP;
      const bu = this.toU(p.team, ball.x), bv = this.toV(p.team, ball.y);
      let line, depth, widthF, shiftV;
      if (inPoss) {
        line = 0.27 + 0.04 * ti.mentality + 0.04 * ti.lineHeight + (bu - 0.5) * 0.4;
        depth = 0.4 + 0.03 * ti.mentality;
        widthF = 0.95 + 0.1 * ti.width;
        shiftV = 0.12;
      } else {
        line = 0.22 + 0.045 * ti.lineHeight + 0.03 * ti.pressing + 0.02 * ti.mentality + (bu - 0.5) * 0.32;
        // with the ball in their final third the defence drops into the box, deeper still against a wide ball (crosses)
        if (bu < 0.36) line -= (0.36 - bu) * 0.3 + (Math.abs(bv - 0.5) > 0.28 ? 0.02 : 0);
        depth = 0.37 + 0.02 * ti.lineHeight + 0.015 * ti.mentality;
        // a compact block: narrower than the shape on paper and sliding hard toward the ball
        widthF = 0.71 + 0.05 * ti.width;
        shiftV = 0.45;
      }
      line = clamp(line + this.lineStep(p.team), 0.06, 0.56);
      // the role decides the movement; the focus (Defend / Balanced / Attack) stretches or tempers it
      const off = inPoss ? role.attack : role.defend, f = p.instr.runs || 0;
      let du = inPoss ? TAC.focusDu(off.du, f) : (off.du > 0 ? off.du * 0.65 : off.du) + 0.03 * f;
      if (inPoss && role.stDrop && slot.pos === 'ST') du += role.stDrop;
      const dv = inPoss ? off.dv * (1 + 0.3 * f) : off.dv;
      // out of possession the front of the block tucks in behind the ball, so the team stays ~40m long
      const su = !inPoss && slot.u > 0.45 ? 0.45 + (slot.u - 0.45) * 0.38 : slot.u;
      let u = line + su * depth + du;
      // and the back line closes the gaps between its defenders a little more than the rest
      if (!inPoss && slot.u < 0.1) widthF *= 0.9;
      let v;
      const wideSlot = slot.pos === 'LW' || slot.pos === 'RW' || slot.pos === 'LM' || slot.pos === 'RM';
      if (inPoss && wideSlot && off.dv <= 0.08) {
        // a wide role holds the touchline with the ball, ready for the switch (inverted roles come inside instead)
        const edge = clamp(0.06 - 0.015 * ti.width + Math.min(0, dv) * 0.4, 0.035, 0.1);
        v = slot.v < 0.5 ? edge : 1 - edge;
      } else {
        // with the ball only the ball-side half (and the spine) slides over; the far side holds its width
        const nearHalf = Math.abs(slot.v - 0.5) < 0.05 || (bv - 0.5) * (slot.v - 0.5) > 0;
        const shift = inPoss && !nearHalf ? shiftV * 0.3 : shiftV;
        v = 0.5 + (slot.v - 0.5) * widthF + TAC.lateral(slot, p.slot, dv) + (bv - 0.5) * shift;
      }
      // a poacher lives in the box once the ball is in the final half
      if (inPoss && role.boxStay && bu > 0.5) u = Math.max(u, 0.8 + 0.08 * (bu - 0.5));
      // the front line pins the defence: once the ball is over halfway, forwards (bar the ones who drop off) play on
      // the last defender's shoulder rather than hanging off it
      if (inPoss && oppLineU !== undefined && (slot.u >= 0.85 || (slot.u >= 0.65 && role.w.run >= 1.4)) && !role.stDrop && off.du > -0.05 && bu > 0.42) u = Math.max(u, oppLineU - (bu > 0.6 ? 0.012 : 0.025));
      // hold an onside position: never beyond the last defender unless the ball is further on
      if (oppLineU !== undefined) u = Math.min(u, Math.max(oppLineU - 0.005, inPoss ? bu - 0.01 : 0));
      return this.fromUV(p.team, clamp(u, 0.03, 0.96), clamp(v, 0.03, 0.97));
    }
    // the back line steps up together for a moment when the opposition plays it backward or square, or after a clearance
    lineStep(t) { return this.stepUntil && this.time < this.stepUntil[t] ? 0.04 : 0; }
    keeperTarget(p, ball) {
      const c = this.cfg, sweeper = !!p.rOOP.sweeper || this.hm(p, 'sweepgk') === 2, lh = this.tac(p.team).team.lineHeight;
      const bu = this.toU(p.team, ball.x), bv = this.toV(p.team, ball.y);
      const crude = 0.012 + 0.012 * bu;
      if (sweeper) {
        // a sweeper keeper tracks the defensive line, high enough to sweep up balls played in behind it
        const u = clamp(0.06 + 0.15 * (bu - 0.4) + 0.012 * lh + 0.5 * this.lineStep(p.team), crude, 0.2);
        return this.fromUV(p.team, u, 0.5 + (bv - 0.5) * (u > 0.08 ? 0.3 : 0.18));
      }
      // a keeper stands on the line from the middle of the goal to the ball, a step or two off the line, coming out
      // further to narrow the angle when the ball is near; positioning decides how close to that ideal they get
      const q = clamp(this.attr(p, 'positioning') / 99, 0, 1);
      const naive = this.fromUV(p.team, crude, 0.5 + (bv - 0.5) * 0.18);
      const g = this.ownGoal(p.team), to = sub(ball, g), dBall = len(to);
      if (dBall < 0.5) return naive;
      const near = clamp(1 - (dBall - 11 * c.k) / (25 * c.k), 0, 1);
      const depth = crude * c.L * (0.85 + 0.3 * q) + near * q * 1.4 * c.k;
      const dir = scale(to, 1 / dBall);
      const ideal = { x: g.x + Math.sign(dir.x || (p.team === 0 ? 1 : -1)) * Math.max(0.5, Math.abs(dir.x) * depth), y: clamp(g.y + dir.y * depth, c.GY0 + 0.3, c.GY1 - 0.3) };
      const w = 0.3 + 0.7 * q;
      return { x: naive.x + (ideal.x - naive.x) * w, y: naive.y + (ideal.y - naive.y) * w };
    }

    // ── main loop ──
    stepPlay() {
      const b = this.ball;
      if (b.owner !== null) this.possession = this.players[b.owner].team;
      this.updateKeeperReset();
      this.stats[this.possession].poss++;
      this.computeOppLines();
      this.computeChasers();
      this.computePressers();
      this.computeBlocker();
      this.computeBoxRuns();
      this.computeMarks();
      for (const p of this.onPitch) {
        this.think(p);
        this.transitionEffort(p);
        if (this.phase !== 'play') return;
      }
      for (const p of this.onPitch) this.move(p);
      this.collide();
      this.updateBall();
      if (this.phase === 'play' && b.owner !== null) this.resolveChallenges();
    }

    secondTick() {
      // momentum: who is threatening, smoothed
      const b = this.ball;
      const holder = b.owner !== null ? this.players[b.owner].team : b.lastTeam;
      const th = this.threat(holder, b.pos) - 0.3;
      this.momentum = clamp(this.momentum * 0.94 + (holder === 0 ? 1 : -1) * th * 0.12, -1, 1);
      if (this.phase !== 'restart' || this.restart?.type !== 'kickoff') this.momSeries.push(+this.momentum.toFixed(2));
      // substitutions for AI-run sides (and the user's, if auto-subs are on)
      for (const t of [0, 1]) if (this.teams[t].ai || this.teams[t].autoSub) this.aiSubs(t);
    }

    startKeeperReset(kp) {
      this.reset = { keeper: kp.id, team: kp.team, since: this.time };
      kp.decisionCd = KEEPER_HOLD_MAX;
      kp.mustPass = true;
      kp.action = 'hold';
      for (const q of this.onPitch) { q.runTarget = null; q.supportTarget = null; }
    }
    updateKeeperReset() {
      const r = this.reset;
      if (!r) return;
      const kp = this.players[r.keeper];
      if (this.ball.owner !== r.keeper || this.phase !== 'play') { this.reset = null; return; }
      const held = this.time - r.since;
      const clear = this.onPitch.every(o => o.team === r.team || o.isGK || dist(o.pos, kp.pos) > 22 * this.cfg.k);
      if (held > KEEPER_HOLD_MAX || (held > KEEPER_HOLD_MIN && clear)) {
        this.reset = null;
        kp.decisionCd = Math.min(kp.decisionCd, 0.2);
        kp.gotBallAt = this.time;
      }
    }
    thinkReset(p, r) {
      const attacking = p.team === r.team;
      const ball = attacking ? this.fromUV(r.team, 0.22, 0.5) : vec(this.cfg.L / 2, this.cfg.W / 2);
      p.target = this.formationTarget(p, ball, attacking, this.oppLine[p.team]);
      p.urgency = dist(p.pos, p.target) > 8 ? 0.85 : 0.6;
      p.action = 'position';
    }
    computeOppLines() {
      for (const t of [0, 1]) {
        let m = 0.5;
        for (const o of this.onPitch) if (o.team !== t && !o.isGK) m = Math.max(m, this.toU(t, o.pos.x));
        // no offside in the academy 5-a-side: only a loose "don't camp on the keeper" limit applies
        this.oppLine[t] = this.five ? Math.max(m, 0.9) : m;
      }
      // step-up triggers: the opposition plays it backward or square away from our box, or we clear our lines
      if (!this.stepUntil) this.stepUntil = [-99, -99];
      const b = this.ball, sp = len(b.vel);
      if (b.owner === null && !b.shot && sp > 6) {
        const kt = b.lastTeam, def = 1 - kt, fwd = (kt === 0 ? b.vel.x : -b.vel.x) / sp;
        const defU = this.toU(def, b.pos.x);
        if (defU > 0.3 && (fwd < -0.2 || (Math.abs(fwd) < 0.3 && defU > 0.4))) this.stepUntil[def] = this.time + 1.5;
        if (fwd > 0.5 && sp > 12 && b.lofted && b.receiver === null && this.toU(kt, b.loftFrom.x) < 0.35) this.stepUntil[kt] = this.time + 1.8;
      }
    }

    // ball position after t seconds of free travel, and whether it's low enough to play there
    ballAt(t) {
      const b = this.ball;
      const travel = (v0, k, tt) => (v0 * (1 - Math.exp(-k * tt))) / k;
      const speed = len(b.vel);
      const curling = b.curl !== 0 && b.receiver !== null && !b.shot;
      const dir = curling ? norm(sub(b.curlTarget, b.pos)) : speed > 1e-6 ? scale(b.vel, 1 / speed) : vec();
      if (!b.lofted || b.shot) {
        const k = b.shot ? SHOT_K : this.groundK;
        return { pos: add(b.pos, scale(dir, travel(speed, k, t))), playable: true };
      }
      const done = dist(b.pos, b.loftFrom), airLeft = Math.max(0, b.loftDist - done);
      const x = AIR_K * airLeft < speed ? -Math.log(1 - (AIR_K * airLeft) / speed) / AIR_K : Infinity;
      if (t <= x) {
        const d = travel(speed, AIR_K, t);
        return { pos: add(b.pos, scale(dir, d)), playable: (done + d) / b.loftDist >= 0.82 };
      }
      const landSpeed = speed * Math.exp(-AIR_K * x) * LANDING_DAMP;
      return { pos: add(b.pos, scale(dir, airLeft + travel(landSpeed, this.groundK, t - x))), playable: true };
    }

    computeChasers() {
      const b = this.ball;
      this.chasers = [-1, -1];
      this.interceptors.clear();
      if (b.owner !== null || b.shot) return;
      const path = [];
      for (let i = 1; i <= 30; i++) path.push(this.ballAt(i * 0.1));
      const reach = new Map();
      for (const p of this.onPitch) {
        if (p.down > 0) { reach.set(p.id, { tt: 99, pt: path[29].pos }); continue; }
        const vmax = this.maxSpeed(p);
        const markerRead = b.receiver !== null && this.marks.get(p.id) === b.receiver ? (0.8 * this.attr(p, 'marking')) / 99 : 0;
        const lateRead = b.threaded && b.receiver !== null && b.passer !== null && this.players[b.passer].team !== p.team ? 0.4 : 1;
        const read = (0.1 + (2.6 * this.attr(p, 'positioning')) / 99 + markerRead) * lateRead;
        let tt = 99, pt = path[29].pos;
        for (let i = 0; i < 30; i++) {
          const s = (i + 1) * 0.1;
          if (path[i].playable && dist(p.pos, path[i].pos) <= vmax * s * 0.9 + read) { tt = s; pt = path[i].pos; break; }
        }
        reach.set(p.id, { tt, pt });
      }
      if (b.receiver !== null && !this.players[b.receiver].active) b.receiver = null;
      const recv = b.receiver !== null ? this.players[b.receiver] : null;
      // earliest an opponent of each side gets there (a sweeper keeper only leaves the box to win a race)
      const firstOpp = [99, 99];
      for (const p of this.onPitch) { const tt = reach.get(p.id).tt - (recv && recv.id === p.id ? 0.3 : 0); firstOpp[1 - p.team] = Math.min(firstOpp[1 - p.team], tt); }
      for (const t of [0, 1]) {
        let best = -1, bestT = Infinity, bestPt = vec();
        for (const p of this.onPitch) {
          if (p.team !== t) continue;
          const r = reach.get(p.id);
          let tt = r.tt;
          if (p.isGK && !this.inAttackingBox(1 - t, r.pt)) {
            if (!(p.rOOP.sweeper || this.hm(p, 'sweepgk')) || this.toU(t, r.pt.x) > 0.28 + 0.04 * this.hm(p, 'sweepgk') || tt > firstOpp[t] - 0.1) continue;          }
          if (recv && recv.id === p.id) tt -= 0.6;
          if (tt < bestT) { bestT = tt; best = p.id; bestPt = r.pt; }
        }
        this.chasers[t] = best;
        this.chasePoint[t] = this.clampPitch(bestPt);
      }
      if (b.passer === null || !recv) return;
      const def = 1 - this.players[b.passer].team;
      const recvT = reach.get(recv.id).tt;
      for (const p of this.onPitch) {
        if (p.team !== def || p.isGK || p.id === this.chasers[def]) continue;
        const r = reach.get(p.id);
        if (r.tt < Math.min(2.2, recvT + 0.2)) this.interceptors.set(p.id, this.clampPitch(r.pt));
      }
    }

    computePressers() {
      this.pressers.clear();
      if (this.reset) return;
      const b = this.ball;
      if (b.owner === null) return;
      const carrier = this.players[b.owner];
      const def = 1 - carrier.team;
      const ti = this.tac(def).team;
      const cands = this.teamOn(def).filter(p => !p.isGK && p.down <= 0).sort((a, c) => dist(a.pos, carrier.pos) - dist(c.pos, carrier.pos));
      const depth = this.toU(def, carrier.pos.x);
      const counter = this.time - this.lostBallAt[def] < 3 && ti.pressing >= 0 ? 8 : 0;
      const k = Math.max(0.65, this.cfg.k);
      for (let i = 0; i < Math.min(3, cands.length); i++) {
        const p = cands[i], d = dist(p.pos, carrier.pos), wp = p.rOOP.w.press;
        // the role's press weight scales how far they'll go to close the ball down
        let range = ((10 + (ti.pressing < 0 ? 4 : 6) * ti.pressing + 1.5 * ti.mentality) * wp * (1 + 0.2 * p.instr.agg) + counter * Math.min(1.2, wp)) * k;
        if (depth < 0.35) range += 8 * k;
        if (depth > 0.65 && ti.pressing < 1) range *= 0.6;
        // a carrier dwelling on it draws the nearest willing presser from further out; reluctant pressers never make up the 2nd/3rd man
        const dwelling = i === 0 && wp >= 0.7 && this.time - carrier.gotBallAt > 1.8;
        const limit = dwelling ? range * 1.8 : i === 0 ? range + 4 : wp < 0.7 ? 0 : i === 1 ? range * (ti.pressing > 0 ? 1 : 0.6) : ti.pressing > 0 ? range * 0.6 : 0;
        if (d < limit) this.pressers.add(p.id);
      }
      // counter-press: for a few seconds after losing it, everyone close by swarms the ball
      if (this.time - this.lostBallAt[def] < 3 && ti.pressing >= 0) {
        const reach = (11 + 3 * ti.pressing) * k;
        let n = 0;
        for (const p of cands) {
          if (n >= 5) break;
          const wp = p.rOOP.w.press;
          if (wp >= 0.7 && dist(p.pos, carrier.pos) < reach * Math.min(1.3, wp)) { this.pressers.add(p.id); n++; }
        }
      }
    }
    computeBlocker() {
      this.blocker = -1;
      if (this.reset) return;
      const b = this.ball;
      if (b.owner === null) return;
      const carrier = this.players[b.owner], def = 1 - carrier.team, goal = this.ownGoal(def);
      const dGoal = dist(carrier.pos, goal);
      if (dGoal > 32 * this.cfg.k) return;
      this.blockPoint = add(carrier.pos, scale(norm(sub(goal, carrier.pos)), Math.min(3.2, dGoal * 0.4)));
      let best = 14;
      for (const p of this.onPitch) {
        if (p.team !== def || p.isGK || this.pressers.has(p.id) || p.down > 0) continue;
        const d = dist(p.pos, this.blockPoint);
        if (d < best) { best = d; this.blocker = p.id; }
      }
    }
    zoneOf(p) {
      const pos = TAC.formation(this.tac(p.team).oop).slots[p.slot].pos;
      if (pos === 'CB' || pos === 'LB' || pos === 'RB') return 'def';
      if (pos === 'ST' || pos === 'LW' || pos === 'RW') return 'fwd';
      return 'mid';
    }
    // how far a role ranges to defend: roaming only widens the net for roles that want to win the ball back
    defRoam(p) { const r = p.rOOP.roam || 1; return p.rOOP.w.press >= 1 ? r : Math.min(1, r); }
    // where the ball is about to be: the defending shape reads it a moment early so the block moves as one
    ballLead() {
      const b = this.ball;
      if (b.owner !== null) { const c = this.players[b.owner]; return this.clampPitch(add(c.pos, scale(c.vel, 0.6))); }
      return b.shot ? b.pos : this.clampPitch(add(b.pos, scale(b.vel, 0.25)));
    }
    computeMarks() {
      const prev = new Map(this.marks);
      this.marks.clear();
      if (this.reset) return;
      const att = this.possession, def = 1 - att, b = this.ball, k = this.cfg.k;
      // free roles (Classic 10, Trequartista) are excused from marking: they stay up as the outlet
      const defenders = this.teamOn(def).filter(p => !p.isGK && !this.pressers.has(p.id) && p.id !== this.blocker && p.down <= 0 && !p.rOOP.free);
      const anchors = new Map(), lead = this.ballLead();
      let lineSum = 0, lineN = 0;
      for (const d of defenders) {
        const a = this.formationTarget(d, lead, false, this.oppLine[def]);
        anchors.set(d.id, a);
        if (this.zoneOf(d) === 'def') { lineSum += this.toU(def, a.x); lineN++; }
      }
      // where the back line holds (markAdjust keeps defenders within a few metres of it)
      if (!this.defLineU) this.defLineU = [0.25, 0.25];
      if (lineN) this.defLineU[def] = lineSum / lineN;
      const attackers = this.teamOn(att).filter(a => !a.isGK && a.id !== b.owner)
        .map(a => ({ a, danger: this.threat(att, a.pos) + (a.action === 'run' ? 0.3 : 0) }))
        .sort((x, y) => y.danger - x.danger);
      const taken = new Set();
      for (const { a } of attackers) {
        const au = this.toU(def, a.pos.x);
        let best = -1, bestCost = Infinity;
        for (const d of defenders) {
          if (taken.has(d.id)) continue;
          const anchor = anchors.get(d.id), zone = this.zoneOf(d), roam = this.defRoam(d);
          let cost = Math.min(dist(anchor, a.pos), dist(d.pos, a.pos) * 1.2);
          if (zone === 'def' && au > 0.6) cost += 20;
          // a defender doesn't follow a forward who drops off deep into midfield: hand them on (unless a stopper)
          if (zone === 'def' && d.rOOP.id !== 'stp' && au > this.defLineU[def] + 0.12) cost += 10;
          if (zone === 'fwd' && au < this.toU(def, anchor.x) - 0.1) cost += 30;
          if (zone === 'mid' && au < 0.2) cost += 6;
          cost /= roam;
          if (prev.get(d.id) === a.id) cost -= 4;
          const max = (zone === 'def' ? 20 : zone === 'mid' ? 18 : 9) * Math.max(0.7, k);
          if (cost < max && cost < bestCost) { bestCost = cost; best = d.id; }
        }
        if (best >= 0) { this.marks.set(best, a.id); taken.add(best); }
      }
    }
    inCrossingZone(t, v) { const edge = 0.24 + 0.08 * this.tac(t).team.width; return v < edge || v > 1 - edge; }
    computeBoxRuns() {
      const b = this.ball;
      // while a pass is travelling the runners keep attacking their zones (offside was judged at the kick)
      if (b.owner === null && !b.shot && this.boxRuns.size && this.time - (this.boxRunsAt || 0) < 2.5) return;
      const prevRuns = new Set(this.boxRuns.keys());
      this.boxRuns.clear();
      if (b.owner === null) return;
      this.boxRunsAt = this.time;
      const carrier = this.players[b.owner], t = carrier.team;
      const u = this.toU(t, carrier.pos.x), v = this.toV(t, carrier.pos.y);
      // in the final third the forwards fill the box: always when the ball is wide, and when it's central once the
      // defence has dropped in front of its box (against a high line they run in behind instead)
      const wideBall = this.inCrossingZone(t, v);
      if (u < (wideBall ? 0.55 : 0.62) || (!wideBall && this.oppLine[t] < 0.8)) return;
      const near = v < 0.5 ? -1 : 1;
      const Z = { near: this.fromUV(t, 0.955, 0.5 + near * 0.06), far: this.fromUV(t, 0.955, 0.5 - near * 0.08), spot: this.fromUV(t, 0.86, 0.5 - near * 0.02) };
      // who attacks the cross: runners by role appetite, how close they already are and how well they read it
      const cands = [];
      for (const p of this.teamOn(t)) {
        if (p === carrier || p.isGK || p.down > 0) continue;
        const w = p.rIP.w.run, slot = this.slotFor(p, true);
        // forwards and runners first; an advanced midfielder makes up the numbers
        const midFill = slot.u >= 0.4 && w >= 0.8 && this.zoneOf(p) === 'mid';
        if (slot.u < 0.65 && w < 1.3 && !midFill) continue;
        const q = this.attr(p, 'positioning') / 99, pu = this.toU(t, p.pos.x);
        const score = w + 1.5 * pu + 0.5 * q + (slot.u >= 0.65 ? 0.3 : 0) - (this.zoneOf(p) === 'def' ? 0.6 : 0) - (slot.u < 0.65 && w < 1.3 ? 0.5 : 0) + (prevRuns.has(p.id) ? 0.4 : 0);
        cands.push({ p, score, slot });
      }
      cands.sort((a, c) => c.score - a.score || a.p.slot - c.p.slot);
      const free = new Set(['near', 'far', 'spot']);
      for (const { p, slot } of cands.slice(0, this.five ? 2 : 3)) {
        // the role picks the zone: target men and poachers the near post, inside forwards the far post,
        // late-arriving midfielders the penalty spot; otherwise wide players go far, strikers near
        const pos = slot.pos, wide = pos === 'LW' || pos === 'RW' || pos === 'LM' || pos === 'RM' || pos === 'LB' || pos === 'RB';
        const pref = p.rIP.boxZone || (wide ? 'far' : pos === 'ST' ? 'near' : 'spot');
        const pick = free.has(pref) ? pref : ['near', 'far', 'spot'].find(z => free.has(z));
        free.delete(pick);
        this.boxRuns.set(p.id, Z[pick]);
      }
    }

    transitionEffort(p) {
      if (p.isGK || this.reset || this.ball.owner === p.id || this.phase !== 'play' || p.down > 0) return;
      if (!['position', 'support', 'mark', 'run', 'box'].includes(p.action)) return;
      const won = this.possession === p.team && this.time - this.regainAt[p.team] < TRANSITION_SECONDS;
      const lost = this.possession !== p.team && this.time - this.lostBallAt[p.team] < TRANSITION_SECONDS;
      if (!won && !lost) return;
      const tempo = this.tac(p.team).team.tempo;
      // caught out of shape after losing it: everybody sprints back, whatever the tempo
      // caught on the wrong side of the ball, or well upfield of where they should be: sprint back; otherwise a hard jog
      if (lost) {
        const c = this.cfg, pu = this.toU(p.team, p.pos.x);
        const wrongSide = pu > this.toU(p.team, this.ball.pos.x) - 0.02, deficit = (pu - this.toU(p.team, p.target.x)) * c.L > 6 * c.k;
        if (wrongSide || deficit) p.urgency = Math.max(p.urgency, 1);
        else if (V.dist(p.pos, p.target) > 6 * c.k) p.urgency = Math.max(p.urgency, 0.85);
        return;
      }
      const effort = tempo > 0 ? 1 : tempo === 0 ? 0.88 : 0.66;
      p.urgency = tempo > 0 ? Math.max(p.urgency, effort) : Math.min(p.urgency, effort);
      if (won && tempo > 0 && (p.action === 'position' || p.action === 'support')) {
        const dir = p.team === 0 ? 1 : -1;
        p.target = this.clampPitch({ x: p.target.x + dir * TRANSITION_SURGE * this.cfg.k, y: p.target.y });
      }
    }

    // ── off-ball thinking ──
    think(p) {
      p.decisionCd -= TICK; p.tackleCd -= TICK; p.supportTimer -= TICK; p.bumpCd -= TICK;
      if (p.runTimer > 0) { p.runTimer -= TICK; if (p.runTimer <= 0) p.runTarget = null; }
      if (p.down > 0) { p.action = 'down'; return; }
      const b = this.ball;
      if (b.owner === p.id) return this.thinkCarrier(p);
      if (this.reset && !p.isGK) return this.thinkReset(p, this.reset);
      if (b.shot && b.shot.team !== p.team && !p.isGK && this.thinkShotBlock(p)) return;
      if (b.owner === null && !b.shot && this.chasers[p.team] === p.id) { p.target = this.chasePoint[p.team]; p.urgency = 1; p.action = 'chase'; return; }
      const cut = this.interceptors.get(p.id);
      if (cut) { p.target = cut; p.urgency = 1; p.action = 'chase'; return; }
      if (p.isGK) return this.thinkKeeper(p);
      const inPoss = this.possession === p.team;
      const base = this.formationTarget(p, inPoss ? b.pos : this.ballLead(), inPoss, this.oppLine[p.team]);
      if (inPoss) return this.thinkAttacking(p, base);
      this.thinkDefending(p, base);
    }
    thinkAttacking(p, base) {
      const b = this.ball, ti = this.tac(p.team).team;
      const box = this.boxRuns.get(p.id), line = this.oppLine[p.team];
      if (box) {
        // attack the zone, but arrive onside: never beyond the last defender before the ball is delivered
        const cu = b.owner !== null ? this.toU(p.team, this.players[b.owner].pos.x) : 1, cap = Math.max(line - 0.005, cu - 0.01);
        p.target = b.owner !== null && this.toU(p.team, box.x) > cap ? this.fromUV(p.team, cap, this.toV(p.team, box.y)) : box;
        p.urgency = dist(p.pos, p.target) > 2.5 * this.cfg.k ? 1 : 0.8; p.action = 'box'; return;
      }
      if (!p.runTarget && b.owner !== null) this.maybeStartRun(p, base, ti);
      if (p.runTarget) {
        p.action = 'run';
        // a run in behind starts from onside: hold on the last defender's shoulder until the carrier can release it
        if (!p.runGo && b.owner !== null && this.toU(p.team, p.runTarget.x) > line - 0.005) {
          if (this.runReady(p)) { p.runGo = true; if (this.raw(p, 'accel') > 70) p.burstUntil = Math.max(p.burstUntil, this.time + 1.2); }
          else { p.target = this.fromUV(p.team, line - 0.004, this.toV(p.team, p.runTarget.y)); p.urgency = 0.85; return; }
        }
        p.target = p.runTarget; p.urgency = 1; return;
      }
      if (b.owner !== null) {
        const carrier = this.players[b.owner];
        if (p.supportTimer <= 0 || !p.supportTarget) {
          p.supportTarget = dist(carrier.pos, base) < 40 * this.cfg.k ? this.supportSpot(p, base, carrier) : base;
          p.supportTimer = 0.5 + this.rng.next() * 0.3;
        }
        p.target = p.supportTarget;
        p.action = 'support';
      } else { p.target = base; p.action = 'position'; }
      // a forward caught well short of the front line in the final third gets back up there quickly
      const far = dist(p.pos, p.target), fwdCatch = far > 8 && this.toU(p.team, b.pos.x) > 0.55 && this.toU(p.team, p.target.x) > this.toU(p.team, p.pos.x) + 0.05;
      p.urgency = fwdCatch ? 0.95 : far > 8 ? 0.85 : 0.6;
    }
    supportSpot(p, base, carrier) {
      const opps = this.teamOn(1 - p.team), k = Math.max(0.6, this.cfg.k);
      // stay onside: level with the last defender at most, unless the ball is further upfield
      const maxU = Math.max(this.oppLine[p.team] - 0.005, this.toU(p.team, carrier.pos.x) - 0.01);
      const baseU = this.toU(p.team, base.x), sp = this.slotFor(p, true).pos;
      // a wide role keeps its width: leaving the touchline costs extra
      const holdWidth = (sp === 'LW' || sp === 'RW' || sp === 'LM' || sp === 'RM') && p.rIP.attack.dv <= 0.08 ? 0.45 : 0;
      // free roles look further afield for space
      const scan = (this.raw(p, 'vision') > 75 ? 1.5 : 1) * Math.min(1.5, p.rIP.roam || 1) * k;
      const score = c => {
        const space = Math.min(8, this.nearestDist(c, opps));
        let lane = 6;
        for (const o of opps) {
          const { d, t } = this.segDist(o.pos, carrier.pos, c);
          if (t > 0.05 && t < 0.98) lane = Math.min(lane, d);
        }
        const tooClose = dist(c, carrier.pos) < 6 * k ? 3 : 0;
        const du = this.toU(p.team, c.x) - baseU;
        return space * 0.6 + lane * 0.7 - dist(c, base) * 0.22 - tooClose + du * 6 + (p.rIP.boxStay && du < 0 ? du * 12 : 0) - holdWidth * Math.abs(c.y - base.y);
      };
      let best = base, bestS = -Infinity;
      for (const [dx0, dy0] of SUPPORT) {
        let c = this.clampPitch({ x: base.x + dx0 * scan, y: base.y + dy0 * scan });
        if (this.toU(p.team, c.x) > maxU) c = this.fromUV(p.team, maxU, this.toV(p.team, c.y));
        const s = score(c);
        if (s > bestS) { bestS = s; best = c; }
      }
      // hysteresis: keep the current spot unless the new one is clearly better
      const cur = p.supportTarget;
      if (cur && cur !== base && dist(cur, base) < 12 * k && this.toU(p.team, cur.x) <= maxU + 0.002 && score(cur) + 1.2 >= bestS) return cur;
      return best;
    }
    // is the carrier in a position to release a runner: facing forward, not swamped, with a lane to the run
    runReady(p) {
      const b = this.ball, c = b.owner !== null ? this.players[b.owner] : null;
      if (!c || c.team !== p.team || !p.runTarget) return false;
      const early = () => this.rng.chance((1 - this.attr(p, 'positioning') / 99) * 0.1); // poor readers go too soon
      if (this.time - c.gotBallAt < 0.25) return early();
      const facing = Math.cos(c.ang - (p.team === 0 ? 0 : Math.PI));
      if (facing < 0.25 || this.pressureOn(c) > 0.9) return early();
      for (const o of this.onPitch) {
        if (o.team === p.team || o.isGK || o.down > 0) continue;
        const { d, t } = this.segDist(o.pos, c.pos, p.runTarget);
        if (t > 0.1 && t < 0.85 && d < 1.2) return early();
      }
      return true;
    }
    thinkDefending(p, base) {
      const b = this.ball;
      p.runTarget = null; p.supportTarget = null;
      if (b.owner !== null && this.pressers.has(p.id)) {
        const carrier = this.players[b.owner];
        const d = dist(p.pos, carrier.pos);
        const lead = clamp(d / this.maxSpeed(p), 0.3, 1.2);
        const fut = add(carrier.pos, scale(carrier.vel, lead));
        // press from the goal side: step into the line between the ball and our goal, not into his back
        const toGoal = norm(sub(this.ownGoal(p.team), fut));
        const goalSide = this.toU(p.team, p.pos.x) < this.toU(p.team, carrier.pos.x) - 0.3 / this.cfg.L;
        if (goalSide || d > 6) {
          p.target = add(fut, scale(toGoal, d < 3 ? 0.9 : 1.6));
          p.urgency = d < 3 ? 0.85 : 1;
        } else {
          // caught behind him: come round the shoulder on whichever side he's already on
          const perp = vec(-toGoal.y, toGoal.x), side = dot(sub(p.pos, carrier.pos), perp) >= 0 ? 1 : -1;
          p.target = add(fut, add(scale(toGoal, 0.8), scale(perp, side * 1.1)));
          p.urgency = 1;
        }
        p.action = 'press';
        return;
      }
      if (this.blocker === p.id) { p.target = this.blockPoint; p.urgency = 1; p.action = 'block'; return; }
      p.target = this.markAdjust(p, base);
      const man = this.marks.get(p.id), m = man !== undefined ? this.players[man] : null;
      // flat out only when the man has actually got goal-side, or is sprinting in behind level with them; otherwise jockey
      const pu = this.toU(p.team, p.pos.x);
      const mu = m ? this.toU(p.team, m.pos.x) : 1, goalward = m ? -(p.team === 0 ? m.vel.x : -m.vel.x) : 0;
      const beaten = m && (mu < pu - 0.005 || (goalward > 4.5 && mu < pu + 0.015));
      const d = dist(p.pos, p.target), k = this.cfg.k;
      p.urgency = beaten ? 1 : d > 12 * k ? 0.9 : d > 6 * k ? 0.82 : 0.7;
      // the back line moves as one: a defender out of step with its depth hurries to get back in line
      if (!beaten && this.zoneOf(p) === 'def' && Math.abs(pu - this.toU(p.team, p.target.x)) * this.cfg.L > 1.5 * k) p.urgency = Math.max(p.urgency, 0.92);
      p.action = 'mark';
    }
    thinkShotBlock(p) {
      const b = this.ball, end = add(b.pos, scale(b.vel, 1.2));
      const { d, t } = this.segDist(p.pos, b.pos, end);
      if (d > 4 || t <= 0.02) return false;
      p.target = add(b.pos, scale(sub(end, b.pos), t));
      p.urgency = 1;
      p.action = 'block';
      return true;
    }
    maybeStartRun(p, target, ti) {
      const u = this.toU(p.team, target.x);
      // wide centre-backs overlap from deeper than anyone else
      if (u < (p.rIP.runFrom || 0.35)) return;
      const counter = this.inTransition(p.team) ? 3 : 1;
      const carrier = this.players[this.ball.owner];
      const time = 1 - 0.6 * Math.min(1, this.pressureOn(carrier));
      const legs = 0.4 + 0.6 * p.stamina;
      const perSec = 0.14 * p.rIP.w.run * (1 + 0.5 * p.instr.runs) * (1 + 0.25 * ti.mentality) * (1 + 0.8 * ti.directness) * counter * time * legs;
      if (perSec <= 0 || !this.rng.chance(perSec * TICK)) return;
      const line = this.oppLine[p.team], v = this.toV(p.team, target.y), q = this.attr(p, 'positioning') / 99;
      let gapV = this.findGap(p.team, v + (0.5 - v) * (p.rIP.w.shoot > 1.2 ? 0.5 : 0.1), q);
      // a touchline role runs down its own channel rather than into the middle
      const sp = this.slotFor(p, true).pos;
      if ((sp === 'LW' || sp === 'RW' || sp === 'LM' || sp === 'RM') && p.rIP.attack.dv <= 0.08) gapV = v + (gapV - v) * 0.3;
      const behind = u > line - 0.12;
      const runU = behind ? Math.min(line + this.rng.range(0.05, 0.12), 0.95) : Math.min(u + 0.2, line - 0.02);
      if (runU < u + 0.04) return;
      p.runTarget = this.fromUV(p.team, runU, gapV);
      // a run beyond the line waits (onside) for the release; one into space short of it just goes
      p.runGo = !behind;
      p.runTimer = behind ? this.rng.range(2.2, 3.4) : this.rng.range(1.8, 2.8);
      if (this.raw(p, 'accel') > 78 && this.rng.chance(0.35)) p.burstUntil = this.time + 2.5;
    }
    findGap(t, v, q = 0.6) {
      const line = this.oppLine[t];
      const vs = this.onPitch.filter(o => o.team !== t && !o.isGK && this.toU(t, o.pos.x) > line - 0.12).map(o => this.toV(t, o.pos.y));
      vs.push(0.06, 0.94);
      vs.sort((a, c) => a - c);
      let best = v, bestS = -Infinity;
      for (let i = 1; i < vs.length; i++) {
        const w = vs[i] - vs[i - 1];
        if (w < 0.08) continue;
        const mid = (vs[i] + vs[i - 1]) / 2;
        // a sharper reader of the game values the size of the gap over its convenience
        const s = Math.min(w, 0.3) * (0.6 + 0.8 * q) - Math.abs(mid - v) * 0.9;
        if (s > bestS) { bestS = s; best = mid; }
      }
      return clamp(best, 0.08, 0.92);
    }
    markAdjust(p, base) {
      const b = this.ball;
      const ballPos = b.owner !== null ? this.players[b.owner].pos : b.pos;
      const zone = this.zoneOf(p), roam = this.defRoam(p), positioning = this.attr(p, 'positioning') / 99;
      const manId = this.marks.get(p.id);
      let spot, leash;
      if (manId !== undefined) {
        const m = this.players[manId];
        const at = add(m.pos, scale(m.vel, 0.4));
        const toGoal = sub(this.ownGoal(p.team), at);
        const goalSide = add(at, scale(norm(toGoal), Math.min(1.8, len(toGoal) * 0.3)));
        const dc = dist(ballPos, at);
        const lane = add(at, scale(sub(ballPos, at), Math.min(0.45, 3.5 / Math.max(1, dc))));
        const laneW = clamp((30 - dc) / 18, 0, 0.8) * (0.4 + 0.6 * positioning);
        spot = add(goalSide, scale(sub(lane, goalSide), laneW));
        const near = this.toU(p.team, m.pos.x) < 0.38 ? 0.3 : 0;
        const tight = clamp(0.6 + near - 0.06 * this.tac(p.team).team.mentality, 0.35, 1);
        spot = add(base, scale(sub(spot, base), tight));
        // a defender marks from the inside shoulder: only part of the way out toward a man drifting wide
        if (zone === 'def' && Math.abs(m.pos.y - this.cfg.W / 2) > Math.abs(base.y - this.cfg.W / 2)) spot.y = base.y + (spot.y - base.y) * 0.7;
        leash = (zone === 'def' ? 12 : zone === 'mid' ? 13 * roam : 6 * roam) * Math.max(0.6, this.cfg.k) * (1 - 0.22 * (p.instr.runs || 0));
      } else {
        let sum = base, wsum = 1;
        for (const a of this.onPitch) {
          if (a.team === p.team || a.isGK || a.id === b.owner || dist(ballPos, a.pos) > 35) continue;
          const { d, t } = this.segDist(base, ballPos, a.pos);
          if (d > 9 || t < 0.15 || t > 0.92) continue;
          const w = (0.3 + this.threat(a.team, a.pos)) * (1 - d / 9) * (0.6 + 0.8 * positioning);
          sum = add(sum, scale(add(ballPos, scale(sub(a.pos, ballPos), t)), w));
          wsum += w;
        }
        spot = scale(sum, 1 / wsum);
        leash = zone === 'fwd' ? 4 : 8;
      }
      let off = sub(spot, base);
      const l = len(off);
      if (l > leash) off = scale(off, leash / l);
      let out = add(base, off);
      // the back line stays flat: within a few metres of its depth, unless defending the box, tracking a man who
      // has got in behind it, or a stopper stepping out
      if (zone === 'def' && this.defLineU && p.rOOP.id !== 'stp' && !this.inAttackingBox(1 - p.team, out)) {
        const c = this.cfg, line = this.defLineU[p.team], band = (3 * c.k) / c.L;
        let lo = line - band;
        if (manId !== undefined) lo = Math.min(lo, this.toU(p.team, this.players[manId].pos.x) - 0.01);
        const u = clamp(this.toU(p.team, out.x), lo, line + band);
        out = this.fromUV(p.team, u, this.toV(p.team, out.y));
      }
      return out;
    }
    thinkKeeper(p) {
      const b = this.ball, c = this.cfg;
      if (b.shot && b.shot.team !== p.team && Math.abs(b.vel.x) > 0.1) {
        const tt = (p.pos.x - b.pos.x) / b.vel.x;
        const y = b.pos.y + b.vel.y * Math.max(0, tt);
        const aim = b.shot.outcome === 'saved' ? b.shot.gy : b.shot.outcome === 'goal' ? U.lerp(y, p.pos.y, 0.55) : y;
        p.target = { x: p.pos.x, y: clamp(aim, c.GY0 - 1, c.GY1 + 1) };
        p.urgency = 1;
        // the dive: a big lateral launch in the last instant
        if (!p.dive && tt > 0 && tt < 0.45 && Math.abs(aim - p.pos.y) > 0.8) {
          p.dive = 0.75;
          p.diveDir = Math.sign(aim - p.pos.y);
          p.vel = { x: p.vel.x * 0.3, y: p.diveDir * (5 + (4 * this.raw(p, 'goalkeeping')) / 99) };
          p.z = 0.1; p.vz = 2.2;
        }
        return;
      }
      if (b.owner === null && !b.shot && V.len(b.vel) > 0.5) {
        // a loose ball heading for the goal: get to it before it crosses the line
        const gx = p.team === 0 ? 0 : c.L;
        for (let i = 1; i <= 25; i++) {
          const at = this.ballAt(i * 0.1).pos;
          if ((p.team === 0 ? at.x <= 0.6 : at.x >= c.L - 0.6) && at.y > c.GY0 - 1 && at.y < c.GY1 + 1) {
            const pt = this.ballAt(Math.max(0.1, i * 0.1 - 0.35)).pos;
            p.target = { x: p.team === 0 ? Math.max(0.3, pt.x) : Math.min(c.L - 0.3, pt.x), y: U.clamp(pt.y, c.GY0 - 1, c.GY1 + 1) };
            p.urgency = 1; p.action = 'chase';
            void gx;
            return;
          }
        }
      }
      p.target = this.keeperTarget(p, b.pos);
      p.urgency = 0.7;
      p.action = 'position';
    }

    // ── on-ball decisions ──
    thinkCarrier(p) {
      if (p.decisionCd > 0) {
        if (p.action === 'dribble' && p.dribbleTarget) { p.target = p.dribbleTarget; p.urgency = 1; }
        else { p.target = p.pos; p.urgency = 0.2; p.action = 'hold'; }
        return;
      }
      this.decide(p);
    }
    passRisk(from, aim, m, lofted, opps) {
      const d = Math.max(1, dist(from, aim));
      const k = lofted ? AIR_K : this.groundK;
      const v0 = kickSpeed(d, lofted, this.groundK, this.weather.arrive);
      if (k * d >= v0 - 0.5) return 1;
      const tAt = s => -Math.log(1 - (k * s) / v0) / k;
      const tb = tAt(d);
      const tr = Math.max(0, dist(m.pos, aim) - 0.8) / this.maxSpeed(m) + 0.15;
      const tReceive = Math.max(tb, tr);
      let risk = clamp((tr - tb - 0.5) / 1.5, 0, 0.6);
      const dir = scale(sub(aim, from), 1 / d);
      const fracs = lofted ? [0.88, 1] : [0.2, 0.4, 0.6, 0.8, 1];
      for (const o of opps) {
        if (o.down > 0.4) continue;
        const vo = this.maxSpeed(o), reach = o.isGK ? 1.8 : 1.0;
        for (const f of fracs) {
          const pt = add(from, scale(dir, d * f));
          const tBall = f === 1 ? tReceive : tAt(d * f);
          const tOpp = Math.max(0, dist(o.pos, pt) - reach) / vo + 0.25;
          const margin = tOpp - tBall;
          if (margin < 0.5) risk = Math.max(risk, clamp(0.5 - margin / 0.8, 0, 0.95));
        }
      }
      return risk;
    }

    decide(p) {
      const t = p.team, opp = 1 - t, ti = this.tac(t).team, side = this.teams[t];
      const opps = this.teamOn(opp), mates = this.teamOn(t).filter(m => m.id !== p.id && m.down <= 0);
      const goal = this.attackGoal(t), pressure = this.pressureOn(p), k = this.cfg.k;
      const opts = [];
      const myU = this.toU(t, p.pos.x), here = this.threat(t, p.pos), w = p.rIP.w;
      this.countTakeOn(p);
      const counter = this.inTransition(t) ? 0.3 * (1 - 0.15 * ti.mentality) : 0;
      const stale = clamp((this.time - this.possStart[t] - 10) / 15, 0, 1) * (myU < 0.5 ? 0.3 : 0.12);
      const push = clamp(0.05 * ti.mentality + 0.7 * counter + 1.2 * stale, -0.3, 0.5);
      // a gentle lean toward goal, scaled by how far forward the ball goes (not a flat bonus for any forward ball)
      const forwardBias = to => 1 + push * clamp((this.toU(t, to.x) - myU) * 5, -1, 1);
      const flair = this.flair(p);
      const throwIn = !!p.throwIn;
      const direct = ti.directness - 0.25 * Math.min(0, ti.mentality);
      // keeping the ball is worth something in itself: possession sides value it more, counters less
      // (and less as a move goes stale: sterile circulation has to end in something)
      const retain = 0.24 * (1 - 2.2 * stale) * (1 - 0.2 * direct) * (1 - counter);
      const offLine = this.offsideLineU(t), freeKick = this.freeRestart === p.id;

      // clear it: under pressure deep in his own half, a defender just gets rid
      if (!p.mustPass && myU < 0.3 && pressure > 0.55 && !p.isGK) {
        const danger = (0.3 - myU) * 3 + (pressure - 0.55);
        opts.push({ score: danger * 0.9 * (1.2 - this.attr(p, 'composure') / 99) * (p.rIP.w.direct || 1), run: () => this.clear(p) });
      }
      // shoot: no hard range gate, but every metre beyond ~18 costs (more patience for poor/long shooters)
      const dGoal = dist(p.pos, goal);
      if (dGoal < 38 * k && !p.mustPass && !throwIn) {
        const crowd = this.congestion(p);
        const xg = this.shotXg(p, pressure, false, crowd);
        const skid = dGoal > 16 * k ? 1 + this.weather.slick : 1;
        const longShot = 1 + 0.25 * (flair - 1) + 0.2 * p.instr.shoot + 0.3 * (w.shoot - 1) + 0.25 * (this.attr(p, 'finishing') / 99 - 0.7) + 0.15 * (this.hm(p, 'cannon') + this.hm(p, 'bender'));
        const kr = Math.max(k, 0.75); // small-sided: a short pitch but the same legs, so shooting range shrinks less
        const far = Math.exp(-Math.max(0, dGoal - 18 * kr) / (8.5 * kr * Math.max(0.5, longShot)));
        const s = xg * Math.pow(0.65, this.blockers(p)) * 34 * far * skid * w.shoot * (1 + 0.35 * p.instr.shoot) * (1 + 0.05 * ti.mentality) * (side.blitz ? 1.15 : 1);
        opts.push({ score: s, run: () => this.shoot(p, xg, false) });
      }

      // pass: to feet, into space, or to a runner; on the ground or in the air
      const skill = this.attr(p, 'passing') / 99, vision = this.attr(p, 'vision') / 99, composure = this.attr(p, 'composure') / 99;
      const throwMax = this.throwRange(p);
      const myV = this.toV(t, p.pos.y);
      for (const m of mates) {
        // the keeper is an outlet from deep, not a target from midfield
        if (m.isGK && (myU > 0.42 || throwIn || pressure < 0.35)) continue;
        // a team-mate standing offside: the passer sees the flag coming (mostly)
        const offM = !freeKick && !throwIn && this.offsideSeen(m, p.pos.x, offLine, vision);
        const aims = [this.aimClamp(t, add(m.pos, scale(m.vel, 0.35)))];
        const dv = Math.abs(this.toV(t, m.pos.y) - myV);
        if (!m.isGK) {
          const toGoal = norm(sub(goal, m.pos)), sp = len(m.vel);
          const lead = norm(add(toGoal, sp > 1 ? scale(m.vel, 0.6 / sp) : vec()));
          aims.push(this.aimClamp(t, add(m.pos, scale(lead, 5 * k))), this.aimClamp(t, add(m.pos, scale(lead, 10 * k))));
          if (m.action === 'run' && m.runTarget) aims.push(this.aimClamp(t, m.runTarget));
        }
        const range = throwIn ? throwMax : (25 + 40 * vision + 8 * this.hm(p, 'quarterback') + (p.isGK ? 12 * this.hm(p, 'launcher') : 0)) * this.weather.visibility * Math.max(0.6, k);
        // the hub roles want it, the wide men are the outlet for a switch, the big men for a lofted ball
        const hub = (1 + 0.35 * (m.rIP.w.pass - 1)) * (m.rIP.free ? 1.08 : 1);
        const wideOut = m.rIP.w.cross >= 1.3 || m.rIP.id === 'wtm' ? 1 : 0;
        const aerialT = 0.35 * (m.rIP.w.aerial - 1) + (m.rIP.holdUp ? 0.12 : 0) + 0.3 * (this.attr(m, 'heading') / 99 - 0.6);
        for (const aim of aims) {
          const d = dist(p.pos, aim);
          if (d < (throwIn ? 3 : 4 * k) || d > range) continue;
          for (const lofted of throwIn ? [d > 9 * Math.max(0.6, k)] : [false, true]) {
            if (!throwIn && (lofted ? d < 15 * k : d > 32)) continue;
            const ambitious = aim !== aims[0];
            if (ambitious && this.rng.next() > 0.35 + 0.65 * vision + 0.12 * this.hm(p, 'threader')) continue;
            const canCurl = !lofted && this.raw(p, 'curve') * w.curl > 70;
            const risk = this.passRisk(p.pos, aim, m, lofted, opps) * (canCurl ? 0.8 : 1) * (side.passBonus > 1 && !lofted ? 0.85 : 1);
            // everyone thinks they can pass: the range judgement is pulled toward an average player's
            const acc = 1 - clamp((d / (lofted ? 42 : 30)) * (1 - (0.4 * skill + 0.6 * 0.72)) * (lofted ? 1.2 : 1), 0, 0.6);
            // calibrated against outcomes: the lane model is optimistic, and a man in your face costs more than it says
            const calm = 1 - 0.18 * Math.max(this.hm(p, 'pressproof'), !lofted && d < 22 ? this.hm(p, 'metronome') : 0);
            const fail = clamp(1.5 * risk * (ambitious ? 1 - 0.1 * this.hm(p, 'threader') : 1) + 0.24 * Math.min(1, pressure) * (1.2 - composure) * calm + 0.04, 0, 0.95);
            let pOk = (1 - fail) * acc * (!lofted && d < 22 && ti.directness < 0 ? 1.1 : 1);
            pOk = Math.pow(pOk, 1 - 0.15 * ti.mentality);
            if (offM) pOk *= 0.1 + 0.3 * (1 - vision);
            const near = this.nearestDist(aim, opps), aimT = this.threat(t, aim), space = clamp(near / 8, 0, 1);
            // a ball in the air hangs: anyone close to the drop zone contests it
            if (lofted && !throwIn) pOk *= (0.88 + 0.04 * Math.max(this.hm(p, 'quarterback'), this.hm(p, 'launcher'))) * (near < 3 ? 0.7 + 0.1 * near : 1);
            const gain = pOk * (aimT + retain * (0.7 + 0.3 * space) + (m.isGK ? -0.05 : 0)) - (1 - pOk) * 0.35 * this.threat(opp, aim);
            let bypassed = 0;
            const aimU = this.toU(t, aim.x);
            for (const o of opps) { const ou = this.toU(t, o.pos.x); if (ou > myU && ou < aimU) bypassed++; }
            const style = lofted || d > 26 ? (0.84 + 0.16 * direct) * w.direct : 1 - 0.05 * direct;
            let rb = lofted ? 1 + aerialT : hub;
            // the poacher lives in the box: find him there
            if (m.rIP.boxStay && this.inAttackingBox(t, aim)) rb *= 1.15;
            // straight back to whoever just gave it to you, unpressed and not forward: sterile ping-pong
            if (m.id === p.receivedFrom && this.time - p.receivedAt < 4 && pressure < 0.5 && aimU <= myU + 0.02) rb *= 0.6;
            const pp = this.pingPong;
            if (pp && pp.to === p.id && pp.from === m.id && pp.n >= 2) rb *= pressure > 0.7 ? 0.6 : pp.n >= 4 ? 0.04 : 0.15;
            // switch of play: a long diagonal into a wide man in space on the far side
            if (lofted && d > 25 * k && dv > 0.35) rb *= 1 + 0.12 + 0.2 * wideOut + 0.2 * space;
            // possession sides are patient but always probing: line-breaking short passes are what they live for
            const s = (gain + 0.025 * bypassed * pOk) * style * w.pass * forwardBias(aim) * (side.passBonus || 1) * rb;
            opts.push({ score: s, run: () => this.pass(p, m, aim, lofted, false) });
          }
        }
      }

      // cross into the zones the runners are attacking
      const v = this.toV(t, p.pos.y);
      if (myU > 0.72 && this.inCrossingZone(t, v) && !throwIn) {
        const crossing = this.attr(p, 'crossing') / 99;
        const kp = this.keeper(opp);
        for (const [id, zone] of this.boxRuns) {
          const att = this.players[id];
          if (att.team !== t || att.down > 0) continue;
          // only worth it if the runner gets there with the ball
          const dc = dist(p.pos, zone), tf = travelTime(dc, kickSpeed(dc, true), AIR_K);
          const late = Math.max(0, dist(att.pos, zone) - 1.5) / this.maxSpeed(att) - tf;
          if (late > 0.5) continue;
          const timing = clamp(1 - Math.max(0, late) / 0.6, 0.15, 1);
          let def = null;
          for (const o of opps) { if (o.isGK || dist(o.pos, zone) > 3.5) continue; if (!def || this.aerialScore(o) > this.aerialScore(def)) def = o; }
          const pWin = def ? clamp(0.5 + (this.aerialScore(att) - this.aerialScore(def)) / 99, 0.15, 0.85) : 0.85;
          const xgH = this.angleXg(t, zone) * 0.6 * (0.6 + (0.8 * this.attr(att, 'heading')) / 99);
          const delivery = 0.3 + 0.7 * crossing + 0.07 * this.hm(p, 'whip') - 0.15 * Math.min(1, pressure);
          // a keeper camped near the drop zone comes and claims it
          const gkThreat = kp ? clamp(1 - dist(kp.pos, zone) / 9, 0, 0.6) : 0;
          const offA = !freeKick && this.offsideSeen(att, p.pos.x, offLine, vision);
          const s = delivery * timing * pWin * (1 - gkThreat) * (xgH * 6 + 0.25) * w.cross * (1 + 0.6 * ti.width) * (side.crossBonus || 1) * (offA ? 0.15 : 1);
          opts.push({ score: s, run: () => this.pass(p, att, zone, true, true) });
        }
      }
      // from the byline: a low driven ball across the six-yard box, or a cut-back to the penalty spot / edge
      if (myU > 0.8 && Math.abs(v - 0.5) > 0.12 && !throwIn) {
        const c = this.cfg, crossing = this.attr(p, 'crossing') / 99, sgn = Math.sign(v - 0.5);
        const lowAims = [
          this.fromUV(t, 1 - (c.PEN + 0.5 * k) / c.L, 0.5 + sgn * 0.02),
          this.fromUV(t, 1 - (c.BOX_D + 1.5 * k) / c.L, 0.5 + sgn * 0.06),
          this.fromUV(t, 1 - 5 / c.L, 0.5 + sgn * 0.035),
          this.fromUV(t, 1 - 5 / c.L, 0.5 - sgn * 0.05),
        ].map(a => this.aimClamp(t, a));
        for (const aim of lowAims) {
          const d = dist(p.pos, aim);
          if (d < 5 * k || d > 30) continue;
          const tb = travelTime(d, kickSpeed(d, false, this.groundK, this.weather.arrive), this.groundK);
          let best = null, bt = Infinity;
          for (const m of mates) {
            if (m.isGK || (!freeKick && this.offsidePos(m, p.pos.x, offLine))) continue;
            const tr = Math.max(0, dist(m.pos, aim) - 1) / this.maxSpeed(m);
            if (tr < bt) { bt = tr; best = m; }
          }
          if (!best || bt > tb + 0.5) continue;
          const pOk = (1 - this.passRisk(p.pos, aim, best, false, opps)) * (0.5 + 0.5 * crossing) * (1 - 0.2 * Math.min(1, pressure));
          const xgL = this.angleXg(t, aim) * (0.6 + (0.6 * this.attr(best, 'finishing')) / 99);
          const s = pOk * (xgL * 5 + 0.25) * (0.6 + 0.4 * w.cross) * (side.crossBonus || 1);
          opts.push({ score: s, run: () => this.pass(p, best, aim, false, true) });
        }
      }

      if (!p.mustPass) {
        const fwd = norm(sub(goal, p.pos)), dribbling = this.attr(p, 'dribbling') / 99;
        const reach = 7 * Math.max(0.7, k);
        // carries: forward, diagonal, lateral and turning back out of trouble
        for (const ang of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9]) {
          const ahead = this.clampPitch(add(p.pos, scale(rot(fwd, ang), reach * (Math.abs(ang) > 1.5 ? 0.7 : 1))));
          const space = this.nearestDist(ahead, opps);
          // defenders standing in the path itself, not just at the end of it
          let path = 9;
          for (const o of opps) { if (o.down > 0.3) continue; const sd = this.segDist(o.pos, p.pos, ahead); if (sd.t > 0.05) path = Math.min(path, sd.d); }
          const pKeep = clamp(space / 9, 0.1, 1) * clamp(0.3 + path / 3.5, 0.3, 1) * (0.45 + 0.55 * dribbling + 0.06 * this.hm(p, 'trickster')) * (1 - 0.45 * Math.min(1, pressure) * (1 - 0.3 * this.hm(p, 'pressproof')));
          // even a stay-at-home defender steps into open grass when nobody comes to him
          // (ball-playing / wide centre-backs are built to carry it out)
          const wd = (p.rIP.carry && Math.abs(ang) < 0.7 && myU < 0.6 ? Math.max(w.dribble, 0.95) : w.dribble) + Math.max(0, 1 - w.dribble) * (Math.abs(ang) < 0.7 ? clamp((space - 6) / 10, 0, 0.6) * (1 - Math.min(1, pressure)) : 0);
          let s = (pKeep * (this.threat(t, ahead) + 0.9 * retain) - (1 - pKeep) * 0.25 * this.threat(opp, p.pos)) * wd * forwardBias(ahead);
          if (p.isGK) s *= 0.05;
          opts.push({ score: s, run: () => this.startDribble(p, ahead) });
        }
        // under pressure: shield it, back to the marker, and wait for help
        if (pressure > 0.4 && !p.isGK) {
          const shield = this.clampPitch(add(p.pos, scale(fwd, -2.2)));
          const str = this.attr(p, 'strength') / 99, holdUpRole = p.rIP.holdUp ? 1 : 0;
          const pKeep = clamp(0.25 + 0.45 * str + 0.2 * dribbling + 0.15 * holdUpRole - 0.25 * Math.min(1, pressure), 0.1, 0.9);
          const s = (pKeep * (here + retain) * (0.55 + 0.35 * holdUpRole) - (1 - pKeep) * 0.25 * this.threat(opp, p.pos)) * (1 - stale);
          opts.push({ score: s, run: () => { this.startDribble(p, shield); p.decisionCd = 0.45; } });
        }
        // cut inside from the flank toward the edge of the box (inside forwards, inverted wingers, flair players)
        if ((p.rIP.id === 'if' || p.rIP.id === 'iw' || p.rIP.id === 'rau' || p.pers === 'flair') && myU > 0.6 && Math.abs(v - 0.5) > 0.18) {
          const target = this.clampPitch(this.fromUV(t, Math.min(0.88, myU + 0.08), 0.5 + Math.sign(v - 0.5) * 0.1));
          const space = this.nearestDist(target, opps);
          const pKeep = clamp(space / 8, 0.15, 1) * (0.5 + 0.5 * dribbling) * (1 - 0.35 * Math.min(1, pressure));
          const s = (pKeep * this.threat(t, target) * 1.5 - (1 - pKeep) * 0.25 * this.threat(opp, p.pos)) * w.dribble;
          opts.push({ score: s, run: () => { this.startDribble(p, target); p.cutUntil = this.time + 4; p.decisionCd = 0.8; } });
        }
        const holdUp = p.rIP.holdUp && myU > 0.5;
        opts.push({
          score: (here + 0.6 * retain) * (holdUp ? 0.75 : pressure < 0.3 ? 0.7 : 0.3) * (1 - 0.15 * ti.tempo) * (1 - counter - stale) * clamp(1 - (this.time - p.gotBallAt - 1) / (holdUp ? 4 : 2.5), 0, 1),
          run: () => { p.action = 'hold'; p.decisionCd = 0.35 - 0.1 * ti.tempo; },
        });
      }
      if (!opts.length && throwIn && mates.length) {
        // nobody in range: lob it to the nearest team-mate's area
        const nm = mates.reduce((a, c) => (dist(c.pos, p.pos) < dist(a.pos, p.pos) ? c : a));
        const aim = this.aimClamp(t, add(p.pos, scale(norm(sub(nm.pos, p.pos)), Math.min(throwMax, dist(nm.pos, p.pos)))));
        opts.push({ score: 0, run: () => this.pass(p, nm, aim, dist(p.pos, aim) > 9) });
      }
      if (!opts.length) { p.decisionCd = 0.3; return; }
      const noise = 0.15 - 0.12 * vision + 0.15 * Math.min(1, pressure) * (1 - this.attr(p, 'composure') / 99);
      let best = opts[0], bs = -Infinity;
      for (const o of opts) {
        const sc = o.score * (1 + (this.rng.next() - 0.5) * 2 * noise);
        if (sc > bs) { bs = sc; best = o; }
      }
      p.mustPass = false;
      best.run();
    }

    countTakeOn(p) {
      const to = p.takeOn;
      if (!to) return;
      if (this.time > to.until || this.ball.owner !== p.id) { p.takeOn = null; return; }
      const o = this.players[to.id];
      if (this.toU(p.team, o.pos.x) < this.toU(p.team, p.pos.x) - 0.8 / this.cfg.L || o.down > 0) {
        p.takeOn = null;
        this.stats[p.team].takeOns++;
        p.ps.takeOns++;
      }
    }
    startDribble(p, target) {
      p.dribbleTarget = target;
      p.action = 'dribble';
      p.decisionCd = 0.55 - 0.2 * this.tac(p.team).team.tempo;
      p.ps.dribbles++;
      // squaring up a defender in the path: if he ends up behind us with the ball still ours, that's a take-on
      if (!p.takeOn || this.time > p.takeOn.until) {
        p.takeOn = null;
        const myU = this.toU(p.team, p.pos.x);
        for (const o of this.onPitch) {
          if (o.team === p.team || o.isGK || o.down > 0) continue;
          const sd = this.segDist(o.pos, p.pos, target);
          if (sd.d < 2.2 && this.toU(p.team, o.pos.x) > myU && dist(o.pos, p.pos) < 4) { p.takeOn = { id: o.id, until: this.time + 2.5 }; break; }
        }
      }
      if (this.inTransition(p.team) && this.raw(p, 'accel') > 75 && this.nearestDist(target, this.teamOn(1 - p.team)) > 6) p.burstUntil = this.time + 2.5;
    }

    // a kick: sets the ball's flight, including its height arc (vz) so a lofted ball lands where it's meant to
    launch(dir, speed, lofted, d) {
      const b = this.ball;
      b.vel = scale(dir, speed);
      if (lofted) {
        const tf = travelTime(d, speed, AIR_K);
        b.vz = (GRAV * Math.min(tf, 3.2)) / 2;
      } else b.vz = 0;
      b.z = Math.max(b.z, 0.05);
      b.spin = (this.rng.next() - 0.5) * 30;
      b.gkTried = false;
    }

    pass(p, m, aim, lofted, cross) {
      const b = this.ball;
      // count back-and-forth exchanges between the same two players
      const pp = this.pingPong;
      this.pingPong = pp && pp.to === p.id && pp.from === m.id ? { from: p.id, to: m.id, n: pp.n + 1 } : { from: p.id, to: m.id, n: 1 };
      this.markOffside(p);
      if (p.throwIn) return this.throwBall(p, m, aim, lofted);
      if (cross && lofted && this.crossBlocked(p, aim)) return;
      const skill = this.attr(p, cross ? 'crossing' : 'passing') / 99, pressure = this.pressureOn(p), d = dist(p.pos, aim);
      const curveSkill = this.attr(p, 'curve') / 99 * p.rIP.w.curl * this.flair(p);
      const precise = !cross && d > 12 && this.toU(p.team, aim.x) > this.toU(p.team, m.pos.x) + 0.02 && this.rng.chance(clamp((this.attr(p, 'vision') - 70) / 60, 0, 0.4) + 0.15 * this.hm(p, 'threader'));
      const hmE = 1 - 0.14 * (cross ? this.hm(p, 'whip') : lofted || d > 28 ? Math.max(this.hm(p, 'quarterback'), p.isGK ? this.hm(p, 'launcher') : 0) : d < 20 ? this.hm(p, 'metronome') : 0);
      const blocker = !cross && !lofted && d > 8 ? this.laneBlocker(p, aim) : null;
      const curl = (blocker !== null && this.rng.chance(clamp(curveSkill - 0.35, 0, 0.85))) || (cross && this.rng.chance(clamp(curveSkill - 0.2, 0.15, 0.9)));
      const err = (0.01 + (1 - skill) * (cross ? 0.17 : 0.16) + pressure * 0.07 * (1.3 - (0.6 * this.attr(p, 'composure')) / 99) * (1 - 0.35 * this.hm(p, 'pressproof'))) * hmE * (lofted ? 1.3 : 1) * this.weather.passErr * (precise || curl ? 0.45 : 1) * (this.teams[p.team].passBonus > 1 ? 0.8 : 1) * (!lofted && d < 22 && this.tac(p.team).team.directness < 0 ? 0.8 : 1);
      let dir = rot(norm(sub(aim, p.pos)), this.rng.gauss() * err);
      let dErr = Math.max(3, d * (1 + this.rng.gauss() * err * 0.7));
      // the shank: under pressure a poor passer sometimes slices it badly
      if (!cross && !m.isGK && this.toU(p.team, p.pos.x) > 0.3 && this.rng.chance(0.03 + 0.1 * Math.min(1, pressure) * (1.1 - skill))) { dir = rot(dir, this.rng.gauss() * 0.5); dErr *= this.rng.range(1.15, 1.5); }
      let curve = 0;
      if (curl) {
        if (blocker) {
          const ab = sub(aim, p.pos), ao = sub(blocker.pos, p.pos);
          curve = ab.x * ao.y - ab.y * ao.x > 0 ? -1 : 1;
        } else {
          // crosses swing in toward goal: bend away from the keeper
          const g = this.attackGoal(p.team), ab = sub(aim, p.pos), ag = sub(g, p.pos);
          curve = ab.x * ag.y - ab.y * ag.x > 0 ? -1 : 1;
        }
        dir = rot(dir, curve * CURL_ANGLE);
      }
      const arc = curve ? CURL_ANGLE / Math.sin(CURL_ANGLE) : 1;
      const speed = kickSpeed(dErr * arc, lofted, this.groundK, this.weather.arrive);
      b.curl = curve ? (-curve * 2 * Math.sin(CURL_ANGLE)) / dErr : 0;
      b.curlTarget = { ...aim };
      b.owner = null;
      this.launch(dir, speed, lofted, dErr * arc);
      b.receiver = m.id; b.fumbler = null; b.passer = p.id; b.noTouchTimer = 0.3;
      b.lofted = lofted; b.loftFrom = { ...p.pos }; b.loftDist = dErr * arc; b.cross = cross;
      b.crossQuality = cross ? Math.min(1, skill + (curl ? 0.15 : 0) + 0.08 * this.hm(p, 'whip') + (this.freeRestart === p.id ? 0.08 * this.hm(p, 'deadeye') : 0)) : 0;
      b.threaded = precise || (curl && !cross);
      b.handOk = false;
      b.lastTeam = p.team; b.power = 0;
      this.stats[p.team].passes++;
      p.ps.passes++;
      if (cross) this.stats[p.team].crosses++;
      m.runTarget = null;
      p.action = 'position';
      p.decisionCd = 0.5;
      this.effect('pass', p.pos, p.team, { tx: aim.x, ty: aim.y, curve: curve || 0, lofted });
      if (curl && !cross && d > 15) this.effect('special', p.pos, p.team, { label: 'Curler', pid: p.data.id });
    }
    // the full-back gets in the way of the cross: off his shin, often behind for a corner
    crossBlocked(p, aim) {
      const b = this.ball, c = this.cfg, dir = norm(sub(aim, p.pos));
      let o = null;
      for (const q of this.onPitch) {
        if (q.team === p.team || q.isGK || q.down > 0) continue;
        const rel = sub(q.pos, p.pos), d = len(rel);
        if (d < 2.4 && dot(rel, dir) > 0.3 * d && (!o || d < dist(o.pos, p.pos))) o = q;
      }
      if (!o || !this.rng.chance(clamp(0.42 - 0.32 * (this.attr(p, 'crossing') / 99), 0.08, 0.32) * (1 - 0.25 * this.hm(p, 'whip')))) return false;
      this.stats[p.team].passes++; this.stats[p.team].crosses++; p.ps.passes++;
      this.stats[o.team].blocks++; o.ps.blocks++;
      const nearLine = this.toU(p.team, p.pos.x) > 0.78;
      const behind = vec(p.team === 0 ? c.L + 2 : -2, clamp(p.pos.y + this.rng.range(-4, 4), 1, c.W - 1));
      b.owner = null;
      b.vel = nearLine && this.rng.chance(0.7) ? this.deflectVel(o.pos, behind) : scale(rot(scale(dir, -1), this.rng.range(-1.2, 1.2)), this.rng.range(4, 9));
      b.pos = { ...o.pos }; b.z = 0.4; b.vz = this.rng.range(1, 4);
      b.receiver = null; b.passer = null; b.fumbler = o.id; b.noTouchTimer = 0.3; b.lastTeam = o.team;
      b.lofted = false; b.cross = false; b.curl = 0; b.shot = null; b.power = 0;
      p.action = 'position'; p.decisionCd = 0.5;
      this.effect('block', o.pos, o.team, { pid: o.data.id });
      return true;
    }
    // a throw-in: out of the hands, a looping lob (or a short one to feet); strength sets the range
    throwBall(p, m, aim, lofted) {
      const b = this.ball;
      p.throwIn = false;
      const maxD = this.throwRange(p);
      const d = Math.min(dist(p.pos, aim), maxD);
      const err = 0.03 + (1 - this.attr(p, 'passing') / 99) * 0.06 + this.pressureOn(p) * 0.03;
      const dir = rot(norm(sub(aim, p.pos)), this.rng.gauss() * err);
      const dErr = Math.max(2.5, d * (1 + this.rng.gauss() * err * 0.6));
      b.owner = null;
      if (lofted) {
        const speed = Math.min(17, AIR_K * dErr + 9);
        this.launch(dir, speed, true, dErr);
      } else {
        b.vel = scale(dir, Math.min(13, this.groundK * dErr + 4)); b.vz = 1;
      }
      b.z = 1.7; b.spin = 0;
      b.receiver = m.id; b.fumbler = null; b.passer = p.id; b.noTouchTimer = 0.3;
      b.lofted = lofted; b.loftFrom = { ...p.pos }; b.loftDist = dErr; b.cross = false; b.crossQuality = 0; b.threaded = false;
      b.curl = 0; b.curlTarget = { ...aim }; b.lastTeam = p.team; b.power = 0; b.handOk = true;
      this.stats[p.team].passes++;
      p.ps.passes++;
      m.runTarget = null;
      p.action = 'position';
      p.decisionCd = 0.5;
      this.effect('pass', p.pos, p.team, { tx: aim.x, ty: aim.y, curve: 0, lofted, throw: true });
    }
    throwRange(p) { return (12 + (18 * this.raw(p, 'strength')) / 99 + 7 * this.hm(p, 'longthrow')) * Math.max(0.6, this.cfg.k); }
    clear(p) {
      const b = this.ball, c = this.cfg;
      // pick the best of a fan of hoofs: upfield, away from the danger, toward a team-mate or into space,
      // the touchline as a safe fallback; poise decides how much thought goes into it
      const up = p.team === 0 ? 1 : -1, sideNear = p.pos.y < c.W / 2 ? -1 : 1;
      const comp = this.attr(p, 'composure') / 99, opps = this.teamOn(1 - p.team), mates = this.teamOn(p.team).filter(m => m.id !== p.id && !m.isGK);
      let dir = null, range = 0, bs = -Infinity;
      for (const ang of [-1.25, -0.8, -0.35, 0, 0.35, 0.8, 1.25]) {
        const dr = norm(vec(up * Math.cos(ang), Math.sin(ang)));
        const rg = this.rng.range(28, 46) * c.k;
        const land = add(p.pos, scale(dr, rg));
        const out = land.y < 0 || land.y > c.W;
        const lp = this.clampPitch(land);
        const mate = this.nearestDist(lp, mates), opp = this.nearestDist(lp, opps);
        const toward = Math.sign(dr.y) === sideNear ? 0.15 : 0;
        let s = out ? 0.45 : clamp((opp - mate) / 10, -0.6, 0.6) + 0.25 + toward;
        s += this.rng.gauss() * (0.5 - 0.35 * comp);
        if (s > bs) { bs = s; dir = dr; range = rg; }
      }
      b.owner = null;
      this.launch(dir, kickSpeed(range, true), true, range);
      b.lofted = true; b.loftFrom = { ...p.pos }; b.loftDist = range; b.cross = false; b.receiver = null; b.passer = p.id; b.noTouchTimer = 0.3; b.lastTeam = p.team; b.curl = 0; b.power = 0; b.handOk = false;
      b.offside = null;
      p.action = 'position'; p.decisionCd = 0.5;
      this.effect('pass', p.pos, p.team, { tx: p.pos.x + dir.x * range, ty: p.pos.y + dir.y * range, curve: 0, lofted: true });
    }
    laneBlocker(p, aim) {
      let best = null, bd = 2.5;
      for (const o of this.onPitch) {
        if (o.team === p.team || o.down > 0) continue;
        const { d, t } = this.segDist(o.pos, p.pos, aim);
        if (t > 0.15 && t < 0.85 && d < bd) { bd = d; best = o; }
      }
      return best;
    }

    // a shot: the outcome is settled on contact (goal / saved / miss / woodwork), then the ball flies there for real
    shoot(p, xg, header, pGoalOverride, bonus = 1, kind) {
      const b = this.ball, t = p.team, c = this.cfg;
      const kp = this.keeper(1 - t);
      const SHOT_CAL = 1.42; // arcade: finishing runs a touch hot vs xG (and blocked shots count xG but can't score)
      const dGoal = dist(p.pos, this.attackGoal(t));
      const skid = !header && dGoal > 16 * c.k ? 1 + this.weather.slick : 1;
      const open = pGoalOverride === undefined && !header;
      const flair = this.flair(p);
      // special strikes: a thunderbolt from distance, or a curler bent inside the post
      const power = open && dGoal > 17 * c.k && this.rng.chance((clamp((this.attr(p, 'strength') + this.attr(p, 'finishing') - 120) / 120, 0, 0.45) + 0.14 * this.hm(p, 'cannon')) * flair);
      const finesse = !power && open && this.rng.chance((clamp((this.attr(p, 'curve') - 55) / 70, 0, 0.6) * p.rIP.w.curl + 0.18 * this.hm(p, 'bender')) * flair);
      // the chip: a keeper off his line one-on-one gets the ball dinked over him
      const chip = open && !power && this.hm(p, 'chipper') > 0 && kp && kp.down <= 0 && dGoal < 20 * c.k && dist(kp.pos, p.pos) < 8 * Math.max(0.7, c.k) && dist(kp.pos, this.ownGoal(kp.team)) > 3.5 && this.rng.chance(0.35 + 0.25 * this.hm(p, 'chipper'));
      const cutIn = !header && this.time < p.cutUntil ? 1.12 : 1;
      const special = (power ? 1.15 + 0.06 * this.hm(p, 'cannon') : finesse ? 1.12 + 0.06 * this.hm(p, 'bender') : chip ? 1.2 + 0.1 * this.hm(p, 'chipper') : 1) * cutIn * bonus;
      // xg already carries angle, distance, pressure and bodies in the way; finisher and keeper scale it (~1 each at 70)
      const pGoal = pGoalOverride ?? clamp(xg * this.finishMult(p, header) * this.keeperMult(kp, dGoal < 12 * c.k) * skid * special * SHOT_CAL, 0.01, 0.9);
      const fin = this.attr(p, header ? 'heading' : 'finishing') / 99;
      // on target: accuracy falls with distance; whatever is on target and not in is the keeper's
      const pOn = pGoalOverride !== undefined ? clamp(pGoal + 0.1 + 0.08 * fin, 0, 0.97)
        : clamp(pGoal + (0.15 + 0.4 * fin) * clamp(1.25 - dGoal / (40 * c.k), 0.35, 1) * (header ? 0.8 : 1), pGoal, 0.95);
      const gx = t === 0 ? c.L + 0.5 : -0.5;
      let outcome, gy, gz;
      const roll = this.rng.next();
      if (roll < pGoal) {
        outcome = 'goal';
        // a good finisher picks the far side from the keeper; a scruffy one goes where it goes
        const away = kp && kp.pos.y < c.W / 2 ? 1 : -1;
        const side = this.rng.chance(0.4 + 0.5 * fin) ? away : -away;
        gy = c.W / 2 + side * this.rng.range(c.GW * 0.18, c.GW * 0.45);
        gz = chip ? this.rng.range(1.5, c.GH - 0.25) : this.rng.range(0.15, c.GH - 0.2);
      } else if (roll < pOn) {
        outcome = 'saved';
        gy = kp ? clamp(kp.pos.y + this.rng.gauss() * 1.6, c.GY0 + 0.4, c.GY1 - 0.4) : c.W / 2;
        gz = this.rng.range(0.2, 1.9);
      } else if (this.rng.chance(0.1)) {
        // off the woodwork!
        outcome = 'post';
        const bar = this.rng.chance(0.35);
        gy = bar ? c.W / 2 + this.rng.range(-c.GW / 2.5, c.GW / 2.5) : c.W / 2 + (this.rng.chance(0.5) ? 1 : -1) * (c.GW / 2 + 0.05);
        gz = bar ? c.GH + 0.05 : this.rng.range(0.3, 2);
      } else {
        outcome = 'miss';
        if (this.rng.chance(0.4)) { gy = c.W / 2 + this.rng.range(-c.GW / 2, c.GW / 2); gz = c.GH + this.rng.range(0.4, 3); }
        else { gy = c.W / 2 + (this.rng.chance(0.5) ? 1 : -1) * (c.GW / 2 + this.rng.range(0.4, 4)); gz = this.rng.range(0.1, 2.5); }
      }
      // struck harder from further out; headers are softer
      const speed = (pGoalOverride !== undefined ? 25 + 6 * fin
        : header ? clamp(11 + 0.35 * dGoal / c.k + 6 * fin, 12, 22) : clamp(17 + 0.45 * dGoal / Math.max(0.6, c.k) + 9 * fin, 18, 36)) + (power ? 8 : 0);
      b.offside = null;
      const aim = vec(gx, gy);
      let dir = norm(sub(aim, p.pos));
      const dd = dist(p.pos, aim);
      // a curler sets off wide and bends back onto the target
      let curve = 0;
      if (finesse || (kind === 'fk')) {
        curve = (gy < c.W / 2) === (t === 0) ? 1 : -1;
        if (this.rng.chance(0.5)) curve = -curve;
        dir = rot(dir, curve * CURL_ANGLE * 0.8);
        b.curl = (-curve * 2 * Math.sin(CURL_ANGLE * 0.8)) / dd;
      } else b.curl = 0;
      b.curlTarget = aim;
      b.owner = null;
      b.vel = scale(dir, speed);
      // vertical: rise so it arrives at the goal line at height gz
      const tg = travelTime(Math.abs(gx - p.pos.x) / Math.max(0.2, Math.abs(dir.x)), speed, SHOT_K);
      b.z = header ? 1.9 : 0.15;
      b.vz = (gz - b.z + 0.5 * GRAV * tg * tg) / Math.max(0.1, tg);
      b.spin = (this.rng.next() - 0.5) * 40;
      b.lofted = false; b.cross = false; b.receiver = null; b.passer = null; b.noTouchTimer = 0.3; b.lastTeam = t;
      b.power = power ? 1 : speed > 30 ? 0.5 : 0;
      b.shot = { team: t, shooter: p.id, outcome, gy, gz, close: dGoal < 12 * c.k, checked: pGoalOverride !== undefined ? this.onPitch.map(q => q.id) : [] };
      this.stats[t].shots++;
      this.stats[t].xg += pGoalOverride ?? xg;
      p.ps.shots++;
      if (outcome === 'goal' || outcome === 'saved') { this.stats[t].onTarget++; p.ps.onTarget++; }
      if (p.receivedFrom !== null && this.time - p.receivedAt < 4) { const from = this.players[p.receivedFrom]; if (from.team === t) from.ps.keyPasses++; }
      p.action = 'position';
      p.decisionCd = 0.5;
      this.effect(header ? 'header' : 'shot', p.pos, t, { power: b.power, curve, pid: p.data.id });
      if (power) this.effect('special', p.pos, t, { label: 'Thunderbolt', pid: p.data.id });
      else if (finesse && kind !== 'fk') this.effect('special', p.pos, t, { label: 'Finesse', pid: p.data.id });
      else if (chip) this.effect('special', p.pos, t, { label: 'Chip', pid: p.data.id });
      if (kp) kp.dive = 0;
    }

    // ── movement ──
    move(p) {
      const b = this.ball;
      // Blitz physics: knocked down / airborne players slide and tumble until they get up
      if (p.down > 0) {
        p.down -= TICK;
        p.vel = scale(p.vel, Math.exp(-3.2 * TICK));
        p.pos = add(p.pos, scale(p.vel, TICK));
        p.spinAng += p.spin * TICK;
        p.spin *= Math.exp(-3 * TICK);
        this.stepZ(p);
        this.clampBody(p, false);
        if (p.down <= 0) { p.down = 0; p.spinAng = 0; }
        return;
      }
      if (p.slide > 0) {
        p.slide -= TICK;
        p.vel = scale(p.vel, Math.exp(-2.2 * TICK));
        p.pos = add(p.pos, scale(p.vel, TICK));
        this.clampBody(p, false);
        return;
      }
      if (p.dive > 0) {
        p.dive -= TICK;
        p.vel = scale(p.vel, Math.exp(-1.8 * TICK));
        p.pos = add(p.pos, scale(p.vel, TICK));
        this.stepZ(p);
        if (p.dive <= 0) { p.dive = 0; p.down = 0.5; p.spin = 0; }
        this.clampBody(p, false);
        return;
      }
      const carrying = b.owner === p.id;
      const shield = p.rIP.holdUp ? 0.4 : 1;
      const jockeyed = carrying ? 1 - 0.12 * Math.min(1, this.pressureOn(p)) * (1.2 - (0.4 * this.attr(p, 'strength')) / 99) * shield * (1 - 0.4 * this.hm(p, 'pressproof')) : 1;
      const vmax = this.maxSpeed(p) * (carrying ? 0.82 + (0.12 * this.attr(p, 'dribbling')) / 99 : 1) * jockeyed;
      // tired legs: off-ball efforts lose their top end as the stamina goes (chasing the ball and pressing still go flat out)
      const effort = carrying || p.action === 'chase' || p.action === 'press' || p.action === 'block' ? p.urgency : Math.min(p.urgency, 0.88 + 0.12 * p.stamina);
      const cap = vmax * effort;
      const to = sub(p.target, p.pos), d = len(to);
      let desired = d < 0.25 ? vec() : scale(to, Math.min(cap, d * 2) / d);
      // a presser's target moves with the carrier: match his velocity as well, or he settles a couple of metres off him
      if (p.action === 'press' && b.owner !== null && this.players[b.owner].team !== p.team) {
        desired = add(desired, scale(this.players[b.owner].vel, 0.8));
        const dl = len(desired);
        if (dl > cap) desired = scale(desired, cap / dl);
      }
      for (const q of this.onPitch) {
        if (q === p || q.team !== p.team) continue;
        const dd = dist(p.pos, q.pos);
        if (dd < 2 && dd > 0.01) desired = add(desired, scale(sub(p.pos, q.pos), ((2 - dd) * 1.5) / dd));
      }
      let dv = sub(desired, p.vel);
      const dvl = len(dv), maxDv = this.accel(p) * TICK;
      if (dvl > maxDv) dv = scale(dv, maxDv / dvl);
      p.vel = add(p.vel, dv);
      p.pos = add(p.pos, scale(p.vel, TICK));
      this.stepZ(p);
      this.clampBody(p, carrying);
      // facing: where he's running, or toward the ball when still
      const sp = len(p.vel);
      const jockey = p.action === 'press' && dist(p.pos, b.pos) < 3.5;
      const face = sp > 0.6 && !jockey ? Math.atan2(p.vel.y, p.vel.x) : Math.atan2(b.pos.y - p.pos.y, b.pos.x - p.pos.x);
      let da = face - p.ang;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      p.ang += da * Math.min(1, TICK * 10);
      p.stride += sp * TICK;
      const frac = sp / (5.2 + (3.3 * this.raw(p, 'pace')) / 99);
      const ti = this.tac(p.team).team, side = this.teams[p.team];
      const drain = (0.00025 + 0.0011 * frac * frac) * (1.35 - (0.7 * this.raw(p, 'stamina')) / 99) * (p.action === 'press' ? 1.6 : 1)
        * (this.possession !== p.team ? 1 + 0.15 * ti.pressing : 1) * (1 + 0.12 * ti.tempo) * this.weather.stamina * (side.stamMult || 1) * (1 - 0.2 * this.hm(p, 'engine'));
      p.stamina = Math.max(0.2, p.stamina - drain * TICK);
    }
    stepZ(p) {
      if (p.z > 0 || p.vz > 0) {
        p.vz -= GRAV * TICK;
        p.z += p.vz * TICK;
        if (p.z <= 0) { p.z = 0; p.vz = 0; }
      }
    }
    clampBody(p, carrying) {
      const c = this.cfg, m = carrying ? 0.4 : -1.5;
      p.pos.x = clamp(p.pos.x, carrying ? m : -2.5, c.L - (carrying ? m : -2.5));
      p.pos.y = clamp(p.pos.y, carrying ? m : -2.5, c.W - (carrying ? m : -2.5));
    }
    // opponents running into each other: the weaker one bounces off (and sometimes goes down)
    collide() {
      const ps = this.onPitch;
      for (let i = 0; i < ps.length; i++) {
        const a = ps[i];
        if (a.down > 0 || a.isGK) continue;
        for (let j = i + 1; j < ps.length; j++) {
          const q = ps[j];
          if (q.team === a.team || q.down > 0 || q.isGK) continue;
          const dd = dist(a.pos, q.pos);
          if (dd > 0.95 || dd < 0.01) continue;
          const rel = len(sub(a.vel, q.vel));
          const n = norm(sub(q.pos, a.pos));
          // gently separate
          a.pos = add(a.pos, scale(n, -(0.95 - dd) / 2));
          q.pos = add(q.pos, scale(n, (0.95 - dd) / 2));
          if (rel < 7 || a.bumpCd > 0 || q.bumpCd > 0) continue;
          // only a real contest for the ball turns into a shoulder charge
          const owner = this.ball.owner, contest = owner === a.id || owner === q.id || a.action === 'chase' || q.action === 'chase' || a.action === 'press' || q.action === 'press';
          if (!contest) continue;
          a.bumpCd = q.bumpCd = 1.2;
          const sa = this.raw(a, 'strength') + (a.pers === 'hothead' ? 8 : 0) + 10 * this.hm(a, 'enforcer'), sq = this.raw(q, 'strength') + (q.pers === 'hothead' ? 8 : 0) + 10 * this.hm(q, 'enforcer');
          const [win, lose] = this.rng.next() < 0.5 + (sa - sq) / 120 ? [a, q] : [q, a];
          const dir = win === a ? n : scale(n, -1);
          const pw = clamp((rel - 5) / 6, 0.15, 1);
          if (this.rng.chance(0.12 + pw * 0.25)) this.knock(lose, dir, pw * 0.7, 'bump', win);
          else lose.vel = add(scale(lose.vel, 0.3), scale(dir, 3 + pw * 3));
        }
      }
    }
    // send a player flying: the signature Blitz moment
    knock(p, dir, power, kind = 'hit', by = null) {
      if (p.isGK && kind === 'bump') return;
      const b = this.ball;
      p.down = 0.5 + power * 0.9 + this.rng.range(0, 0.3);
      p.vel = add(scale(p.vel, 0.2), scale(dir, 3 + power * 7));
      p.vz = 1.2 + power * 3.8;
      p.z = 0.05;
      p.spin = (this.rng.chance(0.5) ? 1 : -1) * (5 + power * 12);
      p.runTarget = null;
      p.action = 'down';
      if (b.owner === p.id) {
        b.owner = null;
        b.vel = add(scale(dir, 4 + power * 4), vec(this.rng.range(-2, 2), this.rng.range(-2, 2)));
        b.vz = 2 + power * 3;
        b.receiver = null; b.passer = null; b.noTouchTimer = 0.2; b.fumbler = p.id;
      }
      this.stats[1 - p.team].hits++;
      if (by) by.ps.hits++;
      this.effect('hit', p.pos, 1 - p.team, { power, kind, pid: p.data.id });
      // the bigger the hit, the bigger the injury risk
      if (power > 0.55 && this.rng.chance((power - 0.5) * 0.09)) this.injure(p);
    }
    injure(p) {
      if (p.injured) return;
      p.injured = this.rng.chance(0.7) ? this.rng.int(3, 14) : this.rng.int(15, 60);
      this.emit('injury', p.team, `${p.data.ln} is hurt and can't continue`, { pid: p.data.id });
      this.effect('injury', p.pos, p.team, { pid: p.data.id });
      p.injuryAt = this.time;
    }

    // ── ball ──
    stepBallZ() {
      const b = this.ball;
      if (b.owner !== null) { b.z = 0; b.vz = 0; return; }
      if (b.z > 0 || b.vz > 0) {
        b.vz -= GRAV * TICK;
        b.z += b.vz * TICK;
        if (b.z <= 0) {
          b.z = 0;
          if (b.vz < -2.5) { b.vz = -b.vz * 0.45; this.effect('bounce', b.pos, b.lastTeam, { v: b.vz }); } else b.vz = 0;
        }
      }
      b.spin *= Math.exp(-0.6 * TICK);
    }
    updateBall() {
      const b = this.ball;
      if (b.noTouchTimer > 0) b.noTouchTimer -= TICK;
      if (b.owner !== null) {
        const o = this.players[b.owner], sp = len(o.vel);
        const dir = sp > 0.3 ? scale(o.vel, 1 / sp) : norm(sub(this.attackGoal(o.team), o.pos));
        b.pos = add(o.pos, scale(dir, 0.6));
        b.vel = { ...o.vel };
        b.z = 0; b.vz = 0;
        return;
      }
      const from = { ...b.pos };
      const k = b.shot ? SHOT_K : b.lofted ? AIR_K : this.groundK;
      b.pos = add(b.pos, scale(b.vel, TICK));
      if (b.curl && ((b.receiver !== null) || b.shot)) b.vel = rot(b.vel, b.curl * len(b.vel) * TICK);
      b.vel = scale(b.vel, Math.exp(-k * TICK));
      if (b.lofted) {
        const f = dist(b.pos, b.loftFrom) / Math.max(1, b.loftDist);
        // a cross that drops untouched dies on the bounce (it shouldn't trickle on into the net)
        if (f >= 1) { b.lofted = false; b.vel = scale(b.vel, b.cross ? 0.22 : LANDING_DAMP); if (b.cross) b.curl = 0; }
        else if (this.weather.gust) b.vel = add(b.vel, scale(this.wind, TICK));
      }
      if (b.shot) {
        if (this.checkShotBlock(from)) return;
        return this.checkShot();
      }
      const c = this.cfg;
      if (b.pos.y < 0 || b.pos.y > c.W) return this.throwIn();
      if (b.pos.x < 0 || b.pos.x > c.L) return this.byline();
      this.tryPickup(from);
    }
    checkShotBlock(from) {
      const b = this.ball, s = b.shot;
      for (const o of this.onPitch) {
        if (o.team === s.team || o.isGK || s.checked.includes(o.id) || o.down > 0) continue;
        const d = this.segDist(o.pos, from, b.pos).d;
        if (d > 0.95 + 0.2 * this.hm(o, 'brickwall') || b.z > 2) continue;
        s.checked.push(o.id);
        const placed = 1.35 - (0.7 * this.attr(this.players[s.shooter], 'finishing')) / 99;
        if (!this.rng.chance((0.3 + (0.3 * this.attr(o, 'positioning')) / 99) * placed * (1 + 0.2 * this.hm(o, 'brickwall')))) continue;
        this.stats[o.team].blocks++;
        o.ps.blocks++;
        if (s.outcome === 'goal' || s.outcome === 'saved') { this.stats[s.team].onTarget--; this.players[s.shooter].ps.onTarget--; }
        const c = this.cfg;
        const behind = this.rng.chance(0.5);
        // deflected behind: off for a corner, wide of the posts
        const wide = vec(s.team === 0 ? c.L + 1 : -1, c.W / 2 + (o.pos.y < c.W / 2 ? -1 : 1) * (c.GW / 2 + this.rng.range(1.5, 6)));
        const back = behind ? norm(sub(wide, o.pos)) : rot(norm(scale(b.vel, -1)), this.rng.range(-1.3, 1.3));
        const pw = len(b.vel) / 34;
        b.shot = null; b.curl = 0; b.pos = { ...o.pos };
        b.vel = behind ? this.deflectVel(o.pos, wide) : scale(back, this.rng.range(5, 13));
        b.vz = this.rng.range(1, 6);
        // the ball has just bounced off him: he can't instantly trap his own deflection
        b.receiver = null; b.passer = null; b.fumbler = o.id; b.noTouchTimer = 0.35; b.lastTeam = o.team;
        this.effect('block', o.pos, o.team, { pid: o.data.id });
        // a rocket to the body flattens him
        if (pw > 0.75 && this.rng.chance(0.5)) this.knock(o, norm(scale(back, -1)), pw * 0.6, 'block');
        return true;
      }
      return false;
    }
    // velocity for a deflection that should actually carry to `tgt` (behind for a corner, out for a throw)
    deflectVel(from, tgt, spare = [2, 6]) {
      const d = dist(from, tgt);
      return scale(norm(sub(tgt, from)), Math.min(30, this.groundK * d + this.rng.range(spare[0], spare[1])));
    }
    // the keeper comes for a ball in the air: one go per delivery; claim, punch, or flap (ball stays live)
    keeperClaim(kp, attTeam) {
      const b = this.ball;
      b.gkTried = true;
      let traffic = 0;
      for (const q of this.onPitch) if (q.team === attTeam && q.down <= 0 && dist(q.pos, b.pos) < 2.5) traffic++;
      const q = (0.6 * this.attr(kp, 'goalkeeping') + 0.25 * this.attr(kp, 'positioning') + 0.15 * this.attr(kp, 'composure')) / 99;
      const pClaim = clamp(0.08 + 0.55 * q + 0.07 * this.hm(kp, 'safehands') - 0.15 * traffic - (b.cross ? 0.4 * (b.crossQuality - 0.5) : 0), 0.08, 0.92) * this.weather.grip;
      if (this.rng.chance(pClaim)) { this.setOwner(kp); return true; }
      if (this.rng.chance(0.5)) {
        const away = rot(norm(sub(this.attackGoal(kp.team), kp.pos)), this.rng.range(-0.9, 0.9));
        const range = this.rng.range(12, 22) * Math.max(0.6, this.cfg.k);
        this.effect('save', kp.pos, kp.team, { pid: kp.data.id, power: 0 });
        this.launch(away, kickSpeed(range, true), true, range);
        b.gkTried = true;
        b.lofted = true; b.loftFrom = { ...b.pos }; b.loftDist = range; b.cross = false; b.receiver = null; b.passer = null; b.fumbler = kp.id; b.noTouchTimer = 0.3; b.lastTeam = kp.team; b.curl = 0; b.offside = null;
        return true;
      }
      return false;
    }
    tryPickup(from) {
      const b = this.ball, speed = len(b.vel);
      if (b.lofted && dist(b.pos, b.loftFrom) / b.loftDist < 0.82) return;
      if ((b.lofted || (b.cross && b.z > 1.2)) && b.passer !== null) {
        const attTeam = this.players[b.passer].team;
        // the keeper comes for it: one go per delivery, harder through traffic and against a good ball
        const kp = this.keeper(1 - attTeam);
        if (kp && !b.gkTried && kp.down <= 0 && b.z <= 2.9 && this.inAttackingBox(attTeam, b.pos) && dist(kp.pos, b.pos) < 1.4 && this.keeperClaim(kp, attTeam)) return;
        let att = null;
        for (const p of this.onPitch) if (p.team === attTeam && !p.isGK && p.down <= 0 && dist(p.pos, b.pos) < 2.5 && (!att || dist(p.pos, b.pos) < dist(att.pos, b.pos))) att = p;
        if (att) return this.aerialDuel(att);
      }
      const near = [];
      for (const p of this.onPitch) {
        if (p.down > 0 || p.slide > 0.25) continue;
        if (b.noTouchTimer > 0 && (p.id === b.passer || p.id === b.fumbler)) continue;
        if (b.z > (p.isGK ? 2.8 : 2.1)) continue;
        const r = p.isGK && this.inAttackingBox(1 - p.team, p.pos) ? 1.6 : p.id === b.receiver ? 1.5 : CONTROL_RADIUS + 0.2 * this.hm(p, 'ballhawk');
        const d = this.segDist(p.pos, from, b.pos).d;
        if (d <= r) near.push({ p, d });
      }
      if (!near.length) return;
      near.sort((a, c) => a.d - c.d);
      for (const { p } of near) {
        // in his own box the keeper uses his hands — unless a team-mate deliberately kicked it back to him
        const backPass = b.passer !== null && this.players[b.passer].team === p.team && !b.handOk;
        if (p.isGK && this.inAttackingBox(1 - p.team, p.pos) && speed < 16 && !backPass) {
          // a cross still in the air is a claim, not a gather; once it's down he just picks it up
          if (b.cross && b.z > 0.8 && b.passer !== null) { if (b.gkTried || !this.keeperClaim(p, 1 - p.team)) continue; return; }
          return this.setOwner(p);
        }
        if (p.id === b.receiver) {
          if (this.offsideCheck(p)) return;
          const tech = (0.6 * this.attr(p, 'dribbling') + 0.4 * this.attr(p, 'composure')) / 99;
          // a heavy touch: pressure makes it likelier, and a hard-hit ball beats a poor first touch on its own
          const heavy = (clamp((speed - 5) / 30 + (b.cross ? 0.1 : 0), 0, 0.4) * (0.15 + 0.85 * Math.min(1, this.pressureOn(p))) + clamp((speed - 13) / 45, 0, 0.12)) * (1.1 - tech) * this.weather.touch * (1 - 0.4 * this.hm(p, 'velcro'));
          if (this.rng.chance(heavy)) {
            b.vel = scale(rot(vec(1, 0), this.rng.range(0, Math.PI * 2)), this.rng.range(2, 4));
            b.receiver = null; b.passer = null; b.lofted = false; b.cross = false; b.fumbler = p.id; b.noTouchTimer = 0.3; b.curl = 0;
            return;
          }
          const lowCross = b.cross && this.inAttackingBox(p.team, p.pos);
          this.setOwner(p);
          // a low ball across the box is met first time
          if (lowCross && this.ball.owner === p.id) p.decisionCd = 0.05;
          return;
        }
        const marker = b.receiver !== null && this.marks.get(p.id) === b.receiver ? (0.25 * this.attr(p, 'marking')) / 99 : 0;
        const killer = b.threaded && b.receiver !== null && b.passer !== null && this.players[b.passer].team !== p.team ? 0.35 : 1;
        const chance = clamp(1.1 - speed / 30, 0.3, 0.95) * (0.45 + (0.65 * this.attr(p, 'positioning')) / 99 + marker) * killer * (1 + 0.15 * this.hm(p, 'ballhawk'));
        if (this.rng.chance(chance)) {
          if (this.offsideCheck(p)) return;
          // a fast ball only gets a toe poked at it: it deflects off and runs loose
          if (b.receiver !== null && speed > 9 && this.rng.chance(b.cross ? 0.45 : 0.3)) {
            const deep = this.toU(p.team, p.pos.x) < 0.2, c = this.cfg;
            // near his own byline a defender's touch usually sends it behind for a corner
            const wide = vec(p.team === 0 ? -1 : c.L + 1, c.W / 2 + (p.pos.y < c.W / 2 ? -1 : 1) * (c.GW / 2 + this.rng.range(2, 9)));
            // ...and near the touchline it usually skews out for a throw
            const edgeY = p.pos.y < c.W / 2 ? -1 : c.W + 1, nearLine = Math.abs(edgeY - p.pos.y) < 7;
            b.vel = deep && this.rng.chance(0.7) ? this.deflectVel(p.pos, wide)
              : nearLine && this.rng.chance(0.55) ? this.deflectVel(p.pos, vec(p.pos.x + b.vel.x * 0.3 + this.rng.range(-3, 3), edgeY))
              : scale(rot(norm(b.vel), this.rng.range(-1.4, 1.4)), speed * this.rng.range(0.35, 0.6));
            b.vz = this.rng.range(0, 3); b.receiver = null; b.passer = null; b.lofted = false; b.cross = false; b.curl = 0; b.fumbler = p.id; b.noTouchTimer = 0.25; b.lastTeam = p.team;
            return;
          }
          return this.setOwner(p);
        }
      }
    }
    aerialDuel(att) {
      const b = this.ball;
      if (this.offsideCheck(att)) return;
      let def = null;
      for (const o of this.onPitch) {
        if (o.team === att.team || o.down > 0 || dist(o.pos, att.pos) > 2.5) continue;
        if (!def || this.aerialScore(o) > this.aerialScore(def)) def = o;
      }
      const delivery = b.cross ? (b.crossQuality - 0.6) * 0.6 : 0;
      // a whipped-in, well-placed cross makes the header itself easier
      const ballQ = b.cross ? 0.7 + 0.6 * b.crossQuality : 1;
      const attWins = !def || this.rng.chance(clamp(0.5 + (this.aerialScore(att) - this.aerialScore(def)) / 99 + delivery, 0.15, 0.85));
      // both go up: Blitz rules, someone usually ends up on the floor
      att.z = 0.05; att.vz = 3.2;
      if (def) { def.z = 0.05; def.vz = 3; }
      if (attWins) {
        if (def) {
          att.ps.aerials++;
          if (this.rng.chance(0.3)) this.knock(def, norm(sub(def.pos, att.pos)), 0.35, 'aerial', att);
        }
        const dGoal = dist(att.pos, this.attackGoal(att.team));
        // the acrobatic finish: a bicycle kick, only for a high ball dropping from behind him (rare)
        const toGoal = norm(sub(this.attackGoal(att.team), att.pos)), bv = len(b.vel);
        const fromBehind = bv > 0.5 && dot(scale(b.vel, 1 / bv), toGoal) > 0.2;
        if (dGoal < 16 * this.cfg.k && fromBehind && b.z > 1.4 && this.rng.chance((clamp((this.attr(att, 'finishing') + this.attr(att, 'accel') - 125) / 1600, 0, 0.015) + 0.012 * this.hm(att, 'acrobat')) * this.flair(att))) {
          b.pos = { ...att.pos };
          att.spin = 14; att.down = 0.9; att.vz = 4; att.z = 0.3;
          this.effect('special', att.pos, att.team, { label: 'Bicycle kick', pid: att.data.id });
          return this.shoot(att, this.shotXg(att, def ? 0.4 : 0, false), false, undefined, 1.25, 'bike');
        }
        // a header at goal when it's on; further out (or facing away) he cushions it down instead
        const angOk = this.angleXg(att.team, att.pos) > 0.06;
        const goFor = this.rng.chance(clamp(0.2 + 0.5 * (this.attr(att, 'heading') / 99) + (b.cross ? 0.15 : 0) + 0.08 * this.hm(att, 'powerhead') - dGoal / (40 * this.cfg.k), 0.15, 0.85));
        if (dGoal < 14 * this.cfg.k && angOk && goFor) {
          b.pos = { ...att.pos };
          // a diving header for the low ones
          if (this.rng.chance(0.25)) { att.dive = 0.5; att.diveDir = 0; att.vel = scale(norm(sub(this.attackGoal(att.team), att.pos)), 6); }
          return this.shoot(att, clamp(this.shotXg(att, def ? 0.4 : 0, true) * ballQ, 0.005, 0.8), true);
        }
        // won it but no header on: cushioned down to his feet (from a stretch it drops a yard in front of him)
        if (dist(att.pos, b.pos) <= 1.6) return this.setOwner(att);
        const to = sub(att.pos, b.pos);
        b.vel = scale(norm(to), 2 + 2 * len(to)); b.vz = 0.5; b.z = Math.min(b.z, 1.2);
        b.lofted = false; b.cross = false; b.receiver = att.id; b.fumbler = null; b.noTouchTimer = 0; b.curl = 0; b.offside = null; b.lastTeam = att.team; // passer kept: it still counts as his completed pass
        return;
      }
      def.ps.aerials++;
      this.effect('header', def.pos, def.team, { pid: def.data.id });
      const cc = this.cfg;
      if ((b.cross || this.inAttackingBox(att.team, def.pos)) && this.toU(def.team, def.pos.x) < 0.16 && this.rng.chance(0.55)) {
        // nodded behind for a corner
        const wide = vec(def.team === 0 ? -1 : cc.L + 1, cc.W / 2 + (def.pos.y < cc.W / 2 ? -1 : 1) * (cc.GW / 2 + this.rng.range(2, 7)));
        b.vel = this.deflectVel(def.pos, wide); b.vz = this.rng.range(2, 5);
        b.lofted = false; b.cross = false; b.receiver = null; b.passer = null; b.fumbler = def.id; b.noTouchTimer = 0.35; b.lastTeam = def.team; b.curl = 0; b.offside = null;
        return;
      }
      if (this.rng.chance(0.35)) this.knock(att, norm(sub(att.pos, def.pos)), 0.3, 'aerial', def);
      if (this.rng.chance(b.cross ? 0.2 : 0.35)) {
        b.vel = scale(rot(norm(sub(this.attackGoal(def.team), def.pos)), this.rng.range(-1.7, 1.7)), this.rng.range(3, 7));
        b.vz = this.rng.range(2, 5);
        b.lofted = false; b.cross = false; b.receiver = null; b.passer = null; b.noTouchTimer = 0.2; b.lastTeam = def.team; b.curl = 0;
        return;
      }
      const away = rot(norm(sub(this.attackGoal(def.team), def.pos)), this.rng.range(-0.7, 0.7));
      const range = this.rng.range(18, 30) * Math.max(0.6, this.cfg.k);
      this.launch(away, kickSpeed(range, true), true, range);
      b.lofted = true; b.loftFrom = { ...b.pos }; b.loftDist = range; b.cross = false; b.receiver = null; b.passer = def.id; b.noTouchTimer = 0.3; b.lastTeam = def.team; b.curl = 0; b.handOk = true; b.offside = null;
    }
    setOwner(p) {
      const b = this.ball;
      if (this.offsideCheck(p)) return;
      b.fumbler = null;
      p.gotBallAt = this.time;
      p.throwIn = false;
      const prev = this.possession;
      let turn = 0;
      if (b.passer !== null && !b.shot) {
        const passer = this.players[b.passer];
        if (passer.team === p.team && passer.id !== p.id) {
          this.stats[p.team].passesOk++;
          passer.ps.passesOk++;
          p.receivedFrom = passer.id;
          p.receivedAt = this.time;
          // first touch: receiving facing the ball with goal behind him, he needs time to open up and turn
          const sp = len(b.vel);
          if (sp > 1) {
            const facing = scale(b.vel, -1 / sp), toGoal = norm(sub(this.attackGoal(p.team), p.pos));
            const ang = Math.acos(clamp(dot(facing, toGoal), -1, 1)) / Math.PI;
            const tech = (0.5 * this.attr(p, 'dribbling') + 0.5 * this.attr(p, 'composure')) / 99;
            turn = 0.3 * ang * ang * (1.25 - tech) * (1 - 0.3 * this.hm(p, 'velcro')) - 0.04 * this.hm(p, 'velcro');
          }
        } else if (passer.team !== p.team && !p.isGK) {
          this.stats[p.team].interceptions++;
          p.ps.interceptions++;
        }
      }
      b.owner = p.id; b.vel = vec(); b.receiver = null; b.passer = null; b.lofted = false; b.cross = false; b.threaded = false; b.curl = 0; b.shot = null; b.z = 0; b.vz = 0; b.lastTeam = p.team; b.power = 0;
      const ti = this.tac(p.team).team;
      p.decisionCd = 0.25 + 0.3 * (1 - this.attr(p, 'composure') / 99) - 0.08 * ti.tempo + turn;
      p.action = 'hold';
      p.runTarget = null;
      if (p.team !== prev) {
        this.lostBallAt[prev] = this.time;
        this.regainAt[p.team] = this.time;
        this.possStart[p.team] = this.time;
        for (const q of this.onPitch) if (q.team === prev) q.runTarget = null;
      }
      this.possession = p.team;
      // the keeper only settles and holds it in his own box; a sweeper winning it outside just plays on
      if (p.isGK && p.team !== prev && this.inAttackingBox(1 - p.team, p.pos)) this.startKeeperReset(p);
    }
    checkShot() {
      const b = this.ball, s = b.shot, c = this.cfg, def = 1 - s.team, kp = this.keeper(def);
      if (s.outcome === 'saved' && kp && dist(b.pos, kp.pos) < 1.9 && kp.down <= 0.3) return this.resolveSave(kp);
      const crossed = s.team === 0 ? b.pos.x >= c.L : b.pos.x <= 0;
      if (crossed) {
        if (s.outcome === 'goal') return this.goal(s.team, this.players[s.shooter]);
        if (s.outcome === 'saved' && kp) return this.resolveSave(kp);
        if (s.outcome === 'post') return this.woodwork();
        this.emit('miss', s.team, `${this.players[s.shooter].data.ln} ${s.gz > c.GH ? 'blazes it over' : 'drags it wide'}`, { pid: this.players[s.shooter].data.id });
        return this.goalKick(def, b.pos.y);
      }
      if (len(b.vel) < 2) { b.shot = null; b.curl = 0; }
    }
    woodwork() {
      const b = this.ball, s = b.shot, c = this.cfg;
      this.stats[s.team].woodwork++;
      this.emit('post', s.team, `${this.players[s.shooter].data.ln} smacks the ${s.gz > c.GH ? 'crossbar' : 'post'}!`, { pid: this.players[s.shooter].data.id });
      this.effect('post', { x: s.team === 0 ? c.L : 0, y: b.pos.y }, s.team);
      b.pos.x = s.team === 0 ? c.L - 0.4 : 0.4;
      b.vel = { x: -b.vel.x * 0.45, y: b.vel.y * 0.5 + this.rng.range(-5, 5) };
      b.vz = this.rng.range(2, 6);
      b.shot = null; b.curl = 0; b.receiver = null; b.passer = null; b.noTouchTimer = 0.15; b.lastTeam = 1 - s.team;
    }
    resolveSave(kp) {
      const b = this.ball, c = this.cfg;
      const shooter = b.shot ? this.players[b.shot.shooter] : null;
      const power = b.power;
      this.emit('save', kp.team, `Save! ${kp.data.ln} denies ${shooter ? shooter.data.ln : 'the shot'}`, { pid: kp.data.id });
      kp.ps.saves++;
      this.stats[kp.team].saves++;
      this.effect('save', kp.pos, kp.team, { pid: kp.data.id, power });
      b.pos = { x: clamp(b.pos.x, 0.3, c.L - 0.3), y: clamp(b.pos.y, 0.3, c.W - 0.3) };
      if (b.shot && b.shot.close && this.hm(kp, 'reflexes')) this.effect('special', kp.pos, kp.team, { label: 'Cat Reflexes', pid: kp.data.id });
      const held = this.rng.chance((0.35 + (0.35 * this.attr(kp, 'goalkeeping')) / 99 + (0.15 * this.attr(kp, 'composure')) / 99 + 0.1 * this.hm(kp, 'safehands')) * this.weather.grip * (power ? 0.6 : 1));
      if (held && dist(kp.pos, b.pos) < 1.8) { b.shot = null; this.setOwner(kp); return; }
      // parried — a thunderbolt can knock the keeper clean off his feet
      if (power && this.rng.chance(0.5)) this.knock(kp, norm(b.vel), 0.5, 'save');
      const corner = this.rng.chance(0.4);
      b.shot = null; b.curl = 0;
      if (corner) {
        // tipped round the post: aim for the byline a couple of metres outside the goal
        const side = kp.pos.y < c.W / 2 ? -1 : 1;
        const lineX = kp.team === 0 ? 0 : c.L;
        b.pos = { x: kp.team === 0 ? Math.max(b.pos.x, 1) : Math.min(b.pos.x, c.L - 1), y: b.pos.y };
        const cy = c.W / 2 + side * (c.GW / 2 + this.rng.range(2, 6));
        const tgt = vec(lineX + (kp.team === 0 ? -0.6 : 0.6), Math.abs(cy - c.W / 2) > Math.abs(b.pos.y - c.W / 2) + 1 ? cy : b.pos.y + side * 3);
        b.vel = this.deflectVel(b.pos, tgt, [3, 7]);
      } else b.vel = scale(norm(rot(norm(sub(this.attackGoal(kp.team), kp.pos)), this.rng.range(-1.2, 1.2))), this.rng.range(7, 13));
      b.vz = this.rng.range(2, 7);
      // parried: the keeper can't simply gather his own parry on the next frame
      b.receiver = null; b.passer = null; b.fumbler = kp.id; b.noTouchTimer = 0.4; b.lastTeam = kp.team;
    }
    goal(team, scorer) {
      const b = this.ball;
      this.score[team]++;
      let text, assist = null;
      if (scorer && scorer.team === team) {
        scorer.ps.goals++;
        const helper = scorer.receivedFrom !== null && this.time - scorer.receivedAt < 10 ? this.players[scorer.receivedFrom] : null;
        if (helper && helper.team === team) { helper.ps.assists++; assist = helper; }
        text = `GOAL! ${scorer.data.fn[0]}. ${scorer.data.ln}${assist ? ` (${assist.data.ln})` : ''}`;
        const n = (this.goalsBy.get(scorer.id) || 0) + 1;
        this.goalsBy.set(scorer.id, n);
        // two goals and he's on fire
        if (n >= 2) {
          const was = this.time < scorer.fire;
          scorer.fire = this.time + FIRE_SECS;
          if (!was) { this.effect('fire', scorer.pos, team, { pid: scorer.data.id }); this.emit('fire', team, `${scorer.data.ln} is ON FIRE!`, { pid: scorer.data.id }); }
        }
        if (n === 3) this.emit('hattrick', team, `HAT-TRICK for ${scorer.data.ln}!`, { pid: scorer.data.id });
        scorer.celebrate = 3.4;
      } else text = 'GOAL! Own goal';
      const kp = this.keeper(1 - team);
      if (kp) kp.ps.conceded++;
      for (const p of this.onPitch) if (p.team !== team && !p.isGK) p.ps.conceded++;
      this.emit('goal', team, `${text} · ${this.teams[0].short} ${this.score[0]}-${this.score[1]} ${this.teams[1].short}`, { pid: scorer && scorer.team === team ? scorer.data.id : null, apid: assist ? assist.data.id : null, score: [...this.score] });
      this.effect('goal', b.pos, team, { pid: scorer ? scorer.data.id : null });
      this.momentum = clamp(this.momentum + (team === 0 ? 0.5 : -0.5), -1, 1);
      b.shot = null; b.curl = 0;
      b.vel = scale(b.vel, 0.15);
      this.celebrator = scorer && scorer.team === team ? scorer.id : null;
      this.setRestart('kickoff', 1 - team, vec(this.cfg.L / 2, this.cfg.W / 2), 3.6, false);
    }
    throwIn() {
      const b = this.ball, c = this.cfg;
      this.stats[1 - b.lastTeam].throwIns++;
      this.setRestart('throwin', 1 - b.lastTeam, vec(clamp(b.pos.x, 1, c.L - 1), b.pos.y < 0 ? 0.3 : c.W - 0.3), undefined, false);
    }
    byline() {
      const b = this.ball, c = this.cfg;
      const defTeam = b.pos.x < 0 ? 0 : 1, attTeam = 1 - defTeam;
      if (b.pos.y > c.GY0 && b.pos.y < c.GY1 && b.z < c.GH) {
        const by = b.lastTeam === attTeam && b.passer !== null ? this.players[b.passer] : null;
        return this.goal(attTeam, by && by.team === attTeam ? by : null);
      }
      if (b.lastTeam === defTeam) {
        this.stats[attTeam].corners++;
        const x = b.pos.x < 0 ? 0.5 : c.L - 0.5;
        return this.setRestart('corner', attTeam, vec(x, b.pos.y < c.W / 2 ? 0.5 : c.W - 0.5), undefined, false);
      }
      this.goalKick(defTeam, b.pos.y);
    }
    goalKick(team, y, out = true) {
      const c = this.cfg, x = team === 0 ? c.SIX_D : c.L - c.SIX_D;
      this.stats[team].goalKicks++;
      this.setRestart('goalkick', team, vec(x, c.W / 2 + (y < c.W / 2 ? -c.SIX_W / 3 : c.SIX_W / 3)), undefined, !out);
    }

    // ── challenges ──
    resolveChallenges() {
      if (this.reset) return;
      const carrier = this.players[this.ball.owner];
      for (const def of this.onPitch) {
        if (def.team === carrier.team || def.down > 0 || def.slide > 0) { def.engT = 0; continue; }
        const d = dist(def.pos, carrier.pos);
        // how long he's been right on the carrier: the longer he's engaged, the sooner he commits
        def.engT = d < 2 ? (def.engT || 0) + TICK : 0;
        if (def.tackleCd > 0) continue;
        const slider = this.raw(def, 'tackling') + this.raw(def, 'aggression') > 120 || def.pers === 'hothead' || this.hm(def, 'slider') > 0;
        if (d > (slider ? 2.8 : 1.7)) continue;
        if (def.isGK && !this.inAttackingBox(carrier.team, carrier.pos)) continue;
        const ti = this.tac(def.team).team, side = this.teams[def.team];
        const agg = ti.tackling * 0.5 + def.instr.agg * 0.35 + (this.raw(def, 'aggression') - 50) / 100 + (def.pers === 'hothead' ? 0.25 : 0);
        const box = this.inAttackingBox(carrier.team, carrier.pos);
        const rate = 0.38 * (1 + 0.35 * agg) * def.rOOP.w.tackle * (this.pressers.has(def.id) ? 1.4 + 0.3 * ti.pressing : 1) * (box ? 0.7 : 1) * (1 + 1.6 * clamp((def.engT - 0.3) / 0.7, 0, 1));
        if (!this.rng.chance(rate * TICK)) continue;
        const slide = d > 1.7;
        if (slide && !this.rng.chance(0.5)) continue;
        // a standing tackle needs him goal-side or facing the ball; from behind only a slide (and that's risky)
        const toCar = norm(sub(carrier.pos, def.pos));
        const facing = Math.cos(def.ang) * toCar.x + Math.sin(def.ang) * toCar.y > 0.3;
        const goalSide = this.toU(carrier.team, def.pos.x) > this.toU(carrier.team, carrier.pos.x) - 0.4 / this.cfg.L;
        // running level with him: a shoulder-to-shoulder challenge is fair game
        const csp = len(carrier.vel), along = csp > 1 ? scale(carrier.vel, 1 / csp) : norm(sub(this.attackGoal(carrier.team), carrier.pos));
        const beside = Math.abs(dot(sub(def.pos, carrier.pos), along)) < 0.8;
        if (!slide && !facing && !goalSide && !beside) continue;
        const behind = !goalSide && !facing && !beside, shoulder = !goalSide && !facing && beside;
        def.tackleCd = 1.5;
        this.stats[def.team].tackles++;
        def.ps.tackles++;
        if (slide) {
          // the slide: launch along the ground at the ball
          def.slide = 0.7;
          def.vel = scale(norm(sub(carrier.pos, def.pos)), 8.5);
          def.ang = Math.atan2(def.vel.y, def.vel.x);
          this.effect('slide', def.pos, def.team, { pid: def.data.id, ang: def.ang });
        }
        // a flair player can flick it over the challenge
        if (this.rng.chance((clamp((this.attr(carrier, 'dribbling') - 72) / 110, 0, 0.18) + 0.09 * this.hm(carrier, 'trickster')) * this.flair(carrier))) {
          def.tackleCd = 1.6;
          if (!slide) def.vel = vec();
          carrier.decisionCd = Math.min(carrier.decisionCd, 0.1);
          this.effect('special', carrier.pos, carrier.team, { label: U.pick(['Rainbow flick', 'Nutmeg', 'Roulette', 'Elastico']), pid: carrier.data.id });
          continue;
        }
        const tk = this.attr(def, def.isGK ? 'goalkeeping' : 'tackling'), dr = this.attr(carrier, 'dribbling');
        const shield = carrier.rIP.holdUp && this.toU(carrier.team, carrier.pos.x) > 0.5;
        const pFoul = clamp((0.19 + 0.07 * agg + 0.1 * Math.max(0, agg) + 0.22 * (1 - tk / 99)) * (box ? 0.42 : 1) * (slide ? 1.3 * (1 - 0.25 * this.hm(def, 'slider')) : 1 - 0.2 * this.hm(def, 'shadow')) * (behind ? 1.8 : shoulder ? 1.25 : 1), 0.04, 0.75);
        const pWin = clamp(0.42 + ((tk - dr) / 99) * 0.7 + 0.03 * agg + ((this.raw(def, 'strength') - this.raw(carrier, 'strength')) / 99) * (shield ? 0.6 : 0.2) + (slide ? 0.15 : 0) - (shield ? 0.15 : 0) + (side.pressBonus && this.pressers.has(def.id) ? 0.06 : 0) + (slide ? 0.06 * this.hm(def, 'slider') : 0.05 * this.hm(def, 'shadow')) + 0.04 * this.hm(def, 'enforcer') - 0.06 * this.hm(carrier, 'pressproof') - 0.04 * this.hm(carrier, 'trickster') - (shoulder ? 0.08 : 0), 0.05, 0.85);
        if (this.rng.chance(pFoul)) return this.foul(def, carrier, agg, slide, behind);
        if (this.rng.chance(pWin)) {
          this.stats[def.team].tacklesWon++;
          def.ps.tacklesWon++;
          this.effect('tackle', def.pos, def.team, { pid: def.data.id });
          // a full-blooded challenge sends the carrier flying
          const hard = clamp(0.25 + agg * 0.35 + (this.raw(def, 'strength') - this.raw(carrier, 'strength')) / 140 + (slide ? 0.2 : 0) + (side.blitz ? 0.15 : 0) + 0.15 * this.hm(def, 'enforcer'), 0.1, 1);
          const dir = norm(add(sub(carrier.pos, def.pos), scale(carrier.vel, 0.15)));
          if (this.rng.chance(0.12 + hard * 0.3)) this.knock(carrier, dir, hard, 'tackle', def);
          // he wins it: right on top of the ball he just takes it; from further out (a slide, a long leg) it's poked to him
          const take = () => {
            if (d <= 1.2) { this.setOwner(def); return; }
            const b = this.ball, to = sub(def.pos, b.pos);
            b.owner = null; b.vel = scale(norm(to), Math.min(9, 2 + 2.2 * len(to))); b.vz = 0;
            b.receiver = def.id; b.passer = null; b.fumbler = carrier.id; b.noTouchTimer = 0.3; b.lastTeam = def.team; b.lofted = false; b.cross = false; b.curl = 0; b.shot = null; b.offside = null;
          };
          if (this.ball.owner === null || this.rng.chance(0.65)) {
            if (this.ball.owner !== null) { take(); return; }
            // ball spills loose; the tackler usually gets to it
            if (!slide && this.rng.chance(0.5)) { take(); return; }
            return;
          }
          const b = this.ball;
          b.owner = null;
          const cw = this.cfg.W, edgeY = carrier.pos.y < cw / 2 ? -1 : cw + 1;
          // poked away: near a touchline the tackler often just puts it out of play
          b.vel = Math.abs(edgeY - carrier.pos.y) < 6 && this.rng.chance(0.5)
            ? scale(norm(vec(this.rng.range(-0.6, 0.6), Math.sign(edgeY - carrier.pos.y))), this.rng.range(5, 9))
            : scale(rot(vec(1, 0), this.rng.range(0, Math.PI * 2)), this.rng.range(4, 8));
          b.passer = null; b.receiver = null; b.noTouchTimer = 0.15; b.lastTeam = def.team;
          carrier.decisionCd = 0.4;
          return;
        }
        // whiffed it: the tackler ends up on the floor
        if (slide || this.rng.chance(0.25)) { def.down = slide ? 0.5 : 0.35; def.spin = 0; this.effect('whiff', def.pos, def.team, { pid: def.data.id }); }
        else def.vel = scale(def.vel, 0.2);
      }
    }
    foul(def, victim, agg, slide, behind = false) {
      const st = this.stats[def.team];
      st.fouls++;
      def.ps.fouls++;
      const brutal = clamp(0.35 + agg * 0.4 + (slide ? 0.25 : 0), 0.2, 1);
      this.knock(victim, norm(add(sub(victim.pos, def.pos), scale(victim.vel, 0.1))), brutal, 'foul', def);
      this.effect('foul', victim.pos, def.team, { pid: def.data.id });
      // straight reds are rare (a brutal lunge from behind); cards mostly for the reckless
      const pRed = clamp(0.001 + 0.003 * Math.max(0, agg) + (brutal > 0.85 && slide && behind ? 0.02 : brutal > 0.85 ? 0.004 : 0), 0, 0.05);
      // a booked player is given more leeway before the second yellow
      const pYellow = clamp(0.2 + 0.1 * agg + (slide ? 0.06 : 0) + (behind ? 0.1 : 0), 0.05, 0.55) * (def.yellows >= 1 ? 0.25 : 1);
      const r = this.rng.next();
      if (r < pRed || (r < pRed + pYellow && def.yellows >= 1)) {
        def.yellows++;
        st.reds++;
        def.ps.red++;
        def.sentOff = true;
        def.active = false;
        def.offAt = this.time;
        if (this.ball.owner === def.id) this.ball.owner = null;
        this.refreshOnPitch();
        this.effect('card', def.pos, def.team, { red: true, pid: def.data.id });
        this.emit('red', def.team, `RED CARD! ${def.data.ln} is sent off`, { pid: def.data.id });
      } else if (r < pRed + pYellow) {
        def.yellows++;
        st.yellows++;
        def.ps.yellow++;
        this.effect('card', def.pos, def.team, { red: false, pid: def.data.id });
        this.emit('yellow', def.team, `Yellow card: ${def.data.ln}`, { pid: def.data.id });
      }
      if (this.inAttackingBox(victim.team, victim.pos)) {
        this.emit('penalty', victim.team, `PENALTY to ${this.teams[victim.team].short}!`);
        const spot = victim.team === 0 ? this.cfg.L - this.cfg.PEN : this.cfg.PEN;
        return this.setRestart('penalty', victim.team, vec(spot, this.cfg.W / 2));
      }
      this.setRestart('freekick', victim.team, this.clampPitch(victim.pos));
    }

    // ── restarts ──
    setRestart(type, team, pos, timer = RESTART_TIME[type], placeBall = true) {
      const b = this.ball;
      b.owner = null; b.receiver = null; b.passer = null; b.lofted = false; b.cross = false; b.shot = null; b.curl = 0;
      b.offside = null; this.freeRestart = null;
      if (placeBall) { b.vel = vec(); b.pos = { ...pos }; b.z = 0; b.vz = 0; }
      this.phase = 'restart';
      if (team !== this.possession) this.possStart[team] = this.time;
      this.possession = team;
      this.reset = null;
      this.wall = null;
      // direct free kick in range: build a wall
      let direct = false;
      if (type === 'freekick') {
        const g = this.attackGoal(team), dg = dist(pos, g);
        if (dg < 32 * this.cfg.k && dg > 14 * this.cfg.k && Math.abs(pos.y - this.cfg.W / 2) < 20 * this.cfg.k) {
          direct = true;
          const dir = norm(sub(g, pos)), perp = vec(-dir.y, dir.x), at = add(pos, scale(dir, this.cfg.CIRCLE));
          const n = this.five ? 2 : 4;
          this.wall = { pts: Array.from({ length: n }, (_, i) => add(at, scale(perp, (i - (n - 1) / 2) * 0.75))), ids: [] };
          const defs = this.teamOn(1 - team).filter(p => !p.isGK).sort((a, c) => dist(a.pos, at) - dist(c.pos, at)).slice(0, n);
          this.wall.ids = defs.map(p => p.id);
        }
      }
      this.restart = { type, team, pos: { ...pos }, taker: this.chooseTaker(type, team, pos, direct), timer: timer + (direct ? 0.6 : 0), teleported: false, direct, flying: !placeBall && type !== 'kickoff', flyT: 0 };
      if (!placeBall && type !== 'kickoff') { b.shot = null; b.owner = null; }
      for (const p of this.onPitch) { p.runTarget = null; p.supportTarget = null; p.action = 'position'; p.mustPass = false; }
    }
    chooseTaker(type, team, pos, direct) {
      const mine = this.teamOn(team), outfield = mine.filter(p => !p.isGK && p.down <= 0);
      const pool = outfield.length ? outfield : mine.length ? mine : this.onPitch;
      if (!pool.length) return null;
      if (type === 'goalkick') return (this.keeper(team) || pool[0]).id;
      const pref = this.teams[team].tac;
      if (type === 'penalty') {
        const set = pool.find(p => p.data.id === pref.pk);
        const pk = q => this.attr(q, 'finishing') + this.attr(q, 'composure') + 10 * this.hm(q, 'icevein');
        return (set || pool.reduce((a, c) => (pk(c) > pk(a) ? c : a))).id;
      }
      if (direct) {
        const set = pool.find(p => p.data.id === pref.fk);
        const fk = q => this.attr(q, 'curve') + this.attr(q, 'finishing') + 15 * this.hm(q, 'deadeye') - 0.4 * dist(q.pos, pos);
        return (set || pool.reduce((a, c) => (fk(c) > fk(a) ? c : a))).id;
      }
      if (type === 'corner') {
        // the best deliverer, but never one of the two biggest threats in the air: they're wanted in the box
        const aerial = [...pool].sort((a, c) => this.aerialScore(c) - this.aerialScore(a)).slice(0, pool.length > 4 ? 2 : 0);
        const cands = pool.filter(p => !aerial.includes(p));
        const ck = q => this.attr(q, 'crossing') + this.attr(q, 'curve') + 12 * this.hm(q, 'deadeye') + 8 * this.hm(q, 'whip') - 0.8 * dist(q.pos, pos);
        return cands.reduce((a, c) => (ck(c) > ck(a) ? c : a)).id;
      }
      if (type === 'kickoff') return pool.reduce((a, c) => (this.slotFor(c, true).u > this.slotFor(a, true).u ? c : a)).id;
      return pool.reduce((a, c) => (dist(c.pos, pos) < dist(a.pos, pos) ? c : a)).id;
    }
    restartTarget(p, r) {
      if (p.isGK) return this.keeperTarget(p, r.pos);
      if (this.wall && this.wall.ids.includes(p.id)) return this.wall.pts[this.wall.ids.indexOf(p.id)];
      let t = this.formationTarget(p, r.pos, p.team === r.team);
      if (r.type === 'kickoff') {
        t = this.fromUV(p.team, Math.min(this.toU(p.team, t.x), 0.47), this.toV(p.team, t.y));
        if (p.team !== r.team) t = this.pushOut(t, r.pos, this.cfg.CIRCLE + 0.5);
      } else if (r.type === 'penalty') {
        if (this.toU(r.team, t.x) > 0.82) t = this.fromUV(r.team, 0.8, this.toV(r.team, t.y));
      } else if (p.team !== r.team && (r.type === 'freekick' || r.type === 'corner')) {
        t = this.pushOut(t, r.pos, this.cfg.CIRCLE + 0.3);
      }
      return t;
    }
    // a ball that's gone out keeps flying past the line: over the boards' edge it bounces back and dies,
    // then it's fetched back to the restart spot (the ball boy's job)
    flyOut(r) {
      const b = this.ball, c = this.cfg;
      r.flyT += TICK;
      b.pos = add(b.pos, scale(b.vel, TICK));
      b.vel = scale(b.vel, Math.exp(-(b.z > 0.2 ? AIR_K : 1.6) * TICK));
      const m = this.five ? 4.5 : 3.1, lo = { x: -m, y: -m }, hi = { x: c.L + m, y: c.W + m };
      for (const k of ['x', 'y']) {
        if (b.pos[k] < lo[k] || b.pos[k] > hi[k]) {
          // the advertising boards (or the stand) stop it: a low ball thuds back, a high one drops behind them
          if (b.z < 1.2) { b.pos[k] = clamp(b.pos[k], lo[k], hi[k]); b.vel[k] *= -0.3; b.vel = scale(b.vel, 0.6); }
          else if (b.pos[k] < lo[k] - 6 || b.pos[k] > hi[k] + 6) { b.vel = vec(); b.pos[k] = clamp(b.pos[k], lo[k] - 6, hi[k] + 6); }
        }
      }
      if (r.flyT > 2.2 || (r.flyT > 0.7 && len(b.vel) < 0.8 && b.z < 0.05)) {
        r.flying = false;
        b.pos = { ...r.pos }; b.prevPos = { ...r.pos }; b.vel = vec(); b.z = 0; b.vz = 0; b.spin = 0;
        r.timer = Math.max(r.timer, 0.5);
      }
    }
    pushOut(t, from, radius) {
      const d = dist(t, from);
      if (d >= radius) return t;
      const dir = d > 0.01 ? norm(sub(t, from)) : vec(1, 0);
      return this.clampPitch(add(from, scale(dir, radius)));
    }
    teleportKickoff(r) {
      const b = this.ball;
      b.pos = { ...r.pos }; b.prevPos = { ...r.pos }; b.vel = vec(); b.z = 0; b.vz = 0;
      for (const p of this.onPitch) {
        const t = p.id === r.taker ? add(r.pos, vec(r.team === 0 ? -0.6 : 0.6, 0)) : this.restartTarget(p, r);
        p.pos = { ...t }; p.prevPos = { ...t }; p.vel = vec(); p.target = { ...t };
        p.down = 0; p.z = 0; p.vz = 0; p.slide = 0; p.dive = 0; p.celebrate = 0; p.spinAng = 0;
        p.ang = p.team === 0 ? 0 : Math.PI; p.prevAng = p.ang;
      }
    }
    stepRestart() {
      const r = this.restart;
      r.timer -= TICK;
      if (r.type === 'kickoff' && !r.teleported) {
        if (r.timer <= 1.5) { this.teleportKickoff(r); r.teleported = true; }
        else {
          // goal celebration: the scorer wheels away, team-mates chase him; the other lot trudge back
          const cel = this.celebrator != null ? this.players[this.celebrator] : null;
          for (const p of this.onPitch) {
            if (p.down > 0) { this.move(p); continue; }
            if (cel && p === cel) {
              const c = this.cfg, corner = vec(p.team === 0 ? c.L - 3 : 3, p.pos.y < c.W / 2 ? 3 : c.W - 3);
              p.target = corner; p.urgency = 1;
            } else if (cel && p.team === cel.team && !p.isGK) { p.target = cel.pos; p.urgency = 0.95; }
            else { p.target = p.pos; p.urgency = 0.1; }
            this.move(p);
            if (p.celebrate > 0) p.celebrate -= TICK;
          }
          this.ball.pos = add(this.ball.pos, scale(this.ball.vel, TICK));
          this.ball.vel = scale(this.ball.vel, 0.85);
          return;
        }
      }
      if (r.flying) this.flyOut(r);
      let taker = r.taker != null ? this.players[r.taker] : null;
      if (!taker || !taker.active) { r.taker = this.chooseTaker(r.type, r.team, r.pos, r.direct); taker = r.taker != null ? this.players[r.taker] : null; }
      if (!taker) { this.phase = 'play'; this.restart = null; this.wall = null; this.ball.pos = { ...r.pos }; return; }
      const behind = add(r.pos, scale(norm(sub(this.ownGoal(r.team), r.pos)), 0.6));
      for (const p of this.onPitch) {
        if (p.down > 0) { this.move(p); continue; }
        if (p.id === r.taker) { p.target = behind; p.urgency = 1; }
        else { p.target = this.restartTarget(p, r); p.urgency = 0.75; }
        this.move(p);
      }
      if (r.timer > 0 || r.flying) return;
      // the taker has to actually get to the ball: no teleporting onto it (a safety valve stops play stalling)
      r.wait = (r.wait || 0) + TICK;
      if (dist(taker.pos, behind) > 0.45 && r.wait < 6) return;
      taker.pos = { ...behind }; taker.vel = vec(); taker.down = 0;
      this.ball.pos = { ...r.pos };
      this.phase = 'play';
      this.restart = null;
      this.setOwner(taker);
      taker.decisionCd = r.type === 'kickoff' ? 0.2 : 0;
      taker.mustPass = r.type === 'throwin' || r.type === 'goalkick' || r.type === 'corner' || r.type === 'kickoff';
      // no offside straight from a throw-in, goal kick or corner
      if (r.type === 'throwin' || r.type === 'goalkick' || r.type === 'corner') this.freeRestart = taker.id;
      taker.throwIn = r.type === 'throwin';
      if (r.type === 'corner') this.computeBoxRuns();
      if (r.type === 'penalty') {
        const kp = this.keeper(1 - r.team);
        const pGoal = clamp(0.62 + (0.25 * this.attr(taker, 'finishing')) / 99 + (0.08 * this.attr(taker, 'composure')) / 99 + 0.04 * this.hm(taker, 'icevein') - (kp ? (0.17 * this.attr(kp, 'goalkeeping')) / 99 : 0), 0.5, 0.93);
        this.shoot(taker, 0.76, false, pGoal);
      } else if (r.direct) {
        // over the wall and into the corner — or a clever short one
        const curve = this.attr(taker, 'curve') / 99, fin = this.attr(taker, 'finishing') / 99;
        const dg = dist(taker.pos, this.attackGoal(r.team));
        if (this.rng.chance(clamp(0.2 + 0.25 * curve + 0.1 * fin + 0.12 * this.hm(taker, 'deadeye') - Math.max(0, dg - 22 * this.cfg.k) * 0.02, 0.1, 0.7))) {
          const pGoal = clamp(0.03 + 0.14 * curve * curve + 0.05 * fin + 0.04 * this.hm(taker, 'deadeye') - dg * 0.0015, 0.02, 0.3);
          this.effect('special', taker.pos, r.team, { label: 'Free kick', pid: taker.data.id });
          this.shoot(taker, 0.07, false, pGoal, 1, 'fk');
          // the wall is live: it jumps, and a low or poorly-struck one smacks into it
          if (this.ball.shot) this.ball.shot.checked = [];
        }
      }
      this.wall = null;
    }

    // ── substitutions ──
    sub(t, outPid, inPid, why) {
      if (this.subsUsed[t] >= this.maxSubs) return false;
      const out = this.onPitch.find(p => p.team === t && p.data.id === outPid);
      const data = this.teams[t].squad.find(p => p.id === inPid);
      if (!out || !data || this.players.some(p => p.team === t && p.data.id === inPid)) return false;
      const tac = this.tac(t);
      tac.lineup[out.slot] = inPid;
      tac.bench = (tac.bench || []).filter(id => id !== inPid);
      const sp = this.makeSim(t, out.slot, data);
      sp.id = this.players.length;
      sp.pos = { ...out.pos }; sp.prevPos = { ...out.pos }; sp.ang = out.ang;
      this.players.push(sp);
      out.active = false;
      out.offAt = this.time;
      if (this.ball.owner === out.id) this.ball.owner = sp.id;
      if (this.ball.receiver === out.id) this.ball.receiver = sp.id;
      this.subsUsed[t]++;
      this.lastSubAt[t] = this.time;
      this.refreshOnPitch();
      this.emit('sub', t, `${this.teams[t].short}: ${data.ln} on for ${out.data.ln}${why ? ` (${why})` : ''}`, { pid: inPid, opid: outPid });
      this.effect('sub', out.pos, t, { pid: inPid });
      return true;
    }
    // apply edited tactics mid-match (formations, roles, instructions); subs go through sub()
    applyTactics(t, next) {
      const tac = this.tac(t);
      Object.assign(tac, { oop: next.oop, ip: next.ip, map: [...next.map], rIP: [...next.rIP], rOOP: [...next.rOOP], instr: next.instr.map(x => ({ ...x })), team: { ...next.team }, pk: next.pk, fk: next.fk });
      const fo = TAC.formation(tac.oop);
      // lineup order may have been shuffled (position swaps): follow the new slot of each player
      const slotOf = new Map(next.lineup.map((id, i) => [id, i]));
      for (const p of this.players) {
        if (p.team !== t || !p.active) continue;
        const s = slotOf.get(p.data.id);
        if (s !== undefined) p.slot = s;
        const ipPos = TAC.formation(tac.ip).slots[tac.map[p.slot]].pos;
        p.rIP = TAC.ROLES[tac.rIP[p.slot]] || TAC.ROLES[TAC.defaultRole(ipPos)];
        p.rOOP = TAC.ROLES[tac.rOOP[p.slot]] || TAC.ROLES[TAC.defaultRole(fo.slots[p.slot].pos)];
        p.instr = tac.instr[p.slot] || TAC.defaultInstr();
        p.fam = TAC.fam(p.data, fo.slots[p.slot].pos) * 0.82 + TAC.fam(p.data, ipPos) * 0.18;
        p.isGK = p.slot === 0;
      }
      tac.lineup = [...next.lineup];
      this.refreshOnPitch();
    }
    benchFor(t, pos) {
      const tac = this.tac(t), used = new Set(this.players.filter(p => p.team === t).map(p => p.data.id));
      return (tac.bench || []).map(id => this.teams[t].squad.find(p => p.id === id)).filter(p => p && !used.has(p.id) && !(p.inj > 0))
        .sort((a, b) => (b.ovr * TAC.fam(b, pos)) - (a.ovr * TAC.fam(a, pos)));
    }
    aiSubs(t) {
      if (this.phase !== 'play' && this.phase !== 'restart') return;
      if (this.subsUsed[t] >= this.maxSubs) return;
      // injuries come off straight away
      const hurt = this.onPitch.find(p => p.team === t && p.injured && !p.subbedHurt && this.time - (p.injuryAt || 0) > 1.5);
      if (hurt) {
        hurt.subbedHurt = true;
        const pos = TAC.formation(this.tac(t).oop).slots[hurt.slot].pos;
        const rep = this.benchFor(t, pos)[0];
        if (rep && this.sub(t, hurt.data.id, rep.id, 'injury')) return;
      }
      const m = this.minute, frac = this.time / (this.halfSecs * 2);
      if (frac < 0.55 || this.time - this.lastSubAt[t] < this.halfSecs * 0.09) return;
      const tired = this.onPitch.filter(p => p.team === t && !p.isGK && p.stamina < 0.74 + 0.3 * (frac - 0.55)).sort((a, b) => a.stamina - b.stamina)[0];
      if (!tired) return;
      const pos = TAC.formation(this.tac(t).oop).slots[tired.slot].pos;
      const rep = this.benchFor(t, pos)[0];
      if (rep && rep.ovr * TAC.fam(rep, pos) > tired.data.ovr * 0.78) this.sub(t, tired.data.id, rep.id);
      void m;
    }
    aiHalftime(t) {
      const ti = this.tac(t).team, diff = this.score[t] - this.score[1 - t];
      if (diff < 0) { ti.mentality = Math.min(2, ti.mentality + 1); ti.pressing = Math.min(1, ti.pressing + 1); }
      else if (diff >= 2) ti.mentality = Math.max(-1, ti.mentality - 1);
    }

    endHalf() {
      this.time = this.half * this.halfSecs;
      this.ball.owner = null;
      this.ball.vel = vec();
      this.effect('whistle', this.ball.pos, 0);
      if (this.half === 1) {
        this.phase = 'halftime';
        this.emit('halftime', 0, `Half-time: ${this.score[0]}-${this.score[1]}`);
      } else {
        this.phase = 'fulltime';
        if (this.knockout && this.score[0] === this.score[1]) this.shootout();
        for (const p of this.onPitch) p.offAt = this.time;
        this.emit('fulltime', 0, `Full-time: ${this.score[0]}-${this.score[1]}${this.pens ? ` (${this.pens[0]}-${this.pens[1]} pens)` : ''}`);
      }
    }
    shootout() {
      const takers = [0, 1].map(t => this.teamOn(t).filter(p => !p.isGK).sort((a, b) => (this.attr(b, 'finishing') + this.attr(b, 'composure')) - (this.attr(a, 'finishing') + this.attr(a, 'composure'))));
      const pens = [0, 0], kicks = [[], []];
      for (let i = 0; i < 30; i++) {
        const t = i % 2, round = Math.floor(i / 2), list = takers[t];
        if (!list.length) continue;
        const sh = list[round % list.length], kp = this.keeper(1 - t);
        const p = clamp(0.72 + 0.15 * (this.attr(sh, 'finishing') - 60) / 39 + 0.06 * (this.attr(sh, 'composure') - 60) / 39 + 0.04 * this.hm(sh, 'icevein') - (kp ? 0.12 * (this.attr(kp, 'goalkeeping') - 60) / 39 : 0), 0.5, 0.92);
        const ok = this.rng.chance(p);
        if (ok) pens[t]++;
        kicks[t].push({ pid: sh.data.id, ok });
        this.emit('pen', t, `${sh.data.ln} ${ok ? 'scores' : 'misses'} — ${pens[0]}-${pens[1]}`, { pid: sh.data.id, ok });
        const r0 = kicks[0].length, r1 = kicks[1].length;
        if (r0 <= 5 && r1 <= 5) {
          const left0 = 5 - r0, left1 = 5 - r1;
          if (pens[0] > pens[1] + left1 || pens[1] > pens[0] + left0) break;
        } else if (r0 === r1 && pens[0] !== pens[1]) break;
      }
      this.pens = pens;
      this.kicks = kicks;
    }
    winner() {
      if (this.score[0] !== this.score[1]) return this.score[0] > this.score[1] ? 0 : 1;
      if (this.pens) return this.pens[0] > this.pens[1] ? 0 : 1;
      return -1;
    }

    // ── ratings & summary ──
    rating(p) {
      const ps = p.ps, mins = this.minutesPlayed(p), t = p.team;
      if (mins <= 0) return 0;
      const won = this.score[t] > this.score[1 - t], lost = this.score[t] < this.score[1 - t];
      const pos = TAC.formation(this.tac(t).oop).slots[p.slot] ? TAC.formation(this.tac(t).oop).slots[p.slot].pos : p.data.pos;
      const g = DATA.POS_GROUP[pos];
      let r = 6.2 + ps.goals * (g === 'DEF' ? 1.3 : 1.0) + ps.assists * 0.65 + ps.keyPasses * 0.15 + ps.onTarget * 0.08 + ps.tacklesWon * 0.14 + ps.interceptions * 0.1 + ps.blocks * 0.15 + ps.saves * 0.32 + ps.aerials * 0.05 + ps.hits * 0.05;
      if (ps.passes >= 8) r += ((ps.passesOk / ps.passes) - 0.75) * 1.2;
      if ((g === 'DEF' || g === 'GK') && this.score[1 - t] === 0 && mins > 60) r += 0.6;
      if (g === 'DEF' || g === 'GK') r -= Math.min(2, ps.conceded * 0.22 * (mins / (this.halfMins * 2)));
      r -= ps.yellow * 0.3 + ps.red * 1.4 + ps.fouls * 0.05;
      r += won ? 0.3 : lost ? -0.3 : 0;
      if (mins < 25) r = 6 + (r - 6) * 0.6;
      return Math.round(clamp(r, 3, 10) * 10) / 10;
    }
    summary() {
      const players = this.players.map(p => ({
        pid: p.data.id, team: p.team, slot: p.slot, min: this.minutesPlayed(p), rating: this.rating(p), ...p.ps,
        inj: p.injured || 0, red: p.ps.red, yellow: p.ps.yellow, fit: Math.round(p.stamina * 100), fire: p.fire > 0,
      }));
      const totalPoss = this.stats[0].poss + this.stats[1].poss || 1;
      const motm = players.filter(p => p.min > 0).sort((a, b) => b.rating - a.rating)[0];
      return {
        score: [...this.score], pens: this.pens, stats: this.stats.map(s => ({ ...s, possPct: Math.round((s.poss / totalPoss) * 100) })),
        events: this.events, players, motm: motm ? motm.pid : null, mom: this.momSeries, winner: this.winner(),
      };
    }
  }

  return { Match, TICK, pitch };
})();
