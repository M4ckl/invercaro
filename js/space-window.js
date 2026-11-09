/* Home — Space opens as an in-page window (space.html in an iframe) instead of loading a new page; its traffic lights close, minimise or zoom it.
   Minimise uses a macOS-style genie into a window thumbnail at the right end of the dock (behind a separator);
   clicking the thumbnail, the app's icon or any Space link brings the window back the same way. */
(function () {
  const host = document.getElementById('space-host');
  if (!host) return;
  const frame = document.getElementById('space-frame');
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GENIE_MS = 680;
  let ready = false;
  let pending = null;
  let open = false;
  let hideTimer = 0;
  let lastFocus = null;
  let currentApp = 'mono';
  let minimizedApp = null;
  let genie = null;
  let thumb = null;
  const dockEl = document.getElementById('dock');
  const windowsEl = document.getElementById('dock-windows');

  const send = (msg) => {
    if (ready && frame.contentWindow) frame.contentWindow.postMessage({ space: true, ...msg }, '*');
  };

  function load(hash) {
    if (!frame.getAttribute('src')) frame.src = 'space.html' + hash;
  }

  /* ---- the minimised window's thumbnail in the dock ---- */
  function makeThumb(app) {
    const appBtn = document.querySelector(`.dock-app[data-app="${app}"]`);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dock-window';
    btn.dataset.app = app;
    btn.setAttribute('aria-label', `Show ${appBtn ? appBtn.dataset.name : app} window`);
    btn.innerHTML =
      '<span class="dock-window-card"><span class="dock-window-bar"><i></i><i></i><i></i></span>' +
      `<img class="dock-window-shot" src="style/videos/${app}/${app}_hero_poster.jpg" alt=""></span>`;
    if (appBtn) {
      const badge = appBtn.querySelector('.dock-icon').cloneNode();
      badge.className = 'dock-window-badge';
      badge.alt = '';
      btn.append(badge);
    }
    windowsEl.append(btn);
    return btn;
  }

  /* Where the thumbnail ends up once the dock has grown, so the genie can aim there while the dock animates. */
  function slotRect(btn) {
    dockEl.classList.add('is-measuring', 'has-windows');
    btn.classList.add('is-in');
    const rect = btn.getBoundingClientRect();
    btn.classList.remove('is-in');
    dockEl.classList.remove('has-windows');
    void btn.offsetWidth;
    dockEl.classList.remove('is-measuring');
    dockEl.classList.add('has-windows');
    btn.classList.add('is-in');
    return rect;
  }

  function dropThumb() {
    if (!thumb) return;
    const old = thumb;
    thumb = null;
    old.classList.remove('is-filled', 'is-in');
    dockEl.classList.remove('has-windows');
    setTimeout(() => old.remove(), 400);
  }

  function setMinimized(app) {
    minimizedApp = app;
    document.querySelectorAll('.dock-app').forEach((b) => b.classList.toggle('is-minimized', b.dataset.app === app));
  }

  /* ---- genie: the window funnels into (or out of) its dock thumbnail ---- */
  const smooth = (t) => t * t * (3 - 2 * t);

  /* A polygon whose top edge spans topL..topR and bottom edge botL..botR (percent of the frame), with curved sides. */
  function funnel(topL, topR, botL, botR) {
    const n = 14;
    const left = [];
    const right = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const e = smooth(t);
      const y = (t * 100).toFixed(2);
      left.push(`${(topL + (botL - topL) * e).toFixed(2)}% ${y}%`);
      right.unshift(`${(topR + (botR - topR) * e).toFixed(2)}% ${y}%`);
    }
    return `polygon(${left.concat(right).join(', ')})`;
  }

  function genieFrames(target) {
    const f = frame.getBoundingClientRect();
    const cx = target.left + target.width / 2 - f.left;
    const cy = target.top + target.height / 2 - f.top;
    const mid = (cx / f.width) * 100;
    const half = (target.width / f.width) * 50;
    const l = mid - half;
    const r = mid + half;
    frame.style.transformOrigin = `${cx}px ${cy}px`;
    return [
      { offset: 0, clipPath: funnel(0, 100, 0, 100), transform: 'scale(1, 1)', opacity: 1 },
      { offset: 0.42, clipPath: funnel(0, 100, l, r), transform: 'scale(1, 0.9)', opacity: 1 },
      { offset: 0.78, clipPath: funnel(l * 0.75, 100 - (100 - r) * 0.75, l, r), transform: 'scale(1, 0.32)', opacity: 1 },
      { offset: 1, clipPath: funnel(l, r, l, r), transform: 'scale(1, 0.02)', opacity: 0 },
    ];
  }

  function stopGenie() {
    if (!genie) return;
    genie.onfinish = null;
    genie.cancel();
    genie = null;
    frame.style.transformOrigin = '';
    host.classList.remove('is-genie');
  }

  /* ---- open / close ---- */
  function show(hash, { restore = false } = {}) {
    clearTimeout(hideTimer);
    if (!ready) { pending = hash; load(hash); return; }
    const fromRect = thumb && !reduceMotion ? thumb.getBoundingClientRect() : null;
    // Bringing the minimised window back keeps its page and scroll; a Space link routes as usual.
    if (!restore) send({ type: 'route', hash });
    send({ type: 'theme', theme: root.getAttribute('data-theme') || 'light' });
    send({ type: 'visible', on: true });
    if (open) return;
    open = true;
    setMinimized(null);
    dropThumb();
    lastFocus = document.activeElement;
    stopGenie();
    host.hidden = false;
    host.classList.remove('is-closing', 'is-minimizing');
    root.classList.add('space-open');

    if (fromRect && fromRect.width > 0) {
      host.classList.add('is-genie', 'is-open');
      genie = frame.animate(genieFrames(fromRect), {
        duration: GENIE_MS,
        easing: 'cubic-bezier(0.45, 0, 0.35, 1)',
        direction: 'reverse',
      });
      genie.onfinish = stopGenie;
    } else {
      void host.offsetWidth;
      host.classList.add('is-open');
    }
    frame.focus();
  }

  function hide(minimize) {
    if (!open) return;
    open = false;
    send({ type: 'visible', on: false });
    if (lastFocus && lastFocus.focus) lastFocus.focus();

    const canGenie = minimize && !reduceMotion && dockEl && windowsEl && dockEl.getBoundingClientRect().width > 0;
    if (minimize) { dropThumb(); thumb = dockEl && windowsEl ? makeThumb(currentApp) : null; }
    if (canGenie) {
      stopGenie();
      host.classList.add('is-genie');
      host.classList.remove('is-max');
      root.classList.remove('space-open');
      setMinimized(currentApp);
      const target = slotRect(thumb);
      const filled = thumb;
      genie = frame.animate(genieFrames(target), {
        duration: GENIE_MS,
        easing: 'cubic-bezier(0.45, 0, 0.35, 1)',
        fill: 'forwards',
      });
      genie.onfinish = () => {
        host.hidden = true;
        host.classList.remove('is-open');
        stopGenie();
        filled.classList.add('is-filled');
      };
      return;
    }

    if (minimize) {
      setMinimized(currentApp);
      if (thumb) {
        dockEl.classList.add('has-windows');
        thumb.classList.add('is-in', 'is-filled');
      }
    }
    host.classList.remove('is-open', 'is-max');
    host.classList.add('is-closing');
    host.classList.toggle('is-minimizing', minimize);
    root.classList.remove('space-open');
    hideTimer = setTimeout(() => {
      host.hidden = true;
      host.classList.remove('is-closing', 'is-minimizing');
    }, reduceMotion ? 0 : 520);
  }

  /* ---- messages from the window ---- */
  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg || !msg.space || e.source !== frame.contentWindow) return;
    if (msg.type === 'ready') {
      ready = true;
      if (pending) { const hash = pending; pending = null; show(hash); }
    }
    if (msg.type === 'app' && msg.app) currentApp = msg.app;
    if (msg.type === 'close') { setMinimized(null); dropThumb(); hide(false); }
    if (msg.type === 'minimize') hide(true);
    if (msg.type === 'zoom') host.classList.toggle('is-max', msg.on);
  });

  /* ---- the dock thumbnail, or the minimised app's icon, reopens the window (before the dock's own click handler) ---- */
  document.addEventListener('click', (e) => {
    const button = e.target.closest('.dock-window, .dock-app');
    if (!button || !minimizedApp || button.dataset.app !== minimizedApp) return;
    e.preventDefault();
    e.stopPropagation();
    show('#' + minimizedApp, { restore: true });
  }, true);

  /* ---- an app's dock icon opens its window ---- */
  document.addEventListener('click', (e) => {
    const app = e.target.closest('.dock-app');
    if (app) show('#' + app.dataset.app);
  });

  /* ---- links to Space open the window ---- */
  document.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const a = e.target.closest('a[href^="space.html"]');
    if (!a) return;
    e.preventDefault();
    show(new URL(a.href).hash || '#mono');
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open && !document.querySelector('.menu-trigger[aria-expanded="true"]')) {
      setMinimized(null);
      hide(false);
    }
  });

  document.addEventListener('themechange', (e) => send({ type: 'theme', theme: e.detail }));

  /* ---- warm up after the home page has loaded ---- */
  window.addEventListener('load', () => setTimeout(() => load('#mono'), 1200));
})();
