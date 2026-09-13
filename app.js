/**
 * Daily Habit & Expense Tracker PWA
 * Pure Client-Side JavaScript Application
 */

(function () {
  'use strict';

  // ==========================================================================
  // APP STATE & STORAGE KEYS
  // ==========================================================================
  const STORAGE_HABITS_KEY = 'tracker_habits_v1';
  const STORAGE_LOGS_KEY = 'tracker_logs_v1';

  // Default Habit Templates
  const DEFAULT_HABITS = [
    { id: 'h_1', emoji: '💪', title: 'Exercise 30 mins' },
    { id: 'h_2', emoji: '💧', title: 'Drink 2L Water' },
    { id: 'h_3', emoji: '📖', title: 'Read 15 Pages' },
    { id: 'h_4', emoji: '🧘', title: 'Meditation 10 mins' },
    { id: 'h_5', emoji: '😴', title: '7+ Hours Sleep' }
  ];

  // App State Variables
  let habitTemplates = [];
  let dailyLogs = {}; // Key: YYYY-MM-DD -> { habits: { habitId: boolean }, expenses: [ { id, amount, note, timestamp } ] }
  let selectedDate = getTodayFormatted();
  let deferredInstallPrompt = null;

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    loadDataFromStorage();
    initDateControls();
    initExpenseForm();
    initHabitModal();
    initSettingsModal();
    initPWA();
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
  // STORAGE MANAGEMENT
  // ==========================================================================
  function loadDataFromStorage() {
    try {
      const storedHabits = localStorage.getItem(STORAGE_HABITS_KEY);
      if (storedHabits) {
        habitTemplates = JSON.parse(storedHabits);
      } else {
        habitTemplates = [...DEFAULT_HABITS];
        saveHabitsToStorage();
      }

      const storedLogs = localStorage.getItem(STORAGE_LOGS_KEY);
      if (storedLogs) {
        dailyLogs = JSON.parse(storedLogs);
      } else {
        dailyLogs = {};
        saveLogsToStorage();
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

    // Day Name Label (Today / Yesterday / Tomorrow / Day of Week)
    if (selectedDate === todayKey) {
      dateDayName.textContent = 'Today';
    } else {
      const diffTime = dateObj - parseDateKey(todayKey);
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === -1) dateDayName.textContent = 'Yesterday';
      else if (diffDays === 1) dateDayName.textContent = 'Tomorrow';
      else dateDayName.textContent = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    }

    // Formatted Date (e.g. Sep 14, 2026)
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
      showToast(`Added expense: $${amountVal.toFixed(2)}`);
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
          <span class="expense-item-amount">$${parseFloat(item.amount).toFixed(2)}</span>
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
        ${streak > 0 ? `<div class="habit-streak">🔥 ${streak}d</div>` : ''}
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

  // Streak Calculation (consecutive days completed up to current selected date / today)
  function calculateHabitStreak(habitId) {
    let streak = 0;
    let checkDate = parseDateKey(selectedDate);

    while (true) {
      const dateKey = formatDateKey(checkDate);
      if (dailyLogs[dateKey] && dailyLogs[dateKey].habits && dailyLogs[dateKey].habits[habitId]) {
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
    // 1. Current Perfect Day Streak
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

    // 2. 7-Day Habit Completion Rate & 7-Day Expense Total
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
   * Formats all logged data into an Excel-friendly UTF-8 CSV with BOM
   */
  function exportToExcelCSV() {
    const dates = Object.keys(dailyLogs).sort();

    if (dates.length === 0) {
      showToast('No data available to export yet!');
      return;
    }

    // Prepare CSV Header Columns
    // Columns: Date, Total Expenses ($), Expense Details, Habits Completed Ratio, [Habit 1 Title], [Habit 2 Title]...
    const habitTitles = habitTemplates.map(h => h.title);
    const headers = ['Date', 'Total Expenses ($)', 'Expense Details', 'Habits Completed', ...habitTitles];

    const csvRows = [];
    csvRows.push(headers.map(escapeCsvValue).join(','));

    dates.forEach(dateKey => {
      const log = dailyLogs[dateKey] || {};
      const habitsState = log.habits || {};
      const expensesList = log.expenses || [];

      // Calculate Total Expense & Notes
      const totalExpense = expensesList.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      const expenseNotes = expensesList.map(e => `${e.note} ($${parseFloat(e.amount).toFixed(2)})`).join('; ');

      // Count Habits
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

      csvRows.push(row.map(escapeCsvValue).join(','));
    });

    // Create CSV blob with UTF-8 BOM so Excel displays unicode characters seamlessly
    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    const downloadLink = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const fileName = `Daily_Tracker_Export_${getTodayFormatted()}.csv`;

    downloadLink.setAttribute('href', url);
    downloadLink.setAttribute('download', fileName);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    showToast('Exported to Excel CSV!');
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
      version: 1,
      exportedAt: new Date().toISOString(),
      habits: habitTemplates,
      logs: dailyLogs
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

        saveHabitsToStorage();
        saveLogsToStorage();

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
    if (confirm('Are you sure you want to delete all habits and recorded logs? This action cannot be undone.')) {
      localStorage.removeItem(STORAGE_HABITS_KEY);
      localStorage.removeItem(STORAGE_LOGS_KEY);
      habitTemplates = [...DEFAULT_HABITS];
      dailyLogs = {};
      saveHabitsToStorage();
      saveLogsToStorage();
      renderAll();
      document.getElementById('settingsModal').classList.add('hidden');
      showToast('All data reset to defaults');
    }
  }

  // ==========================================================================
  // PWA REGISTRATION & INSTALL PROMPT
  // ==========================================================================
  function initPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => console.log('[PWA] Service Worker registered:', reg.scope))
          .catch((err) => console.log('[PWA] Service Worker registration failed:', err));
      });
    }

    const pwaInstallBtn = document.getElementById('pwaInstallBtn');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      pwaInstallBtn.classList.remove('hidden');
    });

    pwaInstallBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      console.log('[PWA] User response to install prompt:', outcome);
      deferredInstallPrompt = null;
      pwaInstallBtn.classList.add('hidden');
    });
  }

  // ==========================================================================
  // RENDER ALL & TOAST HELPERS
  // ==========================================================================
  function renderAll() {
    renderDateHeader();
    renderExpenses();
    renderHabits();
    renderStats();
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
