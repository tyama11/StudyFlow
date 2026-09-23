import { renderWeeklyChart } from "./chart.js";
import kaeruPianoAudioSrc from "./assets/audio/kaeru_piano.mp3";
import {
  STORAGE_KEYS,
  DEFAULT_SUBJECTS,
  DEFAULT_SUBJECTS_EN,
  DEFAULT_GOAL_SETTINGS,
  DEFAULT_POMODORO_SETTINGS,
} from "./constants/defaults.js";
import { getTodayStr, formatDateDisplay } from "./utils/date.js";
import {
  formatDuration,
  formatHoursMinutes,
  generateId,
  escapeHtml,
} from "./utils/format.js";
import {
  calculateTotalSeconds,
  calculateGoalProgress,
  aggregateSessionsBySubject,
  getWeeklyChartData,
} from "./models/stats.js";
import { sanitizePomodoroMinutes } from "./models/timer.js";
import { t, resolveLanguage } from "./utils/i18n.js";
import type {
  Todo,
  StudySession,
  Subject,
  GoalSettings,
  PomodoroSettings,
  TimerMode,
  Theme,
  Language,
  ResolvedLanguage,
  GoalProgress,
} from "./types/index.js";

// -------------------------------------------------------
// Application State
// -------------------------------------------------------

let todos: Todo[] = [];
let sessions: StudySession[] = [];
let subjects: Subject[] = [];
let goalSettings: GoalSettings = { ...DEFAULT_GOAL_SETTINGS };
let pomodoroSettings: PomodoroSettings = { ...DEFAULT_POMODORO_SETTINGS };
let activeTab = "tracker";
let currentTheme: Theme = "auto";
let currentLanguage: Language = "auto";
let currentResolvedLang: ResolvedLanguage = "ja";

// Audio State
let alarmAudio: HTMLAudioElement | null = null;
let isAlarmRinging = false;
let isPreviewPlaying = false;
let previewAudio: HTMLAudioElement | null = null;

// Confirm Modal Callback
let confirmModalCallback: (() => void) | null = null;

// Timer State
let timerMode: TimerMode = "countup";
let timerInterval: ReturnType<typeof setInterval> | null = null;
let timerSeconds = 0;
let timerRunning = false;
let sessionStartTime: Date | null = null;
let currentSessionDurationSeconds = 0;

// History State
let selectedHistoryDate = getTodayStr();

// -------------------------------------------------------
// Custom Modal Dialog & Toast
// -------------------------------------------------------

interface ConfirmModalOptions {
  title: string;
  message: string;
  confirmText: string;
  confirmClass: string;
  onConfirm: () => void;
}

function showConfirmModal({
  title,
  message,
  confirmText,
  confirmClass,
  onConfirm,
}: ConfirmModalOptions): void {
  const modal = document.getElementById("confirm-modal");
  const titleEl = document.getElementById("confirm-modal-title");
  const msgEl = document.getElementById("confirm-modal-message");
  const confirmBtn = document.getElementById("confirm-modal-btn-confirm");

  if (!modal) {
    onConfirm();
    return;
  }

  if (titleEl) titleEl.textContent = title || t("confirmDefaultTitle", {}, currentResolvedLang);
  if (msgEl) msgEl.textContent = message || t("confirmDefaultMsg", {}, currentResolvedLang);
  if (confirmBtn) {
    confirmBtn.textContent = confirmText || t("confirmBtnText", {}, currentResolvedLang);
    confirmBtn.className = `btn ${confirmClass || "btn-danger"}`;
  }

  confirmModalCallback = onConfirm;
  modal.style.display = "flex";
}

function closeConfirmModal(): void {
  const modal = document.getElementById("confirm-modal");
  if (modal) modal.style.display = "none";
  confirmModalCallback = null;
}

interface ToastElement extends HTMLDivElement {
  timeoutId?: ReturnType<typeof setTimeout>;
}

function showToast(message: string): void {
  let toast = document.getElementById("app-toast") as ToastElement | null;
  if (!toast) {
    toast = document.createElement("div") as ToastElement;
    toast.id = "app-toast";
    toast.className = "app-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  if (toast.timeoutId) clearTimeout(toast.timeoutId);
  toast.timeoutId = setTimeout(() => {
    (toast as ToastElement).classList.remove("show");
  }, 2500);
}

// -------------------------------------------------------
// Theme Management
// -------------------------------------------------------

function initTheme(): void {
  const stored = localStorage.getItem(STORAGE_KEYS.THEME);
  currentTheme = stored === "dark" || stored === "light" ? stored : "auto";
  applyTheme(currentTheme);
}

function applyTheme(theme: Theme): void {
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
    document.documentElement.removeAttribute("data-theme");
    if (iconEl) iconEl.textContent = "🌓";
    if (textEl) textEl.textContent = "OS連動";
  }

  if (activeTab === "history") {
    renderWeeklyTrend();
  }
}

function toggleTheme(): void {
  if (currentTheme === "auto") {
    applyTheme("dark");
  } else if (currentTheme === "dark") {
    applyTheme("light");
  } else {
    applyTheme("auto");
  }
}

// -------------------------------------------------------
// Language (i18n) Management
// -------------------------------------------------------

function initLanguage(): void {
  const stored = localStorage.getItem(STORAGE_KEYS.LANGUAGE) as Language | null;
  currentLanguage = stored === "ja" || stored === "en" ? stored : "auto";
  applyLanguage(currentLanguage);
}

function applyLanguage(lang: Language): void {
  currentLanguage = lang;
  currentResolvedLang = resolveLanguage(lang);
  localStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);

  const textEl = document.getElementById("lang-toggle-text");
  if (textEl) {
    if (lang === "auto") {
      textEl.textContent = currentResolvedLang === "ja" ? "言語: 自動 (日)" : "Language: Auto (EN)";
    } else if (lang === "ja") {
      textEl.textContent = "日本語";
    } else {
      textEl.textContent = "English";
    }
  }

  // Update HTML lang attribute
  document.documentElement.lang = currentResolvedLang;

  // Translate static UI elements
  translateStaticUI();

  // If no custom subjects were ever saved, update default subjects to current language
  const rawSubjects = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
  if (!rawSubjects) {
    subjects = JSON.parse(
      JSON.stringify(currentResolvedLang === "en" ? DEFAULT_SUBJECTS_EN : DEFAULT_SUBJECTS),
    ) as Subject[];
    renderSubjectSelects();
    renderSubjectManageList();
  }

  updateAllViews();
  updatePomodoroUI();
}

function toggleLanguage(): void {
  if (currentLanguage === "auto") {
    applyLanguage("en");
  } else if (currentLanguage === "en") {
    applyLanguage("ja");
  } else {
    applyLanguage("auto");
  }
}

function translateStaticUI(): void {
  const l = currentResolvedLang;

  // Nav menu
  const navTracker = document.querySelector<HTMLElement>('[data-tab="tracker"] span');
  if (navTracker) navTracker.textContent = t("tabTracker", {}, l);

  const navHistory = document.querySelector<HTMLElement>('[data-tab="history"] span');
  if (navHistory) navHistory.textContent = t("tabHistory", {}, l);

  const navSettings = document.querySelector<HTMLElement>('[data-tab="settings"] span');
  if (navSettings) navSettings.textContent = t("tabSettings", {}, l);

  const brandSub = document.querySelector<HTMLElement>(".brand-sub");
  if (brandSub) brandSub.textContent = t("brandSubtitle", {}, l);

  // Top Header Subtitle
  const headerSub = document.getElementById("header-date-sub");
  if (headerSub) headerSub.textContent = t("headerEncouragement", {}, l);

  // Timer Card
  const timerCardH3 = document.querySelector<HTMLElement>(".timer-card .card-header h3");
  if (timerCardH3) timerCardH3.textContent = t("timerCardTitle", {}, l);

  const btnModeCountup = document.getElementById("btn-mode-countup");
  if (btnModeCountup) btnModeCountup.textContent = t("modeStopwatch", {}, l);

  const pomoQuickLabel = document.querySelector<HTMLElement>(".pomodoro-quick-label");
  if (pomoQuickLabel) pomoQuickLabel.textContent = t("pomodoroQuickLabel", {}, l);

  const pomoCustomInput = document.getElementById("pomo-quick-custom-input") as HTMLInputElement | null;
  if (pomoCustomInput) pomoCustomInput.placeholder = t("customMinutesPlaceholder", {}, l);

  const pomoCustomSuffix = document.querySelector<HTMLElement>(".pomo-custom-suffix");
  if (pomoCustomSuffix) pomoCustomSuffix.textContent = t("minutesSuffix", {}, l);

  const timerSubjectLabel = document.querySelector<HTMLElement>('label[for="timer-subject"]');
  if (timerSubjectLabel) timerSubjectLabel.textContent = t("subjectLabel", {}, l);

  const timerTodoLabel = document.querySelector<HTMLElement>('label[for="timer-todo-link"]');
  if (timerTodoLabel) timerTodoLabel.textContent = t("todoLinkLabel", {}, l);

  const btnStart = document.getElementById("btn-timer-start");
  if (btnStart) {
    const span = btnStart.querySelector("span");
    if (span) span.textContent = t("startTimer", {}, l);
  }

  const btnStop = document.getElementById("btn-timer-stop");
  if (btnStop) {
    const span = btnStop.querySelector("span");
    if (span) span.textContent = t("stopTimer", {}, l);
  }

  const btnAlarmStop = document.getElementById("btn-timer-alarm-stop");
  if (btnAlarmStop) {
    const span = btnAlarmStop.querySelector("span");
    if (span) span.textContent = t("alarmStopAndRecord", {}, l);
  }

  const btnReset = document.getElementById("btn-timer-reset");
  if (btnReset) {
    const span = btnReset.querySelector("span");
    if (span) span.textContent = t("resetTimer", {}, l);
  }

  const recentH4 = document.querySelector<HTMLElement>(".sessions-header-row h4");
  if (recentH4) recentH4.textContent = t("recentSessionsTitle", {}, l);

  const recentHint = document.querySelector<HTMLElement>(".sessions-sub-hint");
  if (recentHint) recentHint.textContent = t("recentSessionsHint", {}, l);

  // TODO Card
  const todoCardH3 = document.querySelector<HTMLElement>(".todo-card .card-header h3");
  if (todoCardH3) todoCardH3.textContent = t("todoCardTitle", {}, l);

  const todoInputTitle = document.getElementById("todo-input-title") as HTMLInputElement | null;
  if (todoInputTitle) todoInputTitle.placeholder = t("todoInputPlaceholder", {}, l);

  const todoBtnAdd = document.querySelector<HTMLElement>(".todo-add-box .btn-add span");
  if (todoBtnAdd) todoBtnAdd.textContent = t("addBtn", {}, l);

  const todoInputEst = document.getElementById("todo-input-estimate") as HTMLInputElement | null;
  if (todoInputEst) todoInputEst.placeholder = t("estimatePlaceholder", {}, l);

  const todoInputMemo = document.getElementById("todo-input-memo") as HTMLInputElement | null;
  if (todoInputMemo) todoInputMemo.placeholder = t("memoPlaceholder", {}, l);

  // History Tab Headings
  const allTimeH3 = document.querySelector<HTMLElement>(".history-all-time-section h3.section-title");
  if (allTimeH3) allTimeH3.textContent = t("allTimeSummaryTitle", {}, l);

  const statLabels = document.querySelectorAll<HTMLElement>(".stat-label");
  if (statLabels[0]) statLabels[0].textContent = t("allTimeTotalTimeLabel", {}, l);
  if (statLabels[1]) statLabels[1].textContent = t("allTimeTodoCountLabel", {}, l);
  if (statLabels[2]) statLabels[2].textContent = t("allTimeTopSubjectLabel", {}, l);
  if (statLabels[3]) statLabels[3].textContent = t("dayTotalTimeLabel", {}, l);
  if (statLabels[4]) statLabels[4].textContent = t("dayCompletedTasksLabel", {}, l);
  if (statLabels[5]) statLabels[5].textContent = t("dayTopSubjectLabel", {}, l);

  const subjectTotalsH3 = document.querySelector<HTMLElement>(".subject-totals-card .card-header h3");
  if (subjectTotalsH3) subjectTotalsH3.textContent = t("subjectBreakdownTitle", {}, l);

  const historyDateH3 = document.querySelectorAll<HTMLElement>("#tab-history h3.section-title");
  if (historyDateH3[1]) historyDateH3[1].textContent = t("historyDateSectionTitle", {}, l);

  const historyDateLabel = document.querySelector<HTMLElement>('label[for="history-date-picker"] strong');
  if (historyDateLabel) historyDateLabel.textContent = t("selectDateLabel", {}, l);

  const btnPrev = document.getElementById("btn-prev-day");
  if (btnPrev) btnPrev.textContent = t("prevDay", {}, l);

  const btnNext = document.getElementById("btn-next-day");
  if (btnNext) btnNext.textContent = t("nextDay", {}, l);

  const btnToday = document.getElementById("btn-today-day");
  if (btnToday) btnToday.textContent = t("backToToday", {}, l);

  // History Tables
  const sessionTableWrapH3 = document.querySelector<HTMLElement>(".session-table-wrap")?.parentElement?.querySelector("h3");
  if (sessionTableWrapH3) sessionTableWrapH3.textContent = t("historySessionsTableTitle", {}, l);

  const tableHeaders = document.querySelectorAll<HTMLElement>("#history-sessions-table th");
  if (tableHeaders[0]) tableHeaders[0].textContent = t("tableTimeRange", {}, l);
  if (tableHeaders[1]) tableHeaders[1].textContent = t("tableSubject", {}, l);
  if (tableHeaders[2]) tableHeaders[2].textContent = t("tableMemo", {}, l);
  if (tableHeaders[3]) tableHeaders[3].textContent = t("tableDuration", {}, l);
  if (tableHeaders[4]) tableHeaders[4].textContent = t("tableActions", {}, l);

  const todoHistoryH3 = document.querySelector<HTMLElement>(".todo-history-list")?.parentElement?.querySelector("h3");
  if (todoHistoryH3) todoHistoryH3.textContent = t("historyTodosTitle", {}, l);

  const weeklyChartH3 = document.querySelector<HTMLElement>(".chart-container")?.parentElement?.querySelector("h3");
  if (weeklyChartH3) weeklyChartH3.textContent = t("weeklyChartTitle", {}, l);

  // Settings Tab
  const goalHeaderH3 = document.querySelector<HTMLElement>("#goal-settings-form")?.parentElement?.querySelector(".card-header h3");
  if (goalHeaderH3) goalHeaderH3.textContent = t("goalSettingsTitle", {}, l);

  const goalDesc = document.querySelector<HTMLElement>("#goal-settings-form")?.parentElement?.querySelector(".section-desc");
  if (goalDesc) goalDesc.textContent = t("goalSettingsDesc", {}, l);

  const goalMetric = document.querySelector<HTMLElement>(".goal-type-grid")?.parentElement?.querySelector(".form-label-bold");
  if (goalMetric) goalMetric.textContent = t("goalMetricLabel", {}, l);

  const goalTaskCardStrong = document.querySelector<HTMLElement>("#goal-type-label-tasks strong");
  if (goalTaskCardStrong) goalTaskCardStrong.textContent = t("goalTypeTasksTitle", {}, l);

  const goalTaskCardSpan = document.querySelector<HTMLElement>("#goal-type-label-tasks span:not(.goal-card-icon)");
  if (goalTaskCardSpan) goalTaskCardSpan.textContent = t("goalTypeTasksDesc", {}, l);

  const goalTimeCardStrong = document.querySelector<HTMLElement>("#goal-type-label-time strong");
  if (goalTimeCardStrong) goalTimeCardStrong.textContent = t("goalTypeTimeTitle", {}, l);

  const goalTimeCardSpan = document.querySelector<HTMLElement>("#goal-type-label-time span:not(.goal-card-icon)");
  if (goalTimeCardSpan) goalTimeCardSpan.textContent = t("goalTypeTimeDesc", {}, l);

  const goalTaskModeLabel = document.querySelector<HTMLElement>("#goal-tasks-config .form-label-bold");
  if (goalTaskModeLabel) goalTaskModeLabel.textContent = t("goalTaskModeLabel", {}, l);

  const goalRadioSpans = document.querySelectorAll<HTMLElement>("#goal-tasks-config .radio-inline span");
  if (goalRadioSpans[0]) goalRadioSpans[0].textContent = t("goalTaskModeAll", {}, l);
  if (goalRadioSpans[1]) goalRadioSpans[1].textContent = t("goalTaskModeCustom", {}, l);

  const goalTaskCountLabel = document.querySelector<HTMLElement>('label[for="goal-task-count-input"]');
  if (goalTaskCountLabel) goalTaskCountLabel.textContent = t("goalTaskCountLabel", {}, l);

  const goalItemUnit = document.querySelector<HTMLElement>("#goal-task-count-row .unit-label");
  if (goalItemUnit) goalItemUnit.textContent = t("itemUnit", {}, l);

  const goalTimeLabel = document.querySelector<HTMLElement>("#goal-time-config .form-label-bold");
  if (goalTimeLabel) goalTimeLabel.textContent = t("goalTimeLabel", {}, l);

  const timeUnits = document.querySelectorAll<HTMLElement>("#goal-time-config .unit-label");
  if (timeUnits[0]) timeUnits[0].textContent = t("hoursSuffix", {}, l);
  if (timeUnits[1]) timeUnits[1].textContent = t("minutesSuffix", {}, l);

  const presetHint = document.querySelector<HTMLElement>("#goal-time-config .preset-hint");
  if (presetHint) presetHint.textContent = t("quickSetting", {}, l);

  const btnSaveGoalSpan = document.querySelector<HTMLElement>("#btn-save-goal-settings span");
  if (btnSaveGoalSpan) btnSaveGoalSpan.textContent = t("saveGoalSettingsBtn", {}, l);

  // Settings Tab - Pomodoro
  const pomoHeaderH3 = document.querySelector<HTMLElement>("#pomodoro-settings-form")?.parentElement?.querySelector(".card-header h3");
  if (pomoHeaderH3) pomoHeaderH3.textContent = t("pomodoroSettingsTitle", {}, l);

  const pomoDesc = document.querySelector<HTMLElement>("#pomodoro-settings-form")?.parentElement?.querySelector(".section-desc");
  if (pomoDesc) pomoDesc.textContent = t("pomodoroSettingsDesc", {}, l);

  const pomoTimeLabel = document.querySelector<HTMLElement>(".pomodoro-setting-section .form-label-bold");
  if (pomoTimeLabel) pomoTimeLabel.textContent = t("defaultPomodoroTime", {}, l);

  const pomoTimePresetsHint = document.querySelector<HTMLElement>("#pomo-setting-presets .preset-hint");
  if (pomoTimePresetsHint) pomoTimePresetsHint.textContent = t("quickSelect", {}, l);

  const pomoHelp = document.querySelector<HTMLElement>(".pomodoro-setting-section .form-help");
  if (pomoHelp) pomoHelp.textContent = t("pomodoroTimerHint", {}, l);

  const soundLabel = document.querySelectorAll<HTMLElement>(".pomodoro-setting-section .form-label-bold")[1];
  if (soundLabel) soundLabel.textContent = t("alarmSoundSectionTitle", {}, l);

  const soundTitle = document.querySelector<HTMLElement>(".sound-title");
  if (soundTitle) soundTitle.textContent = t("soundTitle", {}, l);

  const soundMeta = document.querySelector<HTMLElement>(".sound-meta");
  if (soundMeta) soundMeta.textContent = t("soundComposer", {}, l);

  const previewBtnText = document.getElementById("btn-sound-preview-text");
  if (previewBtnText) previewBtnText.textContent = isPreviewPlaying ? t("soundPreviewStop", {}, l) : t("soundPreviewBtn", {}, l);

  const soundToggleLabel = document.querySelector<HTMLElement>(".sound-options-row .toggle-label");
  if (soundToggleLabel) soundToggleLabel.textContent = t("soundEnableCheckbox", {}, l);

  const btnSavePomoSpan = document.querySelector<HTMLElement>("#btn-save-pomodoro-settings span");
  if (btnSavePomoSpan) btnSavePomoSpan.textContent = t("savePomodoroSettingsBtn", {}, l);

  // Settings Tab - Subjects
  const subjectCardH3 = document.querySelector<HTMLElement>("#subject-form")?.parentElement?.querySelector(".card-header h3");
  if (subjectCardH3) subjectCardH3.textContent = t("subjectManageTitle", {}, l);

  const subjectDesc = document.querySelector<HTMLElement>("#subject-form")?.parentElement?.querySelector(".section-desc");
  if (subjectDesc) subjectDesc.textContent = t("subjectManageDesc", {}, l);

  const subjectNameLabel = document.querySelector<HTMLElement>('label[for="subject-input-name"]');
  if (subjectNameLabel) subjectNameLabel.textContent = t("subjectNameLabel", {}, l);

  const subjectNameInput = document.getElementById("subject-input-name") as HTMLInputElement | null;
  if (subjectNameInput) subjectNameInput.placeholder = t("subjectNamePlaceholder", {}, l);

  const subjectColorLabel = document.querySelector<HTMLElement>('label[for="subject-input-color"]');
  if (subjectColorLabel) subjectColorLabel.textContent = t("subjectColorLabel", {}, l);

  const btnAddSubjectSpan = document.querySelector<HTMLElement>("#btn-add-subject span");
  if (btnAddSubjectSpan) btnAddSubjectSpan.textContent = t("addSubjectBtn", {}, l);

  const colorPresetLabel = document.querySelector<HTMLElement>(".color-presets-label");
  if (colorPresetLabel) colorPresetLabel.textContent = t("recommendedColors", {}, l);

  const registeredSubH4 = document.querySelector<HTMLElement>(".subject-list-header h4");
  if (registeredSubH4) registeredSubH4.textContent = t("registeredSubjectsHeader", {}, l);

  const resetSubSpan = document.querySelector<HTMLElement>("#btn-reset-subjects span");
  if (resetSubSpan) resetSubSpan.textContent = t("resetSubjectsBtn", {}, l);

  // Settings Tab - Backup
  const backupCardH3 = document.querySelector<HTMLElement>(".backup-actions")?.parentElement?.querySelector(".card-header h3");
  if (backupCardH3) backupCardH3.textContent = t("backupSectionTitle", {}, l);

  const backupDesc = document.querySelector<HTMLElement>(".backup-actions")?.parentElement?.querySelector(".section-desc");
  if (backupDesc) backupDesc.textContent = t("backupSectionDesc", {}, l);

  const backupInfos = document.querySelectorAll<HTMLElement>(".backup-item .backup-info");
  if (backupInfos[0]) {
    const h4 = backupInfos[0].querySelector("h4");
    const p = backupInfos[0].querySelector("p");
    if (h4) h4.textContent = t("exportJsonTitle", {}, l);
    if (p) p.textContent = t("exportJsonDesc", {}, l);
  }
  const btnExportSpan = document.querySelector<HTMLElement>("#btn-export-json span");
  if (btnExportSpan) btnExportSpan.textContent = t("exportJsonBtn", {}, l);

  if (backupInfos[1]) {
    const h4 = backupInfos[1].querySelector("h4");
    const p = backupInfos[1].querySelector("p");
    if (h4) h4.textContent = t("importJsonTitle", {}, l);
    if (p) p.textContent = t("importJsonDesc", {}, l);
  }
  const btnImportSpan = document.querySelector<HTMLElement>(".file-upload-btn span");
  if (btnImportSpan) btnImportSpan.textContent = t("importJsonBtn", {}, l);

  if (backupInfos[2]) {
    const h4 = backupInfos[2].querySelector("h4");
    const p = backupInfos[2].querySelector("p");
    if (h4) h4.textContent = t("loadDemoTitle", {}, l);
    if (p) p.textContent = t("loadDemoDesc", {}, l);
  }
  const btnLoadDemoSpan = document.querySelector<HTMLElement>("#btn-load-demo span");
  if (btnLoadDemoSpan) btnLoadDemoSpan.textContent = t("loadDemoBtn", {}, l);

  if (backupInfos[3]) {
    const h4 = backupInfos[3].querySelector("h4");
    const p = backupInfos[3].querySelector("p");
    if (h4) h4.textContent = t("clearAllTitle", {}, l);
    if (p) p.textContent = t("clearAllDesc", {}, l);
  }
  const btnClearAllSpan = document.querySelector<HTMLElement>("#btn-clear-all span");
  if (btnClearAllSpan) btnClearAllSpan.textContent = t("clearAllBtn", {}, l);

  // Modals
  const recordModalH3 = document.querySelector<HTMLElement>("#record-modal .modal-card h3");
  if (recordModalH3) recordModalH3.textContent = t("modalRecordTitle", {}, l);

  const recordModalP = document.querySelector<HTMLElement>("#record-modal .modal-card > p");
  if (recordModalP) recordModalP.textContent = t("modalRecordDesc", {}, l);

  const recordModalStatLabel = document.querySelector<HTMLElement>("#record-modal .modal-stat-label");
  if (recordModalStatLabel) recordModalStatLabel.textContent = t("modalRecordDuration", {}, l);

  const recordSubjectLabel = document.querySelector<HTMLElement>('label[for="modal-subject"]');
  if (recordSubjectLabel) recordSubjectLabel.textContent = t("modalRecordSubject", {}, l);

  const recordMemoLabel = document.querySelector<HTMLElement>('label[for="modal-memo"]');
  if (recordMemoLabel) recordMemoLabel.textContent = t("modalRecordMemoLabel", {}, l);

  const recordMemoInput = document.getElementById("modal-memo") as HTMLTextAreaElement | null;
  if (recordMemoInput) recordMemoInput.placeholder = t("modalRecordMemoPlaceholder", {}, l);

  const recordCancelBtn = document.getElementById("modal-btn-cancel");
  if (recordCancelBtn) recordCancelBtn.textContent = t("modalDiscardBtn", {}, l);

  const recordSaveBtn = document.getElementById("modal-btn-save");
  if (recordSaveBtn) recordSaveBtn.textContent = t("modalSaveBtn", {}, l);

  const editModalH3 = document.querySelector<HTMLElement>("#edit-session-modal .modal-card h3");
  if (editModalH3) editModalH3.textContent = t("modalEditTitle", {}, l);

  const editModalP = document.querySelector<HTMLElement>("#edit-session-modal .modal-card > p");
  if (editModalP) editModalP.textContent = t("modalEditDesc", {}, l);

  const editSubjectLabel = document.querySelector<HTMLElement>('label[for="edit-session-subject"]');
  if (editSubjectLabel) editSubjectLabel.textContent = t("modalEditSubject", {}, l);

  const editMinutesLabel = document.querySelector<HTMLElement>('label[for="edit-session-minutes"]');
  if (editMinutesLabel) editMinutesLabel.textContent = t("modalEditMinutes", {}, l);

  const editMemoLabel = document.querySelector<HTMLElement>('label[for="edit-session-memo"]');
  if (editMemoLabel) editMemoLabel.textContent = t("modalEditMemo", {}, l);

  const editMemoInput = document.getElementById("edit-session-memo") as HTMLTextAreaElement | null;
  if (editMemoInput) editMemoInput.placeholder = t("modalEditMemoPlaceholder", {}, l);

  const editCancelBtn = document.getElementById("edit-session-btn-cancel");
  if (editCancelBtn) editCancelBtn.textContent = t("modalCancelBtn", {}, l);

  const editSaveBtn = document.getElementById("edit-session-btn-save");
  if (editSaveBtn) editSaveBtn.textContent = t("modalSaveUpdateBtn", {}, l);

  const alarmDismiss = document.getElementById("alarm-modal-btn-dismiss");
  if (alarmDismiss) alarmDismiss.textContent = t("alarmDismissBtn", {}, l);

  const alarmRecordSpan = document.querySelector<HTMLElement>("#alarm-modal-btn-record span");
  if (alarmRecordSpan) alarmRecordSpan.textContent = t("alarmRecordBtn", {}, l);
}

// -------------------------------------------------------
// Data Persistence
// -------------------------------------------------------

function loadData(): void {
  try {
    const rawTodos = localStorage.getItem(STORAGE_KEYS.TODOS);
    todos = rawTodos ? (JSON.parse(rawTodos) as Todo[]) : [];

    const rawSessions = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    sessions = rawSessions ? (JSON.parse(rawSessions) as StudySession[]) : [];

    const rawSubjects = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
    if (rawSubjects) {
      subjects = JSON.parse(rawSubjects) as Subject[];
    } else {
      subjects = JSON.parse(JSON.stringify(DEFAULT_SUBJECTS)) as Subject[];
    }

    const rawGoalSettings = localStorage.getItem(STORAGE_KEYS.GOAL_SETTINGS);
    if (rawGoalSettings) {
      goalSettings = {
        ...DEFAULT_GOAL_SETTINGS,
        ...(JSON.parse(rawGoalSettings) as Partial<GoalSettings>),
      };
    } else {
      goalSettings = { ...DEFAULT_GOAL_SETTINGS };
    }

    const rawPomodoroSettings = localStorage.getItem(STORAGE_KEYS.POMODORO_SETTINGS);
    if (rawPomodoroSettings) {
      pomodoroSettings = {
        ...DEFAULT_POMODORO_SETTINGS,
        ...(JSON.parse(rawPomodoroSettings) as Partial<PomodoroSettings>),
      };
    } else {
      pomodoroSettings = { ...DEFAULT_POMODORO_SETTINGS };
    }
  } catch (e) {
    console.error("Failed to parse localStorage data", e);
    todos = [];
    sessions = [];
    subjects = JSON.parse(JSON.stringify(DEFAULT_SUBJECTS)) as Subject[];
    goalSettings = { ...DEFAULT_GOAL_SETTINGS };
    pomodoroSettings = { ...DEFAULT_POMODORO_SETTINGS };
  }
}

function saveData(): void {
  localStorage.setItem(STORAGE_KEYS.TODOS, JSON.stringify(todos));
  localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  updateAllViews();
}

function saveSubjects(): void {
  localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));
  renderSubjectSelects();
  renderSubjectManageList();
  updateAllViews();
}

function saveGoalSettings(): void {
  localStorage.setItem(STORAGE_KEYS.GOAL_SETTINGS, JSON.stringify(goalSettings));
  updateGoalSettingsUI();
  updateHeaderAndSummary();
  showToast(t("toastGoalSaved", {}, currentResolvedLang));
}

// -------------------------------------------------------
// Pomodoro & Alarm Sound
// -------------------------------------------------------

function getAudioSource(): string {
  return (kaeruPianoAudioSrc as string) || "./audio/kaeru_piano.mp3";
}

function initAlarmAudio(): void {
  if (!alarmAudio) {
    try {
      alarmAudio = new Audio(getAudioSource());
      alarmAudio.loop = true;
    } catch (e) {
      console.warn("Audio initialization warning:", e);
    }
  }
  if (alarmAudio) {
    alarmAudio.volume = pomodoroSettings.volume;
  }
}

function playAlarmSound(): void {
  if (!pomodoroSettings.soundEnabled) return;
  initAlarmAudio();
  if (!alarmAudio) return;
  isAlarmRinging = true;
  alarmAudio.currentTime = 0;
  alarmAudio.play().catch((err) => {
    console.warn("Alarm play prevented (user interaction might be needed):", err);
  });
}

function stopAlarmSound(): void {
  isAlarmRinging = false;
  if (alarmAudio) {
    alarmAudio.pause();
    alarmAudio.currentTime = 0;
  }
  const alarmBtn = document.getElementById("btn-timer-alarm-stop");
  if (alarmBtn) (alarmBtn as HTMLButtonElement).style.display = "none";
  const timerCircle = document.getElementById("timer-circle");
  if (timerCircle) timerCircle.classList.remove("completed");
}

function startPreviewSound(): void {
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
    previewAudio.volume = pomodoroSettings.volume;
    previewAudio.currentTime = 0;
    previewAudio
      .play()
      .then(() => {
        isPreviewPlaying = true;
        updateSoundPreviewButton(true);
      })
      .catch((err) => {
        console.warn("Preview audio play error:", err);
        showToast(t("toastAudioBlocked", {}, currentResolvedLang));
      });
  }
}

function stopPreviewSound(): void {
  if (previewAudio) {
    previewAudio.pause();
    previewAudio.currentTime = 0;
  }
  isPreviewPlaying = false;
  updateSoundPreviewButton(false);
}

function togglePreviewSound(): void {
  if (isPreviewPlaying) {
    stopPreviewSound();
  } else {
    startPreviewSound();
  }
}

function updateSoundPreviewButton(isPlaying: boolean): void {
  const previewText = document.getElementById("btn-sound-preview-text");
  if (previewText) {
    previewText.textContent = isPlaying
      ? t("soundPreviewStop", {}, currentResolvedLang)
      : t("soundPreviewBtn", {}, currentResolvedLang);
  }
}

function savePomodoroSettings(showNotification = false): void {
  localStorage.setItem(STORAGE_KEYS.POMODORO_SETTINGS, JSON.stringify(pomodoroSettings));
  updatePomodoroUI();
  if (showNotification) {
    showToast(t("toastPomoSaved", {}, currentResolvedLang));
  }
}

function setPomodoroMinutes(minutes: number, updateTimerIfIdle = true): void {
  const m = sanitizePomodoroMinutes(minutes);
  pomodoroSettings.workMinutes = m;
  savePomodoroSettings(false);
  if (timerMode === "pomodoro" && !timerRunning && updateTimerIfIdle) {
    timerSeconds = m * 60;
    updateTimerDisplay();
  }
}

function updatePomodoroUI(): void {
  const workMins = pomodoroSettings.workMinutes || 25;

  const pomodoroModeBtn = document.getElementById("btn-mode-pomodoro");
  if (pomodoroModeBtn) {
    pomodoroModeBtn.textContent =
      currentResolvedLang === "en"
        ? `Pomodoro (${workMins}m)`
        : `ポモドーロ (${workMins}分)`;
  }

  const quickBar = document.getElementById("pomodoro-quick-bar");
  if (quickBar) {
    (quickBar as HTMLElement).style.display = timerMode === "pomodoro" ? "flex" : "none";
  }

  const quickPresets = document.querySelectorAll<HTMLButtonElement>(".pomo-preset-btn");
  let matchesQuickPreset = false;
  quickPresets.forEach((btn) => {
    const mins = parseInt(btn.dataset["minutes"] ?? "", 10);
    if (mins === workMins) {
      btn.classList.add("active");
      matchesQuickPreset = true;
    } else {
      btn.classList.remove("active");
    }
  });

  const customInput = document.getElementById("pomo-quick-custom-input") as HTMLInputElement | null;
  if (customInput) {
    customInput.value = matchesQuickPreset ? "" : String(workMins);
  }

  const settingBadge = document.getElementById("pomodoro-current-badge");
  if (settingBadge) {
    settingBadge.textContent =
      currentResolvedLang === "en" ? `Current: ${workMins}m` : `現在: ${workMins}分`;
  }

  const settingInput = document.getElementById("setting-pomo-minutes") as HTMLInputElement | null;
  if (settingInput) {
    settingInput.value = String(workMins);
  }

  const settingPresets = document.querySelectorAll<HTMLButtonElement>(".btn-pomo-setting-preset");
  settingPresets.forEach((btn) => {
    const mins = parseInt(btn.dataset["minutes"] ?? "", 10);
    if (mins === workMins) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  const soundCheckbox = document.getElementById(
    "setting-pomo-sound-enabled",
  ) as HTMLInputElement | null;
  if (soundCheckbox) {
    soundCheckbox.checked = pomodoroSettings.soundEnabled !== false;
  }

  const volumeSlider = document.getElementById(
    "setting-pomo-volume",
  ) as HTMLInputElement | null;
  const volumeText = document.getElementById("setting-pomo-volume-text");
  const volPct = Math.round(pomodoroSettings.volume * 100);
  if (volumeSlider) {
    volumeSlider.value = String(volPct);
  }
  if (volumeText) {
    volumeText.textContent = `${volPct}%`;
  }
}

// -------------------------------------------------------
// Goal Settings UI
// -------------------------------------------------------

function updateGoalSettingsUI(): void {
  const typeTasksRadio = document.querySelector<HTMLInputElement>(
    'input[name="goal-type"][value="tasks"]',
  );
  const typeTimeRadio = document.querySelector<HTMLInputElement>(
    'input[name="goal-type"][value="time"]',
  );
  const labelTasks = document.getElementById("goal-type-label-tasks");
  const labelTime = document.getElementById("goal-type-label-time");
  const tasksConfig = document.getElementById("goal-tasks-config");
  const timeConfig = document.getElementById("goal-time-config");

  if (goalSettings.type === "time") {
    if (typeTimeRadio) typeTimeRadio.checked = true;
    if (labelTime) labelTime.classList.add("active");
    if (labelTasks) labelTasks.classList.remove("active");
    if (timeConfig) (timeConfig as HTMLElement).style.display = "block";
    if (tasksConfig) (tasksConfig as HTMLElement).style.display = "none";
  } else {
    if (typeTasksRadio) typeTasksRadio.checked = true;
    if (labelTasks) labelTasks.classList.add("active");
    if (labelTime) labelTime.classList.remove("active");
    if (tasksConfig) (tasksConfig as HTMLElement).style.display = "block";
    if (timeConfig) (timeConfig as HTMLElement).style.display = "none";
  }

  const modeAllRadio = document.querySelector<HTMLInputElement>(
    'input[name="goal-task-mode"][value="all"]',
  );
  const modeCustomRadio = document.querySelector<HTMLInputElement>(
    'input[name="goal-task-mode"][value="custom"]',
  );
  const countRow = document.getElementById("goal-task-count-row");
  const countInput = document.getElementById("goal-task-count-input") as HTMLInputElement | null;

  if (goalSettings.taskTargetMode === "custom") {
    if (modeCustomRadio) modeCustomRadio.checked = true;
    if (countRow) (countRow as HTMLElement).style.display = "flex";
  } else {
    if (modeAllRadio) modeAllRadio.checked = true;
    if (countRow) (countRow as HTMLElement).style.display = "none";
  }
  if (countInput) countInput.value = String(goalSettings.taskTargetCount || 5);

  const hoursInput = document.getElementById("goal-time-hours-input") as HTMLInputElement | null;
  const minsInput = document.getElementById("goal-time-mins-input") as HTMLInputElement | null;
  const totalMins = goalSettings.timeTargetMinutes || 180;
  if (hoursInput) hoursInput.value = String(Math.floor(totalMins / 60));
  if (minsInput) minsInput.value = String(totalMins % 60);

  const badge = document.getElementById("current-goal-badge");
  if (badge) {
    if (goalSettings.type === "time") {
      badge.textContent =
        currentResolvedLang === "en"
          ? `Study Time (Goal ${formatHoursMinutes(totalMins * 60, currentResolvedLang)})`
          : `学習時間 (目標 ${formatHoursMinutes(totalMins * 60, currentResolvedLang)})`;
    } else if (goalSettings.taskTargetMode === "custom") {
      badge.textContent =
        currentResolvedLang === "en"
          ? `Task Count (Goal ${goalSettings.taskTargetCount} tasks)`
          : `タスク数 (目標 ${goalSettings.taskTargetCount} 個)`;
    } else {
      badge.textContent =
        currentResolvedLang === "en" ? `Task Count (All Tasks)` : `タスク数 (全タスク完了)`;
    }
  }
}

// -------------------------------------------------------
// Subject Management
// -------------------------------------------------------

function addSubject(name: string, color: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (subjects.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
    showToast(t("toastSubjectAlreadyExists", { name: trimmed }, currentResolvedLang));
    return false;
  }
  subjects.push({ name: trimmed, color: color || "#6366f1" });
  saveSubjects();
  showToast(t("toastSubjectAdded", { name: trimmed }, currentResolvedLang));
  return true;
}

function deleteSubject(name: string): void {
  showConfirmModal({
    title: t("deleteSubjectConfirmTitle", {}, currentResolvedLang),
    message: t("deleteSubjectConfirmMsg", { name }, currentResolvedLang),
    confirmText: t("delete", {}, currentResolvedLang),
    confirmClass: "btn-danger",
    onConfirm: () => {
      subjects = subjects.filter((s) => s.name !== name);
      saveSubjects();
      showToast(t("toastSubjectDeleted", { name }, currentResolvedLang));
    },
  });
}

function resetSubjects(): void {
  showConfirmModal({
    title: t("resetSubjectsConfirmTitle", {}, currentResolvedLang),
    message: t("resetSubjectsConfirmMsg", {}, currentResolvedLang),
    confirmText: t("resetSubjectsBtn", {}, currentResolvedLang),
    confirmClass: "btn-secondary",
    onConfirm: () => {
      subjects = JSON.parse(
        JSON.stringify(currentResolvedLang === "en" ? DEFAULT_SUBJECTS_EN : DEFAULT_SUBJECTS),
      ) as Subject[];
      saveSubjects();
      showToast(t("toastSubjectsReset", {}, currentResolvedLang));
    },
  });
}

function renderSubjectSelects(): void {
  const selectIds = ["timer-subject", "todo-input-subject", "modal-subject", "edit-session-subject"];

  selectIds.forEach((id) => {
    const select = document.getElementById(id) as HTMLSelectElement | null;
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = subjects
      .map((s) => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`)
      .join("");

    if (currentVal && subjects.some((s) => s.name === currentVal)) {
      select.value = currentVal;
    } else if (subjects.length > 0) {
      select.value = subjects[0]?.name ?? "";
    }
  });

  const timerSub = document.getElementById("timer-subject") as HTMLSelectElement | null;
  const targetDisplay = document.getElementById("timer-target-display");
  if (timerSub && targetDisplay) {
    targetDisplay.textContent = `${t("subjectPrefix", {}, currentResolvedLang)}: ${timerSub.value || (currentResolvedLang === "en" ? "None" : "未選択")}`;
  }
}

function renderSubjectManageList(): void {
  const container = document.getElementById("subject-chips-container");
  const countBadge = document.getElementById("subject-count-badge");
  if (!container) return;

  if (countBadge) {
    countBadge.textContent = t("subjectCountBadge", { count: subjects.length }, currentResolvedLang);
  }

  if (subjects.length === 0) {
    container.innerHTML = `<div class="empty-hint">${t("noSubjectsRegistered", {}, currentResolvedLang)}</div>`;
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
  `,
    )
    .join("");

  container.querySelectorAll<HTMLButtonElement>(".btn-delete-subject").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-name");
      if (name) deleteSubject(name);
    });
  });
}

// -------------------------------------------------------
// View Updates
// -------------------------------------------------------

function updateAllViews(): void {
  updateHeaderAndSummary();
  renderTodoList();
  renderTodaySessions();
  updateTodoLinkOptions();
  renderHistoryView();
  renderSubjectManageList();
  updateGoalSettingsUI();
}

function updateHeaderAndSummary(): void {
  const l = currentResolvedLang;
  const todayStr = getTodayStr();
  const headerDateTitle = document.getElementById("header-date-title");
  if (headerDateTitle) {
    headerDateTitle.textContent = formatDateDisplay(todayStr, l);
  }

  const todaySessions = sessions.filter((s) => s.date === todayStr);
  const totalSeconds = calculateTotalSeconds(todaySessions);

  const todayTotalTimeEl = document.getElementById("today-total-time");
  if (todayTotalTimeEl) {
    todayTotalTimeEl.textContent = formatHoursMinutes(totalSeconds, l);
  }

  const goalIconEl = document.getElementById("today-goal-icon");
  const goalLabelEl = document.getElementById("today-goal-label");
  const goalRatioEl = document.getElementById("today-todo-ratio");
  const progressLabelEl = document.getElementById("today-progress-label");
  const percentEl = document.getElementById("today-progress-percent");
  const progressBar = document.getElementById("today-progress-bar");
  const goalBadgeEl = document.getElementById("today-goal-badge");

  const todayTodos = todos.filter((t) => !t.date || t.date === todayStr);

  const goalProgress: GoalProgress = calculateGoalProgress(goalSettings, todaySessions, todayTodos);
  const { pct, isAchieved } = goalProgress;

  if (goalProgress.type === "time") {
    if (goalIconEl) goalIconEl.textContent = goalProgress.icon;
    if (goalLabelEl) {
      goalLabelEl.textContent =
        l === "en"
          ? `Daily Study Goal (${formatHoursMinutes(goalProgress.targetSeconds, l)})`
          : `本日の学習目標 (${formatHoursMinutes(goalProgress.targetSeconds, l)})`;
    }
    if (goalRatioEl) {
      goalRatioEl.textContent = `${formatHoursMinutes(totalSeconds, l)} / ${formatHoursMinutes(goalProgress.targetSeconds, l)}`;
    }
    if (progressLabelEl) progressLabelEl.textContent = t("todayTimeProgressRate", {}, l);
  } else {
    if (goalIconEl) goalIconEl.textContent = goalProgress.icon;
    if (progressLabelEl) progressLabelEl.textContent = t("todayProgressRate", {}, l);

    if (goalProgress.type === "tasks_custom") {
      if (goalLabelEl) {
        goalLabelEl.textContent =
          l === "en"
            ? `Task Goal (${goalProgress.targetCount} tasks)`
            : `本日のTODO達成 (目標 ${goalProgress.targetCount} 個)`;
      }
      if (goalRatioEl) {
        goalRatioEl.textContent =
          l === "en"
            ? `${goalProgress.completedCount} / ${goalProgress.targetCount} completed`
            : `${goalProgress.completedCount} / ${goalProgress.targetCount} 個達成`;
      }
    } else {
      if (goalLabelEl) {
        goalLabelEl.textContent =
          l === "en" ? "Task Goal (All Tasks)" : "本日のTODO達成 (全タスク)";
      }
      if (goalRatioEl) {
        goalRatioEl.textContent =
          l === "en"
            ? `${goalProgress.completedCount} / ${goalProgress.totalTodoCount} done`
            : `${goalProgress.completedCount} / ${goalProgress.totalTodoCount} 完了`;
      }
    }
  }

  if (percentEl) {
    percentEl.textContent = `${pct}%`;
  }
  if (progressBar) {
    (progressBar as HTMLElement).style.width = `${Math.min(100, pct)}%`;
    if (isAchieved) {
      (progressBar as HTMLElement).style.background = "linear-gradient(90deg, #10b981, #059669)";
    } else {
      (progressBar as HTMLElement).style.background = "";
    }
  }

  if (goalBadgeEl) {
    goalBadgeEl.textContent = t("todayGoalAchieved", {}, l);
    (goalBadgeEl as HTMLElement).style.display = isAchieved ? "inline-block" : "none";
  }
}

// -------------------------------------------------------
// TODO Management
// -------------------------------------------------------

function renderTodoList(): void {
  const l = currentResolvedLang;
  const container = document.getElementById("todo-list-container");
  if (!container) return;

  const todayStr = getTodayStr();
  const currentTodos = todos.filter((t) => !t.date || t.date === todayStr);

  if (currentTodos.length === 0) {
    container.innerHTML = `
      <div class="empty-hint">
        ${t("todoEmptyHint", {}, l)}
      </div>
    `;
    return;
  }

  container.innerHTML = currentTodos
    .map(
      (todo) => `
    <div class="todo-item ${todo.completed ? "completed" : ""}" data-id="${todo.id}">
      <input type="checkbox" class="todo-checkbox" ${todo.completed ? "checked" : ""} title="${todo.completed ? t("markIncomplete", {}, l) : t("markComplete", {}, l)}" />
      <div class="todo-content">
        <div class="todo-title">${escapeHtml(todo.title)}</div>
        <div class="todo-meta">
          <span class="todo-subject-badge" style="background-color: ${getSubjectColor(todo.subject)}20; color: ${getSubjectColor(todo.subject)}; border: 1px solid ${getSubjectColor(todo.subject)}40;">${escapeHtml(todo.subject || (l === "en" ? "Self-Study" : "その他自習"))}</span>
          ${todo.estimatedMinutes ? `<span>${l === "en" ? "Est: " : "目安: "}${todo.estimatedMinutes}${t("minutesSuffix", {}, l)}</span>` : ""}
          ${todo.memo ? `<span>${l === "en" ? "Note: " : "メモ: "}${escapeHtml(todo.memo)}</span>` : ""}
        </div>
      </div>
      <div class="todo-actions">
        ${
          !todo.completed
            ? `<button class="icon-btn btn-timer-link" title="${t("startTimerForThisTask", {}, l)}">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              </button>`
            : ""
        }
        <button class="icon-btn delete btn-todo-delete" title="${t("delete", {}, l)}">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    </div>
  `,
    )
    .join("");

  container.querySelectorAll<HTMLElement>(".todo-item").forEach((el) => {
    const id = el.getAttribute("data-id");

    const checkbox = el.querySelector<HTMLInputElement>(".todo-checkbox");
    checkbox?.addEventListener("change", (e) => {
      toggleTodoCompleted(id, (e.target as HTMLInputElement).checked);
    });

    const deleteBtn = el.querySelector(".btn-todo-delete");
    deleteBtn?.addEventListener("click", () => {
      deleteTodo(id);
    });

    const timerLinkBtn = el.querySelector(".btn-timer-link");
    timerLinkBtn?.addEventListener("click", () => {
      if (id) startTimerForTodo(id);
    });
  });
}

function addTodo(
  title: string,
  subject: string,
  estimatedMinutes: string,
  memo: string,
): void {
  const newTodo: Todo = {
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

function toggleTodoCompleted(id: string | null, completed: boolean): void {
  const target = todos.find((t) => t.id === id);
  if (target) {
    target.completed = completed;
    target.completedAt = completed ? new Date().toISOString() : null;
    saveData();
  }
}

function deleteTodo(id: string | null): void {
  todos = todos.filter((t) => t.id !== id);
  saveData();
}

function updateTodoLinkOptions(): void {
  const select = document.getElementById("timer-todo-link") as HTMLSelectElement | null;
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

// -------------------------------------------------------
// Timer Management
// -------------------------------------------------------

function updateTimerDisplay(): void {
  const display = document.getElementById("timer-display");
  if (!display) return;
  display.textContent = formatDuration(timerSeconds);
}

function startTimer(): void {
  if (timerRunning) return;
  initAlarmAudio();

  if (timerMode === "pomodoro" && timerSeconds <= 0) {
    timerSeconds = (pomodoroSettings.workMinutes || 25) * 60;
    updateTimerDisplay();
  }

  timerRunning = true;
  sessionStartTime = new Date();

  const startBtn = document.getElementById("btn-timer-start") as HTMLButtonElement | null;
  const stopBtn = document.getElementById("btn-timer-stop") as HTMLButtonElement | null;
  const alarmBtn = document.getElementById("btn-timer-alarm-stop") as HTMLButtonElement | null;
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
  if (chipText) chipText.textContent = t("timerStatusRunning", {}, currentResolvedLang);

  const subjectSelect = document.getElementById("timer-subject") as HTMLSelectElement | null;
  const targetDisplay = document.getElementById("timer-target-display");
  if (subjectSelect && targetDisplay) {
    targetDisplay.textContent = `${t("subjectPrefix", {}, currentResolvedLang)}: ${subjectSelect.value}`;
  }

  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    if (timerMode === "countup") {
      timerSeconds++;
      updateTimerDisplay();
    } else {
      if (timerSeconds > 1) {
        timerSeconds--;
        updateTimerDisplay();
      } else {
        timerSeconds = 0;
        updateTimerDisplay();
        triggerPomodoroCompleted();
      }
    }
  }, 1000);
}

function triggerPomodoroCompleted(): void {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerRunning = false;

  const startBtn = document.getElementById("btn-timer-start") as HTMLButtonElement | null;
  const stopBtn = document.getElementById("btn-timer-stop") as HTMLButtonElement | null;
  const alarmBtn = document.getElementById("btn-timer-alarm-stop") as HTMLButtonElement | null;
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
  if (chipText) chipText.textContent = t("timerStatusCompleted", {}, currentResolvedLang);

  playAlarmSound();

  const modal = document.getElementById("alarm-modal");
  const completedText = document.getElementById("alarm-completed-minutes-text");
  if (completedText) {
    completedText.textContent = `${pomodoroSettings.workMinutes || 25}${t("minutesSuffix", {}, currentResolvedLang)}`;
  }
  if (modal) {
    (modal as HTMLElement).style.display = "flex";
  }
}

function stopTimer(isCompleted = false): void {
  void isCompleted;
  if (!timerRunning && timerSeconds === 0 && !isAlarmRinging) return;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerRunning = false;

  const startBtn = document.getElementById("btn-timer-start") as HTMLButtonElement | null;
  const stopBtn = document.getElementById("btn-timer-stop") as HTMLButtonElement | null;
  const alarmBtn = document.getElementById("btn-timer-alarm-stop") as HTMLButtonElement | null;
  const timerCircle = document.getElementById("timer-circle");
  const chip = document.getElementById("timer-status-chip");
  const chipText = document.getElementById("timer-status-text");

  if (startBtn) startBtn.style.display = "inline-flex";
  if (stopBtn) stopBtn.style.display = "none";
  if (alarmBtn) alarmBtn.style.display = "none";
  if (timerCircle) timerCircle.classList.remove("active");
  if (chip) chip.classList.remove("running");
  if (chipText) chipText.textContent = t("timerStatusIdle", {}, currentResolvedLang);

  let elapsed = 0;
  if (timerMode === "countup") {
    elapsed = timerSeconds;
  } else {
    const totalPomoSec = (pomodoroSettings.workMinutes || 25) * 60;
    elapsed = Math.max(1, totalPomoSec - timerSeconds);
  }

  if (elapsed > 0) {
    openRecordModal(elapsed);
  }
}

function resetTimer(): void {
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

  const startBtn = document.getElementById("btn-timer-start") as HTMLButtonElement | null;
  const stopBtn = document.getElementById("btn-timer-stop") as HTMLButtonElement | null;
  const alarmBtn = document.getElementById("btn-timer-alarm-stop") as HTMLButtonElement | null;
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
  if (chipText) chipText.textContent = t("timerStatusIdle", {}, currentResolvedLang);

  const subjectSelect = document.getElementById("timer-subject") as HTMLSelectElement | null;
  const targetDisplay = document.getElementById("timer-target-display");
  if (subjectSelect && targetDisplay) {
    targetDisplay.textContent = `${t("subjectPrefix", {}, currentResolvedLang)}: ${subjectSelect.value || (currentResolvedLang === "en" ? "None" : "未選択")}`;
  }
}

function startTimerForTodo(todoId: string): void {
  const target = todos.find((t) => t.id === todoId);
  if (!target) return;

  const subjectSelect = document.getElementById("timer-subject") as HTMLSelectElement | null;
  const todoSelect = document.getElementById("timer-todo-link") as HTMLSelectElement | null;

  if (subjectSelect) subjectSelect.value = target.subject;
  if (todoSelect) todoSelect.value = target.id;

  switchTab("tracker");
  resetTimer();
  startTimer();
}

// -------------------------------------------------------
// Record Modal
// -------------------------------------------------------

function openRecordModal(durationSec: number | null = null): void {
  const modal = document.getElementById("record-modal");
  const durationText = document.getElementById("modal-duration-text");
  const subjectInput = document.getElementById("modal-subject") as HTMLSelectElement | null;
  const memoInput = document.getElementById("modal-memo") as HTMLTextAreaElement | null;
  const subjectSelect = document.getElementById("timer-subject") as HTMLSelectElement | null;

  currentSessionDurationSeconds =
    durationSec !== null
      ? durationSec
      : timerMode === "pomodoro"
        ? (pomodoroSettings.workMinutes || 25) * 60
        : timerSeconds;

  if (durationText) durationText.textContent = formatDuration(currentSessionDurationSeconds);
  if (subjectInput && subjectSelect) subjectInput.value = subjectSelect.value;
  if (memoInput) memoInput.value = "";
  if (modal) (modal as HTMLElement).style.display = "flex";
}

function closeRecordModal(): void {
  const modal = document.getElementById("record-modal");
  if (modal) (modal as HTMLElement).style.display = "none";
}

function saveCurrentSession(): void {
  const subjectSelect = document.getElementById("modal-subject") as HTMLSelectElement | null;
  const todoSelect = document.getElementById("timer-todo-link") as HTMLSelectElement | null;
  const memoInput = document.getElementById("modal-memo") as HTMLTextAreaElement | null;

  const durationSec =
    currentSessionDurationSeconds > 0
      ? currentSessionDurationSeconds
      : timerMode === "pomodoro"
        ? (pomodoroSettings.workMinutes || 25) * 60
        : timerSeconds;

  const endTime = new Date();
  const startTime = sessionStartTime || new Date(endTime.getTime() - durationSec * 1000);

  const newSession: StudySession = {
    id: generateId(),
    date: getTodayStr(),
    startTime: startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    endTime: endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    durationSeconds: durationSec,
    subject: subjectSelect ? subjectSelect.value : "その他自習",
    timerMode,
    todoId: todoSelect?.value || null,
    memo: memoInput?.value.trim() || "",
  };

  sessions.unshift(newSession);
  saveData();

  closeRecordModal();
  resetTimer();
}

// -------------------------------------------------------
// Session Edit Modal
// -------------------------------------------------------

function openEditSessionModal(sessionId: string): void {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;

  const modal = document.getElementById("edit-session-modal");
  const idInput = document.getElementById("edit-session-id") as HTMLInputElement | null;
  const subjectSelect = document.getElementById("edit-session-subject") as HTMLSelectElement | null;
  const minutesInput = document.getElementById("edit-session-minutes") as HTMLInputElement | null;
  const memoInput = document.getElementById("edit-session-memo") as HTMLTextAreaElement | null;

  if (idInput) idInput.value = session.id;
  if (subjectSelect) subjectSelect.value = session.subject;
  if (minutesInput) minutesInput.value = String(Math.max(1, Math.round(session.durationSeconds / 60)));
  if (memoInput) memoInput.value = session.memo || "";

  if (modal) (modal as HTMLElement).style.display = "flex";
}

function closeEditSessionModal(): void {
  const modal = document.getElementById("edit-session-modal");
  if (modal) (modal as HTMLElement).style.display = "none";
}

function saveEditedSession(): void {
  const idInput = document.getElementById("edit-session-id") as HTMLInputElement | null;
  const subjectSelect = document.getElementById("edit-session-subject") as HTMLSelectElement | null;
  const minutesInput = document.getElementById("edit-session-minutes") as HTMLInputElement | null;
  const memoInput = document.getElementById("edit-session-memo") as HTMLTextAreaElement | null;

  if (!idInput?.value) return;

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

function deleteSession(sessionId: string): void {
  showConfirmModal({
    title: t("discardConfirmTitle", {}, currentResolvedLang),
    message: t("discardConfirmMsg", {}, currentResolvedLang),
    confirmText: t("modalDiscardBtn", {}, currentResolvedLang),
    confirmClass: "btn-danger",
    onConfirm: () => {
      sessions = sessions.filter((s) => s.id !== sessionId);
      saveData();
      showToast(t("toastSessionDiscarded", {}, currentResolvedLang));
    },
  });
}

// -------------------------------------------------------
// Render Today Sessions
// -------------------------------------------------------

function renderTodaySessions(): void {
  const container = document.getElementById("today-session-list");
  if (!container) return;

  const l = currentResolvedLang;
  const todayStr = getTodayStr();
  const todaySessions = sessions.filter((s) => s.date === todayStr);

  if (todaySessions.length === 0) {
    container.innerHTML = `<div class="empty-hint">${t("recentSessionsEmpty", {}, l)}</div>`;
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
        <strong>${formatHoursMinutes(s.durationSeconds, l)}</strong>
        <button class="icon-btn edit btn-edit-session" title="${t("edit", {}, l)}">
          <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button class="icon-btn delete btn-delete-today-session" title="${t("delete", {}, l)}">
          <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    </div>
  `,
    )
    .join("");

  container.querySelectorAll<HTMLButtonElement>(".btn-edit-session").forEach((btn) => {
    btn.addEventListener("click", () => {
      const el = btn.closest<HTMLElement>(".session-item-compact");
      const id = el?.getAttribute("data-id");
      if (id) openEditSessionModal(id);
    });
  });

  container.querySelectorAll<HTMLButtonElement>(".btn-delete-today-session").forEach((btn) => {
    btn.addEventListener("click", () => {
      const el = btn.closest<HTMLElement>(".session-item-compact");
      const id = el?.getAttribute("data-id");
      if (id) deleteSession(id);
    });
  });
}

// -------------------------------------------------------
// Subject Color Mapping
// -------------------------------------------------------

const SUBJECT_COLORS: Record<string, string> = {
  英語: "#3b82f6",
  数学: "#ef4444",
  現代文: "#10b981",
  "古文・漢文": "#059669",
  物理: "#8b5cf6",
  化学: "#ec4899",
  生物: "#14b8a6",
  地学: "#f59e0b",
  日本史: "#d97706",
  世界史: "#b45309",
  地理: "#06b6d4",
  "公共・政経・倫理": "#6366f1",
  情報: "#0ea5e9",
  "過去問・演習": "#f97316",
  "模試・復習": "#a855f7",
  その他自習: "#64748b",
};

function getSubjectColor(subject: string | undefined): string {
  if (!subject) return "#64748b";
  const found = subjects.find((s) => s.name === subject);
  const color = SUBJECT_COLORS[subject];
  if (color) {
    return color;
  }
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 65%, 52%)`;
}

// -------------------------------------------------------
// All-time Statistics
// -------------------------------------------------------

function renderAllTimeStats(): void {
  const l = currentResolvedLang;
  const totalSeconds = sessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);

  const totalTimeEl = document.getElementById("all-time-total-time");
  if (totalTimeEl) totalTimeEl.textContent = formatHoursMinutes(totalSeconds, l);

  const sessionCountEl = document.getElementById("all-time-session-count");
  if (sessionCountEl) sessionCountEl.textContent = t("allTimeTotalSessions", { count: sessions.length }, l);

  const completedTodoCount = todos.filter((t) => t.completed).length;
  const todoCountEl = document.getElementById("all-time-todo-count");
  if (todoCountEl) {
    todoCountEl.textContent =
      l === "en" ? `${completedTodoCount} tasks` : `${completedTodoCount} 個`;
  }

  const activeDaysSet = new Set(sessions.map((s) => s.date).filter(Boolean));
  const activeDaysEl = document.getElementById("all-time-active-days");
  if (activeDaysEl) activeDaysEl.textContent = t("allTimeActiveDays", { days: activeDaysSet.size }, l);

  const subjectAggregates = aggregateSessionsBySubject(sessions);

  const topSubEl = document.getElementById("all-time-top-subject");
  const topSubTimeEl = document.getElementById("all-time-top-subject-time");
  if (subjectAggregates.length > 0) {
    const topItem = subjectAggregates[0];
    if (topSubEl) topSubEl.textContent = topItem?.subject ?? "-";
    if (topSubTimeEl) topSubTimeEl.textContent = formatHoursMinutes(topItem?.seconds ?? 0, l);
  } else {
    if (topSubEl) topSubEl.textContent = "-";
    if (topSubTimeEl) topSubTimeEl.textContent = "-";
  }

  const breakdownCountEl = document.getElementById("subject-breakdown-count");
  if (breakdownCountEl) {
    breakdownCountEl.textContent = t("subjectBreakdownCount", { count: subjectAggregates.length }, l);
  }

  const listContainer = document.getElementById("subject-totals-list");
  if (listContainer) {
    if (subjectAggregates.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-hint">
          ${t("subjectBreakdownEmpty", {}, l)}
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
                <span class="subject-stat-hours">${formatHoursMinutes(secs, l)}</span>
                <span class="subject-stat-pct">${pct}%</span>
              </div>
            </div>
          `;
        })
        .join("");
    }
  }
}

// -------------------------------------------------------
// History & Past Data View
// -------------------------------------------------------

function renderHistoryView(): void {
  const l = currentResolvedLang;
  renderAllTimeStats();

  const dateInput = document.getElementById("history-date-picker") as HTMLInputElement | null;
  if (dateInput && dateInput.value !== selectedHistoryDate) {
    dateInput.value = selectedHistoryDate;
  }

  const selectedSessions = sessions.filter((s) => s.date === selectedHistoryDate);
  const totalSeconds = selectedSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);

  const totalTimeEl = document.getElementById("history-total-time");
  const sessionCountEl = document.getElementById("history-session-count");
  if (totalTimeEl) totalTimeEl.textContent = formatHoursMinutes(totalSeconds, l);
  if (sessionCountEl) sessionCountEl.textContent = t("daySessionCount", { count: selectedSessions.length }, l);

  const historySubjectAggs = aggregateSessionsBySubject(selectedSessions);
  const topSubEl = document.getElementById("history-top-subject");
  const topSubTimeEl = document.getElementById("history-top-subject-time");
  if (historySubjectAggs.length > 0) {
    const topSub = historySubjectAggs[0];
    if (topSubEl) topSubEl.textContent = topSub?.subject ?? "-";
    if (topSubTimeEl) topSubTimeEl.textContent = formatHoursMinutes(topSub?.seconds ?? 0, l);
  } else {
    if (topSubEl) topSubEl.textContent = "-";
    if (topSubTimeEl) topSubTimeEl.textContent = "-";
  }

  const selectedTodos = todos.filter((t) => t.date === selectedHistoryDate);
  const doneTodos = selectedTodos.filter((t) => t.completed);
  const todoCountEl = document.getElementById("history-todo-count");
  const todoRateEl = document.getElementById("history-todo-rate");
  if (todoCountEl) todoCountEl.textContent = `${doneTodos.length} / ${selectedTodos.length}`;
  if (todoRateEl) {
    const rate =
      selectedTodos.length > 0 ? Math.round((doneTodos.length / selectedTodos.length) * 100) : 0;
    todoRateEl.textContent = t("dayAchievementRate", { rate }, l);
  }

  const tbody = document.getElementById("history-sessions-tbody");
  if (tbody) {
    if (selectedSessions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-dim); padding: 1.5rem;">${t("tableNoRecords", {}, l)}</td></tr>`;
    } else {
      tbody.innerHTML = selectedSessions
        .map((s) => {
          const linkedTodo = s.todoId ? todos.find((t) => t.id === s.todoId) : null;
          return `
          <tr>
            <td>${s.startTime || "-"} ~ ${s.endTime || "-"}</td>
            <td><span class="session-badge" style="background-color: ${getSubjectColor(s.subject)}25; color: ${getSubjectColor(s.subject)}; border: 1px solid ${getSubjectColor(s.subject)}50;">${escapeHtml(s.subject)}</span></td>
            <td>${linkedTodo ? escapeHtml(linkedTodo.title) : (s.memo ? escapeHtml(s.memo) : "-")}</td>
            <td><strong>${formatHoursMinutes(s.durationSeconds, l)}</strong></td>
            <td>
              <button class="icon-btn edit btn-history-edit-session" data-id="${s.id}" title="${t("edit", {}, l)}">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button class="icon-btn delete btn-delete-session" data-id="${s.id}" title="${t("delete", {}, l)}">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </td>
          </tr>
        `;
        })
        .join("");

      tbody.querySelectorAll<HTMLButtonElement>(".btn-history-edit-session").forEach((btn) => {
        btn.addEventListener("click", () => {
          const sid = btn.getAttribute("data-id");
          if (sid) openEditSessionModal(sid);
        });
      });

      tbody.querySelectorAll<HTMLButtonElement>(".btn-delete-session").forEach((btn) => {
        btn.addEventListener("click", () => {
          const sid = btn.getAttribute("data-id");
          if (sid) deleteSession(sid);
        });
      });
    }
  }

  const historyTodoList = document.getElementById("history-todos-list");
  if (historyTodoList) {
    if (selectedTodos.length === 0) {
      historyTodoList.innerHTML = `<div class="empty-hint">${t("historyTodosEmpty", {}, l)}</div>`;
    } else {
      historyTodoList.innerHTML = selectedTodos
        .map(
          (tItem) => `
        <div class="todo-item ${tItem.completed ? "completed" : ""}">
          <input type="checkbox" class="todo-checkbox" ${tItem.completed ? "checked" : ""} disabled />
          <div class="todo-content">
            <div class="todo-title">${escapeHtml(tItem.title)}</div>
            <div class="todo-meta">
              <span class="todo-subject-badge" style="background-color: ${getSubjectColor(tItem.subject)}20; color: ${getSubjectColor(tItem.subject)}; border: 1px solid ${getSubjectColor(tItem.subject)}40;">${escapeHtml(tItem.subject || (l === "en" ? "Self-Study" : "その他自習"))}</span>
              ${tItem.completed ? `<span style="color: var(--success)">${t("todoAchievedStatus", {}, l)}</span>` : `<span>${t("todoIncompleteStatus", {}, l)}</span>`}
            </div>
          </div>
        </div>
      `,
        )
        .join("");
    }
  }

  renderWeeklyTrend();
}

function renderWeeklyTrend(): void {
  const chartData = getWeeklyChartData(sessions, selectedHistoryDate, currentResolvedLang);
  renderWeeklyChart("weekly-chart", chartData);
}

// -------------------------------------------------------
// Navigation & Tabs
// -------------------------------------------------------

function switchTab(tabName: string): void {
  activeTab = tabName;
  document.querySelectorAll<HTMLElement>(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === tabName);
  });
  document.querySelectorAll<HTMLElement>(".tab-pane").forEach((pane) => {
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

// -------------------------------------------------------
// Export & Import & Backup
// -------------------------------------------------------

function exportDataAsJSON(): void {
  const payload = {
    appName: "StudyFlow",
    version: "2.0.0",
    exportDate: new Date().toISOString(),
    todos,
    sessions,
    subjects,
    goalSettings,
    pomodoroSettings,
    language: currentLanguage,
  };

  const dataStr =
    "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `studyflow_backup_${getTodayStr()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast(t("toastExported", {}, currentResolvedLang));
}

function importDataFromJSON(file: File): void {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse((e.target as FileReader).result as string) as {
        todos?: unknown[];
        sessions?: unknown[];
        subjects?: unknown[];
        goalSettings?: Partial<GoalSettings>;
        pomodoroSettings?: Partial<PomodoroSettings>;
        language?: Language;
      };
      if (Array.isArray(data.todos) && Array.isArray(data.sessions)) {
        todos = data.todos as Todo[];
        sessions = data.sessions as StudySession[];
        if (Array.isArray(data.subjects) && data.subjects.length > 0) {
          subjects = data.subjects as Subject[];
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
        if (data.language && (data.language === "auto" || data.language === "ja" || data.language === "en")) {
          applyLanguage(data.language);
        }
        showToast(t("toastImportSuccess", {}, currentResolvedLang));
      } else {
        showToast(t("toastInvalidBackup", {}, currentResolvedLang));
      }
    } catch (err) {
      showToast(t("toastImportError", {}, currentResolvedLang) + (err as Error).message);
    }
  };
  reader.readAsText(file);
}

function loadSampleDemoData(): void {
  const today = new Date();
  const sampleTodos: Todo[] = [];
  const sampleSessions: StudySession[] = [];
  const isEn = currentResolvedLang === "en";

  const examTasks: Array<{ title: string; subject: string; mins: number; memo: string }> = isEn
    ? [
        { title: "Vocabulary list: memorize 100 words", subject: "English", mins: 45, memo: "Review errors thoroughly" },
        { title: "Calculus practice: integrals & limits", subject: "Math", mins: 60, memo: "Past exam questions 3 to 5" },
        { title: "Reading comprehension chapter 2", subject: "Reading", mins: 40, memo: "Analyze argument flow" },
        { title: "Physics mechanics problem set 3", subject: "Physics", mins: 75, memo: "Focus on energy conservation" },
        { title: "Chemistry redox & thermochemistry", subject: "Chemistry", mins: 60, memo: "Equilibrium formulas review" },
        { title: "World history: Modern era review", subject: "History", mins: 50, memo: "Timeline check from 1900" },
        { title: "Full mock exam review & essay", subject: "Mock Exams", mins: 90, memo: "Time management practice" },
      ]
    : [
        { title: "ターゲット1900 100語暗記・確認テスト", subject: "英語", mins: 45, memo: "間違えた箇所の解説を熟読" },
        { title: "共通テスト過去問 数学II・B 微積分", subject: "数学", mins: 60, memo: "第3問〜第5問" },
        { title: "現代文 キーワード読解 2章", subject: "現代文", mins: 40, memo: "論理構成の把握" },
        { title: "セミナー物理 力学 総合演習3題", subject: "物理", mins: 75, memo: "力学的エネルギー保存則" },
        { title: "共通テスト化学 酸化還元・熱化学", subject: "化学", mins: 60, memo: "熱化学方程式の復習" },
        { title: "日本史 一問一答 近現代史の総復習", subject: "日本史", mins: 50, memo: "年表と出来事の整理" },
        { title: "志望校 英語過去問 2024年度長文読解", subject: "過去問・演習", mins: 90, memo: "時間配分のシミュレーション" },
      ];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0] || getTodayStr();

    const task = examTasks[i % examTasks.length] ?? {
      title: "Self-Study Task",
      subject: "その他自習",
      mins: 45,
      memo: "",
    };
    const t1: Todo = {
      id: generateId(),
      title: task.title,
      subject: task.subject,
      estimatedMinutes: task.mins,
      memo: task.memo,
      completed: true,
      completedAt: new Date(d.getTime() + 3600000).toISOString(),
      createdAt: d.toISOString(),
      date: dateStr,
    };
    const t2: Todo = {
      id: generateId(),
      title: isEn ? "Grammar & structure exercises 1-50" : "古文単語315 1〜100確認テスト",
      subject: isEn ? "English" : "古文・漢文",
      estimatedMinutes: 30,
      memo: isEn ? "Check auxiliary verbs" : "助動詞の接続も合わせて確認",
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
      timerMode: "countup",
      todoId: t1.id,
      memo: isEn ? "Focused and completed problems" : "集中して演習完了",
    });
  }

  todos = sampleTodos;
  sessions = sampleSessions;
  saveData();
  showToast(t("toastDemoLoaded", {}, currentResolvedLang));
}

function clearAllData(): void {
  showConfirmModal({
    title: t("clearAllConfirmTitle", {}, currentResolvedLang),
    message: t("clearAllConfirmMsg", {}, currentResolvedLang),
    confirmText: t("clearAllBtn", {}, currentResolvedLang),
    confirmClass: "btn-danger",
    onConfirm: () => {
      todos = [];
      sessions = [];
      saveData();
      showToast(t("toastAllCleared", {}, currentResolvedLang));
    },
  });
}

// -------------------------------------------------------
// DOMContentLoaded — Initialization & Event Listeners
// -------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  loadData();
  initLanguage();
  renderSubjectSelects();
  updatePomodoroUI();
  updateAllViews();
  resetTimer();

  // Theme toggle
  document.getElementById("btn-theme-toggle")?.addEventListener("click", toggleTheme);

  // Language toggle
  document.getElementById("btn-lang-toggle")?.addEventListener("click", toggleLanguage);

  // Tab navigation
  document.querySelectorAll<HTMLElement>(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.getAttribute("data-tab") ?? "tracker");
    });
  });

  // Goal Settings Controls
  const goalForm = document.getElementById("goal-settings-form");
  const goalTypeRadios = document.querySelectorAll<HTMLInputElement>('input[name="goal-type"]');
  const goalTaskModeRadios = document.querySelectorAll<HTMLInputElement>(
    'input[name="goal-task-mode"]',
  );

  goalTypeRadios.forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const type = (e.target as HTMLInputElement).value;
      const tasksConfig = document.getElementById("goal-tasks-config");
      const timeConfig = document.getElementById("goal-time-config");
      const labelTasks = document.getElementById("goal-type-label-tasks");
      const labelTime = document.getElementById("goal-type-label-time");

      if (type === "time") {
        if (timeConfig) (timeConfig as HTMLElement).style.display = "block";
        if (tasksConfig) (tasksConfig as HTMLElement).style.display = "none";
        if (labelTime) labelTime.classList.add("active");
        if (labelTasks) labelTasks.classList.remove("active");
      } else {
        if (tasksConfig) (tasksConfig as HTMLElement).style.display = "block";
        if (timeConfig) (timeConfig as HTMLElement).style.display = "none";
        if (labelTasks) labelTasks.classList.add("active");
        if (labelTime) labelTime.classList.remove("active");
      }
    });
  });

  goalTaskModeRadios.forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const countRow = document.getElementById("goal-task-count-row");
      if (countRow) {
        (countRow as HTMLElement).style.display =
          (e.target as HTMLInputElement).value === "custom" ? "flex" : "none";
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>(".btn-goal-preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mins = Number(btn.getAttribute("data-minutes") || 180);
      const hoursInput = document.getElementById("goal-time-hours-input") as HTMLInputElement | null;
      const minsInput = document.getElementById("goal-time-mins-input") as HTMLInputElement | null;
      if (hoursInput) hoursInput.value = String(Math.floor(mins / 60));
      if (minsInput) minsInput.value = String(mins % 60);
    });
  });

  goalForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const type =
      document.querySelector<HTMLInputElement>('input[name="goal-type"]:checked')?.value || "tasks";
    const taskMode =
      document.querySelector<HTMLInputElement>('input[name="goal-task-mode"]:checked')?.value ||
      "all";
    const count = Number(
      (document.getElementById("goal-task-count-input") as HTMLInputElement | null)?.value || 5,
    );
    const hours = Number(
      (document.getElementById("goal-time-hours-input") as HTMLInputElement | null)?.value || 0,
    );
    const mins = Number(
      (document.getElementById("goal-time-mins-input") as HTMLInputElement | null)?.value || 0,
    );
    const totalMinutes = Math.max(5, hours * 60 + mins);

    goalSettings = {
      type: type as "tasks" | "time",
      taskTargetMode: taskMode as "all" | "custom",
      taskTargetCount: Math.max(1, count),
      timeTargetMinutes: totalMinutes,
    };
    saveGoalSettings();
  });

  // Subject Management Controls
  const subjectForm = document.getElementById("subject-form");
  const subjectNameInput = document.getElementById("subject-input-name") as HTMLInputElement | null;
  const subjectColorInput = document.getElementById(
    "subject-input-color",
  ) as HTMLInputElement | null;
  const subjectHexLabel = document.getElementById("subject-color-hex");

  subjectColorInput?.addEventListener("input", (e) => {
    const val = (e.target as HTMLInputElement).value;
    if (subjectHexLabel) subjectHexLabel.textContent = val;
    document.querySelectorAll<HTMLButtonElement>(".color-dot-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-color") === val);
    });
  });

  document.querySelectorAll<HTMLButtonElement>(".color-dot-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const color = btn.getAttribute("data-color");
      if (color && subjectColorInput) {
        subjectColorInput.value = color;
        if (subjectHexLabel) subjectHexLabel.textContent = color;
        document
          .querySelectorAll<HTMLButtonElement>(".color-dot-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      }
    });
  });

  subjectForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (subjectNameInput?.value.trim()) {
      const added = addSubject(
        subjectNameInput.value.trim(),
        subjectColorInput?.value || "#6366f1",
      );
      if (added) {
        subjectNameInput.value = "";
      }
    }
  });

  document.getElementById("btn-reset-subjects")?.addEventListener("click", resetSubjects);

  // Confirm Modal controls
  document
    .getElementById("confirm-modal-btn-cancel")
    ?.addEventListener("click", closeConfirmModal);
  document
    .getElementById("confirm-modal-btn-confirm")
    ?.addEventListener("click", () => {
      if (confirmModalCallback) {
        confirmModalCallback();
      }
      closeConfirmModal();
    });

  document.getElementById("confirm-modal")?.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).id === "confirm-modal") {
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
    document.getElementById("btn-mode-countup")?.classList.add("active");
    document.getElementById("btn-mode-pomodoro")?.classList.remove("active");
    updatePomodoroUI();
    resetTimer();
  });
  document.getElementById("btn-mode-pomodoro")?.addEventListener("click", () => {
    timerMode = "pomodoro";
    document.getElementById("btn-mode-pomodoro")?.classList.add("active");
    document.getElementById("btn-mode-countup")?.classList.remove("active");
    updatePomodoroUI();
    resetTimer();
  });

  // Pomodoro Quick Bar Presets & Custom Input
  document.querySelectorAll<HTMLButtonElement>(".pomo-preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mins = parseInt(btn.getAttribute("data-minutes") ?? "", 10);
      if (mins) {
        setPomodoroMinutes(mins);
      }
    });
  });

  const quickCustomInput = document.getElementById(
    "pomo-quick-custom-input",
  ) as HTMLInputElement | null;
  quickCustomInput?.addEventListener("change", (e) => {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    if (val && val >= 1 && val <= 180) {
      setPomodoroMinutes(val);
    }
  });

  document.getElementById("btn-timer-alarm-stop")?.addEventListener("click", () => {
    stopAlarmSound();
    const modal = document.getElementById("alarm-modal");
    if (modal) (modal as HTMLElement).style.display = "none";
    openRecordModal((pomodoroSettings.workMinutes || 25) * 60);
  });

  const settingPomoInput = document.getElementById(
    "setting-pomo-minutes",
  ) as HTMLInputElement | null;
  settingPomoInput?.addEventListener("change", (e) => {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    if (val && val >= 1 && val <= 180) {
      setPomodoroMinutes(val, false);
    }
  });

  document.querySelectorAll<HTMLButtonElement>(".btn-pomo-setting-preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mins = parseInt(btn.getAttribute("data-minutes") ?? "", 10);
      if (mins) {
        setPomodoroMinutes(mins, false);
      }
    });
  });

  document.getElementById("btn-sound-preview")?.addEventListener("click", togglePreviewSound);

  document
    .getElementById("setting-pomo-sound-enabled")
    ?.addEventListener("change", (e) => {
      pomodoroSettings.soundEnabled = (e.target as HTMLInputElement).checked;
      savePomodoroSettings(false);
    });

  const volumeSlider = document.getElementById(
    "setting-pomo-volume",
  ) as HTMLInputElement | null;
  volumeSlider?.addEventListener("input", (e) => {
    const vol = parseInt((e.target as HTMLInputElement).value, 10) / 100;
    pomodoroSettings.volume = vol;
    if (alarmAudio) alarmAudio.volume = vol;
    if (previewAudio) previewAudio.volume = vol;
    const volText = document.getElementById("setting-pomo-volume-text");
    if (volText) volText.textContent = `${(e.target as HTMLInputElement).value}%`;
  });
  volumeSlider?.addEventListener("change", () => {
    savePomodoroSettings(false);
  });

  document.getElementById("pomodoro-settings-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    savePomodoroSettings(true);
  });

  document.getElementById("alarm-modal-btn-record")?.addEventListener("click", () => {
    stopAlarmSound();
    const modal = document.getElementById("alarm-modal");
    if (modal) (modal as HTMLElement).style.display = "none";
    openRecordModal((pomodoroSettings.workMinutes || 25) * 60);
  });

  document.getElementById("alarm-modal-btn-dismiss")?.addEventListener("click", () => {
    stopAlarmSound();
    const modal = document.getElementById("alarm-modal");
    if (modal) (modal as HTMLElement).style.display = "none";
    resetTimer();
  });

  window.addEventListener("keydown", (e) => {
    if (isAlarmRinging) {
      if (e.key === "Escape") {
        stopAlarmSound();
        const modal = document.getElementById("alarm-modal");
        if (modal) (modal as HTMLElement).style.display = "none";
        resetTimer();
      } else if (e.key === "Enter" || e.key === " ") {
        stopAlarmSound();
        const modal = document.getElementById("alarm-modal");
        if (modal) (modal as HTMLElement).style.display = "none";
        openRecordModal((pomodoroSettings.workMinutes || 25) * 60);
      }
    }
  });

  document.getElementById("timer-subject")?.addEventListener("change", (e) => {
    const targetDisplay = document.getElementById("timer-target-display");
    if (targetDisplay) {
      targetDisplay.textContent = `${t("subjectPrefix", {}, currentResolvedLang)}: ${(e.target as HTMLSelectElement).value}`;
    }
  });

  // Modal 1 controls (Record)
  document.getElementById("modal-btn-cancel")?.addEventListener("click", () => {
    closeRecordModal();
    resetTimer();
  });
  document.getElementById("modal-btn-save")?.addEventListener("click", saveCurrentSession);

  // Modal 2 controls (Edit Session)
  document
    .getElementById("edit-session-btn-cancel")
    ?.addEventListener("click", closeEditSessionModal);
  document.getElementById("edit-session-btn-save")?.addEventListener("click", saveEditedSession);

  // TODO Form
  document.getElementById("todo-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const titleInput = document.getElementById("todo-input-title") as HTMLInputElement | null;
    const subjectInput = document.getElementById(
      "todo-input-subject",
    ) as HTMLSelectElement | null;
    const estimateInput = document.getElementById(
      "todo-input-estimate",
    ) as HTMLInputElement | null;
    const memoInput = document.getElementById("todo-input-memo") as HTMLInputElement | null;

    if (titleInput?.value.trim()) {
      addTodo(
        titleInput.value.trim(),
        subjectInput?.value ?? "",
        estimateInput?.value ?? "",
        memoInput?.value.trim() ?? "",
      );
      titleInput.value = "";
      if (memoInput) memoInput.value = "";
      if (estimateInput) estimateInput.value = "";
    }
  });

  // History Date Picker Controls
  const datePicker = document.getElementById(
    "history-date-picker",
  ) as HTMLInputElement | null;
  datePicker?.addEventListener("change", (e) => {
    const val = (e.target as HTMLInputElement).value;
    if (val) {
      selectedHistoryDate = val;
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

  const importInput = document.getElementById(
    "import-json-input",
  ) as HTMLInputElement | null;
  importInput?.addEventListener("change", (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files?.[0]) {
      importDataFromJSON(files[0]);
    }
  });

  document.getElementById("btn-load-demo")?.addEventListener("click", loadSampleDemoData);
  document.getElementById("btn-clear-all")?.addEventListener("click", clearAllData);
});
