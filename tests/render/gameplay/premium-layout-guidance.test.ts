import { describe, expect, test } from "bun:test";
import { createGameplayController } from "../../../src/app/gameplay";
import { getCellSpanFromFrame } from "../../../src/ui/shell";
import type { CapturedFrame } from "@opentui/core";
import { captureControllerFrame } from "./support";

function findLineIndex(lines: string[], needle: string): number {
  const index = lines.findIndex((line) => line.includes(needle));
  if (index < 0) throw new Error(`Expected frame to contain line with: ${needle}`);
  return index;
}

function getVisibleBounds(line: string): { start: number; end: number } {
  const start = line.search(/\S/);
  if (start < 0) {
    throw new Error("Expected non-empty visible line.");
  }
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

function getCenteredBlockMidpointY(lines: string[], needles: string[]): number {
  const lineIndexes = needles.map((needle) => findLineIndex(lines, needle));
  const start = Math.min(...lineIndexes);
  const end = Math.max(...lineIndexes);
  return (start + end) / 2;
}

function expectSelectionGuidanceCues(frame: CapturedFrame, row: number, col: number): void {
  const selected = getCellSpanFromFrame(frame, row, col);
  const rowPeerCol = col === 8 ? 7 : col + 1;
  const colPeerRow = row === 8 ? 7 : row + 1;
  const rowPeer = getCellSpanFromFrame(frame, row, rowPeerCol);
  const colPeer = getCellSpanFromFrame(frame, colPeerRow, col);
  const outsideCell = getCellSpanFromFrame(frame, colPeerRow, rowPeerCol);

  expect(selected?.bg).toBeDefined();
  expect(rowPeer?.bg).toBeDefined();
  expect(colPeer?.bg).toBeDefined();
  expect(rowPeer?.bg).not.toEqual(selected?.bg);
  expect(colPeer?.bg).not.toEqual(selected?.bg);
  expect(rowPeer?.bg).not.toEqual(outsideCell?.bg);
  expect(colPeer?.bg).not.toEqual(outsideCell?.bg);
}

describe("Gameplay premium layout and guidance cues", () => {
  test("root/play/generator/solver/help screens keep centered primary content framing in both axes", async () => {
    const viewportMidpoint = 49.5;
    const viewportVerticalMidpoint = 14.5;

    const rootController = createGameplayController();
    const rootCapture = await captureControllerFrame(rootController);
    const rootLines = rootCapture.text.split("\n");
    const rootMidpoint = getCenteredBlockMidpoint(rootLines, [
      "OpenSudoku",
      "Arrows/WASD move",
      "  Quit",
    ]);
    const rootMidpointY = getCenteredBlockMidpointY(rootLines, ["OpenSudoku", "Arrows/WASD move"]);
    expect(Math.abs(rootMidpoint - viewportMidpoint)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(rootMidpointY - viewportVerticalMidpoint)).toBeLessThanOrEqual(1.5);

    const playController = createGameplayController();
    playController.press("enter");
    const playCapture = await captureControllerFrame(playController);
    const playLines = playCapture.text.split("\n");
    const playMidpoint = getCenteredBlockMidpoint(playLines, [
      "OpenSudoku Play",
      "Move: WASD/arrows, 1-9, Backspace/Delete clear",
      "Status:",
    ]);
    const playMidpointY = getCenteredBlockMidpointY(playLines, ["OpenSudoku Play", "Active:"]);
    expect(Math.abs(playMidpoint - viewportMidpoint)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(playMidpointY - viewportVerticalMidpoint)).toBeLessThanOrEqual(1.5);

    const generatorController = createGameplayController();
    generatorController.press("g");
    const generatorCapture = await captureControllerFrame(generatorController);
    const generatorLines = generatorCapture.text.split("\n");
    const generatorMidpoint = getCenteredBlockMidpoint(generatorLines, [
      "Generator",
      "1 Easy | 2 Medium | 3 Hard",
      "Enter/Esc return",
    ]);
    const generatorMidpointY = getCenteredBlockMidpointY(generatorLines, [
      "Generator",
      "Enter/Esc return",
    ]);
    expect(Math.abs(generatorMidpoint - viewportMidpoint)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(generatorMidpointY - viewportVerticalMidpoint)).toBeLessThanOrEqual(1.5);

    const solverController = createGameplayController();
    solverController.press("down");
    solverController.press("down");
    solverController.press("down");
    solverController.press("down");
    solverController.press("enter");
    const solverCapture = await captureControllerFrame(solverController);
    const solverLines = solverCapture.text.split("\n");
    const solverMidpoint = getCenteredBlockMidpoint(solverLines, [
      "Solver Checks",
      "1 Known solvable | 2 Known invalid | 3 Known unsolvable | c Current board",
      "Enter/Esc return",
    ]);
    const solverMidpointY = getCenteredBlockMidpointY(solverLines, [
      "Solver Checks",
      "Enter/Esc return",
    ]);
    expect(Math.abs(solverMidpoint - viewportMidpoint)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(solverMidpointY - viewportVerticalMidpoint)).toBeLessThanOrEqual(1.5);

    const helpController = createGameplayController();
    helpController.press("h");
    const helpCapture = await captureControllerFrame(helpController);
    const helpLines = helpCapture.text.split("\n");
    const helpMidpoint = getCenteredBlockMidpoint(helpLines, [
      "Help",
      "Play: 1-9 set, 0/. clear, n notes, v candidate view, h hint, u undo, r redo, t challenge timer.",
      "Enter/Esc return",
    ]);
    const helpMidpointY = getCenteredBlockMidpointY(helpLines, ["Help", "Enter/Esc return"]);
    expect(Math.abs(helpMidpoint - viewportMidpoint)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(helpMidpointY - viewportVerticalMidpoint)).toBeLessThanOrEqual(1.5);
  });

  test("play screen shows row/column guidance and active-number invalid-position cues without obscuring selection", async () => {
    const controller = createGameplayController();
    controller.press("enter");
    controller.press("right");
    controller.press("right");
    controller.press("4");

    const { frame, text } = await captureControllerFrame(controller);
    expect(text).toContain("Active: 4");

    const selected = getCellSpanFromFrame(frame, 0, 2);
    const rowPeer = getCellSpanFromFrame(frame, 0, 3);
    const colPeer = getCellSpanFromFrame(frame, 1, 2);
    const outsideCell = getCellSpanFromFrame(frame, 1, 3);
    expect(selected?.bg).toBeDefined();
    expect(rowPeer?.bg).toBeDefined();
    expect(colPeer?.bg).toBeDefined();
    expect(rowPeer?.bg).not.toEqual(selected?.bg);
    expect(colPeer?.bg).not.toEqual(selected?.bg);
    expect(rowPeer?.bg).not.toEqual(outsideCell?.bg);
    expect(colPeer?.bg).not.toEqual(outsideCell?.bg);
    expect(rowPeer?.fg).not.toEqual(outsideCell?.fg);
  });

  test("active number and board guidance stay truthful through note edits, value entry, clear/history replay, and filled-to-empty selection return", async () => {
    const controller = createGameplayController();
    controller.press("enter");
    controller.press("right");
    controller.press("right");
    controller.press("5");
    let capture = await captureControllerFrame(controller);
    expect(capture.text).toContain("Active: -");
    expect(controller.state.board.getCell(0, 2).value).toBe(0);
    expect(controller.state.status.toLowerCase()).toContain("conflict");
    expectSelectionGuidanceCues(capture.frame, 0, 2);

    controller.press("n");
    controller.press("2");
    capture = await captureControllerFrame(controller);
    expect(capture.text).toContain("Active: 2");
    expectSelectionGuidanceCues(capture.frame, 0, 2);

    controller.press("n");
    controller.press("4");
    capture = await captureControllerFrame(controller);
    expect(capture.text).toContain("Active: 4");
    expect(controller.state.board.getCell(0, 2).value).toBe(4);
    expectSelectionGuidanceCues(capture.frame, 0, 2);

    controller.press("backspace");
    capture = await captureControllerFrame(controller);
    expect(capture.text).toContain("Active: 4");
    expect(controller.state.board.getCell(0, 2).value).toBe(0);
    expectSelectionGuidanceCues(capture.frame, 0, 2);

    controller.press("u");
    capture = await captureControllerFrame(controller);
    expect(capture.text).toContain("Active: 4");
    expect(controller.state.board.getCell(0, 2).value).toBe(4);
    expectSelectionGuidanceCues(capture.frame, 0, 2);

    controller.press("u");
    capture = await captureControllerFrame(controller);
    expect(capture.text).toContain("Active: 4");
    expect(controller.state.board.getCell(0, 2).value).toBe(0);
    expectSelectionGuidanceCues(capture.frame, 0, 2);

    controller.press("r");
    capture = await captureControllerFrame(controller);
    expect(capture.text).toContain("Active: 4");
    expect(controller.state.board.getCell(0, 2).value).toBe(4);
    expectSelectionGuidanceCues(capture.frame, 0, 2);

    controller.press("left");
    capture = await captureControllerFrame(controller);
    expect(capture.text).toContain("Active: 3");
    expectSelectionGuidanceCues(capture.frame, 0, 1);

    controller.press("down");
    capture = await captureControllerFrame(controller);
    expect(controller.state.board.getCell(1, 1).value).toBe(0);
    expect(capture.text).toContain("Active: 3");
    expectSelectionGuidanceCues(capture.frame, 1, 1);
  });
});
