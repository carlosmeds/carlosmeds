import { describe, expect, it } from "vitest";
import { currentStreak, longestStreak } from "../src/streaks.js";
import { computeStats } from "../src/stats.js";
import { daysFrom, range } from "./helpers.js";

const daily = { excludeWeekends: false };
const weekdays = { excludeWeekends: true };

describe("current streak", () => {
  it("is zero for an empty history", () => {
    expect(currentStreak([], { ...daily, today: "2026-11-06" })).toEqual({ length: 0, start: null, end: null });
    expect(longestStreak([], { ...daily, today: "2026-11-06" })).toEqual({ length: 0, start: null, end: null });
  });

  it("is zero when there are no contributions at all", () => {
    const days = daysFrom("2026-01-01", "2026-11-06", {});
    const stats = computeStats(days, { ...daily, today: "2026-11-06" });
    expect(stats.totalContributions).toBe(0);
    expect(stats.activeDays).toBe(0);
    expect(stats.contributionsPerActiveDay).toBe(0);
    expect(stats.firstContributionDate).toBeNull();
    expect(stats.currentStreak.length).toBe(0);
    expect(stats.longestStreak.length).toBe(0);
  });

  it("includes today when today has contributions", () => {
    const days = daysFrom("2026-10-01", "2026-11-06", range("2026-11-01", "2026-11-06"));
    expect(currentStreak(days, { ...daily, today: "2026-11-06" })).toEqual({ length: 6, start: "2026-11-01", end: "2026-11-06" });
  });

  it("does not break because today has no contributions yet", () => {
    const days = daysFrom("2026-10-01", "2026-11-06", range("2026-11-01", "2026-11-05"));
    expect(currentStreak(days, { ...daily, today: "2026-11-06" })).toEqual({ length: 5, start: "2026-11-01", end: "2026-11-05" });
  });

  it("breaks when yesterday had no contributions", () => {
    const days = daysFrom("2026-10-01", "2026-11-06", range("2026-11-01", "2026-11-04"));
    expect(currentStreak(days, { ...daily, today: "2026-11-06" }).length).toBe(0);
  });

  it("treats dates missing from the calendar as zero", () => {
    const days = [
      { date: "2026-11-03", count: 1 },
      { date: "2026-11-05", count: 1 },
    ];
    expect(currentStreak(days, { ...daily, today: "2026-11-06" }).length).toBe(1);
  });

  it("ignores a calendar that is already on the next UTC day", () => {
    // 23:00 in São Paulo: GitHub may already return tomorrow (UTC) with zero.
    const days = daysFrom("2026-11-01", "2026-11-07", range("2026-11-01", "2026-11-06"));
    expect(currentStreak(days, { ...daily, today: "2026-11-06" }).length).toBe(6);
  });

  it("crosses months and years", () => {
    const days = daysFrom("2026-12-01", "2027-01-02", range("2026-12-30", "2027-01-02"));
    expect(currentStreak(days, { ...daily, today: "2027-01-02" })).toEqual({ length: 4, start: "2026-12-30", end: "2027-01-02" });
  });

  it("handles leap days", () => {
    const days = daysFrom("2024-02-01", "2024-03-02", range("2024-02-27", "2024-03-02"));
    expect(currentStreak(days, { ...daily, today: "2024-03-02" }).length).toBe(5);
    const nonLeap = daysFrom("2023-02-01", "2023-03-02", range("2023-02-27", "2023-03-02"));
    expect(currentStreak(nonLeap, { ...daily, today: "2023-03-02" }).length).toBe(4);
  });

  it("counts weekends normally when exclude_weekends is false", () => {
    // Fri 2026-11-06, Sat 07 empty, Mon 09
    const days = daysFrom("2026-11-01", "2026-11-09", { "2026-11-06": 1, "2026-11-08": 1, "2026-11-09": 1 });
    expect(currentStreak(days, { ...daily, today: "2026-11-09" }).length).toBe(2);
  });
});

describe("exclude_weekends", () => {
  it("continues from Friday to Monday over an empty weekend", () => {
    const days = daysFrom("2026-11-01", "2026-11-10", { "2026-11-05": 2, "2026-11-06": 1, "2026-11-09": 3, "2026-11-10": 1 });
    expect(currentStreak(days, { ...weekdays, today: "2026-11-10" })).toEqual({ length: 4, start: "2026-11-05", end: "2026-11-10" });
    expect(currentStreak(days, { ...daily, today: "2026-11-10" }).length).toBe(2);
  });

  it("does not break on a single empty weekend day", () => {
    const days = daysFrom("2026-11-05", "2026-11-09", range("2026-11-05", "2026-11-09"));
    days.find((d) => d.date === "2026-11-08")!.count = 0; // Sunday
    expect(currentStreak(days, { ...weekdays, today: "2026-11-09" }).length).toBe(4);
  });

  it("counts weekend contributions towards the length", () => {
    const days = daysFrom("2026-11-05", "2026-11-09", range("2026-11-05", "2026-11-09"));
    expect(currentStreak(days, { ...weekdays, today: "2026-11-09" }).length).toBe(5);
  });

  it("is still alive on Sunday when the last contribution was Friday", () => {
    const days = daysFrom("2026-11-01", "2026-11-08", range("2026-11-04", "2026-11-06"));
    expect(currentStreak(days, { ...weekdays, today: "2026-11-08" })).toEqual({ length: 3, start: "2026-11-04", end: "2026-11-06" });
    expect(currentStreak(days, { ...daily, today: "2026-11-08" }).length).toBe(0);
  });

  it("still breaks on an empty weekday", () => {
    // Thu 05 empty breaks Wed 04 -> Fri 06
    const days = daysFrom("2026-11-01", "2026-11-09", { "2026-11-04": 1, "2026-11-06": 1, "2026-11-09": 1 });
    expect(currentStreak(days, { ...weekdays, today: "2026-11-09" })).toEqual({ length: 2, start: "2026-11-06", end: "2026-11-09" });
  });

  it("affects only streaks, not totals", () => {
    const days = daysFrom("2026-11-01", "2026-11-10", { "2026-11-06": 4, "2026-11-09": 2 });
    const a = computeStats(days, { ...daily, today: "2026-11-10" });
    const b = computeStats(days, { ...weekdays, today: "2026-11-10" });
    expect([a.totalContributions, a.activeDays, a.contributionsPerActiveDay]).toEqual([6, 2, 3]);
    expect([b.totalContributions, b.activeDays, b.contributionsPerActiveDay]).toEqual([6, 2, 3]);
    expect(a.longestStreak.length).toBe(1);
    expect(b.longestStreak.length).toBe(2);
  });
});

describe("longest streak", () => {
  it("finds the longest run across the whole history", () => {
    const days = daysFrom("2018-09-01", "2026-11-06", {
      ...range("2019-03-01", "2019-03-10"),
      ...range("2024-09-20", "2024-10-24"),
      ...range("2026-11-01", "2026-11-06"),
    });
    expect(longestStreak(days, { ...daily, today: "2026-11-06" })).toEqual({ length: 35, start: "2024-09-20", end: "2024-10-24" });
  });

  it("spans year boundaries and leap days", () => {
    const days = daysFrom("2023-12-01", "2024-03-31", range("2023-12-20", "2024-03-01"));
    const s = longestStreak(days, { ...daily, today: "2024-03-31" });
    expect(s).toEqual({ length: 73, start: "2023-12-20", end: "2024-03-01" });
  });

  it("prefers the most recent run on ties", () => {
    const days = daysFrom("2026-01-01", "2026-01-31", { ...range("2026-01-02", "2026-01-04"), ...range("2026-01-10", "2026-01-12") });
    expect(longestStreak(days, { ...daily, today: "2026-01-31" }).start).toBe("2026-01-10");
  });

  it("includes the current streak when it is the longest", () => {
    const days = daysFrom("2026-10-01", "2026-11-06", range("2026-10-20", "2026-11-05"));
    const today = { ...daily, today: "2026-11-06" };
    expect(longestStreak(days, today)).toEqual(currentStreak(days, today));
  });
});
