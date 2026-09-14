// Business logic for study statistics and goal calculations

import { getPastDateRange } from "../utils/date.js";

/**
 * Calculates the total study duration in seconds from a list of sessions.
 * @param {Array<{ durationSeconds?: number }>} sessions
 * @returns {number} total seconds
 */
export function calculateTotalSeconds(sessions = []) {
  if (!Array.isArray(sessions)) return 0;
  return sessions.reduce((sum, s) => sum + (s?.durationSeconds || 0), 0);
}

/**
 * Calculates goal progress based on settings, sessions, and todos.
 * @param {Object} goalSettings
 * @param {Array} todaySessions
 * @param {Array} todayTodos
 * @returns {{ pct: number, isAchieved: boolean, label: string, ratioText: string, icon: string }}
 */
export function calculateGoalProgress(goalSettings, todaySessions = [], todayTodos = []) {
  const totalSeconds = calculateTotalSeconds(todaySessions);
  const completedCount = (todayTodos || []).filter((t) => t?.completed).length;
  const totalTodoCount = (todayTodos || []).length;

  if (goalSettings?.type === "time") {
    const targetMinutes = Math.max(1, goalSettings.timeTargetMinutes || 180);
    const targetSeconds = targetMinutes * 60;
    const pct = Math.round((totalSeconds / targetSeconds) * 100);
    const isAchieved = totalSeconds >= targetSeconds;

    return {
      type: "time",
      pct,
      isAchieved,
      targetSeconds,
      totalSeconds,
      icon: "⏱️",
    };
  }

  // Tasks mode
  if (goalSettings?.taskTargetMode === "custom") {
    const targetCount = Math.max(1, goalSettings.taskTargetCount || 5);
    const pct = Math.round((completedCount / targetCount) * 100);
    const isAchieved = completedCount >= targetCount;

    return {
      type: "tasks_custom",
      pct,
      isAchieved,
      targetCount,
      completedCount,
      icon: "📝",
    };
  }

  // All tasks mode
  const pct = totalTodoCount > 0 ? Math.round((completedCount / totalTodoCount) * 100) : 0;
  const isAchieved = completedCount === totalTodoCount && totalTodoCount > 0;

  return {
    type: "tasks_all",
    pct,
    isAchieved,
    totalTodoCount,
    completedCount,
    icon: "📝",
  };
}

/**
 * Aggregates sessions by subject.
 * @param {Array<{ subject?: string, durationSeconds?: number }>} sessions
 * @returns {Array<{ subject: string, seconds: number, percentage: number }>} sorted descending by seconds
 */
export function aggregateSessionsBySubject(sessions = []) {
  if (!Array.isArray(sessions) || sessions.length === 0) return [];

  const subjectMap = {};
  let totalSeconds = 0;

  sessions.forEach((s) => {
    const sub = s?.subject || "その他自習";
    const secs = s?.durationSeconds || 0;
    subjectMap[sub] = (subjectMap[sub] || 0) + secs;
    totalSeconds += secs;
  });

  return Object.entries(subjectMap)
    .filter(([_, secs]) => secs > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([subject, seconds]) => ({
      subject,
      seconds,
      percentage: totalSeconds > 0 ? Math.round((seconds / totalSeconds) * 100) : 0,
    }));
}

/**
 * Prepares weekly trend data for chart rendering.
 * @param {Array<{ date?: string, durationSeconds?: number }>} sessions
 * @param {string} baseDateStr
 * @returns {Array<{ date: string, label: string, minutes: number }>}
 */
export function getWeeklyChartData(sessions = [], baseDateStr) {
  const dateRange = getPastDateRange(baseDateStr, 7);

  return dateRange.map((d) => {
    const daySessions = (sessions || []).filter((s) => s?.date === d.date);
    const daySeconds = calculateTotalSeconds(daySessions);
    return {
      date: d.date,
      label: d.label,
      minutes: Math.round(daySeconds / 60),
    };
  });
}
