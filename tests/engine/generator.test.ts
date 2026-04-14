import { describe, test, expect } from "bun:test";
import { createPuzzle, Difficulty, generate } from "../../src/domain/generator";
import { gradePuzzleDifficulty } from "../../src/domain/generator-grading";
import { boardToString, type Board } from "../../src/domain/board";
import { solve } from "../../src/domain/solver";

const SUPPORTED_TIERS: Difficulty[] = [Difficulty.Easy, Difficulty.Medium, Difficulty.Hard];

const UNIQUENESS_SAMPLES_PER_DIFFICULTY = 5;
const SCORE_ORDER_SAMPLES_PER_DIFFICULTY = 8;

function countGivens(board: Board): number {
  return board.cells.filter((cell) => cell.isGiven && cell.value !== 0).length;
}

function findEmptyCell(board: Board): { row: number; col: number } | null {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board.getCell(row, col).value === 0) {
        return { row, col };
      }
    }
  }

  return null;
}

function countSolutions(board: Board, limit: number = 2): number {
  const working = board.clone();
  let solutions = 0;

  const search = (): void => {
    if (solutions >= limit) return;
    const empty = findEmptyCell(working);
    if (!empty) {
      if (working.isSolved()) {
        solutions++;
      }
      return;
    }

    for (let value = 1; value <= 9; value++) {
      if (working.wouldConflict(empty.row, empty.col, value)) {
        continue;
      }

      working.setValue(empty.row, empty.col, value);
      search();
      working.clearCell(empty.row, empty.col);

      if (solutions >= limit) return;
    }
  };

  search();
  return solutions;
}

describe("Generator", () => {
  describe("createPuzzle - basic creation", () => {
    test("creates valid puzzle at easy difficulty", () => {
      const result = createPuzzle(Difficulty.Easy);
      expect(result.status).toBe("success");
      expect(result.puzzle).not.toBeNull();

      // Puzzle should have no contradictions
      expect(result.puzzle!.hasContradiction()).toBe(false);

      // Puzzle should not be solved (should have empty cells)
      expect(result.puzzle!.isSolved()).toBe(false);
    });

    test("creates valid puzzle at medium difficulty", () => {
      const result = createPuzzle(Difficulty.Medium);
      expect(result.status).toBe("success");
      expect(result.puzzle).not.toBeNull();
      expect(result.puzzle!.hasContradiction()).toBe(false);
      expect(result.puzzle!.isSolved()).toBe(false);
    });

    test("creates valid puzzle at hard difficulty", () => {
      const result = createPuzzle(Difficulty.Hard);
      expect(result.status).toBe("success");
      expect(result.puzzle).not.toBeNull();
      expect(result.puzzle!.hasContradiction()).toBe(false);
      expect(result.puzzle!.isSolved()).toBe(false);
    });
  });

  describe("createPuzzle - puzzle characteristics", () => {
    test("puzzle has given cells", () => {
      const result = createPuzzle(Difficulty.Easy);
      const puzzle = result.puzzle!;
      expect(countGivens(puzzle)).toBeGreaterThan(0);
    });

    test("puzzle can be solved back to valid solution", () => {
      const result = createPuzzle(Difficulty.Easy);
      const puzzle = result.puzzle!;

      const solved = solve(puzzle);

      expect(solved.status).toBe("solved");
      expect(solved.solution).not.toBeNull();
      expect(solved.solution!.isSolved()).toBe(true);
    });
  });

  describe("createPuzzle - difficulty levels", () => {
    test("supported tiers preserve selected difficulty with ordered grading scores", () => {
      const averageScores: number[] = [];

      for (const tier of SUPPORTED_TIERS) {
        const scores: number[] = [];

        for (let sample = 0; sample < SCORE_ORDER_SAMPLES_PER_DIFFICULTY; sample++) {
          const result = createPuzzle(tier);
          expect(result.status).toBe("success");
          expect(result.puzzle).not.toBeNull();
          expect(result.difficulty).toBe(tier);

          const grade = gradePuzzleDifficulty(result.puzzle!);
          expect(grade.difficulty).toBe(tier);
          expect(grade.score).toBeGreaterThan(0);
          scores.push(grade.score);
        }

        const averageScore = scores.reduce((total, score) => total + score, 0) / scores.length;
        averageScores.push(averageScore);
      }

      expect(averageScores[0]).toBeLessThan(averageScores[1]);
      expect(averageScores[1]).toBeLessThan(averageScores[2]);
    }, 20000);
  });

  describe("createPuzzle - uniqueness", () => {
    test(`generated puzzles are uniquely solvable across ${UNIQUENESS_SAMPLES_PER_DIFFICULTY} samples per supported difficulty`, () => {
      for (const tier of SUPPORTED_TIERS) {
        for (let sample = 0; sample < UNIQUENESS_SAMPLES_PER_DIFFICULTY; sample++) {
          const result = createPuzzle(tier);
          expect(result.status).toBe("success");
          expect(result.puzzle).not.toBeNull();
          expect(result.solution).not.toBeNull();

          const puzzle = result.puzzle!;
          const solutionCount = countSolutions(puzzle, 2);
          expect(solutionCount).toBe(1);

          const solved = solve(puzzle);
          expect(solved.status).toBe("solved");
          expect(solved.solution).not.toBeNull();
          expect(boardToString(solved.solution!)).toBe(boardToString(result.solution!));
        }
      }
    }, 20000);
  });

  describe("createPuzzle - invalid input", () => {
    test("rejects invalid difficulty value", () => {
      // @ts-ignore - testing runtime behavior
      const result = createPuzzle("invalid" as Difficulty);
      // Should either throw or return error status
      expect(result.status).toBe("error");
    });
  });

  describe("generate function alias", () => {
    test("generate is alias for createPuzzle", () => {
      const result1 = createPuzzle(Difficulty.Easy);
      const result2 = generate(Difficulty.Easy);

      expect(result1.status).toBe(result2.status);
      expect(result1.puzzle).not.toBeNull();
      expect(result2.puzzle).not.toBeNull();
    });
  });
});
