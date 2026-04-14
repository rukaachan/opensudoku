import { describe, expect, test } from "bun:test";
import { createGameplayController } from "../../../src/app/gameplay";
import { getCellSpanFromFrame } from "../../../src/ui/shell";
import { captureControllerFrame } from "./support";

function visibleNotes(notes: number[]): string {
  return notes.slice(0, 3).join("");
}

describe("Gameplay premium followup notes/status polish", () => {
  test("cells with 4+ notes render readable leading notes instead of encoded tokens", async () => {
    const controller = createGameplayController();
    controller.press("enter");
    controller.press("right");
    controller.press("right");
    controller.press("n");
    controller.press("1");
    controller.press("2");
    controller.press("4");
    controller.press("5");
    controller.press("7");
    controller.press("8");
    controller.press("9");
    expect(controller.state.board.getCell(0, 2).notes).toEqual([1, 2, 4, 5, 7, 8, 9]);

    const first = await captureControllerFrame(controller);
    const firstText = (getCellSpanFromFrame(first.frame, 0, 2)?.text ?? "").trim();
    expect(firstText).toBe(visibleNotes([1, 2, 4, 5, 7, 8, 9]));
    expect(firstText).toBe("124");

    controller.press("2");
    controller.press("3");
    expect(controller.state.board.getCell(0, 2).notes).toEqual([1, 3, 4, 5, 7, 8, 9]);

    const second = await captureControllerFrame(controller);
    const secondText = (getCellSpanFromFrame(second.frame, 0, 2)?.text ?? "").trim();
    expect(secondText).toBe(visibleNotes([1, 3, 4, 5, 7, 8, 9]));
    expect(secondText).not.toBe(firstText);
  });

  test("restart-required lockout status renders without raw object placeholder leakage", async () => {
    const controller = createGameplayController();
    controller.press("enter");
    controller.press("right");
    controller.press("right");
    controller.press("left");
    controller.press("left");
    controller.press("1");
    controller.press("backspace");
    controller.press("right");
    controller.press("right");
    controller.press("5");

    const { text } = await captureControllerFrame(controller);
    expect(text.toLowerCase()).toContain("restart");
    expect(text).not.toContain("[object Object]");
  });
});
