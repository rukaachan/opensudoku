import type { GameplayState } from "./gameplay-state";

export type PressResult = "continue" | "noop" | "quit-app";

export function getInputMutationSignature(state: GameplayState): string {
  const hint = state.lastHint
    ? `${state.lastHint.row}:${state.lastHint.col}:${state.lastHint.value}:${state.lastHint.type}`
    : "-";
  const dailyKeys = state.dailyCompletedDateKeys.join(",");
  return [
    state.screen,
    state.rootFocusIndex,
    state.selection.row,
    state.selection.col,
    state.notesMode ? 1 : 0,
    state.status,
    state.solved ? 1 : 0,
    state.invalid ? 1 : 0,
    state.activeDifficulty ?? "-",
    state.activeSessionType ?? "-",
    state.activeSessionId ?? "-",
    state.activeDailyDateKey ?? "-",
    state.dailyBrowseMode,
    state.dailySelectedDateKey ?? "-",
    hint,
    state.remainingHints,
    state.activeNumber ?? "-",
    state.strikeCount,
    state.runLocked ? 1 : 0,
    state.sessionStartedAtMs ?? -1,
    state.sessionStoppedAtMs ?? -1,
    state.sessionTimerMode,
    state.challengeTotalSeconds ?? -1,
    state.challengeFailed ? 1 : 0,
    state.bestTimeMs ?? -1,
    state.dailyStreakCount,
    dailyKeys,
    state.history.undoCount,
    state.history.redoCount,
  ].join("|");
}

export function finalizePressResult(
  state: GameplayState,
  beforeSignature: string,
  result: "continue" | "quit-app",
): PressResult {
  if (result === "quit-app") return "quit-app";
  return getInputMutationSignature(state) === beforeSignature ? "noop" : "continue";
}
