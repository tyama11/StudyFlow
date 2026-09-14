// Safe LocalStorage wrapper and state persistence

import {
  STORAGE_KEYS,
  DEFAULT_SUBJECTS,
  DEFAULT_GOAL_SETTINGS,
  DEFAULT_POMODORO_SETTINGS,
} from "../constants/defaults.js";

/**
 * Safely parses JSON with a fallback.
 * @param {string|null} raw
 * @param {*} fallback
 * @returns {*}
 */
export function safeJsonParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.warn("safeJsonParse error:", e);
    return fallback;
  }
}

/**
 * Loads all persistent StudyFlow data from LocalStorage.
 * @param {Storage} [storage=window.localStorage]
 * @returns {Object} state
 */
export function loadAllData(storage = (typeof window !== "undefined" ? window.localStorage : null)) {
  if (!storage) {
    return {
      todos: [],
      sessions: [],
      subjects: JSON.parse(JSON.stringify(DEFAULT_SUBJECTS)),
      goalSettings: { ...DEFAULT_GOAL_SETTINGS },
      pomodoroSettings: { ...DEFAULT_POMODORO_SETTINGS },
      theme: "auto",
    };
  }

  const todos = safeJsonParse(storage.getItem(STORAGE_KEYS.TODOS), []);
  const sessions = safeJsonParse(storage.getItem(STORAGE_KEYS.SESSIONS), []);

  const rawSubjects = safeJsonParse(storage.getItem(STORAGE_KEYS.SUBJECTS), null);
  const subjects = rawSubjects && Array.isArray(rawSubjects) && rawSubjects.length > 0
    ? rawSubjects
    : JSON.parse(JSON.stringify(DEFAULT_SUBJECTS));

  const rawGoals = safeJsonParse(storage.getItem(STORAGE_KEYS.GOAL_SETTINGS), null);
  const goalSettings = { ...DEFAULT_GOAL_SETTINGS, ...(rawGoals || {}) };

  const rawPomodoro = safeJsonParse(storage.getItem(STORAGE_KEYS.POMODORO_SETTINGS), null);
  const pomodoroSettings = { ...DEFAULT_POMODORO_SETTINGS, ...(rawPomodoro || {}) };

  const theme = storage.getItem(STORAGE_KEYS.THEME) || "auto";

  return {
    todos,
    sessions,
    subjects,
    goalSettings,
    pomodoroSettings,
    theme,
  };
}

/**
 * Saves specific key data to LocalStorage.
 * @param {string} key
 * @param {*} value
 * @param {Storage} [storage=window.localStorage]
 */
export function saveStorageItem(key, value, storage = (typeof window !== "undefined" ? window.localStorage : null)) {
  if (!storage) return;
  try {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    storage.setItem(key, serialized);
  } catch (e) {
    console.error(`Failed to save to storage key: ${key}`, e);
  }
}
