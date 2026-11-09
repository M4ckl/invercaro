/* The 3D pages of the Space window, each loaded (three.js) only when it is first needed on a desktop window:
   Mono's live story (js/story3d-engine.js), Sileo's design frame (js/sileo3d.js) and Intent's frames (js/intent3d.js).
   Kept tiny on purpose: a static three.js import here would hold up the whole window. */
function mount(el, wanted, load) {
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
    const on = wanted(state);
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

const onPage = (id) => (s) => s.staged && s.page && s.visible && s.section === id;

mount(document.querySelector('[data-live]'), onPage('sp-mono'), (el) => import('./story3d-engine.js?v=68').then((m) => m.createLiveStory(el)));
mount(document.querySelector('[data-sileo3d]'), onPage('sp-sileo'), (el) => import('./sileo3d.js?v=68').then((m) => m.createSileoScene(el)));
// Intent has a 3D frame on every stage after the hero, so it loads as soon as its window is shown.
mount(document.getElementById('sp-intent'), (s) => s.staged && s.visible && s.section === 'sp-intent',
  (el) => import('./intent3d.js?v=68').then((m) => m.createIntentScenes(el)));
