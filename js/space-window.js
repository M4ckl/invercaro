/* Home — app windows. Each app has its own Space window (space.html#app) and Support window (support.html#app), each an iframe in a
   `.space-host`. Several can be open (the front one is on top) or minimised at once: minimise is a macOS-style genie into that
   window's own thumbnail at the right end of the dock, and the thumbnail (or the app's dock icon) brings it back the same way.
   While a window is in front the menu bar switches to that app: its name, then Support (or Overview, from its Support window). */
(function () {
  const hosts = document.getElementById('space-hosts');
  if (!hosts) return;
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GENIE_MS = 680;
  const dockEl = document.getElementById('dock');
  const windowsEl = document.getElementById('dock-windows');

  const APPS = {
    mono: { name: 'Mono', status: 'Testing', desc: 'Track spending. Nothing more.' },
    intent: { name: 'Intent', status: 'Testing', desc: 'Plan the trip. Keep the journey.' },
    sileo: { name: 'Sileo', status: 'Design', desc: 'Space to pause, breathe and notice the small wins.' },
  };
  const PAGES = { space: 'space.html', support: 'support.html' };

  const wins = new Map();
  let stack = [];
  let spare = null;

  /* ---- window objects ---- */
  function makeHost(kind, hash) {
    const host = document.createElement('div');
    host.className = 'space-host';
    host.hidden = true;
    const frame = document.createElement('iframe');
    frame.className = 'space-frame';
    frame.tabIndex = -1;
    frame.src = PAGES[kind] + hash;
    host.append(frame);
    hosts.append(host);
    return { kind, host, frame, ready: false, pending: null, open: false, max: false, thumb: null, genie: null, hideTimer: 0 };
  }

  function getWin(kind, app) {
    const key = `${kind}:${app}`;
    let w = wins.get(key);
    if (w) return w;
    if (kind === 'space' && spare) {
      w = spare;
      spare = null;
      w.route = '#' + app;
    } else {
      w = makeHost(kind, '#' + app);
    }
    w.key = key;
    w.app = app;
    w.frame.title = `${APPS[app].name} ${kind === 'support' ? 'Support' : ''}`.trim();
    wins.set(key, w);
    return w;
  }

  const send = (w, msg) => {
    if (w.ready && w.frame.contentWindow) w.frame.contentWindow.postMessage({ space: true, ...msg }, '*');
  };
  const front = () => stack[stack.length - 1] || null;

  /* ---- stacking, menu bar, dock dots ---- */
  const menubar = document.querySelector('.menubar');
  const siteGroup = document.getElementById('menubar-site');
  const appGroup = document.getElementById('menubar-app');
  let swapT = 0;

  function fillMenus(w) {
    const a = APPS[w.app];
    document.getElementById('menubar-app-name').textContent = a.name;
    document.getElementById('menu-app-title').textContent = a.name;
    document.getElementById('menu-app-status').textContent = a.status;
    document.getElementById('menu-app-desc').textContent = a.desc;
    const overview = document.getElementById('menubar-app-overview');
    const support = document.getElementById('menubar-app-support');
    overview.href = `space.html#${w.app}`;
    support.href = `support.html#${w.app}`;
    // Only the other window of this app is offered: Support from its page, Overview from its Support.
    overview.hidden = w.kind === 'space';
    support.hidden = w.kind === 'support';
  }

  function setAppMenus(w) {
    if (!menubar || !appGroup) return;
    clearTimeout(swapT);
    if (!w) {
      menubar.classList.remove('is-app');
      appGroup.inert = true;
      siteGroup.inert = false;
      return;
    }
    siteGroup.inert = true;
    appGroup.inert = false;
    if (menubar.classList.contains('is-app') && !reduceMotion) {
      appGroup.classList.add('is-refreshing');
      swapT = setTimeout(() => {
        fillMenus(w);
        appGroup.classList.remove('is-refreshing');
      }, 180);
    } else {
      fillMenus(w);
      menubar.classList.add('is-app');
    }
  }

  function restack() {
    stack.forEach((w, i) => {
      w.host.style.zIndex = String((w.max ? 60 : 40) + i);
      send(w, { type: 'visible', on: i === stack.length - 1 });
    });
    root.classList.toggle('space-open', stack.length > 0);
    setAppMenus(front());
    // The front app's Support window loads in the background, so the menu bar's Support opens at once.
    if (front() && front().kind === 'space') getWin('support', front().app);
    document.querySelectorAll('.dock-app').forEach((b) => {
      const app = b.dataset.app;
      b.classList.toggle('is-running', [...wins.values()].some((w) => w.app === app && (w.open || w.thumb)));
    });
  }

  /* ---- dock thumbnails ---- */
  function makeThumb(w) {
    const appBtn = document.querySelector(`.dock-app[data-app="${w.app}"]`);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dock-window';
    btn.setAttribute('aria-label', `Show ${w.frame.title} window`);
    const shot = w.kind === 'space'
      ? `<img class="dock-window-shot" src="style/videos/${w.app}/${w.app}_hero_poster.jpg" alt="">`
      : '<span class="dock-window-shot dock-window-shot--support"><b>?</b></span>';
    btn.innerHTML = `<span class="dock-window-card"><span class="dock-window-bar"><i></i><i></i><i></i></span>${shot}</span>`;
    if (appBtn) {
      const badge = appBtn.querySelector('.dock-icon').cloneNode();
      badge.className = 'dock-window-badge';
      badge.alt = '';
      btn.append(badge);
    }
    btn.addEventListener('click', () => show(w, { restore: true }));
    windowsEl.append(btn);
    return btn;
  }

  /* Where the thumbnail ends up once the dock has grown, so the genie can aim there while the dock animates. */
  function slotRect(btn) {
    dockEl.classList.add('is-measuring', 'has-windows');
    btn.classList.add('is-in');
    const rect = btn.getBoundingClientRect();
    btn.classList.remove('is-in');
    if (!windowsEl.querySelector('.dock-window.is-in')) dockEl.classList.remove('has-windows');
    void btn.offsetWidth;
    dockEl.classList.remove('is-measuring');
    dockEl.classList.add('has-windows');
    btn.classList.add('is-in');
    return rect;
  }

  function dropThumb(w) {
    if (!w.thumb) return;
    const old = w.thumb;
    w.thumb = null;
    old.classList.remove('is-filled', 'is-in');
    if (!windowsEl.querySelector('.dock-window.is-in')) dockEl.classList.remove('has-windows');
    setTimeout(() => old.remove(), 400);
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

  function genieFrames(w, target) {
    const f = w.frame.getBoundingClientRect();
    const cx = target.left + target.width / 2 - f.left;
    const cy = target.top + target.height / 2 - f.top;
    const mid = (cx / f.width) * 100;
    const half = (target.width / f.width) * 50;
    const l = mid - half;
    const r = mid + half;
    w.frame.style.transformOrigin = `${cx}px ${cy}px`;
    return [
      { offset: 0, clipPath: funnel(0, 100, 0, 100), transform: 'scale(1, 1)', opacity: 1 },
      { offset: 0.42, clipPath: funnel(0, 100, l, r), transform: 'scale(1, 0.9)', opacity: 1 },
      { offset: 0.78, clipPath: funnel(l * 0.75, 100 - (100 - r) * 0.75, l, r), transform: 'scale(1, 0.32)', opacity: 1 },
      { offset: 1, clipPath: funnel(l, r, l, r), transform: 'scale(1, 0.02)', opacity: 0 },
    ];
  }

  function stopGenie(w) {
    if (!w.genie) return;
    w.genie.onfinish = null;
    w.genie.cancel();
    w.genie = null;
    w.frame.style.transformOrigin = '';
    w.host.classList.remove('is-genie');
  }

  /* ---- open / focus / close / minimise ---- */
  function show(w, { restore = false, hash = null } = {}) {
    clearTimeout(w.hideTimer);
    if (!w.ready) { w.pending = { restore, hash }; return; }
    const route = hash || w.route;
    w.route = null;
    if (route) send(w, { type: 'route', hash: route });
    send(w, { type: 'theme', theme: root.getAttribute('data-theme') || 'light' });
    stack = stack.filter((x) => x !== w).concat(w);
    if (w.open) { restack(); w.frame.focus(); return; }

    const fromRect = w.thumb && !reduceMotion ? w.thumb.getBoundingClientRect() : null;
    w.open = true;
    dropThumb(w);
    stopGenie(w);
    w.host.hidden = false;
    w.host.classList.remove('is-closing', 'is-minimizing');
    w.host.classList.toggle('is-max', w.max);
    restack();

    if (restore && fromRect && fromRect.width > 0) {
      w.host.classList.add('is-genie', 'is-open');
      w.genie = w.frame.animate(genieFrames(w, fromRect), {
        duration: GENIE_MS,
        easing: 'cubic-bezier(0.45, 0, 0.35, 1)',
        direction: 'reverse',
      });
      w.genie.onfinish = () => stopGenie(w);
    } else {
      void w.host.offsetWidth;
      w.host.classList.add('is-open');
    }
    w.frame.focus();
  }

  function hide(w, minimize) {
    if (!w.open) return;
    w.open = false;
    stack = stack.filter((x) => x !== w);
    if (minimize) w.thumb = makeThumb(w);
    restack();
    send(w, { type: 'visible', on: false });

    const canGenie = minimize && !reduceMotion && dockEl.getBoundingClientRect().width > 0;
    if (canGenie) {
      stopGenie(w);
      w.host.classList.add('is-genie');
      const target = slotRect(w.thumb);
      const filled = w.thumb;
      w.genie = w.frame.animate(genieFrames(w, target), {
        duration: GENIE_MS,
        easing: 'cubic-bezier(0.45, 0, 0.35, 1)',
        fill: 'forwards',
      });
      w.genie.onfinish = () => {
        w.host.hidden = true;
        w.host.classList.remove('is-open');
        stopGenie(w);
        filled.classList.add('is-filled');
      };
      return;
    }

    if (minimize && w.thumb) {
      dockEl.classList.add('has-windows');
      w.thumb.classList.add('is-in', 'is-filled');
    }
    w.host.classList.remove('is-open');
    w.host.classList.add('is-closing');
    w.host.classList.toggle('is-minimizing', minimize);
    w.hideTimer = setTimeout(() => {
      w.host.hidden = true;
      w.host.classList.remove('is-closing', 'is-minimizing');
    }, reduceMotion ? 0 : 520);
  }

  function close(w) {
    dropThumb(w);
    if (w.open) hide(w, false);
    else restack();
  }

  /* Open (or bring forward, or restore) the window of one kind for one app. */
  function openWindow(kind, app, hash) {
    if (!APPS[app]) app = 'mono';
    const w = getWin(kind, app);
    show(w, { restore: !!w.thumb, hash: hash || null });
  }

  /* space.html#mono, #intent, #sileo, #privacy (Mono), #intent-privacy (Intent); support.html#app. */
  function openHref(href) {
    const url = new URL(href, window.location.href);
    const hash = url.hash;
    if (url.pathname.endsWith('support.html')) {
      const app = hash.slice(1) || (front() && front().app) || 'mono';
      openWindow('support', APPS[app] ? app : 'mono');
      return;
    }
    const app = hash === '#privacy' ? 'mono' : hash === '#intent-privacy' ? 'intent' : hash.slice(1);
    openWindow('space', APPS[app] ? app : 'mono', hash || null);
  }

  /* ---- messages from the windows ---- */
  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg || !msg.space) return;
    const w = [...wins.values(), spare].find((x) => x && x.frame.contentWindow === e.source);
    if (!w) return;
    if (msg.type === 'ready') {
      w.ready = true;
      if (w.pending) { const p = w.pending; w.pending = null; show(w, p); }
    }
    if (msg.type === 'close') close(w);
    if (msg.type === 'minimize') hide(w, true);
    if (msg.type === 'zoom') {
      w.max = msg.on;
      w.host.classList.toggle('is-max', msg.on);
      restack();
    }
    if (msg.type === 'open' && msg.href) {
      if (msg.href === 'index.html') close(w);
      else openHref(msg.href);
    }
  });

  /* ---- an app's dock icon opens (or restores) its window ---- */
  document.addEventListener('click', (e) => {
    const app = e.target.closest('.dock-app');
    if (!app) return;
    const minimized = [...wins.values()].find((w) => w.app === app.dataset.app && w.thumb && w.kind === 'space')
      || [...wins.values()].find((w) => w.app === app.dataset.app && w.thumb);
    if (minimized) show(minimized, { restore: true });
    else openWindow('space', app.dataset.app);
  });

  /* ---- links to Space or Support open their windows ---- */
  document.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const a = e.target.closest('a[href^="space.html"], a[href^="support.html"]');
    if (!a) return;
    e.preventDefault();
    openHref(a.getAttribute('href'));
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && front() && !document.querySelector('.menu-trigger[aria-expanded="true"]')) close(front());
  });

  document.addEventListener('themechange', (e) => wins.forEach((w) => send(w, { type: 'theme', theme: e.detail })));

  /* ---- warm up one Space window after the home page has loaded ---- */
  window.addEventListener('load', () => setTimeout(() => { if (!wins.size && !spare) spare = makeHost('space', '#mono'); }, 1200));
})();
