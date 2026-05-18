document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.sp-tab');
    const tabIndicator = document.getElementById('sp-tab-indicator');
    const sections = document.querySelectorAll('.sp-content-section');

    function updateTabIndicator(activeTab) {
        const tabWidth = activeTab.offsetWidth;
        const tabLeft = activeTab.offsetLeft;

        tabIndicator.style.transform = `translateX(${tabLeft - 4}px)`;
        tabIndicator.style.width = `${tabWidth}px`;
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('sp-active'));

            tab.classList.add('sp-active');

            updateTabIndicator(tab);

            const targetId = tab.getAttribute('data-target');

            sections.forEach(section => {
                if (section.id === targetId) {
                    section.classList.add('sp-active-section');
                } else {
                    section.classList.remove('sp-active-section');
                }
            });
        });


    });

    const appStoreLink = document.getElementById('sp-app-store-link');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('sp-active'));
            tab.classList.add('sp-active');
            updateTabIndicator(tab);

            const targetId = tab.getAttribute('data-target');

            if (targetId === 'sp-mono') {
                appStoreLink.href = "#";
            } else if (targetId === 'sp-sileo') {
                appStoreLink.href = "#";
            }

            sections.forEach(section => {
                if (section.id === targetId) {
                    section.classList.add('sp-active-section');
                } else {
                    section.classList.remove('sp-active-section');
                }
            });
        });
    });

    const hash = window.location.hash;

    let tabToActivate = document.querySelector('.sp-tab.sp-active');

    if (hash === '#sileo') {
        tabToActivate = document.querySelector('.sp-tab[data-target="sp-sileo"]');
    } else if (hash === '#mono') {
        tabToActivate = document.querySelector('.sp-tab[data-target="sp-mono"]');
    }
    if (tabToActivate) {
        setTimeout(() => {
            tabToActivate.click();
        }, 50);
    }

    window.addEventListener('resize', () => {
        const activeTab = document.querySelector('.sp-tab.sp-active');
        if (activeTab) updateTabIndicator(activeTab);
    });
});