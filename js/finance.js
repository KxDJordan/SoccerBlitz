'use strict';
// ── FINANCE: sponsorship deals, stadium & commercial extras, ticket pricing, income forecast, day-by-day money history ──
const Fin = (() => {
  const u = () => L.user();
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // ── sponsor slots and the brands that fill them ──
  const SLOTS = {
    shirt: { name: 'Shirt front', icon: '👕', share: 0.42 },
    kit: { name: 'Kit supplier', icon: '🧵', share: 0.26 },
    stadium: { name: 'Stadium partner', icon: '🏟️', share: 0.12 },
    training: { name: 'Training ground', icon: '🏋️', share: 0.1 },
    sleeve: { name: 'Sleeve', icon: '💪', share: 0.1 },
  };
  const SLOT_IDS = Object.keys(SLOTS);
  // pres: 0 local, 1 national, 2 global (global brands only call clubs with a big name, and pay more)
  const BRANDS = [
    ['Ironside Brewing', '🍺', 0], ['Golden Harvest Foods', '🌾', 0], ['Harbourline Ferries', '⛴️', 0], ['Copperfield Motors', '🚙', 0], ['Redwood Timber', '🪵', 0], ['Lantern Pizza', '🍕', 0], ['Bramble Building Society', '🏠', 0], ['Thistle Taxis', '🚕', 0],
    ['Nitro Energy', '⚡', 1], ['Orbit Mobile', '📱', 1], ['Meridian Insurance', '🛡️', 1], ['Vertex Logistics', '📦', 1], ['Lumen Electric', '💡', 1], ['Halcyon Hotels', '🏨', 1], ['Coral Cruises', '🛳️', 1], ['Brightwave Tech', '💻', 1],
    ['Kestrel Airways', '✈️', 2], ['Bluefin Bank', '🏦', 2], ['Quanta Cloud', '☁️', 2], ['Apex Automotive', '🏎️', 2], ['Sable Watches', '⌚', 2], ['Solstice Telecom', '🛰️', 2],
  ];
  const KIT_BRANDS = [['Arcfield', '👟', 0], ['Northpeak Sport', '👟', 0], ['Stride', '👟', 1], ['Kinetic Athletic', '👟', 1], ['Pulse', '👟', 2], ['Vanta', '👟', 2]];

  // ── stadium & commercial facilities (the user's club only) ──
  const BIZ = {
    food: { name: 'Food & drink concourses', icon: '🍔', max: 3, desc: lv => `Fans spend about $${spendPerFan(lv)} a head on match days.`, cost: (t, lv) => [1, 2, 3.5][lv] * capScale(t) },
    boxes: { name: 'Hospitality boxes', icon: '🥂', max: 3, desc: (lv, t) => `Corporate guests pay ${U.money(boxesPerGame(t, lv))} a home game.`, cost: (t, lv) => [2, 4, 7][lv] * tierScale(t) },
    store: { name: 'Club megastore', icon: '🛍️', max: 3, desc: (lv, t) => `Shirts and souvenirs: ${U.money(storeWeekly(t, lv))} a week.`, cost: (t, lv) => [1.5, 3, 5][lv] * tierScale(t) },
    screen: { name: 'Big screens & fan zone', icon: '📺', max: 2, desc: lv => `Pulls in ${lv * 4}% more fans for every home game.`, cost: (t, lv) => [1.5, 3][lv] * capScale(t) },
    heating: { name: 'Undersoil heating & drainage', icon: '♨️', max: 2, desc: lv => (lv === 1 ? 'Snow can\'t freeze the pitch: no frost postponements, far less snow damage.' : 'Plus drainage: rain and storms do half the damage, and the pitch recovers faster.'), cost: (t, lv) => [1.2, 2.5][lv] * capScale(t) },
    tours: { name: 'Museum & stadium tours', icon: '🏛️', max: 2, desc: (lv, t) => `Visitors all week: ${U.money(toursWeekly(t, lv))} a week (more with trophies in the cabinet).`, cost: (t, lv) => [0.8, 1.8][lv] * tierScale(t) },
  };
  const capScale = t => clamp(t.stadium.cap / 30000, 0.45, 2.4);
  const tierScale = t => (t.tier === 0 ? 1 : 0.55);
  const spendPerFan = lv => [0, 2.5, 5, 8][lv] || 0;
  const boxesPerGame = (t, lv) => lv * (0.025 + t.rep * 0.0011);
  const storeWeekly = (t, lv) => lv * t.rep * 0.0007;
  const toursWeekly = (t, lv) => lv * (0.012 + 0.003 * Math.min(15, t.trophies.length));
  const biz = (t = u()) => { t.biz = t.biz || {}; for (const k of ['food', 'boxes', 'store', 'screen', 'tours', 'heating']) t.biz[k] = t.biz[k] || 0; return t.biz; };
  const fillBonus = t => (t.biz ? (t.biz.screen || 0) * 0.04 : 0);
  function bizCost(kind, t = u()) { const b = BIZ[kind], lv = biz(t)[kind] || 0; return lv >= b.max ? 0 : +b.cost(t, lv).toFixed(1); }
  function buyBiz(kind) {
    const t = u(), cost = bizCost(kind);
    if (!cost) return { ok: false, why: 'Already at the top level.' };
    if (t.fin.bal < cost) return { ok: false, why: 'Not enough money in the bank.' };
    L.logMoney(t, -cost, 'build', `Built: ${BIZ[kind].name} (level ${biz(t)[kind] + 1})`);
    biz(t)[kind]++;
    L.save();
    return { ok: true };
  }

  // ── state ──
  function ensure() {
    if (!G) return;
    const t = u();
    if (!t) return;
    biz(t);
    if (!G.spon || G.spon.tid !== t.id) startDeals(t);
    if (!G.finHist) {
      G.finHist = {};
      for (const e of G.finLog || []) if (e.s === G.season) addHist(e.s, e.d, e.cat, e.amt);
    }
  }
  function addHist(s, d, cat, amt) {
    const H = (G.finHist[s] = G.finHist[s] || {}), day = (H[d] = H[d] || {});
    day[cat] = +((day[cat] || 0) + amt).toFixed(3);
  }
  function record(amt, cat) {
    if (!G) return;
    if (!G.finHist) ensure();
    addHist(G.season, G.day, cat, amt);
    // keep three seasons
    for (const s of Object.keys(G.finHist)) if (+s < G.season - 2) delete G.finHist[s];
  }

  // ── sponsorship ──
  function base(t) {
    const pos = L.position(t.id), n = (L.league(t.leagueId).teams || []).length || 12;
    const perf = G.day > 30 && pos ? 0.92 + 0.16 * (1 - (pos - 1) / (n - 1)) : 1;
    return 0.0034 * t.rep * (1 + Math.max(0, t.rep - 50) / 90) * (t.tier === 0 ? 1 : 0.85) * (t.ident === 'galactico' ? 1.3 : 1) * perf;
  }
  const fair = (slot, t = u()) => SLOTS[slot].share * base(t);
  const worth = d => d.wk + (d.win || 0) * 0.45; // a win bonus is worth roughly this much a week
  function brandFor(slot, t, taken) {
    const pres = t.rep >= 75 ? 2 : t.rep >= 50 ? 1 : 0;
    const list = (slot === 'kit' ? KIT_BRANDS : BRANDS).filter(b => b[2] <= pres && !taken.has(b[0]));
    // the best-known names they can attract are more likely to call
    return U.wpick(list.length ? list : BRANDS, b => 1 + b[2] * 1.5);
  }
  function startDeals(t) {
    const deals = {};
    const taken = new Set();
    for (const slot of SLOT_IDS) {
      if (slot === 'sleeve' && t.rep < 35) { deals[slot] = null; continue; }
      const b = brandFor(slot, t, taken);
      taken.add(b[0]);
      deals[slot] = { slot, brand: b[0], icon: b[1], wk: +(fair(slot, t) * 0.85).toFixed(3), win: 0, until: G.season + U.ri(0, 2), from: G.season };
    }
    G.spon = { tid: t.id, deals, offers: [], peak: t.rep, nextId: 1 };
  }
  function makeOffer(slot, why) {
    const t = u(), cur = G.spon.deals[slot];
    const taken = new Set(Object.values(G.spon.deals).filter(Boolean).map(d => d.brand).concat(G.spon.offers.map(o => o.brand)));
    const b = cur && cur.until === G.season && Math.random() < 0.45 ? [cur.brand, cur.icon, 0] : brandFor(slot, t, taken);
    const f = fair(slot, t) * U.rand(0.88, 1.2) * (1 + b[2] * 0.06);
    const kind = U.wpick(['flat', 'perf', 'bonus'], k => ({ flat: 3, perf: 2, bonus: 1.5 })[k]);
    const o = { id: G.spon.nextId++, slot, brand: b[0], icon: b[1], kind, yrs: U.ri(1, 3), exp: G.day + 12, s: G.season, why, renew: !!cur && cur.brand === b[0] };
    if (kind === 'perf') { o.wk = +(f * 0.7).toFixed(3); o.win = +(f * 0.75).toFixed(3); }
    else if (kind === 'bonus') { o.wk = +(f * 0.9).toFixed(3); o.bonus = +(f * 6).toFixed(2); }
    else o.wk = +f.toFixed(3);
    // not worth a call if it doesn't beat what the slot already earns
    if (cur && cur.until > G.season && worth(o) + (o.bonus || 0) / 25 < worth(cur) * 1.1) return null;
    G.spon.offers.push(o);
    const what = `${o.icon} ${o.brand} want the ${SLOTS[slot].name.toLowerCase()}: ${dealText(o)}.`;
    const replace = o.renew ? ' A renewal of the current deal.' : cur ? (cur.until > G.season ? ` It would replace ${cur.brand} (${U.money(cur.wk)}/wk) — breaking that deal costs ${U.money(buyout(cur))}.` : ` ${cur.brand}'s deal ends this season.`) : ' The slot is empty right now.';
    const msg = Career.inbox({ type: 'sponsor', spon: o.id, title: `${why === 'rise' ? 'Your rise has sponsors calling: ' : 'Sponsor offer: '}${o.brand}`, body: what + replace, actions: [{ label: 'Accept', act: 'sponAccept', v: o.id }, { label: 'Decline', act: 'sponDecline', v: o.id }], expires: o.exp });
    o.msg = msg.id;
    return o;
  }
  function dealText(d) {
    const len = d.yrs ? `${d.yrs} season${d.yrs > 1 ? 's' : ''}` : '';
    return `${U.money(d.wk)}/wk${d.win ? ` + ${U.money(d.win)} per win` : ''}${d.bonus ? ` + ${U.money(d.bonus)} signing bonus` : ''}${len ? ` for ${len}` : ''}`;
  }
  const buyout = d => +(d.wk * 3).toFixed(2);
  function accept(id) {
    ensure();
    const o = G.spon.offers.find(x => x.id === id);
    if (!o || G.day > o.exp || o.s !== G.season) return { ok: false, why: 'That offer has lapsed.' };
    const t = u(), cur = G.spon.deals[o.slot];
    if (cur && cur.until > G.season && !o.renew) L.logMoney(t, -buyout(cur), 'spon', `Ended ${cur.brand} deal early`);
    // signed in the first weeks, this season counts as year one; later on (or in the summer), the years start next season
    const late = G.phase === 'post' || G.day > 40 || (cur && cur.until === G.season);
    G.spon.deals[o.slot] = { slot: o.slot, brand: o.brand, icon: o.icon, wk: o.wk, win: o.win || 0, until: G.season + o.yrs - (late ? 0 : 1), from: G.season };
    if (o.bonus) L.logMoney(t, o.bonus, 'spon', `${o.brand} signing bonus`);
    settle(o, 'Signed.');
    // a rival bid for the same slot is off the table
    for (const x of G.spon.offers.filter(x => x.slot === o.slot)) settle(x, `${o.brand} got the slot.`);
    L.save();
    return { ok: true, text: `🤝 ${o.brand} signed: ${dealText(o)}.` };
  }
  function decline(id) {
    ensure();
    const o = G.spon.offers.find(x => x.id === id);
    if (o) settle(o, 'Declined.');
    L.save();
    return { ok: true, text: 'Declined.' };
  }
  function settle(o, result) {
    G.spon.offers = G.spon.offers.filter(x => x !== o);
    const m = G.inbox.find(x => x.id === o.msg);
    if (m && !m.done) { m.done = true; m.result = result; m.read = true; }
  }
  // sponsors call more often as the club gets bigger, and straight away when there's a hole to fill
  function offersTick() {
    const t = u(), S = G.spon;
    S.offers = S.offers.filter(o => { if (G.day > o.exp || o.s !== G.season) { settle(o, 'Expired'); return false; } return true; });
    if (S.offers.length >= 2) return;
    const empty = SLOT_IDS.filter(s => !S.deals[s] && !(s === 'sleeve' && t.rep < 35));
    const ending = SLOT_IDS.filter(s => S.deals[s] && S.deals[s].until <= G.season);
    const open = new Set(S.offers.map(o => o.slot));
    if (t.rep >= S.peak + 3) {
      S.peak = t.rep;
      const slot = U.pick(empty.concat(ending).filter(s => !open.has(s))) || U.pick(SLOT_IDS.filter(s => !open.has(s)));
      if (slot && makeOffer(slot, 'rise')) return;
    }
    const pool = empty.concat(ending).filter(s => !open.has(s));
    const p = pool.length ? 0.45 : 0.08 + t.rep / 900;
    if (Math.random() > p) return;
    const slot = pool.length ? U.pick(pool) : U.pick(SLOT_IDS.filter(s => !open.has(s)));
    if (slot) makeOffer(slot, 'call');
  }
  // money that comes in every week for the user's club
  function weekly(t) {
    ensure();
    const S = G.spon, deals = Object.values(S.deals).filter(Boolean);
    const spon = U.sum(deals.map(d => d.wk));
    if (spon) L.logMoney(t, spon, 'spon', `Sponsors (${deals.length} deal${deals.length > 1 ? 's' : ''})`);
    const merch = 0.001 * t.rep * (1 + t.form.slice(-5).filter(x => x === 'W').length * 0.08) * (t.ident === 'galactico' ? 1.3 : 1);
    const store = storeWeekly(t, biz(t).store), tours = toursWeekly(t, biz(t).tours), esports = G.esports ? 0.05 : 0;
    L.logMoney(t, merch + store + tours + esports, 'comm', 'Merchandise & commercial');
    offersTick();
  }
  function onWin(t, f) {
    if (!G.spon || f.comp === 'A' || f.comp === 'F') return;
    for (const d of Object.values(G.spon.deals)) if (d && d.win) L.logMoney(t, d.win, 'spon', `${d.brand} win bonus`);
  }
  // a home game: concessions and hospitality on top of the gate
  function matchday(t, att, f) {
    const b = biz(t);
    const amt = (att * spendPerFan(b.food)) / 1e6 + boxesPerGame(t, b.boxes) * (f.comp === 'X' ? 1.5 : 1);
    if (amt > 0) L.logMoney(t, amt, 'match', `Concessions & hospitality vs ${L.team(f.h === t.id ? f.a : f.h).abbr}`);
  }
  // summer: deals that have run their course end; empty slots get calls straight away
  function newSeason() {
    ensure();
    const ended = [];
    for (const s of SLOT_IDS) { const d = G.spon.deals[s]; if (d && d.until < G.season) { ended.push(d); G.spon.deals[s] = null; } }
    G.spon.offers = [];
    if (ended.length) Career.inbox({ type: 'sponsor', title: `${ended.length} sponsorship deal${ended.length > 1 ? 's' : ''} expired`, body: `${ended.map(d => `${d.icon} ${d.brand} (${SLOTS[d.slot].name})`).join(', ')}. Offers for the empty slots will come in over the next few weeks — check Club → Finance → Sponsors.` });
    G.spon.peak = Math.min(G.spon.peak, u().rep);
    for (let i = 0; i < 2; i++) offersTick();
  }

  // ── tickets: what the crowd will pay ──
  function ticketRange(t = u()) { return t.tier === 0 ? [15, 80] : [8, 40]; }
  // match-day money at each price against a typical league visitor
  function ticketCurve(t = u()) {
    const lg = L.league(t.leagueId), others = lg.teams.filter(id => id !== t.id).map(L.team);
    const opp = { rep: U.avg(others.map(x => x.rep)) };
    const [lo, hi] = ticketRange(t), b = biz(t), pts = [];
    for (let p = lo; p <= hi; p++) {
      const att = L.attendance(t, opp, { comp: 'L' }, p);
      pts.push({ p, att, gate: (att * p) / 1e6, total: (att * (p + spendPerFan(b.food))) / 1e6 + boxesPerGame(t, b.boxes) });
    }
    const best = pts.reduce((a, x) => (x.total > a.total ? x : a), pts[0]);
    const good = pts.filter(x => x.total >= best.total * 0.95);
    return { pts, best, lo: good[0].p, hi: good[good.length - 1].p, cap: t.stadium.cap };
  }

  // ── what a normal week should bring in: drives the wage budget ──
  function forecast(t = u()) {
    ensure();
    const tv = t.tier === 0 ? 0.26 : 0.08;
    const spon = U.sum(Object.values(G.spon.deals).filter(Boolean).map(worth));
    const merch = 0.001 * t.rep * (t.ident === 'galactico' ? 1.3 : 1) + storeWeekly(t, biz(t).store) + toursWeekly(t, biz(t).tours) + (G.esports ? 0.05 : 0);
    const c = ticketCurve(t), now = c.pts.find(x => x.p === t.fin.ticket) || c.best;
    // roughly one home game every two weeks
    const gate = now.gate / 2, extras = (now.total - now.gate) / 2;
    const wages = L.payroll(t) / 1000, staff = L.staffWages() / 1000;
    const ops = 0.06 + 0.02 * t.facilities + 0.015 * t.acad.level;
    const income = tv + spon + merch + gate + extras;
    return { tv, spon, merch, gate, extras, income, wages, staff, ops, out: wages + staff + ops, att: now.att };
  }
  // weekly wage budget left for players, $K (staff wages come out of the same pot)
  function wageRoom(t = u()) {
    const f = forecast(t);
    return Math.round(f.income * 1000 * 0.68 - L.payroll(t) - L.staffWages());
  }

  // ── history for the charts ──
  const INC = ['gate', 'match', 'tv', 'spon', 'comm', 'prize', 'sales', 'events'], EXP = ['wages', 'ops', 'fees', 'build'];
  const CAT = { gate: 'Gate receipts', match: 'Concessions & hospitality', tv: 'Broadcast', spon: 'Sponsorship', comm: 'Merch & commercial', prize: 'Prize money', sales: 'Player sales', events: 'Events & tours', wages: 'Player wages', ops: 'Staff & running costs', fees: 'Transfers & fees', build: 'Building work' };
  // periods: [{ label, from, to, inc, exp, cats }]
  function periods(season, by) {
    const H = (G.finHist && G.finHist[season]) || {};
    const out = new Map();
    const last = season === G.season ? G.day : DATA.SEASON.LEN;
    for (let d = 1; d <= last; d++) {
      const key = by === 'month' ? L.dateStr(d, true).split(' ')[0] : Math.floor((d - 1) / 7);
      if (!out.has(key)) out.set(key, { key, label: by === 'month' ? key : `W${key + 1}`, from: d, to: d, inc: 0, exp: 0, cats: {} });
      const P = out.get(key);
      P.to = d;
      for (const [c, a] of Object.entries(H[d] || {})) {
        P.cats[c] = +((P.cats[c] || 0) + a).toFixed(3);
        if (a >= 0) P.inc += a; else P.exp -= a;
      }
    }
    return [...out.values()];
  }

  return { SLOTS, SLOT_IDS, BIZ, INC, EXP, CAT, ensure, record, biz, bizCost, buyBiz, fillBonus, spendPerFan, fair, worth, dealText, buyout, accept, decline, weekly, onWin, matchday, newSeason, ticketRange, ticketCurve, forecast, wageRoom, periods, offersTick };
})();
