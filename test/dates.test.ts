import { describe, expect, it } from "vitest";
import { addDays, assertTimeZone, dayOfWeek, isWeekend, parseIsoDate, todayInTimeZone } from "../src/dates.js";

describe("dates", () => {
  it("adds days across months, years and leap days", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2024-02-29", 1)).toBe("2024-03-01");
    expect(addDays("2023-02-28", 1)).toBe("2023-03-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("is not affected by DST transitions", () => {
    // Brazil used DST until 2019; the US switches in March/November.
    expect(addDays("2018-11-03", 1)).toBe("2018-11-04");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
  });

  it("rejects invalid dates", () => {
    expect(() => parseIsoDate("2023-02-29")).toThrow();
    expect(() => parseIsoDate("2026-13-01")).toThrow();
    expect(() => parseIsoDate("06/11/2026")).toThrow();
  });

  it("knows weekdays", () => {
    expect(dayOfWeek("2026-11-06")).toBe(5); // Friday
    expect(isWeekend("2026-11-07")).toBe(true);
    expect(isWeekend("2026-11-08")).toBe(true);
    expect(isWeekend("2026-11-09")).toBe(false);
  });

  it("computes today in the configured time zone", () => {
    const lateEvening = new Date("2026-11-07T02:30:00Z"); // 23:30 on Nov 6 in São Paulo
    expect(todayInTimeZone("America/Sao_Paulo", lateEvening)).toBe("2026-11-06");
    expect(todayInTimeZone("UTC", lateEvening)).toBe("2026-11-07");
    expect(todayInTimeZone("Asia/Tokyo", new Date("2026-12-31T16:00:00Z"))).toBe("2027-01-01");
  });

  it("validates time zones", () => {
    expect(() => assertTimeZone("America/Sao_Paulo")).not.toThrow();
    expect(() => assertTimeZone("Mars/Base")).toThrow(/Invalid time zone/);
  });
});
