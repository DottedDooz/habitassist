import { trackerTab } from './tracker.js';
import { insightsTab } from './insights.js';
import { narratorPage } from './narrator.js';
import { toggleDarkMode, uiUtils } from './utils.js';

const initTabs = () => {
    document.getElementById('planner-button').addEventListener('click', () => {
        window.location.href = '/';
    });
    document.getElementById('tracker-button').addEventListener('click', () => {
        loadPage('/tracker', true);
    });
    document.getElementById('insights-button').addEventListener('click', () => {
        loadPage('/insights', true);
    });
    const narratorButton = document.getElementById('narrator-button');
    if (narratorButton) {
        narratorButton.addEventListener('click', () => {
            loadPage('/narrator', true);
        });
    }
};

if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
}

const updateNavActiveState = (page) => {
    const buttons = document.querySelectorAll('.nav-button');
    buttons.forEach((button) => {
        const buttonPage = button.dataset.page;
        button.classList.toggle('is-active', buttonPage === page);
    });
};

const setPageContext = (page) => {
    document.body.classList.remove('page--planner', 'page--tracker', 'page--insights', 'page--narrator');
    if (page) {
        document.body.classList.add(`page--${page}`);
    }
    updateNavActiveState(page);
};

const detectInitialPage = () => {
    if (document.querySelector('#insights')) return 'insights';
    if (document.querySelector('#tracker')) return 'tracker';
    if (document.querySelector('#narrator')) return 'narrator';
    return 'planner';
};

const init = () => {
    initTabs();
    uiUtils.scheduleDailyAnalysis();
    const initialPage = detectInitialPage();
    setPageContext(initialPage);
    uiUtils.startHabitWatcher();
    if (initialPage === 'tracker') {
        trackerTab.init();
    } else if (initialPage === 'insights') {
        insightsTab.init();
    } else if (initialPage === 'narrator') {
        narratorPage.init();
    }
    // trackerTab.init(); // Start with tracker tab
};

async function loadPage(path, push = true) {
    const contentDiv = document.getElementById('content');
    if (!contentDiv) {
        console.error("Missing #content container in your HTML");
        return;
    }

    let pageUrl = '';
    let targetPage = 'planner';
    if (path === '/' || path === '/planner' || path === '/planner.html') {
        pageUrl = '/planner';
        targetPage = 'planner';
    } else if (path === '/tracker' || path === '/home') {
        pageUrl = '/tracker';
        targetPage = 'tracker';
    } else if (path === '/insights' || path === '/completions') {
        pageUrl = '/insights';
        targetPage = 'insights';
    } else if (path === '/narrator') {
        pageUrl = '/narrator';
        targetPage = 'narrator';
    } else {
        console.warn('Unknown path, loading planner');
        pageUrl = '/planner';
        targetPage = 'planner';
    }

    try {
        const response = await fetch(pageUrl);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const newContent = doc.querySelector('#content');

        if (newContent) {
            contentDiv.innerHTML = newContent.innerHTML;
            setPageContext(targetPage);
            if (targetPage === 'tracker') {
                trackerTab.init();
            } else if (targetPage === 'insights') {
                insightsTab.init();
            } else if (targetPage === 'narrator') {
                narratorPage.init();
            }
            // if (push) history.pushState({}, '', path);
        } else {
            console.error('No #content found in', pageUrl);
        }
    } catch (error) {
        console.error('Error loading page:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const darkModeButton = document.getElementById('dark-mode-toggle');
    if (darkModeButton) {
        darkModeButton.addEventListener('click', toggleDarkMode);
    }
    init();
});
