import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseBoard } from "../../src/domain/board";
import {
  countPuzzleSolutions,
  gradePuzzleDifficulty,
  type GradeAuditArtifact,
} from "../../src/domain/generator-grading";
import { Difficulty } from "../../src/domain/generator";
import { resolveRepoRoot } from "../repo-root";

const REPO_ROOT = resolveRepoRoot(import.meta.dir);
const ARTIFACT_PATH = join(
  REPO_ROOT,
  "dist",
  "validation",
  "gameplay-core",
  "generator-grading-audit.json",
);

function loadArtifact(): GradeAuditArtifact {
  if (!existsSync(ARTIFACT_PATH)) {
    const generated = Bun.spawnSync(["bun", "run", "scripts/generate-grading-audit.ts"], {
      cwd: REPO_ROOT,
      stdout: "pipe",
      stderr: "pipe",
    });
    if (generated.exitCode !== 0) {
      const stderr = generated.stderr ? new TextDecoder().decode(generated.stderr) : "";
      throw new Error(`Failed to generate grading audit artifact: ${stderr}`);
    }
  }
  const raw = readFileSync(ARTIFACT_PATH, "utf8");
  return JSON.parse(raw) as GradeAuditArtifact;
}

describe("Generator grading audit artifact", () => {
  test("declares metric, thresholds, corpus rule, and ordered tier evidence", () => {
    const artifact = loadArtifact();
    expect(artifact.metric.name).toBe("solver_effort_v1");
    expect(artifact.corpusRule.samplesPerTier).toBe(30);
    expect(artifact.thresholds.easyMaxInclusive).toBeGreaterThan(0);
    expect(artifact.thresholds.mediumMaxInclusive).toBeGreaterThan(
      artifact.thresholds.easyMaxInclusive,
    );
    expect(artifact.summary.easy.averageScore).toBeLessThan(artifact.summary.medium.averageScore);
    expect(artifact.summary.medium.averageScore).toBeLessThan(artifact.summary.hard.averageScore);
  });

  test("stores 30 samples per tier with unique solvability and grade consistency", () => {
    const artifact = loadArtifact();

    const tiers: Difficulty[] = [Difficulty.Easy, Difficulty.Medium, Difficulty.Hard];
    for (const tier of tiers) {
      const samples = artifact.samples[tier];
      expect(samples.length).toBe(30);

      for (const sample of samples) {
        const board = parseBoard(sample.puzzle);
        expect(countPuzzleSolutions(board, 2)).toBe(1);

        const grade = gradePuzzleDifficulty(board);
        expect(grade.score).toBe(sample.score);
        expect(grade.difficulty).toBe(sample.grade);
        expect(sample.grade).toBe(tier);
      }
    }
  }, 30000);

  test("regression: solver effort scoring stays branch-isolated for known hard-corpus fixtures", () => {
    const branchLeakRegressionCases = [
      {
        puzzle: "500100000406270500709400030008501609100763000000000000000902000050087103000000700",
        expectedScore: 447,
        expectedDifficulty: Difficulty.Medium,
      },
      {
        puzzle: "080000067501070080000500020032905070890007000000600008900000340710060000060800090",
        expectedScore: 451,
        expectedDifficulty: Difficulty.Medium,
      },
    ] as const;

    for (const fixture of branchLeakRegressionCases) {
      const grade = gradePuzzleDifficulty(parseBoard(fixture.puzzle));
      expect(grade.score).toBe(fixture.expectedScore);
      expect(grade.difficulty).toBe(fixture.expectedDifficulty);
    }
  });
});
