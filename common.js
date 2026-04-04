import { db } from './firebase-config.js';

// --- DOM SAFE HELPERS ---
export const $ = (id) => document.getElementById(id);
export const $$ = (sel) => document.querySelector(sel);
export const $$$ = (sel) => document.querySelectorAll(sel);

// --- STATE ---
export let currentLang = localStorage.getItem('site_lang') || 'ru'; // Default RU

// --- TRANSLATIONS (Static UI) ---
export const translations = {
    ru: { title: "Кыргыз Органик", home: "Главная", categories: "Категории", about: "О нас", contact: "Контакты", search: "Поиск продуктов...", all: "Все продукты", hits: "Хиты продаж 🔥", hit: "Хит", available_today: "В наличии сегодня", available_today_label: "Свежий запас", no_available_today: "Сегодня доступных товаров пока нет.", full_catalog: "Полный каталог", recommended: "С этим покупают", delivery_title: "Бесплатная доставка", delivery_text: "По Бишкеку и окрестностям", invest_title: "Инвестируйте в Бискотти", invest_text: "Поддержите местное производство и получайте доход.", learn_more: "Подробнее", ingredients: "Состав:", storage: "Хранение:", price_currency: "с", no_products_found: "Продукты не найдены.", quick_links: "Быстрые ссылки", admin_login: "Вход для админа", copyright: "© 2025 OA Kyrgyz Organic. Все права защищены.", address: "Бишкек, Кыргызстан", icon_local: "Местные продукты", icon_eco: "Эко сертификат", icon_seasonal: "Сезонные продукты", banner_title: "Доставка по Бишкеку и окрестностям", banner_sub: "Экологически чистые продукты у вас дома", deliv_ph: "Введите ваш адрес", check: "Проверить", footer_text: "Мы связываем вас с лучшими производителями органической продукции в Кыргызстане.", view_product_page: "Страница товара", copy_link: "Копировать ссылку", link_copied: "Ссылка скопирована", product_not_found: "Товар не найден.", back_to_catalog: "Назад в каталог", product_details: "Детали товара", stock_in: "В наличии", stock_out: "Нет в наличии", cart: "Корзина", cart_ready: "Готово к заказу", cart_items_count: "товаров", add_to_cart: "В корзину", buy_now: "Купить сейчас", remove: "Убрать", open_cart: "Открыть корзину", cart_empty: "Корзина пока пуста.", checkout: "Оформление заказа", quantity: "Количество", subtotal: "Сумма товаров", delivery_fee: "Доставка", total: "Итого", customer_name: "Имя", customer_phone: "Телефон", delivery_method: "Способ получения", delivery: "Доставка", pickup: "Самовывоз", delivery_address: "Адрес доставки", notes: "Комментарий", place_order: "Создать заказ", payment_receipt: "Загрузите чек оплаты", payment_instructions: "Оплатите по QR-коду и загрузите чек.", order_summary: "Сводка заказа", awaiting_payment: "Ожидает оплаты", payment_submitted: "Оплата отправлена. Мы проверим заказ.", free_delivery: "Бесплатно", checkout_name_required: "Введите имя.", checkout_phone_required: "Введите номер телефона.", checkout_address_required: "Введите адрес доставки.", added_to_cart: "Товар добавлен в корзину.", no_payment_methods: "Нет доступных способов оплаты.", order_items: "Состав заказа", invalid_quantity: "Некорректное количество" },
    en: { title: "Kyrgyz Organic", home: "Home", categories: "Categories", about: "About", contact: "Contact", search: "Search products...", all: "All Products", hits: "Top Sellers 🔥", hit: "Hit", available_today: "Available Today", available_today_label: "Fresh Stock", no_available_today: "No products are available today yet.", full_catalog: "Full Catalog", recommended: "Frequently Bought Together", delivery_title: "Free Delivery", delivery_text: "In Bishkek and nearby areas", invest_title: "Invest in Biscotti", invest_text: "Support local production and earn returns.", learn_more: "Learn More", ingredients: "Ingredients:", storage: "Storage:", price_currency: "KGS", no_products_found: "No products found.", quick_links: "Quick Links", admin_login: "Admin Login", copyright: "© 2025 OA Kyrgyz Organic. All rights reserved.", address: "Bishkek, Kyrgyzstan", icon_local: "Local Producers", icon_eco: "Eco Certified", icon_seasonal: "Seasonal", banner_title: "Delivery across Bishkek and nearby areas", banner_sub: "Eco-friendly local producers at your doorstep", deliv_ph: "Enter your address", check: "Check", footer_text: "Connecting you with the best organic producers in Kyrgyzstan.", view_product_page: "Product Page", copy_link: "Copy Link", link_copied: "Link copied", product_not_found: "Product not found.", back_to_catalog: "Back to Catalog", product_details: "Product Details", stock_in: "In stock", stock_out: "Sold out", cart: "Cart", cart_ready: "Ready to order", cart_items_count: "items", add_to_cart: "Add to Cart", buy_now: "Buy Now", remove: "Remove", open_cart: "Open Cart", cart_empty: "Your cart is empty.", checkout: "Checkout", quantity: "Quantity", subtotal: "Subtotal", delivery_fee: "Delivery Fee", total: "Total", customer_name: "Name", customer_phone: "Phone", delivery_method: "Fulfillment", delivery: "Delivery", pickup: "Pickup", delivery_address: "Delivery Address", notes: "Notes", place_order: "Create Order", payment_receipt: "Upload payment receipt", payment_instructions: "Pay with the QR code and upload your receipt.", order_summary: "Order Summary", awaiting_payment: "Awaiting payment", payment_submitted: "Payment submitted. We will verify your order.", free_delivery: "Free", checkout_name_required: "Please enter your name.", checkout_phone_required: "Please enter your phone number.", checkout_address_required: "Please enter a delivery address.", added_to_cart: "Added to cart.", no_payment_methods: "No payment methods available.", order_items: "Order Items", invalid_quantity: "Invalid quantity" },
    kg: { title: "Кыргыз Органик", home: "Башкы бет", categories: "Категориялар", about: "Биз жөнүндө", contact: "Байланыш", search: "Издөө...", all: "Бардык продуктылар", hits: "Эң көп сатылган 🔥", hit: "Хит", available_today: "Бүгүн бар товарлар", available_today_label: "Жаңы запас", no_available_today: "Бүгүн жеткиликтүү товарлар азырынча жок.", full_catalog: "Толук каталог", recommended: "Көбүнчө чогуу алышат", delivery_title: "Акысыз жеткирүү", delivery_text: "Бишкек жана айланасына", invest_title: "Бискоттиге инвестиция", invest_text: "Жергиликтүү өндүрүштү колдоп, киреше табыңыз.", learn_more: "Кененирээк", ingredients: "Курамы:", storage: "Сактоо:", price_currency: "сом", no_products_found: "Продуктылар табылган жок.", quick_links: "Шилтемелер", admin_login: "Админ кирүү", copyright: "© 2025 OA Kyrgyz Organic. Бардык укуктар корголгон.", address: "Бишкек, Кыргызстан", icon_local: "Жергиликтүү өндүрүүчүлөр", icon_eco: "Эко сертификат", icon_seasonal: "Мезгилдүү продуктылар", banner_title: "Бишкек жана айланасына жеткирүү", banner_sub: "Экологиялык таза продуктылар эшигиңизде", deliv_ph: "Дарегиңизди жазыңыз", check: "Текшерүү", footer_text: "Кыргызстандагы эң мыкты органикалык өндүрүүчүлөр менен байланыштырабыз.", view_product_page: "Товардын барагы", copy_link: "Шилтемени көчүрүү", link_copied: "Шилтеме көчүрүлдү", product_not_found: "Товар табылган жок.", back_to_catalog: "Каталогго кайтуу", product_details: "Товар тууралуу", stock_in: "Бар", stock_out: "Сатылып бүттү", cart: "Себет", cart_ready: "Буйрутмага даяр", cart_items_count: "товар", add_to_cart: "Себетке кошуу", buy_now: "Азыр сатып алуу", remove: "Өчүрүү", open_cart: "Себетти ачуу", cart_empty: "Себет азырынча бош.", checkout: "Буйрутма берүү", quantity: "Саны", subtotal: "Жыйынтык баа", delivery_fee: "Жеткирүү", total: "Жалпы", customer_name: "Аты", customer_phone: "Телефон", delivery_method: "Алуу жолу", delivery: "Жеткирүү", pickup: "Өзү алып кетүү", delivery_address: "Жеткирүү дареги", notes: "Эскертүү", place_order: "Буйрутма түзүү", payment_receipt: "Төлөмдүн чек сүрөтүн жүктөңүз", payment_instructions: "QR код менен төлөп, чекти жүктөңүз.", order_summary: "Буйрутма маалыматы", awaiting_payment: "Төлөм күтүлүүдө", payment_submitted: "Төлөм жөнөтүлдү. Буйрутмаңызды текшеребиз.", free_delivery: "Акысыз", checkout_name_required: "Атыңызды жазыңыз.", checkout_phone_required: "Телефон номериңизди жазыңыз.", checkout_address_required: "Жеткирүү дарегин жазыңыз.", added_to_cart: "Себетке кошулду.", no_payment_methods: "Төлөм ыкмалары жеткиликтүү эмес.", order_items: "Буйрутмадагы товарлар", invalid_quantity: "Туура эмес сан" }
};

// Helper: Get Localized String
export function t(key) {
    return translations[currentLang][key] || translations['ru'][key] || key;
}

// Helper: Get Localized Data Field
export function loc(item, field) {
    return item[`${field}_${currentLang}`] || item[`${field}_ru`] || item[field] || ''; // Fallback chain
}

export function setupLanguage() {
    // Nav Items translate
    if (document.getElementById('navHome')) document.getElementById('navHome').textContent = t('home');
    if (document.getElementById('navCategories')) document.getElementById('navCategories').textContent = t('categories') + ' ▾';
    if (document.getElementById('navAbout')) document.getElementById('navAbout').textContent = t('about');
    if (document.getElementById('navContact')) document.getElementById('navContact').textContent = t('contact');

    // Mobile nav
    if (document.getElementById('mobHome')) document.getElementById('mobHome').textContent = t('home');
    if (document.getElementById('mobCategories')) document.getElementById('mobCategories').textContent = t('categories');
    if (document.getElementById('mobAbout')) document.getElementById('mobAbout').textContent = t('about');
    if (document.getElementById('mobContact')) document.getElementById('mobContact').textContent = t('contact');

    // Footer
    if (document.getElementById('footQuickLinks')) document.getElementById('footQuickLinks').textContent = t('quick_links');
    if (document.getElementById('footContactsTitle')) document.getElementById('footContactsTitle').textContent = t('contact');
    if (document.getElementById('footLinkHome')) document.getElementById('footLinkHome').textContent = t('home');
    if (document.getElementById('footLinkAbout')) document.getElementById('footLinkAbout').textContent = t('about');
    if (document.getElementById('footLinkContact')) document.getElementById('footLinkContact').textContent = t('contact');
    if (document.getElementById('footAddress')) document.getElementById('footAddress').textContent = t('address');
    if (document.getElementById('footCopyright')) document.getElementById('footCopyright').textContent = t('copyright');
    if (document.getElementById('footAdmin')) document.getElementById('footAdmin').textContent = t('admin_login');
    if (document.getElementById('footAboutTitle')) document.getElementById('footAboutTitle').textContent = t('title');
    if (document.getElementById('footAboutText')) document.getElementById('footAboutText').textContent = t('footer_text');

    // Trust Icons
    if (document.getElementById('iconDelivery')) document.getElementById('iconDelivery').textContent = t('delivery_title');
    if (document.getElementById('iconLocal')) document.getElementById('iconLocal').textContent = t('icon_local');
    if (document.getElementById('iconEco')) document.getElementById('iconEco').textContent = t('icon_eco');
    if (document.getElementById('iconSeasonal')) document.getElementById('iconSeasonal').textContent = t('icon_seasonal');

    // Delivery Banner
    if (document.getElementById('bannerDelivTitle')) document.getElementById('bannerDelivTitle').textContent = t('banner_title');
    if (document.getElementById('bannerDelivSub')) document.getElementById('bannerDelivSub').textContent = t('banner_sub');
    if (document.getElementById('bannerDelivInput')) document.getElementById('bannerDelivInput').placeholder = t('deliv_ph');
    if (document.getElementById('bannerDelivBtn')) document.getElementById('bannerDelivBtn').textContent = t('check');

    // Update critical static text based on existing IDs
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.placeholder = t('search');
}

window.setLang = (lang) => {
    currentLang = lang;
    localStorage.setItem('site_lang', lang);
    location.reload();
};
window.changeLanguage = window.setLang; // Alias for HTML calls

export function initMobileMenu() {
    const hamburgerBtn = document.querySelector('.hamburger-btn');
    const mobileMenu = document.querySelector('.mobile-menu');
    const closeMenuBtn = document.querySelector('.close-menu');

    if (hamburgerBtn && mobileMenu && closeMenuBtn) {
        hamburgerBtn.addEventListener('click', () => {
            mobileMenu.classList.add('open');
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        });

        const closeMenu = () => {
            mobileMenu.classList.remove('open');
            document.body.style.overflow = '';
        }

        closeMenuBtn.addEventListener('click', closeMenu);

        // Close when clicking outside (on overlay if we added one, but here just simple close logic)
        // Or if clicking a link
        mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', closeMenu);
        });

        // Export closing function for external usage (like filter click)
        return closeMenu;
    }
    return () => { };
}
