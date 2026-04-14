import { describe, expect, test } from "bun:test";
import { boardToString } from "../../../src/domain/board";
import { createGameplayController } from "../../../src/app/gameplay";
import { getCellSpanFromFrame } from "../../../src/ui/shell";
import { captureControllerFrame } from "./support";

function getVisibleBounds(line: string): { start: number; end: number } {
  const start = line.search(/\S/);
  if (start < 0) throw new Error("Expected non-empty visible line.");
  const end = line.replace(/\s+$/, "").length - 1;
  return { start, end };
}

describe("Gameplay play render readability and clear controls", () => {
  test("play board rendering shows separator, label, and cell-style readability distinctions", async () => {
    const controller = createGameplayController();
    controller.press("enter");
    controller.press("right");
    controller.press("right");
    const { frame, text } = await captureControllerFrame(controller);

    expect(text).toContain(" 5  3  .  │  .  7  .  │  .  .  .");
    expect(text).toMatch(/─+┼─+┼─+/);
    expect(text).toContain("Mode:");
    expect(text).toContain("Difficulty:");
    expect(text).toContain("Selection:");
    expect(text).toContain("Status:");

    const boardRowText = " 5  3  .  │  .  7  .  │  .  .  .";
    const lines = text.split("\n");
    const boardLine = lines.find((line) => line.includes(boardRowText));
    const separatorLine = lines.find((line) => line.includes("┼"));
    if (!boardLine || !separatorLine)
      throw new Error("Expected board and separator lines in rendered output.");
    const boardStart = boardLine.indexOf(boardRowText);
    const separatorBounds = getVisibleBounds(separatorLine);
    expect(boardStart).toBeGreaterThanOrEqual(0);
    expect(separatorBounds.start).toBe(boardStart);
    expect(separatorBounds.end - separatorBounds.start + 1).toBe(boardRowText.length + 1);

    const selectedEditable = getCellSpanFromFrame(frame, 0, 2);
    const unselectedGiven = getCellSpanFromFrame(frame, 0, 0);
    const unselectedEditable = getCellSpanFromFrame(frame, 0, 3);
    expect(selectedEditable?.bg).toBeDefined();
    expect(selectedEditable?.fg).not.toEqual(unselectedGiven?.fg);
    expect(selectedEditable?.fg).not.toEqual(unselectedEditable?.fg);
    expect(unselectedGiven?.fg).not.toEqual(unselectedEditable?.fg);

    const topBoardLine = frame.lines.find((line) =>
      line.spans.some((span) => span.text.includes("│")),
    );
    const separatorSpan = topBoardLine?.spans.find((span) => span.text.includes("│"));
    expect(separatorSpan?.fg).toBeDefined();
    expect(separatorSpan?.fg).not.toEqual(unselectedEditable?.fg);
  });

  test("clear controls are discoverable and no-op clear does not mutate history", async () => {
    const controller = createGameplayController();
    controller.press("enter");

    const { text } = await captureControllerFrame(controller);
    expect(text).toMatch(/backspace|delete|clear/i);

    controller.press("right");
    controller.press("right");
    const before = boardToString(controller.state.board);
    const undoBefore = controller.state.history.undoCount;
    controller.press("backspace");

    expect(boardToString(controller.state.board)).toBe(before);
    expect(controller.state.history.undoCount).toBe(undoBefore);
  });
});
