import { join } from "node:path";
import { writeFile } from "node:fs/promises";

export async function runBench(outputPath: string): Promise<{ exitCode: number; stderr: string }> {
  const proc = Bun.spawn(
    ["bun", "run", "bench", "--", "--suite", "default", "--json", outputPath],
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [exitCode, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
  return { exitCode, stderr };
}

export async function writeBenchArtifact(
  path: string,
  timestamp = new Date().toISOString(),
): Promise<void> {
  await writeFile(
    path,
    JSON.stringify(
      {
        timestamp,
        suite: "default",
        exitCode: 0,
        benchmarks: [{ name: "startup", runs: 1, durationMs: 1 }],
      },
      null,
      2,
    ),
  );
}

export async function writeHotPathArtifact(options: {
  path: string;
  benchOutputPath: string;
  generatedAt?: string;
  benchTimestamp?: string;
  metrics?: Array<{ name: string; durationMs: number; runs: number; avgDurationMs: number }>;
}): Promise<void> {
  await writeFile(
    options.path,
    JSON.stringify(
      {
        generatedAt: options.generatedAt ?? new Date().toISOString(),
        benchmarkTimestamp: options.benchTimestamp ?? new Date().toISOString(),
        suite: "default",
        benchOutputPath: options.benchOutputPath,
        metrics: options.metrics ?? [{ name: "startup", durationMs: 1, runs: 1, avgDurationMs: 1 }],
      },
      null,
      2,
    ),
  );
}

export async function writeSmokeAndTranscriptArtifacts(options: {
  tempDir: string;
  smokeTimestamp?: string;
  transcriptTimestamp?: string;
  transcriptPath?: string;
  smokeBodyOverride?: string;
}): Promise<void> {
  const transcriptPath =
    options.transcriptPath ??
    join(options.tempDir, "task-11-live-startup-root-play-first-input-clean-exit.json");
  const smokePath = join(options.tempDir, "task-11-smoke.json");
  const smokeTimestamp = options.smokeTimestamp ?? new Date().toISOString();
  const transcriptTimestamp = options.transcriptTimestamp ?? smokeTimestamp;

  if (!options.smokeBodyOverride) {
    await writeFile(
      transcriptPath,
      JSON.stringify(
        {
          timestamp: transcriptTimestamp,
          phases: [
            { phase: "startup-root", observed: true, signal: "OpenSudoku", signalIndex: 10 },
            { phase: "play-entry", observed: true, signal: "Timer:", signalIndex: 20 },
            { phase: "first-input", observed: true, signal: "Status:", signalIndex: 30 },
            { phase: "clean-exit", observed: true, signal: "exit=0", signalIndex: 40 },
          ],
        },
        null,
        2,
      ),
    );
  }

  const smokeBody =
    options.smokeBodyOverride ??
    JSON.stringify(
      {
        timestamp: smokeTimestamp,
        exitCode: 0,
        checks: [{ name: "live-startup-root-play-first-input-clean-exit", passed: true }],
        artifacts: { liveStartupTranscript: transcriptPath },
      },
      null,
      2,
    );
  await writeFile(smokePath, smokeBody);
}
