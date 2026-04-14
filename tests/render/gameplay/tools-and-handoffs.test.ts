import { describe, test, expect } from "bun:test";
import { boardToString, parseBoard } from "../../../src/domain/board";
import { createGameplayController } from "../../../src/app/gameplay";
import { Difficulty } from "../../../src/app/puzzle-tools";
import { snapshotSession } from "./support";

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

function moveToFirstEditableCell(controller: ReturnType<typeof createGameplayController>): void {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (!controller.state.board.getCell(row, col).isGiven) {
        moveSelectionTo(controller, row, col);
        return;
      }
    }
  }
  throw new Error("Expected at least one editable cell.");
}

describe("Gameplay generator/solver flows and state handoffs", () => {
  test("generator supported difficulty creates playable puzzles and performs a clean play handoff", () => {
    const supported: Array<{ key: "1" | "2" | "3"; difficulty: Difficulty }> = [
      { key: "1", difficulty: Difficulty.Easy },
      { key: "2", difficulty: Difficulty.Medium },
      { key: "3", difficulty: Difficulty.Hard },
    ];

    for (const { key, difficulty } of supported) {
      const controller = createGameplayController();
      controller.press("enter");
      controller.press("right");
      controller.press("right");
      controller.press("4");
      controller.press("n");
      controller.press("1");
      expect(controller.state.history.undoCount).toBeGreaterThan(0);
      expect(controller.state.notesMode).toBe(true);
      controller.press("escape");

      controller.press("g");
      expect(controller.state.screen).toBe("generator");
      controller.press(key);

      expect(controller.state.screen).toBe("play");
      expect(controller.state.activeDifficulty).toBe(difficulty);
      expect(controller.state.status.toLowerCase()).toContain(difficulty);
      expect(controller.state.selection.row).toBe(0);
      expect(controller.state.selection.col).toBe(0);
      expect(controller.state.history.undoCount).toBe(0);
      expect(controller.state.history.redoCount).toBe(0);
      expect(controller.state.notesMode).toBe(false);
      expect(controller.state.lastHint).toBeNull();
      expect(controller.state.solved).toBe(false);
      expect(controller.state.invalid).toBe(false);
      expect(controller.state.board.hasContradiction()).toBe(false);

      let givenCount = 0;
      let emptyCount = 0;
      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
          const cell = controller.state.board.getCell(row, col);
          if (cell.isGiven && cell.value !== 0) givenCount++;
          if (cell.value === 0 && !cell.isGiven) emptyCount++;
        }
      }
      expect(givenCount).toBeGreaterThan(0);
      expect(emptyCount).toBeGreaterThan(0);

      controller.press("right");
      expect(controller.state.selection.col).toBe(1);
    }
  });

  test("generator unsupported difficulty fails clearly without fallback or unrelated state mutation", () => {
    const controller = createGameplayController();
    controller.press("enter");
    controller.press("right");
    controller.press("right");
    controller.press("4");
    controller.press("escape");

    const boardBefore = boardToString(controller.state.board);
    const historyUndoBefore = controller.state.history.undoCount;
    const historyRedoBefore = controller.state.history.redoCount;
    const difficultyBefore = controller.state.activeDifficulty;

    controller.press("g");
    expect(controller.state.screen).toBe("generator");
    controller.press("5");

    expect(controller.state.screen).toBe("generator");
    expect(controller.state.status.toLowerCase()).toContain("unsupported");
    expect(boardToString(controller.state.board)).toBe(boardBefore);
    expect(controller.state.history.undoCount).toBe(historyUndoBefore);
    expect(controller.state.history.redoCount).toBe(historyRedoBefore);
    expect(controller.state.activeDifficulty).toBe(difficultyBefore);
  });

  test("solver reports solved, invalid, and unsolvable outcomes distinctly", () => {
    const controller = createGameplayController();
    controller.press("down");
    controller.press("down");
    controller.press("down");
    controller.press("down");
    controller.press("enter");
    expect(controller.state.screen).toBe("solver");

    controller.press("1");
    expect(controller.state.status.toLowerCase()).toContain("solved");
    controller.press("2");
    expect(controller.state.status.toLowerCase()).toContain("invalid");
    controller.press("3");
    expect(controller.state.status.toLowerCase()).toContain("unsolvable");
  });

  test("solver flow is screen-local and preserves existing generated play session including last hint", () => {
    const controller = createGameplayController();
    controller.press("down");
    controller.press("down");
    controller.press("enter");
    controller.press("3");
    expect(controller.state.screen).toBe("play");

    moveToFirstEditableCell(controller);
    controller.press("n");
    controller.press("1");
    controller.press("n");
    controller.press("h");
    expect(controller.state.history.undoCount).toBeGreaterThan(0);
    expect(controller.state.lastHint).not.toBeNull();

    const beforeSolver = snapshotSession(controller);
    controller.press("escape");
    expect(controller.state.screen).toBe("root");
    controller.press("down");
    controller.press("down");
    controller.press("down");
    controller.press("down");
    controller.press("enter");
    expect(controller.state.screen).toBe("solver");

    controller.press("1");
    expect(controller.state.status.toLowerCase()).toContain("solved");
    controller.press("2");
    expect(controller.state.status.toLowerCase()).toContain("invalid");
    controller.press("3");
    expect(controller.state.status.toLowerCase()).toContain("unsolvable");
    controller.press("escape");
    expect(controller.state.screen).toBe("root");
    expect(controller.state.status).toBe("Use arrows/WASD + Enter to choose.");
    expect(snapshotSession(controller)).toEqual(beforeSolver);
  });

  test("solver current-board path evaluates a live snapshot distinct from canned fixtures", () => {
    const customBoard = parseBoard("0".repeat(81));
    customBoard.setValue(0, 0, 1);
    customBoard.setValue(0, 1, 1); // contradictory row to force invalid.
    const controller = createGameplayController({ board: customBoard });
    controller.press("enter");
    expect(controller.state.screen).toBe("play");

    const beforeSolver = boardToString(controller.state.board);
    controller.press("escape");
    controller.press("down");
    controller.press("down");
    controller.press("down");
    controller.press("down");
    controller.press("enter");
    expect(controller.state.screen).toBe("solver");

    controller.press("c");
    expect(controller.state.status.toLowerCase()).toContain("invalid");
    expect(controller.state.status.toLowerCase()).not.toContain("known puzzle");
    expect(boardToString(controller.state.board)).toBe(beforeSolver);
  });

  test("quit controls exit from root/play/generator/solver/help screens", () => {
    const rootController = createGameplayController();
    expect(rootController.press("q")).toBe("quit-app");

    const playController = createGameplayController();
    playController.press("enter");
    expect(playController.state.screen).toBe("play");
    expect(playController.press("q")).toBe("quit-app");

    const generatorController = createGameplayController();
    generatorController.press("g");
    expect(generatorController.state.screen).toBe("generator");
    expect(generatorController.press("q")).toBe("quit-app");

    const solverController = createGameplayController();
    solverController.press("down");
    solverController.press("down");
    solverController.press("down");
    solverController.press("down");
    solverController.press("enter");
    expect(solverController.state.screen).toBe("solver");
    expect(solverController.press("q")).toBe("quit-app");

    const helpController = createGameplayController();
    helpController.press("h");
    expect(helpController.state.screen).toBe("help");
    expect(helpController.press("q")).toBe("quit-app");
  });
});
