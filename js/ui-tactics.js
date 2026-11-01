'use strict';
// ── TACTICS BOARD ─────────────────────────────────────────────────
// One formation. Each player's role decides how he moves: where he drifts when his side has the ball and where
// he holds when it doesn't, stretched or tempered by his focus (Defend / Balanced / Attack). The board shows
// both: flip between "With the ball" and "Without the ball" to watch every token slide to his role's zone.

(() => {
  const { S, A, SCREENS, I, esc } = UI;
  const P = id => G.players[id];
  const DEPTH = 0.42; // roles shift in pitch units; the board draws the team block

  // the tactics being edited: the club's own in the hub, a live copy during a match
  const ctx = () => (S.liveTac ? S.liveTac : { tac: L.user().tac, squad: L.squad(L.user()), live: null });
  const tac = () => ctx().tac;
  const find = pid => P(pid) || ctx().squad.find(q => q.id === pid);

  function baseXY(slot, isGK) {
    if (isGK) return { x: 50, y: 91.5, u: -0.2, v: 0.5 };
    return { x: 8 + slot.v * 84, y: 77 - slot.u * 62, u: slot.u, v: slot.v };
  }
  // where the role takes him in a phase, on the board
  function zoneXY(slot, i, phase) {
    const t = tac(), b = baseXY(slot, i === 0);
    if (i === 0 || phase === 'base') return b;
    const z = TAC.zones(t.rOOP[i], (t.instr[i] || {}).runs || 0)[phase];
    const toward = Math.sign(0.5 - slot.v) || 0;
    const u = U.clamp(slot.u + z.du / DEPTH, -0.1, 1.08), v = U.clamp(slot.v + toward * z.dv, 0.04, 0.96);
    return { x: 8 + v * 84, y: 77 - u * 62, u, v };
  }
  // what a role does, in plain words
  function moves(roleId, focus = 0) {
    const r = TAC.ROLES[roleId];
    if (!r) return { att: '', def: '' };
    const z = TAC.zones(roleId, focus), a = [], d = [];
    if (z.att.du > 0.25) a.push('bombs on high up the pitch'); else if (z.att.du > 0.13) a.push('pushes forward'); else if (z.att.du > 0.05) a.push('supports going forward'); else if (z.att.du < -0.08) a.push('drops deep to collect'); else if (z.att.du < -0.03) a.push('sits a little deeper');
    if (z.att.dv > 0.16) a.push('steps inside into the middle'); else if (z.att.dv > 0.08) a.push('drifts infield'); else if (z.att.dv < -0.08) a.push('drifts wide into the half-space'); else if (z.att.dv < -0.03) a.push('hugs the touchline');
    if (r.w.run >= 1.4) a.push('makes runs in behind'); if (r.w.shoot >= 1.3) a.push('looks to shoot'); if (r.w.pass >= 1.35) a.push('dictates the passing'); if (r.w.cross >= 1.4) a.push('crosses early'); if (r.w.dribble >= 1.25) a.push('takes men on'); if (r.holdUp) a.push('holds the ball up');
    if (z.def.du > 0.09) d.push('stays high as an outlet'); else if (z.def.du > 0.03) d.push('holds a slightly higher line'); else if (z.def.du < -0.02) d.push('sits deeper than his slot');
    if (r.w.press >= 1.5) d.push('presses relentlessly'); else if (r.w.press <= 0.6) d.push('rarely presses');
    if (r.w.tackle >= 1.25) d.push('flies into tackles'); if ((r.roam || 1) >= 1.3) d.push('covers a lot of ground'); else if ((r.roam || 1) <= 0.85) d.push('guards his zone');
    if (r.sweeper) d.push('sweeps behind the defence');
    return { att: a.length ? a.join(', ') : 'keeps to his position', def: d.length ? d.join(', ') : 'holds his position in the block' };
  }

  function lines() {
    return `<svg class="lines" viewBox="0 0 68 92" preserveAspectRatio="none"><g fill="none" stroke="rgba(255,255,255,.5)" stroke-width=".35"><rect x="1.5" y="1.5" width="65" height="89" rx=".5"/><line x1="1.5" y1="46" x2="66.5" y2="46"/><circle cx="34" cy="46" r="8"/><rect x="14" y="1.5" width="40" height="15"/><rect x="24" y="1.5" width="20" height="5"/><rect x="14" y="75.5" width="40" height="15"/><rect x="24" y="85.5" width="20" height="5"/><circle cx="34" cy="46" r=".7" fill="rgba(255,255,255,.6)"/></g></svg>`;
  }
  const phaseOf = () => (S.tac.phase === 'def' ? 'def' : S.tac.phase === 'base' ? 'base' : 'att');
  function board() {
    const t = tac(), phase = phaseOf(), fo = TAC.formation(t.oop);
    const arrows = [];
    const col = phase === 'att' ? '253,224,71' : '125,211,252';
    // where every token goes, nudged apart so two players sharing a zone stay readable
    const spots = t.lineup.map((_, i) => ({ ...zoneXY(fo.slots[i], i, phase) }));
    for (let it = 0; it < 8; it++) for (let a = 1; a < spots.length; a++) for (let b = a + 1; b < spots.length; b++) {
      const dx = spots[b].x - spots[a].x, dy = (spots[b].y - spots[a].y) * 1.35, d = Math.hypot(dx, dy);
      if (d >= 13) continue;
      const push = (13 - d) / 2 / Math.max(d, 0.01), ux = d > 0.01 ? dx : 1, uy = d > 0.01 ? dy : 0;
      spots[a].x -= ux * push; spots[b].x += ux * push; spots[a].y -= (uy * push) / 1.35; spots[b].y += (uy * push) / 1.35;
    }
    for (const s of spots) { s.x = U.clamp(s.x, 7, 93); s.y = U.clamp(s.y, 7, 93); }
    const slots = t.lineup.map((pid, i) => {
      const p = find(pid), sl = fo.slots[i], pos = sl.pos;
      const b = baseXY(sl, i === 0), xy = i === 0 ? b : spots[i];
      if (i > 0 && Math.hypot(b.x - xy.x, b.y - xy.y) > 2.5) arrows.push([b, xy]);
      const role = TAC.ROLES[t.rOOP[i]];
      const fit = p ? TAC.fam(p, pos) : 0;
      const val = p ? Math.round(L.roleRating(p, t.rOOP[i], pos)) : 0;
      const f = (t.instr[i] || {}).runs || 0;
      const live = ctx().live;
      const sp = live ? live.players.find(q => q.team === S.liveSide && q.active && q.data.id === pid) : null;
      const stam = sp ? Math.round(sp.stamina * 100) : null;
      const sel = S.tac.sel === i, swap = S.tac.sel != null && S.tac.sel !== i;
      return `<button class="slot${sel ? ' sel' : ''}${swap ? ' swap' : ''}" style="left:${xy.x}%;top:${xy.y}%" data-a="slotTap" data-v="${i}"><div class="tok">${p ? UI.face(p, 40) : '+'}<span class="ov">${val}</span>${fit < 0.9 ? '<span class="warnfit">⚠️</span>' : ''}</div><span class="lbl">${p ? esc(p.ln) : 'Empty'}</span><span class="rl">${pos} · ${role ? role.short : '?'}${f ? (f > 0 ? ' ▲' : ' ▼') : ''}</span>${stam != null ? `<span class="lbl" style="background:${stam > 70 ? '#14532d' : stam > 50 ? '#713f12' : '#7f1d1d'}">${stam}%</span>` : ''}</button>`;
    }).join('');
    const ghosts = phase === 'base' ? '' : t.lineup.map((pid, i) => { if (!i) return ''; const b = baseXY(fo.slots[i]); return `<i style="position:absolute;left:${b.x}%;top:${b.y}%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;border:1.5px dashed rgba(255,255,255,.45)"></i>`; }).join('');
    const arr = `<svg class="trail" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><marker id="ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="rgba(${col},.9)"/></marker></defs>${arrows.map(([a, b]) => `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="rgba(${col},.6)" stroke-width=".55" stroke-dasharray="1.6 1.2" marker-end="url(#ah)"/>`).join('')}</svg>`;
    return `<div class="board">${lines()}${ghosts}${arr}${slots}</div>`;
  }
  function shapeReport() {
    const t = tac(), fo = TAC.formation(t.oop);
    const att = t.lineup.map((_, i) => (i ? zoneXY(fo.slots[i], i, 'att') : null)).filter(Boolean);
    const def = t.lineup.map((_, i) => (i ? zoneXY(fo.slots[i], i, 'def') : null)).filter(Boolean);
    const rest = att.filter(z => z.u <= 0.36).length, box = att.filter(z => z.u >= 0.7).length;
    const wide = att.filter(z => z.v < 0.15 || z.v > 0.85).length, outlets = t.rOOP.filter((r, i) => i && TAC.zones(r, (t.instr[i] || {}).runs || 0).def.du >= 0.09).length;
    const tag = (v, lo, hi) => (v < lo ? 't-bad' : v > hi ? 't-warn' : 't-good');
    const notes = [];
    if (rest < 4) notes.push('⚠️ Few players stay back when you attack: lose it and you are open to the counter.');
    if (box <= 1) notes.push('Not many bodies attack the box.');
    if (wide < 2) notes.push('Little natural width with the ball: give someone a wide role.');
    if (outlets >= 3) notes.push('Several players stay high without the ball: great for counters, thin when defending.');
    return `<div class="grid3 mb8"><div class="card tight center" style="margin:0"><div class="kicker">Rest defence</div><span class="tag ${tag(rest, 4, 7)}">${rest} back</span></div><div class="card tight center" style="margin:0"><div class="kicker">Box presence</div><span class="tag ${box >= 3 ? 't-good' : box <= 1 ? 't-bad' : ''}">${box} high</span></div><div class="card tight center" style="margin:0"><div class="kicker">Width</div><span class="tag ${wide >= 2 ? 't-good' : 't-warn'}">${wide} wide</span></div></div>
      <p class="tiny muted" style="margin-top:0">${notes.join(' ') || 'A balanced structure.'}</p>`;
  }
  function slotPanel(i, live) {
    const t = tac(), pid = t.lineup[i], p = find(pid);
    if (!p) return '';
    const pos = TAC.oopPos(t, i), cur = t.rOOP[i], r = TAC.ROLES[cur], f = (t.instr[i] || {}).runs || 0, mv = moves(cur, f);
    const cap = s => s[0].toUpperCase() + s.slice(1);
    const roleChip = x => `<button class="chip${cur === x.id ? ' on' : ''}" data-a="tacRole" data-v="${i}:${x.id}">${esc(x.name)} <b>${L.roleRating(p, x.id, pos)}</b></button>`;
    return `<div class="card" style="border-color:var(--accent-2)"><div class="flex">${UI.face(p, 44)}<div class="grow"><div class="bold">${esc(p.fn)} ${esc(p.ln)}</div><div class="tiny muted">Natural ${p.pos}${p.alt.length ? ` (${p.alt.join(', ')})` : ''} · playing ${pos}</div></div><button class="btn xs" data-a="player" data-v="${p.id}">Profile</button><button class="icon-btn" data-a="slotTap" data-v="${i}" style="width:32px;height:32px">${I.x}</button></div>
      <div class="kicker mt12 mb8">Role · ${pos}</div><div class="chips" style="flex-wrap:wrap">${TAC.rolesFor(pos).map(roleChip).join('')}</div>
      ${r ? `<div class="small mt4"><b>${esc(r.name)}</b> <span class="muted">${esc(r.desc)}</span></div>
      <div class="flex mt8" style="gap:8px;align-items:flex-start"><span class="tag" style="background:rgba(253,224,71,.18);color:#fde68a;flex:none">⚔️ With the ball</span><span class="small">${esc(cap(mv.att))}.</span></div>
      <div class="flex mt4" style="gap:8px;align-items:flex-start"><span class="tag" style="background:rgba(125,211,252,.18);color:#bae6fd;flex:none">🛡️ Without it</span><span class="small">${esc(cap(mv.def))}.</span></div>` : ''}
      ${i === 0 ? '' : `<div class="kicker mt12 mb8">Focus &amp; instructions</div>${TAC.PLAYER_OPTIONS.map(o => `<div class="instr"><span class="lab small">${o.label}</span><div class="opts">${o.options.map(x => `<button class="${(t.instr[i] || {})[o.key] === x.value ? 'on' : ''}" data-a="tacInstr" data-v="${i}:${o.key}:${x.value}">${x.label}</button>`).join('')}</div></div>`).join('')}<div class="tiny dim">Attack focus pushes his role's movement further forward; Defend focus tones it down and has him track back further.</div>`}
      ${!live ? `<div class="kicker mt12 mb8">Swap in from the squad</div><div class="chips" style="flex-wrap:wrap">${L.squad(L.user()).filter(q => !t.lineup.includes(q.id) && L.available(q)).sort((a, b) => L.calcOvr(b, pos) * TAC.fam(b, pos) - L.calcOvr(a, pos) * TAC.fam(a, pos)).slice(0, 10).map(q => `<button class="chip" data-a="tacPut" data-v="${i}:${q.id}">${q.pos} ${esc(q.ln)} <b>${Math.round(L.calcOvr(q, pos) * TAC.fam(q, pos))}</b></button>`).join('')}</div>` : ''}</div>`;
  }
  function body(live) {
    const t = TAC.normalize(tac()), phase = phaseOf();
    const sel = S.tac.sel;
    const benchIds = live ? live.benchIds : t.bench || [];
    const bench = benchIds.map(find).filter(Boolean);
    const outfield = t.lineup.map(find).filter(p => p && p.pos !== 'GK');
    return `<div class="flex mb8"><select class="txt" style="height:42px;font-weight:700" data-ch="tacForm">${TAC.FORMATION_IDS.map(f => `<option value="${f}"${f === t.oop ? ' selected' : ''}>${f}</option>`).join('')}</select>${!live ? `<button class="btn sm" data-a="tacAuto">Auto XI</button>` : ''}</div>
      <div class="tiny muted mb8">${esc(TAC.formation(t.oop).note || '')} Roles decide how each player moves. Tap a player to change his role; tap two players to swap them.</div>
      <div class="seg" style="margin-bottom:8px"><button class="${phase === 'att' ? 'on' : ''}" data-a="tacPhase" data-v="att">⚔️ With the ball</button><button class="${phase === 'def' ? 'on' : ''}" data-a="tacPhase" data-v="def">🛡️ Without the ball</button><button class="${phase === 'base' ? 'on' : ''}" data-a="tacPhase" data-v="base">Formation</button></div>
      ${board()}
      ${sel != null ? slotPanel(sel, live) : ''}
      ${shapeReport()}
      <div class="card"><h3>${live ? `Bench · ${live.subsLeft} subs left` : 'Bench'}</h3><div class="bench">${bench.map(p => `<button class="bp${S.tac.bench === p.id ? ' sel' : ''}" data-a="benchTap" data-v="${p.id}">${UI.face(p, 34)}<span>${esc(p.ln)}</span><span class="tiny">${UI.posB(p.pos)} ${p.ovr}</span></button>`).join('') || '<div class="tiny muted">Nobody on the bench.</div>'}</div></div>
      <div class="card"><h3>Team instructions</h3>${TAC.TEAM_OPTIONS.map(o => `<div class="instr"><span class="lab">${o.label}</span><div class="opts">${o.options.map(x => `<button class="${t.team[o.key] === x.value ? 'on' : ''}" data-a="tacTeam" data-v="${o.key}:${x.value}">${x.label}</button>`).join('')}</div></div>`).join('')}</div>
      <div class="card"><h3>Set pieces</h3><div class="instr"><span class="lab">Penalties</span><select class="txt" style="height:38px" data-ch="tacPk"><option value="">Auto (best finisher)</option>${outfield.map(p => `<option value="${p.id}"${t.pk === p.id ? ' selected' : ''}>${esc(p.ln)} (FIN ${p.a[DATA.AK.finishing]})</option>`).join('')}</select></div><div class="instr"><span class="lab">Free kicks</span><select class="txt" style="height:38px" data-ch="tacFk"><option value="">Auto (best curler)</option>${outfield.map(p => `<option value="${p.id}"${t.fk === p.id ? ' selected' : ''}>${esc(p.ln)} (CUR ${p.a[DATA.AK.curve]})</option>`).join('')}</select></div></div>
      ${!live ? `<div class="card"><h3>Philosophy presets</h3><p class="tiny muted" style="margin-top:-6px">Load a complete system: formation, instructions and the roles that make it tick. Your best XI is picked for it.</p><div class="idgrid">${Object.entries(DATA.COACH_IDS).map(([id, c]) => `<button class="idcard" data-a="tacPreset" data-v="${id}"><div class="ic">${c.icon}</div><b>${esc(c.name)}</b><p class="dim">${c.oop}${c.roles && c.roles.length ? ` · ${c.roles.slice(0, 3).map(r => TAC.ROLES[r].short).join(' ')}` : ''}</p></button>`).join('')}</div></div>` : ''}`;
  }

  SCREENS.tacticsBody = () => {
    S.liveTac = null;
    L.validateUser();
    return `<div class="scroll">${body(null)}<p class="tiny dim center">Changes save automatically.</p></div>`;
  };
  const after = () => { TAC.normalize(tac()); if (!S.liveTac) L.save(); if (S.liveTac && S.liveTac.onChange) S.liveTac.onChange(); rerender(); };
  function rerender() { if (S.liveTac) UI.refreshSheet(); else UI.render(); }

  A.tacPhase = v => { S.tac.phase = v; rerender(); };
  A.tacForm = v => { TAC.setFormation(tac(), 'oop', v); S.tac.sel = null; after(); };
  A.slotTap = v => {
    const i = +v, t = tac();
    if (S.tac.bench != null) {
      const bid = S.tac.bench;
      S.tac.bench = null;
      if (S.liveTac && S.liveTac.live) { S.liveTac.sub(i, bid); return; }
      const out = t.lineup[i];
      t.lineup[i] = bid;
      t.bench = (t.bench || []).map(x => (x === bid ? out : x));
      return after();
    }
    if (S.tac.sel != null && S.tac.sel !== i && i !== 0 && S.tac.sel !== 0) {
      // swap the two players; the roles belong to the positions, so each takes on the other's role
      const a = S.tac.sel;
      [t.lineup[a], t.lineup[i]] = [t.lineup[i], t.lineup[a]];
      S.tac.sel = null;
      return after();
    }
    S.tac.sel = S.tac.sel === i ? null : i;
    rerender();
  };
  A.benchTap = v => { const id = +v; S.tac.bench = S.tac.bench === id ? null : id; S.tac.sel = null; rerender(); if (S.tac.bench) UI.toast('Now tap the player to replace', '', 1500); };
  A.tacRole = v => { const [i, r] = v.split(':'); TAC.setRole(tac(), +i, r); after(); };
  A.tacInstr = v => { const [i, k, x] = v.split(':'); const t = tac(); t.instr[+i] = { ...(t.instr[+i] || TAC.defaultInstr()), [k]: +x }; after(); };
  A.tacTeam = v => { const [k, x] = v.split(':'); tac().team[k] = +x; after(); };
  A.tacPk = v => { tac().pk = v ? +v : null; after(); };
  A.tacFk = v => { tac().fk = v ? +v : null; after(); };
  A.tacPut = v => { const [i, pid] = v.split(':').map(Number); const t = tac(); const out = t.lineup[i]; t.lineup[i] = pid; t.bench = (t.bench || []).filter(x => x !== pid); if (out != null && !t.bench.includes(out)) t.bench.push(out); after(); };
  A.tacAuto = () => { L.autoLineup(L.user()); S.tac.sel = null; UI.toast('Best XI picked for this shape'); after(); };
  A.tacPreset = v => {
    const id = DATA.COACH_IDS[v], t = tac();
    void t;
    L.applyPhilosophy(L.user(), v);
    S.tac.sel = null;
    UI.toast(`${id.icon} ${esc(id.name)} loaded`);
    after();
  };

  // live: the board inside a sheet, editing a copy that the match picks up
  UI.tacticsSheet = (live, keep) => {
    if (!keep) { S.tac.sel = null; S.tac.bench = null; }
    UI.sheet(`<h2>Tactics</h2>${body(live)}<button class="btn primary block" data-a="close">Back to the match</button>`, { id: 'tactics', refresh: () => UI.tacticsSheet(S.liveTac && S.liveTac.live ? S.liveTac.liveInfo() : live, true) });
  };
})();
