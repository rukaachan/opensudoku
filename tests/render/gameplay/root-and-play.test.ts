import { describe, test, expect } from "bun:test";
import { boardToString } from "../../../src/domain/board";
import { createGameplayController } from "../../../src/app/gameplay";
import { getCellSpanFromFrame, getRootActionSpanFromFrame } from "../../../src/ui/shell";
import { captureControllerFrame } from "./support";

describe("Gameplay root shell and play interactions", () => {
  test("first launch shows root actions with visible focus styling and all top-level actions", async () => {
    const controller = createGameplayController();
    expect(controller.state.screen).toBe("root");

    const { frame, text } = await captureControllerFrame(controller);
    expect(text).toContain("OpenSudoku");
    expect(text).toContain("> Play");
    expect(text).toContain("  Daily");
    expect(text).toContain("  Generator");
    expect(text).toContain("  Solver Checks");
    expect(text).toContain("  Help");
    expect(text).toContain("  Quit");

    const focusedPlay = getRootActionSpanFromFrame(frame, 0);
    const unfocusedGenerator = getRootActionSpanFromFrame(frame, 2);
    expect(focusedPlay?.text).toContain("> Play");
    expect(unfocusedGenerator?.text).toContain("  Generator");
    expect(focusedPlay?.bg).toBeDefined();
    expect(focusedPlay?.attributes).not.toEqual(unfocusedGenerator?.attributes);
  });

  test("keyboard-only traversal reaches play/generator/solver/help and returns root", () => {
    const controller = createGameplayController();
    controller.press("enter");
    expect(controller.state.screen).toBe("play");
    controller.press("escape");
    expect(controller.state.screen).toBe("root");

    controller.press("down");
    controller.press("enter");
    expect(controller.state.screen).toBe("daily");
    controller.press("escape");
    expect(controller.state.screen).toBe("root");

    controller.press("down");
    controller.press("enter");
    expect(controller.state.screen).toBe("generator");
    controller.press("escape");
    expect(controller.state.screen).toBe("root");

    controller.press("s");
    controller.press("s");
    controller.press("enter");
    expect(controller.state.screen).toBe("solver");
    controller.press("escape");
    expect(controller.state.screen).toBe("root");

    controller.press("h");
    expect(controller.state.screen).toBe("help");
    controller.press("escape");
    expect(controller.state.screen).toBe("root");
  });

  test("quit is accepted from root menu activation and direct quit hotkey", () => {
    const byMenu = createGameplayController();
    byMenu.press("down");
    byMenu.press("down");
    byMenu.press("down");
    byMenu.press("down");
    byMenu.press("down");
    byMenu.press("down");
    expect(byMenu.state.rootFocusIndex).toBe(6);
    expect(byMenu.press("enter")).toBe("quit-app");

    const byHotkey = createGameplayController();
    expect(byHotkey.press("q")).toBe("quit-app");
  });

  test("play mode renders valid board with one active selection and distinct selected-cell styling", async () => {
    const controller = createGameplayController();
    controller.press("enter");

    expect(controller.state.screen).toBe("play");
    expect(controller.state.selection.row).toBe(0);
    expect(controller.state.selection.col).toBe(0);
    expect(controller.state.board.hasContradiction()).toBe(false);

    const { frame, text } = await captureControllerFrame(controller);
    expect(text).toContain(" 5  3  .  │  .  7  .  │  .  .  .");
    expect(text).not.toContain("Daily Challenger");

    const selected = getCellSpanFromFrame(frame, 0, 0);
    const unselected = getCellSpanFromFrame(frame, 0, 1);
    expect(selected?.text).toBe(" 5 ");
    expect(unselected?.text).toContain(" 3 ");
    expect(selected?.bg).not.toEqual(unselected?.bg);
    expect(selected?.fg).not.toEqual(unselected?.fg);
    expect(selected?.attributes).not.toBe(unselected?.attributes);
  });

  test("movement clamps at edges while selected-cell visuals remain distinct", async () => {
    const controller = createGameplayController();
    controller.press("enter");
    controller.press("left");
    controller.press("up");
    expect(controller.state.selection.row).toBe(0);
    expect(controller.state.selection.col).toBe(0);

    const { frame } = await captureControllerFrame(controller);
    const selected = getCellSpanFromFrame(frame, 0, 0);
    const neighbor = getCellSpanFromFrame(frame, 0, 1);
    expect(selected?.text).toBe(" 5 ");
    expect(selected?.bg).toBeDefined();
    expect(selected?.attributes).not.toEqual(neighbor?.attributes);
  });

  test("movement is bounded and given cells are locked without history mutation", () => {
    const controller = createGameplayController();
    controller.press("enter");
    controller.press("left");
    controller.press("up");
    controller.press("right");
    controller.press("down");
    expect(controller.state.selection.row).toBe(1);
    expect(controller.state.selection.col).toBe(1);

    controller.press("up");
    controller.press("left");
    const beforeUndoCount = controller.state.history.undoCount;
    controller.press("9");
    controller.press("backspace");
    controller.press("n");
    controller.press("1");

    const cell = controller.state.board.getCell(0, 0);
    expect(cell.value).toBe(5);
    expect(cell.notes).toEqual([]);
    expect(controller.state.history.undoCount).toBe(beforeUndoCount);
    expect(controller.state.status).toContain("locked");
  });

  test("toggling notes mode updates visible mode/status without mutating board or history", async () => {
    const controller = createGameplayController();
    controller.press("enter");

    const boardBefore = boardToString(controller.state.board);
    const undoBefore = controller.state.history.undoCount;

    const beforeFrame = await captureControllerFrame(controller);
    expect(beforeFrame.text).toContain("Mode: Values");

    controller.press("n");
    expect(controller.state.notesMode).toBe(true);
    expect(controller.state.status).toContain("Notes mode enabled");
    expect(boardToString(controller.state.board)).toBe(boardBefore);
    expect(controller.state.history.undoCount).toBe(undoBefore);

    const enabledFrame = await captureControllerFrame(controller);
    expect(enabledFrame.text).toContain("Mode: Notes");
    expect(enabledFrame.text).toContain("Status: Notes mode enabled.");

    controller.press("n");
    expect(controller.state.notesMode).toBe(false);
    expect(controller.state.status).toContain("Notes mode disabled");
    expect(boardToString(controller.state.board)).toBe(boardBefore);
    expect(controller.state.history.undoCount).toBe(undoBefore);

    const disabledFrame = await captureControllerFrame(controller);
    expect(disabledFrame.text).toContain("Mode: Values");
    expect(disabledFrame.text).toContain("Status: Notes mode disabled.");
  });

  test("candidate entry rejects filled editable, given, and run-locked states without board/history mutation", () => {
    const controller = createGameplayController();
    controller.press("enter");
    controller.press("right");
    controller.press("right");
    controller.press("4");

    controller.press("n");
    const filledBoardBefore = boardToString(controller.state.board);
    const filledUndoBefore = controller.state.history.undoCount;
    const filledNotesBefore = [...controller.state.board.getCell(0, 2).notes];

    controller.press("1");
    expect(boardToString(controller.state.board)).toBe(filledBoardBefore);
    expect(controller.state.history.undoCount).toBe(filledUndoBefore);
    expect(controller.state.board.getCell(0, 2).notes).toEqual(filledNotesBefore);
    expect(controller.state.status.toLowerCase()).toContain("empty");

    controller.press("left");
    controller.press("left");
    const givenBoardBefore = boardToString(controller.state.board);
    const givenUndoBefore = controller.state.history.undoCount;

    controller.press("2");
    expect(boardToString(controller.state.board)).toBe(givenBoardBefore);
    expect(controller.state.history.undoCount).toBe(givenUndoBefore);
    expect(controller.state.board.getCell(0, 0).notes).toEqual([]);
    expect(controller.state.status.toLowerCase()).toContain("locked");

    controller.state.runLocked = true;
    controller.state.selection = controller.state.selection.moveRight();
    const lockedBoardBefore = boardToString(controller.state.board);
    const lockedUndoBefore = controller.state.history.undoCount;

    controller.press("3");
    expect(boardToString(controller.state.board)).toBe(lockedBoardBefore);
    expect(controller.state.history.undoCount).toBe(lockedUndoBefore);
    expect(controller.state.board.getCell(0, 1).notes).toEqual([]);
    expect(controller.state.status.toLowerCase()).toContain("run locked");

    controller.state.challengeFailed = true;
    controller.state.status = "Challenge time expired. Run failed — restart Play from root.";
    controller.state.notesMode = true;
    controller.press("right");
    controller.press("right");
    const failedBoardBefore = boardToString(controller.state.board);
    const failedUndoBefore = controller.state.history.undoCount;
    const failedStatusBefore = controller.state.status;
    const failedSelectionBefore = { ...controller.state.selection };

    controller.press("1");
    controller.press("c");
    controller.press("u");
    expect(boardToString(controller.state.board)).toBe(failedBoardBefore);
    expect(controller.state.history.undoCount).toBe(failedUndoBefore);
    expect(controller.state.status).toBe(failedStatusBefore);

    controller.press("left");
    expect(controller.state.selection.col).toBe(failedSelectionBefore.col - 1);
  });
});
