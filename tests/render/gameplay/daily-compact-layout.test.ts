import { describe, expect, test } from "bun:test";
import { createGameplayController } from "../../../src/app/gameplay";
import { captureControllerFrame } from "./support";

function openDailyScreen(controller: ReturnType<typeof createGameplayController>): void {
  controller.press("down");
  controller.press("enter");
  expect(controller.state.screen).toBe("daily");
}

function lineIndex(lines: string[], needle: string): number {
  return lines.findIndex((line) => line.includes(needle));
}

describe("Daily compact browse layout", () => {
  test("keeps Daily title and condenses selected date + browse mode into one metadata row above calendar", async () => {
    const controller = createGameplayController({ now: () => Date.UTC(2026, 3, 15, 12, 0, 0) });
    openDailyScreen(controller);

    const { text } = await captureControllerFrame(controller);
    const lines = text.split("\n");
    const titleLine = lineIndex(lines, "Daily");
    const metadataLine = lineIndex(lines, "Selected:");
    const monthLine = lineIndex(lines, "April 2026");

    expect(titleLine).toBeGreaterThanOrEqual(0);
    expect(metadataLine).toBeGreaterThan(titleLine);
    expect(lines[metadataLine]).toContain("Browse:");
    expect(lines[metadataLine]).not.toContain("Status:");
    expect(monthLine).toBeGreaterThan(metadataLine);
    expect(text).not.toContain("Browse mode:");
  });

  test("renders browse controls in one compact footer line below content in month and year modes", async () => {
    const controller = createGameplayController({ now: () => Date.UTC(2026, 3, 15, 12, 0, 0) });
    openDailyScreen(controller);

    const monthCapture = await captureControllerFrame(controller);
    const monthLines = monthCapture.text.split("\n");
    const monthLabelLine = lineIndex(monthLines, "April 2026");
    const monthFooterLine = lineIndex(monthLines, "Enter open");

    expect(monthLabelLine).toBeGreaterThanOrEqual(0);
    expect(monthFooterLine).toBeGreaterThan(monthLabelLine);
    expect(monthLines[monthFooterLine]).toContain("Browse:");
    expect(monthCapture.text).not.toContain("Up/Down: ±day | Left/Right: ±month or ±year");
    expect(monthCapture.text).not.toContain(
      "m month | y year | t today | Enter open | Esc return | q quit",
    );
    expect(monthLines.filter((line) => line.includes("Enter open")).length).toBe(1);

    controller.press("y");
    const yearCapture = await captureControllerFrame(controller);
    const yearLines = yearCapture.text.split("\n");
    const yearMetadataLine = lineIndex(yearLines, "Selected:");
    const yearFooterLine = lineIndex(yearLines, "Enter open");

    expect(yearCapture.text).toContain("Browse: year");
    expect(yearMetadataLine).toBeGreaterThanOrEqual(0);
    expect(yearFooterLine).toBeGreaterThan(yearMetadataLine);
    expect(yearLines[yearFooterLine]).toContain("Browse:");
    expect(yearLines.filter((line) => line.includes("Enter open")).length).toBe(1);
  });

  test("hides routine status row and shows it only when status adds materially informative state", async () => {
    const controller = createGameplayController({ now: () => Date.UTC(2026, 3, 15, 12, 0, 0) });
    openDailyScreen(controller);

    const routine = await captureControllerFrame(controller);
    expect(routine.text).not.toContain("Status:");

    controller.state.status = "Daily store unavailable; browse state may be stale.";
    const informative = await captureControllerFrame(controller);
    expect(informative.text).toContain(
      "Status: Daily store unavailable; browse state may be stale.",
    );
  });
});
