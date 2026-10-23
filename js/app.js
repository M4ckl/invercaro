/* Shared page behaviour: menu bar (current page, clock, menus), splash, entrance. */
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
        const prev = openTrigger;
        const dir = prev && trigger ? Math.sign(triggers.indexOf(trigger) - triggers.indexOf(prev)) : 0;
        if (prev) {
            prev.setAttribute('aria-expanded', 'false');
            prev.parentElement.style.setProperty('--slide', `${-dir * 18}px`);
            prev.parentElement.classList.remove('is-open');
        }
        openTrigger = trigger;
        if (trigger) {
            const menu = trigger.parentElement;
            menu.classList.add('no-anim');
            menu.style.setProperty('--slide', `${dir * 18}px`);
            void menu.offsetWidth;
            menu.classList.remove('no-anim');
            trigger.setAttribute('aria-expanded', 'true');
            menu.classList.add('is-open');
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

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || !openTrigger) return;
        const t = openTrigger;
        setMenu(null);
        t.focus();
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
