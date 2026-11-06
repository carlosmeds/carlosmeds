#!/usr/bin/env node
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { loadConfig } from "./config.js";
import { isIsoDate, todayInTimeZone } from "./dates.js";
import { generateCards, writeOutputs } from "./generate.js";
import { GitHubClient, redact } from "./github/client.js";
import { fetchContributionDays } from "./github/contributions.js";
import { consoleLogger as log } from "./logger.js";
import { SAMPLE_TODAY, sampleContributionDays } from "./sample.js";

const HELP = `Usage: node dist/cli.js [options]

  --out <dir>        Output directory for the SVGs (default: out)
  --config <file>    Config file (default: stats.config.json)
  --sample           Use the bundled sample data instead of the GitHub API
  --today <date>     Override "today" (YYYY-MM-DD), mainly for testing
  -h, --help         Show this help

Token: GH_STATS_TOKEN, or GITHUB_TOKEN as fallback (not needed with --sample).`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      out: { type: "string", default: "out" },
      config: { type: "string", default: "stats.config.json" },
      sample: { type: "boolean", default: false },
      today: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help) {
    console.log(HELP);
    return;
  }

  const config = await loadConfig(resolve(values.config));
  if (values.today !== undefined && !isIsoDate(values.today)) throw new Error(`--today must be YYYY-MM-DD`);

  let days;
  let today: string;
  if (values.sample) {
    log.info("Using bundled sample data (preview mode)");
    days = sampleContributionDays();
    today = values.today ?? SAMPLE_TODAY;
  } else {
    const usingStatsToken = Boolean(process.env.GH_STATS_TOKEN);
    const token = process.env.GH_STATS_TOKEN || process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("No token found. Set GH_STATS_TOKEN (recommended) or GITHUB_TOKEN, or use --sample.");
    }
    log.info(`Fetching contributions for ${config.username} using ${usingStatsToken ? "GH_STATS_TOKEN" : "GITHUB_TOKEN"}`);
    const client = new GitHubClient({ token, logger: log });
    const result = await fetchContributionDays(client, config.username, log);
    if (!result.includesPrivate) {
      log.info("No private contributions reported by the API (see docs/STATS_CARD.md if you expected some).");
    }
    days = result.days;
    today = values.today ?? todayInTimeZone(config.timezone);
  }

  const { stats, card, files } = generateCards(days, config, today);
  log.info(
    [
      `Today (${config.timezone}): ${today}; exclude weekends: ${config.excludeWeekends}`,
      `Total contributions: ${card.total} (${card.totalRange})`,
      `Current streak: ${card.current} (${card.currentRange}; ${stats.currentStreak.start ?? "-"} .. ${stats.currentStreak.end ?? "-"})`,
      `Longest streak: ${card.longest} (${card.longestRange}; ${stats.longestStreak.start ?? "-"} .. ${stats.longestStreak.end ?? "-"})`,
      `Active days: ${card.activeDays}; contributions / active day: ${card.average}`,
    ].join("\n"),
  );

  const outDir = resolve(values.out);
  await writeOutputs(outDir, files);
  log.info(`Wrote ${files.map((f) => f.name).join(", ")} to ${outDir}`);
}

main().catch((error: unknown) => {
  const token = process.env.GH_STATS_TOKEN || process.env.GITHUB_TOKEN;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`::error::${redact(message, token)}`);
  process.exitCode = 1;
});
