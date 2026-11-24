/**
 * Daily Habit & Expense Tracker PWA
 * Pure Client-Side JavaScript Application
 * Includes: Daily Habits, Daily Expenses, and ACE (Actual Cost Evaluator)
 */

(function () {
  'use strict';

  // ==========================================================================
  // APP STATE & STORAGE KEYS
  // ==========================================================================
  const STORAGE_HABITS_KEY = 'tracker_habits_v1';
  const STORAGE_LOGS_KEY = 'tracker_logs_v1';
  const STORAGE_ACE_KEY = 'tracker_ace_v1';
  const STORAGE_PAGE_KEY = 'tracker_active_page_v1';

  // Default Habit Templates
  const DEFAULT_HABITS = [
    { id: 'h_1', emoji: '💧', title: 'Drink 3L Water' },
    { id: 'h_2', emoji: '👟', title: 'Walk 10k Steps' },
    { id: 'h_3', emoji: '🥗', title: 'No Junk / Outside Food', allowStreakFreeze: true },
    { id: 'h_4', emoji: '🏋️', title: 'Workout / Exercise' }
  ];

  // Default Sample ACE Products (e.g. cycle investment recovering Rapido fares)
  const DEFAULT_ACE_PRODUCTS = [
    {
      id: 'ace_cycle_sample',
      name: 'Commuter Bicycle',
      emoji: '🚲',
      initialCost: 7300,
      createdAt: getTodayFormatted(),
      benchmarkNote: 'Commute to office (saves ~₹80 on Rapido/ride)',
      logs: [
        {
          id: 'log_c1',
          type: 'cost',
          amount: 250,
          note: 'Initial chain lube & bell',
          date: getTodayFormatted()
        },
        {
          id: 'log_s1',
          type: 'saving',
          amount: 160,
          note: 'Office round trip (saved on Rapido)',
          date: getTodayFormatted()
        }
      ]
    }
  ];

  // App State Variables
  let habitTemplates = [];
  let dailyLogs = {}; // Key: YYYY-MM-DD -> { habits: {}, expenses: [] }
  let aceProducts = [];
  let activePage = 'daily'; // 'daily' or 'ace'
  let aceFilter = 'all'; // 'all' | 'pending' | 'recovered'
  let expandedAceHistory = {}; // Key: productId -> boolean
  let selectedDate = getTodayFormatted();

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    initPasscode();
    loadDataFromStorage();
    initNavigation();
    initDateControls();
    initExpenseForm();
    initHabitModal();
    initSettingsModal();
    initAceModals();
    initPWA();

    // Check URL hash for direct routing (#ace or #daily)
    const hash = window.location.hash.replace('#', '').toLowerCase();
    if (hash === 'ace' || hash === 'daily') {
      switchPage(hash, false);
    } else {
      const savedPage = localStorage.getItem(STORAGE_PAGE_KEY);
      if (savedPage === 'ace' || savedPage === 'daily') {
        switchPage(savedPage, false);
      }
    }

    renderAll();
  });

  // Helper: Get today's YYYY-MM-DD
  function getTodayFormatted() {
    const d = new Date();
    return formatDateKey(d);
  }

  function formatDateKey(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Parse YYYY-MM-DD string to Date object
  function parseDateKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  // ==========================================================================
  // PASSCODE LOCK SCREEN VERIFICATION
  // ==========================================================================
  function initPasscode() {
    const passcodeOverlay = document.getElementById('passcodeOverlay');
    const passcodeForm = document.getElementById('passcodeForm');
    const passcodeInput = document.getElementById('passcodeInput');
    const passcodeError = document.getElementById('passcodeError');

    if (!passcodeOverlay) return;

    function attemptUnlock() {
      const pinVal = passcodeInput.value.trim();
      // Accepts 0000 or 9999 for seamless unlock
      if (pinVal === '9999' || pinVal === '0000') {
        passcodeOverlay.classList.add('unlocked');
        passcodeError.classList.add('hidden');
      } else {
        passcodeError.classList.remove('hidden');
        passcodeInput.value = '';
        passcodeInput.focus();
      }
    }

    passcodeForm.addEventListener('submit', (e) => {
      e.preventDefault();
      attemptUnlock();
    });

    passcodeInput.addEventListener('input', () => {
      passcodeError.classList.add('hidden');
      if (passcodeInput.value.length === 4) {
        attemptUnlock();
      }
    });
  }

  // ==========================================================================
  // STORAGE MANAGEMENT
  // ==========================================================================
  function loadDataFromStorage() {
    try {
      // Habits
      const storedHabits = localStorage.getItem(STORAGE_HABITS_KEY);
      if (storedHabits) {
        habitTemplates = JSON.parse(storedHabits);
      } else {
        habitTemplates = [...DEFAULT_HABITS];
        saveHabitsToStorage();
      }

      // Logs
      const storedLogs = localStorage.getItem(STORAGE_LOGS_KEY);
      if (storedLogs) {
        dailyLogs = JSON.parse(storedLogs);
      } else {
        dailyLogs = {};
        saveLogsToStorage();
      }

      // ACE Products
      const storedAce = localStorage.getItem(STORAGE_ACE_KEY);
      if (storedAce) {
        aceProducts = JSON.parse(storedAce);
      } else {
        aceProducts = [...DEFAULT_ACE_PRODUCTS];
        saveAceToStorage();
      }
    } catch (e) {
      console.error('Error loading data from localStorage', e);
      showToast('Error loading saved data');
    }
  }

  function saveHabitsToStorage() {
    localStorage.setItem(STORAGE_HABITS_KEY, JSON.stringify(habitTemplates));
  }

  function saveLogsToStorage() {
    localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(dailyLogs));
  }

  function saveAceToStorage() {
    localStorage.setItem(STORAGE_ACE_KEY, JSON.stringify(aceProducts));
    updateAceNavChip();
  }

  // Ensure log structure exists for a specific date key
  function ensureDateLogExists(dateKey) {
    if (!dailyLogs[dateKey]) {
      dailyLogs[dateKey] = {
        habits: {},
        expenses: []
      };
    }
    if (!dailyLogs[dateKey].habits) dailyLogs[dateKey].habits = {};
    if (!dailyLogs[dateKey].expenses) dailyLogs[dateKey].expenses = [];
  }

  // ==========================================================================
  // HAMBURGER MENU & MULTI-PAGE NAVIGATION
  // ==========================================================================
  function initNavigation() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const navDrawerOverlay = document.getElementById('navDrawerOverlay');
    const navDrawerBackdrop = document.getElementById('navDrawerBackdrop');
    const closeDrawerBtn = document.getElementById('closeDrawerBtn');

    const navLinkDaily = document.getElementById('navLinkDaily');
    const navLinkAce = document.getElementById('navLinkAce');

    const drawerManageHabitsBtn = document.getElementById('drawerManageHabitsBtn');
    const drawerExportCsvBtn = document.getElementById('drawerExportCsvBtn');
    const drawerSettingsBtn = document.getElementById('drawerSettingsBtn');

    function openDrawer() {
      navDrawerOverlay.classList.remove('hidden');
      navDrawerOverlay.setAttribute('aria-hidden', 'false');
      updateAceNavChip();
    }

    function closeDrawer() {
      navDrawerOverlay.classList.add('hidden');
      navDrawerOverlay.setAttribute('aria-hidden', 'true');
    }

    hamburgerBtn.addEventListener('click', openDrawer);
    closeDrawerBtn.addEventListener('click', closeDrawer);
    navDrawerBackdrop.addEventListener('click', closeDrawer);

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !navDrawerOverlay.classList.contains('hidden')) {
        closeDrawer();
      }
    });

    // Page Switching
    navLinkDaily.addEventListener('click', () => {
      switchPage('daily');
      closeDrawer();
    });

    navLinkAce.addEventListener('click', () => {
      switchPage('ace');
      closeDrawer();
    });

    // Drawer Secondary Actions
    drawerManageHabitsBtn.addEventListener('click', () => {
      closeDrawer();
      openHabitsModal();
    });

    drawerExportCsvBtn.addEventListener('click', () => {
      closeDrawer();
      exportToExcelCSV();
    });

    drawerSettingsBtn.addEventListener('click', () => {
      closeDrawer();
      document.getElementById('settingsModal').classList.remove('hidden');
    });

    // Listen to hash change for browser navigation
    window.addEventListener('hashchange', () => {
      const newHash = window.location.hash.replace('#', '').toLowerCase();
      if (newHash === 'daily' || newHash === 'ace') {
        switchPage(newHash, false);
      }
    });
  }

  function switchPage(pageKey, updateHash = true) {
    if (pageKey !== 'daily' && pageKey !== 'ace') return;
    activePage = pageKey;
    localStorage.setItem(STORAGE_PAGE_KEY, activePage);

    if (updateHash) {
      window.location.hash = activePage;
    }

    const pageDaily = document.getElementById('pageDaily');
    const pageAce = document.getElementById('pageAce');
    const navLinkDaily = document.getElementById('navLinkDaily');
    const navLinkAce = document.getElementById('navLinkAce');

    const headerPageTitle = document.getElementById('headerPageTitle');
    const headerSubtitleBadge = document.getElementById('headerSubtitleBadge');

    const dailyActions = document.querySelectorAll('.header-action-daily');
    const aceActions = document.querySelectorAll('.header-action-ace');

    if (activePage === 'daily') {
      pageDaily.classList.remove('hidden');
      pageDaily.classList.add('active');
      pageAce.classList.add('hidden');
      pageAce.classList.remove('active');

      navLinkDaily.classList.add('active');
      navLinkAce.classList.remove('active');

      headerPageTitle.textContent = 'Daily Tracker';
      headerSubtitleBadge.textContent = 'Offline Ready';

      dailyActions.forEach(el => el.classList.remove('hidden'));
      aceActions.forEach(el => el.classList.add('hidden'));

      renderHabits();
      renderExpenses();
      renderStats();
    } else {
      pageDaily.classList.add('hidden');
      pageDaily.classList.remove('active');
      pageAce.classList.remove('hidden');
      pageAce.classList.add('active');

      navLinkDaily.classList.remove('active');
      navLinkAce.classList.add('active');

      headerPageTitle.textContent = 'Actual Cost (ACE)';
      headerSubtitleBadge.textContent = 'Investment ROI';

      dailyActions.forEach(el => el.classList.add('hidden'));
      aceActions.forEach(el => el.classList.remove('hidden'));

      renderAce();
    }

    updateAceNavChip();
  }

  function updateAceNavChip() {
    const chip = document.getElementById('aceNavCountChip');
    if (chip) {
      chip.textContent = aceProducts.length;
    }
  }

  // ==========================================================================
  // DATE NAVIGATION & UI
  // ==========================================================================
  function initDateControls() {
    const prevDateBtn = document.getElementById('prevDateBtn');
    const nextDateBtn = document.getElementById('nextDateBtn');
    const todayBtn = document.getElementById('todayBtn');
    const hiddenDatePicker = document.getElementById('hiddenDatePicker');
    const datePickerWrapper = document.querySelector('.date-picker-wrapper');

    prevDateBtn.addEventListener('click', () => changeDateOffset(-1));
    nextDateBtn.addEventListener('click', () => changeDateOffset(1));
    todayBtn.addEventListener('click', () => setSelectedDate(getTodayFormatted()));

    hiddenDatePicker.addEventListener('change', (e) => {
      if (e.target.value) {
        setSelectedDate(e.target.value);
      }
    });

    datePickerWrapper.addEventListener('click', () => {
      hiddenDatePicker.showPicker ? hiddenDatePicker.showPicker() : hiddenDatePicker.focus();
    });
  }

  function changeDateOffset(offsetDays) {
    const current = parseDateKey(selectedDate);
    current.setDate(current.getDate() + offsetDays);
    setSelectedDate(formatDateKey(current));
  }

  function setSelectedDate(dateKey) {
    selectedDate = dateKey;
    document.getElementById('hiddenDatePicker').value = dateKey;
    renderAll();
  }

  function renderDateHeader() {
    const dateObj = parseDateKey(selectedDate);
    const todayKey = getTodayFormatted();

    const dateDayName = document.getElementById('dateDayName');
    const dateFormatted = document.getElementById('dateFormatted');

    if (selectedDate === todayKey) {
      dateDayName.textContent = 'Today';
    } else {
      const diffTime = dateObj - parseDateKey(todayKey);
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === -1) dateDayName.textContent = 'Yesterday';
      else if (diffDays === 1) dateDayName.textContent = 'Tomorrow';
      else dateDayName.textContent = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    }

    dateFormatted.textContent = dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  // ==========================================================================
  // EXPENSE LOGGING LOGIC
  // ==========================================================================
  function initExpenseForm() {
    const expenseForm = document.getElementById('expenseForm');
    const expenseAmountInput = document.getElementById('expenseAmount');
    const expenseNoteInput = document.getElementById('expenseNote');

    expenseForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const amountVal = parseFloat(expenseAmountInput.value);
      if (isNaN(amountVal) || amountVal <= 0) {
        showToast('Please enter a valid expense amount');
        return;
      }

      const noteVal = expenseNoteInput.value.trim() || 'General Expense';

      ensureDateLogExists(selectedDate);

      const newExpense = {
        id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        amount: amountVal,
        note: noteVal,
        timestamp: new Date().toISOString()
      };

      dailyLogs[selectedDate].expenses.push(newExpense);
      saveLogsToStorage();

      // Reset form
      expenseAmountInput.value = '';
      expenseNoteInput.value = '';

      renderExpenses();
      renderStats();
      showToast(`Added expense: ₹${amountVal.toFixed(2)}`);
    });
  }

  function renderExpenses() {
    ensureDateLogExists(selectedDate);
    const dayExpenses = dailyLogs[selectedDate].expenses || [];

    const total = dayExpenses.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    document.getElementById('dayExpenseTotal').textContent = total.toFixed(2);

    const container = document.getElementById('expenseEntriesContainer');
    container.innerHTML = '';

    if (dayExpenses.length === 0) {
      return;
    }

    dayExpenses.forEach((item) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'expense-item';
      itemEl.innerHTML = `
        <div class="expense-item-note">${escapeHtml(item.note)}</div>
        <div class="expense-item-actions">
          <span class="expense-item-amount">₹${parseFloat(item.amount).toFixed(2)}</span>
          <button class="btn-delete-item" data-id="${item.id}" title="Delete expense">&times;</button>
        </div>
      `;

      itemEl.querySelector('.btn-delete-item').addEventListener('click', (e) => {
        const idToDelete = e.currentTarget.getAttribute('data-id');
        deleteExpense(idToDelete);
      });

      container.appendChild(itemEl);
    });
  }

  function deleteExpense(expenseId) {
    if (!dailyLogs[selectedDate]) return;
    dailyLogs[selectedDate].expenses = dailyLogs[selectedDate].expenses.filter(item => item.id !== expenseId);
    saveLogsToStorage();
    renderExpenses();
    renderStats();
    showToast('Expense deleted');
  }

  // ==========================================================================
  // HABITS CHECKLIST LOGIC
  // ==========================================================================
  function renderHabits() {
    ensureDateLogExists(selectedDate);
    const dayHabitState = dailyLogs[selectedDate].habits || {};

    const habitsListEl = document.getElementById('habitsList');
    habitsListEl.innerHTML = '';

    if (habitTemplates.length === 0) {
      habitsListEl.innerHTML = `
        <div class="empty-state">
          <p>No habits configured yet.</p>
          <button class="btn btn-secondary btn-sm" id="emptyAddHabitBtn" style="margin-top:12px;">+ Add Habit</button>
        </div>
      `;
      document.getElementById('emptyAddHabitBtn')?.addEventListener('click', openHabitsModal);
      updateHabitProgress(0, 0);
      return;
    }

    let completedCount = 0;

    habitTemplates.forEach((habit) => {
      const isCompleted = !!dayHabitState[habit.id];
      if (isCompleted) completedCount++;

      const streak = calculateHabitStreak(habit.id);
      const isFreezeHabit = habit.allowStreakFreeze || habit.title.toLowerCase().includes('no junk');
      const earnedShields = Math.floor(streak / 7);

      let shieldHtml = '';
      if (isFreezeHabit) {
        if (earnedShields > 0) {
          shieldHtml = `<span class="shield-badge" title="7-day streak reward: 1 Cheat Day allowed without breaking streak">🛡️ ${earnedShields} Cheat Shield</span>`;
        } else {
          shieldHtml = `<span class="shield-badge-muted" title="Complete a 7-day streak to earn 1 Cheat Day shield!">🛡️ 7d = 1 Cheat Shield</span>`;
        }
      }

      const card = document.createElement('div');
      card.className = `habit-card ${isCompleted ? 'completed' : ''}`;
      card.setAttribute('role', 'checkbox');
      card.setAttribute('aria-checked', isCompleted);

      card.innerHTML = `
        <div class="habit-main">
          <div class="habit-checkbox">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <span class="habit-emoji">${habit.emoji || '✨'}</span>
          <span class="habit-title">${escapeHtml(habit.title)}</span>
        </div>
        <div class="habit-badges">
          ${shieldHtml}
          ${streak > 0 ? `<div class="habit-streak">🔥 ${streak}d</div>` : ''}
        </div>
      `;

      card.addEventListener('click', () => {
        toggleHabit(habit.id);
      });

      habitsListEl.appendChild(card);
    });

    updateHabitProgress(completedCount, habitTemplates.length);
  }

  function toggleHabit(habitId) {
    ensureDateLogExists(selectedDate);
    const currentState = !!dailyLogs[selectedDate].habits[habitId];
    dailyLogs[selectedDate].habits[habitId] = !currentState;
    saveLogsToStorage();

    renderHabits();
    renderStats();
  }

  function updateHabitProgress(completed, total) {
    const counterEl = document.getElementById('habitProgressCounter');
    const barEl = document.getElementById('habitProgressBar');

    counterEl.textContent = `${completed} of ${total} Completed`;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    barEl.style.width = `${percentage}%`;
  }

  // Streak Calculation with Streak Freeze / Cheat Shield Support
  function calculateHabitStreak(habitId) {
    const habitObj = habitTemplates.find(h => h.id === habitId);
    const allowFreeze = habitObj && (habitObj.allowStreakFreeze || habitObj.title.toLowerCase().includes('no junk'));

    let streak = 0;
    let earnedShields = 0;
    let checkDate = parseDateKey(selectedDate);

    while (true) {
      const dateKey = formatDateKey(checkDate);
      const isDone = dailyLogs[dateKey] && dailyLogs[dateKey].habits && dailyLogs[dateKey].habits[habitId];

      if (isDone) {
        streak++;
        if (allowFreeze && streak % 7 === 0) {
          earnedShields++;
        }
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (allowFreeze && earnedShields > 0) {
        earnedShields--;
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  // ==========================================================================
  // DASHBOARD ANALYTICS & STATS
  // ==========================================================================
  function renderStats() {
    let perfectStreak = 0;
    let checkDate = parseDateKey(getTodayFormatted());

    while (true) {
      const key = formatDateKey(checkDate);
      const log = dailyLogs[key];
      if (log && habitTemplates.length > 0) {
        const completedHabits = habitTemplates.filter(h => log.habits && log.habits[h.id]);
        if (completedHabits.length === habitTemplates.length) {
          perfectStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      } else {
        break;
      }
    }
    document.getElementById('currentStreak').textContent = perfectStreak;

    let totalPossibleHabits = 0;
    let totalDoneHabits = 0;
    let weeklyExpensesSum = 0;

    const endDate = parseDateKey(selectedDate);

    for (let i = 0; i < 7; i++) {
      const d = new Date(endDate);
      d.setDate(d.getDate() - i);
      const k = formatDateKey(d);

      const log = dailyLogs[k];
      if (habitTemplates.length > 0) {
        totalPossibleHabits += habitTemplates.length;
        if (log && log.habits) {
          habitTemplates.forEach(h => {
            if (log.habits[h.id]) totalDoneHabits++;
          });
        }
      }

      if (log && log.expenses) {
        log.expenses.forEach(e => {
          weeklyExpensesSum += parseFloat(e.amount) || 0;
        });
      }
    }

    const weeklyRate = totalPossibleHabits > 0 ? Math.round((totalDoneHabits / totalPossibleHabits) * 100) : 0;
    document.getElementById('weeklyHabitRate').textContent = `${weeklyRate}%`;
    document.getElementById('weeklyExpenseTotal').textContent = weeklyExpensesSum.toFixed(2);
  }

  // ==========================================================================
  // ACE (ACTUAL COST EVALUATOR) - CORE LOGIC & RENDERING
  // ==========================================================================

  /**
   * Calculate financial recovery metrics for an ACE product
   * - Total Cost = Initial Purchase Cost + All Extra Costs (+)
   * - Total Savings = Sum of all savings (-)
   * - If Total Cost > Total Savings: Outstanding expense (Pending recovery) -> Reddish background
   * - If Total Savings >= Total Cost: Total saving (Excess amount recovered) -> Greenish background
   */
  function calculateProductMetrics(product) {
    const initialCost = parseFloat(product.initialCost) || 0;
    const logs = product.logs || [];

    const extraCosts = logs
      .filter(l => l.type === 'cost')
      .reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);

    const totalSavings = logs
      .filter(l => l.type === 'saving')
      .reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);

    const totalCost = initialCost + extraCosts;
    const netBalance = totalSavings - totalCost; // Positive = profit/excess savings, Negative = outstanding
    const isRecovered = netBalance >= 0;
    const outstandingExpense = isRecovered ? 0 : (totalCost - totalSavings);
    const excessSaving = isRecovered ? netBalance : 0;

    const recoveryRate = totalCost > 0
      ? Math.round((totalSavings / totalCost) * 100)
      : 100;

    return {
      initialCost,
      extraCosts,
      totalCost,
      totalSavings,
      netBalance,
      isRecovered,
      outstandingExpense,
      excessSaving,
      recoveryRate
    };
  }

  function renderAce() {
    const productsListEl = document.getElementById('aceProductsList');
    if (!productsListEl) return;

    // Filter Buttons state
    const filterButtons = document.querySelectorAll('.ace-filter-btn');
    filterButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-filter') === aceFilter);
    });

    // Counts & Summaries
    let totalInvestedAll = 0;
    let totalSavingsAll = 0;
    let countPending = 0;
    let countRecovered = 0;

    const evaluatedProducts = aceProducts.map(p => {
      const metrics = calculateProductMetrics(p);
      totalInvestedAll += metrics.totalCost;
      totalSavingsAll += metrics.totalSavings;

      if (metrics.isRecovered) countRecovered++;
      else countPending++;

      return { product: p, metrics };
    });

    // Update Summary Header Banner
    document.getElementById('aceTotalInvested').textContent = totalInvestedAll.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    document.getElementById('aceTotalSavings').textContent = totalSavingsAll.toLocaleString('en-IN', { maximumFractionDigits: 2 });

    const netAll = totalSavingsAll - totalInvestedAll;
    const aceNetValueEl = document.getElementById('aceNetValue');
    const aceNetLabelEl = document.getElementById('aceNetLabel');
    const aceNetSubtextEl = document.getElementById('aceNetSubtext');

    if (netAll >= 0) {
      aceNetLabelEl.textContent = 'Net Savings Profit';
      aceNetValueEl.className = 'stat-value text-emerald';
      aceNetValueEl.textContent = '+₹' + netAll.toLocaleString('en-IN', { maximumFractionDigits: 2 });
      aceNetSubtextEl.textContent = '🎉 Excess Value Generated';
    } else {
      const pendingTotal = totalInvestedAll - totalSavingsAll;
      aceNetLabelEl.textContent = 'Net Outstanding';
      aceNetValueEl.className = 'stat-value text-danger';
      aceNetValueEl.textContent = '-₹' + pendingTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 });
      aceNetSubtextEl.textContent = 'To achieve breakeven';
    }

    // Filter counts
    document.getElementById('aceFilterAllCount').textContent = aceProducts.length;
    document.getElementById('aceFilterPendingCount').textContent = countPending;
    document.getElementById('aceFilterRecoveredCount').textContent = countRecovered;
    updateAceNavChip();

    // Filter products
    const filtered = evaluatedProducts.filter(({ metrics }) => {
      if (aceFilter === 'pending') return !metrics.isRecovered;
      if (aceFilter === 'recovered') return metrics.isRecovered;
      return true;
    });

    // Render Product Cards
    productsListEl.innerHTML = '';

    if (filtered.length === 0) {
      productsListEl.innerHTML = `
        <div class="empty-state glass-card">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">⚖️</div>
          <h3>${aceProducts.length === 0 ? 'No products tracked yet' : 'No products in this filter'}</h3>
          <p>${aceProducts.length === 0 ? 'Add an asset or item (e.g. Cycle, Coffee Machine, Tool) to evaluate its real payoff!' : 'Try selecting another tab or add a new product.'}</p>
          <button class="btn btn-primary btn-sm" id="emptyAddAceBtn" style="margin-top: 14px;">+ Add First Product</button>
        </div>
      `;
      document.getElementById('emptyAddAceBtn')?.addEventListener('click', openAddAceProductModal);
      return;
    }

    filtered.forEach(({ product, metrics }) => {
      const card = document.createElement('article');
      const isPending = !metrics.isRecovered;
      // 5.1 Reddish background for pending, 5.2 Greenish background for recovered
      card.className = `ace-card ${isPending ? 'status-pending' : 'status-recovered'}`;
      card.setAttribute('data-id', product.id);

      const isHistoryOpen = !!expandedAceHistory[product.id];
      const txCount = (product.logs || []).length;

      card.innerHTML = `
        <div class="ace-card-header">
          <div class="ace-product-info">
            <span class="ace-product-emoji">${product.emoji || '📦'}</span>
            <div class="ace-product-title-group">
              <h4>${escapeHtml(product.name)}</h4>
              ${product.benchmarkNote ? `<div class="ace-benchmark-note" title="${escapeHtml(product.benchmarkNote)}">💡 ${escapeHtml(product.benchmarkNote)}</div>` : ''}
            </div>
          </div>
          <div class="ace-card-menu">
            <button class="btn-icon-xs btn-edit-prod" title="Edit product" data-id="${product.id}">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button class="btn-icon-xs btn-delete-prod" title="Delete product" data-id="${product.id}">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>

        <!-- 5.1 & 5.2 Highlight Banner -->
        <div class="ace-highlight-banner">
          <div class="ace-status-pill">
            <span class="ace-status-label">${isPending ? '🔴 Outstanding Expense' : '🟢 Total Saving (Net Profit)'}</span>
            <span class="ace-status-amount">₹${(isPending ? metrics.outstandingExpense : metrics.excessSaving).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div class="ace-rate-badge">
            ${isPending ? `${metrics.recoveryRate}% Recovered` : `🎉 100%+ Paid Off`}
          </div>
        </div>

        <!-- Progress Bar towards Breakeven -->
        <div class="ace-progress-wrap">
          <div class="ace-progress-bar">
            <div class="ace-progress-fill" style="width: ${Math.min(100, metrics.recoveryRate)}%;"></div>
          </div>
          <div class="ace-progress-text">
            <span>₹${metrics.totalSavings.toFixed(2)} savings</span>
            <span>${isPending ? `₹${metrics.outstandingExpense.toFixed(2)} pending` : `+₹${metrics.excessSaving.toFixed(2)} excess profit`}</span>
          </div>
        </div>

        <!-- Financial Breakdown Stats -->
        <div class="ace-financial-grid">
          <div class="ace-fin-col">
            <span class="ace-fin-label">Initial Cost</span>
            <span class="ace-fin-val">₹${metrics.initialCost.toFixed(2)}</span>
          </div>
          <div class="ace-fin-col">
            <span class="ace-fin-label">Extra Costs (+)</span>
            <span class="ace-fin-val" style="color:#f87171;">₹${metrics.extraCosts.toFixed(2)}</span>
          </div>
          <div class="ace-fin-col">
            <span class="ace-fin-label">Total Invested</span>
            <span class="ace-fin-val">₹${metrics.totalCost.toFixed(2)}</span>
          </div>
          <div class="ace-fin-col">
            <span class="ace-fin-label">Total Saved (-)</span>
            <span class="ace-fin-val" style="color:#34d399;">₹${metrics.totalSavings.toFixed(2)}</span>
          </div>
        </div>

        <!-- 2. '+' and '-' Action Buttons & History Toggle -->
        <div class="ace-actions-row">
          <button class="btn-ace-cost" data-id="${product.id}" title="Add extra expense like repairs, maintenance, or accessories">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>+ Cost</span>
          </button>

          <button class="btn-ace-save" data-id="${product.id}" title="Log savings generated by using this product">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>- Saving</span>
          </button>

          <button class="btn-ace-toggle-history" data-id="${product.id}" title="View transaction history">
            <span>History (${txCount})</span>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="${isHistoryOpen ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}"/></svg>
          </button>
        </div>

        <!-- Expandable Activity History Log -->
        ${isHistoryOpen ? renderProductHistoryHtml(product) : ''}
      `;

      // Event Listeners for Card buttons
      card.querySelector('.btn-ace-cost').addEventListener('click', () => openAceLogModal(product.id, 'cost'));
      card.querySelector('.btn-ace-save').addEventListener('click', () => openAceLogModal(product.id, 'saving'));

      card.querySelector('.btn-ace-toggle-history').addEventListener('click', () => {
        expandedAceHistory[product.id] = !expandedAceHistory[product.id];
        renderAce();
      });

      card.querySelector('.btn-edit-prod').addEventListener('click', () => openEditAceProductModal(product.id));
      card.querySelector('.btn-delete-prod').addEventListener('click', () => deleteAceProduct(product.id));

      // Delete buttons inside history if open
      if (isHistoryOpen) {
        card.querySelectorAll('.btn-delete-tx').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const txId = e.currentTarget.getAttribute('data-tx-id');
            deleteAceTransaction(product.id, txId);
          });
        });
      }

      productsListEl.appendChild(card);
    });
  }

  function renderProductHistoryHtml(product) {
    const logs = [...(product.logs || [])].reverse(); // newest first
    if (logs.length === 0) {
      return `
        <div class="ace-history-box">
          <div class="ace-history-title">Activity History (0)</div>
          <div style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 10px;">
            No transactions logged yet. Use '+ Cost' for repairs or '- Saving' for money saved!
          </div>
        </div>
      `;
    }

    const itemsHtml = logs.map(l => {
      const isCost = l.type === 'cost';
      return `
        <div class="ace-tx-item ${isCost ? 'tx-cost' : 'tx-saving'}">
          <div class="ace-tx-left">
            <span class="ace-tx-badge">${isCost ? '+ COST' : '- SAVING'}</span>
            <div class="ace-tx-details">
              <span class="ace-tx-note">${escapeHtml(l.note)}</span>
              <span class="ace-tx-date">${escapeHtml(l.date || 'Recent')}</span>
            </div>
          </div>
          <div class="ace-tx-right">
            <span class="ace-tx-amount">${isCost ? '+' : '-'}₹${parseFloat(l.amount).toFixed(2)}</span>
            <button class="btn-delete-item btn-delete-tx" data-tx-id="${l.id}" title="Delete entry">&times;</button>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="ace-history-box">
        <div class="ace-history-title">
          <span>Activity History (${logs.length})</span>
          <small style="color:var(--text-muted);">Newest First</small>
        </div>
        <div class="ace-tx-list">
          ${itemsHtml}
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // ACE MODALS & USER ACTIONS (+ COST & - SAVINGS)
  // ==========================================================================
  function initAceModals() {
    // 1. Add / Edit Product Modal
    const addAceProductTopBtn = document.getElementById('addAceProductTopBtn');
    const addAceProductBtn = document.getElementById('addAceProductBtn');
    const aceProductModal = document.getElementById('aceProductModal');
    const closeAceProductModal = document.getElementById('closeAceProductModal');
    const cancelAceProductBtn = document.getElementById('cancelAceProductBtn');
    const aceProductForm = document.getElementById('aceProductForm');

    addAceProductTopBtn?.addEventListener('click', openAddAceProductModal);
    addAceProductBtn?.addEventListener('click', openAddAceProductModal);

    closeAceProductModal.addEventListener('click', () => aceProductModal.classList.add('hidden'));
    cancelAceProductBtn.addEventListener('click', () => aceProductModal.classList.add('hidden'));

    aceProductModal.addEventListener('click', (e) => {
      if (e.target === aceProductModal) aceProductModal.classList.add('hidden');
    });

    aceProductForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveAceProductFromModal();
    });

    // 2. Log Action Modal (+ Cost / - Saving)
    const aceLogModal = document.getElementById('aceLogModal');
    const closeAceLogModal = document.getElementById('closeAceLogModal');
    const cancelAceLogBtn = document.getElementById('cancelAceLogBtn');
    const aceLogForm = document.getElementById('aceLogForm');

    closeAceLogModal.addEventListener('click', () => aceLogModal.classList.add('hidden'));
    cancelAceLogBtn.addEventListener('click', () => aceLogModal.classList.add('hidden'));

    aceLogModal.addEventListener('click', (e) => {
      if (e.target === aceLogModal) aceLogModal.classList.add('hidden');
    });

    aceLogForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveAceLogFromModal();
    });

    // Filter Buttons in ACE View
    const filterButtons = document.querySelectorAll('.ace-filter-btn');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        aceFilter = btn.getAttribute('data-filter') || 'all';
        renderAce();
      });
    });
  }

  function openAddAceProductModal() {
    document.getElementById('aceProductModalTitle').textContent = 'Add New Product for ACE';
    document.getElementById('aceProductId').value = '';
    document.getElementById('aceProductEmoji').value = '🚲';
    document.getElementById('aceProductName').value = '';
    document.getElementById('aceProductInitialCost').value = '';
    document.getElementById('aceProductBenchmark').value = '';
    document.getElementById('aceProductDate').value = getTodayFormatted();

    document.getElementById('aceProductModal').classList.remove('hidden');
    setTimeout(() => document.getElementById('aceProductName').focus(), 100);
  }

  function openEditAceProductModal(productId) {
    const prod = aceProducts.find(p => p.id === productId);
    if (!prod) return;

    document.getElementById('aceProductModalTitle').textContent = 'Edit Product';
    document.getElementById('aceProductId').value = prod.id;
    document.getElementById('aceProductEmoji').value = prod.emoji || '📦';
    document.getElementById('aceProductName').value = prod.name;
    document.getElementById('aceProductInitialCost').value = prod.initialCost;
    document.getElementById('aceProductBenchmark').value = prod.benchmarkNote || '';
    document.getElementById('aceProductDate').value = prod.createdAt || getTodayFormatted();

    document.getElementById('aceProductModal').classList.remove('hidden');
  }

  function saveAceProductFromModal() {
    const id = document.getElementById('aceProductId').value.trim();
    const name = document.getElementById('aceProductName').value.trim();
    const emoji = document.getElementById('aceProductEmoji').value.trim() || '📦';
    const initialCost = parseFloat(document.getElementById('aceProductInitialCost').value);
    const benchmark = document.getElementById('aceProductBenchmark').value.trim();
    const dateVal = document.getElementById('aceProductDate').value || getTodayFormatted();

    if (!name) {
      showToast('Please enter product name');
      return;
    }
    if (isNaN(initialCost) || initialCost < 0) {
      showToast('Please enter valid purchase cost');
      return;
    }

    if (id) {
      // Editing existing product
      const existing = aceProducts.find(p => p.id === id);
      if (existing) {
        existing.name = name;
        existing.emoji = emoji;
        existing.initialCost = initialCost;
        existing.benchmarkNote = benchmark;
        existing.createdAt = dateVal;
        showToast(`Updated "${name}"`);
      }
    } else {
      // Create new product
      const newProduct = {
        id: 'ace_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        name: name,
        emoji: emoji,
        initialCost: initialCost,
        createdAt: dateVal,
        benchmarkNote: benchmark,
        logs: []
      };
      aceProducts.unshift(newProduct);
      showToast(`Added product "${name}" (₹${initialCost.toFixed(2)})`);
    }

    saveAceToStorage();
    renderAce();
    document.getElementById('aceProductModal').classList.add('hidden');
  }

  function deleteAceProduct(productId) {
    const prod = aceProducts.find(p => p.id === productId);
    if (!prod) return;

    if (confirm(`Delete product "${prod.name}" and all its recorded savings/costs?`)) {
      aceProducts = aceProducts.filter(p => p.id !== productId);
      delete expandedAceHistory[productId];
      saveAceToStorage();
      renderAce();
      showToast(`Deleted "${prod.name}"`);
    }
  }

  /**
   * Open the Log Modal for either '+' (Extra Cost) or '-' (Saving)
   */
  function openAceLogModal(productId, type) {
    const prod = aceProducts.find(p => p.id === productId);
    if (!prod) return;

    const metrics = calculateProductMetrics(prod);

    document.getElementById('aceLogProductId').value = prod.id;
    document.getElementById('aceLogType').value = type;

    document.getElementById('aceLogProductEmoji').textContent = prod.emoji || '📦';
    document.getElementById('aceLogProductName').textContent = prod.name;

    const statusBannerSub = document.getElementById('aceLogProductStatus');
    if (!metrics.isRecovered) {
      statusBannerSub.textContent = `Outstanding: ₹${metrics.outstandingExpense.toFixed(2)} (${metrics.recoveryRate}% recovered)`;
      statusBannerSub.style.color = '#f87171';
    } else {
      statusBannerSub.textContent = `Paid Off! Net Profit: ₹${metrics.excessSaving.toFixed(2)}`;
      statusBannerSub.style.color = '#34d399';
    }

    const modalTitle = document.getElementById('aceLogModalTitle');
    const amountLabel = document.getElementById('aceLogAmountLabel');
    const noteLabel = document.getElementById('aceLogNoteLabel');
    const noteInput = document.getElementById('aceLogNote');
    const submitBtn = document.getElementById('aceLogSubmitBtn');
    const presetsContainer = document.getElementById('aceLogPresetChips');

    document.getElementById('aceLogAmount').value = '';
    document.getElementById('aceLogDate').value = getTodayFormatted();
    presetsContainer.innerHTML = '';

    if (type === 'cost') {
      // '+' EXTRA COST (repairs, maintenance, accessories)
      modalTitle.textContent = `+ Add Extra Cost for ${prod.name}`;
      amountLabel.textContent = 'Extra Cost Amount (₹) *';
      noteLabel.textContent = 'Reason / Repair Note *';
      noteInput.placeholder = 'e.g. Tire repair, Annual service, New accessories';
      submitBtn.textContent = '+ Add Extra Cost';
      submitBtn.className = 'btn btn-danger';

      const presets = ['Puncture repair', 'General service', 'Spare parts', 'Accessories / Gear', 'Cleaning & oiling'];
      presets.forEach(text => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'preset-chip';
        chip.textContent = text;
        chip.addEventListener('click', () => {
          noteInput.value = text;
        });
        presetsContainer.appendChild(chip);
      });
    } else {
      // '-' SAVING (money saved thanks to product, e.g. saved on Rapido)
      modalTitle.textContent = `- Log Saving for ${prod.name}`;
      amountLabel.textContent = 'Amount Saved (₹) *';
      noteLabel.textContent = 'Savings Description *';
      noteInput.placeholder = 'e.g. Commute to office (saved on Rapido)';
      submitBtn.textContent = '- Log Saving';
      submitBtn.className = 'btn btn-accent';

      const presets = [
        'Commute to office (saved on Rapido)',
        'Round-trip Rapido commute saved',
        'Avoided cab / taxi fare',
        'Home replacement saving',
        'Daily commute offset'
      ];

      // If user has a benchmark note like "Rapido", extract or add custom chip
      if (prod.benchmarkNote) {
        presets.unshift(prod.benchmarkNote);
      }

      presets.slice(0, 4).forEach(text => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'preset-chip';
        chip.textContent = text;
        chip.addEventListener('click', () => {
          noteInput.value = text;
        });
        presetsContainer.appendChild(chip);
      });
    }

    document.getElementById('aceLogModal').classList.remove('hidden');
    setTimeout(() => document.getElementById('aceLogAmount').focus(), 100);
  }

  function saveAceLogFromModal() {
    const prodId = document.getElementById('aceLogProductId').value;
    const type = document.getElementById('aceLogType').value; // 'cost' or 'saving'
    const amountVal = parseFloat(document.getElementById('aceLogAmount').value);
    const noteVal = document.getElementById('aceLogNote').value.trim() || (type === 'cost' ? 'Extra Expense' : 'Saving');
    const dateVal = document.getElementById('aceLogDate').value || getTodayFormatted();

    if (isNaN(amountVal) || amountVal <= 0) {
      showToast('Please enter a valid amount');
      return;
    }

    const prod = aceProducts.find(p => p.id === prodId);
    if (!prod) return;

    if (!prod.logs) prod.logs = [];

    const newLog = {
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: type,
      amount: amountVal,
      note: noteVal,
      date: dateVal
    };

    prod.logs.push(newLog);
    saveAceToStorage();

    // Auto expand history so user sees their new entry
    expandedAceHistory[prodId] = true;

    renderAce();
    document.getElementById('aceLogModal').classList.add('hidden');

    const updatedMetrics = calculateProductMetrics(prod);
    if (type === 'saving') {
      if (updatedMetrics.isRecovered) {
        showToast(`🎉 Logged ₹${amountVal.toFixed(2)} saving! Product is fully paid off with ₹${updatedMetrics.excessSaving.toFixed(2)} net profit!`);
      } else {
        showToast(`Saved ₹${amountVal.toFixed(2)} on "${prod.name}"! Outstanding: ₹${updatedMetrics.outstandingExpense.toFixed(2)}`);
      }
    } else {
      showToast(`Added +₹${amountVal.toFixed(2)} cost to "${prod.name}"`);
    }
  }

  function deleteAceTransaction(productId, txId) {
    const prod = aceProducts.find(p => p.id === productId);
    if (!prod || !prod.logs) return;

    prod.logs = prod.logs.filter(l => l.id !== txId);
    saveAceToStorage();
    renderAce();
    showToast('Transaction removed');
  }

  // ==========================================================================
  // HABITS MANAGEMENT MODAL
  // ==========================================================================
  function initHabitModal() {
    const manageHabitsBtn = document.getElementById('manageHabitsBtn');
    const habitsModal = document.getElementById('habitsModal');
    const closeHabitsModal = document.getElementById('closeHabitsModal');
    const addHabitForm = document.getElementById('addHabitForm');

    manageHabitsBtn.addEventListener('click', openHabitsModal);
    closeHabitsModal.addEventListener('click', closeHabitsModalFn);

    habitsModal.addEventListener('click', (e) => {
      if (e.target === habitsModal) closeHabitsModalFn();
    });

    addHabitForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const emojiInput = document.getElementById('newHabitEmoji').value.trim() || '✨';
      const titleInput = document.getElementById('newHabitTitle').value.trim();

      if (!titleInput) return;

      const newHabit = {
        id: 'h_' + Date.now(),
        emoji: emojiInput,
        title: titleInput
      };

      habitTemplates.push(newHabit);
      saveHabitsToStorage();

      document.getElementById('newHabitTitle').value = '';
      renderHabitsManageList();
      renderHabits();
      renderStats();
      showToast('New habit added!');
    });
  }

  function openHabitsModal() {
    renderHabitsManageList();
    document.getElementById('habitsModal').classList.remove('hidden');
  }

  function closeHabitsModalFn() {
    document.getElementById('habitsModal').classList.add('hidden');
  }

  function renderHabitsManageList() {
    const container = document.getElementById('habitsManageList');
    container.innerHTML = '';

    habitTemplates.forEach((habit, index) => {
      const item = document.createElement('div');
      item.className = 'manage-habit-item';
      item.innerHTML = `
        <div class="manage-habit-info">
          <span>${habit.emoji || '✨'}</span>
          <span>${escapeHtml(habit.title)}</span>
        </div>
        <button class="btn btn-danger btn-xs delete-habit-btn" data-index="${index}" title="Remove habit">&times;</button>
      `;

      item.querySelector('.delete-habit-btn').addEventListener('click', () => {
        deleteHabitTemplate(index);
      });

      container.appendChild(item);
    });
  }

  function deleteHabitTemplate(index) {
    if (confirm(`Delete habit "${habitTemplates[index].title}"?`)) {
      habitTemplates.splice(index, 1);
      saveHabitsToStorage();
      renderHabitsManageList();
      renderHabits();
      renderStats();
      showToast('Habit removed');
    }
  }

  // ==========================================================================
  // SETTINGS & EXCEL / JSON EXPORT/IMPORT
  // ==========================================================================
  function initSettingsModal() {
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsModal = document.getElementById('closeSettingsModal');

    const exportExcelBtn = document.getElementById('exportExcelBtn');
    const modalExportCsvBtn = document.getElementById('modalExportCsvBtn');
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    const importJsonInput = document.getElementById('importJsonInput');
    const clearDataBtn = document.getElementById('clearDataBtn');

    settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    closeSettingsModal.addEventListener('click', () => settingsModal.classList.add('hidden'));

    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) settingsModal.classList.add('hidden');
    });

    exportExcelBtn.addEventListener('click', exportToExcelCSV);
    modalExportCsvBtn.addEventListener('click', exportToExcelCSV);
    exportJsonBtn.addEventListener('click', exportToJson);

    importJsonInput.addEventListener('change', importFromJson);
    clearDataBtn.addEventListener('click', clearAllData);
  }

  /**
   * EXCEL CSV EXPORT ENGINE
   * Formats habits, daily expenses, AND ACE actual cost evaluations
   * into an Excel-friendly UTF-8 CSV with BOM
   */
  function exportToExcelCSV() {
    const dates = Object.keys(dailyLogs).sort();
    const csvSections = [];

    // --- Section 1: Daily Habits & Expenses ---
    const habitTitles = habitTemplates.map(h => h.title);
    const headersDaily = ['Date', 'Total Expenses (₹)', 'Expense Details', 'Habits Completed', ...habitTitles];
    const dailyRows = [];
    dailyRows.push(['=== DAILY HABITS & EXPENSES LOG ===']);
    dailyRows.push(headersDaily.map(escapeCsvValue).join(','));

    dates.forEach(dateKey => {
      const log = dailyLogs[dateKey] || {};
      const habitsState = log.habits || {};
      const expensesList = log.expenses || [];

      const totalExpense = expensesList.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      const expenseNotes = expensesList.map(e => `${e.note} (₹${parseFloat(e.amount).toFixed(2)})`).join('; ');

      let completedHabitCount = 0;
      const habitCheckValues = habitTemplates.map(h => {
        const checked = !!habitsState[h.id];
        if (checked) completedHabitCount++;
        return checked ? 'YES' : 'NO';
      });

      const habitRatio = `${completedHabitCount}/${habitTemplates.length}`;

      const row = [
        dateKey,
        totalExpense.toFixed(2),
        expenseNotes || 'None',
        habitRatio,
        ...habitCheckValues
      ];

      dailyRows.push(row.map(escapeCsvValue).join(','));
    });

    csvSections.push(dailyRows.join('\r\n'));

    // --- Section 2: ACE (Actual Cost Evaluator) Products & Payoff ---
    if (aceProducts.length > 0) {
      const aceRows = [];
      aceRows.push('\r\n\r\n=== ACE: ACTUAL COST EVALUATOR (PRODUCTS & PAYOFF) ===');
      aceRows.push([
        'Product Name',
        'Initial Cost (₹)',
        'Extra Costs (+) (₹)',
        'Total Investment (₹)',
        'Total Savings (-) (₹)',
        'Recovery Status',
        'Outstanding Pending (₹)',
        'Net Profit Saved (₹)',
        'Recovery Rate %',
        'Savings Benchmark / Purpose'
      ].map(escapeCsvValue).join(','));

      aceProducts.forEach(prod => {
        const m = calculateProductMetrics(prod);
        aceRows.push([
          prod.name,
          m.initialCost.toFixed(2),
          m.extraCosts.toFixed(2),
          m.totalCost.toFixed(2),
          m.totalSavings.toFixed(2),
          m.isRecovered ? 'PAID OFF (PROFITABLE)' : 'PENDING RECOVERY',
          m.outstandingExpense.toFixed(2),
          m.excessSaving.toFixed(2),
          `${m.recoveryRate}%`,
          prod.benchmarkNote || 'None'
        ].map(escapeCsvValue).join(','));
      });

      // Section 2.1: Transaction audit breakdown
      aceRows.push('\r\n=== ACE TRANSACTION DETAILS ===');
      aceRows.push(['Product', 'Type', 'Amount (₹)', 'Date', 'Description / Note'].map(escapeCsvValue).join(','));

      aceProducts.forEach(prod => {
        (prod.logs || []).forEach(log => {
          aceRows.push([
            prod.name,
            log.type === 'cost' ? 'Extra Cost (+)' : 'Saving (-)',
            parseFloat(log.amount).toFixed(2),
            log.date || 'N/A',
            log.note || ''
          ].map(escapeCsvValue).join(','));
        });
      });

      csvSections.push(aceRows.join('\r\n'));
    }

    const csvContent = '\uFEFF' + csvSections.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    const downloadLink = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const fileName = `Tracker_Export_Full_${getTodayFormatted()}.csv`;

    downloadLink.setAttribute('href', url);
    downloadLink.setAttribute('download', fileName);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    showToast('Exported complete data to Excel CSV!');
  }

  function escapeCsvValue(val) {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  }

  // JSON Export / Import
  function exportToJson() {
    const dataObj = {
      version: 2,
      exportedAt: new Date().toISOString(),
      habits: habitTemplates,
      logs: dailyLogs,
      aceProducts: aceProducts
    };

    const jsonStr = JSON.stringify(dataObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `tracker_backup_${getTodayFormatted()}.json`;
    a.click();
    showToast('JSON Backup downloaded!');
  }

  function importFromJson(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.habits && Array.isArray(parsed.habits)) {
          habitTemplates = parsed.habits;
        }
        if (parsed.logs && typeof parsed.logs === 'object') {
          dailyLogs = parsed.logs;
        }
        if (parsed.aceProducts && Array.isArray(parsed.aceProducts)) {
          aceProducts = parsed.aceProducts;
        }

        saveHabitsToStorage();
        saveLogsToStorage();
        saveAceToStorage();

        renderAll();
        document.getElementById('settingsModal').classList.add('hidden');
        showToast('Backup restored successfully!');
      } catch (err) {
        showToast('Invalid JSON file format');
      }
    };
    reader.readAsText(file);
  }

  function clearAllData() {
    if (confirm('Are you sure you want to delete all habits, recorded logs, and ACE product evaluations? This action cannot be undone.')) {
      localStorage.removeItem(STORAGE_HABITS_KEY);
      localStorage.removeItem(STORAGE_LOGS_KEY);
      localStorage.removeItem(STORAGE_ACE_KEY);
      habitTemplates = [...DEFAULT_HABITS];
      dailyLogs = {};
      aceProducts = [...DEFAULT_ACE_PRODUCTS];
      expandedAceHistory = {};

      saveHabitsToStorage();
      saveLogsToStorage();
      saveAceToStorage();

      renderAll();
      document.getElementById('settingsModal').classList.add('hidden');
      showToast('All data reset to defaults');
    }
  }

  // ==========================================================================
  // PWA SERVICE WORKER REGISTRATION
  // ==========================================================================
  function initPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { scope: './' })
          .then((reg) => console.log('[PWA] Service Worker registered scope:', reg.scope))
          .catch((err) => console.log('[PWA] Service Worker registration failed:', err));
      });
    }
  }

  // ==========================================================================
  // RENDER ALL & TOAST HELPERS
  // ==========================================================================
  function renderAll() {
    renderDateHeader();
    renderExpenses();
    renderHabits();
    renderStats();
    renderAce();
    updateAceNavChip();
  }

  function showToast(message) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2600);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
