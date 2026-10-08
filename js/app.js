/* Shared page behaviour: nav indicator, entrance, typewriter title. */
document.addEventListener('DOMContentLoaded', () => {
    const root = document.documentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------------- Nav indicator ---------------- */
    const indicator = document.getElementById('nav-indicator');
    const track = document.querySelector('.track-gray');
    const invercaroLink = document.getElementById('link-invercaro');
    const spaceLink = document.getElementById('link-space');
    const supportLink = document.getElementById('link-support');
    const isSpacePage = window.location.pathname.includes('space.html');
    const isSupportPage = window.location.pathname.includes('support.html');

    function updateIndicatorPosition() {
        if (!track || !indicator) return;
        const trackRect = track.getBoundingClientRect();
        const extraWidth = 18;

        if (isSupportPage) {
            const supportRect = supportLink.getBoundingClientRect();
            indicator.style.left = `${(supportRect.left - trackRect.left) - extraWidth}px`;
            indicator.style.width = `${supportRect.width + (extraWidth * 2)}px`;
            supportLink.classList.add('nav-current');
        } else if (!isSpacePage) {
            const invRect = invercaroLink.getBoundingClientRect();
            indicator.style.left = '0px';
            indicator.style.width = `${(invRect.right - trackRect.left) + extraWidth}px`;
            invercaroLink.classList.add('nav-current');
            spaceLink.classList.remove('nav-current');
        } else {
            const spaceRect = spaceLink.getBoundingClientRect();
            indicator.style.left = `${(spaceRect.left - trackRect.left) - extraWidth}px`;
            indicator.style.width = `${spaceRect.width + (extraWidth * 2)}px`;
            spaceLink.classList.add('nav-current');
            invercaroLink.classList.remove('nav-current');
        }
    }

    updateIndicatorPosition();
    window.addEventListener('resize', updateIndicatorPosition);

    /* ---------------- Entrance ---------------- */
    root.classList.remove('is-loading');
    root.classList.add('is-loaded');

    /* ---------------- Typewriter title ---------------- */
    const title = document.querySelector('[data-typewriter]');
    if (title) {
        const full = title.textContent.trim();
        if (reduceMotion) {
            title.classList.add('type-done');
        } else {
            title.textContent = '';
            title.classList.add('typing');
            let i = 0;
            const type = () => {
                if (i <= full.length) {
                    title.textContent = full.slice(0, i);
                    i++;
                    setTimeout(type, 55);
                } else {
                    title.classList.remove('typing');
                    title.classList.add('type-done');
                }
            };
            setTimeout(type, 850);
        }
    }
});
