import { describe, it, expect, afterEach, vi } from "vitest";
import {
  detectSystemLanguage,
  resolveLanguage,
  t,
  MESSAGES,
} from "../../src/utils/i18n.js";

describe("src/utils/i18n.ts", () => {
  describe("detectSystemLanguage", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("returns 'ja' when navigator.language starts with ja (e.g. ja-JP)", () => {
      vi.stubGlobal("navigator", { language: "ja-JP" });
      expect(detectSystemLanguage()).toBe("ja");
    });

    it("returns 'ja' for lowercase or mixed case 'JA'", () => {
      vi.stubGlobal("navigator", { language: "JA" });
      expect(detectSystemLanguage()).toBe("ja");
    });

    it("returns 'en' for English locales (e.g. en-US)", () => {
      vi.stubGlobal("navigator", { language: "en-US" });
      expect(detectSystemLanguage()).toBe("en");
    });

    it("returns 'en' for other non-Japanese locales (e.g. fr-FR, zh-CN, de)", () => {
      vi.stubGlobal("navigator", { language: "zh-CN" });
      expect(detectSystemLanguage()).toBe("en");
    });
  });

  describe("resolveLanguage", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("returns 'ja' when pref is 'ja'", () => {
      expect(resolveLanguage("ja")).toBe("ja");
    });

    it("returns 'en' when pref is 'en'", () => {
      expect(resolveLanguage("en")).toBe("en");
    });

    it("falls back to system detection when pref is 'auto'", () => {
      vi.stubGlobal("navigator", { language: "en-GB" });
      expect(resolveLanguage("auto")).toBe("en");

      vi.stubGlobal("navigator", { language: "ja-JP" });
      expect(resolveLanguage("auto")).toBe("ja");
    });
  });

  describe("t (translation function)", () => {
    it("returns Japanese message by default or when lang='ja'", () => {
      expect(t("appName", {}, "ja")).toBe("StudyFlow");
      expect(t("brandSubtitle", {}, "ja")).toBe("受験・学習サポーター");
      expect(t("timerCardTitle", {}, "ja")).toBe("⏱️ 学習タイマー");
    });

    it("returns English message when lang='en'", () => {
      expect(t("brandSubtitle", {}, "en")).toBe("Study & Exam Tracker");
      expect(t("timerCardTitle", {}, "en")).toBe("⏱️ Study Timer");
      expect(t("startTimer", {}, "en")).toBe("Start Timer");
    });

    it("substitutes parameters into message templates", () => {
      expect(t("toastSubjectAdded", { name: "World History" }, "en")).toBe(
        'Subject "World History" added successfully!',
      );
      expect(t("toastSubjectAdded", { name: "日本史" }, "ja")).toBe(
        "科目「日本史」を追加しました！",
      );
      expect(t("dayAchievementRate", { rate: 85 }, "en")).toBe("Completion Rate: 85%");
      expect(t("dayAchievementRate", { rate: 85 }, "ja")).toBe("達成率 85%");
    });

    it("falls back gracefully when given unknown key", () => {
      // @ts-expect-error Testing invalid key runtime behavior
      expect(t("nonExistentKey", {}, "en")).toBe("nonExistentKey");
    });
  });

  describe("dictionary completeness", () => {
    it("ensures Japanese and English dictionaries have identical keys", () => {
      const jaKeys = Object.keys(MESSAGES.ja).sort();
      const enKeys = Object.keys(MESSAGES.en).sort();
      expect(jaKeys).toEqual(enKeys);
    });
  });
});
