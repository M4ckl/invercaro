/* Support page — app picker and FAQ accordion; embedded in the home page it is one app's Support window (traffic lights, hash-routed). */
document.addEventListener('DOMContentLoaded', () => {
    const root = document.documentElement;
    const embedded = root.classList.contains('is-embed');
    const apps = document.querySelectorAll('.su-app');
    const panels = document.querySelectorAll('.su-panel');
    const title = document.getElementById('su-window-title');
    const tell = (msg) => window.parent.postMessage({ space: true, ...msg }, '*');

    /* ---- app picker ---- */
    function select(name, updateHash) {
        apps.forEach((app) => {
            const on = app.dataset.app === name;
            app.classList.toggle('is-active', on);
            app.setAttribute('aria-pressed', on);
        });
        panels.forEach((panel) => panel.classList.toggle('is-active', panel.id === `su-${name}`));
        const app = document.querySelector(`.su-app[data-app="${name}"] strong`);
        if (title && app) title.textContent = `${app.textContent} Support`;
        if (updateHash) history.replaceState(null, '', `#${name}`);
        if (embedded) tell({ type: 'app', app: name });
    }

    apps.forEach((app) => app.addEventListener('click', () => select(app.dataset.app, true)));

    function fromHash() {
        const name = window.location.hash.slice(1);
        select(document.getElementById(`su-${name}`) ? name : 'mono', false);
    }

    window.addEventListener('hashchange', fromHash);
    fromHash();

    /* ---- faq ---- */
    document.querySelectorAll('.su-faq-q').forEach((question) => {
        question.addEventListener('click', () => {
            const open = question.getAttribute('aria-expanded') === 'true';
            question.setAttribute('aria-expanded', !open);
        });
    });

    if (!embedded) return;

    /* ---- window controls (embedded in the home page) ---- */
    function setMax(on) {
        root.classList.toggle('su-max', on);
        const zoom = document.querySelector('[data-win="zoom"]');
        if (zoom) zoom.setAttribute('aria-label', on ? 'Exit full screen' : 'Enter full screen');
        tell({ type: 'zoom', on });
    }

    document.querySelectorAll('[data-win]').forEach((btn) => btn.addEventListener('click', () => {
        const action = btn.dataset.win;
        if (action === 'zoom') setMax(!root.classList.contains('su-max'));
        else tell({ type: action });
    }));

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (root.classList.contains('su-max')) setMax(false);
        else tell({ type: 'close' });
    });

    /* Links to Space (e.g. a privacy policy) open in the home page's Space window, not inside this one. */
    document.addEventListener('click', (e) => {
        const a = e.target.closest('a[href^="space.html"], a[href^="support.html"], a[href="index.html"]');
        if (!a) return;
        e.preventDefault();
        tell({ type: 'open', href: a.getAttribute('href') });
    }, true);

    window.addEventListener('message', (e) => {
        const msg = e.data;
        if (!msg || !msg.space || e.source !== window.parent) return;
        if (msg.type === 'route') {
            if (window.location.hash === msg.hash) fromHash();
            else window.location.hash = msg.hash;
        }
        if (msg.type === 'visible' && !msg.on && root.classList.contains('su-max')) setMax(false);
        if (msg.type === 'theme' && msg.theme !== root.getAttribute('data-theme')) {
            root.setAttribute('data-theme', msg.theme);
            document.dispatchEvent(new CustomEvent('themechange', { detail: msg.theme }));
        }
    });

    tell({ type: 'ready' });
});
