import { describe, expect, test } from "bun:test";
import { boardToString } from "../../../src/domain/board";
import { createGameplayController } from "../../../src/app/gameplay";

function snapshotNotes(controller: ReturnType<typeof createGameplayController>): string {
  const rows: string[] = [];
  for (let row = 0; row < 9; row++) {
    const cols: string[] = [];
    for (let col = 0; col < 9; col++) {
      cols.push(controller.state.board.getCell(row, col).notes.join(""));
    }
    rows.push(cols.join("|"));
  }
  return rows.join("\n");
}

const EMPTY_NOTES_SNAPSHOT = Array.from({ length: 9 }, () => Array(9).fill("").join("|")).join(
  "\n",
);

describe("Hint candidate integrity and fresh candidate reset", () => {
  test("hint requests preserve candidates, selection, notes mode, and history in both value and notes modes", () => {
    const valueMode = createGameplayController();
    valueMode.press("enter");
    valueMode.press("right");
    valueMode.press("right");
    valueMode.press("n");
    valueMode.press("1");
    valueMode.press("2");
    valueMode.press("n");

    const beforeValueHint = {
      board: boardToString(valueMode.state.board),
      notes: snapshotNotes(valueMode),
      row: valueMode.state.selection.row,
      col: valueMode.state.selection.col,
      notesMode: valueMode.state.notesMode,
      undo: valueMode.state.history.undoCount,
      redo: valueMode.state.history.redoCount,
      remainingHints: valueMode.state.remainingHints,
    };
    valueMode.press("h");

    expect(boardToString(valueMode.state.board)).toBe(beforeValueHint.board);
    expect(snapshotNotes(valueMode)).toBe(beforeValueHint.notes);
    const valueHint = valueMode.state.lastHint;
    if (!valueHint) throw new Error("Expected hint payload in value mode");
    expect(valueMode.state.selection.row).toBe(valueHint.row);
    expect(valueMode.state.selection.col).toBe(valueHint.col);
    expect(valueMode.state.activeNumber).toBe(valueHint.value);
    expect(valueMode.state.notesMode).toBe(beforeValueHint.notesMode);
    expect(valueMode.state.history.undoCount).toBe(beforeValueHint.undo);
    expect(valueMode.state.history.redoCount).toBe(beforeValueHint.redo);
    expect(valueMode.state.remainingHints).toBe(beforeValueHint.remainingHints - 1);
    expect(valueMode.state.lastHint).not.toBeNull();

    const notesMode = createGameplayController();
    notesMode.press("enter");
    notesMode.press("right");
    notesMode.press("right");
    notesMode.press("n");
    notesMode.press("1");
    notesMode.press("2");

    const beforeNotesHint = {
      board: boardToString(notesMode.state.board),
      notes: snapshotNotes(notesMode),
      row: notesMode.state.selection.row,
      col: notesMode.state.selection.col,
      notesMode: notesMode.state.notesMode,
      undo: notesMode.state.history.undoCount,
      redo: notesMode.state.history.redoCount,
      remainingHints: notesMode.state.remainingHints,
    };
    notesMode.press("h");

    expect(boardToString(notesMode.state.board)).toBe(beforeNotesHint.board);
    expect(snapshotNotes(notesMode)).toBe(beforeNotesHint.notes);
    const notesHint = notesMode.state.lastHint;
    if (!notesHint) throw new Error("Expected hint payload in notes mode");
    expect(notesMode.state.selection.row).toBe(notesHint.row);
    expect(notesMode.state.selection.col).toBe(notesHint.col);
    expect(notesMode.state.activeNumber).toBe(notesHint.value);
    expect(notesMode.state.notesMode).toBe(beforeNotesHint.notesMode);
    expect(notesMode.state.history.undoCount).toBe(beforeNotesHint.undo);
    expect(notesMode.state.history.redoCount).toBe(beforeNotesHint.redo);
    expect(notesMode.state.remainingHints).toBe(beforeNotesHint.remainingHints - 1);
    expect(notesMode.state.lastHint).not.toBeNull();
  });

  test("hint guidance toggles without mutating board candidates, and failed hint requests keep state untouched", () => {
    const exhausted = createGameplayController();
    exhausted.press("enter");
    exhausted.press("right");
    exhausted.press("right");
    exhausted.press("n");
    exhausted.press("1");
    exhausted.press("2");
    exhausted.press("h");

    const toggledHint = exhausted.state.lastHint;
    if (!toggledHint) throw new Error("Expected hint payload before toggle");
    const beforeToggle = {
      board: boardToString(exhausted.state.board),
      notes: snapshotNotes(exhausted),
      row: exhausted.state.selection.row,
      col: exhausted.state.selection.col,
      notesMode: exhausted.state.notesMode,
      undo: exhausted.state.history.undoCount,
      redo: exhausted.state.history.redoCount,
      remainingHints: exhausted.state.remainingHints,
    };
    exhausted.press("h");

    expect(boardToString(exhausted.state.board)).toBe(beforeToggle.board);
    expect(snapshotNotes(exhausted)).toBe(beforeToggle.notes);
    expect(exhausted.state.selection.row).toBe(beforeToggle.row);
    expect(exhausted.state.selection.col).toBe(beforeToggle.col);
    expect(exhausted.state.notesMode).toBe(beforeToggle.notesMode);
    expect(exhausted.state.history.undoCount).toBe(beforeToggle.undo);
    expect(exhausted.state.history.redoCount).toBe(beforeToggle.redo);
    expect(exhausted.state.remainingHints).toBe(beforeToggle.remainingHints);
    expect(exhausted.state.lastHint).not.toBeNull();
    expect(exhausted.state.activeNumber).toBeNull();

    exhausted.press("h");
    expect(exhausted.state.remainingHints).toBe(beforeToggle.remainingHints);
    expect(exhausted.state.activeNumber).toBe(toggledHint.value);

    const failed = createGameplayController();
    failed.press("enter");
    failed.press("right");
    failed.press("right");
    failed.press("n");
    failed.press("1");
    failed.press("2");
    failed.press("h");
    failed.state.board.setValue(0, 2, 5);

    const beforeFailure = {
      board: boardToString(failed.state.board),
      notes: snapshotNotes(failed),
      row: failed.state.selection.row,
      col: failed.state.selection.col,
      notesMode: failed.state.notesMode,
      undo: failed.state.history.undoCount,
      redo: failed.state.history.redoCount,
      remainingHints: failed.state.remainingHints,
    };
    failed.state.lastHint = null;
    failed.press("h");

    expect(boardToString(failed.state.board)).toBe(beforeFailure.board);
    expect(snapshotNotes(failed)).toBe(beforeFailure.notes);
    expect(failed.state.selection.row).toBe(beforeFailure.row);
    expect(failed.state.selection.col).toBe(beforeFailure.col);
    expect(failed.state.notesMode).toBe(beforeFailure.notesMode);
    expect(failed.state.history.undoCount).toBe(beforeFailure.undo);
    expect(failed.state.history.redoCount).toBe(beforeFailure.redo);
    expect(failed.state.remainingHints).toBe(beforeFailure.remainingHints);
    expect(failed.state.lastHint).toBeNull();
    expect(failed.state.status).toContain("conflicts");
  });

  test("fresh normal, generated, and Daily sessions clear stale candidate and assist HUD context", () => {
    const normal = createGameplayController();
    normal.press("enter");
    normal.press("right");
    normal.press("right");
    normal.press("n");
    normal.press("1");
    normal.press("h");
    expect(snapshotNotes(normal)).not.toBe(EMPTY_NOTES_SNAPSHOT);
    normal.press("escape");
    normal.press("p");
    expect(normal.state.notesMode).toBe(false);
    expect(normal.state.lastHint).toBeNull();
    expect(normal.state.remainingHints).toBe(2);
    expect(normal.state.activeNumber).toBeNull();
    expect(normal.state.history.undoCount).toBe(0);
    expect(normal.state.history.redoCount).toBe(0);
    expect(normal.state.selection.row).toBe(0);
    expect(normal.state.selection.col).toBe(0);
    expect(snapshotNotes(normal)).toBe(EMPTY_NOTES_SNAPSHOT);

    const generated = createGameplayController();
    generated.press("enter");
    generated.press("right");
    generated.press("right");
    generated.press("n");
    generated.press("1");
    generated.press("h");
    expect(snapshotNotes(generated)).not.toBe(EMPTY_NOTES_SNAPSHOT);
    generated.press("escape");
    generated.press("g");
    generated.press("1");
    expect(generated.state.activeSessionType).toBe("generated");
    expect(generated.state.notesMode).toBe(false);
    expect(generated.state.lastHint).toBeNull();
    expect(generated.state.remainingHints).toBe(2);
    expect(generated.state.activeNumber).toBeNull();
    expect(generated.state.history.undoCount).toBe(0);
    expect(generated.state.history.redoCount).toBe(0);
    expect(generated.state.selection.row).toBe(0);
    expect(generated.state.selection.col).toBe(0);
    expect(snapshotNotes(generated)).toBe(EMPTY_NOTES_SNAPSHOT);

    const daily = createGameplayController();
    daily.press("enter");
    daily.press("right");
    daily.press("right");
    daily.press("n");
    daily.press("1");
    daily.press("h");
    expect(snapshotNotes(daily)).not.toBe(EMPTY_NOTES_SNAPSHOT);
    daily.press("escape");
    daily.press("d");
    daily.press("enter");
    expect(daily.state.activeSessionType).toBe("daily");
    expect(daily.state.notesMode).toBe(false);
    expect(daily.state.lastHint).toBeNull();
    expect(daily.state.remainingHints).toBe(2);
    expect(daily.state.activeNumber).toBeNull();
    expect(daily.state.history.undoCount).toBe(0);
    expect(daily.state.history.redoCount).toBe(0);
    expect(daily.state.selection.row).toBe(0);
    expect(daily.state.selection.col).toBe(0);
    expect(snapshotNotes(daily)).toBe(EMPTY_NOTES_SNAPSHOT);
  });
});
