import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "./config.js";
import type { ContributionDay } from "./contributions.js";
import type { IsoDate } from "./dates.js";
import { toCardText, type CardText } from "./format.js";
import { computeStats, type ContributionStats } from "./stats.js";
import { renderCard, type Layout } from "./svg/render.js";
import type { ThemeName } from "./svg/theme.js";
import { validateStats, validateSvg } from "./validate.js";

export interface OutputFile {
  name: string;
  svg: string;
}

export const OUTPUTS: { name: string; theme: ThemeName; layout: Layout }[] = [
  { name: "streak-light.svg", theme: "light", layout: "wide" },
  { name: "streak-dark.svg", theme: "dark", layout: "wide" },
  { name: "streak-compact-light.svg", theme: "light", layout: "compact" },
  { name: "streak-compact-dark.svg", theme: "dark", layout: "compact" },
];

export interface Generated {
  stats: ContributionStats;
  card: CardText;
  files: OutputFile[];
}

/** Pure: days -> validated stats -> validated SVGs. Throws instead of producing bad output. */
export function generateCards(days: readonly ContributionDay[], config: Config, today: IsoDate): Generated {
  const stats = computeStats(days, { today, excludeWeekends: config.excludeWeekends });
  validateStats(stats, { allowEmpty: config.allowEmpty });
  const card = toCardText(stats);
  const files = OUTPUTS.map(({ name, theme, layout }) => {
    const svg = renderCard(card, config.themes[theme], layout);
    validateSvg(svg, card);
    return { name, svg };
  });
  return { stats, card, files };
}

/** Writes all files to a staging dir first, then moves them in, so a crash never leaves a partial set. */
export async function writeOutputs(outDir: string, files: readonly OutputFile[]): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const staging = join(outDir, `.staging-${process.pid}`);
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging);
  try {
    for (const f of files) await writeFile(join(staging, f.name), f.svg, "utf8");
    for (const f of files) await rename(join(staging, f.name), join(outDir, f.name));
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
