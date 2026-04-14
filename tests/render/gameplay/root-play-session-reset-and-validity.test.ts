import { describe, test, expect } from "bun:test";
import { boardToString, parseBoard } from "../../../src/domain/board";
import { createGameplayController, DEFAULT_PUZZLE } from "../../../src/app/gameplay";
import { Difficulty } from "../../../src/app/puzzle-tools";
import { captureControllerFrame } from "./support";

describe("Gameplay session reset and board validity", () => {
  test("returning to root and starting play resets to fresh default session", () => {
    const controller = createGameplayController();
    controller.press("enter");
    controller.press("right");
    controller.press("right");
    controller.press("4");
    controller.press("h");
    expect(controller.state.history.undoCount).toBeGreaterThan(0);
    expect(controller.state.lastHint).not.toBeNull();
    controller.press("escape");

    controller.press("down");
    controller.press("down");
    controller.press("enter");
    expect(controller.state.screen).toBe("generator");
    controller.press("3");
    expect(controller.state.activeDifficulty).toBe(Difficulty.Hard);
    controller.press("escape");

    controller.press("p");
    expect(controller.state.screen).toBe("play");
    expect(boardToString(controller.state.board)).toBe(DEFAULT_PUZZLE);
    expect(controller.state.activeDifficulty).toBeNull();
    expect(controller.state.lastHint).toBeNull();
    expect(controller.state.history.undoCount).toBe(0);
    expect(controller.state.history.redoCount).toBe(0);
    expect(controller.state.selection.row).toBe(0);
    expect(controller.state.selection.col).toBe(0);
    expect(controller.state.notesMode).toBe(false);
  });

  test("contradictory board fixtures surface explicit invalid state in play render", async () => {
    const contradictory = parseBoard(
      "554678912672195348198342567859761423426853791713924856961537284287419635345286179",
    );
    const controller = createGameplayController({ board: contradictory });
    controller.press("enter");

    expect(controller.state.invalid).toBe(true);
    const { text } = await captureControllerFrame(controller);
    expect(text).toContain("State: INVALID");
    expect(text).toContain("Status: Invalid board: contradictory state detected.");
  });

  test("default puzzle fixture remains contradiction-free", () => {
    const board = parseBoard(DEFAULT_PUZZLE);
    expect(board.hasContradiction()).toBe(false);
    expect(board.isSolved()).toBe(false);
  });
});
