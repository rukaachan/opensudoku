import { describe, expect, test } from "bun:test";
import { boardToString, parseBoard } from "../../../src/domain/board";
import { createGameplayController } from "../../../src/app/gameplay";
import { getCellSpanFromFrame } from "../../../src/ui/shell";
import { captureControllerFrame } from "./support";

function moveSelectionTo(
  controller: ReturnType<typeof createGameplayController>,
  targetRow: number,
  targetCol: number,
): void {
  while (controller.state.selection.row < targetRow) controller.press("down");
  while (controller.state.selection.row > targetRow) controller.press("up");
  while (controller.state.selection.col < targetCol) controller.press("right");
  while (controller.state.selection.col > targetCol) controller.press("left");
}

describe("Gameplay play-mode mutations and render feedback", () => {
  test("terminal feedback cues distinguish rejected moves, successful edits, and puzzle completion", () => {
    const controller = createGameplayController();
    controller.press("enter");
    controller.press("right");
    controller.press("right");
    controller.press("5");
    expect(controller.consumeTerminalFeedback()).toBe("fail");
    controller.press("4");
    expect(controller.consumeTerminalFeedback()).toBe("success");
    expect(controller.consumeTerminalFeedback()).toBeNull();
    const almostSolved = parseBoard(
      "034678912672195348198342567859761423426853791713924856961537284287419635345286179",
    );
    const solvedController = createGameplayController({ board: almostSolved });
    solvedController.press("enter");
    solvedController.press("5");
    expect(solvedController.state.solved).toBe(true);
    expect(solvedController.consumeTerminalFeedback()).toBe("complete");
    expect(solvedController.consumeTerminalFeedback()).toBeNull();
  });

  test("value entry, clear, notes mode, undo/redo, conflict feedback, solved and contradictory states", () => {
    const controller = createGameplayController();
    controller.press("enter");
    controller.press("right");
    controller.press("right");

    const historyAtStart = controller.state.history.undoCount;
    controller.press("4");
    expect(controller.state.board.getCell(0, 2).value).toBe(4);
    expect(controller.state.history.undoCount).toBe(historyAtStart + 1);

    controller.press("backspace");
    expect(controller.state.board.getCell(0, 2).value).toBe(0);

    controller.press("n");
    expect(controller.state.notesMode).toBe(true);
    controller.press("1");
    expect(controller.state.board.getCell(0, 2).notes).toEqual([1]);

    controller.press("u");
    expect(controller.state.board.getCell(0, 2).notes).toEqual([]);
    controller.press("r");
    expect(controller.state.board.getCell(0, 2).notes).toEqual([1]);
    controller.press("n");
    expect(controller.state.notesMode).toBe(false);

    const undoBeforeConflict = controller.state.history.undoCount;
    controller.press("5");
    expect(controller.state.board.getCell(0, 2).value).toBe(0);
    expect(controller.state.history.undoCount).toBe(undoBeforeConflict);
    expect(controller.state.status.toLowerCase()).toContain("conflict");

    const almostSolved = parseBoard(
      "034678912672195348198342567859761423426853791713924856961537284287419635345286179",
    );
    const solvedController = createGameplayController({ board: almostSolved });
    solvedController.press("enter");
    solvedController.press("5");
    expect(solvedController.state.solved).toBe(true);
    expect(solvedController.state.status).toContain("Solved");

    const contradictory = parseBoard(
      "554678912672195348198342567859761423426853791713924856961537284287419635345286179",
    );
    const contradictoryController = createGameplayController({ board: contradictory });
    contradictoryController.press("enter");
    expect(contradictoryController.state.invalid).toBe(true);
    expect(contradictoryController.state.solved).toBe(false);
  });

  test("notes mode additional note mutations visibly change rendered target cell", async () => {
    const controller = createGameplayController();
    controller.press("enter");
    controller.press("right");
    controller.press("right");
    controller.press("n");
    controller.press("1");
    expect(controller.state.board.getCell(0, 2).notes).toEqual([1]);

    const first = await captureControllerFrame(controller);
    const firstText = getCellSpanFromFrame(first.frame, 0, 2)?.text ?? "";

    controller.press("2");
    expect(controller.state.board.getCell(0, 2).notes).toEqual([1, 2]);
    const second = await captureControllerFrame(controller);
    const secondText = getCellSpanFromFrame(second.frame, 0, 2)?.text ?? "";

    expect(secondText).not.toBe(firstText);
    expect(secondText).toContain("1");
    expect(secondText).toContain("2");
  });

  test("conflict rejection gives explicit row/column/box feedback without board mutation", () => {
    const rowBoard = parseBoard("0".repeat(81));
    rowBoard.setValue(0, 0, 5);
    const rowController = createGameplayController({ board: rowBoard });
    rowController.press("enter");
    for (let step = 0; step < 8; step++) rowController.press("right");
    rowController.press("5");
    expect(rowController.state.board.getCell(0, 8).value).toBe(0);
    expect(rowController.state.status.toLowerCase()).toContain("row conflict");

    const colBoard = parseBoard("0".repeat(81));
    colBoard.setValue(0, 0, 6);
    const colController = createGameplayController({ board: colBoard });
    colController.press("enter");
    for (let step = 0; step < 8; step++) colController.press("down");
    colController.press("6");
    expect(colController.state.board.getCell(8, 0).value).toBe(0);
    expect(colController.state.status.toLowerCase()).toContain("column conflict");

    const boxBoard = parseBoard("0".repeat(81));
    boxBoard.setValue(0, 0, 7);
    const boxController = createGameplayController({ board: boxBoard });
    boxController.press("enter");
    boxController.press("right");
    boxController.press("down");
    boxController.press("7");
    expect(boxController.state.board.getCell(1, 1).value).toBe(0);
    expect(boxController.state.status.toLowerCase()).toContain("box conflict");
  });

  test("hint is contextual, non-mutating, and enforces a two-use session budget", async () => {
    const controller = createGameplayController();
    controller.press("enter");
    expect(controller.state.remainingHints).toBe(2);
    const initialFrame = await captureControllerFrame(controller);
    expect(initialFrame.text).toContain("Hints: 2");

    controller.press("right");
    controller.press("right");
    controller.press("4");
    expect(controller.consumeTerminalFeedback()).toBe("success");
    expect(controller.consumeTerminalFeedback()).toBeNull();
    const beforeHintBoard = boardToString(controller.state.board);
    const beforeHintUndo = controller.state.history.undoCount;
    controller.press("h");
    expect(controller.consumeTerminalFeedback()).toBe("success");
    expect(controller.consumeTerminalFeedback()).toBeNull();

    expect(boardToString(controller.state.board)).toBe(beforeHintBoard);
    expect(controller.state.history.undoCount).toBe(beforeHintUndo);
    expect(controller.state.remainingHints).toBe(1);
    expect(controller.state.status).toMatch(/hint/i);
    expect(controller.state.status).toContain("Hint shown on board.");

    const firstHint = controller.state.lastHint;
    if (!firstHint) throw new Error("Expected first hint payload");
    expect(controller.state.selection.row).toBe(firstHint.row);
    expect(controller.state.selection.col).toBe(firstHint.col);
    expect(controller.state.activeNumber).toBe(firstHint.value);

    const firstHintFrame = await captureControllerFrame(controller);
    expect(firstHintFrame.text).toContain("Hints: 1");

    const beforeToggleBoard = boardToString(controller.state.board);
    const beforeToggleUndo = controller.state.history.undoCount;
    controller.press("h");
    expect(controller.consumeTerminalFeedback()).toBe("success");
    expect(controller.consumeTerminalFeedback()).toBeNull();
    expect(boardToString(controller.state.board)).toBe(beforeToggleBoard);
    expect(controller.state.history.undoCount).toBe(beforeToggleUndo);
    expect(controller.state.remainingHints).toBe(1);
    expect(controller.state.activeNumber).toBeNull();
    expect(controller.state.status.toLowerCase()).toContain("hint hidden");

    controller.press("h");
    expect(controller.consumeTerminalFeedback()).toBe("success");
    expect(controller.consumeTerminalFeedback()).toBeNull();
    expect(controller.state.remainingHints).toBe(1);
    expect(controller.state.status).toMatch(/hint/i);
  });
  test("hint requests do not mutate history and successful value/clear mutations clear stale hint context", () => {
    const controller = createGameplayController();
    controller.press("enter");

    const beforeHintBoard = boardToString(controller.state.board);
    const beforeHintUndo = controller.state.history.undoCount;
    controller.press("h");

    expect(boardToString(controller.state.board)).toBe(beforeHintBoard);
    expect(controller.state.history.undoCount).toBe(beforeHintUndo);
    expect(controller.state.remainingHints).toBe(1);
    expect(controller.state.lastHint).not.toBeNull();

    const firstHint = controller.state.lastHint;
    if (!firstHint) throw new Error("Expected hint payload");

    moveSelectionTo(controller, firstHint.row, firstHint.col);
    controller.press(String(firstHint.value));
    expect(controller.state.lastHint).toBeNull();
    expect(controller.state.remainingHints).toBe(1);

    controller.press("h");
    expect(controller.state.lastHint).not.toBeNull();
    expect(controller.state.remainingHints).toBe(0);
    const secondHint = controller.state.lastHint;
    if (!secondHint) throw new Error("Expected second hint payload");
    moveSelectionTo(controller, secondHint.row, secondHint.col);
    controller.press(String(secondHint.value));

    expect(controller.state.lastHint).toBeNull();
    expect(controller.state.remainingHints).toBe(0);
  });

  test("hint status remains visibly distinct for solved, contradictory, and no-logical boards", () => {
    const solved = createGameplayController({
      board: parseBoard(
        "534678912672195348198342567859761423426853791713924856961537284287419635345286179",
      ),
    });
    solved.press("enter");
    solved.press("h");
    expect(solved.state.status).toContain("already solved");

    const contradictory = createGameplayController({
      board: parseBoard(
        "554678912672195348198342567859761423426853791713924856961537284287419635345286179",
      ),
    });
    contradictory.press("enter");
    contradictory.press("h");
    expect(contradictory.state.status).toContain("conflicts");

    const noLogical = createGameplayController({ board: parseBoard("0".repeat(81)) });
    noLogical.press("enter");
    noLogical.press("h");
    expect(noLogical.state.status).toContain("No clear hint right now");
  });
});
