/* Shared page behaviour: menu bar (current page, clock, menus, studio window), splash, entrance. */
document.addEventListener('DOMContentLoaded', () => {
    const root = document.documentElement;

    /* ---------------- Current page ---------------- */
    const path = window.location.pathname;
    const current = path.includes('space.html') ? 'link-space'
        : path.includes('support.html') ? 'link-support'
        : 'link-invercaro';
    const currentLink = document.getElementById(current);
    if (currentLink) {
        currentLink.classList.add('nav-current');
        currentLink.setAttribute('aria-current', 'page');
    }

    /* ---------------- Clock ---------------- */
    const clock = document.getElementById('menubar-clock');
    if (clock) {
        const dateFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
        const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
        const tick = () => {
            const now = new Date();
            clock.textContent = `${dateFmt.format(now)}  ${timeFmt.format(now)}`;
            clock.dateTime = now.toISOString();
            setTimeout(tick, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 20);
        };
        tick();
    }

    /* ---------------- Menus ---------------- */
    const triggers = Array.from(document.querySelectorAll('.menu-trigger'));
    let openTrigger = null;

    function setMenu(trigger) {
        if (openTrigger === trigger) return;
        if (openTrigger) {
            openTrigger.setAttribute('aria-expanded', 'false');
            openTrigger.parentElement.classList.remove('is-open');
        }
        openTrigger = trigger;
        if (trigger) {
            trigger.setAttribute('aria-expanded', 'true');
            trigger.parentElement.classList.add('is-open');
        }
    }

    triggers.forEach((t) => {
        t.addEventListener('click', (e) => {
            e.stopPropagation();
            setMenu(openTrigger === t ? null : t);
        });
        t.addEventListener('mouseenter', () => {
            if (openTrigger && openTrigger !== t) setMenu(t);
        });
    });

    document.addEventListener('click', (e) => {
        if (openTrigger && (!e.target.closest('.menu-pop') || e.target.closest('.menu-pop a'))) setMenu(null);
    });

    /* ---------------- Studio window ---------------- */
    const studioTrigger = document.getElementById('link-invercaro');
    const studioOverlay = document.getElementById('studio-overlay');
    const studioWindow = document.getElementById('studio-window');
    const studioClose = document.getElementById('studio-close');

    function setStudio(open) {
        if (!studioOverlay) return;
        studioOverlay.classList.toggle('is-open', open);
        studioTrigger.setAttribute('aria-expanded', String(open));
        if (open) studioWindow.focus();
        else studioTrigger.focus();
    }

    if (studioTrigger && studioOverlay) {
        studioTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            setMenu(null);
            setStudio(!studioOverlay.classList.contains('is-open'));
        });
        studioOverlay.addEventListener('click', (e) => {
            if (e.target === studioOverlay) setStudio(false);
        });
        studioClose.addEventListener('click', () => setStudio(false));
    }

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (studioOverlay && studioOverlay.classList.contains('is-open')) {
            setStudio(false);
        } else if (openTrigger) {
            const t = openTrigger;
            setMenu(null);
            t.focus();
        }
    });

    /* ---------------- Splash + entrance ---------------- */
    function reveal() {
        root.classList.remove('is-loading');
        root.classList.add('is-loaded');
    }

    const splash = document.getElementById('splash');
    if (!splash || !root.classList.contains('has-splash')) {
        reveal();
        return;
    }

    try { sessionStorage.setItem('invercaro-splash', '1'); } catch (e) {}

    const MIN_SHOW = 2300;
    const MAX_SHOW = 5000;
    const start = performance.now();
    let done = false;

    function finish() {
        if (done) return;
        done = true;
        splash.classList.add('is-leaving');
        setTimeout(reveal, 260);
        setTimeout(() => {
            splash.remove();
            root.classList.remove('has-splash');
        }, 1100);
    }

    function whenLoaded() {
        setTimeout(finish, Math.max(0, MIN_SHOW - (performance.now() - start)));
    }

    if (document.readyState === 'complete') whenLoaded();
    else window.addEventListener('load', whenLoaded, { once: true });
    setTimeout(finish, MAX_SHOW);
});
