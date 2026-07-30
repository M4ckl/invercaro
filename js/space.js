/* Space page — Mono / Sileo tab switcher. */
document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.sp-tab');
    const tabIndicator = document.getElementById('sp-tab-indicator');
    const sections = document.querySelectorAll('.sp-content-section');

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
    }

    tabs.forEach((tab) => tab.addEventListener('click', () => activate(tab)));

    const hash = window.location.hash;
    let initial = document.querySelector('.sp-tab.sp-active');
    if (hash === '#sileo') initial = document.querySelector('.sp-tab[data-target="sp-sileo"]');
    else if (hash === '#mono') initial = document.querySelector('.sp-tab[data-target="sp-mono"]');
    if (initial) setTimeout(() => activate(initial), 50);

    window.addEventListener('resize', () => {
        const activeTab = document.querySelector('.sp-tab.sp-active');
        if (activeTab) updateTabIndicator(activeTab);
    });
});
