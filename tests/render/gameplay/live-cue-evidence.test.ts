import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

interface CueCaseEvidence {
  caseId: "fail" | "success" | "complete";
  expectedCue: "fail" | "success" | "complete";
  observedCueTypes: Array<"fail" | "success" | "complete">;
  hasExpectedCue: boolean;
  cueEventCount: number;
  passed: boolean;
  cueAdjacentFrame: {
    framePath: string;
    hasCueAdjacentPlaySurface: boolean;
    hasCueAdjacentCaseMarker: boolean;
  };
}

interface LiveCueEvidence {
  checks: CueCaseEvidence[];
  allPassed: boolean;
}

describe("Live gameplay cue evidence harness", () => {
  test(
    "archives distinct fail, success, and completion cue mapping from live CLI/TUI play",
    async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "opensudoku-live-cues-"));
      const outputPath = join(tempDir, "live-cues.json");

      try {
        const proc = Bun.spawn(
          ["bun", "run", "scripts/live/live-cue-evidence.ts", "--", "--json", outputPath],
          {
            stdout: "pipe",
            stderr: "pipe",
          },
        );

        const [exitCode, stderr] = await Promise.all([
          proc.exited,
          new Response(proc.stderr).text(),
        ]);
        expect(exitCode, stderr || "live cue harness exited non-zero").toBe(0);

        const evidenceRaw = await readFile(outputPath, "utf-8");
        const evidence = JSON.parse(evidenceRaw) as LiveCueEvidence;
        expect(evidence.checks).toHaveLength(3);
        expect(evidence.allPassed).toBe(true);

        const byCase = new Map(evidence.checks.map((entry) => [entry.caseId, entry]));
        const fail = byCase.get("fail");
        const success = byCase.get("success");
        const complete = byCase.get("complete");

        expect(fail?.expectedCue).toBe("fail");
        expect(success?.expectedCue).toBe("success");
        expect(complete?.expectedCue).toBe("complete");
        expect(fail?.hasExpectedCue).toBe(true);
        expect(success?.hasExpectedCue).toBe(true);
        expect(complete?.hasExpectedCue).toBe(true);
        expect(new Set(fail?.observedCueTypes ?? [])).toEqual(new Set(["fail"]));
        expect(new Set(success?.observedCueTypes ?? [])).toEqual(new Set(["success"]));
        expect(new Set(complete?.observedCueTypes ?? [])).toEqual(new Set(["complete"]));
        for (const check of [fail, success, complete]) {
          expect(check?.cueEventCount).toBe(1);
          expect(check?.cueAdjacentFrame.hasCueAdjacentPlaySurface).toBe(true);
          expect(check?.cueAdjacentFrame.hasCueAdjacentCaseMarker).toBe(true);
          expect(check?.cueAdjacentFrame.framePath).toContain(
            `live-cue-${check?.caseId}.frame.txt`,
          );
          expect(check?.passed).toBe(true);
        }
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    },
    { timeout: 30_000 },
  );
});
