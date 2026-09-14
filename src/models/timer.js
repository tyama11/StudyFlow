// Timer state and countdown calculation helpers

/**
 * Calculates remaining seconds and progress percentage for Pomodoro.
 * @param {number} currentSeconds Current countdown remaining in seconds
 * @param {number} totalMinutes Total configured work minutes
 * @returns {{ remainingSeconds: number, progressPct: number, isFinished: boolean }}
 */
export function calculatePomodoroProgress(currentSeconds, totalMinutes) {
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
 * @param {number|string} minutes
 * @returns {number} between 1 and 180
 */
export function sanitizePomodoroMinutes(minutes) {
  const parsed = parseInt(minutes, 10);
  if (isNaN(parsed)) return 25;
  return Math.max(1, Math.min(180, parsed));
}
