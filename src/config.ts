import { readFile } from "node:fs/promises";
import { assertTimeZone } from "./dates.js";
import { DEFAULT_THEMES, type Theme, type ThemeName } from "./svg/theme.js";

export interface Config {
  username: string;
  timezone: string;
  excludeWeekends: boolean;
  /** Publishing an all-zero card is refused unless this is true (protects against silent API failures). */
  allowEmpty: boolean;
  themes: Record<ThemeName, Theme>;
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const USERNAME = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const COLOR_KEYS = ["background", "border", "divider", "text", "label", "muted", "accent"] as const;

type Raw = Record<string, unknown>;

function isObject(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function color(value: unknown, path: string): string {
  if (typeof value !== "string" || !HEX_COLOR.test(value)) {
    throw new Error(`Config "${path}" must be a hex colour like #f97316`);
  }
  return value.toLowerCase();
}

function bool(value: unknown, path: string, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Config "${path}" must be true or false`);
}

function buildTheme(name: ThemeName, accent: string | undefined, overrides: unknown): Theme {
  const theme: Theme = { ...DEFAULT_THEMES[name] };
  if (accent) theme.accent = accent;
  if (overrides === undefined) return theme;
  if (!isObject(overrides)) throw new Error(`Config "themes.${name}" must be an object`);
  for (const [key, value] of Object.entries(overrides)) {
    if ((COLOR_KEYS as readonly string[]).includes(key)) {
      theme[key as (typeof COLOR_KEYS)[number]] = color(value, `themes.${name}.${key}`);
    } else if (key === "accentSoftOpacity") {
      if (typeof value !== "number" || value < 0 || value > 1) {
        throw new Error(`Config "themes.${name}.accentSoftOpacity" must be a number between 0 and 1`);
      }
      theme.accentSoftOpacity = value;
    } else {
      throw new Error(`Unknown config key "themes.${name}.${key}"`);
    }
  }
  return theme;
}

/** Validates raw config. Environment variables (STATS_*) take precedence over the file. */
export function parseConfig(raw: unknown, env: NodeJS.ProcessEnv = {}): Config {
  if (!isObject(raw)) throw new Error("Config must be a JSON object");

  const username = env.STATS_USERNAME ?? raw.username;
  if (typeof username !== "string" || !USERNAME.test(username)) {
    throw new Error(`Config "username" must be a valid GitHub login, got ${JSON.stringify(username)}`);
  }

  const timezone = env.STATS_TIMEZONE ?? raw.timezone ?? "America/Sao_Paulo";
  if (typeof timezone !== "string") throw new Error(`Config "timezone" must be a string`);
  assertTimeZone(timezone);

  const accent = raw.accent === undefined ? undefined : color(raw.accent, "accent");
  const themes = raw.themes === undefined ? {} : raw.themes;
  if (!isObject(themes)) throw new Error(`Config "themes" must be an object`);
  for (const key of Object.keys(themes)) {
    if (key !== "light" && key !== "dark") throw new Error(`Unknown theme "${key}" (use "light" or "dark")`);
  }

  return {
    username,
    timezone,
    excludeWeekends: bool(env.STATS_EXCLUDE_WEEKENDS ?? raw.excludeWeekends, "excludeWeekends", false),
    allowEmpty: bool(raw.allowEmpty, "allowEmpty", false),
    themes: {
      light: buildTheme("light", accent, themes.light),
      dark: buildTheme("dark", accent, themes.dark),
    },
  };
}

export async function loadConfig(path: string, env: NodeJS.ProcessEnv = process.env): Promise<Config> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    throw new Error(`Could not read config file ${path}: ${(error as Error).message}`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new Error(`Config file ${path} is not valid JSON: ${(error as Error).message}`);
  }
  return parseConfig(raw, env);
}
