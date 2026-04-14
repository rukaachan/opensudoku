import { describe, expect, test } from "bun:test";
import { boardToString, type Board } from "../../../src/domain/board";
import {
  createDailyPuzzle,
  getDailyDifficulty,
  type DailyPuzzleResult,
  type DailyDateKey,
} from "../../../src/domain/daily";
import {
  runDailyByDateKey,
  Difficulty,
  type GeneratedPuzzleResult,
} from "../../../src/app/puzzle-tools";

type SuccessfulDailyPuzzle = DailyPuzzleResult & {
  status: "success";
  puzzle: Board;
  solution: Board;
  difficulty: Difficulty;
};

function expectSuccessfulDailyPuzzle(
  result: DailyPuzzleResult,
  dateKey: DailyDateKey,
): SuccessfulDailyPuzzle {
  if (result.status !== "success" || !result.puzzle || !result.solution || !result.difficulty) {
    throw new Error(`Expected ${dateKey} to produce a successful Daily puzzle+solution.`);
  }

  return result as SuccessfulDailyPuzzle;
}

function expectPlayableDailySession(
  result: ReturnType<typeof runDailyByDateKey>,
  dateKey: DailyDateKey,
) {
  if (!result || !("board" in result)) {
    throw new Error(`Expected ${dateKey} to produce a playable Daily session.`);
  }

  const session: GeneratedPuzzleResult = result;
  expect(session.sessionType).toBe("daily");
  expect(session.dailyDateKey).toBe(dateKey);
  expect(session.sessionId).toBe(`daily:${dateKey}`);
  expect(session.status).toContain("Daily");
  expect(session.status).toContain(dateKey);
  expect(session.status).toContain(session.difficulty);
  return session;
}

describe("Daily deterministic puzzle rotation", () => {
  test("same date key always maps to same puzzle and difficulty", () => {
    const dateKey: DailyDateKey = "2026-04-07";

    const first = createDailyPuzzle(dateKey);
    const second = createDailyPuzzle(dateKey);

    expect(first.status).toBe("success");
    expect(second.status).toBe("success");

    if (first.status !== "success" || second.status !== "success") {
      throw new Error("Expected deterministic daily generation to succeed for valid date key.");
    }

    const firstPuzzle = first.puzzle;
    const secondPuzzle = second.puzzle;
    const firstSolution = first.solution;
    const secondSolution = second.solution;

    if (!firstPuzzle || !secondPuzzle || !firstSolution || !secondSolution) {
      throw new Error("Expected successful daily generation to return puzzle and solution boards.");
    }

    expect(first.difficulty).toBe(second.difficulty);
    expect(boardToString(firstPuzzle)).toBe(boardToString(secondPuzzle));
    expect(boardToString(firstSolution)).toBe(boardToString(secondSolution));
  });

  test("difficulty rotates easy -> medium -> hard across adjacent dates", () => {
    const start = new Date(Date.UTC(2026, 2, 30));
    const difficulties: Difficulty[] = [];

    for (let offset = 0; offset < 6; offset++) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + offset);
      difficulties.push(getDailyDifficulty(date));
    }

    const nextByDifficulty: Record<Difficulty, Difficulty> = {
      [Difficulty.Easy]: Difficulty.Medium,
      [Difficulty.Medium]: Difficulty.Hard,
      [Difficulty.Hard]: Difficulty.Easy,
    };

    for (let i = 1; i < difficulties.length; i++) {
      expect(difficulties[i]).toBe(nextByDifficulty[difficulties[i - 1]]);
    }
  });

  test("daily app helper exposes daily session identity for selected date", () => {
    const result = runDailyByDateKey("2030-12-25");
    expect(result).not.toBeNull();

    if (!result || !("board" in result)) {
      throw new Error("Expected daily app helper to return a playable daily session.");
    }

    expect(result.difficulty).toBe(Difficulty.Medium);
    expect(result.sessionType).toBe("daily");
    expect(result.dailyDateKey).toBe("2030-12-25");
    expect(result.sessionId).toBe("daily:2030-12-25");
    expect(result.status.toLowerCase()).toContain("2030-12-25");
  });

  test("same UTC date key reproduces full daily identity surface", () => {
    const dateKey: DailyDateKey = "2024-02-29";

    const firstGenerated = expectSuccessfulDailyPuzzle(createDailyPuzzle(dateKey), dateKey);
    const secondGenerated = expectSuccessfulDailyPuzzle(createDailyPuzzle(dateKey), dateKey);
    const first = runDailyByDateKey(dateKey);
    const second = runDailyByDateKey(dateKey);

    const firstSession = expectPlayableDailySession(first, dateKey);
    const secondSession = expectPlayableDailySession(second, dateKey);

    expect(firstGenerated.dateKey).toBe(dateKey);
    expect(secondGenerated.dateKey).toBe(dateKey);
    expect(firstGenerated.difficulty).toBe(secondGenerated.difficulty);
    expect(boardToString(firstGenerated.puzzle)).toBe(boardToString(secondGenerated.puzzle));
    expect(boardToString(firstGenerated.solution)).toBe(boardToString(secondGenerated.solution));

    expect(firstSession.status).toBe(secondSession.status);
    expect(firstSession.difficulty).toBe(secondSession.difficulty);
    expect(boardToString(firstSession.board)).toBe(boardToString(secondSession.board));
    expect(boardToString(firstSession.board)).toBe(boardToString(firstGenerated.puzzle));
    expect(boardToString(secondSession.board)).toBe(boardToString(secondGenerated.puzzle));
  });

  test("generated Daily identity stays distinct across leap-day and year-edge date keys", () => {
    const ordinaryA: DailyDateKey = "2026-04-07";
    const ordinaryB: DailyDateKey = "2026-04-08";
    const leapDay: DailyDateKey = "2024-02-29";
    const leapNext: DailyDateKey = "2024-03-01";
    const yearEdgeA: DailyDateKey = "2025-12-31";
    const yearEdgeB: DailyDateKey = "2026-01-01";

    const generated = {
      ordinaryA: expectSuccessfulDailyPuzzle(createDailyPuzzle(ordinaryA), ordinaryA),
      ordinaryB: expectSuccessfulDailyPuzzle(createDailyPuzzle(ordinaryB), ordinaryB),
      leapDay: expectSuccessfulDailyPuzzle(createDailyPuzzle(leapDay), leapDay),
      leapNext: expectSuccessfulDailyPuzzle(createDailyPuzzle(leapNext), leapNext),
      yearEdgeA: expectSuccessfulDailyPuzzle(createDailyPuzzle(yearEdgeA), yearEdgeA),
      yearEdgeB: expectSuccessfulDailyPuzzle(createDailyPuzzle(yearEdgeB), yearEdgeB),
    };

    const sessions = {
      ordinaryA: expectPlayableDailySession(runDailyByDateKey(ordinaryA), ordinaryA),
      ordinaryB: expectPlayableDailySession(runDailyByDateKey(ordinaryB), ordinaryB),
      leapDay: expectPlayableDailySession(runDailyByDateKey(leapDay), leapDay),
      leapNext: expectPlayableDailySession(runDailyByDateKey(leapNext), leapNext),
      yearEdgeA: expectPlayableDailySession(runDailyByDateKey(yearEdgeA), yearEdgeA),
      yearEdgeB: expectPlayableDailySession(runDailyByDateKey(yearEdgeB), yearEdgeB),
    };

    expect(boardToString(generated.ordinaryA.puzzle)).not.toBe(
      boardToString(generated.ordinaryB.puzzle),
    );
    expect(boardToString(generated.leapDay.puzzle)).not.toBe(
      boardToString(generated.leapNext.puzzle),
    );
    expect(boardToString(generated.yearEdgeA.puzzle)).not.toBe(
      boardToString(generated.yearEdgeB.puzzle),
    );
    expect(boardToString(generated.leapDay.solution)).not.toBe(
      boardToString(generated.leapNext.solution),
    );
    expect(boardToString(generated.yearEdgeA.solution)).not.toBe(
      boardToString(generated.yearEdgeB.solution),
    );

    expect(sessions.ordinaryA.sessionId).not.toBe(sessions.ordinaryB.sessionId);
    expect(sessions.leapDay.sessionId).not.toBe(sessions.leapNext.sessionId);
    expect(sessions.yearEdgeA.sessionId).not.toBe(sessions.yearEdgeB.sessionId);
    expect(boardToString(sessions.ordinaryA.board)).not.toBe(
      boardToString(sessions.ordinaryB.board),
    );
    expect(boardToString(sessions.leapDay.board)).not.toBe(boardToString(sessions.leapNext.board));
    expect(boardToString(sessions.yearEdgeA.board)).not.toBe(
      boardToString(sessions.yearEdgeB.board),
    );
  });

  test("year-edge date keys are deterministic on reopen", () => {
    const dateKeys: DailyDateKey[] = ["2025-12-31", "2026-01-01"];

    for (const dateKey of dateKeys) {
      const first = runDailyByDateKey(dateKey);
      const second = runDailyByDateKey(dateKey);

      if (!first || !("board" in first) || !second || !("board" in second)) {
        throw new Error(`Expected deterministic year-edge Daily sessions for ${dateKey}.`);
      }

      expect(first.sessionType).toBe("daily");
      expect(second.sessionType).toBe("daily");
      expect(first.dailyDateKey).toBe(dateKey);
      expect(second.dailyDateKey).toBe(dateKey);
      expect(first.sessionId).toBe(`daily:${dateKey}`);
      expect(second.sessionId).toBe(`daily:${dateKey}`);
      expect(first.status).toBe(second.status);
      expect(first.status.toLowerCase()).toContain(dateKey);
      expect(boardToString(first.board)).toBe(boardToString(second.board));
      expect(first.difficulty).toBe(second.difficulty);
    }
  });
});
