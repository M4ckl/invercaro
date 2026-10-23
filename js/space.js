/* Space page — Mono / Intent / Sileo window (hash routed), traffic-light controls (also when embedded in the home page), in-window overlay scrollbar, video heroes, blur-rise reveal, screen rails and privacy links. */
document.addEventListener('DOMContentLoaded', () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sections = Array.from(document.querySelectorAll('.sp-content-section'));
    const root = document.documentElement;
    const embedded = root.classList.contains('is-embed');
    const scroller = document.getElementById('sp-window-scroll');
    const bar = document.getElementById('sp-scrollbar');
    const thumb = document.getElementById('sp-scrollbar-thumb');
    /* Each app's privacy policy: its anchor, and the section it lives in. */
    const policies = { '#privacy': 'sp-mono', '#intent-privacy': 'sp-intent' };
    const narrowView = window.matchMedia('(max-width: 900px)');
    const heroes = Array.from(document.querySelectorAll('.ap-hero--video'));
    let hideTimer = 0;
    let visible = !embedded;

    /* ---- sections ---- */
    function activate(id) {
        const target = document.getElementById(id);
        if (!target) return;
        sections.forEach((section) => section.classList.toggle('sp-active-section', section === target));
        scroller.scrollTop = 0;
        window.scrollTo(0, 0);
        layout();
        syncVideos();
    }

    function sectionForHash(hash) {
        if (hash === '#sileo') return 'sp-sileo';
        if (hash === '#intent') return 'sp-intent';
        return 'sp-mono';
    }

    function goToPrivacy(hash, smooth) {
        activate(policies[hash]);
        document.getElementById(hash.slice(1))
            .scrollIntoView({ behavior: smooth && !reduceMotion ? 'smooth' : 'auto', block: 'start' });
    }

    function route(smooth) {
        const hash = window.location.hash;
        if (policies[hash]) goToPrivacy(hash, smooth);
        else activate(sectionForHash(hash));
    }

    /* ---- overlay scrollbar ---- */
    function layout() {
        if (!narrowView.matches) scroller.style.setProperty('--sp-view-h', `${scroller.clientHeight}px`);
        else scroller.style.removeProperty('--sp-view-h');
        updateBar();
        updateHeroes();
        rails.forEach((rail) => rail.sync());
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
        updateHeroes();
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
    if ('ResizeObserver' in window) {
        const resize = new ResizeObserver(updateBar);
        sections.forEach((section) => resize.observe(section));
    }

    /* ---- video heroes ---- */
    function updateHeroes() {
        heroes.forEach((hero) => {
            const rect = hero.getBoundingClientRect();
            const top = narrowView.matches ? 0 : scroller.getBoundingClientRect().top;
            const p = Math.min(1, Math.max(0, (top - rect.top) / rect.height));
            hero.style.setProperty('--hp', p.toFixed(3));
        });
    }

    function syncVideos() {
        heroes.forEach((hero) => {
            const video = hero.querySelector('video');
            if (!video) return;
            const on = visible && hero.closest('.sp-content-section').classList.contains('sp-active-section');
            if (!on) { video.pause(); return; }
            if (!video.getAttribute('src')) video.src = video.dataset.src;
            if (!reduceMotion) video.play().catch(() => {});
        });
    }

    heroes.forEach((hero) => {
        hero.querySelector('video').addEventListener('error', () => hero.classList.remove('ap-hero--video'));
    });
    window.addEventListener('scroll', updateHeroes, { passive: true });

    /* ---- scroll reveal ---- */
    if (!reduceMotion && 'IntersectionObserver' in window) {
        const narrow = window.matchMedia('(max-width: 900px)').matches;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-in');
                observer.unobserve(entry.target);
            });
        }, { root: narrow ? null : scroller, threshold: 0.15 });
        document.querySelectorAll('.ap').forEach((page) => page.classList.add('ap-reveal'));
        const groups = [...document.querySelectorAll('.ap-slide'), ...document.querySelectorAll('.ap-block')];
        groups.forEach((group) => {
            group.querySelectorAll('.rv').forEach((el, i) => {
                if (el.style.getPropertyValue('--i')) return;
                el.style.setProperty('--i', Math.min(i, 6));
                observer.observe(el);
            });
        });
    }

    /* ---- screen rails ---- */
    const rails = Array.from(document.querySelectorAll('[data-rail]')).map((rail) => {
        const block = rail.closest('.ap-rail-block');
        const slides = Array.from(rail.querySelectorAll('.ap-slide'));
        const dotsBox = block.querySelector('.ap-rail-dots');
        const [prev, next] = block.querySelectorAll('.ap-rail-btn');
        let current = 0;

        const goTo = (i) => {
            const target = slides[Math.max(0, Math.min(slides.length - 1, i))];
            rail.scrollTo({
                left: target.offsetLeft - slides[0].offsetLeft,
                behavior: reduceMotion ? 'auto' : 'smooth',
            });
        };

        const dots = slides.map((slide, i) => {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'ap-rail-dot';
            dot.setAttribute('aria-label', `Slide ${i + 1}`);
            dot.addEventListener('click', () => goTo(i));
            dotsBox.appendChild(dot);
            return dot;
        });

        const sync = () => {
            const max = rail.scrollWidth - rail.clientWidth;
            current = rail.scrollLeft >= max - 2
                ? slides.length - 1
                : slides.reduce((best, slide, i) => (
                    Math.abs(slide.offsetLeft - slides[0].offsetLeft - rail.scrollLeft)
                        < Math.abs(slides[best].offsetLeft - slides[0].offsetLeft - rail.scrollLeft) ? i : best
                ), 0);
            dots.forEach((dot, i) => dot.classList.toggle('is-active', i === current));
            prev.disabled = current === 0;
            next.disabled = current === slides.length - 1;
        };

        prev.addEventListener('click', () => goTo(current - 1));
        next.addEventListener('click', () => goTo(current + 1));
        rail.addEventListener('scroll', sync, { passive: true });
        rail.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') { e.preventDefault(); goTo(current + 1); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(current - 1); }
        });
        sync();
        return { sync };
    });

    /* ---- privacy links ---- */
    document.querySelectorAll('.mn-copy-link').forEach((copyBtn) => copyBtn.addEventListener('click', () => {
        const url = `${location.origin}${location.pathname}#${copyBtn.dataset.hash}`;
        const done = () => {
            copyBtn.textContent = 'Link copied';
            setTimeout(() => { copyBtn.textContent = 'Copy link to this policy'; }, 2000);
        };
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => window.prompt('Copy this link:', url));
        else window.prompt('Copy this link:', url);
    }));

    /* ---- window controls ---- */
    const tell = (msg) => window.parent.postMessage({ space: true, ...msg }, '*');

    function setMax(on) {
        root.classList.toggle('sp-max', on);
        const zoom = document.querySelector('[data-win="zoom"]');
        if (zoom) zoom.setAttribute('aria-label', on ? 'Exit full screen' : 'Enter full screen');
        if (embedded) tell({ type: 'zoom', on });
        requestAnimationFrame(layout);
    }

    document.querySelectorAll('[data-win]').forEach((btn) => btn.addEventListener('click', () => {
        const action = btn.dataset.win;
        if (action === 'zoom') { setMax(!root.classList.contains('sp-max')); return; }
        if (embedded) tell({ type: action });
        else window.location.href = 'index.html';
    }));

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (root.classList.contains('sp-max')) setMax(false);
        else if (embedded) tell({ type: 'close' });
    });

    /* ---- embedded in the home page ---- */
    window.addEventListener('message', (e) => {
        const msg = e.data;
        if (!msg || !msg.space || e.source !== window.parent) return;
        if (msg.type === 'route') {
            if (window.location.hash === msg.hash) route(false);
            else window.location.hash = msg.hash;
        }
        if (msg.type === 'visible') {
            visible = msg.on;
            if (!msg.on && root.classList.contains('sp-max')) setMax(false);
            syncVideos();
            if (msg.on) requestAnimationFrame(layout);
        }
        if (msg.type === 'theme' && msg.theme !== root.getAttribute('data-theme')) {
            root.setAttribute('data-theme', msg.theme);
            document.dispatchEvent(new CustomEvent('themechange', { detail: msg.theme }));
        }
    });

    /* ---- init ---- */
    window.addEventListener('hashchange', () => route(true));
    route(false);
    if (embedded) tell({ type: 'ready' });
});
