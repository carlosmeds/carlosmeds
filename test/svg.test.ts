import { XMLValidator } from "fast-xml-parser";
import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config.js";
import type { CardText } from "../src/format.js";
import { generateCards } from "../src/generate.js";
import { SAMPLE_TODAY, sampleContributionDays } from "../src/sample.js";
import { renderCard } from "../src/svg/render.js";
import { DEFAULT_THEMES } from "../src/svg/theme.js";
import { validateSvg } from "../src/validate.js";

const card: CardText = {
  total: "9,966",
  totalRange: "Sep 2018 – Present",
  current: "6",
  currentRange: "Nov 1 – Nov 6",
  longest: "35",
  longestRange: "Sep 2024 – Oct 2024",
  activeDays: "1,304",
  average: "7.6",
};

describe("svg rendering", () => {
  for (const layout of ["wide", "compact"] as const) {
    for (const theme of ["light", "dark"] as const) {
      it(`renders a valid ${layout} ${theme} card`, () => {
        const svg = renderCard(card, DEFAULT_THEMES[theme], layout);
        expect(XMLValidator.validate(svg)).toBe(true);
        expect(() => validateSvg(svg, card)).not.toThrow();
        expect(svg).toMatch(/viewBox="0 0 \d+ \d+"/);
        expect(svg).toContain(DEFAULT_THEMES[theme].background);
        expect(svg).toContain("Current Streak");
        for (const removed of ["Pull Requests", "Code Reviews", "Issues", "Most Active Year", "This Year"]) {
          expect(svg).not.toContain(removed);
        }
        expect(svg).not.toMatch(/Gradient|filter=|<script/);
      });
    }
  }

  it("uses one accent colour for every coloured detail", () => {
    const svg = renderCard(card, DEFAULT_THEMES.light, "wide");
    const colours = new Set(svg.match(/#[0-9a-f]{6}/gi)?.map((c) => c.toLowerCase()));
    const t = DEFAULT_THEMES.light;
    const allowed = new Set([t.background, t.border, t.divider, t.text, t.label, t.muted, t.accent]);
    for (const c of colours) expect(allowed.has(c)).toBe(true);
  });

  it("escapes text", () => {
    const svg = renderCard({ ...card, totalRange: `<b>&"'` }, DEFAULT_THEMES.light);
    expect(XMLValidator.validate(svg)).toBe(true);
    expect(svg).toContain("&lt;b&gt;&amp;&quot;&apos;");
  });

  it("is deterministic so unchanged data produces no commit", () => {
    const config = parseConfig({ username: "carlosmeds" });
    const a = generateCards(sampleContributionDays(), config, SAMPLE_TODAY).files;
    const b = generateCards(sampleContributionDays(), config, SAMPLE_TODAY).files;
    expect(a).toEqual(b);
    expect(a.map((f) => f.name)).toEqual([
      "streak-light.svg",
      "streak-dark.svg",
      "streak-compact-light.svg",
      "streak-compact-dark.svg",
    ]);
  });

  it("validation rejects broken output", () => {
    const svg = renderCard(card, DEFAULT_THEMES.light);
    expect(() => validateSvg(svg.replace("</svg>", ""), card)).toThrow(/well-formed/);
    expect(() => validateSvg(svg.replace(">9,966<", ">NaN<"), card)).toThrow();
    expect(() => validateSvg(svg, { ...card, total: "1" })).toThrow(/missing/);
    expect(() => validateSvg("", card)).toThrow(/size/);
  });
});
