'use strict';
// ── LEAGUE, FEED, CLUB, SEASON REVIEW ─────────────────────────────

(() => {
  const { S, A, SCREENS, I, esc } = UI;
  const P = id => G.players[id];
  const T = id => G.teams[id];

  // ════════ LEAGUE ════════
  SCREENS.leagueBody = () => {
    const sub = S.sub.league;
    const body = { table: tableView, fixtures: fixturesView, cups: cupsView, acad: acadView, stats: statsView, world: worldView }[sub] || tableView;
    return `<div class="scroll">${UI.seg('league', [['table', 'Table'], ['fixtures', 'Fixtures'], ['cups', 'Cups'], ['acad', 'U18'], ['stats', 'Stats'], ['world', 'World']])}${body()}</div>`;
  };
  function lgPick() {
    const cur = S.leagueView != null ? S.leagueView : L.user().leagueId;
    return `<div class="chips">${G.leagues.map(l => `<button class="chip${cur === l.id ? ' on' : ''}" data-a="lgView" data-v="${l.id}">${Art.flag(DATA.NATIONS[l.nation].name, 14)} ${esc(l.name)}</button>`).join('')}</div>`;
  }
  A.lgView = v => { S.leagueView = +v; UI.render(); };
  function tableView() {
    const id = S.leagueView != null ? S.leagueView : L.user().leagueId, lg = L.league(id), tb = L.table(id);
    return `${lgPick()}<div class="card tight"><table class="tbl"><tr><th>#</th><th class="l">Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr>
      ${tb.map((r, i) => { const t = T(r.tid); const zone = lg.tier === 0 ? (i < 2 ? 'cont' : i >= tb.length - 2 ? 'down' : '') : i < 2 ? 'up' : ''; return `<tr class="${r.tid === G.userTeamId ? 'me' : ''} ${zone}" data-a="teamSheet" data-v="${r.tid}"><td>${i + 1}</td><td class="l"><span class="tm">${UI.crest(t, 22)}<span class="ellip" style="max-width:120px">${esc(t.name)}</span></span></td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gd > 0 ? '+' : ''}${r.gd}</td><td class="pts">${r.pts}</td></tr>`; }).join('')}</table>
      <div class="flex wrap tiny muted mt8" style="gap:12px">${lg.tier === 0 ? '<span><b style="color:#38bdf8">▍</b> Continental places</span><span><b class="bad">▍</b> Relegation</span>' : '<span><b class="good">▍</b> Promotion</span>'}</div></div>`;
  }
  function fixturesView() {
    const id = S.leagueView != null ? S.leagueView : L.user().leagueId;
    const all = G.fixtures.filter(f => f.comp === 'L' && f.lg === id);
    const maxR = Math.max(1, ...all.map(f => f.rd));
    const cur = all.filter(f => !f.done).sort((a, b) => a.rd - b.rd)[0];
    const rd = U.clamp(S.fxRound || (cur ? cur.rd : maxR), 1, maxR);
    const list = all.filter(f => f.rd === rd);
    const mine = G.fixtures.filter(f => f.comp !== 'A' && (f.h === G.userTeamId || f.a === G.userTeamId)).sort((a, b) => a.day - b.day);
    return `${lgPick()}<div class="card"><div class="flex between mb8"><button class="icon-btn" data-a="fxRound" data-v="${rd - 1}">${I.back}</button><div class="center"><div class="bold">Round ${rd}</div><div class="tiny muted">${list[0] ? L.dateStr(list[0].day) : ''}</div></div><button class="icon-btn" data-a="fxRound" data-v="${rd + 1}" style="transform:scaleX(-1)">${I.back}</button></div>
      ${list.map(fxRow).join('')}</div>
      <div class="card"><h3>Your season</h3>${mine.map(fxRow).join('')}</div>`;
  }
  function fxRow(f) {
    const h = T(f.h), a = T(f.a), me = f.h === G.userTeamId || f.a === G.userTeamId;
    return `<div class="row ${f.done ? 'tap' : ''} ${me ? 'me' : ''}" ${f.done ? `data-a="boxScore" data-v="${f.id}"` : ''} style="min-height:44px"><span class="tag" style="min-width:34px;justify-content:center">${esc(UI.compLabel(f))}</span><span class="grow flex" style="justify-content:flex-end;gap:6px"><b class="small ellip">${esc(h.abbr)}</b>${UI.crest(h, 22)}</span><b style="font-family:var(--f-display);min-width:54px;text-align:center">${f.done ? `${f.hs} - ${f.as}` : L.dateStr(f.day, true)}</b><span class="grow flex" style="gap:6px">${UI.crest(a, 22)}<b class="small ellip">${esc(a.abbr)}</b></span>${f.pens ? `<span class="tiny muted">p${f.pens[0]}-${f.pens[1]}</span>` : ''}${me && f.done ? (r => `<span class="form"><i class="${r}">${r}</i></span>`)(L.resultFor(f, G.userTeamId)) : ''}</div>`;
  }
  A.fxRound = v => { S.fxRound = +v; UI.render(); };
  A.boxScore = v => {
    const f = G.fixtures.find(x => x.id === +v);
    if (!f) return;
    const h = T(f.h), a = T(f.a);
    const ev = (f.ev || []).slice().sort((x, y) => x.m - y.m);
    const icon = { goal: '⚽', red: '🟥', injury: '🩹', pen: '🎯' };
    UI.sheet(`<div class="kicker center">${esc(UI.compName(f))}</div><div class="vs"><div class="side">${UI.crest(h, 56)}<b>${esc(h.name)}</b></div><div class="mid" style="color:var(--text);font-size:38px">${f.hs}-${f.as}${f.pens ? `<small>${f.pens[0]}-${f.pens[1]} pens</small>` : ''}</div><div class="side">${UI.crest(a, 56)}<b>${esc(a.name)}</b></div></div>
      <div class="center mb12">${UI.wxChip(f.wx)}${f.att ? ` · <span class="tiny muted">${f.att.toLocaleString()} fans</span>` : ''}</div>
      ${ev.length ? ev.map(e => { const p = P(e.p); return `<div class="flex" style="justify-content:${e.s === 0 ? 'flex-start' : 'flex-end'};padding:5px 0"><span class="tiny muted">${e.m}'</span><span>${icon[e.t] || '•'}</span><span class="small">${p ? esc(p.ln) : '?'}${e.a && P(e.a) ? ` <span class="muted">(${esc(P(e.a).ln)})</span>` : ''}</span></div>`; }).join('') : '<div class="empty small">No key events recorded.</div>'}
      ${f.motm && P(f.motm) ? `<div class="center small mt12">⭐ Player of the match: <b>${esc(P(f.motm).fn)} ${esc(P(f.motm).ln)}</b></div>` : ''}`);
  };
  function bracket(rounds, order, names) {
    return order.filter(r => rounds[r]).map(r => `<div class="kicker mt12 mb8">${esc(names[r] || r)}</div><div class="bracket">${rounds[r].map(id => G.fixtures.find(f => f.id === id)).filter(Boolean).map(f => { const w = f.done ? L.winnerOf(f) : null; const me = f.h === G.userTeamId || f.a === G.userTeamId; return `<div class="tie${me ? ' me' : ''}" ${f.done ? `data-a="boxScore" data-v="${f.id}"` : ''}><span class="flex ${w === f.h ? 'w' : ''}" style="gap:6px">${UI.crest(T(f.h), 20)}${esc(T(f.h).abbr)}</span><b style="font-family:var(--f-display)">${f.done ? `${f.hs}-${f.as}${f.pens ? '*' : ''}` : L.dateStr(f.day, true)}</b><span class="flex ${w === f.a ? 'w' : ''}" style="gap:6px;justify-content:flex-end">${esc(T(f.a).abbr)}${UI.crest(T(f.a), 20)}</span></div>`; }).join('')}</div>`).join('');
  }
  function cupsView() {
    const n = S.cupNation != null ? S.cupNation : L.user().nation;
    const cup = G.cups[n];
    return `<div class="chips">${DATA.NATIONS.map(x => `<button class="chip${n === x.id ? ' on' : ''}" data-a="cupNation" data-v="${x.id}">${esc(x.cup)}</button>`).join('')}</div>
      <div class="card"><h3>🥇 ${esc(DATA.NATIONS[n].cup)}${cup && cup.winner != null ? `<span class="grow"></span><span class="tag t-good">${esc(T(cup.winner).name)}</span>` : ''}</h3>${cup ? bracket(cup.rounds, ['R1', 'R16', 'QF', 'SF', 'F'], L.CUP_NAMES) : ''}<div class="tiny dim mt8">* decided on penalties</div></div>
      <div class="card"><h3>🌍 ${esc(DATA.CONTINENTAL)}${G.cont && G.cont.winner != null ? `<span class="grow"></span><span class="tag t-good">${esc(T(G.cont.winner).name)}</span>` : ''}</h3><p class="tiny muted">The top two of each top flight from last season. Huge prize money.</p>${G.cont ? bracket(G.cont.rounds, ['QF', 'SF', 'F'], L.CUP_NAMES) : ''}</div>
      <div class="card"><h3>☀️ ${esc(DATA.INVITATIONAL)}</h3>${G.inv ? bracket(G.inv.rounds, ['SF', 'F', 'P'], { SF: 'Semi-finals', F: 'Final', P: 'Third place' }) : ''}</div>`;
  }
  A.cupNation = v => { S.cupNation = +v; UI.render(); };
  function acadView() {
    const rows = L.acadTableRows();
    const mine = G.fixtures.filter(f => f.comp === 'A' && (f.h === G.userTeamId || f.a === G.userTeamId)).sort((a, b) => a.day - b.day);
    return `<p class="tiny muted">The Academy League: 5-a-side games between the U18 sides of your division, the day before each league round. Played games can be re-watched.</p>
      <div class="card tight"><table class="tbl"><tr><th>#</th><th class="l">U18 side</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr>${rows.map((r, i) => `<tr class="${r.tid === G.userTeamId ? 'me' : ''}"><td>${i + 1}</td><td class="l"><span class="tm">${UI.crest(T(r.tid), 20)}${esc(T(r.tid).abbr)}</span></td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gd > 0 ? '+' : ''}${r.gd}</td><td class="pts">${r.pts}</td></tr>`).join('')}</table></div>
      <div class="card"><h3>Our U18 fixtures</h3>${mine.map(f => `<div class="row ${f.done ? 'tap' : ''}" ${f.done ? `data-a="replayAcad" data-v="${f.id}"` : ''} style="min-height:44px"><span class="tiny muted" style="min-width:44px">${L.dateStr(f.day, true)}</span><span class="grow flex" style="justify-content:flex-end;gap:6px"><b class="small">${esc(T(f.h).abbr)}</b>${UI.crest(T(f.h), 20)}</span><b style="font-family:var(--f-display);min-width:44px;text-align:center">${f.done ? `${f.hs}-${f.as}` : 'v'}</b><span class="grow flex" style="gap:6px">${UI.crest(T(f.a), 20)}<b class="small">${esc(T(f.a).abbr)}</b></span>${f.done ? I.eye.replace('<svg', '<svg style="width:16px;height:16px;opacity:.6"') : ''}</div>`).join('')}</div>`;
  }
  function statsView() {
    const id = S.leagueView != null ? S.leagueView : L.user().leagueId;
    const pool = Object.values(G.players).filter(p => p.tid >= 0 && !p.acad && T(p.tid) && T(p.tid).leagueId === id);
    const top = (fn, n = 8, filt = () => true) => pool.filter(filt).sort((a, b) => fn(b) - fn(a)).slice(0, n);
    const block = (title, list, fn, fmt = x => x) => `<div class="card"><h3>${title}</h3>${list.map((p, i) => UI.playerRow(p, { meta: `${i + 1}. ${esc(T(p.tid).name)}`, right: `<b style="font-family:var(--f-display);font-size:20px">${fmt(fn(p))}</b>` })).join('') || '<div class="empty small">No games yet.</div>'}</div>`;
    return `${lgPick()}${block('⚽ Golden Boot', top(p => p.st.g), p => p.st.g)}${block('🅰️ Assists', top(p => p.st.a), p => p.st.a)}${block('⭐ Average rating (5+ games)', top(p => p.st.rat / p.st.gp, 8, p => p.st.gp >= 5), p => p.st.rat / p.st.gp, x => x.toFixed(2))}${block('💥 Big hits', top(p => p.st.hits || 0), p => p.st.hits || 0)}${block('🧤 Clean sheets', top(p => p.st.cs, 6, p => p.pos === 'GK'), p => p.st.cs)}`;
  }
  function worldView() {
    const hist = G.history.slice().reverse();
    const coachNews = G.news.filter(n => n.tag === 'coach').slice(0, 8);
    const myLg = L.league(L.user().leagueId);
    const coaches = myLg.teams.map(T).filter(t => t.coach != null && G.coaches[t.coach]).map(t => ({ t, c: G.coaches[t.coach] }));
    return `<div class="card"><h3>🧠 Managers in the ${esc(myLg.name)}</h3><p class="tiny muted" style="margin-top:-6px">A manager's philosophy follows him to every club — and decides how his team plays.</p>${coaches.map(({ t, c }) => `<div class="row tap" data-a="coachSheet" data-v="${c.id}">${Art.coachFace(c, 38)}<div class="grow"><div class="nm">${esc(c.fn)} ${esc(c.ln)}</div><div class="meta">${UI.crest(t, 14).replace('<svg', '<svg style="display:inline;vertical-align:-2px"')} ${esc(t.abbr)} · ${DATA.COACH_IDS[c.ident].icon} ${esc(DATA.COACH_IDS[c.ident].name)} · ${c.w}-${c.d}-${c.l}</div></div><span class="tag">${c.rating}</span></div>`).join('')}</div>
      <div class="card"><h3>🔄 Managerial merry-go-round</h3>${coachNews.length ? coachNews.map(n => `<div class="news"><div class="grow"><div class="nt small">${esc(n.title)}</div><div class="by">${L.dateStr(n.d, true)} · S${n.s}</div></div></div>`).join('') : '<div class="empty small">No sackings… yet.</div>'}</div>
      <div class="card"><h3>📜 Roll of honour</h3>${hist.length ? hist.map(h => `<div class="kicker mt8 mb8">Season ${h.season}</div>${h.leagues.map(l => `<div class="flex small" style="padding:3px 0">${UI.crest(T(l.champ), 18)}<b>${esc(T(l.champ).name)}</b><span class="muted">· ${esc(L.league(l.lg).name)}</span></div>`).join('')}<div class="tiny muted mt4">⬆ ${h.promoted.map(id => esc(T(id).abbr)).join(', ')} · ⬇ ${h.relegated.map(id => esc(T(id).abbr)).join(', ')}</div>`).join('') : '<div class="empty small">History is written at the end of the season.</div>'}</div>`;
  }
  A.coachSheet = v => {
    const c = G.coaches[+v], id = DATA.COACH_IDS[c.ident];
    UI.sheet(`<div class="flex mb12">${Art.coachFace(c, 64)}<div class="grow"><h2>${esc(c.fn)} ${esc(c.ln)}</h2><div class="small muted">${Art.flag(c.nat, 14)} ${esc(c.nat)} · ${c.age} · rating ${c.rating} · rep ${c.rep}</div></div></div>
      <div class="card"><div class="bold">${id.icon} ${esc(id.name)}</div><div class="small muted">${esc(id.desc)}</div><div class="tiny dim mt4">Plays a ${id.oop} · favourite roles: ${(id.roles || []).slice(0, 4).map(r => TAC.ROLES[r].short).join(' · ') || 'balanced roles'}</div></div>
      <div class="kv"><div><b>${c.w}</b><span>Won</span></div><div><b>${c.d}</b><span>Drawn</span></div><div><b>${c.l}</b><span>Lost</span></div></div>
      <div class="kicker mt12 mb8">Career</div>${c.tid >= 0 ? `<div class="small">Now: <b>${esc(T(c.tid).name)}</b> since season ${c.since}</div>` : '<div class="small muted">Out of work</div>'}${(c.hist || []).map(h => `<div class="small muted">S${h.s0}–S${h.s1}: ${esc(T(h.tid).name)}${h.sacked ? ' (sacked)' : ''}</div>`).join('')}<div class="small mt4">🏆 ${c.trophies} trophies</div>`);
  };
  A.teamSheet = v => {
    const t = T(+v), sq = L.squad(t).sort((a, b) => b.ovr - a.ovr), c = t.coach != null ? G.coaches[t.coach] : null;
    const r = (G.table[L.tableLg(t.id)] || {})[t.id];
    UI.sheet(`<div class="hero" style="${UI.teamVars(t)}"><div class="hcrest">${UI.crest(t, 160)}</div><div class="kicker" style="color:rgba(255,255,255,.75)">${esc(L.league(t.leagueId).name)} · Founded ${t.founded}</div><div class="nm">${esc(t.name)}</div><div class="sub">${DATA.CLUB_IDS[t.ident].icon} ${esc(DATA.CLUB_IDS[t.ident].name)} · ${esc(t.stadium.name)}</div>
      <div class="hero-stats"><div><b>${L.position(t.id) ? U.ord(L.position(t.id)) : '–'}</b><span>Position</span></div><div><b>${r ? r.pts : 0}</b><span>Points</span></div><div><b>${t.rep}</b><span>Rep</span></div><div><b>${Math.round(L.teamLevel(t))}</b><span>Squad</span></div></div></div>
      ${c && t.id !== G.userTeamId ? `<div class="row tap" data-a="coachSheet" data-v="${c.id}">${Art.coachFace(c, 38)}<div class="grow"><div class="nm">${esc(c.fn)} ${esc(c.ln)}</div><div class="meta">${DATA.COACH_IDS[c.ident].icon} ${esc(DATA.COACH_IDS[c.ident].name)} · plays ${t.tac ? t.tac.oop : ''}</div></div>${I.chev}</div>` : ''}
      ${t.trophies.length ? `<div class="small mt8">🏆 ${t.trophies.slice(-6).map(x => `${esc(x.name)} (S${x.s})`).join(' · ')}</div>` : ''}
      <div class="kicker mt12 mb8">Squad</div><div class="list">${sq.map(p => UI.playerRow(p)).join('')}</div>`, { vars: UI.teamVars(t) });
  };

  // ════════ FEED ════════
  SCREENS.feedBody = () => {
    const sub = S.sub.feed;
    return `<div class="scroll">${UI.seg('feed', [['news', 'News'], ['forum', 'Forum'], ['inbox', 'Inbox']])}${sub === 'forum' ? forum() : sub === 'inbox' ? inboxList() : newsList()}</div>`;
  };
  function newsList() {
    const f = S.newsFilter || 'all';
    const tags = ['all', 'club', 'match', 'transfer', 'coach', 'league', 'cup', 'academy'];
    const list = G.news.filter(n => f === 'all' || n.tag === f);
    return `<div class="chips">${tags.map(t => `<button class="chip${f === t ? ' on' : ''}" data-a="newsFilter" data-v="${t}">${t === 'all' ? 'All' : t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
      <div class="card">${list.slice(0, 60).map(a => `<div class="news tap" data-a="article" data-v="${a.id}">${a.pid && P(a.pid) ? UI.face(P(a.pid), 40) : a.tid != null && T(a.tid) ? UI.crest(T(a.tid), 40) : '<div class="av" style="background:var(--surface-3)">📰</div>'}<div class="grow"><div class="flex" style="gap:6px"><span class="ntag ${a.tag}">${a.tag}</span><span class="tiny dim">${L.dateStr(a.d, true)} · S${a.s}</span></div><div class="nt mt4">${esc(a.title)}</div></div></div>`).join('') || '<div class="empty">No news.</div>'}</div>`;
  }
  A.newsFilter = v => { S.newsFilter = v; UI.render(); };
  A.article = v => {
    const a = G.news.find(x => x.id === +v);
    if (!a) return;
    UI.sheet(`<span class="ntag ${a.tag}">${a.tag}</span><h2 class="mt8" style="text-transform:none;font-size:24px;line-height:1.15">${esc(a.title)}</h2><div class="tiny dim mb12">${a.by ? `${esc(a.by.n)}, ${esc(a.by.role)} · ` : ''}${L.dateStr(a.d)} · Season ${a.s}</div>
      ${a.pid && P(a.pid) ? `<div class="row tap" data-a="player" data-v="${a.pid}">${UI.face(P(a.pid), 44)}<div class="grow"><div class="nm">${esc(P(a.pid).fn)} ${esc(P(a.pid).ln)}</div><div class="meta">${UI.posB(P(a.pid).pos)} ${P(a.pid).age} yrs</div></div>${UI.ovrB(P(a.pid))}</div>` : ''}
      <p style="font-size:15.5px;line-height:1.6">${esc(a.body)}</p>${a.fx ? `<button class="btn block" data-a="boxScore" data-v="${a.fx}">Match details</button>` : ''}`);
  };
  function avatar(n, tid) {
    const t = tid != null ? T(tid) : null;
    const col = t ? t.crest.c1 : U.pick(['#334155', '#475569', '#1e293b']);
    return `<div class="av" style="background:${col};color:${U.onColor(col)}">${esc(n.slice(0, 2).toUpperCase())}</div>`;
  }
  function forum() {
    return G.forum.slice(0, 40).map(th => `<div class="thread tap" data-a="thread" data-v="${th.id}"><div class="flex">${avatar(th.author, th.tid)}<div class="grow"><div class="bold small">${esc(th.title)}</div><div class="tiny muted">${esc(th.author)}${th.tid != null && T(th.tid) ? ` · ${esc(T(th.tid).abbr)} fan` : ''} · ${th.posts.length} posts · ${th.views.toLocaleString()} views</div></div><span class="ntag ${th.tag}">${th.tag}</span></div></div>`).join('') || '<div class="empty">The forum is quiet.</div>';
  }
  A.thread = v => {
    const th = G.forum.find(x => x.id === +v);
    if (!th) return;
    UI.sheet(`<span class="ntag ${th.tag}">${th.tag}</span><h2 class="mt8" style="text-transform:none;font-size:21px">${esc(th.title)}</h2><div class="tiny dim mb12">${th.views.toLocaleString()} views · ${L.dateStr(th.d, true)}</div>
      ${th.posts.map((p, i) => `<div class="post">${avatar(p.n, p.tid)}<div class="grow"><div class="who">${esc(p.n)} ${p.tid != null && T(p.tid) ? `<span class="tiny muted">· ${esc(T(p.tid).abbr)}</span>` : ''}${i === 0 ? ' <span class="tag t-acc">OP</span>' : ''}</div><div class="txt">${esc(p.t)}</div><div class="up">▲ ${p.up}</div></div></div>`).join('')}`);
  };
  function inboxList() {
    for (const m of G.inbox) if (!m.actions || !m.actions.length || m.done) m.read = true;
    return G.inbox.length ? G.inbox.slice(0, 50).map(m => {
      const icon = { trade: '🔄', bid: '💰', event: '⚡', acad: '🎓', scout: '🔭', injury: '🩹', contract: '📝', job: '💼', board: '🏛️', showcase: '🌟', unrest: '😤', sponsor: '🤝', unlock: '🎨', vote: '🗳️' }[m.type] || '✉️';
      return `<div class="msg"><div class="mt"><span>${icon}</span><span class="grow">${esc(m.title)}</span><span class="tiny dim">${L.dateStr(m.day, true)}</span></div>${m.body ? `<div class="mb">${esc(m.body)}</div>` : ''}${!m.done && m.actions ? `<div class="acts">${m.actions.map((a, i) => `<button class="btn xs ${i === 0 ? 'primary' : a.danger ? 'danger' : ''}" data-a="msgAct" data-v="${m.id}:${i}">${esc(a.label)}</button>`).join('')}</div>` : ''}${m.result ? `<div class="res">${esc(m.result)}</div>` : ''}</div>`;
    }).join('') : '<div class="empty">Nothing yet.</div>';
  }

  // ════════ CLUB ════════
  A.club = () => { S.clubTab = S.clubTab || 'overview'; UI.go('club'); };
  A.clubTab = v => { S.clubTab = v; UI.closeSheet(); if (S.screen !== 'club') UI.go('club'); else UI.render(); };
  A.backHub = () => UI.go('hub');
  SCREENS.club = () => {
    const u = L.user(), tab = S.clubTab || 'overview';
    const body = { overview: overview, finance: finance, staff: staff, facilities: facilities, identity: identity, trophies: trophies }[tab] || overview;
    const tabs = [['overview', 'Club'], ['finance', 'Finance'], ['staff', 'Staff'], ['facilities', 'Facilities'], ['identity', 'Identity'], ['trophies', 'Trophies']];
    return `<div class="screen">${UI.topbar(esc(u.name), 'Club management', `<button class="icon-btn" data-a="backHub">${I.back}</button>`, `<button class="icon-btn" data-a="settings">${I.gear}</button>`)}<div class="scroll noTab"><div class="seg">${tabs.map(([v, l]) => `<button class="${tab === v ? 'on' : ''}" data-a="clubTab" data-v="${v}">${l}</button>`).join('')}</div>${body()}</div></div>`;
  };
  function overview() {
    const u = L.user(), m = G.mgr, ci = DATA.CLUB_IDS[u.ident], mi = DATA.COACH_IDS[m.ident];
    const st = Career.challengeStatus();
    return `<div class="hero" style="${UI.teamVars(u)}"><div class="hcrest">${UI.crest(u, 170)}</div><div class="kicker" style="color:rgba(255,255,255,.75)">Founded ${u.founded} · ${esc(L.league(u.leagueId).name)}</div><div class="nm">${esc(u.name)}</div><div class="sub">${esc(u.stadium.name)} · ${u.stadium.cap.toLocaleString()} seats</div>
      <div class="hero-stats"><div><b>${u.rep}</b><span>Reputation</span></div><div><b>${U.money(u.fin.bal)}</b><span>Bank</span></div><div><b>${G.board.conf}</b><span>Board</span></div><div><b>${u.trophies.length}</b><span>Trophies</span></div></div></div>
      <div class="card"><h3>🧑‍💼 Manager</h3><div class="bold">${esc(m.name)}</div><div class="small muted">${mi.icon} ${esc(mi.name)} · reputation ${m.rep} · ${m.w}W ${m.d}D ${m.l}L · ${m.trophies} trophies</div></div>
      <div class="card"><h3>${ci.icon} Club identity</h3><div class="bold">${esc(ci.name)}</div><div class="small muted">${esc(ci.desc)}</div><div class="small mt4">Fans say: <i>"${esc(ci.fans)}"</i></div></div>
      <div class="card"><h3>🏛️ Board objective</h3><div class="bold">${esc(G.board.obj ? G.board.obj.label : '—')}</div><div class="prog mt8"><i style="width:${G.board.conf}%"></i></div><div class="tiny dim mt4">Confidence ${G.board.conf}/100</div></div>
      ${st ? `<div class="card"><h3>${st.ch.icon} ${esc(st.ch.name)}</h3><div class="small muted">${esc(st.ch.desc)}</div><div class="small mt8">${esc(st.text)}</div></div>` : ''}`;
  }
  // ════════ FINANCE ════════
  const FIN_TABS = [['summary', 'Summary'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['matchday', 'Matchday'], ['sponsors', 'Sponsors']];
  function finance() {
    Fin.ensure();
    const tab = S.finTab || 'summary';
    const body = { summary: finSummary, weekly: () => finFlow('week'), monthly: () => finFlow('month'), matchday: finMatchday, sponsors: finSponsors }[tab] || finSummary;
    const offers = G.spon.offers.length;
    return `<div class="opts mb12">${FIN_TABS.map(([v, l]) => `<button class="${tab === v ? 'on' : ''}" data-a="finTab" data-v="${v}">${l}${v === 'sponsors' && offers ? ` <b class="good">${offers}</b>` : ''}</button>`).join('')}</div>${body()}`;
  }
  A.finTab = v => { S.finTab = v; S.finSel = null; S.finPage = null; UI.render(); };
  const sign = x => (x > 0 ? '+' : '') + U.money(x);
  // bank, total wage bill and what's left of the wage budget: computed fresh on every render
  function finKV() {
    const u = L.user(), room = L.wageRoom(), bill = L.payroll(u) + L.staffWages();
    return `<div class="kv mb12"><div><b class="${u.fin.bal < 0 ? 'bad' : ''}">${U.money(u.fin.bal)}</b><span>Bank</span></div><div><b>${U.wage(bill).replace('/wk', '')}</b><span>Wages/wk (incl. staff)</span></div><div><b id="wroom" class="${room < 0 ? 'bad' : 'good'}">${U.wage(Math.abs(room)).replace('/wk', '')}</b><span id="wroomL">${room < 0 ? 'Over budget' : 'Wage room'}</span></div></div>`;
  }
  function finSummary() {
    const u = L.user(), s = G.finSeason, f = Fin.forecast(u);
    const row = (l, v, cls = '') => `<div class="frow ${cls}"><span>${l}</span><b class="${v < 0 ? 'bad' : cls && v > 0 ? 'good' : ''}">${sign(v)}</b></div>`;
    const net = f.income - f.out;
    const totIn = U.sum(Fin.INC.map(k => Math.max(0, s[k] || 0))), totOut = U.sum(Fin.EXP.map(k => Math.min(0, s[k] || 0)));
    const cats = Fin.INC.concat(Fin.EXP).filter(k => s[k]);
    const max = Math.max(1, ...cats.map(k => Math.abs(s[k])));
    const line = k => `<div class="attr" style="grid-template-columns:140px 1fr 64px"><span class="small">${Fin.CAT[k]}</span><div class="bar"><i style="width:${(Math.abs(s[k]) / max) * 100}%;${s[k] < 0 ? 'background:var(--bad)' : ''}"></i></div><b class="small ${s[k] < 0 ? 'bad' : ''}" style="font-size:13px">${U.money(s[k])}</b></div>`;
    return finKV() + `<div class="card"><h3>📅 A typical week<span class="grow"></span><span class="tag ${net >= 0 ? 't-good' : 't-bad'}">${sign(net)}/wk</span></h3><p class="tiny muted" style="margin-top:-6px">What the club should earn and spend in a normal week at today's prices and deals (prize money and transfers not included). Your wage room is 68% of this income, minus the wages you already pay to players and staff.</p>
      ${row('Broadcast', f.tv)}${row('Sponsors', f.spon)}${row('Merch & commercial', f.merch)}${row(`Gate (${f.att.toLocaleString()} fans, a home game every 2 wks)`, f.gate)}${f.extras ? row('Concessions & hospitality', f.extras) : ''}${row('Income', f.income, 'tot')}
      <div class="mt8"></div>${row('Player wages', -f.wages)}${row('Staff wages', -f.staff)}${row('Running costs', -f.ops)}${row('Costs', -f.out, 'tot')}</div>
      <div class="card"><h3>Season ${G.season} so far<span class="grow"></span><span class="tag ${totIn + totOut >= 0 ? 't-good' : 't-bad'}">${U.money(totIn + totOut)}</span></h3>${cats.length ? cats.map(line).join('') : '<div class="tiny muted">Nothing yet.</div>'}</div>
      <div class="card"><h3>Ledger</h3>${G.finLog.slice(0, 40).map(e => `<div class="flex between small" style="padding:4px 0;border-bottom:1px solid var(--line)"><span class="grow ellip">${esc(e.label)}</span><span class="tiny dim">${L.dateStr(e.d, true)}</span><b class="${e.amt < 0 ? 'bad' : 'good'}" style="min-width:64px;text-align:right">${sign(e.amt)}</b></div>`).join('') || '<div class="empty small">No transactions yet.</div>'}</div>`;
  }

  // ── income vs expenses, by week or by month ──
  function niceMax(v) { const e = Math.pow(10, Math.floor(Math.log10(v))); return [1, 2, 2.5, 5, 10].map(m => m * e).find(m => m >= v) || v; }
  // a bar with rounded top corners, square on the baseline
  function barPath(x, y0, w, h) {
    if (h <= 0.5) return '';
    const r = Math.min(3, w / 2, h);
    return `M${x},${y0}V${y0 - h + r}Q${x},${y0 - h} ${x + r},${y0 - h}H${x + w - r}Q${x + w},${y0 - h} ${x + w},${y0 - h + r}V${y0}Z`;
  }
  function flowChart(list, sel) {
    const W = 340, H = 176, L0 = 40, R = 4, T = 10, B = 22, ih = H - T - B, n = list.length;
    const top = niceMax(Math.max(0.05, ...list.map(p => Math.max(p.inc, p.exp))));
    const gw = (W - L0 - R) / n, bw = Math.min(11, Math.max(3, gw * 0.34));
    const y = v => T + ih - (v / top) * ih;
    let g = '';
    for (let i = 0; i <= 4; i++) { const v = (top * i) / 4, yy = y(v); g += `<line class="grid" x1="${L0}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text x="${L0 - 5}" y="${yy + 3}" text-anchor="end">${v ? U.money(v) : '0'}</text>`; }
    const every = Math.ceil(n / 7);
    list.forEach((p, i) => {
      const x = L0 + i * gw, cx = x + gw / 2;
      if (i === sel) g += `<rect class="selbg" x="${x + 1}" y="${T}" width="${gw - 2}" height="${ih}" rx="4"/>`;
      g += `<path d="${barPath(cx - bw - 1, T + ih, bw, (p.inc / top) * ih)}" fill="var(--good)"/><path d="${barPath(cx + 1, T + ih, bw, (p.exp / top) * ih)}" fill="var(--bad)"/>`;
      if (i % every === 0 || i === sel) g += `<text x="${cx}" y="${H - 7}" text-anchor="middle" style="${i === sel ? 'fill:var(--text);font-weight:700' : ''}">${p.label}</text>`;
      g += `<rect class="hit" data-a="finSel" data-v="${i}" x="${x}" y="0" width="${gw}" height="${H}"><title>${p.label}: in ${U.money(p.inc)}, out ${U.money(p.exp)}</title></rect>`;
    });
    g += `<line x1="${L0}" x2="${W - R}" y1="${T + ih}" y2="${T + ih}" stroke="var(--line-strong)"/>`;
    return `<svg class="fchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Income and expenses per period">${g}</svg>`;
  }
  function finFlow(by) {
    const seasons = Object.keys(G.finHist || {}).map(Number).sort((a, b) => b - a);
    const season = S.finSeasonSel && seasons.includes(S.finSeasonSel) ? S.finSeasonSel : G.season;
    const all = Fin.periods(season, by);
    // weeks come in pages of 13 (half a season) so the bars stay readable
    let page = 0, pages = 1, list = all, off = 0;
    if (by === 'week') {
      pages = Math.max(1, Math.ceil(all.length / 13));
      page = S.finPage != null ? Math.min(S.finPage, pages - 1) : pages - 1;
      off = page * 13; list = all.slice(off, off + 13);
    }
    const seasonBtns = seasons.length > 1 ? `<div class="chips mb8">${seasons.map(x => `<button class="chip${x === season ? ' on' : ''}" data-a="finSeason" data-v="${x}">Season ${x}</button>`).join('')}</div>` : '';
    if (!list.length) return finKV() + seasonBtns + '<div class="empty">No money has moved yet this season.</div>';
    const sel = S.finSel != null && S.finSel < list.length ? S.finSel : list.length - 1;
    const p = list[sel], unit = by === 'week' ? 'week' : 'month';
    const avgIn = U.avg(all.map(x => x.inc)), avgOut = U.avg(all.map(x => x.exp));
    const cats = Object.entries(p.cats).filter(([, v]) => Math.abs(v) >= 0.0005).sort((a, b) => b[1] - a[1]);
    const pager = pages > 1 ? `<div class="flex between mt8"><button class="btn xs ${page === 0 ? 'off' : ''}" data-a="finPage" data-v="${page - 1}">◀ Earlier</button><span class="tiny muted">Weeks ${off + 1}–${off + list.length}</span><button class="btn xs ${page >= pages - 1 ? 'off' : ''}" data-a="finPage" data-v="${page + 1}">Later ▶</button></div>` : '';
    return finKV() + seasonBtns + `<div class="card"><h3>${by === 'week' ? 'Weekly' : 'Monthly'} income vs expenses</h3>
      <div class="fleg mb8"><span><i style="background:var(--good)"></i>Income</span><span><i style="background:var(--bad)"></i>Expenses</span><span class="grow"></span><span class="tiny dim">Tap a bar for details</span></div>
      ${flowChart(list, sel)}${pager}
      <div class="flex between tiny muted mt8"><span>Season average per ${unit}</span><span><b class="good">${U.money(avgIn)}</b> in · <b class="bad">${U.money(avgOut)}</b> out</span></div></div>
      <div class="card"><h3>${by === 'week' ? `Week ${p.key + 1}` : p.label} · ${L.dateStr(p.from, true)}–${L.dateStr(p.to, true)}<span class="grow"></span><span class="tag ${p.inc - p.exp >= 0 ? 't-good' : 't-bad'}">${sign(p.inc - p.exp)}</span></h3>
        ${cats.map(([k, v]) => `<div class="frow"><span>${Fin.CAT[k] || k}</span><b class="${v < 0 ? 'bad' : 'good'}">${sign(v)}</b></div>`).join('') || '<div class="tiny muted">Nothing moved.</div>'}
        <div class="frow tot"><span>In ${U.money(p.inc)} · Out ${U.money(p.exp)}</span><b class="${p.inc - p.exp < 0 ? 'bad' : 'good'}">${sign(p.inc - p.exp)}</b></div></div>`;
  }
  A.finSel = v => { S.finSel = +v; UI.render(); };
  A.finPage = v => { S.finPage = Math.max(0, +v); S.finSel = null; UI.render(); };
  A.finSeason = v => { S.finSeasonSel = +v; S.finSel = null; S.finPage = null; UI.render(); };

  // ── match day: the ticket sweet spot and stadium extras ──
  function ticketChart(c, price) {
    const W = 340, H = 124, L0 = 8, R = 8, T = 18, B = 18, ih = H - T - B;
    const top = Math.max(...c.pts.map(p => p.total)) * 1.08;
    const p0 = c.pts[0].p, p1 = c.pts[c.pts.length - 1].p;
    const x = p => L0 + ((p - p0) / (p1 - p0)) * (W - L0 - R);
    const y = v => T + ih - (v / top) * ih;
    const path = c.pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.p).toFixed(1)},${y(p.total).toFixed(1)}`).join('');
    const cur = c.pts.find(p => p.p === price) || c.best;
    const mid = Math.min(W - 70, Math.max(70, (x(c.lo) + x(c.hi)) / 2));
    let g = `<rect x="${x(c.lo)}" y="${T}" width="${Math.max(3, x(c.hi) - x(c.lo))}" height="${ih}" fill="var(--good)" opacity=".16" rx="4"/>`;
    g += `<text x="${mid}" y="${T - 6}" text-anchor="middle" style="fill:var(--good);font-weight:700">sweet spot $${c.lo}–$${c.hi}</text>`;
    g += `<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>`;
    g += `<line x1="${x(cur.p)}" x2="${x(cur.p)}" y1="${T}" y2="${T + ih}" stroke="var(--text)" stroke-dasharray="3 3" opacity=".55"/><circle cx="${x(cur.p)}" cy="${y(cur.total)}" r="5" fill="var(--text)" stroke="var(--surface)" stroke-width="2"/>`;
    g += `<line x1="${L0}" x2="${W - R}" y1="${T + ih}" y2="${T + ih}" stroke="var(--line-strong)"/><text x="${L0}" y="${H - 4}">$${p0}</text><text x="${W - R}" y="${H - 4}" text-anchor="end">$${p1}</text><text x="${W / 2}" y="${H - 4}" text-anchor="middle">price → match-day income per home game</text>`;
    return `<svg class="fchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Match-day income at each ticket price">${g}</svg>`;
  }
  function ticketLive(c, price) {
    const cur = c.pts.find(p => p.p === price) || c.best, fill = Math.round((cur.att / c.cap) * 100);
    const verdict = price < c.lo ? `<span class="warn">Below the sweet spot:</span> the ground ${fill >= 99 ? 'sells out' : 'fills up'}, but you're leaving money on the table.` : price > c.hi ? `<span class="bad">Too pricey:</span> the empty seats cost more than the higher price earns, and fans may protest.` : '<span class="good">In the sweet spot.</span>';
    const room = L.wageRoom();
    return `<div class="small mt8">${verdict}</div><div class="frow mt4"><span>Expected crowd</span><b>${cur.att.toLocaleString()} (${fill}%)</b></div><div class="frow"><span>Gate per home game</span><b>${U.money(cur.gate)}</b></div><div class="frow"><span>With food, drink & boxes</span><b>${U.money(cur.total)}</b></div><div class="frow"><span>Best price</span><b>$${c.best.p} → ${U.money(c.best.total)}</b></div><div class="frow"><span>Wage room at this price</span><b class="${room < 0 ? 'bad' : 'good'}">${room < 0 ? '−' : ''}${U.wage(Math.abs(room))}</b></div>`;
  }
  function finMatchday() {
    const u = L.user(), c = Fin.ticketCurve(u), [lo, hi] = Fin.ticketRange(u), b = Fin.biz(u);
    const item = kind => {
      const d = Fin.BIZ[kind], lv = b[kind] || 0, cost = Fin.bizCost(kind);
      return `<div class="deal"><div class="ic">${d.icon}</div><div class="grow"><div class="bold small">${d.name} <span class="tiny dim">${'●'.repeat(lv)}${'○'.repeat(d.max - lv)}</span></div><div class="tiny muted">${lv ? 'Now: ' + d.desc(lv, u) : 'Not built yet.'}${lv < d.max ? `<br>Next level: ${d.desc(lv + 1, u)}` : ''}</div></div>${cost ? `<button class="btn xs primary ${u.fin.bal < cost ? 'off' : ''}" data-a="buyBiz" data-v="${kind}">${U.money(cost)}</button>` : '<span class="tag t-good">Max</span>'}</div>`;
    };
    const sc = L.upgradeCost('stadium');
    return finKV() + `<div class="card"><h3>🎟️ Ticket price<span class="grow"></span><b class="money" id="tixLbl">$${u.fin.ticket}</b></h3>
      <div class="tiny muted mb8">Against a typical league visitor at today's form. Big cup and European nights draw bigger crowds; bad weather draws smaller ones.</div>
      <div id="tixChart">${ticketChart(c, u.fin.ticket)}</div>
      <input type="range" min="${lo}" max="${hi}" value="${u.fin.ticket}" data-in="ticket" data-ch="ticketSave" style="width:100%">
      <div id="tixLive">${ticketLive(c, u.fin.ticket)}</div></div>
      ${pitchCard(u)}
      <div class="card"><h3>🏟️ Stadium & commercial</h3><p class="tiny muted" style="margin-top:-6px">Build once, earn for good. Better concourses and boxes also move your ticket sweet spot.</p>
        ${Object.keys(Fin.BIZ).map(item).join('')}
        <div class="deal"><div class="ic">🏗️</div><div class="grow"><div class="bold small">Stadium expansion</div><div class="tiny muted">${u.stadium.cap.toLocaleString()} seats now · +5,000 seats</div></div><button class="btn xs primary ${u.fin.bal < sc ? 'off' : ''}" data-a="upgrade" data-v="stadium">${U.money(sc)}</button></div></div>`;
  }
  function pitchCard(u) {
    const v = Xtra.pitch(u), lbl = Xtra.pitchLabel(v), col = v >= 70 ? 'var(--good)' : v >= 40 ? 'var(--warn)' : 'var(--bad)';
    const heat = (u.biz && u.biz.heating) || 0;
    return `<div class="card"><h3>🌱 Pitch condition<span class="grow"></span><span class="tag" style="color:${col}">${lbl} · ${Math.round(v)}%</span></h3><div class="prog"><i style="width:${v}%;background:${col}"></i></div>
      <p class="tiny muted mt8">Every home game wears it, and rain, storms and snow do real damage; it grows back a little each day. Below 70% the ball bobbles (heavier touches, wilder passes); below 40% players start getting hurt on it. Snow can freeze an unheated pitch and get the game postponed, so the fixtures pile up.</p>
      <div class="tiny ${heat ? 'good' : 'warn'}">${heat >= 2 ? '♨️ Undersoil heating and drainage installed.' : heat ? '♨️ Undersoil heating installed: no frozen-pitch postponements.' : '⚠️ No undersoil heating: winter games can be called off.'}</div></div>`;
  }
  // the slider redraws its chart, the projections and the wage room as it moves
  A.ticket = v => {
    const u = L.user();
    u.fin.ticket = +v;
    const c = Fin.ticketCurve(u), set = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
    set('tixLbl', `$${v}`);
    set('tixChart', ticketChart(c, +v));
    set('tixLive', ticketLive(c, +v));
    const room = L.wageRoom(), wr = document.getElementById('wroom');
    if (wr) { wr.textContent = U.wage(Math.abs(room)).replace('/wk', ''); wr.className = room < 0 ? 'bad' : 'good'; set('wroomL', room < 0 ? 'Over budget' : 'Wage room'); }
  };
  A.ticketSave = () => L.save();
  A.buyBiz = v => { const r = Fin.buyBiz(v); if (r.ok) { Sfx.play('cash'); UI.toast(`🏗️ ${Fin.BIZ[v].name} upgraded`); } else UI.toast(esc(r.why)); UI.render(); };

  // ── sponsors ──
  function finSponsors() {
    const u = L.user(), SP = G.spon, total = U.sum(Object.values(SP.deals).filter(Boolean).map(d => d.wk));
    const deal = slot => {
      const sl = Fin.SLOTS[slot], d = SP.deals[slot];
      const locked = slot === 'sleeve' && u.rep < 35;
      return `<div class="deal"><div class="ic">${d ? d.icon : sl.icon}</div><div class="grow"><div class="tiny dim">${sl.name}</div><div class="bold small">${d ? esc(d.brand) : locked ? 'Needs club reputation 35' : '<span class="warn">Empty: offers on the way</span>'}</div>${d ? `<div class="tiny muted">${U.money(d.wk)}/wk${d.win ? ` + ${U.money(d.win)} per win` : ''} · ${d.until <= G.season ? '<span class="warn">ends this summer</span>' : `until the end of season ${d.until}`}</div>` : `<div class="tiny muted">Worth about ${U.money(Fin.fair(slot))}/wk to a club like yours</div>`}</div></div>`;
    };
    const offer = o => {
      const cur = SP.deals[o.slot], early = cur && cur.until > G.season;
      return `<div class="deal"><div class="ic">${o.icon}</div><div class="grow"><div class="tiny dim">${Fin.SLOTS[o.slot].name} · answer by ${L.dateStr(o.exp, true)}</div><div class="bold small">${esc(o.brand)}</div><div class="tiny muted">${Fin.dealText(o)}${o.renew ? `<br>Renewal: ${U.money(cur.wk)}/wk now` : cur ? `<br>Replaces ${esc(cur.brand)} (${U.money(cur.wk)}/wk)${early ? ` · ${U.money(Fin.buyout(cur))} to end it early` : ''}` : ''}</div></div><div class="flex" style="flex-direction:column;gap:4px"><button class="btn xs primary" data-a="sponAccept" data-v="${o.id}">Accept</button><button class="btn xs" data-a="sponDecline" data-v="${o.id}">Decline</button></div></div>`;
    };
    const tierName = u.rep >= 75 ? 'Global brands' : u.rep >= 50 ? 'National brands' : 'Local businesses';
    return finKV() + `<div class="card"><h3>🤝 Sponsorship<span class="grow"></span><span class="tag t-good">${U.money(total)}/wk</span></h3>
      <div class="small muted">Club reputation <b>${u.rep}</b> · ${tierName} are interested.</div><div class="prog mt8"><i style="width:${u.rep}%"></i></div>
      <p class="tiny dim mt8">Sponsors pay more as your reputation grows and you climb the table. Every 3-point rise in reputation brings a fresh call, empty slots fill fast, and deals in their last season get renewal offers. Win-bonus deals pay out on every competitive win.</p></div>
      ${SP.offers.length ? `<div class="card" style="border-color:rgba(34,197,94,.45)"><h3>📨 Offers on the table</h3>${SP.offers.map(offer).join('')}</div>` : ''}
      <div class="card"><h3>Current deals</h3>${Fin.SLOT_IDS.map(deal).join('')}</div>`;
  }
  A.sponAccept = v => { const r = Fin.accept(+v); UI.toast(esc(r.ok ? r.text : r.why)); if (r.ok) Sfx.play('cash'); UI.render(); };
  A.sponDecline = v => { Fin.decline(+v); UI.render(); };
  const ROLE_NAME = { ast: 'Assistant manager', fit: 'Fitness coach', yth: 'Youth coach', sct: 'Scout' };
  const ROLE_DESC = { ast: 'Better training growth for the first team', fit: 'Faster fitness recovery between games', yth: 'Faster academy growth and better intakes', sct: 'Shorter, sharper scouting trips' };
  function staff() {
    const slot = (role, cid) => { const c = cid != null ? G.coaches[cid] : null; return `<div class="row">${c ? Art.coachFace(c, 42) : '<div class="av" style="background:var(--surface-3);width:42px;height:42px">?</div>'}<div class="grow"><div class="nm">${c ? `${esc(c.fn)} ${esc(c.ln)}` : 'Vacant'}</div><div class="meta">${ROLE_NAME[role]}${c ? ` · rating <b>${c.rating}</b> · ${U.wage(c.wage)}` : ` · ${ROLE_DESC[role]}`}</div></div>${c ? `<button class="btn xs danger" data-a="fireStaff" data-v="${role}:${c.id}">Fire</button>` : `<button class="btn xs primary" data-a="hireSheet" data-v="${role}">Hire</button>`}</div>`; };
    return `<div class="card"><h3>Backroom staff</h3>${slot('ast', G.staff.ast)}${slot('fit', G.staff.fit)}${slot('yth', G.staff.yth)}${G.staff.sct.map(id => slot('sct', id)).join('')}${G.staff.sct.length < 3 ? `<button class="btn block sm mt8" data-a="hireSheet" data-v="sct">+ Add a scout (${G.staff.sct.length}/3)</button>` : ''}</div>
      <div class="card"><h3>Upgrade a role</h3><div class="grid2">${['ast', 'fit', 'yth'].map(r => `<button class="btn sm" data-a="hireSheet" data-v="${r}">${ROLE_NAME[r]}</button>`).join('')}</div></div>`;
  }
  A.hireSheet = role => {
    const pool = G.staffPool.map(id => G.coaches[id]).filter(c => c && c.role === role && c.tid < 0).sort((a, b) => b.rating - a.rating);
    UI.sheet(`<h2>Hire: ${ROLE_NAME[role]}</h2><p class="small muted">${ROLE_DESC[role]}. Signing-on fee is four weeks' wages. The pool refreshes every summer.</p>${pool.map(c => `<div class="row">${Art.coachFace(c, 42)}<div class="grow"><div class="nm">${esc(c.fn)} ${esc(c.ln)}</div><div class="meta">${Art.flag(c.nat, 12)} ${c.age} · ${U.wage(c.wage)} · fee ${U.money(c.wage * 4 / 1000)}</div></div><span class="ovr ${U.ovrClass(c.rating)}">${c.rating}</span><button class="btn xs primary" data-a="hireStaff" data-v="${c.id}">Hire</button></div>`).join('') || '<div class="empty">Nobody available.</div>'}`);
  };
  A.hireStaff = v => { const r = L.hireStaff(+v); if (r.ok) { UI.closeSheet(); UI.toast('🤝 Welcome aboard'); UI.render(); } else UI.toast(esc(r.why)); };
  A.fireStaff = v => { const [role, id] = v.split(':'); const c = G.coaches[+id]; UI.confirm(`Fire ${c.ln}?`, `You'll pay off eight weeks' wages (${U.money(c.wage * 8 / 1000)}).`, 'Fire', () => { L.fireStaff(role, +id); UI.render(); }, true); };
  function facilities() {
    const u = L.user();
    const item = (kind, title, desc, level, max) => { const cost = L.upgradeCost(kind); return `<div class="card"><div class="flex"><div class="grow"><div class="bold">${title}</div><div class="small muted">${desc}</div><div class="mt4">${level}</div></div>${cost && (max == null || true) ? `<button class="btn sm primary ${u.fin.bal < cost ? 'off' : ''}" data-a="upgrade" data-v="${kind}">${U.money(cost)}</button>` : '<span class="tag t-good">Max</span>'}</div></div>`; };
    return item('stadium', '🏟️ Stadium expansion', '+5,000 seats. More gate money — if you can fill them.', `<b>${u.stadium.cap.toLocaleString()}</b> seats`)
      + item('facilities', '🏋️ Training ground', 'Better facilities improve match-day boost and lower running costs over time.', `Level <b>${u.facilities}</b> / 5`)
      + item('academy', '🎓 Academy', 'Better youth intakes and faster development. Higher levels attract wonderkids.', `${'★'.repeat(u.acad.level)}${'☆'.repeat(5 - u.acad.level)}`);
  }
  A.upgrade = v => { if (L.upgrade(v)) { Sfx.play('cash'); UI.toast('🏗️ Upgrade complete'); UI.render(); } else UI.toast('Not enough money (or already maxed).'); };
  // ── kit & badge studio: the base designs, plus the ones earned through milestones ──
  function studio() {
    const u = L.user(), earned = Xtra.UNLOCKS.filter(x => Xtra.has(x.id)).length;
    const row = (kind, cur) => `<div class="chips" style="flex-wrap:wrap">${Xtra.options(kind).map(o => o.locked
      ? `<button class="chip" style="opacity:.5" data-a="studioLocked" data-v="${esc(o.how)}">🔒 ${esc(o.name)}</button>`
      : `<button class="chip${cur === o.id ? ' on' : ''}" data-a="studio" data-v="${kind}:${o.id}">${esc(o.name)}</button>`).join('')}</div>`;
    const sw = (field, cur) => `<div class="flex wrap" style="gap:6px">${DATA.PALETTE.map(col => `<button data-a="studio" data-v="${field}:${col}" aria-label="${col}" style="width:28px;height:28px;border-radius:9px;background:${col};box-shadow:${cur === col ? '0 0 0 3px var(--bg),0 0 0 5px var(--accent-2)' : 'inset 0 0 0 1px rgba(255,255,255,.2)'}"></button>`).join('')}</div>`;
    const gold = Xtra.has('gold');
    return `<div class="card"><h3>🎨 Kit & badge studio<span class="grow"></span><span class="tag">${earned}/${Xtra.UNLOCKS.length} earned</span></h3>
      <div class="flex" style="gap:16px;justify-content:center">${UI.crest(u, 92)}${Art.kit(u.kit, 80, 10)}${Art.kit(u.away, 56, 10)}</div>
      <div class="kicker mt12 mb8">Shirt pattern</div>${row('style', u.kit.style)}
      <div class="kicker mt8 mb8">Badge shape</div>${row('shape', u.crest.shape)}
      <div class="kicker mt8 mb8">Badge emblem</div>${row('icon', u.crest.icon)}
      <div class="kicker mt8 mb8">Badge trim</div><div class="chips">${gold ? `<button class="chip${u.crest.trim === 'gold' ? ' on' : ''}" data-a="studio" data-v="trim:gold">✨ Gold trim</button>` : `<button class="chip" style="opacity:.5" data-a="studioLocked" data-v="${esc(Xtra.UNLOCKS.find(x => x.id === 'gold').how)}">🔒 Gold trim</button>`}</div>
      <div class="kicker mt12 mb8">Home colours</div>${sw('c1', u.kit.c1)}<div class="mt8"></div>${sw('c2', u.kit.c2)}
      <div class="kicker mt12 mb8">Shorts</div>${sw('shorts', u.kit.c3)}
      <div class="kicker mt12 mb8">Still to earn</div>${Xtra.UNLOCKS.filter(x => !Xtra.has(x.id)).map(x => `<div class="frow"><span>🔒 ${esc(x.name)}</span><span class="tiny muted">${esc(typeof x.how === 'function' ? x.how() : x.how)}</span></div>`).join('') || '<div class="tiny good">Everything unlocked. A true club legend.</div>'}</div>`;
  }
  A.studio = v => { const i = v.indexOf(':'); const r = Xtra.design(v.slice(0, i), v.slice(i + 1)); if (!r.ok && r.why) UI.toast(esc(r.why)); UI.render(); };
  A.studioLocked = v => UI.toast(`🔒 ${esc(v)} to unlock this.`);
  function identity() {
    const u = L.user(), ci = DATA.CLUB_IDS[u.ident], mi = DATA.COACH_IDS[G.mgr.ident];
    const use = G.mgr.usage || {};
    const total = U.sum(Object.values(use)) || 1;
    return studio() + `<div class="card"><h3>Club DNA</h3><div class="flex"><div style="font-size:34px">${ci.icon}</div><div class="grow"><div class="bold">${esc(ci.name)}</div><div class="small muted">${esc(ci.desc)}</div></div></div><p class="tiny dim">Clubs grow into new identities: give academy debuts, score bags of goals, or turn a profit and the fans will start calling you something else.</p></div>
      <div class="card"><h3>Your philosophy</h3><div class="flex"><div style="font-size:34px">${mi.icon}</div><div class="grow"><div class="bold">${esc(mi.name)}</div><div class="small muted">${esc(mi.desc)}</div></div></div>
      <div class="kicker mt12 mb8">How you've actually played this season</div>${Object.entries(use).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<div class="attr" style="grid-template-columns:130px 1fr 34px"><span class="small">${DATA.COACH_IDS[k].icon} ${esc(DATA.COACH_IDS[k].name)}</span><div class="bar"><i style="width:${(n / total) * 100}%"></i></div><b class="small">${n}</b></div>`).join('') || '<div class="tiny muted">Play some matches.</div>'}<p class="tiny dim">At season's end your label follows the style you used most — and it travels with you to any club you take over.</p></div>
      <div class="card"><h3>All philosophies</h3>${Object.values(DATA.COACH_IDS).map(c => `<div class="row"><div style="font-size:22px">${c.icon}</div><div class="grow"><div class="nm">${esc(c.name)}</div><div class="meta">${esc(c.desc)} <span class="dim">(${c.oop} · ${(c.roles || []).slice(0, 3).map(r => TAC.ROLES[r].short).join(', ') || 'any roles'})</span></div></div></div>`).join('')}</div>`;
  }
  // a trophy drawn for its competition: league titles in gold, cups in silver, the continental prize with its big ears
  function trophyArt(kind, size) {
    const col = { league: ['#fde68a', '#b45309'], league2: ['#e2e8f0', '#64748b'], cup: ['#f1f5f9', '#475569'], cont: ['#fcd34d', '#92400e'], other: ['#fdba74', '#9a3412'] }[kind];
    // each drawing needs its own gradient id, or every trophy on the page picks up the first one's metal
    const id = 'tg' + kind + Math.random().toString(36).slice(2, 7);
    const ears = kind === 'cont' ? `<path d="M24 22 C2 22 2 54 30 50 M76 22 C98 22 98 54 70 50" fill="none" stroke="url(#${id})" stroke-width="7"/>` : kind === 'cup' ? `<path d="M28 24 C12 24 12 44 32 44 M72 24 C88 24 88 44 68 44" fill="none" stroke="url(#${id})" stroke-width="5"/>` : '';
    const body = kind === 'league2' ? `<path d="M30 18 H70 L64 52 H36 Z" fill="url(#${id})"/>` : `<path d="M26 14 H74 V28 C74 46 64 56 50 58 C36 56 26 46 26 28 Z" fill="url(#${id})"/>`;
    const lid = kind === 'league' ? `<path d="M38 14 Q50 2 62 14 Z" fill="url(#${id})"/><circle cx="50" cy="5" r="3.5" fill="url(#${id})"/>` : '';
    return `<svg viewBox="0 0 100 100" width="${size}" height="${size}"><defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="${col[1]}"/><stop offset=".45" stop-color="${col[0]}"/><stop offset="1" stop-color="${col[1]}"/></linearGradient></defs>${ears}${lid}${body}<rect x="44" y="56" width="12" height="16" fill="url(#${id})"/><path d="M30 72 H70 L74 92 H26 Z" fill="#3f2a1d"/><rect x="34" y="78" width="32" height="6" rx="1" fill="url(#${id})" opacity=".8"/></svg>`;
  }
  function trophyKind(name) {
    if (name === DATA.CONTINENTAL) return 'cont';
    if (DATA.NATIONS.some(n => n.cup === name)) return 'cup';
    if (DATA.NATIONS.some(n => n.tiers[0] === name)) return 'league';
    if (DATA.NATIONS.some(n => n.tiers[1] === name)) return 'league2';
    return 'other';
  }
  function trophies() {
    const u = L.user(), tours = (u.biz && u.biz.tours) || 0;
    const groups = {};
    for (const t of u.trophies) (groups[t.name] = groups[t.name] || []).push(t);
    const order = ['cont', 'league', 'cup', 'league2', 'other'];
    const shelf = Object.entries(groups).sort((a, b) => order.indexOf(trophyKind(a[0])) - order.indexOf(trophyKind(b[0])));
    const gots = (G.gotsHist || []).filter(x => x.club === u.name).slice().reverse();
    const legends = L.squad(u).filter(p => p.car && p.car.gp >= 20).sort((a, b) => (b.car.g * 2 + b.car.a + b.car.motm) - (a.car.g * 2 + a.car.a + a.car.motm)).slice(0, 5);
    return `<div class="card museum"><h3>🏛️ ${esc(u.name)} museum</h3>
      <div class="tiny muted" style="margin-top:-6px">${tours ? `Open to the public: ${tours > 1 ? 'guided tours and a stadium walk' : 'tours run every day'}. Every trophy here brings in more visitors.` : 'Build Museum & stadium tours (Finance → Matchday) to open this to paying fans.'}</div>
      <div class="cabinet mt8">${shelf.length ? shelf.map(([name, list]) => `<div class="tro">${trophyArt(trophyKind(name), 64)}${list.length > 1 ? `<span class="cnt">×${list.length}</span>` : ''}<b>${esc(name)}</b><span>${list.map(t => t.y).join(', ')}</span></div>`).join('') : '<div class="empty small" style="grid-column:1/-1">The cabinet is empty. For now.</div>'}</div></div>
      <div class="card"><h3>⚽ Goal of the Season</h3>${gots.length ? gots.map(x => `<div class="row"><div style="font-size:22px">🥇</div><div class="grow"><div class="nm">${esc(x.name)}</div><div class="meta">Season ${x.s}: ${esc(x.desc)}${x.opp ? ` vs ${esc(x.opp)}` : ''}</div></div></div>`).join('') : '<div class="tiny muted">At the end of each season, your three best goals go to a vote. The winners hang here.</div>'}</div>
      ${legends.length ? `<div class="card"><h3>⭐ Club greats in the squad</h3>${legends.map(p => UI.playerRow(p, { meta: `${p.car.gp} games · ${p.car.g} goals · ${p.car.a} assists${p.gots ? ` · 🥇×${p.gots}` : ''}` })).join('')}</div>` : ''}
      <div class="card"><h3>📈 League history</h3>${u.hist.length ? u.hist.slice().reverse().map(h => `<div class="flex between small" style="padding:4px 0"><span>Season ${h.s} · ${esc(L.league(h.lg).name)}</span><b>${U.ord(h.pos)} · ${h.pts} pts</b></div>`).join('') : '<div class="empty small">First season in progress.</div>'}</div>
      <button class="btn block" data-a="achSheet">${I.trophy} Achievements</button>`;
  }

  // ════════ SEASON REVIEW ════════
  A.review = () => UI.go('review');
  SCREENS.review = () => {
    const sm = G.lastSummary, u = L.user(), v = G.lastVerdict || {};
    if (!sm) return `<div class="screen">${UI.topbar('Season review')}<div class="scroll noTab"><button class="btn primary block" data-a="nextSeason">Continue</button></div></div>`;
    const lg = sm.leagues.find(l => l.lg === sm.user.lg);
    const aw = sm.awards;
    const awardRow = (label, pid) => { const p = pid != null ? P(pid) : null; return p ? `<div class="row tap" data-a="player" data-v="${p.id}">${UI.face(p, 42)}<div class="grow"><div class="kicker">${label}</div><div class="nm">${esc(p.fn)} ${esc(p.ln)}</div><div class="meta">${p.tid >= 0 && T(p.tid) ? esc(T(p.tid).name) : ''}</div></div>${UI.ovrB(p)}</div>` : ''; };
    const up = sm.promoted.includes(u.id), down = sm.relegated.includes(u.id);
    return `<div class="screen">${UI.topbar(`Season ${sm.season} review`, `${sm.year}`)}<div class="scroll noTab">
      <div class="hero" style="${UI.teamVars(u)}"><div class="hcrest">${UI.crest(u, 170)}</div><div class="kicker" style="color:rgba(255,255,255,.75)">${esc(L.league(sm.user.lg).name)}</div><div class="nm">${U.ord(sm.user.pos)} place</div><div class="sub">${up ? '⬆️ PROMOTED!' : down ? '⬇️ Relegated' : ''} Board verdict: <b>${esc(v.verdict || '—')}</b>${v.obj ? ` (target: ${esc(v.obj.label)})` : ''}</div></div>
      <div class="card"><h3>Final table</h3><table class="tbl"><tr><th>#</th><th class="l">Club</th><th>Pts</th></tr>${lg.table.map((r, i) => `<tr class="${r.tid === u.id ? 'me' : ''}"><td>${i + 1}</td><td class="l"><span class="tm">${UI.crest(T(r.tid), 20)}${esc(T(r.tid).name)}</span></td><td class="pts">${r.pts}</td></tr>`).join('')}</table></div>
      <div class="card"><h3>🏅 Awards</h3>${awardRow('Player of the Season', aw.poty)}${awardRow('Golden Boot', aw.boot)}${awardRow('Young Player', aw.young)}</div>
      <div class="card"><h3>Champions</h3>${sm.leagues.map(l => `<div class="flex small" style="padding:4px 0">${UI.crest(T(l.champ), 20)}<b>${esc(T(l.champ).name)}</b><span class="muted">${esc(L.league(l.lg).name)}</span></div>`).join('')}<div class="tiny muted mt8">⬆ ${sm.promoted.map(id => esc(T(id).name)).join(', ')}<br>⬇ ${sm.relegated.map(id => esc(T(id).name)).join(', ')}</div></div>
      ${expiringCard()}
      <p class="small muted">Over the summer: players age and develop, contracts expire, veterans retire, and a new academy intake arrives.</p>
      <button class="btn primary big block" data-a="nextSeason">Start season ${sm.season + 1}</button></div></div>`;
  };
  function expiringCard() {
    const list = L.squad(L.user()).filter(p => p.yrs <= 1).sort((a, b) => b.ovr - a.ovr);
    if (!list.length) return '';
    return `<div class="card" style="border-color:rgba(245,158,11,.45)"><h3>📝 Contracts expiring<span class="grow"></span><span class="tag t-warn">${list.filter(p => !p.renewed).length} leaving</span></h3><p class="tiny muted" style="margin-top:-6px">These players walk for nothing this summer unless you renew them now.</p>${list.map(p => UI.playerRow(p, { meta: `${p.age} · asks ${U.wage(L.wageDemand(p))}${p.wantsOut ? ' · <span class="warn">unhappy</span>' : ''}`, right: p.renewed ? '<span class="tag t-good">Renewed</span>' : `<button class="btn xs primary" data-a="quickRenew" data-v="${p.id}">Renew</button>` })).join('')}</div>`;
  }
  A.quickRenew = v => {
    const p = P(+v);
    if (p.wantsOut) { UI.toast(`${esc(p.ln)} wants out: negotiate from his profile.`); A.player(+v); return; }
    L.renew(+v, L.wageDemand(p), p.age >= 31 ? 1 : p.age >= 28 ? 2 : 3);
    p.yrs = p.age >= 31 ? 2 : p.age >= 28 ? 3 : 4;
    UI.toast(`📝 ${esc(p.ln)} signs on for ${U.wage(p.wage)}`);
    UI.render();
  };
  A.nextSeason = () => {
    UI.toast('Summer break…', '', 1200);
    setTimeout(() => {
      let n = 0;
      while (G.phase === 'post' && n++ < 30) L.advanceDay();
      UI.go('hub', { tab: 'home' });
      UI.toast(`Season ${G.season} begins! The transfer window is open.`, '', 3000);
    }, 40);
  };

  // ════════ SACKED ════════
  SCREENS.sacked = () => {
    const offers = (G.jobOffers || []).map(T).filter(Boolean);
    return `<div class="scroll noTab" style="padding-top:calc(30px + var(--safe-t))"><div class="center"><div style="font-size:64px">📦</div><div class="big">You're fired</div><p class="muted">${esc(L.user().name)} have relieved ${esc(G.mgr.name)} of their duties. The phone is ringing, though.</p></div>
      ${offers.map(t => `<button class="pick" data-a="takeJob" data-v="${t.id}" style="${UI.teamVars(t)}">${UI.crest(t, 46)}<div class="grow"><div class="pt">${esc(t.name)}</div><div class="pd">${esc(L.league(t.leagueId).name)} · rep ${t.rep} · ${DATA.CLUB_IDS[t.ident].icon} ${esc(DATA.CLUB_IDS[t.ident].name)}</div></div>${I.chev}</button>`).join('') || '<div class="empty">No offers. Time for a sabbatical.</div>'}
      <button class="btn block mt12" data-a="retire">Retire from management</button></div>`;
  };
  A.takeJob = v => { G.sacked = null; L.takeJob(+v); Career.unlock('job_hopper'); UI.go('hub', { tab: 'home' }); UI.toast(`New job: ${esc(L.user().name)}`); };
  A.retire = () => UI.confirm('Retire?', 'This ends your career and deletes the save.', 'Retire', () => { L.wipe(); UI.go('menu'); }, true);
})();
