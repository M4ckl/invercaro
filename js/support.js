/* Support page — app picker and FAQ accordion. */
document.addEventListener('DOMContentLoaded', () => {
    const apps = document.querySelectorAll('.su-app');
    const panels = document.querySelectorAll('.su-panel');

    /* ---- app picker ---- */
    function select(name, updateHash) {
        apps.forEach((app) => {
            const on = app.dataset.app === name;
            app.classList.toggle('is-active', on);
            app.setAttribute('aria-pressed', on);
        });
        panels.forEach((panel) => panel.classList.toggle('is-active', panel.id === `su-${name}`));
        if (updateHash) history.replaceState(null, '', `#${name}`);
    }

    apps.forEach((app) => app.addEventListener('click', () => select(app.dataset.app, true)));

    function fromHash() {
        const name = window.location.hash.slice(1);
        if (document.getElementById(`su-${name}`)) select(name, false);
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
});
