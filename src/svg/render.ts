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
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="16" fill="${t.background}" stroke="${t.border}"/>` +
    `<g font-family="${FONT}">${body}</g>` +
    `</svg>\n`
  );
}

interface BottomStat {
  value: string;
  caption: string;
  icon: "calendar" | "bars";
}

/** Icon box followed by number + caption, centred as a group around `cx`. */
function bottomStatInline(cx: number, cy: number, s: BottomStat, t: Theme): string {
  const icon = 56;
  const gap = 22;
  const valueSize = 36;
  const captionSize = 17;
  const textWidth = Math.max(estimateWidth(s.value, valueSize, true), estimateWidth(s.caption, captionSize));
  const left = Math.round(cx - (icon + gap + textWidth) / 2);
  const tx = left + icon + gap;
  return (
    iconBox(left, cy - icon / 2, icon, s.icon, t) +
    text(s.value, { x: tx, y: cy + 4, size: valueSize, weight: 700, fill: t.text, anchor: "start" }) +
    text(s.caption, { x: tx, y: cy + 30, size: captionSize, fill: t.muted, anchor: "start" })
  );
}

function renderWide(card: CardText, t: Theme): string {
  const W = 900;
  const H = 400;
  const cols = [170, 450, 730];
  const side = (x: number, value: string, label: string, range: string) =>
    text(value, { x, y: 126, size: 50, weight: 700, fill: t.text }) +
    text(label, { x, y: 166, size: 20, weight: 500, fill: t.label }) +
    text(range, { x, y: 198, size: 16, fill: t.muted });

  const body = [
    side(cols[0]!, card.total, "Total Contributions", card.totalRange),
    streakRing(cols[1]!, 100, 56, card.current, 46, t),
    text("Current Streak", { x: cols[1]!, y: 196, size: 20, weight: 700, fill: t.accent }),
    text(card.currentRange, { x: cols[1]!, y: 224, size: 16, fill: t.muted }),
    side(cols[2]!, card.longest, "Longest Streak", card.longestRange),
    line(310, 56, 310, 210, t.divider),
    line(590, 56, 590, 210, t.divider),
    line(40, 258, W - 40, 258, t.divider),
    line(450, 286, 450, 372, t.divider),
    bottomStatInline(245, 326, { value: card.activeDays, caption: "Active Days", icon: "calendar" }, t),
    bottomStatInline(655, 326, { value: card.average, caption: "Contributions / Active Day", icon: "bars" }, t),
  ].join("");
  return frame({ width: W, height: H, body, card, t });
}

/**
 * Narrow layout for phones: streak on top, then two 2-column rows. Rendered at
 * ~340px wide it keeps captions around 11–12px instead of the ~6px the wide card
 * would shrink to.
 */
function renderCompact(card: CardText, t: Theme): string {
  const W = 480;
  const H = 580;
  const cols = [125, 355];
  const pair = (x: number, value: string, label: string, range: string) =>
    text(value, { x, y: 302, size: 38, weight: 700, fill: t.text }) +
    text(label, { x, y: 332, size: 17, weight: 500, fill: t.label }) +
    text(range, { x, y: 358, size: 15, fill: t.muted });
  const stacked = (x: number, s: BottomStat) =>
    iconBox(x - 26, 412, 52, s.icon, t) +
    text(s.value, { x, y: 512, size: 34, weight: 700, fill: t.text }) +
    text(s.caption, { x, y: 540, size: 15, fill: t.muted });

  const body = [
    streakRing(W / 2, 98, 56, card.current, 46, t),
    text("Current Streak", { x: W / 2, y: 194, size: 20, weight: 700, fill: t.accent }),
    text(card.currentRange, { x: W / 2, y: 221, size: 16, fill: t.muted }),
    line(32, 246, W - 32, 246, t.divider),
    pair(cols[0]!, card.total, "Total Contributions", card.totalRange),
    pair(cols[1]!, card.longest, "Longest Streak", card.longestRange),
    line(W / 2, 266, W / 2, 368, t.divider),
    line(32, 390, W - 32, 390, t.divider),
    stacked(cols[0]!, { value: card.activeDays, caption: "Active Days", icon: "calendar" }),
    stacked(cols[1]!, { value: card.average, caption: "Contributions / Active Day", icon: "bars" }),
    line(W / 2, 410, W / 2, 552, t.divider),
  ].join("");
  return frame({ width: W, height: H, body, card, t });
}

export function renderCard(card: CardText, theme: Theme, layout: Layout = "wide"): string {
  return layout === "wide" ? renderWide(card, theme) : renderCompact(card, theme);
}
