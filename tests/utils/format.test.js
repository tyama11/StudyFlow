import { describe, it, expect } from "vitest";
import { formatDuration, formatHoursMinutes, escapeHtml, generateId } from "../../src/utils/format.js";

describe("src/utils/format.js", () => {
  describe("formatDuration", () => {
    it("formats 0 seconds as 00:00:00", () => {
      expect(formatDuration(0)).toBe("00:00:00");
    });

    it("formats less than a minute correctly", () => {
      expect(formatDuration(45)).toBe("00:00:45");
    });

    it("formats minutes and seconds correctly", () => {
      expect(formatDuration(150)).toBe("00:02:30");
    });

    it("formats hours, minutes, and seconds correctly", () => {
      expect(formatDuration(3665)).toBe("01:01:05");
    });

    it("handles negative numbers and NaN gracefully", () => {
      expect(formatDuration(-10)).toBe("00:00:00");
      expect(formatDuration(NaN)).toBe("00:00:00");
      expect(formatDuration(null)).toBe("00:00:00");
    });
  });

  describe("formatHoursMinutes", () => {
    it("formats minutes only when under an hour", () => {
      expect(formatHoursMinutes(1800)).toBe("30分");
    });

    it("formats hours and minutes when 1 hour or more", () => {
      expect(formatHoursMinutes(3600)).toBe("1時間 0分");
      expect(formatHoursMinutes(5400)).toBe("1時間 30分");
      expect(formatHoursMinutes(9020)).toBe("2時間 30分");
    });
  });

  describe("escapeHtml", () => {
    it("escapes dangerous HTML characters", () => {
      const unsafe = '<script>alert("XSS & \'attack\'")</script>';
      const safe = escapeHtml(unsafe);
      expect(safe).not.toContain("<");
      expect(safe).not.toContain(">");
      expect(safe).toBe('&lt;script&gt;alert(&quot;XSS &amp; &#039;attack&#039;&quot;)&lt;/script&gt;');
    });

    it("handles empty or non-string inputs", () => {
      expect(escapeHtml("")).toBe("");
      expect(escapeHtml(null)).toBe("");
      expect(escapeHtml(undefined)).toBe("");
      expect(escapeHtml(123)).toBe("123");
    });
  });

  describe("generateId", () => {
    it("generates non-empty unique strings", () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });
  });
});
