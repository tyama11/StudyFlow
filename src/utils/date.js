// Date utility functions

/**
 * Returns today's date in YYYY-MM-DD format (local timezone)
 * @param {Date} [date=new Date()]
 * @returns {string} e.g. "2026-09-14"
 */
export function getTodayStr(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Formats a date string (YYYY-MM-DD) into Japanese display format: "YYYY年M月D日 (曜日)"
 * @param {string} dateStr
 * @returns {string} e.g. "2026年9月14日 (月)"
 */
export function formatDateDisplay(dateStr) {
  if (!dateStr || !dateStr.includes("-")) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${y}年${m}月${d}日 (${weekdays[dateObj.getDay()]})`;
}

/**
 * Generates an array of past N days up to baseDateStr (inclusive)
 * @param {string} baseDateStr YYYY-MM-DD
 * @param {number} [days=7]
 * @returns {Array<{ date: string, label: string, year: number, month: number, day: number }>}
 */
export function getPastDateRange(baseDateStr, days = 7) {
  const result = [];
  const [y, m, d] = (baseDateStr || getTodayStr()).split("-").map(Number);
  const base = new Date(y, m - 1, d);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

  for (let i = days - 1; i >= 0; i--) {
    const target = new Date(base);
    target.setDate(target.getDate() - i);
    const targetYear = target.getFullYear();
    const targetMonth = String(target.getMonth() + 1).padStart(2, "0");
    const targetDay = String(target.getDate()).padStart(2, "0");
    const dateStr = `${targetYear}-${targetMonth}-${targetDay}`;
    result.push({
      date: dateStr,
      label: `${target.getMonth() + 1}/${target.getDate()}(${weekdays[target.getDay()]})`,
      year: targetYear,
      month: target.getMonth() + 1,
      day: target.getDate(),
    });
  }
  return result;
}
