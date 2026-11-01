'use strict';
// ── TACTICS BOARD ─────────────────────────────────────────────────
// Two shapes on one board: Out of Possession (where each player defends) and In Possession (where he moves to
// attack). Arrows show every player's rotation between the two. Tap a player to change him, his role for each
// phase, or his instructions; tap two players to swap them (in the IP view, to swap their attacking spots).

(() => {
  const { S, A, SCREENS, I, esc } = UI;
  const P = id => G.players[id];

  // the tactics being edited: the club's own in the hub, a live copy during a match
  const ctx = () => (S.liveTac ? S.liveTac : { tac: L.user().tac, squad: L.squad(L.user()), live: null });
  const tac = () => ctx().tac;

  function slotXY(slot, isGK) {
    if (isGK) return { x: 50, y: 91.5 };
    return { x: 8 + slot.v * 84, y: 79 - slot.u * 67 };
  }
  function lines() {
    return `<svg class="lines" viewBox="0 0 68 92" preserveAspectRatio="none"><g fill="none" stroke="rgba(255,255,255,.5)" stroke-width=".35"><rect x="1.5" y="1.5" width="65" height="89" rx=".5"/><line x1="1.5" y1="46" x2="66.5" y2="46"/><circle cx="34" cy="46" r="8"/><rect x="14" y="1.5" width="40" height="15"/><rect x="24" y="1.5" width="20" height="5"/><rect x="14" y="75.5" width="40" height="15"/><rect x="24" y="85.5" width="20" height="5"/><circle cx="34" cy="46" r=".7" fill="rgba(255,255,255,.6)"/></g></svg>`;
  }
  function board() {
    const t = tac(), phase = S.tac.phase, ip = phase === 'ip';
    const fo = TAC.formation(t.oop), fi = TAC.formation(t.ip);
    const arrows = [];
    const slots = t.lineup.map((pid, i) => {
      const p = P(pid) || ctx().squad.find(q => q.id === pid);
      const sl = ip ? fi.slots[t.map[i]] : fo.slots[i];
      const pos = sl.pos, xy = slotXY(sl, i === 0);
      if (i > 0) {
        const a = slotXY(fo.slots[i]), b = slotXY(fi.slots[t.map[i]]);
        if (Math.hypot(a.x - b.x, a.y - b.y) > 4) arrows.push(ip ? [a, b] : [b, a]);
      }
      const role = TAC.ROLES[ip ? t.rIP[i] : t.rOOP[i]];
      const fit = p ? TAC.fam(p, pos) : 0;
      const val = p ? Math.round(L.calcOvr(p, pos) * fit) : 0;
      const live = ctx().live;
      const sp = live ? live.players.find(q => q.team === S.liveSide && q.active && q.data.id === pid) : null;
      const stam = sp ? Math.round(sp.stamina * 100) : null;
      const sel = S.tac.sel === i, swap = S.tac.swap != null && S.tac.swap !== i;
      return `<button class="slot${sel ? ' sel' : ''}${swap ? ' swap' : ''}" style="left:${xy.x}%;top:${xy.y}%" data-a="slotTap" data-v="${i}"><div class="tok">${p ? UI.face(p, 40) : '+'}<span class="ov" style="color:${U.ovrClass(val) === 'o-bad' ? '#fca5a5' : '#fff'}">${val}</span>${fit < 0.9 ? '<span class="warnfit">⚠️</span>' : ''}</div><span class="lbl">${p ? esc(p.ln) : 'Empty'}</span><span class="rl">${pos} · ${role ? role.short : '?'}</span>${stam != null ? `<span class="lbl" style="background:${stam > 70 ? '#14532d' : stam > 50 ? '#713f12' : '#7f1d1d'}">${stam}%</span>` : ''}</button>`;
    }).join('');
    const arr = `<svg class="trail" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><marker id="ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="rgba(253,224,71,.85)"/></marker></defs>${arrows.map(([a, b]) => `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="rgba(253,224,71,.55)" stroke-width=".55" stroke-dasharray="1.6 1.2" marker-end="url(#ah)"/>`).join('')}</svg>`;
    return `<div class="board">${lines()}${arr}${slots}</div>`;
  }
  function shapeReport() {
    const t = tac(), fi = TAC.formation(t.ip), fo = TAC.formation(t.oop);
    const rest = t.map.filter((j, i) => i > 0 && fi.slots[j].u <= 0.36).length;
    const box = t.map.filter((j, i) => i > 0 && fi.slots[j].u >= 0.66).length;
    const wide = t.map.filter((j, i) => i > 0 && (fi.slots[j].v < 0.15 || fi.slots[j].v > 0.85)).length;
    const shift = U.avg(t.map.map((j, i) => (i ? Math.hypot(fo.slots[i].u - fi.slots[j].u, fo.slots[i].v - fi.slots[j].v) : 0)));
    const tag = (v, lo, hi) => (v < lo ? 't-bad' : v > hi ? 't-warn' : 't-good');
    return `<div class="grid3 mb12"><div class="card tight center" style="margin:0"><div class="kicker">Rest defence</div><span class="tag ${tag(rest, 4, 7)}">${rest} back</span></div><div class="card tight center" style="margin:0"><div class="kicker">Box presence</div><span class="tag ${box >= 4 ? 't-good' : box <= 1 ? 't-bad' : ''}">${box} high</span></div><div class="card tight center" style="margin:0"><div class="kicker">Rotation</div><span class="tag ${shift > 0.22 ? 't-warn' : 't-good'}">${shift > 0.22 ? 'Big' : shift > 0.1 ? 'Medium' : 'Small'}</span></div></div>
      <p class="tiny muted" style="margin-top:-6px">${rest < 4 ? '⚠️ Few players stay back when you attack: lose the ball and you are open to counters.' : box <= 1 ? 'Not many bodies attack the box when you have the ball.' : shift > 0.22 ? 'A big shape change between phases: devastating when it clicks, exposed in transition.' : 'A balanced structure.'}${wide < 2 ? ' Little natural width in possession.' : ''}</p>`;
  }
  function body(live) {
    const t = tac(), phase = S.tac.phase;
    const fid = phase === 'ip' ? t.ip : t.oop;
    const sel = S.tac.sel;
    const benchIds = live ? live.benchIds : t.bench || [];
    const bench = benchIds.map(id => P(id) || ctx().squad.find(q => q.id === id)).filter(Boolean);
    const outfield = t.lineup.map(id => P(id)).filter(p => p && p.pos !== 'GK');
    return `<div class="phase-toggle"><button class="oop${phase === 'oop' ? ' on' : ''}" data-a="tacPhase" data-v="oop">🛡️ Out of possession<br><span class="tiny" style="opacity:.8">${t.oop}</span></button><button class="ip${phase === 'ip' ? ' on' : ''}" data-a="tacPhase" data-v="ip">⚔️ In possession<br><span class="tiny" style="opacity:.8">${t.ip}</span></button></div>
      <div class="flex mb8"><select class="txt" style="height:40px;font-weight:700" data-ch="tacForm">${TAC.FORMATION_IDS.map(f => `<option value="${f}"${f === fid ? ' selected' : ''}>${f}</option>`).join('')}</select>${!live ? `<button class="btn sm" data-a="tacAuto">Auto XI</button>` : ''}</div>
      <div class="tiny muted mb8">${esc(TAC.formation(fid).note || '')} ${phase === 'ip' ? 'Tap two players to swap where they move when you attack.' : 'Tap two players to swap them; tap the bench to bring someone in.'}</div>
      ${board()}
      ${sel != null ? slotPanel(sel, live) : ''}
      ${shapeReport()}
      <div class="card"><h3>${live ? `Bench · ${live.subsLeft} subs left` : 'Bench'}</h3><div class="bench">${bench.map(p => `<button class="bp${S.tac.bench === p.id ? ' sel' : ''}" data-a="benchTap" data-v="${p.id}">${UI.face(p, 34)}<span>${esc(p.ln)}</span><span class="tiny">${UI.posB(p.pos)} ${p.ovr}</span></button>`).join('') || '<div class="tiny muted">Nobody on the bench.</div>'}</div></div>
      <div class="card"><h3>Team instructions</h3>${TAC.TEAM_OPTIONS.map(o => `<div class="instr"><span class="lab">${o.label}</span><div class="opts">${o.options.map(x => `<button class="${t.team[o.key] === x.value ? 'on' : ''}" data-a="tacTeam" data-v="${o.key}:${x.value}">${x.label}</button>`).join('')}</div></div>`).join('')}</div>
      <div class="card"><h3>Set pieces</h3><div class="instr"><span class="lab">Penalties</span><select class="txt" style="height:38px" data-ch="tacPk"><option value="">Auto (best finisher)</option>${outfield.map(p => `<option value="${p.id}"${t.pk === p.id ? ' selected' : ''}>${esc(p.ln)} (FIN ${p.a[DATA.AK.finishing]})</option>`).join('')}</select></div><div class="instr"><span class="lab">Free kicks</span><select class="txt" style="height:38px" data-ch="tacFk"><option value="">Auto (best curler)</option>${outfield.map(p => `<option value="${p.id}"${t.fk === p.id ? ' selected' : ''}>${esc(p.ln)} (CUR ${p.a[DATA.AK.curve]})</option>`).join('')}</select></div></div>
      ${!live ? `<div class="card"><h3>Philosophy presets</h3><p class="tiny muted" style="margin-top:-6px">Load a complete system: both shapes plus instructions. Your players stay put.</p><div class="idgrid">${Object.entries(DATA.COACH_IDS).map(([id, c]) => `<button class="idcard" data-a="tacPreset" data-v="${id}"><div class="ic">${c.icon}</div><b>${esc(c.name)}</b><p class="dim">${c.oop} / ${c.ip}</p></button>`).join('')}</div></div>` : ''}`;
  }
  function slotPanel(i, live) {
    const t = tac(), pid = t.lineup[i], p = P(pid) || ctx().squad.find(q => q.id === pid);
    if (!p) return '';
    const posO = TAC.oopPos(t, i), posI = TAC.ipPos(t, i);
    const rolePick = (phase, pos, cur) => `<div class="kicker mt8 mb8">${phase === 'ip' ? '⚔️ In-possession role' : '🛡️ Out-of-possession role'} · ${pos}</div><div class="chips" style="flex-wrap:wrap">${TAC.rolesFor(pos).map(r => `<button class="chip${cur === r.id ? ' on' : ''}" data-a="tacRole" data-v="${phase}:${i}:${r.id}">${esc(r.name)} <b>${L.roleRating(p, r.id)}</b></button>`).join('')}</div>`;
    const rO = TAC.ROLES[t.rOOP[i]], rI = TAC.ROLES[t.rIP[i]];
    return `<div class="card" style="border-color:var(--accent-2)"><div class="flex">${UI.face(p, 44)}<div class="grow"><div class="bold">${esc(p.fn)} ${esc(p.ln)}</div><div class="tiny muted">Natural ${p.pos}${p.alt.length ? ` (${p.alt.join(', ')})` : ''} · defends ${posO}, attacks ${posI}</div></div><button class="btn xs" data-a="player" data-v="${p.id}">Profile</button><button class="icon-btn" data-a="slotTap" data-v="${i}" style="width:32px;height:32px">${I.x}</button></div>
      ${i === 0 ? rolePick('oop', posO, t.rOOP[i]) : `${rolePick('oop', posO, t.rOOP[i])}<div class="tiny dim">${esc(rO ? rO.desc : '')}</div>${rolePick('ip', posI, t.rIP[i])}<div class="tiny dim">${esc(rI ? rI.desc : '')}</div>
      <div class="kicker mt12 mb8">Player instructions</div>${TAC.PLAYER_OPTIONS.map(o => `<div class="instr"><span class="lab small">${o.label}</span><div class="opts">${o.options.map(x => `<button class="${(t.instr[i] || {})[o.key] === x.value ? 'on' : ''}" data-a="tacInstr" data-v="${i}:${o.key}:${x.value}">${x.label}</button>`).join('')}</div></div>`).join('')}`}
      ${!live ? `<div class="kicker mt8 mb8">Swap in from the squad</div><div class="chips" style="flex-wrap:wrap">${L.squad(L.user()).filter(q => !t.lineup.includes(q.id) && L.available(q)).sort((a, b) => L.calcOvr(b, posO) * TAC.fam(b, posO) - L.calcOvr(a, posO) * TAC.fam(a, posO)).slice(0, 10).map(q => `<button class="chip" data-a="tacPut" data-v="${i}:${q.id}">${q.pos} ${esc(q.ln)} <b>${Math.round(L.calcOvr(q, posO) * TAC.fam(q, posO))}</b></button>`).join('')}</div>` : ''}</div>`;
  }

  SCREENS.tacticsBody = () => {
    S.liveTac = null;
    const t = L.user().tac;
    L.validateUser();
    return `<div class="scroll">${body(null)}<p class="tiny dim center">${t.oop === t.ip ? 'Same shape in both phases.' : `Defends ${t.oop}, attacks ${t.ip}.`} Changes save automatically.</p></div>`;
  };
  const after = () => { if (!S.liveTac) L.save(); if (S.liveTac && S.liveTac.onChange) S.liveTac.onChange(); rerender(); };
  function rerender() { if (S.liveTac) UI.refreshSheet(); else UI.render(); }

  A.tacPhase = v => { S.tac.phase = v; S.tac.swap = null; rerender(); };
  A.tacForm = v => { TAC.setFormation(tac(), S.tac.phase, v); S.tac.sel = null; after(); };
  A.slotTap = v => {
    const i = +v, t = tac();
    if (S.tac.bench != null) {
      // bring the selected bench player into this slot
      const bid = S.tac.bench;
      S.tac.bench = null;
      if (S.liveTac && S.liveTac.live) { S.liveTac.sub(i, bid); return; }
      const out = t.lineup[i];
      t.lineup[i] = bid;
      t.bench = (t.bench || []).map(x => (x === bid ? out : x));
      return after();
    }
    if (S.tac.sel != null && S.tac.sel !== i && i !== 0 && S.tac.sel !== 0) {
      const a = S.tac.sel;
      if (S.tac.phase === 'ip') TAC.swapIP(t, a, i);
      else {
        [t.lineup[a], t.lineup[i]] = [t.lineup[i], t.lineup[a]];
        // keep each player's IP rotation with the slot (the slot moves, not the man)
      }
      S.tac.sel = null;
      return after();
    }
    S.tac.sel = S.tac.sel === i ? null : i;
    rerender();
  };
  A.benchTap = v => { const id = +v; S.tac.bench = S.tac.bench === id ? null : id; S.tac.sel = null; rerender(); if (S.tac.bench) UI.toast('Now tap the player to replace', '', 1500); };
  A.tacRole = v => { const [ph, i, r] = v.split(':'); const t = tac(); if (ph === 'ip') t.rIP[+i] = r; else t.rOOP[+i] = r; after(); };
  A.tacInstr = v => { const [i, k, x] = v.split(':'); const t = tac(); t.instr[+i] = { ...(t.instr[+i] || TAC.defaultInstr()), [k]: +x }; after(); };
  A.tacTeam = v => { const [k, x] = v.split(':'); tac().team[k] = +x; after(); };
  A.tacPk = v => { tac().pk = v ? +v : null; after(); };
  A.tacFk = v => { tac().fk = v ? +v : null; after(); };
  A.tacPut = v => { const [i, pid] = v.split(':').map(Number); const t = tac(); const out = t.lineup[i]; t.lineup[i] = pid; t.bench = (t.bench || []).filter(x => x !== pid); if (out != null && !t.bench.includes(out)) t.bench.push(out); after(); };
  A.tacAuto = () => { L.autoLineup(L.user()); S.tac.sel = null; UI.toast('Best XI picked for this shape'); after(); };
  A.tacPreset = v => {
    const id = DATA.COACH_IDS[v], t = tac();
    TAC.setFormation(t, 'oop', id.oop);
    TAC.setFormation(t, 'ip', id.ip);
    Object.assign(t.team, id.team);
    L.autoLineup(L.user(), true);
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
