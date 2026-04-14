function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderConfiguredHero(root, store, section) {
    const hero = store?.content?.hero || {};
    const variant = section?.variant || 'image';
    const imageUrl = hero.imageUrl || '';

    root.classList.add('store-hero-section', `store-hero-${variant}`);
    root.innerHTML = `
        <div class="store-hero-copy">
            <p class="store-hero-eyebrow">${escapeHtml(store?.name || '')}</p>
            <h1>${escapeHtml(hero.title || store?.name || '')}</h1>
            ${hero.subtitle ? `<p>${escapeHtml(hero.subtitle)}</p>` : ''}
            ${hero.ctaText ? `<a class="cta-btn" href="${escapeHtml(hero.ctaTarget || '#products')}">${escapeHtml(hero.ctaText)}</a>` : ''}
        </div>
        ${imageUrl ? `<div class="store-hero-media"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(hero.title || store?.name || 'Store hero')}"></div>` : ''}
    `;
}

function renderCarouselHero(root, bannerData = []) {
    if (!bannerData.length) {
        root.innerHTML = `
          <div style="display:flex; justify-content:center; align-items:center; height:100%; background:#eee; color:#777;">
            No Active Banners
          </div>`;
        return;
    }

    root.innerHTML = `
        <div class="carousel-track">
            ${bannerData.map((b, i) => `
                <div class="carousel-slide ${i === 0 ? 'is-active' : ''}">
                    <img src="${escapeHtml(b.imageUrl)}" class="carousel-image" alt="">
                </div>
            `).join('')}
        </div>
        <div class="carousel-dots">
            ${bannerData.map((_, i) => `<button class="dot ${i === 0 ? 'is-active' : ''}" type="button"></button>`).join('')}
        </div>
    `;

    let currentSlide = 0;
    const slides = root.querySelectorAll('.carousel-slide');
    const dots = root.querySelectorAll('.dot');

    if (slides.length > 1) {
        setInterval(() => {
            slides[currentSlide].classList.remove('is-active');
            if (dots[currentSlide]) dots[currentSlide].classList.remove('is-active');

            currentSlide = (currentSlide + 1) % slides.length;

            slides[currentSlide].classList.add('is-active');
            if (dots[currentSlide]) dots[currentSlide].classList.add('is-active');
        }, 5000);
    }
}

export function renderHeroSection({ root, store, section, bannerData = [] }) {
    if (!root) return false;

    root.className = 'hero-carousel';
    root.innerHTML = '';

    if ((section?.variant || 'carousel') === 'carousel') {
        renderCarouselHero(root, bannerData);
    } else {
        renderConfiguredHero(root, store, section);
    }

    return true;
}
