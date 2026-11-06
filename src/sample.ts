import { addDays, type IsoDate } from "./dates.js";
import type { ContributionDay } from "./contributions.js";

/**
 * Deterministic synthetic history reproducing the reference snapshot, used for previews
 * and tests only (never published by the workflow):
 *   9,966 contributions · 1,304 active days · 7.6 per active day
 *   history since Sep 2018 · current streak 6 (Nov 1 – Nov 6, 2026)
 *   longest streak 35 (Sep 2024 – Oct 2024)
 */
export const SAMPLE_TODAY: IsoDate = "2026-11-06";

export function sampleContributionDays(): ContributionDay[] {
  const start = "2018-09-29";
  const longestStart = "2024-09-20";
  const longestEnd = addDays(longestStart, 34); // 2024-10-24
  const currentStart = "2026-11-01";
  const targetActive = 1304;
  const targetTotal = 9966;

  const active = new Set<IsoDate>();
  for (let d = longestStart; d <= longestEnd; d = addDays(d, 1)) active.add(d);
  for (let d = currentStart; d <= SAMPLE_TODAY; d = addDays(d, 1)) active.add(d);

  // Fill the rest with short bursts (4 on / 5 off) so no other run gets close to 35,
  // keeping a one-day gap around the two fixed streaks.
  let i = 0;
  for (let d = start; active.size < targetActive; d = addDays(d, 1), i++) {
    const nearLongest = d >= addDays(longestStart, -1) && d <= addDays(longestEnd, 1);
    if (d >= addDays(currentStart, -1)) throw new Error("sample generator ran out of days");
    if (!nearLongest && i % 9 < 4) active.add(d);
  }

  const dates = [...active].sort();
  let extra = targetTotal - dates.length * 7;
  const counts = new Map<IsoDate, number>(dates.map((d) => [d, 7]));
  for (let k = 0; extra > 0; k = (k + 13) % dates.length, extra--) {
    counts.set(dates[k]!, counts.get(dates[k]!)! + 1);
  }

  const days: ContributionDay[] = [];
  for (let d = "2018-01-01"; d <= SAMPLE_TODAY; d = addDays(d, 1)) days.push({ date: d, count: counts.get(d) ?? 0 });
  return days;
}
