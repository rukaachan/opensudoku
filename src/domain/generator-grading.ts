import type { Board } from "./board";

export type SupportedDifficulty = "easy" | "medium" | "hard";

export interface DifficultyThresholds {
  easyMaxInclusive: number;
  mediumMaxInclusive: number;
}

export interface PuzzleGrade {
  difficulty: SupportedDifficulty;
  score: number;
  metrics: {
    emptyCells: number;
    forcedPlacements: number;
    branchingDecisions: number;
    backtracks: number;
    maxCandidates: number;
  };
}

export interface GradeAuditSample {
  puzzle: string;
  score: number;
  grade: SupportedDifficulty;
}

export interface GradeAuditArtifact {
  generatedAtUtc: string;
  metric: {
    name: "solver_effort_v1";
    scoreFormula: string;
  };
  thresholds: DifficultyThresholds;
  corpusRule: {
    samplesPerTier: number;
  };
  summary: Record<
    SupportedDifficulty,
    { averageScore: number; minScore: number; maxScore: number }
  >;
  samples: Record<SupportedDifficulty, GradeAuditSample[]>;
}

export const DIFFICULTY_SCORE_THRESHOLDS: DifficultyThresholds = {
  easyMaxInclusive: 170,
  mediumMaxInclusive: 500,
};

export function getDifficultyFromScore(
  score: number,
  thresholds: DifficultyThresholds = DIFFICULTY_SCORE_THRESHOLDS,
): SupportedDifficulty {
  if (score <= thresholds.easyMaxInclusive) {
    return "easy";
  }
  if (score <= thresholds.mediumMaxInclusive) {
    return "medium";
  }
  return "hard";
}

export function gradePuzzleDifficulty(
  board: Board,
  thresholds: DifficultyThresholds = DIFFICULTY_SCORE_THRESHOLDS,
): PuzzleGrade {
  const metrics = computeSolverEffortMetrics(board);
  const score =
    metrics.emptyCells +
    metrics.forcedPlacements * 2 +
    metrics.branchingDecisions * 36 +
    metrics.backtracks * 90 +
    metrics.maxCandidates * 8;

  return {
    difficulty: getDifficultyFromScore(score, thresholds),
    score,
    metrics,
  };
}

export function countPuzzleSolutions(board: Board, limit: number = 2): number {
  const working = board.clone();
  let solutions = 0;

  const search = (): void => {
    if (solutions >= limit) {
      return;
    }

    const target = selectCellWithFewestCandidates(working);
    if (!target) {
      if (working.isSolved()) {
        solutions++;
      }
      return;
    }

    if (target.candidates.length === 0) {
      return;
    }

    for (const candidate of target.candidates) {
      working.setValue(target.row, target.col, candidate);
      search();
      working.clearCell(target.row, target.col);
      if (solutions >= limit) {
        return;
      }
    }
  };

  search();
  return solutions;
}

function computeSolverEffortMetrics(board: Board): PuzzleGrade["metrics"] {
  const metrics: PuzzleGrade["metrics"] = {
    emptyCells: countEmptyCells(board),
    forcedPlacements: 0,
    branchingDecisions: 0,
    backtracks: 0,
    maxCandidates: 0,
  };

  const search = (working: Board): boolean => {
    let progress = true;
    while (progress) {
      progress = false;
      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
          const cell = working.getCell(row, col);
          if (cell.value !== 0) {
            continue;
          }

          const scan = scanCandidates(working, row, col);
          metrics.maxCandidates = Math.max(metrics.maxCandidates, scan.count);
          if (scan.count === 0) {
            return false;
          }
          if (scan.count === 1) {
            working.setValue(row, col, scan.lastCandidate);
            metrics.forcedPlacements += 1;
            progress = true;
          }
        }
      }
    }

    const target = selectCellWithFewestCandidates(working);
    if (!target) {
      return working.isSolved();
    }
    if (target.candidates.length === 0) {
      return false;
    }

    metrics.maxCandidates = Math.max(metrics.maxCandidates, target.candidates.length);
    metrics.branchingDecisions += 1;
    for (const candidate of target.candidates) {
      const branch = working.clone();
      branch.setValue(target.row, target.col, candidate);
      if (search(branch)) {
        return true;
      }
      metrics.backtracks += 1;
    }

    return false;
  };

  search(board.clone());
  return metrics;
}

function countEmptyCells(board: Board): number {
  let emptyCells = 0;
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board.getCell(row, col).value === 0) {
        emptyCells += 1;
      }
    }
  }
  return emptyCells;
}

function getCandidates(board: Board, row: number, col: number): number[] {
  if (board.getCell(row, col).value !== 0) {
    return [];
  }

  const candidates: number[] = [];
  for (let value = 1; value <= 9; value++) {
    if (!board.wouldConflict(row, col, value)) {
      candidates.push(value);
    }
  }
  return candidates;
}

function scanCandidates(
  board: Board,
  row: number,
  col: number,
): { count: number; lastCandidate: number } {
  let count = 0;
  let lastCandidate = 0;
  for (let value = 1; value <= 9; value++) {
    if (!board.wouldConflict(row, col, value)) {
      count += 1;
      lastCandidate = value;
    }
  }
  return { count, lastCandidate };
}

function selectCellWithFewestCandidates(
  board: Board,
): { row: number; col: number; candidates: number[] } | null {
  let selected: { row: number; col: number; candidates: number[] } | null = null;
  let selectedCount = 10;

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board.getCell(row, col).value !== 0) {
        continue;
      }

      const scan = scanCandidates(board, row, col);
      if (scan.count < selectedCount) {
        selectedCount = scan.count;
        selected = { row, col, candidates: getCandidates(board, row, col) };
        if (selectedCount <= 1) {
          return selected;
        }
      }
    }
  }

  return selected;
}
