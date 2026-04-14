import { describe, test, expect } from "bun:test";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildSignoff } from "../../../scripts/perf/bench-signoff";
import {
  runBench,
  writeBenchArtifact,
  writeHotPathArtifact,
  writeSmokeAndTranscriptArtifacts,
} from "./benchmark-evidence-support";
interface BenchEntry {
  name: string;
  durationMs: number;
  runs: number;
}

interface BenchEvidence {
  exitCode: number;
  suite: string;
  benchmarks: BenchEntry[];
}

interface SignoffEvidence {
  suite: string;
  artifacts: Array<{
    path: string;
    exists: boolean;
    readable: boolean;
  }>;
}

describe("Benchmark evidence", () => {
  test(
    "full suite writes named startup/render/solve/generate measurements",
    async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "opensudoku-bench-"));
      const outputPath = join(tempDir, "task-11-bench.json");

      try {
        await writeSmokeAndTranscriptArtifacts({ tempDir });
        const proc = Bun.spawn(
          ["bun", "run", "bench", "--", "--suite", "full", "--json", outputPath],
          {
            stdout: "pipe",
            stderr: "pipe",
          },
        );
        const [exitCode, stderr] = await Promise.all([
          proc.exited,
          new Response(proc.stderr).text(),
        ]);
        expect(exitCode, stderr || "bench exited non-zero").toBe(0);

        const raw = await readFile(outputPath, "utf-8");
        const evidence = JSON.parse(raw) as BenchEvidence;
        const entriesByName = new Map(evidence.benchmarks.map((entry) => [entry.name, entry]));

        expect(evidence.exitCode).toBe(0);
        expect(evidence.suite).toBe("full");
        expect(entriesByName.has("startup")).toBe(true);
        expect(entriesByName.has("render")).toBe(true);
        expect(entriesByName.has("solve")).toBe(true);
        expect(entriesByName.has("generate")).toBe(true);
        expect(entriesByName.has("harness-verification")).toBe(false);

        for (const name of ["startup", "render", "solve", "generate"]) {
          const entry = entriesByName.get(name);
          expect(entry).toBeDefined();
          expect(entry!.runs).toBeGreaterThan(0);
          expect(entry!.durationMs).toBeGreaterThan(0);
        }

        const signoffPath = join(tempDir, "task-11-signoff.json");
        const signoffRaw = await readFile(signoffPath, "utf-8");
        const signoff = JSON.parse(signoffRaw) as SignoffEvidence;
        expect(signoff.suite).toBe("full");
        const benchArtifact = signoff.artifacts.find((artifact) => artifact.path === outputPath);
        expect(benchArtifact?.exists).toBe(true);
        expect(benchArtifact?.readable).toBe(true);
        expect(
          signoff.artifacts.some((artifact) =>
            artifact.path.endsWith("task-11-hot-path-performance.json"),
          ),
        ).toBe(true);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    },
    { timeout: 20_000 },
  );

  test(
    "signoff fails when smoke artifact is missing, unreadable, stale, or out-of-sync",
    async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "opensudoku-bench-signoff-"));
      const outputPath = join(tempDir, "task-11-bench.json");

      try {
        const missingSmoke = await runBench(outputPath);
        expect(missingSmoke.exitCode).not.toBe(0);

        await writeSmokeAndTranscriptArtifacts({ tempDir, smokeBodyOverride: "{not-json" });
        const unreadableSmoke = await runBench(outputPath);
        expect(unreadableSmoke.exitCode).not.toBe(0);

        await writeSmokeAndTranscriptArtifacts({
          tempDir,
          smokeTimestamp: "2020-01-01T00:00:00.000Z",
          transcriptTimestamp: "2020-01-01T00:00:00.000Z",
        });
        const staleSmoke = await runBench(outputPath);
        expect(staleSmoke.exitCode).not.toBe(0);

        await writeSmokeAndTranscriptArtifacts({
          tempDir,
          transcriptPath: join(tempDir, "some-other-transcript.json"),
        });
        const outOfSyncSmoke = await runBench(outputPath);
        expect(outOfSyncSmoke.exitCode).not.toBe(0);

        const now = new Date().toISOString();
        const liveTranscriptPath = join(
          tempDir,
          "task-11-live-startup-root-play-first-input-clean-exit.json",
        );
        const hotPathPath = join(tempDir, "task-11-hot-path-performance.json");

        await writeBenchArtifact(outputPath, now);
        await writeSmokeAndTranscriptArtifacts({
          tempDir,
          smokeTimestamp: now,
          transcriptTimestamp: now,
        });
        await unlink(hotPathPath).catch(() => undefined);

        await expect(
          buildSignoff({
            suite: "default",
            outputPath,
            smokePath: join(tempDir, "task-11-smoke.json"),
            liveTranscriptPath,
            hotPathArtifactPaths: [hotPathPath],
          }),
        ).rejects.toThrow("missing");

        await writeFile(hotPathPath, "{not-json");
        await expect(
          buildSignoff({
            suite: "default",
            outputPath,
            smokePath: join(tempDir, "task-11-smoke.json"),
            liveTranscriptPath,
            hotPathArtifactPaths: [hotPathPath],
          }),
        ).rejects.toThrow("unreadable JSON");

        await writeHotPathArtifact({
          path: hotPathPath,
          benchOutputPath: outputPath,
          generatedAt: "2020-01-01T00:00:00.000Z",
          benchTimestamp: "2020-01-01T00:00:00.000Z",
        });
        await expect(
          buildSignoff({
            suite: "default",
            outputPath,
            smokePath: join(tempDir, "task-11-smoke.json"),
            liveTranscriptPath,
            hotPathArtifactPaths: [hotPathPath],
          }),
        ).rejects.toThrow("stale");

        await writeHotPathArtifact({
          path: hotPathPath,
          benchOutputPath: outputPath,
          generatedAt: now,
          benchTimestamp: now,
          metrics: [],
        });
        await expect(
          buildSignoff({
            suite: "default",
            outputPath,
            smokePath: join(tempDir, "task-11-smoke.json"),
            liveTranscriptPath,
            hotPathArtifactPaths: [hotPathPath],
          }),
        ).rejects.toThrow("placeholder");

        await writeHotPathArtifact({
          path: hotPathPath,
          benchOutputPath: join(tempDir, "different-bench.json"),
          generatedAt: now,
          benchTimestamp: now,
        });
        await expect(
          buildSignoff({
            suite: "default",
            outputPath,
            smokePath: join(tempDir, "task-11-smoke.json"),
            liveTranscriptPath,
            hotPathArtifactPaths: [hotPathPath],
          }),
        ).rejects.toThrow("out-of-sync");
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    },
    { timeout: 20_000 },
  );
});
