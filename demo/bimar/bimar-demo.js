(function () {
  const data = window.BIMAR_DEMO_DATA;
  const state = {
    branchId: data.branches[0].id,
    category: "All",
    selectedProductId: null
  };

  const selectors = {
    branchSelector: document.getElementById("branchSelector"),
    localOfferTitle: document.getElementById("localOfferTitle"),
    pickupLocation: document.getElementById("pickupLocation"),
    availableCount: document.getElementById("availableCount"),
    categoryTabs: document.getElementById("categoryTabs"),
    productGrid: document.getElementById("productGrid"),
    emptyProducts: document.getElementById("emptyProducts"),
    campaignGrid: document.getElementById("campaignGrid"),
    productModal: document.getElementById("productModal"),
    productModalContent: document.getElementById("productModalContent"),
    campaignModal: document.getElementById("campaignModal"),
    campaignModalContent: document.getElementById("campaignModalContent"),
    loyaltyProgress: document.getElementById("loyaltyProgress"),
    loyaltyBalance: document.getElementById("loyaltyBalance"),
    earnedPointsText: document.getElementById("earnedPointsText"),
    metricGrid: document.getElementById("metricGrid"),
    channelChart: document.getElementById("channelChart"),
    funnelChart: document.getElementById("funnelChart"),
    usePointsButton: document.getElementById("usePointsButton")
  };

  function init() {
    renderBranchOptions();
    renderCategoryTabs();
    renderProducts();
    renderCampaigns();
    renderDashboard();
    updateBranchContext();
    updateLoyalty(0);
    bindEvents();
  }

  function bindEvents() {
    selectors.branchSelector.addEventListener("change", function (event) {
      state.branchId = event.target.value;
      updateBranchContext();
      renderProducts();
    });

    selectors.categoryTabs.addEventListener("click", function (event) {
      const button = event.target.closest("button[data-category]");
      if (!button) return;
      state.category = button.dataset.category;
      renderCategoryTabs();
      renderProducts();
    });

    selectors.productGrid.addEventListener("click", function (event) {
      const productButton = event.target.closest("[data-product-action]");
      if (!productButton) return;
      const product = findProduct(productButton.dataset.productId);
      if (!product) return;

      if (productButton.dataset.productAction === "view") {
        openProductModal(product);
      } else {
        updateLoyalty(product.points);
        openDemoLink(product, "Website Order");
      }
    });

    selectors.campaignGrid.addEventListener("click", function (event) {
      const campaignButton = event.target.closest("[data-campaign-id]");
      if (!campaignButton) return;
      const campaign = data.campaigns.find(function (item) {
        return item.id === campaignButton.dataset.campaignId;
      });
      if (campaign) openCampaignModal(campaign);
    });

    document.addEventListener("click", function (event) {
      const closeButton = event.target.closest("[data-close-modal]");
      const backdrop = event.target.classList.contains("modal-backdrop") ? event.target : null;
      if (closeButton || backdrop) closeModals();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeModals();
    });

    selectors.usePointsButton.addEventListener("click", function () {
      selectors.earnedPointsText.textContent = "Demo applied: 500 points reserved for your next order.";
      selectors.loyaltyBalance.textContent = "380 pts";
      selectors.loyaltyProgress.style.width = "38%";
    });
  }

  function renderBranchOptions() {
    selectors.branchSelector.innerHTML = data.branches.map(function (branch) {
      return `<option value="${branch.id}">${escapeHtml(branch.name)}</option>`;
    }).join("");
  }

  function renderCategoryTabs() {
    const categories = ["All"].concat(data.categories);
    selectors.categoryTabs.innerHTML = categories.map(function (category) {
      const activeClass = category === state.category ? "is-active" : "";
      return `<button class="${activeClass}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`;
    }).join("");
  }

  function renderProducts() {
    const products = getVisibleProducts();
    selectors.emptyProducts.hidden = products.length > 0;
    selectors.productGrid.innerHTML = products.map(createProductCard).join("");
  }

  function getProductImage(tone) {
    const images = {
      meat: "https://images.unsplash.com/photo-1603048297172-c92544798d5e?auto=format&fit=crop&w=600&q=80",
      bakery: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
      meal: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=600&q=80",
      drink: "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=600&q=80",
      produce: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=600&q=80",
      gift: "https://images.unsplash.com/photo-1513885535751-8b9f0aa364ce?auto=format&fit=crop&w=600&q=80"
    };
    return images[tone] || images.produce;
  }

  function createProductCard(product) {
    const available = isAvailable(product);
    const availabilityLabel = available ? "Available now" : "Not at selected branch";
    const availabilityClass = available ? "is-available" : "is-unavailable";
    const availabilityIcon = available ? "ph-check-circle" : "ph-x-circle";
    const bgImage = getProductImage(product.tone);

    return `
      <article class="product-card">
        <div class="product-art" style="background-image: url('${bgImage}')" aria-label="${escapeHtml(product.name)} image">
          <span class="category-badge">${escapeHtml(product.category)}</span>
        </div>
        <div class="product-card-body">
          <div class="product-meta-line">
            <span><i class="ph-bold ph-tag"></i> ${escapeHtml(product.category)}</span>
            <strong>${formatPrice(product.price)}</strong>
          </div>
          <h3>${escapeHtml(product.name)}</h3>
          <p>${escapeHtml(product.description)}</p>
          <div class="product-badges">
            <span class="loyalty-badge"><i class="ph-fill ph-star"></i> ${product.points} pts</span>
            <span class="${availabilityClass}"><i class="ph-fill ${availabilityIcon}"></i> ${availabilityLabel}</span>
          </div>
          <div class="branch-list">${renderBranchAvailability(product)}</div>
          <div class="product-actions">
            <button class="button button-secondary" type="button" data-product-action="view" data-product-id="${product.id}">View Details</button>
            <button class="button button-primary" type="button" data-product-action="order" data-product-id="${product.id}" ${available ? "" : "disabled"}>Order Now</button>
          </div>
        </div>
      </article>
    `;
  }

  function renderBranchAvailability(product) {
    return data.branches.map(function (branch) {
      const availableClass = product.availability.includes(branch.id) ? "branch-chip-on" : "branch-chip-off";
      return `<span class="${availableClass}">${escapeHtml(branch.name)}</span>`;
    }).join("");
  }

  function getCampaignImage(index) {
    const images = [
      "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1513885535751-8b9f0aa364ce?auto=format&fit=crop&w=800&q=80"
    ];
    return images[index % images.length];
  }

  function renderCampaigns() {
    selectors.campaignGrid.innerHTML = data.campaigns.map(function (campaign, index) {
      const bgImage = getCampaignImage(index);
      return `
        <article class="campaign-card">
          <div class="campaign-art" style="background-image: url('${bgImage}')">
            <span class="campaign-sale-badge">${escapeHtml(campaign.offer)}</span>
          </div>
          <div class="campaign-card-body">
            <div class="campaign-topline">
              <strong class="timer-badge"><i class="ph-bold ph-clock"></i> Ends in ${escapeHtml(campaign.countdown)}</strong>
            </div>
            <h3>${escapeHtml(campaign.title)}</h3>
            <p>${escapeHtml(campaign.description)}</p>
            <div class="countdown-visual" aria-label="Countdown timer visual">
              <div class="timer-block"><span>02</span><small>Days</small></div>
              <div class="timer-block"><span>14</span><small>Hrs</small></div>
              <div class="timer-block"><span>45</span><small>Min</small></div>
            </div>
            <button class="button button-primary" type="button" data-campaign-id="${campaign.id}">View Campaign <i class="ph-bold ph-arrow-right"></i></button>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderDashboard() {
    selectors.metricGrid.innerHTML = data.dashboard.metrics.map(function (metric) {
      return `
        <article class="metric-card">
          <span>${escapeHtml(metric[0])}</span>
          <strong>${escapeHtml(metric[1])}</strong>
        </article>
      `;
    }).join("");

    selectors.channelChart.innerHTML = data.dashboard.channels.map(function (channel) {
      return `
        <div class="bar-row">
          <span>${escapeHtml(channel[0])}</span>
          <div><i style="width:${channel[1]}%"></i></div>
          <strong>${channel[1]}%</strong>
        </div>
      `;
    }).join("");

    selectors.funnelChart.innerHTML = data.dashboard.funnel.map(function (step) {
      return `
        <div class="funnel-step" style="width:${step[2]}%">
          <span>${escapeHtml(step[0])}</span>
          <strong>${escapeHtml(step[1])}</strong>
        </div>
      `;
    }).join("");
  }

  function openProductModal(product) {
    state.selectedProductId = product.id;
    const branch = getSelectedBranch();
    const relatedProducts = product.related.map(findProduct).filter(Boolean);
    const available = isAvailable(product);
    const bgImage = getProductImage(product.tone);
    const availabilityIcon = available ? "ph-check-circle" : "ph-x-circle";
    const availabilityColor = available ? "is-available" : "is-unavailable";

    selectors.productModalContent.innerHTML = `
      <div class="modal-product-layout">
        <div class="product-art product-art-large" style="background-image: url('${bgImage}')" aria-label="${escapeHtml(product.name)} image">
          <span class="category-badge">${escapeHtml(product.category)}</span>
        </div>
        <div>
          <p class="eyebrow"><i class="ph-bold ph-tag"></i> ${escapeHtml(product.category)}</p>
          <h2 id="productModalTitle">${escapeHtml(product.name)}</h2>
          <p class="modal-description">${escapeHtml(product.description)}</p>
          <div class="modal-price-row">
            <strong>${formatPrice(product.price)}</strong>
            <span class="loyalty-badge"><i class="ph-fill ph-star"></i> Earn ${product.points} loyalty points</span>
          </div>
          <div class="nutrition-row">
             <span><i class="ph-fill ph-leaf"></i> Fresh</span>
             <span><i class="ph-fill ph-check-square-offset"></i> Premium Quality</span>
          </div>
          <div class="availability-panel">
            <strong><i class="ph-bold ph-storefront"></i> Availability by branch</strong>
            <div class="branch-list">${renderBranchAvailability(product)}</div>
            <p class="availability-text ${availabilityColor}"><i class="ph-fill ${availabilityIcon}"></i> ${available ? "Ready for pickup at " + branch.name : "Not available at " + branch.name + " today."}</p>
          </div>
          <div class="order-options">
            <strong><i class="ph-bold ph-shopping-bag"></i> Order options</strong>
            <div class="order-option-grid">
              ${createOrderButtons(product)}
            </div>
          </div>
        </div>
      </div>
      <section class="related-products">
        <h3><i class="ph-bold ph-arrows-merge"></i> Frequently bought together</h3>
        <div class="related-grid">
          ${relatedProducts.map(function (item) {
            const itemImg = getProductImage(item.tone);
            return `
              <button type="button" class="related-item" data-related-product="${item.id}">
                <div class="related-img" style="background-image: url('${itemImg}')"></div>
                <div class="related-info">
                  <span class="related-name">${escapeHtml(item.name)}</span>
                  <span class="related-price">${formatPrice(item.price)}</span>
                </div>
              </button>
            `;
          }).join("")}
        </div>
      </section>
    `;

    selectors.productModal.hidden = false;
    document.body.classList.add("modal-open");

    selectors.productModalContent.querySelectorAll("[data-order-channel]").forEach(function (button) {
      button.addEventListener("click", function () {
        updateLoyalty(product.points);
        openDemoLink(product, button.dataset.orderChannel);
      });
    });

    selectors.productModalContent.querySelectorAll("[data-related-product]").forEach(function (button) {
      button.addEventListener("click", function () {
        const related = findProduct(button.dataset.relatedProduct);
        if (related) openProductModal(related);
      });
    });
  }

  function createOrderButtons(product) {
    const channels = [
      { name: "Website", icon: "ph-globe", class: "btn-web" },
      { name: "WhatsApp", icon: "ph-whatsapp-logo", class: "btn-whatsapp" },
      { name: "Telegram", icon: "ph-telegram-logo", class: "btn-telegram" },
      { name: "Glovo", icon: "ph-moped", class: "btn-glovo" },
      { name: "Yandex", icon: "ph-car", class: "btn-yandex" },
      { name: "Pickup", icon: "ph-storefront", class: "btn-pickup" }
    ];

    return channels.map(function (channel) {
      return `<button class="button channel-button ${channel.class}" type="button" data-order-channel="${escapeHtml(channel.name)}">
                <i class="ph-fill ${channel.icon}"></i> ${escapeHtml(channel.name)}
              </button>`;
    }).join("");
  }

  function openCampaignModal(campaign) {
    const campaignProducts = campaign.products.map(findProduct).filter(Boolean);
    const bgImage = getCampaignImage(data.campaigns.indexOf(campaign));
    
    selectors.campaignModalContent.innerHTML = `
      <div class="campaign-modal-hero" style="background-image: linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.8)), url('${bgImage}')">
        <div class="campaign-modal-hero-content">
          <p class="eyebrow"><i class="ph-bold ph-megaphone"></i> Campaign landing page</p>
          <h2 id="campaignModalTitle">${escapeHtml(campaign.title)}</h2>
          <p>${escapeHtml(campaign.description)}</p>
          <strong class="campaign-sale-badge">${escapeHtml(campaign.offer)}</strong>
        </div>
        <div class="mini-qr-wrapper">
          <div class="mini-qr" aria-label="QR code placeholder">
            <span></span><span></span><span></span><span></span><span></span><span></span>
            <span></span><span></span><span></span><span></span><span></span><span></span>
            <span></span><span></span><span></span><span></span><span></span><span></span>
          </div>
          <p class="qr-caption">Scan to preview</p>
        </div>
      </div>
      <div class="share-link"><i class="ph-bold ph-link"></i> Share link: <code>oako.kg/bimar/c/${escapeHtml(campaign.id)}</code></div>
      <div class="campaign-content-layout">
        <div class="campaign-products-section">
          <h3>Featured Products</h3>
          <div class="campaign-product-list">
            ${campaignProducts.map(function (product) {
              const itemImg = getProductImage(product.tone);
              return `
                <div class="campaign-product-item">
                  <div class="cp-img" style="background-image: url('${itemImg}')"></div>
                  <div class="cp-info">
                    <span>${escapeHtml(product.name)}</span>
                    <strong>${formatPrice(product.price)}</strong>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
        <div class="campaign-stats-section">
          <h3>Campaign Analytics</h3>
          <div class="campaign-stats">
            <div><span><i class="ph-bold ph-eye"></i> Views</span><strong>${escapeHtml(campaign.stats.views)}</strong></div>
            <div><span><i class="ph-bold ph-cursor-click"></i> Clicks</span><strong>${escapeHtml(campaign.stats.clicks)}</strong></div>
            <div><span><i class="ph-bold ph-shopping-bag"></i> Orders</span><strong>${escapeHtml(campaign.stats.orders)}</strong></div>
            <div><span><i class="ph-bold ph-trend-up"></i> Conversion rate</span><strong>${escapeHtml(campaign.stats.conversion)}</strong></div>
          </div>
        </div>
      </div>
    `;
    selectors.campaignModal.hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeModals() {
    selectors.productModal.hidden = true;
    selectors.campaignModal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  function updateBranchContext() {
    const branch = getSelectedBranch();
    const availableCount = data.products.filter(isAvailable).length;
    selectors.localOfferTitle.textContent = branch.localOffer;
    selectors.pickupLocation.textContent = branch.pickup;
    selectors.availableCount.textContent = String(availableCount);
  }

  function updateLoyalty(pointsEarned) {
    const basePoints = 880;
    const nextReward = 1000;
    const total = Math.min(basePoints + pointsEarned, nextReward);
    const percent = Math.round((total / nextReward) * 100);
    selectors.loyaltyBalance.textContent = `${total} pts`;
    selectors.loyaltyProgress.style.width = `${percent}%`;
    selectors.earnedPointsText.textContent = pointsEarned
      ? `This demo order would earn ${pointsEarned} points.`
      : "Add a product to preview earned points.";
  }

  function openDemoLink(product, channel) {
    const branch = getSelectedBranch();
    selectors.earnedPointsText.textContent = `${channel} demo link selected for ${product.name} at ${branch.name}.`;
  }

  function getVisibleProducts() {
    return data.products.filter(function (product) {
      return state.category === "All" || product.category === state.category;
    });
  }

  function getSelectedBranch() {
    return data.branches.find(function (branch) {
      return branch.id === state.branchId;
    }) || data.branches[0];
  }

  function isAvailable(product) {
    return product.availability.includes(state.branchId);
  }

  function findProduct(productId) {
    return data.products.find(function (product) {
      return product.id === productId;
    });
  }

  function formatPrice(value) {
    return `${Number(value).toLocaleString("en-US")} KGS`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  init();
})();
