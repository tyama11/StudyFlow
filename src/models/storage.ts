// Safe LocalStorage wrapper and state persistence

import type { AppState, Theme, Language } from "../types/index.js";
import {
  STORAGE_KEYS,
  DEFAULT_SUBJECTS,
  DEFAULT_GOAL_SETTINGS,
  DEFAULT_POMODORO_SETTINGS,
} from "../constants/defaults.js";

/**
 * Safely parses JSON with a fallback.
 */
export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn("safeJsonParse error:", e);
    return fallback;
  }
}

/**
 * Loads all persistent StudyFlow data from LocalStorage.
 */
export function loadAllData(storage: Storage | null = getDefaultStorage()): AppState {
  if (!storage) {
    return {
      todos: [],
      sessions: [],
      subjects: JSON.parse(JSON.stringify(DEFAULT_SUBJECTS)) as typeof DEFAULT_SUBJECTS,
      goalSettings: { ...DEFAULT_GOAL_SETTINGS },
      pomodoroSettings: { ...DEFAULT_POMODORO_SETTINGS },
      theme: "auto",
      language: "auto",
    };
  }

  const todos = safeJsonParse(storage.getItem(STORAGE_KEYS.TODOS), []);
  const sessions = safeJsonParse(storage.getItem(STORAGE_KEYS.SESSIONS), []);

  const rawSubjects = safeJsonParse<typeof DEFAULT_SUBJECTS | null>(
    storage.getItem(STORAGE_KEYS.SUBJECTS),
    null,
  );
  const subjects =
    rawSubjects && Array.isArray(rawSubjects) && rawSubjects.length > 0
      ? rawSubjects
      : (JSON.parse(JSON.stringify(DEFAULT_SUBJECTS)) as typeof DEFAULT_SUBJECTS);

  const rawGoals = safeJsonParse(storage.getItem(STORAGE_KEYS.GOAL_SETTINGS), null);
  const goalSettings = { ...DEFAULT_GOAL_SETTINGS, ...(rawGoals ?? {}) };

  const rawPomodoro = safeJsonParse(storage.getItem(STORAGE_KEYS.POMODORO_SETTINGS), null);
  const pomodoroSettings = { ...DEFAULT_POMODORO_SETTINGS, ...(rawPomodoro ?? {}) };

  const rawTheme = storage.getItem(STORAGE_KEYS.THEME);
  const theme: Theme =
    rawTheme === "dark" || rawTheme === "light" ? rawTheme : "auto";

  const rawLang = storage.getItem(STORAGE_KEYS.LANGUAGE);
  const language: Language =
    rawLang === "ja" || rawLang === "en" ? rawLang : "auto";

  return {
    todos,
    sessions,
    subjects,
    goalSettings,
    pomodoroSettings,
    theme,
    language,
  };
}

/**
 * Saves a specific key's data to LocalStorage.
 */
export function saveStorageItem(
  key: string,
  value: unknown,
  storage: Storage | null = getDefaultStorage(),
): void {
  if (!storage) {
    return;
  }
  try {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    storage.setItem(key, serialized);
  } catch (e) {
    console.error(`Failed to save to storage key: ${key}`, e);
  }
}

function getDefaultStorage(): Storage | null {
  return typeof window !== "undefined" ? window.localStorage : null;
}
