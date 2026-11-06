import { parseIsoDate, yearOf, type IsoDate } from "./dates.js";
import type { ContributionStats } from "./stats.js";
import type { Streak } from "./streaks.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export const RANGE_SEPARATOR = " – "; // en dash

const integerFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const oneDecimalFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatNumber(value: number): string {
  return integerFormat.format(value);
}

export function formatAverage(total: number, activeDays: number): string {
  return oneDecimalFormat.format(activeDays === 0 ? 0 : total / activeDays);
}

function parts(date: IsoDate): { month: string; day: number; year: number } {
  const d = parseIsoDate(date);
  return { month: MONTHS[d.getUTCMonth()]!, day: d.getUTCDate(), year: d.getUTCFullYear() };
}

/** "Sep 2018" */
export function formatMonthYear(date: IsoDate): string {
  const p = parts(date);
  return `${p.month} ${p.year}`;
}

/** "Nov 6" or "Nov 6, 2026" */
export function formatMonthDay(date: IsoDate, withYear = false): string {
  const p = parts(date);
  return withYear ? `${p.month} ${p.day}, ${p.year}` : `${p.month} ${p.day}`;
}

/** "Sep 2018 – Present" */
export function formatHistoryRange(firstContribution: IsoDate | null): string {
  return firstContribution ? `${formatMonthYear(firstContribution)}${RANGE_SEPARATOR}Present` : "No contributions yet";
}

/**
 * Current streak, day precision:
 *   same (current) year  -> "Nov 1 – Nov 6"
 *   same past year       -> "Dec 20 – Dec 31, 2026"
 *   crossing years       -> "Dec 30, 2026 – Jan 2, 2027"
 *   single day           -> "Nov 6"
 *   no streak            -> today's date
 */
export function formatCurrentStreakRange(streak: Streak, today: IsoDate): string {
  const currentYear = yearOf(today);
  if (streak.length === 0 || !streak.start || !streak.end) {
    return formatMonthDay(today);
  }
  const startYear = yearOf(streak.start);
  const endYear = yearOf(streak.end);
  if (startYear !== endYear) {
    return `${formatMonthDay(streak.start, true)}${RANGE_SEPARATOR}${formatMonthDay(streak.end, true)}`;
  }
  const showYear = endYear !== currentYear;
  if (streak.start === streak.end) return formatMonthDay(streak.end, showYear);
  return `${formatMonthDay(streak.start)}${RANGE_SEPARATOR}${formatMonthDay(streak.end, showYear)}`;
}

/**
 * Longest streak, month precision:
 *   different months -> "Sep 2024 – Oct 2024"
 *   same month       -> "Sep 2024"
 */
export function formatLongestStreakRange(streak: Streak): string {
  if (streak.length === 0 || !streak.start || !streak.end) return "No streak yet";
  const start = formatMonthYear(streak.start);
  const end = formatMonthYear(streak.end);
  return start === end ? start : `${start}${RANGE_SEPARATOR}${end}`;
}

export interface CardText {
  total: string;
  totalRange: string;
  current: string;
  currentRange: string;
  longest: string;
  longestRange: string;
  activeDays: string;
  average: string;
}

export function toCardText(stats: ContributionStats): CardText {
  return {
    total: formatNumber(stats.totalContributions),
    totalRange: formatHistoryRange(stats.firstContributionDate),
    current: formatNumber(stats.currentStreak.length),
    currentRange: formatCurrentStreakRange(stats.currentStreak, stats.today),
    longest: formatNumber(stats.longestStreak.length),
    longestRange: formatLongestStreakRange(stats.longestStreak),
    activeDays: formatNumber(stats.activeDays),
    average: formatAverage(stats.totalContributions, stats.activeDays),
  };
}
