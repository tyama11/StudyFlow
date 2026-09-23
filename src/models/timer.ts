// Timer state and countdown calculation helpers

import type { PomodoroProgress } from "../types/index.js";

/**
 * Calculates remaining seconds and progress percentage for Pomodoro.
 */
export function calculatePomodoroProgress(
  currentSeconds: number,
  totalMinutes: number,
): PomodoroProgress {
  const totalSeconds = Math.max(1, totalMinutes * 60);
  const safeCurrent = Math.max(0, currentSeconds);
  const elapsed = totalSeconds - safeCurrent;
  const progressPct = Math.min(100, Math.max(0, Math.round((elapsed / totalSeconds) * 100)));

  return {
    remainingSeconds: safeCurrent,
    progressPct,
    isFinished: safeCurrent <= 0,
  };
}

/**
 * Validates and sanitizes pomodoro work minutes.
 * @returns number between 1 and 180
 */
export function sanitizePomodoroMinutes(minutes: number | string | null | undefined): number {
  const parsed = parseInt(String(minutes ?? ""), 10);
  if (isNaN(parsed)) return 25;
  return Math.max(1, Math.min(180, parsed));
}
