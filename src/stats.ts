import type { ContributionDay } from "./contributions.js";
import type { IsoDate } from "./dates.js";
import { currentStreak, longestStreak, type Streak } from "./streaks.js";

export interface ContributionStats {
  totalContributions: number;
  activeDays: number;
  /** Unrounded; formatting rounds to one decimal. */
  contributionsPerActiveDay: number;
  firstContributionDate: IsoDate | null;
  currentStreak: Streak;
  longestStreak: Streak;
  today: IsoDate;
  excludeWeekends: boolean;
}

export interface ComputeOptions {
  today: IsoDate;
  excludeWeekends: boolean;
}

/** `days` must be sorted and unique (see mergeContributionDays). */
export function computeStats(days: readonly ContributionDay[], options: ComputeOptions): ContributionStats {
  const active = days.filter((d) => d.count > 0);
  const totalContributions = active.reduce((sum, d) => sum + d.count, 0);
  const activeDays = active.length;
  return {
    totalContributions,
    activeDays,
    contributionsPerActiveDay: activeDays === 0 ? 0 : totalContributions / activeDays,
    firstContributionDate: active[0]?.date ?? null,
    currentStreak: currentStreak(days, options),
    longestStreak: longestStreak(days, options),
    today: options.today,
    excludeWeekends: options.excludeWeekends,
  };
}
