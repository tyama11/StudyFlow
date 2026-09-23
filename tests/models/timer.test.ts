import { describe, it, expect } from "vitest";
import { calculatePomodoroProgress, sanitizePomodoroMinutes } from "../../src/models/timer.js";

describe("src/models/timer.ts", () => {
  describe("calculatePomodoroProgress", () => {
    it("calculates 0% progress at the start", () => {
      const res = calculatePomodoroProgress(25 * 60, 25);
      expect(res.progressPct).toBe(0);
      expect(res.remainingSeconds).toBe(1500);
      expect(res.isFinished).toBe(false);
    });

    it("calculates 50% progress midway", () => {
      const res = calculatePomodoroProgress(12.5 * 60, 25);
      expect(res.progressPct).toBe(50);
      expect(res.isFinished).toBe(false);
    });

    it("calculates 100% progress and finishes when seconds <= 0", () => {
      const res = calculatePomodoroProgress(0, 25);
      expect(res.progressPct).toBe(100);
      expect(res.isFinished).toBe(true);
    });

    it("handles negative currentSeconds safely (clamps to 0)", () => {
      const res = calculatePomodoroProgress(-100, 25);
      expect(res.remainingSeconds).toBe(0);
      expect(res.progressPct).toBe(100);
      expect(res.isFinished).toBe(true);
    });

    it("handles totalMinutes=0 safely (clamps to 1s minimum)", () => {
      const res = calculatePomodoroProgress(0, 0);
      // totalSeconds = max(1, 0*60) = 1, elapsed = 1-0 = 1, pct = 100%
      expect(res.isFinished).toBe(true);
      expect(res.progressPct).toBe(100);
    });
  });

  describe("sanitizePomodoroMinutes", () => {
    it("clamps values between 1 and 180", () => {
      expect(sanitizePomodoroMinutes(-5)).toBe(1);
      expect(sanitizePomodoroMinutes(0)).toBe(1);
      expect(sanitizePomodoroMinutes(500)).toBe(180);
      expect(sanitizePomodoroMinutes(45)).toBe(45);
    });

    it("returns default 25 on invalid input", () => {
      expect(sanitizePomodoroMinutes("abc")).toBe(25);
      expect(sanitizePomodoroMinutes(null)).toBe(25);
      expect(sanitizePomodoroMinutes(undefined)).toBe(25);
    });

    it("correctly parses numeric strings", () => {
      expect(sanitizePomodoroMinutes("30")).toBe(30);
      expect(sanitizePomodoroMinutes("1")).toBe(1);
      expect(sanitizePomodoroMinutes("180")).toBe(180);
    });
  });
});
