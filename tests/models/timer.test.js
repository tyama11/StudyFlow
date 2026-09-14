import { describe, it, expect } from "vitest";
import { calculatePomodoroProgress, sanitizePomodoroMinutes } from "../../src/models/timer.js";

describe("src/models/timer.js", () => {
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
    });
  });
});
