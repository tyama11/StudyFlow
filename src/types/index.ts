// StudyFlow 共通型定義

// -------------------------------------------------------
// ドメインエンティティ
// -------------------------------------------------------

export interface Todo {
  id: string;
  title: string;
  subject: string;
  completed: boolean;
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO 8601
  completedAt?: string | null;
  estimatedMinutes?: number | null;
  memo?: string;
}

export interface StudySession {
  id: string;
  subject: string;
  date: string; // YYYY-MM-DD
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  durationSeconds: number;
  timerMode: TimerMode;
  todoId?: string | null;
  memo?: string;
}

export interface Subject {
  name: string;
  color: string; // CSS hex color e.g. "#3b82f6"
}

// -------------------------------------------------------
// 設定
// -------------------------------------------------------

export type GoalType = "tasks" | "time";
export type TaskTargetMode = "all" | "custom";
export type TimerMode = "countup" | "pomodoro";
export type Theme = "auto" | "dark" | "light";
export type Language = "auto" | "ja" | "en";
export type ResolvedLanguage = "ja" | "en";

export interface GoalSettings {
  type: GoalType;
  taskTargetMode: TaskTargetMode;
  taskTargetCount: number;
  timeTargetMinutes: number;
}

export interface PomodoroSettings {
  workMinutes: number;
  soundEnabled: boolean;
  volume: number; // 0.0 - 1.0
}

// -------------------------------------------------------
// 統計・チャート
// -------------------------------------------------------

export interface SubjectAggregation {
  subject: string;
  seconds: number;
  percentage: number;
}

export interface DailyChartData {
  date: string; // YYYY-MM-DD
  label: string; // 表示用 e.g. "9/14(月)"
  minutes: number;
}

export interface DateEntry {
  date: string; // YYYY-MM-DD
  label: string;
  year: number;
  month: number;
  day: number;
}

// -------------------------------------------------------
// 目標進捗 (discriminated union)
// -------------------------------------------------------

export interface GoalProgressTime {
  type: "time";
  pct: number;
  isAchieved: boolean;
  targetSeconds: number;
  totalSeconds: number;
  icon: string;
}

export interface GoalProgressTasksAll {
  type: "tasks_all";
  pct: number;
  isAchieved: boolean;
  totalTodoCount: number;
  completedCount: number;
  icon: string;
}

export interface GoalProgressTasksCustom {
  type: "tasks_custom";
  pct: number;
  isAchieved: boolean;
  targetCount: number;
  completedCount: number;
  icon: string;
}

export type GoalProgress = GoalProgressTime | GoalProgressTasksAll | GoalProgressTasksCustom;

// -------------------------------------------------------
// ポモドーロ進捗
// -------------------------------------------------------

export interface PomodoroProgress {
  remainingSeconds: number;
  progressPct: number;
  isFinished: boolean;
}

// -------------------------------------------------------
// アプリ状態
// -------------------------------------------------------

export interface AppState {
  todos: Todo[];
  sessions: StudySession[];
  subjects: Subject[];
  goalSettings: GoalSettings;
  pomodoroSettings: PomodoroSettings;
  theme: Theme;
  language: Language;
}
