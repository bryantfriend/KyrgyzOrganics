import { db } from '../../firebase-config.js';
import pipeline from '../../ICF/engine/pipeline.js';
import gamesIntent from '../../ICF/Intents/GamesIntent.js';
import { HAMSTER_DEFAULT_SPIN_IMAGES, HAMSTER_SPIN_MIN_IMAGES } from '../../hamster_game/spin-image-defaults.js';
import { uploadImage } from '../utils.js';
import { BaseTab } from './BaseTab.js';

var GAME_STORE_ID = 'kyrgyz-organics';
var HAMSTER_GAME_ID = 'hamster-spin';
var STORAGE_PREFIX = 'stores/kyrgyz-organics/media/games/hamster-spin/spin-images';
var MIN_SPIN_MESSAGE = 'Spinning mode must have at least 4 pictures.';

export class GamesTab extends BaseTab {
  constructor() {
    super('games');

    this.root = document.getElementById('gamesRoot');
    this.activeView = 'dashboard';
    this.activeGameId = HAMSTER_GAME_ID;
    this.activeSection = 'spin';
    this.images = [];
    this.lastLoadData = null;
    this.payoutModalOpen = false;
    this.form = null;
    this.status = null;
    this.meta = null;
    this.submitBtn = null;
  }

  async init() {
    await this.openDashboard();
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  async onShow() {
    if (this.activeView === 'detail') {
      await this.openGameDetail(this.activeGameId);
      return;
    }

    await this.openDashboard();
  }

  async onStoreChanged() {
    if (!this.isInitialized) {
      return;
    }

    await this.onShow();
  }

  async openDashboard() {
    var result = await this.runIntent('OpenGamesDashboardIntent', {});
    this.activeView = 'dashboard';
    this.renderDashboard(result.data.games || []);
  }

  async openGameDetail(gameId) {
    var result = await this.runIntent('OpenGameDetailIntent', {
      storeId: GAME_STORE_ID,
      gameId: gameId || HAMSTER_GAME_ID
    });

    this.activeView = 'detail';
    this.activeGameId = gameId || HAMSTER_GAME_ID;
    this.renderGameDetail(result.data.game || {});
    await this.loadSpinImages();
  }

  renderDashboard(games) {
    if (!this.root) {
      return;
    }

    var markup = ''
      + '<div class="games-admin-shell">'
      + '<div class="admin-card games-dashboard-card">'
      + '<div class="card-heading-row">'
      + '<div>'
      + '<div class="eyebrow">Games</div>'
      + '<h3>Games Dashboard</h3>'
      + '<p>Manage playable store experiences from one scalable admin area.</p>'
      + '</div>'
      + '<span class="muted-pill">' + games.length + ' game</span>'
      + '</div>'
      + '<div class="games-grid">';

    if (!games.length) {
      markup += '<div class="games-empty">No games are configured yet.</div>';
    }

    var index = 0;
    while (index < games.length) {
      var game = games[index];
      markup += ''
        + '<article class="games-game-card">'
        + '<div class="games-game-card-top">'
        + '<div class="games-game-icon" aria-hidden="true">◎</div>'
        + '<span class="status-badge success">' + escapeHtml(game.status || 'Active') + '</span>'
        + '</div>'
        + '<h4>' + escapeHtml(game.title || 'Game') + '</h4>'
        + '<p>' + escapeHtml(game.description || '') + '</p>'
        + '<button type="button" class="btn-primary" data-games-action="open-detail" data-game-id="' + escapeHtml(game.id) + '">Manage Game</button>'
        + '</article>';
      index = index + 1;
    }

    markup += '</div></div></div>';
    this.root.innerHTML = markup;
    this.bindDashboardEvents();
  }

  renderGameDetail(game) {
    if (!this.root) {
      return;
    }

    this.root.innerHTML = ''
      + '<div class="games-admin-shell">'
      + '<div class="games-detail-header">'
      + '<button type="button" class="btn-secondary" data-games-action="back-dashboard">All Games</button>'
      + '<div>'
      + '<div class="eyebrow">Games / Hamster Spin</div>'
      + '<h3>' + escapeHtml(game.title || 'Hamster Spin Game') + '</h3>'
      + '<p>' + escapeHtml(game.description || 'Manage spin images, payouts, rewards, and game settings.') + '</p>'
      + '</div>'
      + '<span class="status-badge success">' + escapeHtml(game.status || 'Active') + '</span>'
      + '</div>'
      + '<div class="games-section-tabs" role="tablist" aria-label="Hamster game options">'
      + '<button type="button" class="' + this.getSectionButtonClass('spin') + '" data-games-section="spin">Spin Pictures</button>'
      + '<button type="button" class="' + this.getSectionButtonClass('payouts') + '" data-games-section="payouts">Payouts / Rewards</button>'
      + '<button type="button" class="' + this.getSectionButtonClass('settings') + '" data-games-section="settings">Game Settings</button>'
      + '</div>'
      + '<div id="gamesDetailPanel">'
      + this.renderActiveSection()
      + '</div>'
      + this.renderPayoutModal()
      + '</div>';

    this.captureElements();
    this.bindDetailEvents();
  }

  renderActiveSection() {
    if (this.activeSection === 'payouts') {
      return this.renderPayoutSection();
    }

    if (this.activeSection === 'settings') {
      return this.renderSettingsSection();
    }

    return this.renderSpinSection();
  }

  renderSpinSection() {
    return ''
      + '<div class="admin-card games-spin-manager">'
      + '<div class="card-heading-row">'
      + '<div>'
      + '<div class="eyebrow">Hamster Game</div>'
      + '<h3>Spin Pictures</h3>'
      + '<p>These pictures power spinning mode. The game keeps a safe fallback until Firestore has at least 4 active pictures.</p>'
      + '</div>'
      + '<span id="gamesSpinMeta" class="muted-pill">Loading</span>'
      + '</div>'
      + '<form id="gamesSpinImageForm" class="games-spin-form">'
      + '<div class="form-row">'
      + '<div class="form-group">'
      + '<label for="gamesSpinLabel">Label</label>'
      + '<input type="text" id="gamesSpinLabel" placeholder="Chocolate cookie" required>'
      + '</div>'
      + '<div class="form-group">'
      + '<label for="gamesSpinImageUrl">Image URL</label>'
      + '<input type="url" id="gamesSpinImageUrl" placeholder="https://..." autocomplete="off">'
      + '</div>'
      + '<div class="form-group">'
      + '<label for="gamesSpinImageFile">Upload Image</label>'
      + '<input type="file" id="gamesSpinImageFile" accept="image/*">'
      + '</div>'
      + '</div>'
      + '<div class="games-spin-actions">'
      + '<p class="field-hint">Use either an image URL or an uploaded file. Removing an active image is blocked when only 4 remain.</p>'
      + '<button type="submit" id="gamesSpinSubmitBtn" class="btn-primary">Add Spin Picture</button>'
      + '</div>'
      + '</form>'
      + '<div id="gamesSpinStatus" class="inline-alert" hidden></div>'
      + '<div id="gamesSpinImagesList" class="games-spin-grid"></div>'
      + '</div>';
  }

  renderPayoutSection() {
    return ''
      + '<div class="admin-card games-payout-card">'
      + '<div class="card-heading-row">'
      + '<div>'
      + '<div class="eyebrow">Rewards</div>'
      + '<h3>Payouts / Rewards</h3>'
      + '<p>Payout details stay hidden until an admin opens the rewards modal.</p>'
      + '</div>'
      + '<button type="button" class="btn-primary" data-games-action="open-payout-modal">View Payouts</button>'
      + '</div>'
      + '<div class="games-muted-panel">Reward details are not shown on the main admin screen by default.</div>'
      + '</div>';
  }

  renderSettingsSection() {
    return ''
      + '<div class="admin-card games-settings-card">'
      + '<div class="card-heading-row">'
      + '<div>'
      + '<div class="eyebrow">Configuration</div>'
      + '<h3>Game Settings</h3>'
      + '<p>General hamster game settings will live at stores/' + GAME_STORE_ID + '/games/' + HAMSTER_GAME_ID + '/settings/main.</p>'
      + '</div>'
      + '<span class="muted-pill">Ready</span>'
      + '</div>'
      + '<div class="games-settings-grid">'
      + '<div><span>Store</span><strong>' + GAME_STORE_ID + '</strong></div>'
      + '<div><span>Game</span><strong>' + HAMSTER_GAME_ID + '</strong></div>'
      + '<div><span>Minimum active spin pictures</span><strong>' + HAMSTER_SPIN_MIN_IMAGES + '</strong></div>'
      + '</div>'
      + '</div>';
  }

  renderPayoutModal() {
    var openClass = this.payoutModalOpen ? '' : ' hidden';
    return ''
      + '<div id="gamesPayoutModal" class="modal games-payout-modal' + openClass + '" data-games-action="modal-backdrop">'
      + '<div class="modal-panel games-payout-panel" role="dialog" aria-modal="true" aria-labelledby="gamesPayoutTitle">'
      + '<div class="modal-header">'
      + '<div>'
      + '<div class="eyebrow">Hamster Spin</div>'
      + '<h3 id="gamesPayoutTitle">Payouts / Rewards</h3>'
      + '</div>'
      + '<button type="button" class="icon-button" data-games-action="close-payout-modal" aria-label="Close payouts">×</button>'
      + '</div>'
      + '<div class="games-payout-list">'
      + '<div><strong>2 matching pictures</strong><span>Small seed reward based on the matched picture.</span></div>'
      + '<div><strong>3 matching pictures</strong><span>Larger seed reward based on the matched picture.</span></div>'
      + '<div><strong>Premium matches</strong><span>Higher-value rewards are highlighted in the player modal.</span></div>'
      + '</div>'
      + '<button type="button" class="btn-primary" data-games-action="close-payout-modal">Close</button>'
      + '</div>'
      + '</div>';
  }

  async loadSpinImages() {
    if (this.activeSection !== 'spin') {
      return;
    }

    this.renderLoadingImages();

    try {
      var result = await this.runIntent('LoadSpinImagesIntent', {
        storeId: GAME_STORE_ID,
        gameId: HAMSTER_GAME_ID,
        includeInactive: true
      });

      this.lastLoadData = result.data;
      this.images = this.getRenderableImages(result.data);
      this.renderImages(result.data);
    } catch (error) {
      this.lastLoadData = {
        source: 'fallback',
        activeCount: 0,
        minActiveImages: HAMSTER_SPIN_MIN_IMAGES
      };
      this.images = this.normalizeFallbackImages();
      this.showStatus('Could not load managed images. Showing safe fallback pictures.', 'error');
      this.renderImages(this.lastLoadData);
    }
  }

  async handleSubmit(event) {
    event.preventDefault();

    var labelInput = document.getElementById('gamesSpinLabel');
    var urlInput = document.getElementById('gamesSpinImageUrl');
    var fileInput = document.getElementById('gamesSpinImageFile');
    var imageUrl = urlInput ? urlInput.value.trim() : '';
    var label = labelInput ? labelInput.value.trim() : '';
    var file = fileInput && fileInput.files.length ? fileInput.files[0] : null;
    var originalText = this.submitBtn ? this.submitBtn.textContent : 'Add Spin Picture';

    try {
      this.setBusy(true, 'Adding spin image...');

      if (file) {
        imageUrl = await uploadImage(file, STORAGE_PREFIX, {
          autoCompress: true,
          maxDimension: 1200,
          quality: 0.82
        });
      }

      await this.runIntent('AddSpinImageIntent', {
        storeId: GAME_STORE_ID,
        gameId: HAMSTER_GAME_ID,
        imageUrl: imageUrl,
        label: label,
        active: true,
        sortOrder: Date.now()
      });

      if (this.form) {
        this.form.reset();
      }

      this.showStatus('Spin image added.', 'success');
      await this.loadSpinImages();
    } catch (error) {
      this.showStatus(error.message || 'Could not add spin image.', 'error');
    } finally {
      this.setBusy(false, originalText);
    }
  }

  async handleRemoveClick(event) {
    var button = event.currentTarget;
    var imageId = button.getAttribute('data-id') || '';

    try {
      this.showStatus('Removing spin image...', 'warning');
      await this.runIntent('RemoveSpinImageIntent', {
        storeId: GAME_STORE_ID,
        gameId: HAMSTER_GAME_ID,
        id: imageId
      });
      this.showStatus('Spin image removed.', 'success');
      await this.loadSpinImages();
    } catch (error) {
      this.showStatus(error.message || MIN_SPIN_MESSAGE, 'error');
    }
  }

  async openPayoutModal() {
    await this.runIntent('OpenPayoutModalIntent', {
      storeId: GAME_STORE_ID,
      gameId: HAMSTER_GAME_ID
    });
    this.payoutModalOpen = true;
    this.updatePayoutModal();
  }

  async closePayoutModal() {
    await this.runIntent('ClosePayoutModalIntent', {
      storeId: GAME_STORE_ID,
      gameId: HAMSTER_GAME_ID
    });
    this.payoutModalOpen = false;
    this.updatePayoutModal();
  }

  updatePayoutModal() {
    var modal = document.getElementById('gamesPayoutModal');

    if (!modal) {
      return;
    }

    if (this.payoutModalOpen) {
      modal.classList.remove('hidden');
    } else {
      modal.classList.add('hidden');
    }
  }

  async runIntent(type, payload) {
    var factory = this.getIntentFactory(type);
    var intent = factory(
      this.getActor(),
      payload || {},
      {
        db: db,
        storeId: GAME_STORE_ID,
        gameId: HAMSTER_GAME_ID,
        fallbackImages: HAMSTER_DEFAULT_SPIN_IMAGES,
        minActiveImages: HAMSTER_SPIN_MIN_IMAGES,
        source: 'admin'
      }
    );
    var result = await pipeline.run(intent);

    if (!result.ok) {
      throw new Error(this.getResultErrorMessage(result));
    }

    return result;
  }

  getIntentFactory(type) {
    if (type === 'OpenGamesDashboardIntent') {
      return gamesIntent.createOpenGamesDashboardIntent;
    }

    if (type === 'OpenGameDetailIntent') {
      return gamesIntent.createOpenGameDetailIntent;
    }

    if (type === 'LoadGameConfigIntent') {
      return gamesIntent.createLoadGameConfigIntent;
    }

    if (type === 'LoadSpinImagesIntent') {
      return gamesIntent.createLoadSpinImagesIntent;
    }

    if (type === 'AddSpinImageIntent') {
      return gamesIntent.createAddSpinImageIntent;
    }

    if (type === 'RemoveSpinImageIntent') {
      return gamesIntent.createRemoveSpinImageIntent;
    }

    if (type === 'OpenPayoutModalIntent') {
      return gamesIntent.createOpenPayoutModalIntent;
    }

    if (type === 'ClosePayoutModalIntent') {
      return gamesIntent.createClosePayoutModalIntent;
    }

    throw new Error('Unknown games intent.');
  }

  getActor() {
    var app = window.adminApp || {};
    var profile = app.userProfile || {};
    var user = profile.uid || profile.email || 'admin';
    var role = profile.role || 'admin';

    return {
      id: String(user),
      role: String(role)
    };
  }

  bindDashboardEvents() {
    var buttons = this.root.querySelectorAll('[data-games-action="open-detail"]');
    var index = 0;

    while (index < buttons.length) {
      buttons[index].addEventListener('click', this.handleOpenDetailClick.bind(this));
      index = index + 1;
    }
  }

  bindDetailEvents() {
    var backButton = this.root.querySelector('[data-games-action="back-dashboard"]');
    var sectionButtons = this.root.querySelectorAll('[data-games-section]');
    var openPayoutButton = this.root.querySelector('[data-games-action="open-payout-modal"]');
    var closeButtons = this.root.querySelectorAll('[data-games-action="close-payout-modal"]');
    var modal = document.getElementById('gamesPayoutModal');
    var index = 0;

    if (backButton) {
      backButton.addEventListener('click', this.handleBackClick.bind(this));
    }

    while (index < sectionButtons.length) {
      sectionButtons[index].addEventListener('click', this.handleSectionClick.bind(this));
      index = index + 1;
    }

    if (this.form) {
      this.form.addEventListener('submit', this.handleSubmit.bind(this));
    }

    if (openPayoutButton) {
      openPayoutButton.addEventListener('click', this.openPayoutModal.bind(this));
    }

    index = 0;
    while (index < closeButtons.length) {
      closeButtons[index].addEventListener('click', this.closePayoutModal.bind(this));
      index = index + 1;
    }

    if (modal) {
      modal.addEventListener('click', this.handleModalBackdropClick.bind(this));
    }
  }

  async handleOpenDetailClick(event) {
    var gameId = event.currentTarget.getAttribute('data-game-id') || HAMSTER_GAME_ID;
    this.activeSection = 'spin';
    await this.openGameDetail(gameId);
  }

  async handleBackClick() {
    await this.openDashboard();
  }

  async handleSectionClick(event) {
    this.activeSection = event.currentTarget.getAttribute('data-games-section') || 'spin';
    this.renderGameDetail({
      id: HAMSTER_GAME_ID,
      title: 'Hamster Spin Game',
      status: 'Active',
      description: 'Manage spin images, payouts, rewards, and game settings.'
    });

    if (this.activeSection === 'spin') {
      await this.loadSpinImages();
    }
  }

  handleModalBackdropClick(event) {
    if (event.target && event.target.id === 'gamesPayoutModal') {
      this.closePayoutModal();
    }
  }

  handleKeyDown(event) {
    if (event.key === 'Escape' && this.payoutModalOpen) {
      this.closePayoutModal();
    }
  }

  captureElements() {
    this.form = document.getElementById('gamesSpinImageForm');
    this.status = document.getElementById('gamesSpinStatus');
    this.meta = document.getElementById('gamesSpinMeta');
    this.submitBtn = document.getElementById('gamesSpinSubmitBtn');
  }

  bindRemoveButtons() {
    var list = document.getElementById('gamesSpinImagesList');
    var buttons;
    var index = 0;

    if (!list) {
      return;
    }

    buttons = list.querySelectorAll('.games-spin-remove');
    while (index < buttons.length) {
      buttons[index].addEventListener('click', this.handleRemoveClick.bind(this));
      index = index + 1;
    }
  }

  renderLoadingImages() {
    var list = document.getElementById('gamesSpinImagesList');

    if (list) {
      list.innerHTML = '<div class="games-spin-empty">Loading hamster spin pictures...</div>';
    }

    if (this.meta) {
      this.meta.textContent = 'Loading';
    }
  }

  renderImages(data) {
    var list = document.getElementById('gamesSpinImagesList');
    var activeCount = data && typeof data.activeCount === 'number' ? data.activeCount : this.countActiveImages(this.images);
    var source = data && data.source ? data.source : 'fallback';
    var markup = '';
    var index = 0;

    if (!list) {
      return;
    }

    if (this.meta) {
      this.meta.textContent = activeCount + ' active pictures · source: ' + source;
    }

    if (!this.images.length) {
      list.innerHTML = '<div class="games-spin-empty">No spin pictures yet. Add at least 4 active pictures before using spinning mode.</div>';
      return;
    }

    while (index < this.images.length) {
      var image = this.images[index];
      var activeClass = image.active === false ? ' is-inactive' : '';
      var fallback = image.source === 'fallback';
      var removeCopy = fallback ? 'Fallback' : 'Remove';
      var removeDisabled = fallback ? ' disabled' : '';

      markup += ''
        + '<article class="games-spin-card' + activeClass + '">'
        + '<div class="games-spin-thumb"><img src="' + escapeHtml(image.imageUrl) + '" alt="' + escapeHtml(image.label) + '"></div>'
        + '<div class="games-spin-copy">'
        + '<strong>' + escapeHtml(image.label) + '</strong>'
        + '<span>' + (image.active === false ? 'Inactive' : 'Active') + ' · #' + escapeHtml(image.sortOrder || index + 1) + '</span>'
        + '</div>'
        + '<button type="button" class="btn-secondary games-spin-remove" data-id="' + escapeHtml(image.id) + '"' + removeDisabled + '>' + removeCopy + '</button>'
        + '</article>';

      index = index + 1;
    }

    list.innerHTML = markup;
    this.bindRemoveButtons();

    if (source === 'fallback') {
      this.showStatus('Firestore needs at least 4 active pictures. The game is using its safe fallback set for now.', 'warning');
    } else if (activeCount < HAMSTER_SPIN_MIN_IMAGES) {
      this.showStatus(MIN_SPIN_MESSAGE, 'error');
    } else {
      this.clearStatus();
    }
  }

  getRenderableImages(data) {
    var managedImages = data && data.managedImages ? data.managedImages : [];

    if (managedImages.length) {
      return managedImages;
    }

    return this.normalizeFallbackImages();
  }

  normalizeFallbackImages() {
    var images = [];
    var index = 0;

    while (index < HAMSTER_DEFAULT_SPIN_IMAGES.length) {
      var item = HAMSTER_DEFAULT_SPIN_IMAGES[index];
      images.push({
        id: item.id,
        imageUrl: item.imageUrl,
        label: item.label,
        active: true,
        sortOrder: item.sortOrder,
        source: 'fallback'
      });
      index = index + 1;
    }

    return images;
  }

  countActiveImages(images) {
    var count = 0;
    var index = 0;

    while (index < images.length) {
      if (images[index].active !== false) {
        count = count + 1;
      }
      index = index + 1;
    }

    return count;
  }

  setBusy(isBusy, text) {
    if (this.submitBtn) {
      this.submitBtn.disabled = isBusy;
      this.submitBtn.textContent = text;
    }
  }

  showStatus(message, type) {
    if (!this.status) {
      return;
    }

    this.status.textContent = message;
    this.status.hidden = false;
    this.status.className = 'inline-alert ' + (type || 'warning');
  }

  clearStatus() {
    if (!this.status) {
      return;
    }

    this.status.textContent = '';
    this.status.hidden = true;
    this.status.className = 'inline-alert';
  }

  getSectionButtonClass(section) {
    return this.activeSection === section ? 'games-section-tab active' : 'games-section-tab';
  }

  getResultErrorMessage(result) {
    if (result && result.errors && result.errors.length) {
      return result.errors.join(' ');
    }

    return 'Games action failed.';
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
