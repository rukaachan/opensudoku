import { describe, expect, test } from "bun:test";
import { createGameplayController } from "../../../src/app/gameplay";

describe("runtime loop quiescence boundaries", () => {
  test("tick stays quiescent off-play and only requests play refresh on visible clock changes", () => {
    let nowMs = 0;
    const controller = createGameplayController({ now: () => nowMs });

    expect(controller.tick()).toBe(false);

    controller.press("enter");
    expect(controller.state.screen).toBe("play");

    nowMs = 250;
    expect(controller.tick()).toBe(false);

    nowMs = 999;
    expect(controller.tick()).toBe(false);

    nowMs = 1_000;
    expect(controller.tick()).toBe(true);

    nowMs = 1_250;
    expect(controller.tick()).toBe(false);
  });

  test("play input reports noop for edge-clamped and no-op mutation keys", () => {
    const controller = createGameplayController();
    expect(controller.press("enter")).toBe("continue");
    expect(controller.state.screen).toBe("play");

    expect(controller.press("up")).toBe("noop");
    expect(controller.state.selection.row).toBe(0);

    expect(controller.press("left")).toBe("noop");
    expect(controller.state.selection.col).toBe(0);

    expect(controller.press("u")).toBe("noop");
    expect(controller.press("r")).toBe("noop");

    expect(controller.press("right")).toBe("continue");
    expect(controller.press("right")).toBe("continue");
    expect(controller.press("backspace")).toBe("noop");
  });
});
