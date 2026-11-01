'use strict';
// ── CAREER: board, inbox, random events, owner challenges, identities, achievements ──

const Career = (() => {
  const ACH_KEY = 'soccerblitz.ach';
  const u = () => L.user();
  let onUnlock = null;

  // ── achievements (kept across careers on this device, and per career) ──
  const ACH = [
    { id: 'first_win', icon: '✅', name: 'Off the Mark', desc: 'Win your first match.' },
    { id: 'clean_sheet', icon: '🧤', name: 'Shut Out', desc: 'Keep a clean sheet.' },
    { id: 'thrash', icon: '💥', name: 'Demolition Job', desc: 'Win a match by five or more goals.' },
    { id: 'comeback', icon: '🔄', name: 'Never Say Die', desc: 'Win a match after trailing by two goals.' },
    { id: 'hat_trick', icon: '🎩', name: 'Hat-Trick Hero', desc: 'One of your players scores a hat-trick.' },
    { id: 'on_fire', icon: '🔥', name: "He's On Fire!", desc: 'One of your players catches fire in a match.' },
    { id: 'bicycle', icon: '🚲', name: 'Overhead Glory', desc: 'Score with a bicycle kick.' },
    { id: 'free_kick', icon: '🎯', name: 'Over the Wall', desc: 'Score a direct free kick.' },
    { id: 'blitz', icon: '🏈', name: 'Blitz Mode', desc: 'Your team lands 15 big hits in one match.' },
    { id: 'giant_killer', icon: '🗡️', name: 'Giant Killer', desc: 'Beat a club with 20+ more reputation.' },
    { id: 'tactician', icon: '♟️', name: 'Shape Shifter', desc: 'Win with two or more inverted or false roles in your side (IFB, IWB, FLB, IW, F9).' },
    { id: 'unbeaten10', icon: '🧱', name: 'Unbreakable', desc: 'Go ten matches unbeaten.' },
    { id: 'promoted', icon: '📈', name: 'Going Up!', desc: 'Win promotion to the top flight.' },
    { id: 'champion', icon: '🏆', name: 'Champions', desc: 'Win a league title.' },
    { id: 'cup', icon: '🥇', name: 'Cup Run', desc: 'Win your national cup.' },
    { id: 'continental', icon: '🌍', name: 'Kings of the Continent', desc: `Win the ${DATA.CONTINENTAL}.` },
    { id: 'invitational', icon: '☀️', name: 'Summer Silverware', desc: `Win the ${DATA.INVITATIONAL}.` },
    { id: 'double', icon: '✌️', name: 'The Double', desc: 'Win the league and national cup in the same season.' },
    { id: 'treble', icon: '👑', name: 'The Treble', desc: 'League, cup and continental titles in one season.' },
    { id: 'invincible', icon: '🛡️', name: 'Invincibles', desc: 'Go a whole league season unbeaten.' },
    { id: 'youth_debut', icon: '🌱', name: 'One of Our Own', desc: 'Give an academy graduate his debut.' },
    { id: 'youth_ten', icon: '🎓', name: 'Class of Legends', desc: 'Hand out ten academy debuts.' },
    { id: 'wonderkid', icon: '💎', name: 'Wonderkid', desc: 'Have an academy player with A+ potential.' },
    { id: 'homegrown_star', icon: '⭐', name: 'Homegrown Star', desc: 'An academy graduate reaches 80 overall.' },
    { id: 'big_spender', icon: '💸', name: 'Statement Signing', desc: 'Sign a player for $20M or more.' },
    { id: 'sold_high', icon: '🤑', name: 'Sell High', desc: 'Sell a player for $25M or more.' },
    { id: 'rich', icon: '🏦', name: 'Money Bags', desc: 'Have $100M in the bank.' },
    { id: 'scout_master', icon: '🔭', name: 'Eye for Talent', desc: 'Sign five scouted youngsters to the academy.' },
    { id: 'full_house', icon: '🏟️', name: 'Full House', desc: 'Sell out your stadium.' },
    { id: 'stadium', icon: '🏗️', name: 'Cathedral', desc: 'Expand your stadium to 60,000 seats.' },
    { id: 'job_hopper', icon: '💼', name: 'Bigger Things', desc: 'Accept a job at another club.' },
    { id: 'legend', icon: '🐐', name: 'Legend', desc: 'Win ten trophies as a manager.' },
    { id: 'decade', icon: '📅', name: 'Long Haul', desc: 'Complete ten seasons.' },
    { id: 'challenge', icon: '🏅', name: "Owner's Favourite", desc: 'Complete an owner challenge.' },
    { id: 'great_escape', icon: '🪂', name: 'Great Escape', desc: 'Survive in the top flight after being bottom at Christmas.' },
  ];
  const store = () => { try { return JSON.parse(localStorage.getItem(ACH_KEY)) || {}; } catch (e) { return {}; } };
  function unlock(id) {
    if (!G) return;
    G.ach = G.ach || {};
    if (G.ach[id]) return;
    G.ach[id] = G.season;
    const s = store();
    const fresh = !s[id];
    if (fresh) { s[id] = Date.now(); try { localStorage.setItem(ACH_KEY, JSON.stringify(s)); } catch (e) { /* full */ } }
    const a = ACH.find(x => x.id === id);
    if (a && onUnlock) onUnlock(a, fresh);
  }
  const achList = () => { const s = store(); return ACH.map(a => ({ ...a, got: s[a.id] || null, career: !!(G && G.ach && G.ach[a.id]) })); };

  // state-based achievements, checked whenever something notable happens
  function check() {
    if (!G) return;
    const t = u();
    if (t.fin.bal >= 100) unlock('rich');
    if (t.stadium.cap >= 60000) unlock('stadium');
    if (G.stats.youthDebuts >= 1) unlock('youth_debut');
    if (G.stats.youthDebuts >= 10) unlock('youth_ten');
    if (L.academy().some(p => p.pot >= 90)) unlock('wonderkid');
    if (L.squad(t).some(p => p.promoted && p.ovr >= 80)) unlock('homegrown_star');
    if ((G.stats.scoutSigned || 0) >= 5) unlock('scout_master');
    if (G.mgr.trophies >= 10) unlock('legend');
    if (G.season >= 11) unlock('decade');
    const run = t.form.slice().reverse();
    let unb = 0;
    for (const r of run) { if (r === 'L') break; unb++; }
    if (unb >= 10) unlock('unbeaten10');
  }
  // match-based achievements from a played match
  function onMatch(f, res, live) {
    const side = f.h === G.userTeamId ? 0 : 1, us = res.score[side], them = res.score[1 - side];
    const won = us > them || (us === them && f.pens && L.winnerOf(f) === G.userTeamId);
    if (won) { unlock('first_win'); G.stats.wins++; }
    if (them === 0) unlock('clean_sheet');
    if (us - them >= 5) unlock('thrash');
    G.stats.goals += us;
    const opp = L.team(side === 0 ? f.a : f.h);
    if (won && opp.rep >= u().rep + 20) unlock('giant_killer');
    if (won) { const inv = u().tac.rOOP.filter(r => ['ifb', 'iwb', 'flb', 'iw', 'f9'].includes(r)).length; if (inv >= 2) unlock('tactician'); }
    const ev = res.events || [];
    const goalsBy = {};
    for (const e of ev) if (e.type === 'goal' && e.team === side && e.pid) goalsBy[e.pid] = (goalsBy[e.pid] || 0) + 1;
    if (Object.values(goalsBy).some(n => n >= 3)) unlock('hat_trick');
    if (ev.some(e => e.type === 'fire' && e.team === side)) unlock('on_fire');
    if (res.stats && res.stats[side].hits >= 15) unlock('blitz');
    if (live && live.specialGoals) { if (live.specialGoals.includes('Bicycle kick')) unlock('bicycle'); if (live.specialGoals.includes('Free kick')) unlock('free_kick'); }
    // comeback: trailing by two at some point, then won
    let h = 0, a = 0, worst = 0;
    for (const e of ev) if (e.type === 'goal') { if (e.team === 0) h++; else a++; worst = Math.min(worst, side === 0 ? h - a : a - h); }
    if (won && worst <= -2) unlock('comeback');
    if (f.att && f.att >= u().stadium.cap && f.h === G.userTeamId) unlock('full_house');
    // the manager's style: which philosophy do his tactics look like?
    const ti = u().tac.team;
    let best = null, bd = Infinity;
    for (const [id, c] of Object.entries(DATA.COACH_IDS)) {
      const d = Object.keys(c.team).reduce((s, k) => s + Math.abs((ti[k] || 0) - c.team[k]), 0) + (u().tac.oop === c.oop ? -0.5 : 0) - 0.4 * u().tac.rOOP.filter(r => (c.roles || []).includes(r)).length;
      if (d < bd) { bd = d; best = id; }
    }
    G.mgr.usage = G.mgr.usage || {};
    G.mgr.usage[best] = (G.mgr.usage[best] || 0) + 1;
    check();
  }
  function trophy(name) {
    if (name === DATA.CONTINENTAL) unlock('continental');
    else if (name === DATA.INVITATIONAL) unlock('invitational');
    else if (DATA.NATIONS.some(n => n.cup === name)) unlock('cup');
    else unlock('champion');
    G.mgr.rep = Math.min(99, G.mgr.rep + 6);
    const won = u().trophies.filter(x => x.s === G.season).map(x => x.name);
    const lgWon = won.some(n => DATA.NATIONS.some(nn => nn.tiers.includes(n)));
    const cupWon = won.some(n => DATA.NATIONS.some(nn => nn.cup === n));
    if (lgWon && cupWon) unlock('double');
    if (lgWon && cupWon && won.includes(DATA.CONTINENTAL)) unlock('treble');
    check();
  }
  function onSign(p, fee) { if (fee >= 20) unlock('big_spender'); G.stats.spent = (G.stats.spent || 0) + fee; }
  function onSell(p, fee) { if (fee >= 25) unlock('sold_high'); G.stats.earned = (G.stats.earned || 0) + fee; }

  // ── inbox ──
  function inbox(m) {
    const msg = { id: G.nextMsg++, day: G.day, s: G.season, done: false, ...m };
    G.inbox.unshift(msg);
    if (G.inbox.length > 80) G.inbox.length = 80;
    return msg;
  }
  const unread = () => G.inbox.filter(m => !m.done && !m.read).length;

  // ── board ──
  function objectives() {
    const t = u(), exp = L.expectedPos(t);
    const ch = G.challenge && CHALLENGES[G.challenge.id];
    if (t.tier === 1) {
      const target = exp <= 3 ? 2 : exp <= 6 ? 6 : 9;
      return { pos: target, label: target <= 2 ? 'Win promotion (top 2)' : target <= 6 ? 'Push for promotion (top 6)' : 'Mid-table safety (top 9)', solvent: true, challenge: ch ? ch.name : null };
    }
    const target = exp <= 1 ? 1 : exp <= 3 ? 3 : exp <= 6 ? 6 : exp <= 9 ? 9 : 10;
    return { pos: target, label: target === 1 ? 'Win the league' : target <= 3 ? `Finish in the top ${target}` : target <= 9 ? `Finish in the top ${target}` : 'Avoid relegation', solvent: true, challenge: ch ? ch.name : null };
  }
  function weekly() {
    const t = u(), obj = G.board.obj;
    if (!obj) return;
    const pos = L.position(t.id), rec = t.form.slice(-3);
    let d = 0;
    d += pos <= obj.pos ? 1.5 : pos <= obj.pos + 2 ? 0 : -2;
    d += rec.filter(r => r === 'W').length * 0.8 - rec.filter(r => r === 'L').length * 1.2;
    if (t.fin.bal < 0) d -= 1.5;
    const patience = t.ident === 'oldguard' ? 0.6 : t.ident === 'galactico' ? 1.3 : 1;
    G.board.conf = Math.round(U.clamp(G.board.conf + d * (d < 0 ? patience : 1), 0, 100));
    if (G.board.conf <= 8 && G.day > 40 && !G.sacked && G.mode !== 'sandbox') sack();
    challengeTick();
  }
  function sack() {
    G.sacked = { day: G.day, tid: G.userTeamId };
    const lower = G.teams.filter(t => t.id !== G.userTeamId && t.rep < u().rep - 5 && t.rep > u().rep - 35).sort(() => Math.random() - 0.5).slice(0, 3);
    G.jobOffers = lower.map(t => t.id);
    News.event(`${u().name} sack ${G.mgr.name}`, `The board has lost patience with ${G.mgr.name} after a miserable run. ${G.jobOffers.length ? 'Smaller clubs are already calling.' : ''}`, 'coach');
    G.mgr.rep = Math.max(5, G.mgr.rep - 10);
  }
  function seasonEnd(sm) {
    const t = u(), pos = sm.user.pos, obj = G.board.obj;
    // promotion/relegation has already moved the club: judge it on the table it finished in
    const fin = (sm.final && sm.final[t.id]) || null;
    if (sm.promoted.includes(t.id)) unlock('promoted');
    if (fin && fin.pos === 1 && fin.l === 0) unlock('invincible');
    if (G.bottomAtXmas && t.tier === 0 && !sm.relegated.includes(t.id)) unlock('great_escape');
    G.bottomAtXmas = false;
    // verdict
    let verdict;
    if (obj) {
      const diff = obj.pos - pos;
      verdict = diff >= 2 ? 'exceeded' : diff >= 0 ? 'met' : diff >= -2 ? 'missed' : 'failed';
      G.board.conf = Math.round(U.clamp(G.board.conf + { exceeded: 18, met: 8, missed: -12, failed: -28 }[verdict], 0, 100));
      G.mgr.rep = Math.round(U.clamp(G.mgr.rep + { exceeded: 8, met: 3, missed: -2, failed: -6 }[verdict], 5, 99));
    }
    G.lastVerdict = { verdict, pos, obj };
    if (G.board.conf <= 12 && G.mode !== 'sandbox') sack();
    // job offers for the in-demand manager
    else if (verdict === 'exceeded' || G.mgr.rep > t.rep + 10) {
      const bigger = G.teams.filter(x => x.id !== t.id && x.rep > t.rep + 4 && x.rep <= G.mgr.rep + 25 && !L.isUser(x.id)).sort(() => Math.random() - 0.5).slice(0, 2);
      for (const b of bigger) inbox({ type: 'job', tid: b.id, title: `Job offer: ${b.name}`, body: `${b.name} (${L.league(b.leagueId).name}, reputation ${b.rep}) want you as their manager. Your ${DATA.COACH_IDS[G.mgr.ident].name} identity goes with you; your academy and staff stay behind.`, actions: [{ label: 'Accept the job', act: 'jobAccept', v: b.id }, { label: 'Stay loyal', act: 'dismiss' }], expires: G.day + 14 });
    }
    // identities evolve: the club becomes what it does
    const season = G.season, wins = t.form;
    const debuts = L.squad(t).filter(p => p.promoted === season).length;
    const goals = fin;
    let nu = null;
    if (debuts >= 3 && t.ident !== 'academy') nu = 'academy';
    else if (goals && goals.gf >= 60 && t.ident !== 'entertainers') nu = 'entertainers';
    else if ((G.stats.earned || 0) - (G.stats.spent || 0) > 30 && t.ident !== 'moneyball') nu = 'moneyball';
    if (nu && Math.random() < 0.5) {
      const old = DATA.CLUB_IDS[t.ident].name;
      t.ident = nu;
      News.event(`${t.name} reinvented: "${DATA.CLUB_IDS[nu].name}"`, `Once known for ${old}, ${t.name} have a new identity: ${DATA.CLUB_IDS[nu].desc}`, 'club');
    }
    // and so does the manager: the style he actually plays
    const use = G.mgr.usage || {};
    const top = Object.entries(use).sort((a, b) => b[1] - a[1])[0];
    if (top && top[0] !== G.mgr.ident && top[1] >= 8) {
      G.mgr.ident = top[0];
      News.event(`${G.mgr.name}: a ${DATA.COACH_IDS[top[0]].name} manager now`, `Pundits have rebranded ${G.mgr.name}'s football. The ${DATA.COACH_IDS[top[0]].icon} ${DATA.COACH_IDS[top[0]].name} label sticks — and follows wherever they go next.`, 'coach');
    }
    G.mgr.usage = {};
    challengeTick(true);
    void wins;
    check();
  }
  function seasonStart() { G.eventsSeen = {}; }
  function newSeason() {
    // expiring contracts: decisions for the user
    for (const p of L.squad(u())) {
      if (p.yrs === 1) inbox({ type: 'contract', pid: p.id, title: `${p.ln}: final year of contract`, body: `${p.fn} ${p.ln} (${p.ovr}, age ${p.age}) has a year left. Renew from his player page, or he walks for free next summer.`, actions: [{ label: 'View player', act: 'player', v: p.id }] });
    }
    if (G.lastIntake && G.lastIntake.length) inbox({ type: 'acad', title: `Youth intake: ${G.lastIntake.length} new academy players`, body: 'The new crop has arrived. Set their training plans in the Academy.', actions: [{ label: 'Open academy', act: 'tab', v: 'squad:acad' }] });
  }
  function boostMult() {
    const avgMor = U.avg(L.squad(u()).map(p => p.mor));
    return (0.97 + avgMor / 1700) * (G.mgr.ident === 'motivator' ? 1.015 : 1);
  }

  // ── random events ──
  const pickSquad = f => U.pick(L.squad(u()).filter(f || (() => true)));
  const EVENTS = [
    { id: 'viral', w: 5, make() { const p = pickSquad(x => x.a[DATA.AK.dribbling] > 65); if (!p) return null; return { title: `${p.ln}'s skills go viral`, body: `A training-ground clip of ${p.fn} ${p.ln} has millions of views. The squad loves it and the club shop is busy.`, auto() { p.mor = Math.min(100, p.mor + 10); u().rep = Math.min(99, u().rep + 1); L.logMoney(u(), 0.25, 'spon', 'Viral merch spike'); } }; } },
    { id: 'sponsor', w: 4, make() { const amt = +(0.8 + u().rep * 0.02).toFixed(1); return { title: 'Sleeve sponsor offer', body: `A betting-app startup offers ${U.money(amt)} to put its logo on the sleeves. Fans are not keen.`, actions: [{ label: `Accept ${U.money(amt)}`, fn() { L.logMoney(u(), amt, 'spon', 'Sleeve sponsorship'); for (const p of L.squad(u())) p.mor = Math.max(10, p.mor - 2); return 'Deal done. The ultras unfurl a banner about it.'; } }, { label: 'Decline', fn() { u().rep = Math.min(99, u().rep + 1); return 'The fans approve of the club keeping its shirt clean.'; } }] }; } },
    { id: 'birthday', w: 4, make() { const p = pickSquad(); if (!p) return null; return { title: `${p.ln}'s birthday bash`, body: `${p.fn} ${p.ln} wants the whole squad at his birthday party two days before a game.`, actions: [{ label: 'Let them party', fn() { for (const q of L.squad(u())) { q.mor = Math.min(100, q.mor + 6); q.fit = Math.max(40, q.fit - 15); } return 'Great night. Heavy legs at training.'; } }, { label: 'Curfew', fn() { for (const q of L.squad(u())) q.mor = Math.max(10, q.mor - 3); return 'Grumbles in the dressing room, but they are fresh.'; } }] }; } },
    { id: 'flu', w: 3, make() { const ps = U.shuffle(L.squad(u()).slice()).slice(0, 4); return { title: 'Flu sweeps the dressing room', body: `${ps.map(p => p.ln).join(', ')} are laid low with a bug.`, auto() { for (const p of ps) p.fit = Math.max(25, p.fit - 35); } }; } },
    { id: 'raise', w: 4, make() { const p = L.squad(u()).filter(x => x.ovr >= L.teamLevel(u()) + 2).sort((a, b) => b.ovr - a.ovr)[0]; if (!p) return null; const nw = Math.round(p.wage * 1.3); return { title: `${p.ln}'s agent wants a raise`, body: `${p.fn} ${p.ln}'s agent says his client is underpaid at ${U.wage(p.wage)}. He wants ${U.wage(nw)}.`, actions: [{ label: `Pay ${U.wage(nw)}`, fn() { p.wage = nw; p.mor = Math.min(100, p.mor + 15); p.yrs = Math.max(p.yrs, 3); return `${p.ln} signs an improved deal.`; } }, { label: 'Refuse', fn() { p.mor = Math.max(10, p.mor - 20); if (p.pers === 'ambitious') p.wantsOut = true; return `${p.ln} is sulking.`; } }] }; } },
    { id: 'investor', w: 1.5, cond: () => !(G.challenge && G.challenge.id === 'rescue'), make() { const amt = U.ri(4, 12); return { title: 'The owner opens the chequebook', body: `A cash injection of ${U.money(amt)} lands in the transfer kitty.`, auto() { L.logMoney(u(), amt, 'events', 'Owner investment'); } }; } },
    { id: 'charity', w: 3, make() { return { title: 'Charity match invitation', body: 'A children\'s hospital asks for a midweek charity game. +$0.5M and goodwill, but tired legs.', actions: [{ label: 'Play it', fn() { L.logMoney(u(), 0.5, 'events', 'Charity match'); u().rep = Math.min(99, u().rep + 2); for (const p of L.squad(u())) p.fit = Math.max(40, p.fit - 12); return 'A lovely evening. The squad is a bit leggy.'; } }, { label: 'Politely decline', fn() { return 'Maybe next year.'; } }] }; } },
    { id: 'scandal', w: 3, make() { const p = pickSquad(x => x.pers === 'hothead' || Math.random() < 0.2); if (!p) return null; return { title: `${p.ln} in nightclub scandal`, body: `Photos of ${p.fn} ${p.ln} at 3am are all over the papers.`, actions: [{ label: 'Fine him two weeks\' wages', fn() { L.logMoney(u(), p.wage * 2 / 1000, 'events', `Fine: ${p.ln}`); p.mor = Math.max(10, p.mor - 12); return 'Discipline restored.'; } }, { label: 'Defend him publicly', fn() { for (const q of L.squad(u())) q.mor = Math.min(100, q.mor + 2); u().rep = Math.max(5, u().rep - 2); return 'The squad respects it. The press does not.'; } }] }; } },
    { id: 'tour', w: 30, cond: () => G.day <= 4 && !G.eventsSeen.tour, make() { return { title: 'Pre-season tour offers', body: 'Three options for the summer. Choose one.', actions: [{ label: 'Far East tour (+$3M, tiring)', fn() { L.logMoney(u(), 3, 'events', 'Far East tour'); for (const p of L.squad(u())) p.fit = Math.max(50, p.fit - 20); u().rep = Math.min(99, u().rep + 2); return 'Huge crowds, jet-lagged players.'; } }, { label: 'Mountain camp (fitness)', fn() { for (const p of L.squad(u())) { p.a[DATA.AK.stamina] = Math.min(99, p.a[DATA.AK.stamina] + 1); p.mor = Math.min(100, p.mor + 3); } return 'Lungs of steel.'; } }, { label: 'Stay home', fn() { for (const p of L.squad(u())) p.fit = 100; return 'Fresh and ready.'; } }] }; } },
    { id: 'mindgames', w: 3, make() { const f = L.nextUserFixture(); if (!f) return null; const opp = L.team(f.h === G.userTeamId ? f.a : f.h); const c = opp.coach != null ? G.coaches[opp.coach] : null; if (!c) return null; return { title: `${c.ln} takes a swipe`, body: `${opp.name}'s manager ${c.fn} ${c.ln} calls your ${DATA.COACH_IDS[G.mgr.ident].name} football "boring nonsense" ahead of your meeting.`, actions: [{ label: 'Fire back', fn() { for (const p of L.squad(u())) p.mor = Math.min(100, p.mor + 5); return 'The squad is fired up. Better win now.'; } }, { label: 'Rise above it', fn() { G.mgr.rep = Math.min(99, G.mgr.rep + 1); return 'Classy. The press likes you.'; } }] }; } },
    { id: 'wonderkid', w: 2, make() { return { title: 'A wonderkid on the doorstep', body: 'The parents of a 15-year-old local prodigy want him to join your academy. The family asks for $0.3M.', actions: [{ label: 'Sign him ($0.3M)', fn() { if (u().fin.bal < 0.3) return 'Not enough cash.'; L.logMoney(u(), -0.3, 'fees', 'Academy prodigy'); const p = L.mkAcademy(u(), 15, 8); return `${p.fn} ${p.ln} (${p.pos}) joins the academy.`; } }, { label: 'Pass', fn() { return 'He signs for a rival instead.'; } }] }; } },
    { id: 'fanfest', w: 3, make() { return { title: 'Fan festival a sell-out', body: 'Supporters organised a festival outside the ground. The club shop did a roaring trade.', auto() { L.logMoney(u(), 0.4, 'events', 'Fan festival'); } }; } },
    { id: 'overtraining', w: 2, cond: () => G.train === 'hard', make() { return { title: 'Physio warning', body: 'The medical team says the squad is overtrained. Switch to light training for a week?', actions: [{ label: 'Ease off', fn() { G.train = 'light'; return 'Training switched to Light.'; } }, { label: 'Keep pushing', fn() { const p = pickSquad(); if (p) p.inj = U.ri(5, 20); return p ? `${p.ln} pulls a hamstring.` : 'They cope.'; } }] }; } },
    { id: 'documentary', w: 1.5, cond: () => !G.eventsSeen.documentary, make() { return { title: 'Streaming documentary', body: 'A streaming giant wants fly-on-the-wall access for a season. $2M, but cameras everywhere.', actions: [{ label: 'Roll cameras ($2M)', fn() { G.eventsSeen.documentary = 1; L.logMoney(u(), 2, 'events', 'Documentary deal'); for (const p of L.squad(u())) p.mor = Math.max(10, p.mor - 4); u().rep = Math.min(99, u().rep + 3); return 'Lights, camera, dressing-room rants.'; } }, { label: 'No thanks', fn() { return 'Privacy kept.'; } }] }; } },
    { id: 'naming', w: 1, cond: () => !u().stadium.sold, make() { const amt = U.ri(6, 12); return { title: 'Stadium naming rights', body: `An energy-drink brand offers ${U.money(amt)} to rename ${u().stadium.name}.`, actions: [{ label: `Take ${U.money(amt)}`, fn() { L.logMoney(u(), amt, 'events', 'Naming rights'); u().stadium.name = `${U.pick(['Volt', 'Rush', 'Surge', 'Kraken', 'Nitro'])} ${U.pick(['Arena', 'Dome', 'Park', 'Stadium'])}`; u().stadium.sold = true; for (const p of L.squad(u())) p.mor = Math.max(10, p.mor - 2); return `Welcome to the ${u().stadium.name}.`; } }, { label: 'Never', fn() { u().rep = Math.min(99, u().rep + 1); return 'Tradition wins.'; } }] }; } },
    { id: 'pundit', w: 2, make() { return { title: 'TV punditry offer', body: 'A broadcaster wants you on their Saturday show.', auto() { G.mgr.rep = Math.min(99, G.mgr.rep + 2); } }; } },
    { id: 'poach', w: 2, cond: () => G.staff.ast != null, make() { const c = G.coaches[G.staff.ast]; if (!c) return null; const club = U.pick(G.teams.filter(t => !L.isUser(t.id))); return { title: `${club.name} want your assistant`, body: `${club.name} have approached ${c.fn} ${c.ln} about a role. Let him go for $0.2M compensation, or match their offer (+30% wages).`, actions: [{ label: 'Let him go', fn() { L.logMoney(u(), 0.2, 'events', 'Compensation'); c.tid = -1; G.staff.ast = null; return `${c.ln} moves on. Hire a new assistant in Club → Staff.`; } }, { label: 'Match the offer', fn() { c.wage = Math.round(c.wage * 1.3); return `${c.ln} stays.`; } }] }; } },
    { id: 'agent', w: 2, make() { const p = L.mkPlayer(U.pick(DATA.POS), Math.round(L.teamLevel(u()) + U.ri(0, 5)), U.ri(28, 32), U.ri(0, 3)); L.toFA(p); p.wage = Math.round(L.marketWage(p) * 1.4); return { title: 'A super-agent calls', body: `${p.fn} ${p.ln} (${p.pos}, ${p.ovr}) is a free agent and "open to offers". Wage demands are steep.`, actions: [{ label: 'View player', act: 'player', v: p.id }, { label: 'Not interested', fn() { return 'Noted.'; } }] }; } },
    { id: 'derby', w: 2, make() { return { title: 'Derby week fever', body: 'The city is painted in club colours. Merchandise flies off the shelves.', auto() { L.logMoney(u(), 0.3, 'spon', 'Derby merch'); for (const p of L.squad(u())) p.mor = Math.min(100, p.mor + 2); } }; } },
  ];
  // offers with a deadline lapse after it, and never survive into a new season (the day count restarts)
  const expired = m => !m.done && !!m.expires && (G.day > m.expires || (m.s != null && m.s !== G.season));
  function daily() {
    // expire stale bids
    for (const m of G.inbox) if (expired(m)) { m.done = true; m.result = 'Expired'; }
    // contract reminders settle themselves once he's re-signed or gone
    for (const m of G.inbox) {
      if (m.done || m.type !== 'contract') continue;
      const p = G.players[m.pid];
      if (!p || p.tid !== G.userTeamId) { m.done = true; m.result = 'No longer at the club.'; }
      else if (p.yrs > 1) { m.done = true; m.result = 'Contract renewed.'; }
    }
    // Christmas check for the Great Escape
    if (G.day === 100) { const tb = L.table(u().leagueId); if (tb.length && tb[tb.length - 1].tid === G.userTeamId && u().tier === 0) G.bottomAtXmas = true; }
    if (G.lastEventDay && G.day - G.lastEventDay < 5) return;
    if (Math.random() > 0.11 && !(G.day <= 2 && !G.eventsSeen.tour)) return;
    const pool = EVENTS.filter(e => !e.cond || e.cond());
    for (let tries = 0; tries < 4; tries++) {
      const e = U.wpick(pool, x => x.w);
      const ev = e.make();
      if (!ev) continue;
      G.lastEventDay = G.day;
      G.eventsSeen[e.id] = 1;
      if (ev.auto) { ev.auto(); inbox({ type: 'event', title: ev.title, body: ev.body }); News.event(ev.title, ev.body); }
      else {
        // choices can't be stored as functions: remember the event and rebuild it when answered
        const msg = inbox({ type: 'event', ev: e.id, title: ev.title, body: ev.body, actions: ev.actions.map((a, i) => ({ label: a.label, act: a.act || 'event', v: a.v != null ? a.v : i })), block: false });
        pendingEvents[msg.id] = ev;
      }
      return;
    }
  }
  const pendingEvents = {};
  function answerEvent(msg, i) {
    const ev = pendingEvents[msg.id];
    if (!ev) { msg.done = true; msg.result = 'This decision has lapsed.'; return msg.result; }
    const a = ev.actions[i];
    const res = a && a.fn ? a.fn() : '';
    msg.done = true;
    msg.result = res;
    delete pendingEvents[msg.id];
    L.save();
    return res;
  }
  function showcaseInvite() {
    const opp = G.teams.filter(t => t.nation !== u().nation && t.tier === 0).sort((a, b) => b.rep - a.rep)[U.ri(0, 4)];
    G.showcase = { opp: opp.id, state: 'invited' };
    // the answer is needed before the day itself
    inbox({ type: 'showcase', title: `${DATA.SHOWCASE} invitation`, body: `Organisers invite you to a glamour friendly against ${opp.name} on ${L.dateStr(DATA.SEASON.SHOWCASE, true)}. Appearance fee ${U.money(DATA.PRIZE.showcase)}, more for a win. Your players will be tired for the next league game.`, actions: [{ label: 'Accept', act: 'showcaseYes' }, { label: 'Decline', act: 'dismiss' }], expires: DATA.SEASON.SHOWCASE - 1 });
  }

  // ── owner challenges ──
  const CHALLENGES = {
    rescue: { name: 'In the Red', icon: '🩸', desc: 'Take over a top-flight club $25M in debt. Clear the debt by the end of season 2 without being relegated.', seasons: 2,
      teams: () => G.teams.filter(t => t.tier === 0 && t.rep >= 45 && t.rep <= 70),
      setup() { u().fin.bal = -25; },
      status() { const t = u(); const done = G.season >= 2 && G.phase === 'post' && t.fin.bal >= 0 && t.tier === 0; const failed = t.tier === 1 || (G.season > 2); return { done, failed: failed && !done, text: `Balance ${U.money(t.fin.bal)} · Season ${G.season}/2` }; } },
    youth: { name: 'Youth Revolution', icon: '🌱', desc: 'Every senior player over 23 is sold. Win promotion — or finish in the top half — within three seasons.', seasons: 3,
      teams: () => G.teams.filter(t => t.rep >= 30 && t.rep <= 75),
      setup() { const t = u(); for (const p of L.squad(t).filter(p => p.age > 23)) L.toFA(p); while (L.squad(t).length < 20) { const p = L.mkPlayer(U.pick(DATA.POS), Math.round(L.teamLevel(t) - 8 + U.gauss(0, 4)), U.ri(17, 21), t.nation); L.joinTeam(p, t); } L.autoLineup(t); L.logMoney(t, 6, 'events', 'Proceeds of the sell-off'); },
      status() { const t = u(); const pos = L.position(t.id); const done = G.phase === 'post' && ((t.tier === 0 && pos <= 6) || (G.lastSummary && G.lastSummary.promoted.includes(t.id))); return { done, failed: G.season > 3 && !done, text: `Season ${G.season}/3 · ${U.ord(pos)} place` }; } },
    climb: { name: 'The Long Climb', icon: '🧗', desc: 'Take the lowest-rated club in a second division to the top-flight title within five seasons.', seasons: 5,
      teams: () => DATA.NATIONS.map((n, i) => L.league(i * 2 + 1).teams.map(L.team).sort((a, b) => a.rep - b.rep)[0]),
      setup() { },
      status() { const t = u(); const done = t.trophies.some(x => DATA.NATIONS.some(n => n.tiers[0] === x.name)); return { done, failed: G.season > 5 && !done, text: `Season ${G.season}/5 · ${L.league(t.leagueId).name}` }; } },
    galactico: { name: 'Galácticos', icon: '🌟', desc: 'The richest club gets $80M to spend. The owner wants the league and cup double within three seasons.', seasons: 3,
      teams: () => DATA.NATIONS.map((n, i) => L.league(i * 2).teams.map(L.team).sort((a, b) => b.rep - a.rep)[0]),
      setup() { L.logMoney(u(), 80, 'events', 'Owner war chest'); u().ident = 'galactico'; },
      status() { const done = !!(G.ach && G.ach.double); return { done, failed: G.season > 3 && !done, text: `Season ${G.season}/3 · double ${done ? 'won' : 'not yet'}` }; } },
    moneyball: { name: 'Moneyball', icon: '📈', desc: 'No transfer budget and a wage cap. Reach the top four in the top flight within three seasons — and stay in the black.', seasons: 3,
      teams: () => G.teams.filter(t => t.tier === 0 && t.rep <= 55),
      setup() { u().fin.bal = 0; u().ident = 'moneyball'; },
      status() { const t = u(); const pos = L.position(t.id); const fs = L.finalStanding(t.id); const tier = fs ? fs.tier : t.tier; const done = G.phase === 'post' && tier === 0 && pos <= 4 && t.fin.bal >= 0; return { done, failed: G.season > 3 && !done, text: `Season ${G.season}/3 · ${U.ord(pos)} · ${U.money(t.fin.bal)}` }; } },
    cupkings: { name: 'Cup Kings', icon: '🥇', desc: 'A second-division minnow. Win your national cup within three seasons.', seasons: 3,
      teams: () => G.teams.filter(t => t.tier === 1 && t.rep <= 40),
      setup() { },
      status() { const t = u(); const done = t.trophies.some(x => DATA.NATIONS.some(n => n.cup === x.name)); return { done, failed: G.season > 3 && !done, text: `Season ${G.season}/3` }; } },
    blitz: { name: 'Blitz Chaos', icon: '💥', desc: 'The owner wants entertainment: Blitz Ball tactics only, and 70+ league goals in a season.', seasons: 3,
      teams: () => G.teams.filter(t => t.tier === 0 && t.rep >= 40 && t.rep <= 80),
      setup() { G.mgr.ident = 'blitz'; L.applyPhilosophy(u(), 'blitz'); u().ident = 'entertainers'; },
      status() { const r = (G.table[u().leagueId] || {})[G.userTeamId] || { gf: 0 }; const done = r.gf >= 70; return { done, failed: G.season > 3 && !done, text: `${r.gf}/70 league goals this season` }; } },
    fortress: { name: 'Fortress', icon: '🏰', desc: 'Go an entire league season unbeaten at home within three seasons.', seasons: 3,
      teams: () => G.teams.filter(t => t.rep >= 35 && t.rep <= 70),
      setup() { u().ident = 'fortress'; },
      status() { const home = G.fixtures.filter(f => f.comp === 'L' && f.h === G.userTeamId && f.done); const lost = home.some(f => f.hs < f.as); const done = G.phase === 'post' && home.length >= 11 && !lost; if (done) G.challenge.won = true; return { done: done || G.challenge.won, failed: G.season > 3 && !G.challenge.won, text: `Home: ${home.filter(f => f.hs > f.as).length}W ${home.filter(f => f.hs === f.as).length}D ${home.filter(f => f.hs < f.as).length}L` }; } },
  };
  function applyChallenge(c) {
    G.challenge = { id: c.id || c, start: G.season, done: false, failed: false };
    const ch = CHALLENGES[G.challenge.id];
    if (ch && ch.setup) ch.setup();
  }
  function challengeStatus() {
    if (!G.challenge) return null;
    const ch = CHALLENGES[G.challenge.id];
    if (!ch) return null;
    return { ...ch.status(), ch };
  }
  function challengeTick(seasonEnd) {
    const st = challengeStatus();
    if (!st || G.challenge.done || G.challenge.failed) return;
    if (st.done) {
      G.challenge.done = true;
      unlock('challenge');
      G.mgr.rep = Math.min(99, G.mgr.rep + 15);
      inbox({ type: 'board', title: `Challenge complete: ${st.ch.name}!`, body: 'The owner is delighted. Carry on in a normal career from here.' });
      News.event(`${G.mgr.name} completes "${st.ch.name}"`, 'The owner hails a job well done.', 'club');
    } else if (st.failed && seasonEnd) {
      G.challenge.failed = true;
      inbox({ type: 'board', title: `Challenge failed: ${st.ch.name}`, body: 'The owner is disappointed, but you keep your job. Carry on in a normal career.' });
    }
  }

  // ── inbox actions ──
  function act(msgId, actIdx) {
    const m = G.inbox.find(x => x.id === msgId);
    if (!m) return null;
    const a = m.actions && m.actions[actIdx];
    if (!a) return null;
    m.read = true;
    if (a.act !== 'player' && a.act !== 'tab') {
      if (expired(m)) { m.done = true; m.result = 'Expired'; return { text: 'Too late: this has expired.' }; }
      if (m.done) return { text: m.result || '' };
    }
    switch (a.act) {
      case 'event': return { text: answerEvent(m, a.v) };
      case 'dismiss': m.done = true; m.result = 'Dismissed.'; return { text: '' };
      case 'promote': if (L.promote(a.v)) { m.done = true; m.result = 'Promoted to the first team.'; } return { text: m.result };
      case 'releaseAcad': m.done = true; m.result = L.releaseAcademy(a.v) ? 'Released.' : 'No longer in the academy.'; return { text: m.result };
      case 'acceptBid': {
        const p = G.players[m.pid];
        if (!p || p.tid !== G.userTeamId) { m.done = true; m.result = 'No longer at the club.'; return { text: m.result }; }
        const r = L.sellTo(m.pid, m.buyer, m.fee, true);
        if (!r.ok) { if (!L.canLose()) return { text: r.why }; m.done = true; m.result = r.why; return { text: m.result }; }
        m.done = true; m.result = `Sold for ${U.money(m.fee)}.`; return { text: m.result };
      }
      case 'counterBid': {
        const p = G.players[m.pid];
        if (!p || p.tid !== G.userTeamId) { m.done = true; return { text: 'No longer at the club.' }; }
        const want = +(m.fee * 1.25).toFixed(2), b = L.team(m.buyer);
        if (!L.canLose()) return { text: L.squadFloorWhy() };
        if (!L.windowOpen()) { m.done = true; m.result = 'The transfer window has closed: the deal is off.'; }
        else if (!b || b.fin.bal < want) { m.done = true; m.result = `${b ? b.name : 'They'} can't stretch to ${U.money(want)} and walk away.`; }
        else if (Math.random() < (p.listed ? 0.55 : 0.4)) { const r = L.sellTo(m.pid, m.buyer, want, true); m.done = true; m.result = r.ok ? `They paid up: sold for ${U.money(want)}.` : r.why; }
        else { m.done = true; m.result = 'They walked away.'; }
        return { text: m.result };
      }
      case 'rejectBid': { const p = G.players[m.pid]; if (p && p.pers === 'ambitious' && m.fee > L.value(p) * 1.1) { p.mor = Math.max(10, p.mor - 12); p.wantsOut = true; } m.done = true; m.result = 'Rejected.'; return { text: m.result }; }
      case 'acceptTrade': { m.done = true; m.result = L.executeTrade(m); return { text: m.result }; }
      case 'showcaseYes': {
        if (!G.showcase || G.showcase.state !== 'invited' || G.day >= DATA.SEASON.SHOWCASE) { m.done = true; m.result = 'Too late: the organisers have filled the slot.'; return { text: m.result }; }
        const opp = G.showcase.opp;
        G.fixtures.push({ id: G.nextFx++, day: DATA.SEASON.SHOWCASE, comp: 'S', lg: -1, rd: 'S', h: G.userTeamId, a: opp, done: false, hs: 0, as: 0, wx: { id: 'clear', ko: 'night', temp: 4, wa: 0, ws: 0 }, seed: U.ri(1, 2 ** 31 - 2), neutral: true, ko: true });
        G.showcase.state = 'accepted'; m.done = true; m.result = 'Accepted. See you under the lights.';
        return { text: m.result };
      }
      case 'jobAccept': if (!L.takeJob(a.v)) { m.done = true; m.result = 'You already manage this club.'; return { text: m.result }; } unlock('job_hopper'); m.done = true; m.result = `You are the new ${L.team(a.v).name} manager.`; return { text: m.result, nav: 'home' };
      case 'player': return { nav: 'player', v: a.v };
      case 'tab': return { nav: 'tab', v: a.v };
      default: return null;
    }
  }

  return {
    ACH, achList, unlock, check, onMatch, trophy, onSign, onSell, inbox, unread, objectives, weekly, daily, seasonEnd, seasonStart, newSeason, boostMult,
    CHALLENGES, applyChallenge, challengeStatus, showcaseInvite, act, setOnUnlock: fn => { onUnlock = fn; },
  };
})();
