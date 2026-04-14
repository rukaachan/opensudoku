import { describe, expect, test } from "bun:test";
import { createEmptyBoard, parseBoard } from "../../../src/domain/board";

describe("Solved detection", () => {
  test("isSolved returns true for complete valid board", () => {
    const board = createEmptyBoard();
    const solution = [
      [5, 3, 4, 6, 7, 8, 9, 1, 2],
      [6, 7, 2, 1, 9, 5, 3, 4, 8],
      [1, 9, 8, 3, 4, 2, 5, 6, 7],
      [8, 5, 9, 7, 6, 1, 4, 2, 3],
      [4, 2, 6, 8, 5, 3, 7, 9, 1],
      [7, 1, 3, 9, 2, 4, 8, 5, 6],
      [9, 6, 1, 5, 3, 7, 2, 8, 4],
      [2, 8, 7, 4, 1, 9, 6, 3, 5],
      [3, 4, 5, 2, 8, 6, 1, 7, 9],
    ];

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        board.cells[r * 9 + c].value = solution[r][c];
        board.cells[r * 9 + c].isGiven = true;
      }
    }

    expect(board.isSolved()).toBe(true);
  });

  test("isSolved returns false for incomplete board", () => {
    expect(createEmptyBoard().isSolved()).toBe(false);
  });

  test("isSolved returns false for complete but conflicting board", () => {
    const board = createEmptyBoard();
    for (let i = 0; i < 81; i++) {
      board.cells[i].value = 1;
      board.cells[i].isGiven = true;
    }
    expect(board.isSolved()).toBe(false);
  });

  test("isSolved returns false for valid but incomplete", () => {
    const board = parseBoard(
      "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
    );
    expect(board.isSolved()).toBe(false);
  });
});

describe("Contradictory board detection", () => {
  test("hasContradiction detects board with conflicts", () => {
    const board = createEmptyBoard();
    board.setValue(0, 0, 5);
    board.setValue(0, 1, 5);
    expect(board.hasContradiction()).toBe(true);
  });

  test("hasContradiction returns false for valid board", () => {
    const board = parseBoard(
      "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
    );
    expect(board.hasContradiction()).toBe(false);
  });

  test("hasContradiction returns false for empty board", () => {
    expect(createEmptyBoard().hasContradiction()).toBe(false);
  });
});

describe("Board cloning", () => {
  test("clone creates independent copy", () => {
    const board = createEmptyBoard();
    board.setValue(4, 4, 5);

    const cloned = board.clone();
    cloned.setValue(4, 4, 9);

    expect(board.cells[40].value).toBe(5);
  });
});
