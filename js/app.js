document.addEventListener('DOMContentLoaded', () => {
    const indicator = document.getElementById('nav-indicator');
    const track = document.querySelector('.track-gray');

    const invercaroLink = document.getElementById('link-invercaro');
    const spaceLink = document.getElementById('link-space');

    const isSpacePage = window.location.pathname.includes('space.html');

    function updateIndicatorPosition() {
        const trackRect = track.getBoundingClientRect();

        const extraWidth = 18;

        if (!isSpacePage) {
            const invRect = invercaroLink.getBoundingClientRect();
            const width = (invRect.right - trackRect.left) + extraWidth;

            indicator.style.left = '0px';
            indicator.style.width = `${width}px`;

            document.querySelector('.logo-text').style.color = '#000000';
            spaceLink.style.color = '#8E8E93';

        } else {
            const spaceRect = spaceLink.getBoundingClientRect();

            const leftOffset = (spaceRect.left - trackRect.left) - extraWidth;

            const width = spaceRect.width + (extraWidth * 2);

            indicator.style.left = `${leftOffset}px`;
            indicator.style.width = `${width}px`;

            document.querySelector('.logo-text').style.color = '#8E8E93';
            spaceLink.style.color = '#000000';
        }
    }

    updateIndicatorPosition();
    window.addEventListener('resize', updateIndicatorPosition);
});