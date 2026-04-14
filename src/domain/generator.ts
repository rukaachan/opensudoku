import { Board, createEmptyBoard } from "./board";
import { countPuzzleSolutions, gradePuzzleDifficulty } from "./generator-grading";

export enum Difficulty {
  Easy = "easy",
  Medium = "medium",
  Hard = "hard",
}

export type GeneratorStatus = "success" | "error";
export type RandomSource = () => number;

export interface GeneratorOptions {
  rng?: RandomSource;
}

export interface PuzzleResult {
  status: GeneratorStatus;
  puzzle: Board | null;
  solution?: Board;
  difficulty?: Difficulty;
  message?: string;
}

// Number of givens to leave for each difficulty
const DIFFICULTY_GIVENS: Record<Difficulty, number> = {
  [Difficulty.Easy]: 45, // ~55% of cells given
  [Difficulty.Medium]: 35, // ~43% of cells given
  [Difficulty.Hard]: 28, // ~35% of cells given
};
const MAX_GENERATION_ATTEMPTS = 60;

/**
 * Generates a new Sudoku puzzle at the specified difficulty.
 */
export function createPuzzle(difficulty: Difficulty, options: GeneratorOptions = {}): PuzzleResult {
  // Validate difficulty
  if (!Object.values(Difficulty).includes(difficulty)) {
    return {
      status: "error",
      puzzle: null,
      message: `Invalid difficulty: ${difficulty}`,
    };
  }

  try {
    const rng = options.rng ?? Math.random;

    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
      // Step 1: Generate a complete valid solution
      const solution = generateSolution(rng);

      if (!solution || !solution.isSolved()) {
        continue;
      }

      // Step 2: Remove cells based on difficulty while preserving unique solvability
      const puzzle = createPuzzleFromSolution(solution, difficulty, rng);
      if (!puzzle) {
        continue;
      }
      const grade = gradePuzzleDifficulty(puzzle);
      if (grade.difficulty !== difficulty) {
        continue;
      }

      return {
        status: "success",
        puzzle,
        solution,
        difficulty,
      };
    }

    return {
      status: "error",
      puzzle: null,
      message: "Failed to generate uniquely solvable puzzle",
    };
  } catch (error) {
    return {
      status: "error",
      puzzle: null,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Alias for createPuzzle for convenience.
 */
export function generate(difficulty: Difficulty, options: GeneratorOptions = {}): PuzzleResult {
  return createPuzzle(difficulty, options);
}

/**
 * Generates a complete valid Sudoku solution board.
 */
function generateSolution(rng: RandomSource): Board {
  const board = createEmptyBoard();

  // Fill diagonal 3x3 boxes (they are independent)
  fillDiagonalBoxes(board, rng);

  // Solve the rest
  solveBoard(board);

  return board;
}

/**
 * Fills the three diagonal 3x3 boxes with random valid digits.
 * These are independent of each other, so we can fill them first.
 */
function fillDiagonalBoxes(board: Board, rng: RandomSource): void {
  // Diagonal boxes: (0,0), (1,1), (2,2)
  for (let box = 0; box < 3; box++) {
    const boxRow = box * 3;
    const boxCol = box * 3;
    const digits = shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);

    let idx = 0;
    for (let r = boxRow; r < boxRow + 3; r++) {
      for (let c = boxCol; c < boxCol + 3; c++) {
        board.setValue(r, c, digits[idx++]);
      }
    }
  }
}

/**
 * Shuffles an array in place using Fisher-Yates algorithm.
 */
function shuffleArray<T>(array: T[], rng: RandomSource): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Creates a puzzle by removing cells from a solved solution.
 */
function createPuzzleFromSolution(
  solution: Board,
  difficulty: Difficulty,
  rng: RandomSource,
): Board | null {
  const puzzle = solution.clone();
  const targetGivens = DIFFICULTY_GIVENS[difficulty];

  // Get all cell positions
  const positions: { row: number; col: number }[] = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      positions.push({ row, col });
    }
  }

  // Shuffle positions to remove randomly
  const shuffled = shuffleArray(positions, rng);

  // Remove cells until we have the target number of givens while keeping exactly one solution
  let currentGivens = 81;
  for (const pos of shuffled) {
    if (currentGivens <= targetGivens) break;

    const cell = puzzle.getCell(pos.row, pos.col);
    if (cell.value !== 0) {
      const previousValue = cell.value;
      cell.value = 0;
      cell.isGiven = false;
      if (countPuzzleSolutions(puzzle, 2) === 1) {
        currentGivens--;
      } else {
        cell.value = previousValue;
      }
    }
  }

  if (currentGivens !== targetGivens) {
    return null;
  }

  // Mark remaining cells with values as given (clues)
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const cell = puzzle.getCell(row, col);
      if (cell.value !== 0) {
        cell.isGiven = true;
      }
    }
  }

  return puzzle;
}

/**
 * Solves the board using backtracking.
 * Returns true if solved.
 */
function solveBoard(board: Board): boolean {
  const emptyCell = findEmptyCell(board);

  if (!emptyCell) {
    return board.isSolved();
  }

  const { row, col } = emptyCell;

  for (let digit = 1; digit <= 9; digit++) {
    if (!board.wouldConflict(row, col, digit)) {
      board.setValue(row, col, digit);

      if (solveBoard(board)) {
        return true;
      }

      board.clearCell(row, col);
    }
  }

  return false;
}

/**
 * Finds first empty cell.
 */
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
