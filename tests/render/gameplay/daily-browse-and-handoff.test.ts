import { describe, test, expect } from "bun:test";
import { createGameplayController } from "../../../src/app/gameplay";
import type { DailyDateKey } from "../../../src/app/puzzle-tools";
import { captureControllerFrame } from "./support";

function openDailyScreen(controller: ReturnType<typeof createGameplayController>): void {
  controller.press("down");
  controller.press("enter");
  expect(controller.state.screen).toBe("daily");
}

function selectedDateFromStatus(status: string): DailyDateKey {
  const match = status.match(/\d{4}-\d{2}-\d{2}/);
  if (!match) {
    throw new Error(`Expected status to include daily date key, got: ${status}`);
  }
  return match[0] as DailyDateKey;
}

function setBrowseMode(
  controller: ReturnType<typeof createGameplayController>,
  mode: "month" | "year",
): void {
  controller.press(mode === "month" ? "m" : "y");
}

function shiftUntil(
  controller: ReturnType<typeof createGameplayController>,
  direction: "left" | "right" | "up" | "down",
  done: (dateKey: DailyDateKey) => boolean,
): DailyDateKey {
  for (let i = 0; i < 400; i++) {
    const current = selectedDateFromStatus(controller.state.status);
    if (done(current)) {
      return current;
    }
    controller.press(direction);
  }
  throw new Error("Exceeded shift limit while trying to reach target daily date.");
}

function setDateExact(
  controller: ReturnType<typeof createGameplayController>,
  target: DailyDateKey,
): DailyDateKey {
  const [targetYear, targetMonth, targetDay] = target.split("-").map(Number);

  setBrowseMode(controller, "year");
  for (let i = 0; i < 200; i++) {
    const current = selectedDateFromStatus(controller.state.status);
    const year = Number(current.slice(0, 4));
    if (year === targetYear) break;
    controller.press(year < targetYear ? "right" : "left");
  }

  setBrowseMode(controller, "month");
  for (let i = 0; i < 200; i++) {
    const current = selectedDateFromStatus(controller.state.status);
    const month = Number(current.slice(5, 7));
    if (month === targetMonth) break;
    controller.press(month < targetMonth ? "right" : "left");
  }

  for (let i = 0; i < 200; i++) {
    const current = selectedDateFromStatus(controller.state.status);
    const day = Number(current.slice(8, 10));
    if (day === targetDay) return current;
    controller.press(day < targetDay ? "down" : "up");
  }

  throw new Error(`Failed to set target daily date ${target}`);
}

describe("Daily calendar browsing and clean session handoff", () => {
  test("opening Daily from root transitions into a clean playable daily session and surfaces date+difficulty", async () => {
    const controller = createGameplayController();
    openDailyScreen(controller);

    const target: DailyDateKey = "2096-02-29";
    const chosenDate = setDateExact(controller, target);
    expect(chosenDate).toBe(target);

    controller.press("enter");
    expect(controller.state.screen).toBe("play");
    expect(controller.state.activeSessionType).toBe("daily");
    expect(controller.state.activeDailyDateKey).toBe(target);
    expect(controller.state.selection.row).toBe(0);
    expect(controller.state.selection.col).toBe(0);
    expect(controller.state.notesMode).toBe(false);
    expect(controller.state.history.undoCount).toBe(0);
    expect(controller.state.history.redoCount).toBe(0);
    expect(controller.state.invalid).toBe(false);

    const { text } = await captureControllerFrame(controller);
    expect(text).toContain("Daily Challenger");
    expect(text).toContain(`Difficulty: ${controller.state.activeDifficulty}`);
    expect(text).toContain(`Daily: ${target}`);
  });

  test("month browsing opens the exact chosen future date", () => {
    const controller = createGameplayController();
    openDailyScreen(controller);

    controller.press("t");
    setBrowseMode(controller, "month");

    const now = new Date();
    const futureYear = now.getUTCFullYear() + 1;
    const target: DailyDateKey = `${futureYear.toString().padStart(4, "0")}-12-17` as DailyDateKey;
    const chosenDate = setDateExact(controller, target);

    controller.press("enter");
    expect(controller.state.screen).toBe("play");
    expect(controller.state.activeSessionType).toBe("daily");
    expect(controller.state.activeDailyDateKey).toBe(chosenDate);
    expect(controller.state.activeDailyDateKey).toBe(target);
  });

  test("year browsing opens the exact chosen future date", () => {
    const controller = createGameplayController();
    openDailyScreen(controller);

    controller.press("t");
    setBrowseMode(controller, "year");

    const now = new Date();
    const targetYear = now.getUTCFullYear() + 3;

    const chosenDate = shiftUntil(
      controller,
      "right",
      (dateKey) => Number(dateKey.slice(0, 4)) === targetYear,
    );
    expect(Number(chosenDate.slice(0, 4))).toBe(targetYear);

    controller.press("enter");
    expect(controller.state.screen).toBe("play");
    expect(controller.state.activeSessionType).toBe("daily");
    expect(controller.state.activeDailyDateKey).toBe(chosenDate);
    expect(controller.state.activeDailyDateKey?.startsWith(`${targetYear}-`)).toBe(true);
  });

  test("date boundaries stay correct across month/year edges including leap-day handling", () => {
    const controller = createGameplayController();
    openDailyScreen(controller);

    expect(setDateExact(controller, "2027-12-31")).toBe("2027-12-31");
    controller.press("down");
    expect(selectedDateFromStatus(controller.state.status)).toBe("2028-01-01");

    expect(setDateExact(controller, "2028-02-28")).toBe("2028-02-28");
    controller.press("down");
    expect(selectedDateFromStatus(controller.state.status)).toBe("2028-02-29");
    controller.press("down");
    expect(selectedDateFromStatus(controller.state.status)).toBe("2028-03-01");

    expect(setDateExact(controller, "2027-02-28")).toBe("2027-02-28");
    controller.press("down");
    expect(selectedDateFromStatus(controller.state.status)).toBe("2027-03-01");

    const finalChosen = selectedDateFromStatus(controller.state.status);
    controller.press("enter");
    expect(controller.state.activeSessionType).toBe("daily");
    expect(controller.state.activeDailyDateKey).toBe(finalChosen);
  });

  test("month/year boundary browsing keeps exact chosen date stable on round-trip and handoff", async () => {
    const controller = createGameplayController();
    openDailyScreen(controller);

    expect(setDateExact(controller, "2028-01-31")).toBe("2028-01-31");
    setBrowseMode(controller, "month");
    controller.press("right");
    expect(selectedDateFromStatus(controller.state.status)).toBe("2028-02-29");
    controller.press("left");
    expect(selectedDateFromStatus(controller.state.status)).toBe("2028-01-31");

    expect(setDateExact(controller, "2028-02-29")).toBe("2028-02-29");
    setBrowseMode(controller, "year");
    controller.press("right");
    expect(selectedDateFromStatus(controller.state.status)).toBe("2029-02-28");
    controller.press("left");
    const finalChosen = selectedDateFromStatus(controller.state.status);
    expect(finalChosen).toBe("2028-02-29");

    controller.press("enter");
    expect(controller.state.screen).toBe("play");
    expect(controller.state.activeSessionType).toBe("daily");
    expect(controller.state.activeDailyDateKey).toBe(finalChosen);
    expect(controller.state.status).toContain(`Daily ${finalChosen}`);
    expect(controller.state.status).toContain(`(${controller.state.activeDifficulty})`);

    const { text } = await captureControllerFrame(controller);
    expect(text).toContain(`Daily: ${finalChosen}`);
    expect(text).toContain(`Difficulty: ${controller.state.activeDifficulty}`);
  });
});
