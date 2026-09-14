import { describe, it, expect, beforeEach } from "vitest";
import { safeJsonParse, loadAllData, saveStorageItem } from "../../src/models/storage.js";
import { DEFAULT_SUBJECTS } from "../../src/constants/defaults.js";

describe("src/models/storage.js", () => {
  let mockStorage;

  beforeEach(() => {
    const store = {};
    mockStorage = {
      getItem: (key) => store[key] || null,
      setItem: (key, value) => {
        store[key] = String(value);
      },
      clear: () => {
        for (const k in store) delete store[k];
      },
    };
  });

  describe("safeJsonParse", () => {
    it("parses valid JSON string", () => {
      expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
    });

    it("returns fallback for invalid JSON string", () => {
      expect(safeJsonParse("invalid-json", { fallback: true })).toEqual({ fallback: true });
    });

    it("returns fallback for null or empty string", () => {
      expect(safeJsonParse(null, [])).toEqual([]);
      expect(safeJsonParse("", [])).toEqual([]);
    });
  });

  describe("loadAllData", () => {
    it("returns default values when storage is empty", () => {
      const data = loadAllData(mockStorage);
      expect(data.todos).toEqual([]);
      expect(data.sessions).toEqual([]);
      expect(data.subjects).toEqual(DEFAULT_SUBJECTS);
      expect(data.goalSettings.type).toBe("tasks");
      expect(data.pomodoroSettings.workMinutes).toBe(25);
    });

    it("loads saved items from storage correctly", () => {
      saveStorageItem("studyflow_todos", [{ id: "t1", title: "Test TODO" }], mockStorage);
      const data = loadAllData(mockStorage);
      expect(data.todos).toHaveLength(1);
      expect(data.todos[0].title).toBe("Test TODO");
    });
  });
});
