document.addEventListener('DOMContentLoaded', async function() {
    AOS.init({ duration: 800, once: true, offset: 50 });
    
    // --- Investment Level Data ---
const investmentLevels = [
    { level: 1, min: 5000, max: 18000, rate: 0.09, cashOut: '6 weeks', slots: 288, topUp: '1 week', color: 'bg-green-50' },
    { level: 2, min: 18001, max: 36000, rate: 0.11, cashOut: '3 months', slots: 144, topUp: '2 weeks', color: 'bg-green-50' },
    { level: 3, min: 36001, max: 72000, rate: 0.14, cashOut: '6 months', slots: 72, topUp: '4 weeks', color: 'bg-green-50' },
    { level: 4, min: 72001, max: 144000, rate: 0.18, cashOut: '9 months', slots: 36, topUp: '6 weeks', color: 'bg-green-50' },
    { level: 5, min: 144001, max: 288000, rate: 0.22, cashOut: '12 months', slots: 18, topUp: '8 weeks', color: 'bg-blue-50' },
    { level: 6, min: 288001, max: 576000, rate: 0.28, cashOut: '14 months', slots: 9, topUp: '10 weeks', color: 'bg-blue-50' },
    { level: 7, min: 576001, max: 1152000, rate: 0.34, cashOut: '16 months', slots: 5, topUp: '12 weeks', color: 'bg-purple-50' }
];


    // --- Mobile Menu Toggle ---
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileMenuLinks = document.querySelectorAll('#mobile-menu a');

    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    if (mobileMenu && mobileMenuLinks.length > 0) {
        mobileMenuLinks.forEach(link => {
            link.addEventListener('click', () => {
                setTimeout(() => {
                    mobileMenu.classList.add('hidden');
                }, 100);
            });
        });
    }

    let translations = {};
    let currentLang = localStorage.getItem('biscottiLang') || 'ky';

    // --- Load translations JSON ---
    try {
        const response = await fetch('biscotti_translations.json');
        translations = await response.json();
    } catch (err) {
        console.error("Error loading translations:", err);
    }

    // --- Language switching ---
    const setLanguage = (lang) => {
        if (!translations[lang]) return;
        currentLang = lang;
        localStorage.setItem('biscottiLang', lang);

        document.querySelectorAll('[data-lang]').forEach(el => {
            const key = el.getAttribute('data-lang');
            if (translations[lang][key]) {
                el.innerHTML = translations[lang][key];
            }
        });

        document.querySelectorAll('[data-lang-placeholder]').forEach(el => {
            const key = el.getAttribute('data-lang-placeholder');
            if (translations[lang][key]) {
                el.placeholder = translations[lang][key];
            }
        });

        document.querySelectorAll('.lang-switcher button').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-set-lang') === lang);
        });
        
        renderLevelCards();
        calculateROI(parseInt(investmentInput.value, 10));
    };

    document.querySelectorAll('[data-set-lang]').forEach(button => {
        button.addEventListener('click', () => {
            setLanguage(button.getAttribute('data-set-lang'));
        });
    });

    // --- ROI Calculator Logic ---
    const investmentInput = document.getElementById('investment');
    const investmentSlider = document.getElementById('investment-slider');
    const investmentLevelEl = document.getElementById('investment-level');
    const returnRateEl = document.getElementById('return-rate');
    const annualProfitEl = document.getElementById('annual-profit');

    function getLevelForInvestment(investment) {
        return investmentLevels.find(l => investment >= l.min && investment <= l.max) || investmentLevels[0];
    }

    function calculateROI(investment) {
        const currentLevel = getLevelForInvestment(investment);
        const annualProfit = investment * currentLevel.rate;

        investmentLevelEl.textContent = currentLevel.level;
        // FIXED: Round the percentage to a whole number
        returnRateEl.textContent = `${Math.round(currentLevel.rate * 100)}%`;
        annualProfitEl.textContent = Math.round(annualProfit).toLocaleString();
        
        document.querySelectorAll('.level-card').forEach(card => {
            card.classList.remove('level-active');
            if (parseInt(card.dataset.level) === currentLevel.level) {
                card.classList.add('level-active');
            }
        });

        localStorage.setItem('biscottiInvestmentAmount', investment);
    }

    investmentInput.addEventListener('input', (e) => {
        let value = parseInt(e.target.value, 10) || 0;
        if (value < 5000) value = 5000;
        if (value > 1152000) value = 1152000;
        investmentSlider.value = value;
        calculateROI(value);
    });
    investmentSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value, 10);
        investmentInput.value = value;
        calculateROI(value);
    });

    // --- Level Cards Rendering ---
    const levelsContainer = document.getElementById('levels-container');
    function renderLevelCards() {
        levelsContainer.innerHTML = '';
        investmentLevels.forEach(level => {
            const card = document.createElement('div');
            card.className = `level-card p-6 rounded-lg shadow-md transition-all duration-300 border-2 border-transparent ${level.color}`;
            card.dataset.level = level.level;

            card.innerHTML = `
                <div class="flex justify-between items-center mb-2">
                    <h3 class="text-xl font-bold text-gray-800" data-lang="level_card_title">Level ${level.level}</h3>
                    <span class="text-2xl font-bold text-green-700">${Math.round(level.rate * 100)}%</span>
                </div>
                <p class="text-gray-600 font-semibold">${level.min.toLocaleString()} - ${level.max.toLocaleString()} som</p>
                <div class="text-sm text-gray-500 mt-4 space-y-1">
                    <p><strong><span data-lang="level_card_slots">Slots</span>:</strong> ${level.slots}</p>
                    <p><strong><span data-lang="level_card_cashout">Cash-out</span>:</strong> <span data-lang="level_card_after">after</span> ${level.cashOut}</p>
                    <p><strong><span data-lang="level_card_topup">Top-up</span>:</strong> <span data-lang="level_card_after">after</span> ${level.topUp}</p>
                </div>
            `;
            levelsContainer.appendChild(card);
        });
    }

    // --- Modal & Pitch Generator ---
    const modal = document.getElementById('summary-modal');
    const summaryContent = document.getElementById('summary-content');
    const generatePitchBtn = document.getElementById('generate-pitch-btn');
    const pitchLoader = document.getElementById('pitch-loader');
    const pitchResultContainer = document.getElementById('pitch-result-container');
    const pitchText = document.getElementById('pitch-text');
    const copyPitchBtn = document.getElementById('copy-pitch-btn');
    const copyFeedback = document.getElementById('copy-feedback');

    document.getElementById('show-summary-btn').addEventListener('click', () => {
        const investment = investmentInput.value;
        const currentLevelData = getLevelForInvestment(parseInt(investment));
        const profit = Math.round(investment * currentLevelData.rate).toLocaleString();
        const lang = currentLang;

        summaryContent.innerHTML = `
            <p><strong>${translations[lang].modal_summary_investment}</strong> 
            <span class="text-green-700 font-semibold">${parseInt(investment).toLocaleString()} som</span></p>
            <p><strong>${translations[lang].modal_summary_level}</strong> 
            <span class="text-green-700 font-semibold">${currentLevelData.level} (${Math.round(currentLevelData.rate * 100)}%)</span></p>
            <p><strong>${translations[lang].modal_summary_profit}</strong> 
            <span class="text-green-700 font-semibold">${profit} som</span></p>
            <p class="text-sm text-gray-500 mt-4">${translations[lang].modal_summary_disclaimer}</p>
        `;
        pitchResultContainer.classList.add('hidden');
        generatePitchBtn.classList.remove('hidden');
        modal.classList.remove('hidden');
    });

    generatePitchBtn.addEventListener('click', async () => {
        generatePitchBtn.classList.add('hidden');
        pitchLoader.classList.remove('hidden');

        const investment = investmentInput.value;
        const profit = annualProfitEl.textContent;
        const currentLevelData = getLevelForInvestment(parseInt(investment));
        const rate = `${Math.round(currentLevelData.rate * 100)}%`;
        
        const pitch = `Hey, I came across an interesting local investment: ${parseInt(investment).toLocaleString()} som into Biscotti_Miste for a guaranteed ${rate} annual return, which projects to ${profit} som per year. What do you think?`;

        pitchText.value = pitch;
        pitchLoader.classList.add('hidden');
        pitchResultContainer.classList.remove('hidden');
    });

    copyPitchBtn.addEventListener('click', () => {
        pitchText.select();
        document.execCommand('copy');
        copyFeedback.classList.remove('hidden');
        setTimeout(() => copyFeedback.classList.add('hidden'), 2000);
    });

    const closeModal = () => modal.classList.add('hidden');
    document.getElementById('close-modal-btn').addEventListener('click', closeModal);
    document.getElementById('close-modal-btn-2').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.getElementById('print-summary-btn').addEventListener('click', () => window.print());

    // --- FAQ Accordion ---
    document.querySelectorAll('.faq-item .faq-question').forEach(question => {
        question.addEventListener('click', () => {
            const answer = question.nextElementSibling;
            const icon = question.querySelector('i');
            const isOpen = answer.style.maxHeight && answer.style.maxHeight !== '0px';
            document.querySelectorAll('.faq-answer').forEach(a => a.style.maxHeight = '0');
            document.querySelectorAll('.faq-question i').forEach(i => i.classList.remove('rotate-180'));
            if (!isOpen) {
                answer.style.maxHeight = answer.scrollHeight + 'px';
                icon.classList.add('rotate-180');
            }
        });
    });

    // --- Scroll Spy & Header Hide/Show ---
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    const header = document.getElementById('header');
    let lastScrollTop = 0;
    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => { if (pageYOffset >= section.offsetTop - 100) current = section.getAttribute('id'); });
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.href && link.href.includes(current)) link.classList.add('active');
        });
        let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        if (scrollTop > lastScrollTop) {
            header.style.top = '-100px';
        } else {
            header.style.top = '0';
        }
        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
    });

    // --- Initial Load ---
    const savedInvestment = localStorage.getItem('biscottiInvestmentAmount');
    if (savedInvestment) {
        const initialInvestment = parseInt(savedInvestment, 10);
        investmentInput.value = initialInvestment;
        investmentSlider.value = initialInvestment;
    }
    setLanguage(currentLang);
    calculateROI(parseInt(investmentInput.value, 10));
});

// --- WhatsApp Form Submission Logic ---
const leadForm = document.getElementById('lead-capture-form');
if (leadForm) {
    leadForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const userWhatsApp = document.getElementById('whatsapp').value.trim();

        if (!name || !email || !userWhatsApp) {
            alert('Please fill out all fields before submitting.');
            return;
        }

        const iljaWhatsAppNumber = '996555099158';
        const message = `👋 Hello Ilja!

✨ *New Consultation Request from Biscotti_Miste* ✨
-----------------------------------------

My name is *${name}*, and I'm very interested in learning more about the investment opportunity.

Here are my contact details:
👤 *Name:* ${name}
📧 *Email:* ${email}
📱 *WhatsApp:* ${userWhatsApp}

I'm looking forward to my free consultation. Please let me know the next steps.

Thank you!`;
        const whatsappUrl = `https://wa.me/${iljaWhatsAppNumber}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
        leadForm.reset();
        alert('Thank you! We are redirecting you to WhatsApp to send your request.');
    });
}
