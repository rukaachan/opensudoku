import { describe, expect, test } from "bun:test";
import { History, createEmptyBoard, parseBoard } from "../../../src/domain/board";
import type { Move } from "../../../src/domain/board";

describe("History tracking", () => {
  test("History records move", () => {
    const history = new History();
    const board = createEmptyBoard();
    const move: Move = { row: 4, col: 4, value: 5 };
    const snapshot = history.record(board, move);

    expect(snapshot).not.toBeNull();
    expect(history.canUndo()).toBe(true);
  });

  test("History does not record rejected move", () => {
    const history = new History();
    const board = createEmptyBoard();
    board.setValue(4, 0, 5);
    const snapshot = history.record(board, { row: 4, col: 1, value: 5 });

    expect(snapshot).toBeNull();
    expect(history.canUndo()).toBe(false);
  });

  test("History does not record move attempts on given cells", () => {
    const history = new History();
    const board = parseBoard(
      "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
    );

    const snapshot = history.record(board, { row: 0, col: 0, value: 9 });
    expect(snapshot).toBeNull();
    expect(history.canUndo()).toBe(false);
    expect(board.getCell(0, 0).value).toBe(5);
  });

  test("History records clear action", () => {
    const history = new History();
    const board = createEmptyBoard();
    board.setValue(4, 4, 5);
    const snapshot = history.recordClear(board, 4, 4);

    expect(snapshot).not.toBeNull();
    expect(history.canUndo()).toBe(true);
  });

  test("History records note action", () => {
    const history = new History();
    const board = createEmptyBoard();
    const snapshot = history.recordNote(board, 4, 4, 1, true);

    expect(snapshot).not.toBeNull();
    expect(history.canUndo()).toBe(true);
  });

  test("History does not record note no-op mutations", () => {
    const history = new History();
    const board = createEmptyBoard();

    expect(history.recordNote(board, 4, 4, 1, false)).toBeNull();
    expect(history.canUndo()).toBe(false);
  });

  test("History does not record value no-op mutations", () => {
    const history = new History();
    const board = createEmptyBoard();
    board.setValue(4, 4, 5);

    expect(history.record(board, { row: 4, col: 4, value: 5 })).toBeNull();
    expect(history.canUndo()).toBe(false);
  });

  test("Undo reverts last move", () => {
    const history = new History();
    const board = createEmptyBoard();
    history.record(board, { row: 4, col: 4, value: 5 });

    expect(history.undo(board).cells[40].value).toBe(0);
  });

  test("Redo reapplies undone move", () => {
    const history = new History();
    const board = createEmptyBoard();
    history.record(board, { row: 4, col: 4, value: 5 });

    history.undo(board);
    expect(history.redo(board).cells[40].value).toBe(5);
  });

  test("New action after undo clears redo", () => {
    const history = new History();
    const board = createEmptyBoard();

    history.record(board, { row: 4, col: 4, value: 5 });
    history.undo(board);
    history.record(board, { row: 4, col: 4, value: 9 });

    expect(history.canRedo()).toBe(false);
    expect(history.undo(board).cells[40].value).toBe(0);
  });

  test("Cannot redo when nothing to redo", () => {
    const history = new History();
    const board = createEmptyBoard();
    expect(history.redo(board)).toBe(board);
  });

  test("Cannot undo when nothing to undo", () => {
    const history = new History();
    const board = createEmptyBoard();
    expect(history.undo(board)).toBe(board);
  });

  test("Undo and redo for clear action", () => {
    const history = new History();
    const board = createEmptyBoard();

    board.setValue(4, 4, 5);
    expect(board.cells[40].value).toBe(5);

    history.recordClear(board, 4, 4);
    expect(board.cells[40].value).toBe(0);

    history.undo(board);
    expect(board.cells[40].value).toBe(5);

    history.redo(board);
    expect(board.cells[40].value).toBe(0);
  });

  test("Undo and redo for note action", () => {
    const history = new History();
    const board = createEmptyBoard();

    history.recordNote(board, 4, 4, 1, true);
    expect(board.cells[40].notes).toContain(1);

    history.undo(board);
    expect(board.cells[40].notes).not.toContain(1);

    history.redo(board);
    expect(board.cells[40].notes).toContain(1);
  });

  test("Clear action with notes clears both value and notes", () => {
    const history = new History();
    const board = createEmptyBoard();

    board.setNote(4, 4, 1, true);
    board.setNote(4, 4, 2, true);
    expect(board.cells[40].notes).toEqual([1, 2]);

    history.recordClear(board, 4, 4);
    expect(board.cells[40].value).toBe(0);
    expect(board.cells[40].notes).toEqual([]);

    history.undo(board);
    expect(board.cells[40].notes).toEqual([1, 2]);
  });

  test("History stores compact typed snapshots for undo entries", () => {
    const history = new History();
    const board = createEmptyBoard();

    history.record(board, { row: 0, col: 0, value: 1 });
    const undoStack = (history as unknown as { undoStack: unknown[] }).undoStack;
    const entry = undoStack[0] as {
      boardSnapshot?: { cellMeta?: Uint16Array; noteMasks?: Uint16Array };
    };

    expect(entry.boardSnapshot?.cellMeta).toBeInstanceOf(Uint16Array);
    expect(entry.boardSnapshot?.noteMasks).toBeInstanceOf(Uint16Array);
    expect(entry.boardSnapshot?.cellMeta?.length).toBe(81);
    expect(entry.boardSnapshot?.noteMasks?.length).toBe(81);
  });

  test("Deep accepted stacks keep compact snapshot payload size bounded", () => {
    const history = new History();
    const board = createEmptyBoard();

    for (let i = 0; i < 300; i++) {
      const row = 0;
      const col = 0;
      const value = i % 2 === 0 ? 1 : 2;
      board.clearCell(row, col);
      const recorded = history.record(board, { row, col, value });
      expect(recorded).not.toBeNull();
    }

    const undoStack = (
      history as unknown as {
        undoStack: Array<{ boardSnapshot: { cellMeta: Uint16Array; noteMasks: Uint16Array } }>;
      }
    ).undoStack;
    const totalSnapshotBytes = undoStack.reduce(
      (total, entry) =>
        total + entry.boardSnapshot.cellMeta.byteLength + entry.boardSnapshot.noteMasks.byteLength,
      0,
    );

    expect(undoStack.length).toBe(300);
    expect(totalSnapshotBytes).toBeLessThanOrEqual(120_000);
  });
});
