import { XMLParser, XMLValidator } from "fast-xml-parser";
import { escapeXml } from "./svg/render.js";
import type { CardText } from "./format.js";
import type { ContributionStats } from "./stats.js";

const MAX_SVG_BYTES = 64 * 1024;

/** Sanity checks that stop a broken or suspicious result from being published. */
export function validateStats(stats: ContributionStats, options: { allowEmpty: boolean }): void {
  const numbers = {
    totalContributions: stats.totalContributions,
    activeDays: stats.activeDays,
    contributionsPerActiveDay: stats.contributionsPerActiveDay,
    currentStreak: stats.currentStreak.length,
    longestStreak: stats.longestStreak.length,
  };
  for (const [name, value] of Object.entries(numbers)) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid ${name}: ${value}`);
  }
  if (stats.totalContributions === 0 && !options.allowEmpty) {
    throw new Error(
      "No contributions found. Refusing to publish an all-zero card (this usually means an auth or API problem). " +
        'Set "allowEmpty": true in stats.config.json if the profile really has no contributions.',
    );
  }
  if (stats.activeDays > stats.totalContributions) throw new Error("More active days than contributions");
  if (stats.currentStreak.length > stats.longestStreak.length) throw new Error("Current streak longer than longest streak");
  if (stats.longestStreak.length > stats.activeDays) throw new Error("Longest streak longer than active days");
}

export function validateSvg(svg: string, card: CardText): void {
  const bytes = Buffer.byteLength(svg, "utf8");
  if (bytes === 0 || bytes > MAX_SVG_BYTES) throw new Error(`SVG has unexpected size (${bytes} bytes)`);

  const result = XMLValidator.validate(svg);
  if (result !== true) throw new Error(`SVG is not well-formed XML: ${result.err.msg} (line ${result.err.line})`);

  const doc = new XMLParser({ ignoreAttributes: false }).parse(svg) as Record<string, Record<string, string> | undefined>;
  const root = doc.svg;
  if (!root) throw new Error("SVG root element missing");
  if (root["@_xmlns"] !== "http://www.w3.org/2000/svg") throw new Error("SVG namespace missing");
  if (!/^0 0 \d+ \d+$/.test(root["@_viewBox"] ?? "")) throw new Error("SVG viewBox missing");

  if (/\b(NaN|undefined|null|Infinity)\b/.test(svg)) throw new Error("SVG contains an invalid value");
  if (/<script|on\w+=|href=/i.test(svg)) throw new Error("SVG contains active content");

  for (const value of Object.values(card)) {
    if (!svg.includes(`>${escapeXml(value)}<`)) throw new Error(`SVG is missing expected text "${value}"`);
  }
}
