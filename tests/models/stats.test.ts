import { describe, it, expect } from "vitest";
import {
  calculateTotalSeconds,
  calculateGoalProgress,
  aggregateSessionsBySubject,
  getWeeklyChartData,
} from "../../src/models/stats.js";
import type { StudySession, GoalSettings, Todo } from "../../src/types/index.js";

// Helper to create a minimal StudySession
function makeSession(overrides: Partial<StudySession> = {}): StudySession {
  return {
    id: "s1",
    subject: "英語",
    date: "2026-09-14",
    startTime: "10:00",
    endTime: "11:00",
    durationSeconds: 3600,
    timerMode: "countup",
    ...overrides,
  };
}

// Helper to create a minimal Todo
function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: "t1",
    title: "Test",
    subject: "英語",
    completed: false,
    date: "2026-09-14",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("src/models/stats.ts", () => {
  // -------------------------------------------------------
  describe("calculateTotalSeconds", () => {
    it("sums all durationSeconds properly", () => {
      const sessions = [
        makeSession({ durationSeconds: 1200 }),
        makeSession({ durationSeconds: 1800 }),
        makeSession({ durationSeconds: 600 }),
      ];
      expect(calculateTotalSeconds(sessions)).toBe(3600);
    });

    it("handles empty sessions", () => {
      expect(calculateTotalSeconds([])).toBe(0);
    });

    it("handles null / undefined input safely", () => {
      expect(calculateTotalSeconds(null)).toBe(0);
      expect(calculateTotalSeconds(undefined)).toBe(0);
    });

    it("treats missing durationSeconds as 0", () => {
      const s = makeSession({ durationSeconds: 0 });
      expect(calculateTotalSeconds([s])).toBe(0);
    });
  });

  // -------------------------------------------------------
  describe("calculateGoalProgress", () => {
    const baseGoal: GoalSettings = {
      type: "time",
      taskTargetMode: "all",
      taskTargetCount: 5,
      timeTargetMinutes: 60,
    };

    it("calculates time-based goal progress correctly (50%)", () => {
      const sessions = [makeSession({ durationSeconds: 1800 })]; // 30 min
      const progress = calculateGoalProgress({ ...baseGoal, type: "time" }, sessions, []);

      expect(progress.type).toBe("time");
      expect(progress.pct).toBe(50);
      expect(progress.isAchieved).toBe(false);
    });

    it("marks time goal achieved when target is reached or exceeded", () => {
      const sessions = [makeSession({ durationSeconds: 4000 })];
      const progress = calculateGoalProgress({ ...baseGoal, type: "time" }, sessions, []);

      expect(progress.isAchieved).toBe(true);
      expect(progress.pct).toBe(111);
    });

    it("clamps timeTargetMinutes to minimum 1 (edge case 0 minutes)", () => {
      const sessions = [makeSession({ durationSeconds: 60 })];
      const progress = calculateGoalProgress(
        { ...baseGoal, type: "time", timeTargetMinutes: 0 },
        sessions,
        [],
      );
      // 0 → clamped to 1 min = 60s. 60s / 60s = 100%
      expect(progress.pct).toBe(100);
      expect(progress.isAchieved).toBe(true);
    });

    it("calculates tasks-based goal (all) correctly", () => {
      const todos = [
        makeTodo({ completed: true }),
        makeTodo({ id: "t2", completed: true }),
        makeTodo({ id: "t3", completed: false }),
      ];
      const progress = calculateGoalProgress(
        { ...baseGoal, type: "tasks", taskTargetMode: "all" },
        [],
        todos,
      );

      expect(progress.type).toBe("tasks_all");
      expect(progress.pct).toBe(67);
      expect(progress.isAchieved).toBe(false);
    });

    it("marks all tasks goal achieved when 100% complete", () => {
      const todos = [makeTodo({ completed: true }), makeTodo({ id: "t2", completed: true })];
      const progress = calculateGoalProgress(
        { ...baseGoal, type: "tasks", taskTargetMode: "all" },
        [],
        todos,
      );

      expect(progress.pct).toBe(100);
      expect(progress.isAchieved).toBe(true);
    });

    it("returns 0% when task list is empty (all mode)", () => {
      const progress = calculateGoalProgress(
        { ...baseGoal, type: "tasks", taskTargetMode: "all" },
        [],
        [],
      );
      expect(progress.pct).toBe(0);
      expect(progress.isAchieved).toBe(false);
    });

    it("calculates custom count tasks goal correctly", () => {
      const todos = [
        makeTodo({ completed: true }),
        makeTodo({ id: "t2", completed: true }),
        makeTodo({ id: "t3", completed: false }),
      ];
      const progress = calculateGoalProgress(
        { ...baseGoal, type: "tasks", taskTargetMode: "custom", taskTargetCount: 3 },
        [],
        todos,
      );

      expect(progress.type).toBe("tasks_custom");
      expect(progress.pct).toBe(67);
      expect(progress.isAchieved).toBe(false);
    });
  });

  // -------------------------------------------------------
  describe("aggregateSessionsBySubject", () => {
    it("groups and sorts sessions by subject descending", () => {
      const sessions = [
        makeSession({ subject: "英語", durationSeconds: 3600 }),
        makeSession({ id: "s2", subject: "数学", durationSeconds: 7200 }),
        makeSession({ id: "s3", subject: "英語", durationSeconds: 1800 }),
      ];
      const result = aggregateSessionsBySubject(sessions);

      expect(result).toHaveLength(2);
      expect(result[0]?.subject).toBe("数学");
      expect(result[0]?.seconds).toBe(7200);
      expect(result[0]?.percentage).toBe(57);
      expect(result[1]?.subject).toBe("英語");
      expect(result[1]?.seconds).toBe(5400);
      expect(result[1]?.percentage).toBe(43);
    });

    it("returns empty array for empty or null sessions", () => {
      expect(aggregateSessionsBySubject([])).toEqual([]);
      expect(aggregateSessionsBySubject(null)).toEqual([]);
    });

    it("filters out sessions with durationSeconds=0", () => {
      const sessions = [
        makeSession({ subject: "英語", durationSeconds: 0 }),
        makeSession({ id: "s2", subject: "数学", durationSeconds: 1800 }),
      ];
      const result = aggregateSessionsBySubject(sessions);

      // 英語 is filtered (0 secs), only 数学 remains
      expect(result).toHaveLength(1);
      expect(result[0]?.subject).toBe("数学");
    });
  });

  // -------------------------------------------------------
  describe("getWeeklyChartData", () => {
    it("aggregates sessions per day for the last 7 days", () => {
      const baseDate = "2026-09-14";
      const sessions = [
        makeSession({ date: "2026-09-14", durationSeconds: 3600 }), // 60 min
        makeSession({ id: "s2", date: "2026-09-13", durationSeconds: 1800 }), // 30 min
      ];
      const chartData = getWeeklyChartData(sessions, baseDate);

      expect(chartData).toHaveLength(7);
      expect(chartData[6]?.date).toBe("2026-09-14");
      expect(chartData[6]?.minutes).toBe(60);
      expect(chartData[5]?.date).toBe("2026-09-13");
      expect(chartData[5]?.minutes).toBe(30);
      expect(chartData[0]?.minutes).toBe(0);
    });

    it("uses today when baseDateStr is undefined", () => {
      const chartData = getWeeklyChartData([], undefined);
      expect(chartData).toHaveLength(7);
    });
  });
});
