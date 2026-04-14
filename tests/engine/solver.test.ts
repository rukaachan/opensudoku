import { describe, test, expect } from "bun:test";
import { Board, parseBoard, createEmptyBoard, boardToString } from "../../src/domain/board";
import { solve } from "../../src/domain/solver";

const SOLVABLE_EASY =
  "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const SOLVABLE_UNIQUE =
  "000000000000003084000060000009000000070000200500000000700400008000100005000000000";
const INVALID_CONTRADICTORY =
  "554678912672195348198342567859761423426853791713924856961537284287419635345286179";
const UNSOLVABLE_WELL_FORMED =
  "004000910000105040190042000000791420400000000710000850000530000200019600040080000";
const SOLVED_VALID =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

function expectBoardUnchanged(board: Board, before: string): void {
  expect(boardToString(board)).toBe(before);
}

function countSolutions(board: Board, maxCount = 2): number {
  const grid: number[][] = Array.from({ length: 9 }, (_, row) =>
    Array.from({ length: 9 }, (_, col) => board.getCell(row, col).value),
  );

  const canPlace = (row: number, col: number, value: number): boolean => {
    for (let i = 0; i < 9; i++) {
      if (grid[row][i] === value) return false;
      if (grid[i][col] === value) return false;
    }

    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let r = boxRow; r < boxRow + 3; r++) {
      for (let c = boxCol; c < boxCol + 3; c++) {
        if (grid[r][c] === value) return false;
      }
    }

    return true;
  };

  const findEmpty = (): { row: number; col: number } | null => {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (grid[row][col] === 0) {
          return { row, col };
        }
      }
    }
    return null;
  };

  let solutions = 0;

  const search = (): void => {
    if (solutions >= maxCount) {
      return;
    }

    const empty = findEmpty();
    if (!empty) {
      solutions += 1;
      return;
    }

    for (let value = 1; value <= 9; value++) {
      if (!canPlace(empty.row, empty.col, value)) {
        continue;
      }

      grid[empty.row][empty.col] = value;
      search();
      grid[empty.row][empty.col] = 0;
    }
  };

  search();
  return solutions;
}

function hasGivenConflicts(boardString: string): boolean {
  const grid = Array.from({ length: 9 }, (_, row) =>
    Array.from({ length: 9 }, (_, col) => Number(boardString[row * 9 + col])),
  );

  const seen = new Set<string>();
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const value = grid[row][col];
      if (value === 0) {
        continue;
      }

      const rowKey = `r${row}:${value}`;
      const colKey = `c${col}:${value}`;
      const boxKey = `b${Math.floor(row / 3)}${Math.floor(col / 3)}:${value}`;

      if (seen.has(rowKey) || seen.has(colKey) || seen.has(boxKey)) {
        return true;
      }

      seen.add(rowKey);
      seen.add(colKey);
      seen.add(boxKey);
    }
  }

  return false;
}

describe("Solver", () => {
  describe("solve - solvable puzzles", () => {
    test("solves known easy puzzle to the expected full grid without mutating input", () => {
      const board = parseBoard(SOLVABLE_EASY);
      const before = boardToString(board);
      const result = solve(board);

      expect(result.status).toBe("solved");
      expect(result.solution).not.toBeNull();
      expect(result.solution!.isSolved()).toBe(true);
      expect(boardToString(result.solution!)).toBe(SOLVED_VALID);
      expectBoardUnchanged(board, before);
    });

    test("solves puzzle with unique solution", () => {
      const board = parseBoard(SOLVABLE_UNIQUE);
      const result = solve(board);

      expect(result.status).toBe("solved");
      expect(result.solution).not.toBeNull();
      expect(result.solution!.isSolved()).toBe(true);
    });

    test("solves empty board (full solution)", () => {
      const board = createEmptyBoard();
      const result = solve(board);

      expect(result.status).toBe("solved");
      expect(result.solution).not.toBeNull();
      expect(result.solution!.isSolved()).toBe(true);
    });
  });

  describe("solve - invalid puzzles", () => {
    test("detects contradictory fixture as invalid (separate from unsolvable fixture)", () => {
      const board = parseBoard(INVALID_CONTRADICTORY);
      const before = boardToString(board);

      expect(board.hasContradiction()).toBe(true);

      const result = solve(board);
      expect(result.status).toBe("invalid");
      expect(result.solution).toBeNull();
      expectBoardUnchanged(board, before);
    });

    test("detects puzzle with row conflict (invalid)", () => {
      const board = createEmptyBoard();
      board.setValue(0, 0, 5);
      board.setValue(0, 1, 5); // Row conflict

      const result = solve(board);
      expect(result.status).toBe("invalid");
    });

    test("detects puzzle with column conflict (invalid)", () => {
      const board = createEmptyBoard();
      board.setValue(0, 0, 5);
      board.setValue(1, 0, 5); // Column conflict

      const result = solve(board);
      expect(result.status).toBe("invalid");
    });

    test("detects puzzle with box conflict (invalid)", () => {
      const board = createEmptyBoard();
      board.setValue(0, 0, 5);
      board.setValue(1, 1, 5); // Box conflict

      const result = solve(board);
      expect(result.status).toBe("invalid");
    });
  });

  describe("solve - unsolvable puzzles", () => {
    test("detects well-formed unsolvable puzzle", () => {
      const board = parseBoard(UNSOLVABLE_WELL_FORMED);
      const before = boardToString(board);

      expect(hasGivenConflicts(UNSOLVABLE_WELL_FORMED)).toBe(false);
      expect(board.hasContradiction()).toBe(false);
      expect(countSolutions(board)).toBe(0);

      const result = solve(board);
      expect(result.status).toBe("unsolvable");
      expect(result.solution).toBeNull();
      expectBoardUnchanged(board, before);
    });
  });

  describe("solve - edge cases", () => {
    test("preserves given cells in solution", () => {
      const board = parseBoard(SOLVABLE_EASY);
      const result = solve(board);

      expect(result.solution).not.toBeNull();
      const solution = result.solution!;

      expect(solution.cells[0].value).toBe(5);
      expect(solution.cells[1].value).toBe(3);
      expect(solution.cells[9].value).toBe(6);
    });

    test("returns solved status for fully solved valid board", () => {
      const board = parseBoard(SOLVED_VALID);
      expect(board.isSolved()).toBe(true);

      const result = solve(board);
      expect(result.status).toBe("solved");
      expect(result.solution).not.toBeNull();
    });
  });
});
