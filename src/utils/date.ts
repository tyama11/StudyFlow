import type { DateEntry, ResolvedLanguage } from "../types/index.js";

/**
 * Returns today's date in YYYY-MM-DD format (local timezone)
 */
export function getTodayStr(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const MONTH_NAMES_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];

/**
 * Formats a date string (YYYY-MM-DD) into localized display format:
 * - Japanese: "2026年9月14日 (月)"
 * - English: "Mon, Sep 14, 2026"
 */
export function formatDateDisplay(
  dateStr: string | null | undefined,
  lang: ResolvedLanguage = "ja",
): string {
  if (!dateStr || !dateStr.includes("-")) return "";
  const parts = dateStr.split("-").map(Number);
  const [y, m, d] = parts as [number, number, number];
  if (!y || !m || !d) return "";
  const dateObj = new Date(y, m - 1, d);

  if (lang === "en") {
    const weekday = WEEKDAYS_EN[dateObj.getDay()] ?? "";
    const month = MONTH_NAMES_EN[dateObj.getMonth()] ?? "";
    return `${weekday}, ${month} ${d}, ${y}`;
  }

  const weekday = WEEKDAYS_JA[dateObj.getDay()] ?? "";
  return `${y}年${m}月${d}日 (${weekday})`;
}

/**
 * Generates an array of past N days up to baseDateStr (inclusive)
 * @example getPastDateRange("2026-09-14", 7, "ja") // 7 entries ending on 2026-09-14
 */
export function getPastDateRange(
  baseDateStr: string | undefined,
  days = 7,
  lang: ResolvedLanguage = "ja",
): DateEntry[] {
  const result: DateEntry[] = [];
  const parts = (baseDateStr ?? getTodayStr()).split("-").map(Number);
  const [y, m, d] = parts as [number, number, number];
  const base = new Date(y, m - 1, d);

  for (let i = days - 1; i >= 0; i--) {
    const target = new Date(base);
    target.setDate(target.getDate() - i);
    const targetYear = target.getFullYear();
    const targetMonth = String(target.getMonth() + 1).padStart(2, "0");
    const targetDay = String(target.getDate()).padStart(2, "0");
    const dateStr = `${targetYear}-${targetMonth}-${targetDay}`;
    const weekday =
      lang === "en"
        ? (WEEKDAYS_EN[target.getDay()] ?? "")
        : (WEEKDAYS_JA[target.getDay()] ?? "");

    const label =
      lang === "en"
        ? `${MONTH_NAMES_EN[target.getMonth()] ?? ""} ${target.getDate()}`
        : `${target.getMonth() + 1}/${target.getDate()}(${weekday})`;

    result.push({
      date: dateStr,
      label,
      year: targetYear,
      month: target.getMonth() + 1,
      day: target.getDate(),
    });
  }
  return result;
}
