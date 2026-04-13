import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { $, setupLanguage, currentLang, initMobileMenu } from './common.js';
import { COMPANY_ID } from './company-config.js';
import { getPageDocId } from './firestore-paths.js';

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
        const scopedId = getPageDocId(COMPANY_ID, pageId);
        let docSnap = await getDoc(doc(db, 'pages', scopedId));
        if (!docSnap.exists()) {
            docSnap = await getDoc(doc(db, 'pages', pageId));
        }

        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.companyId && data.companyId !== COMPANY_ID) {
                console.warn('Page companyId mismatch:', pageId);
                container.innerHTML = '<p>No content found.</p>';
                return;
            }
            if (!data.companyId) console.warn('Page missing companyId:', pageId);
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
