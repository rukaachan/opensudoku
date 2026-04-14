import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createGameplayController } from "../../../src/app/gameplay";
import {
  recordDailyCompletion,
  resolveDailyCompletionStorePath,
} from "../../../src/app/daily/daily-completion-store";
import { captureControllerFrame } from "./support";

function openDailyScreen(controller: ReturnType<typeof createGameplayController>): void {
  controller.press("down");
  controller.press("enter");
  expect(controller.state.screen).toBe("daily");
}

function lineIndex(lines: string[], needle: string): number {
  return lines.findIndex((line) => line.includes(needle));
}

describe("Daily play + calendar polish", () => {
  test("active Daily play keeps board as the visual anchor with clearly separated puzzle context + status copy", async () => {
    const controller = createGameplayController();
    openDailyScreen(controller);
    controller.press("enter");

    const { text } = await captureControllerFrame(controller);
    const lines = text.split("\n");
    const boardLine = lineIndex(lines, "│");
    const bannerLine = lineIndex(lines, "Daily Challenger");
    const dailyLine = lineIndex(lines, "Daily:");
    const difficultyLine = lineIndex(lines, "Difficulty:");
    const statusLine = lineIndex(lines, "Status:");

    expect(boardLine).toBeGreaterThanOrEqual(0);
    expect(difficultyLine).toBeGreaterThan(boardLine);
    expect(bannerLine).toBeGreaterThan(boardLine);
    expect(dailyLine).toBeGreaterThan(bannerLine);
    expect(statusLine).toBeGreaterThan(dailyLine);
  });

  test("active Daily play never renders raw object coercions in visible puzzle/status copy", async () => {
    const controller = createGameplayController();
    openDailyScreen(controller);
    controller.press("enter");

    controller.state.status = { type: "play-status-object" } as unknown as string;
    controller.state.activeDifficulty = { tier: "play-difficulty-object" } as never;
    controller.state.activeDailyDateKey = { date: "play-date-object" } as never;

    const { text } = await captureControllerFrame(controller);
    expect(text).not.toContain("[object Object]");
    expect(text).toContain("Status: Unavailable");
    expect(text).toContain("Difficulty: Unavailable");
    expect(text).toContain("Daily: Unavailable");
  });

  test("Daily calendar keeps metadata and month grid cohesive and easy to scan", async () => {
    const root = mkdtempSync(join(tmpdir(), "opensudoku-daily-polish-"));
    try {
      const now = Date.UTC(2026, 3, 15, 12, 0, 0);
      const storePath = resolveDailyCompletionStorePath(root);
      recordDailyCompletion(storePath, "2026-04-03", now - 1_000);

      const controller = createGameplayController({ bestTimeDataRoot: root, now: () => now });
      openDailyScreen(controller);

      const { text } = await captureControllerFrame(controller);
      const lines = text.split("\n");
      const selectedLine = lineIndex(lines, "Selected:");
      const statusLine = lineIndex(lines, "Status:");
      const monthLine = lineIndex(lines, "April 2026");
      const weekdaysLine = lineIndex(lines, "Su  Mo  Tu  We  Th  Fr  Sa");
      const gridLine = lineIndex(lines, " 3*");

      expect(selectedLine).toBeGreaterThanOrEqual(0);
      expect(lines[selectedLine]).toContain("Browse: month");
      expect(statusLine).toBe(-1);
      expect(monthLine).toBeGreaterThan(selectedLine);
      expect(weekdaysLine).toBe(monthLine + 1);
      expect(gridLine).toBeGreaterThan(weekdaysLine);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("Daily calendar never renders raw object coercions in visible metadata and status copy", async () => {
    const controller = createGameplayController();
    openDailyScreen(controller);

    controller.state.dailySelectedDateKey = { key: "daily-selected-object" } as never;
    controller.state.dailyBrowseMode = { mode: "daily-browse-object" } as never;
    controller.state.status = { type: "daily-status-object" } as unknown as string;

    const { text } = await captureControllerFrame(controller);
    expect(text).not.toContain("[object Object]");
    expect(text).toContain("Selected: Unavailable | Browse: Unavailable");
    expect(text).not.toContain("Browse mode:");
    expect(text).not.toContain("Status: [object Object]");
  });
});
