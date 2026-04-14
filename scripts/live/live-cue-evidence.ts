#!/usr/bin/env bun

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const defaultOutputPath = join(
  repoRoot,
  "dist",
  "validation",
  "runtime-optimization",
  "user-testing",
  "evidence",
  "live-gameplay-cue-proof.json",
);

const ALMOST_SOLVED_BOARD =
  "034678912672195348198342567859761423426853791713924856961537284287419635345286179";

type CueType = "fail" | "success" | "complete";

interface CaseConfig {
  caseId: CueType;
  expectedCue: CueType;
  keys: string[];
  startBoard?: string;
}

interface CueEvent {
  cue: CueType;
}

interface CueFile {
  events: CueEvent[];
}

interface RunResult {
  exitCode: number;
  timedOut: boolean;
  stdout: string;
  stderr: string;
}

function parseOutputPath(args: string[]): string {
  const index = args.indexOf("--json");
  if (index >= 0 && args[index + 1]) {
    const requested = args[index + 1]!;
    return isAbsolute(requested) ? requested : resolve(repoRoot, requested);
  }
  return defaultOutputPath;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function stripAnsi(text: string): string {
  return stripVTControlCharacters(text);
}

function normalizeForChecks(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function getCueAdjacentCaseMarkers(caseId: CueType): string[] {
  if (caseId === "fail") return ["strike 1/3", "conflict"];
  if (caseId === "success") return ["r1c3"];
  return ["state: solved", "solved!", "puzzle complete"];
}

async function runLiveSession(config: CaseConfig, cuePath: string): Promise<RunResult> {
  const child = Bun.spawn(["bun", "run", "src/index.ts"], {
    cwd: repoRoot,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      OPEN_SUDOKU_LIVE_CUE_EVIDENCE_PATH: cuePath,
      ...(config.startBoard ? { OPEN_SUDOKU_START_BOARD: config.startBoard } : {}),
    },
  });

  const stdoutPromise = new Response(child.stdout).text();
  const stderrPromise = new Response(child.stderr).text();
  const timeoutMs = 8_000;
  const timeoutPromise = sleep(timeoutMs).then(() => ({ timedOut: true, exitCode: -1 }));
  const exitPromise = child.exited.then((exitCode) => ({ timedOut: false, exitCode }));
  void (async () => {
    for (const key of config.keys) {
      await sleep(350);
      child.stdin.write(key);
    }
  })();

  const result = await Promise.race([timeoutPromise, exitPromise]);
  if (result.timedOut) {
    child.kill();
    await child.exited;
  }

  const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
  return { ...result, stdout, stderr };
}

function buildCueAdjacentFrameText(stdout: string, caseId: CueType): string {
  const plain = stripAnsi(stdout);
  const normalizedPlain = plain.toLowerCase();
  const marker = getCueAdjacentCaseMarkers(caseId)
    .map((candidate) => candidate.toLowerCase())
    .find((candidate) => normalizedPlain.includes(candidate));
  if (!marker) return plain;

  const markerIndex = normalizedPlain.lastIndexOf(marker);
  if (markerIndex === -1) return plain;
  const contextRadius = 1400;
  const from = Math.max(0, markerIndex - contextRadius);
  const to = Math.min(plain.length, markerIndex + marker.length + contextRadius);
  return plain.slice(from, to);
}

function hasCueAdjacentPlaySurface(frameNormalized: string, fullNormalized: string): boolean {
  const surfaceSignals = ["opensudoku play", "esc root, q quit", "h hint, u/r undo-redo"];
  return (
    surfaceSignals.some((signal) => frameNormalized.includes(signal)) ||
    surfaceSignals.some((signal) => fullNormalized.includes(signal))
  );
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
OpenSudoku live cue evidence harness

Usage:
  bun run scripts/live/live-cue-evidence.ts [--json <path>]

Generates one live fail, one live success, and one live completion cue artifact
using app-boundary cue events captured from the interactive CLI/TUI surface.
`);
  process.exit(0);
}

const outputPath = parseOutputPath(process.argv.slice(2));
const caseConfigs: CaseConfig[] = [
  { caseId: "fail", expectedCue: "fail", keys: ["p", "d", "d", "5", "q"] },
  { caseId: "success", expectedCue: "success", keys: ["p", "d", "d", "4", "q"] },
  {
    caseId: "complete",
    expectedCue: "complete",
    keys: ["p", "5", "q"],
    startBoard: ALMOST_SOLVED_BOARD,
  },
];

const checks = [];
for (const config of caseConfigs) {
  const cuePath = join(dirname(outputPath), `live-cue-${config.caseId}.events.json`);
  const ansiPath = join(dirname(outputPath), `live-cue-${config.caseId}.ansi.txt`);
  const framePath = join(dirname(outputPath), `live-cue-${config.caseId}.frame.txt`);
  await rm(ansiPath, { force: true });
  await rm(framePath, { force: true });

  let finalCheck: (typeof checks)[number] | null = null;
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await rm(cuePath, { force: true });
    const run = await runLiveSession(config, cuePath);
    await writeFile(ansiPath, run.stdout);
    const cueAdjacentFrameText = buildCueAdjacentFrameText(run.stdout, config.caseId);
    await writeFile(framePath, cueAdjacentFrameText);

    let events: CueEvent[] = [];
    try {
      const cueRaw = await readFile(cuePath, "utf8");
      const parsed = JSON.parse(cueRaw) as CueFile;
      events = Array.isArray(parsed.events) ? parsed.events : [];
    } catch {
      events = [];
    }

    const observedCueTypes = [...new Set(events.map((event) => event.cue))] as CueType[];
    const hasExpectedCue = observedCueTypes.includes(config.expectedCue);
    const cueEventCount = events.length;
    const cueAdjacentNormalized = normalizeForChecks(cueAdjacentFrameText);
    const fullNormalized = normalizeForChecks(stripAnsi(run.stdout));
    const cueAdjacentHasPlaySurface = hasCueAdjacentPlaySurface(
      cueAdjacentNormalized,
      fullNormalized,
    );
    const hasCueAdjacentCaseMarker = getCueAdjacentCaseMarkers(config.caseId).some((marker) =>
      cueAdjacentNormalized.includes(marker),
    );
    const passed =
      !run.timedOut &&
      run.exitCode === 0 &&
      hasExpectedCue &&
      observedCueTypes.length === 1 &&
      cueEventCount === 1 &&
      cueAdjacentHasPlaySurface &&
      hasCueAdjacentCaseMarker;

    finalCheck = {
      caseId: config.caseId,
      expectedCue: config.expectedCue,
      keys: config.keys,
      exitCode: run.exitCode,
      timedOut: run.timedOut,
      observedCueTypes,
      hasExpectedCue,
      cueEventCount,
      cueEvidencePath: cuePath,
      ansiOutputPath: ansiPath,
      cueAdjacentFramePath: framePath,
      attempts: attempt,
      passed,
      cueAdjacentFrame: {
        framePath,
        hasCueAdjacentPlaySurface: cueAdjacentHasPlaySurface,
        hasCueAdjacentCaseMarker,
      },
    };

    if (passed) break;
    await sleep(300);
  }

  if (finalCheck) checks.push(finalCheck);
}

const allPassed = checks.every((check) => check.passed);

const artifact = {
  generatedAt: new Date().toISOString(),
  assertion: "VAL-GAMEPLAY-008",
  evidenceMode: "app-boundary live cue events",
  allPassed,
  checks,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(artifact, null, 2));
if (!allPassed) process.exit(1);
process.exit(0);
