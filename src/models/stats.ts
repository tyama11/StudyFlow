// Business logic for study statistics and goal calculations

import type {
  StudySession,
  Todo,
  GoalSettings,
  GoalProgress,
  SubjectAggregation,
  DailyChartData,
} from "../types/index.js";
import { getPastDateRange } from "../utils/date.js";

/**
 * Calculates the total study duration in seconds from a list of sessions.
 */
export function calculateTotalSeconds(sessions: StudySession[] | null | undefined): number {
  if (!Array.isArray(sessions)) return 0;
  return sessions.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);
}

/**
 * Calculates goal progress based on settings, sessions, and todos.
 */
export function calculateGoalProgress(
  goalSettings: GoalSettings,
  todaySessions: StudySession[] = [],
  todayTodos: Pick<Todo, "completed">[] = [],
): GoalProgress {
  const totalSeconds = calculateTotalSeconds(todaySessions);
  const completedCount = todayTodos.filter((t) => t.completed).length;
  const totalTodoCount = todayTodos.length;

  if (goalSettings.type === "time") {
    const targetMinutes = Math.max(1, goalSettings.timeTargetMinutes);
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

  // Tasks mode: custom count
  if (goalSettings.taskTargetMode === "custom") {
    const targetCount = Math.max(1, goalSettings.taskTargetCount);
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

  // Tasks mode: all tasks
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
 * Aggregates sessions by subject, sorted descending by seconds.
 */
export function aggregateSessionsBySubject(
  sessions: StudySession[] | null | undefined,
): SubjectAggregation[] {
  if (!Array.isArray(sessions) || sessions.length === 0) return [];

  const subjectMap: Record<string, number> = {};
  let totalSeconds = 0;

  sessions.forEach((s) => {
    const sub = s.subject || "その他自習";
    const secs = s.durationSeconds ?? 0;
    subjectMap[sub] = (subjectMap[sub] ?? 0) + secs;
    totalSeconds += secs;
  });

  return Object.entries(subjectMap)
    .filter(([, secs]) => secs > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([subject, seconds]) => ({
      subject,
      seconds,
      percentage: totalSeconds > 0 ? Math.round((seconds / totalSeconds) * 100) : 0,
    }));
}

/**
 * Prepares weekly trend data for chart rendering.
 */
export function getWeeklyChartData(
  sessions: StudySession[] | null | undefined,
  baseDateStr: string | undefined,
): DailyChartData[] {
  const dateRange = getPastDateRange(baseDateStr, 7);

  return dateRange.map((d) => {
    const daySessions = (sessions ?? []).filter((s) => s.date === d.date);
    const daySeconds = calculateTotalSeconds(daySessions);
    return {
      date: d.date,
      label: d.label,
      minutes: Math.round(daySeconds / 60),
    };
  });
}
