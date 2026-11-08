/* Mono page 3 — loads the live story (js/story3d-engine.js, three.js) only when the page is first shown on a desktop window.
   Kept tiny on purpose: a static three.js import here would hold up the whole window. */
const live = document.querySelector('[data-live]');
let engine = null;
let loading = null;
let state = { staged: false, page: false, visible: true };

function fallback() {
  // No WebGL (or the CDN is unreachable): show the regular sections instead.
  const section = live.closest('.sp-content-section');
  if (section) section.classList.add('ap-live-off');
}

function update() {
  const on = state.staged && state.page && state.visible;
  if (engine) { engine.setActive(on); return; }
  if (!on || loading) return;
  loading = import('./story3d-engine.js?v=44')
    .then((m) => m.createLiveStory(live))
    .then((e) => { engine = e; update(); })
    .catch(fallback);
}

if (live) {
  document.addEventListener('stagechange', (e) => {
    state = e.detail;
    update();
  });
}
