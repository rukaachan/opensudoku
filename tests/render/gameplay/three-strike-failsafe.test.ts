import { describe, expect, test } from "bun:test";
import { boardToString } from "../../../src/domain/board";
import { createGameplayController } from "../../../src/app/gameplay";

function moveToEditableTopRowCell(controller: ReturnType<typeof createGameplayController>): void {
  controller.press("right");
  controller.press("right");
}

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

function forceThreeStrikesOnGivenCell(
  controller: ReturnType<typeof createGameplayController>,
): void {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (controller.state.board.getCell(row, col).isGiven) {
        moveSelectionTo(controller, row, col);
        row = 9;
        break;
      }
    }
  }
  controller.press("1");
  controller.press("2");
  controller.press("3");
  expect(controller.state.strikeCount).toBe(3);
  expect(controller.state.runLocked).toBe(true);
}

describe("Gameplay three-strike failsafe", () => {
  test("conflicting editable and given-cell rejects consume strikes while navigation, note edits, hints, and noop clear do not", () => {
    const controller = createGameplayController();
    controller.press("enter");
    moveToEditableTopRowCell(controller);

    const beforeNoopActions = boardToString(controller.state.board);
    controller.press("backspace");
    controller.press("n");
    controller.press("1");
    controller.press("n");
    controller.press("h");
    moveSelectionTo(controller, 0, 2);
    controller.press("left");
    controller.press("right");
    expect(controller.state.strikeCount).toBe(0);
    expect(boardToString(controller.state.board)).toBe(beforeNoopActions);

    controller.press("5");
    expect(controller.state.strikeCount).toBe(1);
    expect(controller.state.status).toContain("Strike 1/3");

    controller.press("left");
    controller.press("left");
    const beforeGivenRejects = boardToString(controller.state.board);
    controller.press("backspace");
    expect(controller.state.strikeCount).toBe(2);
    expect(controller.state.status).toContain("Strike 2/3");
    controller.press("1");
    expect(controller.state.strikeCount).toBe(3);
    expect(controller.state.runLocked).toBe(true);
    expect(boardToString(controller.state.board)).toBe(beforeGivenRejects);
  });

  test("strike lockout survives non-fresh detours and only fresh Play/Generator/Daily starts clear it", () => {
    const controller = createGameplayController();
    controller.press("enter");
    forceThreeStrikesOnGivenCell(controller);

    controller.press("escape");
    expect(controller.state.screen).toBe("root");
    expect(controller.state.strikeCount).toBe(3);
    expect(controller.state.runLocked).toBe(true);

    controller.press("h");
    expect(controller.state.screen).toBe("help");
    controller.press("escape");
    expect(controller.state.strikeCount).toBe(3);
    expect(controller.state.runLocked).toBe(true);

    controller.press("up");
    controller.press("enter");
    expect(controller.state.screen).toBe("solver");
    controller.press("1");
    controller.press("escape");
    expect(controller.state.strikeCount).toBe(3);
    expect(controller.state.runLocked).toBe(true);

    controller.press("g");
    expect(controller.state.screen).toBe("generator");
    controller.press("9");
    expect(controller.state.screen).toBe("generator");
    controller.press("escape");
    expect(controller.state.strikeCount).toBe(3);
    expect(controller.state.runLocked).toBe(true);

    controller.press("d");
    expect(controller.state.screen).toBe("daily");
    controller.press("escape");
    expect(controller.state.strikeCount).toBe(3);
    expect(controller.state.runLocked).toBe(true);

    controller.press("p");
    expect(controller.state.screen).toBe("play");
    expect(controller.state.strikeCount).toBe(0);
    expect(controller.state.runLocked).toBe(false);

    forceThreeStrikesOnGivenCell(controller);
    controller.press("escape");
    controller.press("g");
    controller.press("1");
    expect(controller.state.screen).toBe("play");
    expect(controller.state.activeSessionType).toBe("generated");
    expect(controller.state.strikeCount).toBe(0);
    expect(controller.state.runLocked).toBe(false);

    forceThreeStrikesOnGivenCell(controller);
    controller.press("escape");
    controller.press("d");
    controller.press("enter");
    controller.press("enter");
    expect(controller.state.screen).toBe("play");
    expect(controller.state.activeSessionType).toBe("daily");
    expect(controller.state.strikeCount).toBe(0);
    expect(controller.state.runLocked).toBe(false);
  });

  test("only explicit rejected play moves consume strikes and the third strike locks mutations until fresh play restart", () => {
    const controller = createGameplayController();
    controller.press("enter");

    moveToEditableTopRowCell(controller);
    const beforeNoopClear = boardToString(controller.state.board);
    controller.press("backspace");
    controller.press("n");
    controller.press("n");
    controller.press("h");
    moveSelectionTo(controller, 0, 2);
    expect(boardToString(controller.state.board)).toBe(beforeNoopClear);

    controller.press("left");
    controller.press("left");
    controller.press("1");
    expect(controller.state.status).toContain("Strike 1/3");

    controller.press("backspace");
    expect(controller.state.status).toContain("Strike 2/3");

    controller.press("right");
    controller.press("right");
    const beforeStrikeThree = boardToString(controller.state.board);
    controller.press("5");
    expect(controller.state.status).toContain("Strike 3/3");
    expect(controller.state.status.toLowerCase()).toContain("restart");
    expect(boardToString(controller.state.board)).toBe(beforeStrikeThree);

    controller.press("4");
    expect(boardToString(controller.state.board)).toBe(beforeStrikeThree);
    expect(controller.state.status.toLowerCase()).toContain("restart");

    controller.press("escape");
    controller.press("g");
    controller.press("1");
    expect(controller.state.runLocked).toBe(false);
    expect(controller.state.strikeCount).toBe(0);

    controller.press("escape");
    controller.press("s");
    controller.press("1");
    controller.press("escape");
    controller.press("h");
    controller.press("escape");
    controller.press("p");
    controller.press("right");
    controller.press("right");
    controller.press("4");
    expect(controller.state.board.getCell(0, 2).value).toBe(4);
  });

  test("run lockout keeps visible lockout reason while candidate attempts are rejected and navigation still works", () => {
    const controller = createGameplayController();
    controller.press("enter");
    forceThreeStrikesOnGivenCell(controller);
    controller.state.notesMode = true;
    const lockoutStatus = controller.state.status;
    const before = boardToString(controller.state.board);
    const undoBefore = controller.state.history.undoCount;
    const selectionBefore = { ...controller.state.selection };

    controller.press("n");
    controller.press("1");
    controller.press("c");
    controller.press("u");
    expect(controller.state.status).toBe(lockoutStatus);
    expect(boardToString(controller.state.board)).toBe(before);
    expect(controller.state.history.undoCount).toBe(undoBefore);

    controller.press("left");
    expect(controller.state.selection.col).toBe(Math.max(0, selectionBefore.col - 1));
  });
});
