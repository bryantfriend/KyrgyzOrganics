import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, collection, addDoc, serverTimestamp, onSnapshot, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { COMPANY_ID, matchesCompanyId } from "../company-config.js";

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
let countdownTimer = null;
let campaignUnsubscribe = null;

async function logEvent(actionType, actionValue = '') {
    try {
        await addDoc(collection(db, 'campaign_events'), {
            companyId: COMPANY_ID,
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

function normalizeWhatsappNumber(value) {
    return String(value || '').replace(/[^\d]/g, '');
}

function buildWhatsAppUrl(config, headlineText) {
    const phone = normalizeWhatsappNumber(config.whatsappNumber);
    if (!phone) return '';

    const message = [
        'Hello!',
        `I want to order: ${headlineText || config.headline || 'Campaign offer'}.`,
        sourceParam && sourceParam !== 'unknown' ? `Source: ${sourceParam}` : ''
    ].filter(Boolean).join('\n');

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function applyCountdownVariant(variant = 'classic') {
    const countdownCard = document.getElementById('countdownCard');
    if (!countdownCard) return;
    countdownCard.className = `countdown-card variant-${variant}`;
}

function startCountdown(endDate, variant = 'classic') {
    const countdownCard = document.getElementById('countdownCard');
    const daysEl = document.getElementById('countdownDays');
    const hoursEl = document.getElementById('countdownHours');
    const minutesEl = document.getElementById('countdownMinutes');
    const secondsEl = document.getElementById('countdownSeconds');
    if (!countdownCard || !daysEl || !hoursEl || !minutesEl || !secondsEl || !endDate) return;

    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }

    applyCountdownVariant(variant);

    const updateCountdown = () => {
        const remaining = endDate.getTime() - Date.now();
        if (remaining <= 0) {
            daysEl.textContent = '00';
            hoursEl.textContent = '00';
            minutesEl.textContent = '00';
            secondsEl.textContent = '00';
            clearInterval(countdownTimer);
            countdownTimer = null;
            return;
        }

        const totalSeconds = Math.floor(remaining / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        daysEl.textContent = String(days).padStart(2, '0');
        hoursEl.textContent = String(hours).padStart(2, '0');
        minutesEl.textContent = String(minutes).padStart(2, '0');
        secondsEl.textContent = String(seconds).padStart(2, '0');
    };

    countdownCard.hidden = false;
    updateCountdown();
    countdownTimer = window.setInterval(updateCountdown, 1000);
}

function renderItemsLeftBadge(config) {
    const badge = document.getElementById('itemsLeftBadge');
    if (!badge) return;

    const maxSales = Number(config.maxSales || 0);
    const soldCount = Number(config.soldCount || 0);
    const left = Math.max(0, maxSales - soldCount);

    if (config.showItemsLeft && config.limitSalesEnabled && maxSales > 0) {
        badge.textContent = `ОСТАЛОСЬ ${left} ШТ.`;
        badge.hidden = false;
    } else {
        badge.hidden = true;
    }
}

function renderLogos(config, styles = {}) {
    const logoWidth = `${styles.logoWidth || 120}px`;
    const logos = [
        { el: document.getElementById('brandLogo'), url: config.logoUrl || '' },
        { el: document.getElementById('brandLogo2'), url: config.logoUrl2 || '' }
    ];

    logos.forEach(({ el, url }) => {
        if (!el) return;
        if (url) {
            el.src = url;
            el.style.display = 'block';
            el.style.width = logoWidth;
            el.style.height = 'auto';
        } else {
            el.removeAttribute('src');
            el.style.display = 'none';
        }
    });
}

function buildCampaignSilhouette(title = 'Coming Soon') {
    return `
        <div class="timeline-silhouette">
            <div class="silhouette-arch"></div>
            <div class="silhouette-lines">
                <span></span>
                <span></span>
            </div>
        </div>
        <span>${title}</span>
    `;
}

function toCampaignDate(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getCampaignTitle(campaign = {}, fallback = 'Campaign') {
    return campaign.timelineTitle || campaign.headline || campaign.headlineEN || campaign.headlineKG || campaign.title || fallback;
}

function getCampaignImage(campaign = {}) {
    return campaign.timelineImageUrl || campaign.imageUrl || campaign.optionalImageUrl || '';
}

function getCampaignUrl(campaign = {}) {
    if (campaign.url) return campaign.url;
    if (campaign.campaignUrl) return campaign.campaignUrl;
    if (campaign.slug) return `/${String(campaign.slug).replace(/^\/+|\/+$/g, '')}/`;
    if (campaign.id === 'prime-mun') return '/prime-mun/';
    return '/prime-mun/';
}

function getFallbackCampaignTimeline(currentCampaign = {}) {
    const fallbackTimeline = [
        { key: 'past1', status: 'past', title: 'Previous Drop', imageUrl: '' },
        { key: 'past2', status: 'past', title: 'Last Campaign', imageUrl: '' },
        { key: 'current', status: 'current', title: getCampaignTitle(currentCampaign, 'Current Campaign'), imageUrl: getCampaignImage(currentCampaign), url: getCampaignUrl(currentCampaign) },
        { key: 'future1', status: 'future', title: 'Coming Soon', imageUrl: '' },
        { key: 'future2', status: 'future', title: 'Next Surprise', imageUrl: '' }
    ];
    const savedTimeline = Array.isArray(currentCampaign.campaignTimeline) ? currentCampaign.campaignTimeline : [];

    return fallbackTimeline.map((fallback) => ({
        ...fallback,
        ...(savedTimeline.find(item => item.key === fallback.key) || {})
    }));
}

function campaignToTimelineItem(campaign, key, status, fallbackTitle) {
    return {
        key,
        status,
        title: getCampaignTitle(campaign, fallbackTitle),
        imageUrl: getCampaignImage(campaign),
        url: getCampaignUrl(campaign)
    };
}

function buildCampaignTimelineFromDocs(campaigns, currentCampaign) {
    const now = new Date();
    const fallbackTimeline = getFallbackCampaignTimeline(currentCampaign);
    const fallbackByKey = Object.fromEntries(fallbackTimeline.map(item => [item.key, item]));
    const currentId = currentCampaign.id || 'prime-mun';

    const pastCampaigns = campaigns
        .filter(campaign => campaign.id !== currentId)
        .filter(campaign => {
            const end = toCampaignDate(campaign.endDate);
            return end && end < now;
        })
        .sort((a, b) => toCampaignDate(b.endDate) - toCampaignDate(a.endDate))
        .slice(0, 2)
        .reverse();

    const futureCampaigns = campaigns
        .filter(campaign => campaign.id !== currentId)
        .filter(campaign => {
            const start = toCampaignDate(campaign.startDate);
            return start && start > now;
        })
        .sort((a, b) => toCampaignDate(a.startDate) - toCampaignDate(b.startDate))
        .slice(0, 2);

    return [
        pastCampaigns[0] ? campaignToTimelineItem(pastCampaigns[0], 'past1', 'past', 'Previous Campaign') : fallbackByKey.past1,
        pastCampaigns[1] ? campaignToTimelineItem(pastCampaigns[1], 'past2', 'past', 'Last Campaign') : fallbackByKey.past2,
        campaignToTimelineItem(currentCampaign, 'current', 'current', fallbackByKey.current?.title || 'Current Campaign'),
        futureCampaigns[0] ? campaignToTimelineItem(futureCampaigns[0], 'future1', 'future', 'Coming Soon') : fallbackByKey.future1,
        futureCampaigns[1] ? campaignToTimelineItem(futureCampaigns[1], 'future2', 'future', 'Next Surprise') : fallbackByKey.future2
    ].filter(Boolean);
}

async function resolveCampaignTimeline(config, headlineText) {
    const currentCampaign = {
        id: 'prime-mun',
        ...config,
        headline: headlineText || config.headline
    };

    try {
        const campaignsSnap = await getDocs(collection(db, 'campaigns'));
        const campaigns = campaignsSnap.docs
            .map(campaignDoc => ({ id: campaignDoc.id, ...campaignDoc.data() }))
            .filter(campaign => matchesCompanyId(campaign, `campaigns/${campaign.id}`));

        const hasCurrent = campaigns.some(campaign => campaign.id === currentCampaign.id);
        return buildCampaignTimelineFromDocs(hasCurrent ? campaigns : [...campaigns, currentCampaign], currentCampaign);
    } catch (error) {
        console.warn('Campaign timeline load failed:', error);
        return getFallbackCampaignTimeline(currentCampaign);
    }
}

async function renderCampaignTimeline(config, headlineText) {
    const timelineEl = document.getElementById('campaignTimeline');
    if (!timelineEl) return;

    if (config.showCampaignJourney === false) {
        timelineEl.hidden = true;
        timelineEl.innerHTML = '';
        return;
    }

    const timeline = await resolveCampaignTimeline(config, headlineText);

    timelineEl.hidden = false;
    timelineEl.innerHTML = `
        <div class="timeline-kicker">Campaign Journey</div>
        <div class="timeline-track">
            ${timeline.map((item) => {
                const status = item.status || 'future';
                const title = item.title || (status === 'future' ? 'Coming Soon' : 'Campaign');
                const imageUrl = item.imageUrl || '';
                const imageMarkup = imageUrl
                    ? `<img src="${imageUrl}" alt="${title}">`
                    : buildCampaignSilhouette(title);

                return `
                    <article class="timeline-card ${status === 'current' ? 'is-current' : ''} ${status === 'future' ? 'is-future' : ''}">
                        <div class="timeline-image">${imageMarkup}</div>
                        <div class="timeline-label">${status === 'current' ? 'Now' : status === 'future' ? 'Soon' : 'Past'}</div>
                        <h3>${title}</h3>
                    </article>
                `;
            }).join('')}
        </div>
    `;
}

function renderContentElement({ textEl, imageEl, useImage, imageUrl, textValue }) {
    if (!textEl || !imageEl) return;

    if (useImage && imageUrl) {
        imageEl.src = imageUrl;
        imageEl.hidden = false;
        imageEl.style.display = '';
        textEl.hidden = true;
        textEl.style.display = 'none';
        return;
    }

    textEl.hidden = false;
    textEl.style.display = '';
    imageEl.hidden = true;
    imageEl.style.display = 'none';
    imageEl.removeAttribute('src');
    if ('textContent' in textEl) {
        textEl.textContent = textValue || '';
    }
}

function spawnParticles(type, color) {
    const container = document.getElementById('particleBg');
    if (!container) return;
    container.innerHTML = '';
    if (!type || type === 'none') return;
    
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
        p.style.color = color || '#f9e29f';
        p.style.opacity = '0';
        p.style.pointerEvents = 'none';
        p.style.animation = `float ${Math.random() * 5 + 8}s linear infinite`;
        p.style.animationDelay = Math.random() * 10 + 's';
        container.appendChild(p);
    }
}

function applyEntranceAnimation(element, variant = 'fadeUp') {
    if (!element) return;
    element.classList.remove('anim-fadeUp', 'anim-zoomIn', 'anim-reveal', 'anim-bounce');
    void element.offsetWidth;
    element.classList.add(`anim-${variant}`);
}

async function initCampaign() {
    const mainContainer = document.getElementById('mainContainer');
    const fallbackMessage = document.getElementById('fallbackMessage');
    const ctaButton = document.getElementById('ctaButton');
    const deliveryInfo = document.querySelector('.delivery-info');
    const countdownCard = document.getElementById('countdownCard');

    try {
        const campaignRef = doc(db, 'campaigns', 'prime-mun');
        let hasLoggedPageView = false;
        campaignUnsubscribe?.();
        campaignUnsubscribe = onSnapshot(campaignRef, (campaignSnap) => {
            if (!campaignSnap.exists()) throw new Error("No campaign config");
            const config = campaignSnap.data();
            if (config.companyId && config.companyId !== COMPANY_ID) throw new Error("Campaign unavailable for this company");
            if (!config.companyId) console.warn('Campaign missing companyId: prime-mun');
            const s = config.styles || {};
            const soldCount = Number(config.soldCount || 0);

            const now = new Date();
            let isActive = config.isActive;
            let endDate = null;
            if (isActive && config.startDate && config.endDate) {
                const start = config.startDate.toDate();
                endDate = config.endDate.toDate();
                if (now < start || now > endDate) isActive = false;
            } else if (config.endDate) {
                endDate = config.endDate.toDate();
            }

            if (!isActive) {
                fallbackMessage.style.display = 'block';
                mainContainer.style.display = 'none';
                return;
            }

            fallbackMessage.style.display = 'none';
            mainContainer.style.display = '';

            const salesLimitReached = Boolean(config.limitSalesEnabled && config.maxSales > 0 && soldCount >= config.maxSales);

            const bodyColor = s.textColor || '#f9e29f';
            document.body.style.backgroundColor = s.bgColor || '#0c0b0a';
            document.body.style.color = bodyColor;

            document.body.classList.remove('texture-noise', 'texture-luxury', 'texture-stars', 'texture-dots', 'texture-carbon');
            if (s.bgTexture && s.bgTexture !== 'none') {
                document.body.classList.add(`texture-${s.bgTexture}`);
            }

            spawnParticles(s.bgParticles, bodyColor);

            let headlineText = config.headline;
            if (langParam === 'en' && config.headlineEN) headlineText = config.headlineEN;
            if (langParam === 'kg' && config.headlineKG) headlineText = config.headlineKG;
            renderCampaignTimeline(config, headlineText);

            const h1 = document.getElementById('headline');
            const headlineImage = document.getElementById('headlineImage');
            if (h1) {
                h1.style.fontFamily = s.headlineFont || "'Playfair Display', serif";
                h1.style.fontSize = (s.headlineSize || 2.25) + 'rem';
                h1.style.color = bodyColor;
            }
            renderContentElement({
                textEl: h1,
                imageEl: headlineImage,
                useImage: !!config.headlineUseImage,
                imageUrl: config.headlineImageUrl || '',
                textValue: headlineText
            });

            const subH = document.getElementById('subheadline');
            const subheadlineImage = document.getElementById('subheadlineImage');
            if (subH) {
                subH.style.color = bodyColor;
            }
            renderContentElement({
                textEl: subH,
                imageEl: subheadlineImage,
                useImage: !!config.subheadlineUseImage,
                imageUrl: config.subheadlineImageUrl || '',
                textValue: config.subheadline
            });

            if (countdownCard) {
                countdownCard.hidden = true;
            }

            if (config.showCountdown !== false && endDate && endDate.getTime() > Date.now()) {
                startCountdown(endDate, config.countdownVariant || 'classic');
            } else if (countdownTimer) {
                clearInterval(countdownTimer);
                countdownTimer = null;
            }
            renderItemsLeftBadge(config);

            const optionalLine = document.getElementById('optionalLine');
            const optionalLineImage = document.getElementById('optionalLineImage');
            if (optionalLine) {
                if (config.optionalLine || config.optionalImageUrl) {
                    optionalLine.style.color = bodyColor;
                } else {
                    optionalLine.style.display = 'none';
                }
            }
            if (optionalLineImage) {
                optionalLineImage.hidden = true;
            }
            if (optionalLine && (config.optionalLine || config.optionalImageUrl)) {
                optionalLine.style.display = '';
                renderContentElement({
                    textEl: optionalLine,
                    imageEl: optionalLineImage,
                    useImage: !!config.optionalUseImage,
                    imageUrl: config.optionalImageUrl || '',
                    textValue: config.optionalLine
                });
            }

            renderLogos(config, s);

            const productImage = document.getElementById('productImage');
            if (productImage) {
                productImage.src = config.imageUrl;
                productImage.style.transform = `scale(${(s.imgScale || 100) / 100})`;
            }

            if (ctaButton) {
                ctaButton.style.background = s.btnColor || '#00c3a5';
                ctaButton.classList.remove('pulse-btn');
                if (s.btnPulse) ctaButton.classList.add('pulse-btn');
                const whatsappUrl = buildWhatsAppUrl(config, headlineText);
                ctaButton.disabled = !whatsappUrl || salesLimitReached;
                ctaButton.textContent = salesLimitReached ? 'Sold Out' : (whatsappUrl ? 'Order on WhatsApp' : 'WhatsApp unavailable');
                const dot = document.createElement('span');
                dot.className = 'location-dot';
                ctaButton.appendChild(dot);
                ctaButton.onclick = (e) => {
                    e.preventDefault();
                    if (!whatsappUrl || salesLimitReached) return;
                    logEvent('cta_click', whatsappUrl).then(() => {
                        window.location.href = whatsappUrl;
                    });
                };
            }

            if (deliveryInfo && salesLimitReached) {
                deliveryInfo.innerHTML = `
                    <span>This campaign has reached its order limit.</span>
                `;
            } else if (deliveryInfo) {
                const shouldShowDeliveryInfo = !!config.showDeliveryInfo;
                const deliveryText = config.deliveryInfoText || 'Delivery in under 60 minutes';
                deliveryInfo.style.display = shouldShowDeliveryInfo ? '' : 'none';
                if (shouldShowDeliveryInfo) {
                    deliveryInfo.innerHTML = `
                        <span>${deliveryText}</span>
                    `;
                }
            }

            if (mainContainer) {
                applyEntranceAnimation(mainContainer, s.entranceAnim || 'fadeUp');
                mainContainer.classList.add('loaded');
                setTimeout(() => { mainContainer.style.opacity = '1'; }, 10);
            }

            if (!hasLoggedPageView) {
                hasLoggedPageView = true;
                logEvent('page_view', window.location.search);
            }
        }, (error) => {
            console.error("Campaign subscription error:", error);
            if (fallbackMessage) fallbackMessage.style.display = 'block';
            if (mainContainer) mainContainer.style.display = 'none';
        });

    } catch (error) {
        console.error("Campaign init error:", error);
        if (fallbackMessage) fallbackMessage.style.display = 'block';
        if (mainContainer) mainContainer.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', initCampaign);
