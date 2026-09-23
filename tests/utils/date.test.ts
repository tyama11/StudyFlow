import { describe, it, expect } from "vitest";
import { getTodayStr, formatDateDisplay, getPastDateRange } from "../../src/utils/date.js";

describe("src/utils/date.ts", () => {
  describe("getTodayStr", () => {
    it("returns formatted string YYYY-MM-DD for a specific date", () => {
      const fixedDate = new Date(2026, 8, 14); // 2026-09-14
      expect(getTodayStr(fixedDate)).toBe("2026-09-14");
    });

    it("pads single digit month and day with zero", () => {
      const earlyDate = new Date(2025, 0, 5); // 2025-01-05
      expect(getTodayStr(earlyDate)).toBe("2025-01-05");
    });

    it("uses current date when no argument is given", () => {
      const result = getTodayStr();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("formatDateDisplay", () => {
    it("formats YYYY-MM-DD with Japanese weekday", () => {
      // 2026-09-14 is Monday (月)
      expect(formatDateDisplay("2026-09-14")).toBe("2026年9月14日 (月)");
    });

    it("formats YYYY-MM-DD in English format when lang='en'", () => {
      // 2026-09-14 is Monday
      expect(formatDateDisplay("2026-09-14", "en")).toBe("Mon, Sep 14, 2026");
      expect(formatDateDisplay("2026-01-01", "en")).toBe("Thu, Jan 1, 2026");
    });

    it("formats Saturday correctly (土)", () => {
      // 2026-09-12 is Saturday
      expect(formatDateDisplay("2026-09-12")).toBe("2026年9月12日 (土)");
      expect(formatDateDisplay("2026-09-12", "en")).toBe("Sat, Sep 12, 2026");
    });

    it("formats Sunday correctly (日)", () => {
      // 2026-09-13 is Sunday
      expect(formatDateDisplay("2026-09-13")).toBe("2026年9月13日 (日)");
      expect(formatDateDisplay("2026-09-13", "en")).toBe("Sun, Sep 13, 2026");
    });

    it("returns empty string on empty or invalid input", () => {
      expect(formatDateDisplay("")).toBe("");
      expect(formatDateDisplay(null)).toBe("");
      expect(formatDateDisplay(undefined)).toBe("");
      expect(formatDateDisplay("invalid")).toBe("");
      expect(formatDateDisplay("invalid", "en")).toBe("");
    });
  });

  describe("getPastDateRange", () => {
    it("generates exactly 7 days ending on baseDateStr", () => {
      const range = getPastDateRange("2026-09-14", 7);
      expect(range).toHaveLength(7);
      expect(range[range.length - 1]?.date).toBe("2026-09-14");
      expect(range[0]?.date).toBe("2026-09-08");
    });

    it("handles month rollover correctly (Feb → Mar)", () => {
      const range = getPastDateRange("2026-03-02", 4);
      expect(range).toHaveLength(4);
      expect(range[3]?.date).toBe("2026-03-02");
      expect(range[2]?.date).toBe("2026-03-01");
      expect(range[1]?.date).toBe("2026-02-28");
      expect(range[0]?.date).toBe("2026-02-27");
    });

    it("generates exactly 1 day when days=1", () => {
      const range = getPastDateRange("2026-09-14", 1);
      expect(range).toHaveLength(1);
      expect(range[0]?.date).toBe("2026-09-14");
    });

    it("uses today when baseDateStr is undefined", () => {
      const range = getPastDateRange(undefined, 7);
      expect(range).toHaveLength(7);
      // Last entry should be today
      const today = getTodayStr();
      expect(range[range.length - 1]?.date).toBe(today);
    });

    it("includes year, month, day, label in each entry", () => {
      const range = getPastDateRange("2026-09-14", 1);
      const entry = range[0];
      expect(entry).toHaveProperty("date");
      expect(entry).toHaveProperty("label");
      expect(entry?.label).toBe("9/14(月)");
      expect(entry).toHaveProperty("year");
      expect(entry).toHaveProperty("month");
      expect(entry).toHaveProperty("day");

      const enRange = getPastDateRange("2026-09-14", 1, "en");
      expect(enRange[0]?.label).toBe("Sep 14");
    });
  });
});
