'use strict';
// ── PLAY: turning a fixture into an engine match, and its result back into the season ──

const Play = (() => {
  // what the club, its manager and its identity bring onto the pitch
  function sideFor(t, opp, home, f) {
    const isU = L.isUser(t.id);
    const ident = isU ? G.mgr.ident : (t.coach != null && G.coaches[t.coach] ? G.coaches[t.coach].ident : 'developer');
    const tac = TAC.clone(t.tac);
    const squad = L.squad(t);
    return {
      id: t.id, name: t.name, short: t.abbr, squad, tac,
      ai: !isU, autoSub: isU && G.settings.autoSub,
      boost: L.boostFor(t, opp, home && !f.neutral, f.ko),
      stamMult: t.ident === 'workhorse' ? 0.88 : 1,
      pressBonus: ident === 'gegenpress' || ident === 'motivator',
      passBonus: ident === 'tiki' || ident === 'positional' ? 1.06 : 1,
      crossBonus: ident === 'wingplay' ? 1.15 : 1,
      blitz: ident === 'blitz',
    };
  }
  function weatherFor(f) {
    const w = DATA.WEATHER[f.wx ? f.wx.id : 'clear'] || DATA.WEATHER.clear;
    const ws = f.wx ? f.wx.ws || 0 : 0, wa = f.wx ? f.wx.wa || 0 : 0;
    // a worn pitch plays like bad weather
    return Xtra.pitchWeather(f, { weather: w, wind: { x: Math.cos(wa) * ws, y: Math.sin(wa) * ws } });
  }
  function create(f) {
    const h = L.team(f.h), a = L.team(f.a);
    if (L.isUser(h.id) || L.isUser(a.id)) L.validateUser();
    if (!L.isUser(h.id)) L.autoLineup(h);
    if (!L.isUser(a.id)) L.autoLineup(a);
    const { weather, wind } = weatherFor(f);
    const m = new Engine.Match(sideFor(h, a, true, f), sideFor(a, h, false, f), { seed: f.seed, weather, wind, knockout: !!f.ko, cup: f.comp === 'C' || f.comp === 'X' });
    return m;
  }
  // academy 5-a-side: the user's kids against a rival academy rebuilt from its seed
  function acadSide(t, isUserSide, snap) {
    const kids = isUserSide ? (snap ? snap.map(x => ({ ...x })) : L.academy().slice()) : L.rivalAcademy(t);
    const fit = kids.map(p => ({ ...p, fit: 100 }));
    const shape = '1-2-1', fo = TAC.formation(shape);
    const tac = TAC.make(shape, shape);
    const used = new Set();
    fo.slots.forEach((sl, i) => {
      const pick = fit.filter(p => !used.has(p.id)).sort((x, y) => L.calcOvr(y, sl.pos) * TAC.fam(y, sl.pos) - L.calcOvr(x, sl.pos) * TAC.fam(x, sl.pos))[0];
      if (pick) { tac.lineup[i] = pick.id; used.add(pick.id); }
    });
    tac.bench = fit.filter(p => !used.has(p.id)).map(p => p.id);
    // the user's kids play the roles their training plans point at, where the role fits the slot
    if (isUserSide) tac.lineup.forEach((pid, i) => { const p = fit.find(q => q.id === pid); if (p && p.focus && TAC.ROLES[p.focus] && TAC.ROLES[p.focus].slots.includes(fo.slots[i].pos)) tac.rOOP[i] = tac.rIP[i] = p.focus; });
    return { id: t.id, name: `${t.name} U18`, short: t.abbr, squad: fit, tac, ai: true, boost: 1 };
  }
  function createAcad(f) {
    const h = L.team(f.h), a = L.team(f.a);
    const { weather, wind } = weatherFor(f);
    // the kids as they were on the day, so a replay plays out exactly as the real game did
    if (!f.snap) f.snap = L.academy().map(k => ({ id: k.id, fn: k.fn, ln: k.ln, nat: k.nat, age: k.age, pos: k.pos, alt: k.alt, a: [...k.a], ovr: k.ovr, pers: k.pers, focus: k.focus, num: k.num, tid: k.tid, acad: true }));
    return new Engine.Match(acadSide(h, L.isUser(h.id), f.snap), acadSide(a, L.isUser(a.id), f.snap), { seed: f.seed, five: true, weather, wind });
  }
  function enough(f) {
    if (f.comp !== 'A') return true;
    return L.academy().length >= 5;
  }

  // a finished engine match back into the season
  function finish(f, m, live) {
    const res = m.summary();
    if (f.comp === 'A') {
      // rival kids are not real players: keep only the user's academy lines
      res.players = res.players.filter(p => p.pid > 0 && G.players[p.pid] && G.players[p.pid].acad);
      L.applyResult(f, res);
      L.save();
      return res;
    }
    L.applyResult(f, res);
    // specials that ended in goals (for achievements)
    const specials = [];
    const goals = m.fx.filter(x => x.type === 'goal');
    for (const g of goals) {
      const sp = m.fx.filter(x => x.type === 'special' && x.time <= g.time && g.time - x.time < 3).pop();
      if (sp) specials.push(sp.label);
    }
    G.stats.hits += res.stats[f.h === G.userTeamId ? 0 : 1].hits;
    Career.onMatch(f, res, { specialGoals: specials, live });
    Xtra.logGoals(f, m);
    Xtra.checkUnlocks();
    News.matchReport(f, res, live);
    L.save();
    return res;
  }
  // the user skips watching: play it out in full, instantly
  function quick(f) {
    const m = f.comp === 'A' ? createAcad(f) : create(f);
    m.simulateFull();
    return { m, res: finish(f, m, false) };
  }

  return { create, createAcad, finish, quick, enough, sideFor };
})();
