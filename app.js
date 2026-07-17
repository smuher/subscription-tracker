/**
 * SubTrack | Premium Subscription Tracker - Core JavaScript Logic
 * Handles state management, UI rendering, calculations, charts, and native notifications.
 */

// ==========================================================================
// STATE MANAGEMENT & CONSTANTS
// ==========================================================================
let state = {
  subscriptions: [],
  dismissedAlerts: [], // Array of strings: 'subId-date-type'
  activeTab: 'dashboard',
  activeFilter: 'all', // 'all', 'service', 'product'
  theme: 'dark', // 'dark', 'light'
  categoryFilter: 'all',
  searchQuery: '',
  sortKey: 'renewal-soon'
};

const STORAGE_KEYS = {
  SUBS: 'subtrack_subscriptions',
  DISMISSED: 'subtrack_dismissed_alerts',
  THEME: 'subtrack_theme'
};

const CATEGORY_COLORS = {
  'Entertainment': '#818cf8',      // Indigo
  'Utilities': '#f59e0b',          // Orange
  'SaaS': '#3b82f6',              // Blue
  'Health & Wellness': '#10b981',  // Emerald
  'Productivity': '#ec4899',      // Pink
  'Food & Drink': '#ef4444',       // Red
  'Shopping': '#14b8a6',           // Teal
  'Others': '#8b5cf6'             // Purple
};

// ==========================================================================
// APPLICATION INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  loadLocalStorage();
  applySavedTheme();
  setupEventListeners();
  switchTab(state.activeTab);
  checkNotificationPermissionsOnLoad();
  checkUpcomingRenewals();
  registerServiceWorker();
});

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  }
}

function loadLocalStorage() {
  try {
    const storedSubs = localStorage.getItem(STORAGE_KEYS.SUBS);
    if (storedSubs) state.subscriptions = JSON.parse(storedSubs);

    const storedDismissed = localStorage.getItem(STORAGE_KEYS.DISMISSED);
    if (storedDismissed) state.dismissedAlerts = JSON.parse(storedDismissed);

    const storedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    if (storedTheme) state.theme = storedTheme;
  } catch (e) {
    console.error('Failed to load local storage data:', e);
  }
}

function saveLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEYS.SUBS, JSON.stringify(state.subscriptions));
    localStorage.setItem(STORAGE_KEYS.DISMISSED, JSON.stringify(state.dismissedAlerts));
    localStorage.setItem(STORAGE_KEYS.THEME, state.theme);
  } catch (e) {
    console.error('Failed to save to local storage:', e);
  }
}

// ==========================================================================
// THEME & NAVIGATION CONTROLLERS
// ==========================================================================
function applySavedTheme() {
  if (state.theme === 'light') {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
  }
}

function setupEventListeners() {
  // Tab Navigation Links (Desktop Sidebar & Mobile Bottom Nav)
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabId = btn.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  // Theme Toggle Buttons
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });

  // Modal Control (FAB & Add Buttons)
  const modal = document.getElementById('subscription-modal');
  const addSubBtnFab = document.getElementById('add-sub-btn-fab');
  const addSubBtnDesktop = document.getElementById('add-sub-btn-desktop');
  const emptyStateAddBtn = document.getElementById('empty-state-add-btn');
  const closeModalBtns = document.querySelectorAll('.close-modal-btn');

  const openAddModal = () => {
    // Reset Form
    document.getElementById('subscription-form').reset();
    document.getElementById('sub-id').value = '';
    document.getElementById('modal-title').textContent = 'Add Subscription';
    document.getElementById('sub-renewal-date').value = getTodayDateString();
    document.getElementById('custom-category-group').style.display = 'none';
    document.getElementById('product-name-group').style.display = 'none';
    document.getElementById('sub-product-name').value = '';
    
    // Default to service selected
    document.getElementById('type-service').checked = true;

    modal.classList.add('active');
    
    // Put cursor in the first input field
    setTimeout(() => {
      document.getElementById('sub-name').focus();
    }, 150);
  };

  if (addSubBtnFab) addSubBtnFab.addEventListener('click', openAddModal);
  if (addSubBtnDesktop) addSubBtnDesktop.addEventListener('click', openAddModal);
  if (emptyStateAddBtn) emptyStateAddBtn.addEventListener('click', openAddModal);

  closeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  });

  // Custom Category Dropdown toggle
  const categorySelect = document.getElementById('sub-category');
  const customCatGroup = document.getElementById('custom-category-group');
  categorySelect.addEventListener('change', () => {
    if (categorySelect.value === 'custom') {
      customCatGroup.style.display = 'flex';
      document.getElementById('sub-custom-category').required = true;
    } else {
      customCatGroup.style.display = 'none';
      document.getElementById('sub-custom-category').required = false;
    }
  });

  // Type toggle: show/hide Product Name field
  const typeServiceRadio = document.getElementById('type-service');
  const typeProductRadio = document.getElementById('type-product');
  const productNameGroup = document.getElementById('product-name-group');

  function updateProductNameVisibility() {
    if (typeProductRadio.checked) {
      productNameGroup.style.display = 'flex';
    } else {
      productNameGroup.style.display = 'none';
    }
  }

  typeServiceRadio.addEventListener('change', updateProductNameVisibility);
  typeProductRadio.addEventListener('change', updateProductNameVisibility);

  // Form Submission
  const form = document.getElementById('subscription-form');
  form.addEventListener('submit', handleFormSubmit);

  // Search & Filtering controls
  const searchInput = document.getElementById('search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');
  const sortSelect = document.getElementById('sort-select');

  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase().trim();
    if (state.searchQuery.length > 0) {
      searchClearBtn.style.display = 'flex';
    } else {
      searchClearBtn.style.display = 'none';
    }
    renderSubscriptionsList();
  });

  searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    searchClearBtn.style.display = 'none';
    renderSubscriptionsList();
  });

  sortSelect.addEventListener('change', (e) => {
    state.sortKey = e.target.value;
    renderSubscriptionsList();
  });

  // Category Filter Chips event listener
  const catChipsList = document.getElementById('category-chips-list');
  catChipsList.addEventListener('click', (e) => {
    const chip = e.target.closest('.cat-chip');
    if (!chip) return;
    
    catChipsList.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    
    state.categoryFilter = chip.getAttribute('data-category');
    renderSubscriptionsList();
  });

  // Dashboard quick filter chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.activeFilter = chip.getAttribute('data-filter-type');
      renderDashboard();
    });
  });

  // Notification Bell Center
  const bellBtn = document.querySelector('.notification-bell-btn');
  const notificationsModal = document.getElementById('notifications-modal');
  const closeNotificationsBtn = document.getElementById('close-notifications-btn');
  
  if (bellBtn) {
    bellBtn.addEventListener('click', () => {
      notificationsModal.classList.add('active');
      renderNotificationsCenter();
    });
  }

  if (closeNotificationsBtn) {
    closeNotificationsBtn.addEventListener('click', () => {
      notificationsModal.classList.remove('active');
    });
  }

  // Native notification banner actions
  const enableNotificationsBtn = document.getElementById('enable-notifications-btn');
  if (enableNotificationsBtn) {
    enableNotificationsBtn.addEventListener('click', requestNotificationPermission);
  }

  // Test Notification button
  const testNotifBtn = document.getElementById('notifications-test-btn');
  if (testNotifBtn) {
    testNotifBtn.addEventListener('click', () => {
      sendTestNotification();
    });
  }

  // JSON Export / Import
  const exportBtn = document.getElementById('export-json-btn');
  const importInput = document.getElementById('import-json-file');

  if (exportBtn) exportBtn.addEventListener('click', exportDataToJSON);
  if (importInput) importInput.addEventListener('change', importDataFromJSON);

  // Close modals on overlay click
  window.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
    if (e.target === notificationsModal) notificationsModal.classList.remove('active');
  });
}

function switchTab(tabId) {
  state.activeTab = tabId;
  
  // Update view classes
  document.querySelectorAll('.tab-view').forEach(view => {
    view.classList.remove('active');
  });
  const activeView = document.getElementById(`view-${tabId}`);
  if (activeView) activeView.classList.add('active');

  // Update nav item highlights
  document.querySelectorAll('[data-tab]').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update Page Title
  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');
  if (tabId === 'dashboard') {
    pageTitle.textContent = 'Dashboard';
    pageSubtitle.textContent = 'Overview of your spending';
  } else if (tabId === 'subscriptions') {
    pageTitle.textContent = 'Subscriptions';
    pageSubtitle.textContent = 'Manage and filter items';
  } else if (tabId === 'analytics') {
    pageTitle.textContent = 'Analytics';
    pageSubtitle.textContent = 'Spend charts and breakdowns';
  }

  // Refresh visual views if needed
  renderAll();
  
  // Re-run icons render
  if (window.lucide) window.lucide.createIcons();
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applySavedTheme();
  saveLocalStorage();
  renderAll();
}

function getTodayDateString() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

// ==========================================================================
// CALCULATIONS & FORMULA INTEGRITY
// ==========================================================================
/**
 * Normalizes any billing cycle into monthly and annual costs based on exact requirements.
 * Formulas:
 * - If weeks: annual = cost * (52 / interval); monthly = annual / 12
 * - If months: annual = cost * (12 / interval); monthly = annual / 12 (i.e. cost / interval)
 * - If years: annual = cost * (1 / interval); monthly = annual / 12
 */
function calculateNormalizedCosts(sub) {
  const cost = parseFloat(sub.cost);
  const interval = parseInt(sub.billingInterval);
  const period = sub.billingPeriod; // 'weeks', 'months', 'years'
  
  let annualCost = 0;
  
  if (period === 'weeks') {
    annualCost = cost * (52 / interval);
  } else if (period === 'months') {
    annualCost = cost * (12 / interval);
  } else if (period === 'years') {
    annualCost = cost * (1 / interval);
  }
  
  const monthlyCost = annualCost / 12;
  
  return {
    monthly: monthlyCost,
    annual: annualCost
  };
}

function getFilteredSubscriptions() {
  let filtered = [...state.subscriptions];

  // Quick Filter (All / Services / Products)
  if (state.activeFilter === 'service') {
    filtered = filtered.filter(s => s.type === 'service');
  } else if (state.activeFilter === 'product') {
    filtered = filtered.filter(s => s.type === 'product');
  }

  return filtered;
}

// ==========================================================================
// FORM CRUD HANDLING
// ==========================================================================
function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);

  let categoryValue = formData.get('category');
  if (categoryValue === 'custom') {
    const customVal = document.getElementById('sub-custom-category').value.trim();
    categoryValue = customVal || 'Custom';
  }

  const subId = formData.get('id');
  const subType = formData.get('type') || 'service';
  const subData = {
    id: subId || generateUUID(),
    name: formData.get('name').trim(),
    cost: parseFloat(formData.get('cost')),
    currency: formData.get('currency'),
    type: subType,
    productName: subType === 'product' ? (formData.get('productName') || '').trim() : '',
    billingInterval: parseInt(formData.get('billingInterval')),
    billingPeriod: formData.get('billingPeriod'),
    nextRenewalDate: formData.get('nextRenewalDate'),
    category: categoryValue,
    manageUrl: formData.get('manageUrl').trim(),
    notes: formData.get('notes').trim(),
    reminderDate: formData.get('reminderDate'),
    reminderText: formData.get('reminderText').trim(),
    createdAt: subId ? (state.subscriptions.find(s => s.id === subId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
  };

  if (subId) {
    // Edit existing
    const idx = state.subscriptions.findIndex(s => s.id === subId);
    if (idx !== -1) {
      state.subscriptions[idx] = subData;
    }
  } else {
    // Add new
    state.subscriptions.push(subData);
  }

  saveLocalStorage();
  
  // Close modal & refresh
  document.getElementById('subscription-modal').classList.remove('active');
  renderAll();
  
  // Check for upcoming notifications
  checkUpcomingRenewals();

  if (window.lucide) window.lucide.createIcons();
}

function editSubscription(subId) {
  const sub = state.subscriptions.find(s => s.id === subId);
  if (!sub) return;

  const modal = document.getElementById('subscription-modal');
  document.getElementById('modal-title').textContent = 'Edit Subscription';
  document.getElementById('sub-id').value = sub.id;
  document.getElementById('sub-name').value = sub.name;
  document.getElementById('sub-cost').value = sub.cost;
  document.getElementById('sub-currency').value = sub.currency;

  if (sub.type === 'service') {
    document.getElementById('type-service').checked = true;
  } else {
    document.getElementById('type-product').checked = true;
  }

  document.getElementById('sub-interval').value = sub.billingInterval;
  document.getElementById('sub-period').value = sub.billingPeriod;
  document.getElementById('sub-renewal-date').value = sub.nextRenewalDate;

  // Handle category
  const selectCat = document.getElementById('sub-category');
  const customCatGroup = document.getElementById('custom-category-group');
  
  // Clear any dynamically created options first
  const existingCustomOptions = selectCat.querySelectorAll('.dynamic-opt');
  existingCustomOptions.forEach(opt => opt.remove());

  // Check if predefined category exists
  let exists = false;
  for (let i = 0; i < selectCat.options.length; i++) {
    if (selectCat.options[i].value === sub.category) {
      exists = true;
      break;
    }
  }

  if (exists) {
    selectCat.value = sub.category;
    customCatGroup.style.display = 'none';
  } else {
    // Dynamically insert the custom category
    const opt = document.createElement('option');
    opt.value = sub.category;
    opt.textContent = sub.category;
    opt.className = 'dynamic-opt';
    selectCat.insertBefore(opt, selectCat.lastElementChild); // Insert before custom option
    selectCat.value = sub.category;
    customCatGroup.style.display = 'flex';
    document.getElementById('sub-custom-category').value = sub.category;
  }

  document.getElementById('sub-manage-url').value = sub.manageUrl || '';
  document.getElementById('sub-notes').value = sub.notes || '';
  document.getElementById('sub-reminder-date').value = sub.reminderDate || '';
  document.getElementById('sub-reminder-text').value = sub.reminderText || '';

  // Product Name field
  const productNameGrp = document.getElementById('product-name-group');
  if (sub.type === 'product') {
    productNameGrp.style.display = 'flex';
    document.getElementById('sub-product-name').value = sub.productName || '';
  } else {
    productNameGrp.style.display = 'none';
    document.getElementById('sub-product-name').value = '';
  }

  modal.classList.add('active');
  
  // Put cursor in the first input field
  setTimeout(() => {
    document.getElementById('sub-name').focus();
  }, 150);
  
  if (window.lucide) window.lucide.createIcons();
}

function deleteSubscription(subId) {
  const sub = state.subscriptions.find(s => s.id === subId);
  if (!sub) return;

  if (confirm(`Are you sure you want to delete your subscription to "${getDisplayName(sub)}"?`)) {
    state.subscriptions = state.subscriptions.filter(s => s.id !== subId);
    
    // Clean up dismissed notifications for this subscription
    state.dismissedAlerts = state.dismissedAlerts.filter(id => !id.startsWith(subId));
    
    saveLocalStorage();
    renderAll();
    checkUpcomingRenewals();
  }
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    let r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ==========================================================================
// VIEW RENDERERS (DASHBOARD, LIST, ANALYTICS)
// ==========================================================================
function renderAll() {
  if (state.activeTab === 'dashboard') {
    renderDashboard();
  } else if (state.activeTab === 'subscriptions') {
    renderSubscriptionsList();
    renderCategoryChips();
  } else if (state.activeTab === 'analytics') {
    renderAnalytics();
  }
}

// Render Dashboard View
function renderDashboard() {
  const subs = getFilteredSubscriptions();
  
  let monthlyTotal = 0;
  let annualTotal = 0;
  let servicesCount = 0;
  let productsCount = 0;

  subs.forEach(s => {
    const costs = calculateNormalizedCosts(s);
    monthlyTotal += costs.monthly;
    annualTotal += costs.annual;
    
    if (s.type === 'service') servicesCount++;
    else if (s.type === 'product') productsCount++;
  });

  // Update UI Stats
  const currencySymbol = state.subscriptions[0]?.currency || '$';
  document.getElementById('stat-monthly-cost').textContent = `${currencySymbol}${monthlyTotal.toFixed(2)}`;
  document.getElementById('stat-annual-cost').textContent = `${currencySymbol}${annualTotal.toFixed(2)}`;
  
  if (state.activeFilter === 'all') {
    document.getElementById('stat-active-count').textContent = state.subscriptions.length;
    document.getElementById('stat-active-subtext').textContent = `${servicesCount} services, ${productsCount} products`;
  } else if (state.activeFilter === 'service') {
    document.getElementById('stat-active-count').textContent = servicesCount;
    document.getElementById('stat-active-subtext').textContent = 'Filtering services only';
  } else {
    document.getElementById('stat-active-count').textContent = productsCount;
    document.getElementById('stat-active-subtext').textContent = 'Filtering products only';
  }

  // Render Upcoming lists & custom alerts
  renderDashboardAlerts();
}

function renderDashboardAlerts() {
  const upcomingContainer = document.getElementById('upcoming-renewals-list');
  const customContainer = document.getElementById('custom-reminders-list');
  
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(today.getDate() + 3);
  threeDaysFromNow.setHours(23,59,59,999);

  const upcomingList = [];
  const customList = [];

  state.subscriptions.forEach(sub => {
    const renewalDate = new Date(sub.nextRenewalDate + 'T00:00:00');
    
    // 1. Upcoming renewals within 3 days
    if (renewalDate >= today && renewalDate <= threeDaysFromNow) {
      upcomingList.push(sub);
    }

    // 2. Custom alerts
    if (sub.reminderDate) {
      const remDate = new Date(sub.reminderDate + 'T00:00:00');
      // If today or past, and reminder is not dismissed
      const alertId = `${sub.id}-${sub.reminderDate}-custom`;
      if (remDate <= today && !state.dismissedAlerts.includes(alertId)) {
        customList.push(sub);
      }
    }
  });

  // Sort upcoming by closest date
  upcomingList.sort((a,b) => new Date(a.nextRenewalDate) - new Date(b.nextRenewalDate));
  // Sort custom alerts by reminder date (closest first)
  customList.sort((a,b) => new Date(a.reminderDate) - new Date(b.reminderDate));

  // Render Upcoming
  document.getElementById('upcoming-renewals-count').textContent = `${upcomingList.length} Soon`;
  
  if (upcomingList.length === 0) {
    upcomingContainer.innerHTML = `
      <div class="empty-state">
        <i data-lucide="check-circle-2" class="text-emerald"></i>
        <p>All caught up! No renewals in the next 3 days.</p>
      </div>
    `;
  } else {
    upcomingContainer.innerHTML = upcomingList.map(sub => {
      const diffTime = Math.ceil((new Date(sub.nextRenewalDate + 'T00:00:00') - today) / (1000 * 60 * 60 * 24));
      const daysStr = diffTime === 0 ? 'Today' : diffTime === 1 ? 'Tomorrow' : `In ${diffTime} days`;
      const dateFormatted = formatDateString(sub.nextRenewalDate);
      const isProduct = sub.type === 'product';
      const indicatorColor = isProduct ? 'text-teal' : 'text-indigo';

      return `
        <div class="list-item-card">
          <div class="list-item-main">
            <div class="list-item-circle-badge" style="background: ${isProduct ? 'var(--product-gradient)' : 'var(--service-gradient)'}; color: white">
              ${sub.name.charAt(0).toUpperCase()}
            </div>
            <div class="list-item-details">
              <span class="list-item-name">${getDisplayName(sub)}</span>
              <span class="list-item-meta">
                <i data-lucide="calendar" class="${indicatorColor}" style="width:12px;height:12px;"></i>
                <span>Renews: ${daysStr} (${dateFormatted})</span>
              </span>
            </div>
          </div>
          <div class="list-item-aside">
            <span class="list-item-cost">${sub.currency}${sub.cost.toFixed(2)}</span>
            <span class="list-item-meta">every ${sub.billingInterval} ${sub.billingPeriod}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Custom alerts
  document.getElementById('custom-reminders-count').textContent = `${customList.length} Active`;
  
  if (customList.length === 0) {
    customContainer.innerHTML = `
      <div class="empty-state">
        <i data-lucide="bell-off"></i>
        <p>No active custom reminders right now.</p>
      </div>
    `;
  } else {
    customContainer.innerHTML = customList.map(sub => {
      const alertId = `${sub.id}-${sub.reminderDate}-custom`;
      return `
        <div class="list-item-card" style="border-left: 4px solid var(--warning)">
          <div class="list-item-main">
            <div class="list-item-circle-badge" style="background: rgba(245, 158, 11, 0.15); color: var(--warning)">
              <i data-lucide="alert-triangle" style="width: 20px; height: 20px;"></i>
            </div>
            <div class="list-item-details">
              <span class="list-item-name">${getDisplayName(sub)} Reminder</span>
              <span class="list-item-meta" style="font-weight: 600; color: var(--text-primary);">"${sub.reminderText || 'Review Subscription'}"</span>
              <span class="list-item-meta">Due: ${formatDateString(sub.reminderDate)}</span>
            </div>
          </div>
          <div class="list-item-aside">
            <button class="btn-dismiss-alert" onclick="dismissReminder('${alertId}')" aria-label="Dismiss alert">
              <i data-lucide="check" class="text-emerald"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
}

function dismissReminder(alertId) {
  if (!state.dismissedAlerts.includes(alertId)) {
    state.dismissedAlerts.push(alertId);
    saveLocalStorage();
    renderDashboardAlerts();
    updateBellCount();
  }
}

// Render Subscriptions List View
function renderSubscriptionsList() {
  const container = document.getElementById('subscriptions-list-container');
  
  let list = [...state.subscriptions];

  // 1. Search Query Filter
  if (state.searchQuery) {
    list = list.filter(sub => 
      sub.name.toLowerCase().includes(state.searchQuery) ||
      sub.category.toLowerCase().includes(state.searchQuery) ||
      (sub.notes && sub.notes.toLowerCase().includes(state.searchQuery))
    );
  }

  // 2. Category Filter
  if (state.categoryFilter !== 'all') {
    list = list.filter(sub => sub.category === state.categoryFilter);
  }

  // 3. Sorting
  if (state.sortKey === 'renewal-soon') {
    list.sort((a,b) => new Date(a.nextRenewalDate) - new Date(b.nextRenewalDate));
  } else if (state.sortKey === 'cost-high') {
    list.sort((a,b) => calculateNormalizedCosts(b).monthly - calculateNormalizedCosts(a).monthly);
  } else if (state.sortKey === 'cost-low') {
    list.sort((a,b) => calculateNormalizedCosts(a).monthly - calculateNormalizedCosts(b).monthly);
  } else if (state.sortKey === 'name-az') {
    list.sort((a,b) => a.name.localeCompare(b.name));
  } else if (state.sortKey === 'name-za') {
    list.sort((a,b) => b.name.localeCompare(a.name));
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-state large-empty-state">
        <i data-lucide="search"></i>
        <h3>No Matching Subscriptions</h3>
        <p>Try resetting filters or changing your search terms.</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  container.innerHTML = list.map(sub => {
    const isService = sub.type === 'service';
    const bgGradient = isService ? 'var(--service-gradient)' : 'var(--product-gradient)';
    const badgeClass = isService ? 'sub-badge-service' : 'sub-badge-product';
    const typeLabel = isService ? 'Service' : 'Product';
    const costs = calculateNormalizedCosts(sub);

    return `
      <div class="sub-card" data-sub-id="${sub.id}" onclick="toggleCardExpansion(this, event)">
        <div class="sub-card-header">
          <div class="sub-info-block">
            <div class="sub-logo" style="background: ${bgGradient}">
              ${sub.name.charAt(0).toUpperCase()}
            </div>
            <div class="sub-name-wrapper">
              <span class="sub-name">${sub.name}</span>
              ${sub.productName ? `<span class="sub-product-name">${escapeHTML(sub.productName)}</span>` : ''}
              <div class="sub-meta-row">
                <span class="sub-badge ${badgeClass}">${typeLabel}</span>
                <span class="sub-category-tag">${sub.category}</span>
              </div>
            </div>
          </div>
          <div class="sub-pricing-block">
            <span class="sub-price">${sub.currency}${sub.cost.toFixed(2)}</span>
            <span class="sub-cycle">every ${sub.billingInterval} ${sub.billingPeriod}</span>
          </div>
        </div>

        <div class="sub-card-expanded-content">
          <div class="sub-card-divider"></div>
          
          <div class="expanded-meta-grid">
            <div class="expanded-meta-item">
              <span class="expanded-meta-label">Next Renewal</span>
              <span class="expanded-meta-value">
                <i data-lucide="calendar"></i>
                <span>${formatDateString(sub.nextRenewalDate)}</span>
              </span>
            </div>
            <div class="expanded-meta-item">
              <span class="expanded-meta-label">Monthly Equivalent</span>
              <span class="expanded-meta-value">
                <i data-lucide="trending-up"></i>
                <span>${sub.currency}${costs.monthly.toFixed(2)}</span>
              </span>
            </div>
            <div class="expanded-meta-item">
              <span class="expanded-meta-label">Annual Equivalent</span>
              <span class="expanded-meta-value">
                <i data-lucide="coins"></i>
                <span>${sub.currency}${costs.annual.toFixed(2)}</span>
              </span>
            </div>
          </div>

          ${sub.notes ? `
            <div class="expanded-meta-item" style="margin-bottom:12px;">
              <span class="expanded-meta-label">Notes</span>
              <div class="notes-block">${escapeHTML(sub.notes)}</div>
            </div>
          ` : ''}

          ${sub.reminderDate ? `
            <div class="expanded-meta-item" style="margin-bottom:12px; border-left: 2px solid var(--warning); padding-left: 8px;">
              <span class="expanded-meta-label" style="color:var(--warning)">Custom Reminder</span>
              <span class="expanded-meta-value" style="font-size:12px;">
                <strong>${formatDateString(sub.reminderDate)}:</strong> "${escapeHTML(sub.reminderText) || 'No message'}"
              </span>
            </div>
          ` : ''}

          <div class="card-actions-row">
            <div class="card-btn-group">
              <button class="btn-action-outline card-action-btn" onclick="editSubscription('${sub.id}')">
                <i data-lucide="edit-3" style="width:14px;height:14px;margin-right:4px;"></i>
                <span>Edit</span>
              </button>
              <button class="card-action-btn card-action-btn-danger" onclick="deleteSubscription('${sub.id}')">
                <i data-lucide="trash-2" style="width:14px;height:14px;margin-right:4px;"></i>
                <span>Delete</span>
              </button>
            </div>
            
            ${sub.manageUrl ? `
              <a href="${sub.manageUrl}" target="_blank" rel="noopener noreferrer" class="card-action-btn-manage" onclick="event.stopPropagation()">
                <span>Manage</span>
                <i data-lucide="external-link" style="width:12px;height:12px;"></i>
              </a>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

function toggleCardExpansion(cardElement, event) {
  // Prevent expansion toggle when clicking action buttons/links
  if (event.target.closest('button') || event.target.closest('a') || event.target.closest('input')) {
    return;
  }
  cardElement.classList.toggle('expanded');
  if (window.lucide) window.lucide.createIcons();
}

function renderCategoryChips() {
  const container = document.getElementById('category-chips-list');
  const categories = ['Entertainment', 'Utilities', 'SaaS', 'Health & Wellness', 'Productivity', 'Food & Drink', 'Shopping'];
  
  // Scan for custom categories
  state.subscriptions.forEach(s => {
    if (s.category && !categories.includes(s.category)) {
      categories.push(s.category);
    }
  });

  const activeCategory = state.categoryFilter;

  container.innerHTML = `
    <button class="cat-chip ${activeCategory === 'all' ? 'active' : ''}" data-category="all">All</button>
  ` + categories.map(cat => `
    <button class="cat-chip ${activeCategory === cat ? 'active' : ''}" data-category="${cat}">${cat}</button>
  `).join('');
}

// Render Analytics View (SVG Custom Donut & Custom Bar Chart)
function renderAnalytics() {
  const donutContainer = document.getElementById('donut-chart-container');
  const barContainer = document.getElementById('bar-chart-container');
  const tableBody = document.getElementById('comparison-table-body');
  
  const donutLegend = document.getElementById('donut-chart-legend');
  const barLegend = document.getElementById('bar-chart-legend');

  if (state.subscriptions.length === 0) {
    donutContainer.innerHTML = `
      <div class="empty-chart-placeholder">
        <i data-lucide="pie-chart" class="placeholder-icon"></i>
        <p>Add subscriptions to view category breakdown</p>
      </div>
    `;
    barContainer.innerHTML = `
      <div class="empty-chart-placeholder">
        <i data-lucide="bar-chart-2" class="placeholder-icon"></i>
        <p>Add subscriptions to view monthly chart</p>
      </div>
    `;
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-secondary">No subscriptions added. Add items to view comparisons.</td>
      </tr>
    `;
    donutLegend.innerHTML = '';
    barLegend.innerHTML = '';
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  // Currency
  const currencySymbol = state.subscriptions[0]?.currency || '$';

  // 1. Calculate category spends (Monthly Normalized)
  const categorySpends = {};
  let totalMonthlySpend = 0;

  state.subscriptions.forEach(s => {
    const costs = calculateNormalizedCosts(s);
    totalMonthlySpend += costs.monthly;
    
    if (!categorySpends[s.category]) categorySpends[s.category] = 0;
    categorySpends[s.category] += costs.monthly;
  });

  // Draw Donut Chart SVG
  let donutHTML = `<svg width="180" height="180" viewBox="0 0 160 160" class="donut-chart">`;
  const radius = 55;
  const cx = 80;
  const cy = 80;
  const circumference = 2 * Math.PI * radius; // ~345.57
  
  let currentOffset = 0;
  const sortedCategories = Object.entries(categorySpends).sort((a,b) => b[1] - a[1]);
  
  sortedCategories.forEach(([cat, val]) => {
    const percentage = val / totalMonthlySpend;
    const dashArray = `${percentage * circumference} ${circumference}`;
    const dashOffset = -currentOffset;
    currentOffset += percentage * circumference;
    
    const color = CATEGORY_COLORS[cat] || CATEGORY_COLORS['Others'];
    
    donutHTML += `
      <circle class="donut-segment" 
              cx="${cx}" cy="${cy}" r="${radius}" 
              stroke="${color}" 
              stroke-dasharray="${dashArray}" 
              stroke-dashoffset="${dashOffset}">
        <title>${cat}: ${currencySymbol}${val.toFixed(2)}/mo (${(percentage*100).toFixed(1)}%)</title>
      </circle>
    `;
  });

  donutHTML += `
    <circle cx="${cx}" cy="${cy}" r="40" fill="var(--bg-app)" style="transition: fill var(--transition-normal);"></circle>
    <text x="${cx}" y="${cy - 4}" text-anchor="middle" class="donut-center-text" fill="var(--text-primary)">
      ${currencySymbol}${totalMonthlySpend.toFixed(0)}
    </text>
    <text x="${cx}" y="${cy + 12}" text-anchor="middle" class="donut-center-subtext" fill="var(--text-muted)">
      / month
    </text>
  </svg>`;

  donutContainer.innerHTML = donutHTML;

  // Render Donut Legend
  donutLegend.innerHTML = sortedCategories.map(([cat, val]) => {
    const pct = ((val / totalMonthlySpend) * 100).toFixed(1);
    const color = CATEGORY_COLORS[cat] || CATEGORY_COLORS['Others'];
    return `
      <div class="legend-item">
        <span class="legend-color" style="background: ${color}"></span>
        <span class="legend-text" title="${cat}">${cat}</span>
        <span class="legend-value">${pct}%</span>
      </div>
    `;
  }).join('');

  // 2. Monthly Expense Breakdown (Top Subscriptions Bar Chart)
  // Group by subscription name (rolling up same-company products), then sort by highest monthly cost
  const topSubs = groupSubscriptionsByName(state.subscriptions)
    .sort((a,b) => b.monthly - a.monthly)
    .slice(0, 5); // Limit to top 5

  const maxVal = Math.max(...topSubs.map(item => item.monthly), 1);
  const chartHeight = 160;
  const chartWidth = 240;
  const barWidth = 24;
  const spacing = 18;
  const startX = 20;
  
  let barHTML = `<svg width="100%" height="220" viewBox="0 0 ${chartWidth} 200" style="overflow: visible;">`;
  
  topSubs.forEach((item, idx) => {
    const normHeight = (item.monthly / maxVal) * chartHeight;
    const x = startX + idx * (barWidth + spacing);
    const y = chartHeight - normHeight + 15;
    const color = item.type === 'service' ? 'url(#service-glow)' : 'url(#product-glow)';
    
    // Gradient definitions
    if (idx === 0) {
      barHTML += `
        <defs>
          <linearGradient id="service-glow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="hsl(245, 75%, 65%)"/>
            <stop offset="100%" stop-color="hsl(270, 80%, 55%)"/>
          </linearGradient>
          <linearGradient id="product-glow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="hsl(170, 75%, 50%)"/>
            <stop offset="100%" stop-color="hsl(190, 80%, 40%)"/>
          </linearGradient>
        </defs>
      `;
    }

    barHTML += `
      <!-- Bar -->
      <rect class="bar-chart-rect" 
            x="${x}" y="${y}" 
            width="${barWidth}" height="${normHeight}" 
            rx="6" fill="${color}">
        <title>${getGroupDisplayName(item)}: ${currencySymbol}${item.monthly.toFixed(2)}/mo</title>
      </rect>
      <!-- Value Label -->
      <text x="${x + barWidth/2}" y="${y - 6}" text-anchor="middle" class="bar-chart-text" fill="var(--text-primary)" style="font-weight:700; font-size:9px;">
        ${currencySymbol}${item.monthly.toFixed(0)}
      </text>
      <!-- Name Tag -->
      <text x="${x + barWidth/2}" y="${chartHeight + 30}" text-anchor="middle" class="bar-chart-text" style="font-size:9px;">
        ${item.name.length > 5 ? item.name.substring(0, 4) + '..' : item.name}
      </text>
    `;
  });

  barHTML += `</svg>`;
  barContainer.innerHTML = barHTML;

  // Render Bar Legend
  barLegend.innerHTML = topSubs.map(item => {
    const color = item.type === 'service' ? 'var(--service-color)' : 'var(--product-color)';
    const label = getGroupDisplayName(item);
    return `
      <div class="legend-item">
        <span class="legend-color" style="background: ${color}; border-radius: 2px; width: 12px; height: 8px;"></span>
        <span class="legend-text" title="${label}">${label}</span>
        <span class="legend-value">${currencySymbol}${item.monthly.toFixed(2)}</span>
      </div>
    `;
  }).join('');

  // 3. Comparison Table rendering
  tableBody.innerHTML = state.subscriptions.map(s => {
    const costs = calculateNormalizedCosts(s);
    const pct = ((costs.monthly / totalMonthlySpend) * 100).toFixed(1);
    const typeLabel = s.type === 'service' ? 'Service' : 'Product';
    const typeBadge = s.type === 'service' ? 'sub-badge-service' : 'sub-badge-product';

    return `
      <tr>
        <td style="font-weight:600;">${getDisplayName(s)}</td>
        <td><span class="sub-badge ${typeBadge}">${typeLabel}</span></td>
        <td>every ${s.billingInterval} ${s.billingPeriod}</td>
        <td>${s.currency}${s.cost.toFixed(2)}</td>
        <td style="font-weight:600;">${s.currency}${costs.monthly.toFixed(2)}</td>
        <td>${s.currency}${costs.annual.toFixed(2)}</td>
        <td style="font-weight:700; color:var(--primary);">${pct}%</td>
      </tr>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

// Helper Date formatter
function formatDateString(dateStr) {
  if (!dateStr) return '';
  const dateObj = new Date(dateStr + 'T00:00:00');
  return dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Builds the display label for a subscription, appending its product name when present
function getDisplayName(sub) {
  return sub.productName ? `${sub.name} - ${sub.productName}` : sub.name;
}

// Groups subscriptions by name for the Monthly Expense Breakdown chart.
// Product subscriptions that share the same company name (sub.name) roll up into one entry;
// services are never merged since each is a distinct subscription.
function groupSubscriptionsByName(subs) {
  const groups = {};
  const order = [];

  subs.forEach(s => {
    const key = s.type === 'product' ? `product:${s.name}` : `service:${s.id}`;
    const monthly = calculateNormalizedCosts(s).monthly;

    if (!groups[key]) {
      groups[key] = { name: s.name, type: s.type, monthly: 0, count: 0, productName: s.productName || '' };
      order.push(key);
    } else if (groups[key].productName !== (s.productName || '')) {
      groups[key].productName = '';
    }

    groups[key].monthly += monthly;
    groups[key].count += 1;
  });

  return order.map(key => groups[key]);
}

// Display label for a grouped chart entry: rolled-up products show a count, single items show their product name
function getGroupDisplayName(group) {
  if (group.type === 'product' && group.count > 1) {
    return `${group.name} (${group.count})`;
  }
  if (group.type === 'product' && group.productName) {
    return `${group.name} - ${group.productName}`;
  }
  return group.name;
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// ==========================================================================
// NOTIFICATIONS SYSTEM (LOCAL BROWSER API)
// ==========================================================================
function checkNotificationPermissionsOnLoad() {
  const permBar = document.getElementById('notification-permission-bar');
  if (!('Notification' in window)) {
    if (permBar) permBar.style.display = 'none';
    return;
  }

  updatePermissionBadge();

  if (Notification.permission === 'default') {
    if (permBar) permBar.style.display = 'flex';
  } else {
    if (permBar) permBar.style.display = 'none';
  }
}

function updatePermissionBadge() {
  const badge = document.getElementById('native-permission-badge');
  if (!badge) return;

  if (!('Notification' in window)) {
    badge.textContent = 'Not Supported';
    badge.className = 'status-indicator denied';
    return;
  }

  if (Notification.permission === 'granted') {
    badge.textContent = 'Active';
    badge.className = 'status-indicator allowed';
  } else if (Notification.permission === 'denied') {
    badge.textContent = 'Blocked';
    badge.className = 'status-indicator denied';
  } else {
    badge.textContent = 'Pending';
    badge.className = 'status-indicator default';
  }
}

function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  
  Notification.requestPermission().then(permission => {
    updatePermissionBadge();
    const permBar = document.getElementById('notification-permission-bar');
    if (permission === 'granted') {
      if (permBar) permBar.style.display = 'none';
      sendLocalPushNotification('SubTrack Notifications Enabled', 'You will receive reminders for upcoming subscription renewals.');
    } else {
      if (permBar) permBar.style.display = 'none';
    }
  });
}

function checkUpcomingRenewals() {
  const todayStr = getTodayDateString();
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(today.getDate() + 3);
  threeDaysFromNow.setHours(23,59,59,999);

  let newNotificationsSent = false;

  state.subscriptions.forEach(sub => {
    const renewalDate = new Date(sub.nextRenewalDate + 'T00:00:00');
    
    // 1. Check Renewal alerts (within 3 days)
    if (renewalDate >= today && renewalDate <= threeDaysFromNow) {
      const alertId = `${sub.id}-${sub.nextRenewalDate}-renewal`;
      
      if (!state.dismissedAlerts.includes(alertId)) {
        // Send alert
        const diffTime = Math.ceil((renewalDate - today) / (1000 * 60 * 60 * 24));
        const renewalMessage = diffTime === 0 ? 'renews today!' : diffTime === 1 ? 'renews tomorrow!' : `renews in ${diffTime} days.`;
        
        sendLocalPushNotification(
          `${getDisplayName(sub)} Renewal Alert`,
          `Your subscription to ${getDisplayName(sub)} of ${sub.currency}${sub.cost.toFixed(2)} ${renewalMessage}`
        );
        newNotificationsSent = true;
      }
    }

    // 2. Check Custom reminders
    if (sub.reminderDate) {
      const reminderDateObj = new Date(sub.reminderDate + 'T00:00:00');
      if (reminderDateObj <= today) {
        const alertId = `${sub.id}-${sub.reminderDate}-custom`;
        if (!state.dismissedAlerts.includes(alertId)) {
          sendLocalPushNotification(
            `Reminder: ${getDisplayName(sub)}`,
            sub.reminderText || `Custom alert scheduled for today.`
          );
          newNotificationsSent = true;
        }
      }
    }
  });

  updateBellCount();
}

function sendLocalPushNotification(title, body) {
  if (!('Notification' in window)) return;
  
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: body,
        icon: 'https://cdn-icons-png.flaticon.com/512/3119/3119074.png' // Modern bell icon placeholder
      });
    } catch (e) {
      console.warn('Native notification failed, falling back:', e);
    }
  }
}

function sendTestNotification() {
  if (!('Notification' in window)) {
    alert('Notifications are not supported in this browser.');
    return;
  }
  
  if (Notification.permission !== 'granted') {
    Notification.requestPermission().then(permission => {
      updatePermissionBadge();
      
      if (permission === 'granted') {
        sendLocalPushNotification('Test Successful!', 'Congratulations! SubTrack native notifications are working perfectly.');
      } else if (permission === 'denied') {
        alert('Notification permission was denied. Please enable them in your browser settings.');
      } else {
        // 'default' state: browser ignored or blocked due to insecure origin (e.g. file://)
        alert('Notification permission request was not saved. This usually happens because you are opening the file directly (via file://) or using insecure HTTP. To test native notifications, please serve the app on localhost (e.g., by running "npx serve" in your folder).');
      }
    });
  } else {
    sendLocalPushNotification('Test Successful!', 'Congratulations! SubTrack native notifications are working perfectly.');
  }
}

function updateBellCount() {
  const badge = document.getElementById('notification-badge-count');
  if (!badge) return;

  const today = new Date();
  today.setHours(0,0,0,0);
  
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(today.getDate() + 3);
  threeDaysFromNow.setHours(23,59,59,999);

  let activeAlertsCount = 0;

  state.subscriptions.forEach(sub => {
    // 1. Renewal alerts
    const renewalDate = new Date(sub.nextRenewalDate + 'T00:00:00');
    if (renewalDate >= today && renewalDate <= threeDaysFromNow) {
      const alertId = `${sub.id}-${sub.nextRenewalDate}-renewal`;
      if (!state.dismissedAlerts.includes(alertId)) {
        activeAlertsCount++;
      }
    }

    // 2. Custom reminders
    if (sub.reminderDate) {
      const remDate = new Date(sub.reminderDate + 'T00:00:00');
      if (remDate <= today) {
        const alertId = `${sub.id}-${sub.reminderDate}-custom`;
        if (!state.dismissedAlerts.includes(alertId)) {
          activeAlertsCount++;
        }
      }
    }
  });

  if (activeAlertsCount > 0) {
    badge.textContent = activeAlertsCount;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function renderNotificationsCenter() {
  updatePermissionBadge();
  const listContainer = document.getElementById('notifications-history-list');
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(today.getDate() + 3);
  threeDaysFromNow.setHours(23,59,59,999);

  const activeAlerts = [];

  state.subscriptions.forEach(sub => {
    // 1. Renewal alerts
    const renewalDate = new Date(sub.nextRenewalDate + 'T00:00:00');
    if (renewalDate >= today && renewalDate <= threeDaysFromNow) {
      const alertId = `${sub.id}-${sub.nextRenewalDate}-renewal`;
      const diffTime = Math.ceil((renewalDate - today) / (1000 * 60 * 60 * 24));
      const renewalMessage = diffTime === 0 ? 'renews today!' : diffTime === 1 ? 'renews tomorrow!' : `renews in ${diffTime} days.`;
      
      activeAlerts.push({
        id: alertId,
        title: `${getDisplayName(sub)} Renewal`,
        body: `Cost: ${sub.currency}${sub.cost.toFixed(2)} ${renewalMessage}`,
        time: sub.nextRenewalDate,
        dismissed: state.dismissedAlerts.includes(alertId)
      });
    }

    // 2. Custom reminders
    if (sub.reminderDate) {
      const remDate = new Date(sub.reminderDate + 'T00:00:00');
      if (remDate <= today) {
        const alertId = `${sub.id}-${sub.reminderDate}-custom`;
        activeAlerts.push({
          id: alertId,
          title: `Reminder: ${getDisplayName(sub)}`,
          body: sub.reminderText || `Custom alert scheduled.`,
          time: sub.reminderDate,
          dismissed: state.dismissedAlerts.includes(alertId)
        });
      }
    }
  });

  // Filter out dismissed alerts in history list if desired, or show them as marked read. Let's filter to show only active alerts
  const activeOnly = activeAlerts.filter(a => !a.dismissed);

  if (activeOnly.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <i data-lucide="bell-off"></i>
        <p>No active alerts right now.</p>
      </div>
    `;
  } else {
    listContainer.innerHTML = activeOnly.map(a => `
      <div class="history-item">
        <div class="history-item-content">
          <span class="history-item-title">${a.title}</span>
          <span>${a.body}</span>
          <span class="history-item-time">Due: ${formatDateString(a.time)}</span>
        </div>
        <button class="btn-dismiss-alert" onclick="dismissFromCenter('${a.id}')" aria-label="Dismiss alert">
          <i data-lucide="x" style="width: 14px; height: 14px;"></i>
        </button>
      </div>
    `).join('');
  }

  if (window.lucide) window.lucide.createIcons();
}

// Global window reference to allow onclick triggers
window.dismissFromCenter = function(alertId) {
  if (!state.dismissedAlerts.includes(alertId)) {
    state.dismissedAlerts.push(alertId);
    saveLocalStorage();
    renderNotificationsCenter();
    renderDashboardAlerts();
    updateBellCount();
  }
};

// ==========================================================================
// DATA PORTABILITY & DATA BACKUPS
// ==========================================================================
function exportDataToJSON() {
  try {
    const dataStr = JSON.stringify(state.subscriptions, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `subtrack_backup_${getTodayDateString()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  } catch (e) {
    console.error('Failed to export data:', e);
    alert('Failed to export subscriptions data.');
  }
}

function importDataFromJSON(e) {
  const fileReader = new FileReader();
  const file = e.target.files[0];
  if (!file) return;

  fileReader.onload = (event) => {
    try {
      const importedData = JSON.parse(event.target.result);
      
      // Basic schema validation
      if (Array.isArray(importedData)) {
        const isValid = importedData.every(item => 
          item.id && 
          item.name && 
          typeof item.cost === 'number' && 
          item.currency &&
          item.billingInterval &&
          item.billingPeriod &&
          item.nextRenewalDate
        );

        if (isValid) {
          if (confirm(`Successfully read backup file. Do you want to import ${importedData.length} subscriptions? This will merge with your current items.`)) {
            // Merge matching IDs, add non-existent
            importedData.forEach(importedItem => {
              const existingIdx = state.subscriptions.findIndex(s => s.id === importedItem.id);
              if (existingIdx !== -1) {
                state.subscriptions[existingIdx] = importedItem;
              } else {
                state.subscriptions.push(importedItem);
              }
            });

            saveLocalStorage();
            renderAll();
            checkUpcomingRenewals();
            alert('Subscriptions imported successfully!');
          }
        } else {
          alert('Import failed: The JSON file does not match the required SubTrack data schema.');
        }
      } else {
        alert('Import failed: Backup file must contain a JSON array of subscriptions.');
      }
    } catch (err) {
      alert('Import failed: Invalid JSON file.');
      console.error(err);
    }
  };

  fileReader.readAsText(file);
}
