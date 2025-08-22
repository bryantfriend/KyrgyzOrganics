document.addEventListener('DOMContentLoaded', async function() {
    AOS.init({ duration: 800, once: true, offset: 50 });

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
    };

    document.querySelectorAll('[data-set-lang]').forEach(button => {
        button.addEventListener('click', () => {
            setLanguage(button.getAttribute('data-set-lang'));
        });
    });

    // --- ROI Calculator Logic ---
    const investmentInput = document.getElementById('investment');
    const investmentSlider = document.getElementById('investment-slider');
    const packsProducedEl = document.getElementById('packs-produced');
    const monthlyPacksEl = document.getElementById('monthly-packs');
    const annualProfitEl = document.getElementById('annual-profit');
    const costPerPack = 127;

    function calculateROI(investment) {
        const packsProduced = Math.floor(investment / costPerPack);
        const baseInvestment = 5000;
        const baseAnnualProfit = 1800;
        const calculatedAnnualProfit = (investment / baseInvestment) * baseAnnualProfit;
        const netProfitPerPack = 295 - costPerPack;
        const packsSoldPerYear = Math.ceil(calculatedAnnualProfit / netProfitPerPack);
        const monthlyPacksForROI = (packsSoldPerYear / 12).toFixed(1);

        packsProducedEl.textContent = packsProduced.toLocaleString();
        monthlyPacksEl.textContent = `~${monthlyPacksForROI}`;
        annualProfitEl.textContent = Math.round(calculatedAnnualProfit).toLocaleString();
        localStorage.setItem('biscottiInvestmentAmount', investment);
    }

    investmentInput.addEventListener('input', (e) => {
        const value = parseInt(e.target.value, 10) || 0;
        investmentSlider.value = value;
        calculateROI(value);
    });
    investmentSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value, 10);
        investmentInput.value = value;
        calculateROI(value);
    });

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
        const packs = packsProducedEl.textContent;
        const profit = annualProfitEl.textContent;
        const lang = currentLang;

        summaryContent.innerHTML = `
            <p><strong>${translations[lang].modal_summary_investment}</strong> 
            <span class="text-green-700 font-semibold">${parseInt(investment).toLocaleString()} som</span></p>
            <p><strong>${translations[lang].modal_summary_packs}</strong> 
            <span class="text-green-700 font-semibold">${packs}</span></p>
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
        let prompt = translations[currentLang].gemini_pitch_prompt;
        prompt = prompt.replace('{investment}', investment).replace('{profit}', profit);

        // Optional: hook to Gemini API
        // const pitch = await callGemini(prompt);
        const pitch = `Hey, I came across an interesting local investment: ${investment} som into Biscotti_Miste with a projected return of ${profit} som. What do you think?`;

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

    // --- Scroll Spy ---
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    const header = document.getElementById('header');
    let lastScrollTop = 0;
    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => { if (pageYOffset >= section.offsetTop - 100) current = section.getAttribute('id'); });
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href').includes(current)) link.classList.add('active');
        });
        let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        header.style.top = (scrollTop > lastScrollTop) ? '-100px' : '0';
        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
    });

    // --- Initial Load ---
    const savedInvestment = localStorage.getItem('biscottiInvestmentAmount');
    if (savedInvestment) {
        const initialInvestment = parseInt(savedInvestment, 10);
        investmentInput.value = initialInvestment;
        investmentSlider.value = initialInvestment;
    }
    calculateROI(investmentInput.value);
    setLanguage(currentLang);
});

// --- WhatsApp Form Submission Logic (Vibrant & Friendly Style) ---
const leadForm = document.getElementById('lead-capture-form');

if (leadForm) {
    leadForm.addEventListener('submit', function(event) {
        // 1. Prevent the form from submitting the traditional way
        event.preventDefault();

        // 2. Get the user's input from the form fields
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const userWhatsApp = document.getElementById('whatsapp').value.trim();

        // 3. Basic validation to ensure fields are not empty
        if (!name || !email || !userWhatsApp) {
            alert('Please fill out all fields before submitting.');
            return; // Stop the function if validation fails
        }

        // 4. Ilja's WhatsApp number
        const iljaWhatsAppNumber = '+996555099158';

        // 5. Create the new, formatted message
        // Note: The asterisks (*) will make the text bold in WhatsApp
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

        // 6. Create the WhatsApp click-to-chat URL
        const whatsappUrl = `https://wa.me/${iljaWhatsAppNumber}?text=${encodeURIComponent(message)}`;

        // 7. Open the URL in a new tab
        window.open(whatsappUrl, '_blank');

        // 8. Optional: Clear the form and show a success message
        leadForm.reset();
        alert('Thank you! We are redirecting you to WhatsApp to send your request.');
    });
}

