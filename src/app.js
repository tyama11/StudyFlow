import { renderWeeklyChart } from "./chart.js";
import kaeruPianoAudioSrc from "./assets/audio/kaeru_piano.mp3";
import {
  STORAGE_KEYS,
  DEFAULT_SUBJECTS,
  DEFAULT_GOAL_SETTINGS,
  DEFAULT_POMODORO_SETTINGS,
} from "./constants/defaults.js";
import { getTodayStr, formatDateDisplay } from "./utils/date.js";
import { formatDuration, formatHoursMinutes, generateId, escapeHtml } from "./utils/format.js";
import {
  calculateTotalSeconds,
  calculateGoalProgress,
  aggregateSessionsBySubject,
  getWeeklyChartData,
} from "./models/stats.js";
import { sanitizePomodoroMinutes } from "./models/timer.js";

let todos = [];
let sessions = [];
let subjects = [];
let goalSettings = { ...DEFAULT_GOAL_SETTINGS };
let pomodoroSettings = { ...DEFAULT_POMODORO_SETTINGS };
let activeTab = "tracker";
let currentTheme = "auto"; // 'auto' | 'dark' | 'light'

// Audio State
let alarmAudio = null;
let isAlarmRinging = false;
let isPreviewPlaying = false;
let previewAudio = null;

// Confirm Modal Callback
let confirmModalCallback = null;

// Timer State
let timerMode = "countup"; // 'countup' | 'pomodoro'
let timerInterval = null;
let timerSeconds = 0;
let timerRunning = false;
let sessionStartTime = null;
let currentSessionDurationSeconds = 0;

// History State
let selectedHistoryDate = getTodayStr();

// --- Custom Modal Dialog & Toast (Tauri/WebView Safe) ---
function showConfirmModal({ title, message, confirmText, confirmClass, onConfirm }) {
  const modal = document.getElementById("confirm-modal");
  const titleEl = document.getElementById("confirm-modal-title");
  const msgEl = document.getElementById("confirm-modal-message");
  const confirmBtn = document.getElementById("confirm-modal-btn-confirm");

  if (!modal) {
    if (onConfirm) onConfirm();
    return;
  }

  if (titleEl) titleEl.textContent = title || "確認";
  if (msgEl) msgEl.textContent = message || "本当に実行しますか？";
  if (confirmBtn) {
    confirmBtn.textContent = confirmText || "実行する";
    confirmBtn.className = `btn ${confirmClass || "btn-danger"}`;
  }

  confirmModalCallback = onConfirm || null;
  modal.style.display = "flex";
}

function closeConfirmModal() {
  const modal = document.getElementById("confirm-modal");
  if (modal) modal.style.display = "none";
  confirmModalCallback = null;
}

function showToast(message) {
  let toast = document.getElementById("app-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "app-toast";
    toast.className = "app-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toast.timeoutId);
  toast.timeoutId = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

// --- Theme Management ---
function initTheme() {
  currentTheme = localStorage.getItem(STORAGE_KEYS.THEME) || "auto";
  applyTheme(currentTheme);
}

function applyTheme(theme) {
  currentTheme = theme;
  localStorage.setItem(STORAGE_KEYS.THEME, theme);

  const iconEl = document.getElementById("theme-toggle-icon");
  const textEl = document.getElementById("theme-toggle-text");

  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    if (iconEl) iconEl.textContent = "🌙";
    if (textEl) textEl.textContent = "ダーク";
  } else if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
    if (iconEl) iconEl.textContent = "☀️";
    if (textEl) textEl.textContent = "ライト";
  } else {
    // OS auto
    document.documentElement.removeAttribute("data-theme");
    if (iconEl) iconEl.textContent = "🌓";
    if (textEl) textEl.textContent = "OS連動";
  }

  // Redraw chart if visible
  if (activeTab === "history") {
    renderWeeklyTrend();
  }
}

function toggleTheme() {
  if (currentTheme === "auto") {
    applyTheme("dark");
  } else if (currentTheme === "dark") {
    applyTheme("light");
  } else {
    applyTheme("auto");
  }
}

// --- Data Persistence ---
function loadData() {
  try {
    const rawTodos = localStorage.getItem(STORAGE_KEYS.TODOS);
    todos = rawTodos ? JSON.parse(rawTodos) : [];

    const rawSessions = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    sessions = rawSessions ? JSON.parse(rawSessions) : [];

    const rawSubjects = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
    if (rawSubjects) {
      subjects = JSON.parse(rawSubjects);
    } else {
      subjects = JSON.parse(JSON.stringify(DEFAULT_SUBJECTS));
    }

    const rawGoalSettings = localStorage.getItem(STORAGE_KEYS.GOAL_SETTINGS);
    if (rawGoalSettings) {
      goalSettings = { ...DEFAULT_GOAL_SETTINGS, ...JSON.parse(rawGoalSettings) };
    } else {
      goalSettings = { ...DEFAULT_GOAL_SETTINGS };
    }

    const rawPomodoroSettings = localStorage.getItem(STORAGE_KEYS.POMODORO_SETTINGS);
    if (rawPomodoroSettings) {
      pomodoroSettings = { ...DEFAULT_POMODORO_SETTINGS, ...JSON.parse(rawPomodoroSettings) };
    } else {
      pomodoroSettings = { ...DEFAULT_POMODORO_SETTINGS };
    }
  } catch (e) {
    console.error("Failed to parse localStorage data", e);
    todos = [];
    sessions = [];
    subjects = JSON.parse(JSON.stringify(DEFAULT_SUBJECTS));
    goalSettings = { ...DEFAULT_GOAL_SETTINGS };
    pomodoroSettings = { ...DEFAULT_POMODORO_SETTINGS };
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEYS.TODOS, JSON.stringify(todos));
  localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  updateAllViews();
}

function saveSubjects() {
  localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));
  renderSubjectSelects();
  renderSubjectManageList();
  updateAllViews();
}

function saveGoalSettings() {
  localStorage.setItem(STORAGE_KEYS.GOAL_SETTINGS, JSON.stringify(goalSettings));
  updateGoalSettingsUI();
  updateHeaderAndSummary();
  showToast("1日の目標設定を保存しました！");
}

// --- Pomodoro & Alarm Sound ---
function getAudioSource() {
  return kaeruPianoAudioSrc || "./audio/kaeru_piano.mp3";
}

function initAlarmAudio() {
  if (!alarmAudio) {
    try {
      alarmAudio = new Audio(getAudioSource());
      alarmAudio.loop = true;
    } catch (e) {
      console.warn("Audio initialization warning:", e);
    }
  }
  if (alarmAudio) {
    alarmAudio.volume = pomodoroSettings.volume !== undefined ? pomodoroSettings.volume : 0.8;
  }
}

function playAlarmSound() {
  if (!pomodoroSettings.soundEnabled) return;
  initAlarmAudio();
  if (!alarmAudio) return;
  isAlarmRinging = true;
  alarmAudio.currentTime = 0;
  alarmAudio.play().catch((err) => {
    console.warn("Alarm play prevented (user interaction might be needed):", err);
  });
}

function stopAlarmSound() {
  isAlarmRinging = false;
  if (alarmAudio) {
    alarmAudio.pause();
    alarmAudio.currentTime = 0;
  }
  const alarmBtn = document.getElementById("btn-timer-alarm-stop");
  if (alarmBtn) alarmBtn.style.display = "none";
  const timerCircle = document.getElementById("timer-circle");
  if (timerCircle) timerCircle.classList.remove("completed");
}

function startPreviewSound() {
  if (!previewAudio) {
    try {
      previewAudio = new Audio(getAudioSource());
      previewAudio.loop = false;
      previewAudio.onended = () => {
        stopPreviewSound();
      };
    } catch (e) {
      console.warn("Preview audio warning:", e);
    }
  }
  if (previewAudio) {
    previewAudio.volume = pomodoroSettings.volume !== undefined ? pomodoroSettings.volume : 0.8;
    previewAudio.currentTime = 0;
    previewAudio.play().then(() => {
      isPreviewPlaying = true;
      updateSoundPreviewButton(true);
    }).catch((err) => {
      console.warn("Preview audio play error:", err);
      showToast("音声の再生がブラウザによりブロックされました");
    });
  }
}

function stopPreviewSound() {
  if (previewAudio) {
    previewAudio.pause();
    previewAudio.currentTime = 0;
  }
  isPreviewPlaying = false;
  updateSoundPreviewButton(false);
}

function togglePreviewSound() {
  if (isPreviewPlaying) {
    stopPreviewSound();
  } else {
    startPreviewSound();
  }
}

function updateSoundPreviewButton(isPlaying) {
  const previewText = document.getElementById("btn-sound-preview-text");
  if (previewText) {
    previewText.textContent = isPlaying ? "試聴を停止" : "テスト試聴";
  }
}

function savePomodoroSettings(showNotification = false) {
  localStorage.setItem(STORAGE_KEYS.POMODORO_SETTINGS, JSON.stringify(pomodoroSettings));
  updatePomodoroUI();
  if (showNotification) {
    showToast("ポモドーロ＆アラーム設定を保存しました！");
  }
}

function setPomodoroMinutes(minutes, updateTimerIfIdle = true) {
  const m = sanitizePomodoroMinutes(minutes);
  pomodoroSettings.workMinutes = m;
  savePomodoroSettings(false);
  if (timerMode === "pomodoro" && !timerRunning && updateTimerIfIdle) {
    timerSeconds = m * 60;
    updateTimerDisplay();
  }
}

function updatePomodoroUI() {
  const workMins = pomodoroSettings.workMinutes || 25;

  // 1. タイマーモードボタンのラベル更新
  const pomodoroModeBtn = document.getElementById("btn-mode-pomodoro");
  if (pomodoroModeBtn) {
    pomodoroModeBtn.textContent = `ポモドーロ (${workMins}分)`;
  }

  // 2. タイマーカードのクイックバー更新
  const quickBar = document.getElementById("pomodoro-quick-bar");
  if (quickBar) {
    quickBar.style.display = timerMode === "pomodoro" ? "flex" : "none";
  }

  const quickPresets = document.querySelectorAll(".pomo-preset-btn");
  let matchesQuickPreset = false;
  quickPresets.forEach((btn) => {
    const mins = parseInt(btn.dataset.minutes, 10);
    if (mins === workMins) {
      btn.classList.add("active");
      matchesQuickPreset = true;
    } else {
      btn.classList.remove("active");
    }
  });

  const customInput = document.getElementById("pomo-quick-custom-input");
  if (customInput) {
    customInput.value = matchesQuickPreset ? "" : workMins;
  }

  // 3. 設定タブのポモドーロカード更新
  const settingBadge = document.getElementById("pomodoro-current-badge");
  if (settingBadge) {
    settingBadge.textContent = `現在: ${workMins}分`;
  }

  const settingInput = document.getElementById("setting-pomo-minutes");
  if (settingInput) {
    settingInput.value = workMins;
  }

  const settingPresets = document.querySelectorAll(".btn-pomo-setting-preset");
  settingPresets.forEach((btn) => {
    const mins = parseInt(btn.dataset.minutes, 10);
    if (mins === workMins) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  const soundCheckbox = document.getElementById("setting-pomo-sound-enabled");
  if (soundCheckbox) {
    soundCheckbox.checked = pomodoroSettings.soundEnabled !== false;
  }

  const volumeSlider = document.getElementById("setting-pomo-volume");
  const volumeText = document.getElementById("setting-pomo-volume-text");
  const volPct = Math.round((pomodoroSettings.volume !== undefined ? pomodoroSettings.volume : 0.8) * 100);
  if (volumeSlider) {
    volumeSlider.value = volPct;
  }
  if (volumeText) {
    volumeText.textContent = `${volPct}%`;
  }
}

// --- Goal Settings UI ---
function updateGoalSettingsUI() {
  const typeTasksRadio = document.querySelector('input[name="goal-type"][value="tasks"]');
  const typeTimeRadio = document.querySelector('input[name="goal-type"][value="time"]');
  const labelTasks = document.getElementById("goal-type-label-tasks");
  const labelTime = document.getElementById("goal-type-label-time");
  const tasksConfig = document.getElementById("goal-tasks-config");
  const timeConfig = document.getElementById("goal-time-config");

  if (goalSettings.type === "time") {
    if (typeTimeRadio) typeTimeRadio.checked = true;
    if (labelTime) labelTime.classList.add("active");
    if (labelTasks) labelTasks.classList.remove("active");
    if (timeConfig) timeConfig.style.display = "block";
    if (tasksConfig) tasksConfig.style.display = "none";
  } else {
    if (typeTasksRadio) typeTasksRadio.checked = true;
    if (labelTasks) labelTasks.classList.add("active");
    if (labelTime) labelTime.classList.remove("active");
    if (tasksConfig) tasksConfig.style.display = "block";
    if (timeConfig) timeConfig.style.display = "none";
  }

  const modeAllRadio = document.querySelector('input[name="goal-task-mode"][value="all"]');
  const modeCustomRadio = document.querySelector('input[name="goal-task-mode"][value="custom"]');
  const countRow = document.getElementById("goal-task-count-row");
  const countInput = document.getElementById("goal-task-count-input");

  if (goalSettings.taskTargetMode === "custom") {
    if (modeCustomRadio) modeCustomRadio.checked = true;
    if (countRow) countRow.style.display = "flex";
  } else {
    if (modeAllRadio) modeAllRadio.checked = true;
    if (countRow) countRow.style.display = "none";
  }
  if (countInput) countInput.value = goalSettings.taskTargetCount || 5;

  const hoursInput = document.getElementById("goal-time-hours-input");
  const minsInput = document.getElementById("goal-time-mins-input");
  const totalMins = goalSettings.timeTargetMinutes || 180;
  if (hoursInput) hoursInput.value = Math.floor(totalMins / 60);
  if (minsInput) minsInput.value = totalMins % 60;

  const badge = document.getElementById("current-goal-badge");
  if (badge) {
    if (goalSettings.type === "time") {
      badge.textContent = `学習時間 (目標 ${formatHoursMinutes(totalMins * 60)})`;
    } else if (goalSettings.taskTargetMode === "custom") {
      badge.textContent = `タスク数 (目標 ${goalSettings.taskTargetCount} 個)`;
    } else {
      badge.textContent = `タスク数 (全タスク完了)`;
    }
  }
}

// --- Subject Management ---
function addSubject(name, color) {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (subjects.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
    showToast(`「${trimmed}」は既に登録されています`);
    return false;
  }
  subjects.push({
    name: trimmed,
    color: color || "#6366f1",
  });
  saveSubjects();
  showToast(`科目「${trimmed}」を追加しました！`);
  return true;
}

function deleteSubject(name) {
  showConfirmModal({
    title: "科目の削除",
    message: `「${name}」を科目一覧から削除しますか？\n（※過去に記録した学習ログやTODOのデータは保持されます）`,
    confirmText: "削除する",
    confirmClass: "btn-danger",
    onConfirm: () => {
      subjects = subjects.filter((s) => s.name !== name);
      saveSubjects();
      showToast(`科目「${name}」を削除しました`);
    },
  });
}

function resetSubjects() {
  showConfirmModal({
    title: "科目の初期化",
    message: "科目一覧を初期の標準セットに戻しますか？\n（※追加したカスタム科目は削除されます）",
    confirmText: "初期状態に戻す",
    confirmClass: "btn-secondary",
    onConfirm: () => {
      subjects = JSON.parse(JSON.stringify(DEFAULT_SUBJECTS));
      saveSubjects();
      showToast("科目一覧を初期状態に戻しました");
    },
  });
}

function renderSubjectSelects() {
  const selectConfigs = [
    { id: "timer-subject" },
    { id: "todo-input-subject" },
    { id: "modal-subject" },
    { id: "edit-session-subject" },
  ];

  selectConfigs.forEach(({ id }) => {
    const select = document.getElementById(id);
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = subjects
      .map((s) => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`)
      .join("");

    if (currentVal && subjects.some((s) => s.name === currentVal)) {
      select.value = currentVal;
    } else if (subjects.length > 0) {
      select.value = subjects[0].name;
    }
  });

  const timerSub = document.getElementById("timer-subject");
  const targetDisplay = document.getElementById("timer-target-display");
  if (timerSub && targetDisplay) {
    targetDisplay.textContent = `科目: ${timerSub.value || "未選択"}`;
  }
}

function renderSubjectManageList() {
  const container = document.getElementById("subject-chips-container");
  const countBadge = document.getElementById("subject-count-badge");
  if (!container) return;

  if (countBadge) {
    countBadge.textContent = `${subjects.length} 科目登録中`;
  }

  if (subjects.length === 0) {
    container.innerHTML = `<div class="empty-hint">登録されている科目がありません。「科目を追加」から登録してください。</div>`;
    return;
  }

  container.innerHTML = subjects
    .map(
      (s) => `
    <div class="subject-chip-item">
      <span class="subject-chip-color" style="background-color: ${s.color};"></span>
      <span class="subject-chip-name">${escapeHtml(s.name)}</span>
      <button type="button" class="subject-chip-del btn-delete-subject" data-name="${escapeHtml(s.name)}" title="「${escapeHtml(s.name)}」を削除">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
  `
    )
    .join("");

  container.querySelectorAll(".btn-delete-subject").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-name");
      if (name) deleteSubject(name);
    });
  });
}

// --- View Updates ---
function updateAllViews() {
  updateHeaderAndSummary();
  renderTodoList();
  renderTodaySessions();
  updateTodoLinkOptions();
  renderHistoryView();
  renderSubjectManageList();
  updateGoalSettingsUI();
}

function updateHeaderAndSummary() {
  const todayStr = getTodayStr();
  const headerDateTitle = document.getElementById("header-date-title");
  if (headerDateTitle) {
    headerDateTitle.textContent = formatDateDisplay(todayStr);
  }

  // Calculate today's study time
  const todaySessions = sessions.filter((s) => s.date === todayStr);
  const totalSeconds = todaySessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);

  // Tab Inside Summary: Today's Total Time
  const todayTotalTimeEl = document.getElementById("today-total-time");
  if (todayTotalTimeEl) {
    todayTotalTimeEl.textContent = formatHoursMinutes(totalSeconds);
  }

  // Elements for goal display
  const goalIconEl = document.getElementById("today-goal-icon");
  const goalLabelEl = document.getElementById("today-goal-label");
  const goalRatioEl = document.getElementById("today-todo-ratio");
  const progressLabelEl = document.getElementById("today-progress-label");
  const percentEl = document.getElementById("today-progress-percent");
  const progressBar = document.getElementById("today-progress-bar");
  const goalBadgeEl = document.getElementById("today-goal-badge");

  const todayTodos = todos.filter((t) => !t.date || t.date === todayStr);
  const completedCount = todayTodos.filter((t) => t.completed).length;
  const totalTodoCount = todayTodos.length;

  const goalProgress = calculateGoalProgress(goalSettings, todaySessions, todayTodos);
  const { pct, isAchieved } = goalProgress;

  if (goalProgress.type === "time") {
    if (goalIconEl) goalIconEl.textContent = goalProgress.icon;
    if (goalLabelEl) goalLabelEl.textContent = `本日の学習目標 (${formatHoursMinutes(goalProgress.targetSeconds)})`;
    if (goalRatioEl) goalRatioEl.textContent = `${formatHoursMinutes(totalSeconds)} / ${formatHoursMinutes(goalProgress.targetSeconds)}`;
    if (progressLabelEl) progressLabelEl.textContent = "目標時間達成率";
  } else {
    if (goalIconEl) goalIconEl.textContent = goalProgress.icon;
    if (progressLabelEl) progressLabelEl.textContent = "タスク達成率";

    if (goalProgress.type === "tasks_custom") {
      if (goalLabelEl) goalLabelEl.textContent = `本日のTODO達成 (目標 ${goalProgress.targetCount} 個)`;
      if (goalRatioEl) goalRatioEl.textContent = `${goalProgress.completedCount} / ${goalProgress.targetCount} 個達成`;
    } else {
      if (goalLabelEl) goalLabelEl.textContent = "本日のTODO達成 (全タスク)";
      if (goalRatioEl) goalRatioEl.textContent = `${goalProgress.completedCount} / ${goalProgress.totalTodoCount} 完了`;
    }
  }

  // 達成率とプログレスバーの更新
  if (percentEl) {
    percentEl.textContent = `${pct}%`;
  }
  if (progressBar) {
    progressBar.style.width = `${Math.min(100, pct)}%`;
    if (isAchieved) {
      progressBar.style.background = "linear-gradient(90deg, #10b981, #059669)";
    } else {
      progressBar.style.background = "";
    }
  }

  // 達成バッジ
  if (goalBadgeEl) {
    goalBadgeEl.style.display = isAchieved ? "inline-block" : "none";
  }
}

// --- TODO Management (一覧のみ表示) ---
function renderTodoList() {
  const container = document.getElementById("todo-list-container");
  if (!container) return;

  const todayStr = getTodayStr();
  const currentTodos = todos.filter((t) => !t.date || t.date === todayStr);

  if (currentTodos.length === 0) {
    container.innerHTML = `
      <div class="empty-hint">
        今日のタスクはありません。上から追加してみましょう！
      </div>
    `;
    return;
  }

  container.innerHTML = currentTodos
    .map(
      (todo) => `
    <div class="todo-item ${todo.completed ? "completed" : ""}" data-id="${todo.id}">
      <input type="checkbox" class="todo-checkbox" ${todo.completed ? "checked" : ""} title="${todo.completed ? "未完了に戻す" : "完了にする"}" />
      <div class="todo-content">
        <div class="todo-title">${escapeHtml(todo.title)}</div>
        <div class="todo-meta">
          <span class="todo-subject-badge" style="background-color: ${getSubjectColor(todo.subject)}20; color: ${getSubjectColor(todo.subject)}; border: 1px solid ${getSubjectColor(todo.subject)}40;">${escapeHtml(todo.subject || "その他自習")}</span>
          ${todo.estimatedMinutes ? `<span>目安: ${todo.estimatedMinutes}分</span>` : ""}
          ${todo.memo ? `<span>メモ: ${escapeHtml(todo.memo)}</span>` : ""}
        </div>
      </div>
      <div class="todo-actions">
        ${
          !todo.completed
            ? `<button class="icon-btn btn-timer-link" title="このタスクでタイマーを開始">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              </button>`
            : ""
        }
        <button class="icon-btn delete btn-todo-delete" title="削除">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    </div>
  `
    )
    .join("");

  // Attach event handlers
  container.querySelectorAll(".todo-item").forEach((el) => {
    const id = el.getAttribute("data-id");

    const checkbox = el.querySelector(".todo-checkbox");
    checkbox?.addEventListener("change", (e) => {
      toggleTodoCompleted(id, e.target.checked);
    });

    const deleteBtn = el.querySelector(".btn-todo-delete");
    deleteBtn?.addEventListener("click", () => {
      deleteTodo(id);
    });

    const timerLinkBtn = el.querySelector(".btn-timer-link");
    timerLinkBtn?.addEventListener("click", () => {
      startTimerForTodo(id);
    });
  });
}

function addTodo(title, subject, estimatedMinutes, memo) {
  const newTodo = {
    id: generateId(),
    title,
    subject: subject || "英語",
    estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : null,
    memo: memo || "",
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
    date: getTodayStr(),
  };

  todos.unshift(newTodo);
  saveData();
}

function toggleTodoCompleted(id, completed) {
  const target = todos.find((t) => t.id === id);
  if (target) {
    target.completed = completed;
    target.completedAt = completed ? new Date().toISOString() : null;
    saveData();
  }
}

function deleteTodo(id) {
  todos = todos.filter((t) => t.id !== id);
  saveData();
}

function updateTodoLinkOptions() {
  const select = document.getElementById("timer-todo-link");
  if (!select) return;

  const currentVal = select.value;
  const activeTodos = todos.filter((t) => !t.completed);

  select.innerHTML =
    '<option value="">-- 指定なし --</option>' +
    activeTodos
      .map((t) => `<option value="${t.id}">${escapeHtml(t.title)} (${escapeHtml(t.subject)})</option>`)
      .join("");

  if (activeTodos.some((t) => t.id === currentVal)) {
    select.value = currentVal;
  }
}

// --- Timer Management ---
function updateTimerDisplay() {
  const display = document.getElementById("timer-display");
  if (!display) return;
  display.textContent = formatDuration(timerSeconds);
}

function startTimer() {
  if (timerRunning) return;
  // オーディオアンロック (ユーザーの開始クリック契機)
  initAlarmAudio();

  // ポモドーロモードで現在0秒なら、設定した集中時間から開始
  if (timerMode === "pomodoro" && timerSeconds <= 0) {
    timerSeconds = (pomodoroSettings.workMinutes || 25) * 60;
    updateTimerDisplay();
  }

  timerRunning = true;
  sessionStartTime = new Date();

  const startBtn = document.getElementById("btn-timer-start");
  const stopBtn = document.getElementById("btn-timer-stop");
  const alarmBtn = document.getElementById("btn-timer-alarm-stop");
  const timerCircle = document.getElementById("timer-circle");
  const chip = document.getElementById("timer-status-chip");
  const chipText = document.getElementById("timer-status-text");

  if (startBtn) startBtn.style.display = "none";
  if (stopBtn) stopBtn.style.display = "inline-flex";
  if (alarmBtn) alarmBtn.style.display = "none";
  if (timerCircle) {
    timerCircle.classList.add("active");
    timerCircle.classList.remove("completed");
  }
  if (chip) {
    chip.classList.add("running");
    chip.classList.remove("completed");
  }
  if (chipText) chipText.textContent = "学習中";

  // Update target label
  const subjectSelect = document.getElementById("timer-subject");
  const targetDisplay = document.getElementById("timer-target-display");
  if (subjectSelect && targetDisplay) {
    targetDisplay.textContent = `科目: ${subjectSelect.value}`;
  }

  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    if (timerMode === "countup") {
      timerSeconds++;
      updateTimerDisplay();
    } else {
      // Pomodoro countdown
      if (timerSeconds > 1) {
        timerSeconds--;
        updateTimerDisplay();
      } else {
        // カウントダウンが0に到達！
        timerSeconds = 0;
        updateTimerDisplay();
        triggerPomodoroCompleted();
      }
    }
  }, 1000);
}

function triggerPomodoroCompleted() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerRunning = false;

  const startBtn = document.getElementById("btn-timer-start");
  const stopBtn = document.getElementById("btn-timer-stop");
  const alarmBtn = document.getElementById("btn-timer-alarm-stop");
  const timerCircle = document.getElementById("timer-circle");
  const chip = document.getElementById("timer-status-chip");
  const chipText = document.getElementById("timer-status-text");

  if (startBtn) startBtn.style.display = "none";
  if (stopBtn) stopBtn.style.display = "none";
  if (alarmBtn) alarmBtn.style.display = "inline-flex";
  if (timerCircle) {
    timerCircle.classList.remove("active");
    timerCircle.classList.add("completed");
  }
  if (chip) {
    chip.classList.add("running");
    chip.classList.add("completed");
  }
  if (chipText) chipText.textContent = "🎉 集中完了";

  // アラーム音再生
  playAlarmSound();

  // 完了モーダル表示
  const modal = document.getElementById("alarm-modal");
  const completedText = document.getElementById("alarm-completed-minutes-text");
  if (completedText) {
    completedText.textContent = `${pomodoroSettings.workMinutes || 25}分`;
  }
  if (modal) {
    modal.style.display = "flex";
  }
}

function stopTimer(isCompleted = false) {
  if (!timerRunning && timerSeconds === 0 && !isAlarmRinging) return;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerRunning = false;

  const startBtn = document.getElementById("btn-timer-start");
  const stopBtn = document.getElementById("btn-timer-stop");
  const alarmBtn = document.getElementById("btn-timer-alarm-stop");
  const timerCircle = document.getElementById("timer-circle");
  const chip = document.getElementById("timer-status-chip");
  const chipText = document.getElementById("timer-status-text");

  if (startBtn) startBtn.style.display = "inline-flex";
  if (stopBtn) stopBtn.style.display = "none";
  if (alarmBtn) alarmBtn.style.display = "none";
  if (timerCircle) timerCircle.classList.remove("active");
  if (chip) chip.classList.remove("running");
  if (chipText) chipText.textContent = "待機中";

  // 学習時間の計算
  let elapsed = 0;
  if (timerMode === "countup") {
    elapsed = timerSeconds;
  } else {
    // ポモドーロモードの場合: 設定分数 - 残り秒数
    const totalPomoSec = (pomodoroSettings.workMinutes || 25) * 60;
    elapsed = Math.max(1, totalPomoSec - timerSeconds);
  }

  if (elapsed > 0) {
    openRecordModal(elapsed);
  }
}

// リセット機能（確実に初期値および停止状態を反映）
function resetTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerRunning = false;
  sessionStartTime = null;
  stopAlarmSound();

  const pomoSec = (pomodoroSettings.workMinutes || 25) * 60;
  timerSeconds = timerMode === "pomodoro" ? pomoSec : 0;
  updateTimerDisplay();

  const startBtn = document.getElementById("btn-timer-start");
  const stopBtn = document.getElementById("btn-timer-stop");
  const alarmBtn = document.getElementById("btn-timer-alarm-stop");
  const timerCircle = document.getElementById("timer-circle");
  const chip = document.getElementById("timer-status-chip");
  const chipText = document.getElementById("timer-status-text");

  if (startBtn) startBtn.style.display = "inline-flex";
  if (stopBtn) stopBtn.style.display = "none";
  if (alarmBtn) alarmBtn.style.display = "none";
  if (timerCircle) {
    timerCircle.classList.remove("active");
    timerCircle.classList.remove("completed");
  }
  if (chip) {
    chip.classList.remove("running");
    chip.classList.remove("completed");
  }
  if (chipText) chipText.textContent = "待機中";

  const subjectSelect = document.getElementById("timer-subject");
  const targetDisplay = document.getElementById("timer-target-display");
  if (subjectSelect && targetDisplay) {
    targetDisplay.textContent = `科目: ${subjectSelect.value}`;
  }
}

function startTimerForTodo(todoId) {
  const target = todos.find((t) => t.id === todoId);
  if (!target) return;

  const subjectSelect = document.getElementById("timer-subject");
  const todoSelect = document.getElementById("timer-todo-link");

  if (subjectSelect) subjectSelect.value = target.subject;
  if (todoSelect) todoSelect.value = target.id;

  switchTab("tracker");
  resetTimer();
  startTimer();
}

// --- Record Modal ---
function openRecordModal(durationSec = null) {
  const modal = document.getElementById("record-modal");
  const durationText = document.getElementById("modal-duration-text");
  const subjectInput = document.getElementById("modal-subject");
  const memoInput = document.getElementById("modal-memo");

  const subjectSelect = document.getElementById("timer-subject");

  currentSessionDurationSeconds = durationSec !== null ? durationSec : (
    timerMode === "pomodoro" ? (pomodoroSettings.workMinutes || 25) * 60 : timerSeconds
  );

  if (durationText) durationText.textContent = formatDuration(currentSessionDurationSeconds);
  if (subjectInput && subjectSelect) subjectInput.value = subjectSelect.value;
  if (memoInput) memoInput.value = "";
  if (modal) modal.style.display = "flex";
}

function closeRecordModal() {
  const modal = document.getElementById("record-modal");
  if (modal) modal.style.display = "none";
}

function saveCurrentSession() {
  const subjectSelect = document.getElementById("modal-subject");
  const todoSelect = document.getElementById("timer-todo-link");
  const memoInput = document.getElementById("modal-memo");

  const durationSec = currentSessionDurationSeconds > 0 ? currentSessionDurationSeconds : (
    timerMode === "pomodoro" ? (pomodoroSettings.workMinutes || 25) * 60 : timerSeconds
  );

  const endTime = new Date();
  const startTime = sessionStartTime || new Date(endTime.getTime() - durationSec * 1000);

  const newSession = {
    id: generateId(),
    date: getTodayStr(),
    startTime: startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    endTime: endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    durationSeconds: durationSec,
    subject: subjectSelect ? subjectSelect.value : "その他自習",
    todoId: todoSelect ? todoSelect.value : null,
    memo: memoInput ? memoInput.value : "",
  };

  sessions.unshift(newSession);
  saveData();

  closeRecordModal();
  resetTimer();
}

// --- Session Edit Modal (本日の記録の編集・破棄) ---
function openEditSessionModal(sessionId) {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;

  const modal = document.getElementById("edit-session-modal");
  const idInput = document.getElementById("edit-session-id");
  const subjectSelect = document.getElementById("edit-session-subject");
  const minutesInput = document.getElementById("edit-session-minutes");
  const memoInput = document.getElementById("edit-session-memo");

  if (idInput) idInput.value = session.id;
  if (subjectSelect) subjectSelect.value = session.subject;
  if (minutesInput) minutesInput.value = Math.max(1, Math.round(session.durationSeconds / 60));
  if (memoInput) memoInput.value = session.memo || "";

  if (modal) modal.style.display = "flex";
}

function closeEditSessionModal() {
  const modal = document.getElementById("edit-session-modal");
  if (modal) modal.style.display = "none";
}

function saveEditedSession() {
  const idInput = document.getElementById("edit-session-id");
  const subjectSelect = document.getElementById("edit-session-subject");
  const minutesInput = document.getElementById("edit-session-minutes");
  const memoInput = document.getElementById("edit-session-memo");

  if (!idInput || !idInput.value) return;

  const target = sessions.find((s) => s.id === idInput.value);
  if (target) {
    target.subject = subjectSelect ? subjectSelect.value : target.subject;
    const mins = minutesInput ? Number(minutesInput.value) : 1;
    target.durationSeconds = Math.max(60, mins * 60);
    target.memo = memoInput ? memoInput.value.trim() : "";
    saveData();
  }

  closeEditSessionModal();
}

function deleteSession(sessionId) {
  showConfirmModal({
    title: "学習記録の破棄",
    message: "この学習記録を破棄（削除）しますか？\n合計学習時間や達成率にも即時反映されます。",
    confirmText: "破棄する",
    confirmClass: "btn-danger",
    onConfirm: () => {
      sessions = sessions.filter((s) => s.id !== sessionId);
      saveData();
      showToast("学習記録を破棄しました");
    },
  });
}

// --- Render Today Sessions (編集・破棄ボタン付き) ---
function renderTodaySessions() {
  const container = document.getElementById("today-session-list");
  if (!container) return;

  const todayStr = getTodayStr();
  const todaySessions = sessions.filter((s) => s.date === todayStr);

  if (todaySessions.length === 0) {
    container.innerHTML = `<div class="empty-hint">まだ今日の記録はありません。Startボタンで計測を開始してください。</div>`;
    return;
  }

  container.innerHTML = todaySessions
    .map(
      (s) => `
    <div class="session-item-compact" data-id="${s.id}">
      <div class="session-left">
        <span class="session-badge" style="background-color: ${getSubjectColor(s.subject)}25; color: ${getSubjectColor(s.subject)}; border: 1px solid ${getSubjectColor(s.subject)}50;">${escapeHtml(s.subject)}</span>
        <span style="color: var(--text-muted); font-size: 0.75rem;">${s.startTime || ""} - ${s.endTime || ""}</span>
        ${s.memo ? `<span class="session-memo-preview" title="${escapeHtml(s.memo)}">💭 ${escapeHtml(s.memo)}</span>` : ""}
      </div>
      <div class="session-right">
        <strong>${formatHoursMinutes(s.durationSeconds)}</strong>
        <button class="icon-btn edit btn-edit-session" title="編集">
          <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button class="icon-btn delete btn-delete-today-session" title="破棄">
          <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    </div>
  `
    )
    .join("");

  // Attach event handlers
  container.querySelectorAll(".btn-edit-session").forEach((btn) => {
    btn.addEventListener("click", () => {
      const el = btn.closest(".session-item-compact");
      const id = el?.getAttribute("data-id");
      if (id) openEditSessionModal(id);
    });
  });

  container.querySelectorAll(".btn-delete-today-session").forEach((btn) => {
    btn.addEventListener("click", () => {
      const el = btn.closest(".session-item-compact");
      const id = el?.getAttribute("data-id");
      if (id) deleteSession(id);
    });
  });
}

// --- Subject Color Mapping ---
const SUBJECT_COLORS = {
  "英語": "#3b82f6",
  "数学": "#ef4444",
  "現代文": "#10b981",
  "古文・漢文": "#059669",
  "物理": "#8b5cf6",
  "化学": "#ec4899",
  "生物": "#14b8a6",
  "地学": "#f59e0b",
  "日本史": "#d97706",
  "世界史": "#b45309",
  "地理": "#06b6d4",
  "公共・政経・倫理": "#6366f1",
  "情報": "#0ea5e9",
  "過去問・演習": "#f97316",
  "模試・復習": "#a855f7",
  "その他自習": "#64748b",
};

function getSubjectColor(subject) {
  if (!subject) return "#64748b";
  const found = subjects.find((s) => s.name === subject);
  if (found && found.color) return found.color;
  if (SUBJECT_COLORS[subject]) return SUBJECT_COLORS[subject];
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 65%, 52%)`;
}

// --- All-time Statistics & Subject Totals ---
function renderAllTimeStats() {
  const totalSeconds = sessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);

  // 1. All-time Total Time
  const totalTimeEl = document.getElementById("all-time-total-time");
  if (totalTimeEl) {
    totalTimeEl.textContent = formatHoursMinutes(totalSeconds);
  }

  // 2. All-time Session Count
  const sessionCountEl = document.getElementById("all-time-session-count");
  if (sessionCountEl) {
    sessionCountEl.textContent = `総セッション: ${sessions.length} 回`;
  }

  // 3. All-time Completed TODOs
  const completedTodoCount = todos.filter((t) => t.completed).length;
  const todoCountEl = document.getElementById("all-time-todo-count");
  if (todoCountEl) {
    todoCountEl.textContent = `${completedTodoCount} 個`;
  }

  // 4. Unique Active Days
  const activeDaysSet = new Set(sessions.map((s) => s.date).filter(Boolean));
  const activeDaysEl = document.getElementById("all-time-active-days");
  if (activeDaysEl) {
    activeDaysEl.textContent = `記録日数: ${activeDaysSet.size} 日`;
  }

  // 5. Subject Totals Aggregation
  const subjectAggregates = aggregateSessionsBySubject(sessions);

  // Top Subject
  const topSubEl = document.getElementById("all-time-top-subject");
  const topSubTimeEl = document.getElementById("all-time-top-subject-time");
  if (subjectAggregates.length > 0) {
    const topItem = subjectAggregates[0];
    if (topSubEl) topSubEl.textContent = topItem.subject;
    if (topSubTimeEl) topSubTimeEl.textContent = formatHoursMinutes(topItem.seconds);
  } else {
    if (topSubEl) topSubEl.textContent = "-";
    if (topSubTimeEl) topSubTimeEl.textContent = "-";
  }

  // Subject Count Badge
  const breakdownCountEl = document.getElementById("subject-breakdown-count");
  if (breakdownCountEl) {
    breakdownCountEl.textContent = `${subjectAggregates.length} 科目記録中`;
  }

  // Subject Breakdown List
  const listContainer = document.getElementById("subject-totals-list");
  if (listContainer) {
    if (subjectAggregates.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-hint">
          学習記録がまだありません。タイマーで学習を記録するとここに科目ごとの累計時間が表示されます。
        </div>
      `;
    } else {
      listContainer.innerHTML = subjectAggregates
        .map(({ subject: sub, seconds: secs, percentage: pct }) => {
          const color = getSubjectColor(sub);
          return `
            <div class="subject-breakdown-item">
              <div class="subject-item-meta">
                <span class="subject-dot" style="background-color: ${color};"></span>
                <span class="subject-name" title="${escapeHtml(sub)}">${escapeHtml(sub)}</span>
              </div>
              <div class="subject-bar-wrap">
                <div class="subject-bar-fill" style="width: ${pct}%; background-color: ${color};"></div>
              </div>
              <div class="subject-item-stats">
                <span class="subject-stat-hours">${formatHoursMinutes(secs)}</span>
                <span class="subject-stat-pct">${pct}%</span>
              </div>
            </div>
          `;
        })
        .join("");
    }
  }
}

// --- History & Past Data View ---
function renderHistoryView() {
  renderAllTimeStats();

  const dateInput = document.getElementById("history-date-picker");
  if (dateInput && dateInput.value !== selectedHistoryDate) {
    dateInput.value = selectedHistoryDate;
  }

  const selectedSessions = sessions.filter((s) => s.date === selectedHistoryDate);
  const totalSeconds = selectedSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);

  // Summary Cards
  const totalTimeEl = document.getElementById("history-total-time");
  const sessionCountEl = document.getElementById("history-session-count");
  if (totalTimeEl) totalTimeEl.textContent = formatHoursMinutes(totalSeconds);
  if (sessionCountEl) sessionCountEl.textContent = `${selectedSessions.length} セッション`;

  // Top Subject
  const historySubjectAggs = aggregateSessionsBySubject(selectedSessions);
  const topSubEl = document.getElementById("history-top-subject");
  const topSubTimeEl = document.getElementById("history-top-subject-time");
  if (historySubjectAggs.length > 0) {
    const topSub = historySubjectAggs[0];
    if (topSubEl) topSubEl.textContent = topSub.subject;
    if (topSubTimeEl) topSubTimeEl.textContent = formatHoursMinutes(topSub.seconds);
  } else {
    if (topSubEl) topSubEl.textContent = "-";
    if (topSubTimeEl) topSubTimeEl.textContent = "-";
  }

  // TODOs for this date
  const selectedTodos = todos.filter((t) => t.date === selectedHistoryDate);
  const doneTodos = selectedTodos.filter((t) => t.completed);
  const todoCountEl = document.getElementById("history-todo-count");
  const todoRateEl = document.getElementById("history-todo-rate");
  if (todoCountEl) todoCountEl.textContent = `${doneTodos.length} / ${selectedTodos.length}`;
  if (todoRateEl) {
    const rate = selectedTodos.length > 0 ? Math.round((doneTodos.length / selectedTodos.length) * 100) : 0;
    todoRateEl.textContent = `達成率 ${rate}%`;
  }

  // Sessions Table
  const tbody = document.getElementById("history-sessions-tbody");
  if (tbody) {
    if (selectedSessions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-dim); padding: 1.5rem;">この日の学習記録はありません。</td></tr>`;
    } else {
      tbody.innerHTML = selectedSessions
        .map((s) => {
          const linkedTodo = s.todoId ? todos.find((t) => t.id === s.todoId) : null;
          return `
          <tr>
            <td>${s.startTime || "-"} ~ ${s.endTime || "-"}</td>
            <td><span class="session-badge" style="background-color: ${getSubjectColor(s.subject)}25; color: ${getSubjectColor(s.subject)}; border: 1px solid ${getSubjectColor(s.subject)}50;">${escapeHtml(s.subject)}</span></td>
            <td>${linkedTodo ? escapeHtml(linkedTodo.title) : (s.memo ? escapeHtml(s.memo) : "-")}</td>
            <td><strong>${formatHoursMinutes(s.durationSeconds)}</strong></td>
            <td>
              <button class="icon-btn edit btn-history-edit-session" data-id="${s.id}" title="編集">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button class="icon-btn delete btn-delete-session" data-id="${s.id}" title="削除">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </td>
          </tr>
        `;
        })
        .join("");

      tbody.querySelectorAll(".btn-history-edit-session").forEach((btn) => {
        btn.addEventListener("click", () => {
          const sid = btn.getAttribute("data-id");
          if (sid) openEditSessionModal(sid);
        });
      });

      tbody.querySelectorAll(".btn-delete-session").forEach((btn) => {
        btn.addEventListener("click", () => {
          const sid = btn.getAttribute("data-id");
          if (sid) deleteSession(sid);
        });
      });
    }
  }

  // History TODO list
  const historyTodoList = document.getElementById("history-todos-list");
  if (historyTodoList) {
    if (selectedTodos.length === 0) {
      historyTodoList.innerHTML = `<div class="empty-hint">この日のTODO記録はありません。</div>`;
    } else {
      historyTodoList.innerHTML = selectedTodos
        .map(
          (t) => `
        <div class="todo-item ${t.completed ? "completed" : ""}">
          <input type="checkbox" class="todo-checkbox" ${t.completed ? "checked" : ""} disabled />
          <div class="todo-content">
            <div class="todo-title">${escapeHtml(t.title)}</div>
            <div class="todo-meta">
              <span class="todo-subject-badge" style="background-color: ${getSubjectColor(t.subject)}20; color: ${getSubjectColor(t.subject)}; border: 1px solid ${getSubjectColor(t.subject)}40;">${escapeHtml(t.subject || "その他自習")}</span>
              ${t.completed ? `<span style="color: var(--success)">✓ 達成</span>` : `<span>未完了</span>`}
            </div>
          </div>
        </div>
      `
        )
        .join("");
    }
  }

  renderWeeklyTrend();
}

function renderWeeklyTrend() {
  const chartData = getWeeklyChartData(sessions, selectedHistoryDate);
  renderWeeklyChart("weekly-chart", chartData);
}

// --- Navigation & Tabs ---
function switchTab(tabName) {
  activeTab = tabName;
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === tabName);
  });
  document.querySelectorAll(".tab-pane").forEach((pane) => {
    pane.classList.toggle("active", pane.id === `tab-${tabName}`);
  });

  if (tabName === "history") {
    renderHistoryView();
  } else if (tabName === "settings") {
    renderSubjectManageList();
  } else if (tabName === "tracker") {
    renderTodaySessions();
    updateHeaderAndSummary();
  }
}

// --- Export & Import & Backup ---
function exportDataAsJSON() {
  const payload = {
    appName: "StudyFlow",
    version: "1.3.0",
    exportDate: new Date().toISOString(),
    todos,
    sessions,
    subjects,
    goalSettings,
    pomodoroSettings,
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `studyflow_backup_${getTodayStr()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast("バックアップJSONをエクスポートしました");
}

function importDataFromJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data.todos) && Array.isArray(data.sessions)) {
        todos = data.todos;
        sessions = data.sessions;
        if (Array.isArray(data.subjects) && data.subjects.length > 0) {
          subjects = data.subjects;
          saveSubjects();
        } else {
          saveData();
        }
        if (data.goalSettings && typeof data.goalSettings === "object") {
          goalSettings = { ...DEFAULT_GOAL_SETTINGS, ...data.goalSettings };
          localStorage.setItem(STORAGE_KEYS.GOAL_SETTINGS, JSON.stringify(goalSettings));
          updateGoalSettingsUI();
          updateHeaderAndSummary();
        }
        if (data.pomodoroSettings && typeof data.pomodoroSettings === "object") {
          pomodoroSettings = { ...DEFAULT_POMODORO_SETTINGS, ...data.pomodoroSettings };
          savePomodoroSettings(false);
          updatePomodoroUI();
        }
        showToast("データの読み込み・復元が完了しました！");
      } else {
        showToast("無効なバックアップファイル形式です");
      }
    } catch (err) {
      showToast("JSONファイルの解析に失敗しました: " + err.message);
    }
  };
  reader.readAsText(file);
}

function loadSampleDemoData() {
  const today = new Date();
  const sampleTodos = [];
  const sampleSessions = [];
  const examTasks = [
    { title: "ターゲット1900 100語暗記・確認テスト", subject: "英語", mins: 45 },
    { title: "共通テスト過去問 数学II・B 微積分", subject: "数学", mins: 60 },
    { title: "現代文 キーワード読解 2章", subject: "現代文", mins: 40 },
    { title: "セミナー物理 力学 総合演習3題", subject: "物理", mins: 75 },
    { title: "共通テスト化学 酸化還元・熱化学", subject: "化学", mins: 60 },
    { title: "日本史 一問一答 近現代史の総復習", subject: "日本史", mins: 50 },
    { title: "志望校 英語過去問 2024年度長文読解", subject: "過去問・演習", mins: 90 },
  ];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];

    const task = examTasks[i % examTasks.length];
    const t1 = {
      id: generateId(),
      title: task.title,
      subject: task.subject,
      estimatedMinutes: task.mins,
      memo: "間違えた箇所の解説を熟読",
      completed: true,
      completedAt: new Date(d.getTime() + 3600000).toISOString(),
      createdAt: d.toISOString(),
      date: dateStr,
    };
    const t2 = {
      id: generateId(),
      title: "古文単語315 1〜100確認テスト",
      subject: "古文・漢文",
      estimatedMinutes: 30,
      memo: "助動詞の接続も合わせて確認",
      completed: i < 5,
      completedAt: i < 5 ? new Date(d.getTime() + 7200000).toISOString() : null,
      createdAt: d.toISOString(),
      date: dateStr,
    };
    sampleTodos.push(t1, t2);

    const sessionDuration = (Math.floor(Math.random() * 60) + 60) * 60;
    sampleSessions.push({
      id: generateId(),
      date: dateStr,
      startTime: "14:00",
      endTime: "15:45",
      durationSeconds: sessionDuration,
      subject: task.subject,
      todoId: t1.id,
      memo: "集中して演習完了",
    });
  }

  todos = sampleTodos;
  sessions = sampleSessions;
  saveData();
  showToast("受験生向けのサンプルデータを投入しました！");
}

function clearAllData() {
  showConfirmModal({
    title: "全データの初期化",
    message: "本当にすべてのTODOおよび学習ログを削除しますか？\nこの操作は取り消せません。",
    confirmText: "すべて消去",
    confirmClass: "btn-danger",
    onConfirm: () => {
      todos = [];
      sessions = [];
      saveData();
      showToast("すべてのデータを初期化しました");
    },
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --- Initialization & Event Listeners ---
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  loadData();
  renderSubjectSelects();
  updatePomodoroUI();
  updateAllViews();
  resetTimer();

  // Theme toggle
  document.getElementById("btn-theme-toggle")?.addEventListener("click", toggleTheme);

  // Tab navigation
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.getAttribute("data-tab"));
    });
  });

  // Goal Settings Controls
  const goalForm = document.getElementById("goal-settings-form");
  const goalTypeRadios = document.querySelectorAll('input[name="goal-type"]');
  const goalTaskModeRadios = document.querySelectorAll('input[name="goal-task-mode"]');

  goalTypeRadios.forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const type = e.target.value;
      const tasksConfig = document.getElementById("goal-tasks-config");
      const timeConfig = document.getElementById("goal-time-config");
      const labelTasks = document.getElementById("goal-type-label-tasks");
      const labelTime = document.getElementById("goal-type-label-time");

      if (type === "time") {
        if (timeConfig) timeConfig.style.display = "block";
        if (tasksConfig) tasksConfig.style.display = "none";
        if (labelTime) labelTime.classList.add("active");
        if (labelTasks) labelTasks.classList.remove("active");
      } else {
        if (tasksConfig) tasksConfig.style.display = "block";
        if (timeConfig) timeConfig.style.display = "none";
        if (labelTasks) labelTasks.classList.add("active");
        if (labelTime) labelTime.classList.remove("active");
      }
    });
  });

  goalTaskModeRadios.forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const countRow = document.getElementById("goal-task-count-row");
      if (countRow) {
        countRow.style.display = e.target.value === "custom" ? "flex" : "none";
      }
    });
  });

  document.querySelectorAll(".btn-goal-preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mins = Number(btn.getAttribute("data-minutes") || 180);
      const hoursInput = document.getElementById("goal-time-hours-input");
      const minsInput = document.getElementById("goal-time-mins-input");
      if (hoursInput) hoursInput.value = Math.floor(mins / 60);
      if (minsInput) minsInput.value = mins % 60;
    });
  });

  goalForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const type = document.querySelector('input[name="goal-type"]:checked')?.value || "tasks";
    const taskMode = document.querySelector('input[name="goal-task-mode"]:checked')?.value || "all";
    const count = Number(document.getElementById("goal-task-count-input")?.value || 5);
    const hours = Number(document.getElementById("goal-time-hours-input")?.value || 0);
    const mins = Number(document.getElementById("goal-time-mins-input")?.value || 0);
    const totalMinutes = Math.max(5, hours * 60 + mins);

    goalSettings = {
      type,
      taskTargetMode: taskMode,
      taskTargetCount: Math.max(1, count),
      timeTargetMinutes: totalMinutes,
    };
    saveGoalSettings();
  });

  // Subject Management Controls
  const subjectForm = document.getElementById("subject-form");
  const subjectNameInput = document.getElementById("subject-input-name");
  const subjectColorInput = document.getElementById("subject-input-color");
  const subjectHexLabel = document.getElementById("subject-color-hex");

  subjectColorInput?.addEventListener("input", (e) => {
    const val = e.target.value;
    if (subjectHexLabel) subjectHexLabel.textContent = val;
    document.querySelectorAll(".color-dot-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-color") === val);
    });
  });

  document.querySelectorAll(".color-dot-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const color = btn.getAttribute("data-color");
      if (color && subjectColorInput) {
        subjectColorInput.value = color;
        if (subjectHexLabel) subjectHexLabel.textContent = color;
        document.querySelectorAll(".color-dot-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      }
    });
  });

  subjectForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (subjectNameInput && subjectNameInput.value.trim()) {
      const added = addSubject(subjectNameInput.value.trim(), subjectColorInput?.value || "#6366f1");
      if (added) {
        subjectNameInput.value = "";
      }
    }
  });

  document.getElementById("btn-reset-subjects")?.addEventListener("click", resetSubjects);

  // Confirm Modal controls
  document.getElementById("confirm-modal-btn-cancel")?.addEventListener("click", closeConfirmModal);
  document.getElementById("confirm-modal-btn-confirm")?.addEventListener("click", () => {
    if (confirmModalCallback) {
      confirmModalCallback();
    }
    closeConfirmModal();
  });

  // Close confirm modal when clicking backdrop
  document.getElementById("confirm-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "confirm-modal") {
      closeConfirmModal();
    }
  });

  // Timer controls
  document.getElementById("btn-timer-start")?.addEventListener("click", startTimer);
  document.getElementById("btn-timer-stop")?.addEventListener("click", () => stopTimer(false));
  document.getElementById("btn-timer-reset")?.addEventListener("click", resetTimer);

  // Timer mode toggle
  document.getElementById("btn-mode-countup")?.addEventListener("click", () => {
    timerMode = "countup";
    document.getElementById("btn-mode-countup").classList.add("active");
    document.getElementById("btn-mode-pomodoro").classList.remove("active");
    updatePomodoroUI();
    resetTimer();
  });
  document.getElementById("btn-mode-pomodoro")?.addEventListener("click", () => {
    timerMode = "pomodoro";
    document.getElementById("btn-mode-pomodoro").classList.add("active");
    document.getElementById("btn-mode-countup").classList.remove("active");
    updatePomodoroUI();
    resetTimer();
  });

  // Pomodoro Quick Bar (Timer Card) Presets & Custom Input
  document.querySelectorAll(".pomo-preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mins = parseInt(btn.getAttribute("data-minutes"), 10);
      if (mins) {
        setPomodoroMinutes(mins);
      }
    });
  });

  const quickCustomInput = document.getElementById("pomo-quick-custom-input");
  quickCustomInput?.addEventListener("change", (e) => {
    const val = parseInt(e.target.value, 10);
    if (val && val >= 1 && val <= 180) {
      setPomodoroMinutes(val);
    }
  });

  // Alarm ringing stop button on Timer Card
  document.getElementById("btn-timer-alarm-stop")?.addEventListener("click", () => {
    stopAlarmSound();
    const modal = document.getElementById("alarm-modal");
    if (modal) modal.style.display = "none";
    openRecordModal((pomodoroSettings.workMinutes || 25) * 60);
  });

  // Pomodoro Settings Card in Settings Tab
  const settingPomoInput = document.getElementById("setting-pomo-minutes");
  settingPomoInput?.addEventListener("change", (e) => {
    const val = parseInt(e.target.value, 10);
    if (val && val >= 1 && val <= 180) {
      setPomodoroMinutes(val, false);
    }
  });

  document.querySelectorAll(".btn-pomo-setting-preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mins = parseInt(btn.getAttribute("data-minutes"), 10);
      if (mins) {
        setPomodoroMinutes(mins, false);
      }
    });
  });

  // Sound Preview Button
  document.getElementById("btn-sound-preview")?.addEventListener("click", togglePreviewSound);

  // Sound Options (Toggle & Volume)
  document.getElementById("setting-pomo-sound-enabled")?.addEventListener("change", (e) => {
    pomodoroSettings.soundEnabled = e.target.checked;
    savePomodoroSettings(false);
  });

  const volumeSlider = document.getElementById("setting-pomo-volume");
  volumeSlider?.addEventListener("input", (e) => {
    const vol = parseInt(e.target.value, 10) / 100;
    pomodoroSettings.volume = vol;
    if (alarmAudio) alarmAudio.volume = vol;
    if (previewAudio) previewAudio.volume = vol;
    const volText = document.getElementById("setting-pomo-volume-text");
    if (volText) volText.textContent = `${e.target.value}%`;
  });
  volumeSlider?.addEventListener("change", () => {
    savePomodoroSettings(false);
  });

  document.getElementById("pomodoro-settings-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    savePomodoroSettings(true);
  });

  // Modal 4: Pomodoro Completed Alarm Modal
  document.getElementById("alarm-modal-btn-record")?.addEventListener("click", () => {
    stopAlarmSound();
    const modal = document.getElementById("alarm-modal");
    if (modal) modal.style.display = "none";
    openRecordModal((pomodoroSettings.workMinutes || 25) * 60);
  });

  document.getElementById("alarm-modal-btn-dismiss")?.addEventListener("click", () => {
    stopAlarmSound();
    const modal = document.getElementById("alarm-modal");
    if (modal) modal.style.display = "none";
    resetTimer();
  });

  // Keyboard shortcut to dismiss alarm if ringing
  window.addEventListener("keydown", (e) => {
    if (isAlarmRinging) {
      if (e.key === "Escape") {
        stopAlarmSound();
        const modal = document.getElementById("alarm-modal");
        if (modal) modal.style.display = "none";
        resetTimer();
      } else if (e.key === "Enter" || e.key === " ") {
        stopAlarmSound();
        const modal = document.getElementById("alarm-modal");
        if (modal) modal.style.display = "none";
        openRecordModal((pomodoroSettings.workMinutes || 25) * 60);
      }
    }
  });

  // Subject change in timer
  document.getElementById("timer-subject")?.addEventListener("change", (e) => {
    const targetDisplay = document.getElementById("timer-target-display");
    if (targetDisplay) targetDisplay.textContent = `科目: ${e.target.value}`;
  });

  // Modal 1 controls (Record)
  document.getElementById("modal-btn-cancel")?.addEventListener("click", () => {
    closeRecordModal();
    resetTimer();
  });
  document.getElementById("modal-btn-save")?.addEventListener("click", saveCurrentSession);

  // Modal 2 controls (Edit Session)
  document.getElementById("edit-session-btn-cancel")?.addEventListener("click", closeEditSessionModal);
  document.getElementById("edit-session-btn-save")?.addEventListener("click", saveEditedSession);

  // TODO Form
  document.getElementById("todo-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const titleInput = document.getElementById("todo-input-title");
    const subjectInput = document.getElementById("todo-input-subject");
    const estimateInput = document.getElementById("todo-input-estimate");
    const memoInput = document.getElementById("todo-input-memo");

    if (titleInput && titleInput.value.trim()) {
      addTodo(titleInput.value.trim(), subjectInput.value, estimateInput.value, memoInput.value.trim());
      titleInput.value = "";
      if (memoInput) memoInput.value = "";
      if (estimateInput) estimateInput.value = "";
    }
  });

  // History Date Picker Controls
  const datePicker = document.getElementById("history-date-picker");
  datePicker?.addEventListener("change", (e) => {
    if (e.target.value) {
      selectedHistoryDate = e.target.value;
      renderHistoryView();
    }
  });

  document.getElementById("btn-prev-day")?.addEventListener("click", () => {
    const d = new Date(selectedHistoryDate);
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    selectedHistoryDate = `${y}-${m}-${day}`;
    renderHistoryView();
  });

  document.getElementById("btn-next-day")?.addEventListener("click", () => {
    const d = new Date(selectedHistoryDate);
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    selectedHistoryDate = `${y}-${m}-${day}`;
    renderHistoryView();
  });

  document.getElementById("btn-today-day")?.addEventListener("click", () => {
    selectedHistoryDate = getTodayStr();
    renderHistoryView();
  });

  // Backup & Restore
  document.getElementById("btn-export-json")?.addEventListener("click", exportDataAsJSON);

  const importInput = document.getElementById("import-json-input");
  importInput?.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      importDataFromJSON(e.target.files[0]);
    }
  });

  document.getElementById("btn-load-demo")?.addEventListener("click", loadSampleDemoData);
  document.getElementById("btn-clear-all")?.addEventListener("click", clearAllData);
});
