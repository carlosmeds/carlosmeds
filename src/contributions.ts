import { isIsoDate, type IsoDate } from "./dates.js";

export interface ContributionDay {
  date: IsoDate;
  count: number;
}

/**
 * Merges day lists from several (possibly overlapping) API windows into a single,
 * chronologically sorted list with one entry per date.
 *
 * The same date can legitimately appear twice when windows overlap; GitHub returns the
 * same count for it, so duplicates are collapsed. A conflicting count for the same date
 * means something is off, so we fail instead of guessing.
 */
export function mergeContributionDays(chunks: readonly (readonly ContributionDay[])[]): ContributionDay[] {
  const byDate = new Map<IsoDate, number>();
  for (const chunk of chunks) {
    for (const day of chunk) {
      if (!isIsoDate(day.date)) throw new Error(`Invalid contribution date "${String(day.date)}"`);
      if (!Number.isInteger(day.count) || day.count < 0) {
        throw new Error(`Invalid contribution count ${String(day.count)} on ${day.date}`);
      }
      const previous = byDate.get(day.date);
      if (previous !== undefined && previous !== day.count) {
        throw new Error(`Conflicting counts for ${day.date}: ${previous} vs ${day.count}`);
      }
      byDate.set(day.date, day.count);
    }
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, count]) => ({ date, count }));
}
