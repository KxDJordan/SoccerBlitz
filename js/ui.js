'use strict';
// ── UI CORE: state, actions, shared components, sheets ────────────
// Screens and actions are registered by the other ui-*.js files into SCREENS and A. Every tap on an element
// with data-a="name" runs A[name](data-v, element). Screens are plain HTML strings re-rendered on change.

const BUILD = (() => { try { return new URL(document.currentScript.src).searchParams.get('v') || 'dev'; } catch (e) { return 'dev'; } })();

const UI = (() => {
  const S = {
    screen: 'menu', tab: 'home', prevTab: null,
    sub: { squad: 'first', market: 'search', league: 'table', feed: 'news', club: 'overview' },
    leagueView: null, filters: { pos: 'ALL', market: 'ALL', maxPrice: 0, sort: 'ovr' },
    create: null, tac: { phase: 'oop', sel: null, swap: null }, sheetStack: [],
  };
  const A = {}, SCREENS = {};
  const esc = U.esc;
  const $app = () => document.getElementById('app');

  // ── icons ──
  const sv = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
  const I = {
    home: sv('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'),
    squad: sv('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-6 6.5-6s5.9 2.4 6.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.7.2 4.8 2.3 5.4 5.8"/>'),
    tactics: sv('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 12h18M12 3v18"/><circle cx="12" cy="12" r="3"/>'),
    market: sv('<path d="M7 7h13l-1.5 8H8.5z"/><path d="M7 7 6 3H3"/><circle cx="9.5" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>'),
    league: sv('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'),
    feed: sv('<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="M8 10h8M8 13h5"/>'),
    back: sv('<path d="M15 18l-6-6 6-6"/>'),
    chev: sv('<path d="M9 18l6-6-6-6"/>', 'style="width:16px;height:16px;opacity:.5"'),
    x: sv('<path d="M18 6 6 18M6 6l12 12"/>'),
    inbox: sv('<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/>'),
    club: sv('<path d="M12 2.5 20 5.5v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z"/><path d="M9 12l2 2 4-4"/>'),
    play: sv('<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>'),
    pause: sv('<path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" fill="currentColor" stroke="none"/>'),
    ff: sv('<path d="M3 5v14l8-7zM12 5v14l8-7z" fill="currentColor" stroke="none"/>'),
    skip: sv('<path d="M5 5v14l9-7zM16 5h3v14h-3z" fill="currentColor" stroke="none"/>'),
    cam: sv('<path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>'),
    stats: sv('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    swap: sv('<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>'),
    money: sv('<circle cx="12" cy="12" r="9"/><path d="M15 9a3 3 0 0 0-3-1.5c-1.7 0-3 .9-3 2s1.3 1.8 3 2 3 .9 3 2-1.3 2-3 2a3 3 0 0 1-3-1.5M12 6v1.5M12 16.5V18"/>'),
    gear: sv('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
    star: sv('<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>'),
    starF: sv('<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" fill="currentColor"/>'),
    trophy: sv('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'),
    eye: sv('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    up: sv('<path d="M12 19V5M5 12l7-7 7 7"/>'),
    plus: sv('<path d="M12 5v14M5 12h14"/>'),
    search: sv('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'),
    whistle: sv('<circle cx="9" cy="14" r="6"/><path d="M13 10 21 5M15 8h4"/>'),
    flame: sv('<path d="M12 2c1.5 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2-6 1 1.5 1.5 2.5 2 3 .5-2.5 0-4.5 1-7z"/>'),
    sub: sv('<path d="M17 3v18M17 21l-4-4M7 21V3M7 3 3 7"/>'),
    grad: sv('<path d="M2 9 12 4l10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>'),
    scope: sv('<circle cx="12" cy="12" r="8"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="2"/>'),
  };
  const WXI = { clear: '☀️', cloudy: '☁️', rain: '🌧️', storm: '⛈️', snow: '🌨️', fog: '🌫️', heat: '🔥', wind: '💨' };

  // ── components ──
  const crest = (t, size = 36) => (t ? Art.crest(t, size) : '');
  const face = (p, size = 40) => Art.face(p, size);
  const posGroup = pos => DATA.POS_GROUP[pos] || 'MID';
  const posB = pos => `<span class="pos ${posGroup(pos)}">${pos}</span>`;
  const ovrB = (p, lg) => {
    const v = L.seenOvr(p);
    if (v.exact) return `<span class="ovr ${U.ovrClass(p.ovr)}${lg ? ' lg' : ''}">${p.ovr}</span>`;
    return `<span class="ovr scout${lg ? ' lg' : ''}" title="Scouted estimate">${v.lo}-${v.hi}</span>`;
  };
  const potTxt = p => {
    const k = L.knowledge(p);
    if (k >= 3) return U.potGrade(p.pot);
    const spread = k === 2 ? 3 : 7, off = ((U.hash(`p${p.id}`) % 5) - 2) * 1.5;
    const a = U.potGrade(Math.round(p.pot + off - spread)), b = U.potGrade(Math.round(p.pot + off + spread));
    return a === b ? a : `${a}–${b}`;
  };
  const form = arr => `<span class="form">${(arr || []).slice(-5).map(r => `<i class="${r}">${r}</i>`).join('')}</span>`;
  const rateCol = r => (r >= 8 ? '#22d3ee' : r >= 7 ? '#22c55e' : r >= 6.3 ? '#eab308' : r > 0 ? '#f97316' : '#334155');
  const rating = r => `<span class="rating" style="background:${rateCol(r)}">${r ? r.toFixed(1) : '–'}</span>`;
  const fitBar = p => `<div class="bar" style="max-width:46px;height:5px"><i style="width:${p.fit}%;background:${p.fit > 80 ? 'var(--good)' : p.fit > 60 ? 'var(--warn)' : 'var(--bad)'}"></i></div>`;
  // club-coloured cards carry white text: a very light primary hands over to the darker colour (or is deepened)
  const teamVars = t => {
    let a = t.crest.c1, b = t.crest.c2;
    if (U.lum(a) > 0.45) { if (U.lum(b) < 0.3) [a, b] = [b, a]; else a = U.mix(a, '#0b0f17', 0.55); }
    return `--team-1:${a};--team-2:${b}`;
  };
  const tname = t => esc(t.name);
  const pname = p => `${esc(p.fn)} ${esc(p.ln)}`;
  const status = p => (p.trainPos && p.trainPos !== p.pos && !(p.inj > 0) ? `<span class="tag t-acc">🔄 ${p.trainPos} ${Math.round((p.retrain || 0) * 100)}%</span>` : p.inj > 0 ? `<span class="tag t-bad">🩹 ${p.inj}d</span>` : p.ban > 0 ? `<span class="tag t-bad">⛔ ${p.ban}</span>` : p.listed ? '<span class="tag t-warn">Listed</span>' : p.wantsOut ? '<span class="tag t-warn">Unhappy</span>' : '');
  function playerRow(p, opts = {}) {
    const right = opts.right != null ? opts.right : ovrB(p);
    const meta = opts.meta != null ? opts.meta : `${p.age} · ${esc(p.nat)}${p.tid >= 0 && !p.acad && p.tid !== G.userTeamId && G.teams[p.tid] ? ` · ${esc(G.teams[p.tid].abbr)}` : ''}`;
    return `<div class="row tap" data-a="${opts.act || 'player'}" data-v="${opts.v != null ? opts.v : p.id}">${face(p, 40)}<div class="grow"><div class="flex" style="gap:6px">${posB(p.pos)}<span class="nm ellip">${esc(p.fn[0])}. ${esc(p.ln)}</span>${status(p)}</div><div class="meta">${meta}</div></div>${opts.mid || ''}${right}</div>`;
  }
  function teamChip(t, size = 22) { return `<span class="flex" style="gap:6px;display:inline-flex">${crest(t, size)}<b>${esc(t.abbr)}</b></span>`; }
  function wxChip(wx) { if (!wx) return ''; const w = DATA.WEATHER[wx.id]; const ko = DATA.KICKOFF.find(k => k.id === wx.ko); return `<span class="wx">${WXI[wx.id] || ''} ${w ? w.name : ''} · ${wx.temp}°C${ko ? ` · ${ko.label}` : ''}</span>`; }
  function compLabel(f) {
    const short = { L: L.league(f.lg) ? L.league(f.lg).short : 'LG', C: 'CUP', X: 'BCC', I: 'INV', S: 'SHW', A: 'U18', F: 'FRI' }[f.comp];
    return short;
  }
  function compName(f) { return News.compName(f); }
  function ring(val, label, color) {
    const r = 34, c = 2 * Math.PI * r, pct = U.clamp((val - 40) / 59, 0.02, 1);
    return `<div style="position:relative;width:84px;height:84px"><svg viewBox="0 0 84 84" width="84" height="84"><circle cx="42" cy="42" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="7"/><circle cx="42" cy="42" r="${r}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(1)}" transform="rotate(-90 42 42)"/></svg><div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center"><div><b style="font-family:var(--f-display);font-size:24px;display:block;line-height:1">${val}</b><span class="tiny muted">${label}</span></div></div></div>`;
  }

  // ── theme from the user's club ──
  // UI themes (per device). Each sets the surfaces; the club's colours set the accent unless switched off.
  const THEMES = {
    midnight: { name: 'Midnight', bg: '#070c16', surface: '#0f1726', s3: '#1d2a45', acc: '#22c55e', acc2: '#fde047' },
    stadium: { name: 'Stadium Lights', bg: '#040a1c', surface: '#0a1530', s3: '#162b58', acc: '#38bdf8', acc2: '#f472b6' },
    pitch: { name: 'Pitchside', bg: '#04140c', surface: '#0a2416', s3: '#164027', acc: '#22c55e', acc2: '#fde047' },
    arcade: { name: 'Neon Arcade', bg: '#0d0618', surface: '#170b2b', s3: '#2c1652', acc: '#ff2bd6', acc2: '#22e1ff' },
    sunset: { name: 'Sunset', bg: '#140808', surface: '#22100e', s3: '#3d1e18', acc: '#fb923c', acc2: '#fde047' },
    light: { name: 'Daylight', bg: '#f2f5fa', surface: '#ffffff', s3: '#e1e7f1', acc: '#2563eb', acc2: '#f59e0b' },
  };
  const pref = (k, d) => { try { return localStorage.getItem(`soccerblitz.${k}`) || d; } catch (e) { return d; } };
  const setPref = (k, v) => { try { localStorage.setItem(`soccerblitz.${k}`, v); } catch (e) { /* storage blocked */ } };
  function applyTheme() {
    const th = THEMES[pref('theme', 'midnight')] ? pref('theme', 'midnight') : 'midnight';
    const root = document.documentElement;
    if (root.dataset.theme !== th) {
      root.dataset.theme = th;
      root.style.background = THEMES[th].bg;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', THEMES[th].bg);
    }
    const t = G && G.userTeamId != null && G.teams ? G.teams[G.userTeamId] : null;
    const b = document.body;
    if (!t || pref('clubAccent', 'on') === 'off') { b.style.removeProperty('--accent'); b.style.removeProperty('--accent-2'); b.style.removeProperty('--on-accent'); return; }
    let a = t.crest.c1, a2 = t.crest.c2;
    if (U.lum(a) < 0.035 || U.lum(a) > 0.85) [a, a2] = [a2, a];
    if (U.lum(a) < 0.035) a = U.mix(a, '#ffffff', 0.35);
    if (U.lum(a2) < 0.05 || U.cdist(a, a2) < 90) a2 = '#fde047';
    b.style.setProperty('--accent', a);
    b.style.setProperty('--accent-2', a2);
    b.style.setProperty('--on-accent', U.onColor(a));
  }

  // ── render ──
  function render() {
    const app = $app();
    const key = `${S.screen}:${S.tab}:${S.sub[S.tab] || ''}`;
    const sc = app.querySelector('.scroll');
    const keep = sc && S.lastKey === key ? sc.scrollTop : 0;
    applyTheme();
    const fn = SCREENS[S.screen] || SCREENS.menu;
    app.innerHTML = fn();
    app.classList.toggle('wide', S.screen === 'match' && window.innerWidth > 900);
    const first = app.firstElementChild;
    if (first && S.lastKey === key) first.style.animation = 'none';
    else if (first && S.screen === 'hub' && S.prevScreen === 'hub') {
      const order = ['home', 'squad', 'tactics', 'market', 'league', 'feed'], from = order.indexOf(S.prevTab), to = order.indexOf(S.tab);
      if (from >= 0 && to >= 0 && from !== to) first.classList.add(to > from ? 'slide-l' : 'slide-r');
    }
    S.prevTab = S.tab; S.prevScreen = S.screen;
    const sc2 = app.querySelector('.scroll');
    if (sc2) sc2.scrollTop = keep;
    S.lastKey = key;
    if (SCREENS[S.screen] && SCREENS[S.screen].mount) SCREENS[S.screen].mount();
  }
  function go(screen, opts = {}) {
    if (S.screen !== screen && SCREENS[S.screen] && SCREENS[S.screen].unmount) SCREENS[S.screen].unmount();
    S.screen = screen;
    Object.assign(S, opts);
    render();
  }

  // ── sheets, toasts, confirms ──
  function sheet(html, opts = {}) {
    const root = document.getElementById('sheet-root');
    root.innerHTML = `<div class="sheet-bg"${opts.locked ? ' data-locked="1"' : ''}></div><div class="sheet${opts.full ? ' full' : ''}" style="${opts.vars || ''}"><div class="grab"></div>${html}</div>`;
    S.sheetOpen = opts.id || 'sheet';
    S.sheetRefresh = opts.refresh || null;
    requestAnimationFrame(() => root.querySelectorAll('.sheet-bg, .sheet').forEach(e => e.classList.add('in')));
    document.body.classList.add('sheet-open');
  }
  function refreshSheet() { if (S.sheetOpen && S.sheetRefresh) { const sh = document.querySelector('#sheet-root .sheet'); const top = sh ? sh.scrollTop : 0; S.sheetRefresh(); const sh2 = document.querySelector('#sheet-root .sheet'); if (sh2) { sh2.classList.add('in'); sh2.style.transition = 'none'; sh2.scrollTop = top; requestAnimationFrame(() => { sh2.style.transition = ''; }); } } }
  function closeSheet() {
    const root = document.getElementById('sheet-root');
    root.querySelectorAll('.in').forEach(e => e.classList.remove('in'));
    S.sheetOpen = null; S.sheetRefresh = null;
    document.body.classList.remove('sheet-open');
    setTimeout(() => { if (!S.sheetOpen) root.innerHTML = ''; }, 320);
    if (S.onSheetClose) { const f = S.onSheetClose; S.onSheetClose = null; f(); }
  }
  function toast(msg, kind = '', ms = 2600) {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = msg;
    root.appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .3s, transform .3s'; el.style.opacity = '0'; el.style.transform = 'translateY(-8px)'; setTimeout(() => el.remove(), 320); }, ms);
  }
  function confirm(title, body, okLabel, onOk, danger) {
    S.confirmOk = onOk;
    sheet(`<h2>${esc(title)}</h2><p class="muted small">${body}</p><div class="grid2 mt12"><button class="btn" data-a="close">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-a="confirmOk">${esc(okLabel)}</button></div>`);
  }
  A.confirmOk = () => { const f = S.confirmOk; S.confirmOk = null; closeSheet(); if (f) f(); };
  A.close = () => closeSheet();
  A.tab = v => {
    const [tab, sub] = String(v).split(':');
    closeSheet();
    if (S.screen !== 'hub') S.screen = 'hub';
    S.tab = tab;
    if (sub) S.sub[tab] = sub;
    render();
    const sc = document.querySelector('.scroll'); if (sc && S.prevTab !== tab) sc.scrollTop = 0;
  };
  A.sub = (v, el) => { const tab = el.dataset.tab || S.tab; S.sub[tab] = v; render(); };
  A.noop = () => {};

  // ── shared chrome ──
  function tabbar() {
    const unread = G ? G.inbox.filter(m => !m.done && !m.read).length : 0;
    const tabs = [['home', 'Home', I.home, unread], ['squad', 'Squad', I.squad], ['tactics', 'Tactics', I.tactics], ['market', 'Market', I.market], ['league', 'League', I.league], ['feed', 'Feed', I.feed]];
    return `<nav class="tabbar">${tabs.map(([id, label, ic, n]) => `<button class="tab${S.tab === id ? ' on' : ''}" data-a="tab" data-v="${id}">${ic}${label}${n ? `<span class="dot">${n}</span>` : ''}</button>`).join('')}</nav>`;
  }
  function topbar(title, sub, left = '', right = '') {
    return `<header class="topbar">${left}<div class="title">${title}${sub ? `<div class="sub">${sub}</div>` : ''}</div>${right}</header>`;
  }
  function seg(tab, opts) { return `<div class="seg">${opts.map(([v, l]) => `<button class="${S.sub[tab] === v ? 'on' : ''}" data-a="sub" data-tab="${tab}" data-v="${v}">${l}</button>`).join('')}</div>`; }

  // ── wiring ──
  function wire() {
    document.addEventListener('click', e => {
      const bg = e.target.classList && e.target.classList.contains('sheet-bg');
      if (bg && !e.target.dataset.locked) { closeSheet(); return; }
      const el = e.target.closest('[data-a]');
      if (!el) return;
      const fn = A[el.dataset.a];
      if (fn) { e.preventDefault(); Sfx.play('tap'); fn(el.dataset.v, el, e); }
    });
    document.addEventListener('input', e => { const el = e.target.closest('[data-in]'); if (el && A[el.dataset.in]) A[el.dataset.in](el.value, el, e); });
    document.addEventListener('change', e => { const el = e.target.closest('[data-ch]'); if (el && A[el.dataset.ch]) A[el.dataset.ch](el.value, el, e); });
    // swipe a sheet down to close it
    let y0 = null;
    document.addEventListener('touchstart', e => { const sh = e.target.closest && e.target.closest('.sheet'); y0 = sh && sh.scrollTop <= 0 && e.touches[0] ? e.touches[0].clientY : null; }, { passive: true });
    document.addEventListener('touchend', e => { if (y0 != null && e.changedTouches[0] && e.changedTouches[0].clientY - y0 > 110) { const bgEl = document.querySelector('.sheet-bg'); if (bgEl && !bgEl.dataset.locked) closeSheet(); } y0 = null; }, { passive: true });
    window.addEventListener('resize', () => { const sc = SCREENS[S.screen]; if (sc && sc.resize) sc.resize(); });
    Career.setOnUnlock((a, fresh) => { toast(`<span class="ti">${a.icon}</span><div><div class="tiny gold bold">ACHIEVEMENT${fresh ? '' : ' (career)'}</div>${esc(a.name)}</div>`, 'ach', 3600); Sfx.play('achievement'); });
    let failWarned = 0;
    Store.setOnFail(() => { if (Date.now() - failWarned < 60000) return; failWarned = Date.now(); toast('Your progress couldn’t be saved. Free up space or export your career.', '', 5000); });
    const persist = () => { if (G) L.flush(true); };
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist(); });
  }

  return {
    S, A, SCREENS, I, WXI, THEMES, pref, setPref, esc, render, go, sheet, refreshSheet, closeSheet, toast, confirm, tabbar, topbar, seg, wire,
    crest, face, posB, ovrB, potTxt, form, rating, rateCol, fitBar, teamVars, tname, pname, status, playerRow, teamChip, wxChip, compLabel, compName, ring, applyTheme,
  };
})();
