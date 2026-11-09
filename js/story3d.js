/* The 3D pages of the Space window, each loaded (three.js) only when its page is first shown on a desktop window:
   Mono's live story (js/story3d-engine.js) and Sileo's design frame (js/sileo3d.js).
   Kept tiny on purpose: a static three.js import here would hold up the whole window. */
function mount(el, sectionId, load) {
  if (!el) return;
  let engine = null;
  let loading = null;
  let state = { staged: false, page: false, visible: true, section: null };

  function fallback() {
    // No WebGL (or the CDN is unreachable): show the flat version instead.
    const section = el.closest('.sp-content-section');
    if (section) section.classList.add('ap-live-off');
  }

  function update() {
    const on = state.staged && state.page && state.visible && state.section === sectionId;
    if (engine) { engine.setActive(on); return; }
    if (!on || loading) return;
    loading = load(el)
      .then((e) => { engine = e; update(); })
      .catch(fallback);
  }

  document.addEventListener('stagechange', (e) => {
    state = e.detail;
    update();
  });
}

mount(document.querySelector('[data-live]'), 'sp-mono', (el) => import('./story3d-engine.js?v=66').then((m) => m.createLiveStory(el)));
mount(document.querySelector('[data-sileo3d]'), 'sp-sileo', (el) => import('./sileo3d.js?v=66').then((m) => m.createSileoScene(el)));
