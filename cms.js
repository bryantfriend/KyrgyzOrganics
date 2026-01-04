import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { $, setupLanguage, currentLang, initMobileMenu } from './common.js';

async function init() {
    setupLanguage();
    initMobileMenu();

    const dynamicContainer = $('dynamicContent');
    if (dynamicContainer) {
        await loadDynamicContent(dynamicContainer);
    }
}

async function loadDynamicContent(container) {
    const path = window.location.pathname;
    let pageId = null;

    if (path.includes('about')) pageId = 'about';
    else if (path.includes('contact')) pageId = 'contact';

    if (!pageId) return;

    try {
        const docRef = doc(db, 'pages', pageId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const content = data[currentLang] || data['en'] || '<p>Content not available in this language.</p>';
            container.innerHTML = content;
        } else {
            container.innerHTML = '<p>No content found.</p>';
        }
    } catch (e) {
        console.error("Error loading dynamic content:", e);
        container.innerHTML = '<p>Error loading content.</p>';
    }
}

// Start
init();
