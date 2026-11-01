'use strict';
// ── HUB: home, squad (first team / academy / scouting), player pages, the market ──

(() => {
  const { S, A, SCREENS, I, esc } = UI;
  const P = id => G.players[id];
  const T = id => G.teams[id];

  SCREENS.hub = () => {
    if (G.sacked) return SCREENS.sacked();
    const body = { home, squad, tactics: () => SCREENS.tacticsBody(), market, league: () => SCREENS.leagueBody(), feed: () => SCREENS.feedBody() }[S.tab] || home;
    return `<div class="screen">${hubTop()}${body()}${UI.tabbar()}</div>`;
  };
  function hubTop() {
    const u = L.user(), unread = G.inbox.filter(m => !m.done && !m.read).length;
    return `<header class="topbar">${UI.crest(u, 34)}<div class="title">${esc(u.name)}<div class="sub">${L.dateStr()} · Season ${G.season} · <span class="money ${u.fin.bal < 0 ? 'bad' : ''}">${U.money(u.fin.bal)}</span></div></div><button class="icon-btn" data-a="inbox">${I.inbox}${unread ? `<span class="dot">${unread}</span>` : ''}</button><button class="icon-btn" data-a="club">${I.club}</button></header>`;
  }

  // ════════ HOME ════════
  function home() {
    const u = L.user();
    return `<div class="scroll">${heroCard(u)}${nextCard()}${lastResultCard()}${calStrip()}${challengeCard()}${inboxPreview()}${boardCard()}${miniTable()}${newsTeaser()}</div>`;
  }
  function heroCard(u) {
    const pos = L.position(u.id), lg = L.league(L.tableLg(u.id)), lrec = (G.table[lg.id] || {})[u.id] || { pts: 0 }, rec = L.seasonRecord(u.id);
    return `<div class="hero" style="${UI.teamVars(u)}"><div class="hcrest">${UI.crest(u, 170)}</div>
      <div class="kicker" style="color:rgba(255,255,255,.72)">${esc(lg.name)} · ${DATA.CLUB_IDS[u.ident].icon} ${esc(DATA.CLUB_IDS[u.ident].name)}</div>
      <div class="nm">${esc(u.name)}</div><div class="sub">${esc(G.mgr.name)} · ${DATA.COACH_IDS[G.mgr.ident].icon} ${esc(DATA.COACH_IDS[G.mgr.ident].name)}</div>
      <div class="hero-stats"><div><b>${pos ? U.ord(pos) : '–'}</b><span>Position</span></div><div><b>${lrec.pts}</b><span>League pts</span></div><div><b>${rec.w}-${rec.d}-${rec.l}</b><span>W-D-L · all</span></div><div><b>${Math.round(L.teamLevel(u))}</b><span>Squad</span></div></div>
      <div class="flex between mt8">${UI.form(u.form)}<span class="tiny" style="color:rgba(255,255,255,.8)">${u.stadium.cap.toLocaleString()} seats</span></div></div>`;
  }
  function vsBlock(f) {
    const h = T(f.h), a = T(f.a);
    return `<div class="vs"><div class="side">${UI.crest(h, 56)}<b>${esc(h.name)}</b><span class="tiny muted">${f.comp === 'L' ? U.ord(L.position(h.id)) : esc(L.league(h.leagueId).short)}</span></div><div class="mid">VS<small>${esc(UI.compLabel(f))}${f.rd && f.comp !== 'L' ? ` ${esc(L.CUP_NAMES[f.rd] || f.rd)}` : f.comp === 'L' ? ` R${f.rd}` : ''}</small></div><div class="side">${UI.crest(a, 56)}<b>${esc(a.name)}</b><span class="tiny muted">${f.comp === 'L' ? U.ord(L.position(a.id)) : esc(L.league(a.leagueId).short)}</span></div></div>`;
  }
  function nextCard() {
    if (G.phase === 'post') {
      return `<div class="next"><div class="kicker">Season ${G.season} is over</div><div class="big mt4">Season review</div><p class="small muted">Final tables, awards, promotions and relegations — and the board's verdict.</p><button class="btn primary big block" data-a="review">Open season review</button></div>`;
    }
    const pend = L.pending();
    if (pend && pend.kind === 'match') {
      const f = pend.f;
      return `<div class="next"><div class="flex between"><span class="kicker"><span class="pulse-dot"></span> Matchday · ${esc(UI.compName(f))}</span>${UI.wxChip(f.wx)}</div>${vsBlock(f)}<div class="grid2"><button class="btn primary big" data-a="prematch">${I.play} Play</button><button class="btn big" data-a="quickSim">${I.ff} Sim</button></div></div>`;
    }
    if (pend && pend.kind === 'acad') {
      const f = pend.f;
      return `<div class="next"><div class="kicker">${I.grad.replace('<svg', '<svg style="display:inline;width:14px;height:14px;vertical-align:-2px"')} Academy League · 5-a-side</div>${vsBlock(f)}<div class="grid2"><button class="btn primary" data-a="watchAcad">${I.eye} Watch the kids</button><button class="btn" data-a="simAcad">${I.ff} Auto-play</button></div></div>`;
    }
    const nf = L.nextUserFixture();
    const today = L.todays().filter(f => !f.done && f.comp !== 'A').length;
    return `<div class="next"><div class="flex between"><span class="kicker">${L.dateStr()}${L.windowOpen() ? ' · <span class="good">Window open</span>' : ''}</span><span class="tiny muted">${today ? `${today} games today` : 'No games today'}</span></div>
      ${nf ? `<div class="flex mt8" style="gap:8px"><span class="small muted">Next:</span>${UI.crest(T(nf.h === G.userTeamId ? nf.a : nf.h), 24)}<b class="small">${nf.h === G.userTeamId ? 'vs' : '@'} ${esc(T(nf.h === G.userTeamId ? nf.a : nf.h).name)}</b><span class="tiny muted">in ${nf.day - G.day} day${nf.day - G.day === 1 ? '' : 's'} · ${esc(UI.compLabel(nf))}</span></div>` : ''}
      <div class="grid2 mt12"><button class="btn primary big" data-a="advance">Next day</button><button class="btn big" data-a="skip">${I.ff} To next match</button></div></div>`;
  }
  // the most recent result, always from the user's side of the scoreline
  function lastResultCard() {
    const f = L.lastUserFixture();
    if (!f) return '';
    const u = L.user(), home = f.h === u.id, opp = T(home ? f.a : f.h);
    const us = home ? f.hs : f.as, them = home ? f.as : f.hs, r = L.resultFor(f, u.id);
    const col = r === 'W' ? 'var(--good)' : r === 'D' ? '#94a3b8' : 'var(--bad)', word = r === 'W' ? 'WIN' : r === 'D' ? 'DRAW' : 'LOSS';
    const scorers = (f.ev || []).filter(e => e.t === 'goal' && e.s === (home ? 0 : 1) && e.p && G.players[e.p]).map(e => `${esc(G.players[e.p].ln)} ${e.m}'`);
    return `<div class="card tap" data-a="boxScore" data-v="${f.id}" style="border-color:${col}"><div class="flex between"><span class="kicker">Last result · ${esc(UI.compName(f))}</span><span class="tag" style="background:${col};color:#0b0f17">${word}</span></div>
      <div class="flex mt8" style="gap:10px">${UI.crest(u, 38)}<div class="big" style="color:${col}">${us} – ${them}</div>${UI.crest(opp, 38)}<div class="grow"><div class="bold small">${home ? 'vs' : '@'} ${esc(opp.name)}</div><div class="tiny muted">${f.pens ? `${home ? f.pens[0] : f.pens[1]}-${home ? f.pens[1] : f.pens[0]} on penalties · ` : ''}${scorers.length ? scorers.slice(0, 4).join(', ') : L.dateStr(f.day, true)}</div></div></div></div>`;
  }
  function calStrip() {
    const days = [];
    for (let d = G.day; d < G.day + 12 && d <= DATA.SEASON.LEN; d++) {
      const fx = L.todays(d).filter(f => f.h === G.userTeamId || f.a === G.userTeamId);
      const main = fx.find(f => f.comp !== 'A'), ac = fx.find(f => f.comp === 'A');
      let ev = '';
      if (main) { const opp = T(main.h === G.userTeamId ? main.a : main.h); ev = UI.crest(opp, 20); }
      else if (ac) ev = '🎓';
      else if (d === DATA.SEASON.END) ev = '🏁';
      else if (L.windowOpen(d)) ev = '<span class="tiny good">⇄</span>';
      const dt = L.dateStr(d, true).split(' ');
      days.push(`<div class="d${d === G.day ? ' today' : ''}"><div class="dn">${dt[0]}</div><div class="dd">${dt[1]}</div><div class="ev">${ev}</div></div>`);
    }
    return `<div class="card tight"><div class="cal">${days.join('')}</div><div class="tiny dim mt4">⇄ transfer window · 🎓 academy · crest = match</div></div>`;
  }
  function challengeCard() {
    const st = Career.challengeStatus();
    if (!st) return '';
    const ch = st.ch;
    return `<div class="card" style="border-color:rgba(251,146,60,.4)"><h3>${ch.icon} Owner challenge <span class="grow"></span>${G.challenge.done ? '<span class="tag t-good">Complete</span>' : G.challenge.failed ? '<span class="tag t-bad">Failed</span>' : '<span class="tag t-warn">In progress</span>'}</h3><div class="bold">${esc(ch.name)}</div><div class="small muted">${esc(ch.desc)}</div><div class="small mt8">${esc(st.text)}</div></div>`;
  }
  function inboxPreview() {
    const open = G.inbox.filter(m => !m.done && m.actions && m.actions.length).slice(0, 3);
    const fresh = G.inbox.filter(m => !m.read && !(m.actions && m.actions.length)).slice(0, 2);
    const list = [...open, ...fresh];
    if (!list.length) return '';
    return `<div class="card"><h3>${I.inbox.replace('<svg', '<svg style="width:16px;height:16px"')} Inbox<span class="grow"></span><button class="btn xs" data-a="inbox">All</button></h3>${list.map(msgHTML).join('')}</div>`;
  }
  function msgHTML(m) {
    const icon = { trade: '🔄', bid: '💰', event: '⚡', acad: '🎓', scout: '🔭', injury: '🩹', contract: '📝', job: '💼', board: '🏛️', showcase: '🌟', unrest: '😤' }[m.type] || '✉️';
    return `<div class="msg${m.read ? '' : ' unread'}"><div class="mt"><span>${icon}</span><span class="grow">${esc(m.title)}</span><span class="tiny dim">${L.dateStr(m.day, true)}</span></div>${m.body ? `<div class="mb">${esc(m.body)}</div>` : ''}${!m.done && m.actions ? `<div class="acts">${m.actions.map((a, i) => `<button class="btn xs ${i === 0 ? 'primary' : a.danger ? 'danger' : ''}" data-a="msgAct" data-v="${m.id}:${i}">${esc(a.label)}</button>`).join('')}</div>` : ''}${m.result ? `<div class="res">${esc(m.result)}</div>` : ''}</div>`;
  }
  function boardCard() {
    const obj = G.board.obj, c = G.board.conf;
    if (!obj) return '';
    const pos = L.position(G.userTeamId);
    return `<div class="card"><h3>🏛️ The board<span class="grow"></span><span class="tag ${c >= 60 ? 't-good' : c >= 30 ? 't-warn' : 't-bad'}">${c >= 70 ? 'Delighted' : c >= 50 ? 'Content' : c >= 30 ? 'Concerned' : 'Furious'}</span></h3>
      <div class="flex between small"><span>Objective: <b>${esc(obj.label)}</b></span><span class="${pos <= obj.pos ? 'good' : 'bad'}">${pos ? U.ord(pos) : '–'}</span></div>
      <div class="prog mt8"><i style="width:${c}%;background:${c < 30 ? 'var(--bad)' : c < 50 ? 'var(--warn)' : 'var(--good)'}"></i></div><div class="tiny dim mt4">Confidence ${c}/100${c < 20 ? ' · your job is at risk' : ''}</div></div>`;
  }
  function miniTable() {
    const u = L.user(), lgId = L.tableLg(u.id), tb = L.table(lgId), i = Math.max(0, tb.findIndex(r => r.tid === u.id));
    const lo = U.clamp(i - 2, 0, Math.max(0, tb.length - 5)), rows = tb.slice(lo, lo + 5);
    return `<div class="card"><h3>${esc(L.league(lgId).name)}<span class="grow"></span><button class="btn xs" data-a="tab" data-v="league:table">Table</button></h3><table class="tbl"><tr><th>#</th><th class="l">Club</th><th>P</th><th>GD</th><th>Pts</th></tr>${rows.map(r => `<tr class="${r.tid === u.id ? 'me' : ''}"><td>${tb.indexOf(r) + 1}</td><td class="l"><span class="tm">${UI.crest(T(r.tid), 20)}${esc(T(r.tid).name)}</span></td><td>${r.p}</td><td>${r.gd > 0 ? '+' : ''}${r.gd}</td><td class="pts">${r.pts}</td></tr>`).join('')}</table></div>`;
  }
  function newsTeaser() {
    const n = G.news.slice(0, 3);
    if (!n.length) return '';
    return `<div class="card"><h3>📰 Latest<span class="grow"></span><button class="btn xs" data-a="tab" data-v="feed:news">Feed</button></h3>${n.map(a => `<div class="news tap" data-a="article" data-v="${a.id}">${a.tid != null && T(a.tid) ? UI.crest(T(a.tid), 30) : '<div class="av" style="background:var(--surface-3)">📰</div>'}<div class="grow"><span class="ntag ${a.tag}">${a.tag}</span><div class="nt mt4">${esc(a.title)}</div></div></div>`).join('')}</div>`;
  }

  // ── day flow ──
  A.advance = () => {
    const pend = L.pending();
    if (pend) return handlePending(pend);
    const before = G.day;
    L.advanceDay();
    Sfx.play('advance');
    dayToast(before);
    UI.render();
  };
  A.skip = () => {
    const before = G.day;
    let n = 0;
    while (n++ < 30) {
      if (L.pending()) break;
      if (G.phase !== 'season') break;
      const blocking = G.inbox.some(m => !m.done && m.day === G.day && (m.type === 'event' || m.type === 'job' || m.type === 'showcase') && m.actions && m.actions.length);
      if (blocking && G.day !== before) break;
      L.advanceDay();
      if (G.sacked) break;
    }
    Sfx.play('advance');
    dayToast(before);
    UI.render();
  };
  function dayToast(before) {
    const fresh = G.inbox.filter(m => !m.done && m.day > before && m.actions && m.actions.length);
    if (fresh.length) UI.toast(`✉️ ${fresh.length} new item${fresh.length > 1 ? 's' : ''} need your attention`);
    if (G.phase === 'post' && before < DATA.SEASON.END) UI.toast('🏁 The season is over! Open the season review.');
  }
  function handlePending(p) {
    if (p.kind === 'match') return A.prematch();
    if (p.kind === 'acad') return acadPrompt(p.f);
    if (p.kind === 'post') return A.review();
  }
  function acadPrompt(f) {
    UI.sheet(`<h2>Academy match day</h2><p class="small muted">Your U18s play a 5-a-side Academy League game today.</p>${vsBlock(f)}<div class="grid2"><button class="btn primary" data-a="watchAcad">${I.eye} Watch</button><button class="btn" data-a="simAcad">Auto-play</button></div>`);
  }
  A.simAcad = () => {
    UI.closeSheet();
    const f = L.userAcadFixture();
    if (!f) return;
    if (!Play.enough(f)) { f.skip = true; UI.toast('Not enough academy players for a 5-a-side — match forfeited.'); L.save(); UI.render(); return; }
    const { res } = Play.quick(f);
    const side = f.h === G.userTeamId ? 0 : 1;
    UI.toast(`🎓 Academy: ${esc(T(f.h).abbr)} ${res.score[0]}-${res.score[1]} ${esc(T(f.a).abbr)}${res.score[side] > res.score[1 - side] ? ' — win!' : ''}`);
    UI.render();
  };
  A.msgAct = v => {
    const [id, i] = v.split(':').map(Number);
    const out = Career.act(id, i);
    L.save();
    if (out && out.nav === 'player') { A.player(out.v); return; }
    if (out && out.nav === 'tab') { A.tab(out.v); return; }
    if (out && out.text) UI.toast(esc(out.text));
    if (out && out.nav === 'home') { UI.closeSheet(); UI.go('hub', { tab: 'home' }); return; }
    if (S.sheetOpen === 'inbox') A.inbox(); else UI.render();
  };
  A.inbox = () => {
    for (const m of G.inbox) if (!m.actions || !m.actions.length || m.done) m.read = true;
    UI.sheet(`<h2>Inbox</h2>${G.inbox.length ? G.inbox.slice(0, 40).map(msgHTML).join('') : '<div class="empty">Nothing yet.</div>'}`, { id: 'inbox', refresh: () => A.inbox() });
    UI.render && setTimeout(() => { if (S.screen === 'hub') { const tb = document.querySelector('.tabbar'); if (tb) tb.outerHTML = UI.tabbar(); } }, 50);
  };

  // ════════ SQUAD ════════
  function squad() {
    const sub = S.sub.squad;
    return `<div class="scroll">${UI.seg('squad', [['first', 'First Team'], ['acad', 'Academy'], ['scout', 'Scouting']])}${sub === 'acad' ? academy() : sub === 'scout' ? scouting() : firstTeam()}</div>`;
  }
  const POS_ORDER = DATA.POS;
  function firstTeam() {
    const u = L.user(), all = L.squad(u);
    const f = S.filters.pos;
    let list = all.filter(p => f === 'ALL' || DATA.POS_GROUP[p.pos] === f);
    const sort = S.filters.sort;
    list.sort(sort === 'pos' ? (a, b) => POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos) || b.ovr - a.ovr : sort === 'age' ? (a, b) => a.age - b.age : sort === 'value' ? (a, b) => L.value(b) - L.value(a) : sort === 'form' ? (a, b) => U.avg(b.form) - U.avg(a.form) : (a, b) => b.ovr - a.ovr);
    const wages = L.payroll(u);
    const xi = new Set(u.tac.lineup);
    return `<div class="kv mb12"><div><b>${all.length}</b><span>Players</span></div><div><b>${Math.round(U.avg(all.map(p => p.ovr)))}</b><span>Avg OVR</span></div><div><b>${U.wage(wages).replace('/wk', '')}</b><span>Wages / wk</span></div></div>
      <div class="card tight"><div class="flex between"><div><div class="bold small">Training intensity</div><div class="tiny muted">Harder = faster growth, slower recovery, more knocks</div></div></div><div class="opts mt8">${['light', 'normal', 'hard'].map(x => `<button class="${G.train === x ? 'on' : ''}" data-a="setTrain" data-v="${x}">${x[0].toUpperCase() + x.slice(1)}</button>`).join('')}</div></div>
      <div class="chips">${['ALL', 'GK', 'DEF', 'MID', 'FWD'].map(x => `<button class="chip${f === x ? ' on' : ''}" data-a="filtPos" data-v="${x}">${x === 'ALL' ? 'All' : x}</button>`).join('')}<span style="width:8px"></span>${[['ovr', 'OVR'], ['pos', 'Position'], ['age', 'Age'], ['value', 'Value'], ['form', 'Form']].map(([k, l]) => `<button class="chip${sort === k ? ' on' : ''}" data-a="sortBy" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="card tight list">${list.map(p => UI.playerRow(p, { meta: `${p.age} · ${xi.has(p.id) ? '<b class="good">XI</b> · ' : ''}${p.st.gp ? `${p.st.gp} gp · ${p.st.g}g ${p.st.a}a · ${(p.st.rat / p.st.gp).toFixed(1)}` : 'no games yet'}`, mid: UI.fitBar(p) })).join('')}</div>`;
  }
  A.setTrain = v => { G.train = v; L.save(); UI.render(); };
  A.filtPos = v => { S.filters.pos = v; UI.render(); };
  A.sortBy = v => { S.filters.sort = v; UI.render(); };

  // ── academy ──
  function academy() {
    const u = L.user(), kids = L.academy().sort((a, b) => b.pot - a.pot);
    const yc = G.staff.yth != null ? G.coaches[G.staff.yth] : null;
    const at = L.acadTableRows(), pos = at.findIndex(r => r.tid === u.id) + 1;
    const next = G.fixtures.filter(f => f.comp === 'A' && !f.done && (f.h === u.id || f.a === u.id)).sort((a, b) => a.day - b.day)[0];
    const last = G.fixtures.filter(f => f.comp === 'A' && f.done && (f.h === u.id || f.a === u.id)).sort((a, b) => b.day - a.day)[0];
    return `<div class="kv mb12"><div><b>${'★'.repeat(u.acad.level)}</b><span>Academy</span></div><div><b>${pos ? U.ord(pos) : '–'}</b><span>U18 league</span></div><div><b>${kids.length}</b><span>Prospects</span></div></div>
      <div class="card tight"><div class="flex">${yc ? Art.coachFace(yc, 40) : '<div class="av" style="background:var(--surface-3)">?</div>'}<div class="grow"><div class="bold small">${yc ? `${esc(yc.fn)} ${esc(yc.ln)}` : 'No youth coach'}</div><div class="tiny muted">Youth coach ${yc ? `· rating ${yc.rating}` : '— hire one in Club → Staff'}</div></div><button class="btn xs" data-a="clubTab" data-v="facilities">Upgrade</button></div></div>
      ${next ? `<div class="card tight"><div class="flex between"><span class="kicker">Next U18 game</span><span class="tiny muted">${L.dateStr(next.day, true)}</span></div><div class="flex mt8">${UI.crest(T(next.h), 26)}<b class="small grow">${esc(T(next.h).abbr)} v ${esc(T(next.a).abbr)}</b>${UI.crest(T(next.a), 26)}</div></div>` : ''}
      ${last ? `<div class="card tight"><div class="flex between"><span class="kicker">Last U18 result</span><button class="btn xs" data-a="replayAcad" data-v="${last.id}">${I.eye} Watch replay</button></div><div class="flex mt8">${UI.crest(T(last.h), 24)}<b class="grow small">${esc(T(last.h).abbr)} ${last.hs}-${last.as} ${esc(T(last.a).abbr)}</b>${UI.crest(T(last.a), 24)}</div></div>` : ''}
      <p class="tiny muted">Set each prospect's training plan to steer his growth toward a role. Players can join the first team from age 17, and must be promoted or released at 19.</p>
      <div class="card tight list">${kids.length ? kids.map(p => { const r = TAC.ROLES[p.focus]; return UI.playerRow(p, { act: 'kid', meta: `${p.age} yrs · POT <b>${U.potGrade(p.pot)}</b> · ${r ? `🎯 ${esc(r.name)}` : 'no plan'}`, right: `<span class="ovr ${U.ovrClass(p.ovr)}">${p.ovr}</span>` }); }).join('') : '<div class="empty">The academy is empty. Scout for youth prospects, or wait for the next intake.</div>'}</div>`;
  }
  A.kid = pid => kidSheet(+pid);
  function kidSheet(pid) {
    const p = P(pid);
    if (!p) return;
    UI.sheet(`${pcard(p)}${hallmarksHTML(p)}${devPanel(p)}
      <div class="grid2 mt12"><button class="btn primary ${p.age < 17 ? 'off' : ''}" data-a="promoteKid" data-v="${pid}">${p.age < 17 ? `Promote at 17` : 'Promote to first team'}</button><button class="btn danger" data-a="releaseKid" data-v="${pid}">Release</button></div>`, { vars: UI.teamVars(L.user()), refresh: () => kidSheet(pid) });
  }
  // ── development plan: a position to grow into, a role inside it, and what that does to his growth ──
  function outlookCard(p) {
    const g = L.growthInfo(p);
    const pct = x => `${Math.round(U.clamp(x, 0, 1) * 100)}%`;
    const col = g.net >= 3.5 ? 'var(--good)' : g.net >= 1.5 ? 'var(--accent)' : g.net > 0.3 ? 'var(--warn)' : 'var(--bad)';
    const factor = (label, v, max, txt) => `<div class="attr" style="grid-template-columns:96px 1fr 58px"><span class="small">${label}</span><div class="bar"><i style="width:${pct(v / max)}"></i></div><b class="small" style="font-size:12.5px">${txt}</b></div>`;
    return `<div class="card"><h3>📈 Growth outlook<span class="grow"></span><span class="tag" style="background:${col};color:#0b0f17">${g.label}</span></h3>
      <div class="flex between"><div><div class="big" style="color:${col}">${g.net >= 0 ? '+' : ''}${g.net.toFixed(1)}</div><div class="tiny muted">overall per season (est.)</div></div><div class="right"><div class="bold small">${esc(g.phase)}</div><div class="tiny muted">age ${p.age} · ${p.ovr} → potential ${U.potGrade(p.pot)} (${p.pot})</div></div></div>
      <div class="prog mt8" title="Progress toward potential"><i style="width:${pct(p.ovr / Math.max(1, p.pot))}"></i></div>
      <div class="mt8">${factor('Age curve', g.ageF, 0.62, `${Math.round((g.ageF / 0.62) * 100)}%`)}${factor('Potential gap', g.potF, 1.8, `${Math.max(0, p.pot - p.ovr)} left`)}${factor('Coaching &amp; minutes', g.mult, 2, `×${g.mult.toFixed(2)}`)}</div>
      <p class="tiny dim" style="margin:6px 0 0">Growth is fastest under 20 and stops around 27–28; the further he is from his potential (and the higher it is), the quicker he climbs. Coaching, training intensity, minutes and personality multiply it.${g.decline > 0.2 ? ` From 30 he loses about ${g.decline.toFixed(1)} a season, mostly pace and stamina.` : ''}</p></div>`;
  }
  function devPanel(p) {
    const g = L.growthInfo(p), target = g.pos, gkOnly = p.pos === 'GK';
    const positions = DATA.POS.filter(x => (x === 'GK') === gkOnly);
    const posChip = x => {
      const nat = x === p.pos, alt = (p.alt || []).includes(x), on = x === target;
      const wk = nat ? 0 : L.retrainWeeks(p, x);
      return `<button class="chip${on ? ' on' : ''}" data-a="devPos" data-v="${p.id}:${x}">${nat ? '★ ' : alt ? '✓ ' : ''}${x}${nat ? '' : ` <span class="tiny" style="opacity:.7">${wk}w</span>`}</button>`;
    };
    const roles = TAC.rolesFor(target);
    const focus = TAC.ROLES[p.focus] && TAC.ROLES[p.focus].slots.includes(target) ? TAC.ROLES[p.focus] : null;
    const retraining = target !== p.pos;
    return `${outlookCard(p)}
      <div class="kicker mb8">1 · Position</div><p class="tiny muted" style="margin-top:-2px">★ natural · ✓ secondary. Pick a new one and he retrains week by week (younger players learn faster), then switches to it for good. His growth follows the position he's training for.</p>
      <div class="chips" style="flex-wrap:wrap">${positions.map(posChip).join('')}</div>
      ${retraining ? `<div class="card tight"><div class="flex between small"><span>🔄 Retraining <b>${p.pos} → ${target}</b> (${esc(DATA.POS_NAME[target])})</span><span class="muted">${Math.round(g.progress * 100)}% · ~${Math.max(1, Math.ceil(g.weeks * (1 - g.progress)))} wks left</span></div><div class="prog mt8"><i style="width:${g.progress * 100}%"></i></div><div class="tiny dim mt4">Would rate ${L.calcOvr(p, target)} there today · ${Math.round(TAC.fam(p, target) * 100)}% comfortable · growth slowed 15% while learning</div></div>` : ''}
      <div class="kicker mt12 mb8">2 · Role</div><p class="tiny muted" style="margin-top:-2px">60% of his growth goes into the role's three key attributes; the rest follows the ${target} position.</p>
      ${roles.map(r => { const rr = L.roleRating(p, r.id, target); return `<button class="rolefit${focus && focus.id === r.id ? ' on' : ''}" style="width:100%;text-align:left" data-a="devRole" data-v="${p.id}:${r.id}"><div><div class="bold small">${esc(r.name)} <span class="tag">${r.short}</span></div><div class="tiny muted">${r.keys.map(k => DATA.ATTR_NAME[k]).join(' · ')}</div></div><span class="ovr ${U.ovrClass(rr)}">${rr}</span></button>`; }).join('')}
      ${hmTrainPanel(p)}
      <div class="kicker mt12 mb8">Projected over a season</div>${attrsHTML(p, focus ? focus.keys : [], g.proj)}`;
  }
  function planLine(p) {
    const g = L.growthInfo(p), r = TAC.ROLES[p.focus];
    return `<button class="card tight mt8" data-a="focusSheet" data-v="${p.id}" style="width:100%;text-align:left;display:block"><div class="flex between"><div class="small">🎯 <b>${g.pos !== p.pos ? `Retraining → ${g.pos}` : p.pos}</b> · ${r ? esc(r.name) : 'no role set'}</div><span class="tag ${g.net >= 1.5 ? 't-good' : g.net > 0.3 ? 't-warn' : 't-bad'}">${g.label} ${g.net >= 0 ? '+' : ''}${g.net.toFixed(1)}/season</span></div></button>`;
  }
  A.devPos = v => { const [pid, pos] = v.split(':'); L.setPlan(+pid, pos); UI.refreshSheet(); UI.render(); };
  A.devRole = v => { const [pid, r] = v.split(':'); L.setPlan(+pid, null, r); UI.refreshSheet(); UI.render(); };
  A.promoteKid = v => { const p = P(+v); if (L.promote(+v)) { UI.closeSheet(); UI.toast(`🎓 ${esc(p.fn)} ${esc(p.ln)} joins the first team!`); UI.render(); } };
  A.releaseKid = v => { const p = P(+v); UI.confirm('Release prospect?', `${esc(p.fn)} ${esc(p.ln)} leaves the academy for good.`, 'Release', () => { L.releaseAcademy(+v); UI.render(); }, true); };

  // ── scouting ──
  function scouting() {
    const scouts = G.staff.sct.map(id => G.coaches[id]).filter(Boolean);
    const youth = G.scout.youth.map(P).filter(p => p && p.tid === -3);
    const targets = G.scout.targets.map(P).filter(p => p && p.tid >= 0 && p.tid !== G.userTeamId);
    return `<div class="card"><h3>${I.scope.replace('<svg', '<svg style="width:16px;height:16px"')} Scouts<span class="grow"></span><button class="btn xs" data-a="clubTab" data-v="staff">Hire</button></h3>
      ${scouts.length ? scouts.map(c => { const job = G.scout.jobs.find(j => j.cid === c.id); return `<div class="row">${Art.coachFace(c, 40)}<div class="grow"><div class="nm">${esc(c.fn)} ${esc(c.ln)}</div><div class="meta">Rating ${c.rating}${job ? ` · ${esc(L.REGIONS.find(r => r.id === job.region).name)} (${job.focus})` : ' · available'}</div>${job ? `<div class="prog mt4"><i style="width:${(1 - job.days / job.total) * 100}%"></i></div>` : ''}</div>${job ? `<span class="tiny muted">${job.days}d</span>` : `<button class="btn xs primary" data-a="assignScout" data-v="${c.id}">Send</button>`}</div>`; }).join('') : '<div class="empty">No scouts. Hire one in Club → Staff.</div>'}</div>
      <div class="card"><h3>🌱 Youth prospects found</h3>${youth.length ? youth.map(p => UI.playerRow(p, { meta: `${p.age} · ${esc(p.nat)} · POT <b>${UI.potTxt(p)}</b>`, right: `<button class="btn xs primary" data-a="signYouth" data-v="${p.id}">Sign ${U.money(p.fee)}</button>` })).join('') : '<div class="empty small">Send a scout on a youth trip to find wonderkids.</div>'}</div>
      <div class="card"><h3>🎯 Recommended targets</h3>${targets.length ? targets.map(p => UI.playerRow(p, { right: `<div class="right">${UI.ovrB(p)}<div class="tiny muted">${U.money(L.value(p))}</div></div>` })).join('') : '<div class="empty small">Send a scout on a senior trip for recommendations.</div>'}</div>`;
  }
  A.assignScout = cid => {
    S.scoutPick = { cid: +cid, region: L.user().nation, focus: 'youth' };
    scoutSheet();
  };
  function scoutSheet() {
    const sp = S.scoutPick;
    UI.sheet(`<h2>Scouting trip</h2><div class="kicker mb8">Where</div>${L.REGIONS.map(r => `<button class="pick${sp.region === r.id ? ' on' : ''}" data-a="scoutRegion" data-v="${r.id}">${r.id === 'world' ? '🌍' : Art.flag(DATA.NATIONS[r.id].name, 28)}<div class="grow"><div class="pt">${esc(r.name)}</div></div></button>`).join('')}
      <div class="kicker mt12 mb8">Looking for</div><div class="opts"><button class="${sp.focus === 'youth' ? 'on' : ''}" data-a="scoutFocus" data-v="youth">Youth prospects</button><button class="${sp.focus === 'senior' ? 'on' : ''}" data-a="scoutFocus" data-v="senior">First-team targets</button></div>
      <button class="btn primary block mt12" data-a="startScout">Send · ${U.money(L.scoutCost(sp.region, sp.focus))}</button>`, { refresh: scoutSheet });
  }
  A.scoutRegion = v => { S.scoutPick.region = v === 'world' ? 'world' : +v; UI.refreshSheet(); };
  A.scoutFocus = v => { S.scoutPick.focus = v; UI.refreshSheet(); };
  A.startScout = () => { const sp = S.scoutPick; if (L.startScouting(sp.cid, sp.region, sp.focus)) { UI.closeSheet(); UI.toast('🔭 Scout dispatched'); UI.render(); } else UI.toast('Not enough money for the trip.'); };
  A.signYouth = v => { const p = P(+v); if (L.signYouth(+v)) { Career.check(); UI.toast(`🌱 ${esc(p.fn)} ${esc(p.ln)} joins the academy`); UI.render(); } else UI.toast('Not enough money.'); };

  // ════════ PLAYER PAGE ════════
  function pcard(p) {
    const t = p.tid >= 0 && T(p.tid) ? T(p.tid) : null;
    const k = L.knowledge(p);
    const v = L.seenOvr(p);
    return `<div class="pcard" style="${t ? UI.teamVars(t) : '--team-1:#334155;--team-2:#94a3b8'}"><div class="num">${p.num || ''}</div><div class="flex" style="align-items:flex-start">${UI.face(p, 76)}<div class="grow"><div class="flex" style="gap:5px">${UI.posB(p.pos)}${(p.alt || []).map(UI.posB).join('')}</div><div class="pn mt4">${esc(p.fn)}<br>${esc(p.ln)}</div><div class="small" style="opacity:.85">${Art.flag(p.nat, 16)} ${esc(p.nat)} · ${p.age} yrs · ${p.foot === 'L' ? 'Left' : 'Right'} foot</div></div><div class="center">${v.exact ? `<span class="ovr lg ${U.ovrClass(p.ovr)}">${p.ovr}</span>` : `<span class="ovr lg scout" style="color:#fff;font-size:15px">${v.lo}-${v.hi}</span>`}<div class="tiny mt4" style="opacity:.8">POT ${UI.potTxt(p)}</div></div></div>
      <div class="flex mt8" style="gap:6px;flex-wrap:wrap">${t ? `<span class="tag" style="background:rgba(0,0,0,.3);color:#fff">${UI.crest(t, 14)} ${esc(t.name)}</span>` : p.tid === -1 ? '<span class="tag t-good">Free agent</span>' : p.tid === -3 ? '<span class="tag t-acc">Scouted prospect</span>' : ''}${p.acad ? '<span class="tag t-acc">Academy</span>' : ''}<span class="tag" style="background:rgba(0,0,0,.3);color:#fff">${esc(DATA.PERSONALITIES[p.pers] ? DATA.PERSONALITIES[p.pers].name : p.pers)}</span>${k < 3 ? `<span class="tag t-warn">Scouted ${k}/3</span>` : ''}</div></div>`;
  }
  function attrsHTML(p, keys = [], proj = null) {
    const k = L.knowledge(p);
    if (k < 2) return `<div class="card tight center"><div class="small muted">Attributes unknown. Scout him for a full report.</div>${p.tid !== G.userTeamId ? `<button class="btn sm mt8" data-a="scoutPlayer" data-v="${p.id}">${I.scope} Scout · ${U.money(0.03)}</button>` : ''}</div>`;
    const fuzz = k < 3;
    const groups = DATA.ATTR_GROUPS.filter(g => g.id !== 'gk' || p.pos === 'GK');
    return `<div class="card tight">${groups.map(g => `<div class="kicker mt4 mb8">${g.label}</div>${g.keys.map(key => { let v = p.a[DATA.AK[key]]; if (fuzz) v = Math.round(v / 5) * 5; const gain = proj ? proj[DATA.AK[key]] : 0; return `<div class="attr${keys.includes(key) ? ' key' : ''}"${proj ? ' style="grid-template-columns:92px 1fr 62px"' : ''}><span>${DATA.ATTR_NAME[key]}</span><div class="bar" style="position:relative"><i class="${U.ovrClass(v)}" style="width:${v}%"></i>${gain > 0 ? `<i style="position:absolute;top:0;left:${v}%;width:${gain}%;background:var(--good);opacity:.55"></i>` : ''}</div><b>${fuzz ? '~' : ''}${v}${proj ? ` <span class="tiny ${gain > 0 ? 'good' : 'dim'}" style="font-family:var(--f-body)">${gain > 0 ? `+${gain}` : '·'}</span>` : ''}</b></div>`; }).join('')}`).join('')}</div>`;
  }
  // ── hallmarks: what he's known for, and what he's working on ──
  function hmChip(id, lvl) {
    const h = DATA.HM[id];
    return h ? `<button class="hmchip${lvl === 2 ? ' elite' : ''}" data-a="hmInfo" data-v="${id}:${lvl}"><span>${h.icon}</span>${esc(h.name)}${lvl === 2 ? ' ★' : ''}</button>` : '';
  }
  function hallmarksHTML(p) {
    const mine = p.tid === G.userTeamId, k = L.knowledge(p), ids = Object.keys(p.hm || {});
    const head = `<div class="kicker mt12 mb8">Hallmarks <span class="dim">· ${ids.length}/${Math.max(ids.length, L.hmSlots(p))}</span></div>`;
    if (!mine && k < 2) return `${head}<div class="card tight small muted">${ids.length ? `${ids.length} hallmark${ids.length > 1 ? 's' : ''}: scout him to find out which.` : 'None that the scouts have heard of.'}</div>`;
    const order = DATA.HM_GROUPS.map(g => g[0]);
    ids.sort((a, b) => p.hm[b] - p.hm[a] || order.indexOf(DATA.HM[a].g) - order.indexOf(DATA.HM[b].g));
    const tr = p.hmTrain && DATA.HM[p.hmTrain.id];
    return `${head}<div class="hmwrap">${ids.length ? ids.map(id => hmChip(id, p.hm[id])).join('') : '<span class="small muted">No hallmarks yet.</span>'}</div>
      ${tr && mine ? `<div class="tiny muted mt8">🏋️ Training: <b>${tr.icon} ${esc(tr.name)}${p.hm[tr.id] ? ' ★' : ''}</b> · ${Math.round(p.hmTrain.prog * 100)}%</div>` : ''}`;
  }
  A.hmInfo = v => { const [id, lvl] = v.split(':'), h = DATA.HM[id]; if (h) UI.toast(`${h.icon} <b>${esc(h.name)}${lvl === '2' ? ' ★ Elite' : ''}</b>: ${esc(lvl === '2' ? h.elite : h.desc)}`); };
  function hmTrainPanel(p) {
    const cands = L.hmCandidates(p), tr = p.hmTrain;
    const reqTxt = (h, lvl) => Object.keys(h.req).map(k => { const need = h.req[k] + (lvl ? DATA.HM_ELITE : 0), have = p.a[DATA.AK[k]]; return `<span class="${have >= need ? 'good' : 'warn'}">${DATA.ATTR_SHORT[k]} ${have}/${need}</span>`; }).join(' · ');
    return `<div class="kicker mt12 mb8">3 · Hallmark training</div><p class="tiny muted" style="margin-top:-2px">Pick one hallmark to work on. Progress builds week by week (training intensity speeds it up), and part of his growth goes into the attributes it needs. It lands once both are complete.${L.hmSlots(p) <= Object.keys(p.hm || {}).length ? ' His hallmark slots are full, so he can only master the ones he has.' : ''}</p>
      ${cands.length ? cands.map(({ h, lvl, weeks }) => { const on = tr && tr.id === h.id; return `<button class="rolefit${on ? ' on' : ''}" style="width:100%;text-align:left" data-a="hmTrain" data-v="${p.id}:${h.id}"><div><div class="bold small">${h.icon} ${lvl ? 'Master ' : ''}${esc(h.name)}${lvl ? ' ★' : ''}</div><div class="tiny muted">${esc(lvl ? h.elite : h.desc)}</div><div class="tiny mt4">${reqTxt(h, lvl)}</div>${on ? `<div class="prog mt4"><i style="width:${Math.round(tr.prog * 100)}%"></i></div>` : ''}</div><span class="tiny muted">${on ? `${Math.round(tr.prog * 100)}%` : `~${weeks}w`}</span></button>`; }).join('') : '<div class="card tight small muted">Nothing within reach yet: his attributes need to grow first.</div>'}`;
  }
  A.hmTrain = v => { const [pid, id] = v.split(':'); L.setHmTrain(+pid, id); UI.refreshSheet(); };
  function rolesHTML(p) {
    const roles = TAC.rolesFor(p.pos).map(r => ({ r, v: L.roleRating(p, r.id) })).sort((a, b) => b.v - a.v).slice(0, 4);
    const max = roles[0] ? roles[0].v : 1;
    return `<div class="kicker mb8">Best roles</div>${roles.map(({ r, v }) => `<div class="rolefit"><div><div class="bold small">${esc(r.name)}</div><div class="tiny muted">${esc(r.desc)}</div></div><div class="center"><span class="ovr ${U.ovrClass(v)}">${v}</span><div class="stars">${'★'.repeat(Math.max(1, Math.round(5 - (max - v) / 2)))}</div></div></div>`).join('')}`;
  }
  A.player = pid => playerSheet(+pid);
  function playerSheet(pid) {
    const p = P(pid);
    if (!p) { UI.toast('Player not found.'); return; }
    if (p.acad && p.tid === G.userTeamId) return kidSheet(pid);
    const mine = p.tid === G.userTeamId, t = p.tid >= 0 ? T(p.tid) : null;
    const st = p.st, avg = st.gp ? (st.rat / st.gp).toFixed(2) : '–';
    const val = L.value(p), k = L.knowledge(p);
    const short = G.shortlist.includes(pid);
    let actions = '';
    if (mine) {
      actions = `<div class="grid2"><button class="btn" data-a="renewSheet" data-v="${pid}">📝 Contract</button><button class="btn" data-a="toggleList" data-v="${pid}">${p.listed ? 'Unlist' : '🏷️ Transfer list'}</button></div><div class="grid2 mt8"><button class="btn" data-a="focusSheet" data-v="${pid}">🎯 Development</button><button class="btn danger" data-a="releaseP" data-v="${pid}">Release</button></div>`;
    } else if (p.tid === -3) {
      actions = `<button class="btn primary block" data-a="signYouth" data-v="${pid}">Sign to academy · ${U.money(p.fee)}</button>`;
    } else {
      actions = `<div class="grid2"><button class="btn primary" data-a="offerSheet" data-v="${pid}">${p.tid === -1 ? 'Offer contract' : 'Make an offer'}</button><button class="btn" data-a="toggleShort" data-v="${pid}">${short ? '★ Shortlisted' : '☆ Shortlist'}</button></div>${k < 3 ? `<button class="btn block mt8" data-a="scoutPlayer" data-v="${pid}">${I.scope} Scout him (${U.money(0.03)}, 3 days)</button>` : ''}`;
    }
    UI.sheet(`${pcard(p)}
      <div class="kv mb12"><div><b>${k >= 2 || mine ? U.money(val) : '?'}</b><span>Value</span></div><div><b>${U.wage(p.wage).replace('/wk', '')}</b><span>Wage/wk</span></div><div><b>${p.tid === -1 ? 'Free' : `${p.yrs}y`}</b><span>Contract</span></div><div><b>${p.mor}</b><span>Morale</span></div><div><b>${p.fit}%</b><span>Fitness</span></div><div><b>${p.inj > 0 ? `${p.inj}d` : p.ban > 0 ? `Ban ${p.ban}` : 'Fit'}</b><span>Status</span></div></div>
      ${actions}
      ${mine ? planLine(p) : ''}
      <div class="kicker mt12 mb8">This season</div><div class="kv mb12"><div><b>${st.gp}</b><span>Games</span></div><div><b>${st.g}</b><span>Goals</span></div><div><b>${st.a}</b><span>Assists</span></div><div><b>${avg}</b><span>Avg rating</span></div><div><b>${st.motm}</b><span>MOTM</span></div><div><b>${st.hits || 0}</b><span>Big hits</span></div></div>
      ${rolesHTML(p)}
      ${hallmarksHTML(p)}
      ${attrsHTML(p, p.focus && TAC.ROLES[p.focus] ? TAC.ROLES[p.focus].keys : [])}
      ${p.hist && p.hist.length ? `<div class="kicker mt12 mb8">History</div><table class="tbl"><tr><th class="l">Season</th><th class="l">Club</th><th>GP</th><th>G</th><th>A</th><th>Rtg</th></tr>${p.hist.map(h => `<tr><td class="l">S${h.s}</td><td class="l">${T(h.tid) ? esc(T(h.tid).abbr) : '—'}</td><td>${h.gp}</td><td>${h.g}</td><td>${h.a}</td><td>${h.rat}</td></tr>`).join('')}</table>` : ''}
      <div class="tiny dim mt12">${esc(DATA.PERSONALITIES[p.pers] ? DATA.PERSONALITIES[p.pers].desc : '')} Career: ${p.car.gp} games, ${p.car.g} goals.${p.awards && p.awards.length ? ` 🏅 ${p.awards.map(a => ({ boot: 'Golden Boot', poty: 'Player of the Season', young: 'Young Player' }[a.k] + ` S${a.s}`)).join(', ')}` : ''}</div>`,
      { vars: t ? UI.teamVars(t) : '', refresh: () => playerSheet(pid) });
  }
  A.toggleShort = v => { const id = +v; G.shortlist = G.shortlist.includes(id) ? G.shortlist.filter(x => x !== id) : [...G.shortlist, id]; L.save(); UI.refreshSheet(); };
  A.toggleList = v => { const p = P(+v); p.listed = !p.listed; L.save(); UI.toast(p.listed ? `${esc(p.ln)} is on the transfer list` : `${esc(p.ln)} taken off the list`); UI.refreshSheet(); };
  A.scoutPlayer = v => { if (L.scoutPlayer(+v)) UI.toast('🔭 Report in 3 days'); else UI.toast('Already being scouted, or not enough money.'); };
  A.releaseP = v => { const p = P(+v); if (!L.canLose()) { UI.toast(esc(L.squadFloorWhy())); return; } const pay = +((p.wage * 52 * Math.max(0, p.yrs) * 0.5) / 1000).toFixed(2); UI.confirm(`Release ${p.ln}?`, `You'll pay a settlement of ${U.money(pay)} and he becomes a free agent.`, 'Release', () => { if (L.release(+v) == null) UI.toast(esc(L.squadFloorWhy())); else UI.toast(`${esc(p.ln)} released`); UI.render(); }, true); };
  A.focusSheet = v => {
    const p = P(+v);
    UI.sheet(`<h2>Development plan</h2><div class="flex mb12">${UI.face(p, 48)}<div class="grow"><div class="bold">${esc(p.fn)} ${esc(p.ln)}</div><div class="small muted">${UI.posB(p.pos)} ${p.age} yrs · ${p.ovr} overall</div></div><button class="btn xs" data-a="player" data-v="${p.id}">Profile</button></div>${devPanel(p)}`, { vars: UI.teamVars(L.user()), refresh: () => A.focusSheet(v) });
  };

  // ── contracts ──
  A.renewSheet = v => contractSheet(+v, 'renew');
  function contractSheet(pid, mode, fee = 0, give = []) {
    const p = P(pid), demand = L.wageDemand(p);
    S.contract = S.contract && S.contract.pid === pid && S.contract.mode === mode ? S.contract : { pid, mode, wage: demand, yrs: p.age > 30 ? 2 : 4, fee, give };
    const c = S.contract;
    const room = L.wageRoom() + (mode === 'renew' ? p.wage : 0);
    UI.sheet(`<h2>${mode === 'renew' ? 'New contract' : 'Personal terms'}</h2><div class="flex mb12">${UI.face(p, 48)}<div class="grow"><div class="bold">${esc(p.fn)} ${esc(p.ln)}</div><div class="small muted">Asks for ${U.wage(demand)} · currently ${U.wage(p.wage)}</div></div></div>
      <div class="kicker">Weekly wage: <b class="money" style="color:var(--text);font-size:16px">${U.wage(c.wage)}</b></div><input type="range" min="${Math.max(1, Math.round(demand * 0.6))}" max="${Math.round(demand * 1.6)}" value="${c.wage}" data-in="cWage">
      <div class="kicker mt12">Length</div><div class="opts mt4">${[1, 2, 3, 4, 5].map(y => `<button class="${c.yrs === y ? 'on' : ''}" data-a="cYrs" data-v="${y}">${y} yr${y > 1 ? 's' : ''}</button>`).join('')}</div>
      <div class="small mt12 ${c.wage - (mode === 'renew' ? 0 : 0) > room ? 'bad' : 'muted'}">Wage room: ${U.wage(Math.max(0, room))}${c.wage > room ? ' — over budget; the board will grumble and your margins shrink' : ''}</div>
      ${fee ? `<div class="small muted">Transfer fee agreed: <b>${U.money(fee)}</b>${give.length ? ` + ${give.map(id => esc(P(id).ln)).join(', ')}` : ''}</div>` : ''}
      <button class="btn primary block mt12" data-a="cSubmit">Offer contract</button>`, { refresh: () => contractSheet(pid, mode, fee, give) });
  }
  A.cWage = v => { S.contract.wage = +v; const el = document.querySelector('.sheet .kicker b'); if (el) el.textContent = U.wage(+v); };
  A.cYrs = v => { S.contract.yrs = +v; UI.refreshSheet(); };
  A.cSubmit = () => {
    const c = S.contract, p = P(c.pid), demand = L.wageDemand(p);
    const keen = c.mode === 'renew' ? (p.wantsOut ? 0.4 : p.pers === 'loyal' ? 1 : 0.85) : L.willingness(p);
    const need = demand * (c.mode === 'renew' ? 0.92 : 0.95) * (1 + (1 - keen) * 0.6) * (c.yrs >= 4 && p.age > 29 ? 0.94 : 1);
    if (keen < 0.2 && c.mode !== 'renew') { UI.toast(`${esc(p.ln)} isn't interested in joining a club at your level.`); S.contract = null; UI.closeSheet(); return; }
    if (c.wage < need) { Sfx.play('error'); UI.toast(`${esc(p.ln)}'s agent: "We're not there yet."`); return; }
    if (c.mode === 'renew') { L.renew(c.pid, c.wage, c.yrs); p.wantsOut = false; UI.toast(`📝 ${esc(p.ln)} signs a new ${c.yrs}-year deal`); S.contract = null; UI.closeSheet(); UI.render(); return; }
    const res = L.completeSigning(c.pid, c.fee, c.give, c.wage, c.yrs);
    S.contract = null;
    if (!res.ok) { UI.toast(esc(res.why)); return; }
    Sfx.play('cash');
    UI.closeSheet();
    UI.toast(`✍️ ${esc(p.fn)} ${esc(p.ln)} signs for ${esc(L.user().name)}!`, 'ach', 3000);
    UI.render();
  };

  // ── offers & trades ──
  A.offerSheet = v => { S.offer = { pid: +v, fee: null, give: [] }; offerSheet(); };
  function offerSheet() {
    const o = S.offer, p = P(o.pid);
    if (p.tid === -1) { contractSheet(o.pid, 'free'); return; }
    const t = T(p.tid), ask = L.askingPrice(p), bal = L.user().fin.bal;
    if (o.fee == null) o.fee = +Math.min(Math.max(0, bal), ask * 0.9).toFixed(2);
    const mine = L.squad(L.user()).sort((a, b) => b.ovr - a.ovr);
    const giveVal = o.give.reduce((s, id) => s + L.value(P(id)), 0);
    UI.sheet(`<h2>Offer for ${esc(p.ln)}</h2><div class="flex mb12">${UI.crest(t, 36)}<div class="grow small">${esc(t.name)} value him at about <b>${L.knowledge(p) >= 2 ? U.money(ask) : '?'}</b>${!L.windowOpen() ? '<div class="bad tiny">The window is closed: clubs won\'t sell until it opens.</div>' : ''}</div></div>
      <div class="kicker">Transfer fee: <b class="money" id="feeLbl" style="color:var(--text);font-size:16px">${U.money(o.fee)}</b> <span class="tiny muted">(bank ${U.money(bal)})</span></div>
      <input type="range" min="0" max="${Math.max(1, Math.ceil(Math.max(ask * 1.6, 1) * 10))}" value="${Math.round(o.fee * 10)}" data-in="offerFee">
      <div class="kicker mt12 mb8">Add players to the deal (trade)</div><p class="tiny muted" style="margin-top:-4px">They value players who fill a need at their level. Selected: ${o.give.length ? `${o.give.length} (~${U.money(giveVal)})` : 'none'}</p>
      <div class="chips" style="flex-wrap:wrap">${mine.slice(0, 26).map(q => `<button class="chip${o.give.includes(q.id) ? ' on' : ''}" data-a="offerGive" data-v="${q.id}">${q.pos} ${esc(q.ln)} ${q.ovr}</button>`).join('')}</div>
      <button class="btn primary block mt12" data-a="offerSubmit">Submit offer</button>`, { refresh: offerSheet });
  }
  A.offerFee = v => { S.offer.fee = +(v / 10).toFixed(1); const el = document.getElementById('feeLbl'); if (el) el.textContent = U.money(S.offer.fee); };
  A.offerGive = v => { const id = +v, o = S.offer; o.give = o.give.includes(id) ? o.give.filter(x => x !== id) : [...o.give, id]; UI.refreshSheet(); };
  A.offerSubmit = () => {
    const o = S.offer, p = P(o.pid);
    if (o.fee > L.user().fin.bal + 0.001) { UI.toast('You can\'t afford that fee.'); return; }
    const r = L.evalOffer(o.pid, o.fee, o.give);
    if (r.ok) { Sfx.play('cash'); UI.toast(`✅ ${esc(r.why)} Now agree personal terms.`); contractSheet(o.pid, 'transfer', o.fee, o.give); return; }
    if (r.counter != null) {
      UI.sheet(`<h2>Counter-offer</h2><p class="small">${esc(r.why)} They'd take <b>${U.money(Math.max(0, r.counter))}</b>${o.give.length ? ' plus the players offered' : ''}.</p><div class="grid2"><button class="btn" data-a="close">Walk away</button><button class="btn primary" data-a="acceptCounter" data-v="${Math.max(0, r.counter)}">Pay ${U.money(Math.max(0, r.counter))}</button></div>`);
      return;
    }
    Sfx.play('error');
    UI.toast(esc(r.why), '', 3400);
  };
  A.acceptCounter = v => { const o = S.offer; if (+v > L.user().fin.bal) { UI.toast('You can\'t afford that.'); return; } o.fee = +v; contractSheet(o.pid, 'transfer', o.fee, o.give); };

  // ════════ MARKET ════════
  function market() {
    const sub = S.sub.market, open = L.windowOpen();
    const win = DATA.SEASON.WINDOWS.find(([a, b]) => G.day >= a && G.day <= b);
    const nextWin = DATA.SEASON.WINDOWS.find(([a]) => a > G.day);
    const banner = `<div class="card tight" style="border-color:${open ? 'rgba(34,197,94,.4)' : 'var(--line)'}"><div class="flex between"><div><div class="bold small">${open ? '🟢 Transfer window open' : '🔴 Window closed'}</div><div class="tiny muted">${open ? `Closes ${L.dateStr(win[1], true)} (${win[1] - G.day} days)` : nextWin ? `Opens ${L.dateStr(nextWin[0], true)} · free agents can sign any time` : 'Opens next summer · free agents can sign any time'}</div></div><div class="right"><div class="tiny muted">Bank</div><b class="money">${U.money(L.user().fin.bal)}</b></div></div></div>`;
    const body = { search: marketSearch, short: shortlist, free: freeAgents, sell: selling }[sub] || marketSearch;
    return `<div class="scroll">${UI.seg('market', [['search', 'Search'], ['short', 'Shortlist'], ['free', 'Free agents'], ['sell', 'Selling']])}${banner}${body()}</div>`;
  }
  function marketSearch() {
    const f = S.filters, lgs = G.leagues;
    const maxP = f.maxPrice || 0;
    let list = Object.values(G.players).filter(p => p.tid >= 0 && !p.acad && p.tid !== G.userTeamId);
    if (f.market !== 'ALL') list = list.filter(p => DATA.POS_GROUP[p.pos] === f.market || p.pos === f.market);
    if (S.leagueFilter != null) list = list.filter(p => T(p.tid).leagueId === S.leagueFilter);
    if (maxP) list = list.filter(p => L.value(p) <= maxP);
    const key = f.sort === 'value' ? p => -L.value(p) : f.sort === 'age' ? p => p.age : f.sort === 'pot' ? p => -(L.knowledge(p) >= 3 ? p.pot : L.seenOvr(p).mid + 5) : p => -L.seenOvr(p).mid;
    list.sort((a, b) => key(a) - key(b));
    return `<div class="chips">${['ALL', 'GK', 'DEF', 'MID', 'FWD', ...DATA.POS.filter(x => x !== 'GK')].map(x => `<button class="chip${f.market === x ? ' on' : ''}" data-a="mPos" data-v="${x}">${x === 'ALL' ? 'All' : x}</button>`).join('')}</div>
      <div class="chips"><button class="chip${S.leagueFilter == null ? ' on' : ''}" data-a="mLg" data-v="">All leagues</button>${lgs.map(l => `<button class="chip${S.leagueFilter === l.id ? ' on' : ''}" data-a="mLg" data-v="${l.id}">${esc(l.name)}</button>`).join('')}</div>
      <div class="chips">${[['ovr', 'Best'], ['value', 'Value'], ['age', 'Youngest'], ['pot', 'Potential']].map(([k, l]) => `<button class="chip${f.sort === k ? ' on' : ''}" data-a="mSort" data-v="${k}">${l}</button>`).join('')}${[0, 2, 5, 10, 25].map(x => `<button class="chip${maxP === x ? ' on' : ''}" data-a="mMax" data-v="${x}">${x ? `≤ ${U.money(x)}` : 'Any price'}</button>`).join('')}</div>
      <div class="card tight list">${list.slice(0, 50).map(p => UI.playerRow(p, { right: `<div class="right">${UI.ovrB(p)}<div class="tiny muted">${L.knowledge(p) >= 2 ? U.money(L.value(p)) : '?'}</div></div>` })).join('') || '<div class="empty">No players match.</div>'}</div><p class="tiny dim center">Ratings shown as ranges until your scouts know a player. Players in your own league are partly known.</p>`;
  }
  A.mPos = v => { S.filters.market = v; UI.render(); };
  A.mLg = v => { S.leagueFilter = v === '' ? null : +v; UI.render(); };
  A.mSort = v => { S.filters.sort = v; UI.render(); };
  A.mMax = v => { S.filters.maxPrice = +v; UI.render(); };
  function shortlist() {
    const list = G.shortlist.map(P).filter(p => p && p.tid !== G.userTeamId);
    return `<div class="card tight list">${list.length ? list.map(p => UI.playerRow(p, { right: `<div class="right">${UI.ovrB(p)}<div class="tiny muted">${U.money(L.value(p))}</div></div>` })).join('') : '<div class="empty">Tap ☆ Shortlist on any player to track him here.</div>'}</div>`;
  }
  function freeAgents() {
    const list = G.fa.map(P).filter(Boolean).sort((a, b) => b.ovr - a.ovr);
    return `<p class="tiny muted">No fee — just agree wages. Free agents can be signed outside the window.</p><div class="card tight list">${list.slice(0, 60).map(p => UI.playerRow(p, { meta: `${p.age} · ${esc(p.nat)} · asks ${U.wage(L.wageDemand(p))}`, right: UI.ovrB(p) })).join('')}</div>`;
  }
  function selling() {
    const mine = L.squad(L.user());
    const listed = mine.filter(p => p.listed);
    const bids = G.inbox.filter(m => m.type === 'bid' && !m.done);
    return `<div class="card"><h3>💰 Bids received</h3>${bids.length ? bids.map(msgHTML).join('') : '<div class="empty small">No bids right now. Listed players attract more interest during the window.</div>'}</div>
      <div class="card"><h3>🏷️ Transfer list</h3>${listed.length ? listed.map(p => UI.playerRow(p, { right: `<div class="right">${UI.ovrB(p)}<div class="tiny muted">${U.money(L.value(p))}</div></div>` })).join('') : '<div class="empty small">Nobody is listed. Open a player and tap "Transfer list".</div>'}</div>`;
  }
})();
