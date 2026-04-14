import { describe, expect, test } from "bun:test";
import { createGameplayController } from "../../../src/app/gameplay";

class FakeClock {
  private valueMs = 0;
  now = (): number => this.valueMs;
}

describe("Challenge activation guards", () => {
  test("default Play rejects challenge activation without mutating timer state or text", () => {
    const clock = new FakeClock();
    const controller = createGameplayController({ now: clock.now });
    controller.press("enter");
    expect(controller.state.screen).toBe("play");
    expect(controller.state.activeSessionType).toBeNull();
    expect(controller.state.activeDifficulty).toBeNull();

    const beforeView = controller.getViewModel();
    controller.press("t");
    const afterView = controller.getViewModel();

    expect(controller.state.status.toLowerCase()).toContain("challenge mode");
    expect(controller.state.status.toLowerCase()).toContain("generated");
    expect(afterView.sessionTimerMode).toBe(beforeView.sessionTimerMode);
    expect(afterView.sessionTimerText).toBe(beforeView.sessionTimerText);
    expect(controller.state.challengeTotalSeconds).toBeNull();
    expect(controller.state.challengeFailed).toBe(false);
  });

  test("Daily sessions reject challenge activation without mutating timer state or text", () => {
    const clock = new FakeClock();
    const controller = createGameplayController({ now: clock.now });
    controller.press("down");
    controller.press("enter");
    expect(controller.state.screen).toBe("daily");
    controller.press("enter");

    expect(controller.state.screen).toBe("play");
    expect(controller.state.activeSessionType).toBe("daily");
    expect(controller.state.activeDifficulty).not.toBeNull();

    const beforeView = controller.getViewModel();
    controller.press("t");
    const afterView = controller.getViewModel();

    expect(controller.state.status.toLowerCase()).toContain("challenge mode");
    expect(controller.state.status.toLowerCase()).toContain("generated");
    expect(afterView.sessionTimerMode).toBe(beforeView.sessionTimerMode);
    expect(afterView.sessionTimerText).toBe(beforeView.sessionTimerText);
    expect(controller.state.challengeTotalSeconds).toBeNull();
    expect(controller.state.challengeFailed).toBe(false);
  });
});
