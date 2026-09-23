// Date utility functions

import type { DateEntry } from "../types/index.js";

/**
 * Returns today's date in YYYY-MM-DD format (local timezone)
 */
export function getTodayStr(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Formats a date string (YYYY-MM-DD) into Japanese display format: "YYYY年M月D日 (曜日)"
 * @example formatDateDisplay("2026-09-14") // "2026年9月14日 (月)"
 */
export function formatDateDisplay(dateStr: string | null | undefined): string {
  if (!dateStr || !dateStr.includes("-")) return "";
  const parts = dateStr.split("-").map(Number);
  const [y, m, d] = parts as [number, number, number];
  if (!y || !m || !d) return "";
  const dateObj = new Date(y, m - 1, d);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${y}年${m}月${d}日 (${weekdays[dateObj.getDay()]})`;
}

/**
 * Generates an array of past N days up to baseDateStr (inclusive)
 * @example getPastDateRange("2026-09-14", 7) // 7 entries ending on 2026-09-14
 */
export function getPastDateRange(baseDateStr: string | undefined, days = 7): DateEntry[] {
  const result: DateEntry[] = [];
  const parts = (baseDateStr ?? getTodayStr()).split("-").map(Number);
  const [y, m, d] = parts as [number, number, number];
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
