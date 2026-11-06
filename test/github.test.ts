import { describe, expect, it, vi } from "vitest";
import { GitHubApiError, GitHubClient, redact } from "../src/github/client.js";
import { fetchContributionDays } from "../src/github/contributions.js";
import type { Logger } from "../src/logger.js";

const TOKEN = "ghp_abcdefghijklmnopqrstuvwxyz0123456789";

function recordingLogger(): Logger & { lines: string[] } {
  const lines: string[] = [];
  return { lines, info: (m) => lines.push(m), warn: (m) => lines.push(m) };
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

function calendar(days: [string, number][], restricted = 0) {
  return {
    user: {
      contributionsCollection: {
        hasAnyRestrictedContributions: restricted > 0,
        restrictedContributionsCount: restricted,
        contributionCalendar: {
          totalContributions: days.reduce((s, [, c]) => s + c, 0),
          weeks: [{ contributionDays: days.map(([date, contributionCount]) => ({ date, contributionCount })) }],
        },
      },
    },
    rateLimit: { cost: 1, remaining: 4999, resetAt: "2026-11-06T12:00:00Z" },
  };
}

function client(fetchImpl: typeof fetch, logger: Logger = recordingLogger()) {
  return new GitHubClient({ token: TOKEN, logger, fetch: fetchImpl, sleep: async () => {} });
}

describe("fetchContributionDays", () => {
  it("queries one window per year, merges overlaps and keeps every day once", async () => {
    const calls: { from: string; to: string }[] = [];
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const { variables } = JSON.parse(String(init?.body)) as { variables: { from?: string; to?: string } };
      if (!variables.from) {
        return json({ data: { user: { createdAt: "2024-09-29T05:13:44Z", contributionsCollection: { contributionYears: [2026, 2025, 2024] } } } });
      }
      calls.push({ from: variables.from, to: variables.to! });
      const year = variables.from.slice(0, 4);
      if (year === "2024") return json({ data: calendar([["2024-12-31", 3], ["2025-01-01", 9]]) }); // padded week
      if (year === "2025") return json({ data: calendar([["2025-01-01", 9], ["2025-06-01", 1]], 1) });
      return json({ data: calendar([["2026-11-06", 2]]) });
    }) as unknown as typeof fetch;

    // Day sums for 2024 include a day outside the year -> must be cross-checked after filtering.
    await expect(
      fetchContributionDays(client(fetchImpl), "carlosmeds", recordingLogger(), new Date("2026-11-06T12:00:00Z")),
    ).rejects.toThrow(/Validation failed for 2024/);
  });

  it("returns merged days and validates per-year totals", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const { variables } = JSON.parse(String(init?.body)) as { variables: { from?: string; to?: string } };
      if (!variables.from) {
        return json({ data: { user: { createdAt: "2025-03-01T00:00:00Z", contributionsCollection: { contributionYears: [2026, 2025] } } } });
      }
      if (variables.from.startsWith("2025")) {
        expect(variables.to).toBe("2025-12-31T23:59:59Z");
        return json({ data: calendar([["2025-12-30", 1], ["2025-12-31", 2]], 2) });
      }
      expect(variables.to).toBe("2026-11-06T12:00:00.000Z");
      return json({ data: calendar([["2026-01-01", 4], ["2026-01-02", 0]]) });
    }) as unknown as typeof fetch;

    const logger = recordingLogger();
    const result = await fetchContributionDays(client(fetchImpl), "carlosmeds", logger, new Date("2026-11-06T12:00:00Z"));
    expect(result.days).toEqual([
      { date: "2025-12-30", count: 1 },
      { date: "2025-12-31", count: 2 },
      { date: "2026-01-01", count: 4 },
      { date: "2026-01-02", count: 0 },
    ]);
    expect(result.includesPrivate).toBe(true);
    expect(result.years.map((y) => y.githubTotal)).toEqual([3, 4]);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(logger.lines.join("\n")).not.toContain(TOKEN);
  });

  it("fails clearly when the user does not exist", async () => {
    const fetchImpl = (async () => json({ data: { user: null } })) as unknown as typeof fetch;
    await expect(fetchContributionDays(client(fetchImpl), "nobody", recordingLogger())).rejects.toThrow(/not found/);
  });
});

describe("GitHubClient", () => {
  it("does not retry auth failures and never leaks the token", async () => {
    const fetchImpl = vi.fn(async () => json({ message: "Bad credentials" }, 401)) as unknown as typeof fetch;
    const error = await client(fetchImpl).graphql("{ viewer { login } }").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GitHubApiError);
    expect((error as Error).message).toMatch(/401/);
    expect((error as Error).message).not.toContain(TOKEN);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries server errors and succeeds", async () => {
    const responses = [json({}, 502), json({}, 503), json({ data: { ok: true } })];
    const fetchImpl = vi.fn(async () => responses.shift()!) as unknown as typeof fetch;
    const logger = recordingLogger();
    await expect(client(fetchImpl, logger).graphql("{}")).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(logger.lines.some((l) => l.includes("retrying"))).toBe(true);
  });

  it("waits for rate limits using Retry-After", async () => {
    const sleep = vi.fn(async () => {});
    const responses = [json({}, 403, { "retry-after": "7" }), json({ data: { ok: 1 } })];
    const c = new GitHubClient({ token: TOKEN, logger: recordingLogger(), fetch: (async () => responses.shift()!) as unknown as typeof fetch, sleep });
    await expect(c.graphql("{}")).resolves.toEqual({ ok: 1 });
    expect(sleep).toHaveBeenCalledWith(7000);
  });

  it("gives up when the rate limit resets too far in the future", async () => {
    const reset = String(Math.floor(Date.now() / 1000) + 3600);
    const fetchImpl = (async () => json({}, 403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": reset })) as unknown as typeof fetch;
    await expect(client(fetchImpl).graphql("{}")).rejects.toThrow(/rate limit/);
  });

  it("retries GraphQL RATE_LIMITED errors and surfaces other GraphQL errors", async () => {
    const responses = [json({ errors: [{ type: "RATE_LIMITED", message: "slow down" }] }), json({ data: { ok: 2 } })];
    await expect(client((async () => responses.shift()!) as unknown as typeof fetch).graphql("{}")).resolves.toEqual({ ok: 2 });
    const bad = (async () => json({ errors: [{ message: "Field 'x' doesn't exist" }] })) as unknown as typeof fetch;
    await expect(client(bad).graphql("{}")).rejects.toThrow(/Field 'x'/);
  });

  it("redacts tokens", () => {
    expect(redact(`token ${TOKEN} here`)).toBe("token *** here");
    expect(redact("x github_pat_11ABCDEFG0123456789_abcdefghijklmnop y")).toBe("x *** y");
    expect(redact("secret=abc", "abc")).toBe("secret=***");
  });
});
