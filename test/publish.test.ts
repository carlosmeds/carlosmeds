import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = resolve("scripts/publish.sh");

let root: string;
let remote: string;
let work: string;
let out: string;

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" } }).trim();

const publish = (env: Record<string, string> = {}) =>
  execFileSync("bash", [SCRIPT, out], {
    cwd: work,
    encoding: "utf8",
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", ...env },
  });

const svg = (label: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text>${label}</text></svg>\n`;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "publish-test-"));
  remote = join(root, "remote.git");
  work = join(root, "work");
  out = join(root, "out");
  execFileSync("git", ["init", "--quiet", "--bare", "--initial-branch=main", remote]);
  execFileSync("git", ["clone", "--quiet", remote, work], { stdio: "ignore" });
  git(work, "-c", "user.name=Owner", "-c", "user.email=owner@example.com", "commit", "--quiet", "--allow-empty", "-m", "init");
  git(work, "push", "--quiet", "origin", "HEAD:main");
  mkdirSync(out);
  writeFileSync(join(out, "streak-light.svg"), svg("light"));
  writeFileSync(join(out, "streak-dark.svg"), svg("dark"));
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("publish.sh", () => {
  it("creates the generated branch with bot authorship and leaves main alone", () => {
    const mainBefore = git(remote, "rev-parse", "main");
    const headBefore = git(work, "rev-parse", "HEAD");
    const log = publish();
    expect(log).toMatch(/will be created/);

    expect(git(remote, "rev-parse", "main")).toBe(mainBefore);
    expect(git(work, "rev-parse", "HEAD")).toBe(headBefore);
    expect(git(work, "status", "--porcelain")).toBe("");

    expect(git(remote, "ls-tree", "-r", "--name-only", "generated").split("\n").sort()).toEqual([
      "README.md",
      "assets/streak-dark.svg",
      "assets/streak-light.svg",
    ]);
    expect(git(remote, "log", "-1", "--format=%an <%ae>|%cn", "generated")).toBe(
      "github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>|github-actions[bot]",
    );
    // Orphan branch: shares no history with main.
    expect(git(remote, "rev-list", "--count", "generated")).toBe("1");
    expect(git(remote, "show", "generated:assets/streak-light.svg")).toContain("light");
  });

  it("does not commit when nothing changed", () => {
    publish();
    const first = git(remote, "rev-parse", "generated");
    const log = publish();
    expect(log).toMatch(/unchanged; no commit/);
    expect(git(remote, "rev-parse", "generated")).toBe(first);
  });

  it("appends a commit when an SVG changes", () => {
    publish();
    const first = git(remote, "rev-parse", "generated");
    writeFileSync(join(out, "streak-light.svg"), svg("light v2"));
    publish();
    expect(git(remote, "rev-parse", "generated^")).toBe(first);
    expect(git(remote, "show", "generated:assets/streak-light.svg")).toContain("light v2");
  });

  it("refuses to publish to main or with missing/invalid files", () => {
    expect(() => publish({ PUBLISH_BRANCH: "main" })).toThrow();
    writeFileSync(join(out, "streak-dark.svg"), "");
    expect(() => publish()).toThrow();
    rmSync(out, { recursive: true });
    mkdirSync(out);
    expect(() => publish()).toThrow();
    expect(git(remote, "branch", "--list", "generated")).toBe("");
  });
});
