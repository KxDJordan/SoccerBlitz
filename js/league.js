'use strict';
// ── LEAGUE: the world, the calendar, and everything that happens between matches ──
// G is the whole save. Four nations, two divisions each, twelve clubs per division. A season is a run of
// days: league rounds on one weekday, cup and continental ties midweek, academy 5-a-sides the day before
// league games, transfer windows in summer and winter, and a promotion/relegation shake-up at the end.

let G = null;

const L = (() => {
  const SEA = DATA.SEASON, AK = DATA.AK;
  const team = id => G.teams[id];
  const user = () => G.teams[G.userTeamId];
  const P = id => G.players[id];
  const squad = t => t.squad.map(P).filter(Boolean);
  const league = id => G.leagues[id];
  const isUser = id => id === G.userTeamId;
  const rng = () => Math.random();

  // ── naming ──
  function mkName(natKey) {
    if (natKey === 'world') {
      const w = U.pick(DATA.NAMES.world);
      return { fn: U.pick(w.f), ln: U.pick(w.l), nat: w.nat };
    }
    const pool = DATA.NAMES[natKey], n = DATA.NATIONS[DATA.NAT_KEY.indexOf(natKey)];
    return { fn: U.pick(pool.f), ln: U.pick(pool.l), nat: n.name };
  }
  function natFor(nationId) {
    const r = rng();
    if (r < 0.7) return DATA.NAT_KEY[nationId];
    if (r < 0.82) return U.pick(DATA.NAT_KEY.filter((_, i) => i !== nationId));
    return 'world';
  }

  // ── players ──
  function calcOvr(p, pos = p.pos) {
    const w = DATA.OVR_W[pos];
    let s = 0;
    for (let i = 0; i < w.length; i++) s += p.a[i] * w[i];
    return Math.round(s);
  }
  function roleRating(p, roleId, at) {
    const r = TAC.ROLES[roleId];
    if (!r) return calcOvr(p);
    const pos = at && r.slots.includes(at) ? at : r.slots.includes(p.pos) ? p.pos : r.slots[0];
    const keys = r.keys.length ? U.avg(r.keys.map(k => p.a[AK[k]])) : calcOvr(p, pos);
    return Math.round((calcOvr(p, pos) * 0.65 + keys * 0.35) * TAC.fam(p, pos));
  }
  const ALT = { GK: [], CB: ['DM', 'RB', 'LB'], LB: ['LM', 'CB', 'RB'], RB: ['RM', 'CB', 'LB'], DM: ['MF', 'CB'], MF: ['DM', 'AM'], LM: ['LW', 'LB', 'MF'], RM: ['RW', 'RB', 'MF'], AM: ['MF', 'ST', 'LW', 'RW'], LW: ['LM', 'RW', 'ST', 'AM'], RW: ['RM', 'LW', 'ST', 'AM'], ST: ['AM', 'LW', 'RW'] };
  const PERS_W = [['steady', 30], ['pro', 14], ['leader', 9], ['ambitious', 12], ['loyal', 10], ['hothead', 9], ['flair', 10], ['clutch', 6]];

  function genAttrs(pos, target) {
    const w = DATA.OVR_W[pos], a = new Array(DATA.ATTRS.length);
    for (let i = 0; i < a.length; i++) {
      const wi = w[i];
      a[i] = wi >= 0.08 ? target + U.gauss(3, 4.5) : wi > 0 ? target + U.gauss(-4, 6) : target + U.gauss(-14, 8);
    }
    if (pos !== 'GK') a[AK.goalkeeping] = U.ri(6, 22);
    else for (let i = 0; i < a.length; i++) if (i !== AK.goalkeeping && w[i] === 0) a[i] = target + U.gauss(-24, 8);
    // nudge until the weighted overall lands on target
    for (let k = 0; k < 6; k++) {
      let s = 0;
      for (let i = 0; i < a.length; i++) s += a[i] * w[i];
      const diff = target - s;
      if (Math.abs(diff) < 0.4) break;
      for (let i = 0; i < a.length; i++) if (w[i] > 0) a[i] += diff;
    }
    return a.map(v => Math.round(U.clamp(v, 15, 99)));
  }
  function mkPlayer(pos, target, age, nationId, extra = {}) {
    const nm = mkName(extra.natKey || natFor(nationId));
    const id = G.nextPid++;
    const p = {
      id, fn: nm.fn, ln: nm.ln, nat: nm.nat, age, pos, alt: [], a: genAttrs(pos, target), ovr: 0, pot: 0,
      tid: -1, num: 0, wage: 0, yrs: 0, mor: 70, fit: 100, inj: 0, ban: 0, yc: 0, form: [],
      pers: U.wpick(PERS_W, x => x[1])[0], foot: (pos[0] === 'L' ? rng() < 0.65 : rng() < 0.2) ? 'L' : 'R',
      st: blankSt(), car: { gp: 0, g: 0, a: 0, s: 0, motm: 0 }, hist: [], gp: 0,
      ...extra,
    };
    delete p.natKey;
    p.ovr = calcOvr(p);
    const altN = rng() < 0.55 ? U.ri(1, 2) : 0;
    p.alt = U.shuffle([...ALT[pos]]).slice(0, altN);
    if (!p.pot) {
      const head = age <= 18 ? U.gauss(16, 7) : age <= 21 ? U.gauss(10, 6) : age <= 24 ? U.gauss(5, 4) : age <= 27 ? U.gauss(1.5, 2) : 0;
      p.pot = Math.round(U.clamp(p.ovr + Math.max(0, head), p.ovr, 97));
    }
    if (!p.hm) rollHallmarks(p);
    p.wage = marketWage(p);
    p.yrs = U.ri(1, age < 24 ? 5 : age < 30 ? 4 : 2);
    G.players[id] = p;
    return p;
  }
  const blankSt = () => ({ gp: 0, g: 0, a: 0, rat: 0, motm: 0, cs: 0, yc: 0, rc: 0, min: 0, hits: 0 });

  // ── hallmarks ──
  // how many a player can carry: the better he is, the more tricks he has
  const hmSlots = p => (p.ovr >= 84 ? 5 : p.ovr >= 78 ? 4 : p.ovr >= 70 ? 3 : p.ovr >= 62 ? 2 : p.ovr >= 52 ? 1 : 0);
  const hmCount = p => Object.keys(p.hm || {}).length;
  // how far above the requirement his weakest key attribute sits (negative = short of it)
  function hmMargin(p, h) {
    if (!h || !!h.gk !== (p.pos === 'GK') || (h.pos && !h.pos.includes(p.pos))) return -99;
    let m = 99;
    for (const k in h.req) m = Math.min(m, p.a[AK[k]] - h.req[k]);
    return m;
  }
  // the ones he's born with: what his attributes clearly support, best first, some left to learn
  function rollHallmarks(p) {
    p.hm = {};
    const n = hmSlots(p);
    let elites = 0;
    for (const { h, m } of DATA.HALLMARKS.map(h => ({ h, m: hmMargin(p, h) })).filter(x => x.m >= 0).sort((a, b) => b.m - a.m)) {
      if (hmCount(p) >= n) break;
      if (rng() < 0.3) continue;
      const elite = m >= DATA.HM_ELITE && p.ovr >= 76 && elites < 2 && rng() < 0.55;
      if (elite) elites++;
      p.hm[h.id] = elite ? 2 : 1;
    }
  }
  // what a hallmark asks of him: the learn target, or the mastery target for the Elite version
  const hmTarget = (p, id) => ((p.hm || {})[id] ? DATA.HM_ELITE : 0);
  // what he could work on in training: hallmarks within reach, or ones he has and could master
  function hmCandidates(p) {
    const out = [];
    for (const h of DATA.HALLMARKS) {
      const m = hmMargin(p, h), lvl = (p.hm || {})[h.id] || 0;
      if (m === -99 || lvl === 2) continue;
      if (lvl === 1 ? m >= DATA.HM_ELITE - 8 : m >= -8 && hmCount(p) < Math.max(1, hmSlots(p))) out.push({ h, m, lvl, need: hmTarget(p, h.id) - m, weeks: hmWeeks(p, h.id) });
    }
    return out.sort((a, b) => a.need - b.need);
  }
  function hmWeeks(p, id) {
    const base = p.age <= 21 ? 6 : p.age <= 25 ? 8 : p.age <= 29 ? 11 : 15;
    return Math.round(base * ((p.hm || {})[id] ? 1.6 : 1));
  }
  function setHmTrain(pid, id) {
    const p = P(pid);
    if (!p) return;
    if (!id || (p.hmTrain && p.hmTrain.id === id)) p.hmTrain = null;
    else if (hmCandidates(p).some(c => c.h.id === id)) p.hmTrain = { id, prog: 0 };
    save();
  }
  function hmNote(p, title, body) {
    if (p.tid === G.userTeamId && typeof Career !== 'undefined') Career.inbox({ type: 'scout', pid: p.id, title, body, actions: [{ label: 'View player', act: 'player', v: p.id }] });
  }
  // a week on the training ground: progress fills, and the hallmark lands once his attributes are there too
  function hmTrainWeek(p) {
    const tr = p.hmTrain;
    if (!tr) return;
    const h = DATA.HM[tr.id];
    if (!h) { p.hmTrain = null; return; }
    const intensity = { light: 0.75, normal: 1, hard: 1.3 }[G.train] || 1;
    tr.prog = Math.min(1, tr.prog + intensity / hmWeeks(p, tr.id));
    if (tr.prog < 1 || hmMargin(p, h) < hmTarget(p, tr.id)) return;
    const elite = !!(p.hm || {})[tr.id];
    p.hm = p.hm || {};
    p.hm[tr.id] = elite ? 2 : 1;
    p.hmTrain = null;
    hmNote(p, `${h.icon} ${p.ln} ${elite ? 'masters' : 'learns'} ${h.name}${elite ? ' ★' : ''}`, `${p.fn} ${p.ln} has ${elite ? 'mastered the Elite version of' : 'added'} ${h.name} to his game: ${elite ? h.elite : h.desc}`);
  }
  // each summer: the young pick things up naturally, and the old lose what their legs no longer support
  function hmSeason(p) {
    if (!p.hm) rollHallmarks(p);
    for (const id in p.hm) {
      const h = DATA.HM[id], m = hmMargin(p, h);
      if (!h || m < -6) { delete p.hm[id]; if (h) hmNote(p, `${h.icon} ${p.ln} loses ${h.name}`, `Age has caught up with ${p.fn} ${p.ln}: he no longer has the attributes for ${h.name}.`); }
      else if (p.hm[id] === 2 && m < DATA.HM_ELITE - 6) p.hm[id] = 1;
    }
    if (rng() > (p.age <= 23 ? 0.45 : 0.25)) return;
    const up = Object.keys(p.hm).find(id => p.hm[id] === 1 && p.ovr >= 76 && hmMargin(p, DATA.HM[id]) >= DATA.HM_ELITE);
    if (up && rng() < 0.4) { p.hm[up] = 2; hmNote(p, `${DATA.HM[up].icon} ${p.ln} masters ${DATA.HM[up].name} ★`, `Over the season ${p.fn} ${p.ln} has made ${DATA.HM[up].name} his trademark: ${DATA.HM[up].elite}`); return; }
    if (hmCount(p) >= hmSlots(p)) return;
    const c = DATA.HALLMARKS.filter(h => !p.hm[h.id] && hmMargin(p, h) >= 0).sort((a, b) => hmMargin(p, b) - hmMargin(p, a))[0];
    if (c) { p.hm[c.id] = 1; hmNote(p, `${c.icon} ${p.ln} picks up ${c.name}`, `${p.fn} ${p.ln} has developed a new hallmark: ${c.desc}`); }
  }
  // what his hallmarks are worth in a quick sim (a few tenths of an overall point each)
  const hmBonus = p => { let s = 0; for (const id in p.hm || {}) s += p.hm[id] === 2 ? 0.8 : 0.35; return s; };
  function retarget(p) { p.ovr = calcOvr(p); if (p.pot < p.ovr) p.pot = p.ovr; }

  // ── money ──
  // weekly wage ($K) a player of this level expects
  function marketWage(p) {
    const base = 2.6 * Math.exp((p.ovr - 50) / 10.5);
    const age = p.age < 21 ? 0.7 : p.age > 31 ? 0.8 : 1;
    return Math.max(1, Math.round(base * age * (1 + Math.max(0, p.pot - p.ovr) / 80)));
  }
  // where a player stands in his club's pecking order: in the XI, on the bench, or out of the picture (with this season's starts)
  function squadRole(p) {
    const t = p.tid >= 0 ? G.teams[p.tid] : null;
    const starts = p.st ? p.st.gp || 0 : 0, apps = starts ? `, ${starts} game${starts === 1 ? '' : 's'} this season` : '';
    if (!t || !t.tac) return { tag: 'Squad player', txt: 'a squad player' };
    if ((t.tac.lineup || []).includes(p.id)) return { tag: 'Starter', txt: `a starter in your XI${apps}` };
    if ((t.tac.bench || []).includes(p.id)) return { tag: 'Bench', txt: `on your bench${apps}` };
    return { tag: 'Reserve', txt: `outside your matchday squad${apps}` };
  }
  // transfer value ($M)
  function value(p) {
    const base = 0.15 * Math.exp((p.ovr - 50) / 7.5);
    const ageM = p.age <= 19 ? 1.5 : p.age <= 21 ? 1.4 : p.age <= 24 ? 1.25 : p.age <= 27 ? 1.1 : p.age <= 29 ? 0.9 : p.age <= 31 ? 0.62 : p.age <= 33 ? 0.38 : 0.2;
    const potM = 1 + Math.max(0, p.pot - p.ovr) * (p.age < 24 ? 0.045 : 0.015);
    const contract = p.tid >= 0 ? (p.yrs <= 0 ? 0.35 : p.yrs === 1 ? 0.7 : 1) : 0;
    const hmM = 1 + 0.085 * hmBonus(p); // ~+3% a hallmark, ~+7% an elite one
    return Math.max(0.02, +(base * ageM * potM * hmM * (p.tid >= 0 ? contract : 1)).toFixed(2));
  }
  function payroll(t) { return U.sum(squad(t).map(p => p.wage)); }
  function staffWages() { return U.sum(Object.values(G.staff || {}).flat().map(id => (G.coaches[id] ? G.coaches[id].wage : 0))); }
  function logMoney(t, amt, cat, label) {
    t.fin.bal = +(t.fin.bal + amt).toFixed(3);
    if (!isUser(t.id)) return;
    const s = G.finSeason;
    s[cat] = +((s[cat] || 0) + amt).toFixed(3);
    G.finLog.unshift({ d: G.day, s: G.season, amt: +amt.toFixed(3), cat, label });
    if (G.finLog.length > 160) G.finLog.length = 160;
  }

  // ── world generation ──
  function rndColors() {
    const c1 = U.pick(DATA.PALETTE);
    let c2 = U.pick(DATA.PALETTE.filter(c => U.cdist(c, c1) > 160));
    if (U.lum(c1) < 0.05 && U.lum(c2) < 0.05) c2 = '#F4F5F7';
    return [c1, c2];
  }
  function abbr(name) {
    const w = name.replace(/[^A-Za-zÀ-ÿ' ]/g, '').split(' ').filter(x => !['FC', 'SV', 'AC', 'AS', 'CD', 'US', 'CF', 'AFC', 'TSV', 'VfB', 'SC', 'Real', 'Club', 'Atlético', 'Deportivo', 'Sporting', 'Racing', 'Unión', 'Union', 'Olympique', 'Inter', 'Stade', 'Virtus', 'Fortuna', 'Eintracht', 'Dynamo', 'Viktoria', 'Juventud', 'Estrella', 'Rot-Weiss'].includes(x));
    const base = (w[0] || name).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
    const used = new Set(G.teams.map(t => t.abbr));
    // first three letters, else first letter + later consonants, until it's unique in the world
    const cands = [base.slice(0, 3)];
    for (let i = 1; i < base.length; i++) for (let j = i + 1; j < base.length; j++) cands.push(base[0] + base[i] + base[j]);
    const pick = cands.find(c => c.length === 3 && !used.has(c));
    return (pick || base.slice(0, 2) + String.fromCharCode(65 + (G.teams.length % 26))).padEnd(3, 'X');
  }
  function mkTeam(nation, city, tier, rep) {
    const n = DATA.NATIONS[nation];
    const name = U.fill(U.pick(n.fmt), { c: city });
    const [c1, c2] = rndColors();
    const style = U.pick(DATA.KIT_STYLES);
    const id = G.teams.length;
    const cap = Math.round((tier === 0 ? 18000 + rep * 520 : 6000 + rep * 260) / 500) * 500;
    const t = {
      id, nation, tier, leagueId: -1, city, name, abbr: abbr(name),
      crest: { shape: U.pick(DATA.CREST_SHAPES), icon: U.pick(DATA.CREST_ICONS), c1, c2, c3: c2 },
      kit: { style, c1, c2, c3: rng() < 0.5 ? c1 : '#F4F5F7' },
      away: { style: U.pick(['plain', 'sash', 'band', 'pin']), c1: c2, c2: c1, c3: c2 },
      stadium: { name: U.fill(U.pick(n.stadium), { c: city }), cap },
      rep, ident: U.pick(Object.keys(DATA.CLUB_IDS)), coach: null, squad: [],
      tac: null, fin: { bal: +(tier === 0 ? 6 + rep * 0.3 : 1.5 + rep * 0.1).toFixed(1), ticket: tier === 0 ? 32 : 16 },
      acad: { level: U.ri(1, 3) }, form: [], trophies: [], hist: [], founded: U.ri(1868, 1962), facilities: U.ri(1, 3),
    };
    G.teams.push(t);
    return t;
  }
  function teamLevel(t) { return t.tier === 0 ? 60 + t.rep * 0.2 : 52 + t.rep * 0.17; }
  function genSquad(t) {
    const lvl = teamLevel(t);
    const plan = [];
    for (const pos in DATA.SQUAD_QUOTA) for (let i = 0; i < DATA.SQUAD_QUOTA[pos]; i++) plan.push([pos, i]);
    for (const [pos, i] of plan) {
      const starter = i === 0 || (pos === 'CB' && i < 2) || (pos === 'MF' && i < 2) || (pos === 'ST' && i < 1);
      const age = U.clamp(Math.round(U.gauss(starter ? 26.5 : 24, 4)), 17, 36);
      const target = Math.round(U.clamp(lvl + (starter ? U.gauss(2, 3.5) : U.gauss(-5, 4.5)) - (age < 21 ? 4 : 0), 38, 92));
      const p = mkPlayer(pos, target, age, t.nation);
      joinTeam(p, t);
    }
  }
  function joinTeam(p, t) {
    if (p.tid >= 0 && G.teams[p.tid]) { const o = G.teams[p.tid]; o.squad = o.squad.filter(x => x !== p.id); }
    p.tid = t.id;
    p.acad = false;
    if (!t.squad.includes(p.id)) t.squad.push(p.id);
    const used = new Set(squad(t).filter(q => q !== p).map(q => q.num));
    if (!p.num || used.has(p.num)) {
      const pref = DATA.NUM_PREF[p.pos].find(n => !used.has(n));
      p.num = pref || Array.from({ length: 98 }, (_, i) => i + 2).find(n => !used.has(n) && n > 25) || 99;
    }
    G.fa = (G.fa || []).filter(x => x !== p.id);
  }
  function toFA(p) {
    if (p.tid >= 0 && G.teams[p.tid]) { const o = G.teams[p.tid]; o.squad = o.squad.filter(x => x !== p.id); if (o.tac) { o.tac.lineup = o.tac.lineup.map(x => (x === p.id ? null : x)); o.tac.bench = (o.tac.bench || []).filter(x => x !== p.id); } }
    p.tid = -1; p.acad = false; p.listed = false;
    p.wage = marketWage(p);
    if (!G.fa.includes(p.id)) G.fa.push(p.id);
  }

  // ── coaches & staff ──
  function mkCoach(role, rating, nationId) {
    const nm = mkName(nationId == null ? U.pick([...DATA.NAT_KEY, 'world']) : natFor(nationId));
    const id = G.nextCid++;
    const c = {
      id, fn: nm.fn, ln: nm.ln, nat: nm.nat, age: U.ri(36, 66), role, rating: Math.round(U.clamp(rating, 30, 95)),
      ident: U.pick(Object.keys(DATA.COACH_IDS)), tid: -1, rep: Math.round(U.clamp(rating + U.gauss(0, 8), 10, 99)),
      wage: Math.round((role === 'mgr' ? 12 : 3) * Math.exp((rating - 50) / 18)), hist: [], w: 0, d: 0, l: 0, trophies: 0, since: 0,
    };
    G.coaches[id] = c;
    return c;
  }
  function hireManager(t, c, quiet) {
    if (c.tid >= 0 && G.teams[c.tid] && G.teams[c.tid].coach === c.id) G.teams[c.tid].coach = null;
    if (t.coach != null && G.coaches[t.coach]) { const old = G.coaches[t.coach]; old.tid = -1; old.hist.push({ tid: t.id, s0: old.since, s1: G.season }); }
    c.tid = t.id; c.since = G.season; c.w = c.d = c.l = 0;
    t.coach = c.id;
    if (!isUser(t.id)) aiTactics(t);
    if (!quiet && G.ready) News.coachHired(t, c);
  }

  // a philosophy's favourite roles on the players in its shape (best fit where it has no favourite)
  function applyRoles(t, identId, noise = 0) {
    const id = DATA.COACH_IDS[identId] || DATA.COACH_IDS.developer, tac = t.tac, liked = new Set(id.roles || []);
    // inverting roles go on one flank only, so the other keeps the width; other favourites at most twice
    const ONE = new Set(['ifb', 'iwb', 'flb', 'iw']), used = {};
    tac.lineup.forEach((pid, i) => {
      const p = P(pid);
      if (!p) return;
      const pos = TAC.oopPos(tac, i);
      let best = tac.rOOP[i], bv = -1;
      for (const r of TAC.rolesFor(pos)) {
        const cap = ONE.has(r.id) ? 1 : 2, fav = liked.has(r.id) && (used[r.id] || 0) < cap;
        const v = roleRating(p, r.id, pos) + (fav ? 4 : 0) - (ONE.has(r.id) && (used[r.id] || 0) >= 1 ? 6 : 0) + U.rand(0, noise);
        if (v > bv) { bv = v; best = r.id; }
      }
      used[best] = (used[best] || 0) + 1;
      TAC.setRole(tac, i, best);
    });
  }
  // a whole system: shape, instructions and roles
  function applyPhilosophy(t, identId) {
    const id = DATA.COACH_IDS[identId] || DATA.COACH_IDS.developer;
    t.tac = t.tac ? TAC.normalize(t.tac) : TAC.make(id.oop, null, id.team);
    TAC.setFormation(t.tac, 'oop', id.oop);
    Object.assign(t.tac.team, id.team);
    autoLineup(t, true);
    applyRoles(t, identId);
  }
  // AI tactics: the coach's philosophy picks the shape, instructions and the roles it likes; players fit the roles
  function aiTactics(t) {
    const c = G.coaches[t.coach];
    const id = DATA.COACH_IDS[c ? c.ident : 'developer'];
    const tac = TAC.make(id.oop, null, id.team);
    t.tac = tac;
    autoLineup(t);
    applyRoles(t, c ? c.ident : 'developer', 2.5);
  }
  // best XI for the OOP shape: scarce slots first, greedy by (overall × familiarity × fitness)
  function available(p) { return p && p.inj <= 0 && p.ban <= 0; }
  function slotScore(p, pos) { return calcOvr(p, pos) * TAC.fam(p, pos) * (0.75 + 0.25 * (p.fit / 100)); }
  function autoLineup(t, keepValid) {
    const tac = t.tac, fo = TAC.formation(tac.oop);
    const pool = squad(t).filter(available);
    const used = new Set();
    const lineup = new Array(fo.slots.length).fill(null);
    if (keepValid) tac.lineup.forEach((pid, i) => { const p = P(pid); if (p && p.tid === t.id && available(p) && !used.has(pid)) { lineup[i] = pid; used.add(pid); } });
    const order = fo.slots.map((s, i) => i).filter(i => lineup[i] == null)
      .sort((a, b) => (fo.slots[a].pos === 'GK' ? -1 : fo.slots[b].pos === 'GK' ? 1 : pool.filter(p => p.pos === fo.slots[a].pos).length - pool.filter(p => p.pos === fo.slots[b].pos).length));
    for (const i of order) {
      const pos = fo.slots[i].pos;
      let best = null, bv = -1;
      for (const p of pool) {
        if (used.has(p.id)) continue;
        if (pos !== 'GK' && p.pos === 'GK') continue;
        const v = slotScore(p, pos);
        if (v > bv) { bv = v; best = p; }
      }
      if (best) { lineup[i] = best.id; used.add(best.id); }
    }
    tac.lineup = lineup;
    const rest = pool.filter(p => !used.has(p.id)).sort((a, b) => b.ovr - a.ovr);
    const gk = rest.find(p => p.pos === 'GK');
    const bench = gk ? [gk] : [];
    for (const p of rest) { if (bench.length >= 9) break; if (!bench.includes(p)) bench.push(p); }
    tac.bench = bench.map(p => p.id);
    return tac;
  }
  // make sure the user's saved lineup can take the field: swap out the injured, banned and departed
  function validateUser() {
    const t = user(), tac = TAC.normalize(t.tac), fixes = [];
    tac.lineup.forEach((pid, i) => {
      const p = P(pid);
      if (!p || p.tid !== t.id || !available(p)) { if (p) fixes.push(`${p.ln} (${p.inj > 0 ? 'injured' : p.ban > 0 ? 'suspended' : 'left'})`); tac.lineup[i] = null; }
    });
    if (tac.lineup.some(x => x == null)) autoLineup(t, true);
    const inXI = new Set(tac.lineup);
    tac.bench = (tac.bench || []).filter(id => { const p = P(id); return p && p.tid === t.id && available(p) && !inXI.has(id); });
    if (tac.bench.length < 5) {
      const extra = squad(t).filter(p => available(p) && !inXI.has(p.id) && !tac.bench.includes(p.id)).sort((a, b) => b.ovr - a.ovr);
      for (const p of extra) { if (tac.bench.length >= 9) break; tac.bench.push(p.id); }
    }
    return fixes;
  }

  // ── new career: build the world first (so the player can browse it), then take a job in it ──
  function newCareer(cfg) { genWorld(); startCareer(cfg); }
  function genWorld() {
    G = {
      v: 1, created: Date.now(), season: 1, year: 2026, day: 1, phase: 'season', ready: false,
      teams: [], players: {}, coaches: {}, leagues: [], fixtures: [], fa: [], nextPid: 1, nextCid: 1, nextFx: 1, nextMsg: 1,
      table: {}, acadTable: {}, cups: {}, cont: null, inv: null, news: [], forum: [], inbox: [], history: [], records: {},
      staff: { ast: null, fit: null, yth: null, sct: [] }, staffPool: [], coachPool: [],
      scout: { jobs: [], youth: [], targets: [], known: {} }, shortlist: [], offers: [],
      finLog: [], finSeason: {}, train: 'normal', board: { conf: 60, obj: null },
      mgr: { name: 'The Gaffer', ident: 'gegenpress', rep: 35, hist: [], trophies: 0, w: 0, d: 0, l: 0 },
      settings: { autoSub: true, speed: 2, cam: 'follow' }, stats: { goals: 0, wins: 0, hits: 0, youthDebuts: 0, signings: 0, sales: 0 },
      mode: 'career', challenge: null, ach: {}, eventsSeen: {}, userTeamId: null,
    };
    for (let nId = 0; nId < 4; nId++) {
      const n = DATA.NATIONS[nId];
      const cities = U.shuffle([...n.cities]);
      for (let tier = 0; tier < 2; tier++) {
        const lg = { id: G.leagues.length, nation: nId, tier, name: n.tiers[tier], short: n.short[tier], teams: [] };
        G.leagues.push(lg);
        for (let i = 0; i < 12; i++) {
          const rep = Math.round(tier === 0 ? U.clamp(92 - i * 5.2 + U.gauss(0, 4), 30, 99) : U.clamp(55 - i * 2.6 + U.gauss(0, 4), 12, 70));
          const t = mkTeam(nId, cities[tier * 12 + i], tier, rep);
          t.leagueId = lg.id;
          lg.teams.push(t.id);
          genSquad(t);
        }
      }
    }
    // managers for every club, plus a pool of free agents in the dugout
    for (const t of G.teams) hireManager(t, mkCoach('mgr', (t.tier === 0 ? 58 : 44) + t.rep * 0.3 + U.gauss(0, 6), t.nation), true);
    for (let i = 0; i < 16; i++) G.coachPool.push(mkCoach('mgr', U.ri(40, 78)).id);
    refreshStaffPool();
    for (let i = 0; i < 70; i++) { const p = mkPlayer(U.pick(DATA.POS), U.ri(45, 70), U.ri(19, 34), U.ri(0, 3)); toFA(p); }
  }
  // a club of the player's own making takes over an existing slot: same division, fresh identity and squad
  const STRENGTH = { minnow: [35, 20], mid: [60, 40], contender: [82, 60] };
  function customizeTeam(tid, c) {
    const t = team(tid);
    if (!t._orig) t._orig = { name: t.name, abbr: t.abbr, city: t.city, crest: { ...t.crest }, kit: { ...t.kit }, away: { ...t.away }, stadium: { ...t.stadium }, ident: t.ident, rep: t.rep, founded: t.founded, fin: { ...t.fin } };
    t.name = c.name.trim();
    t.city = (c.city || '').trim() || t.name.split(' ')[0];
    const want = (c.abbr || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    t.abbr = '';
    t.abbr = want.length === 3 && !G.teams.some(x => x !== t && x.abbr === want) ? want : abbr(t.name);
    t.crest = { shape: c.shape, icon: c.icon, c1: c.c1, c2: c.c2, c3: c.c2 };
    t.kit = { style: c.style, c1: c.c1, c2: c.c2, c3: c.shorts || '#F4F5F7' };
    t.away = { style: 'plain', c1: c.c2, c2: c.c1, c3: c.c2 };
    t.ident = c.ident;
    t.rep = (STRENGTH[c.strength] || STRENGTH.mid)[t.tier];
    t.stadium = { name: (c.stadium || '').trim() || `${t.city} Park`, cap: Math.round((t.tier === 0 ? 18000 + t.rep * 520 : 6000 + t.rep * 260) / 500) * 500 };
    t.fin.bal = +(t.tier === 0 ? 6 + t.rep * 0.3 : 1.5 + t.rep * 0.1).toFixed(1);
    t.founded = G.year; t.trophies = []; t.hist = []; t.custom = true;
    for (const pid of t.squad) delete G.players[pid];
    t.squad = [];
    genSquad(t);
    return t;
  }
  // backing out of the creator gives the division its original club back
  function restoreTeam(tid) {
    const t = team(tid);
    if (!t || !t._orig) return;
    Object.assign(t, t._orig);
    delete t._orig; delete t.custom;
  }
  function startCareer(cfg) {
    for (const t of G.teams) delete t._orig;
    G.mgr.name = cfg.mgrName || 'The Gaffer';
    G.mgr.ident = cfg.mgrIdent || 'gegenpress';
    G.mode = cfg.mode || 'career';
    G.userTeamId = cfg.teamId;
    const ut = user();
    const oldCoach = G.coaches[ut.coach];
    if (oldCoach) { oldCoach.tid = -1; G.coachPool.push(oldCoach.id); }
    ut.coach = null;
    const id = DATA.COACH_IDS[G.mgr.ident];
    ut.tac = null;
    applyPhilosophy(ut, G.mgr.ident);
    // starting staff
    G.staff.ast = takeStaff('ast', 50); G.staff.fit = takeStaff('fit', 48); G.staff.yth = takeStaff('yth', 48); G.staff.sct = [takeStaff('sct', 50)];
    // academy
    for (let i = 0; i < 8; i++) mkAcademy(ut, U.ri(15, 17));
    if (cfg.challenge) Career.applyChallenge(cfg.challenge);
    startSeason(true);
    G.ready = true;
    News.welcome();
    save();
  }
  function takeStaff(role, rating) {
    const c = mkCoach(role, rating + U.gauss(0, 5));
    c.tid = G.userTeamId;
    return c.id;
  }
  function refreshStaffPool() {
    for (const id of G.staffPool) if (G.coaches[id] && G.coaches[id].tid < 0) delete G.coaches[id];
    G.staffPool = [];
    for (const role of ['ast', 'fit', 'yth', 'sct']) for (let i = 0; i < 5; i++) G.staffPool.push(mkCoach(role, U.ri(38, 88)).id);
  }

  // ── academy ──
  function mkAcademy(t, age, quality) {
    const lvl = t.acad.level, yc = G.staff.yth != null && G.coaches[G.staff.yth] ? G.coaches[G.staff.yth].rating : 50;
    const q = quality != null ? quality : 0;
    const pos = U.pick(DATA.POS.filter(x => x !== 'GK').concat(rng() < 0.15 ? ['GK'] : []));
    const ovr = Math.round(U.clamp(34 + (age - 15) * 4 + lvl * 2 + U.gauss(0, 4) + q, 28, 64));
    const pot = Math.round(U.clamp(ovr + 18 + lvl * 2.5 + (yc - 50) / 6 + (t.ident === 'academy' ? 5 : 0) + U.gauss(4, 8) + q, ovr + 6, 96));
    const p = mkPlayer(pos, ovr, age, t.nation, { pot });
    p.tid = t.id; p.acad = true; p.wage = 0; p.yrs = 3; p.focus = TAC.defaultRole(pos);
    p.num = 0;
    G.acad = G.acad || [];
    G.acad.push(p.id);
    return p;
  }
  const academy = () => (G.acad || []).map(P).filter(p => p && p.acad && p.tid === G.userTeamId);
  function promote(pid) {
    const p = P(pid), t = user();
    if (!p || !p.acad) return false;
    G.acad = G.acad.filter(x => x !== pid);
    p.acad = false; p.wage = Math.max(1, Math.round(marketWage(p) * 0.6)); p.yrs = 3; p.num = 0;
    p.debutPending = true;
    // academy numbers stay with the academy: senior stats (and awards) start from zero
    if (p.st && p.st.gp) p.acadSt = p.st;
    p.st = blankSt();
    closeAcadMsgs(pid, 'Promoted to the first team.');
    joinTeam(p, t);
    p.promoted = G.season;
    News.promoted(p);
    Career.check();
    save();
    return true;
  }
  // a "come of age" decision is settled once the kid is promoted or released from anywhere
  function closeAcadMsgs(pid, result) {
    for (const m of G.inbox || []) if (!m.done && m.type === 'acad' && m.pid === pid) { m.done = true; m.result = result; }
  }
  function releaseAcademy(pid) {
    const p = P(pid);
    if (!p || !p.acad) return false;
    G.acad = G.acad.filter(x => x !== pid);
    closeAcadMsgs(pid, 'Released.');
    p.acad = false;
    if (p.age >= 17) toFA(p); else { p.tid = -2; delete G.players[pid]; }
    save();
    return true;
  }
  // a rival academy's five, built the same way every time from the club and season (no need to store them)
  function rivalAcademy(t) {
    const saved = { nextPid: G.nextPid, rnd: Math.random };
    let s = U.hash(`${t.id}:${G.season}`) || 1;
    const r = new Rng(s);
    Math.random = () => r.next();
    const out = [];
    const shape = ['GK', 'CB', 'LM', 'RM', 'ST', 'MF', 'CB'];
    for (let i = 0; i < 7; i++) {
      const age = r.int(15, 18);
      const ovr = Math.round(U.clamp(34 + (age - 15) * 4 + t.acad.level * 2 + r.gauss() * 4, 28, 62));
      const nm = mkName(natFor(t.nation));
      const p = { id: -(t.id * 100 + i + 1), fn: nm.fn, ln: nm.ln, nat: nm.nat, age, pos: shape[i], alt: [], a: genAttrs(shape[i], ovr), pers: 'steady', fit: 100, tid: t.id, num: i + 1 };
      p.ovr = calcOvr(p);
      out.push(p);
    }
    Math.random = saved.rnd;
    G.nextPid = saved.nextPid;
    return out;
  }

  // ── calendar ──
  function dateOf(day) {
    const d = new Date(Date.UTC(G.year, 7, 1));
    d.setUTCDate(d.getUTCDate() + Math.round((day - 1) * 1.8));
    return d;
  }
  function dateStr(day = G.day, short) {
    const d = dateOf(day);
    const m = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    return short ? `${m} ${d.getUTCDate()}` : `${d.toLocaleString('en-US', { weekday: 'short', timeZone: 'UTC' })} ${m} ${d.getUTCDate()}`;
  }
  const windowOpen = (day = G.day) => SEA.WINDOWS.some(([a, b]) => day >= a && day <= b);
  const leagueDay = r => SEA.LEAGUE0 + r * SEA.WEEK;
  function winterness(day) { return U.clamp(Math.sin(Math.PI * Math.min(1, day / SEA.LEN) * 0.92), 0, 1); }
  function rollWeather(day) {
    const odds = DATA.weatherOdds(winterness(day));
    const id = U.wpick(Object.keys(odds), k => Math.max(0, odds[k]));
    const ko = U.wpick(DATA.KICKOFF, k => (k.id === 'day' ? 4 : k.id === 'dusk' ? 3 : 3)).id;
    const temp = Math.round((id === 'heat' ? 33 : id === 'snow' ? -2 : 22 - 18 * winterness(day)) + U.gauss(0, 3));
    return { id, ko, temp, wa: U.rand(0, Math.PI * 2), ws: id === 'wind' ? U.rand(2.5, 4.5) : id === 'storm' ? U.rand(1.5, 3) : 0 };
  }
  function addFixture(f) {
    const fx = { id: G.nextFx++, done: false, hs: 0, as: 0, wx: rollWeather(f.day), seed: U.ri(1, 2 ** 31 - 2), ...f };
    G.fixtures.push(fx);
    return fx;
  }
  function roundRobin(ids) {
    const n = ids.length, arr = [...ids], rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) {
        const a = arr[i], b = arr[n - 1 - i];
        pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
      }
      rounds.push(pairs);
      arr.splice(1, 0, arr.pop());
    }
    return rounds;
  }
  function buildSchedule() {
    G.fixtures = [];
    for (const lg of G.leagues) {
      G.table[lg.id] = {};
      for (const tid of lg.teams) G.table[lg.id][tid] = blankRec();
      const first = roundRobin(U.shuffle([...lg.teams]));
      const all = [...first, ...first.map(r => r.map(([a, b]) => [b, a]))];
      all.forEach((pairs, r) => pairs.forEach(([h, a]) => addFixture({ day: leagueDay(r), comp: 'L', lg: lg.id, rd: r + 1, h, a })));
    }
    // academy league: the user's division, 5-a-side, the day before each league round
    const ulg = league(user().leagueId);
    G.acadTable = {};
    for (const tid of ulg.teams) G.acadTable[tid] = blankRec();
    const ar = roundRobin(U.shuffle([...ulg.teams]));
    [...ar, ...ar.map(r => r.map(([a, b]) => [b, a]))].forEach((pairs, r) => pairs.forEach(([h, a]) => addFixture({ day: leagueDay(r) - 1, comp: 'A', lg: ulg.id, rd: r + 1, h, a })));
  }
  const blankRec = () => ({ p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] });

  // ── cups ──
  const CUP_ROUNDS = ['R1', 'R16', 'QF', 'SF', 'F'];
  const CUP_NAMES = { R1: 'First Round', R16: 'Round of 16', QF: 'Quarter-final', SF: 'Semi-final', F: 'Final' };
  function setupCups() {
    G.cups = {};
    for (let n = 0; n < 4; n++) {
      const t1 = league(n * 2).teams.slice().sort((a, b) => team(b).rep - team(a).rep);
      const t2 = league(n * 2 + 1).teams;
      const byes = t1.slice(0, 8), r1 = U.shuffle([...t1.slice(8), ...t2]);
      G.cups[n] = { nation: n, byes, alive: [...t1, ...t2], round: 'R1', winner: null, rounds: {} };
      const fx = [];
      for (let i = 0; i < r1.length; i += 2) fx.push(addFixture({ day: SEA.CUP.R1, comp: 'C', lg: n, rd: 'R1', h: r1[i], a: r1[i + 1], ko: true }).id);
      G.cups[n].rounds.R1 = fx;
    }
  }
  function cupAdvance(n) {
    const cup = G.cups[n], cur = cup.round, ids = cup.rounds[cur];
    const fxs = ids.map(id => G.fixtures.find(f => f.id === id)).filter(Boolean);
    if (!fxs.length || fxs.some(f => !f.done)) return;
    const winners = fxs.map(f => winnerOf(f));
    const losers = fxs.map(f => (winnerOf(f) === f.h ? f.a : f.h));
    cup.alive = cup.alive.filter(t => !losers.includes(t));
    for (const l of losers) prize(team(l), DATA.PRIZE.cup[cur], `${DATA.NATIONS[n].cup} ${CUP_NAMES[cur]}`);
    if (cur === 'F') {
      cup.winner = winners[0];
      prize(team(cup.winner), DATA.PRIZE.cup.W, `${DATA.NATIONS[n].cup} winners`);
      trophy(team(cup.winner), DATA.NATIONS[n].cup);
      News.cupWinner(n, team(cup.winner), fxs[0]);
      return;
    }
    const next = CUP_ROUNDS[CUP_ROUNDS.indexOf(cur) + 1];
    const field = U.shuffle(next === 'R16' ? [...winners, ...cup.byes] : winners);
    cup.round = next;
    cup.rounds[next] = [];
    for (let i = 0; i < field.length; i += 2) cup.rounds[next].push(addFixture({ day: SEA.CUP[next], comp: 'C', lg: n, rd: next, h: field[i], a: field[i + 1], ko: true }).id);
    if (cup.alive.includes(G.userTeamId)) News.cupDraw(n, next);
  }
  function setupContinental() {
    // the top two of each top flight last season (or by reputation in year one)
    const qual = [];
    for (let n = 0; n < 4; n++) {
      const lg = league(n * 2);
      const prev = G.lastTop && G.lastTop[n];
      const ids = prev && prev.length >= 2 ? prev.slice(0, 2) : lg.teams.slice().sort((a, b) => team(b).rep - team(a).rep).slice(0, 2);
      qual.push(...ids.filter(id => team(id).tier === 0 || true));
    }
    const field = U.shuffle(qual.slice(0, 8));
    G.cont = { teams: field, round: 'QF', rounds: { QF: [] }, winner: null };
    for (let i = 0; i < 8; i += 2) G.cont.rounds.QF.push(addFixture({ day: SEA.CONT.QF, comp: 'X', lg: -1, rd: 'QF', h: field[i], a: field[i + 1], ko: true }).id);
  }
  function contAdvance() {
    const c = G.cont, cur = c.round, fxs = c.rounds[cur].map(id => G.fixtures.find(f => f.id === id)).filter(Boolean);
    if (!fxs.length || fxs.some(f => !f.done)) return;
    const winners = fxs.map(winnerOf);
    for (const f of fxs) { const l = winnerOf(f) === f.h ? f.a : f.h; prize(team(l), DATA.PRIZE.cont[cur], `${DATA.CONTINENTAL} ${CUP_NAMES[cur]}`); }
    if (cur === 'F') {
      c.winner = winners[0];
      prize(team(c.winner), DATA.PRIZE.cont.W, `${DATA.CONTINENTAL} winners`);
      trophy(team(c.winner), DATA.CONTINENTAL);
      News.contWinner(team(c.winner), fxs[0]);
      return;
    }
    const next = cur === 'QF' ? 'SF' : 'F';
    c.round = next; c.rounds[next] = [];
    const field = U.shuffle(winners);
    for (let i = 0; i < field.length; i += 2) c.rounds[next].push(addFixture({ day: SEA.CONT[next], comp: 'X', lg: -1, rd: next, h: field[i], a: field[i + 1], ko: true }).id);
  }
  function setupInvitational() {
    const u = user();
    const others = G.teams.filter(t => t.nation !== u.nation && t.tier === 0).sort((a, b) => Math.abs(a.rep - u.rep) - Math.abs(b.rep - u.rep)).slice(0, 8);
    const field = U.shuffle([u.id, ...U.shuffle(others).slice(0, 3).map(t => t.id)]);
    G.inv = { teams: field, round: 'SF', rounds: { SF: [] }, winner: null };
    for (let i = 0; i < 4; i += 2) G.inv.rounds.SF.push(addFixture({ day: SEA.INVIT.SF, comp: 'I', lg: -1, rd: 'SF', h: field[i], a: field[i + 1], ko: true, neutral: true }).id);
  }
  function invAdvance() {
    const c = G.inv;
    if (!c || c.round !== 'SF') return;
    const fxs = c.rounds.SF.map(id => G.fixtures.find(f => f.id === id));
    if (fxs.some(f => !f || !f.done)) return;
    const w = fxs.map(winnerOf), l = fxs.map(f => (winnerOf(f) === f.h ? f.a : f.h));
    c.round = 'F';
    c.rounds.F = [addFixture({ day: SEA.INVIT.F, comp: 'I', lg: -1, rd: 'F', h: w[0], a: w[1], ko: true, neutral: true }).id];
    c.rounds.P = [addFixture({ day: SEA.INVIT.F, comp: 'I', lg: -1, rd: '3rd', h: l[0], a: l[1], ko: true, neutral: true }).id];
  }
  function invFinish(f) {
    if (f.rd === 'F') {
      const w = winnerOf(f), l = w === f.h ? f.a : f.h;
      G.inv.winner = w;
      prize(team(w), DATA.PRIZE.invitational.W, `${DATA.INVITATIONAL} winners`);
      prize(team(l), DATA.PRIZE.invitational.F, `${DATA.INVITATIONAL} runners-up`);
      trophy(team(w), DATA.INVITATIONAL);
      if (w === G.userTeamId || l === G.userTeamId) News.invitational(team(w), f);
    } else if (f.rd === '3rd') prize(team(winnerOf(f)), DATA.PRIZE.invitational.P, `${DATA.INVITATIONAL} third place`);
  }
  // a finished fixture from one club's point of view: 'W', 'D' or 'L' (shoot-outs count as wins and losses)
  function resultFor(f, tid) {
    if (!f || !f.done) return null;
    const mine = f.h === tid ? f.hs : f.as, theirs = f.h === tid ? f.as : f.hs;
    if (mine !== theirs) return mine > theirs ? 'W' : 'L';
    if (f.pens) return winnerOf(f) === tid ? 'W' : 'L';
    return 'D';
  }
  // this season's record in every competition (league, cups, continental, invitational, showcase)
  function seasonRecord(tid) {
    const r = { w: 0, d: 0, l: 0, gf: 0, ga: 0, p: 0 };
    for (const f of G.fixtures) {
      if (!f.done || f.comp === 'A' || (f.h !== tid && f.a !== tid)) continue;
      const x = resultFor(f, tid);
      r.p++; r[x === 'W' ? 'w' : x === 'D' ? 'd' : 'l']++;
      r.gf += f.h === tid ? f.hs : f.as; r.ga += f.h === tid ? f.as : f.hs;
    }
    return r;
  }
  function lastUserFixture() {
    return G.fixtures.filter(f => f.done && f.comp !== 'A' && (f.h === G.userTeamId || f.a === G.userTeamId)).sort((a, b) => b.day - a.day || b.id - a.id)[0] || null;
  }
  function winnerOf(f) {
    if (f.hs !== f.as) return f.hs > f.as ? f.h : f.a;
    if (f.pens) return f.pens[0] > f.pens[1] ? f.h : f.a;
    return f.h;
  }
  function prize(t, amt, label) { if (amt) logMoney(t, amt, 'prize', label); }
  function trophy(t, name) {
    t.trophies.push({ s: G.season, y: G.year, name });
    if (isUser(t.id)) { G.mgr.trophies++; G.mgr.hist.push({ s: G.season, trophy: name, tid: t.id }); Career.trophy(name); }
    else if (t.coach != null && G.coaches[t.coach]) G.coaches[t.coach].trophies++;
  }

  // ── season start / end ──
  function startSeason(first) {
    G.day = 1;
    G.phase = 'season';
    buildSchedule();
    setupCups();
    setupContinental();
    setupInvitational();
    G.finSeason = {};
    G.board.obj = Career.objectives();
    G.board.conf = first ? 60 : U.clamp(G.board.conf, 35, 80);
    for (const p of Object.values(G.players)) { p.st = blankSt(); p.yc = 0; delete p.acadSt; }
    for (const t of G.teams) { t.form = []; if (!isUser(t.id) && t.coach != null) aiTactics(t); }
    G.showcase = null;
    Career.seasonStart && Career.seasonStart();
    if (!first) News.seasonPreview();
  }
  function table(lgId) {
    const tb = G.table[lgId] || {};
    return Object.entries(tb).map(([tid, r]) => ({ tid: +tid, ...r, gd: r.gf - r.ga }))
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || team(b.tid).rep - team(a.tid).rep);
  }
  function acadTableRows() {
    return Object.entries(G.acadTable || {}).map(([tid, r]) => ({ tid: +tid, ...r, gd: r.gf - r.ga })).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  }
  // after the season ends clubs have already changed divisions: read the final standings from the snapshot
  function finalStanding(tid) {
    const sm = G.phase === 'post' && G.lastSummary && G.lastSummary.season === G.season ? G.lastSummary.final : null;
    return (sm && sm[tid]) || null;
  }
  // the league whose table this club belongs on right now (its old division during the post-season)
  function tableLg(tid) { const f = finalStanding(tid); return f ? f.lg : team(tid).leagueId; }
  function position(tid) {
    const f = finalStanding(tid);
    if (f) return f.pos;
    const t = team(tid);
    return table(t.leagueId).findIndex(r => r.tid === tid) + 1;
  }

  function endSeason() {
    G.phase = 'post';
    const summary = { season: G.season, year: G.year, leagues: [], promoted: [], relegated: [], final: {} };
    G.lastTop = {};
    for (const lg of G.leagues) {
      const tb = table(lg.id);
      // snapshot every club's final standing before promotion and relegation move anyone
      tb.forEach((r, i) => { summary.final[r.tid] = { lg: lg.id, tier: lg.tier, pos: i + 1, p: r.p, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, pts: r.pts }; });
      tb.forEach((r, i) => { const t = team(r.tid); prize(t, DATA.PRIZE.league[lg.tier][i] || 1, `${lg.name} ${U.ord(i + 1)} place`); t.hist.push({ s: G.season, lg: lg.id, pos: i + 1, pts: r.pts }); });
      trophy(team(tb[0].tid), lg.name);
      summary.leagues.push({ lg: lg.id, champ: tb[0].tid, table: tb.map(r => ({ tid: r.tid, pts: r.pts, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga })) });
      if (lg.tier === 0) G.lastTop[lg.nation] = tb.slice(0, 2).map(r => r.tid);
    }
    // promotion & relegation: two up, two down in every nation
    for (let n = 0; n < 4; n++) {
      const top = table(n * 2), bot = table(n * 2 + 1);
      const down = top.slice(-2).map(r => r.tid), up = bot.slice(0, 2).map(r => r.tid);
      summary.promoted.push(...up); summary.relegated.push(...down);
      for (const id of down) { const t = team(id); t.tier = 1; t.leagueId = n * 2 + 1; t.rep = Math.max(10, t.rep - 8); }
      for (const id of up) { const t = team(id); t.tier = 0; t.leagueId = n * 2; t.rep = Math.max(t.rep, Math.min(80, t.rep + 8)); }
      league(n * 2).teams = league(n * 2).teams.filter(id => !down.includes(id)).concat(up);
      league(n * 2 + 1).teams = league(n * 2 + 1).teams.filter(id => !up.includes(id)).concat(down);
    }
    // reputation drifts with finishing position
    for (const lg of G.leagues) table(lg.id).forEach((r, i) => { const t = team(r.tid); t.rep = Math.round(U.clamp(t.rep + (5.5 - i) * 0.6, 8, 99)); });
    // awards
    const all = Object.values(G.players).filter(p => p.tid >= 0 && !p.acad && p.st.gp >= 8);
    const avgR = p => p.st.rat / Math.max(1, p.st.gp);
    const boot = all.slice().sort((a, b) => b.st.g - a.st.g)[0];
    const poty = all.slice().sort((a, b) => avgR(b) + b.st.g * 0.02 - (avgR(a) + a.st.g * 0.02))[0];
    const young = all.filter(p => p.age <= 21).sort((a, b) => avgR(b) - avgR(a))[0];
    summary.awards = { boot: boot && boot.id, poty: poty && poty.id, young: young && young.id };
    for (const [k, p] of [['boot', boot], ['poty', poty], ['young', young]]) if (p) { p.awards = p.awards || []; p.awards.push({ s: G.season, k }); }
    const uf = summary.final[G.userTeamId] || { pos: 0, lg: user().leagueId };
    summary.user = { tid: G.userTeamId, pos: uf.pos, lg: uf.lg };
    G.history.push(summary);
    G.lastSummary = summary;
    Career.seasonEnd(summary);
    News.seasonEnd(summary);
    coachCarousel(true);
    save();
  }

  function newSeason() {
    // ageing, growth and decline
    const leaving = [];
    for (const p of Object.values(G.players)) {
      if (p.tid === -2) continue;
      p.age++;
      if (p.st.gp > 0) { p.hist.unshift({ s: G.season, tid: p.tid, gp: p.st.gp, g: p.st.g, a: p.st.a, rat: +(p.st.rat / p.st.gp).toFixed(2) }); p.hist.length = Math.min(p.hist.length, 12); }
      p.car.s += p.st.gp > 0 ? 1 : 0;
      seasonDev(p);
      if (p.tid >= 0 && !p.acad) {
        p.yrs--;
        if (p.yrs <= 0) leaving.push(p);
      }
      if (retires(p)) { if (p.tid >= 0 && G.teams[p.tid]) G.teams[p.tid].squad = G.teams[p.tid].squad.filter(x => x !== p.id); G.fa = G.fa.filter(x => x !== p.id); if (p.tid === G.userTeamId || p.ovr >= 80) News.retire(p); delete G.players[p.id]; }
    }
    // contracts: AI clubs keep the ones they want; the user's expiring players were dealt with in the inbox
    for (const p of leaving) {
      if (!G.players[p.id]) continue;
      if (p.tid === G.userTeamId) { if (!p.renewed) { News.leftOnFree(p); toFA(p); } continue; }
      const t = team(p.tid);
      if (p.age < 32 && p.ovr >= teamLevel(t) - 6 && rng() < 0.75) { p.yrs = U.ri(1, 4); p.wage = marketWage(p); } else toFA(p);
    }
    for (const p of Object.values(G.players)) p.renewed = false;
    // academy graduates who have come of age must be promoted or let go
    for (const p of academy()) if (p.age >= 19) Career.inbox({ type: 'acad', pid: p.id, title: `${p.fn} ${p.ln} has come of age`, body: `At ${p.age}, ${p.ln} is too old for the academy. Promote to the first team or release.`, actions: [{ label: 'Promote', act: 'promote', v: p.id }, { label: 'Release', act: 'releaseAcad', v: p.id, danger: true }] });
    // youth intake for every club; academy intake for the user
    for (const t of G.teams) {
      if (isUser(t.id)) continue;
      const n = U.ri(2, 4);
      for (let i = 0; i < n; i++) { const p = mkPlayer(U.pick(DATA.POS), Math.round(teamLevel(t) - 14 + U.gauss(0, 5)), U.ri(17, 18), t.nation); joinTeam(p, t); }
      trimSquad(t);
      fillSquad(t);
    }
    emergencySign(user());
    const intake = 3 + user().acad.level + (user().ident === 'academy' ? 1 : 0);
    const kids = [];
    for (let i = 0; i < intake; i++) kids.push(mkAcademy(user(), U.ri(15, 16)));
    G.lastIntake = kids.map(p => p.id);
    for (const t of G.teams) if (!isUser(t.id) && t.fin.bal > 25) t.fin.bal = +(25 + (t.fin.bal - 25) * 0.35).toFixed(2);
    // free agents fade away
    G.fa = G.fa.filter(id => { const p = P(id); if (!p) return false; if (p.age > 34 || rng() < 0.25) { delete G.players[id]; return false; } return true; });
    if (G.fa.length > 140) { const keep = G.fa.map(P).filter(Boolean).sort((a, b) => b.ovr - a.ovr); for (const p of keep.slice(140)) delete G.players[p.id]; G.fa = keep.slice(0, 140).map(p => p.id); }
    while (G.fa.length < 60) { const p = mkPlayer(U.pick(DATA.POS), U.ri(45, 68), U.ri(20, 33), U.ri(0, 3)); toFA(p); }
    // coaches age, pool refresh
    for (const c of Object.values(G.coaches)) c.age++;
    while (G.coachPool.length < 14) G.coachPool.push(mkCoach('mgr', U.ri(42, 80)).id);
    refreshStaffPool();
    G.season++;
    G.year++;
    G.scout.known = {};
    // unsigned youth prospects move on: they sign elsewhere over the summer
    const gone = new Set();
    for (const id of G.scout.youth || []) { const p = P(id); if (p && p.tid === -3) { delete G.players[id]; gone.add(id); } }
    G.scout.youth = [];
    if (G.shortlist) G.shortlist = G.shortlist.filter(id => !gone.has(id));
    // a new season, a new crop: the pool turns over straight away
    refreshYouthPool();
    // only the latest season needs the full final-standings snapshot
    for (const h of G.history) if (h !== G.lastSummary) delete h.final;
    for (const t of G.teams) if (!isUser(t.id)) aiTactics(t);
    validateUser();
    startSeason(false);
    Career.newSeason && Career.newSeason();
    save();
  }
  function retires(p) {
    if (p.tid === G.userTeamId && p.age < 36) return false;
    if (p.age >= 38) return true;
    if (p.age >= 33) return rng() < (p.age - 32) * 0.18 + (p.ovr < 60 ? 0.2 : 0);
    return false;
  }
  function trimSquad(t) {
    const sq = squad(t).sort((a, b) => a.ovr - b.ovr);
    while (sq.length > 28) { const p = sq.shift(); toFA(p); }
  }
  // the user's squad can thin out over a summer (expiries, retirements); the board tops it up to the minimum with cheap one-year deals
  function emergencySign(t) {
    const signed = [];
    while (squad(t).length < MIN_SQUAD) {
      const sq = squad(t);
      const pos = Object.keys(DATA.SQUAD_QUOTA).sort((a, b) => (sq.filter(p => p.pos === a).length - DATA.SQUAD_QUOTA[a]) - (sq.filter(p => p.pos === b).length - DATA.SQUAD_QUOTA[b]))[0];
      let p = G.fa.map(P).filter(x => x && x.pos === pos && x.age < 34).sort((a, b) => b.ovr - a.ovr)[0];
      if (!p || p.ovr < teamLevel(t) - 15) p = mkPlayer(pos, Math.round(teamLevel(t) - 8 + U.gauss(0, 3)), U.ri(21, 31), t.nation);
      joinTeam(p, t); p.yrs = 1; p.wage = Math.round(marketWage(p) * 0.8);
      signed.push(p);
    }
    if (signed.length) Career.inbox({ title: `Board signs ${signed.length} emergency player${signed.length > 1 ? 's' : ''}`, body: `The squad fell below ${MIN_SQUAD} senior players, so the board added ${signed.map(p => `${p.fn} ${p.ln} (${p.pos}, ${p.ovr})`).join(', ')} on one-year deals.` });
  }
  function fillSquad(t) {
    for (const pos in DATA.SQUAD_QUOTA) {
      const have = squad(t).filter(p => p.pos === pos).length;
      for (let i = have; i < Math.max(1, DATA.SQUAD_QUOTA[pos] - 1); i++) {
        const fa = G.fa.map(P).filter(p => p && p.pos === pos).sort((a, b) => b.ovr - a.ovr)[0];
        if (fa && fa.ovr >= teamLevel(t) - 12) { joinTeam(fa, t); fa.yrs = U.ri(1, 3); fa.wage = marketWage(fa); }
        else joinTeam(mkPlayer(pos, Math.round(teamLevel(t) - 6 + U.gauss(0, 4)), U.ri(19, 30), t.nation), t);
      }
    }
  }

  // ── development ──
  function growthRate(p) {
    const a = p.age;
    return a <= 17 ? 0.62 : a <= 19 ? 0.5 : a <= 21 ? 0.38 : a <= 23 ? 0.24 : a <= 25 ? 0.12 : a <= 27 ? 0.05 : 0;
  }
  // how much more there is in him: the gap to his potential, and how high that ceiling is
  function potFactor(p) {
    const room = U.clamp((p.pot - p.ovr) / 10, 0, 1.4);
    return room * U.clamp(0.85 + (p.pot - 65) / 120, 0.7, 1.3);
  }
  // everything around the player that speeds him up or slows him down (coaching, training, identity, minutes…)
  function devMult(p, t) {
    const coach = t && isUser(t.id) ? (G.staff.ast != null && G.coaches[G.staff.ast] ? G.coaches[G.staff.ast].rating : 50) : 60;
    const yth = p.acad && G.staff.yth != null && G.coaches[G.staff.yth] ? G.coaches[G.staff.yth].rating : 50;
    const train = t && isUser(t.id) ? { light: 0.75, normal: 1, hard: 1.3 }[G.train] : 1;
    const ident = t && t.ident === 'academy' && p.age <= 21 ? 1.25 : 1;
    const mgr = t && isUser(t.id) && G.mgr.ident === 'developer' && p.age <= 23 ? 1.2 : 1;
    const pro = p.pers === 'pro' ? 1.2 : p.pers === 'flair' ? 0.95 : 1;
    const minutes = p.acad ? 1 : U.clamp(0.6 + (p.st.min || 0) / Math.max(1, (G.day / 7) * 90) * 0.8, 0.6, 1.3);
    const lvl = p.acad ? 1 + (yth - 50) / 120 + (t ? t.acad.level * 0.05 : 0) : 1 + (coach - 50) / 160;
    // retraining eats into the time he'd otherwise spend improving
    const retrain = p.trainPos && p.trainPos !== p.pos ? 0.85 : 1;
    return train * ident * mgr * pro * minutes * lvl * retrain * (p.acad ? 1.15 : 1);
  }
  // weeks of training to learn a new position: the young learn fastest, and nearby positions come easier
  function retrainWeeks(p, pos) {
    if (!pos || pos === p.pos) return 0;
    const base = p.age <= 20 ? 8 : p.age <= 24 ? 11 : p.age <= 28 ? 15 : 20;
    const near = p.alt && p.alt.includes(pos) ? 0.4 : 1.6 - TAC.fam({ ...p, trainPos: null, retrain: 0 }, pos);
    return Math.max(3, Math.round(base * near));
  }
  const WEEKS = 24;
  // the development outlook the UI shows, built from the same numbers weeklyDev uses
  function growthInfo(p) {
    const t = p.tid >= 0 ? team(p.tid) : null;
    const ageF = growthRate(p), potF = potFactor(p), mult = devMult(p, t);
    const weekly = ageF * potF * mult;
    const season = Math.min(Math.max(0, p.pot - p.ovr), weekly * WEEKS);
    const pro = (p.pers === 'pro' ? 0.6 : 1) * (t && t.ident === 'oldguard' ? 0.6 : 1);
    const declinePts = (p.age >= 30 ? (p.age - 29) * 0.06 * WEEKS * pro : 0) + (p.age >= 31 ? (p.age - 30) * 1.5 : 0);
    const decline = declinePts * 0.12;
    const net = season - decline;
    const phase = p.age <= 19 ? 'Breakthrough years' : p.age <= 23 ? 'Developing' : p.age <= 27 ? 'Entering his prime' : p.age <= 29 ? 'At his peak' : 'Veteran: physical decline';
    const label = net >= 6 ? 'Explosive' : net >= 3.5 ? 'Rapid' : net >= 1.5 ? 'Steady' : net > 0.3 ? 'Slow' : net > -0.5 ? 'Plateau' : 'Declining';
    // where a season of growth points would land: 60% on the role's keys, the rest by the target position
    const pts = weekly * 6.5 * WEEKS, pos = p.trainPos || p.pos, w = DATA.OVR_W[pos];
    const role = p.focus && TAC.ROLES[p.focus] && TAC.ROLES[p.focus].slots.includes(pos) ? TAC.ROLES[p.focus] : null;
    const keys = role ? role.keys.map(k => AK[k]) : [];
    const proj = p.a.map((v, i) => Math.min(99 - v, Math.round(pts * ((keys.includes(i) ? 0.6 / keys.length : 0) + (keys.length ? 0.4 : 1) * w[i]))));
    return { ageF, potF, mult, weekly, season, decline, net, phase, label, proj, pos, weeks: retrainWeeks(p, p.trainPos), progress: p.retrain || 0 };
  }
  // the player's development plan: a position to grow into, and a role within it
  function setPlan(pid, pos, roleId) {
    const p = P(pid);
    if (!p) return;
    if (pos) {
      if ((p.pos === 'GK') !== (pos === 'GK')) return;
      if (pos === p.pos) { p.trainPos = null; p.retrain = 0; }
      else if (pos !== p.trainPos) { p.trainPos = pos; p.retrain = 0; }
      const target = p.trainPos || p.pos;
      if (!p.focus || !TAC.ROLES[p.focus] || !TAC.ROLES[p.focus].slots.includes(target)) p.focus = TAC.defaultRole(target);
    }
    if (roleId && TAC.ROLES[roleId]) p.focus = roleId;
    save();
  }
  function retrainWeek(p) {
    if (!p.trainPos || p.trainPos === p.pos) return;
    p.retrain = Math.min(1, (p.retrain || 0) + 1 / retrainWeeks(p, p.trainPos));
    if (p.retrain < 1) return;
    const old = p.pos;
    p.pos = p.trainPos;
    p.alt = [old, ...(p.alt || []).filter(x => x !== p.pos && x !== old)].slice(0, 3);
    p.trainPos = null; p.retrain = 0;
    retarget(p);
    if (p.tid === G.userTeamId) Career.inbox({ type: 'scout', pid: p.id, title: `${p.ln} is now a ${DATA.POS_NAME[p.pos]}`, body: `${p.fn} ${p.ln} has finished retraining and plays ${p.pos} naturally (${p.ovr} overall there). ${old} stays in his locker as a secondary position.`, actions: [{ label: 'View player', act: 'player', v: p.id }] });
  }
  // spend growth points on attributes: the training focus role's keys first, then the target position's weights
  function spend(p, pts) {
    p.gp = (p.gp || 0) + pts;
    const pos = p.trainPos || p.pos, w = DATA.OVR_W[pos];
    const role = p.focus && TAC.ROLES[p.focus] && TAC.ROLES[p.focus].slots.includes(pos) ? TAC.ROLES[p.focus] : null;
    const keys = role ? role.keys.map(k => AK[k]) : [];
    // hallmark training: a share of the work goes into whatever attributes are still short of its requirement
    const hmh = p.hmTrain && DATA.HM[p.hmTrain.id], hmT = hmh ? hmTarget(p, hmh.id) : 0;
    let guard = 0;
    while (p.gp >= 1 && guard++ < 40) {
      p.gp -= 1;
      let i;
      const short = hmh ? Object.keys(hmh.req).filter(k => p.a[AK[k]] < hmh.req[k] + hmT).map(k => AK[k]) : [];
      if (short.length && rng() < 0.35) i = U.pick(short);
      else if (keys.length && rng() < 0.6) i = U.pick(keys);
      else i = U.wpick(w.map((x, k) => k), k => w[k] + 0.01);
      if (p.a[i] < 99) p.a[i]++;
    }
    retarget(p);
  }
  function decline(p, amt) {
    for (let k = 0; k < amt; k++) {
      const i = rng() < 0.65 ? U.pick([0, 1, 2]) : U.ri(0, DATA.ATTRS.length - 2);
      if (p.a[i] > 20) p.a[i]--;
    }
    retarget(p);
  }
  function weeklyDev(p, t) {
    if (p.inj > 0) return;
    retrainWeek(p);
    hmTrainWeek(p);
    const gain = growthRate(p) * potFactor(p) * devMult(p, t);
    if (gain > 0) spend(p, gain * 6.5);
    if (p.age >= 30 && rng() < (p.age - 29) * 0.06 * (p.pers === 'pro' ? 0.6 : 1) * (t && t.ident === 'oldguard' ? 0.6 : 1)) decline(p, 1);
  }
  function seasonDev(p) {
    if (p.age >= 31) decline(p, Math.round((p.age - 30) * U.rand(0.8, 2.2)));
    // potential re-rolls a touch for the young
    if (p.age <= 22) p.pot = Math.round(U.clamp(p.pot + U.gauss(0, 2), p.ovr, 97));
    retarget(p);
    hmSeason(p);
  }

  // ── strength for quick sims ──
  function strength(t, xi) {
    const tac = t.tac;
    const players = (xi || tac.lineup).map(P).filter(Boolean);
    const fo = TAC.formation(tac.oop);
    let att = 0, aw = 0, def = 0, dw = 0, mid = 0, mw = 0;
    players.forEach((p, i) => {
      const pos = fo.slots[i] ? fo.slots[i].pos : p.pos;
      const g = DATA.POS_GROUP[pos], v = (calcOvr(p, pos) + hmBonus(p)) * TAC.fam(p, pos) * (0.85 + 0.15 * p.fit / 100) * (0.96 + p.mor / 1250);
      if (g === 'FWD') { att += v * 1.2; aw += 1.2; mid += v * 0.3; mw += 0.3; }
      else if (g === 'MID') { mid += v; mw += 1; att += v * 0.5; aw += 0.5; def += v * 0.35; dw += 0.35; }
      else if (g === 'DEF') { def += v; dw += 1; mid += v * 0.15; mw += 0.15; }
      else { def += v * 1.4; dw += 1.4; }
    });
    const n = players.length;
    const short = n < 11 ? (11 - n) * 3 : 0;
    return { att: (aw ? att / aw : 50) - short, mid: (mw ? mid / mw : 50) - short, def: (dw ? def / dw : 50) - short };
  }
  function boostFor(t, opp, home, cup) {
    let b = 1;
    const c = t.coach != null ? G.coaches[t.coach] : null;
    const rating = isUser(t.id) ? 50 + G.mgr.rep * 0.35 : c ? c.rating : 55;
    b *= 0.97 + rating / 1600;
    if (home) b *= t.ident === 'fortress' ? 1.045 : 1.022;
    if (t.ident === 'underdog' && opp && opp.rep > t.rep + 8) b *= 1.06;
    if (isUser(t.id)) b *= Career.boostMult ? Career.boostMult() : 1;
    return b;
  }

  // Poisson quick sim for matches nobody is watching
  function quickSim(f) {
    const h = team(f.h), a = team(f.a);
    if (!isUser(h.id)) autoLineup(h); else validateUser();
    if (!isUser(a.id)) autoLineup(a); else validateUser();
    const sh = strength(h), sa = strength(a);
    const bh = boostFor(h, a, !f.neutral, f.ko), ba = boostFor(a, h, false, f.ko);
    const ch = G.coaches[h.coach], ca = G.coaches[a.coach];
    const blitz = (ch && ch.ident === 'blitz') || (ca && ca.ident === 'blitz') ? 0.3 : 0;
    const r0 = new Rng(f.seed ^ 0x5bd1);
    const dayH = 1 + r0.gauss() * 0.12, dayA = 1 + r0.gauss() * 0.12;
    const lh = U.clamp(1.78 * Math.exp(((sh.att * 0.6 + sh.mid * 0.4) * bh - (sa.def * 0.65 + sa.mid * 0.35) * ba) / 19) * dayH + blitz, 0.2, 4.5);
    const la = U.clamp(1.42 * Math.exp(((sa.att * 0.6 + sa.mid * 0.4) * ba - (sh.def * 0.65 + sh.mid * 0.35) * bh) / 19) * dayA + blitz, 0.2, 4.5);
    const r = new Rng(f.seed);
    const hs = r.poisson(lh), as = r.poisson(la);
    const res = { score: [hs, as], pens: null, players: [], events: [], stats: null, motm: null };
    if (f.ko && hs === as) { const ph = r.int(3, 5), pa = ph === 5 ? r.int(3, 4) : r.chance(0.5) ? ph + 1 : ph - 1; res.pens = [ph, Math.max(0, pa)]; if (res.pens[0] === res.pens[1]) res.pens[1]--; }
    const sides = [h, a];
    for (const s of [0, 1]) {
      const t = sides[s], xi = t.tac.lineup.map(P).filter(Boolean);
      const recs = new Map(xi.map((p, i) => [p.id, { pid: p.id, team: s, slot: i, min: 90, rating: 0, goals: 0, assists: 0, saves: 0, yellow: 0, red: 0, inj: 0, fit: Math.round(U.clamp(p.fit - r.range(18, 30), 30, 100)), hits: r.int(0, 2) }]));
      const goals = res.score[s];
      for (let g = 0; g < goals; g++) {
        const sc = U.wpick(xi, p => (p.pos === 'GK' ? 0 : (p.a[AK.finishing] / 10) ** 2 * ({ FWD: 5, MID: 1.8, DEF: 0.4 }[DATA.POS_GROUP[p.pos]] || 0.1)));
        recs.get(sc.id).goals++;
        const min = r.int(1, 90);
        let ap = null;
        if (r.chance(0.72)) { ap = U.wpick(xi.filter(p => p !== sc), p => (p.a[AK.passing] + p.a[AK.vision] + p.a[AK.crossing]) / 30 * (p.pos === 'GK' ? 0.05 : 1)); recs.get(ap.id).assists++; }
        res.events.push({ min, type: 'goal', team: s, pid: sc.id, apid: ap ? ap.id : null });
      }
      if (r.chance(0.05)) { const p = U.pick(xi); recs.get(p.id).red = 1; res.events.push({ min: r.int(20, 90), type: 'red', team: s, pid: p.id }); }
      for (let k = r.poisson(1.7); k > 0; k--) { const p = U.pick(xi); recs.get(p.id).yellow = 1; }
      if (r.chance(0.09)) { const p = U.pick(xi.filter(q => q.pos !== 'GK')); if (p) { recs.get(p.id).inj = r.chance(0.7) ? r.int(3, 14) : r.int(15, 50); res.events.push({ min: r.int(5, 90), type: 'injury', team: s, pid: p.id }); } }
      const conceded = res.score[1 - s], won = res.score[s] > conceded, lost = res.score[s] < conceded;
      for (const rec of recs.values()) {
        const p = P(rec.pid), g = DATA.POS_GROUP[p.pos];
        let rt = 6.3 + r.gauss() * 0.45 + rec.goals * 1 + rec.assists * 0.6 + (won ? 0.3 : lost ? -0.3 : 0) + (p.ovr - 70) / 40;
        if ((g === 'DEF' || g === 'GK') && conceded === 0) rt += 0.5;
        if (g === 'DEF' || g === 'GK') rt -= conceded * 0.2;
        if (g === 'GK') { rec.saves = r.int(1, 6); rt += rec.saves * 0.08; }
        rec.rating = Math.round(U.clamp(rt, 3.5, 10) * 10) / 10;
        res.players.push(rec);
      }
    }
    res.events.sort((x, y) => x.min - y.min);
    const best = res.players.slice().sort((x, y) => y.rating - x.rating)[0];
    res.motm = best ? best.pid : null;
    return res;
  }
  // academy 5-a-side quick result (rival kids aren't real players)
  function quickAcad(f) {
    const h = team(f.h), a = team(f.a), r = new Rng(f.seed);
    const sh = isUser(h.id) ? U.avg(academy().map(p => p.ovr).sort((x, y) => y - x).slice(0, 5)) : 42 + h.acad.level * 3;
    const sa = isUser(a.id) ? U.avg(academy().map(p => p.ovr).sort((x, y) => y - x).slice(0, 5)) : 42 + a.acad.level * 3;
    return { score: [r.poisson(U.clamp(2 * Math.exp((sh - sa) / 9), 0.3, 6)), r.poisson(U.clamp(1.8 * Math.exp((sa - sh) / 9), 0.3, 6))], players: [], events: [] };
  }

  // the user couldn't field five: a 3-0 walkover to the rivals
  function acadForfeit(f) { const userHome = f.h === G.userTeamId; return { score: userHome ? [0, 3] : [3, 0], players: [], events: [], forfeit: true }; }

  // ── applying results ──
  function rec(tb, tid, gf, ga) {
    const r = tb[tid];
    if (!r) return;
    r.p++; r.gf += gf; r.ga += ga;
    const res = gf > ga ? 'W' : gf < ga ? 'L' : 'D';
    if (res === 'W') { r.w++; r.pts += 3; } else if (res === 'D') { r.d++; r.pts++; } else r.l++;
    r.form.push(res); if (r.form.length > 5) r.form.shift();
  }
  function applyResult(f, res) {
    f.done = true;
    f.hs = res.score[0]; f.as = res.score[1];
    f.pens = res.pens || null;
    f.motm = res.motm;
    f.ev = (res.events || []).filter(e => ['goal', 'red', 'injury', 'pen'].includes(e.type)).map(e => ({ m: e.min, t: e.type, s: e.team, p: e.pid, a: e.apid }));
    if (f.comp === 'A') {
      rec(G.acadTable, f.h, f.hs, f.as); rec(G.acadTable, f.a, f.as, f.hs);
      for (const pr of res.players || []) { const p = P(pr.pid); if (p && p.acad) { p.st.gp++; p.st.g += pr.goals; p.st.a += pr.assists; p.st.rat += pr.rating; } }
      return;
    }
    if (f.comp === 'L') { rec(G.table[f.lg], f.h, f.hs, f.as); rec(G.table[f.lg], f.a, f.as, f.hs); }
    const sides = [team(f.h), team(f.a)];
    for (const s of [0, 1]) {
      const t = sides[s], gf = res.score[s], ga = res.score[1 - s];
      const r = gf > ga ? 'W' : gf < ga ? 'L' : f.pens ? (winnerOf(f) === t.id ? 'W' : 'L') : 'D';
      t.form.push(r); if (t.form.length > 10) t.form.shift();
      const c = t.coach != null ? G.coaches[t.coach] : null;
      if (c) { if (r === 'W') c.w++; else if (r === 'D') c.d++; else c.l++; }
      if (isUser(t.id)) { if (r === 'W') G.mgr.w++; else if (r === 'D') G.mgr.d++; else G.mgr.l++; }
      // morale
      const delta = r === 'W' ? 4 : r === 'D' ? 0 : -4;
      const played = new Set((res.players || []).filter(x => x.team === s && x.min > 0).map(x => x.pid));
      for (const p of squad(t)) {
        const leader = squad(t).some(q => q.pers === 'leader' && played.has(q.id)) && delta < 0 ? 2 : 0;
        p.mor = Math.round(U.clamp(p.mor + delta + leader + (played.has(p.id) ? 1 : p.ovr > teamLevel(t) + 2 ? -2 : -0.5), 15, 100));
      }
    }
    // player stats
    for (const pr of res.players || []) {
      const p = P(pr.pid);
      if (!p || p.acad) continue;
      if (pr.min > 0) {
        if (f.comp !== 'I' && f.comp !== 'S' && f.comp !== 'F') {
          p.st.gp++; p.st.g += pr.goals; p.st.a += pr.assists; p.st.rat += pr.rating; p.st.min += pr.min; p.st.hits += pr.hits || 0;
          p.car.gp++; p.car.g += pr.goals; p.car.a += pr.assists;
          if (pr.yellow) { p.st.yc++; p.yc++; if (p.yc % 5 === 0) p.ban = Math.max(p.ban, 1); }
          if (pr.red) { p.st.rc++; p.ban = Math.max(p.ban, U.ri(1, 3)); }
          const conceded = res.score[1 - pr.team];
          if ((p.pos === 'GK' || DATA.POS_GROUP[p.pos] === 'DEF') && conceded === 0 && pr.min >= 60) p.st.cs++;
          if (res.motm === p.id) { p.st.motm++; p.car.motm++; }
        }
        p.form.push(pr.rating); if (p.form.length > 5) p.form.shift();
        p.fit = Math.round(U.clamp(pr.fit != null ? pr.fit : p.fit - 22, 20, 100));
        if (p.debutPending && p.tid === G.userTeamId) { p.debutPending = false; G.stats.youthDebuts++; News.debut(p); }
      }
      if (pr.inj) { p.inj = Math.max(p.inj, pr.inj); if (p.tid === G.userTeamId) Career.inbox({ type: 'injury', title: `${p.fn} ${p.ln} injured`, body: `Out for about ${p.inj} days.` }); }
    }
    // suspended players who sat this one out serve their ban
    for (const t of sides) for (const p of squad(t)) if (p.ban > 0 && !(res.players || []).some(x => x.pid === p.id && x.min > 0)) p.ban--;
    // gate money for the home side (neutral venues split an appearance fee)
    const ht = sides[0];
    if (!f.neutral) {
      const att = attendance(ht, sides[1], f);
      f.att = att;
      const gate = (att * ht.fin.ticket) / 1e6 * (f.comp === 'X' ? 1.6 : f.comp === 'C' ? 1.2 : 1) * (ht.ident === 'entertainers' ? 1 + 0.04 * f.hs : 1);
      logMoney(ht, gate, 'gate', `Gate receipts vs ${sides[1].abbr}`);
    }
    if (f.comp === 'S') { for (const t of sides) logMoney(t, DATA.PRIZE.showcase * (winnerOf(f) === t.id ? 1.4 : 1), 'events', DATA.SHOWCASE); }
    if (f.comp === 'C') cupAdvance(f.lg);
    if (f.comp === 'X') contAdvance();
    if (f.comp === 'I') { invAdvance(); if (f.rd === 'F' || f.rd === '3rd') invFinish(f); }
  }
  function attendance(t, opp, f) {
    const form = t.form.slice(-5).filter(x => x === 'W').length - t.form.slice(-5).filter(x => x === 'L').length;
    const big = f.comp === 'X' || f.comp === 'C' && (f.rd === 'SF' || f.rd === 'F') ? 0.25 : 0;
    const price = t.fin.ticket / (t.tier === 0 ? 32 : 16);
    const wxm = { rain: 0.92, storm: 0.8, snow: 0.85, heat: 0.95 }[f.wx && f.wx.id] || 1;
    const fill = U.clamp(0.4 + t.rep / 180 + opp.rep / 600 + form * 0.03 + big - (price - 1) * 0.45, 0.2, 1) * wxm;
    return Math.round(t.stadium.cap * fill);
  }

  // ── the day loop ──
  const todays = (day = G.day) => G.fixtures.filter(f => f.day === day);
  function userFixture(day = G.day) { return todays(day).find(f => !f.done && f.comp !== 'A' && (f.h === G.userTeamId || f.a === G.userTeamId)) || null; }
  function userAcadFixture(day = G.day) { return todays(day).find(f => !f.done && f.comp === 'A' && (f.h === G.userTeamId || f.a === G.userTeamId)) || null; }
  function nextUserFixture() { return G.fixtures.filter(f => !f.done && f.day >= G.day && f.comp !== 'A' && (f.h === G.userTeamId || f.a === G.userTeamId)).sort((a, b) => a.day - b.day)[0] || null; }
  // what's blocking the day from moving on
  function pending() {
    if (G.phase === 'post') return { kind: 'post' };
    const f = userFixture();
    if (f) return { kind: 'match', f };
    const af = userAcadFixture();
    if (af && !af.skip) return { kind: 'acad', f: af };
    const dec = G.inbox.find(m => !m.done && m.block);
    if (dec) return { kind: 'decision', m: dec };
    return null;
  }
  // simulate everything still unplayed today
  function simRest() {
    for (const f of todays()) {
      if (f.done) continue;
      if (f.comp === 'A') { applyResult(f, f.skip ? acadForfeit(f) : quickAcad(f)); continue; }
      if (f.h === G.userTeamId || f.a === G.userTeamId) continue;
      applyResult(f, quickSim(f));
    }
  }
  function advanceDay() {
    simRest();
    if (G.day >= SEA.END && G.phase === 'season') { endSeason(); return; }
    if (G.phase === 'post') {
      if (G.day >= SEA.LEN) { newSeason(); return; }
    }
    G.day++;
    daily();
    if (G.day === SEA.END && G.phase === 'season') { simRest(); }
    save();
  }
  function daily() {
    const u = user();
    const fitC = G.staff.fit != null && G.coaches[G.staff.fit] ? G.coaches[G.staff.fit].rating : 50;
    const rec = { light: 13, normal: 10, hard: 7 }[G.train] * (0.8 + fitC / 250);
    for (const p of Object.values(G.players)) {
      if (p.tid < 0) continue;
      if (p.inj > 0) p.inj--;
      p.fit = Math.min(100, p.fit + (p.tid === G.userTeamId ? rec : 11));
    }
    // training knocks
    if (G.train === 'hard' && rng() < 0.03) {
      const p = U.pick(squad(u).filter(x => x.inj <= 0));
      if (p) { p.inj = U.ri(2, 12); Career.inbox({ type: 'injury', title: `${p.ln} hurt in training`, body: `Hard sessions take their toll: out for ${p.inj} days.` }); }
    }
    if (G.day % 7 === 0) weekly();
    if (windowOpen()) transferDay();
    scoutingDay();
    Career.daily();
    // midseason showcase invitation
    if (G.day === SEA.SHOWCASE - 6 && !G.showcase) Career.showcaseInvite();
    if (G.day === SEA.WINDOWS[1][0]) News.windowOpens();
    if (G.day === SEA.WINDOWS[0][1] + 1 || G.day === SEA.WINDOWS[1][1] + 1) News.windowCloses();
    if (G.day % 7 === 3) coachCarousel(false);
    if (G.day % 7 === 1) News.weekly();
  }
  function weekly() {
    // money in, money out
    for (const t of G.teams) {
      const tv = t.tier === 0 ? 0.26 : 0.08;
      const spon = 0.0032 * t.rep * (t.ident === 'galactico' ? 1.3 : 1);
      const merch = 0.001 * t.rep * (1 + t.form.slice(-5).filter(x => x === 'W').length * 0.08);
      const wages = payroll(t) / 1000;
      const ops = 0.06 + 0.02 * t.facilities + (isUser(t.id) ? staffWages() / 1000 + 0.015 * t.acad.level : 0.03);
      logMoney(t, tv, 'tv', 'Broadcast money');
      logMoney(t, spon + merch, 'spon', 'Sponsorship & merchandise');
      logMoney(t, -wages, 'wages', 'Player wages');
      logMoney(t, -ops, 'ops', isUser(t.id) ? 'Staff, academy & running costs' : 'Running costs');
    }
    // development
    for (const t of G.teams) for (const p of squad(t)) weeklyDev(p, t);
    for (const p of academy()) weeklyDev(p, user());
    // morale drifts back toward content; unhappy stars grumble
    for (const p of squad(user())) {
      p.mor = Math.round(p.mor + (68 - p.mor) * 0.08);
      if (p.pers === 'ambitious' && p.mor < 40 && p.ovr > teamLevel(user()) && rng() < 0.15 && !p.wantsOut) {
        p.wantsOut = true;
        Career.inbox({ type: 'unrest', pid: p.id, title: `${p.ln} wants to talk`, body: `${p.fn} ${p.ln} is frustrated and has asked about leaving. Selling him would be easiest — or win him back with game time.` });
      }
    }
    Career.weekly();
  }

  // ── transfers ──
  function askingPrice(p) {
    const t = team(p.tid);
    if (!t) return 0;
    const sq = squad(t).sort((a, b) => b.ovr - a.ovr);
    const key = sq.indexOf(p) < 14 ? 1.2 : 1;
    const mb = t.ident === 'moneyball' ? 1.15 : 1;
    const listed = p.listed ? 0.85 : 1;
    return +(value(p) * 1.15 * key * mb * listed * (isUser(t.id) ? 1 : 1)).toFixed(2);
  }
  function needs(t) {
    const out = {};
    for (const pos in DATA.SQUAD_QUOTA) out[pos] = DATA.SQUAD_QUOTA[pos] - squad(t).filter(p => p.pos === pos).length;
    return out;
  }
  // AI club's verdict on a user's offer: { ok, counter?, why }
  function evalOffer(pid, fee, givePids = []) {
    const p = P(pid), t = team(p.tid);
    if (!windowOpen()) return { ok: false, why: 'The transfer window is closed.' };
    if (p.untouchable) return { ok: false, why: `${t.name} won't sell their captain.` };
    const ask = askingPrice(p);
    const need = needs(t);
    let swap = 0;
    for (const id of givePids) {
      const q = P(id);
      const fit = need[q.pos] > 0 ? 1 : 0.7;
      const level = q.ovr >= teamLevel(t) - 4 ? 1 : 0.6;
      swap += value(q) * fit * level;
    }
    const total = fee + swap;
    const mood = 0.92 + (U.hash(`${pid}:${G.day}`) % 100) / 600;
    if (total >= ask * mood) return { ok: true, why: `${t.name} accept.` };
    if (total >= ask * 0.72) return { ok: false, counter: +(ask * mood - swap).toFixed(2), why: `${t.name} want more.` };
    return { ok: false, why: `${t.name} laugh the bid off. They value ${p.ln} at around ${U.money(ask)}.` };
  }
  // would the player sign for us, and for what wage?
  function wageDemand(p, t = user()) {
    const base = marketWage(p);
    const repGap = U.clamp((p.ovr - teamLevel(t)) / 20, -0.3, 0.6);
    const pers = p.pers === 'ambitious' ? 1.2 : p.pers === 'loyal' && p.tid === t.id ? 0.85 : 1;
    return Math.max(1, Math.round(base * (1.08 + repGap) * pers));
  }
  function willingness(p, t = user()) {
    // the big names won't drop two divisions for anyone
    const lvl = teamLevel(t), gap = p.ovr - lvl;
    if (p.tid >= 0 && team(p.tid).tier < t.tier && p.ovr > lvl + 4) return 0.15;
    return U.clamp(1 - Math.max(0, gap - 4) / 14 + (G.mgr.rep - 40) / 200, 0.05, 1);
  }
  function wageRoom() {
    const t = user();
    return +(weeklyIncome(t) * 1000 * 0.75 - payroll(t)).toFixed(0);
  }
  function weeklyIncome(t) { return (t.tier === 0 ? 0.26 : 0.08) + 0.0042 * t.rep + (t.stadium.cap * t.fin.ticket * 0.7) / 1e6 / 2; }
  function completeSigning(pid, fee, givePids, wage, yrs) {
    const p = P(pid), from = p.tid >= 0 ? team(p.tid) : null, u = user();
    if (fee > u.fin.bal + 0.001) return { ok: false, why: 'Not enough money in the bank.' };
    for (const id of givePids) { const q = P(id); joinTeam(q, from); q.yrs = Math.max(q.yrs, 2); }
    if (from) { logMoney(from, fee, 'sales', `Sold ${p.ln}`); }
    logMoney(u, -fee, 'fees', `Signed ${p.fn} ${p.ln}`);
    joinTeam(p, u);
    p.wage = wage; p.yrs = yrs; p.mor = 80; p.listed = false; p.wantsOut = false;
    G.stats.signings++;
    G.scout.known[p.id] = 3;
    G.shortlist = G.shortlist.filter(x => x !== pid);
    News.transfer(p, from, u, fee, givePids);
    Career.onSign(p, fee);
    if (from && !isUser(from.id)) fillSquad(from);
    save();
    return { ok: true };
  }
  // the user's senior squad can't drop below this many players
  const MIN_SQUAD = 16;
  const squadFloorWhy = () => `You need at least ${MIN_SQUAD} senior players — sign someone first.`;
  function canLose(n = 1) { return squad(user()).length - n >= MIN_SQUAD; }
  function sellTo(pid, buyerId, fee, viaOffer) {
    const p = P(pid), u = user(), b = team(buyerId);
    if (!p || p.tid !== u.id || !b || isUser(b.id)) return { ok: false, why: 'The deal has fallen through.' };
    if (!windowOpen()) return { ok: false, why: 'The transfer window has closed: the deal is off.' };
    if (b.fin.bal < fee) return { ok: false, why: `${b.name} can no longer afford the fee.` };
    if (!canLose()) return { ok: false, why: squadFloorWhy() };
    logMoney(u, fee * (u.ident === 'moneyball' ? 1.0 : 1), 'sales', `Sold ${p.ln} to ${b.abbr}`);
    logMoney(b, -fee, 'fees', `Signed ${p.ln}`);
    joinTeam(p, b);
    p.wage = marketWage(p); p.yrs = U.ri(2, 4); p.listed = false; p.wantsOut = false;
    G.stats.sales++;
    validateUser();
    News.transfer(p, u, b, fee, []);
    Career.onSell(p, fee);
    save();
    return { ok: true };
  }
  // an AI club proposes a swap: one of their players (plus or minus cash) for one of yours
  function tradeProposal() {
    const u = user(), mine = squad(u).filter(p => !p.untouchable && p.ovr >= teamLevel(u) - 6);
    if (!mine.length) return;
    const target = U.pick(mine), myNeeds = needs(u);
    const clubs = G.teams.filter(t => !isUser(t.id) && Math.abs(teamLevel(t) - target.ovr) < 10 && needs(t)[target.pos] > -1);
    for (const t of U.shuffle(clubs).slice(0, 6)) {
      const offer = squad(t).filter(p => p.pos !== target.pos && (myNeeds[p.pos] > 0 || p.ovr >= target.ovr - 3) && Math.abs(value(p) - value(target)) < value(target) * 0.6).sort((a, b) => b.ovr - a.ovr)[0];
      if (!offer) continue;
      const cash = +Math.max(-u.fin.bal * 0.5, (value(target) - value(offer)) * U.rand(0.9, 1.15)).toFixed(2);
      if (cash > t.fin.bal * 0.7) continue;
      if (G.inbox.some(m => !m.done && m.type === 'trade' && (m.pid === target.id || m.give === offer.id))) return;
      const cashTxt = Math.abs(cash) < 0.05 ? '' : cash > 0 ? ` + ${U.money(cash)} to you` : ` + ${U.money(-cash)} from you`;
      Career.inbox({ type: 'trade', pid: target.id, give: offer.id, fee: cash, buyer: t.id, title: `${t.name} propose a swap`, body: `${offer.fn} ${offer.ln} (${offer.pos}, ${offer.ovr}, age ${offer.age})${cashTxt} for your ${target.fn} ${target.ln} (${target.pos}, ${target.ovr}).`, actions: [{ label: 'Accept trade', act: 'acceptTrade' }, { label: 'View their player', act: 'player', v: offer.id }, { label: 'Decline', act: 'dismiss', danger: true }], expires: G.day + 4 });
      return;
    }
  }
  function executeTrade(m) {
    const mine = P(m.pid), theirs = P(m.give), t = team(m.buyer), u = user();
    if (!mine || !theirs || mine.tid !== u.id || theirs.tid !== t.id) return 'The deal has fallen through.';
    if (m.fee < 0 && u.fin.bal < -m.fee) return 'You cannot afford your side of the deal.';
    if (m.fee > 0 && t.fin.bal < m.fee) return `${t.name} can no longer afford their side of the deal.`;
    if (!windowOpen()) return 'The transfer window has closed: the deal is off.';
    joinTeam(mine, t); mine.yrs = Math.max(mine.yrs, 2);
    joinTeam(theirs, u); theirs.yrs = Math.max(theirs.yrs, 2); theirs.mor = 75;
    if (m.fee) { logMoney(u, m.fee, m.fee > 0 ? 'sales' : 'fees', `Trade with ${t.abbr}`); logMoney(t, -m.fee, 'fees', `Trade with ${u.abbr}`); }
    G.scout.known[theirs.id] = 3;
    validateUser();
    News.transfer(theirs, t, u, Math.max(0, -m.fee), [mine.id]);
    G.stats.signings++;
    save();
    return `Done: ${theirs.ln} joins, ${mine.ln} heads to ${t.name}.`;
  }
  function release(pid) {
    const p = P(pid), u = user();
    if (!p || p.tid !== u.id || !canLose()) return null;
    const payoff = +((p.wage * 52 * Math.max(0, p.yrs) * 0.5) / 1000).toFixed(2);
    logMoney(u, -payoff, 'fees', `Released ${p.ln} (settlement)`);
    toFA(p);
    validateUser();
    save();
    return payoff;
  }
  function renew(pid, wage, yrs) {
    const p = P(pid);
    p.wage = wage; p.yrs = yrs; p.renewed = true; p.mor = Math.min(100, p.mor + 8);
    save();
  }
  // AI activity on window days: clubs buying from each other, and bids for the user's players
  function transferDay() {
    const n = U.ri(1, 4);
    for (let i = 0; i < n; i++) {
      const buyer = U.pick(G.teams.filter(t => !isUser(t.id) && t.fin.bal > 2));
      if (!buyer) break;
      const need = Object.entries(needs(buyer)).sort((a, b) => b[1] - a[1])[0][0];
      const lvl = teamLevel(buyer);
      const cands = Object.values(G.players).filter(p => p.tid >= 0 && !p.acad && p.tid !== buyer.id && p.tid !== G.userTeamId && p.pos === need && p.ovr >= lvl - 3 && p.ovr <= lvl + 6 && team(p.tid).rep <= buyer.rep + 5);
      const fa = G.fa.map(P).filter(p => p && p.pos === need && p.ovr >= lvl - 6);
      if (fa.length && rng() < 0.4) { const p = U.pick(fa); joinTeam(p, buyer); p.yrs = U.ri(1, 3); p.wage = marketWage(p); continue; }
      if (!cands.length) continue;
      const p = U.pick(cands), fee = askingPrice(p) * U.rand(0.95, 1.15);
      if (fee > buyer.fin.bal * 0.7) continue;
      const from = team(p.tid);
      logMoney(from, fee, 'sales', `Sold ${p.ln}`);
      logMoney(buyer, -fee, 'fees', `Signed ${p.ln}`);
      joinTeam(p, buyer);
      p.wage = marketWage(p); p.yrs = U.ri(2, 5);
      if (fee > 4 || p.ovr >= 78) News.transfer(p, from, buyer, fee, []);
      fillSquad(from);
      trimSquad(buyer);
    }
    if (rng() < 0.06) tradeProposal();
    // bids for the user's players: listed players attract interest, stars occasionally
    for (const p of squad(user())) {
      const lvl = teamLevel(user());
      const chance = p.listed ? 0.18 : p.wantsOut ? 0.1 : p.ovr > lvl + 5 ? 0.025 : 0.006;
      if (rng() > chance) continue;
      const buyers = G.teams.filter(t => !isUser(t.id) && Math.abs(teamLevel(t) - p.ovr) < 9 && t.fin.bal > value(p) * 0.8);
      if (!buyers.length) continue;
      const b = U.pick(buyers);
      const fee = +(value(p) * U.rand(p.listed ? 0.8 : 0.95, p.listed ? 1.1 : 1.35)).toFixed(2);
      if (G.inbox.some(m => !m.done && m.type === 'bid' && m.pid === p.id)) continue;
      const role = squadRole(p);
      Career.inbox({ type: 'bid', pid: p.id, buyer: b.id, fee, title: `${b.name} bid ${U.money(fee)} for ${p.ln} · ${role.tag}`, body: `${p.fn} ${p.ln} (${p.pos}, ${p.ovr}) is ${role.txt}. Valued around ${U.money(value(p))}.`, actions: [{ label: `Accept ${U.money(fee)}`, act: 'acceptBid' }, { label: 'Counter +25%', act: 'counterBid' }, { label: 'Reject', act: 'rejectBid', danger: true }], expires: G.day + 4 });
    }
  }

  // ── scouting ──
  const REGIONS = [...DATA.NATIONS.map(n => ({ id: n.id, name: n.name })), { id: 'world', name: 'Rest of the World' }];
  function scoutCost(region, focus) { return +((region === 'world' ? 0.35 : 0.15) * (focus === 'youth' ? 1 : 0.8) * (user().ident === 'moneyball' ? 0.5 : 1)).toFixed(2); }
  function startScouting(cid, region, focus) {
    const c = G.coaches[cid];
    if (!c || G.scout.jobs.some(j => j.cid === cid)) return false;
    const cost = scoutCost(region, focus);
    if (user().fin.bal < cost) return false;
    logMoney(user(), -cost, 'ops', `Scouting trip: ${REGIONS.find(r => r.id === region).name}`);
    const days = Math.round(14 - c.rating / 12);
    G.scout.jobs.push({ cid, region, focus, days, total: days });
    save();
    return true;
  }
  function scoutingDay() {
    for (const j of G.scout.jobs) j.days--;
    const done = G.scout.jobs.filter(j => j.days <= 0);
    G.scout.jobs = G.scout.jobs.filter(j => j.days > 0);
    for (const j of done) finishScouting(j);
    // the youth pool turns over on a fixed cadence
    if (!G.scout.pool) refreshYouthPool(true);
    else if (--G.scout.pool.days <= 0) refreshYouthPool();
    for (const id in G.scout.single || {}) { if (--G.scout.single[id] <= 0) { G.scout.known[id] = 3; delete G.scout.single[id]; const p = P(+id); if (p) Career.inbox({ type: 'scout', pid: p.id, title: `Report: ${p.fn} ${p.ln}`, body: `Full report in: ${p.ovr} overall, potential ${U.potGrade(p.pot)}.`, actions: [{ label: 'View', act: 'player', v: p.id }] }); } }
  }
  function finishScouting(j) {
    const c = G.coaches[j.cid], skill = c ? c.rating : 50;
    if (j.focus === 'youth') {
      const n = U.ri(2, 3) + (skill > 75 ? 1 : 0);
      const found = [];
      for (let i = 0; i < n; i++) {
        const nid = j.region === 'world' ? U.ri(0, 3) : j.region;
        const age = U.ri(15, 16);
        const ovr = Math.round(U.clamp(38 + (age - 15) * 4 + U.gauss(0, 5) + (j.region === 'world' ? 2 : 0), 30, 60));
        const pot = Math.round(U.clamp(ovr + 20 + U.gauss(6, 9) + (skill - 50) / 5, ovr + 8, 97));
        const p = mkPlayer(U.pick(DATA.POS), ovr, age, nid, { pot, natKey: j.region === 'world' ? 'world' : undefined });
        p.tid = -3; p.fee = +(0.05 + (pot - 60) * 0.012).toFixed(2); p.found = G.day;
        found.push(p.id);
      }
      G.scout.youth.push(...found);
      Career.inbox({ type: 'scout', title: `${c ? c.ln : 'Scout'}: youth report`, body: `${found.length} prospects found in ${REGIONS.find(r => r.id === j.region).name}. Sign them to the academy from the Scouting tab.`, actions: [{ label: 'Open scouting', act: 'tab', v: 'squad:scout' }] });
    } else {
      const pool = Object.values(G.players).filter(p => p.tid >= 0 && !p.acad && p.tid !== G.userTeamId && (j.region === 'world' ? !DATA.NAT_KEY.some(k => DATA.NATIONS[DATA.NAT_KEY.indexOf(k)].name === p.nat) : team(p.tid).nation === j.region));
      U.shuffle(pool).slice(0, 30).forEach(p => { G.scout.known[p.id] = Math.max(G.scout.known[p.id] || 0, 2); });
      const lvl = teamLevel(user());
      const picks = pool.filter(p => p.ovr >= lvl - 2 && value(p) < user().fin.bal * 1.3).sort((a, b) => (b.ovr + (b.pot - b.ovr) * 0.4) / Math.sqrt(value(b) + 1) - (a.ovr + (a.pot - a.ovr) * 0.4) / Math.sqrt(value(a) + 1)).slice(0, 4 + (skill > 75 ? 2 : 0));
      picks.forEach(p => { G.scout.known[p.id] = 3; });
      G.scout.targets = [...new Set([...picks.map(p => p.id), ...G.scout.targets])].slice(0, 20);
      Career.inbox({ type: 'scout', title: `${c ? c.ln : 'Scout'}: senior report`, body: `${picks.length} recommended targets and 30 players assessed in ${REGIONS.find(r => r.id === j.region).name}.`, actions: [{ label: 'View targets', act: 'tab', v: 'squad:scout' }] });
    }
    save();
  }
  // ── the youth pool: a fresh batch of 15–16-year-olds every POOL_DAYS, picked up by the club's scouting network ──
  // (better scouts, academy and youth coach = more and better prospects; whoever isn't signed moves on at the next refresh)
  const POOL_DAYS = 14;
  function poolQuality() {
    const best = Math.max(45, ...G.staff.sct.map(id => (G.coaches[id] ? G.coaches[id].rating : 0)));
    const yc = G.staff.yth != null && G.coaches[G.staff.yth] ? G.coaches[G.staff.yth].rating : 50;
    return { scout: best, size: 4 + (best >= 70 ? 1 : 0) + (user().acad.level >= 3 ? 1 : 0), bump: (best - 55) / 6 + (yc - 50) / 10 + user().acad.level * 1.5 + (user().ident === 'academy' ? 2 : 0) };
  }
  function refreshYouthPool(quiet = false) {
    const u = user();
    if (!u) return;
    const old = (G.scout.pool && G.scout.pool.ids) || [];
    const gone = new Set();
    for (const id of old) { const p = P(id); if (p && p.tid === -3) { delete G.players[id]; gone.add(id); } }
    if (G.shortlist && gone.size) G.shortlist = G.shortlist.filter(id => !gone.has(id));
    const q = poolQuality(), ids = [];
    for (let i = 0; i < q.size; i++) {
      // mostly home-grown, the odd one from abroad
      const abroad = rng() < 0.25, nid = abroad ? U.pick(DATA.NATIONS.filter(n => n.id !== u.nation)).id : u.nation;
      const age = U.ri(15, 16);
      const ovr = Math.round(U.clamp(37 + (age - 15) * 4 + U.gauss(0, 5) + q.bump * 0.4, 30, 62));
      const pot = Math.round(U.clamp(ovr + 19 + U.gauss(6, 9) + q.bump, ovr + 10, 96));
      const p = mkPlayer(U.pick(DATA.POS.filter(x => x !== 'GK').concat(rng() < 0.15 ? ['GK'] : [])), ovr, age, nid, { pot });
      p.tid = -3; p.fee = +(0.04 + Math.max(0, pot - 60) * 0.011).toFixed(2); p.found = G.day; p.pool = true;
      G.scout.known[p.id] = q.scout >= 70 ? 3 : 2;
      ids.push(p.id);
    }
    G.scout.pool = { ids, days: POOL_DAYS, batch: ((G.scout.pool && G.scout.pool.batch) || 0) + 1 };
    if (!quiet) Career.inbox({ type: 'scout', title: `🌱 Youth pool refreshed: ${ids.length} new prospects`, body: `Your scouting network has a new batch of ${ids.length} youngsters ready to join the academy. Whoever you don't sign moves on in ${POOL_DAYS} days.`, actions: [{ label: 'View the pool', act: 'tab', v: 'squad:scout' }], expires: G.day + POOL_DAYS });
  }
  const youthPool = () => ((G.scout.pool && G.scout.pool.ids) || []).map(P).filter(p => p && p.tid === -3);
  function scoutPlayer(pid) {
    G.scout.single = G.scout.single || {};
    const cost = 0.03 * (user().ident === 'moneyball' ? 0.5 : 1);
    if (G.scout.single[pid] || user().fin.bal < cost) return false;
    logMoney(user(), -cost, 'ops', 'Player scouting report');
    G.scout.single[pid] = 3;
    save();
    return true;
  }
  function signYouth(pid) {
    const p = P(pid), u = user();
    if (!p || p.tid !== -3 || p.age > 17 || u.fin.bal < p.fee) return false;
    logMoney(u, -p.fee, 'fees', `Academy signing: ${p.ln}`);
    p.tid = u.id; p.acad = true; p.wage = 0; p.yrs = 3; p.focus = TAC.defaultRole(p.pos);
    G.acad.push(p.id);
    G.scout.youth = G.scout.youth.filter(x => x !== pid);
    p.pool = false;
    G.stats.scoutSigned = (G.stats.scoutSigned || 0) + 1;
    G.scout.known[pid] = 3;
    save();
    return true;
  }
  // how well the user's scouts know a player: 3 = exact
  function knowledge(p) {
    if (!p) return 0;
    if (p.tid === G.userTeamId || p.acad) return 3;
    const k = G.scout.known[p.id] || 0;
    if (k) return k;
    return p.tid >= 0 && team(p.tid).leagueId === user().leagueId ? 1 : 0;
  }
  function seenOvr(p) {
    const k = knowledge(p);
    if (k >= 3) return { lo: p.ovr, hi: p.ovr, exact: true, mid: p.ovr };
    const spread = k === 2 ? 2 : k === 1 ? 4 : 8;
    const off = ((U.hash(p.id) % 7) - 3) * (spread / 4);
    const mid = Math.round(p.ovr + off);
    return { lo: mid - spread, hi: mid + spread, exact: false, mid };
  }

  // ── coaching carousel: sackings, hirings, and poaching ──
  function expectedPos(t) {
    // post-season: judge a club against the division it actually finished in
    const fs = finalStanding(t.id), fin = fs && G.lastSummary.final;
    const ids = fs ? Object.keys(fin).map(Number).filter(id => fin[id].lg === fs.lg) : league(t.leagueId).teams;
    const byRep = ids.slice().sort((a, b) => team(b).rep - team(a).rep);
    return byRep.indexOf(t.id) + 1;
  }
  function coachCarousel(seasonEnd) {
    const moves = [];
    for (const t of G.teams) {
      if (isUser(t.id) || t.coach == null) continue;
      const c = G.coaches[t.coach];
      const pos = position(t.id), exp = expectedPos(t);
      const recent = t.form.slice(-6), losses = recent.filter(x => x === 'L').length;
      const games = c.w + c.d + c.l;
      const patience = t.ident === 'oldguard' ? 1.6 : t.ident === 'galactico' ? 0.7 : 1;
      let sack = false;
      if (seasonEnd) sack = pos - exp > 4 / patience && rng() < 0.7;
      else if (G.day > 40 && games >= 6) sack = losses >= 5 && pos - exp > 3 / patience && rng() < 0.25;
      if (sack) moves.push(t);
    }
    for (const t of moves.slice(0, seasonEnd ? 8 : 2)) {
      const old = G.coaches[t.coach];
      old.tid = -1;
      old.hist.push({ tid: t.id, s0: old.since, s1: G.season, sacked: true });
      old.rep = Math.max(10, old.rep - 6);
      G.coachPool.push(old.id);
      t.coach = null;
      News.coachSacked(t, old);
      // poach a rising coach from a smaller club, or take the best of the unemployed
      const poachable = G.teams.filter(o => !isUser(o.id) && o.coach != null && o.rep < t.rep - 10 && G.coaches[o.coach].rating > 60 && position(o.id) <= 4);
      let hire;
      if (poachable.length && rng() < 0.45) {
        const from = U.pick(poachable);
        hire = G.coaches[from.coach];
        from.coach = null;
        News.coachPoached(hire, from, t);
        const repl = bestFree(from);
        if (repl) hireManager(from, repl, true);
      } else hire = bestFree(t);
      if (hire) hireManager(t, hire);
    }
  }
  function bestFree(t) {
    const pool = G.coachPool.map(id => G.coaches[id]).filter(c => c && c.tid < 0);
    if (!pool.length) return mkCoach('mgr', 50);
    const c = pool.sort((a, b) => b.rating + b.rep * 0.3 + U.rand(0, 10) - (a.rating + a.rep * 0.3 + U.rand(0, 10)))[0];
    G.coachPool = G.coachPool.filter(id => id !== c.id);
    return c;
  }
  // user staff
  function hireStaff(cid) {
    const c = G.coaches[cid], role = c.role;
    const fee = +(c.wage * 4 / 1000).toFixed(2);
    if (user().fin.bal < fee) return { ok: false, why: 'Not enough money for the signing-on fee.' };
    if (role === 'sct') { if (G.staff.sct.length >= 3) return { ok: false, why: 'You already have three scouts.' }; G.staff.sct.push(cid); }
    else { if (G.staff[role] != null) fireStaff(role, G.staff[role]); G.staff[role] = cid; }
    c.tid = G.userTeamId;
    G.staffPool = G.staffPool.filter(x => x !== cid);
    logMoney(user(), -fee, 'fees', `Hired ${c.fn} ${c.ln}`);
    save();
    return { ok: true };
  }
  function fireStaff(role, cid) {
    const c = G.coaches[cid];
    if (role === 'sct') { G.staff.sct = G.staff.sct.filter(x => x !== cid); G.scout.jobs = G.scout.jobs.filter(j => j.cid !== cid); } else G.staff[role] = null;
    if (c) { c.tid = -1; logMoney(user(), -(c.wage * 8) / 1000, 'fees', `Paid off ${c.ln}`); }
    save();
  }
  // user changes jobs: identity and reputation go with him
  function takeJob(tid) {
    const old = user(), nu = team(tid);
    if (!nu || tid === G.userTeamId) return false;
    G.mgr.hist.push({ s: G.season, left: old.id, joined: nu.id });
    // the new club's old boss walks
    if (nu.coach != null) { const c = G.coaches[nu.coach]; c.tid = -1; G.coachPool.push(c.id); nu.coach = null; }
    // the club you left hires
    const repl = bestFree(old);
    G.userTeamId = tid;
    if (repl) hireManager(old, repl, true);
    const id = DATA.COACH_IDS[G.mgr.ident];
    applyPhilosophy(nu, G.mgr.ident);
    // the academy and staff stay behind: start fresh
    for (const p of academy()) { p.tid = old.id; p.acad = false; joinTeam(p, old); }
    G.acad = [];
    for (let i = 0; i < 6; i++) mkAcademy(nu, U.ri(15, 17));
    G.board.conf = 60;
    G.board.obj = Career.objectives();
    // the academy league follows the new division from next season; this season, leave it as is
    News.userHired(nu);
    save();
    return true;
  }

  // ── facilities ──
  function upgradeCost(kind) {
    const t = user();
    if (kind === 'stadium') return +(4 + t.stadium.cap / 8000).toFixed(1);
    if (kind === 'academy') return [0, 1.5, 3, 6, 10, 0][t.acad.level] || 0;
    if (kind === 'facilities') return [0, 2, 4.5, 8, 14, 0][t.facilities] || 0;
    return 0;
  }
  function upgrade(kind) {
    const t = user(), cost = upgradeCost(kind);
    if (!cost || t.fin.bal < cost) return false;
    if (kind === 'academy' && t.acad.level >= 5) return false;
    if (kind === 'facilities' && t.facilities >= 5) return false;
    logMoney(t, -cost, 'fees', `Upgrade: ${kind}`);
    if (kind === 'stadium') t.stadium.cap += 5000;
    else if (kind === 'academy') t.acad.level++;
    else t.facilities++;
    Career.check();
    save();
    return true;
  }

  // ── persistence ──
  let saveT = 0;
  // a world still being set up (no club chosen yet) must never overwrite the real save
  const saveable = () => !!(G && G.ready && G.userTeamId != null);
  function save() { if (!saveable()) return; clearTimeout(saveT); saveT = setTimeout(flush, 500); }
  function flush(hidden) { if (!saveable()) return; clearTimeout(saveT); saveT = 0; try { Store.write(JSON.stringify(G), hidden); } catch (e) { console.warn(e); } }
  function load(text) {
    try {
      const g = JSON.parse(text);
      if (!g || !g.teams || !g.players) return false;
      // a half-built world (no club taken) isn't a career: fall through to the next copy
      if (g.userTeamId == null || !g.teams[g.userTeamId] || g.ready === false) return false;
      G = g;
      G.ready = true;
      // older saves had separate in/out-of-possession shapes: fold them into one shape with roles
      for (const t of G.teams) if (t.tac) TAC.normalize(t.tac);
      // saves from before hallmarks: give every player the ones his attributes support
      for (const p of Object.values(G.players)) if (!p.hm) rollHallmarks(p);
      return true;
    } catch (e) { return false; }
  }
  function exportText() { return btoa(unescape(encodeURIComponent(JSON.stringify(G)))); }
  function importText(text) {
    try { const s = decodeURIComponent(escape(atob(text.trim()))); if (!load(s)) return false; flush(); return true; } catch (e) { return false; }
  }
  function wipe() { clearTimeout(saveT); saveT = 0; Store.clear(); G = null; }

  return {
    team, user, P, squad, league, isUser, calcOvr, roleRating, mkPlayer, mkCoach, marketWage, value, payroll, staffWages, logMoney, teamLevel,
    applyPhilosophy, applyRoles, growthInfo, setPlan, hmSlots, hmMargin, hmCandidates, hmWeeks, setHmTrain, rollHallmarks, retrainWeeks, newCareer, genWorld, startCareer, customizeTeam, restoreTeam, autoLineup, validateUser, aiTactics, available, academy, promote, releaseAcademy, rivalAcademy, mkAcademy,
    dateStr, windowOpen, todays, userFixture, userAcadFixture, nextUserFixture, pending, simRest, advanceDay, applyResult, quickSim, quickAcad, winnerOf, resultFor, seasonRecord, lastUserFixture, attendance,
    table, acadTableRows, position, finalStanding, tableLg, expectedPos, strength, boostFor, CUP_NAMES, endSeason, newSeason,
    MIN_SQUAD, canLose, squadFloorWhy, askingPrice, evalOffer, wageDemand, willingness, wageRoom, weeklyIncome, completeSigning, sellTo, executeTrade, release, renew, needs, toFA, joinTeam,
    squadRole, REGIONS, scoutCost, startScouting, scoutPlayer, signYouth, knowledge, seenOvr, youthPool, refreshYouthPool, POOL_DAYS,
    hireStaff, fireStaff, hireManager, takeJob, bestFree, upgradeCost, upgrade,
    save, flush, saveable, load, exportText, importText, wipe,
  };
})();
