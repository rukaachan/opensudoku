import { resolveBestTimeScope } from "./best-time-store";
import type { GameplayPersistence } from "./gameplay-persistence";
import type { GameplayState } from "./gameplay-state";
import { freezeSessionTimer, getSessionElapsedMs } from "./session-timer";

export function refreshBoardFlags(
  state: GameplayState,
  deps: {
    now: () => number;
    persistence: GameplayPersistence;
    hydrateProgressSummary: (nowMs: number) => void;
  },
): void {
  const wasSolved = state.solved;
  state.invalid = state.board.hasContradiction();
  state.solved = state.board.isSolved() && !state.invalid;
  if (state.invalid) {
    state.status = "Invalid board: contradictory state detected.";
    return;
  }
  if (!state.solved) return;

  const solvedAtMs = deps.now();
  freezeSessionTimer(state, solvedAtMs);
  if (!wasSolved) {
    if (deps.persistence.hasCompletedSession(state.activeSessionId)) {
      state.bestTimeMs = deps.persistence.readBestTimeMs(resolveBestTimeScope(state));
    } else {
      const creditedDailyDateKey =
        state.activeSessionType === "daily"
          ? deps.persistence.recordDailyCompletionByTimestamp(solvedAtMs)
          : null;
      const eligibleDailyCredit =
        state.activeSessionType !== "daily" ||
        !state.activeDailyDateKey ||
        (creditedDailyDateKey !== null && state.activeDailyDateKey <= creditedDailyDateKey);
      state.bestTimeMs = eligibleDailyCredit
        ? deps.persistence.recordBestTimeMs(
            resolveBestTimeScope(state),
            getSessionElapsedMs(state, solvedAtMs),
          )
        : deps.persistence.readBestTimeMs(resolveBestTimeScope(state));
      const dailyProgressDateKey = eligibleDailyCredit ? creditedDailyDateKey : null;
      if (state.activeSessionType === "daily" && creditedDailyDateKey && eligibleDailyCredit) {
        deps.persistence.recordDailyCompletion(creditedDailyDateKey, solvedAtMs);
      }
      deps.persistence.recordSolveProgress({
        sessionId: state.activeSessionId,
        sessionType: state.activeSessionType ?? "normal",
        generatedDifficulty:
          state.activeSessionType === "generated" ? state.activeDifficulty : null,
        creditedDailyDateKey: dailyProgressDateKey,
        assisted: state.usedHints || state.usedNotes,
        challengeWin: state.sessionTimerMode === "challenge" && !state.challengeFailed,
      });
    }
  }

  state.dailyStreakCount = deps.persistence.getDailyStreakCount(solvedAtMs);
  deps.hydrateProgressSummary(solvedAtMs);
  state.status = "Solved! Puzzle complete.";
}
