import type { DailyDateKey } from "../../domain/daily";
import { parseDailyDateKey } from "../../domain/daily";
import { shiftDailyDateKey } from "./daily-browser";
import { runDailyByDateKey, type GeneratedPuzzleResult } from "../puzzle-tools";
import type { GameplayState } from "../gameplay/gameplay-state";

export interface DailyBrowseHandlers {
  todayDateKey: () => DailyDateKey;
  goRoot: () => void;
  updateDailyStatus: () => void;
  applyGeneratedSession: (result: GeneratedPuzzleResult) => void;
}

export function handleDailyBrowseKey(
  state: GameplayState,
  key: string,
  handlers: DailyBrowseHandlers,
): void {
  const dayFromDateKey = (dateKey: DailyDateKey): number | null =>
    parseDailyDateKey(dateKey)?.getUTCDate() ?? null;

  if (key === "escape") return handlers.goRoot();
  if (key === "enter") {
    const selected = state.dailySelectedDateKey ?? handlers.todayDateKey();
    const result = runDailyByDateKey(selected);
    if ("board" in result) handlers.applyGeneratedSession(result);
    else state.status = result.status;
    return;
  }
  if (key === "t") {
    state.dailySelectedDateKey = handlers.todayDateKey();
    state.dailyBrowseAnchorDay = dayFromDateKey(state.dailySelectedDateKey);
    return handlers.updateDailyStatus();
  }
  if (key === "m") {
    state.dailyBrowseMode = "month";
    return handlers.updateDailyStatus();
  }
  if (key === "y") {
    state.dailyBrowseMode = "year";
    return handlers.updateDailyStatus();
  }

  const selected = state.dailySelectedDateKey ?? handlers.todayDateKey();
  const preferredDay = state.dailyBrowseAnchorDay ?? dayFromDateKey(selected);
  if (key === "up" || key === "w") {
    state.dailySelectedDateKey = shiftDailyDateKey(selected, "day", -1);
    state.dailyBrowseAnchorDay = dayFromDateKey(state.dailySelectedDateKey);
  } else if (key === "down" || key === "s") {
    state.dailySelectedDateKey = shiftDailyDateKey(selected, "day", 1);
    state.dailyBrowseAnchorDay = dayFromDateKey(state.dailySelectedDateKey);
  } else if (key === "left" || key === "a") {
    state.dailySelectedDateKey = shiftDailyDateKey(
      selected,
      state.dailyBrowseMode,
      -1,
      preferredDay ?? undefined,
    );
  } else if (key === "right" || key === "d") {
    state.dailySelectedDateKey = shiftDailyDateKey(
      selected,
      state.dailyBrowseMode,
      1,
      preferredDay ?? undefined,
    );
  } else return;
  handlers.updateDailyStatus();
}
