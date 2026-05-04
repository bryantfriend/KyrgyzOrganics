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
const APP_VERSION = "1.04";
const GUEST_SPINS = 5;
const avatarOptions = {
  ages: [
    { key: "kid", label: "Ребёнок" },
    { key: "teen", label: "Подросток" },
    { key: "adult", label: "Взрослый" }
  ],
  genders: [
    { key: "female", label: "Женский" },
    { key: "male", label: "Мужской" }
  ],
  faces: [
    { key: 0, label: "Тёплый" },
    { key: 1, label: "Солнечный" },
    { key: 2, label: "Ореховый" },
    { key: 3, label: "Золотистый" },
    { key: 4, label: "Шоколадный" }
  ],
  hairStyles: [
    "Каре",
    "Кудри",
    "Чёлка",
    "Пучок",
    "Коса",
    "Короткая",
    "Волна",
    "Андеркат",
    "Хвост",
    "Объём"
  ],
  hairColors: ["#2e1b12", "#5b2f17", "#7a4a22", "#a25d29", "#c98746", "#d9b16f", "#5c3425", "#0f0f12"],
  glasses: [
    "Без очков",
    "Круглые",
    "Квадратные",
    "Тонкие",
    "Большие",
    "Полурамка",
    "Солнечные",
    "Овальные",
    "Винтаж",
    "Яркие"
  ],
  hats: [
    "Без головного убора",
    "Калпак",
    "Кепка",
    "Панама",
    "Поварской колпак",
    "Платок"
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
  const pillLabel = state.user ? `${spins} вращ.` : `${spins}/${GUEST_SPINS} вращ.`;
  const userLabel = state.user ? escapeHtml(state.user.username) : "Гость";
  const userAvatar = state.user
    ? `<img class="hg-user-avatar" src="${renderAvatarDataUrl(state.user.avatar)}" alt="Аватар игрока">`
    : `<span class="hg-user-avatar hg-user-avatar--guest" aria-hidden="true">👤</span>`;
  return `
    <header class="hg-topbar">
      <div class="hg-hero-panel">
        <div class="hg-hero-badges">
          <div class="hg-user-pill ${state.user ? "" : "is-guest"}">${userAvatar}<span>${userLabel}</span></div>
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
            <h2 class="hg-section-title">Аватар</h2>
            <p class="hg-muted">Соберите образ, который нравится вам и близок по стилю.</p>
          </div>
          <button class="hg-button hg-button-secondary" data-action="avatar-reset" type="button">Сбросить</button>
        </div>
        <div class="hg-avatar-builder">
          <div class="hg-avatar-stage">
            <div class="hg-avatar-frame">
              <img class="hg-avatar-preview" src="${renderAvatarDataUrl(avatar)}" alt="Предпросмотр аватара">
            </div>
            <div class="hg-avatar-meta">
              <span class="hg-status">Возраст: ${avatarLabel(avatarOptions.ages, avatar.age)}</span>
              <span class="hg-status">Стиль: ${avatarOptions.hairStyles[avatar.hairStyle]}</span>
            </div>
          </div>
          <div class="hg-avatar-controls">
            <div class="hg-avatar-panel-tabs">
              ${renderAvatarPanelTab("basics", "Основа")}
              ${renderAvatarPanelTab("face", "Лицо")}
              ${renderAvatarPanelTab("hair", "Волосы")}
              ${renderAvatarPanelTab("glasses", "Очки")}
              ${renderAvatarPanelTab("hats", "Головной убор")}
            </div>
            ${renderAvatarPanelContent(avatar)}
          </div>
        </div>
        <button class="hg-button" data-action="avatar-save" ${state.busy ? "disabled" : ""} type="button">Сохранить аватар</button>
      </div>
      <div class="hg-account-stat-grid">
        <div class="hg-stat">Вращения<span class="hg-stat-value">${user.spins?.available || 0}</span></div>
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
            aria-label="Цвет волос"
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
  if (state.avatarPanel === "face") {
    return renderAvatarNumberOptions("Лицо", "face", avatarOptions.faces.map((item) => item.label), avatar.face);
  }
  if (state.avatarPanel === "hair") {
    return `
      ${renderAvatarNumberOptions("Причёска", "hairStyle", avatarOptions.hairStyles, avatar.hairStyle)}
      ${renderAvatarColorOptions("Цвет волос", avatar.hairColor)}
      ${renderAvatarToggle("Борода", "beard", avatar.beard)}
    `;
  }
  if (state.avatarPanel === "glasses") {
    return renderAvatarNumberOptions("Очки", "glasses", avatarOptions.glasses, avatar.glasses);
  }
  if (state.avatarPanel === "hats") {
    return renderAvatarNumberOptions("Головной убор", "hat", avatarOptions.hats, avatar.hat);
  }
  return `
    ${renderAvatarSegment("Возраст", "age", avatarOptions.ages, avatar.age)}
    ${renderAvatarSegment("Стиль", "gender", avatarOptions.genders, avatar.gender)}
  `;
}

function bindEvents() {
  app.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.tab;
      state.error = "";
      state.message = "";
      render();
    });
  });
  app.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.authTab = button.dataset.authTab;
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
      const remainingSpins = Math.max((state.user.spins?.available || 0), 0);
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
    state.resultMessage = !state.user && getActiveSpins() < 1
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
  const value = ["face", "hairStyle", "glasses", "hat"].includes(field) ? Number(rawValue) : rawValue;
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
  state.tab = "account";
  state.message = "";
  state.error = "";
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
    age: "adult",
    gender: "female",
    face: 2,
    hairStyle: 3,
    hairColor: "#5b2f17",
    beard: false,
    glasses: 0,
    hat: 4
  };
}

function normalizeAvatar(avatar) {
  const base = defaultAvatar();
  return {
    age: avatarOptions.ages.some((item) => item.key === avatar?.age) ? avatar.age : base.age,
    gender: avatarOptions.genders.some((item) => item.key === avatar?.gender) ? avatar.gender : base.gender,
    face: Number.isInteger(avatar?.face) && avatar.face >= 0 && avatar.face < avatarOptions.faces.length ? avatar.face : base.face,
    hairStyle: Number.isInteger(avatar?.hairStyle) && avatar.hairStyle >= 0 && avatar.hairStyle < avatarOptions.hairStyles.length ? avatar.hairStyle : base.hairStyle,
    hairColor: avatarOptions.hairColors.includes(avatar?.hairColor) ? avatar.hairColor : base.hairColor,
    beard: Boolean(avatar?.beard),
    glasses: Number.isInteger(avatar?.glasses) && avatar.glasses >= 0 && avatar.glasses < avatarOptions.glasses.length ? avatar.glasses : base.glasses,
    hat: Number.isInteger(avatar?.hat) && avatar.hat >= 0 && avatar.hat < avatarOptions.hats.length ? avatar.hat : base.hat
  };
}

function avatarLabel(options, value) {
  return options.find((item) => item.key === value)?.label || "";
}

function avatarFacePalette(faceIndex) {
  const palettes = [
    { skin: "#f7d7b4", blush: "#efb79f", eye: "#3b2414" },
    { skin: "#efc698", blush: "#dd9d86", eye: "#402519" },
    { skin: "#dca674", blush: "#cb8f72", eye: "#362013" },
    { skin: "#c98c5f", blush: "#b8745d", eye: "#2f1c12" },
    { skin: "#ab6f49", blush: "#995f4a", eye: "#24150e" }
  ];
  return palettes[faceIndex] || palettes[2];
}

function renderAvatarDataUrl(avatar) {
  const palette = avatarFacePalette(avatar.face);
  const hair = avatar.hairColor;
  const ageScale = avatar.age === "kid" ? 0.9 : avatar.age === "teen" ? 0.96 : 1;
  const jaw = avatar.age === "adult" ? 68 : avatar.age === "teen" ? 62 : 58;
  const shoulder = avatar.gender === "male" ? 94 : 86;
  const beard = avatar.beard ? `<path d="M88 152c10 18 34 27 51 27 17 0 41-9 51-27-7 28-23 41-51 41-28 0-44-13-51-41Z" fill="${shade(hair, -18)}"/>` : "";
  const glasses = renderAvatarGlasses(avatar.glasses, palette.eye);
  const hat = renderAvatarHat(avatar.hat, avatar.gender);
  const hairShape = renderAvatarHair(avatar.hairStyle, hair, avatar.gender);
  const body = avatar.gender === "male"
    ? `<path d="M58 258c10-44 42-71 82-71 41 0 72 27 83 71H58Z" fill="#3a7a43"/><path d="M90 194c19 17 43 17 60 0" fill="none" stroke="#e7d7b5" stroke-width="8" stroke-linecap="round"/>`
    : `<path d="M66 258c10-44 39-71 74-71 35 0 64 27 74 71H66Z" fill="#3e8a50"/><path d="M96 194c17 15 35 15 50 0" fill="none" stroke="#e7d7b5" stroke-width="8" stroke-linecap="round"/>`;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 280">
      <defs>
        <linearGradient id="bg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#fff8e8"/>
          <stop offset="1" stop-color="#f2ddb1"/>
        </linearGradient>
      </defs>
      <rect width="280" height="280" rx="34" fill="url(#bg)"/>
      <circle cx="140" cy="104" r="88" fill="rgba(255,233,180,0.45)"/>
      <g transform="translate(0 ${(1 - ageScale) * 24}) scale(${ageScale})">
        ${hat}
        <ellipse cx="140" cy="124" rx="74" ry="${jaw}" fill="${palette.skin}"/>
        ${hairShape}
        <ellipse cx="111" cy="124" rx="12" ry="15" fill="${palette.eye}"/>
        <ellipse cx="169" cy="124" rx="12" ry="15" fill="${palette.eye}"/>
        <circle cx="115" cy="120" r="3.5" fill="#fff"/>
        <circle cx="173" cy="120" r="3.5" fill="#fff"/>
        ${glasses}
        <ellipse cx="100" cy="147" rx="10" ry="6" fill="${palette.blush}" opacity=".55"/>
        <ellipse cx="180" cy="147" rx="10" ry="6" fill="${palette.blush}" opacity=".55"/>
        <path d="M135 148c4-6 8-6 11 0" fill="none" stroke="#8d5d43" stroke-width="4" stroke-linecap="round"/>
        <path d="M106 166c15 17 53 17 68 0" fill="none" stroke="#7a4428" stroke-width="6" stroke-linecap="round"/>
        ${beard}
        ${body}
        <path d="M73 231c24 18 110 18 134 0" fill="none" stroke="#2a5e32" stroke-width="10" stroke-linecap="round" opacity=".38"/>
      </g>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function renderAvatarHair(style, hair, gender) {
  const pieces = [
    `<path d="M73 104c6-44 41-68 71-68 34 0 68 22 73 68-17-17-34-26-71-26-35 0-56 9-73 26Z" fill="${hair}"/>`,
    `<path d="M68 112c10-50 38-76 73-76 37 0 66 21 72 76-18-24-36-35-72-35-34 0-51 8-73 35Z" fill="${hair}"/><path d="M97 65c9 24 15 33 43 37-18 5-35 3-52-9Z" fill="${shade(hair, 12)}"/>`,
    `<path d="M76 100c10-39 34-63 64-63 33 0 58 21 66 63-13-12-29-18-67-18-35 0-51 3-63 18Z" fill="${hair}"/><path d="M133 46c-2 20-8 36-18 50 18-6 35-16 44-35-4-5-12-11-26-15Z" fill="${shade(hair, 12)}"/>`,
    `<path d="M69 108c5-43 31-69 71-69 39 0 68 27 71 69-17-12-31-16-71-16-40 0-54 4-71 16Z" fill="${hair}"/><ellipse cx="190" cy="66" rx="20" ry="18" fill="${hair}"/>`,
    `<path d="M70 106c8-45 39-68 69-68 29 0 60 20 73 68-16-18-29-24-71-24-43 0-55 6-71 24Z" fill="${hair}"/><path d="M194 86c15 18 16 36 7 55" fill="none" stroke="${hair}" stroke-width="18" stroke-linecap="round"/>`,
    `<path d="M79 103c8-36 32-58 61-58 28 0 54 18 61 58-18-14-34-18-61-18-27 0-42 4-61 18Z" fill="${hair}"/>`,
    `<path d="M70 107c8-44 40-69 70-69 32 0 60 19 71 69-18-16-37-26-71-26-34 0-52 8-70 26Z" fill="${hair}"/><path d="M183 83c20 18 28 38 26 60" fill="none" stroke="${shade(hair, -10)}" stroke-width="12" stroke-linecap="round"/>`,
    `<path d="M76 109c9-44 39-66 64-66 29 0 55 17 64 66-19-18-33-24-64-24-32 0-45 5-64 24Z" fill="${hair}"/><path d="M111 58c11 20 22 30 38 37-18 3-41-2-54-18Z" fill="${shade(hair, 12)}"/>`,
    `<path d="M70 108c6-44 36-69 70-69 37 0 67 23 70 69-17-16-30-22-70-22-39 0-53 5-70 22Z" fill="${hair}"/><path d="M191 83c10 15 14 38 10 57" fill="none" stroke="${hair}" stroke-width="10" stroke-linecap="round"/><path d="M203 132c10 13 11 29 5 44" fill="none" stroke="${shade(hair, -12)}" stroke-width="8" stroke-linecap="round"/>`,
    `<path d="M68 111c11-48 42-73 72-73 32 0 63 22 71 73-17-20-33-31-71-31-37 0-55 11-72 31Z" fill="${hair}"/><path d="M84 85c11 18 28 29 52 33-31 8-57 3-73-13Z" fill="${shade(hair, 10)}"/>`
  ];
  const extra = gender === "female" && [4, 8].includes(style)
    ? `<path d="M203 122c19 27 21 54 10 79" fill="none" stroke="${shade(hair, -12)}" stroke-width="14" stroke-linecap="round"/>`
    : "";
  return pieces[style] + extra;
}

function renderAvatarGlasses(style, eyeColor) {
  if (style === 0) return "";
  const frames = [
    "",
    `<g stroke="#6d4f32" stroke-width="5" fill="none"><circle cx="110" cy="124" r="18"/><circle cx="170" cy="124" r="18"/><path d="M128 124h24"/></g>`,
    `<g stroke="#3d312a" stroke-width="5" fill="none"><rect x="89" y="107" width="38" height="30" rx="8"/><rect x="151" y="107" width="38" height="30" rx="8"/><path d="M127 121h24"/></g>`,
    `<g stroke="#b9935d" stroke-width="4" fill="none"><ellipse cx="110" cy="124" rx="19" ry="15"/><ellipse cx="170" cy="124" rx="19" ry="15"/><path d="M129 124h22"/></g>`,
    `<g stroke="#4d3a2c" stroke-width="6" fill="none"><rect x="84" y="103" width="46" height="34" rx="12"/><rect x="150" y="103" width="46" height="34" rx="12"/><path d="M130 120h20"/></g>`,
    `<g stroke="#6f5846" stroke-width="4" fill="none"><path d="M92 121c0-9 7-16 16-16h20M148 105h20c9 0 16 7 16 16"/><path d="M128 121h24"/></g>`,
    `<g stroke="#251d17" stroke-width="5" fill="rgba(64,94,94,0.18)"><ellipse cx="110" cy="124" rx="20" ry="16"/><ellipse cx="170" cy="124" rx="20" ry="16"/><path d="M130 124h20"/></g>`,
    `<g stroke="${eyeColor}" stroke-width="4" fill="none"><ellipse cx="110" cy="124" rx="16" ry="12"/><ellipse cx="170" cy="124" rx="16" ry="12"/><path d="M126 124h28"/></g>`,
    `<g stroke="#8c5e3d" stroke-width="4" fill="none"><circle cx="110" cy="124" r="17"/><rect x="153" y="107" width="33" height="34" rx="10"/><path d="M127 124h26"/></g>`,
    `<g stroke="#5d8aa8" stroke-width="5" fill="none"><rect x="86" y="106" width="42" height="32" rx="10"/><rect x="152" y="106" width="42" height="32" rx="10"/><path d="M128 121h24"/></g>`
  ];
  return frames[style] || "";
}

function renderAvatarHat(style, gender) {
  if (style === 0) return "";
  const hats = [
    "",
    `<g><path d="M83 73c11-24 38-39 58-39 22 0 48 14 58 39-17 7-39 11-58 11-18 0-43-4-58-11Z" fill="#f5f0e6" stroke="#6e4b2d" stroke-width="4"/><path d="M87 76h106" stroke="#6e4b2d" stroke-width="5" stroke-linecap="round"/></g>`,
    `<g><path d="M86 78c10-18 29-29 56-29 24 0 45 7 56 20l-10 10c-15-7-27-10-48-10-23 0-37 4-49 9Z" fill="#bf8d4d"/><path d="M104 66h82" stroke="#6a3c1c" stroke-width="10" stroke-linecap="round"/></g>`,
    `<g><path d="M92 71c14-17 30-25 48-25 18 0 36 8 48 25-10 7-28 10-48 10-20 0-37-3-48-10Z" fill="#e7d091" stroke="#82603e" stroke-width="4"/><path d="M77 80h126" stroke="#82603e" stroke-width="6" stroke-linecap="round"/></g>`,
    `<g><path d="M80 76c-4-29 17-49 34-49 8-14 40-14 48 0 18 0 40 18 35 49H80Z" fill="#fff7ef" stroke="#7f5935" stroke-width="4"/><rect x="96" y="66" width="88" height="22" rx="11" fill="#fffaf0" stroke="#7f5935" stroke-width="4"/></g>`,
    `<g><path d="M89 75c10-18 31-31 51-31 23 0 43 12 51 31-17 8-34 11-51 11-16 0-36-3-51-11Z" fill="${gender === "female" ? "#c2686a" : "#4c8f54"}" stroke="#70422f" stroke-width="4"/><path d="M92 76h96" stroke="#70422f" stroke-width="5" stroke-linecap="round"/></g>`
  ];
  return hats[style] || "";
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
  return state.user?.spins?.available ?? state.guest?.spins?.available ?? 0;
}

function decrementActiveSpin() {
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
