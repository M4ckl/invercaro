/* Home — Space opens as an in-page window (space.html in an iframe) instead of loading a new page; its traffic lights close, minimise or zoom it. */
(function () {
  const host = document.getElementById('space-host');
  if (!host) return;
  const frame = document.getElementById('space-frame');
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ready = false;
  let pending = null;
  let open = false;
  let hideTimer = 0;
  let lastFocus = null;

  const send = (msg) => {
    if (ready && frame.contentWindow) frame.contentWindow.postMessage({ space: true, ...msg }, '*');
  };

  function load(hash) {
    if (!frame.getAttribute('src')) frame.src = 'space.html' + hash;
  }

  function show(hash) {
    clearTimeout(hideTimer);
    if (!ready) { pending = hash; load(hash); return; }
    send({ type: 'route', hash });
    send({ type: 'theme', theme: root.getAttribute('data-theme') || 'light' });
    send({ type: 'visible', on: true });
    if (open) return;
    open = true;
    lastFocus = document.activeElement;
    host.hidden = false;
    host.classList.remove('is-closing', 'is-minimizing');
    void host.offsetWidth;
    host.classList.add('is-open');
    root.classList.add('space-open');
    frame.focus();
  }

  function hide(minimize) {
    if (!open) return;
    open = false;
    send({ type: 'visible', on: false });
    host.classList.remove('is-open', 'is-max');
    host.classList.add('is-closing');
    host.classList.toggle('is-minimizing', minimize);
    root.classList.remove('space-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
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
    if (msg.type === 'close') hide(false);
    if (msg.type === 'minimize') hide(true);
    if (msg.type === 'zoom') host.classList.toggle('is-max', msg.on);
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
    if (e.key === 'Escape' && open && !document.querySelector('.menu-trigger[aria-expanded="true"]')) hide(false);
  });

  document.addEventListener('themechange', (e) => send({ type: 'theme', theme: e.detail }));

  /* ---- warm up after the home page has loaded ---- */
  window.addEventListener('load', () => setTimeout(() => load('#mono'), 1200));
})();
