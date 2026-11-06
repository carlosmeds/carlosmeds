/**
 * Calendar-date helpers.
 *
 * GitHub's contribution calendar returns plain calendar dates ("YYYY-MM-DD") with no
 * time zone attached. We keep them as opaque calendar dates and do all arithmetic in
 * UTC so DST changes or the host time zone can never shift a day. The configured
 * time zone is only used to decide which calendar date is "today".
 */

export type IsoDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export function parseIsoDate(value: IsoDate): Date {
  const match = ISO_DATE.exec(value);
  if (!match) throw new Error(`Invalid date "${value}", expected YYYY-MM-DD`);
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (toIsoDate(date) !== value) throw new Error(`Invalid calendar date "${value}"`);
  return date;
}

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string") return false;
  try {
    parseIsoDate(value);
    return true;
  } catch {
    return false;
  }
}

export function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(value: IsoDate, days: number): IsoDate {
  return toIsoDate(new Date(parseIsoDate(value).getTime() + days * DAY_MS));
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(value: IsoDate): number {
  return parseIsoDate(value).getUTCDay();
}

export function isWeekend(value: IsoDate): boolean {
  const dow = dayOfWeek(value);
  return dow === 0 || dow === 6;
}

export function yearOf(value: IsoDate): number {
  return parseIsoDate(value).getUTCFullYear();
}

export function maxDate(a: IsoDate, b: IsoDate): IsoDate {
  return a >= b ? a : b;
}

export function assertTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
  } catch {
    throw new Error(`Invalid time zone "${timeZone}" (use an IANA name such as America/Sao_Paulo)`);
  }
}

/** Calendar date of `now` in the given IANA time zone. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): IsoDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
