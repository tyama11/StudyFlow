// StudyFlow Constants and Default Configurations

export const STORAGE_KEYS = {
  TODOS: "studyflow_todos",
  SESSIONS: "studyflow_sessions",
  THEME: "studyflow_theme",
  SUBJECTS: "studyflow_subjects",
  GOAL_SETTINGS: "studyflow_goal_settings",
  POMODORO_SETTINGS: "studyflow_pomodoro_settings",
};

export const DEFAULT_SUBJECTS = [
  { name: "英語", color: "#3b82f6" },
  { name: "数学", color: "#ef4444" },
  { name: "現代文", color: "#10b981" },
  { name: "古文・漢文", color: "#059669" },
  { name: "物理", color: "#8b5cf6" },
  { name: "化学", color: "#ec4899" },
  { name: "生物", color: "#14b8a6" },
  { name: "地学", color: "#f59e0b" },
  { name: "日本史", color: "#d97706" },
  { name: "世界史", color: "#b45309" },
  { name: "地理", color: "#06b6d4" },
  { name: "公共・政経・倫理", color: "#6366f1" },
  { name: "情報", color: "#0ea5e9" },
  { name: "過去問・演習", color: "#f97316" },
  { name: "模試・復習", color: "#a855f7" },
  { name: "その他自習", color: "#64748b" },
];

export const DEFAULT_GOAL_SETTINGS = {
  type: "tasks", // "tasks" (タスク数) | "time" (学習時間)
  taskTargetMode: "all", // "all" (全タスク完了) | "custom" (指定個数)
  taskTargetCount: 5,
  timeTargetMinutes: 180, // デフォルト3時間
};

export const DEFAULT_POMODORO_SETTINGS = {
  workMinutes: 25, // 集中時間（分）
  soundEnabled: true, // アラーム音を鳴らすか
  volume: 0.8, // 音量 (0.0 - 1.0)
};
