import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseBoard } from "../../../src/domain/board";
import { createGameplayController } from "../../../src/app/gameplay";
import { Difficulty } from "../../../src/app/puzzle-tools";

class FakeClock {
  private valueMs = 0;

  now = (): number => this.valueMs;

  advance(ms: number): void {
    this.valueMs += ms;
  }
}

function createAlmostSolvedBoard() {
  return parseBoard(
    "034678912672195348198342567859761423426853791713924856961537284287419635345286179",
  );
}

describe("Gameplay best-time scope persistence", () => {
  test("best times remain scoped separately for normal, generated, and each Daily date", () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "opensudoku-best-scope-"));
    try {
      const normalClock = new FakeClock();
      const normalRun = createGameplayController({
        board: createAlmostSolvedBoard(),
        now: normalClock.now,
        bestTimeDataRoot: dataRoot,
      });
      normalRun.press("enter");
      normalClock.advance(8_000);
      normalRun.press("5");
      expect(normalRun.getViewModel().bestTimeText).toBe("00:08");

      const generatedClock = new FakeClock();
      const generatedRun = createGameplayController({
        board: createAlmostSolvedBoard(),
        now: generatedClock.now,
        bestTimeDataRoot: dataRoot,
      });
      generatedClock.advance(1_000);
      generatedRun.press("enter");
      generatedRun.state.activeSessionType = "generated";
      generatedRun.state.activeDifficulty = Difficulty.Easy;
      generatedRun.state.activeSessionId = "generated:easy";
      generatedClock.advance(6_000);
      generatedRun.press("5");
      expect(generatedRun.getViewModel().bestTimeText).toBe("00:06");

      const dailyOneClock = new FakeClock();
      const dailyOneRun = createGameplayController({
        board: createAlmostSolvedBoard(),
        now: dailyOneClock.now,
        bestTimeDataRoot: dataRoot,
      });
      dailyOneClock.advance(Date.parse("2093-03-31T00:00:00.000Z"));
      dailyOneRun.press("enter");
      dailyOneRun.state.activeSessionType = "daily";
      dailyOneRun.state.activeDailyDateKey = "2093-03-31";
      dailyOneClock.advance(4_000);
      dailyOneRun.press("5");
      expect(dailyOneRun.getViewModel().bestTimeText).toBe("00:04");

      const dailyTwoClock = new FakeClock();
      const dailyTwoRun = createGameplayController({
        board: createAlmostSolvedBoard(),
        now: dailyTwoClock.now,
        bestTimeDataRoot: dataRoot,
      });
      dailyTwoClock.advance(Date.parse("2093-04-01T00:00:00.000Z"));
      dailyTwoRun.press("enter");
      dailyTwoRun.state.activeSessionType = "daily";
      dailyTwoRun.state.activeDailyDateKey = "2093-04-01";
      dailyTwoClock.advance(9_000);
      dailyTwoRun.press("5");
      expect(dailyTwoRun.getViewModel().bestTimeText).toBe("00:09");

      const verifyNormal = createGameplayController({
        board: createAlmostSolvedBoard(),
        bestTimeDataRoot: dataRoot,
      });
      verifyNormal.press("enter");
      expect(verifyNormal.getViewModel().bestTimeText).toBe("00:08");

      const persisted = JSON.parse(
        readFileSync(join(dataRoot, "OpenSudoku", "best-times.json"), "utf8"),
      ) as {
        v: number;
        b: { n?: number; g?: Record<string, number>; d?: Record<string, number> };
      };
      expect(persisted).toEqual({
        v: 2,
        b: {
          n: 8_000,
          g: { easy: 6_000 },
          d: {
            "2093-03-31": 4_000,
            "2093-04-01": 9_000,
          },
        },
      });
    } finally {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });
});
