import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseBoard } from "../../../src/domain/board";
import { createGameplayController } from "../../../src/app/gameplay";
import { Difficulty } from "../../../src/app/puzzle-tools";

function createAlmostSolvedBoard() {
  return parseBoard(
    "034678912672195348198342567859761423426853791713924856961537284287419635345286179",
  );
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

describe("Progression scopes and award rules", () => {
  test("tracks assisted solves, challenge wins, generated difficulty scopes, and duplicate-award guards", () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "opensudoku-progression-awards-"));
    try {
      let easyNowMs = 0;
      const easy = createGameplayController({
        board: createAlmostSolvedBoard(),
        bestTimeDataRoot: dataRoot,
        now: () => easyNowMs,
      });
      easy.press("enter");
      easy.state.activeSessionType = "generated";
      easy.state.activeDifficulty = Difficulty.Easy;
      easy.state.activeSessionId = "generated:easy:proof";
      easy.press("h");
      easy.press("t");
      easyNowMs = 5_000;
      easy.press("5");
      expect(easy.state.solved).toBe(true);

      let mediumNowMs = 0;
      const medium = createGameplayController({
        board: createAlmostSolvedBoard(),
        bestTimeDataRoot: dataRoot,
        now: () => mediumNowMs,
      });
      medium.press("enter");
      medium.state.activeSessionType = "generated";
      medium.state.activeDifficulty = Difficulty.Medium;
      medium.state.activeSessionId = "generated:medium:proof";
      mediumNowMs = 9_000;
      medium.press("5");

      let duplicateNowMs = 0;
      const duplicate = createGameplayController({
        board: createAlmostSolvedBoard(),
        bestTimeDataRoot: dataRoot,
        now: () => duplicateNowMs,
      });
      duplicate.press("enter");
      duplicate.state.activeSessionType = "generated";
      duplicate.state.activeDifficulty = Difficulty.Easy;
      duplicate.state.activeSessionId = "generated:easy:proof";
      duplicateNowMs = 3_000;
      duplicate.press("5");

      const abandoned = createGameplayController({
        board: createAlmostSolvedBoard(),
        bestTimeDataRoot: dataRoot,
        now: () => 12_000,
      });
      abandoned.press("enter");
      abandoned.state.activeSessionType = "generated";
      abandoned.state.activeDifficulty = Difficulty.Hard;
      abandoned.state.activeSessionId = "generated:hard:abandoned";
      abandoned.press("escape");

      const bestTimes = readJson<{ b: { g?: { easy?: number; medium?: number; hard?: number } } }>(
        join(dataRoot, "OpenSudoku", "best-times.json"),
      );
      const progression = readJson<{
        s: { g: number; a: number; c: number; ge: { easy: number; medium: number; hard: number } };
        x: { completedSessions: Record<string, true> };
      }>(join(dataRoot, "OpenSudoku", "progression.json"));

      expect(bestTimes.b.g?.easy).toBe(5_000);
      expect(bestTimes.b.g?.medium).toBe(9_000);
      expect(bestTimes.b.g?.hard).toBeUndefined();
      expect(progression.s.g).toBe(2);
      expect(progression.s.a).toBe(1);
      expect(progression.s.c).toBe(1);
      expect(progression.s.ge.easy).toBe(1);
      expect(progression.s.ge.medium).toBe(1);
      expect(progression.s.ge.hard).toBe(0);
      expect(Object.keys(progression.x.completedSessions)).toEqual([
        "generated:easy:proof",
        "generated:medium:proof",
      ]);
    } finally {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  test("credits daily completion by UTC completion date and preserves isolated daily records", () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "opensudoku-daily-progress-"));
    try {
      const crossMidnightSolveTime = Date.parse("2040-01-12T00:00:05.000Z");
      let nowMs = Date.parse("2040-01-11T23:59:55.000Z");
      const daily = createGameplayController({
        board: createAlmostSolvedBoard(),
        bestTimeDataRoot: dataRoot,
        now: () => nowMs,
      });
      daily.press("enter");
      daily.state.activeSessionType = "daily";
      daily.state.activeDailyDateKey = "2040-01-11";
      daily.state.activeSessionId = "daily:2040-01-11";
      daily.press("h");
      nowMs = crossMidnightSolveTime;
      daily.press("5");

      const bestTimes = readJson<{ b: { d?: Record<string, number> } }>(
        join(dataRoot, "OpenSudoku", "best-times.json"),
      );
      const dailyCompletions = readJson<{ c: Record<string, number> }>(
        join(dataRoot, "OpenSudoku", "daily-completions.json"),
      );
      const progression = readJson<{ s: { d: Record<string, number>; g: number; a: number } }>(
        join(dataRoot, "OpenSudoku", "progression.json"),
      );

      expect(bestTimes.b.d?.["2040-01-11"]).toBe(10_000);
      expect(dailyCompletions.c["2040-01-12"]).toBe(crossMidnightSolveTime);
      expect(dailyCompletions.c["2040-01-11"]).toBeUndefined();
      expect(progression.s.d["2040-01-12"]).toBe(1);
      expect(progression.s.g).toBe(1);
      expect(progression.s.a).toBe(1);
    } finally {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });
});
