import { describe, it, expect, beforeEach } from "vitest";
import { safeJsonParse, loadAllData, saveStorageItem } from "../../src/models/storage.js";
import { DEFAULT_SUBJECTS } from "../../src/constants/defaults.js";
import type { Todo } from "../../src/types/index.js";

// Minimal in-memory Storage mock
function createMockStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k in store) delete store[k];
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  } as Storage;
}

describe("src/models/storage.ts", () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockStorage();
  });

  // -------------------------------------------------------
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

    it("returns typed fallback (generic type is preserved)", () => {
      const result = safeJsonParse<string[]>('["a","b"]', []);
      expect(result).toEqual(["a", "b"]);
    });
  });

  // -------------------------------------------------------
  describe("loadAllData", () => {
    it("returns default values when storage is empty", () => {
      const data = loadAllData(mockStorage);
      expect(data.todos).toEqual([]);
      expect(data.sessions).toEqual([]);
      expect(data.subjects).toEqual(DEFAULT_SUBJECTS);
      expect(data.goalSettings.type).toBe("tasks");
      expect(data.pomodoroSettings.workMinutes).toBe(25);
      expect(data.theme).toBe("auto");
      expect(data.language).toBe("auto");
    });

    it("returns defaults when storage is null (e.g. SSR)", () => {
      const data = loadAllData(null);
      expect(data.todos).toEqual([]);
      expect(data.theme).toBe("auto");
      expect(data.language).toBe("auto");
    });

    it("loads saved todos from storage correctly", () => {
      const todo: Todo = {
        id: "t1",
        title: "Test TODO",
        subject: "英語",
        completed: false,
        date: "2026-09-14",
        createdAt: new Date().toISOString(),
      };
      saveStorageItem("studyflow_todos", [todo], mockStorage);
      const data = loadAllData(mockStorage);
      expect(data.todos).toHaveLength(1);
      expect(data.todos[0]?.title).toBe("Test TODO");
    });

    it("validates theme to be 'auto' | 'dark' | 'light'", () => {
      mockStorage.setItem("studyflow_theme", "invalid_theme");
      const data = loadAllData(mockStorage);
      expect(data.theme).toBe("auto"); // falls back to auto
    });

    it("correctly loads 'dark' theme from storage", () => {
      mockStorage.setItem("studyflow_theme", "dark");
      const data = loadAllData(mockStorage);
      expect(data.theme).toBe("dark");
    });

    it("validates language to be 'auto' | 'ja' | 'en'", () => {
      mockStorage.setItem("studyflow_language", "invalid_lang");
      const data = loadAllData(mockStorage);
      expect(data.language).toBe("auto");
    });

    it("correctly loads 'en' and 'ja' language from storage", () => {
      mockStorage.setItem("studyflow_language", "en");
      expect(loadAllData(mockStorage).language).toBe("en");
      mockStorage.setItem("studyflow_language", "ja");
      expect(loadAllData(mockStorage).language).toBe("ja");
    });
  });

  // -------------------------------------------------------
  describe("saveStorageItem", () => {
    it("saves object as JSON string", () => {
      saveStorageItem("test_key", { value: 42 }, mockStorage);
      expect(mockStorage.getItem("test_key")).toBe('{"value":42}');
    });

    it("saves string values without double-serializing", () => {
      saveStorageItem("test_key", "hello", mockStorage);
      expect(mockStorage.getItem("test_key")).toBe("hello"); // NOT '"hello"'
    });

    it("saves arrays as JSON", () => {
      saveStorageItem("test_key", [1, 2, 3], mockStorage);
      expect(mockStorage.getItem("test_key")).toBe("[1,2,3]");
    });

    it("does nothing when storage is null", () => {
      // Should not throw
      expect(() => saveStorageItem("test_key", "value", null)).not.toThrow();
    });
  });
});
