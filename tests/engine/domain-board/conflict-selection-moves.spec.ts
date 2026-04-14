import { describe, expect, test } from "bun:test";
import { Selection, createEmptyBoard, parseBoard } from "../../../src/domain/board";
import type { Move } from "../../../src/domain/board";

describe("Conflict detection", () => {
  test("hasRowConflict detects conflict in row", () => {
    const board = createEmptyBoard();
    board.setValue(4, 0, 5);
    board.setValue(4, 1, 5);
    expect(board.hasConflict(4, 1)).toBe(true);
  });

  test("hasRowConflict returns false for no conflict", () => {
    const board = createEmptyBoard();
    board.setValue(4, 0, 5);
    board.setValue(4, 1, 3);
    expect(board.hasConflict(4, 1)).toBe(false);
  });

  test("hasColConflict detects conflict in column", () => {
    const board = createEmptyBoard();
    board.setValue(0, 4, 5);
    board.setValue(1, 4, 5);
    expect(board.hasConflict(1, 4)).toBe(true);
  });

  test("hasBoxConflict detects conflict in 3x3 box", () => {
    const board = createEmptyBoard();
    board.setValue(0, 0, 5);
    board.setValue(1, 1, 5);
    expect(board.hasConflict(1, 1)).toBe(true);
  });

  test("hasConflict returns true if any conflict exists", () => {
    const board = createEmptyBoard();
    board.setValue(0, 0, 5);
    board.setValue(0, 1, 3);
    board.setValue(1, 0, 7);
    expect(board.hasConflict(1, 1)).toBe(false);
  });

  test("given cells don't cause conflict with themselves", () => {
    const board = parseBoard(
      "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
    );
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        expect(board.hasConflict(r, c)).toBe(false);
      }
    }
  });
});

describe("Selection helpers", () => {
  test("Selection.moveUp clamps at top", () => {
    const sel = new Selection(0, 4).moveUp();
    expect(sel.row).toBe(0);
    expect(sel.col).toBe(4);
  });

  test("Selection.moveDown clamps at bottom", () => {
    const sel = new Selection(8, 4).moveDown();
    expect(sel.row).toBe(8);
    expect(sel.col).toBe(4);
  });

  test("Selection.moveLeft clamps at left", () => {
    const sel = new Selection(4, 0).moveLeft();
    expect(sel.row).toBe(4);
    expect(sel.col).toBe(0);
  });

  test("Selection.moveRight clamps at right", () => {
    const sel = new Selection(4, 8).moveRight();
    expect(sel.row).toBe(4);
    expect(sel.col).toBe(8);
  });

  test("Selection.moveUp moves within bounds", () => {
    expect(new Selection(4, 4).moveUp().row).toBe(3);
  });

  test("Selection.moveDown moves within bounds", () => {
    expect(new Selection(4, 4).moveDown().row).toBe(5);
  });

  test("Selection.moveLeft moves within bounds", () => {
    expect(new Selection(4, 4).moveLeft().col).toBe(3);
  });

  test("Selection.moveRight moves within bounds", () => {
    expect(new Selection(4, 4).moveRight().col).toBe(5);
  });
});

describe("Move application", () => {
  test("ApplyMove to given cell returns null (rejected)", () => {
    const board = parseBoard(
      "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
    );
    const move: Move = { row: 0, col: 0, value: 9 };
    expect(board.applyMove(move)).toBeNull();
  });

  test("ApplyMove to valid cell succeeds", () => {
    const board = createEmptyBoard();
    const move: Move = { row: 4, col: 4, value: 9 };
    expect(board.applyMove(move)).not.toBeNull();
    expect(board.cells[40].value).toBe(9);
  });

  test("ApplyMove with conflict returns null", () => {
    const board = createEmptyBoard();
    board.setValue(4, 0, 5);
    const move: Move = { row: 4, col: 1, value: 5 };
    expect(board.applyMove(move)).toBeNull();
    expect(board.cells[41].value).toBe(0);
  });
});
