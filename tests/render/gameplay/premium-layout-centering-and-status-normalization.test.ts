import { describe, expect, test } from "bun:test";
import { createGameplayController } from "../../../src/app/gameplay";
import { captureControllerFrame } from "./support";

function findLineIndex(lines: string[], needle: string): number {
  const index = lines.findIndex((line) => line.includes(needle));
  if (index < 0) throw new Error(`Expected frame to contain line with: ${needle}`);
  return index;
}

function getVisibleBounds(line: string): { start: number; end: number } {
  const start = line.search(/\S/);
  if (start < 0) throw new Error("Expected non-empty visible line.");
  const end = line.replace(/\s+$/, "").length - 1;
  return { start, end };
}

function getCenteredBlockMidpoint(lines: string[], needles: string[]): number {
  const selectedBounds = needles.map((needle) =>
    getVisibleBounds(lines[findLineIndex(lines, needle)]),
  );
  const start = Math.min(...selectedBounds.map((bounds) => bounds.start));
  const end = Math.max(...selectedBounds.map((bounds) => bounds.end));
  return (start + end) / 2;
}

describe("Gameplay premium centering and status normalization", () => {
  test("play board and hud stay centered as a visible unit even when status copy is long", async () => {
    const controller = createGameplayController();
    controller.press("enter");
    controller.state.status =
      "Status detail: this is intentionally long premium-play feedback copy to verify the board surface does not drift left.";

    const capture = await captureControllerFrame(controller);
    const lines = capture.text.split("\n");
    const boardLine = lines.find((line) => line.includes("│"));
    if (!boardLine) throw new Error("Expected a visible board line.");

    const boardBounds = getVisibleBounds(boardLine);
    const boardMidpoint = (boardBounds.start + boardBounds.end) / 2;
    const statusMidpoint = getCenteredBlockMidpoint(lines, [
      "Status detail: this is intentionally long premium-play",
    ]);
    expect(Math.abs(boardMidpoint - 49.5)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(statusMidpoint - boardMidpoint)).toBeLessThanOrEqual(1.5);
  });

  test("exercised screens never render raw object-coercion placeholders", async () => {
    const rootController = createGameplayController();
    rootController.state.status = { kind: "root-object" } as unknown as string;
    const rootCapture = await captureControllerFrame(rootController);
    expect(rootCapture.text).not.toContain("[object Object]");

    const playController = createGameplayController();
    playController.press("enter");
    playController.state.status = { kind: "play-object" } as unknown as string;
    const playCapture = await captureControllerFrame(playController);
    expect(playCapture.text).not.toContain("[object Object]");

    const generatorController = createGameplayController();
    generatorController.press("down");
    generatorController.press("down");
    generatorController.press("enter");
    generatorController.state.status = { kind: "generator-object" } as unknown as string;
    const generatorCapture = await captureControllerFrame(generatorController);
    expect(generatorCapture.text).not.toContain("[object Object]");

    const solverController = createGameplayController();
    solverController.press("down");
    solverController.press("down");
    solverController.press("down");
    solverController.press("enter");
    solverController.state.status = { kind: "solver-object" } as unknown as string;
    const solverCapture = await captureControllerFrame(solverController);
    expect(solverCapture.text).not.toContain("[object Object]");

    const helpController = createGameplayController();
    helpController.press("h");
    const helpCapture = await captureControllerFrame(helpController);
    expect(helpCapture.text).not.toContain("[object Object]");
  });
});
