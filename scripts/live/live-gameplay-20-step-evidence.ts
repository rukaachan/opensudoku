#!/usr/bin/env bun

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { reconstructFinalFrame, sleep } from "./live-terminal-frame";
import { parseCueTypes, parseHudLines, type CueType } from "./live-gameplay-20-step-support";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const DEFAULT_OUTPUT_PATH = join(
  repoRoot,
  "dist",
  "validation",
  "runtime-optimization",
  "user-testing",
  "evidence",
  "gameplay-input-live-20-step.json",
);
const ALMOST_SOLVED_BOARD =
  "034678912672195348198342567859761423426853791713924856961537284287419635345286179";
const LATENCY_BUDGET_MS = 2000;
const LATENCY_KEYS = [
  "d",
  "d",
  "5",
  "4",
  "h",
  "x",
  "x",
  "\u007f",
  "n",
  "1",
  "2",
  "3",
  "4",
  "n",
  "a",
  "d",
  "w",
  "s",
  "a",
  "d",
] as const;

interface RunResult {
  exitCode: number;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  latencyStartMs?: number;
}

interface CueCheck {
  expectedCue: CueType;
  keys: string[];
  exitCode: number;
  timedOut: boolean;
  observedCueTypes: CueType[];
  hasExpectedCue: boolean;
  cueEvidencePath: string;
  ansiOutputPath: string;
  finalFramePath: string;
  parsedHudLines: Record<string, string>;
}

function parseOutputPath(args: string[]): string {
  const index = args.indexOf("--json");
  if (index >= 0 && args[index + 1]) {
    const requested = args[index + 1]!;
    return isAbsolute(requested) ? requested : resolve(repoRoot, requested);
  }
  return DEFAULT_OUTPUT_PATH;
}

async function runSession(options: {
  keys: string[];
  startBoard?: string;
  cuePath?: string;
  captureLatency?: boolean;
  keyDelayMs?: number;
  timeoutMs?: number;
}): Promise<RunResult> {
  const child = Bun.spawn(["bun", "run", "src/index.ts"], {
    cwd: repoRoot,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      ...(options.startBoard ? { OPEN_SUDOKU_START_BOARD: options.startBoard } : {}),
      ...(options.cuePath ? { OPEN_SUDOKU_LIVE_CUE_EVIDENCE_PATH: options.cuePath } : {}),
    },
  });

  const stdoutPromise = new Response(child.stdout).text();
  const stderrPromise = new Response(child.stderr).text();
  const timeoutMs = options.timeoutMs ?? 10_000;
  const keyDelayMs = options.keyDelayMs ?? 350;
  const timeoutPromise = sleep(timeoutMs).then(() => ({ timedOut: true, exitCode: -1 }));
  const exitPromise = child.exited.then((exitCode) => ({ timedOut: false, exitCode }));

  let latencyStartMs: number | undefined;
  void (async () => {
    for (const [index, key] of options.keys.entries()) {
      await sleep(keyDelayMs);
      if (options.captureLatency && index === 1) latencyStartMs = performance.now();
      child.stdin.write(key);
    }
  })();

  const result = await Promise.race([timeoutPromise, exitPromise]);
  if (result.timedOut) {
    child.kill();
    await child.exited;
  }

  const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
  return {
    ...result,
    stdout,
    stderr,
    ...(options.captureLatency && latencyStartMs !== undefined ? { latencyStartMs } : {}),
  };
}

async function runCueCase(options: {
  caseId: CueType;
  keys: string[];
  outputDir: string;
  startBoard?: string;
}): Promise<CueCheck> {
  const cuePath = join(options.outputDir, `live-cue-${options.caseId}.events.json`);
  const ansiPath = join(options.outputDir, `live-cue-${options.caseId}.ansi.txt`);
  const finalFramePath = join(options.outputDir, `live-cue-${options.caseId}.final-frame.txt`);
  const run = await runSession({ keys: options.keys, startBoard: options.startBoard, cuePath });
  const finalFrame = reconstructFinalFrame(run.stdout, 80, 24);
  await writeFile(ansiPath, run.stdout);
  await writeFile(finalFramePath, finalFrame);
  const cueRaw = await readFile(cuePath, "utf8");
  const observedCueTypes = parseCueTypes(cueRaw);
  return {
    expectedCue: options.caseId,
    keys: options.keys,
    exitCode: run.exitCode,
    timedOut: run.timedOut,
    observedCueTypes,
    hasExpectedCue: observedCueTypes.includes(options.caseId),
    cueEvidencePath: cuePath,
    ansiOutputPath: ansiPath,
    finalFramePath,
    parsedHudLines: parseHudLines(finalFrame),
  };
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
OpenSudoku live gameplay 20-step evidence harness

Usage:
  bun run scripts/live/live-gameplay-20-step-evidence.ts [--json <path>]
`);
  process.exit(0);
}

const outputPath = parseOutputPath(process.argv.slice(2));
const outputDir = dirname(outputPath);
await mkdir(outputDir, { recursive: true });

const latencyKeys = ["p", ...LATENCY_KEYS, "q"];
const latencyRun = await runSession({
  keys: latencyKeys,
  captureLatency: true,
  keyDelayMs: 35,
  timeoutMs: 6_000,
});
const latencyAnsiPath = join(outputDir, "gameplay-input-live-20-step.ansi.txt");
const latencyFramePath = join(outputDir, "gameplay-input-live-20-step.final-frame.txt");
const latencyFrame = reconstructFinalFrame(latencyRun.stdout);
const latencyHudLines = parseHudLines(latencyFrame);
const remainingHintsAfterScriptedHint = Number.parseInt(
  latencyHudLines.Hints?.replace(/^Hints:\s*/, "") ?? "-1",
  10,
);
const latencyEndMs = performance.now();
const latencyMs = Math.max(0, latencyEndMs - (latencyRun.latencyStartMs ?? latencyEndMs));
await writeFile(latencyAnsiPath, latencyRun.stdout);
await writeFile(latencyFramePath, latencyFrame);

const failCase = await runCueCase({ caseId: "fail", keys: ["p", "d", "d", "5", "q"], outputDir });
const successCase = await runCueCase({
  caseId: "success",
  keys: ["p", "d", "d", "4", "q"],
  outputDir,
});
const completionCase = await runCueCase({
  caseId: "complete",
  keys: ["p", "5", "q"],
  startBoard: ALMOST_SOLVED_BOARD,
  outputDir,
});

const artifact = {
  generatedAt: new Date().toISOString(),
  assertion: "VAL-GAMEPLAY-009",
  scriptType: "live-play-20-step-canonical",
  playInputCount: LATENCY_KEYS.length,
  latencyBudgetMs: LATENCY_BUDGET_MS,
  withinBudget: latencyMs <= LATENCY_BUDGET_MS,
  latencyRun: {
    keys: latencyKeys,
    latencyMs: Number(latencyMs.toFixed(3)),
    measurementWindow: { start: "first-play-input", end: "final-captured-frame" },
    exitCode: latencyRun.exitCode,
    timedOut: latencyRun.timedOut,
    remainingHintsAfterScriptedHint,
    ansiOutputPath: latencyAnsiPath,
    finalFramePath: latencyFramePath,
    parsedHudLines: latencyHudLines,
  },
  terminalFeedbackEvidence: {
    failCase,
    successCase,
    completionCase,
  },
  completionPath: {
    expectedCue: completionCase.expectedCue,
    keys: completionCase.keys,
    finalFramePath: completionCase.finalFramePath,
    parsedHudLines: completionCase.parsedHudLines,
    cueEvidencePath: completionCase.cueEvidencePath,
  },
};

await writeFile(outputPath, JSON.stringify(artifact, null, 2));
const cueChecks = [failCase, successCase, completionCase];
const cuesPassed = cueChecks.every(
  (check) =>
    check.exitCode === 0 &&
    !check.timedOut &&
    check.hasExpectedCue &&
    check.observedCueTypes.length === 1,
);
const latencyPassed =
  artifact.withinBudget &&
  Number.isFinite(artifact.latencyRun.latencyMs) &&
  artifact.latencyRun.exitCode === 0 &&
  !artifact.latencyRun.timedOut;
if (!latencyPassed || !cuesPassed) process.exit(1);
process.exit(0);
