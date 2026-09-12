import { renderWeeklyChart } from "./chart.js";

// --- State Management ---
const STORAGE_KEYS = {
  TODOS: "studyflow_todos",
  SESSIONS: "studyflow_sessions",
};

let todos = [];
let sessions = [];
let activeTab = "tracker";
let todoFilter = "all";

// Timer State
let timerMode = "countup"; // 'countup' | 'pomodoro'
let timerInterval = null;
let timerSeconds = 0;
let timerRunning = false;
let sessionStartTime = null;

// History State
let selectedHistoryDate = getTodayStr();

// --- Utility Functions ---
function getTodayStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${y}年${m}月${d}日 (${weekdays[dateObj.getDay()]})`;
}

function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatHoursMinutes(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) {
    return `${hrs}時間 ${mins}分`;
  }
  return `${mins}分`;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

// --- Data Persistence ---
function loadData() {
  try {
    const rawTodos = localStorage.getItem(STORAGE_KEYS.TODOS);
    todos = rawTodos ? JSON.parse(rawTodos) : [];

    const rawSessions = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    sessions = rawSessions ? JSON.parse(rawSessions) : [];
  } catch (e) {
    console.error("Failed to parse localStorage data", e);
    todos = [];
    sessions = [];
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEYS.TODOS, JSON.stringify(todos));
  localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  updateAllViews();
}

// --- View Updates ---
function updateAllViews() {
  updateHeaderAndSidebar();
  renderTodoList();
  renderTodaySessions();
  updateTodoLinkOptions();
  renderHistoryView();
}

function updateHeaderAndSidebar() {
  const todayStr = getTodayStr();
  const headerDateTitle = document.getElementById("header-date-title");
  if (headerDateTitle) {
    headerDateTitle.textContent = formatDateDisplay(todayStr);
  }

  // Calculate today's study time
  const todaySessions = sessions.filter((s) => s.date === todayStr);
  const totalSeconds = todaySessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);

  const sidebarTodayTime = document.getElementById("sidebar-today-time");
  if (sidebarTodayTime) {
    sidebarTodayTime.textContent = formatHoursMinutes(totalSeconds);
  }

  // Calculate today's TODO ratio
  const todayTodos = todos.filter((t) => !t.date || t.date === todayStr);
  const completedCount = todayTodos.filter((t) => t.completed).length;
  const totalTodoCount = todayTodos.length;
  const ratioText = `TODO ${completedCount}/${totalTodoCount} 完了`;

  const sidebarTodoRatio = document.getElementById("sidebar-todo-ratio");
  if (sidebarTodoRatio) {
    sidebarTodoRatio.textContent = ratioText;
  }

  const progressBar = document.getElementById("sidebar-progress-bar");
  if (progressBar) {
    const pct = totalTodoCount > 0 ? (completedCount / totalTodoCount) * 100 : 0;
    progressBar.style.width = `${pct}%`;
  }
}

// --- TODO Management ---
function renderTodoList() {
  const container = document.getElementById("todo-list-container");
  if (!container) return;

  const todayStr = getTodayStr();
  let filtered = todos.filter((t) => !t.date || t.date === todayStr);

  if (todoFilter === "active") {
    filtered = filtered.filter((t) => !t.completed);
  } else if (todoFilter === "done") {
    filtered = filtered.filter((t) => t.completed);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-hint">
        ${todoFilter === "done" ? "完了したタスクはまだありません。" : "今日のタスクはありません。上から追加してみましょう！"}
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map(
      (todo) => `
    <div class="todo-item ${todo.completed ? "completed" : ""}" data-id="${todo.id}">
      <input type="checkbox" class="todo-checkbox" ${todo.completed ? "checked" : ""} />
      <div class="todo-content">
        <div class="todo-title">${escapeHtml(todo.title)}</div>
        <div class="todo-meta">
          <span class="todo-subject-badge">${escapeHtml(todo.subject || "自習")}</span>
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
    subject: subject || "自習",
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
  timerRunning = true;
  sessionStartTime = new Date();

  const startBtn = document.getElementById("btn-timer-start");
  const stopBtn = document.getElementById("btn-timer-stop");
  const timerCircle = document.getElementById("timer-circle");
  const chip = document.getElementById("timer-status-chip");
  const chipText = document.getElementById("timer-status-text");

  if (startBtn) startBtn.style.display = "none";
  if (stopBtn) stopBtn.style.display = "inline-flex";
  if (timerCircle) timerCircle.classList.add("active");
  if (chip) chip.classList.add("running");
  if (chipText) chipText.textContent = "学習中";

  // Update target label
  const subjectSelect = document.getElementById("timer-subject");
  const targetDisplay = document.getElementById("timer-target-display");
  if (subjectSelect && targetDisplay) {
    targetDisplay.textContent = `科目: ${subjectSelect.value}`;
  }

  timerInterval = setInterval(() => {
    if (timerMode === "countup") {
      timerSeconds++;
      updateTimerDisplay();
    } else {
      // Pomodoro countdown
      if (timerSeconds > 0) {
        timerSeconds--;
        updateTimerDisplay();
      } else {
        stopTimer(true);
        alert("ポモドーロ完了！素晴らしい集中でした。ひと息つきましょう。");
      }
    }
  }, 1000);
}

function stopTimer(isCompleted = false) {
  if (!timerRunning && timerSeconds === 0) return;
  clearInterval(timerInterval);
  timerRunning = false;

  const startBtn = document.getElementById("btn-timer-start");
  const stopBtn = document.getElementById("btn-timer-stop");
  const timerCircle = document.getElementById("timer-circle");
  const chip = document.getElementById("timer-status-chip");
  const chipText = document.getElementById("timer-status-text");

  if (startBtn) startBtn.style.display = "inline-flex";
  if (stopBtn) stopBtn.style.display = "none";
  if (timerCircle) timerCircle.classList.remove("active");
  if (chip) chip.classList.remove("running");
  if (chipText) chipText.textContent = "待機中";

  if (timerSeconds > 0) {
    openRecordModal();
  }
}

function resetTimer() {
  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
  }
  const startBtn = document.getElementById("btn-timer-start");
  const stopBtn = document.getElementById("btn-timer-stop");
  const timerCircle = document.getElementById("timer-circle");
  const chip = document.getElementById("timer-status-chip");
  const chipText = document.getElementById("timer-status-text");

  if (startBtn) startBtn.style.display = "inline-flex";
  if (stopBtn) stopBtn.style.display = "none";
  if (timerCircle) timerCircle.classList.remove("active");
  if (chip) chip.classList.remove("running");
  if (chipText) chipText.textContent = "待機中";

  timerSeconds = timerMode === "pomodoro" ? 25 * 60 : 0;
  updateTimerDisplay();
}

function startTimerForTodo(todoId) {
  const target = todos.find((t) => t.id === todoId);
  if (!target) return;

  const subjectSelect = document.getElementById("timer-subject");
  const todoSelect = document.getElementById("timer-todo-link");

  if (subjectSelect) subjectSelect.value = target.subject;
  if (todoSelect) todoSelect.value = target.id;

  // Switch to tracker tab
  switchTab("tracker");

  resetTimer();
  startTimer();
}

// --- Record Modal ---
function openRecordModal() {
  const modal = document.getElementById("record-modal");
  const durationText = document.getElementById("modal-duration-text");
  const subjectInput = document.getElementById("modal-subject");
  const memoInput = document.getElementById("modal-memo");

  const subjectSelect = document.getElementById("timer-subject");
  const todoSelect = document.getElementById("timer-todo-link");

  let sub = subjectSelect ? subjectSelect.value : "自習";
  if (todoSelect && todoSelect.value) {
    const linked = todos.find((t) => t.id === todoSelect.value);
    if (linked) sub = `${linked.title} (${sub})`;
  }

  if (durationText) durationText.textContent = formatDuration(timerSeconds);
  if (subjectInput) subjectInput.value = sub;
  if (memoInput) memoInput.value = "";
  if (modal) modal.style.display = "flex";
}

function closeRecordModal() {
  const modal = document.getElementById("record-modal");
  if (modal) modal.style.display = "none";
}

function saveCurrentSession() {
  const subjectSelect = document.getElementById("timer-subject");
  const todoSelect = document.getElementById("timer-todo-link");
  const memoInput = document.getElementById("modal-memo");

  const endTime = new Date();
  const startTime = sessionStartTime || new Date(endTime.getTime() - timerSeconds * 1000);

  const newSession = {
    id: generateId(),
    date: getTodayStr(),
    startTime: startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    endTime: endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    durationSeconds: timerSeconds,
    subject: subjectSelect ? subjectSelect.value : "自習",
    todoId: todoSelect ? todoSelect.value : null,
    memo: memoInput ? memoInput.value : "",
  };

  sessions.unshift(newSession);
  saveData();

  closeRecordModal();
  resetTimer();
}

// --- History & Past Data View ---
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
    <div class="session-item-compact">
      <div>
        <span class="session-badge">${escapeHtml(s.subject)}</span>
        <span style="color: var(--text-muted); margin-left: 0.5rem;">${s.startTime} - ${s.endTime}</span>
      </div>
      <div>
        <strong>${formatHoursMinutes(s.durationSeconds)}</strong>
      </div>
    </div>
  `
    )
    .join("");
}

function renderHistoryView() {
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
  const subjectMap = {};
  selectedSessions.forEach((s) => {
    subjectMap[s.subject] = (subjectMap[s.subject] || 0) + s.durationSeconds;
  });
  let topSub = "-";
  let topSubTime = 0;
  for (const [sub, secs] of Object.entries(subjectMap)) {
    if (secs > topSubTime) {
      topSubTime = secs;
      topSub = sub;
    }
  }
  const topSubEl = document.getElementById("history-top-subject");
  const topSubTimeEl = document.getElementById("history-top-subject-time");
  if (topSubEl) topSubEl.textContent = topSub;
  if (topSubTimeEl) topSubTimeEl.textContent = topSubTime > 0 ? formatHoursMinutes(topSubTime) : "-";

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
            <td><span class="session-badge">${escapeHtml(s.subject)}</span></td>
            <td>${linkedTodo ? escapeHtml(linkedTodo.title) : "-"}</td>
            <td><strong>${formatHoursMinutes(s.durationSeconds)}</strong></td>
            <td>
              <button class="icon-btn delete btn-delete-session" data-id="${s.id}" title="削除">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </td>
          </tr>
        `;
        })
        .join("");

      tbody.querySelectorAll(".btn-delete-session").forEach((btn) => {
        btn.addEventListener("click", () => {
          const sid = btn.getAttribute("data-id");
          if (confirm("この記録を削除しますか？")) {
            sessions = sessions.filter((s) => s.id !== sid);
            saveData();
          }
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
              <span class="todo-subject-badge">${escapeHtml(t.subject || "自習")}</span>
              ${t.completed ? `<span style="color: var(--success)">✓ 達成</span>` : `<span>未完了</span>`}
            </div>
          </div>
        </div>
      `
        )
        .join("");
    }
  }

  // Render Weekly Chart
  renderWeeklyTrend();
}

function renderWeeklyTrend() {
  const chartData = [];
  const curr = new Date(selectedHistoryDate);

  // Past 7 days relative to selected date
  for (let i = 6; i >= 0; i--) {
    const d = new Date(curr);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${day}`;

    const daySessions = sessions.filter((s) => s.date === dateStr);
    const daySeconds = daySessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);

    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    chartData.push({
      date: dateStr,
      label: `${d.getMonth() + 1}/${d.getDate()}(${weekdays[d.getDay()]})`,
      minutes: Math.round(daySeconds / 60),
    });
  }

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
  }
}

// --- Export & Import & Backup ---
function exportDataAsJSON() {
  const payload = {
    version: "1.0",
    exportDate: new Date().toISOString(),
    todos,
    sessions,
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `studyflow_backup_${getTodayStr()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importDataFromJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data.todos) && Array.isArray(data.sessions)) {
        todos = data.todos;
        sessions = data.sessions;
        saveData();
        alert("データの読み込みが完了しました！");
      } else {
        alert("無効なバックアップファイル形式です。");
      }
    } catch (err) {
      alert("JSONファイルの解析に失敗しました: " + err.message);
    }
  };
  reader.readAsText(file);
}

function loadSampleDemoData() {
  const today = new Date();
  const sampleTodos = [];
  const sampleSessions = [];
  const subjects = ["英語", "プログラミング", "数学・科学", "読書", "資格・試験"];

  // Generate for past 7 days
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];

    // 2-3 todos per day
    const t1 = {
      id: generateId(),
      title: `${subjects[i % subjects.length]}の基本演習 (Day ${7 - i})`,
      subject: subjects[i % subjects.length],
      estimatedMinutes: 60,
      memo: "参考書チャプターの復習",
      completed: true,
      completedAt: new Date(d.getTime() + 3600000).toISOString(),
      createdAt: d.toISOString(),
      date: dateStr,
    };
    const t2 = {
      id: generateId(),
      title: `語学リスニング または 公式確認`,
      subject: "英語",
      estimatedMinutes: 30,
      memo: "シャドーイング練習",
      completed: i < 5,
      completedAt: i < 5 ? new Date(d.getTime() + 7200000).toISOString() : null,
      createdAt: d.toISOString(),
      date: dateStr,
    };
    sampleTodos.push(t1, t2);

    // 1-2 sessions per day
    const sessionDuration = (Math.floor(Math.random() * 80) + 40) * 60; // 40~120 mins
    sampleSessions.push({
      id: generateId(),
      date: dateStr,
      startTime: "10:00",
      endTime: "11:30",
      durationSeconds: sessionDuration,
      subject: subjects[i % subjects.length],
      todoId: t1.id,
      memo: "順調に進行",
    });
  }

  todos = sampleTodos;
  sessions = sampleSessions;
  saveData();
  alert("1週間分のサンプルデータを投入しました！「過去のデータ & 統計」タブでグラフをご確認いただけます。");
}

function clearAllData() {
  if (confirm("本当にすべてのデータを削除しますか？この操作は取り消せません。")) {
    todos = [];
    sessions = [];
    saveData();
    alert("すべてのデータを初期化しました。");
  }
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
  loadData();
  updateAllViews();
  resetTimer();

  // Tab navigation
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.getAttribute("data-tab"));
    });
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
    resetTimer();
  });
  document.getElementById("btn-mode-pomodoro")?.addEventListener("click", () => {
    timerMode = "pomodoro";
    document.getElementById("btn-mode-pomodoro").classList.add("active");
    document.getElementById("btn-mode-countup").classList.remove("active");
    resetTimer();
  });

  // Subject change
  document.getElementById("timer-subject")?.addEventListener("change", (e) => {
    const targetDisplay = document.getElementById("timer-target-display");
    if (targetDisplay) targetDisplay.textContent = `科目: ${e.target.value}`;
  });

  // Modal controls
  document.getElementById("modal-btn-cancel")?.addEventListener("click", () => {
    closeRecordModal();
    resetTimer();
  });
  document.getElementById("modal-btn-save")?.addEventListener("click", saveCurrentSession);

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

  // TODO Filter buttons
  document.querySelectorAll(".filter-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".filter-pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      todoFilter = pill.getAttribute("data-filter");
      renderTodoList();
    });
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
