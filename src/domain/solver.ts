import { Board } from "./board";

export type SolverStatus = "solved" | "invalid" | "unsolvable";

export interface SolverResult {
  status: SolverStatus;
  solution: Board | null;
  message?: string;
}

/**
 * Solves a Sudoku puzzle.
 * Returns:
 * - "solved" with a valid completed board
 * - "invalid" if the puzzle has contradictions (conflicting givens)
 * - "unsolvable" if the puzzle is valid but has no solution
 */
export function solve(inputBoard: Board): SolverResult {
  // First check if the input board has contradictions
  if (inputBoard.hasContradiction()) {
    return {
      status: "invalid",
      solution: null,
      message: "Puzzle has conflicting values",
    };
  }

  // Clone the board for solving
  const board = inputBoard.clone();

  // Try to solve using backtracking
  const solved = solveBoard(board);

  if (solved) {
    return {
      status: "solved",
      solution: board,
    };
  } else {
    // This shouldn't happen for valid puzzles (every valid puzzle has a solution)
    // but handle it anyway
    return {
      status: "unsolvable",
      solution: null,
      message: "No solution exists for this puzzle",
    };
  }
}

/**
 * Solves the board using recursive backtracking.
 * Returns true if solved, false otherwise.
 */
function solveBoard(board: Board): boolean {
  // Find the first empty cell
  const emptyCell = findEmptyCell(board);

  if (emptyCell === null) {
    // No empty cells - board is solved
    return board.isSolved();
  }

  const { row, col } = emptyCell;

  // Try each digit 1-9
  for (let digit = 1; digit <= 9; digit++) {
    // Check if placing this digit is valid
    if (!board.wouldConflict(row, col, digit)) {
      // Place the digit
      board.setValue(row, col, digit);

      // Recursively solve
      if (solveBoard(board)) {
        return true;
      }

      // Backtrack - clear the cell
      board.clearCell(row, col);
    }
  }

  // No digit works - backtrack
  return false;
}

/**
 * Finds the first empty cell in the board.
 * Returns null if no empty cells.
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

/**
 * Checks if a puzzle is valid (no contradictions in givens).
 */
export function isValidPuzzle(board: Board): boolean {
  return !board.hasContradiction();
}
