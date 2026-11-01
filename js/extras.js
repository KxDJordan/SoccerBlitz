'use strict';
// ── EXTRAS: kit & badge designs earned through milestones, Goal of the Season, highlight commentary,
// and the pitch itself: its condition, frozen and waterlogged postponements, heatwave fallout ──
const Xtra = (() => {
  const u = () => L.user();
  const yd = m => Math.round(m * 1.09);

  // ════════ DESIGNS YOU EARN ════════
  const UNLOCKS = [
    { id: 'quarters', kind: 'style', name: 'Quartered shirt', how: 'Win promotion', ok: () => !!G.ach.promoted },
    { id: 'fade', kind: 'style', name: 'Fade shirt', how: 'Win 40 matches as a manager', ok: () => G.mgr.w >= 40 },
    { id: 'goldpin', kind: 'style', name: 'Gold pinstripe', how: 'Win a league title', ok: () => !!G.ach.champion },
    { id: 'starband', kind: 'style', name: 'Star band', how: () => `Win the ${DATA.CONTINENTAL}`, ok: () => !!G.ach.continental },
    { id: 'trophy', kind: 'icon', name: 'Trophy emblem', how: 'Win any trophy', ok: () => G.mgr.trophies >= 1 },
    { id: 'laurel', kind: 'icon', name: 'Laurel emblem', how: 'Win a national cup', ok: () => !!G.ach.cup },
    { id: 'rocket', kind: 'icon', name: 'Rocket emblem', how: 'Take the club to reputation 80', ok: () => u().rep >= 80 },
    { id: 'castle', kind: 'icon', name: 'Castle emblem', how: 'Win 100 matches as a manager', ok: () => G.mgr.w >= 100 },
    { id: 'octagon', kind: 'shape', name: 'Octagon badge', how: 'Give five academy players their debut', ok: () => (G.stats.youthDebuts || 0) >= 5 },
    { id: 'royal', kind: 'shape', name: 'Royal badge', how: 'Win three trophies', ok: () => G.mgr.trophies >= 3 },
    { id: 'gold', kind: 'trim', name: 'Gold badge trim', how: 'Win the league and cup double', ok: () => !!G.ach.double },
  ];
  const how = x => (typeof x.how === 'function' ? x.how() : x.how);
  const has = id => !!(G.unlocks || {})[id];
  function checkUnlocks() {
    if (!G || !G.ready) return;
    G.unlocks = G.unlocks || {};
    G.ach = G.ach || {};
    for (const x of UNLOCKS) {
      if (has(x.id)) continue;
      let ok = false;
      try { ok = x.ok(); } catch (e) { ok = false; }
      if (!ok) continue;
      G.unlocks[x.id] = G.season;
      Career.inbox({ type: 'unlock', title: `🎨 New design unlocked: ${x.name}`, body: `${how(x)}: done. It's ready to use in Club → Identity → Kit & badge studio.`, actions: [{ label: 'Open the studio', act: 'club', v: 'identity' }] });
    }
  }
  // what the studio offers: the base set plus whatever has been earned
  function options(kind) {
    const base = kind === 'style' ? DATA.KIT_STYLES : kind === 'shape' ? DATA.CREST_SHAPES : kind === 'icon' ? DATA.CREST_ICONS : [];
    return base.map(id => ({ id, name: id[0].toUpperCase() + id.slice(1), locked: false }))
      .concat(UNLOCKS.filter(x => x.kind === kind).map(x => ({ id: x.id, name: x.name.replace(/ (shirt|emblem|badge)$/, ''), locked: !has(x.id), how: how(x) })));
  }
  function design(field, val) {
    const t = u();
    const lock = UNLOCKS.find(x => x.id === val && ['style', 'shape', 'icon'].includes(field) && x.kind === field);
    if (lock && !has(lock.id)) return { ok: false, why: `Locked: ${how(lock)}.` };
    if (field === 'style') t.kit.style = val;
    else if (field === 'shape') t.crest.shape = val;
    else if (field === 'icon') t.crest.icon = val;
    else if (field === 'trim') { if (!has('gold')) return { ok: false, why: `Locked: ${how(UNLOCKS.find(x => x.id === 'gold'))}.` }; t.crest.trim = t.crest.trim === 'gold' ? null : 'gold'; }
    else if (field === 'c1' || field === 'c2') {
      const other = field === 'c1' ? t.kit.c2 : t.kit.c1;
      if (U.cdist(val, other) < 60) return { ok: false, why: 'Pick two colours that stand apart.' };
      t.kit[field] = val; t.crest[field] = val; if (field === 'c2') t.crest.c3 = val;
      t.away = { style: 'plain', c1: t.kit.c2, c2: t.kit.c1, c3: t.kit.c2 };
    } else if (field === 'shorts') t.kit.c3 = val;
    else return { ok: false, why: '' };
    L.save();
    return { ok: true };
  }

  // ════════ GOAL OF THE SEASON ════════
  const SK_WORTH = { power: 4, curl: 3, chip: 3.5, fk: 4, bike: 6 };
  function goalScore(g) {
    if (g.sk === 'pen') return 0.3;
    let q = Math.max(0, (g.d || 10) - 8) * 0.35 + (SK_WORTH[g.sk] || 0);
    if (g.header) q += 1.5 + Math.max(0, (g.d || 8) - 10) * 0.3;
    if (g.beat) q += 3.5;
    if (!g.header && g.carry > 3) q += Math.min(4, (g.carry - 3) * 0.8);
    return +(q + Math.random() * 1.2).toFixed(2);
  }
  function goalDesc(g) {
    const d = yd(g.d || 10);
    if (g.sk === 'pen') return 'a coolly taken penalty';
    if (g.sk === 'bike') return 'an overhead bicycle kick';
    let main = g.sk === 'fk' ? `a ${d}-yard free kick` : g.sk === 'power' ? `a ${d}-yard thunderbolt` : g.sk === 'curl' ? (d > 14 ? `a curler from ${d} yards` : 'a curled finish') : g.sk === 'chip' ? 'a delicate chip over the keeper'
      : g.header ? (d > 12 ? `a towering header from ${d} yards` : 'a bullet header') : d > 22 ? `a long-range strike from ${d} yards` : d > 14 ? `a drilled finish from ${d} yards` : 'a close-range finish';
    const extra = [g.beat && 'beating his man with a skill move', !g.header && g.carry > 5 && 'a solo run'].filter(Boolean);
    return extra.length ? `${main} after ${extra.join(' and ')}` : main;
  }
  function logGoals(f, m) {
    if (f.comp === 'A' || !m.goalLog) return;
    const side = f.h === G.userTeamId ? 0 : f.a === G.userTeamId ? 1 : -1;
    if (side < 0) return;
    G.gots = G.gots || [];
    for (const g of m.goalLog) {
      if (g.team !== side || !g.pid || g.og) continue;
      G.gots.push({ pid: g.pid, s: G.season, day: f.day, min: g.min, opp: side === 0 ? f.a : f.h, desc: goalDesc(g), q: goalScore(g) });
    }
    G.gots.sort((a, b) => b.q - a.q);
    if (G.gots.length > 12) G.gots.length = 12;
  }
  // end of the season: the best three goals go to a vote
  function seasonVote() {
    const noms = (G.gots || []).filter(x => x.s === G.season && G.players[x.pid]).slice(0, 3);
    G.gots = [];
    if (noms.length < 2) return;
    const line = (x, i) => { const p = G.players[x.pid], o = L.team(x.opp); return `${i + 1}. ${p.fn} ${p.ln} vs ${o ? o.abbr : '?'} (${L.dateStr(x.day, true)}, ${x.min}'): ${x.desc}.`; };
    Career.inbox({ type: 'vote', nom: noms, title: '🗳️ Goal of the Season: cast your vote', body: `The nominees for ${u().name}'s Goal of the Season:\n${noms.map(line).join('\n')}`, actions: noms.map((x, i) => ({ label: `${G.players[x.pid].ln} vs ${L.team(x.opp) ? L.team(x.opp).abbr : '?'}`, act: 'gotsVote', v: i })), expires: DATA.SEASON.LEN - 1 });
  }
  function vote(m, i) {
    const x = m.nom && m.nom[i], p = x && G.players[x.pid];
    if (!p) return 'That nominee has left the club.';
    const fans = m.nom.reduce((b, y, k) => (y.q > m.nom[b].q ? k : b), 0);
    p.mor = Math.min(100, p.mor + 12);
    p.gots = (p.gots || 0) + 1;
    (G.gotsHist = G.gotsHist || []).push({ s: x.s, pid: p.id, name: `${p.fn} ${p.ln}`, club: u().name, desc: x.desc, opp: L.team(x.opp) ? L.team(x.opp).name : '' });
    News.event(`${p.fn} ${p.ln} wins Goal of the Season`, `${u().name}'s Goal of the Season: ${x.desc} against ${L.team(x.opp) ? L.team(x.opp).name : 'the opposition'}.`, 'club');
    if (i === fans) { u().rep = Math.min(99, u().rep + 1); return `${p.ln} wins it, and the fans agree: club reputation +1, ${p.ln} morale +12. It's in the museum.`; }
    const f = G.players[m.nom[fans].pid];
    return `${p.ln} wins it (morale +12; it's in the museum). The terraces would have picked ${f ? f.ln : 'another one'}.`;
  }

  // ════════ COMMENTARY FOR THE HIGHLIGHTS ════════
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const nm = d => (d ? d.ln : 'him');
  const comm = {
    goal: (g, d) => {
      if (!g || g.og) return pick(['Own goal! Calamity at the back.', 'Off the defender and in! An own goal.']);
      const s = goalDesc(g);
      const big = goalScore({ ...g }) > 6;
      return `${nm(d)}! ${s[0].toUpperCase() + s.slice(1)}. ${big ? pick(['What a goal!', 'Sensational!', 'Unbelievable!', 'That is special.']) : pick(['Get in!', 'Into the net.', 'He makes no mistake.', 'Clinical.'])}`;
    },
    save: (k, s) => pick([`What a save from ${nm(k)}!`, `${nm(k)} at full stretch to deny ${nm(s)}!`, `Denied! ${nm(k)} keeps it out.`, `${nm(s)} thought he'd scored. Not against ${nm(k)}.`]),
    post: s => pick([`${nm(s)} rattles the woodwork!`, `Off the frame! So close from ${nm(s)}.`, `${nm(s)} hits the post. Agony.`]),
    skill: (a, move, v) => pick([`${nm(a)} with the ${move}: ${nm(v)} is left for dead!`, `Look at this from ${nm(a)}. The ${move}, and ${nm(v)} is on the floor.`, `${move} from ${nm(a)}. ${nm(v)} bought the dummy.`]),
  };

  // ════════ THE PITCH ════════
  const winter = () => Math.max(0, Math.sin(Math.PI * Math.min(1, G.day / DATA.SEASON.LEN) * 0.92));
  const pitch = t => (t.pitch == null ? (t.pitch = 88) : t.pitch);
  const heated = t => (L.isUser(t.id) ? ((t.biz && t.biz.heating) || 0) >= 1 : t.rep >= 70);
  const drained = t => (L.isUser(t.id) ? ((t.biz && t.biz.heating) || 0) >= 2 : t.rep >= 85);
  function pitchLabel(v) { return v >= 85 ? 'Pristine' : v >= 70 ? 'Good' : v >= 50 ? 'Worn' : v >= 30 ? 'Bobbly' : 'Mudbath'; }
  // a churned-up surface: heavier touches, a ball that holds up, passes that bobble
  function pitchWeather(f, w) {
    if (f.comp === 'A' || f.neutral) return w;
    const t = L.team(f.h), v = pitch(t);
    if (v >= 70) return w;
    const k = (70 - v) / 70, x = w.weather;
    return { ...w, weather: { ...x, touch: (x.touch || 1) * (1 + 0.45 * k), passErr: (x.passErr || 1) * (1 + 0.1 * k), groundK: (x.groundK || 1) * (1 + 0.18 * k), footing: (x.footing || 1) * (1 - 0.04 * k) }, pitch: v };
  }
  function daily() {
    for (const t of G.teams) {
      const v = pitch(t);
      // grass barely grows in winter; the summer break brings it back
      const grow = G.phase === 'post' ? 2.5 : 0.45 * (1 - 0.7 * winter()) + (drained(t) ? 0.25 : 0);
      t.pitch = Math.min(96, +(v + grow).toFixed(1));
    }
    morning();
  }
  // a home game wears the pitch; weather does the real damage
  function afterMatch(f, res) {
    if (f.comp === 'A' || f.neutral) return;
    const t = L.team(f.h), wx = f.wx ? f.wx.id : 'clear';
    let dmg = 3.5 + ({ rain: 6, storm: 10, snow: 7 }[wx] || 0);
    if (wx === 'snow' && heated(t)) dmg = 5;
    if ((wx === 'rain' || wx === 'storm') && drained(t)) dmg = 3.5 + (dmg - 3.5) / 2;
    t.pitch = Math.max(8, +(pitch(t) - dmg).toFixed(1));
    // fallout for the user's players
    const side = f.h === G.userTeamId ? 0 : f.a === G.userTeamId ? 1 : -1;
    if (side < 0 || !res.players) return;
    const mine = res.players.filter(x => x.team === side && x.min > 0).map(x => ({ x, p: G.players[x.pid] })).filter(o => o.p && o.p.inj <= 0);
    if (wx === 'heat') {
      for (const { x, p } of mine) if (x.min >= 70 && (x.fit != null ? x.fit : p.fit) < 45 && Math.random() < 0.14) {
        p.inj = U.ri(2, 5);
        Career.inbox({ type: 'injury', title: `${p.ln} suffers heat exhaustion`, body: `${p.fn} ${p.ln} ran himself into the ground in the heat. Out for ${p.inj} days.` });
      }
    }
    const v = L.team(f.h).pitch;
    if ((v < 40 || wx === 'snow') && mine.length && Math.random() < (v < 25 ? 0.22 : 0.12)) {
      const { p } = U.pick(mine);
      p.inj = U.ri(3, 10);
      Career.inbox({ type: 'injury', title: `${p.ln} hurt on the ${wx === 'snow' ? 'frozen' : 'heavy'} pitch`, body: `${p.fn} ${p.ln} went over on ${wx === 'snow' ? 'the icy surface' : 'a rutted, churned-up surface'} at ${L.team(f.h).stadium.name}. Out for ${p.inj} days.` });
    }
  }
  // the morning inspection: frozen or waterlogged pitches get the game called off and squeezed in later
  function morning() {
    const SEA = DATA.SEASON;
    if (G.phase !== 'season' || G.day > SEA.END - 6) return;
    for (const f of L.todays()) {
      if (f.done || f.comp !== 'L' || f.neutral || f.postponed) continue;
      const t = L.team(f.h), v = pitch(t), wx = f.wx ? f.wx.id : 'clear';
      const risk = wx === 'snow' ? (heated(t) ? 0 : 0.3 + (v < 60 ? 0.2 : 0)) : wx === 'storm' ? (v < 45 ? 0.35 : 0.05) : wx === 'rain' ? (v < 25 ? 0.3 : 0) : 0;
      if (!risk || Math.random() > risk) continue;
      const ids = [f.h, f.a];
      const busy = d => G.fixtures.some(x => x !== f && x.comp !== 'A' && !x.done && Math.abs(x.day - d) <= 1 && (ids.includes(x.h) || ids.includes(x.a)));
      let nd = null;
      for (let d = G.day + 3; d <= SEA.END - 1; d++) if (!busy(d)) { nd = d; break; }
      if (nd == null) continue;
      f.day = nd; f.postponed = 1; f.wx = L.rollWeather(nd);
      const why = wx === 'snow' ? `A frozen pitch at ${t.stadium.name} failed the morning inspection` : `${t.stadium.name} is waterlogged after the ${wx === 'storm' ? 'storm' : 'rain'}`;
      if (ids.includes(G.userTeamId)) {
        const near = G.fixtures.filter(x => x !== f && x.comp !== 'A' && !x.done && (x.h === G.userTeamId || x.a === G.userTeamId)).map(x => Math.abs(x.day - nd)).sort((a, b) => a - b)[0];
        const tip = near != null && near <= 3 ? ` That's only ${Math.round(near * 1.8)} days from another game: expect tired legs and rotate.` : '';
        Career.inbox({ type: 'event', title: `${wx === 'snow' ? '❄️' : '🌧️'} Postponed: ${t.abbr} v ${L.team(f.a).abbr}`, body: `${why}. The game is rearranged for ${L.dateStr(nd)}.${tip}${L.isUser(t.id) && !heated(t) && wx === 'snow' ? ' Undersoil heating (Finance → Matchday) would stop this happening.' : ''}` });
        News.event(`${t.name} v ${L.team(f.a).name} postponed`, `${why}. The fixture is rearranged for ${L.dateStr(nd)}.`, 'club');
      }
    }
    // a heatwave on the way for the user's next game
    const nf = G.fixtures.find(x => !x.done && x.day === G.day + 1 && x.comp !== 'A' && (x.h === G.userTeamId || x.a === G.userTeamId));
    if (nf && nf.wx && nf.wx.id === 'heat') {
      const opp = L.team(nf.h === G.userTeamId ? nf.a : nf.h);
      Career.inbox({ type: 'event', title: '🔥 Heatwave forecast for tomorrow', body: `${nf.wx.temp}°C expected against ${opp.name}. Legs go fast in this: anyone below 80% fitness who plays the full game risks heat exhaustion. Rotate, and sub early.` });
    }
  }

  return { UNLOCKS, has, checkUnlocks, options, design, goalDesc, goalScore, logGoals, seasonVote, vote, comm, pitch, pitchLabel, pitchWeather, heated, daily, afterMatch };
})();
