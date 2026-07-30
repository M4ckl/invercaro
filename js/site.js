/* Shared site behaviour: theme toggle (circular reveal) + smooth page transitions. */
(function () {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Theme ---------------- */
  function currentTheme() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function updateAppIcons() {
    const dark = currentTheme() === 'dark';
    document.querySelectorAll('[data-app-icon]').forEach((img) => {
      const name = img.getAttribute('data-app-icon');
      img.src = 'style/icons/icon_' + name + (dark ? '_dark' : '') + '.svg';
    });
  }

  function applyTheme(next) {
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('invercaro-theme', next); } catch (e) {}
    updateAppIcons();
    document.dispatchEvent(new CustomEvent('themechange', { detail: next }));
  }

  updateAppIcons();

  /* A disc in the target theme's background colour grows from the toggle,
     the theme is applied under the full cover, then the disc fades away. */
  function toggleTheme(x, y) {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    if (reduceMotion) { applyTheme(next); return; }

    const cx = x == null ? window.innerWidth / 2 : x;
    const cy = y == null ? window.innerHeight / 2 : y;
    const endR = Math.hypot(
      Math.max(cx, window.innerWidth - cx),
      Math.max(cy, window.innerHeight - cy)
    );

    const overlay = document.createElement('div');
    overlay.className = 'theme-reveal';
    overlay.dataset.to = next;
    overlay.style.clipPath = overlay.style.webkitClipPath = `circle(0px at ${cx}px ${cy}px)`;
    document.body.appendChild(overlay);
    void overlay.offsetWidth;
    overlay.style.clipPath = overlay.style.webkitClipPath = `circle(${endR}px at ${cx}px ${cy}px)`;

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      applyTheme(next);
      overlay.classList.add('is-done');
      setTimeout(() => overlay.remove(), 300);
    };
    overlay.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 780);
  }

  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const r = toggle.getBoundingClientRect();
      toggleTheme(r.left + r.width / 2, r.top + r.height / 2);
    });
  }

  /* ---------------- Smooth page transitions ---------------- */
  function isInternal(a) {
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return false;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
    if (/^https?:\/\//i.test(href)) return a.hostname === window.location.hostname;
    return true;
  }

  let leaving = false;
  document.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const a = e.target.closest('a');
    if (!a || !isInternal(a)) return;

    const dest = new URL(a.href, window.location.href);
    if (dest.pathname === window.location.pathname && dest.hash) return;

    e.preventDefault();
    if (leaving) return;
    leaving = true;

    if (reduceMotion) { window.location.href = a.href; return; }
    root.classList.add('is-leaving');
    window.setTimeout(() => { window.location.href = a.href; }, 430);
  });

  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      leaving = false;
      root.classList.remove('is-leaving');
    }
  });
})();
