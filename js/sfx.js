'use strict';
// ── SOUND ─────────────────────────────────────────────────────────
// Every sound is synthesised with Web Audio (no files). iOS only lets audio start from a completed tap,
// so every tap re-arms the context. A crowd bed runs under live matches and swells with danger.

const Sfx = (() => {
  const KEY = 'soccerblitz.sfx';
  let on = localStorage.getItem(KEY) !== 'off';
  let ctx = null, master = null, noiseBuf = null, crowd = null;
  const last = {};

  function init() {
    if (ctx) { if (ctx.state !== 'running') ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) { /* unsupported */ }
    ctx = new AC();
    ctx.resume().catch(() => {});
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = 0.7;
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); s.connect(ctx.destination); s.start(0);
  }
  ['touchend', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if (on) init(); }, { passive: true, capture: true }));
  const ready = () => on && ctx && ctx.state === 'running';

  function env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone(freq, dur, { type = 'sine', vol = 0.3, at = 0, to = null, attack = 0.005 } = {}) {
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    env(g, t, attack, vol, dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, { vol = 0.3, at = 0, type = 'lowpass', freq = 1000, to = null, q = 0.8, attack = 0.005 } = {}) {
    const t = ctx.currentTime + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true;
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    env(g, t, attack, vol, dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  const SOUNDS = {
    tap: () => tone(880, 0.05, { type: 'triangle', vol: 0.06 }),
    toggle: () => { tone(660, 0.05, { type: 'triangle', vol: 0.06 }); tone(990, 0.06, { type: 'triangle', vol: 0.05, at: 0.04 }); },
    pass: () => { noise(0.05, { vol: 0.12, type: 'bandpass', freq: 900, q: 2 }); tone(160, 0.06, { vol: 0.08, to: 90 }); },
    kick: () => { noise(0.07, { vol: 0.2, type: 'bandpass', freq: 700, q: 1.5 }); tone(140, 0.09, { vol: 0.16, to: 70 }); },
    rocket: () => { noise(0.08, { vol: 0.3, type: 'bandpass', freq: 600, q: 1 }); tone(120, 0.12, { vol: 0.25, to: 50 }); noise(0.5, { vol: 0.12, type: 'bandpass', freq: 3000, to: 600, at: 0.03 }); },
    header: () => { tone(220, 0.08, { vol: 0.14, to: 120, type: 'triangle' }); noise(0.05, { vol: 0.1, freq: 1200 }); },
    hit: () => { noise(0.14, { vol: 0.35, freq: 400, to: 120 }); tone(90, 0.16, { vol: 0.3, to: 45, type: 'square' }); },
    bighit: () => { noise(0.3, { vol: 0.5, freq: 600, to: 80 }); tone(70, 0.3, { vol: 0.45, to: 30, type: 'square' }); tone(55, 0.4, { vol: 0.3, to: 28, at: 0.03 }); crowdBurst(0.5, 0.9); },
    slide: () => noise(0.35, { vol: 0.16, type: 'bandpass', freq: 2200, to: 700, q: 0.7 }),
    tackle: () => noise(0.09, { vol: 0.15, freq: 500 }),
    whistle: () => { tone(2900, 0.22, { type: 'sine', vol: 0.11 }); tone(3050, 0.22, { type: 'sine', vol: 0.06 }); },
    longWhistle: () => { tone(2900, 0.25, { vol: 0.11 }); tone(2900, 0.25, { vol: 0.11, at: 0.32 }); tone(2900, 0.7, { vol: 0.12, at: 0.64 }); },
    save: () => { noise(0.1, { vol: 0.22, type: 'bandpass', freq: 1500 }); tone(300, 0.1, { vol: 0.12, to: 180 }); crowdBurst(0.25, 0.7); },
    post: () => { [880, 1320, 1760, 2350].forEach((f, i) => tone(f, 0.9 - i * 0.12, { type: 'triangle', vol: 0.12 / (i + 1) })); crowdBurst(0.35, 0.8); },
    block: () => { noise(0.08, { vol: 0.2, freq: 700 }); tone(110, 0.1, { vol: 0.15 }); },
    special: () => { noise(0.25, { vol: 0.1, type: 'bandpass', freq: 1800, to: 4000 }); tone(1200, 0.12, { type: 'triangle', vol: 0.06, at: 0.05 }); tone(1600, 0.14, { type: 'triangle', vol: 0.05, at: 0.12 }); },
    fire: () => { noise(0.9, { vol: 0.25, type: 'lowpass', freq: 400, to: 3000 }); tone(196, 0.5, { type: 'sawtooth', vol: 0.06, to: 392 }); },
    goal: () => { crowdBurst(1, 2.6); tone(392, 0.5, { type: 'sawtooth', vol: 0.08 }); tone(523, 0.6, { type: 'sawtooth', vol: 0.07, at: 0.12 }); tone(659, 0.9, { type: 'sawtooth', vol: 0.07, at: 0.24 }); noise(0.3, { vol: 0.2, freq: 3000, at: 0.02 }); },
    thunder: () => { noise(2.2, { vol: 0.35, freq: 220, to: 60, attack: 0.05 }); },
    cash: () => { tone(1568, 0.08, { type: 'square', vol: 0.05 }); tone(2093, 0.18, { type: 'square', vol: 0.05, at: 0.07 }); },
    achievement: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.1, at: i * 0.08 })); },
    error: () => { tone(220, 0.12, { type: 'square', vol: 0.06 }); tone(165, 0.18, { type: 'square', vol: 0.06, at: 0.1 }); },
    kickoff: () => SOUNDS.whistle(),
    win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.09, at: i * 0.1 })); crowdBurst(0.7, 2); },
    loss: () => { [392, 349, 294].forEach((f, i) => tone(f, 0.4, { type: 'sine', vol: 0.07, at: i * 0.18 })); },
    advance: () => { tone(520, 0.06, { type: 'triangle', vol: 0.05 }); tone(780, 0.08, { type: 'triangle', vol: 0.05, at: 0.05 }); },
  };
  function crowdBurst(vol, dur) { noise(dur, { vol: vol * 0.32, type: 'bandpass', freq: 900, q: 0.4, attack: 0.08 }); noise(dur * 0.8, { vol: vol * 0.18, type: 'bandpass', freq: 2200, q: 0.5, attack: 0.1 }); }

  function play(name) {
    if (!ready() || !SOUNDS[name]) return;
    const t = performance.now();
    if (last[name] && t - last[name] < 60) return;
    last[name] = t;
    try { SOUNDS[name](); } catch (e) { /* ignore */ }
  }
  // the crowd bed for live matches: a loop of filtered noise whose level follows the danger on the pitch
  function crowdStart() {
    if (!ready() || crowd) return;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true;
    f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.35;
    g.gain.value = 0.04;
    s.connect(f); f.connect(g); g.connect(master); s.start();
    crowd = { s, g, f };
  }
  function crowdLevel(x) { if (crowd && ctx) crowd.g.gain.setTargetAtTime(0.03 + 0.09 * U.clamp(x, 0, 1), ctx.currentTime, 0.4); }
  function crowdStop() { if (crowd) { try { crowd.s.stop(); } catch (e) { /* stopped */ } crowd = null; } }

  return {
    play, crowdStart, crowdLevel, crowdStop,
    get on() { return on; },
    toggle() { on = !on; localStorage.setItem(KEY, on ? 'on' : 'off'); if (on) init(); else crowdStop(); return on; },
  };
})();
