'use strict';
// ── STORE: where the save lives ───────────────────────────────────
// IndexedDB is the main home, written to two alternating slots so a write cut short by the OS never takes the
// last good save with it. localStorage holds a mirror written synchronously when the app is hidden (an IndexedDB
// write might not finish before iOS freezes the page). Loading tries every copy newest-first.

const Store = (() => {
  const DB = 'soccerblitz', OS = 'saves', LS_KEY = 'soccerblitz.save.v1', LS_T = 'soccerblitz.save.t';
  let db = null, slot = 0, onFail = null, size = 0;

  function open() {
    return new Promise(res => {
      const give = setTimeout(() => res(null), 2000);
      const done = v => { clearTimeout(give); res(v); };
      try {
        const rq = indexedDB.open(DB, 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore(OS);
        rq.onsuccess = () => done(rq.result);
        rq.onerror = rq.onblocked = () => done(null);
      } catch (e) { done(null); }
    });
  }
  function get(key) {
    return new Promise(res => {
      try { const rq = db.transaction(OS).objectStore(OS).get(key); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); } catch (e) { res(null); }
    });
  }
  async function init() {
    db = await open();
    const found = [];
    if (db) for (const k of ['a', 'b']) { const r = await get(k); if (r && r.data) found.push({ t: r.t || 0, data: r.data, from: k }); }
    try { const d = localStorage.getItem(LS_KEY); if (d) found.push({ t: +localStorage.getItem(LS_T) || 0, data: d, from: 'mirror' }); } catch (e) { /* storage blocked */ }
    found.sort((x, y) => y.t - x.t);
    const newest = found.find(x => x.from !== 'mirror');
    slot = newest && newest.from === 'a' ? 1 : 0;
    if (found[0]) size = found[0].data.length;
    try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { /* unsupported */ }
    return found;
  }
  function mirror(data, t) {
    try { localStorage.setItem(LS_KEY, data); localStorage.setItem(LS_T, String(t)); return true; } catch (e) { return false; }
  }
  const fail = e => { console.warn('Save failed', e); if (onFail) onFail(e); };
  function write(data, hidden) {
    const t = Date.now();
    size = data.length;
    if (hidden || !db) { if (!mirror(data, t) && !db) fail(new Error('localStorage full')); }
    if (!db) return;
    try {
      const k = slot ? 'b' : 'a', tx = db.transaction(OS, 'readwrite');
      tx.objectStore(OS).put({ t, data }, k);
      tx.oncomplete = () => { slot = k === 'a' ? 1 : 0; };
      tx.onerror = tx.onabort = () => { if (!mirror(data, t)) fail(tx.error); };
    } catch (e) { if (!mirror(data, t)) fail(e); }
  }
  function clear() {
    try { localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_T); } catch (e) { /* ignore */ }
    if (db) try { db.transaction(OS, 'readwrite').objectStore(OS).clear(); } catch (e) { /* ignore */ }
    size = 0;
  }
  return { init, write, clear, setOnFail: fn => { onFail = fn; }, info: () => ({ db: !!db, size }) };
})();
