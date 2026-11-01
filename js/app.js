'use strict';
// ── BOOT ──────────────────────────────────────────────────────────

(function fitViewport() {
  const standalone = !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
  if (standalone) document.documentElement.classList.add('standalone');
  const set = () => {
    let h = Math.max(window.innerHeight, document.documentElement.clientHeight || 0);
    if (standalone && screen.width && screen.height) {
      const portrait = window.innerHeight >= window.innerWidth;
      h = Math.max(h, portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height));
    }
    document.documentElement.style.setProperty('--app-h', `${h}px`);
  };
  set();
  window.addEventListener('resize', set);
  window.addEventListener('orientationchange', () => setTimeout(set, 250));
  window.addEventListener('pageshow', set);
  if (window.visualViewport) visualViewport.addEventListener('resize', set);
  window.addEventListener('scroll', () => { if (window.scrollY) window.scrollTo(0, 0); }, { passive: true });
})();

(async function boot() {
  const copies = await Store.init();
  if (copies.length && !copies.some(c => L.load(c.data))) { console.warn('No saved copy could be read; starting fresh.'); G = null; }
  UI.wire();
  UI.render();
})();
