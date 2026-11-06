import { addDays, type IsoDate } from "../src/dates.js";
import type { ContributionDay } from "../src/contributions.js";

/** Builds a continuous day list from `start` to `end`, with counts for the given dates. */
export function daysFrom(start: IsoDate, end: IsoDate, counts: Record<IsoDate, number>): ContributionDay[] {
  const days: ContributionDay[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push({ date: d, count: counts[d] ?? 0 });
  return days;
}

/** Marks every date in [start, end] with `count`. */
export function range(start: IsoDate, end: IsoDate, count = 1): Record<IsoDate, number> {
  const out: Record<IsoDate, number> = {};
  for (let d = start; d <= end; d = addDays(d, 1)) out[d] = count;
  return out;
}
