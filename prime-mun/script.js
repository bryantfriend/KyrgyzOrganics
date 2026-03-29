import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Same config as main site
const firebaseConfig = {
    apiKey: "AIzaSyB2azgMx3VRCqKTVj4zhdqv51o6w1cAtxI",
    authDomain: "oa-kyrgyz-organic.firebaseapp.com",
    projectId: "oa-kyrgyz-organic",
    storageBucket: "oa-kyrgyz-organic.firebasestorage.app",
    messagingSenderId: "350088203372",
    appId: "1:350088203372:web:128e39d7f0cebc5be51c49",
    measurementId: "G-HD4B2XSVVT"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Utility: Generate Anon Session ID
function getSessionId() {
    let sid = localStorage.getItem('pmun_sid');
    if (!sid) {
        sid = 'sid_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('pmun_sid', sid);
    }
    return sid;
}

// Get URL Params
const urlParams = new URLSearchParams(window.location.search);
const sourceParam = urlParams.get('src') || 'unknown';

async function logEvent(actionType, actionValue = '') {
    try {
        await addDoc(collection(db, 'campaign_events'), {
            campaignId: 'prime-mun',
            sessionId: getSessionId(),
            timestamp: serverTimestamp(),
            source: sourceParam,
            userAgent: navigator.userAgent,
            pagePath: window.location.pathname,
            actionType: actionType,
            actionValue: actionValue
        });
    } catch (error) {
        console.error("Tracking Error:", error);
    }
}

async function initCampaign() {
    const mainContainer = document.getElementById('mainContainer');
    const fallbackMessage = document.getElementById('fallbackMessage');
    const ctaButton = document.getElementById('ctaButton');

    try {
        const campaignRef = doc(db, 'campaigns', 'prime-mun');
        const campaignSnap = await getDoc(campaignRef);

        let config;
        if (campaignSnap.exists()) {
            config = campaignSnap.data();
        } else {
            // Hard fallback if DB fails
            config = {
                isActive: true,
                headline: "PRIME MUN BOX",
                subheadline: "Limited for 3 days",
                imageUrl: "https://via.placeholder.com/600x400.png?text=Prime+MUN+Box",
                glovoLink: "https://glovoapp.com",
                optionalLine: "🎁 Free dessert included"
            };
        }

        // Check active status & Dates
        const now = new Date();
        let isActive = config.isActive;

        // Auto-deactivate if outside range
        if (isActive && config.startDate && config.endDate) {
            const start = config.startDate.toDate();
            const end = config.endDate.toDate();
            if (now < start || now > end) isActive = false;
        }

        if (!isActive) {
            fallbackMessage.style.display = 'block';
            mainContainer.style.display = 'none';
            return;
        }

        // Populate UI
        document.getElementById('headline').textContent = config.headline;
        document.getElementById('subheadline').textContent = config.subheadline;
        
        const productImage = document.getElementById('productImage');
        if (config.imageUrl) {
            productImage.src = config.imageUrl;
        }

        const optionalLine = document.getElementById('optionalLine');
        if (config.optionalLine) {
            optionalLine.textContent = config.optionalLine;
        } else {
            optionalLine.style.display = 'none';
        }

        // CTA Logic
        ctaButton.addEventListener('click', (e) => {
            e.preventDefault();
            logEvent('click_glovo', config.glovoLink).then(() => {
                window.location.href = config.glovoLink;
            });
        });

        // Trigger entrance animations
        // Small delay to ensure styles are ready
        setTimeout(() => {
            mainContainer.classList.add('loaded');
        }, 100);

        // Log page view
        logEvent('page_view', window.location.search);

    } catch (error) {
        console.error("Error loading campaign:", error);
        fallbackMessage.style.display = 'block';
        mainContainer.style.display = 'none';
    }
}

// Run
document.addEventListener('DOMContentLoaded', initCampaign);
