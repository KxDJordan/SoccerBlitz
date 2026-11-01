'use strict';
// ── NEWS & FORUM: the world talks back ────────────────────────────
// Articles come from the wire (results, transfers, sackings, promotions). Forum threads come from fans:
// every club has a crowd with a handle style, and every story spawns replies from the people it hurts or thrills.

const News = (() => {
  const P = id => G.players[id];
  const T = id => G.teams[id];
  const pn = p => `${p.fn} ${p.ln}`;
  const WRITERS = [
    { n: 'Dario Vento', role: 'Transfer Insider' }, { n: 'Kit Hargreaves', role: 'The Touchline' }, { n: 'Mara Esteban', role: 'Chief Football Writer' },
    { n: 'Henrik Stahl', role: 'Tactics Desk' }, { n: 'Lucia Ferrante', role: 'Data & Analysis' }, { n: 'Sol Okonkwo', role: 'Academy Correspondent' },
  ];
  const HANDLE_A = ['Ultra', 'Til_I_Die', 'Faithful', 'Blitz', 'Terrace', 'Gaffer', 'Kop', 'North_End', 'Old_Boy', 'Curva', 'Season_Ticket', 'Away_Day', 'Box_To_Box', 'Number9', 'Cult_Hero'];
  const HANDLE_B = ['Dave', 'Sanchez', 'Klaus', 'Gio', 'Tilly', 'Bazza', 'Mo', 'Ines', 'Pep_Fan', 'Rafa', 'Jo', 'Vik', 'Lars', 'Bea', 'Rocco'];

  function handle(t) {
    const h = U.hash(`${t ? t.id : 'n'}:${Math.random()}`);
    const base = t ? t.city.replace(/[^A-Za-z]/g, '') : U.pick(['Neutral', 'Groundhopper', 'Armchair', 'Pundit']);
    const style = h % 4;
    return style === 0 ? `${base}${U.pick(HANDLE_A)}` : style === 1 ? `${U.pick(HANDLE_B)}_${t ? t.abbr : 'FC'}` : style === 2 ? `${base}_${U.pick(HANDLE_B)}${U.ri(1, 99)}` : `${U.pick(HANDLE_A)}${U.ri(70, 99)}`;
  }

  function post(article) {
    const a = { id: G.nextMsg++, d: G.day, s: G.season, ...article };
    G.news.unshift(a);
    if (G.news.length > 160) G.news.length = 160;
    return a;
  }
  function thread(title, tag, starter, replies, extra = {}) {
    const th = { id: G.nextMsg++, d: G.day, s: G.season, title, tag, author: starter.n, tid: starter.tid, posts: [{ n: starter.n, tid: starter.tid, t: starter.t, up: U.ri(2, 60) }, ...replies.map(r => ({ ...r, up: U.ri(0, 45) }))], views: U.ri(120, 9000), ...extra };
    G.forum.unshift(th);
    if (G.forum.length > 70) G.forum.length = 70;
    return th;
  }
  const fan = (t, txt) => ({ n: handle(t), tid: t ? t.id : null, t: txt });
  const neutral = txt => ({ n: handle(null), tid: null, t: txt });

  // ── career ──
  function welcome() {
    const u = L.user(), lg = L.league(u.leagueId), c = DATA.COACH_IDS[G.mgr.ident], ci = DATA.CLUB_IDS[u.ident];
    post({ tag: 'club', tid: u.id, title: `${G.mgr.name} named ${u.name} manager`, body: `${u.name} have appointed ${G.mgr.name} as their new manager ahead of the ${lg.name} season. A ${c.name} disciple, the new boss inherits a club whose identity is "${ci.name}" — ${ci.desc.toLowerCase()} The board expects: ${G.board.obj ? G.board.obj.label : 'progress'}.`, by: WRITERS[2] });
    thread(`New gaffer: ${G.mgr.name}. Thoughts?`, 'club', fan(u, `${c.name} at ${u.name}? I'll believe it when I see it. ${ci.fans}`), [
      fan(u, U.pick(['Give them a chance, honestly.', 'Better than the last clown.', 'If we see some actual pressing I\'ll be happy.', 'Never heard of them. Classic board.'])),
      fan(u, U.pick(['Sign a striker and I\'m in.', 'Please play the academy kids.', 'Top half or bust.', 'Just don\'t lose the derby.'])),
      neutral(U.pick([`${u.name} are a sleeping giant, this could be interesting.`, 'Bookies have them mid-table. Fair.', 'Watch this space.'])),
    ]);
  }
  function seasonPreview() {
    const u = L.user(), lg = L.league(u.leagueId);
    const fav = L.table(lg.id).map(r => T(r.tid)).sort((a, b) => b.rep - a.rep)[0];
    post({ tag: 'league', title: `${lg.name} preview: is anyone stopping ${fav.name}?`, body: `Season ${G.season} kicks off with ${fav.name} as favourites. ${u.name} are tipped to finish around ${U.ord(L.expectedPos(u))}. The board's target: ${G.board.obj ? G.board.obj.label : '—'}.`, by: WRITERS[3] });
  }
  function weekly() {
    const u = L.user(), lg = L.league(u.leagueId), tb = L.table(lg.id);
    if (!tb.length || tb[0].p < 2) return;
    const top = T(tb[0].tid), pos = L.position(u.id);
    // a power-rankings style column, and a mood thread from the user's fans
    const scorers = Object.values(G.players).filter(p => p.tid >= 0 && T(p.tid) && T(p.tid).leagueId === lg.id).sort((a, b) => b.st.g - a.st.g).slice(0, 3);
    post({ tag: 'league', title: `${lg.name}: ${top.name} ${tb[0].pts > (tb[1] ? tb[1].pts + 4 : 99) ? 'pulling clear' : 'on top'} after ${tb[0].p} games`, body: `${top.name} lead on ${tb[0].pts} points. Golden Boot race: ${scorers.map(p => `${p.ln} (${T(p.tid).abbr}) ${p.st.g}`).join(', ')}. ${u.name} sit ${U.ord(pos)}.`, by: WRITERS[4] });
    const form = u.form.slice(-3).join('');
    const mood = form === 'WWW' ? 'buzz' : form.includes('LL') ? 'crisis' : 'meh';
    if (Math.random() < 0.6) {
      const title = mood === 'buzz' ? `We are ${U.ord(pos)} and I'm dreaming` : mood === 'crisis' ? `${G.mgr.name} OUT? Be honest.` : `Matchday thread — ${u.name} ${U.ord(pos)} in the table`;
      const lines = {
        buzz: ['Unbeaten in three. Nobody wants to play us.', 'The pressing is unreal right now.', 'Who is stopping us? Genuinely asking.', 'Calm down lads, it\'s a long season.'],
        crisis: ['Same mistakes every week.', 'Board need to back the manager, not sack them.', 'Formation is all wrong.', 'Get the academy lads in, can\'t be worse.', 'The defending is a war crime.'],
        meh: ['Solid if unspectacular.', 'Need a proper number 9.', 'Midfield looks better with the new roles.', 'Fine. Not great. Fine.'],
      }[mood];
      thread(title, 'club', fan(u, U.pick(lines)), [fan(u, U.pick(lines)), fan(u, U.pick(lines)), neutral(U.pick(['Your lot are fine, stop whinging.', 'Watched the last one, decent shape.', 'Mid.']))]);
    }
  }

  // ── matches ──
  function matchReport(f, res, live) {
    const h = T(f.h), a = T(f.a), u = L.user();
    const userSide = f.h === u.id ? 0 : f.a === u.id ? 1 : -1;
    if (userSide < 0) return;
    const opp = userSide === 0 ? a : h, us = res.score[userSide], them = res.score[1 - userSide];
    const scorers = (res.events || []).filter(e => e.type === 'goal' && e.team === userSide && e.pid).map(e => P(e.pid)).filter(Boolean);
    const motm = res.motm ? P(res.motm) : null;
    const comp = compName(f);
    const verb = us > them + 2 ? 'thrash' : us > them ? 'beat' : us === them ? 'draw with' : us + 2 < them ? 'are thrashed by' : 'lose to';
    const head = `${u.name} ${verb} ${opp.name} ${us}-${them}${f.pens ? ` (${f.pens[userSide]}-${f.pens[1 - userSide]} pens)` : ''}`;
    const hits = res.stats ? res.stats[userSide].hits : 0;
    const body = `${comp}. ${scorers.length ? `Goals from ${[...new Set(scorers.map(p => p.ln))].join(', ')}.` : 'A blank day in front of goal.'} ${motm ? `${pn(motm)} took player of the match.` : ''} ${hits > 8 ? `A bruising afternoon: ${hits} big hits handed out.` : ''}`.trim();
    post({ tag: 'match', tid: u.id, title: head, body, fx: f.id, by: WRITERS[1] });
    const tone = us > them ? 'win' : us < them ? 'loss' : 'draw';
    const lines = {
      win: [`${scorers[0] ? scorers[0].ln : 'The lads'} is different class.`, 'Three points, get in!', 'That shape in possession was beautiful.', 'Told you all we\'d be fine.', `${opp.name} fans awfully quiet tonight.`],
      loss: ['Shambolic.', 'Why do we keep changing the formation?', 'Ref was a disgrace but we were worse.', 'Bench the keeper.', 'Need January signings, urgently.'],
      draw: ['Point is a point.', 'Should have won that.', 'Subs came on far too late.', 'Decent. Need more in the final third.'],
    }[tone];
    thread(`Post-match: ${head}`, 'match', fan(u, U.pick(lines)), [fan(u, U.pick(lines)), fan(opp, U.pick(tone === 'win' ? ['Robbed.', 'Fair play, you were better.', 'We were awful.'] : ['Easy.', 'Never in doubt.', 'Get in!!'])), fan(u, U.pick(lines))], { fx: f.id });
    // upsets elsewhere
  }
  function compName(f) {
    if (f.comp === 'L') return `${L.league(f.lg).name}, round ${f.rd}`;
    if (f.comp === 'C') return `${DATA.NATIONS[f.lg].cup} ${L.CUP_NAMES[f.rd]}`;
    if (f.comp === 'X') return `${DATA.CONTINENTAL} ${L.CUP_NAMES[f.rd]}`;
    if (f.comp === 'I') return `${DATA.INVITATIONAL} ${f.rd === 'SF' ? 'semi-final' : f.rd === 'F' ? 'final' : 'third-place game'}`;
    if (f.comp === 'S') return DATA.SHOWCASE;
    if (f.comp === 'A') return 'Academy League';
    return 'Friendly';
  }
  function roundUp(day) {
    // the day's biggest upset, if any
    const fx = G.fixtures.filter(f => f.day === day && f.done && f.comp === 'L');
    let best = null, gap = 14;
    for (const f of fx) {
      const w = L.winnerOf(f), l = w === f.h ? f.a : f.h;
      if (f.hs === f.as) continue;
      const g = T(l).rep - T(w).rep;
      if (g > gap) { gap = g; best = { f, w: T(w), l: T(l) }; }
    }
    if (best && best.w.id !== G.userTeamId) {
      post({ tag: 'league', title: `Shock! ${best.w.name} stun ${best.l.name}`, body: `${best.w.name} beat ${best.l.name} ${Math.max(best.f.hs, best.f.as)}-${Math.min(best.f.hs, best.f.as)} — one of the upsets of the season.`, tid: best.w.id, by: WRITERS[4] });
      thread(`${best.l.name} lose to ${best.w.name}?!`, 'league', fan(best.w, 'WHAT A DAY TO BE ALIVE'), [fan(best.l, 'Embarrassing. Heads must roll.'), neutral('Love to see it.'), fan(best.l, 'Manager out. Today.')]);
    }
  }

  // ── transfers ──
  function transfer(p, from, to, fee, swapIds) {
    const swaps = (swapIds || []).map(P).filter(Boolean);
    const userBuy = to && to.id === G.userTeamId, userSell = from && from.id === G.userTeamId;
    const title = fee > 0 ? `${to.name} sign ${pn(p)} for ${U.money(fee)}${swaps.length ? ` + ${swaps.map(s => s.ln).join(', ')}` : ''}` : `${to.name} snap up ${pn(p)}${from ? ` from ${from.name}` : ' on a free'}`;
    post({ tag: 'transfer', tid: to.id, pid: p.id, title, body: `${p.age}-year-old ${DATA.POS_NAME[p.pos].toLowerCase()} ${pn(p)} (${p.ovr} OVR) ${from ? `leaves ${from.name}` : 'arrives as a free agent'} and joins ${to.name}${p.wage ? ` on ${U.wage(p.wage)}` : ''}. ${swaps.length ? `${swaps.map(pn).join(' and ')} move the other way.` : ''} Here we go!`, by: WRITERS[0] });
    if (userBuy || userSell || fee > 10) {
      const t = userBuy ? to : userSell ? from : to;
      thread(`${pn(p)} ${userSell ? 'SOLD' : 'signs'} — reaction`, 'transfer', fan(t, userSell ? U.pick(['Selling our best players again. Ambition?', `${U.money(fee)} is good business tbf.`, 'Gutted. Loved him.']) : U.pick(['Massive signing!!!', `${U.money(fee)}?? Daylight robbery.`, 'Never heard of him, trust the scouts.', 'He fits the system perfectly.'])), [
        fan(t, U.pick(['Agreed.', 'Wait and see.', 'Board have finally woken up.', 'Panic buy if you ask me.'])),
        fan(userSell ? to : from || null, U.pick(['Good luck to him.', 'Overrated anyway.', 'Thanks for the cash!', 'Sad to see him go.'])),
      ], { pid: p.id });
    }
  }
  function windowOpens() { post({ tag: 'transfer', title: 'The winter window is open', body: 'Clubs have two weeks to do business. Expect bids, swaps and the odd panic buy.', by: WRITERS[0] }); }
  function windowCloses() { post({ tag: 'transfer', title: 'Deadline day: window slams shut', body: 'No more deals until the next window. Free agents can still be signed.', by: WRITERS[0] }); }
  function leftOnFree(p) { post({ tag: 'transfer', pid: p.id, title: `${pn(p)} leaves ${L.user().name} on a free`, body: `Out of contract and not renewed, ${p.ln} walks away for nothing.`, by: WRITERS[0] }); }

  // ── coaches ──
  function coachSacked(t, c) {
    post({ tag: 'coach', tid: t.id, title: `${t.name} sack ${c.fn} ${c.ln}`, body: `After a ${c.w}-${c.d}-${c.l} run, ${t.name} have parted ways with their ${DATA.COACH_IDS[c.ident].name} manager. The search for a successor begins.`, by: WRITERS[2] });
    thread(`${c.ln} GONE at ${t.name}`, 'coach', fan(t, U.pick(['About time.', 'Harsh. The squad is the problem.', 'Who on earth replaces him?'])), [fan(t, 'Get someone who actually presses.'), neutral(`${c.ln} will walk into another job, decent coach.`)]);
  }
  function coachHired(t, c) {
    const id = DATA.COACH_IDS[c.ident];
    post({ tag: 'coach', tid: t.id, title: `${t.name} appoint ${c.fn} ${c.ln}`, body: `${c.ln} brings a ${id.icon} ${id.name} identity: ${id.desc} Expect ${t.name} to line up ${id.oop} without the ball and ${id.ip} with it.`, by: WRITERS[3] });
  }
  function coachPoached(c, from, to) {
    post({ tag: 'coach', tid: to.id, title: `${to.name} poach ${c.ln} from ${from.name}`, body: `${from.name} are left reeling as their manager ${c.fn} ${c.ln} jumps ship for ${to.name}. His ${DATA.COACH_IDS[c.ident].name} philosophy goes with him.`, by: WRITERS[0] });
    thread(`${c.ln} walks out on us for ${to.name}`, 'coach', fan(from, 'Loyalty is dead in this game.'), [fan(from, 'Can\'t blame him, bigger club.'), fan(to, 'Great appointment, buzzing.')]);
  }
  function userHired(t) {
    post({ tag: 'club', tid: t.id, title: `${t.name} hire ${G.mgr.name}`, body: `${G.mgr.name} takes the ${t.name} job, bringing a ${DATA.COACH_IDS[G.mgr.ident].name} identity and ${G.mgr.trophies} career trophies.`, by: WRITERS[2] });
  }

  // ── academy ──
  function promoted(p) {
    post({ tag: 'academy', pid: p.id, tid: p.tid, title: `${pn(p)} promoted to the first team`, body: `${L.user().name} have handed ${p.age}-year-old ${p.ln} a first-team contract. Academy staff rate his potential as ${U.potGrade(p.pot)}.`, by: WRITERS[5] });
  }
  function debut(p) {
    const u = L.user();
    post({ tag: 'academy', pid: p.id, tid: u.id, title: `Academy graduate ${p.ln} makes his debut`, body: `${pn(p)} becomes the latest product of the ${u.name} academy to play for the first team.`, by: WRITERS[5] });
    if (u.ident === 'academy') thread(`${p.ln} DEBUT. One of our own!`, 'academy', fan(u, 'One of our own, one of our own!'), [fan(u, 'This is what this club is about.'), fan(u, 'Give him a run in the side.')]);
  }
  function retire(p) { post({ tag: 'league', pid: p.id, title: `${pn(p)} retires`, body: `${p.ln} hangs up his boots at ${p.age} after ${p.car.gp} games and ${p.car.g} goals.`, by: WRITERS[2] }); }

  // ── cups & seasons ──
  function cupDraw(n, round) {
    const cup = G.cups[n], f = cup.rounds[round].map(id => G.fixtures.find(x => x.id === id)).find(x => x && (x.h === G.userTeamId || x.a === G.userTeamId));
    if (!f) return;
    const opp = T(f.h === G.userTeamId ? f.a : f.h);
    post({ tag: 'cup', tid: G.userTeamId, title: `${DATA.NATIONS[n].cup} draw: ${T(f.h).name} v ${T(f.a).name}`, body: `${L.CUP_NAMES[round]}. ${L.user().name} will face ${opp.name}${opp.tier > L.user().tier ? ' — a banana skin' : opp.tier < L.user().tier ? ' — a giant-killing chance' : ''}.`, by: WRITERS[1] });
  }
  function cupWinner(n, t, f) {
    post({ tag: 'cup', tid: t.id, title: `${t.name} win the ${DATA.NATIONS[n].cup}!`, body: `${T(f.h).name} ${f.hs}-${f.as} ${T(f.a).name}${f.pens ? ` (${f.pens[0]}-${f.pens[1]} on penalties)` : ''}. Silverware for ${t.name}.`, by: WRITERS[2] });
    thread(`${t.name} lift the ${DATA.NATIONS[n].cup}`, 'cup', fan(t, 'CHAMPIONS!!! What a team!'), [fan(t, 'Best day of my life.'), neutral('Deserved, best side in the competition.')]);
  }
  function contWinner(t, f) {
    post({ tag: 'cup', tid: t.id, title: `${t.name} are champions of the continent!`, body: `${T(f.h).name} ${f.hs}-${f.as} ${T(f.a).name} in the ${DATA.CONTINENTAL} final. ${t.name} are kings of the four leagues.`, by: WRITERS[2] });
  }
  function invitational(t, f) { post({ tag: 'cup', tid: t.id, title: `${t.name} win the ${DATA.INVITATIONAL}`, body: `A pre-season trophy and ${U.money(DATA.PRIZE.invitational.W)} in the bank.`, by: WRITERS[1] }); }
  function seasonEnd(sm) {
    for (const l of sm.leagues) {
      const lg = L.league(l.lg), ch = T(l.champ);
      post({ tag: 'league', tid: ch.id, title: `${ch.name} are ${lg.name} champions`, body: `${ch.name} finish top with ${l.table[0].pts} points.`, by: WRITERS[2] });
    }
    const up = sm.promoted.map(T).map(t => t.name), down = sm.relegated.map(T).map(t => t.name);
    post({ tag: 'league', title: 'Promoted & relegated', body: `Up: ${up.join(', ')}. Down: ${down.join(', ')}.`, by: WRITERS[4] });
    const a = sm.awards;
    if (a.poty) { const p = P(a.poty); post({ tag: 'league', pid: p.id, title: `${pn(p)} is Player of the Season`, body: `${p.st.g} goals, ${p.st.a} assists, avg rating ${(p.st.rat / Math.max(1, p.st.gp)).toFixed(2)}.`, by: WRITERS[2] }); }
    if (a.boot) { const p = P(a.boot); post({ tag: 'league', pid: p.id, title: `Golden Boot: ${pn(p)} (${p.st.g} goals)`, body: `${p.ln} finishes as the most prolific scorer in the four leagues.`, by: WRITERS[4] }); }
    const u = L.user(), pos = sm.user.pos;
    thread(`Season ${G.season} verdict: ${U.ord(pos)} place`, 'club', fan(u, pos <= 2 ? 'Greatest season of my life.' : pos >= 11 ? 'Write it off and rebuild.' : 'Progress. Mostly.'), [fan(u, 'Rate the manager out of 10.'), fan(u, U.pick(['8. Tactics on point.', '5. Too many experiments.', '10. Legend.', '3. Clueless.']))]);
  }
  function event(title, body, tag = 'club') { post({ tag, tid: G.userTeamId, title, body, by: WRITERS[1] }); }

  return { welcome, seasonPreview, weekly, matchReport, roundUp, transfer, windowOpens, windowCloses, leftOnFree, coachSacked, coachHired, coachPoached, userHired, promoted, debut, retire, cupDraw, cupWinner, contWinner, invitational, seasonEnd, event, compName, thread, fan, neutral, handle };
})();
