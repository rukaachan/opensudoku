import { describe, expect, test } from "bun:test";
import { boardToString } from "../../../src/domain/board";
import { createGameplayController } from "../../../src/app/gameplay";
import { captureControllerFrame } from "./support";

class FakeClock {
  private valueMs = 0;
  now = (): number => this.valueMs;
  advance(ms: number): void {
    this.valueMs += ms;
  }
}

describe("Limited hint budget and fresh-session reset", () => {
  test("fresh play and Daily sessions start with visible two-hint budget and reset after exhaustion", async () => {
    const playController = createGameplayController();
    playController.press("enter");
    expect(playController.state.remainingHints).toBe(2);
    expect((await captureControllerFrame(playController)).text).toContain("Hints: 2");

    playController.press("h");
    playController.press("h");
    expect(playController.state.remainingHints).toBe(1);
    expect(playController.state.activeNumber).toBeNull();
    playController.press("escape");
    playController.press("p");
    expect(playController.state.remainingHints).toBe(2);
    expect((await captureControllerFrame(playController)).text).toContain("Hints: 2");

    const dailyController = createGameplayController();
    dailyController.press("d");
    dailyController.press("enter");
    expect(dailyController.state.screen).toBe("play");
    expect(dailyController.state.activeSessionType).toBe("daily");
    expect(dailyController.state.remainingHints).toBe(2);
    expect((await captureControllerFrame(dailyController)).text).toContain("Hints: 2");
    dailyController.press("h");
    dailyController.press("h");
    expect(dailyController.state.remainingHints).toBe(1);
    expect(dailyController.state.activeNumber).toBeNull();
    dailyController.press("escape");
    dailyController.press("d");
    dailyController.press("enter");
    expect(dailyController.state.screen).toBe("play");
    expect(dailyController.state.remainingHints).toBe(2);
  });

  test("after challenge expiry, hints remain allowed and still enforce two-use cap", () => {
    const clock = new FakeClock();
    const controller = createGameplayController({ now: clock.now });
    controller.press("down");
    controller.press("down");
    controller.press("enter");
    controller.press("1");
    controller.press("t");
    clock.advance(15 * 60 * 1_000 + 1_000);
    controller.tick();
    expect(controller.state.challengeFailed).toBe(true);
    expect(controller.state.runLocked).toBe(true);
    expect(controller.state.remainingHints).toBe(2);

    const beforeHintsUndo = controller.state.history.undoCount;
    controller.press("h");
    expect(controller.state.history.undoCount).toBe(beforeHintsUndo);
    expect(controller.state.remainingHints).toBe(1);
    expect(controller.state.status.toLowerCase()).toContain("hint");

    controller.press("h");
    expect(controller.state.history.undoCount).toBe(beforeHintsUndo);
    expect(controller.state.remainingHints).toBe(1);

    controller.press("h");
    expect(controller.state.remainingHints).toBe(1);
    expect(controller.state.history.undoCount).toBe(beforeHintsUndo);
    expect(controller.state.status.toLowerCase()).toContain("hint");
  });

  test("fresh Generator -> Play resets expired challenge state and stale hint line", async () => {
    const clock = new FakeClock();
    const controller = createGameplayController({ now: clock.now });
    controller.press("enter");
    controller.press("h");
    expect(controller.state.lastHint).not.toBeNull();
    expect((await captureControllerFrame(controller)).text).toContain("Hint:");

    controller.press("down");
    controller.press("down");
    controller.press("escape");
    controller.press("down");
    controller.press("down");
    controller.press("enter");
    controller.press("1");
    controller.press("t");
    clock.advance(15 * 60 * 1_000 + 1_000);
    controller.tick();
    expect(controller.state.challengeFailed).toBe(true);
    expect(controller.state.runLocked).toBe(true);

    controller.press("escape");
    controller.press("g");
    controller.press("1");
    expect(controller.state.screen).toBe("play");
    expect(controller.state.activeSessionType).toBe("generated");
    expect(controller.state.remainingHints).toBe(2);
    expect(controller.state.lastHint).toBeNull();
    expect(controller.state.challengeFailed).toBe(false);
    expect(controller.state.sessionTimerMode).toBe("stopwatch");
    expect(controller.state.runLocked).toBe(false);
    const freshFrame = await captureControllerFrame(controller);
    expect(freshFrame.text).toContain("Hints: 2");
    expect(freshFrame.text).not.toContain("Hint:");
    expect(freshFrame.text).not.toContain("Challenge: FAILED");
  });

  test("failed or exhausted hint requests clear stale Hint line without mutating board/history", async () => {
    const exhausted = createGameplayController();
    exhausted.press("enter");
    exhausted.press("h");
    expect(exhausted.state.lastHint).not.toBeNull();
    expect((await captureControllerFrame(exhausted)).text).toContain("Hint:");
    exhausted.press("h");
    const boardBeforeExhausted = boardToString(exhausted.state.board);
    const undoBeforeExhausted = exhausted.state.history.undoCount;
    exhausted.press("h");
    expect(exhausted.state.lastHint).not.toBeNull();
    expect(boardToString(exhausted.state.board)).toBe(boardBeforeExhausted);
    expect(exhausted.state.history.undoCount).toBe(undoBeforeExhausted);
    const exhaustedFrame = await captureControllerFrame(exhausted);
    expect(exhaustedFrame.text).toContain("Hints: 1");
    expect(exhaustedFrame.text).toContain("Hint:");

    const failed = createGameplayController();
    failed.press("enter");
    failed.press("h");
    const staleHint = failed.state.lastHint;
    if (!staleHint) throw new Error("Expected stale hint before forced failure.");
    failed.state.board.setValue(0, 2, 5);
    const boardBeforeFailed = boardToString(failed.state.board);
    const undoBeforeFailed = failed.state.history.undoCount;
    const hintsBeforeFailed = failed.state.remainingHints;
    failed.state.lastHint = null;
    failed.press("h");
    expect(failed.state.lastHint).toBeNull();
    expect(boardToString(failed.state.board)).toBe(boardBeforeFailed);
    expect(failed.state.history.undoCount).toBe(undoBeforeFailed);
    expect(failed.state.remainingHints).toBe(hintsBeforeFailed);
    expect((await captureControllerFrame(failed)).text).not.toContain("Hint:");
  });
});
