import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

interface SmokeEvidence {
  exitCode: number;
  checks: Array<{ name: string; passed: boolean }>;
  artifacts?: {
    liveStartupTranscript?: string;
  };
}

interface LiveTranscriptEvidence {
  phases: Array<{
    phase: "startup-root" | "play-entry" | "first-input" | "clean-exit";
    observed: boolean;
    signal?: string;
    signalIndex?: number;
  }>;
}

const RUNTIME_CLEANUP_TEST_TIMEOUT_MS = 20_000;

describe("Runtime cleanup smoke evidence", () => {
  test(
    "smoke evidence verifies quit/interrupt cleanup paths",
    async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "opensudoku-smoke-"));
      const outputPath = join(tempDir, "runtime-cleanup.json");

      try {
        const proc = Bun.spawn(["bun", "run", "smoke-test", "--", "--json", outputPath], {
          stdout: "pipe",
          stderr: "pipe",
        });

        const [exitCode, stderr] = await Promise.all([
          proc.exited,
          new Response(proc.stderr).text(),
        ]);
        expect(exitCode, stderr || "smoke-test exited non-zero").toBe(0);

        const raw = await readFile(outputPath, "utf-8");
        const evidence = JSON.parse(raw) as SmokeEvidence;
        const checkNames = new Set(evidence.checks.map((check) => check.name));

        expect(evidence.exitCode).toBe(0);
        expect(checkNames.has("quit-root-screen")).toBe(true);
        expect(checkNames.has("quit-play-screen")).toBe(true);
        expect(checkNames.has("quit-daily-screen")).toBe(true);
        expect(checkNames.has("quit-generator-screen")).toBe(true);
        expect(checkNames.has("quit-solver-screen")).toBe(true);
        expect(checkNames.has("quit-help-screen")).toBe(true);
        expect(checkNames.has("live-startup-root-play-first-input-clean-exit")).toBe(true);
        expect(checkNames.has("ctrl-c-cleanup")).toBe(true);
        expect(checkNames.has("follow-up-shell-command")).toBe(true);
        expect(evidence.checks.every((check) => check.passed)).toBe(true);
        expect(typeof evidence.artifacts?.liveStartupTranscript).toBe("string");

        const transcriptPath = evidence.artifacts!.liveStartupTranscript!;
        const transcriptRaw = await readFile(transcriptPath, "utf-8");
        const transcript = JSON.parse(transcriptRaw) as LiveTranscriptEvidence;
        const startup = transcript.phases.find((phase) => phase.phase === "startup-root");
        const playEntry = transcript.phases.find((phase) => phase.phase === "play-entry");
        const firstInput = transcript.phases.find((phase) => phase.phase === "first-input");
        const cleanExit = transcript.phases.find((phase) => phase.phase === "clean-exit");

        expect(startup?.observed).toBe(true);
        expect(playEntry?.observed).toBe(true);
        expect(firstInput?.observed).toBe(true);
        expect(cleanExit?.observed).toBe(true);
        expect(playEntry?.signal).toBeDefined();
        expect(firstInput?.signal).toBeDefined();
        expect(firstInput?.signal).toBe("Status:");
        expect(firstInput?.signal).not.toBe(playEntry?.signal);
        expect((startup?.signalIndex ?? -1) >= 0).toBe(true);
        expect((playEntry?.signalIndex ?? -1) > (startup?.signalIndex ?? -1)).toBe(true);
        expect((firstInput?.signalIndex ?? -1) > (playEntry?.signalIndex ?? -1)).toBe(true);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    },
    { timeout: RUNTIME_CLEANUP_TEST_TIMEOUT_MS },
  );

  test(
    "smoke evidence creates sibling transcript artifacts for a fresh nested output directory",
    async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "opensudoku-smoke-nested-"));
      const outputDir = join(tempDir, "nested", "artifacts");
      const outputPath = join(outputDir, "runtime-cleanup.json");

      try {
        const proc = Bun.spawn(["bun", "run", "smoke-test", "--", "--json", outputPath], {
          stdout: "pipe",
          stderr: "pipe",
        });

        const [exitCode, stderr] = await Promise.all([
          proc.exited,
          new Response(proc.stderr).text(),
        ]);
        expect(exitCode, stderr || "smoke-test exited non-zero").toBe(0);

        const raw = await readFile(outputPath, "utf-8");
        const evidence = JSON.parse(raw) as SmokeEvidence;
        expect(evidence.exitCode).toBe(0);
        expect(evidence.artifacts?.liveStartupTranscript).toBe(
          join(outputDir, "task-11-live-startup-root-play-first-input-clean-exit.json"),
        );
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    },
    { timeout: RUNTIME_CLEANUP_TEST_TIMEOUT_MS },
  );
});
