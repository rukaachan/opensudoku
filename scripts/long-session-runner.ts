import type { KeyStep, LivePhase, Sample } from "./long-session-phases";

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function runLivePhase(options: {
  repoRoot: string;
  name: string;
  keySteps: KeyStep[];
  sampleTimesMs: number[];
  durationMs: number;
  startBoard?: string;
  sleepMs?: number;
}): Promise<LivePhase> {
  const child = Bun.spawn(["bun", "run", "src/index.ts"], {
    cwd: options.repoRoot,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      ...(options.startBoard ? { OPEN_SUDOKU_START_BOARD: options.startBoard } : {}),
    },
  });
  const stdoutPromise = new Response(child.stdout).text();
  const stderrPromise = new Response(child.stderr).text();
  const start = Date.now();
  const samples: Sample[] = [];
  let keyIndex = 0;
  let sampleIndex = 0;
  while (Date.now() - start <= options.durationMs) {
    const elapsed = Date.now() - start;
    while (keyIndex < options.keySteps.length && options.keySteps[keyIndex]!.atMs <= elapsed) {
      child.stdin.write(options.keySteps[keyIndex++]!.key);
    }
    while (
      sampleIndex < options.sampleTimesMs.length &&
      options.sampleTimesMs[sampleIndex]! <= elapsed
    ) {
      const usage = child.resourceUsage();
      samples.push({
        elapsedMs: options.sampleTimesMs[sampleIndex++]!,
        sampledPid: child.pid,
        timestamp: new Date().toISOString(),
        cpuMs: Number(usage.cpuTime.total) / 1_000_000,
        privateBytes: usage.maxRSS * 1024,
        workingSetBytes: usage.maxRSS * 1024,
      });
    }
    await sleep(options.sleepMs ?? 25);
  }
  child.stdin.write("q");
  await sleep(120);
  child.stdin.write("q");
  const exitCode = await child.exited;
  const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
  return {
    phase: options.name,
    pid: child.pid,
    generatedAt: new Date().toISOString(),
    exitCode,
    responsive: exitCode === 0,
    sampleCount: samples.length,
    privateMemoryDeltaMb:
      samples.length > 1
        ? Number(
            ((samples.at(-1)!.privateBytes - samples[0]!.privateBytes) / 1024 / 1024).toFixed(3),
          )
        : 0,
    samples,
    stdoutTail: stdout.slice(-500),
    stderrTail: stderr.slice(-500),
  };
}
