/* Space page — Mono / Intent / Sileo window (hash routed), traffic-light controls (also when embedded in the home page), in-window overlay scrollbar, video heroes, blur-rise reveal, privacy links,
   and full-window stages (Mono: hero → page) that change with an animation instead of a scroll. */
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
    const tell = (msg) => window.parent.postMessage({ space: true, ...msg }, '*');

    /* ---- full-window stages ---- */
    const stages = (() => {
        const body = scroller.parentElement;
        const LOCK_MS = 1050;
        const nav = document.createElement('nav');
        nav.className = 'sp-stage-nav';
        nav.setAttribute('aria-label', 'Sections');
        body.appendChild(nav);
        let section = null;
        let list = [];
        let rest = null;
        let index = 0;
        let locked = false;
        let fresh = true;
        let settling = false; // momentum of the swipe that changed the stage is still arriving
        let lastWheel = 0;
        let acc = 0;
        let prevAbs = 0;
        let touchY = null;

        const staged = () => !!section && !narrowView.matches;


        function apply() {
            if (!section) return;
            const on = staged();
            section.classList.toggle('ap-staged', on);
            body.classList.toggle('has-stages', on);
            body.classList.toggle('is-stage-locked', on && index < list.length);
            list.forEach((stage, i) => {
                stage.dataset.state = !on || i === index ? 'current' : i < index ? 'past' : 'future';
            });
            rest.dataset.state = !on || index === list.length ? 'current' : 'future';
            nav.dataset.tone = index < list.length && list[index].classList.contains('ap-hero--video') ? 'light' : 'auto';
            nav.querySelectorAll('.sp-stage-dot').forEach((dot, i) => {
                dot.classList.toggle('is-current', i === index);
                dot.setAttribute('aria-current', i === index ? 'true' : 'false');
            });
            if (typeof syncVideos === 'function') syncVideos();
            announce();
        }

        /* Tells the 3D pages (js/story3d.js: Mono's story, Sileo's design frame) whether their page is on screen. */
        function announce() {
            const on = staged();
            document.dispatchEvent(new CustomEvent('stagechange', {
                detail: { staged: on, page: on && index === list.length, visible, section: section ? section.id : null },
            }));
        }

        function go(next) {
            if (!staged()) return;
            next = Math.max(0, Math.min(list.length, next));
            if (next === index || locked) return;
            if (index === list.length) scroller.scrollTop = 0;
            index = next;
            locked = true;
            settling = true;
            acc = 0;
            apply();
            setTimeout(() => { locked = false; fresh = false; }, reduceMotion ? 0 : LOCK_MS);
        }

        function reset(target) {
            section = target && target.querySelector('[data-stages]') ? target : null;
            index = 0;
            locked = false;
            body.classList.remove('has-stages', 'is-stage-locked');
            nav.innerHTML = '';
            if (!section) { announce(); return; }
            list = Array.from(section.querySelectorAll('.ap-stage'));
            rest = section.querySelector('.ap-rest');
            const names = list.map((stage) => stage.getAttribute('aria-label') || 'Section').concat(rest.getAttribute('aria-label') || 'Details');
            names.forEach((name, i) => {
                const dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'sp-stage-dot';
                dot.setAttribute('aria-label', name);
                dot.addEventListener('click', () => go(i));
                nav.appendChild(dot);
            });
            apply();
        }

        /* Straight to a stage without the animation (e.g. a privacy link). */
        function jump(i) {
            if (!section) return;
            index = Math.max(0, Math.min(list.length, i));
            section.classList.add('ap-stage-instant');
            apply();
            requestAnimationFrame(() => section && section.classList.remove('ap-stage-instant'));
        }

        function sync() {
            if (section) apply();
        }

        const atTop = () => scroller.scrollTop <= 1;

        /* Wheel / trackpad: one gesture moves one stage; momentum after a move is ignored until the gesture ends. */
        body.addEventListener('wheel', (e) => {
            if (!staged() || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
            const now = performance.now();
            const gap = now - lastWheel;
            const abs = Math.abs(e.deltaY);
            lastWheel = now;
            if (gap > 180 || (abs > prevAbs * 1.5 && abs > 10)) { fresh = true; acc = 0; }
            prevAbs = abs;
            const onPage = index === list.length;
            // Scrolling the page: reaching the top mid-flick must not jump back; that takes a new gesture.
            if (onPage && !(atTop() && e.deltaY < 0)) {
                // The rest of the swipe that brought the page in must not scroll it: wait for a new gesture.
                if (locked || (settling && !fresh)) { e.preventDefault(); return; }
                settling = false;
                fresh = false;
                return;
            }
            e.preventDefault();
            if (locked || !fresh) return;
            acc += e.deltaY;
            if (acc > 40) go(index + 1);
            else if (acc < -40) go(index - 1);
        }, { passive: false });

        document.addEventListener('keydown', (e) => {
            if (!staged() || e.target.closest('input, textarea, video, [contenteditable]')) return;
            const down = ['ArrowDown', 'PageDown', ' '].includes(e.key);
            const up = ['ArrowUp', 'PageUp'].includes(e.key);
            if (!down && !up) return;
            if (index === list.length && !(up && atTop())) return;
            e.preventDefault();
            go(index + (down ? 1 : -1));
        });

        body.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
        body.addEventListener('touchend', (e) => {
            if (!staged() || touchY === null) return;
            const dy = touchY - e.changedTouches[0].clientY;
            touchY = null;
            if (Math.abs(dy) < 50) return;
            if (index === list.length && !(dy < 0 && atTop())) return;
            go(index + (dy > 0 ? 1 : -1));
        }, { passive: true });

        narrowView.addEventListener('change', sync);
        return { reset, jump, sync, go, announce };
    })();

    /* ---- sections ---- */
    function activate(id) {
        const target = document.getElementById(id);
        if (!target) return;
        sections.forEach((section) => section.classList.toggle('sp-active-section', section === target));
        if (embedded) tell({ type: 'app', app: id.replace('sp-', '') });
        stages.reset(target);
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
        stages.jump(Infinity);
        const target = document.getElementById(hash.slice(1));
        target.scrollIntoView({ behavior: smooth && !reduceMotion ? 'smooth' : 'auto', block: 'start' });
        /* Content above the policy (videos, reveals) can still change height while the page settles, which leaves the
           scroll short of the policy; snap to it once the scroll and the layout have settled. */
        const settle = () => {
            if (window.location.hash !== hash) return;
            const off = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
            if (Math.abs(off) > 4) target.scrollIntoView({ behavior: 'auto', block: 'start' });
        };
        setTimeout(settle, smooth ? 1100 : 400);
        setTimeout(settle, 2200);
    }

    function route(smooth) {
        const hash = window.location.hash;
        if (policies[hash]) goToPrivacy(hash, smooth);
        else activate(sectionForHash(hash));
    }

    /* ---- overlay scrollbar ---- */
    function layout() {
        stages.sync();
        if (!narrowView.matches) scroller.style.setProperty('--sp-view-h', `${scroller.clientHeight}px`);
        else scroller.style.removeProperty('--sp-view-h');
        updateBar();
        updateHeroes();
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
            const stage = hero.closest('.ap-staged .ap-stage');
            const on = visible && hero.closest('.sp-content-section').classList.contains('sp-active-section')
                && (!stage || stage.dataset.state === 'current');
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
        const groups = [...document.querySelectorAll('.ap-block')];
        groups.forEach((group) => {
            group.querySelectorAll('.rv').forEach((el, i) => {
                if (el.style.getPropertyValue('--i')) return;
                el.style.setProperty('--i', Math.min(i, 6));
                observer.observe(el);
            });
        });
    }

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

    /* ---- widget size picker: Small / Medium / Large; the chosen widget animates in ---- */
    document.querySelectorAll('[data-widget-picker]').forEach((picker) => {
        const seg = picker.querySelector('.ap-seg');
        const tabs = Array.from(picker.querySelectorAll('.ap-seg-btn'));
        const items = Array.from(picker.querySelectorAll('.ap-wpick-item'));
        const panel = picker.querySelector('[role="tabpanel"]');
        function pick(size, focus) {
            tabs.forEach((tab, i) => {
                const on = tab.dataset.size === size;
                tab.setAttribute('aria-selected', on ? 'true' : 'false');
                tab.tabIndex = on ? 0 : -1;
                if (!on) return;
                seg.style.setProperty('--seg-i', i);
                panel.setAttribute('aria-labelledby', tab.id);
                if (focus) tab.focus();
            });
            items.forEach((item) => item.classList.toggle('is-shown', item.dataset.size === size));
        }
        tabs.forEach((tab) => tab.addEventListener('click', () => pick(tab.dataset.size)));
        seg.addEventListener('keydown', (e) => {
            const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
            if (!step) return;
            e.preventDefault();
            e.stopPropagation();
            const i = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
            pick(tabs[(i + step + tabs.length) % tabs.length].dataset.size, true);
        });
        pick('medium');
    });

    /* ---- window controls ---- */

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
            stages.announce();
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
