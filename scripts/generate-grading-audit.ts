import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { boardToString } from "../src/domain/board";
import { Difficulty, createPuzzle, type RandomSource } from "../src/domain/generator";
import {
  DIFFICULTY_SCORE_THRESHOLDS,
  gradePuzzleDifficulty,
  type GradeAuditArtifact,
  type SupportedDifficulty,
} from "../src/domain/generator-grading";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const outputDir = join(repoRoot, "dist", "validation", "gameplay-core");
const OUTPUT_PATH = join(outputDir, "generator-grading-audit.json");
const SAMPLES_PER_TIER = 30;

const TIERS: Difficulty[] = [Difficulty.Easy, Difficulty.Medium, Difficulty.Hard];

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const samples: GradeAuditArtifact["samples"] = {
  easy: [],
  medium: [],
  hard: [],
};

for (const difficulty of TIERS) {
  for (let index = 0; index < SAMPLES_PER_TIER; index++) {
    const seed = hashString(`${difficulty}:${index}`);
    const result = createPuzzle(difficulty, { rng: createSeededRandom(seed) });
    if (result.status !== "success" || !result.puzzle) {
      throw new Error(`Failed to generate ${difficulty} sample ${index}.`);
    }

    const grade = gradePuzzleDifficulty(result.puzzle);
    if (grade.difficulty !== difficulty) {
      throw new Error(`Generated ${difficulty} sample ${index} graded as ${grade.difficulty}.`);
    }

    samples[difficulty].push({
      puzzle: boardToString(result.puzzle),
      score: grade.score,
      grade: grade.difficulty,
    });
  }
}

function summarizeTier(
  tier: SupportedDifficulty,
): GradeAuditArtifact["summary"][SupportedDifficulty] {
  const scores = samples[tier].map((sample) => sample.score);
  const sum = scores.reduce((total, score) => total + score, 0);
  return {
    averageScore: Number((sum / scores.length).toFixed(2)),
    minScore: Math.min(...scores),
    maxScore: Math.max(...scores),
  };
}

const artifact: GradeAuditArtifact = {
  generatedAtUtc: new Date().toISOString(),
  metric: {
    name: "solver_effort_v1",
    scoreFormula:
      "emptyCells + forcedPlacements*2 + branchingDecisions*36 + backtracks*90 + maxCandidates*8",
  },
  thresholds: DIFFICULTY_SCORE_THRESHOLDS,
  corpusRule: {
    samplesPerTier: SAMPLES_PER_TIER,
  },
  summary: {
    easy: summarizeTier("easy"),
    medium: summarizeTier("medium"),
    hard: summarizeTier("hard"),
  },
  samples,
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`Wrote grading audit artifact to ${OUTPUT_PATH}`);
