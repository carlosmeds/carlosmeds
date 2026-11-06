import { addDays, isWeekend, maxDate, type IsoDate } from "./dates.js";
import type { ContributionDay } from "./contributions.js";

export interface Streak {
  length: number;
  start: IsoDate | null;
  end: IsoDate | null;
}

export interface StreakOptions {
  /**
   * When true, Saturdays and Sundays never break a streak.
   * Weekend days WITH contributions still count towards the streak length (you did
   * contribute that day); weekend days WITHOUT contributions are simply skipped.
   */
  excludeWeekends: boolean;
  /** Today's calendar date in the configured time zone. */
  today: IsoDate;
}

export const EMPTY_STREAK: Streak = Object.freeze({ length: 0, start: null, end: null });

function countsByDate(days: readonly ContributionDay[]): Map<IsoDate, number> {
  return new Map(days.map((d) => [d.date, d.count]));
}

function isSkippable(date: IsoDate, options: StreakOptions): boolean {
  return options.excludeWeekends && isWeekend(date);
}

/**
 * Longest run of consecutive contribution days in the whole history.
 * Missing dates count as zero. On ties the most recent streak wins.
 */
export function longestStreak(days: readonly ContributionDay[], options: StreakOptions): Streak {
  if (days.length === 0) return { ...EMPTY_STREAK };
  const counts = countsByDate(days);
  const first = days[0]!.date;
  const last = days[days.length - 1]!.date;

  let best: Streak = { ...EMPTY_STREAK };
  let run: Streak = { ...EMPTY_STREAK };
  for (let date = first; date <= last; date = addDays(date, 1)) {
    const count = counts.get(date) ?? 0;
    if (count > 0) {
      run = { length: run.length + 1, start: run.start ?? date, end: date };
      if (run.length >= best.length) best = run;
    } else if (!isSkippable(date, options)) {
      run = { ...EMPTY_STREAK };
    }
  }
  return best;
}

/**
 * Streak that is still alive today.
 *
 * Today (and any date after it, which can appear because GitHub's calendar may already
 * be on the next UTC day) is not over yet, so a zero there does not break the streak:
 * the streak then ends on the last day with contributions.
 */
export function currentStreak(days: readonly ContributionDay[], options: StreakOptions): Streak {
  if (days.length === 0) return { ...EMPTY_STREAK };
  const counts = countsByDate(days);
  const first = days[0]!.date;
  const last = maxDate(days[days.length - 1]!.date, options.today);

  let length = 0;
  let start: IsoDate | null = null;
  let end: IsoDate | null = null;
  for (let date = last; date >= first; date = addDays(date, -1)) {
    const count = counts.get(date) ?? 0;
    if (count > 0) {
      length += 1;
      start = date;
      end ??= date;
    } else if (date >= options.today || isSkippable(date, options)) {
      continue;
    } else {
      break;
    }
  }
  return length === 0 ? { ...EMPTY_STREAK } : { length, start, end };
}
