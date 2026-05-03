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
const APP_VERSION = "1.00";
const GUEST_SPINS = 5;

const seedMeta = {
  poppy: { name: "Маковые семена", short: "Мак", value: 1, icon: "🌑" },
  sesame: { name: "Кунжутные семена", short: "Кунжут", value: 5, icon: "⚪" },
  almond: { name: "Миндальные семена", short: "Миндаль", value: 50, icon: "🌰" },
  walnut: { name: "Грецкие орехи", short: "Орех", value: 1000, icon: "🥜" }
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
  "Айбек выиграл 25 маковых семян",
  "Нура получила 1 кунжутное семя",
  "Тимур почти выиграл джекпот",
  "Айзада получила скидку 5%",
  "Элина нашла миндальное семя"
];

let state = {
  tab: "game",
  authTab: "login",
  userId: localStorage.getItem(SESSION_KEY),
  user: null,
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
      <img class="hg-loading-mascot" src="./assets/svg/hamster.svg" alt="">
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
  const pillLabel = state.user ? `🎰 ${spins}` : `🎰 Гость ${spins}/${GUEST_SPINS}`;
  return `
    <header class="hg-topbar">
      <div>
        <p class="hg-brand-kicker">Kyrgyz Organics</p>
        <h1 class="hg-title">Счастливый хомяк</h1>
        <span class="hg-version">Версия ${APP_VERSION}</span>
      </div>
      <div class="hg-pill" aria-label="Доступные вращения">${pillLabel}</div>
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
        <div class="hg-card hg-daily-row">
          <div>
            <strong>Ежедневное вращение</strong>
            <div class="hg-muted">${dailyAvailable ? "Хомяк приготовил подарок на сегодня." : "Сегодняшний подарок уже получен."}</div>
          </div>
          <button class="hg-button hg-button-secondary" data-action="daily" ${dailyAvailable || state.busy ? "" : "disabled"} type="button">Получить</button>
        </div>
      ` : renderGuestNotice()}
      <div class="hg-slot-wrap ${state.spinning ? "hg-is-spinning" : ""}">
        <div id="hgConfetti"></div>
        <img class="hg-slot-frame-art" src="./assets/svg/slot-machine.svg" alt="">
        <div class="hg-slot-head">
          <img class="hg-hamster" src="./assets/svg/hamster.svg" alt="Хомяк-повар">
          <div class="hg-slot-logo">Хомяк крутит<br>барабаны</div>
          <img class="hg-wheel" src="./assets/svg/hamster-wheel.svg" alt="Колесо хомяка">
        </div>
        <div class="hg-reels" aria-label="Игровые барабаны">
          ${state.resultSymbols.map((symbol) => `<div class="hg-reel ${state.spinning ? "hg-spinning" : ""}"><span class="hg-reel-symbol">${symbol}</span></div>`).join("")}
        </div>
        <button class="hg-button hg-spin-button" data-action="spin" ${state.busy || !spins ? "disabled" : ""} type="button">
          ${state.spinning ? "Хомяк крутит..." : "Крутить!"}
        </button>
      </div>
      <div class="hg-result ${state.resultMessage.includes("ДЖЕКПОТ") ? "hg-jackpot" : ""}">${escapeHtml(state.resultMessage)}</div>
      ${!state.user && !spins ? renderGuestFinishedCard() : ""}
      <div class="hg-card">
        <h2 class="hg-section-title">Свежие выигрыши</h2>
        <div class="hg-feed">
          ${recentWins.map((win) => `<div class="hg-feed-item"><span>🌱</span><span>${win}</span></div>`).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderBalanceSummary() {
  const seeds = getActiveSeeds();
  return `
    <div class="hg-card">
      <div class="hg-balance-grid">
        ${Object.entries(seedMeta).map(([key, meta]) => `
          <div class="hg-seed-chip" data-seed="${key}">
            <span class="hg-seed-icon">${meta.icon}</span>
            <span class="hg-seed-amount">${seeds[key] || 0}</span>
            <span class="hg-seed-label">${meta.short}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderGuestNotice() {
  const used = GUEST_SPINS - getActiveSpins();
  return `
    <div class="hg-card hg-daily-row">
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
      <div class="hg-card">
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
                <h2 class="hg-item-name">${meta.icon} ${meta.name}</h2>
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
  const rewards = state.user.rewards || [];
  return `
    <section class="hg-screen">
      <div class="hg-card">
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
      <div class="hg-card">
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
  return `
    <section class="hg-screen">
      <div class="hg-card">
        <h2 class="hg-section-title">Аккаунт</h2>
        <div class="hg-row">
          <strong>${escapeHtml(user.username)}</strong>
          <span class="hg-status">Категория: Бесплатный</span>
        </div>
        <p class="hg-muted">Premium появится позже.</p>
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
      <div class="hg-card">
        <div class="hg-tabs" role="tablist" aria-label="Аккаунт">
          <button class="hg-tab-button ${state.authTab === "login" ? "hg-active" : ""}" data-auth-tab="login" type="button">Войти</button>
          <button class="hg-tab-button ${state.authTab === "register" ? "hg-active" : ""}" data-auth-tab="register" type="button">Регистрация</button>
        </div>
      </div>
      <div class="hg-card">
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
  return `
    <nav class="hg-bottom-nav" aria-label="Главная навигация">
      ${navItems.map((item) => `
        <button class="hg-nav-button ${state.tab === item.key ? "hg-active" : ""}" data-tab="${item.key}" type="button">
          <span class="hg-nav-icon">${item.icon}</span>
          <span>${item.label}</span>
        </button>
      `).join("")}
    </nav>
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
    return;
  }
  const ref = doc(db, CUSTOMER_COLLECTION, state.userId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    localStorage.removeItem(SESSION_KEY);
    state.userId = null;
    state.user = null;
    return;
  }
  state.user = normalizeUser(snapshot.data());
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

function logout() {
  localStorage.removeItem(SESSION_KEY);
  state.userId = null;
  state.user = null;
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
    rewards: user.rewards || [],
    tasks: { ...defaultTasks(), ...(user.tasks || {}) }
  };
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
