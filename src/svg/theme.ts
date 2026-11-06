export interface Theme {
  background: string;
  border: string;
  divider: string;
  /** Big numbers */
  text: string;
  /** Stat titles ("Total Contributions") */
  label: string;
  /** Date ranges and bottom captions */
  muted: string;
  /** The single accent colour used for every coloured detail */
  accent: string;
  /** Opacity of the accent behind the bottom icons */
  accentSoftOpacity: number;
}

export type ThemeName = "light" | "dark";

export const DEFAULT_ACCENT = "#f97316";

export const DEFAULT_THEMES: Record<ThemeName, Theme> = {
  light: {
    background: "#ffffff",
    border: "#d0d7de",
    divider: "#d8dee4",
    text: "#1f2328",
    label: "#1f2328",
    muted: "#59636e",
    accent: DEFAULT_ACCENT,
    accentSoftOpacity: 0.12,
  },
  // Matches GitHub's dark default palette.
  dark: {
    background: "#0d1117",
    border: "#30363d",
    divider: "#21262d",
    text: "#f0f6fc",
    label: "#e6edf3",
    muted: "#9198a1",
    accent: DEFAULT_ACCENT,
    accentSoftOpacity: 0.16,
  },
};
