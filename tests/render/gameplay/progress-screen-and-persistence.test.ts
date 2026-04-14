import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseBoard } from "../../../src/domain/board";
import { createGameplayController } from "../../../src/app/gameplay";
import { captureControllerFrame } from "./support";

function openProgressScreen(controller: ReturnType<typeof createGameplayController>): void {
  for (let i = 0; i < 8; i += 1) controller.press("up");
  controller.press("down");
  controller.press("down");
  controller.press("down");
  controller.press("enter");
  expect(controller.state.screen).toBe("progress");
}

function createAlmostSolvedBoard() {
  return parseBoard(
    "034678912672195348198342567859761423426853791713924856961537284287419635345286179",
  );
}

describe("Progress screen and progression persistence", () => {
  test("shows explicit empty state copy and populated local progression after a solve", async () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "opensudoku-progress-screen-"));
    try {
      const empty = createGameplayController({ bestTimeDataRoot: dataRoot });
      openProgressScreen(empty);

      const emptyFrame = await captureControllerFrame(empty);
      expect(emptyFrame.text).toContain("Progress");
      expect(emptyFrame.text).toContain("No local progression yet.");
      expect(emptyFrame.text).toContain("General Solves: 0");
      expect(emptyFrame.text).toContain("Latest Daily Completion: None");
      expect(emptyFrame.text).not.toContain("[object Object]");
      expect(emptyFrame.text).not.toContain("undefined");

      let nowMs = 0;
      const populated = createGameplayController({
        board: createAlmostSolvedBoard(),
        bestTimeDataRoot: dataRoot,
        now: () => nowMs,
      });
      populated.press("enter");
      nowMs = 4_000;
      populated.press("5");
      populated.press("escape");
      openProgressScreen(populated);

      const populatedFrame = await captureControllerFrame(populated);
      expect(populatedFrame.text).toContain("General Solves: 1");
      expect(populatedFrame.text).toContain("Assisted Solves: 0");
      expect(populatedFrame.text).toContain("Best Normal: 00:04");

      const relaunched = createGameplayController({ bestTimeDataRoot: dataRoot, now: () => nowMs });
      openProgressScreen(relaunched);
      expect((await captureControllerFrame(relaunched)).text).toContain("General Solves: 1");
    } finally {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  test("repairs corrupt local stores on the next eligible write", () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "opensudoku-progress-repair-"));
    try {
      const appDir = join(dataRoot, "OpenSudoku");
      mkdirSync(appDir, { recursive: true });
      writeFileSync(join(appDir, "best-times.json"), "{broken", "utf8");
      writeFileSync(join(appDir, "daily-completions.json"), '{"v":0}', "utf8");
      writeFileSync(join(appDir, "progression.json"), '{"v":0,"bad":true}', "utf8");

      let nowMs = 0;
      const controller = createGameplayController({
        board: createAlmostSolvedBoard(),
        bestTimeDataRoot: dataRoot,
        now: () => nowMs,
      });
      controller.press("enter");
      controller.state.activeSessionType = "daily";
      controller.state.activeDailyDateKey = "2040-01-02";
      controller.state.activeSessionId = "daily:2040-01-02";
      nowMs = Date.parse("2040-01-02T00:00:07.000Z");
      controller.press("5");

      const bestTimes = JSON.parse(readFileSync(join(appDir, "best-times.json"), "utf8")) as {
        v: number;
      };
      const dailyCompletions = JSON.parse(
        readFileSync(join(appDir, "daily-completions.json"), "utf8"),
      ) as { v: number };
      const progression = JSON.parse(readFileSync(join(appDir, "progression.json"), "utf8")) as {
        v: number;
      };

      expect(bestTimes.v).toBe(2);
      expect(dailyCompletions.v).toBe(1);
      expect(progression.v).toBe(1);
    } finally {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });
});
