import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { boardToString, parseBoard } from "../../../src/domain/board";
import { createGameplayController } from "../../../src/app/gameplay";
import { Difficulty } from "../../../src/app/puzzle-tools";
import { captureControllerFrame } from "./support";

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

describe("Gameplay session timing and challenge countdown", () => {
  test("timer starts only with active play session and stays hidden on root/setup screens", async () => {
    const clock = new FakeClock();
    const controller = createGameplayController({ now: clock.now });

    const rootView = controller.getViewModel();
    expect(rootView.sessionTimerRunning).toBe(false);
    expect(rootView.sessionTimerText).toBe("00:00");

    const rootFrame = await captureControllerFrame(controller);
    expect(rootFrame.text).not.toContain("Timer:");

    controller.press("g");
    expect(controller.state.screen).toBe("generator");

    const setupFrame = await captureControllerFrame(controller);
    expect(setupFrame.text).not.toContain("Timer:");

    controller.press("escape");
    controller.press("p");
    expect(controller.state.screen).toBe("play");

    const startedView = controller.getViewModel();
    expect(startedView.sessionTimerRunning).toBe(true);
    expect(startedView.sessionTimerText).toBe("00:00");

    clock.advance(1_500);
    controller.tick();
    expect(controller.getViewModel().sessionTimerText).toBe("00:01");

    const playFrame = await captureControllerFrame(controller);
    expect(playFrame.text).toContain("Timer: 00:01");
  });

  test("standard stopwatch remains visible during play and freezes on solve", () => {
    const clock = new FakeClock();
    const controller = createGameplayController({
      board: createAlmostSolvedBoard(),
      now: clock.now,
    });

    controller.press("enter");
    clock.advance(2_300);
    controller.tick();
    expect(controller.getViewModel().sessionTimerText).toBe("00:02");
    expect(controller.getViewModel().sessionTimerRunning).toBe(true);

    controller.press("5");
    expect(controller.state.solved).toBe(true);

    const solvedView = controller.getViewModel();
    expect(solvedView.sessionTimerRunning).toBe(false);
    expect(solvedView.sessionTimerText).toBe("00:02");

    clock.advance(5_000);
    controller.tick();
    expect(controller.getViewModel().sessionTimerText).toBe("00:02");
  });

  test("challenge countdown uses difficulty presets and fails clearly at zero", async () => {
    const presets: Array<{ key: "1" | "2" | "3"; difficulty: Difficulty; totalSeconds: number }> = [
      { key: "1", difficulty: Difficulty.Easy, totalSeconds: 15 * 60 },
      { key: "2", difficulty: Difficulty.Medium, totalSeconds: 10 * 60 },
      { key: "3", difficulty: Difficulty.Hard, totalSeconds: 5 * 60 },
    ];

    for (const preset of presets) {
      const clock = new FakeClock();
      const controller = createGameplayController({ now: clock.now });

      controller.press("g");
      expect(controller.state.screen).toBe("generator");
      controller.press(preset.key);
      expect(controller.state.screen).toBe("play");
      expect(controller.state.activeDifficulty).toBe(preset.difficulty);

      controller.press("t");

      const challengeView = controller.getViewModel();
      expect(challengeView.sessionTimerMode).toBe("challenge");
      expect(challengeView.challengeRemainingSeconds).toBe(preset.totalSeconds);
      expect(challengeView.sessionTimerText).toBe(
        `${String(Math.floor(preset.totalSeconds / 60)).padStart(2, "0")}:${String(preset.totalSeconds % 60).padStart(2, "0")}`,
      );

      clock.advance((preset.totalSeconds - 1) * 1_000);
      controller.tick();
      expect(controller.getViewModel().challengeFailed).toBe(false);
      expect(controller.getViewModel().challengeRemainingSeconds).toBe(1);

      clock.advance(2_000);
      controller.tick();

      const failedView = controller.getViewModel();
      expect(failedView.challengeFailed).toBe(true);
      expect(failedView.challengeRemainingSeconds).toBe(0);
      expect(failedView.sessionTimerText).toBe("00:00");
      expect(controller.state.status.toLowerCase()).toContain("time expired");
      expect(controller.state.runLocked).toBe(true);

      const before = controller.state.board.getCell(0, 2).value;
      controller.press("4");
      expect(controller.state.board.getCell(0, 2).value).toBe(before);

      const frame = await captureControllerFrame(controller);
      expect(frame.text).toContain("Challenge: FAILED");
      expect(frame.text).toContain("Timer: 00:00");
    }
  });

  test("after challenge expiry, undo and redo are rejected without mutating board or history", () => {
    const clock = new FakeClock();
    const controller = createGameplayController({ now: clock.now });
    controller.press("g");
    controller.press("1");
    controller.press("h");
    const hint = controller.state.lastHint;
    if (!hint) throw new Error("Expected hint payload for generated challenge board.");
    while (controller.state.selection.row < hint.row) controller.press("down");
    while (controller.state.selection.row > hint.row) controller.press("up");
    while (controller.state.selection.col < hint.col) controller.press("right");
    while (controller.state.selection.col > hint.col) controller.press("left");
    controller.press(String(hint.value));
    expect(controller.state.history.undoCount).toBeGreaterThan(0);
    controller.press("t");
    clock.advance(15 * 60 * 1_000 + 1_000);
    controller.tick();
    expect(controller.state.challengeFailed).toBe(true);
    expect(controller.state.runLocked).toBe(true);
    const boardAtExpiry = boardToString(controller.state.board);
    const undoAtExpiry = controller.state.history.undoCount;
    const redoAtExpiry = controller.state.history.redoCount;
    controller.press("u");
    expect(boardToString(controller.state.board)).toBe(boardAtExpiry);
    expect(controller.state.history.undoCount).toBe(undoAtExpiry);
    expect(controller.state.history.redoCount).toBe(redoAtExpiry);
    expect(controller.state.status.toLowerCase()).not.toContain("undo applied");
    expect(controller.state.status.toLowerCase()).toContain("play to restart");
    controller.press("r");
    expect(boardToString(controller.state.board)).toBe(boardAtExpiry);
    expect(controller.state.history.undoCount).toBe(undoAtExpiry);
    expect(controller.state.history.redoCount).toBe(redoAtExpiry);
    expect(controller.state.status.toLowerCase()).not.toContain("redo applied");
    expect(controller.state.status.toLowerCase()).toContain("play to restart");
  });

  test("best time updates only for faster completions and persists across relaunch", async () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "opensudoku-best-time-"));
    try {
      const firstClock = new FakeClock();
      const firstRun = createGameplayController({
        board: createAlmostSolvedBoard(),
        now: firstClock.now,
        bestTimeDataRoot: dataRoot,
      });
      firstRun.press("enter");
      firstClock.advance(5_000);
      firstRun.press("5");
      expect(firstRun.state.solved).toBe(true);
      expect(firstRun.getViewModel().bestTimeText).toBe("00:05");

      const slowerClock = new FakeClock();
      const slowerRun = createGameplayController({
        board: createAlmostSolvedBoard(),
        now: slowerClock.now,
        bestTimeDataRoot: dataRoot,
      });
      slowerClock.advance(1_000);
      slowerRun.press("enter");
      expect(slowerRun.getViewModel().bestTimeText).toBe("00:05");
      slowerClock.advance(7_000);
      slowerRun.press("5");
      expect(slowerRun.state.solved).toBe(true);
      expect(slowerRun.getViewModel().bestTimeText).toBe("00:05");

      const fasterClock = new FakeClock();
      const fasterRun = createGameplayController({
        board: createAlmostSolvedBoard(),
        now: fasterClock.now,
        bestTimeDataRoot: dataRoot,
      });
      fasterClock.advance(2_000);
      fasterRun.press("enter");
      expect(fasterRun.getViewModel().bestTimeText).toBe("00:05");
      fasterClock.advance(3_000);
      fasterRun.press("5");
      expect(fasterRun.state.solved).toBe(true);
      expect(fasterRun.getViewModel().bestTimeText).toBe("00:03");

      const reloaded = createGameplayController({
        board: createAlmostSolvedBoard(),
        bestTimeDataRoot: dataRoot,
      });
      reloaded.press("enter");
      const frame = await captureControllerFrame(reloaded);
      expect(frame.text).toContain("Best: 00:03");

      const persistedPath = join(dataRoot, "OpenSudoku", "best-times.json");
      expect(existsSync(persistedPath)).toBe(true);
      const raw = Bun.file(persistedPath).text();
      const persisted = JSON.parse(await raw) as {
        v: number;
        b: { n?: number; g?: Record<string, number>; d?: Record<string, number> };
      };
      expect(persisted).toEqual({ v: 2, b: { n: 3_000 } });
    } finally {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });
});
