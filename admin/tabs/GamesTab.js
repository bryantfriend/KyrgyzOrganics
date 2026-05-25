import { db } from '../../firebase-config.js';
import pipeline from '../../ICF/engine/pipeline.js';
import gamesIntent from '../../ICF/Intents/GamesIntent.js';
import { HAMSTER_DEFAULT_SPIN_IMAGES, HAMSTER_SPIN_MIN_IMAGES } from '../../hamster_game/spin-image-defaults.js';
import { HAMSTER_DEFAULT_PAYOUT_RULES } from '../../hamster_game/payout-defaults.js';
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
    this.payoutRules = [];
    this.payoutSource = 'fallback';
    this.payoutEditingId = '';
    this.payoutFormOpen = false;
    this.payoutStatusMessage = '';
    this.payoutStatusType = 'warning';
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
      + '<h3 id="gamesPayoutTitle">Hamster Spin Payouts / Rewards</h3>'
      + '</div>'
      + '<button type="button" class="icon-button" data-games-action="close-payout-modal" aria-label="Close payouts">×</button>'
      + '</div>'
      + '<div class="games-payout-toolbar">'
      + '<span class="muted-pill">source: ' + escapeHtml(this.payoutSource) + '</span>'
      + '<button type="button" class="btn-primary" data-games-action="add-payout-rule">Add Reward</button>'
      + '</div>'
      + this.renderPayoutStatus()
      + this.renderPayoutRuleForm()
      + this.renderPayoutRulesList()
      + '<div class="games-payout-footer">'
      + '<button type="button" class="btn-secondary" data-games-action="load-payout-rules">Refresh</button>'
      + '<button type="button" class="btn-primary" data-games-action="close-payout-modal">Close</button>'
      + '</div>'
      + '</div>'
      + '</div>';
  }

  renderPayoutStatus() {
    if (!this.payoutStatusMessage) {
      return '<div id="gamesPayoutStatus" class="inline-alert" hidden></div>';
    }

    return '<div id="gamesPayoutStatus" class="inline-alert ' + escapeHtml(this.payoutStatusType) + '">' + escapeHtml(this.payoutStatusMessage) + '</div>';
  }

  renderPayoutRuleForm() {
    var rule = this.getEditingPayoutRule();
    var hiddenClass = this.payoutFormOpen ? '' : ' hidden';
    var title = this.payoutEditingId ? 'Edit Reward Rule' : 'Add Reward Rule';
    var active = rule ? rule.active !== false : true;

    return ''
      + '<form id="gamesPayoutRuleForm" class="games-payout-form' + hiddenClass + '">'
      + '<h4>' + title + '</h4>'
      + '<input type="hidden" id="gamesPayoutRuleId" value="' + escapeHtml(rule ? rule.id : '') + '">'
      + '<div class="games-payout-form-grid">'
      + '<label>Reward Name<input type="text" id="gamesPayoutRewardName" value="' + escapeHtml(rule ? rule.rewardName : '') + '" placeholder="Three Matches" required></label>'
      + '<label>Reward Type<select id="gamesPayoutRewardType">'
      + this.renderRewardTypeOptions(rule ? rule.rewardType : 'poppy')
      + '</select></label>'
      + '<label>Match Type<select id="gamesPayoutMatchType">'
      + this.renderMatchTypeOptions(rule ? rule.matchType : 'matches')
      + '</select></label>'
      + '<label>Required Matches<input type="number" id="gamesPayoutRequiredMatches" min="1" step="1" value="' + escapeHtml(rule ? rule.requiredMatches : 2) + '" required></label>'
      + '<label>Payout Amount<input type="number" id="gamesPayoutAmount" min="0" step="1" value="' + escapeHtml(rule ? rule.payoutAmount : 1) + '" required></label>'
      + '<label>Payout Label<input type="text" id="gamesPayoutLabel" value="' + escapeHtml(rule ? rule.payoutLabel : '1 seed') + '" placeholder="1 seed"></label>'
      + '<label>Sort Order<input type="number" id="gamesPayoutSortOrder" step="1" value="' + escapeHtml(rule ? rule.sortOrder : Date.now()) + '"></label>'
      + '<label class="games-payout-checkbox"><input type="checkbox" id="gamesPayoutActive" ' + (active ? 'checked' : '') + '> Active</label>'
      + '</div>'
      + '<div class="games-payout-form-actions">'
      + '<button type="submit" class="btn-primary">Save</button>'
      + '<button type="button" class="btn-secondary" data-games-action="cancel-payout-edit">Cancel</button>'
      + '</div>'
      + '</form>';
  }

  renderRewardTypeOptions(selectedType) {
    var types = ['poppy', 'sesame', 'almond', 'walnut'];
    var markup = '';
    var index = 0;

    while (index < types.length) {
      markup += '<option value="' + types[index] + '"' + (selectedType === types[index] ? ' selected' : '') + '>' + types[index] + '</option>';
      index = index + 1;
    }

    return markup;
  }

  renderMatchTypeOptions(selectedType) {
    var types = ['matches', 'jackpot'];
    var markup = '';
    var index = 0;

    while (index < types.length) {
      markup += '<option value="' + types[index] + '"' + (selectedType === types[index] ? ' selected' : '') + '>' + types[index] + '</option>';
      index = index + 1;
    }

    return markup;
  }

  renderPayoutRulesList() {
    if (!this.payoutRules.length) {
      return '<div class="games-payout-empty">No payout rules yet. Add a reward rule to begin.</div>';
    }

    var markup = '<div class="games-payout-table" role="table" aria-label="Hamster spin payout rules">';
    var index = 0;

    markup += '<div class="games-payout-row games-payout-row-head" role="row"><span>Name</span><span>Match</span><span>Payout</span><span>Status</span><span>Actions</span></div>';

    while (index < this.payoutRules.length) {
      var rule = this.payoutRules[index];
      var activeCopy = rule.active === false ? 'Inactive' : 'Active';
      var toggleCopy = rule.active === false ? 'Activate' : 'Deactivate';
      var disabled = rule.source === 'fallback' ? ' disabled' : '';
      var sourceCopy = rule.source === 'fallback' ? 'Fallback' : activeCopy;

      markup += ''
        + '<div class="games-payout-row" role="row">'
        + '<span><strong>' + escapeHtml(rule.rewardName) + '</strong><small>' + escapeHtml(rule.rewardType) + '</small></span>'
        + '<span>' + escapeHtml(rule.matchType) + '<small>' + escapeHtml(rule.requiredMatches) + ' matches</small></span>'
        + '<span>' + escapeHtml(rule.payoutLabel || rule.payoutAmount) + '<small>sort ' + escapeHtml(rule.sortOrder) + '</small></span>'
        + '<span><span class="status-badge ' + (rule.active === false ? 'warning' : 'success') + '">' + escapeHtml(sourceCopy) + '</span></span>'
        + '<span class="games-payout-row-actions">'
        + '<button type="button" class="btn-secondary" data-games-action="edit-payout-rule" data-id="' + escapeHtml(rule.id) + '"' + disabled + '>Edit</button>'
        + '<button type="button" class="btn-secondary" data-games-action="toggle-payout-rule" data-id="' + escapeHtml(rule.id) + '"' + disabled + '>' + toggleCopy + '</button>'
        + '<button type="button" class="btn-secondary" data-games-action="remove-payout-rule" data-id="' + escapeHtml(rule.id) + '"' + disabled + '>Remove</button>'
        + '</span>'
        + '</div>';
      index = index + 1;
    }

    markup += '</div>';
    return markup;
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
    await this.loadPayoutRules();
    this.renderGameDetail(this.getHamsterGameSummary());
  }

  async closePayoutModal() {
    await this.runIntent('ClosePayoutModalIntent', {
      storeId: GAME_STORE_ID,
      gameId: HAMSTER_GAME_ID
    });
    this.payoutModalOpen = false;
    this.payoutFormOpen = false;
    this.payoutEditingId = '';
    this.renderGameDetail(this.getHamsterGameSummary());
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

  async loadPayoutRules() {
    try {
      var result = await this.runIntent('LoadPayoutRulesIntent', {
        storeId: GAME_STORE_ID,
        gameId: HAMSTER_GAME_ID,
        includeInactive: true
      });

      this.payoutRules = result.data.payoutRules || [];
      this.payoutSource = result.data.source || 'fallback';

      if (this.payoutSource === 'fallback') {
        this.setPayoutStatus('Firestore payout rules are empty. Showing the safe fallback payout table.', 'warning');
      } else if (!this.payoutRules.length) {
        this.setPayoutStatus('No payout rules yet. Add a reward rule to begin.', 'warning');
      } else {
        this.clearPayoutStatus();
      }
    } catch (error) {
      this.payoutRules = this.normalizeFallbackPayoutRules();
      this.payoutSource = 'fallback';
      this.setPayoutStatus('Could not load managed payout rules. Showing safe fallback rewards.', 'error');
    }
  }

  async savePayoutRule(event) {
    event.preventDefault();

    var payload = this.readPayoutFormPayload();
    var intentType = payload.id ? 'UpdatePayoutRuleIntent' : 'AddPayoutRuleIntent';

    try {
      await this.runIntent(intentType, payload);
      this.payoutFormOpen = false;
      this.payoutEditingId = '';
      await this.loadPayoutRules();
      this.setPayoutStatus('Payout rule saved.', 'success');
      this.renderGameDetail(this.getHamsterGameSummary());
    } catch (error) {
      this.setPayoutStatus(error.message || 'Could not save payout rule.', 'error');
      this.renderGameDetail(this.getHamsterGameSummary());
    }
  }

  async togglePayoutRule(event) {
    var id = event.currentTarget.getAttribute('data-id') || '';

    try {
      await this.runIntent('TogglePayoutRuleIntent', {
        storeId: GAME_STORE_ID,
        gameId: HAMSTER_GAME_ID,
        id: id
      });
      await this.loadPayoutRules();
      this.setPayoutStatus('Payout rule status updated.', 'success');
      this.renderGameDetail(this.getHamsterGameSummary());
    } catch (error) {
      this.setPayoutStatus(error.message || 'Could not update payout rule.', 'error');
      this.renderGameDetail(this.getHamsterGameSummary());
    }
  }

  async removePayoutRule(event) {
    var id = event.currentTarget.getAttribute('data-id') || '';

    try {
      await this.runIntent('RemovePayoutRuleIntent', {
        storeId: GAME_STORE_ID,
        gameId: HAMSTER_GAME_ID,
        id: id
      });
      await this.loadPayoutRules();
      this.setPayoutStatus('Payout rule removed.', 'success');
      this.renderGameDetail(this.getHamsterGameSummary());
    } catch (error) {
      this.setPayoutStatus(error.message || 'Could not remove payout rule.', 'error');
      this.renderGameDetail(this.getHamsterGameSummary());
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
        fallbackPayoutRules: HAMSTER_DEFAULT_PAYOUT_RULES,
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

    if (type === 'LoadPayoutRulesIntent') {
      return gamesIntent.createLoadPayoutRulesIntent;
    }

    if (type === 'AddPayoutRuleIntent') {
      return gamesIntent.createAddPayoutRuleIntent;
    }

    if (type === 'UpdatePayoutRuleIntent') {
      return gamesIntent.createUpdatePayoutRuleIntent;
    }

    if (type === 'RemovePayoutRuleIntent') {
      return gamesIntent.createRemovePayoutRuleIntent;
    }

    if (type === 'TogglePayoutRuleIntent') {
      return gamesIntent.createTogglePayoutRuleIntent;
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
    var addPayoutButton = this.root.querySelector('[data-games-action="add-payout-rule"]');
    var payoutForm = document.getElementById('gamesPayoutRuleForm');
    var cancelPayoutButton = this.root.querySelector('[data-games-action="cancel-payout-edit"]');
    var refreshPayoutButton = this.root.querySelector('[data-games-action="load-payout-rules"]');
    var editPayoutButtons = this.root.querySelectorAll('[data-games-action="edit-payout-rule"]');
    var togglePayoutButtons = this.root.querySelectorAll('[data-games-action="toggle-payout-rule"]');
    var removePayoutButtons = this.root.querySelectorAll('[data-games-action="remove-payout-rule"]');
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

    if (addPayoutButton) {
      addPayoutButton.addEventListener('click', this.startAddPayoutRule.bind(this));
    }

    if (payoutForm) {
      payoutForm.addEventListener('submit', this.savePayoutRule.bind(this));
    }

    if (cancelPayoutButton) {
      cancelPayoutButton.addEventListener('click', this.cancelPayoutEdit.bind(this));
    }

    if (refreshPayoutButton) {
      refreshPayoutButton.addEventListener('click', this.handleRefreshPayoutRules.bind(this));
    }

    index = 0;
    while (index < closeButtons.length) {
      closeButtons[index].addEventListener('click', this.closePayoutModal.bind(this));
      index = index + 1;
    }

    index = 0;
    while (index < editPayoutButtons.length) {
      editPayoutButtons[index].addEventListener('click', this.startEditPayoutRule.bind(this));
      index = index + 1;
    }

    index = 0;
    while (index < togglePayoutButtons.length) {
      togglePayoutButtons[index].addEventListener('click', this.togglePayoutRule.bind(this));
      index = index + 1;
    }

    index = 0;
    while (index < removePayoutButtons.length) {
      removePayoutButtons[index].addEventListener('click', this.removePayoutRule.bind(this));
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
    this.renderGameDetail(this.getHamsterGameSummary());

    if (this.activeSection === 'spin') {
      await this.loadSpinImages();
    }
  }

  startAddPayoutRule() {
    this.payoutEditingId = '';
    this.payoutFormOpen = true;
    this.renderGameDetail(this.getHamsterGameSummary());
  }

  startEditPayoutRule(event) {
    this.payoutEditingId = event.currentTarget.getAttribute('data-id') || '';
    this.payoutFormOpen = true;
    this.renderGameDetail(this.getHamsterGameSummary());
  }

  cancelPayoutEdit() {
    this.payoutEditingId = '';
    this.payoutFormOpen = false;
    this.renderGameDetail(this.getHamsterGameSummary());
  }

  async handleRefreshPayoutRules() {
    await this.loadPayoutRules();
    this.renderGameDetail(this.getHamsterGameSummary());
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

  readPayoutFormPayload() {
    var idInput = document.getElementById('gamesPayoutRuleId');
    var rewardNameInput = document.getElementById('gamesPayoutRewardName');
    var rewardTypeInput = document.getElementById('gamesPayoutRewardType');
    var matchTypeInput = document.getElementById('gamesPayoutMatchType');
    var requiredMatchesInput = document.getElementById('gamesPayoutRequiredMatches');
    var amountInput = document.getElementById('gamesPayoutAmount');
    var labelInput = document.getElementById('gamesPayoutLabel');
    var sortInput = document.getElementById('gamesPayoutSortOrder');
    var activeInput = document.getElementById('gamesPayoutActive');
    var id = idInput ? idInput.value.trim() : '';
    var rewardType = rewardTypeInput ? rewardTypeInput.value : 'poppy';
    var payoutAmount = amountInput ? Number(amountInput.value) : 0;

    return {
      id: id,
      storeId: GAME_STORE_ID,
      gameId: HAMSTER_GAME_ID,
      rewardName: rewardNameInput ? rewardNameInput.value.trim() : '',
      rewardType: rewardType,
      matchType: matchTypeInput ? matchTypeInput.value : 'matches',
      requiredMatches: requiredMatchesInput ? Number(requiredMatchesInput.value) : 1,
      payoutAmount: payoutAmount,
      payoutLabel: labelInput && labelInput.value.trim() ? labelInput.value.trim() : this.buildPayoutLabel(payoutAmount, rewardType),
      active: activeInput ? activeInput.checked : true,
      sortOrder: sortInput && sortInput.value ? Number(sortInput.value) : Date.now()
    };
  }

  getEditingPayoutRule() {
    var index = 0;

    while (index < this.payoutRules.length) {
      if (this.payoutRules[index].id === this.payoutEditingId) {
        return this.payoutRules[index];
      }
      index = index + 1;
    }

    return null;
  }

  normalizeFallbackPayoutRules() {
    var rules = [];
    var index = 0;

    while (index < HAMSTER_DEFAULT_PAYOUT_RULES.length) {
      var rule = HAMSTER_DEFAULT_PAYOUT_RULES[index];
      rules.push({
        id: rule.id,
        rewardName: rule.rewardName,
        rewardType: rule.rewardType,
        matchType: rule.matchType,
        requiredMatches: rule.requiredMatches,
        payoutAmount: rule.payoutAmount,
        payoutLabel: rule.payoutLabel,
        active: rule.active !== false,
        sortOrder: rule.sortOrder,
        source: 'fallback'
      });
      index = index + 1;
    }

    return rules;
  }

  setPayoutStatus(message, type) {
    this.payoutStatusMessage = message || '';
    this.payoutStatusType = type || 'warning';
  }

  clearPayoutStatus() {
    this.payoutStatusMessage = '';
    this.payoutStatusType = 'warning';
  }

  getHamsterGameSummary() {
    return {
      id: HAMSTER_GAME_ID,
      title: 'Hamster Spin Game',
      status: 'Active',
      description: 'Manage spin images, payouts, rewards, and game settings.'
    };
  }

  buildPayoutLabel(amount, rewardType) {
    var safeAmount = isFinite(Number(amount)) ? Number(amount) : 0;
    var safeType = rewardType || 'seed';

    if (safeType === 'poppy') {
      safeType = safeAmount === 1 ? 'seed' : 'seeds';
    }

    return String(safeAmount) + ' ' + safeType;
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
