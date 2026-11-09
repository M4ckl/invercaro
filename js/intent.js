/* Intent page — each frame's parts sit side by side in a horizontal rail (scroll-snap); a part with a recording (data-video)
   stays up as long as its clip (data-ms). Pills (with an autoplay progress bar),
   arrows, trackpad swipes and the arrow keys move it. The current part drives the 3D phone (js/intent3d.js listens for
   `intentpart`) or, without 3D, the flat screenshot. Autoplay runs only while its frame is on screen and stops for a while
   after the reader takes over. */
document.addEventListener('DOMContentLoaded', () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const AUTOPLAY_MS = 6500;
    const HOLD_MS = 12000;
    const TICK_MS = 100;

    document.querySelectorAll('[data-ip]').forEach((frame) => {
        const rail = frame.querySelector('.ip-rail');
        const parts = Array.from(rail.querySelectorAll('.ip-part'));
        const pillsBox = frame.querySelector('.ip-pills');
        const [prev, next] = frame.querySelectorAll('.ip-arrow');
        const flat = frame.querySelector('.ip-flat');
        const section = frame.closest('.sp-content-section');
        let current = -1;
        let elapsed = 0;
        let heldUntil = 0;
        let scrollT = 0;

        const pills = parts.map((part, i) => {
            const pill = document.createElement('button');
            pill.type = 'button';
            pill.className = 'ip-pill';
            pill.setAttribute('role', 'tab');
            pill.innerHTML = `<span>${part.dataset.label}</span><i class="ip-pill-bar" aria-hidden="true"></i>`;
            pill.addEventListener('click', () => go(i, true));
            pillsBox.appendChild(pill);
            return pill;
        });

        function hold() {
            heldUntil = performance.now() + HOLD_MS;
            elapsed = 0;
            pills.forEach((p) => p.style.setProperty('--p', '0'));
        }

        function go(i, byUser) {
            const n = parts.length;
            const target = ((i % n) + n) % n;
            if (byUser) hold();
            rail.scrollTo({ left: target * rail.clientWidth, behavior: reduceMotion ? 'auto' : 'smooth' });
            set(target);
        }

        function set(i) {
            if (i === current) return;
            const dir = current < 0 ? 0 : Math.sign(i - current);
            current = i;
            elapsed = 0;
            parts.forEach((part, k) => part.classList.toggle('is-current', k === i));
            pills.forEach((pill, k) => {
                pill.classList.toggle('is-current', k === i);
                pill.setAttribute('aria-selected', k === i ? 'true' : 'false');
                pill.style.setProperty('--p', '0');
            });
            pills[i].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
            if (flat) {
                flat.src = parts[i].dataset.screen;
                flat.alt = `Intent: ${parts[i].dataset.label}`;
            }
            frame.dispatchEvent(new CustomEvent('intentpart', { detail: { index: i, dir, screen: parts[i].dataset.screen, video: parts[i].dataset.video || null } }));
        }

        rail.addEventListener('scroll', () => {
            clearTimeout(scrollT);
            scrollT = setTimeout(() => set(Math.round(rail.scrollLeft / Math.max(1, rail.clientWidth))), 60);
        }, { passive: true });

        // A real touch or trackpad swipe in the rail is the reader taking over.
        rail.addEventListener('pointerdown', hold);
        frame.addEventListener('wheel', (e) => {
            if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
            hold();
            if (!rail.contains(e.target)) {
                e.preventDefault();
                rail.scrollLeft += e.deltaX;
            }
        }, { passive: false });

        prev.addEventListener('click', () => go(current - 1, true));
        next.addEventListener('click', () => go(current + 1, true));
        frame.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') { e.preventDefault(); go(current + 1, true); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1, true); }
        });

        new ResizeObserver(() => { rail.scrollLeft = Math.max(0, current) * rail.clientWidth; }).observe(rail);

        /* ---- autoplay ---- */
        function onScreen() {
            if (document.hidden || !section || !section.classList.contains('sp-active-section')) return false;
            const holder = frame.closest('[data-state]');
            if (holder && holder.dataset.state !== 'current') return false;
            const r = frame.getBoundingClientRect();
            return r.bottom > window.innerHeight * 0.3 && r.top < window.innerHeight * 0.7 && r.width > 0;
        }

        setInterval(() => {
            if (reduceMotion || performance.now() < heldUntil || !onScreen()) return;
            const length = Number(parts[current].dataset.ms) || AUTOPLAY_MS;
            elapsed += TICK_MS;
            pills[current].style.setProperty('--p', String(Math.min(1, elapsed / length)));
            if (elapsed >= length) go(current + 1, false);
        }, TICK_MS);

        set(0);
    });
});
