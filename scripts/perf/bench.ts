#!/usr/bin/env bun

// Benchmark script for OpenSudoku (writes evidence to dist/evidence/)
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "path";
import { fileURLToPath } from "url";
import { createPuzzle, Difficulty } from "../../src/domain/generator";
import { parseBoard } from "../../src/domain/board";
import { solve } from "../../src/domain/solver";
import { createTestRenderer } from "@opentui/core/testing";
import { createGameplayController } from "../../src/app/gameplay";
import { mountGameplayScreen } from "../../src/ui/shell";
import { buildSignoff } from "./bench-signoff";

const __dirname = dirname(fileURLToPath(import.meta.url));
const evidenceDir = join(__dirname, "..", "..", "dist", "evidence");
const repoRoot = join(__dirname, "..", "..");
const SOLVABLE_FIXTURE =
  "530070000600195000098000060800060003400803001700020006060000280000419005000080079";

// Handle --help flag
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
OpenSudoku Benchmark

Usage:
  bun run bench [options]

Options:
  --help, -h       Show this help message
  --suite <name>  Suite to run (default: "default", "full" for all)
  --json <path>   Write JSON results to specified path

Description:
  Runs performance benchmarks for the Sudoku engine.
`);
  process.exit(0);
}

// Parse arguments
const suiteArgIndex = process.argv.indexOf("--suite");
const jsonArgIndex = process.argv.indexOf("--json");

const suite = suiteArgIndex !== -1 ? process.argv[suiteArgIndex + 1] : "default";

const resolveToRepoRoot = (value: string): string =>
  isAbsolute(value) ? value : resolve(repoRoot, value);
const outputPath =
  jsonArgIndex !== -1
    ? resolveToRepoRoot(process.argv[jsonArgIndex + 1]!)
    : join(evidenceDir, "task-11-bench.json");
const signoffArgIndex = process.argv.indexOf("--signoff");
const signoffPath =
  signoffArgIndex !== -1
    ? resolveToRepoRoot(process.argv[signoffArgIndex + 1]!)
    : join(dirname(outputPath), "task-11-signoff.json");

interface BenchmarkResult {
  timestamp: string;
  suite: string;
  exitCode: number;
  benchmarks: {
    name: string;
    durationMs: number;
    runs: number;
    avgHeapUsedDeltaBytes: number;
    peakHeapUsedBytes: number;
    peakRssBytes: number;
  }[];
}

interface HotPathMetric {
  name: string;
  durationMs: number;
  runs: number;
  avgDurationMs: number;
  avgHeapUsedDeltaBytes: number;
  peakHeapUsedBytes: number;
  peakRssBytes: number;
}

interface HotPathEvidence {
  generatedAt: string;
  benchmarkTimestamp: string;
  suite: string;
  benchOutputPath: string;
  metrics: HotPathMetric[];
}

async function runStartupIteration(): Promise<void> {
  const startup = Bun.spawn(["bun", "run", "start", "--", "--help"], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  const exitCode = await startup.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(startup.stderr).text();
    throw new Error(`startup benchmark failed (exit=${exitCode}) ${stderr}`);
  }
}

async function runRenderIteration(): Promise<void> {
  const testRenderer = await createTestRenderer({
    width: 100,
    height: 30,
    useAlternateScreen: false,
    useConsole: false,
  });
  const controller = createGameplayController();
  const mounted = mountGameplayScreen(testRenderer.renderer, controller.getViewModel());

  try {
    await testRenderer.renderOnce();
    const frame = testRenderer.captureCharFrame();
    if (!frame.includes("OpenSudoku")) {
      throw new Error("render benchmark did not produce expected root frame content");
    }
  } finally {
    mounted.cleanup();
    testRenderer.renderer.destroy();
  }
}

function runSolveIteration(): void {
  const board = parseBoard(SOLVABLE_FIXTURE);
  const result = solve(board);
  if (result.status !== "solved" || !result.solution) {
    throw new Error("solve benchmark did not produce solved result");
  }
}

function runGenerateIteration(): void {
  const result = createPuzzle(Difficulty.Medium);
  if (result.status !== "success" || !result.puzzle) {
    throw new Error("generate benchmark did not produce puzzle");
  }
}

async function benchmark(
  name: string,
  runs: number,
  fn: () => Promise<void> | void,
): Promise<{
  name: string;
  durationMs: number;
  runs: number;
  avgHeapUsedDeltaBytes: number;
  peakHeapUsedBytes: number;
  peakRssBytes: number;
}> {
  const started = performance.now();
  const heapDeltas: number[] = [];
  let peakHeapUsedBytes = 0;
  let peakRssBytes = 0;

  for (let i = 0; i < runs; i++) {
    const before = process.memoryUsage();
    await fn();
    const after = process.memoryUsage();
    heapDeltas.push(after.heapUsed - before.heapUsed);
    peakHeapUsedBytes = Math.max(peakHeapUsedBytes, after.heapUsed);
    peakRssBytes = Math.max(peakRssBytes, after.rss);
  }

  const durationMs = Math.max(0.001, performance.now() - started);
  const avgHeapUsedDeltaBytes = heapDeltas.reduce((sum, value) => sum + value, 0) / runs;
  return { name, durationMs, runs, avgHeapUsedDeltaBytes, peakHeapUsedBytes, peakRssBytes };
}

const result: BenchmarkResult = {
  timestamp: new Date().toISOString(),
  suite,
  exitCode: 0,
  benchmarks: [],
};

const suites: Record<
  string,
  Array<{ name: string; runs: number; fn: () => Promise<void> | void }>
> = {
  default: [
    { name: "startup", runs: 3, fn: runStartupIteration },
    { name: "solve", runs: 30, fn: runSolveIteration },
  ],
  full: [
    { name: "startup", runs: 3, fn: runStartupIteration },
    { name: "render", runs: 10, fn: runRenderIteration },
    { name: "solve", runs: 30, fn: runSolveIteration },
    { name: "generate", runs: 5, fn: runGenerateIteration },
  ],
};

const selectedSuite = suites[suite];
if (!selectedSuite) {
  console.error(`Unknown benchmark suite: ${suite}`);
  process.exit(1);
}

console.log(`Running benchmarks... (suite: ${suite})`);

for (const item of selectedSuite) {
  result.benchmarks.push(await benchmark(item.name, item.runs, item.fn));
}

console.log("Benchmarks completed!");

// Write evidence
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(result, null, 2));
console.log(`Evidence written to: ${outputPath}`);

const hotPathOutputPath = join(dirname(outputPath), "task-11-hot-path-performance.json");
const hotPathEvidence: HotPathEvidence = {
  generatedAt: new Date().toISOString(),
  benchmarkTimestamp: result.timestamp,
  suite,
  benchOutputPath: outputPath,
  metrics: result.benchmarks.map((entry) => ({
    name: entry.name,
    durationMs: entry.durationMs,
    runs: entry.runs,
    avgDurationMs: entry.durationMs / entry.runs,
    avgHeapUsedDeltaBytes: entry.avgHeapUsedDeltaBytes,
    peakHeapUsedBytes: entry.peakHeapUsedBytes,
    peakRssBytes: entry.peakRssBytes,
  })),
};
await writeFile(hotPathOutputPath, JSON.stringify(hotPathEvidence, null, 2));
console.log(`Hot-path evidence written to: ${hotPathOutputPath}`);

const smokePath = join(dirname(outputPath), "task-11-smoke.json");
const liveTranscriptPath = join(
  dirname(outputPath),
  "task-11-live-startup-root-play-first-input-clean-exit.json",
);
const signoff = await buildSignoff({
  suite,
  outputPath,
  smokePath,
  liveTranscriptPath,
  hotPathArtifactPaths: [hotPathOutputPath],
});
await writeFile(signoffPath, JSON.stringify(signoff, null, 2));
console.log(`Signoff written to: ${signoffPath}`);

process.exit(0);
