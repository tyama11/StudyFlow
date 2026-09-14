// Formatting & Sanitization utility functions

/**
 * Formats seconds into HH:MM:SS format
 * @param {number} seconds
 * @returns {string} e.g. "01:23:45"
 */
export function formatDuration(seconds) {
  const safeSec = Math.max(0, Math.floor(seconds || 0));
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = safeSec % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Formats seconds into human-readable Japanese format: "X時間 Y分" or "Y分"
 * @param {number} seconds
 * @returns {string} e.g. "1時間 30分", "45分"
 */
export function formatHoursMinutes(seconds) {
  const safeSec = Math.max(0, Math.floor(seconds || 0));
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  if (hrs > 0) {
    return `${hrs}時間 ${mins}分`;
  }
  return `${mins}分`;
}

/**
 * Generates a unique alphanumeric ID
 * @returns {string}
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

/**
 * Escapes HTML characters to prevent XSS
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
