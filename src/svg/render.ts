import type { CardText } from "../format.js";
import type { Theme } from "./theme.js";

export type Layout = "wide" | "compact";

/**
 * SVGs inside a README are rendered through <img>, which cannot load web fonts or run
 * scripts, so we rely on the system UI font stack that GitHub itself uses.
 */
const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif`;

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Rough text width estimate; only used to centre icon + text groups. */
function estimateWidth(text: string, fontSize: number, bold = false): number {
  let units = 0;
  for (const ch of text) {
    if (/[0-9]/.test(ch)) units += 0.6;
    else if (/[,.]/.test(ch)) units += 0.3;
    else if (ch === " ") units += 0.28;
    else if (/[A-Z]/.test(ch)) units += 0.66;
    else if (/[il/]/.test(ch)) units += 0.3;
    else units += 0.53;
  }
  return units * fontSize * (bold ? 1.06 : 1);
}

interface TextOptions {
  x: number;
  y: number;
  size: number;
  fill: string;
  weight?: number;
  anchor?: "start" | "middle" | "end";
}

function text(content: string, o: TextOptions): string {
  return `<text x="${o.x}" y="${o.y}" font-size="${o.size}" font-weight="${o.weight ?? 400}" fill="${o.fill}" text-anchor="${o.anchor ?? "middle"}">${escapeXml(content)}</text>`;
}

function line(x1: number, y1: number, x2: number, y2: number, stroke: string): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="1"/>`;
}

/** Fit long streak numbers inside the ring. */
function ringNumberSize(value: string, base: number): number {
  const digits = value.replace(/\D/g, "").length;
  if (digits <= 2) return base;
  if (digits === 3) return Math.round(base * 0.82);
  return Math.round(base * 0.66);
}

function flame(cx: number, cy: number, scale: number, t: Theme): string {
  // Teardrop flame with an inner "hole", drawn on a background-coloured disc that
  // cuts a gap in the ring (as in the reference design).
  const s = scale;
  const path =
    `M ${cx} ${cy - 11 * s} ` +
    `C ${cx + 3 * s} ${cy - 6 * s} ${cx + 8 * s} ${cy - 3 * s} ${cx + 8 * s} ${cy + 3 * s} ` +
    `C ${cx + 8 * s} ${cy + 8 * s} ${cx + 4.4 * s} ${cy + 11 * s} ${cx} ${cy + 11 * s} ` +
    `C ${cx - 4.4 * s} ${cy + 11 * s} ${cx - 8 * s} ${cy + 8 * s} ${cx - 8 * s} ${cy + 3 * s} ` +
    `C ${cx - 8 * s} ${cy - 1 * s} ${cx - 5 * s} ${cy - 3.5 * s} ${cx - 3.5 * s} ${cy - 6.5 * s} ` +
    `C ${cx - 2.5 * s} ${cy - 4 * s} ${cx - 1.5 * s} ${cy - 3 * s} ${cx} ${cy - 11 * s} Z`;
  return [
    `<circle cx="${cx}" cy="${cy + 1 * s}" r="${13 * s}" fill="${t.background}"/>`,
    `<path d="${path}" fill="${t.accent}"/>`,
    `<circle cx="${cx}" cy="${cy + 4.5 * s}" r="${3.4 * s}" fill="${t.background}"/>`,
  ].join("");
}

function streakRing(cx: number, cy: number, r: number, value: string, numberSize: number, t: Theme): string {
  return [
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${t.accent}" stroke-width="${Math.round(r / 8)}"/>`,
    flame(cx, cy - r - 2, (r / 56) * 1.45, t),
    text(value, { x: cx, y: cy + numberSize * 0.36, size: ringNumberSize(value, numberSize), weight: 700, fill: t.text }),
  ].join("");
}

function iconBox(x: number, y: number, size: number, kind: "calendar" | "bars", t: Theme): string {
  const k = size / 56;
  const g = (v: number) => +(v * k).toFixed(2);
  const bg = `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${g(14)}" fill="${t.accent}" fill-opacity="${t.accentSoftOpacity}"/>`;
  // Icons drawn on a 24-unit grid centred in the box.
  const ox = x + g(12);
  const oy = y + g(12);
  const u = g(32) / 24;
  const p = (vx: number, vy: number) => `${+(ox + vx * u).toFixed(2)} ${+(oy + vy * u).toFixed(2)}`;
  if (kind === "calendar") {
    const sw = +(2 * u).toFixed(2);
    return (
      bg +
      `<g fill="none" stroke="${t.accent}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">` +
      `<rect x="${+(ox + 3 * u).toFixed(2)}" y="${+(oy + 5 * u).toFixed(2)}" width="${+(18 * u).toFixed(2)}" height="${+(16 * u).toFixed(2)}" rx="${+(2.5 * u).toFixed(2)}"/>` +
      `<path d="M ${p(3, 10)} L ${p(21, 10)} M ${p(8, 3)} L ${p(8, 7)} M ${p(16, 3)} L ${p(16, 7)}"/>` +
      `</g>`
    );
  }
  const bars = [
    { x: 3, h: 6, o: 1 },
    { x: 8.25, h: 10, o: 1 },
    { x: 13.5, h: 14, o: 0.55 },
    { x: 18.75, h: 18, o: 1 },
  ];
  return (
    bg +
    bars
      .map(
        (b) =>
          `<rect x="${+(ox + b.x * u).toFixed(2)}" y="${+(oy + (21 - b.h) * u).toFixed(2)}" width="${+(3 * u).toFixed(2)}" height="${+(b.h * u).toFixed(2)}" rx="${+(1 * u).toFixed(2)}" fill="${t.accent}"${b.o < 1 ? ` fill-opacity="${b.o}"` : ""}/>`,
      )
      .join("")
  );
}

interface FrameOptions {
  width: number;
  height: number;
  body: string;
  card: CardText;
  t: Theme;
}

function frame({ width, height, body, card, t }: FrameOptions): string {
  const title = "GitHub contribution stats";
  const desc =
    `${card.total} total contributions (${card.totalRange}). ` +
    `Current streak: ${card.current} days (${card.currentRange}). ` +
    `Longest streak: ${card.longest} days (${card.longestRange}). ` +
    `${card.activeDays} active days, ${card.average} contributions per active day.`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">` +
    `<title id="title">${escapeXml(title)}</title>` +
    `<desc id="desc">${escapeXml(desc)}</desc>` +
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="${t.background}" stroke="${t.border}"/>` +
    `<g font-family="${FONT}">${body}</g>` +
    `</svg>\n`
  );
}

interface BottomStat {
  value: string;
  caption: string;
  icon: "calendar" | "bars";
}

/** Largest font size <= `size` whose estimated width fits in `maxWidth`. */
function fit(content: string, size: number, maxWidth: number, bold = false): number {
  const width = estimateWidth(content, size, bold);
  return width <= maxWidth ? size : Math.floor((size * maxWidth) / width * 10) / 10;
}

/**
 * Both layouts share the same structure (3 columns on top, 2 below); only the metrics
 * differ. "wide" is the desktop card (~500x220, close to the classic streak card);
 * "compact" is narrower with relatively larger type, for phone-width READMEs.
 */
interface Metrics {
  width: number;
  height: number;
  pad: number;
  /** Top row */
  ringCy: number;
  ringR: number;
  ringNumber: number;
  sideNumberY: number;
  sideNumber: number;
  labelY: number;
  label: number;
  rangeY: number;
  range: number;
  streakLabelY: number;
  streakRangeY: number;
  dividerTop: [number, number];
  /** Bottom row */
  rowY: number;
  bottomCy: number;
  icon: number;
  iconGap: number;
  bottomNumber: number;
  caption: number;
  bottomDivider: [number, number];
}

const METRICS: Record<Layout, Metrics> = {
  wide: {
    width: 500,
    height: 220,
    pad: 14,
    ringCy: 60,
    ringR: 31,
    ringNumber: 25,
    sideNumberY: 70,
    sideNumber: 28,
    labelY: 95,
    label: 13,
    rangeY: 114,
    range: 11.5,
    streakLabelY: 113,
    streakRangeY: 130,
    dividerTop: [30, 120],
    rowY: 146,
    bottomCy: 183,
    icon: 34,
    iconGap: 11,
    bottomNumber: 21,
    caption: 11.5,
    bottomDivider: [160, 206],
  },
  compact: {
    width: 330,
    height: 200,
    pad: 8,
    ringCy: 54,
    ringR: 26,
    ringNumber: 22,
    sideNumberY: 63,
    sideNumber: 24,
    labelY: 86,
    label: 11.5,
    rangeY: 103,
    range: 10.5,
    streakLabelY: 101,
    streakRangeY: 117,
    dividerTop: [28, 108],
    rowY: 131,
    bottomCy: 165,
    icon: 28,
    iconGap: 8,
    bottomNumber: 18,
    caption: 10.5,
    bottomDivider: [144, 188],
  },
};

/** Icon box followed by number + caption, centred as a group in a column. */
function bottomStat(cx: number, m: Metrics, sizes: { number: number; caption: number; maxText: number }, s: BottomStat, t: Theme): string {
  const { number: numberSize, caption: captionSize, maxText } = sizes;
  const textWidth = Math.min(
    maxText,
    Math.max(estimateWidth(s.value, numberSize, true), estimateWidth(s.caption, captionSize)),
  );
  const left = Math.round(cx - (m.icon + m.iconGap + textWidth) / 2);
  const tx = left + m.icon + m.iconGap;
  return (
    iconBox(left, Math.round(m.bottomCy - m.icon / 2), m.icon, s.icon, t) +
    text(s.value, { x: tx, y: m.bottomCy + Math.round(numberSize * 0.12), size: numberSize, weight: 700, fill: t.text, anchor: "start" }) +
    text(s.caption, { x: tx, y: m.bottomCy + Math.round(captionSize * 1.45), size: captionSize, fill: t.muted, anchor: "start" })
  );
}

function renderLayout(card: CardText, t: Theme, m: Metrics): string {
  const inner = m.width - 2 * m.pad;
  const col = inner / 3;
  const cols = [m.pad + col / 2, m.width / 2, m.width - m.pad - col / 2];
  const maxText = col - 6;

  // One size per text role, so every column in a row uses the same typography; long
  // values shrink the whole role instead of a single column.
  const shared = (base: number, max: number, bold: boolean, ...values: string[]) =>
    Math.min(...values.map((v) => fit(v, base, max, bold)));
  const sideNumber = shared(m.sideNumber, maxText, true, card.total, card.longest);
  const labelSize = Math.min(
    shared(m.label, maxText, false, "Total Contributions", "Longest Streak"),
    shared(m.label, maxText, true, "Current Streak"),
  );
  const rangeSize = shared(m.range, maxText, false, card.totalRange, card.currentRange, card.longestRange);

  const bottomMax = m.width / 2 - m.icon - m.iconGap - 12;
  const bottomSizes = {
    number: shared(m.bottomNumber, bottomMax, true, card.activeDays, card.average),
    caption: shared(m.caption, bottomMax, false, "Active Days", "Contributions / Active Day"),
    maxText: bottomMax,
  };

  const side = (x: number, value: string, label: string, range: string) =>
    text(value, { x, y: m.sideNumberY, size: sideNumber, weight: 700, fill: t.text }) +
    text(label, { x, y: m.labelY, size: labelSize, weight: 500, fill: t.label }) +
    text(range, { x, y: m.rangeY, size: rangeSize, fill: t.muted });

  const halfCenters = [m.width / 4, (3 * m.width) / 4];
  const body = [
    side(cols[0]!, card.total, "Total Contributions", card.totalRange),
    streakRing(cols[1]!, m.ringCy, m.ringR, card.current, m.ringNumber, t),
    text("Current Streak", { x: cols[1]!, y: m.streakLabelY, size: labelSize, weight: 700, fill: t.accent }),
    text(card.currentRange, { x: cols[1]!, y: m.streakRangeY, size: rangeSize, fill: t.muted }),
    side(cols[2]!, card.longest, "Longest Streak", card.longestRange),
    line(m.pad + col, m.dividerTop[0], m.pad + col, m.dividerTop[1], t.divider),
    line(m.pad + 2 * col, m.dividerTop[0], m.pad + 2 * col, m.dividerTop[1], t.divider),
    line(m.pad + 6, m.rowY, m.width - m.pad - 6, m.rowY, t.divider),
    line(m.width / 2, m.bottomDivider[0], m.width / 2, m.bottomDivider[1], t.divider),
    bottomStat(halfCenters[0]!, m, bottomSizes, { value: card.activeDays, caption: "Active Days", icon: "calendar" }, t),
    bottomStat(halfCenters[1]!, m, bottomSizes, { value: card.average, caption: "Contributions / Active Day", icon: "bars" }, t),
  ].join("");
  return frame({ width: m.width, height: m.height, body, card, t });
}

export function renderCard(card: CardText, theme: Theme, layout: Layout = "wide"): string {
  return renderLayout(card, theme, METRICS[layout]);
}
