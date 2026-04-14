#!/usr/bin/env bun

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseRequiredHudLines, type HudLines } from "./live-candidate-workflow-hud.ts";
import { createStreamCollector, reconstructFinalFrame, sleep } from "./live-terminal-frame";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const DEFAULT_OUTPUT_PATH = join(
  repoRoot,
  "dist",
  "validation",
  "candidate-productivity",
  "user-testing",
  "evidence",
  "live-candidate-workflow.json",
);
const EXIT_KEYS = ["q", "q"] as const;

type WorkflowStepId =
  | "enter-play"
  | "toggle-notes"
  | "add-note"
  | "remove-note"
  | "clear-note-only"
  | "request-hint";

type WorkflowStep = { id: WorkflowStepId; keys: string[] };

type StepEvidence = {
  id: WorkflowStepId;
  keys: string[];
  framePath: string;
  ansiOutputPath: string;
  hudLines: HudLines;
  editedCellText: string;
  exitCode: number;
  timedOut: boolean;
};

const CANDIDATE_WORKFLOW: WorkflowStep[] = [
  { id: "enter-play", keys: ["p"] },
  { id: "toggle-notes", keys: ["n"] },
  { id: "add-note", keys: ["d", "d", "1"] },
  { id: "remove-note", keys: ["1"] },
  { id: "clear-note-only", keys: ["\u007f"] },
  { id: "request-hint", keys: ["n", "h"] },
];

const parseOutputPath = (args: string[]): string => {
  const index = args.indexOf("--json");
  if (index >= 0 && args[index + 1]) {
    const requested = args[index + 1]!;
    return isAbsolute(requested) ? requested : resolve(repoRoot, requested);
  }
  return DEFAULT_OUTPUT_PATH;
};

function extractEditedCellText(frame: string, rowIndex: number, colIndex: number): string {
  const boardRows = frame
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(
      (line) =>
        line.includes("│") && !line.includes("┼") && !/[A-Za-z]/.test(line) && /[0-9.]/.test(line),
    );
  const row = boardRows[rowIndex];
  if (!row) throw new Error(`Could not locate board row ${rowIndex + 1} in final frame.`);
  const tokens = row.replaceAll("│", " ").trim().split(/\s+/);
  if (tokens.length < 9) throw new Error(`Expected 9 board tokens, found ${tokens.length}.`);
  return tokens[colIndex] ?? "";
}

async function captureSnapshotWithRetry(
  getAnsiOutput: () => string,
  timeoutMs = 2_500,
): Promise<{
  ansiOutput: string;
  finalFrame: string;
  hudLines: HudLines;
  editedCellText: string;
}> {
  const startedAt = Date.now();
  let lastError: Error | null = null;
  while (Date.now() - startedAt <= timeoutMs) {
    const ansiOutput = getAnsiOutput();
    const clearIndex = ansiOutput.lastIndexOf("\u001b[2J");
    const resetIndex = ansiOutput.lastIndexOf("\u001bc");
    const frameAnsi = ansiOutput.slice(
      Math.max(clearIndex, resetIndex) >= 0 ? Math.max(clearIndex, resetIndex) : 0,
    );
    const finalFrame = reconstructFinalFrame(frameAnsi, 100, 30);

    try {
      return {
        ansiOutput: frameAnsi,
        finalFrame,
        hudLines: parseRequiredHudLines(finalFrame),
        editedCellText: extractEditedCellText(finalFrame, 0, 2),
      };
    } catch (error) {
      lastError = error as Error;
      await sleep(120);
    }
  }

  throw lastError ?? new Error("Timed out waiting for complete HUD snapshot.");
}

async function captureWorkflow(
  outputDir: string,
): Promise<{ steps: StepEvidence[]; exitCode: number; timedOut: boolean; stderr: string }> {
  const child = Bun.spawn(["bun", "run", "src/index.ts"], {
    cwd: repoRoot,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });

  const stdoutCollector = createStreamCollector(child.stdout);
  const stderrCollector = createStreamCollector(child.stderr);
  const steps: StepEvidence[] = [];

  try {
    for (const step of CANDIDATE_WORKFLOW) {
      for (const key of step.keys) {
        await sleep(130);
        child.stdin.write(key);
      }

      await sleep(550);
      const snapshot = await captureSnapshotWithRetry(() => stdoutCollector.getText());
      const ansiOutputPath = join(outputDir, `live-candidate-workflow-${step.id}.ansi.txt`);
      const framePath = join(outputDir, `live-candidate-workflow-${step.id}.frame.txt`);

      await writeFile(ansiOutputPath, snapshot.ansiOutput);
      await writeFile(framePath, snapshot.finalFrame);

      steps.push({
        id: step.id,
        keys: step.keys,
        framePath,
        ansiOutputPath,
        hudLines: snapshot.hudLines,
        editedCellText: snapshot.editedCellText,
        exitCode: 0,
        timedOut: false,
      });
    }

    for (const key of EXIT_KEYS) {
      await sleep(120);
      child.stdin.write(key);
    }

    const exitResult = await Promise.race([
      child.exited.then((exitCode) => ({ timedOut: false as const, exitCode })),
      sleep(6_000).then(() => ({ timedOut: true as const, exitCode: -1 })),
    ]);

    if (exitResult.timedOut) {
      child.kill();
      await child.exited;
    }

    await Promise.all([stdoutCollector.done, stderrCollector.done]);
    return {
      steps,
      exitCode: exitResult.timedOut ? -1 : exitResult.exitCode,
      timedOut: exitResult.timedOut,
      stderr: stderrCollector.getText(),
    };
  } catch (error) {
    child.kill();
    await child.exited;
    await Promise.all([stdoutCollector.done, stderrCollector.done]);
    throw error;
  }
}

const outputPath = parseOutputPath(process.argv.slice(2));
const outputDir = dirname(outputPath);
await mkdir(outputDir, { recursive: true });

const run = await captureWorkflow(outputDir);
const artifact = {
  generatedAt: new Date().toISOString(),
  assertion: "VAL-CUX-011",
  scriptType: "live-candidate-workflow",
  editedCell: "r1c3",
  steps: run.steps,
  exit: {
    keys: [...EXIT_KEYS],
    exitCode: run.exitCode,
    timedOut: run.timedOut,
  },
};

await writeFile(outputPath, JSON.stringify(artifact, null, 2));
const coreChecks = run.steps.every(
  (step) =>
    step.hudLines.Mode && step.hudLines.Status && step.hudLines.Active && step.hudLines.Hints,
);
if (!coreChecks || run.exitCode !== 0 || run.timedOut) {
  if (run.stderr.trim().length > 0) console.error(run.stderr.trim());
  process.exit(1);
}
process.exit(0);
