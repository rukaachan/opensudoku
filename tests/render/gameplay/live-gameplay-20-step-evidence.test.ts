import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

interface CandidateWorkflowStepEvidence {
  id:
    | "enter-play"
    | "toggle-notes"
    | "add-note"
    | "remove-note"
    | "clear-note-only"
    | "request-hint";
  keys: string[];
  framePath: string;
  hudLines: {
    Mode: string;
    Status: string;
    Active: string;
    Hints: string;
  };
  editedCellText: string;
}

interface LiveCandidateWorkflowEvidence {
  assertion: "VAL-CUX-011";
  scriptType: "live-candidate-workflow";
  generatedAt: string;
  editedCell: "r1c3";
  steps: CandidateWorkflowStepEvidence[];
  exit: {
    keys: string[];
    exitCode: number;
    timedOut: boolean;
  };
}

describe("Live gameplay 20-step evidence harness", () => {
  test(
    "archives VAL-CUX-011 live candidate workflow proof from the real CLI/TUI surface",
    async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "opensudoku-live-gameplay-20-step-"));
      const outputPath = join(tempDir, "live-candidate-workflow.json");

      try {
        const proc = Bun.spawn(
          [
            "bun",
            "run",
            "scripts/live/live-candidate-workflow-evidence.ts",
            "--",
            "--json",
            outputPath,
          ],
          {
            stdout: "pipe",
            stderr: "pipe",
          },
        );

        const [exitCode, stderr] = await Promise.all([
          proc.exited,
          new Response(proc.stderr).text(),
        ]);
        expect(exitCode, stderr || "live candidate workflow harness exited non-zero").toBe(0);

        const artifactRaw = await readFile(outputPath, "utf8");
        const artifact = JSON.parse(artifactRaw) as LiveCandidateWorkflowEvidence;
        expect(artifact.assertion).toBe("VAL-CUX-011");
        expect(artifact.scriptType).toBe("live-candidate-workflow");
        expect(artifact.editedCell).toBe("r1c3");
        expect(artifact.steps.map((step) => step.id)).toEqual([
          "enter-play",
          "toggle-notes",
          "add-note",
          "remove-note",
          "clear-note-only",
          "request-hint",
        ]);

        for (const step of artifact.steps) {
          expect(step.hudLines.Mode).toStartWith("Mode:");
          expect(step.hudLines.Status).toStartWith("Status:");
          expect(step.hudLines.Active).toStartWith("Active:");
          expect(step.hudLines.Hints).toStartWith("Hints:");
          expect(step.editedCellText).toBeString();
          const frameText = await readFile(step.framePath, "utf8");
          expect(frameText).toContain("OpenSudoku Play");
          expect(frameText).toContain(step.hudLines.Mode);
          expect(frameText).toContain(step.hudLines.Status);
          expect(frameText).toContain(step.hudLines.Active);
          expect(frameText).toContain(step.hudLines.Hints);
        }

        expect(artifact.steps[0]?.keys).toEqual(["p"]);
        expect(artifact.steps[1]?.keys).toEqual(["n"]);
        expect(artifact.steps[2]?.keys).toEqual(["d", "d", "1"]);
        expect(artifact.steps[3]?.keys).toEqual(["1"]);
        expect(artifact.steps[4]?.keys).toEqual(["\u007f"]);
        expect(artifact.steps[5]?.keys).toEqual(["n", "h"]);

        expect(artifact.steps[2]?.editedCellText).toContain("1");
        expect(artifact.steps[3]?.editedCellText).toBe(".");
        expect(artifact.steps[4]?.editedCellText).toBe(".");
        expect(artifact.steps[5]?.hudLines.Status).toContain("Status: Hint shown on board.");
        expect(artifact.steps[5]?.hudLines.Hints).toBe("Hints: 1");

        expect(artifact.exit.keys).toEqual(["q", "q"]);
        expect(artifact.exit.timedOut).toBe(false);
        expect(artifact.exit.exitCode).toBe(0);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    },
    { timeout: 60_000 },
  );
});
