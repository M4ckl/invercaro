/* Home dock: app switcher that drives the centre 3D model + the menu bar's app menus. */
(function () {
  const dock = document.getElementById('dock');
  if (!dock) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const apps = Array.from(dock.querySelectorAll('.dock-app'));

  const menubar = document.querySelector('.menubar');
  const siteGroup = document.getElementById('menubar-site');
  const appGroup = document.getElementById('menubar-app');
  const appExplore = document.getElementById('menubar-app-explore');
  const appAbout = document.getElementById('menubar-app-about');
  const appName = document.getElementById('menu-app-name');
  const appStatus = document.getElementById('menu-app-status');
  const appDesc = document.getElementById('menu-app-desc');

  const modelStage = document.getElementById('model-stage');
  const modelFloat = document.getElementById('model-float');
  let modelViewer = document.getElementById('app-model');
  let incoming = null;
  let orbit = '0deg 90deg 95%';

  /* ---------------- macOS-style dock magnification ---------------- */
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

  if (!reduceMotion) {
    dock.addEventListener('mousemove', (e) => {
      dock.classList.add('is-hover');
      magnify(e.clientX);
    });
    dock.addEventListener('mouseleave', () => {
      dock.classList.remove('is-hover');
      apps.forEach((app) => app.style.setProperty('--mag', '1'));
    });
  }

  /* ---------------- App selection ---------------- */
  const STATUS_LABELS = { design: 'Design', testing: 'Testing' };
  let active = null;
  let modelActive = false;
  let swapT = 0;

  function fillMenus(app) {
    const d = app.dataset;
    appExplore.href = d.href;
    appAbout.textContent = 'About ' + d.name;
    appName.textContent = d.name;
    appStatus.textContent = STATUS_LABELS[d.status] || d.status;
    appDesc.textContent = d.desc;
  }

  function setAppMenus(app) {
    clearTimeout(swapT);
    if (!app) {
      menubar.classList.remove('is-app');
      appGroup.classList.remove('is-refreshing');
      appGroup.inert = true;
      siteGroup.inert = false;
      return;
    }
    siteGroup.inert = true;
    appGroup.inert = false;
    if (menubar.classList.contains('is-app') && !reduceMotion) {
      appGroup.classList.add('is-refreshing');
      swapT = setTimeout(() => {
        fillMenus(app);
        appGroup.classList.remove('is-refreshing');
      }, 180);
    } else {
      fillMenus(app);
      menubar.classList.add('is-app');
    }
  }

  function popStage() {
    if (reduceMotion) return;
    modelStage.classList.remove('pop');
    void modelStage.offsetWidth;
    modelStage.classList.add('pop');
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function modelSrc(app, theme = currentTheme()) {
    const name = app.dataset.app;
    return `style/3d%20models/${name}/icon_${name}_3d_${theme}.glb`;
  }

  function prefetchOtherTheme(app) {
    const other = currentTheme() === 'dark' ? 'light' : 'dark';
    fetch(modelSrc(app, other)).catch(() => {});
  }

  function cancelSwap() {
    if (!incoming) return;
    incoming.remove();
    incoming = null;
  }

  function showModel(app) {
    if (!modelViewer) return;
    cancelSwap();
    modelViewer.hidden = false;
    const src = modelSrc(app);
    if (modelViewer.getAttribute('src') !== src) modelViewer.setAttribute('src', src);
    modelStage.classList.add('has-model');
    modelActive = true;
    resetOrbit();
    popStage();
    prefetchOtherTheme(app);
  }

  /* ---------------- Theme cross-fade: new model dissolves in over the old one ---------------- */
  function swapModelForTheme() {
    if (!modelActive || !modelViewer || !active) return;
    const src = modelSrc(active);
    if (modelViewer.getAttribute('src') === src) return;
    if (reduceMotion) { modelViewer.setAttribute('src', src); return; }

    cancelSwap();
    const next = modelViewer.cloneNode(false);
    next.removeAttribute('id');
    next.classList.remove('is-leaving');
    next.classList.add('is-entering');
    next.setAttribute('camera-orbit', orbit);
    next.setAttribute('src', src);
    modelFloat.appendChild(next);
    incoming = next;

    next.addEventListener('load', () => {
      if (incoming !== next) return;
      incoming = null;
      const old = modelViewer;
      old.removeAttribute('id');
      next.id = 'app-model';
      next.cameraOrbit = orbit;
      modelViewer = next;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        next.classList.remove('is-entering');
        old.classList.add('is-leaving');
      }));
      setTimeout(() => old.remove(), 1000);
      prefetchOtherTheme(active);
    }, { once: true });
  }

  function select(app) {
    if (active === app) { deselect(); return; }
    active = app;
    apps.forEach((a) => a.classList.toggle('is-active', a === app));
    setAppMenus(app);
    showModel(app);
  }

  function deselect() {
    cancelSwap();
    active = null;
    modelActive = false;
    apps.forEach((a) => a.classList.remove('is-active'));
    if (modelViewer) modelViewer.hidden = true;
    modelStage.classList.remove('has-model');
    setAppMenus(null);
  }

  apps.forEach((app) => app.addEventListener('click', () => select(app)));

  document.addEventListener('themechange', swapModelForTheme);

  /* ---------------- Cursor-reactive tilt (no spin) ---------------- */
  const REST_PHI = 90;
  const MAX_THETA = 34;
  const MAX_PHI = 20;
  const RADIUS = '95%';

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function resetOrbit() {
    orbit = `0deg ${REST_PHI}deg ${RADIUS}`;
    if (modelViewer) modelViewer.cameraOrbit = orbit;
  }

  let rafPending = false;
  let pendTheta = 0, pendPhi = REST_PHI;

  function onMouse(e) {
    if (!modelActive || !modelViewer) return;
    const r = modelStage.getBoundingClientRect();
    const nx = clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth * 0.5), -1, 1);
    const ny = clamp((e.clientY - (r.top + r.height / 2)) / (window.innerHeight * 0.5), -1, 1);
    pendTheta = -nx * MAX_THETA;
    pendPhi = REST_PHI - ny * MAX_PHI;
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        orbit = `${pendTheta.toFixed(1)}deg ${pendPhi.toFixed(1)}deg ${RADIUS}`;
        modelViewer.cameraOrbit = orbit;
        if (incoming) incoming.cameraOrbit = orbit;
      });
    }
  }

  window.addEventListener('mousemove', onMouse, { passive: true });
})();
