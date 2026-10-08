/* Space page — Mono / Sileo tab switcher, Mono stacked panels, progress scrollbar and privacy link. */
document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.sp-tab');
    const tabIndicator = document.getElementById('sp-tab-indicator');
    const sections = document.querySelectorAll('.sp-content-section');
    const monoTab = document.querySelector('.sp-tab[data-target="sp-mono"]');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mobile = window.matchMedia('(max-width: 900px)');

    const stack = document.querySelector('.mn-stack');
    const panels = stack ? Array.from(stack.querySelectorAll('.mn-panel')) : [];
    const privacy = document.getElementById('privacy');
    const localNav = document.querySelector('.sp-tabs-wrapper');
    const bar = document.getElementById('mn-scrollbar');
    const barFill = document.getElementById('mn-scrollbar-fill');
    const barTicks = document.getElementById('mn-scrollbar-ticks');
    const STACK_GAP = 24;
    const BOTTOM_GAP = 20;
    let targets = [];
    let ticks = [];
    let ticking = false;

    /* ---- tabs ---- */
    function updateTabIndicator(activeTab) {
        tabIndicator.style.transform = `translateX(${activeTab.offsetLeft - 4}px)`;
        tabIndicator.style.width = `${activeTab.offsetWidth}px`;
    }

    function activate(tab) {
        tabs.forEach((t) => t.classList.remove('sp-active'));
        tab.classList.add('sp-active');
        updateTabIndicator(tab);

        const targetId = tab.getAttribute('data-target');
        sections.forEach((section) => {
            section.classList.toggle('sp-active-section', section.id === targetId);
        });

        const isMono = targetId === 'sp-mono';
        window.scrollTo(0, 0);
        document.body.classList.toggle('sp-scroll', isMono);
        layout();
    }

    /* ---- layout ---- */
    function docTop(el) {
        let top = 0;
        for (let node = el; node; node = node.offsetParent) top += node.offsetTop;
        return top;
    }

    function stickTopOf(i) {
        if (mobile.matches) return 16;
        const css = getComputedStyle(stack);
        return parseFloat(css.getPropertyValue('--mn-stack-top')) + i * parseFloat(css.getPropertyValue('--mn-step'));
    }

    function layout() {
        if (!stack || !document.body.classList.contains('sp-scroll')) return;
        const stackTop = docTop(stack);

        panels.forEach((panel, i) => {
            if (mobile.matches) panel.style.removeProperty('--mn-panel-h');
            else panel.style.setProperty('--mn-panel-h', `${Math.round(window.innerHeight - stickTopOf(i) - BOTTOM_GAP)}px`);
        });

        let staticTop = stackTop;
        targets = panels.map((panel, i) => {
            const target = Math.max(0, staticTop - stickTopOf(i));
            staticTop += panel.offsetHeight + STACK_GAP;
            return target;
        });

        buildTicks();
        update();
    }

    /* ---- progress scrollbar ---- */
    function buildTicks() {
        if (!barTicks) return;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (!ticks.length) {
            ticks = panels.map((panel, i) => {
                const tick = document.createElement('button');
                tick.type = 'button';
                tick.className = 'mn-tick';
                tick.dataset.label = panel.querySelector('.mn-title').textContent;
                tick.setAttribute('aria-label', tick.dataset.label);
                tick.addEventListener('click', () => {
                    window.scrollTo({ top: targets[i], behavior: reduceMotion ? 'auto' : 'smooth' });
                });
                barTicks.appendChild(tick);
                return tick;
            });
        }
        ticks.forEach((tick, i) => {
            tick.style.top = `${max > 0 ? Math.min(1, targets[i] / max) * 100 : 0}%`;
        });
        bar.classList.toggle('is-ready', max > 0);
    }

    function update() {
        ticking = false;
        const y = window.scrollY;
        localNav.classList.toggle('is-stuck', y > 0 && localNav.getBoundingClientRect().top <= parseFloat(getComputedStyle(localNav).top) + 0.5);
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (barFill) barFill.style.setProperty('--progress', max > 0 ? Math.min(1, y / max).toFixed(4) : 0);
        if (privacy) privacy.classList.toggle('is-docked', !mobile.matches && y >= max - 2);

        let current = -1;
        targets.forEach((target, i) => { if (y >= target - 4) current = i; });
        ticks.forEach((tick, i) => {
            tick.classList.toggle('is-passed', i <= current);
            tick.classList.toggle('is-current', i === current);
        });

        if (reduceMotion || mobile.matches) {
            panels.forEach((panel) => panel.style.setProperty('--p', 0));
            return;
        }
        for (let i = 0; i < panels.length - 1; i++) {
            const panel = panels[i];
            const stickTop = stickTopOf(i);
            const nextTop = panels[i + 1].getBoundingClientRect().top;
            const progress = 1 - (nextTop - stickTop) / panel.offsetHeight;
            panel.style.setProperty('--p', Math.min(1, Math.max(0, progress)).toFixed(3));
        }
    }

    function requestUpdate() {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(update);
        }
    }

    if (stack) {
        window.addEventListener('scroll', requestUpdate, { passive: true });
        window.addEventListener('resize', layout);
        window.addEventListener('load', layout);

        if (!reduceMotion && 'IntersectionObserver' in window) {
            stack.classList.add('mn-reveal');
            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-in');
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.2 });
            panels.forEach((panel) => observer.observe(panel));
        }
    }

    /* ---- privacy link ---- */
    function goToPrivacy(smooth) {
        if (!monoTab.classList.contains('sp-active')) activate(monoTab);
        privacy.scrollIntoView({ behavior: smooth && !reduceMotion ? 'smooth' : 'auto' });
        history.replaceState(null, '', '#privacy');
    }

    const privacyLink = document.getElementById('sp-privacy-link');
    if (privacyLink) privacyLink.addEventListener('click', (e) => {
        e.preventDefault();
        goToPrivacy(true);
    });

    const copyBtn = document.getElementById('mn-copy-link');
    if (copyBtn) copyBtn.addEventListener('click', () => {
        const url = `${location.origin}${location.pathname}#privacy`;
        const done = () => {
            copyBtn.textContent = 'Link copied';
            setTimeout(() => { copyBtn.textContent = 'Copy link to this policy'; }, 2000);
        };
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => window.prompt('Copy this link:', url));
        else window.prompt('Copy this link:', url);
    });

    /* ---- init ---- */
    function tabForHash(hash) {
        if (hash === '#sileo') return document.querySelector('.sp-tab[data-target="sp-sileo"]');
        if (hash === '#mono' || hash === '#privacy') return monoTab;
        return null;
    }

    tabs.forEach((tab) => tab.addEventListener('click', () => {
        if (tab.classList.contains('sp-active')) {
            window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
            return;
        }
        activate(tab);
        history.replaceState(null, '', tab === monoTab ? '#mono' : '#sileo');
    }));

    window.addEventListener('hashchange', () => {
        const tab = tabForHash(window.location.hash);
        if (!tab) return;
        if (window.location.hash === '#privacy') goToPrivacy(true);
        else if (!tab.classList.contains('sp-active')) activate(tab);
    });

    const hash = window.location.hash;
    const initial = tabForHash(hash) || monoTab;
    layout();
    if (initial) setTimeout(() => {
        activate(initial);
        if (hash === '#privacy') goToPrivacy(false);
    }, 50);

    window.addEventListener('resize', () => {
        const activeTab = document.querySelector('.sp-tab.sp-active');
        if (activeTab) updateTabIndicator(activeTab);
    });
});
