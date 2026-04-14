import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { boardToString, parseBoard } from "../../../src/domain/board";
import { createGameplayController } from "../../../src/app/gameplay";
import { captureControllerFrame } from "./support";
import { resolveRepoRoot } from "../../repo-root";

const evidenceDir = join(
  resolveRepoRoot(import.meta.dir),
  "dist",
  "validation",
  "progression-stats",
  "user-testing",
  "evidence",
);

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

function openProgress(controller: ReturnType<typeof createGameplayController>): void {
  controller.press("down");
  controller.press("down");
  controller.press("down");
  controller.press("enter");
  expect(controller.state.screen).toBe("progress");
}

function snapshot(controller: ReturnType<typeof createGameplayController>) {
  const view = controller.getViewModel();
  return {
    screen: controller.state.screen,
    board: boardToString(controller.state.board),
    undo: controller.state.history.undoCount,
    redo: controller.state.history.redoCount,
    selection: { ...controller.state.selection },
    activeSessionId: controller.state.activeSessionId,
    activeDifficulty: controller.state.activeDifficulty,
    activeDailyDateKey: controller.state.activeDailyDateKey,
    timer: view.sessionTimerText,
    strikeCount: controller.state.strikeCount,
    runLocked: controller.state.runLocked,
    challengeFailed: controller.state.challengeFailed,
    notesMode: controller.state.notesMode,
    activeNumber: controller.state.activeNumber,
    hasHint: controller.state.lastHint !== null,
    progress: controller.state.progressSummary,
  };
}

function writeArtifact(name: string, body: unknown): void {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(join(evidenceDir, name), JSON.stringify(body, null, 2));
}

describe("Progression journey proofs", () => {
  test("VAL-X-001 normal-play assist journey updates progress in-session and after relaunch", async () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "opensudoku-x001-"));
    try {
      const controller = createGameplayController({
        board: createAlmostSolvedBoard(),
        bestTimeDataRoot: dataRoot,
      });
      controller.press("enter");
      controller.press("n");
      controller.press("1");
      controller.press("n");
      controller.press("h");
      controller.press("5");
      controller.press("escape");
      openProgress(controller);
      const sameSession = await captureControllerFrame(controller);

      const relaunched = createGameplayController({ bestTimeDataRoot: dataRoot });
      openProgress(relaunched);
      const relaunchedFrame = await captureControllerFrame(relaunched);
      const progression = JSON.parse(
        readFileSync(join(dataRoot, "OpenSudoku", "progression.json"), "utf8"),
      );

      expect(sameSession.text).toContain("General Solves: 1");
      expect(sameSession.text).toContain("Assisted Solves: 1");
      expect(relaunchedFrame.text).toContain("General Solves: 1");
      expect(relaunchedFrame.text).toContain("Assisted Solves: 1");
      expect(progression.s.g).toBe(1);
      expect(progression.s.a).toBe(1);

      writeArtifact("val-x-001-normal-play-journey.json", {
        assertion: "VAL-X-001",
        sameSessionText: sameSession.text,
        relaunchedText: relaunchedFrame.text,
        progression,
      });
    } finally {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  test("VAL-X-002 daily assisted completion stays date-scoped", async () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "opensudoku-x002-"));
    try {
      const clock = new FakeClock();
      clock.advance(Date.parse("2040-01-12T00:00:00.000Z"));
      const controller = createGameplayController({
        board: createAlmostSolvedBoard(),
        bestTimeDataRoot: dataRoot,
        now: clock.now,
      });
      controller.press("enter");
      controller.state.activeSessionType = "daily";
      controller.state.activeDailyDateKey = "2040-01-12";
      controller.state.activeSessionId = "daily:2040-01-12";
      controller.press("n");
      controller.press("1");
      controller.press("n");
      controller.press("h");
      controller.press("5");

      const dailyCompletions = JSON.parse(
        readFileSync(join(dataRoot, "OpenSudoku", "daily-completions.json"), "utf8"),
      );
      const progression = JSON.parse(
        readFileSync(join(dataRoot, "OpenSudoku", "progression.json"), "utf8"),
      );

      expect(dailyCompletions.c["2040-01-12"]).toBeGreaterThan(0);
      expect(progression.s.d["2040-01-12"]).toBe(1);
      expect(progression.s.ge.easy ?? 0).toBe(0);

      writeArtifact("val-x-002-daily-journey.json", {
        assertion: "VAL-X-002",
        dailyCompletions,
        progression,
      });
    } finally {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  test("VAL-X-003 generated challenge solve and failure branches stay progression-distinct", () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "opensudoku-x003-"));
    try {
      const solveClock = new FakeClock();
      const solved = createGameplayController({ bestTimeDataRoot: dataRoot, now: solveClock.now });
      solved.press("g");
      solved.press("1");
      solved.state.board = createAlmostSolvedBoard();
      solved.press("t");
      solved.press("n");
      solved.press("1");
      solved.press("n");
      solved.press("h");
      solved.press("5");

      const failClock = new FakeClock();
      const failed = createGameplayController({ bestTimeDataRoot: dataRoot, now: failClock.now });
      failed.press("g");
      failed.press("1");
      failed.press("t");
      failed.press("n");
      failed.press("1");
      failed.press("n");
      failed.press("h");
      failClock.advance(15 * 60 * 1_000 + 1_000);
      failed.tick();

      const progression = JSON.parse(
        readFileSync(join(dataRoot, "OpenSudoku", "progression.json"), "utf8"),
      );
      expect(solved.state.challengeFailed).toBe(false);
      expect(failed.state.challengeFailed).toBe(true);
      expect(failed.state.runLocked).toBe(true);
      expect(progression.s.g).toBe(1);
      expect(progression.s.c).toBe(1);
      expect(progression.s.ge.easy).toBe(1);

      writeArtifact("val-x-003-generated-challenge-journey.json", {
        assertion: "VAL-X-003",
        solvedStatus: solved.state.status,
        failedStatus: failed.state.status,
        progression,
      });
    } finally {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });

  test("VAL-X-004 detours preserve active run state and only fresh play resets a failed branch", () => {
    const controller = createGameplayController({ board: createAlmostSolvedBoard() });
    controller.press("enter");
    controller.press("n");
    controller.press("1");
    controller.press("n");
    controller.press("h");
    const beforeRoot = snapshot(controller);
    controller.press("escape");
    const atRoot = snapshot(controller);
    controller.press("down");
    controller.press("enter");
    const progressDetour = snapshot(controller);
    controller.press("escape");
    controller.press("down");
    controller.press("down");
    controller.press("enter");
    const helpDetour = snapshot(controller);

    const failClock = new FakeClock();
    const failed = createGameplayController({ now: failClock.now });
    failed.press("g");
    failed.press("1");
    failed.press("t");
    failClock.advance(15 * 60 * 1_000 + 1_000);
    failed.tick();
    const failedBeforeReset = snapshot(failed);
    failed.press("escape");
    failed.press("enter");
    const afterFreshPlay = snapshot(failed);

    expect(atRoot.board).toBe(beforeRoot.board);
    expect(atRoot.undo).toBe(beforeRoot.undo);
    expect(progressDetour.activeSessionId).toBe(beforeRoot.activeSessionId);
    expect(helpDetour.activeSessionId).toBe(beforeRoot.activeSessionId);
    expect(failedBeforeReset.runLocked).toBe(true);
    expect(failedBeforeReset.challengeFailed).toBe(true);
    expect(afterFreshPlay.runLocked).toBe(false);
    expect(afterFreshPlay.challengeFailed).toBe(false);

    writeArtifact("val-x-004-detour-matrix.json", {
      assertion: "VAL-X-004",
      beforeRoot,
      atRoot,
      progressDetour,
      helpDetour,
      failedBeforeReset,
      afterFreshPlay,
    });
  });
});
