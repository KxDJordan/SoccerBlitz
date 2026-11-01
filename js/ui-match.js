'use strict';
// ── MATCH DAY: pre-match, the live broadcast, half-time, the report ──

(() => {
  const { S, A, SCREENS, I, esc } = UI;
  const P = id => G.players[id];
  const T = id => G.teams[id];
  const SPEEDS = [1, 2, 4, 8];

  // ── pre-match ──
  A.prematch = () => {
    const f = L.userFixture();
    if (!f) return;
    const fixes = L.validateUser();
    const side = f.h === G.userTeamId ? 0 : 1, opp = T(side === 0 ? f.a : f.h), u = L.user();
    L.autoLineup(opp);
    const c = opp.coach != null ? G.coaches[opp.coach] : null, ci = c ? DATA.COACH_IDS[c.ident] : null;
    const w = DATA.WEATHER[f.wx.id];
    const keys = L.squad(opp).sort((a, b) => b.ovr - a.ovr).slice(0, 3);
    const xi = u.tac.lineup.map(P).filter(Boolean);
    const tired = xi.filter(p => p.fit < 75);
    const ss = L.strength(u), so = L.strength(opp);
    const edge = (ss.att + ss.mid + ss.def) - (so.att + so.mid + so.def);
    UI.sheet(`<div class="kicker center">${esc(UI.compName(f))}</div>
      <div class="vs"><div class="side">${UI.crest(T(f.h), 62)}<b>${esc(T(f.h).name)}</b></div><div class="mid">VS<small>${L.dateStr()}</small></div><div class="side">${UI.crest(T(f.a), 62)}<b>${esc(T(f.a).name)}</b></div></div>
      <div class="card tight"><div class="flex between">${UI.wxChip(f.wx)}<span class="tiny muted">${f.neutral ? 'Neutral venue' : esc(T(f.h).stadium.name)}</span></div><div class="tiny mt4">${esc(w.tip)}</div></div>
      <div class="card tight"><div class="kicker mb8">Scouting report: ${esc(opp.name)}</div>${c ? `<div class="small">${ci.icon} <b>${esc(c.fn)} ${esc(c.ln)}</b> — ${esc(ci.name)}. Expect a <b>${opp.tac.oop}</b> with ${opp.tac.rOOP.slice(1).map(r => TAC.ROLES[r]).filter(r => r && (r.attack.du > 0.15 || Math.abs(r.attack.dv) > 0.15 || r.attack.du < -0.08)).map(r => r.name).slice(0, 3).join(', ') || 'conventional roles'}.</div>` : ''}<div class="flex mt8" style="gap:6px">${UI.form(opp.form)}<span class="tiny muted">${f.comp === 'L' ? `${U.ord(L.position(opp.id))} in the table` : ''}</span></div>
        <div class="mt8">${keys.map(p => `<div class="flex small" style="padding:3px 0">${UI.posB(p.pos)}<span class="grow">${esc(p.fn[0])}. ${esc(p.ln)}</span>${UI.ovrB(p)}</div>`).join('')}</div></div>
      <div class="card tight"><div class="flex between"><span class="kicker">Your side · ${u.tac.oop}</span><span class="tag ${edge > 6 ? 't-good' : edge < -6 ? 't-bad' : ''}">${edge > 6 ? 'Favourites' : edge < -6 ? 'Underdogs' : 'Even contest'}</span></div>
        ${fixes.length ? `<div class="tiny warn mt4">Auto-replaced: ${esc(fixes.join(', '))}</div>` : ''}${tired.length ? `<div class="tiny warn mt4">Tired legs: ${tired.map(p => esc(p.ln)).join(', ')}</div>` : ''}
        <div class="flex wrap mt8" style="gap:4px">${xi.map(p => `<span class="tag">${p.pos} ${esc(p.ln)}</span>`).join('')}</div></div>
      <div class="grid2"><button class="btn" data-a="tab" data-v="tactics">${I.tactics} Tactics</button><button class="btn" data-a="quickSim">${I.ff} Quick sim</button></div>
      <button class="btn primary big block mt8" data-a="kickoff">${I.whistle} Kick off</button>`);
  };
  A.kickoff = () => {
    const f = L.userFixture();
    if (!f) return;
    UI.closeSheet();
    startLive(f, Play.create(f), { kind: 'senior' });
  };
  A.quickSim = () => {
    const f = L.userFixture();
    if (!f) return;
    UI.closeSheet();
    const { m, res } = Play.quick(f);
    L.simRest();
    S.report = { f, res, m };
    resultSound(f, res);
    UI.go('report');
  };
  A.watchAcad = () => {
    UI.closeSheet();
    const f = L.userAcadFixture();
    if (!f) return;
    if (!Play.enough(f)) { A.simAcad(); return; }
    startLive(f, Play.createAcad(f), { kind: 'acad' });
  };
  A.replayAcad = v => {
    const f = G.fixtures.find(x => x.id === +v);
    if (!f || !f.done) return;
    UI.closeSheet();
    startLive(f, Play.createAcad(f), { kind: 'acad', replay: true });
  };

  // ── the live broadcast ──
  let raf = 0;
  function startLive(f, m, opts) {
    const side = f.h === G.userTeamId ? 0 : 1;
    const [hk, ak] = Art.kitsFor(T(f.h), T(f.a));
    S.live = { f, m, side, opts, speed: G.settings.speed || 2, paused: false, acc: 0, last: 0, shown: 0, ticks: [], hudAt: 0, ended: false, ht: false };
    S.liveSide = side;
    UI.go('match');
    const cv = document.getElementById('pitch');
    const r = new Render.Pitch(cv, m, { home: T(f.h), away: T(f.a), kits: [hk, ak], ko: f.wx ? f.wx.ko : 'day', camera: G.settings.cam || 'follow', onSound: n => Sfx.play(n === 'bighit' ? 'bighit' : n) });
    S.live.r = r;
    fitInsets();
    Sfx.crowdStart();
    Sfx.play('whistle');
    S.live.last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }
  function loop(now) {
    const L0 = S.live;
    if (!L0 || S.screen !== 'match') return;
    const dt = Math.min(0.1, (now - L0.last) / 1000);
    L0.last = now;
    const m = L0.m;
    if (!L0.paused && !L0.ht && !L0.ended) {
      L0.acc += dt * L0.speed * L0.r.timeScale();
      let n = 0;
      while (L0.acc >= Engine.TICK && n++ < 300) {
        L0.acc -= Engine.TICK;
        m.step();
        if (m.phase === 'halftime') { L0.ht = true; L0.acc = 0; Sfx.play('longWhistle'); setTimeout(halftime, 700); break; }
        if (m.isFinished()) { L0.ended = true; Sfx.play('longWhistle'); setTimeout(fulltime, 900); break; }
      }
    }
    L0.r.render(Math.min(1, L0.acc / Engine.TICK));
    if (now - L0.hudAt > 180) { L0.hudAt = now; hud(); }
    raf = requestAnimationFrame(loop);
  }
  function hud() {
    const L0 = S.live, m = L0.m;
    const sc = document.getElementById('sb-score'), ck = document.getElementById('sb-clock'), mo = document.getElementById('mom');
    if (sc) sc.textContent = `${m.score[0]} - ${m.score[1]}`;
    if (ck) ck.textContent = m.phase === 'halftime' ? 'HALF-TIME' : m.isFinished() ? 'FULL-TIME' : `${m.minute}'${m.weather.id !== 'clear' ? ` ${UI.WXI[m.weather.id]}` : ''}`;
    if (mo) { const v = m.momentum; mo.style.left = v >= 0 ? '50%' : `${50 + v * 50}%`; mo.style.width = `${Math.abs(v) * 50}%`; mo.style.background = v >= 0 ? L0.r.kits[0].c1 : L0.r.kits[1].c1; }
    Sfx.crowdLevel(0.3 + Math.abs(m.momentum) * 0.7);
    // ticker: the latest notable events
    const evs = m.events;
    const notable = ['goal', 'red', 'yellow', 'injury', 'sub', 'fire', 'hattrick', 'post', 'save', 'penalty', 'miss', 'pen'];
    for (; L0.shown < evs.length; L0.shown++) {
      const e = evs[L0.shown];
      if (!notable.includes(e.type)) continue;
      if (e.type === 'save' && Math.random() < 0.5) continue;
      if (e.type === 'goal') { const us = e.team === L0.side; U.vibrate(us ? [30, 40, 60] : 20); }
      // add just this line: existing lines stay put (rebuilding them every refresh replayed their animation)
      const tk = document.getElementById('ticker');
      if (!tk) continue;
      const el = document.createElement('div');
      el.className = `tick ${e.type === 'goal' ? 'goal' : e.type === 'red' ? 'red' : e.type === 'fire' || e.type === 'hattrick' ? 'fire' : ''}`;
      el.innerHTML = `<span class="m">${e.min}'</span>${icon(e.type)} ${esc(e.text)}`;
      tk.appendChild(el);
      L0.ticks.push({ el, at: performance.now() });
    }
    // lines fade out after five seconds, and only the latest three stay on screen
    const now = performance.now();
    L0.ticks = L0.ticks.filter((t, i, all) => {
      const keep = now - t.at < 5200 && i >= all.length - 3;
      if (!keep && !t.gone) { t.gone = true; t.el.classList.add('out'); setTimeout(() => t.el.remove(), 320); }
      return keep;
    });
  }
  // the camera frames the pitch between the scoreboard and the controls
  function fitInsets() {
    const L0 = S.live;
    if (!L0 || !L0.r) return;
    const cv = document.getElementById('pitch'), sb = document.querySelector('.screen.match .sb'), dock = document.querySelector('.screen.match .dock');
    if (!cv) return;
    const c = cv.getBoundingClientRect();
    const top = sb ? sb.getBoundingClientRect().bottom - c.top + 10 : 0;
    const bottom = dock ? c.bottom - dock.getBoundingClientRect().top + 6 : 0;
    L0.r.setInsets(top, bottom);
  }
  const icon = t => ({ goal: '⚽', red: '🟥', yellow: '🟨', injury: '🩹', sub: '🔁', fire: '🔥', hattrick: '🎩', post: '🥅', save: '🧤', penalty: '❗', miss: '💨', pen: '🎯' }[t] || '•');

  SCREENS.match = () => {
    const L0 = S.live;
    if (!L0) return SCREENS.hub();
    const f = L0.f, h = T(f.h), a = T(f.a), m = L0.m;
    const [hk, ak] = Art.kitsFor(h, a);
    const acad = L0.opts.kind === 'acad';
    return `<div class="screen match"><canvas id="pitch"></canvas>
      <div class="sb"><div class="tm"><span class="sw" style="background:${hk.c1}"></span>${UI.crest(h, 26)}${esc(h.abbr)}${acad ? '<span class="tiny muted">U18</span>' : ''}</div><div class="sc"><div id="sb-score">${m.score[0]} - ${m.score[1]}</div><div class="clock" id="sb-clock">${m.minute}'</div></div><div class="tm r">${acad ? '<span class="tiny muted">U18</span>' : ''}${esc(a.abbr)}${UI.crest(a, 26)}<span class="sw" style="background:${ak.c1}"></span></div></div>
      <div class="mom"><i id="mom"></i></div>
      ${L0.opts.replay ? '<div class="center tiny" style="position:relative;z-index:3;margin-top:6px;color:#fde047">▶ REPLAY</div>' : ''}
      <div class="ticker" id="ticker"></div>
      <div class="dock">
        <button data-a="livePause" id="btn-pause">${L0.paused ? I.play : I.pause}<span>${L0.paused ? 'Play' : 'Pause'}</span></button>
        <button class="speed" data-a="liveSpeed"><b id="spd">${L0.speed}×</b><span>Speed</span></button>
        ${acad ? '' : `<button data-a="liveTactics">${I.tactics}<span>Tactics</span></button>`}
        <button data-a="liveStats">${I.stats}<span>Stats</span></button>
        <button data-a="liveCam">${I.cam}<span>Camera</span></button>
        <button data-a="liveSkip">${I.skip}<span>Sim</span></button>
      </div><div id="overlay"></div></div>`;
  };
  SCREENS.match.resize = () => { if (S.live && S.live.r) { S.live.r.resize(); fitInsets(); } };
  SCREENS.match.unmount = () => { cancelAnimationFrame(raf); Sfx.crowdStop(); };

  A.livePause = () => { const L0 = S.live; L0.paused = !L0.paused; const b = document.getElementById('btn-pause'); if (b) b.innerHTML = `${L0.paused ? I.play : I.pause}<span>${L0.paused ? 'Play' : 'Pause'}</span>`; };
  A.liveSpeed = () => { const L0 = S.live; L0.speed = SPEEDS[(SPEEDS.indexOf(L0.speed) + 1) % SPEEDS.length]; G.settings.speed = L0.speed; const el = document.getElementById('spd'); if (el) el.textContent = `${L0.speed}×`; };
  A.liveCam = () => { const r = S.live.r; r.camera = r.camera === 'follow' ? 'full' : 'follow'; G.settings.cam = r.camera; UI.toast(r.camera === 'follow' ? '🎥 Following the ball' : '🎥 Full pitch', '', 1100); };
  A.liveSkip = () => {
    const L0 = S.live;
    UI.confirm('Sim to the end?', 'The rest of the match plays out instantly.', 'Sim it', () => {
      const m = L0.m;
      if (m.phase === 'halftime') m.startSecondHalf();
      m.simulateFull();
      L0.ended = true;
      hud();
      fulltime();
    });
  };
  A.liveStats = () => {
    const L0 = S.live;
    L0.paused = true;
    statsSheet(L0.m, L0.f, L0.side);
    S.onSheetClose = () => { L0.paused = false; };
  };
  function statsSheet(m, f, side) {
    const s = m.summary(), h = T(f.h), a = T(f.a);
    UI.sheet(`<h2>Match stats</h2>${statBars(s, h, a)}<div class="kicker mt12 mb8">Your players</div>${ratingsList(m, side)}`);
  }
  function statBars(s, h, a) {
    const [x, y] = s.stats;
    const row = (label, v0, v1, fmt = v => v) => { const t = (v0 + v1) || 1; return `<div class="statrow"><b>${fmt(v0)}</b><div><div class="c">${label}</div><div class="duo"><i style="width:${(v0 / t) * 100}%;background:${h.kit.c1 === '#F4F5F7' ? '#cbd5e1' : h.kit.c1}"></i><i style="width:${(v1 / t) * 100}%;background:${a.kit.c1 === '#F4F5F7' ? '#cbd5e1' : a.kit.c1}"></i></div></div><b>${fmt(v1)}</b></div>`; };
    return `<div class="flex between mb8"><span class="flex" style="gap:6px">${UI.crest(h, 22)}<b>${esc(h.abbr)}</b></span><span class="flex" style="gap:6px"><b>${esc(a.abbr)}</b>${UI.crest(a, 22)}</span></div>
      ${row('Possession', x.possPct, y.possPct, v => `${v}%`)}${row('Shots', x.shots, y.shots)}${row('On target', x.onTarget, y.onTarget)}${row('Expected goals', +x.xg.toFixed(2), +y.xg.toFixed(2), v => v.toFixed(2))}${row('Passes completed', x.passesOk, y.passesOk)}${row('Tackles won', x.tacklesWon, y.tacklesWon)}${row('Big hits 💥', x.hits, y.hits)}${row('Corners', x.corners, y.corners)}${row('Fouls', x.fouls, y.fouls)}${row('Cards', x.yellows + x.reds * 2, y.yellows + y.reds * 2)}${x.woodwork + y.woodwork ? row('Woodwork', x.woodwork, y.woodwork) : ''}`;
  }
  function ratingsList(m, side) {
    const ps = m.players.filter(p => p.team === side && m.minutesPlayed(p) > 0).sort((a, b) => a.slot - b.slot || a.onAt - b.onAt);
    return ps.map(p => { const r = m.rating(p); return `<div class="row" style="min-height:42px">${UI.face(p.data, 32)}<div class="grow"><div class="small bold">${esc(p.data.ln)} ${p.active ? '' : p.sentOff ? '🟥' : '<span class="tiny muted">(off)</span>'}${m.time < p.fire ? ' 🔥' : ''}</div><div class="tiny muted">${p.ps.goals ? `⚽×${p.ps.goals} ` : ''}${p.ps.assists ? `🅰×${p.ps.assists} ` : ''}${p.ps.tacklesWon ? `${p.ps.tacklesWon} tkl ` : ''}${p.ps.hits ? `💥${p.ps.hits} ` : ''}${p.ps.saves ? `${p.ps.saves} saves ` : ''}· ${Math.round(p.stamina * 100)}% fit</div></div>${UI.rating(r)}</div>`; }).join('');
  }
  // live tactics: edit a copy, push it into the engine as you go
  A.liveTactics = () => {
    const L0 = S.live, m = L0.m, side = L0.side;
    L0.paused = true;
    const tac = TAC.clone(m.tac(side));
    const squad = m.teams[side].squad;
    S.liveTac = {
      tac, squad, live: m,
      liveInfo: () => ({ benchIds: m.benchFor(side, 'MF').map(p => p.id).concat((tac.bench || []).filter(id => !m.players.some(q => q.team === side && q.data.id === id))).filter((v, i, a) => a.indexOf(v) === i), subsLeft: m.maxSubs - m.subsUsed[side] }),
      onChange: () => { m.applyTactics(side, tac); },
      sub: (i, bid) => {
        const outId = tac.lineup[i];
        if (m.subsUsed[side] >= m.maxSubs) { UI.toast('No substitutions left.'); return; }
        if (m.sub(side, outId, bid)) {
          tac.lineup = [...m.tac(side).lineup];
          tac.bench = [...m.tac(side).bench];
          UI.toast('🔁 Substitution made', '', 1200);
        } else UI.toast('That change isn\'t possible right now.');
        UI.refreshSheet();
      },
    };
    UI.tacticsSheet(S.liveTac.liveInfo());
    S.onSheetClose = () => { m.applyTactics(side, tac); S.liveTac = null; if (!L0.ht) L0.paused = false; };
  };

  function halftime() {
    const L0 = S.live;
    if (!L0) return;
    const m = L0.m, f = L0.f, acad = L0.opts.kind === 'acad';
    const ov = document.getElementById('overlay');
    if (!ov) return;
    const s = m.summary();
    ov.innerHTML = `<div class="ht"><div class="box"><div class="kicker center">Half-time</div><div class="vs" style="margin:6px 0 10px"><div class="side">${UI.crest(T(f.h), 44)}</div><div class="mid" style="color:var(--text);font-size:40px">${m.score[0]}-${m.score[1]}</div><div class="side">${UI.crest(T(f.a), 44)}</div></div>${statBars(s, T(f.h), T(f.a))}
      ${acad ? '' : `<div class="kicker mt12 mb8">Team talk</div><div class="grid3"><button class="btn sm" data-a="talk" data-v="calm">😌 Calm</button><button class="btn sm" data-a="talk" data-v="fire">🔥 Fire up</button><button class="btn sm" data-a="talk" data-v="praise">👏 Praise</button></div>`}
      <div class="grid2 mt12">${acad ? '<span></span>' : `<button class="btn" data-a="liveTactics">${I.tactics} Tactics</button>`}<button class="btn primary" data-a="secondHalf">Second half ${I.play}</button></div></div></div>`;
  }
  A.talk = v => {
    const L0 = S.live, m = L0.m, side = L0.side;
    const diff = m.score[side] - m.score[1 - side];
    let msg;
    const mine = m.players.filter(p => p.team === side && p.active);
    if (v === 'fire') { const ok = diff <= 0; for (const p of mine) p.boost *= ok ? 1.03 : 0.99; msg = ok ? 'The dressing room is buzzing. They charge out.' : 'They look rattled — you were already winning.'; }
    else if (v === 'calm') { const ok = diff >= 0; for (const p of mine) { p.stamina = Math.min(1, p.stamina + 0.03); if (ok) p.boost *= 1.015; } msg = ok ? 'Calm heads. Keep doing what we\'re doing.' : 'Too calm? They need a kick.'; }
    else { const ok = diff > 0; for (const p of mine) p.boost *= ok ? 1.025 : 1; msg = ok ? 'They lap it up.' : 'Praise for what, exactly?'; }
    UI.toast(`🗣️ ${esc(msg)}`, '', 2600);
    document.querySelectorAll('[data-a="talk"]').forEach(b => b.setAttribute('disabled', ''));
  };
  A.secondHalf = () => {
    const L0 = S.live;
    L0.m.startSecondHalf();
    L0.ht = false; L0.paused = false;
    document.getElementById('overlay').innerHTML = '';
    Sfx.play('whistle');
  };
  function fulltime() {
    const L0 = S.live;
    if (!L0 || L0.finalised) return;
    L0.finalised = true;
    const { f, m, opts } = L0;
    if (opts.replay) {
      const ov = document.getElementById('overlay');
      if (ov) ov.innerHTML = `<div class="ht"><div class="box center"><div class="kicker">Replay over</div><div class="big mt8">${m.score[0]} - ${m.score[1]}</div><button class="btn primary block mt12" data-a="leaveLive">Back</button></div></div>`;
      return;
    }
    const res = Play.finish(f, m, true);
    if (opts.kind === 'acad') {
      const ov = document.getElementById('overlay'), side = L0.side;
      const won = res.score[side] > res.score[1 - side];
      const best = res.players.slice().sort((a, b) => b.rating - a.rating)[0];
      if (ov) ov.innerHTML = `<div class="ht"><div class="box"><div class="kicker center">Academy full-time</div><div class="vs"><div class="side">${UI.crest(T(f.h), 44)}<b class="small">${esc(T(f.h).abbr)} U18</b></div><div class="mid" style="color:var(--text);font-size:40px">${res.score[0]}-${res.score[1]}</div><div class="side">${UI.crest(T(f.a), 44)}<b class="small">${esc(T(f.a).abbr)} U18</b></div></div>
        <p class="center small ${won ? 'good' : 'muted'}">${won ? 'The kids win!' : res.score[side] === res.score[1 - side] ? 'A draw for the kids.' : 'A lesson for the kids.'}</p>${best && P(best.pid) ? `<div class="center small">⭐ Standout: <b>${esc(P(best.pid).fn)} ${esc(P(best.pid).ln)}</b> (${best.rating})</div>` : ''}
        <button class="btn primary block mt12" data-a="leaveLive">Continue</button></div></div>`;
      return;
    }
    L.simRest();
    S.report = { f, res, m };
    // a tie decided on penalties: play the shoot-out out on screen before the report
    if (res.pens && m.kicks) return shootout(f, m, res);
    resultSound(f, res);
    setTimeout(() => { if (S.screen === 'match') UI.go('report'); }, 400);
  }
  function shootout(f, m, res) {
    const ov = document.getElementById('overlay');
    if (!ov) { UI.go('report'); return; }
    const h = T(f.h), a = T(f.a), side = f.h === G.userTeamId ? 0 : 1;
    const order = [];
    for (let i = 0; i < Math.max(m.kicks[0].length, m.kicks[1].length); i++) for (const t of [0, 1]) if (m.kicks[t][i]) order.push({ t, ...m.kicks[t][i] });
    const row = (t, team) => `<div class="flex mt8" style="gap:8px">${UI.crest(team, 30)}<b class="small" style="min-width:42px">${esc(team.abbr)}</b><div class="flex wrap grow" style="gap:5px" id="pk${t}"></div><b class="big" id="pks${t}" style="font-size:26px">0</b></div>`;
    ov.innerHTML = `<div class="ht"><div class="box"><div class="kicker center">Penalty shoot-out</div><div class="center small muted mt4">${res.score[0]}-${res.score[1]} after 90 minutes</div>${row(0, h)}${row(1, a)}<div class="center bold mt12" id="pkmsg" style="min-height:22px"></div><div id="pkbtn"></div></div></div>`;
    const score = [0, 0];
    let i = 0;
    const next = () => {
      if (S.screen !== 'match') return;
      if (i >= order.length) {
        const won = res.pens[side] > res.pens[1 - side];
        const msg = document.getElementById('pkmsg'), btn = document.getElementById('pkbtn');
        if (msg) { msg.textContent = won ? '🎉 You win the shoot-out!' : `💔 ${T(side === 0 ? f.a : f.h).name} win the shoot-out`; msg.className = `center bold mt12 ${won ? 'good' : 'bad'}`; }
        if (btn) btn.innerHTML = '<button class="btn primary block mt12" data-a="toReport">Full-time report</button>';
        resultSound(f, res);
        return;
      }
      const k = order[i++], p = G.players[k.pid];
      if (k.ok) score[k.t]++;
      const box = document.getElementById(`pk${k.t}`), sc = document.getElementById(`pks${k.t}`), msg = document.getElementById('pkmsg');
      if (box) box.insertAdjacentHTML('beforeend', `<span class="tag ${k.ok ? 't-good' : 't-bad'}" title="${p ? esc(p.ln) : ''}">${k.ok ? '✓' : '✗'}</span>`);
      if (sc) sc.textContent = score[k.t];
      if (msg) { msg.textContent = `${p ? `${p.fn[0]}. ${p.ln}` : 'Kick'} ${k.ok ? 'scores!' : 'misses!'}`; msg.className = `center bold mt12 ${k.ok ? '' : 'warn'}`; }
      Sfx.play(k.ok ? 'kick' : 'post');
      setTimeout(next, 750);
    };
    setTimeout(next, 900);
  }
  A.toReport = () => UI.go('report');
  function resultSound(f, res) {
    const side = f.h === G.userTeamId ? 0 : 1;
    const w = L.winnerOf(f) === G.userTeamId && !(res.score[0] === res.score[1] && !res.pens);
    if (w) Sfx.play('win'); else if (res.score[side] < res.score[1 - side]) Sfx.play('loss');
  }
  A.leaveLive = () => { S.live = null; UI.go('hub', { tab: S.tab === 'tactics' ? 'home' : S.tab || 'home' }); };

  // ── the report ──
  SCREENS.report = () => {
    const R = S.report;
    if (!R) return SCREENS.hub();
    const { f, res, m } = R, h = T(f.h), a = T(f.a), side = f.h === G.userTeamId ? 0 : 1;
    const us = res.score[side], them = res.score[1 - side];
    const won = us > them || (us === them && res.pens && res.pens[side] > res.pens[1 - side]);
    const verdict = res.pens && us === them ? (won ? 'Victory on penalties' : 'Defeat on penalties') : won ? 'Victory' : us === them ? 'Draw' : 'Defeat';
    const goals = s => res.events.filter(e => e.type === 'goal' && e.team === s).map(e => `<div class="tiny">${e.pid && P(e.pid) ? esc(P(e.pid).ln) : 'OG'} ${e.min}'</div>`).join('');
    const motm = res.motm ? P(res.motm) : null;
    const mom = res.mom || [];
    const pts = mom.map((v, i) => `${(i / Math.max(1, mom.length - 1)) * 100},${50 - v * 45}`).join(' ');
    const others = L.todays(f.day).filter(x => x.comp === f.comp && x.id !== f.id && x.done && (f.comp !== 'L' || x.lg === f.lg));
    return `<div class="screen">${UI.topbar(verdict, esc(UI.compName(f)))}<div class="scroll noTab">
      <div class="hero" style="${UI.teamVars(won ? L.user() : T(side === 0 ? f.a : f.h))}"><div class="vs" style="margin:0"><div class="side">${UI.crest(h, 64)}<b style="color:#fff">${esc(h.name)}</b>${goals(0)}</div><div class="mid" style="color:#fff;font-size:52px">${res.score[0]}-${res.score[1]}${res.pens ? `<small style="color:#fff">${res.pens[0]}-${res.pens[1]} on penalties · ${esc(T(L.winnerOf(f)).abbr)} go through</small>` : ''}</div><div class="side">${UI.crest(a, 64)}<b style="color:#fff">${esc(a.name)}</b>${goals(1)}</div></div></div>
      ${motm ? `<div class="card tight"><div class="row tap" data-a="player" data-v="${motm.id}" style="border:0">${UI.face(motm, 46)}<div class="grow"><div class="kicker">⭐ Player of the match</div><div class="nm">${esc(motm.fn)} ${esc(motm.ln)}</div><div class="meta">${esc(T(motm.tid) ? T(motm.tid).name : '')}</div></div>${UI.rating((res.players.find(p => p.pid === motm.id) || {}).rating || 0)}</div></div>` : ''}
      ${mom.length > 4 ? `<div class="card"><h3>Momentum</h3><svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:80px"><line x1="0" y1="50" x2="100" y2="50" stroke="var(--line-strong)" stroke-width=".6"/><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg><div class="flex between tiny muted"><span>▲ ${esc(h.abbr)}</span><span>▼ ${esc(a.abbr)}</span></div></div>` : ''}
      <div class="card">${statBars(res, h, a)}</div>
      ${m ? `<div class="card"><h3>Player ratings</h3>${ratingsList(m, side)}</div>` : ''}
      ${others.length ? `<div class="card"><h3>Around the ${f.comp === 'L' ? esc(L.league(f.lg).name) : 'competition'}</h3>${others.map(x => `<div class="flex small" style="padding:5px 0"><span class="grow flex" style="justify-content:flex-end;gap:6px">${esc(T(x.h).abbr)}${UI.crest(T(x.h), 18)}</span><b style="min-width:44px;text-align:center;font-family:var(--f-display)">${x.hs}-${x.as}</b><span class="grow flex" style="gap:6px">${UI.crest(T(x.a), 18)}${esc(T(x.a).abbr)}</span></div>`).join('')}</div>` : ''}
      <button class="btn primary big block" data-a="reportDone">Continue</button></div></div>`;
  };
  A.reportDone = () => { S.report = null; S.live = null; News.roundUp(G.day); L.save(); UI.go('hub', { tab: 'home' }); };
})();
