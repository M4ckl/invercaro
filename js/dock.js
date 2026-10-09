/* Home dock: app switcher that drives the centre 3D model + info panel. */
(function () {
  const dock = document.getElementById('dock');
  if (!dock) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const apps = Array.from(dock.querySelectorAll('.dock-app'));

  const panel = document.getElementById('app-panel');
  const panelName = document.getElementById('app-panel-name');
  const panelStatus = document.getElementById('app-panel-status');
  const panelDesc = document.getElementById('app-panel-desc');
  const panelCta = document.getElementById('app-panel-cta');

  const modelStage = document.getElementById('model-stage');
  const modelViewer = document.getElementById('app-model');

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
  const STATUS_LABELS = { open: 'Open', dev: 'In development', soon: 'Soon' };
  let active = null;
  let modelActive = false;

  function fillPanel(app) {
    const d = app.dataset;
    panelName.textContent = d.name;
    panelStatus.textContent = STATUS_LABELS[d.status] || 'Open';
    panelStatus.className = 'app-panel-status is-' + d.status;
    panelDesc.textContent = d.desc;
    if (d.href) {
      panelCta.href = d.href;
      panelCta.classList.remove('muted');
      panelCta.innerHTML = 'Explore <span class="arrow">→</span>';
    } else {
      panelCta.removeAttribute('href');
      panelCta.classList.add('muted');
      panelCta.textContent = 'Coming soon';
    }
  }

  function popStage() {
    if (reduceMotion) return;
    modelStage.classList.remove('pop');
    void modelStage.offsetWidth;
    modelStage.classList.add('pop');
  }

  function modelSrc(app) {
    const name = app.dataset.app;
    const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    return `style/3d%20models/${name}/icon_${name}_3d_${theme}.glb`;
  }

  function showModel(app) {
    if (!modelViewer) return;
    modelViewer.classList.remove('is-swapping');
    modelViewer.hidden = false;
    const src = modelSrc(app);
    if (modelViewer.getAttribute('src') !== src) modelViewer.setAttribute('src', src);
    modelStage.classList.add('has-model');
    modelActive = true;
    resetOrbit();
    popStage();
  }

  function swapModelForTheme() {
    if (!modelActive || !modelViewer || !active) return;
    const src = modelSrc(active);
    if (modelViewer.getAttribute('src') === src) return;
    modelViewer.classList.add('is-swapping');
    setTimeout(() => modelViewer.setAttribute('src', src), 220);
  }

  function openPanel(app) {
    panel.setAttribute('aria-hidden', 'false');
    if (panel.classList.contains('is-open')) {
      panel.classList.remove('is-open');
      setTimeout(() => {
        fillPanel(app);
        requestAnimationFrame(() => panel.classList.add('is-open'));
      }, 200);
    } else {
      fillPanel(app);
      requestAnimationFrame(() => panel.classList.add('is-open'));
    }
  }

  function select(app) {
    if (active === app) { deselect(); return; }
    active = app;
    apps.forEach((a) => a.classList.toggle('is-active', a === app));
    openPanel(app);
    showModel(app);
  }

  function deselect() {
    active = null;
    modelActive = false;
    apps.forEach((a) => a.classList.remove('is-active'));
    if (modelViewer) modelViewer.hidden = true;
    modelStage.classList.remove('has-model');
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
  }

  apps.forEach((app) => app.addEventListener('click', () => select(app)));

  if (modelViewer) {
    modelViewer.addEventListener('load', () => modelViewer.classList.remove('is-swapping'));
  }
  document.addEventListener('themechange', swapModelForTheme);

  /* ---------------- Cursor-reactive tilt (no spin) ---------------- */
  const REST_PHI = 90;
  const MAX_THETA = 34;
  const MAX_PHI = 20;
  const RADIUS = '95%';

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function resetOrbit() {
    if (modelViewer) modelViewer.cameraOrbit = `0deg ${REST_PHI}deg ${RADIUS}`;
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
        modelViewer.cameraOrbit = `${pendTheta.toFixed(1)}deg ${pendPhi.toFixed(1)}deg ${RADIUS}`;
      });
    }
  }

  window.addEventListener('mousemove', onMouse, { passive: true });
})();
