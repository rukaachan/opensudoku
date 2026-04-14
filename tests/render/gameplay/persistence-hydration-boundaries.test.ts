import { describe, expect, test } from "bun:test";
import { createGameplayController } from "../../../src/app/gameplay";

describe("persistence hydration boundaries", () => {
  test("hydrates persisted data at allowed boundaries and not on repeated idle view-model reads", () => {
    const calls = {
      readBestTimeMs: 0,
      readProgressSummary: 0,
      recordBestTimeMs: 0,
      listCompletedDailyDateKeys: 0,
      recordDailyCompletion: 0,
      getDailyStreakCount: 0,
    };

    const controller = createGameplayController({
      persistence: {
        readBestTimeMs: () => ((calls.readBestTimeMs += 1), null),
        readProgressSummary: () => ((calls.readProgressSummary += 1), null),
        recordBestTimeMs: () => ((calls.recordBestTimeMs += 1), 4_000),
        hasCompletedSession: () => false,
        listCompletedDailyDateKeys: () => ((calls.listCompletedDailyDateKeys += 1), []),
        recordDailyCompletion: () => {
          calls.recordDailyCompletion += 1;
        },
        recordDailyCompletionByTimestamp: () => "2040-01-01",
        recordSolveProgress: () => true,
        getDailyStreakCount: () => ((calls.getDailyStreakCount += 1), 0),
      },
    });

    expect(calls.readBestTimeMs).toBe(0);
    expect(calls.getDailyStreakCount).toBe(0);
    expect(calls.listCompletedDailyDateKeys).toBe(0);

    controller.press("enter");
    expect(calls.readBestTimeMs).toBe(1);
    expect(calls.getDailyStreakCount).toBe(1);

    const playHydrationReads = { ...calls };
    for (let i = 0; i < 5; i += 1) {
      controller.tick();
      controller.getViewModel();
    }

    expect(calls.readBestTimeMs).toBe(playHydrationReads.readBestTimeMs);
    expect(calls.getDailyStreakCount).toBe(playHydrationReads.getDailyStreakCount);
    expect(calls.listCompletedDailyDateKeys).toBe(playHydrationReads.listCompletedDailyDateKeys);

    controller.press("escape");
    controller.press("d");
    expect(controller.state.screen).toBe("daily");
    expect(calls.listCompletedDailyDateKeys).toBe(1);

    const dailyHydrationReads = { ...calls };
    for (let i = 0; i < 5; i += 1) {
      controller.getViewModel();
    }

    expect(calls.readBestTimeMs).toBe(dailyHydrationReads.readBestTimeMs);
    expect(calls.getDailyStreakCount).toBe(dailyHydrationReads.getDailyStreakCount);
    expect(calls.listCompletedDailyDateKeys).toBe(dailyHydrationReads.listCompletedDailyDateKeys);
    expect(calls.recordBestTimeMs).toBe(0);
    expect(calls.recordDailyCompletion).toBe(0);

    controller.press("escape");
    for (let i = 0; i < 8; i += 1) controller.press("up");
    controller.press("down");
    controller.press("down");
    controller.press("down");
    controller.press("enter");
    expect(controller.state.screen).toBe("progress");
    expect(calls.readProgressSummary).toBe(1);

    const progressHydrationReads = { ...calls };
    for (let i = 0; i < 5; i += 1) {
      controller.getViewModel();
    }

    expect(calls.readProgressSummary).toBe(progressHydrationReads.readProgressSummary);
  });
});
