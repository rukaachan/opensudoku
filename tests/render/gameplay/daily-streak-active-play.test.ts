import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseBoard } from "../../../src/domain/board";
import type { DailyDateKey } from "../../../src/app/puzzle-tools";
import { createGameplayController } from "../../../src/app/gameplay";
import { captureControllerFrame } from "./support";

class FakeClock {
  private valueMs = 0;
  now = (): number => this.valueMs;
  advance(ms: number): void {
    this.valueMs += ms;
  }
}

const atUtcNoon = (dateKey: DailyDateKey): number => Date.parse(`${dateKey}T12:00:00.000Z`);

const toPlaceholderDateKey = (year: number, month: number, day: number): DailyDateKey =>
  `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}` as DailyDateKey;

const DAY_1 = toPlaceholderDateKey(2040, 1, 11);
const DAY_2 = toPlaceholderDateKey(2040, 1, 12);
const DAY_3 = toPlaceholderDateKey(2040, 1, 13);
const DAY_4 = toPlaceholderDateKey(2040, 1, 14);
const DAY_5 = toPlaceholderDateKey(2040, 1, 15);
const FUTURE_DAY = toPlaceholderDateKey(2140, 1, 13);

function createAlmostSolvedBoard() {
  return parseBoard(
    "034678912672195348198342567859761423426853791713924856961537284287419635345286179",
  );
}

function completeDaily(dataRoot: string, dateKey: DailyDateKey, nowMs: number): void {
  const clock = new FakeClock();
  clock.advance(nowMs);
  const run = createGameplayController({
    board: createAlmostSolvedBoard(),
    now: clock.now,
    bestTimeDataRoot: dataRoot,
  });
  run.press("enter");
  run.state.activeSessionType = "daily";
  run.state.activeDailyDateKey = dateKey;
  run.press("5");
  expect(run.state.solved).toBe(true);
}

describe("Daily streak active-play followup", () => {
  test("active Daily play shows streak text only once threshold reaches 3 and keeps non-Daily play unchanged", async () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "opensudoku-daily-streak-threshold-"));
    try {
      completeDaily(dataRoot, DAY_1, atUtcNoon(DAY_1));
      completeDaily(dataRoot, DAY_2, atUtcNoon(DAY_2));

      const belowClock = new FakeClock();
      belowClock.advance(atUtcNoon(DAY_2));
      const below = createGameplayController({
        board: createAlmostSolvedBoard(),
        now: belowClock.now,
        bestTimeDataRoot: dataRoot,
      });
      below.press("enter");
      below.state.activeSessionType = "daily";
      below.state.activeDailyDateKey = DAY_2;
      const belowFrame = await captureControllerFrame(below);
      expect(belowFrame.text).toContain("Daily Challenger");
      expect(belowFrame.text).not.toContain("Streak");

      completeDaily(dataRoot, DAY_3, atUtcNoon(DAY_3));
      const thresholdClock = new FakeClock();
      thresholdClock.advance(atUtcNoon(DAY_3));
      const threshold = createGameplayController({
        board: createAlmostSolvedBoard(),
        now: thresholdClock.now,
        bestTimeDataRoot: dataRoot,
      });
      threshold.press("enter");
      threshold.state.activeSessionType = "daily";
      threshold.state.activeDailyDateKey = DAY_3;
      const thresholdFrame = await captureControllerFrame(threshold);
      expect(thresholdFrame.text).toContain("Daily Challenger");
      expect(thresholdFrame.text).toContain("Streak 3");

      const normal = createGameplayController({
        board: createAlmostSolvedBoard(),
        now: thresholdClock.now,
        bestTimeDataRoot: dataRoot,
      });
      normal.press("enter");
      const normalFrame = await captureControllerFrame(normal);
      expect(normalFrame.text).not.toContain("Daily Challenger");
      expect(normalFrame.text).not.toContain("Streak");
    } finally {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  test("streak persists across relaunch, continues with next eligible day, and uses explicit daily completion store", async () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "opensudoku-daily-streak-persist-"));
    try {
      completeDaily(dataRoot, DAY_1, atUtcNoon(DAY_1));
      completeDaily(dataRoot, DAY_2, atUtcNoon(DAY_2));
      completeDaily(dataRoot, DAY_3, atUtcNoon(DAY_3));

      const reloadedClock = new FakeClock();
      reloadedClock.advance(atUtcNoon(DAY_3));
      const reloaded = createGameplayController({
        board: createAlmostSolvedBoard(),
        now: reloadedClock.now,
        bestTimeDataRoot: dataRoot,
      });
      reloaded.press("enter");
      reloaded.state.activeSessionType = "daily";
      reloaded.state.activeDailyDateKey = DAY_3;
      expect(reloaded.getViewModel().dailyStreakCount).toBe(3);

      completeDaily(dataRoot, DAY_4, atUtcNoon(DAY_4));
      const extendedClock = new FakeClock();
      extendedClock.advance(atUtcNoon(DAY_4));
      const extended = createGameplayController({
        board: createAlmostSolvedBoard(),
        now: extendedClock.now,
        bestTimeDataRoot: dataRoot,
      });
      extended.press("enter");
      extended.state.activeSessionType = "daily";
      extended.state.activeDailyDateKey = DAY_4;
      const frame = await captureControllerFrame(extended);
      expect(extended.getViewModel().dailyStreakCount).toBe(4);
      expect(frame.text).toContain("Streak 4");

      expect(existsSync(join(dataRoot, "OpenSudoku", "daily-completions.json"))).toBe(true);
    } finally {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  test("future-dated Daily completions do not add streak credit", () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "opensudoku-daily-streak-future-"));
    try {
      completeDaily(dataRoot, DAY_1, atUtcNoon(DAY_1));
      completeDaily(dataRoot, DAY_2, atUtcNoon(DAY_2));
      completeDaily(dataRoot, FUTURE_DAY, atUtcNoon(DAY_3));

      const clock = new FakeClock();
      clock.advance(atUtcNoon(DAY_3));
      const controller = createGameplayController({
        board: createAlmostSolvedBoard(),
        now: clock.now,
        bestTimeDataRoot: dataRoot,
      });
      controller.press("enter");
      controller.state.activeSessionType = "daily";
      controller.state.activeDailyDateKey = DAY_3;
      expect(controller.getViewModel().dailyStreakCount).toBe(2);
    } finally {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  test("missing an eligible UTC date resets streak until rebuilt", () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "opensudoku-daily-streak-reset-"));
    try {
      completeDaily(dataRoot, DAY_1, atUtcNoon(DAY_1));
      completeDaily(dataRoot, DAY_3, atUtcNoon(DAY_3));

      const resetClock = new FakeClock();
      resetClock.advance(atUtcNoon(DAY_3));
      const reset = createGameplayController({
        board: createAlmostSolvedBoard(),
        now: resetClock.now,
        bestTimeDataRoot: dataRoot,
      });
      reset.press("enter");
      reset.state.activeSessionType = "daily";
      reset.state.activeDailyDateKey = DAY_3;
      expect(reset.getViewModel().dailyStreakCount).toBe(1);

      completeDaily(dataRoot, DAY_4, atUtcNoon(DAY_4));
      completeDaily(dataRoot, DAY_5, atUtcNoon(DAY_5));
      const rebuiltClock = new FakeClock();
      rebuiltClock.advance(atUtcNoon(DAY_5));
      const rebuilt = createGameplayController({
        board: createAlmostSolvedBoard(),
        now: rebuiltClock.now,
        bestTimeDataRoot: dataRoot,
      });
      rebuilt.press("enter");
      rebuilt.state.activeSessionType = "daily";
      rebuilt.state.activeDailyDateKey = DAY_5;
      expect(rebuilt.getViewModel().dailyStreakCount).toBe(3);
    } finally {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });
});
