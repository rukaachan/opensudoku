import { describe, expect, test } from "bun:test";
import { createGameplayController } from "../../../src/app/gameplay";
import { captureControllerFrame } from "./support";

function lineIndex(lines: string[], needle: string): number {
  return lines.findIndex((line) => line.includes(needle));
}

function firstVisibleLineIndex(lines: string[]): number {
  return lines.findIndex((line) => line.trim().length > 0);
}

describe("Non-Daily compact menus", () => {
  test("root menu keeps title first with options as the dominant block and one compact footer help line", async () => {
    const controller = createGameplayController();
    const { text } = await captureControllerFrame(controller);
    const lines = text.split("\n");
    const titleLine = lineIndex(lines, "OpenSudoku");
    const playLine = lineIndex(lines, "> Play");
    const quitLine = lineIndex(lines, "  Quit");
    const footerLine = lineIndex(lines, "Arrows/WASD move");

    expect(firstVisibleLineIndex(lines)).toBe(titleLine);
    expect(titleLine).toBeGreaterThanOrEqual(0);
    expect(playLine).toBeGreaterThan(titleLine);
    expect(quitLine).toBeGreaterThan(playLine);
    expect(footerLine).toBeGreaterThan(quitLine);
    expect(text).not.toContain("Keyboard only: arrows/WASD + Enter");
    expect(text).not.toContain("Status: Use arrows/WASD + Enter to choose.");
    expect(lines.filter((line) => line.includes("Arrows/WASD move")).length).toBe(1);
  });

  test("generator and solver menus hide routine status rows, use compact options, and keep one footer help line", async () => {
    const generator = createGameplayController();
    generator.press("g");
    expect(generator.state.screen).toBe("generator");

    const generatorCapture = await captureControllerFrame(generator);
    expect(generatorCapture.text).toContain("Generator");
    expect(generatorCapture.text).toContain("1 Easy | 2 Medium | 3 Hard | 4 Extreme Hard");
    expect(generatorCapture.text).toContain("Enter/Esc return • q quit");
    expect(generatorCapture.text).not.toContain("Status: Generator screen.");
    expect(generatorCapture.text).not.toContain("Unsupported(example)");

    generator.state.status = "Generator store unavailable.";
    const generatorInformative = await captureControllerFrame(generator);
    expect(generatorInformative.text).toContain("Status: Generator store unavailable.");

    const solver = createGameplayController();
    solver.press("down");
    solver.press("down");
    solver.press("down");
    solver.press("down");
    solver.press("enter");
    expect(solver.state.screen).toBe("solver");

    const solverCapture = await captureControllerFrame(solver);
    expect(solverCapture.text).toContain("Solver Checks");
    expect(solverCapture.text).toContain(
      "1 Known solvable | 2 Known invalid | 3 Known unsolvable | c Current board",
    );
    expect(solverCapture.text).toContain("Enter/Esc return • q quit");
    expect(solverCapture.text).not.toContain("Status: Solver screen.");
  });

  test("help menu keeps compact guidance with one footer help line", async () => {
    const controller = createGameplayController();
    controller.press("h");
    expect(controller.state.screen).toBe("help");

    const { text } = await captureControllerFrame(controller);
    expect(text).toContain("Help");
    expect(text).toContain("Root: arrows/WASD move focus, Enter select.");
    expect(text).toContain(
      "Play: 1-9 set, 0/. clear, n notes, v candidate view, h hint, u undo, r redo, t challenge timer.",
    );
    expect(text).toContain("Candidate view cycles MIN/CNT/FULL (display only).");
    expect(text).toContain("Enter/Esc return • q quit");
    expect(text).not.toContain("Use keyboard only. Root: arrows/WASD + Enter.");
    expect(text).not.toContain("Press Esc or Enter to return, q to quit.");
  });
});
