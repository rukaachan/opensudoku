#!/usr/bin/env bun

/**
 * Smoke test script for OpenSudoku
 * Writes evidence to dist/evidence/
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  addCheck,
  parseOutputPath,
  runAppSession,
  runLiveStartupCheckWithRetries,
  type SmokeResult,
} from "./smoke-test-runner";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const evidenceDir = join(repoRoot, "dist", "evidence");

// Handle --help flag
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
OpenSudoku Smoke Test

Usage:
  bun run smoke-test [options]

Options:
  --help, -h     Show this help message
  --json <path> Write JSON results to specified path

Description:
  Runs runtime smoke checks for startup, quit paths, and interrupt cleanup.
`);
  process.exit(0);
}

const outputPath = parseOutputPath(process.argv.slice(2), evidenceDir, repoRoot);

const result: SmokeResult = {
  timestamp: new Date().toISOString(),
  exitCode: 0,
  checks: [],
  artifacts: {},
};

console.log("Running smoke tests...");

await addCheck(result, "entry-point-loads", async () => {
  await import("../src/index.ts");
  return { passed: true };
});

await addCheck(result, "package-metadata", async () => {
  const pkg = await import("../package.json", { with: { type: "json" } });
  return { passed: pkg.name === "opensudoku" && Boolean(pkg.version) };
});

await addCheck(result, "opentui-available", async () => {
  await import("@opentui/core");
  return { passed: true };
});

await addCheck(result, "quit-root-screen", async () => {
  const run = await runAppSession({ repoRoot, keys: ["q"] });
  return {
    passed: !run.timedOut && run.exitCode === 0,
    details: `exit=${run.exitCode} timedOut=${run.timedOut}`,
  };
});

await addCheck(result, "quit-play-screen", async () => {
  const run = await runAppSession({ repoRoot, keys: ["p", "q"] });
  return {
    passed: !run.timedOut && run.exitCode === 0,
    details: `exit=${run.exitCode} timedOut=${run.timedOut}`,
  };
});

await addCheck(result, "quit-daily-screen", async () => {
  const run = await runAppSession({ repoRoot, keys: ["d", "q"] });
  return {
    passed: !run.timedOut && run.exitCode === 0,
    details: `exit=${run.exitCode} timedOut=${run.timedOut}`,
  };
});

await addCheck(result, "quit-generator-screen", async () => {
  const run = await runAppSession({ repoRoot, keys: ["g", "q"] });
  return {
    passed: !run.timedOut && run.exitCode === 0,
    details: `exit=${run.exitCode} timedOut=${run.timedOut}`,
  };
});

await addCheck(result, "quit-solver-screen", async () => {
  const run = await runAppSession({ repoRoot, keys: ["s", "q"] });
  return {
    passed: !run.timedOut && run.exitCode === 0,
    details: `exit=${run.exitCode} timedOut=${run.timedOut}`,
  };
});

await addCheck(result, "quit-help-screen", async () => {
  const run = await runAppSession({ repoRoot, keys: ["h", "q"] });
  return {
    passed: !run.timedOut && run.exitCode === 0,
    details: `exit=${run.exitCode} timedOut=${run.timedOut}`,
  };
});

await addCheck(result, "ctrl-c-cleanup", async () => {
  const run = await runAppSession({ repoRoot, interrupt: true });
  return {
    passed: !run.timedOut && run.exitCode === 130,
    details: `exit=${run.exitCode} timedOut=${run.timedOut}`,
  };
});

await addCheck(result, "live-startup-root-play-first-input-clean-exit", async () => {
  const check = await runLiveStartupCheckWithRetries(repoRoot, outputPath);
  result.artifacts = {
    liveStartupTranscript: check.transcriptPath,
    liveStartupRawOutput: check.rawOutputPath,
  };
  return { passed: check.passed, details: check.details };
});

await addCheck(result, "follow-up-shell-command", async () => {
  const followUp = Bun.spawn(["bun", "--version"], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  const exitCode = await followUp.exited;
  const stdout = await new Response(followUp.stdout).text();
  return { passed: exitCode === 0 && stdout.trim().length > 0, details: `exit=${exitCode}` };
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(result, null, 2));

if (result.exitCode === 0) {
  console.log("Smoke tests passed!");
} else {
  console.log("Smoke tests failed!");
}
console.log(`Evidence written to: ${outputPath}`);

process.exit(result.exitCode);
