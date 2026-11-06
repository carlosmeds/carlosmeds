import type { Logger } from "../logger.js";

export class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export interface ClientOptions {
  token: string;
  logger: Logger;
  endpoint?: string;
  fetch?: typeof fetch;
  maxAttempts?: number;
  /** Longest single wait we accept for a rate limit reset before giving up. */
  maxWaitMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: { type?: string; message: string }[];
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Removes anything that looks like a credential from text that may end up in logs. */
export function redact(text: string, token?: string): string {
  let out = text;
  if (token) out = out.split(token).join("***");
  return out.replace(/\b(gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, "***");
}

export class GitHubClient {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxAttempts: number;
  private readonly maxWaitMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  private readonly options: ClientOptions;

  constructor(options: ClientOptions) {
    // Secrets pasted into the UI often carry a trailing newline, which is not a valid header value.
    const token = options.token.trim();
    if (!token) throw new GitHubApiError("Missing GitHub token");
    if (/\s/.test(token)) throw new GitHubApiError("GitHub token contains whitespace; check the secret value");
    this.options = { ...options, token };
    this.endpoint = options.endpoint ?? "https://api.github.com/graphql";
    this.fetchImpl = options.fetch ?? fetch;
    this.maxAttempts = options.maxAttempts ?? 4;
    this.maxWaitMs = options.maxWaitMs ?? 5 * 60_000;
    this.sleep = options.sleep ?? defaultSleep;
  }

  async graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await this.once<T>(query, variables);
      } catch (error) {
        lastError = error;
        const retryable = error instanceof GitHubApiError ? error.retryable : true; // network errors
        if (!retryable || attempt === this.maxAttempts) break;
        const wait = error instanceof RetryAfter ? error.waitMs : Math.min(1000 * 2 ** (attempt - 1), 15_000);
        this.options.logger.warn(
          `GitHub API attempt ${attempt}/${this.maxAttempts} failed (${redact((error as Error).message, this.options.token)}); retrying in ${Math.round(wait / 1000)}s`,
        );
        await this.sleep(wait);
      }
    }
    if (lastError instanceof GitHubApiError && !(lastError instanceof RetryAfter)) throw lastError;
    throw new GitHubApiError(redact(`GitHub API request failed: ${(lastError as Error)?.message ?? lastError}`, this.options.token));
  }

  private async once<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `bearer ${this.options.token}`,
        "Content-Type": "application/json",
        "User-Agent": "carlosmeds-stats-card",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (response.status === 401) {
      throw new GitHubApiError(
        "GitHub rejected the token (401 Unauthorized). Check that GH_STATS_TOKEN/GITHUB_TOKEN is set and not expired.",
        401,
      );
    }
    if (response.status === 403 || response.status === 429) {
      const wait = this.rateLimitWait(response);
      if (wait !== undefined) throw new RetryAfter(response.status, wait);
      throw new GitHubApiError(`GitHub returned ${response.status} (forbidden). The token may lack access.`, response.status);
    }
    if (response.status >= 500) {
      throw new GitHubApiError(`GitHub returned ${response.status}`, response.status, true);
    }
    if (!response.ok) {
      throw new GitHubApiError(`GitHub returned ${response.status}`, response.status);
    }

    const body = (await response.json()) as GraphQLResponse<T>;
    if (body.errors?.length) {
      const rateLimited = body.errors.some((e) => e.type === "RATE_LIMITED");
      if (rateLimited) {
        throw new RetryAfter(200, this.rateLimitWait(response) ?? 60_000);
      }
      const message = body.errors.map((e) => e.message).join("; ");
      throw new GitHubApiError(redact(`GitHub GraphQL error: ${message}`, this.options.token));
    }
    if (!body.data) throw new GitHubApiError("GitHub GraphQL response has no data", undefined, true);
    return body.data;
  }

  /** Milliseconds to wait for a rate limit, or undefined if this is not a rate limit response. */
  private rateLimitWait(response: Response): number | undefined {
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter && /^\d+$/.test(retryAfter)) return this.capWait(Number(retryAfter) * 1000);
    if (response.headers.get("x-ratelimit-remaining") === "0") {
      const reset = Number(response.headers.get("x-ratelimit-reset"));
      if (Number.isFinite(reset) && reset > 0) return this.capWait(reset * 1000 - Date.now() + 1000);
      return this.capWait(60_000);
    }
    if (response.status === 429) return this.capWait(60_000);
    return undefined;
  }

  private capWait(ms: number): number {
    const wait = Math.max(ms, 1000);
    if (wait > this.maxWaitMs) {
      throw new GitHubApiError(
        `GitHub rate limit exceeded; reset is ${Math.ceil(wait / 60_000)} min away, giving up for this run`,
        403,
      );
    }
    return wait;
  }
}

class RetryAfter extends GitHubApiError {
  constructor(
    status: number,
    readonly waitMs: number,
  ) {
    super(`rate limited (HTTP ${status})`, status, true);
    this.name = "RetryAfter";
  }
}
