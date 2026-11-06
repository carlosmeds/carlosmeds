import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config.js";
import { generateCards } from "../src/generate.js";
import { SAMPLE_TODAY, sampleContributionDays } from "../src/sample.js";

describe("snapshot data", () => {
  it("reproduces the reference numbers", () => {
    const config = parseConfig({ username: "carlosmeds" });
    const { card, stats } = generateCards(sampleContributionDays(), config, SAMPLE_TODAY);
    expect(card).toEqual({
      total: "9,966",
      totalRange: "Sep 2018 – Present",
      current: "6",
      currentRange: "Nov 1 – Nov 6",
      longest: "35",
      longestRange: "Sep 2024 – Oct 2024",
      activeDays: "1,304",
      average: "7.6",
    });
    expect(stats.firstContributionDate?.startsWith("2018-09")).toBe(true);
  });

  it("refuses to publish an all-zero card unless allowed", () => {
    const empty = [{ date: "2026-11-06", count: 0 }];
    expect(() => generateCards(empty, parseConfig({ username: "x" }), "2026-11-06")).toThrow(/Refusing/);
    expect(() => generateCards(empty, parseConfig({ username: "x", allowEmpty: true }), "2026-11-06")).not.toThrow();
  });
});

describe("config", () => {
  it("applies defaults and env overrides", () => {
    const c = parseConfig({ username: "carlosmeds" }, { STATS_EXCLUDE_WEEKENDS: "true", STATS_USERNAME: "octocat" });
    expect(c.username).toBe("octocat");
    expect(c.timezone).toBe("America/Sao_Paulo");
    expect(c.excludeWeekends).toBe(true);
    expect(c.themes.dark.background).toBe("#0d1117");
  });

  it("propagates the accent colour and per-theme overrides", () => {
    const c = parseConfig({ username: "a", accent: "#FF0000", themes: { dark: { muted: "#aaaaaa" } } });
    expect(c.themes.light.accent).toBe("#ff0000");
    expect(c.themes.dark.accent).toBe("#ff0000");
    expect(c.themes.dark.muted).toBe("#aaaaaa");
  });

  it("rejects unsafe or invalid values", () => {
    expect(() => parseConfig({ username: "bad user" })).toThrow(/username/);
    expect(() => parseConfig({ username: "a", accent: 'red" onload="x' })).toThrow(/hex/);
    expect(() => parseConfig({ username: "a", timezone: "Nowhere/City" })).toThrow(/time zone/);
    expect(() => parseConfig({ username: "a", themes: { dark: { glow: "#fff" } } })).toThrow(/Unknown/);
    expect(() => parseConfig({ username: "a", excludeWeekends: "yes" })).toThrow(/true or false/);
  });
});
