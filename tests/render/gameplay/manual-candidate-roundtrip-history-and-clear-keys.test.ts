import { describe, expect, test } from "bun:test";
import { createGameplayController } from "../../../src/app/gameplay";
import { getCellSpanFromFrame } from "../../../src/ui/shell";
import { captureControllerFrame } from "./support";

async function selectedCellToken(
  controller: ReturnType<typeof createGameplayController>,
): Promise<string> {
  const { frame } = await captureControllerFrame(controller);
  return (getCellSpanFromFrame(frame, 0, 2)?.text ?? "").trim();
}

function enterPlayOnPrimaryEditableCell(
  controller: ReturnType<typeof createGameplayController>,
): void {
  controller.press("enter");
  controller.press("right");
  controller.press("right");
  controller.press("v");
  controller.press("v");
}

function addNotes(
  controller: ReturnType<typeof createGameplayController>,
  ...notes: Array<"1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9">
): void {
  controller.press("n");
  for (const note of notes) controller.press(note);
}

describe("Manual candidate roundtrip history and clear-key consistency", () => {
  test("notes-mode add/remove edits only the selected cell and round-trips exact visible token through undo/redo", async () => {
    const controller = createGameplayController();
    enterPlayOnPrimaryEditableCell(controller);
    addNotes(controller, "1", "2", "4", "9");

    const selectedBeforeRemove = [...controller.state.board.getCell(0, 2).notes];
    const neighborBeforeRemove = [...controller.state.board.getCell(0, 3).notes];
    const tokenBeforeRemove = await selectedCellToken(controller);

    controller.press("2");
    expect(controller.state.board.getCell(0, 2).notes).toEqual([1, 4, 9]);
    expect(controller.state.board.getCell(0, 3).notes).toEqual(neighborBeforeRemove);
    const tokenAfterRemove = await selectedCellToken(controller);
    expect(tokenAfterRemove).not.toBe(tokenBeforeRemove);

    controller.press("u");
    expect(controller.state.board.getCell(0, 2).notes).toEqual(selectedBeforeRemove);
    expect(await selectedCellToken(controller)).toBe(tokenBeforeRemove);

    controller.press("r");
    expect(controller.state.board.getCell(0, 2).notes).toEqual([1, 4, 9]);
    expect(await selectedCellToken(controller)).toBe(tokenAfterRemove);
  });

  test("value placement and note-only clear wipe note state immediately and round-trip exactly through history", async () => {
    const controller = createGameplayController();
    enterPlayOnPrimaryEditableCell(controller);
    addNotes(controller, "1", "2");
    const noteToken = await selectedCellToken(controller);

    controller.press("n");
    controller.press("4");
    expect(controller.state.board.getCell(0, 2).value).toBe(4);
    expect(controller.state.board.getCell(0, 2).notes).toEqual([]);

    controller.press("u");
    expect(controller.state.board.getCell(0, 2).value).toBe(0);
    expect(controller.state.board.getCell(0, 2).notes).toEqual([1, 2]);
    expect(await selectedCellToken(controller)).toBe(noteToken);

    controller.press("r");
    expect(controller.state.board.getCell(0, 2).value).toBe(4);
    expect(controller.state.board.getCell(0, 2).notes).toEqual([]);

    controller.press("backspace");
    controller.press("n");
    controller.press("3");
    controller.press("7");
    const noteOnlyToken = await selectedCellToken(controller);
    expect(controller.state.board.getCell(0, 2).notes).toEqual([3, 7]);

    controller.press("backspace");
    expect(controller.state.board.getCell(0, 2).value).toBe(0);
    expect(controller.state.board.getCell(0, 2).notes).toEqual([]);

    controller.press("u");
    expect(controller.state.board.getCell(0, 2).notes).toEqual([3, 7]);
    expect(await selectedCellToken(controller)).toBe(noteOnlyToken);

    controller.press("r");
    expect(controller.state.board.getCell(0, 2).notes).toEqual([]);
  });

  test("Backspace/Delete/0/c share one note-only clear contract and history replay", async () => {
    const clearKeys = ["backspace", "delete", "0", "c"] as const;
    const statuses: string[] = [];

    for (const clearKey of clearKeys) {
      const controller = createGameplayController();
      enterPlayOnPrimaryEditableCell(controller);
      addNotes(controller, "2", "9");
      const preClearToken = await selectedCellToken(controller);
      expect(controller.state.board.getCell(0, 2).notes).toEqual([2, 9]);

      controller.press(clearKey);
      expect(controller.state.board.getCell(0, 2).value).toBe(0);
      expect(controller.state.board.getCell(0, 2).notes).toEqual([]);
      statuses.push(controller.state.status);

      controller.press("u");
      expect(controller.state.board.getCell(0, 2).notes).toEqual([2, 9]);
      expect(await selectedCellToken(controller)).toBe(preClearToken);

      controller.press("r");
      expect(controller.state.board.getCell(0, 2).notes).toEqual([]);
    }

    expect(statuses).toEqual(["Cleared r1c3.", "Cleared r1c3.", "Cleared r1c3.", "Cleared r1c3."]);
  });
});
