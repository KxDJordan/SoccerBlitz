'use strict';
// ── MENU, NEW GAME, ACHIEVEMENTS, SETTINGS ────────────────────────

(() => {
  const { S, A, SCREENS, I, esc } = UI;

  // ── the menu: a live match plays behind the logo ──
  let demo = null;
  function demoSide(id, name, abbr, c1, c2, style, shape) {
    const t = { id: 900 + id, name, abbr, crest: { shape: 'shield', icon: 'ball', c1, c2 }, kit: { style, c1, c2, c3: c1 }, away: { style: 'plain', c1: c2, c2: c1, c3: c2 }, trophies: [] };
    const tac = TAC.make(shape, shape);
    const squad = TAC.formation(shape).slots.map((sl, i) => {
      const a = DATA.ATTRS.map((k, j) => Math.round(U.clamp(72 + (DATA.OVR_W[sl.pos][j] > 0.05 ? U.rand(0, 12) : U.rand(-18, -4)), 20, 95)));
      if (sl.pos !== 'GK') a[DATA.AK.goalkeeping] = 15;
      return { id: -(id * 100 + i + 1), fn: 'Demo', ln: `${abbr}${i}`, nat: U.pick(Object.keys(DATA.NAT_FLAG)), age: U.ri(19, 33), pos: sl.pos, alt: [], a, ovr: 75, fit: 100, pers: U.pick(['flair', 'hothead', 'steady']), num: i + 1 };
    });
    tac.lineup = squad.map(p => p.id);
    return { t, side: { id: t.id, name, short: abbr, squad, tac, ai: true, boost: 1, blitz: true } };
  }
  function startDemo() {
    stopDemo();
    const cv = document.getElementById('menu-cv');
    if (!cv) return;
    const h = demoSide(1, 'Blitz XI', 'BLZ', U.pick(['#E0262F', '#1F4FBF', '#F2B705', '#0E8C8C']), '#F4F5F7', U.pick(['stripes', 'hoops', 'sash', 'plain']), '4-3-3');
    const a = demoSide(2, 'Rest of World', 'ROW', U.pick(['#15181E', '#4B2A85', '#1F8A3C']), U.pick(['#F2B705', '#F4F5F7']), U.pick(['halves', 'band', 'pin']), '4-4-2');
    const wx = U.pick(['clear', 'clear', 'rain', 'snow', 'cloudy']);
    const m = new Engine.Match(h.side, a.side, { seed: U.ri(1, 1e9), weather: DATA.WEATHER[wx] });
    const r = new Render.Pitch(cv, m, { home: h.t, away: a.t, camera: 'follow', ko: U.pick(['night', 'dusk', 'night']) });
    demo = { m, r, acc: 0, last: performance.now(), raf: 0 };
    const loop = now => {
      if (!demo) return;
      const dt = Math.min(0.1, (now - demo.last) / 1000); demo.last = now;
      demo.acc += dt * 1.15 * r.timeScale();
      while (demo.acc >= Engine.TICK) { demo.acc -= Engine.TICK; m.step(); if (m.phase === 'halftime') m.startSecondHalf(); if (m.isFinished()) { startDemo(); return; } }
      r.render(demo.acc / Engine.TICK);
      demo.raf = requestAnimationFrame(loop);
    };
    demo.raf = requestAnimationFrame(loop);
  }
  function stopDemo() { if (demo) { cancelAnimationFrame(demo.raf); demo = null; } }

  SCREENS.menu = () => {
    const has = !!(G && G.ready && G.userTeamId != null);
    const u = has ? L.user() : null;
    return `<div class="screen menu"><canvas id="menu-cv"></canvas><div class="shade"></div>
      <div class="logo-type">Soccer<span>Blitz</span></div>
      <div class="tagline">Build a club. Bend it like the wind. Hit like a freight train. A real-time football manager where tactics, identity and chaos collide.</div>
      ${has ? `<button class="btn primary big block" data-a="continue">${UI.crest(u, 26)} Continue · ${esc(u.name)}</button><div class="tiny muted center mt4">Season ${G.season} · ${L.dateStr()} · ${esc(L.league(u.leagueId).name)}</div>` : ''}
      <div class="grid2 mt12"><button class="btn ${has ? '' : 'primary'} big" data-a="newGame" data-v="career">New Career</button><button class="btn hot big" data-a="newGame" data-v="challenge">Owner Challenge</button></div>
      <div class="grid2 mt8"><button class="btn" data-a="achSheet">${I.trophy} Achievements</button><button class="btn" data-a="settings">${I.gear} Settings</button></div>
      <div class="build">Build ${BUILD} · All clubs, players and leagues are fictional</div></div>`;
  };
  SCREENS.menu.mount = () => startDemo();
  SCREENS.menu.unmount = () => stopDemo();
  SCREENS.menu.resize = () => { if (demo) demo.r.resize(); };

  A.continue = () => { UI.go('hub', { tab: 'home' }); };
  A.newGame = v => {
    const go = () => {
      UI.closeSheet();
      UI.toast('Building the world…', '', 1200);
      setTimeout(() => {
        L.genWorld();
        S.create = { step: v === 'challenge' ? 'challenge' : 'nation', mode: v, nation: 0, tier: 0, team: null, challenge: null, name: '', ident: 'gegenpress' };
        UI.go('new');
      }, 30);
    };
    if (G && G.ready && G.userTeamId != null) UI.confirm('Start over?', 'Your current career will be replaced. Export it from Settings first if you want to keep it.', 'Start new', go, true);
    else go();
  };

  // ── new game flow ──
  SCREENS.new = () => {
    const c = S.create;
    const steps = { challenge: stepChallenge, nation: stepNation, team: stepTeam, manager: stepManager };
    const back = `<button class="icon-btn" data-a="newBack">${I.back}</button>`;
    const titles = { challenge: ['Owner Challenge', 'Pick your mission'], nation: ['Choose a nation', 'Four leagues, two divisions each'], team: ['Choose your club', c.challenge ? Career.CHALLENGES[c.challenge].name : 'Every club has an identity'], manager: ['Your manager', 'Name and philosophy'] };
    const [t, s] = titles[c.step];
    return `<div class="screen">${UI.topbar(t, s, back)}<div class="scroll noTab">${steps[c.step]()}</div></div>`;
  };
  function stepChallenge() {
    return Object.entries(Career.CHALLENGES).map(([id, ch]) => `<button class="pick${S.create.challenge === id ? ' on' : ''}" data-a="pickChallenge" data-v="${id}"><div style="font-size:30px">${ch.icon}</div><div class="grow"><div class="pt">${esc(ch.name)}</div><div class="pd">${esc(ch.desc)}</div><div class="tiny dim mt4">${ch.seasons} season${ch.seasons > 1 ? 's' : ''}</div></div></button>`).join('');
  }
  function stepNation() {
    return DATA.NATIONS.map(n => {
      const top = L.league(n.id * 2).teams.map(L.team).sort((a, b) => b.rep - a.rep).slice(0, 4);
      return `<button class="pick" data-a="pickNation" data-v="${n.id}">${Art.flag(n.name, 40)}<div class="grow"><div class="pt">${esc(n.name)}</div><div class="pd">${esc(n.tiers[0])} · ${esc(n.tiers[1])} · ${esc(n.cup)}</div><div class="flex mt8" style="gap:4px">${top.map(t => UI.crest(t, 24)).join('')}<span class="tiny dim">+20 more</span></div></div>${I.chev}</button>`;
    }).join('');
  }
  function teamPick(t) {
    const lvl = Math.round(L.teamLevel(t)), id = DATA.CLUB_IDS[t.ident];
    const coach = t.coach != null && G.coaches[t.coach] ? G.coaches[t.coach] : null;
    return `<button class="pick${S.create.team === t.id ? ' on' : ''}" data-a="pickTeam" data-v="${t.id}" style="${UI.teamVars(t)}">${UI.crest(t, 48)}<div class="grow"><div class="pt">${esc(t.name)}</div><div class="pd">${id.icon} ${esc(id.name)} · Squad ${lvl} · ${U.money(t.fin.bal)}</div><div class="tiny dim">${esc(t.stadium.name)} · ${t.stadium.cap.toLocaleString()} seats${coach ? '' : ''}</div></div><div class="center"><div class="tiny muted">REP</div><b style="font-family:var(--f-display);font-size:20px">${t.rep}</b></div></button>`;
  }
  function stepTeam() {
    const c = S.create;
    if (c.challenge) {
      const list = Career.CHALLENGES[c.challenge].teams().filter(Boolean).sort((a, b) => b.rep - a.rep);
      return `<p class="small muted">${esc(Career.CHALLENGES[c.challenge].desc)}</p>${list.map(teamPick).join('')}${c.team != null ? `<div style="position:sticky;bottom:10px"><button class="btn primary big block" data-a="toManager">Continue</button></div>` : ''}`;
    }
    const n = c.nation;
    const lg = L.league(n * 2 + c.tier);
    const teams = lg.teams.map(L.team).sort((a, b) => b.rep - a.rep);
    return `<div class="seg"><button class="${c.tier === 0 ? 'on' : ''}" data-a="pickTier" data-v="0">${esc(DATA.NATIONS[n].tiers[0])}</button><button class="${c.tier === 1 ? 'on' : ''}" data-a="pickTier" data-v="1">${esc(DATA.NATIONS[n].tiers[1])}</button></div>
      <p class="tiny muted">${c.tier === 0 ? 'Top flight: bigger budgets, bigger expectations. Bottom two go down.' : 'Second tier: smaller budgets, a hungry crowd. Top two go up.'}</p>
      ${teams.map(teamPick).join('')}${c.team != null ? `<div style="position:sticky;bottom:10px"><button class="btn primary big block" data-a="toManager">Continue</button></div>` : ''}`;
  }
  function stepManager() {
    const c = S.create, t = L.team(c.team), forced = c.challenge === 'blitz';
    return `<div class="hero" style="${UI.teamVars(t)}"><div class="hcrest">${UI.crest(t, 150)}</div><div class="kicker" style="color:rgba(255,255,255,.75)">Your new club</div><div class="nm">${esc(t.name)}</div><div class="sub">${esc(L.league(t.leagueId).name)} · ${DATA.CLUB_IDS[t.ident].icon} ${esc(DATA.CLUB_IDS[t.ident].name)}</div></div>
      <div class="kicker mb8">Manager name</div><input class="txt" id="mgr-name" maxlength="24" placeholder="e.g. Alex Morgan" value="${esc(c.name)}" data-in="mgrName">
      <div class="kicker mt12 mb8">Your philosophy ${forced ? '<span class="tag t-warn">Fixed by the challenge</span>' : ''}</div>
      <p class="tiny muted" style="margin-top:-4px">Your identity sets your default shapes and instructions, gives a small bonus, and follows you to every club. It evolves with the way you actually play.</p>
      <div class="idgrid">${Object.entries(DATA.COACH_IDS).map(([id, ci]) => `<button class="idcard${(forced ? 'blitz' : c.ident) === id ? ' on' : ''}" data-a="${forced ? 'noop' : 'pickIdent'}" data-v="${id}"><div class="ic">${ci.icon}</div><b>${esc(ci.name)}</b><p>${esc(ci.desc)}</p><p class="dim">${ci.oop} out · ${ci.ip} in</p></button>`).join('')}</div>
      <button class="btn primary big block mt12" data-a="startCareer">Take charge</button>`;
  }
  A.newBack = () => {
    const c = S.create;
    const order = c.mode === 'challenge' ? ['challenge', 'team', 'manager'] : ['nation', 'team', 'manager'];
    const i = order.indexOf(c.step);
    if (i <= 0) { G = null; UI.go('menu'); return; }
    c.step = order[i - 1]; UI.render();
  };
  A.pickChallenge = v => { S.create.challenge = v; S.create.team = null; S.create.step = 'team'; UI.render(); };
  A.pickNation = v => { S.create.nation = +v; S.create.tier = 0; S.create.step = 'team'; UI.render(); };
  A.pickTier = v => { S.create.tier = +v; S.create.team = null; UI.render(); };
  A.pickTeam = v => { S.create.team = +v; UI.render(); };
  A.toManager = () => { S.create.step = 'manager'; UI.render(); };
  A.pickIdent = v => { S.create.ident = v; S.create.name = (document.getElementById('mgr-name') || {}).value || S.create.name; UI.render(); };
  A.mgrName = v => { S.create.name = v; };
  A.startCareer = () => {
    const c = S.create;
    const name = ((document.getElementById('mgr-name') || {}).value || c.name || '').trim() || 'The Gaffer';
    L.startCareer({ teamId: c.team, mgrName: name, mgrIdent: c.challenge === 'blitz' ? 'blitz' : c.ident, mode: c.mode, challenge: c.challenge || null });
    S.create = null;
    Sfx.play('win');
    UI.go('hub', { tab: 'home' });
    UI.toast(`Welcome to ${esc(L.user().name)}, ${esc(name)}!`);
  };

  // ── achievements ──
  A.achSheet = () => {
    const list = Career.achList();
    const got = list.filter(a => a.got).length;
    UI.sheet(`<h2>Achievements</h2><div class="flex between mb8"><span class="muted small">${got} of ${list.length} unlocked on this device</span><span class="tag t-acc">${Math.round((got / list.length) * 100)}%</span></div><div class="prog mb12"><i style="width:${(got / list.length) * 100}%"></i></div>
      ${list.map(a => `<div class="ach${a.got ? ' got' : ''}"><div class="ai">${a.icon}</div><div class="grow"><div class="bold">${esc(a.name)} ${a.career ? '<span class="tag t-good">This career</span>' : ''}</div><div class="small muted">${esc(a.desc)}</div></div>${a.got ? `<span class="tiny dim">${new Date(a.got).toLocaleDateString()}</span>` : ''}</div>`).join('')}`);
  };

  // ── settings ──
  A.settings = () => {
    const has = !!(G && G.ready);
    const info = Store.info();
    UI.sheet(`<h2>Settings</h2>
      <div class="row"><div class="grow"><div class="nm">Sound</div><div class="meta">Synthesised crowd, hits and whistles</div></div><button class="btn sm ${Sfx.on ? 'primary' : ''}" data-a="toggleSfx">${Sfx.on ? 'On' : 'Off'}</button></div>
      ${has ? `<div class="row"><div class="grow"><div class="nm">Auto substitutions</div><div class="meta">Your assistant makes tired and injured changes in live matches</div></div><button class="btn sm ${G.settings.autoSub ? 'primary' : ''}" data-a="toggleAutoSub">${G.settings.autoSub ? 'On' : 'Off'}</button></div>
      <div class="row"><div class="grow"><div class="nm">Match camera</div><div class="meta">Follow the ball, or the whole pitch</div></div><button class="btn sm" data-a="toggleCam">${G.settings.cam === 'follow' ? 'Follow' : 'Full pitch'}</button></div>
      <div class="kicker mt12 mb8">Save</div><div class="small muted mb8">Saved on this device${info.db ? ' (IndexedDB)' : ''} · ${(info.size / 1024).toFixed(0)} KB</div>
      <div class="grid2"><button class="btn" data-a="exportSave">Export</button><button class="btn" data-a="importSave">Import</button></div>
      <button class="btn danger block mt8" data-a="deleteSave">Delete career</button>
      <button class="btn block mt8" data-a="toMenu">Main menu</button>` : `<div class="kicker mt12 mb8">Save</div><button class="btn block" data-a="importSave">Import a career</button>`}
      <div class="build">Build ${BUILD}</div>`, { refresh: () => A.settings() });
  };
  A.toggleSfx = () => { Sfx.toggle(); UI.refreshSheet(); };
  A.toggleAutoSub = () => { G.settings.autoSub = !G.settings.autoSub; L.save(); UI.refreshSheet(); };
  A.toggleCam = () => { G.settings.cam = G.settings.cam === 'follow' ? 'full' : 'follow'; L.save(); UI.refreshSheet(); };
  A.exportSave = () => {
    L.flush();
    const txt = L.exportText();
    UI.sheet(`<h2>Export career</h2><p class="small muted">Copy this text somewhere safe. Paste it into Import on any device to continue.</p><textarea class="txt" readonly id="exp">${esc(txt)}</textarea><button class="btn primary block mt8" data-a="copyExport">Copy</button>`);
  };
  A.copyExport = () => { const el = document.getElementById('exp'); el.select(); try { navigator.clipboard.writeText(el.value); UI.toast('Copied'); } catch (e) { document.execCommand('copy'); UI.toast('Copied'); } };
  A.importSave = () => UI.sheet(`<h2>Import career</h2><p class="small muted">Paste an exported career. This replaces anything saved on this device.</p><textarea class="txt" id="imp" placeholder="Paste here"></textarea><button class="btn primary block mt8" data-a="doImport">Import</button>`);
  A.doImport = () => { const v = document.getElementById('imp').value; if (L.importText(v)) { UI.closeSheet(); UI.toast('Career imported'); UI.go('hub', { tab: 'home' }); } else UI.toast('That doesn’t look like a Soccer Blitz save.'); };
  A.deleteSave = () => UI.confirm('Delete career?', 'This permanently deletes the career saved on this device.', 'Delete', () => { L.wipe(); UI.go('menu'); }, true);
  A.toMenu = () => { UI.closeSheet(); L.flush(); UI.go('menu'); };
})();
