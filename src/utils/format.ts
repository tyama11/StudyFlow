// Formatting & Sanitization utility functions

/**
 * Formats seconds into HH:MM:SS format
 * @example formatDuration(3665) // "01:01:05"
 */
export function formatDuration(seconds: number | null | undefined): string {
  const safeSec = Math.max(0, Math.floor(seconds ?? 0));
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = safeSec % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Formats seconds into human-readable Japanese format: "X時間 Y分" or "Y分"
 * @example formatHoursMinutes(5400) // "1時間 30分"
 */
export function formatHoursMinutes(seconds: number | null | undefined): string {
  const safeSec = Math.max(0, Math.floor(seconds ?? 0));
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  if (hrs > 0) {
    return `${hrs}時間 ${mins}分`;
  }
  return `${mins}分`;
}

/**
 * Generates a unique alphanumeric ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

/**
 * Escapes HTML characters to prevent XSS
 * @example escapeHtml('<script>') // "&lt;script&gt;"
 */
export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
