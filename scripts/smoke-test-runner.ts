import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "path";
import { stripVTControlCharacters } from "node:util";

export interface SmokeCheck {
  name: string;
  passed: boolean;
  details?: string;
}

export interface SmokeResult {
  timestamp: string;
  exitCode: number;
  checks: SmokeCheck[];
  artifacts?: {
    liveStartupTranscript?: string;
    liveStartupRawOutput?: string;
  };
}

export interface LiveStartupCheckResult {
  passed: boolean;
  details: string;
  transcriptPath: string;
  rawOutputPath: string;
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function parseOutputPath(args: string[], evidenceDir: string, repoRoot: string): string {
  const jsonArgIndex = args.indexOf("--json");
  if (jsonArgIndex !== -1 && args[jsonArgIndex + 1]) {
    const requested = args[jsonArgIndex + 1]!;
    return isAbsolute(requested) ? requested : resolve(repoRoot, requested);
  }
  return join(evidenceDir, "task-11-smoke.json");
}

export async function runAppSession(options: {
  repoRoot: string;
  keys?: string[];
  interrupt?: boolean;
  timeoutMs?: number;
  keyDelayMs?: number;
}): Promise<{ exitCode: number; timedOut: boolean; stdout: string; stderr: string }> {
  const child = Bun.spawn(["bun", "run", "src/index.ts"], {
    cwd: options.repoRoot,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });

  const timeoutMs = options.timeoutMs ?? 5000;
  const keyDelayMs = options.keyDelayMs ?? 80;
  const exitPromise = child.exited.then((exitCode) => ({ exitCode, timedOut: false }));
  const timeoutPromise = sleep(timeoutMs).then(() => ({ exitCode: -1, timedOut: true }));
  const stdoutPromise = new Response(child.stdout).text();
  const stderrPromise = new Response(child.stderr).text();

  if (options.keys?.length) {
    void (async () => {
      for (const key of options.keys) {
        await sleep(keyDelayMs);
        child.stdin.write(key);
      }
    })();
  }

  if (options.interrupt) {
    void (async () => {
      await sleep(250);
      child.kill("SIGINT");
    })();
  }

  const result = await Promise.race([exitPromise, timeoutPromise]);
  if (result.timedOut) {
    child.kill();
    await child.exited;
  }
  const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
  return { ...result, stdout, stderr };
}

async function runLiveStartupCheck(
  repoRoot: string,
  outputPath: string,
  attempt: number,
): Promise<LiveStartupCheckResult> {
  const run = await runAppSession({
    repoRoot,
    keys: ["p", "5", "q"],
    timeoutMs: 8000,
    keyDelayMs: 350,
  });
  const plainOutput = stripVTControlCharacters(run.stdout);
  const rootSignal = "OpenSudoku";
  const playSignal = "Timer:";
  const firstInputSignal = "Status:";
  const rootSignalIndex = plainOutput.indexOf(rootSignal);
  const playSignalIndex = plainOutput.indexOf(playSignal);
  const firstStatusSignalIndex = plainOutput.indexOf(firstInputSignal);
  const firstInputSignalIndex =
    firstStatusSignalIndex === -1
      ? -1
      : plainOutput.indexOf(firstInputSignal, firstStatusSignalIndex + firstInputSignal.length);
  const hasRootFrame = rootSignalIndex !== -1 && plainOutput.includes("Play");
  const hasPlayFrame = playSignalIndex !== -1 && plainOutput.includes("Active:");
  const hasFirstInput = firstInputSignalIndex !== -1;
  const phasesOrdered =
    rootSignalIndex !== -1 &&
    playSignalIndex > rootSignalIndex &&
    firstInputSignalIndex > playSignalIndex;

  const transcript = {
    timestamp: new Date().toISOString(),
    attempt,
    keySequence: ["p", "5", "q"],
    phases: [
      {
        phase: "startup-root",
        observed: hasRootFrame,
        signal: rootSignal,
        signalIndex: rootSignalIndex,
      },
      {
        phase: "play-entry",
        observed: hasPlayFrame,
        signal: playSignal,
        signalIndex: playSignalIndex,
      },
      {
        phase: "first-input",
        observed: hasFirstInput,
        signal: firstInputSignal,
        signalIndex: firstInputSignalIndex,
      },
      {
        phase: "clean-exit",
        observed: !run.timedOut && run.exitCode === 0,
        exitCode: run.exitCode,
        timedOut: run.timedOut,
      },
    ],
  };

  const transcriptPath = join(
    dirname(outputPath),
    "task-11-live-startup-root-play-first-input-clean-exit.json",
  );
  const rawOutputPath = join(
    dirname(outputPath),
    "task-11-live-startup-root-play-first-input-clean-exit.ansi.txt",
  );
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(transcriptPath, JSON.stringify(transcript, null, 2));
  await writeFile(rawOutputPath, run.stdout);
  return {
    passed:
      hasRootFrame &&
      hasPlayFrame &&
      hasFirstInput &&
      phasesOrdered &&
      !run.timedOut &&
      run.exitCode === 0,
    details: `attempt=${attempt} exit=${run.exitCode} timedOut=${run.timedOut} ordered=${phasesOrdered} transcript=${transcriptPath}`,
    transcriptPath,
    rawOutputPath,
  };
}

export async function runLiveStartupCheckWithRetries(
  repoRoot: string,
  outputPath: string,
): Promise<LiveStartupCheckResult> {
  let finalResult = await runLiveStartupCheck(repoRoot, outputPath, 1);
  if (finalResult.passed) return finalResult;
  for (let attempt = 2; attempt <= 3; attempt += 1) {
    await sleep(300);
    finalResult = await runLiveStartupCheck(repoRoot, outputPath, attempt);
    if (finalResult.passed) break;
  }
  return finalResult;
}

export async function addCheck(
  result: SmokeResult,
  name: string,
  fn: () => Promise<{ passed: boolean; details?: string }>,
): Promise<void> {
  try {
    const check = await fn();
    result.checks.push({ name, passed: check.passed, details: check.details });
    if (!check.passed) result.exitCode = 1;
  } catch (error) {
    result.checks.push({ name, passed: false, details: String(error) });
    result.exitCode = 1;
  }
}
