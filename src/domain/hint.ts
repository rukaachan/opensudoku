import { Board } from "./board";
import { findPointingPairSingle } from "./hint-pointing-pair";

export enum HintType {
  NakedSingle = "naked_single",
  HiddenSingle = "hidden_single",
  PointingPair = "pointing_pair",
}

export interface Hint {
  row: number;
  col: number;
  value: number;
  type: HintType;
  rationale: string;
}

export type HintFailureReason = "solved" | "contradictory" | "no_logical_hint";
export interface ShallowHintBaselineAudit {
  hasNakedSingle: boolean;
  hasHiddenSingle: boolean;
}

export class HintUnavailableError extends Error {
  readonly reason: HintFailureReason;

  constructor(reason: HintFailureReason, message: string) {
    super(message);
    this.name = "HintUnavailableError";
    this.reason = reason;
  }
}

/**
 * Gets a hint for the next best move on the puzzle.
 * Uses multiple strategies in order of difficulty:
 * 1. Naked Single - cell with only one possible value
 * 2. Hidden Single - value that can only go in one cell in a row/col/box
 *
 * Returns a hint object with the target cell, suggested value, and rationale.
 * Throws an error if no logically justified hint can be found.
 */
export function getHint(board: Board): Hint {
  // First check if puzzle is already solved
  if (board.isSolved()) {
    throw new HintUnavailableError("solved", "Puzzle is already solved");
  }

  // Check for contradictions
  if (board.hasContradiction()) {
    throw new HintUnavailableError(
      "contradictory",
      "Puzzle has contradictions - cannot provide hint",
    );
  }

  // Try to find a Naked Single first (simplest strategy)
  const nakedSingle = findNakedSingle(board);
  if (nakedSingle) {
    return nakedSingle;
  }

  // Try Hidden Single
  const hiddenSingle = findHiddenSingle(board);
  if (hiddenSingle) {
    return hiddenSingle;
  }

  const pointingPairMove = findPointingPairSingle(board);
  if (pointingPairMove) {
    return {
      ...pointingPairMove,
      type: HintType.PointingPair,
    };
  }

  // No logically justified hint available - the board is too unconstrained
  // for any strategy to produce a definitive move
  throw new HintUnavailableError(
    "no_logical_hint",
    "No logically justified hint available - board requires guessing",
  );
}

export function auditShallowHintBaseline(board: Board): ShallowHintBaselineAudit {
  return {
    hasNakedSingle: findNakedSingle(board) !== null,
    hasHiddenSingle: findHiddenSingle(board) !== null,
  };
}

/**
 * Finds a Naked Single: an empty cell that has only one valid candidate.
 */
function findNakedSingle(board: Board): Hint | null {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const cell = board.getCell(row, col);

      if (cell.value === 0) {
        const candidates = getCandidates(board, row, col);

        if (candidates.length === 1) {
          return {
            row,
            col,
            value: candidates[0],
            type: HintType.NakedSingle,
            rationale: `Cell (${row + 1}, ${col + 1}) can only contain ${candidates[0]} because all other digits are already in its row, column, or box.`,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Finds a Hidden Single: a value that can only go in one cell in a row, column, or box.
 */
function findHiddenSingle(board: Board): Hint | null {
  // Check each row for hidden singles
  for (let row = 0; row < 9; row++) {
    const hint = findHiddenSingleInLine(board, row, true);
    if (hint) return hint;
  }

  // Check each column for hidden singles
  for (let col = 0; col < 9; col++) {
    const hint = findHiddenSingleInLine(board, col, false);
    if (hint) return hint;
  }

  // Check each box for hidden singles
  for (let boxRow = 0; boxRow < 9; boxRow += 3) {
    for (let boxCol = 0; boxCol < 9; boxCol += 3) {
      const hint = findHiddenSingleInBox(board, boxRow, boxCol);
      if (hint) return hint;
    }
  }

  return null;
}

/**
 * Finds hidden single in a row (horizontal) or column (vertical).
 */
function findHiddenSingleInLine(board: Board, lineIndex: number, isRow: boolean): Hint | null {
  // For each digit 1-9, check if it can only go in one position
  for (let digit = 1; digit <= 9; digit++) {
    let possiblePositions: { row: number; col: number }[] = [];

    for (let i = 0; i < 9; i++) {
      const row = isRow ? lineIndex : i;
      const col = isRow ? i : lineIndex;
      const cell = board.getCell(row, col);

      if (cell.value === 0 && !board.wouldConflict(row, col, digit)) {
        possiblePositions.push({ row, col });
      }
    }

    if (possiblePositions.length === 1) {
      const pos = possiblePositions[0];
      return {
        row: pos.row,
        col: pos.col,
        value: digit,
        type: HintType.HiddenSingle,
        rationale: `${digit} can only go in ${isRow ? "row" : "column"} ${lineIndex + 1} at cell (${pos.row + 1}, ${pos.col + 1}) - it's the only place where ${digit} doesn't conflict.`,
      };
    }
  }

  return null;
}

/**
 * Finds hidden single in a 3x3 box.
 */
function findHiddenSingleInBox(
  board: Board,
  boxRowStart: number,
  boxColStart: number,
): Hint | null {
  // For each digit 1-9, check if it can only go in one position in the box
  for (let digit = 1; digit <= 9; digit++) {
    let possiblePositions: { row: number; col: number }[] = [];

    for (let r = boxRowStart; r < boxRowStart + 3; r++) {
      for (let c = boxColStart; c < boxColStart + 3; c++) {
        const cell = board.getCell(r, c);

        if (cell.value === 0 && !board.wouldConflict(r, c, digit)) {
          possiblePositions.push({ row: r, col: c });
        }
      }
    }

    if (possiblePositions.length === 1) {
      const pos = possiblePositions[0];
      return {
        row: pos.row,
        col: pos.col,
        value: digit,
        type: HintType.HiddenSingle,
        rationale: `${digit} can only go in box (${Math.floor(boxRowStart / 3) + 1}, ${Math.floor(boxColStart / 3) + 1}) at cell (${pos.row + 1}, ${pos.col + 1}) - it's the only place in this box where ${digit} doesn't conflict.`,
      };
    }
  }

  return null;
}

/**
 * Gets the list of valid candidates for a cell.
 */
function getCandidates(board: Board, row: number, col: number): number[] {
  if (board.getCell(row, col).value !== 0) {
    return [];
  }

  const candidates: number[] = [];

  for (let digit = 1; digit <= 9; digit++) {
    if (!board.wouldConflict(row, col, digit)) {
      candidates.push(digit);
    }
  }

  return candidates;
}
