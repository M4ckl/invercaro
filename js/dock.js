/* Home dock: macOS-style magnification. Clicking an app opens its window (handled in js/space-window.js). */
(function () {
  const dock = document.getElementById('dock');
  if (!dock) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const apps = Array.from(dock.querySelectorAll('.dock-app'));
  const RANGE = 95;
  const MAX = 0.55;

  function magnify(cursorX) {
    apps.forEach((app) => {
      const r = app.getBoundingClientRect();
      const d = Math.abs(cursorX - (r.left + r.width / 2));
      const boost = Math.max(0, 1 - d / RANGE);
      const eased = boost * boost * (3 - 2 * boost);
      app.style.setProperty('--mag', (1 + MAX * eased).toFixed(3));
    });
  }

  dock.addEventListener('mousemove', (e) => {
    dock.classList.add('is-hover');
    magnify(e.clientX);
  });
  dock.addEventListener('mouseleave', () => {
    dock.classList.remove('is-hover');
    apps.forEach((app) => app.style.setProperty('--mag', '1'));
  });
})();
