import { describe, expect, it } from "vitest";
import {
  formatAverage,
  formatCurrentStreakRange,
  formatHistoryRange,
  formatLongestStreakRange,
  formatNumber,
} from "../src/format.js";

const streak = (start: string, end: string, length = 2) => ({ length, start, end });

describe("number formatting", () => {
  it("uses thousands separators", () => {
    expect(formatNumber(9966)).toBe("9,966");
    expect(formatNumber(1304)).toBe("1,304");
    expect(formatNumber(35)).toBe("35");
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it("formats the average with exactly one decimal", () => {
    expect(formatAverage(9966, 1304)).toBe("7.6");
    expect(formatAverage(10, 5)).toBe("2.0");
    expect(formatAverage(0, 0)).toBe("0.0");
    expect(formatAverage(12_345, 10)).toBe("1,234.5");
  });
});

describe("date ranges", () => {
  it("formats the history range", () => {
    expect(formatHistoryRange("2018-09-29")).toBe("Sep 2018 – Present");
    expect(formatHistoryRange(null)).toBe("No contributions yet");
  });

  it("formats the current streak within the current year", () => {
    expect(formatCurrentStreakRange(streak("2026-11-01", "2026-11-06", 6), "2026-11-06")).toBe("Nov 1 – Nov 6");
  });

  it("shows both years when the current streak crosses a year", () => {
    expect(formatCurrentStreakRange(streak("2026-12-30", "2027-01-02", 4), "2027-01-02")).toBe("Dec 30, 2026 – Jan 2, 2027");
  });

  it("shows the year once when the streak ended last year", () => {
    expect(formatCurrentStreakRange(streak("2026-12-20", "2026-12-31", 12), "2027-01-01")).toBe("Dec 20 – Dec 31, 2026");
  });

  it("collapses single-day streaks and shows today when there is none", () => {
    expect(formatCurrentStreakRange(streak("2026-11-06", "2026-11-06", 1), "2026-11-06")).toBe("Nov 6");
    expect(formatCurrentStreakRange({ length: 0, start: null, end: null }, "2026-11-06")).toBe("Nov 6");
  });

  it("formats the longest streak compactly", () => {
    expect(formatLongestStreakRange(streak("2024-09-20", "2024-10-24", 35))).toBe("Sep 2024 – Oct 2024");
    expect(formatLongestStreakRange(streak("2024-12-20", "2025-01-10", 22))).toBe("Dec 2024 – Jan 2025");
    expect(formatLongestStreakRange(streak("2024-09-02", "2024-09-20", 19))).toBe("Sep 2024");
    expect(formatLongestStreakRange({ length: 0, start: null, end: null })).toBe("No streak yet");
  });
});
