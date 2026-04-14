import { describe, test, expect } from "bun:test";
import { resolve } from "node:path";

// Derive repo root portably - works across different checkout paths
const REPO_ROOT = resolve(import.meta.dir, "..");

interface CliRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function stripBunRunnerNoise(stderr: string): string {
  return stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^\$\s*bun\s+run\s+/i.test(line))
    .join("\n");
}

async function runRootStart(args: string[]): Promise<CliRunResult> {
  const proc = Bun.spawn(["bun", "run", "start", "--", ...args], {
    cwd: REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

describe("Root CLI behavior", () => {
  test("--help exits 0 and shows help without starting app", async () => {
    const { exitCode, stdout, stderr } = await runRootStart(["--help"]);
    const productStderr = stripBunRunnerNoise(stderr);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("OpenSudoku");
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("--help");
    expect(stdout).toContain("--version");
    expect(productStderr).toBe("");
  });

  test("--version exits 0 and prints exact package metadata string", async () => {
    const packageJson = JSON.parse(await Bun.file(`${REPO_ROOT}/package.json`).text()) as {
      name: string;
      version: string;
    };
    const { exitCode, stdout, stderr } = await runRootStart(["--version"]);
    const productStderr = stripBunRunnerNoise(stderr);

    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe(`${packageJson.name} v${packageJson.version}`);
    expect(productStderr).toBe("");
  });

  test("unknown flags exit non-zero with clear error and help hint", async () => {
    const { exitCode, stderr } = await runRootStart(["--invalid-flag"]);
    const productStderr = stripBunRunnerNoise(stderr);
    expect(exitCode).not.toBe(0);
    expect(productStderr).toContain("error: unknown option: --invalid-flag");
    expect(productStderr).toContain("Run 'bun run start -- --help' for available options.");
  });

  test("positional arguments exit non-zero with clear error and help hint", async () => {
    const { exitCode, stderr } = await runRootStart(["play"]);
    const productStderr = stripBunRunnerNoise(stderr);
    expect(exitCode).not.toBe(0);
    expect(productStderr).toContain("error: unexpected argument: play");
    expect(productStderr).toContain("Run 'bun run start -- --help' for available options.");
  });

  test("root app boundary remains repo-root with published @opentui/core", async () => {
    const packageJson = JSON.parse(await Bun.file(`${REPO_ROOT}/package.json`).text()) as {
      scripts?: { start?: string };
      dependencies?: Record<string, string>;
    };
    const entrypoint = await Bun.file(`${REPO_ROOT}/src/index.ts`).text();
    const runtimeApp = await Bun.file(`${REPO_ROOT}/src/runtime/runtime-app.ts`).text();

    expect(packageJson.scripts?.start).toBe("bun run src/index.ts");
    expect(packageJson.dependencies?.["@opentui/core"]).toBeDefined();
    expect(packageJson.dependencies?.["@opentui/core"]).not.toContain("file:");
    expect(packageJson.dependencies?.["@opentui/core"]).not.toContain("opentui/packages");
    expect(entrypoint).not.toContain("opentui/packages");
    expect(runtimeApp).toContain('from "@opentui/core"');
    expect(runtimeApp).not.toContain("opentui/packages");
  });

  test("release scripts keep local staging and avoid legacy compiled release commands", async () => {
    const packageJson = JSON.parse(await Bun.file(`${REPO_ROOT}/package.json`).text()) as {
      scripts?: Record<string, string>;
    };
    const scripts = packageJson.scripts ?? {};

    expect(scripts["stage:release"]).toBeDefined();
    expect(scripts["stage:release"]).toContain("stage-release");
    expect(scripts["publish:release"]).toBeUndefined();
    expect(scripts["build:release"]).toBeUndefined();
    expect(scripts["test:release-cli"]).toBeUndefined();
  });

  test("README documents curl installer flow and package metadata avoids legacy compiled release flows", async () => {
    const packageJson = JSON.parse(await Bun.file(`${REPO_ROOT}/package.json`).text()) as {
      scripts?: Record<string, string>;
    };
    const readme = await Bun.file(`${REPO_ROOT}/README.md`).text();

    expect(JSON.stringify(packageJson.scripts ?? {})).not.toContain("release-cli");
    expect(readme).not.toContain("opensudoku.exe");
    expect(readme).toContain("install.ps1");
    expect(readme).toContain("curl.exe -fsSL");
    expect(readme).not.toContain("build:release");
  });
});
