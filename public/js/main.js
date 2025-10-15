import { homeTab } from './home.js';
import { completionsTab } from './completions.js';
import { toggleDarkMode, elements, uiUtils } from './utils.js';

// Initialize tab switching
const initTabs = () => {
document.getElementById('index-button').addEventListener('click', () => {
    window.location.href = '/';
});
document.getElementById('home-button').addEventListener('click', () => {
    loadPage('/home', true);
});
document.getElementById('completions-button').addEventListener('click', () => {
    loadPage('/completions', true);
});
};

// Load theme
if (localStorage.getItem('theme') === 'dark') {
document.body.classList.add('dark-mode');
}

const setPageContext = (page) => {
document.body.classList.remove('page--index', 'page--home', 'page--completions');
if (page) {
    document.body.classList.add(`page--${page}`);
}
};

const detectInitialPage = () => {
if (document.querySelector('#completions')) return 'completions';
if (document.querySelector('#home')) return 'home';
return 'index';
};

// Initialize application
const init = () => {
initTabs();
uiUtils.scheduleDailyAnalysis();
uiUtils.startHabitWatcher();
const initialPage = detectInitialPage();
setPageContext(initialPage);
if (initialPage === 'home') {
    homeTab.init();
} else if (initialPage === 'completions') {
    completionsTab.init();
}
//homeTab.init(); // Start with home tab
};

async function loadPage(path, push = true) {
const contentDiv = document.getElementById('content');
if (!contentDiv) {
    console.error("Missing #content container in your HTML");
    return;
}

let pageUrl = '';
if (path === '/' || path === '/index' || path === '/index.html') {
    pageUrl = '/index';
} else if (path === '/home') {
    pageUrl = '/home';
} else if (path === '/completions') {
    pageUrl = '/completions';
} else {
    console.warn('Unknown path, loading index');
    pageUrl = '/index';
}

try {
    const response = await fetch(pageUrl);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const newContent = doc.querySelector('#content');

    if (newContent) {
        contentDiv.innerHTML = newContent.innerHTML;
        if(path === '/home'){
            setPageContext('home');
            homeTab.init(); // Re-initialize home tab
        } else if (path === '/completions') {
            setPageContext('completions');
            completionsTab.init(); // Re-initialize home tab
        } else {
            setPageContext('index');
        }
        //if (push) history.pushState({}, '', path);
    } else {
        console.error('No #content found in', pageUrl);
    }
} catch (error) {
    console.error('Error loading page:', error);
}
}

// Add dark mode toggle (example button, add to HTML if needed)
document.addEventListener('DOMContentLoaded', () => {
const darkModeButton = document.getElementById('dark-mode-toggle');
if (darkModeButton) {
    darkModeButton.addEventListener('click', toggleDarkMode);
}
init();
});
