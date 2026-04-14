import { RGBA } from "@opentui/core";
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createGameplayController } from "../../../src/app/gameplay";
import {
  recordDailyCompletion,
  resolveDailyCompletionStorePath,
} from "../../../src/app/daily/daily-completion-store";
import { captureControllerFrame } from "./support";

function openDailyScreen(controller: ReturnType<typeof createGameplayController>): void {
  controller.press("down");
  controller.press("enter");
  expect(controller.state.screen).toBe("daily");
}

const EXPECTED_COMPLETED_GOLD_FG = RGBA.fromHex("#facc15");

function findSpanByToken(
  frame: Awaited<ReturnType<typeof captureControllerFrame>>["frame"],
  token: string,
) {
  for (const line of frame.lines) {
    for (const span of line.spans) {
      if (span.text.includes(token)) {
        return span;
      }
    }
  }
  return undefined;
}

describe("Daily calendar completion markers", () => {
  test("current-month completed dates show a gold * marker in month mode", async () => {
    const root = mkdtempSync(join(tmpdir(), "opensudoku-daily-calendar-"));
    try {
      const now = Date.UTC(2026, 3, 15, 12, 0, 0);
      const storePath = resolveDailyCompletionStorePath(root);
      recordDailyCompletion(storePath, "2026-04-03", now - 1_000);
      recordDailyCompletion(storePath, "2026-04-15", now - 500);
      recordDailyCompletion(storePath, "2026-05-01", now - 250);

      const controller = createGameplayController({ bestTimeDataRoot: root, now: () => now });
      openDailyScreen(controller);
      controller.press("down");

      const { frame, text } = await captureControllerFrame(controller);
      expect(text).toContain("Daily");
      expect(text).toContain("Browse: month");
      expect(text).toContain("April 2026");
      expect(text).toContain(" 3*");
      expect(text).toContain("15*");

      const aprilThirdSpan = findSpanByToken(frame, " 3*");
      const aprilFifteenthSpan = findSpanByToken(frame, "15*");
      expect(aprilThirdSpan?.fg).toEqual(EXPECTED_COMPLETED_GOLD_FG);
      expect(aprilFifteenthSpan?.fg).toEqual(EXPECTED_COMPLETED_GOLD_FG);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("selected completed date keeps stronger focus styling than completion marker", async () => {
    const root = mkdtempSync(join(tmpdir(), "opensudoku-daily-calendar-"));
    try {
      const now = Date.UTC(2026, 3, 15, 12, 0, 0);
      const storePath = resolveDailyCompletionStorePath(root);
      recordDailyCompletion(storePath, "2026-04-03", now - 1_000);
      recordDailyCompletion(storePath, "2026-04-15", now - 500);

      const controller = createGameplayController({ bestTimeDataRoot: root, now: () => now });
      openDailyScreen(controller);

      const { frame } = await captureControllerFrame(controller);
      const selectedCompleted = findSpanByToken(frame, "15*");
      const unselectedCompleted = findSpanByToken(frame, " 3*");

      expect(selectedCompleted).toBeDefined();
      expect(unselectedCompleted).toBeDefined();
      expect(selectedCompleted?.bg).toBeDefined();
      expect(selectedCompleted?.fg).not.toEqual(unselectedCompleted?.fg);
      expect(selectedCompleted?.bg).not.toEqual(unselectedCompleted?.bg);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("completion markers are hidden when browsing non-current months and in year mode", async () => {
    const root = mkdtempSync(join(tmpdir(), "opensudoku-daily-calendar-"));
    try {
      const now = Date.UTC(2026, 3, 15, 12, 0, 0);
      const storePath = resolveDailyCompletionStorePath(root);
      recordDailyCompletion(storePath, "2026-04-03", now - 1_000);
      recordDailyCompletion(storePath, "2026-04-15", now - 500);
      recordDailyCompletion(storePath, "2026-05-01", now - 250);

      const controller = createGameplayController({ bestTimeDataRoot: root, now: () => now });
      openDailyScreen(controller);

      controller.press("right");
      const may = await captureControllerFrame(controller);
      expect(may.text).toContain("May 2026");
      expect(may.text).not.toContain("*");

      controller.press("y");
      const year = await captureControllerFrame(controller);
      expect(year.text).toContain("Browse: year");
      expect(year.text).not.toContain("*");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
