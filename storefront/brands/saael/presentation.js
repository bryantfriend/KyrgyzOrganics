// A visual skin for this company only. Stored configuration, launch permissions,
// contact destinations, and all business actions remain owned by the storefront.
var assetRoot = new URL('./assets/', import.meta.url).href;
var cardArtwork = [
    { id: 'my-path', title: 'My Path', text: 'My story, values, and transformations that shape my work.', symbol: 'path' },
    { id: 'visual-worlds', title: 'Visual Worlds', text: 'Explore my artworks and visual expressions from the seen and unseen.', symbol: 'eye' },
    { id: 'mythopoetic-world', title: 'Kyrkkyz\nMythopoetic World', text: 'Step into a symbolic realm of stories, archetypes, and living mythology.', symbol: 'moon' },
    { id: 'intuitive-method', title: 'Intuitive\nDrawing Method', text: 'Discover the practice that bridges intuition, symbols, and the creative soul.', symbol: 'hand' },
    { id: 'inner-notes', title: 'Inner Notes', text: 'Writings, reflections, and philosophical whispers from my inner world.', symbol: 'book' },
    { id: 'conscious-work', title: 'Conscious\nEntrepreneurship', text: 'Building meaningful projects, aligned business, and a life of creative freedom.', symbol: 'sun' },
    { id: 'work-with-me', title: 'Work\nWith Me', text: 'Offerings, collaborations, and mentorship for your journey and expansion.', symbol: 'woman' },
    { id: 'connect', title: 'Connect', text: "Let’s connect and create something beautiful together.", symbol: 'flower' }
];

function isSaaelStore(store) {
    return Boolean(store && store.companyId === 'saael-s');
}

function findCardArtwork(card) {
    for (var index = 0; index < cardArtwork.length; index += 1) {
        var artwork = cardArtwork[index];
        if (card.id === artwork.id || card.href === '#' + artwork.id) {
            return artwork;
        }
    }
    return null;
}

function applyCardArtwork(card) {
    var artwork = findCardArtwork(card);
    if (!artwork) {
        return card;
    }
    // Keep the configured destination even when the presentation changes.
    return Object.assign({}, card, {
        id: artwork.id,
        title: artwork.title,
        text: artwork.text,
        icon: '✧',
        imageUrl: assetRoot + artwork.id + '.webp'
    });
}

function applyNavigationLabel(item) {
    var artwork = findCardArtwork(item);
    if (!artwork) {
        return item;
    }
    return Object.assign({}, item, { label: artwork.title.replace('\n', ' ') });
}

function loadPresentationStyles() {
    if (document.getElementById('saael-presentation-styles')) {
        return;
    }
    var stylesheet = document.createElement('link');
    stylesheet.id = 'saael-presentation-styles';
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('./presentation.css', import.meta.url).href;
    document.head.appendChild(stylesheet);

    var fonts = document.createElement('link');
    fonts.rel = 'stylesheet';
    fonts.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Jost:wght@400;500&display=swap';
    document.head.appendChild(fonts);
}

export function applySaaelPresentation(store) {
    if (!isSaaelStore(store)) {
        return store;
    }
    loadPresentationStyles();
    document.body.classList.add('saael-universe');
    var content = store.content || {};
    var cards = content.linkCards || [];
    var navigation = content.navigation || [];
    return Object.assign({}, store, {
        name: 'Saikal SaaEl Universe',
        theme: Object.assign({}, store.theme, {
            siteStyle: 'editorial', backgroundColor: '#faf0e2', textColor: '#302315',
            primaryColor: '#a95e34', secondaryColor: '#f4e3cc', borderRadius: '20px'
        }),
        seo: Object.assign({}, store.seo, {
            title: 'Saikal SaaEl Universe | Living Archive of Art & Inner Worlds',
            description: 'Art, philosophy, intuitive drawing, mythopoetic storytelling, and conscious entrepreneurship.'
        }),
        content: Object.assign({}, content, {
            loadingText: 'Opening a universe of art & inner worlds.',
            brandStrip: 'ART   ·   PHILOSOPHY   ·   INTUITIVE DRAWING   ·   MYTHOPOETIC STORYTELLING   ·   CONSCIOUS ENTREPRENEURSHIP',
            navigation: navigation.map(applyNavigationLabel),
            linkCards: cards.map(applyCardArtwork),
            hero: Object.assign({}, content.hero, {
                eyebrow: '', title: 'Saikal\nSaaEl\nUniverse',
                subtitle: 'Living Archive of Art & Inner Worlds',
                body: 'I am an artist, philosopher, intuitive drawing guide, author, and entrepreneur creating a mythopoetic visual world.',
                note: 'Art, philosophy, intuitive drawing, mythopoetic storytelling, and conscious entrepreneurship.',
                imageUrl: assetRoot + 'hero.webp',
                ctaText: 'Explore the universe', ctaTarget: '#storeLinkCards'
            })
        })
    });
}

function createSymbol(name) {
    var symbol = document.createElement('span');
    symbol.className = 'saael-symbol';
    symbol.setAttribute('aria-hidden', 'true');
    // Only local, authored SVG symbols are used; no remote markup is inserted.
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 64 72');
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', assetRoot + 'symbols.svg#' + name);
    svg.appendChild(use);
    symbol.appendChild(svg);
    return symbol;
}

export function renderSaaelDetails(store) {
    if (!isSaaelStore(store)) {
        return;
    }
    var logo = document.querySelector('.header .logo');
    if (logo) {
        var name = document.createElement('span');
        name.textContent = 'Saikal SaaEl Universe';
        logo.replaceChildren(createSymbol('brand'), name);
    }
    var hero = document.querySelector('.hero-carousel');
    if (hero) {
        hero.classList.add('saael-hero');
        var heading = hero.querySelector('h1');
        if (heading) {
            heading.setAttribute('aria-label', 'Saikal SaaEl Universe');
            heading.replaceChildren();
            ['Saikal', 'SaaEl', 'Universe'].forEach(function appendTitleLine(line) {
                var span = document.createElement('span');
                span.textContent = line;
                heading.appendChild(span);
            });
        }
        var portrait = hero.querySelector('.store-hero-media img');
        if (portrait) {
            portrait.alt = 'Artist portrait in a warm studio with intuitive drawings and dried wildflowers';
            portrait.setAttribute('fetchpriority', 'high');
            portrait.width = 1536;
            portrait.height = 1024;
        }
    }
    var cards = document.querySelectorAll('#storeLinkCards .store-link-card');
    cards.forEach(function decorateCard(card) {
        var artwork = findCardArtwork({ id: card.id });
        if (!artwork) {
            return;
        }
        var icon = card.querySelector('.store-link-card-icon');
        if (icon) {
            icon.replaceChildren(createSymbol(artwork.symbol));
        }
    });
    var grid = document.getElementById('storeLinkCards');
    if (grid) {
        grid.setAttribute('aria-label', 'Explore the universe');
        grid.tabIndex = -1;
    }
    var menuButton = document.querySelector('.hamburger-btn');
    var menu = document.querySelector('.mobile-menu');
    if (menuButton && menu && !menuButton.dataset.saaelAccessible) {
        menuButton.dataset.saaelAccessible = 'true';
        menu.id = 'saael-mobile-menu';
        menuButton.setAttribute('aria-controls', menu.id);
        menuButton.setAttribute('aria-expanded', 'false');
        menu.inert = true;
        menu.setAttribute('aria-hidden', 'true');
        var closeButton = menu.querySelector('.close-menu');
        if (closeButton) {
            closeButton.setAttribute('aria-label', 'Close menu');
        }
        var observer = new MutationObserver(function updateMenuAccessibility() {
            var isOpen = menu.classList.contains('open');
            menuButton.setAttribute('aria-expanded', String(isOpen));
            menu.inert = !isOpen;
            menu.setAttribute('aria-hidden', String(!isOpen));
            if (isOpen && closeButton) {
                closeButton.focus();
            }
        });
        observer.observe(menu, { attributes: true, attributeFilter: ['class'] });
        // Navigation is re-rendered after the shared menu initializes. Delegate
        // closing here so replacement links retain the existing menu behavior.
        menu.addEventListener('click', function closeMenuAfterNavigation(event) {
            if (event.target.closest('a')) {
                menu.classList.remove('open');
                document.body.style.overflow = '';
            }
        });
        menu.addEventListener('keydown', function closeMenuWithEscape(event) {
            if (event.key === 'Escape') {
                var closeButton = menu.querySelector('.close-menu');
                if (closeButton) {
                    closeButton.click();
                    menuButton.focus();
                }
            }
        });
    }
}
