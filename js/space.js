/* Space page — Mono / Sileo window (hash routed), in-window overlay scrollbar, scroll reveal and privacy link. */
document.addEventListener('DOMContentLoaded', () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sections = Array.from(document.querySelectorAll('.sp-content-section'));
    const title = document.getElementById('sp-window-title');
    const body = document.querySelector('.sp-window-body');
    const scroller = document.getElementById('sp-window-scroll');
    const bar = document.getElementById('sp-scrollbar');
    const thumb = document.getElementById('sp-scrollbar-thumb');
    const privacy = document.getElementById('privacy');
    const panels = Array.from(document.querySelectorAll('.mn-panel'));
    let hideTimer = 0;

    /* ---- sections ---- */
    function activate(id) {
        const target = document.getElementById(id);
        if (!target) return;
        sections.forEach((section) => section.classList.toggle('sp-active-section', section === target));
        title.textContent = target.dataset.title || '';
        scroller.scrollTop = 0;
        window.scrollTo(0, 0);
        layout();
    }

    function sectionForHash(hash) {
        return hash === '#sileo' ? 'sp-sileo' : 'sp-mono';
    }

    function goToPrivacy(smooth) {
        activate('sp-mono');
        privacy.scrollIntoView({ behavior: smooth && !reduceMotion ? 'smooth' : 'auto', block: 'start' });
    }

    function route(smooth) {
        const hash = window.location.hash;
        if (hash === '#privacy') goToPrivacy(smooth);
        else activate(sectionForHash(hash));
    }

    /* ---- overlay scrollbar ---- */
    function layout() {
        body.style.setProperty('--sp-view-h', `${scroller.clientHeight}px`);
        updateBar();
    }

    function metrics() {
        const view = scroller.clientHeight;
        const full = scroller.scrollHeight;
        const track = bar.clientHeight;
        const size = Math.max(32, Math.round(track * view / full));
        return { view, full, track, size, max: full - view };
    }

    function updateBar() {
        const m = metrics();
        const scrollable = m.max > 1;
        bar.classList.toggle('is-scrollable', scrollable);
        if (!scrollable) return;
        thumb.style.height = `${m.size}px`;
        thumb.style.transform = `translateY(${(m.track - m.size) * (scroller.scrollTop / m.max)}px)`;
    }

    function flashBar() {
        bar.classList.add('is-active');
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => bar.classList.remove('is-active'), 1000);
    }

    scroller.addEventListener('scroll', () => {
        updateBar();
        if (bar.classList.contains('is-scrollable')) flashBar();
    }, { passive: true });

    thumb.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const startY = e.clientY;
        const startTop = scroller.scrollTop;
        const m = metrics();
        const ratio = m.max / Math.max(1, m.track - m.size);
        bar.classList.add('is-dragging');
        thumb.setPointerCapture(e.pointerId);
        const move = (ev) => { scroller.scrollTop = startTop + (ev.clientY - startY) * ratio; };
        const up = () => {
            bar.classList.remove('is-dragging');
            thumb.removeEventListener('pointermove', move);
            flashBar();
        };
        thumb.addEventListener('pointermove', move);
        thumb.addEventListener('pointerup', up, { once: true });
        thumb.addEventListener('pointercancel', up, { once: true });
    });

    bar.addEventListener('pointerdown', (e) => {
        if (e.target !== bar) return;
        const m = metrics();
        const y = e.clientY - bar.getBoundingClientRect().top - m.size / 2;
        scroller.scrollTo({
            top: (y / Math.max(1, m.track - m.size)) * m.max,
            behavior: reduceMotion ? 'auto' : 'smooth',
        });
    });

    window.addEventListener('resize', layout);
    window.addEventListener('load', layout);
    if ('ResizeObserver' in window) new ResizeObserver(updateBar).observe(scroller.firstElementChild);

    /* ---- scroll reveal ---- */
    if (!reduceMotion && 'IntersectionObserver' in window && panels.length) {
        panels[0].parentElement.classList.add('mn-reveal');
        const narrow = window.matchMedia('(max-width: 900px)').matches;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-in');
                    observer.unobserve(entry.target);
                }
            });
        }, { root: narrow ? null : scroller, threshold: 0.2 });
        panels.forEach((panel) => observer.observe(panel));
    }

    /* ---- privacy link ---- */
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
    window.addEventListener('hashchange', () => route(true));
    route(false);
});
