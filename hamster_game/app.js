import { db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const CUSTOMER_COLLECTION = "individual_customers";
const SESSION_KEY = "hg_current_customer_id";
const GUEST_SESSION_KEY = "hg_guest_trial";
const SHARE_URL = "https://oako.kg/hamster_game/";
const APP_VERSION = "1.07";
const GUEST_SPINS = 5;
const TEST_INFINITE_SPINS = true;
const avatarOptions = {
  sizes: [
    { key: "tiny", label: "Кроха" },
    { key: "spry", label: "Шустрик" },
    { key: "plush", label: "Пухляш" }
  ],
  moods: [
    { key: "sunny", label: "Лучезарный" },
    { key: "cozy", label: "Уютный" },
    { key: "brave", label: "Смелый" },
    { key: "dreamy", label: "Мечтатель" }
  ],
  furTones: [
    { label: "Медовый", fur: "#d8a15d", belly: "#f7e4bb", ear: "#f1bf83", blush: "#efb48d", eye: "#372113" },
    { label: "Карамельный", fur: "#c98a4f", belly: "#f3d6a3", ear: "#eeb06f", blush: "#e09c74", eye: "#341f13" },
    { label: "Абрикосовый", fur: "#e4b06c", belly: "#fde7bf", ear: "#f7c688", blush: "#f0b395", eye: "#3d2415" },
    { label: "Какао", fur: "#a96d43", belly: "#e6c096", ear: "#ca8e63", blush: "#c68468", eye: "#27170f" },
    { label: "Сливочный", fur: "#ebd0a1", belly: "#fff1d5", ear: "#f7d9ae", blush: "#e8bca5", eye: "#493221" },
    { label: "Ночной", fur: "#5e4b45", belly: "#cab4aa", ear: "#8b6d64", blush: "#9a7168", eye: "#160f0d" }
  ],
  patterns: [
    "Гладкая шёрстка",
    "Белая маска",
    "Полоски на спинке",
    "Пятнышки",
    "Тёмная макушка",
    "Светлый носик"
  ],
  eyeStyles: [
    "Кнопки",
    "Овальные",
    "Сияющие",
    "Сонные",
    "Озорные",
    "Звёздочки"
  ],
  earStyles: [
    "Круглые",
    "Высокие",
    "Пушистые",
    "Короткие",
    "Широкие"
  ],
  hairStyles: [
    "Пушок",
    "Чубчик",
    "Завиток",
    "Два вихра",
    "Хохолок",
    "Гладкий лоб",
    "Пушистый лоб",
    "Полоска",
    "Макушка-облако",
    "Праздничный чуб"
  ],
  hairColors: ["#5b2f17", "#7b4726", "#a86736", "#d59a56", "#f0c988", "#6b7d34", "#3d6d53", "#8a5b8c", "#b84949", "#2b2b30"],
  glasses: [
    "Без очков",
    "Круглые",
    "Квадратные",
    "Золотые",
    "Большие",
    "Полурамка",
    "Солнечные",
    "Овальные",
    "Звёздные",
    "Яркие"
  ],
  hats: [
    "Без головного убора",
    "Калпак",
    "Кепка",
    "Панама",
    "Поварской колпак",
    "Венок",
    "Бант"
  ],
  outfits: [
    "Фартук пекаря",
    "Жилетка",
    "Шарф",
    "Комбинезон",
    "Праздничный жилет",
    "Свитер",
    "Фартук с листиком",
    "Лента чемпиона"
  ],
  accessories: [
    "Без аксессуара",
    "Ложка",
    "Семечко",
    "Колокольчик",
    "Бантик",
    "Колосок",
    "Медаль",
    "Мини-скалка"
  ],
  whiskers: [
    "Короткие",
    "Длинные",
    "Пушистые",
    "Волнистые",
    "Тонкие"
  ]
};

const seedMeta = {
  poppy: { name: "Маковые семена", short: "Мак", value: 1, icon: "🌑", art: "hg-seed-art--poppy" },
  sesame: { name: "Кунжутные семена", short: "Кунжут", value: 5, icon: "⚪", art: "hg-seed-art--sesame" },
  almond: { name: "Миндальные семена", short: "Миндаль", value: 50, icon: "🌰", art: "hg-seed-art--almond" },
  walnut: { name: "Грецкие орехи", short: "Грецкий орех", value: 1000, icon: "🥜", art: "hg-seed-art--walnut" }
};

const symbols = ["🍞", "🥐", "🍪", "🌾", "🥛", "🧀", "⭐", "🥜"];

const rewardRules = {
  "🍞": { two: { poppy: 5 }, three: { poppy: 25 } },
  "🥐": { two: { sesame: 1 }, three: { sesame: 3 } },
  "🍪": { two: { sesame: 1 }, three: { sesame: 5 } },
  "🌾": { two: { poppy: 10 }, three: { poppy: 75 } },
  "🥛": { two: { sesame: 1 }, three: { sesame: 2 } },
  "🧀": { two: { poppy: 10 }, three: { almond: 1 } },
  "⭐": { two: { almond: 1 }, three: { almond: 2 } },
  "🥜": { two: { poppy: 25 }, three: { walnut: 1 } }
};

const storeItems = [
  { name: "Хлеб", type: "product", cost: { poppy: 50 }, approval: false },
  { name: "Органический чай", type: "product", cost: { poppy: 20 }, approval: false },
  { name: "Скидка 5%", type: "discount", cost: { poppy: 100 }, approval: false },
  { name: "Скидка 10%", type: "discount", cost: { sesame: 1 }, approval: false },
  { name: "Бесплатная доставка", type: "delivery", cost: { sesame: 2 }, approval: false },
  { name: "Круассан", type: "product", cost: { sesame: 10 }, approval: false },
  { name: "Набор выпечки", type: "bundle", cost: { almond: 1 }, approval: true },
  { name: "Полный заказ", type: "order", cost: { walnut: 1 }, approval: true }
];

const taskMeta = {
  followInstagram: { title: "Подписаться на Instagram", rewardSpins: 1, action: "instagram" },
  shareGame: { title: "Поделиться игрой", rewardSpins: 1, action: "share" },
  visitWebsite: { title: "Посетить сайт OAKO", rewardSpins: 1, action: "site" },
  inviteFriend: { title: "Пригласить друга", rewardSpins: 2, action: "invite" },
  scanQr: { title: "Сканировать QR в магазине", rewardSpins: 2, action: "placeholder" },
  enterReceiptCode: { title: "Ввести код с чека", rewardSpins: 3, action: "receipt" }
};

const recentWins = [
  { icon: "🐹", text: "Алина из Бишкека выиграла 5 кунжутных семян", time: "5 мин назад" },
  { icon: "🥜", text: "Нурлан поймал грецкий орех!", time: "15 мин назад" },
  { icon: "⭐", text: "Мадина из Оша выиграла золотую звезду!", time: "32 мин назад" },
  { icon: "🍞", text: "Руслан обменял семена на свежий хлеб", time: "1 час назад" }
];

let state = {
  tab: "game",
  authTab: "login",
  headerMenuOpen: false,
  userId: localStorage.getItem(SESSION_KEY),
  user: null,
  avatarDraft: null,
  avatarPanel: "basics",
  guest: loadGuestTrial(),
  loading: true,
  busy: false,
  message: "",
  error: "",
  resultSymbols: ["🍞", "🌾", "🥛"],
  resultMessage: "Хомяк ждёт вашего первого вращения 🎰",
  spinning: false,
  toasts: []
};

const app = document.querySelector("#hgApp");

const navItems = [
  { key: "game", icon: "🎰", label: "Игра" },
  { key: "wallet", icon: "🌱", label: "Семена" },
  { key: "store", icon: "🛒", label: "Магазин" },
  { key: "tasks", icon: "✅", label: "Задания" },
  { key: "account", icon: "👤", label: "Аккаунт" }
];

init();

async function init() {
  try {
    await loadCurrentUser();
  } catch (error) {
    console.error(error);
    state.error = "Не удалось подключиться. Попробуйте позже.";
  } finally {
    state.loading = false;
    render();
  }
}

function render() {
  app.innerHTML = `
    <section class="hg-phone-shell">
      ${state.loading ? renderLoading() : renderShell()}
    </section>
    <div class="hg-toast-stack" id="hgToastStack">
      ${state.toasts.map((toast) => `<div class="hg-toast">${escapeHtml(toast.message)}</div>`).join("")}
    </div>
  `;
  bindEvents();
}

function renderLoading() {
  return `
    <div class="hg-loading">
      <img class="hg-loading-mascot" src="./assets/characters/hamster-chef-bust.svg" alt="">
      <p>Хомяк загружает игру...</p>
    </div>
  `;
}

function renderShell() {
  return `
    ${renderTopbar()}
    ${state.error ? `<div class="hg-card hg-error">${state.error}</div>` : ""}
    ${renderActiveScreen()}
    ${renderBottomNav()}
  `;
}

function renderTopbar() {
  const spins = getActiveSpins();
  const spinLabel = formatSpinCount(spins);
  const pillLabel = state.user ? `${spinLabel} вращ.` : `${spinLabel} вращ.`;
  const userLabel = state.user ? escapeHtml(state.user.username) : "Гость";
  const headerMenu = state.user
    ? `
      <div class="hg-header-menu ${state.headerMenuOpen ? "hg-open" : ""}" role="menu" aria-label="Меню игрока">
        <button class="hg-header-menu-item" data-tab="account" type="button" role="menuitem">Мой аккаунт</button>
        <button class="hg-header-menu-item" data-tab="wallet" type="button" role="menuitem">Мои семена</button>
        <button class="hg-header-menu-item" data-tab="store" type="button" role="menuitem">Магазин наград</button>
        <button class="hg-header-menu-item hg-header-menu-item--danger" data-action="logout" type="button" role="menuitem">Выйти</button>
      </div>
    `
    : `
      <div class="hg-header-menu ${state.headerMenuOpen ? "hg-open" : ""}" role="menu" aria-label="Меню гостя">
        <button class="hg-header-menu-item" data-tab="account" type="button" role="menuitem">Войти или создать аккаунт</button>
        <button class="hg-header-menu-item" data-tab="game" type="button" role="menuitem">Вернуться к игре</button>
      </div>
    `;
  const userAvatar = state.user
    ? `<img class="hg-user-avatar" src="${renderAvatarDataUrl(state.user.avatar)}" alt="Аватар игрока">`
    : `<span class="hg-user-avatar hg-user-avatar--guest" aria-hidden="true">👤</span>`;
  return `
    <header class="hg-topbar">
      <div class="hg-hero-panel">
        <div class="hg-hero-badges">
          <div class="hg-header-menu-wrap" data-header-menu>
            <button
              class="hg-user-pill ${state.user ? "" : "is-guest"} ${state.headerMenuOpen ? "hg-open" : ""}"
              data-action="toggle-header-menu"
              type="button"
              aria-haspopup="menu"
              aria-expanded="${state.headerMenuOpen ? "true" : "false"}"
            >${userAvatar}<span>${userLabel}</span></button>
            ${headerMenu}
          </div>
        </div>
        <div class="hg-hero-grid">
          <div class="hg-hero-mascot">
            <img class="hg-hero-hamster" src="./assets/characters/hamster-chef-main.webp" alt="Хомяк-повар">
          </div>
          <div class="hg-hero-copy">
            <p class="hg-brand-kicker"><span class="hg-brand-leaf" aria-hidden="true"></span><span>Kyrgyz<br>Organics</span></p>
            <h1 class="hg-title"><span class="hg-title-top">Счастливый</span><span class="hg-title-bottom">Хомяк</span></h1>
            <div class="hg-hero-meta">
              <span class="hg-version">v${APP_VERSION}</span>
              <span class="hg-pill hg-pill-spins" aria-label="Доступные вращения">${pillLabel}</span>
            </div>
          </div>
          <div class="hg-hero-sign">
            <div class="hg-hero-sign-inner">
              <strong>Добро пожаловать</strong>
              <span>в пекарню удачи!</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  `;
}

function renderActiveScreen() {
  if (!state.user && state.tab !== "game" && state.tab !== "account") {
    return renderLoggedOutPrompt();
  }
  if (state.tab === "wallet") return renderWallet();
  if (state.tab === "store") return renderStore();
  if (state.tab === "tasks") return renderTasks();
  if (state.tab === "account") return renderAccount();
  return renderGame();
}

function renderLoggedOutPrompt() {
  return `
    <section class="hg-screen">
      <div class="hg-card">
        <h2 class="hg-section-title">Хомяк вас ещё не знает</h2>
        <p class="hg-muted">Вы можете покрутить 5 раз как гость. Создайте аккаунт, чтобы сохранить свои семена и орехи.</p>
        <button class="hg-button" data-tab="account" type="button">Открыть аккаунт</button>
      </div>
    </section>
  `;
}

function renderGame() {
  const dailyAvailable = state.user && canClaimDailySpin();
  const spins = getActiveSpins();
  return `
    <section class="hg-screen">
      ${renderBalanceSummary()}
      ${state.user ? `
        <div class="hg-card hg-card-ribbon hg-daily-row">
          <div>
            <strong>Ежедневное вращение</strong>
            <div class="hg-muted">${dailyAvailable ? "Хомяк приготовил подарок на сегодня." : "Сегодняшний подарок уже получен."}</div>
          </div>
          <button class="hg-button hg-button-secondary" data-action="daily" ${dailyAvailable || state.busy ? "" : "disabled"} type="button">Получить</button>
        </div>
      ` : renderGuestNotice()}
      <div class="hg-slot-wrap ${state.spinning ? "hg-is-spinning" : ""}">
        <div id="hgConfetti"></div>
        <div class="hg-slot-glow" aria-hidden="true"></div>
        <img class="hg-slot-frame-art" src="./assets/machine/slot-machine-frame.svg" alt="">
        <div class="hg-slot-head">
          <div class="hg-slot-mascot">
            <img class="hg-hamster" src="./assets/characters/hamster-chef-bust.svg" alt="Хомяк-повар">
          </div>
          <div class="hg-slot-logo">
            <div class="hg-kicker">Пекарня удачи</div>
            <div class="hg-slot-logo-title">${state.spinning ? "Хомяк крутит барабаны..." : "Собирайте семена"}</div>
            <div class="hg-slot-logo-sub">и ловите орехи</div>
          </div>
          <img class="hg-wheel" src="./assets/characters/hamster-wheel.svg" alt="Колесо хомяка">
        </div>
        <div class="hg-reels-shell">
          <div class="hg-reels" aria-label="Игровые барабаны">
            ${state.resultSymbols.map((symbol) => `<div class="hg-reel ${state.spinning ? "hg-spinning" : ""}"><span class="hg-reel-symbol">${symbol}</span></div>`).join("")}
          </div>
        </div>
        <button class="hg-button hg-spin-button" data-action="spin" ${state.busy || !spins ? "disabled" : ""} type="button">
          <span class="hg-spin-lights" aria-hidden="true">
            ${Array.from({ length: 14 }, (_, index) => `<span class="hg-spin-bulb hg-spin-bulb--${index + 1}"></span>`).join("")}
          </span>
          <span class="hg-spin-label">${state.spinning ? "Хомяк крутит..." : "КРУТИТЬ!"}</span>
        </button>
      </div>
      <div class="hg-result ${state.resultMessage.includes("ДЖЕКПОТ") ? "hg-jackpot" : ""}">
        <div class="hg-result-text">${escapeHtml(state.resultMessage)}</div>
      </div>
      ${!state.user && !spins ? renderGuestFinishedCard() : ""}
      <div class="hg-card hg-card-hero">
        <div class="hg-row">
          <h2 class="hg-section-title">Свежие выигрыши</h2>
          <button class="hg-feed-link" type="button">Смотреть все</button>
        </div>
        <div class="hg-feed">
          ${recentWins.map((win) => `
            <div class="hg-feed-item">
              <span class="hg-feed-icon">${win.icon}</span>
              <span>${win.text}</span>
              <span class="hg-feed-time">${win.time}</span>
            </div>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderBalanceSummary() {
  const seeds = getActiveSeeds();
  const total = walletTotal(seeds);
  return `
    <div class="hg-card hg-card-hero hg-balance-shell">
      <div class="hg-balance-head">
        <div>
          <div class="hg-kicker hg-kicker-wallet">Ваш кошелёк семян</div>
          <h2 class="hg-section-title">Ваш кошелёк семян</h2>
        </div>
        <div class="hg-balance-badge"><span class="hg-balance-badge-icon ${seedMeta.sesame.art}" aria-hidden="true"></span>${total} сомов</div>
      </div>
      <div class="hg-balance-grid">
        ${Object.entries(seedMeta).map(([key, meta]) => `
          <div class="hg-seed-chip" data-seed="${key}">
            <span class="hg-seed-icon ${meta.art}" aria-hidden="true"></span>
            <span class="hg-seed-amount">${seeds[key] || 0}</span>
            <span class="hg-seed-label">${meta.short}</span>
            <span class="hg-seed-value">${meta.value} сом</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderGuestNotice() {
  if (hasInfiniteSpins()) {
    return `
      <div class="hg-card hg-card-ribbon hg-daily-row">
        <div>
          <strong>Тестовый режим</strong>
          <div class="hg-muted">Сейчас для проверки интерфейса и наград включены бесконечные вращения.</div>
        </div>
        <button class="hg-button hg-button-secondary" data-tab="account" type="button">Сохранить</button>
      </div>
    `;
  }
  const used = GUEST_SPINS - getActiveSpins();
  return `
    <div class="hg-card hg-card-ribbon hg-daily-row">
      <div>
        <strong>Пробная игра</strong>
        <div class="hg-muted">У вас есть 5 гостевых вращений. Использовано: ${used} из ${GUEST_SPINS}.</div>
      </div>
      <button class="hg-button hg-button-secondary" data-tab="account" type="button">Сохранить</button>
    </div>
  `;
}

function renderGuestFinishedCard() {
  return `
    <div class="hg-card hg-guest-finished">
      <h2 class="hg-section-title">Пробные вращения закончились</h2>
      <p class="hg-muted">Создайте аккаунт, чтобы хомяк сохранил ваши семена и орехи 🥜</p>
      <button class="hg-button" data-tab="account" type="button">Создать аккаунт</button>
    </div>
  `;
}

function renderWallet() {
  const seeds = getActiveSeeds();
  const total = walletTotal(seeds);
  return `
    <section class="hg-screen">
      <div class="hg-card hg-card-hero">
        <h2 class="hg-section-title">Мои семена</h2>
        <p class="hg-muted">Собирайте семена в игре и меняйте их на бонусы Kyrgyz Organics.</p>
      </div>
      <div class="hg-card hg-wallet-total">
        <span>Общая ценность:</span>
        <span>${total} сом</span>
      </div>
      <div class="hg-wallet-grid">
        ${Object.entries(seedMeta).map(([key, meta]) => {
          const amount = seeds[key] || 0;
          return `
            <article class="hg-wallet-card">
              <div class="hg-row">
                <h2 class="hg-item-name"><span class="hg-seed-inline ${meta.art}" aria-hidden="true"></span>${meta.name}</h2>
                <strong>${amount}</strong>
              </div>
              <div class="hg-muted">Ценность: ${meta.value} сом за 1 шт.</div>
              <div class="hg-cost">Итого: ${amount * meta.value} сом</div>
            </article>
          `;
        }).join("")}
      </div>
      <div class="hg-card hg-muted">Семена можно обменять только на бонусы Kyrgyz Organics. Это игровая ценность, не деньги для вывода.</div>
    </section>
  `;
}

function renderStore() {
  const rewards = state.user?.rewards || [];
  return `
    <section class="hg-screen">
      <div class="hg-card hg-card-hero">
        <h2 class="hg-section-title">Магазин наград</h2>
        <p class="hg-muted">Маленькие награды активируются сразу. Большие награды ждут подтверждения.</p>
      </div>
      <div class="hg-store-grid">
        ${storeItems.map((item, index) => `
          <article class="hg-store-item">
            <div class="hg-row">
              <h3 class="hg-item-name">${item.name}</h3>
              <span class="hg-cost">${formatCost(item.cost)}</span>
            </div>
            <div class="hg-muted">${item.approval ? "Требуется подтверждение" : "Можно использовать сразу"}</div>
            <button class="hg-button" data-action="redeem" data-index="${index}" ${state.busy ? "disabled" : ""} type="button">Обменять</button>
          </article>
        `).join("")}
      </div>
      <div class="hg-card">
        <h2 class="hg-section-title">Мои награды</h2>
        <div class="hg-reward-list">
          ${rewards.length ? rewards.slice().reverse().map(renderReward).join("") : `<div class="hg-empty">Пока нет наград. Хомяк уже присматривает что-нибудь вкусное.</div>`}
        </div>
      </div>
    </section>
  `;
}

function renderReward(reward) {
  const statusText = reward.status === "pending_approval" ? "На проверке" : reward.status === "used" ? "Использована" : "Активна";
  return `
    <article class="hg-reward-item">
      <div class="hg-row">
        <strong>${escapeHtml(reward.rewardName)}</strong>
        <span class="hg-status">${statusText}</span>
      </div>
      <div class="hg-muted">Стоимость: ${formatCost(reward.cost)}</div>
    </article>
  `;
}

function renderTasks() {
  return `
    <section class="hg-screen">
      <div class="hg-card hg-card-hero">
        <h2 class="hg-section-title">Задания хомяка</h2>
        <p class="hg-muted">Выполняйте задания и получайте дополнительные вращения.</p>
      </div>
      <div class="hg-task-grid">
        ${Object.entries(taskMeta).map(([key, task]) => {
          const userTask = state.user.tasks?.[key] || { completed: false, rewardSpins: task.rewardSpins };
          return `
            <article class="hg-task-item">
              <div class="hg-row">
                <h3 class="hg-item-name">${task.title}</h3>
                <span class="hg-cost">+${userTask.rewardSpins || task.rewardSpins} 🎰</span>
              </div>
              ${task.action === "receipt" && !userTask.completed ? `
                <label class="hg-field">
                  <span class="hg-label">Код с чека</span>
                  <input class="hg-input" data-receipt-code="${key}" inputmode="text" placeholder="Например, OAKO123">
                </label>
              ` : ""}
              <button class="hg-button" data-action="task" data-task="${key}" ${state.busy || userTask.completed ? "disabled" : ""} type="button">
                ${userTask.completed ? "Выполнено" : "Получить вращения"}
              </button>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderAccount() {
  if (!state.user) return renderAuthForms();
  const user = state.user;
  const avatar = state.avatarDraft || user.avatar || defaultAvatar();
  return `
    <section class="hg-screen">
      <div class="hg-card hg-card-hero">
        <h2 class="hg-section-title">Аккаунт</h2>
        <div class="hg-row">
          <strong>${escapeHtml(user.username)}</strong>
          <span class="hg-status">Категория: Бесплатный</span>
        </div>
        <p class="hg-muted">Premium появится позже.</p>
      </div>
      <div class="hg-card hg-card-wood">
        <div class="hg-row">
          <div>
            <h2 class="hg-section-title">Хомяк-аватар</h2>
            <p class="hg-muted">Соберите своего фирменного хомяка: шёрстка, наряд, ушки, усы и маленькие детали.</p>
          </div>
          <button class="hg-button hg-button-secondary" data-action="avatar-reset" type="button">Сбросить</button>
        </div>
        <div class="hg-avatar-builder">
          <div class="hg-avatar-stage">
            <div class="hg-avatar-frame">
              <img class="hg-avatar-preview" src="${renderAvatarDataUrl(avatar)}" alt="Предпросмотр аватара">
            </div>
            <div class="hg-avatar-meta">
              <span class="hg-status">Размер: ${avatarLabel(avatarOptions.sizes, avatar.size)}</span>
              <span class="hg-status">Наряд: ${avatarOptions.outfits[avatar.outfit]}</span>
            </div>
          </div>
          <div class="hg-avatar-controls">
            <div class="hg-avatar-panel-tabs">
              ${renderAvatarPanelTab("basics", "Основа")}
              ${renderAvatarPanelTab("fur", "Шёрстка")}
              ${renderAvatarPanelTab("face", "Мордочка")}
              ${renderAvatarPanelTab("style", "Стиль")}
              ${renderAvatarPanelTab("extras", "Детали")}
            </div>
            ${renderAvatarPanelContent(avatar)}
          </div>
        </div>
        <button class="hg-button" data-action="avatar-save" ${state.busy ? "disabled" : ""} type="button">Сохранить хомяка</button>
      </div>
      <div class="hg-account-stat-grid">
        <div class="hg-stat">Вращения<span class="hg-stat-value">${formatSpinCount(getActiveSpins())}</span></div>
        <div class="hg-stat">Всего игр<span class="hg-stat-value">${user.stats?.totalSpins || 0}</span></div>
        <div class="hg-stat">Победы<span class="hg-stat-value">${user.stats?.totalWins || 0}</span></div>
        <div class="hg-stat">Лучший приз<span class="hg-stat-value">${escapeHtml(user.stats?.biggestWin || "—")}</span></div>
      </div>
      <button class="hg-button hg-button-secondary" data-action="logout" type="button">Выйти</button>
    </section>
  `;
}

function renderAuthForms() {
  const guestTotal = walletTotal(state.guest.seeds || defaultSeeds());
  return `
    <section class="hg-screen">
      <div class="hg-card hg-card-hero">
        <div class="hg-tabs" role="tablist" aria-label="Аккаунт">
          <button class="hg-tab-button ${state.authTab === "login" ? "hg-active" : ""}" data-auth-tab="login" type="button">Войти</button>
          <button class="hg-tab-button ${state.authTab === "register" ? "hg-active" : ""}" data-auth-tab="register" type="button">Регистрация</button>
        </div>
      </div>
      <div class="hg-card hg-card-wood">
        <h2 class="hg-section-title">${state.authTab === "login" ? "Войти" : "Создать аккаунт"}</h2>
        ${guestTotal ? `<p class="hg-success">Создайте аккаунт, и хомяк сохранит ваши пробные семена на ${guestTotal} сом.</p>` : ""}
        ${state.message ? `<p class="hg-success">${state.message}</p>` : ""}
        ${state.error ? `<p class="hg-error">${state.error}</p>` : ""}
        <form class="hg-form" data-form="${state.authTab}">
          <label class="hg-field">
            <span class="hg-label">Имя пользователя</span>
            <input class="hg-input" name="username" autocomplete="username" required minlength="3" maxlength="20" pattern="[A-Za-zА-Яа-яЁё0-9_]{3,20}">
          </label>
          <label class="hg-field">
            <span class="hg-label">PIN-код</span>
            <input class="hg-input" name="pin" type="password" inputmode="numeric" autocomplete="current-password" required pattern="[0-9]{4}" maxlength="4">
          </label>
          ${state.authTab === "register" ? `
            <label class="hg-field">
              <span class="hg-label">Повторите PIN-код</span>
              <input class="hg-input" name="confirmPin" type="password" inputmode="numeric" autocomplete="new-password" required pattern="[0-9]{4}" maxlength="4">
            </label>
          ` : ""}
          <button class="hg-button" ${state.busy ? "disabled" : ""} type="submit">${state.authTab === "login" ? "Войти" : "Создать аккаунт"}</button>
        </form>
      </div>
    </section>
  `;
}

function renderBottomNav() {
  const pendingTasks = Boolean(state.user && Object.values(state.user.tasks || {}).some((task) => !task.completed));
  return `
    <nav class="hg-bottom-nav" aria-label="Главная навигация">
      ${navItems.map((item) => `
        <button class="hg-nav-button ${state.tab === item.key ? "hg-active" : ""}" data-tab="${item.key}" type="button">
          <span class="hg-nav-icon">${item.icon}${item.key === "tasks" && pendingTasks ? '<span class="hg-nav-dot"></span>' : ""}</span>
          <span>${item.label}</span>
        </button>
      `).join("")}
    </nav>
  `;
}

function renderAvatarSegment(title, field, options, selected) {
  return `
    <div class="hg-avatar-group">
      <div class="hg-avatar-title">${title}</div>
      <div class="hg-avatar-segment">
        ${options.map((option) => `
          <button
            class="hg-avatar-chip ${selected === option.key ? "hg-active" : ""}"
            data-action="avatar-set"
            data-field="${field}"
            data-value="${option.key}"
            type="button"
          >${option.label}</button>
        `).join("")}
      </div>
    </div>
  `;
}

function renderAvatarNumberOptions(title, field, options, selected) {
  return `
    <div class="hg-avatar-group">
      <div class="hg-avatar-title">${title}</div>
      <div class="hg-avatar-option-grid">
        ${options.map((label, index) => `
          <button
            class="hg-avatar-option ${selected === index ? "hg-active" : ""}"
            data-action="avatar-set"
            data-field="${field}"
            data-value="${index}"
            type="button"
          >${label}</button>
        `).join("")}
      </div>
    </div>
  `;
}

function renderAvatarColorOptions(title, selected) {
  return `
    <div class="hg-avatar-group">
      <div class="hg-avatar-title">${title}</div>
      <div class="hg-avatar-colors">
        ${avatarOptions.hairColors.map((color) => `
          <button
            class="hg-avatar-color ${selected === color ? "hg-active" : ""}"
            data-action="avatar-color"
            data-color="${color}"
            type="button"
            aria-label="${title}"
            style="--hg-avatar-swatch:${color};"
          ></button>
        `).join("")}
      </div>
    </div>
  `;
}

function renderAvatarToggle(title, field, enabled) {
  return `
    <div class="hg-avatar-group">
      <div class="hg-avatar-title">${title}</div>
      <button class="hg-avatar-toggle ${enabled ? "hg-active" : ""}" data-action="avatar-toggle" data-field="${field}" type="button">
        ${enabled ? "Включено" : "Выключено"}
      </button>
    </div>
  `;
}

function renderAvatarPanelTab(key, label) {
  return `
    <button
      class="hg-avatar-panel-tab ${state.avatarPanel === key ? "hg-active" : ""}"
      data-action="avatar-panel"
      data-panel="${key}"
      type="button"
    >${label}</button>
  `;
}

function renderAvatarPanelContent(avatar) {
  if (state.avatarPanel === "fur") {
    return `
      ${renderAvatarNumberOptions("Оттенок шёрстки", "furTone", avatarOptions.furTones.map((item) => item.label), avatar.furTone)}
      ${renderAvatarNumberOptions("Узор", "pattern", avatarOptions.patterns, avatar.pattern)}
      ${renderAvatarColorOptions("Акцент", avatar.hairColor)}
    `;
  }
  if (state.avatarPanel === "face") {
    return `
      ${renderAvatarNumberOptions("Глаза", "eyeStyle", avatarOptions.eyeStyles, avatar.eyeStyle)}
      ${renderAvatarNumberOptions("Ушки", "earStyle", avatarOptions.earStyles, avatar.earStyle)}
      ${renderAvatarNumberOptions("Усы", "whiskers", avatarOptions.whiskers, avatar.whiskers)}
      ${renderAvatarToggle("Пухлые щёчки", "beard", avatar.beard)}
    `;
  }
  if (state.avatarPanel === "style") {
    return `
      ${renderAvatarNumberOptions("Чубчик", "hairStyle", avatarOptions.hairStyles, avatar.hairStyle)}
      ${renderAvatarNumberOptions("Наряд", "outfit", avatarOptions.outfits, avatar.outfit)}
      ${renderAvatarNumberOptions("Очки", "glasses", avatarOptions.glasses, avatar.glasses)}
    `;
  }
  if (state.avatarPanel === "extras") {
    return `
      ${renderAvatarNumberOptions("Головной убор", "hat", avatarOptions.hats, avatar.hat)}
      ${renderAvatarNumberOptions("Аксессуар", "accessory", avatarOptions.accessories, avatar.accessory)}
    `;
  }
  return `
    ${renderAvatarSegment("Размер", "size", avatarOptions.sizes, avatar.size)}
    ${renderAvatarSegment("Характер", "mood", avatarOptions.moods, avatar.mood)}
  `;
}

function bindEvents() {
  const shell = app.querySelector(".hg-phone-shell");
  if (shell) {
    shell.addEventListener("click", (event) => {
      if (!state.headerMenuOpen) return;
      if (event.target.closest("[data-header-menu]")) return;
      state.headerMenuOpen = false;
      render();
    });
  }
  app.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.tab;
      state.headerMenuOpen = false;
      state.error = "";
      state.message = "";
      render();
    });
  });
  app.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.authTab = button.dataset.authTab;
      state.headerMenuOpen = false;
      state.error = "";
      state.message = "";
      render();
    });
  });
  app.querySelectorAll("[data-form]").forEach((form) => {
    form.addEventListener("submit", onAuthSubmit);
  });
  app.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleAction(button));
  });
}

async function handleAction(button) {
  const action = button.dataset.action;
  if (action === "toggle-header-menu") return toggleHeaderMenu();
  if (action === "spin") return spin();
  if (action === "daily") return claimDailySpin();
  if (action === "logout") return logout();
  if (action === "redeem") return redeemReward(Number(button.dataset.index));
  if (action === "task") return claimTask(button.dataset.task);
  if (action === "avatar-set") return setAvatarOption(button.dataset.field, button.dataset.value);
  if (action === "avatar-color") return setAvatarColor(button.dataset.color);
  if (action === "avatar-toggle") return toggleAvatarBoolean(button.dataset.field);
  if (action === "avatar-panel") return setAvatarPanel(button.dataset.panel);
  if (action === "avatar-save") return saveAvatar();
  if (action === "avatar-reset") return resetAvatarDraft();
}

async function onAuthSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const username = form.username.value;
  const pin = form.pin.value;
  const confirmPin = form.confirmPin?.value;
  if (form.dataset.form === "register") {
    await registerUser(username, pin, confirmPin);
  } else {
    await loginUser(username, pin);
  }
}

async function registerUser(username, pin, confirmPin) {
  const usernameIndex = normalizeUsername(username);
  const validation = validateCredentials(usernameIndex, pin, confirmPin, true);
  if (validation) return showError(validation);
  await withBusy(async () => {
    const existing = await getUserByUsername(usernameIndex);
    if (existing) throw new Error("Это имя уже занято. Попробуйте другое.");
    const userRef = doc(collection(db, CUSTOMER_COLLECTION));
    const pinHash = await hashPin(usernameIndex, pin);
    const guestSeeds = state.guest?.seeds || defaultSeeds();
    const guestStats = state.guest?.stats || defaultGuestStats();
    await setDoc(userRef, {
      username: username.trim(),
      usernameIndex,
      pinHash,
      category: "free",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      seeds: { ...defaultSeeds(), ...guestSeeds },
      spins: {
        available: 5,
        dailyFreeUsedDate: null,
        totalEarnedFromTasks: 0
      },
      stats: {
        totalSpins: guestStats.totalSpins || 0,
        totalWins: guestStats.totalWins || 0,
        biggestWin: guestStats.biggestWin || "",
        lastSpinAt: null
      },
      avatar: defaultAvatar(),
      rewards: [],
      tasks: defaultTasks()
    });
    localStorage.setItem(SESSION_KEY, userRef.id);
    clearGuestTrial();
    state.userId = userRef.id;
    await loadCurrentUser();
    state.tab = "game";
    showToast("Добро пожаловать! Хомяк сохранил ваши семена и дарит 5 вращений 🎰");
  });
}

async function loginUser(username, pin) {
  const usernameIndex = normalizeUsername(username);
  if (!usernameIndex || !/^\d{4}$/.test(pin)) return showError("Неверное имя или PIN-код.");
  await withBusy(async () => {
    const found = await getUserByUsername(usernameIndex);
    if (!found) throw new Error("Неверное имя или PIN-код.");
    const pinHash = await hashPin(usernameIndex, pin);
    if (pinHash !== found.data.pinHash) throw new Error("Неверное имя или PIN-код.");
    localStorage.setItem(SESSION_KEY, found.id);
    state.userId = found.id;
    state.user = found.data;
    state.tab = "game";
    showToast("С возвращением! Хомяк уже у барабанов 🎰");
  });
}

async function loadCurrentUser() {
  if (!state.userId) {
    state.user = null;
    state.avatarDraft = null;
    return;
  }
  const ref = doc(db, CUSTOMER_COLLECTION, state.userId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    localStorage.removeItem(SESSION_KEY);
    state.userId = null;
    state.user = null;
    state.avatarDraft = null;
    return;
  }
  state.user = normalizeUser(snapshot.data());
  state.avatarDraft = { ...state.user.avatar };
}

async function saveUserData(partial) {
  if (!state.userId) return;
  await updateDoc(doc(db, CUSTOMER_COLLECTION, state.userId), {
    ...partial,
    updatedAt: serverTimestamp()
  });
  await loadCurrentUser();
}

async function claimDailySpin() {
  if (!state.user || !canClaimDailySpin()) return;
  const today = todayKey();
  const spins = {
    ...state.user.spins,
    available: (state.user.spins?.available || 0) + 1,
    dailyFreeUsedDate: today
  };
  await withBusy(async () => {
    await saveUserData({ spins });
    showToast("Хомяк приготовил ваше ежедневное вращение 🎰");
  });
}

async function spin() {
  const spins = getActiveSpins();
  if (spins < 1) {
    const message = state.user
      ? "У вас закончились вращения. Выполните задание или приходите завтра!"
      : "Пробные вращения закончились. Создайте аккаунт, чтобы сохранить свои семена и орехи 🥜";
    state.resultMessage = message;
    render();
    return showToast(message);
  }
  state.busy = true;
  state.spinning = true;
  state.resultMessage = "Хомяк крутит барабаны...";
  decrementActiveSpin();
  render();
  const ticker = window.setInterval(() => {
    state.resultSymbols = randomSymbols();
    app.querySelectorAll(".hg-reel-symbol").forEach((node, index) => {
      node.textContent = state.resultSymbols[index];
    });
  }, 120);
  await wait(1650);
  window.clearInterval(ticker);
  const finalSymbols = randomSymbols();
  const reward = calculateReward(finalSymbols);
  try {
    if (state.user) {
      const updatedSeeds = addSeeds(state.user.seeds, reward.reward);
      const remainingSpins = hasInfiniteSpins()
        ? (state.user.spins?.available || 0)
        : Math.max((state.user.spins?.available || 0), 0);
      const totalWins = (state.user.stats?.totalWins || 0) + (reward.isWin ? 1 : 0);
      const stats = {
        ...state.user.stats,
        totalSpins: (state.user.stats?.totalSpins || 0) + 1,
        totalWins,
        biggestWin: chooseBiggestWin(state.user.stats?.biggestWin || "", reward),
        lastSpinAt: new Date().toISOString()
      };
      await saveUserData({
        seeds: updatedSeeds,
        spins: { ...state.user.spins, available: remainingSpins },
        stats
      });
    } else {
      applyGuestReward(reward);
    }
    state.resultSymbols = finalSymbols;
    state.resultMessage = !state.user && !hasInfiniteSpins() && getActiveSpins() < 1
      ? `${reward.message} Создайте аккаунт, чтобы сохранить свои семена и орехи 🥜`
      : reward.message;
    state.spinning = false;
    state.busy = false;
    render();
    bumpSeeds(Object.keys(reward.reward));
    if (reward.isWin) burstConfetti();
    showToast(reward.message);
  } catch (error) {
    console.error(error);
    state.spinning = false;
    state.busy = false;
    showError("Не удалось подключиться. Попробуйте позже.");
  }
}

async function redeemReward(index) {
  const item = storeItems[index];
  if (!item) return;
  if (!hasCost(state.user.seeds, item.cost)) {
    return showToast("Недостаточно семян. Хомяк советует покрутить ещё 🎰");
  }
  await withBusy(async () => {
    const reward = {
      id: `reward_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      rewardName: item.name,
      rewardType: item.type,
      cost: item.cost,
      status: item.approval ? "pending_approval" : "active",
      requiresApproval: item.approval,
      createdAt: new Date().toISOString(),
      usedAt: null,
      approvedAt: null
    };
    await saveUserData({
      seeds: subtractSeeds(state.user.seeds, item.cost),
      rewards: [...(state.user.rewards || []), reward]
    });
    showToast(item.approval ? "Заявка отправлена! Мы проверим награду и подтвердим её." : "Награда готова! Покажите её сотруднику Kyrgyz Organics.");
  });
}

async function claimTask(taskKey) {
  const task = taskMeta[taskKey];
  const current = state.user.tasks?.[taskKey];
  if (!task || current?.completed) return;
  if (task.action === "instagram") window.open("https://www.instagram.com/", "_blank", "noopener");
  if (task.action === "site") window.open("https://oako.kg", "_blank", "noopener");
  if (task.action === "share") await shareGame();
  if (task.action === "invite") await copyText(`Поиграйте со мной в Счастливого хомяка Kyrgyz Organics: ${SHARE_URL}`);
  if (task.action === "placeholder") showToast("QR-сканер появится позже. В V1 хомяк засчитывает задание вручную.");
  if (task.action === "receipt") {
    const input = app.querySelector(`[data-receipt-code="${taskKey}"]`);
    if (!input?.value.trim()) return showToast("Введите код с чека, чтобы хомяк засчитал задание.");
  }
  await withBusy(async () => {
    const rewardSpins = current?.rewardSpins || task.rewardSpins;
    const tasks = {
      ...state.user.tasks,
      [taskKey]: { ...current, rewardSpins, completed: true }
    };
    const spins = {
      ...state.user.spins,
      available: (state.user.spins?.available || 0) + rewardSpins,
      totalEarnedFromTasks: (state.user.spins?.totalEarnedFromTasks || 0) + rewardSpins
    };
    await saveUserData({ tasks, spins });
    showToast("Задание выполнено! Хомяк добавил вращения 🎰");
  });
}

function setAvatarOption(field, rawValue) {
  if (!state.avatarDraft) return;
  const value = ["furTone", "pattern", "eyeStyle", "earStyle", "hairStyle", "glasses", "hat", "outfit", "accessory", "whiskers"].includes(field)
    ? Number(rawValue)
    : rawValue;
  state.avatarDraft = normalizeAvatar({
    ...state.avatarDraft,
    [field]: value
  });
  render();
}

function setAvatarPanel(panel) {
  state.avatarPanel = panel || "basics";
  render();
}

function setAvatarColor(color) {
  if (!state.avatarDraft) return;
  state.avatarDraft = normalizeAvatar({
    ...state.avatarDraft,
    hairColor: color
  });
  render();
}

function toggleAvatarBoolean(field) {
  if (!state.avatarDraft) return;
  state.avatarDraft = normalizeAvatar({
    ...state.avatarDraft,
    [field]: !state.avatarDraft[field]
  });
  render();
}

function resetAvatarDraft() {
  if (!state.user) return;
  state.avatarDraft = { ...state.user.avatar };
  render();
}

async function saveAvatar() {
  if (!state.user || !state.avatarDraft) return;
  const avatar = normalizeAvatar(state.avatarDraft);
  await withBusy(async () => {
    await saveUserData({ avatar });
    state.avatarDraft = { ...avatar };
    showToast("Аватар сохранён. Хомяк одобряет новый стиль.");
  });
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  state.userId = null;
  state.user = null;
  state.avatarDraft = null;
  state.headerMenuOpen = false;
  state.tab = "account";
  state.message = "";
  state.error = "";
  render();
}

function toggleHeaderMenu() {
  state.headerMenuOpen = !state.headerMenuOpen;
  render();
}

async function getUserByUsername(usernameIndex) {
  const q = query(collection(db, CUSTOMER_COLLECTION), where("usernameIndex", "==", usernameIndex));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const first = snapshot.docs[0];
  return { id: first.id, data: normalizeUser(first.data()) };
}

function normalizeUser(user) {
  return {
    ...user,
    seeds: { ...defaultSeeds(), ...(user.seeds || {}) },
    spins: {
      available: 0,
      dailyFreeUsedDate: null,
      totalEarnedFromTasks: 0,
      ...(user.spins || {})
    },
    stats: {
      totalSpins: 0,
      totalWins: 0,
      biggestWin: "",
      lastSpinAt: null,
      ...(user.stats || {})
    },
    avatar: normalizeAvatar(user.avatar),
    rewards: user.rewards || [],
    tasks: { ...defaultTasks(), ...(user.tasks || {}) }
  };
}

function defaultAvatar() {
  return {
    size: "spry",
    mood: "sunny",
    furTone: 1,
    pattern: 1,
    eyeStyle: 2,
    earStyle: 0,
    hairStyle: 4,
    hairColor: "#5b2f17",
    beard: false,
    glasses: 0,
    hat: 4,
    outfit: 0,
    accessory: 0,
    whiskers: 1
  };
}

function normalizeAvatar(avatar) {
  const base = defaultAvatar();
  const legacySize = avatar?.age === "kid" ? "tiny" : avatar?.age === "teen" ? "spry" : avatar?.age === "adult" ? "plush" : base.size;
  const legacyMood = avatar?.gender === "male" ? "brave" : avatar?.gender === "female" ? "sunny" : base.mood;
  return {
    size: avatarOptions.sizes.some((item) => item.key === avatar?.size) ? avatar.size : legacySize,
    mood: avatarOptions.moods.some((item) => item.key === avatar?.mood) ? avatar.mood : legacyMood,
    furTone: Number.isInteger(avatar?.furTone) && avatar.furTone >= 0 && avatar.furTone < avatarOptions.furTones.length ? avatar.furTone : (Number.isInteger(avatar?.face) ? avatar.face % avatarOptions.furTones.length : base.furTone),
    pattern: Number.isInteger(avatar?.pattern) && avatar.pattern >= 0 && avatar.pattern < avatarOptions.patterns.length ? avatar.pattern : (Number.isInteger(avatar?.face) ? avatar.face % avatarOptions.patterns.length : base.pattern),
    eyeStyle: Number.isInteger(avatar?.eyeStyle) && avatar.eyeStyle >= 0 && avatar.eyeStyle < avatarOptions.eyeStyles.length ? avatar.eyeStyle : base.eyeStyle,
    earStyle: Number.isInteger(avatar?.earStyle) && avatar.earStyle >= 0 && avatar.earStyle < avatarOptions.earStyles.length ? avatar.earStyle : base.earStyle,
    hairStyle: Number.isInteger(avatar?.hairStyle) && avatar.hairStyle >= 0 && avatar.hairStyle < avatarOptions.hairStyles.length ? avatar.hairStyle : base.hairStyle,
    hairColor: avatarOptions.hairColors.includes(avatar?.hairColor) ? avatar.hairColor : base.hairColor,
    beard: Boolean(avatar?.beard),
    glasses: Number.isInteger(avatar?.glasses) && avatar.glasses >= 0 && avatar.glasses < avatarOptions.glasses.length ? avatar.glasses : base.glasses,
    hat: Number.isInteger(avatar?.hat) && avatar.hat >= 0 && avatar.hat < avatarOptions.hats.length ? avatar.hat : base.hat,
    outfit: Number.isInteger(avatar?.outfit) && avatar.outfit >= 0 && avatar.outfit < avatarOptions.outfits.length ? avatar.outfit : base.outfit,
    accessory: Number.isInteger(avatar?.accessory) && avatar.accessory >= 0 && avatar.accessory < avatarOptions.accessories.length ? avatar.accessory : base.accessory,
    whiskers: Number.isInteger(avatar?.whiskers) && avatar.whiskers >= 0 && avatar.whiskers < avatarOptions.whiskers.length ? avatar.whiskers : base.whiskers
  };
}

function avatarLabel(options, value) {
  return options.find((item) => item.key === value)?.label || "";
}

function hamsterPalette(index) {
  return avatarOptions.furTones[index] || avatarOptions.furTones[0];
}

function renderAvatarDataUrl(avatar) {
  const palette = hamsterPalette(avatar.furTone);
  const accent = avatar.hairColor;
  const scale = avatar.size === "tiny" ? 0.9 : avatar.size === "plush" ? 1.05 : 0.98;
  const headWidth = avatar.size === "tiny" ? 70 : avatar.size === "plush" ? 82 : 76;
  const bodyWidth = avatar.size === "tiny" ? 78 : avatar.size === "plush" ? 96 : 86;
  const eyeMarkup = renderHamsterEyes(avatar.eyeStyle, palette.eye);
  const ears = renderHamsterEars(avatar.earStyle, palette);
  const tuft = renderHamsterTuft(avatar.hairStyle, accent);
  const pattern = renderHamsterPattern(avatar.pattern, palette, accent);
  const whiskers = renderHamsterWhiskers(avatar.whiskers, palette.eye);
  const cheekFluff = avatar.beard ? `<path d="M92 164c10 14 26 21 48 21 22 0 38-7 48-21-5 25-23 39-48 39-25 0-43-14-48-39Z" fill="${shade(palette.fur, -14)}" opacity=".9"/>` : "";
  const glasses = renderHamsterGlasses(avatar.glasses, palette.eye);
  const hat = renderHamsterHat(avatar.hat, accent);
  const outfit = renderHamsterOutfit(avatar.outfit, accent);
  const accessory = renderHamsterAccessory(avatar.accessory, accent);
  const mouth = renderHamsterMood(avatar.mood);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 280">
      <defs>
        <linearGradient id="hgAvatarBg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#fff7e5"/>
          <stop offset="1" stop-color="#efd2a1"/>
        </linearGradient>
      </defs>
      <rect width="280" height="280" rx="34" fill="url(#hgAvatarBg)"/>
      <circle cx="140" cy="96" r="88" fill="rgba(255,233,180,0.38)"/>
      <g transform="translate(0 ${(1 - scale) * 18}) scale(${scale})">
        ${hat}
        ${ears}
        <ellipse cx="140" cy="212" rx="${bodyWidth}" ry="58" fill="${shade(palette.fur, -3)}"/>
        ${outfit}
        <ellipse cx="140" cy="128" rx="${headWidth}" ry="72" fill="${palette.fur}"/>
        ${pattern}
        <ellipse cx="140" cy="154" rx="50" ry="40" fill="${palette.belly}"/>
        <ellipse cx="92" cy="150" rx="13" ry="10" fill="${palette.blush}" opacity=".48"/>
        <ellipse cx="188" cy="150" rx="13" ry="10" fill="${palette.blush}" opacity=".48"/>
        ${tuft}
        ${eyeMarkup}
        ${glasses}
        <ellipse cx="140" cy="156" rx="10" ry="8" fill="${shade(palette.belly, -20)}"/>
        <ellipse cx="135" cy="157" rx="3.5" ry="3" fill="#3f2617"/>
        <ellipse cx="145" cy="157" rx="3.5" ry="3" fill="#3f2617"/>
        ${whiskers}
        ${mouth}
        ${cheekFluff}
        ${accessory}
        <ellipse cx="140" cy="222" rx="42" ry="26" fill="rgba(255,255,255,0.18)"/>
      </g>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function renderHamsterTuft(style, accent) {
  const pieces = [
    `<path d="M117 74c7-11 15-17 23-18 10 0 18 5 24 17-8-4-15-6-24-6-9 0-15 2-23 7Z" fill="${accent}"/>`,
    `<path d="M112 79c8-18 17-27 29-29 12 1 22 10 27 30-10-7-19-10-28-10-12 0-20 3-28 9Z" fill="${accent}"/>`,
    `<path d="M120 76c0-16 7-26 20-33 10 10 15 21 15 33-6-7-12-10-18-10-7 0-12 3-17 10Z" fill="${accent}"/>`,
    `<path d="M108 83c10-18 21-28 33-28 11 0 22 10 31 28-12-7-23-10-31-10-10 0-19 2-33 10Z" fill="${accent}"/><path d="M140 55c7 5 10 12 10 22" fill="none" stroke="${shade(accent, 16)}" stroke-width="4" stroke-linecap="round"/>`,
    `<path d="M112 78c6-22 16-32 28-32 12 0 22 10 28 32-11-8-18-12-28-12-11 0-18 4-28 12Z" fill="${accent}"/><ellipse cx="140" cy="57" rx="10" ry="8" fill="${shade(accent, 12)}"/>`,
    "",
    `<path d="M108 79c9-14 20-21 32-21 12 0 23 7 32 21-12-4-23-7-32-7-10 0-21 2-32 7Z" fill="${accent}"/><path d="M124 57c-1 10-7 17-16 21 10 1 18-2 26-8" fill="${shade(accent, 14)}"/>`,
    `<path d="M112 76c7-15 16-22 28-22 12 0 21 7 28 22-11-5-20-7-28-7-9 0-18 2-28 7Z" fill="${accent}"/><path d="M154 52c2 11 8 18 18 22-9 3-18 1-27-5" fill="${shade(accent, 14)}"/>`,
    `<path d="M104 83c9-22 22-32 36-32 14 0 27 10 36 32-14-8-24-11-36-11s-22 3-36 11Z" fill="${accent}"/><ellipse cx="140" cy="52" rx="14" ry="9" fill="${shade(accent, 8)}"/>`,
    `<path d="M108 80c11-21 23-31 33-31 11 0 23 10 31 31-13-7-24-10-31-10-8 0-18 3-33 10Z" fill="${accent}"/><path d="M122 56c8 8 16 11 24 11 6 0 12-2 19-7-4-8-14-16-27-16-7 0-13 4-16 12Z" fill="${shade(accent, 14)}"/>`
  ];
  return pieces[style] || pieces[0];
}

function renderHamsterPattern(style, palette, accent) {
  const dark = shade(palette.fur, -18);
  const light = shade(palette.belly, 8);
  const pieces = [
    "",
    `<path d="M100 108c8-18 22-28 40-28 18 0 32 10 40 28-10-6-24-10-40-10-16 0-30 4-40 10Z" fill="${light}" opacity=".92"/>`,
    `<path d="M94 92c9 8 21 13 46 13 25 0 37-5 46-13" fill="none" stroke="${dark}" stroke-width="10" stroke-linecap="round" opacity=".5"/><path d="M96 108c9 8 21 13 44 13 24 0 36-5 44-13" fill="none" stroke="${dark}" stroke-width="8" stroke-linecap="round" opacity=".38"/>`,
    `<ellipse cx="111" cy="112" rx="12" ry="9" fill="${dark}" opacity=".45"/><ellipse cx="166" cy="100" rx="14" ry="10" fill="${dark}" opacity=".45"/><ellipse cx="154" cy="129" rx="10" ry="8" fill="${dark}" opacity=".35"/>`,
    `<path d="M98 95c8-24 22-38 42-38 18 0 34 12 42 37-12-7-25-10-42-10-16 0-28 3-42 11Z" fill="${dark}" opacity=".74"/>`,
    `<path d="M123 131c4-12 10-18 17-18 8 0 13 6 17 18-5 4-12 6-17 6-6 0-12-2-17-6Z" fill="${light}" opacity=".95"/>`
  ];
  return pieces[style] || "";
}

function renderHamsterEyes(style, eyeColor) {
  const glow = `fill="#fff"`;
  const pieces = [
    `<ellipse cx="114" cy="126" rx="10" ry="12" fill="${eyeColor}"/><ellipse cx="166" cy="126" rx="10" ry="12" fill="${eyeColor}"/><circle cx="118" cy="122" r="3" ${glow}/><circle cx="170" cy="122" r="3" ${glow}/>`,
    `<ellipse cx="114" cy="126" rx="12" ry="10" fill="${eyeColor}"/><ellipse cx="166" cy="126" rx="12" ry="10" fill="${eyeColor}"/><circle cx="118" cy="123" r="3" ${glow}/><circle cx="170" cy="123" r="3" ${glow}/>`,
    `<ellipse cx="114" cy="126" rx="11" ry="13" fill="${eyeColor}"/><ellipse cx="166" cy="126" rx="11" ry="13" fill="${eyeColor}"/><circle cx="118" cy="121" r="4" ${glow}/><circle cx="170" cy="121" r="4" ${glow}/><circle cx="112" cy="130" r="1.6" fill="#ffe8a6"/><circle cx="164" cy="130" r="1.6" fill="#ffe8a6"/>`,
    `<path d="M103 126c7 6 14 6 21 0" fill="none" stroke="${eyeColor}" stroke-width="6" stroke-linecap="round"/><path d="M155 126c7 6 14 6 21 0" fill="none" stroke="${eyeColor}" stroke-width="6" stroke-linecap="round"/>`,
    `<path d="M102 128c7-10 14-10 22 0" fill="none" stroke="${eyeColor}" stroke-width="6" stroke-linecap="round"/><path d="M154 128c7-10 14-10 22 0" fill="none" stroke="${eyeColor}" stroke-width="6" stroke-linecap="round"/><circle cx="118" cy="126" r="2" fill="#fff"/><circle cx="170" cy="126" r="2" fill="#fff"/>`,
    `<path d="M114 112l3 8 9 1-7 5 2 9-7-5-8 5 2-9-7-5 9-1Z" fill="${eyeColor}"/><path d="M166 112l3 8 9 1-7 5 2 9-7-5-8 5 2-9-7-5 9-1Z" fill="${eyeColor}"/>`
  ];
  return pieces[style] || pieces[0];
}

function renderHamsterEars(style, palette) {
  const outer = shade(palette.fur, -8);
  const inner = palette.ear;
  const pieces = [
    `<ellipse cx="96" cy="74" rx="23" ry="26" fill="${outer}"/><ellipse cx="184" cy="74" rx="23" ry="26" fill="${outer}"/><ellipse cx="98" cy="78" rx="12" ry="14" fill="${inner}"/><ellipse cx="182" cy="78" rx="12" ry="14" fill="${inner}"/>`,
    `<ellipse cx="95" cy="68" rx="21" ry="30" fill="${outer}"/><ellipse cx="185" cy="68" rx="21" ry="30" fill="${outer}"/><ellipse cx="97" cy="74" rx="11" ry="17" fill="${inner}"/><ellipse cx="183" cy="74" rx="11" ry="17" fill="${inner}"/>`,
    `<ellipse cx="96" cy="74" rx="25" ry="28" fill="${outer}"/><ellipse cx="184" cy="74" rx="25" ry="28" fill="${outer}"/><ellipse cx="98" cy="78" rx="15" ry="17" fill="${inner}"/><ellipse cx="182" cy="78" rx="15" ry="17" fill="${inner}"/><path d="M82 67c-6 8-8 15-8 25" fill="none" stroke="${shade(outer, 12)}" stroke-width="6" stroke-linecap="round"/><path d="M198 67c6 8 8 15 8 25" fill="none" stroke="${shade(outer, 12)}" stroke-width="6" stroke-linecap="round"/>`,
    `<ellipse cx="101" cy="76" rx="19" ry="22" fill="${outer}"/><ellipse cx="179" cy="76" rx="19" ry="22" fill="${outer}"/><ellipse cx="102" cy="80" rx="10" ry="12" fill="${inner}"/><ellipse cx="178" cy="80" rx="10" ry="12" fill="${inner}"/>`,
    `<ellipse cx="91" cy="76" rx="27" ry="22" fill="${outer}"/><ellipse cx="189" cy="76" rx="27" ry="22" fill="${outer}"/><ellipse cx="95" cy="80" rx="16" ry="12" fill="${inner}"/><ellipse cx="185" cy="80" rx="16" ry="12" fill="${inner}"/>`
  ];
  return pieces[style] || pieces[0];
}

function renderHamsterWhiskers(style, eyeColor) {
  const strokes = [
    [["92 158 116 154", "92 168 116 166", "164 154 188 158", "164 166 188 168"]],
    [["84 154 116 150", "82 166 116 164", "82 178 116 178", "164 150 196 154", "164 164 198 166", "164 178 198 178"]],
    [["88 154 116 150", "84 166 116 166", "88 178 116 182", "164 150 192 154", "164 166 196 166", "164 182 192 178"]],
    [["86 156 116 152", "84 170 116 166", "86 184 116 182", "164 152 194 156", "164 166 196 170", "164 182 194 184"]],
    [["95 157 116 156", "96 170 116 170", "164 156 185 157", "164 170 184 170"]]
  ];
  return (strokes[style] || strokes[0])[0].map((line) => {
    const [x1, y1, x2, y2] = line.split(" ");
    return `<path d="M${x1} ${y1}Q${(Number(x1) + Number(x2)) / 2} ${(Number(y1) + Number(y2)) / 2 - 3} ${x2} ${y2}" fill="none" stroke="${shade(eyeColor, 28)}" stroke-width="3" stroke-linecap="round" opacity=".7"/>`;
  }).join("");
}

function renderHamsterGlasses(style, eyeColor) {
  if (style === 0) return "";
  const frames = [
    "",
    `<g stroke="#6d4f32" stroke-width="5" fill="none"><circle cx="114" cy="126" r="18"/><circle cx="166" cy="126" r="18"/><path d="M132 126h16"/></g>`,
    `<g stroke="#3d312a" stroke-width="5" fill="none"><rect x="93" y="109" width="38" height="30" rx="8"/><rect x="149" y="109" width="38" height="30" rx="8"/><path d="M131 123h18"/></g>`,
    `<g stroke="#b9935d" stroke-width="4" fill="none"><ellipse cx="114" cy="126" rx="19" ry="15"/><ellipse cx="166" cy="126" rx="19" ry="15"/><path d="M132 126h16"/></g>`,
    `<g stroke="#4d3a2c" stroke-width="6" fill="none"><rect x="88" y="105" width="46" height="34" rx="12"/><rect x="146" y="105" width="46" height="34" rx="12"/><path d="M134 122h12"/></g>`,
    `<g stroke="#6f5846" stroke-width="4" fill="none"><path d="M96 123c0-9 7-16 16-16h16M152 107h16c9 0 16 7 16 16"/><path d="M129 123h22"/></g>`,
    `<g stroke="#251d17" stroke-width="5" fill="rgba(64,94,94,0.18)"><ellipse cx="114" cy="126" rx="20" ry="16"/><ellipse cx="166" cy="126" rx="20" ry="16"/><path d="M134 126h12"/></g>`,
    `<g stroke="${eyeColor}" stroke-width="4" fill="none"><ellipse cx="114" cy="126" rx="16" ry="12"/><ellipse cx="166" cy="126" rx="16" ry="12"/><path d="M130 126h20"/></g>`,
    `<g stroke="#f0c74a" stroke-width="4" fill="none"><path d="M114 107l4 10h10l-8 6 2 10-8-6-8 6 2-10-8-6h10Z"/><path d="M166 107l4 10h10l-8 6 2 10-8-6-8 6 2-10-8-6h10Z"/></g>`,
    `<g stroke="#5d8aa8" stroke-width="5" fill="none"><rect x="90" y="108" width="42" height="32" rx="10"/><rect x="148" y="108" width="42" height="32" rx="10"/><path d="M132 123h16"/></g>`
  ];
  return frames[style] || "";
}

function renderHamsterHat(style, accent) {
  if (style === 0) return "";
  const hats = [
    "",
    `<g><path d="M84 73c11-24 38-39 58-39 22 0 48 14 58 39-17 7-39 11-58 11-18 0-43-4-58-11Z" fill="#f5f0e6" stroke="#6e4b2d" stroke-width="4"/><path d="M88 76h104" stroke="#6e4b2d" stroke-width="5" stroke-linecap="round"/></g>`,
    `<g><path d="M86 79c11-18 29-28 55-28 23 0 44 7 54 19l-10 10c-15-7-27-10-45-10-24 0-39 4-50 9Z" fill="#bf8d4d"/><path d="M102 67h82" stroke="#6a3c1c" stroke-width="10" stroke-linecap="round"/></g>`,
    `<g><path d="M92 73c14-17 30-24 48-24 18 0 35 8 48 24-10 7-27 10-48 10-20 0-38-3-48-10Z" fill="#e7d091" stroke="#82603e" stroke-width="4"/><path d="M78 81h124" stroke="#82603e" stroke-width="6" stroke-linecap="round"/></g>`,
    `<g><path d="M82 77c-4-28 16-47 33-47 8-13 39-13 47 0 18 0 39 18 34 47H82Z" fill="#fff7ef" stroke="#7f5935" stroke-width="4"/><rect x="98" y="67" width="84" height="22" rx="11" fill="#fffaf0" stroke="#7f5935" stroke-width="4"/></g>`,
    `<g><path d="M89 74c11-18 30-30 51-30 22 0 41 12 51 30-17 8-34 11-51 11-16 0-35-3-51-11Z" fill="#88a75b" stroke="#70422f" stroke-width="4"/><circle cx="140" cy="56" r="8" fill="#a5c86c"/></g>`,
    `<g><path d="M110 70c7-15 17-23 30-23 12 0 22 8 29 23-9 6-19 8-29 8-10 0-20-2-30-8Z" fill="${accent}"/><path d="M93 77c12-12 29-18 47-18 18 0 35 6 47 18" fill="none" stroke="#6a3c1c" stroke-width="6" stroke-linecap="round"/></g>`
  ];
  return hats[style] || "";
}

function renderHamsterOutfit(style, accent) {
  const baseApron = `<path d="M82 250c8-34 28-54 58-54 31 0 51 20 59 54H82Z" fill="#2f7a43"/><path d="M112 193c7 11 17 18 28 18 11 0 20-7 28-18" fill="none" stroke="#f3ebce" stroke-width="7" stroke-linecap="round"/>`;
  const outfits = [
    baseApron,
    `<path d="M80 252c8-36 29-56 60-56 32 0 53 20 60 56H80Z" fill="#6f7a4a"/><path d="M106 197h68" stroke="#f5d68b" stroke-width="8" stroke-linecap="round"/>`,
    `<path d="M78 252c8-36 29-56 62-56 33 0 53 20 60 56H78Z" fill="#81653f"/><path d="M104 205c12 10 24 15 36 15 12 0 24-5 36-15" fill="none" stroke="${accent}" stroke-width="10" stroke-linecap="round"/>`,
    `<path d="M80 252c10-38 30-58 60-58 29 0 50 20 60 58H80Z" fill="#c49a5c"/><rect x="122" y="200" width="36" height="48" rx="12" fill="#ead8b1"/>`,
    `<path d="M79 252c8-36 29-56 61-56 32 0 53 20 61 56H79Z" fill="#824a32"/><path d="M112 198h56" stroke="#f1dd9b" stroke-width="8" stroke-linecap="round"/><path d="M126 214h28" stroke="#f1dd9b" stroke-width="8" stroke-linecap="round"/>`,
    `<path d="M80 252c9-38 30-58 60-58 30 0 51 20 60 58H80Z" fill="#94764f"/><path d="M96 210h88" stroke="#e5d0b0" stroke-width="6" stroke-linecap="round"/><path d="M96 226h88" stroke="#e5d0b0" stroke-width="6" stroke-linecap="round"/>`,
    `<path d="M82 250c8-34 28-54 58-54 31 0 51 20 59 54H82Z" fill="#2f7a43"/><path d="M141 204c10-14 28-12 33 6-18 8-32 4-33-6Z" fill="#9ec56a"/><path d="M141 204c-10-14-28-12-33 6 18 8 32 4 33-6Z" fill="#6ea04d"/>`,
    `<path d="M80 252c10-36 30-56 60-56 29 0 50 20 60 56H80Z" fill="#a51f20"/><path d="M100 204h80" stroke="#f4dd9d" stroke-width="10" stroke-linecap="round"/><circle cx="140" cy="206" r="10" fill="#f4dd9d"/>`
  ];
  return outfits[style] || baseApron;
}

function renderHamsterAccessory(style, accent) {
  const items = [
    "",
    `<path d="M194 212c12 4 19 15 21 31-12-6-19-14-21-31Z" fill="#b7905e"/><rect x="188" y="186" width="7" height="28" rx="3.5" fill="#8e6848"/>`,
    `<path d="M188 210c14-7 28-7 40 0-11 12-28 15-40 0Z" fill="#7c4d2a"/><ellipse cx="200" cy="208" rx="8" ry="11" fill="#f0d087"/>`,
    `<circle cx="197" cy="218" r="10" fill="#d39d2c"/><path d="M197 206v-10" stroke="#6c5133" stroke-width="4" stroke-linecap="round"/>`,
    `<path d="M105 200c8-7 16-7 24 0-5 6-11 9-12 16-2-7-8-10-12-16Z" fill="${accent}"/><path d="M129 200c-8-7-16-7-24 0" fill="${shade(accent, -14)}"/>`,
    `<path d="M194 214c11-10 20-12 31-8-8 10-18 15-31 8Z" fill="#d0b04f"/><path d="M192 217c10-2 18-7 24-16" fill="none" stroke="#8f7641" stroke-width="4" stroke-linecap="round"/>`,
    `<circle cx="198" cy="216" r="13" fill="#c9a144"/><circle cx="198" cy="216" r="8" fill="#f9e08d"/><path d="M198 203v26M185 216h26" stroke="#8a6c1c" stroke-width="3"/>`,
    `<rect x="188" y="206" width="22" height="10" rx="5" fill="#c89f64"/><rect x="210" y="204" width="10" height="14" rx="5" fill="#9c6d3f"/><path d="M188 211h22" stroke="#8c5d31" stroke-width="2"/>`
  ];
  return items[style] || "";
}

function renderHamsterMood(mood) {
  const mouths = {
    sunny: `<path d="M116 176c12 13 36 13 48 0" fill="none" stroke="#734126" stroke-width="6" stroke-linecap="round"/>`,
    cozy: `<path d="M120 178c10 8 30 8 40 0" fill="none" stroke="#734126" stroke-width="5" stroke-linecap="round"/>`,
    brave: `<path d="M116 177c8 9 18 12 24 12 7 0 17-3 24-12" fill="none" stroke="#734126" stroke-width="6" stroke-linecap="round"/><path d="M122 171c5-2 11-2 18 0M140 171c7-2 13-2 18 0" fill="none" stroke="#734126" stroke-width="3" stroke-linecap="round"/>`,
    dreamy: `<path d="M118 180c8 6 28 6 36 0" fill="none" stroke="#734126" stroke-width="5" stroke-linecap="round"/>`
  };
  return mouths[mood] || mouths.sunny;
}

function shade(hex, delta) {
  const value = hex.replace("#", "");
  const expand = value.length === 3 ? value.split("").map((char) => char + char).join("") : value;
  const channels = expand.match(/.{2}/g).map((part) => Math.max(0, Math.min(255, parseInt(part, 16) + delta)));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function defaultGuestStats() {
  return {
    totalSpins: 0,
    totalWins: 0,
    biggestWin: "",
    lastSpinAt: null
  };
}

function defaultGuestTrial() {
  return {
    seeds: defaultSeeds(),
    spins: { available: GUEST_SPINS },
    stats: defaultGuestStats()
  };
}

function loadGuestTrial() {
  try {
    const stored = JSON.parse(localStorage.getItem(GUEST_SESSION_KEY) || "null");
    if (!stored) return defaultGuestTrial();
    return {
      seeds: { ...defaultSeeds(), ...(stored.seeds || {}) },
      spins: {
        available: Math.max(0, Math.min(GUEST_SPINS, Number(stored.spins?.available ?? GUEST_SPINS)))
      },
      stats: { ...defaultGuestStats(), ...(stored.stats || {}) }
    };
  } catch (error) {
    console.warn("Failed to read guest trial:", error);
    return defaultGuestTrial();
  }
}

function saveGuestTrial() {
  localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(state.guest));
}

function clearGuestTrial() {
  localStorage.removeItem(GUEST_SESSION_KEY);
  state.guest = defaultGuestTrial();
}

function defaultSeeds() {
  return { poppy: 0, sesame: 0, almond: 0, walnut: 0 };
}

function defaultTasks() {
  return Object.fromEntries(Object.entries(taskMeta).map(([key, task]) => [
    key,
    { completed: false, rewardSpins: task.rewardSpins }
  ]));
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function validateCredentials(usernameIndex, pin, confirmPin, isRegister) {
  if (!/^[a-zа-яё0-9_]{3,20}$/i.test(usernameIndex)) return "Имя пользователя: 3–20 символов, буквы, цифры или подчёркивание.";
  if (!/^\d{4}$/.test(pin)) return "PIN-код должен состоять ровно из 4 цифр.";
  if (isRegister && pin !== confirmPin) return "PIN-коды не совпадают.";
  return "";
}

function getActiveSeeds() {
  return state.user?.seeds || state.guest?.seeds || defaultSeeds();
}

function getActiveSpins() {
  if (hasInfiniteSpins()) return Number.POSITIVE_INFINITY;
  return state.user?.spins?.available ?? state.guest?.spins?.available ?? 0;
}

function decrementActiveSpin() {
  if (hasInfiniteSpins()) return;
  if (state.user) {
    state.user.spins.available = Math.max(0, (state.user.spins?.available || 0) - 1);
    return;
  }
  state.guest.spins.available = Math.max(0, (state.guest.spins?.available || 0) - 1);
  saveGuestTrial();
}

function applyGuestReward(reward) {
  const stats = state.guest.stats || defaultGuestStats();
  state.guest = {
    ...state.guest,
    seeds: addSeeds(state.guest.seeds, reward.reward),
    stats: {
      ...stats,
      totalSpins: (stats.totalSpins || 0) + 1,
      totalWins: (stats.totalWins || 0) + (reward.isWin ? 1 : 0),
      biggestWin: chooseBiggestWin(stats.biggestWin || "", reward),
      lastSpinAt: new Date().toISOString()
    }
  };
  saveGuestTrial();
}

async function hashPin(usernameIndex, pin) {
  /*
    Alpha client-side PIN auth.
    For production, use Firebase Auth or Cloud Functions.
    PIN hashing on client is better than plaintext but not as secure as server-side authentication.
    Rewards with real value should eventually require admin approval and server-side validation.
  */
  const input = `oako-hamster-v1:${usernameIndex}:${pin}`;
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomSymbols() {
  return Array.from({ length: 3 }, () => symbols[Math.floor(Math.random() * symbols.length)]);
}

function calculateReward(result) {
  const counts = result.reduce((acc, symbol) => {
    acc[symbol] = (acc[symbol] || 0) + 1;
    return acc;
  }, {});
  const three = Object.entries(counts).find(([, count]) => count === 3)?.[0];
  if (three) {
    const reward = rewardRules[three].three;
    const jackpot = three === "🥜";
    return {
      reward,
      message: jackpot ? "ДЖЕКПОТ! Хомяк нашёл грецкий орех 🥜" : "Победа! Хомяк нашёл для вас награду 🎉",
      isWin: true,
      rank: jackpot ? 1000 : rewardValue(reward)
    };
  }
  const two = Object.entries(counts).find(([, count]) => count === 2)?.[0];
  if (two) {
    const reward = rewardRules[two].two;
    return { reward, message: "Почти победа! Хомяк дарит вам бонус 🌱", isWin: true, rank: rewardValue(reward) };
  }
  return {
    reward: { poppy: 1 },
    message: "Хомяк всё равно нашёл для вас 1 маковое семя 🌱",
    isWin: false,
    rank: 1
  };
}

function addSeeds(current, reward) {
  const next = { ...defaultSeeds(), ...(current || {}) };
  Object.entries(reward).forEach(([key, amount]) => {
    next[key] = (next[key] || 0) + amount;
  });
  return next;
}

function subtractSeeds(current, cost) {
  const next = { ...defaultSeeds(), ...(current || {}) };
  Object.entries(cost).forEach(([key, amount]) => {
    next[key] = Math.max(0, (next[key] || 0) - amount);
  });
  return next;
}

function hasCost(seeds, cost) {
  return Object.entries(cost).every(([key, amount]) => (seeds?.[key] || 0) >= amount);
}

function rewardValue(reward) {
  return Object.entries(reward).reduce((sum, [key, amount]) => sum + amount * seedMeta[key].value, 0);
}

function chooseBiggestWin(current, reward) {
  if (!reward.isWin) return current;
  const text = formatCost(reward.reward);
  if (!current) return text;
  return reward.rank >= 50 ? text : current;
}

function formatCost(cost) {
  return Object.entries(cost).map(([key, amount]) => `${amount} ${seedMeta[key].icon} ${seedMeta[key].short}`).join(", ");
}

function walletTotal(seeds) {
  return Object.entries(seedMeta).reduce((sum, [key, meta]) => sum + (seeds[key] || 0) * meta.value, 0);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function canClaimDailySpin() {
  return Boolean(state.user && state.user.spins?.dailyFreeUsedDate !== todayKey());
}

function hasInfiniteSpins() {
  return TEST_INFINITE_SPINS;
}

function formatSpinCount(value) {
  return Number.isFinite(value) ? String(value) : "∞";
}

async function withBusy(work) {
  state.busy = true;
  state.error = "";
  state.message = "";
  render();
  try {
    await work();
  } catch (error) {
    console.error(error);
    showError(error.message || "Не удалось подключиться. Попробуйте позже.");
  } finally {
    state.busy = false;
    render();
  }
}

function showError(message) {
  state.error = message;
  state.message = "";
  render();
}

function showToast(message) {
  const id = `toast_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  state.toasts = [...state.toasts, { id, message }];
  render();
  window.setTimeout(() => {
    state.toasts = state.toasts.filter((toast) => toast.id !== id);
    render();
  }, 3300);
}

function bumpSeeds(keys) {
  keys.forEach((key) => {
    const node = app.querySelector(`[data-seed="${key}"]`);
    if (!node) return;
    node.classList.remove("hg-seed-bump");
    window.requestAnimationFrame(() => node.classList.add("hg-seed-bump"));
  });
}

function burstConfetti() {
  const node = app.querySelector("#hgConfetti");
  if (!node) return;
  node.className = "hg-confetti-burst";
  window.setTimeout(() => {
    node.className = "";
  }, 1000);
}

async function shareGame() {
  const payload = {
    title: "Счастливый хомяк Kyrgyz Organics",
    text: "Крутите барабаны и собирайте семена Kyrgyz Organics!",
    url: SHARE_URL
  };
  if (navigator.share) {
    await navigator.share(payload).catch(() => {});
    return;
  }
  await copyText(`${payload.text} ${payload.url}`);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    showToast("Ссылка скопирована 🌱");
  } else {
    showToast("Скопируйте ссылку: " + text);
  }
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
