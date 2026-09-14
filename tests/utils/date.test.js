import { describe, it, expect } from "vitest";
import { getTodayStr, formatDateDisplay, getPastDateRange } from "../../src/utils/date.js";

describe("src/utils/date.js", () => {
  describe("getTodayStr", () => {
    it("returns formatted string YYYY-MM-DD for a specific date", () => {
      const fixedDate = new Date(2026, 8, 14); // 2026-09-14
      expect(getTodayStr(fixedDate)).toBe("2026-09-14");
    });

    it("pads single digit month and day with zero", () => {
      const earlyDate = new Date(2025, 0, 5); // 2025-01-05
      expect(getTodayStr(earlyDate)).toBe("2025-01-05");
    });
  });

  describe("formatDateDisplay", () => {
    it("formats YYYY-MM-DD with Japanese weekday", () => {
      // 2026-09-14 is Monday (月)
      expect(formatDateDisplay("2026-09-14")).toBe("2026年9月14日 (月)");
    });

    it("returns empty string on empty or invalid input", () => {
      expect(formatDateDisplay("")).toBe("");
      expect(formatDateDisplay(null)).toBe("");
      expect(formatDateDisplay("invalid")).toBe("");
    });
  });

  describe("getPastDateRange", () => {
    it("generates exactly 7 days ending on baseDateStr", () => {
      const range = getPastDateRange("2026-09-14", 7);
      expect(range).toHaveLength(7);
      expect(range[range.length - 1].date).toBe("2026-09-14");
      expect(range[0].date).toBe("2026-09-08");
    });

    it("handles month rollover correctly", () => {
      const range = getPastDateRange("2026-03-02", 4);
      expect(range).toHaveLength(4);
      expect(range[3].date).toBe("2026-03-02");
      expect(range[2].date).toBe("2026-03-01");
      expect(range[1].date).toBe("2026-02-28");
      expect(range[0].date).toBe("2026-02-27");
    });
  });
});
