// Internationalization (i18n) module for StudyFlow

import type { Language, ResolvedLanguage } from "../types/index.js";

/**
 * Detects system/browser language.
 * Returns 'ja' if the primary language begins with 'ja', otherwise 'en'.
 */
export function detectSystemLanguage(): ResolvedLanguage {
  if (typeof navigator !== "undefined" && navigator.language) {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith("ja")) {
      return "ja";
    }
  }
  return "en";
}

/**
 * Resolves configured language to either 'ja' or 'en'.
 */
export function resolveLanguage(pref: Language): ResolvedLanguage {
  if (pref === "ja") return "ja";
  if (pref === "en") return "en";
  return detectSystemLanguage();
}

export const MESSAGES = {
  ja: {
    // Brand & Nav
    appName: "StudyFlow",
    brandSubtitle: "受験・学習サポーター",
    tabTracker: "今日 & タイマー",
    tabHistory: "過去のデータ & 統計",
    tabSettings: "設定 & データ",

    // Theme & Lang
    themeAuto: "OS連動",
    themeDark: "ダーク",
    themeLight: "ライト",
    langAuto: "言語: 自動",
    langJa: "日本語",
    langEn: "English",

    // Header
    headerEncouragement: "今日も目標に向かって一歩ずつ進みましょう！",
    timerStatusIdle: "待機中",
    timerStatusRunning: "学習中",
    timerStatusCompleted: "🎉 集中完了",

    // Banner
    todayTotalTimeLabel: "本日の総学習時間",
    todayGoalLabel: "本日のTODO達成",
    todayGoalAchieved: "🎉 目標達成！",
    todayProgressRate: "今日のタスク達成率",
    todayTimeProgressRate: "目標時間達成率",

    // Timer card
    timerCardTitle: "⏱️ 学習タイマー",
    modeStopwatch: "ストップウォッチ",
    modePomodoro: "ポモドーロ",
    pomodoroQuickLabel: "⏱️ 集中時間:",
    customMinutesPlaceholder: "自由",
    minutesSuffix: "分",
    hoursSuffix: "時間",
    subjectPrefix: "科目",
    subjectLabel: "科目 / 受験分野",
    todoLinkLabel: "紐付けるTODO (任意)",
    noOptionSelected: "-- 指定なし --",
    startTimer: "Start (計測開始)",
    stopTimer: "Stop & 記録",
    alarmStopAndRecord: "アラーム停止 & 記録",
    resetTimer: "リセット",

    // Recent sessions
    recentSessionsTitle: "本日の記録一覧",
    recentSessionsHint: "✏️ 編集 / 🗑️ 破棄が可能",
    recentSessionsEmpty: "まだ今日の記録はありません。Startボタンで計測を開始してください。",

    // TODO card
    todoCardTitle: "📝 今日のTODOリスト",
    todoInputPlaceholder: "タスクを入力 (例: ターゲット1900 100語復習)...",
    addBtn: "追加",
    estimatePlaceholder: "目安(分)",
    memoPlaceholder: "メモ(範囲や教材など)",
    todoEmptyHint: "今日のタスクはありません。上から追加してみましょう！",
    markComplete: "完了にする",
    markIncomplete: "未完了に戻す",
    startTimerForThisTask: "このタスクでタイマーを開始",
    delete: "削除",
    edit: "編集",

    // History tab
    allTimeSummaryTitle: "🏆 全期間の累計学習実績",
    allTimeTotalTimeLabel: "総学習時間 (累計)",
    allTimeTotalSessions: "総セッション: {count} 回",
    allTimeTodoCountLabel: "累計達成TODO",
    allTimeActiveDays: "記録日数: {days} 日",
    allTimeTopSubjectLabel: "最も学習した分野",
    subjectBreakdownTitle: "📚 分野・科目別の累計学習時間",
    subjectBreakdownCount: "{count} 科目記録中",
    subjectBreakdownEmpty: "学習記録がまだありません。タイマーで学習を記録するとここに科目ごとの累計時間が表示されます。",

    historyDateSectionTitle: "📅 日付ごとの振り返り & 記録",
    selectDateLabel: "表示する日付を選択:",
    prevDay: "◀ 前の日",
    nextDay: "次の日 ▶",
    backToToday: "今日に戻る",
    dayTotalTimeLabel: "その日の学習時間",
    daySessionCount: "{count} セッション",
    dayCompletedTasksLabel: "完了タスク",
    dayAchievementRate: "達成率 {rate}%",
    dayTopSubjectLabel: "その日の最多科目",

    historySessionsTableTitle: "⏱️ 選択日の学習セッション記録",
    tableTimeRange: "時間帯",
    tableSubject: "科目",
    tableMemo: "関連タスク/メモ",
    tableDuration: "学習時間",
    tableActions: "操作",
    tableNoRecords: "この日の学習記録はありません。",

    historyTodosTitle: "📝 選択日のTODOリスト & 実績",
    historyTodosEmpty: "この日のTODO記録はありません。",
    todoAchievedStatus: "✓ 達成",
    todoIncompleteStatus: "未完了",
    weeklyChartTitle: "📈 直近7日間の学習時間推移",

    // Settings tab - Goal Settings
    goalSettingsTitle: "🎯 1日の目標設定",
    goalSettingsDesc: "本日の達成度や進捗バーの基準を「完了タスク数」か「総学習時間」から選択し、1日の目標値を設定できます。",
    goalMetricLabel: "目標の測定基準:",
    goalTypeTasksTitle: "タスク数（個数）基準",
    goalTypeTasksDesc: "完了したTODOタスクの個数で本日の達成率を測定",
    goalTypeTimeTitle: "学習時間基準",
    goalTypeTimeDesc: "本日の合計勉強時間（時間・分）で達成率を測定",
    goalTaskModeLabel: "目標タスク数の設定:",
    goalTaskModeAll: "今日登録したすべてのTODOタスクを完了する",
    goalTaskModeCustom: "目標完了数を指定する",
    goalTaskCountLabel: "1日の目標数:",
    itemUnit: "個",
    goalTimeLabel: "1日の目標学習時間:",
    quickSetting: "クイック設定:",
    saveGoalSettingsBtn: "目標設定を保存",

    // Settings tab - Pomodoro
    pomodoroSettingsTitle: "🍅 ポモドーロタイマー & アラーム設定",
    pomodoroSettingsDesc: "集中時間（ポモドーロ分数）や、タイマー終了時に鳴らすアラーム音（フリーBGM『かえるのピアノ』）を設定できます。",
    defaultPomodoroTime: "デフォルト集中時間:",
    quickSelect: "クイック選択:",
    pomodoroTimerHint: "※ タイマー画面の集中時間ボタンからもその場ですぐに切り替え可能です。",
    alarmSoundSectionTitle: "終了アラーム音 (フリーBGM):",
    soundTitle: "かえるのピアノ",
    soundComposer: "作曲: こおろぎ 様 / DOVA-SYNDROME（軽快で爽やかなピアノ曲）",
    soundPreviewBtn: "テスト試聴",
    soundPreviewStop: "試聴を停止",
    soundEnableCheckbox: "時間経過時にアラーム音を鳴らす",
    savePomodoroSettingsBtn: "ポモドーロ設定を保存",

    // Settings tab - Subject Management
    subjectManageTitle: "📚 科目・学習分野のカスタマイズ",
    subjectCountBadge: "{count} 科目登録中",
    subjectManageDesc: "タイマー計測やTODOで使用する科目を自由に追加・削除・管理できます。設定した色は分野別グラフやバッジに反映されます。",
    subjectNameLabel: "科目名",
    subjectNamePlaceholder: "例: 英検、簿記、プログラミング、漢検、小論文...",
    subjectColorLabel: "テーマ色",
    addSubjectBtn: "科目を追加",
    recommendedColors: "おすすめ色:",
    registeredSubjectsHeader: "登録済みの科目一覧",
    resetSubjectsBtn: "初期科目にリセット",
    noSubjectsRegistered: "登録されている科目がありません。「科目を追加」から登録してください。",

    // Settings tab - Backup & Data
    backupSectionTitle: "💾 データ管理 & バックアップ",
    backupSectionDesc: "データはすべてお使いのPC内に安全に保存されています。別のPCへの移行やバックアップのためにJSONファイルとして保存・読み出しが可能です。",
    exportJsonTitle: "データをエクスポート (JSON)",
    exportJsonDesc: "すべての学習時間ログ、TODO履歴、設定をJSONファイルとしてダウンロードします。",
    exportJsonBtn: "JSONエクスポート",
    importJsonTitle: "データをインポート (復元)",
    importJsonDesc: "過去にエクスポートしたJSONファイルを選択してデータを復元します。",
    importJsonBtn: "JSONファイルを読み込む",
    loadDemoTitle: "デモデータの読み込み",
    loadDemoDesc: "アプリのグラフや過去ログ、分野別累計の表示を確認するためのサンプルデータを投入します。",
    loadDemoBtn: "サンプルデータを投入",
    clearAllTitle: "全データの初期化",
    clearAllDesc: "すべてのTODOおよび学習ログを削除します。元に戻すことはできません。",
    clearAllBtn: "データをすべて消去",

    // Modals
    modalRecordTitle: "🎉 学習お疲れ様でした！",
    modalRecordDesc: "今回の学習時間を記録します。",
    modalRecordDuration: "学習時間:",
    modalRecordSubject: "科目:",
    modalRecordMemoLabel: "メモ (演習範囲や間違えた問題など):",
    modalRecordMemoPlaceholder: "例: 共通テスト過去問 2024本試 第2問。",
    modalDiscardBtn: "破棄する",
    modalSaveBtn: "保存する",

    modalEditTitle: "✏️ 学習記録の編集",
    modalEditDesc: "記録済みの科目や学習時間、メモを修正できます。",
    modalEditSubject: "科目 / 分野:",
    modalEditMinutes: "学習時間 (分単位):",
    modalEditMemo: "メモ:",
    modalEditMemoPlaceholder: "メモを入力...",
    modalCancelBtn: "キャンセル",
    modalSaveUpdateBtn: "更新を保存",

    confirmDefaultTitle: "確認",
    confirmDefaultMsg: "本当に実行しますか？",
    confirmBtnText: "実行する",
    discardConfirmTitle: "学習記録の破棄",
    discardConfirmMsg: "この学習記録を破棄（削除）しますか？\n合計学習時間や達成率にも即時反映されます。",
    deleteSubjectConfirmTitle: "科目の削除",
    deleteSubjectConfirmMsg: "「{name}」を科目一覧から削除しますか？\n（※過去に記録した学習ログやTODOのデータは保持されます）",
    resetSubjectsConfirmTitle: "科目の初期化",
    resetSubjectsConfirmMsg: "科目一覧を初期の標準セットに戻しますか？\n（※追加したカスタム科目は削除されます）",
    clearAllConfirmTitle: "全データの初期化",
    clearAllConfirmMsg: "本当にすべてのTODOおよび学習ログを削除しますか？\nこの操作は取り消せません。",

    alarmModalTitle: "ポモドーロ集中完了！🎉",
    alarmModalDesc: "設定した <strong>{mins}分</strong> の集中学習が完了しました！<br>素晴らしい集中力でした。少し休憩してリフレッシュしましょう。",
    alarmPlayingText: "アラーム再生中: <strong>かえるのピアノ (DOVA-SYNDROME)</strong>",
    alarmDismissBtn: "音を止める (記録なし)",
    alarmRecordBtn: "アラームを止めて学習を記録",

    // Toasts
    toastGoalSaved: "1日の目標設定を保存しました！",
    toastPomoSaved: "ポモドーロ＆アラーム設定を保存しました！",
    toastSubjectAdded: "科目「{name}」を追加しました！",
    toastSubjectAlreadyExists: "「{name}」は既に登録されています",
    toastSubjectDeleted: "科目「{name}」を削除しました",
    toastSubjectsReset: "科目一覧を初期状態に戻しました",
    toastSessionDiscarded: "学習記録を破棄しました",
    toastExported: "バックアップJSONをエクスポートしました",
    toastImportSuccess: "データの読み込み・復元が完了しました！",
    toastInvalidBackup: "無効なバックアップファイル形式です",
    toastImportError: "JSONファイルの解析に失敗しました: ",
    toastDemoLoaded: "受験生向けのサンプルデータを投入しました！",
    toastAllCleared: "すべてのデータを初期化しました",
    toastAudioBlocked: "音声の再生がブラウザによりブロックされました",
  },
  en: {
    // Brand & Nav
    appName: "StudyFlow",
    brandSubtitle: "Study & Exam Tracker",
    tabTracker: "Today & Timer",
    tabHistory: "History & Stats",
    tabSettings: "Settings & Data",

    // Theme & Lang
    themeAuto: "OS Sync",
    themeDark: "Dark",
    themeLight: "Light",
    langAuto: "Language: Auto",
    langJa: "日本語",
    langEn: "English",

    // Header
    headerEncouragement: "Every step forward brings you closer to your goals!",
    timerStatusIdle: "Idle",
    timerStatusRunning: "Studying",
    timerStatusCompleted: "🎉 Session Done",

    // Banner
    todayTotalTimeLabel: "Today's Study Time",
    todayGoalLabel: "Today's Task Goal",
    todayGoalAchieved: "🎉 Goal Achieved!",
    todayProgressRate: "Task Completion Rate",
    todayTimeProgressRate: "Time Goal Progress",

    // Timer card
    timerCardTitle: "⏱️ Study Timer",
    modeStopwatch: "Stopwatch",
    modePomodoro: "Pomodoro",
    pomodoroQuickLabel: "⏱️ Focus Duration:",
    customMinutesPlaceholder: "Custom",
    minutesSuffix: "m",
    hoursSuffix: "h",
    subjectPrefix: "Subject",
    subjectLabel: "Subject / Field",
    todoLinkLabel: "Link to Task (Optional)",
    noOptionSelected: "-- None --",
    startTimer: "Start Timer",
    stopTimer: "Stop & Record",
    alarmStopAndRecord: "Stop Alarm & Record",
    resetTimer: "Reset",

    // Recent sessions
    recentSessionsTitle: "Today's Sessions",
    recentSessionsHint: "✏️ Edit / 🗑️ Discard available",
    recentSessionsEmpty: "No study records yet today. Press Start to begin tracking.",

    // TODO card
    todoCardTitle: "📝 Today's Tasks",
    todoInputPlaceholder: "Enter a task (e.g. Vocabulary review chapter 5)...",
    addBtn: "Add",
    estimatePlaceholder: "Est. (min)",
    memoPlaceholder: "Notes / Chapters",
    todoEmptyHint: "No tasks for today. Add one above to get started!",
    markComplete: "Mark as completed",
    markIncomplete: "Mark as incomplete",
    startTimerForThisTask: "Start timer for this task",
    delete: "Delete",
    edit: "Edit",

    // History tab
    allTimeSummaryTitle: "🏆 All-Time Achievements",
    allTimeTotalTimeLabel: "Total Study Time",
    allTimeTotalSessions: "Total Sessions: {count}",
    allTimeTodoCountLabel: "Completed Tasks",
    allTimeActiveDays: "Active Days: {days}",
    allTimeTopSubjectLabel: "Top Studied Field",
    subjectBreakdownTitle: "📚 Total Time by Subject",
    subjectBreakdownCount: "{count} subjects tracked",
    subjectBreakdownEmpty: "No study logs yet. Sessions will appear grouped by subject here.",

    historyDateSectionTitle: "📅 Daily Review & Log",
    selectDateLabel: "Select Date:",
    prevDay: "◀ Previous",
    nextDay: "Next ▶",
    backToToday: "Today",
    dayTotalTimeLabel: "Study Time on this Day",
    daySessionCount: "{count} sessions",
    dayCompletedTasksLabel: "Completed Tasks",
    dayAchievementRate: "Completion Rate: {rate}%",
    dayTopSubjectLabel: "Top Subject on this Day",

    historySessionsTableTitle: "⏱️ Study Sessions on Selected Day",
    tableTimeRange: "Time",
    tableSubject: "Subject",
    tableMemo: "Task / Notes",
    tableDuration: "Duration",
    tableActions: "Actions",
    tableNoRecords: "No study records for this day.",

    historyTodosTitle: "📝 Tasks & Status on Selected Day",
    historyTodosEmpty: "No tasks recorded for this day.",
    todoAchievedStatus: "✓ Done",
    todoIncompleteStatus: "Pending",
    weeklyChartTitle: "📈 Weekly Study Time Trend (Last 7 Days)",

    // Settings tab - Goal Settings
    goalSettingsTitle: "🎯 Daily Goal Settings",
    goalSettingsDesc: "Choose whether your daily progress is measured by completed task count or total study hours, and customize target values.",
    goalMetricLabel: "Goal Criterion:",
    goalTypeTasksTitle: "Task Count Criterion",
    goalTypeTasksDesc: "Measure completion rate by the number of finished tasks",
    goalTypeTimeTitle: "Study Time Criterion",
    goalTypeTimeDesc: "Measure completion rate by total study hours & minutes",
    goalTaskModeLabel: "Target Task Count Mode:",
    goalTaskModeAll: "Complete all registered tasks for the day",
    goalTaskModeCustom: "Specify a custom target count",
    goalTaskCountLabel: "Daily Target Tasks:",
    itemUnit: "tasks",
    goalTimeLabel: "Daily Target Study Time:",
    quickSetting: "Quick Presets:",
    saveGoalSettingsBtn: "Save Goal Settings",

    // Settings tab - Pomodoro
    pomodoroSettingsTitle: "🍅 Pomodoro & Alarm Settings",
    pomodoroSettingsDesc: "Configure focus duration and alarm sounds for Pomodoro sessions.",
    defaultPomodoroTime: "Default Focus Duration:",
    quickSelect: "Quick Select:",
    pomodoroTimerHint: "※ You can also quickly switch focus minutes on the timer screen.",
    alarmSoundSectionTitle: "Session End Alarm Sound:",
    soundTitle: "Frog's Piano (Kaeru no Piano)",
    soundComposer: "Composed by Koorogi / DOVA-SYNDROME (Light & Refreshing Piano)",
    soundPreviewBtn: "Preview Sound",
    soundPreviewStop: "Stop Preview",
    soundEnableCheckbox: "Play alarm sound when time expires",
    savePomodoroSettingsBtn: "Save Pomodoro Settings",

    // Settings tab - Subject Management
    subjectManageTitle: "📚 Subject & Topic Customization",
    subjectCountBadge: "{count} subjects registered",
    subjectManageDesc: "Add, edit, and organize subjects used for timers and tasks. Assigned colors will display in charts and badges.",
    subjectNameLabel: "Subject Name",
    subjectNamePlaceholder: "e.g. English, Math, Coding, History, Physics...",
    subjectColorLabel: "Color Theme",
    addSubjectBtn: "Add Subject",
    recommendedColors: "Recommended Colors:",
    registeredSubjectsHeader: "Registered Subjects",
    resetSubjectsBtn: "Reset to Default Subjects",
    noSubjectsRegistered: "No subjects registered yet. Add one using the form above.",

    // Settings tab - Backup & Data
    backupSectionTitle: "💾 Data Management & Backup",
    backupSectionDesc: "All your study data is stored safely in your local browser/device. Export or restore JSON backups at any time.",
    exportJsonTitle: "Export Data (JSON)",
    exportJsonDesc: "Download all study sessions, task history, and settings as a JSON file.",
    exportJsonBtn: "Export JSON",
    importJsonTitle: "Import Data (Restore)",
    importJsonDesc: "Select and restore data from a previously exported JSON backup file.",
    importJsonBtn: "Load JSON File",
    loadDemoTitle: "Load Sample Demo Data",
    loadDemoDesc: "Populate demo data to preview charts, historical trends, and subject aggregations.",
    loadDemoBtn: "Load Demo Data",
    clearAllTitle: "Clear All Data",
    clearAllDesc: "Permanently delete all tasks and study records. This action cannot be undone.",
    clearAllBtn: "Erase All Data",

    // Modals
    modalRecordTitle: "🎉 Great Study Session!",
    modalRecordDesc: "Save this study session to your daily log.",
    modalRecordDuration: "Duration:",
    modalRecordSubject: "Subject:",
    modalRecordMemoLabel: "Notes (chapters, topics, questions):",
    modalRecordMemoPlaceholder: "e.g. Practice exam 2024 problem 2 review.",
    modalDiscardBtn: "Discard",
    modalSaveBtn: "Save Session",

    modalEditTitle: "✏️ Edit Study Session",
    modalEditDesc: "Modify the subject, duration, or notes of this session.",
    modalEditSubject: "Subject / Field:",
    modalEditMinutes: "Duration (minutes):",
    modalEditMemo: "Notes:",
    modalEditMemoPlaceholder: "Enter notes...",
    modalCancelBtn: "Cancel",
    modalSaveUpdateBtn: "Update Record",

    confirmDefaultTitle: "Confirmation",
    confirmDefaultMsg: "Are you sure you want to proceed?",
    confirmBtnText: "Proceed",
    discardConfirmTitle: "Discard Session",
    discardConfirmMsg: "Discard this study session? Total study time and progress will be recalculated immediately.",
    deleteSubjectConfirmTitle: "Delete Subject",
    deleteSubjectConfirmMsg: 'Delete subject "{name}" from the list?\n(Past logs and tasks associated with this subject will be kept.)',
    resetSubjectsConfirmTitle: "Reset Subjects",
    resetSubjectsConfirmMsg: "Reset subject list to the initial default set?\n(Custom subjects will be removed.)",
    clearAllConfirmTitle: "Clear All Data",
    clearAllConfirmMsg: "Are you sure you want to delete all tasks and study logs?\nThis operation cannot be undone.",

    alarmModalTitle: "Pomodoro Session Complete! 🎉",
    alarmModalDesc: "You completed <strong>{mins} min</strong> of focused study!<br>Outstanding focus. Take a short break and refresh.",
    alarmPlayingText: "Alarm Playing: <strong>Frog's Piano (DOVA-SYNDROME)</strong>",
    alarmDismissBtn: "Stop Alarm (No Record)",
    alarmRecordBtn: "Stop Alarm & Save Session",

    // Toasts
    toastGoalSaved: "Daily goal settings saved!",
    toastPomoSaved: "Pomodoro & alarm settings saved!",
    toastSubjectAdded: 'Subject "{name}" added successfully!',
    toastSubjectAlreadyExists: 'Subject "{name}" is already registered.',
    toastSubjectDeleted: 'Subject "{name}" deleted.',
    toastSubjectsReset: "Subjects reset to initial defaults.",
    toastSessionDiscarded: "Study record discarded.",
    toastExported: "Backup JSON exported successfully!",
    toastImportSuccess: "Data restored successfully!",
    toastInvalidBackup: "Invalid backup file format.",
    toastImportError: "Failed to parse JSON file: ",
    toastDemoLoaded: "Sample exam preparation data loaded!",
    toastAllCleared: "All data cleared successfully.",
    toastAudioBlocked: "Audio playback was blocked by browser permissions.",
  },
} as const;

export type MessageKey = keyof typeof MESSAGES.ja;

/**
 * Gets a localized message string by key, with optional parameter replacements.
 */
export function t(
  key: MessageKey,
  params: Record<string, string | number> = {},
  lang: ResolvedLanguage = "ja",
): string {
  const dict = MESSAGES[lang] ?? MESSAGES.en;
  let text: string = dict[key] ?? MESSAGES.ja[key] ?? key;

  for (const [k, v] of Object.entries(params)) {
    text = text.split(`{${k}}`).join(String(v));
  }
  return text;
}
