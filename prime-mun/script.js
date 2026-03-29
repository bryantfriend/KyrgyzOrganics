import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

function getSessionId() {
    let sid = localStorage.getItem('pmun_sid');
    if (!sid) {
        sid = 'sid_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('pmun_sid', sid);
    }
    return sid;
}

const urlParams = new URLSearchParams(window.location.search);
const sourceParam = urlParams.get('src') || 'unknown';
const langParam = urlParams.get('lang') || localStorage.getItem('selectedLang') || 'ru';

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
    } catch (error) { console.error("Tracking error:", error); }
}

function spawnParticles(type) {
    if (type === 'none') return;
    const container = document.getElementById('particleBg');
    const count = 30;
    const icons = {
        sparkles: '✨',
        float: '🍃',
        snow: '🌸'
    };
    const icon = icons[type] || '•';

    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.textContent = icon;
        p.style.position = 'absolute';
        p.style.left = Math.random() * 100 + 'vw';
        p.style.top = '110vh';
        p.style.fontSize = (Math.random() * 1.5 + 0.5) + 'rem';
        p.style.opacity = '0';
        p.style.animation = `float ${Math.random() * 5 + 5}s linear infinite`;
        p.style.animationDelay = Math.random() * 10 + 's';
        container.appendChild(p);
    }
}

async function initCampaign() {
    const mainContainer = document.getElementById('mainContainer');
    const fallbackMessage = document.getElementById('fallbackMessage');
    const ctaButton = document.getElementById('ctaButton');

    try {
        const campaignRef = doc(db, 'campaigns', 'prime-mun');
        const campaignSnap = await getDoc(campaignRef);

        if (!campaignSnap.exists()) throw new Error("No campaign config");
        const config = campaignSnap.data();
        const s = config.styles || {};

        // Active Range Check
        const now = new Date();
        let isActive = config.isActive;
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

        // Apply Global Styles
        document.body.style.backgroundColor = s.bgColor || '#0c0b0a';
        if (s.bgTexture && s.bgTexture !== 'none') {
            document.body.classList.add(`texture-${s.bgTexture}`);
        }
        spawnParticles(s.bgParticles);

        // Language Resolution
        let headlineText = config.headline; // Default RU
        if (langParam === 'en' && config.headlineEN) headlineText = config.headlineEN;
        if (langParam === 'kg' && config.headlineKG) headlineText = config.headlineKG;

        // Typography
        const h1 = document.getElementById('headline');
        h1.textContent = headlineText;
        h1.style.fontFamily = s.headlineFont || "'Playfair Display', serif";
        h1.style.fontSize = (s.headlineSize || 2.25) + 'rem';
        
        document.getElementById('subheadline').textContent = config.subheadline;
        const optionalLine = document.getElementById('optionalLine');
        if (config.optionalLine) {
            optionalLine.textContent = config.optionalLine;
        } else {
            optionalLine.style.display = 'none';
        }

        // Assets
        const brandLogo = document.getElementById('brandLogo');
        brandLogo.src = config.logoUrl || "https://via.placeholder.com/150x60?text=KYRGYZ+ORGANIC";
        brandLogo.style.width = (s.logoWidth || 120) + 'px';

        const productImage = document.getElementById('productImage');
        productImage.src = config.imageUrl;
        productImage.style.transform = `scale(${ (s.imgScale || 100) / 100 })`;

        // CTA
        ctaButton.style.background = s.btnColor || '#00c3a5';
        if (s.btnPulse) ctaButton.classList.add('pulse-btn');
        ctaButton.addEventListener('click', (e) => {
            e.preventDefault();
            logEvent('click_glovo', config.glovoLink).then(() => {
                window.location.href = config.glovoLink;
            });
        });

        // Animations
        const animClass = `anim-${s.entranceAnim || 'fadeUp'}`;
        mainContainer.classList.add(animClass);
        setTimeout(() => { mainContainer.style.opacity = '1'; }, 10);

        logEvent('page_view', window.location.search);

    } catch (error) {
        console.error("Campaign init error:", error);
        fallbackMessage.style.display = 'block';
        mainContainer.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', initCampaign);
