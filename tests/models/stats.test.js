import { describe, it, expect } from "vitest";
import {
  calculateTotalSeconds,
  calculateGoalProgress,
  aggregateSessionsBySubject,
  getWeeklyChartData,
} from "../../src/models/stats.js";

describe("src/models/stats.js", () => {
  describe("calculateTotalSeconds", () => {
    it("sums all durationSeconds properly", () => {
      const sessions = [
        { durationSeconds: 1200 },
        { durationSeconds: 1800 },
        { durationSeconds: 600 },
      ];
      expect(calculateTotalSeconds(sessions)).toBe(3600);
    });

    it("handles empty or invalid sessions safely", () => {
      expect(calculateTotalSeconds([])).toBe(0);
      expect(calculateTotalSeconds([{ durationSeconds: null }])).toBe(0);
      expect(calculateTotalSeconds(null)).toBe(0);
    });
  });

  describe("calculateGoalProgress", () => {
    it("calculates time-based goal progress correctly", () => {
      const settings = { type: "time", timeTargetMinutes: 60 }; // 3600 sec
      const sessions = [{ durationSeconds: 1800 }]; // 30 min (50%)
      const progress = calculateGoalProgress(settings, sessions, []);

      expect(progress.type).toBe("time");
      expect(progress.pct).toBe(50);
      expect(progress.isAchieved).toBe(false);
    });

    it("marks time goal achieved when target is reached or exceeded", () => {
      const settings = { type: "time", timeTargetMinutes: 60 };
      const sessions = [{ durationSeconds: 4000 }];
      const progress = calculateGoalProgress(settings, sessions, []);

      expect(progress.isAchieved).toBe(true);
      expect(progress.pct).toBe(111);
    });

    it("calculates tasks-based goal (all) correctly", () => {
      const settings = { type: "tasks", taskTargetMode: "all" };
      const todos = [
        { id: "1", completed: true },
        { id: "2", completed: true },
        { id: "3", completed: false },
      ];
      const progress = calculateGoalProgress(settings, [], todos);

      expect(progress.type).toBe("tasks_all");
      expect(progress.pct).toBe(67);
      expect(progress.isAchieved).toBe(false);
    });

    it("marks all tasks goal achieved when 100% complete", () => {
      const settings = { type: "tasks", taskTargetMode: "all" };
      const todos = [
        { id: "1", completed: true },
        { id: "2", completed: true },
      ];
      const progress = calculateGoalProgress(settings, [], todos);

      expect(progress.pct).toBe(100);
      expect(progress.isAchieved).toBe(true);
    });

    it("calculates custom count tasks goal correctly", () => {
      const settings = { type: "tasks", taskTargetMode: "custom", taskTargetCount: 3 };
      const todos = [
        { id: "1", completed: true },
        { id: "2", completed: true },
        { id: "3", completed: false },
      ];
      const progress = calculateGoalProgress(settings, [], todos);

      expect(progress.type).toBe("tasks_custom");
      expect(progress.pct).toBe(67);
      expect(progress.isAchieved).toBe(false);
    });
  });

  describe("aggregateSessionsBySubject", () => {
    it("groups and sorts sessions by subject descending", () => {
      const sessions = [
        { subject: "英語", durationSeconds: 3600 },
        { subject: "数学", durationSeconds: 7200 },
        { subject: "英語", durationSeconds: 1800 },
      ];
      const result = aggregateSessionsBySubject(sessions);

      expect(result).toHaveLength(2);
      expect(result[0].subject).toBe("数学");
      expect(result[0].seconds).toBe(7200);
      expect(result[0].percentage).toBe(57); // 7200 / 12600 = 57.1%

      expect(result[1].subject).toBe("英語");
      expect(result[1].seconds).toBe(5400);
      expect(result[1].percentage).toBe(43); // 5400 / 12600 = 42.9%
    });

    it("returns empty array for empty sessions", () => {
      expect(aggregateSessionsBySubject([])).toEqual([]);
    });
  });

  describe("getWeeklyChartData", () => {
    it("aggregates sessions per day for the last 7 days", () => {
      const baseDate = "2026-09-14";
      const sessions = [
        { date: "2026-09-14", durationSeconds: 3600 }, // 60 min
        { date: "2026-09-13", durationSeconds: 1800 }, // 30 min
      ];
      const chartData = getWeeklyChartData(sessions, baseDate);

      expect(chartData).toHaveLength(7);
      expect(chartData[6].date).toBe("2026-09-14");
      expect(chartData[6].minutes).toBe(60);
      expect(chartData[5].date).toBe("2026-09-13");
      expect(chartData[5].minutes).toBe(30);
      expect(chartData[0].minutes).toBe(0);
    });
  });
});
