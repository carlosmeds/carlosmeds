import { mergeContributionDays, type ContributionDay } from "../contributions.js";
import type { Logger } from "../logger.js";
import type { GitHubClient } from "./client.js";

const YEARS_QUERY = /* GraphQL */ `
  query ($login: String!) {
    user(login: $login) {
      createdAt
      contributionsCollection {
        contributionYears
      }
    }
  }
`;

const CALENDAR_QUERY = /* GraphQL */ `
  query ($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        hasAnyRestrictedContributions
        restrictedContributionsCount
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
    rateLimit {
      cost
      remaining
      resetAt
    }
  }
`;

interface YearsResponse {
  user: { createdAt: string; contributionsCollection: { contributionYears: number[] } } | null;
}

interface CalendarResponse {
  user: {
    contributionsCollection: {
      hasAnyRestrictedContributions: boolean;
      restrictedContributionsCount: number;
      contributionCalendar: {
        totalContributions: number;
        weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
      };
    };
  } | null;
  rateLimit: { cost: number; remaining: number; resetAt: string } | null;
}

export interface YearSummary {
  year: number;
  /** GitHub's own total for the window, used to cross-check the day sum. */
  githubTotal: number;
  restricted: number;
  days: number;
}

export interface FetchResult {
  days: ContributionDay[];
  years: YearSummary[];
  /** True when the API reported private ("restricted") contributions in the calendar. */
  includesPrivate: boolean;
}

/**
 * Fetches the full contribution calendar. The API caps a window at one year, so we ask
 * for one calendar year at a time (Jan 1 00:00Z – Dec 31 23:59:59Z, or "now" for the
 * current year), cross-check each window against GitHub's own total and merge.
 */
export async function fetchContributionDays(
  client: GitHubClient,
  login: string,
  logger: Logger,
  now: Date = new Date(),
): Promise<FetchResult> {
  const meta = await client.graphql<YearsResponse>(YEARS_QUERY, { login });
  if (!meta.user) throw new Error(`GitHub user "${login}" not found`);

  const years = meta.user.contributionsCollection.contributionYears;
  const currentYear = now.getUTCFullYear();
  const createdYear = new Date(meta.user.createdAt).getUTCFullYear();
  const firstYear = years.length ? Math.min(...years) : Math.min(createdYear, currentYear);
  logger.info(`User ${login}: account created ${meta.user.createdAt.slice(0, 10)}, contribution years ${years.join(", ") || "none"}`);

  const chunks: ContributionDay[][] = [];
  const summaries: YearSummary[] = [];
  let includesPrivate = false;

  for (let year = firstYear; year <= currentYear; year++) {
    const from = `${year}-01-01T00:00:00Z`;
    const to = year === currentYear ? now.toISOString() : `${year}-12-31T23:59:59Z`;
    const data = await client.graphql<CalendarResponse>(CALENDAR_QUERY, { login, from, to });
    if (!data.user) throw new Error(`GitHub user "${login}" disappeared while fetching ${year}`);

    const collection = data.user.contributionsCollection;
    const calendar = collection.contributionCalendar;
    const days = calendar.weeks
      .flatMap((w) => w.contributionDays)
      .map((d) => ({ date: d.date, count: d.contributionCount }));
    const inYear = days.filter((d) => d.date.startsWith(`${year}-`));
    const sum = inYear.reduce((acc, d) => acc + d.count, 0);
    if (sum !== calendar.totalContributions) {
      throw new Error(
        `Validation failed for ${year}: days add up to ${sum} but GitHub reports ${calendar.totalContributions}`,
      );
    }
    includesPrivate ||= collection.restrictedContributionsCount > 0;
    chunks.push(inYear);
    summaries.push({
      year,
      githubTotal: calendar.totalContributions,
      restricted: collection.restrictedContributionsCount,
      days: inYear.length,
    });
    const rl = data.rateLimit;
    logger.info(
      `  ${year}: ${calendar.totalContributions} contributions (${collection.restrictedContributionsCount} private) over ${inYear.length} days` +
        (rl ? ` [rate limit: cost ${rl.cost}, ${rl.remaining} left]` : ""),
    );
  }

  return { days: mergeContributionDays(chunks), years: summaries, includesPrivate };
}
