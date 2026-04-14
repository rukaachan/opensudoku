import { getTodayDailyDateKey } from "../daily/daily-browser";
import { buildDailyCalendarMonthView } from "../daily/daily-calendar-view";
import { buildBoardRows, ROOT_ACTIONS, type GameplayViewModel } from "./gameplay-model";
import type { GameplayState } from "./gameplay-state";
import {
  formatClock,
  getChallengeRemainingSeconds,
  getSessionClockText,
  isSessionTimerRunning,
} from "./session-timer";

export function buildGameplayViewModel(options: {
  state: GameplayState;
  nowMs: number;
  todayDateKey: () => ReturnType<typeof getTodayDailyDateKey>;
  ensureHydratedScope: (nowMs: number) => void;
}): GameplayViewModel {
  const { state, nowMs } = options;
  const selectedCell = state.board.getCell(state.selection.row, state.selection.col);
  const hintFocused =
    state.lastHint !== null &&
    state.selection.row === state.lastHint.row &&
    state.selection.col === state.lastHint.col &&
    state.activeNumber === state.lastHint.value;
  const hintPulseVisible =
    hintFocused &&
    state.hintPulseUntilMs !== null &&
    nowMs < state.hintPulseUntilMs &&
    Math.floor(nowMs / 250) % 2 === 0;
  const activeNumber = hintFocused
    ? null
    : selectedCell.value !== 0
      ? selectedCell.value
      : state.activeNumber;
  options.ensureHydratedScope(nowMs);
  return {
    screen: state.screen,
    rootActions: ROOT_ACTIONS,
    rootFocusIndex: state.rootFocusIndex,
    boardRows: buildBoardRows(state.board, state.selection, activeNumber),
    selection: state.selection,
    notesMode: state.notesMode,
    candidateDisplayMode: state.candidateDisplayMode,
    status: state.status,
    solved: state.solved,
    invalid: state.invalid,
    activeDifficulty: state.activeDifficulty,
    activeSessionType: state.activeSessionType,
    activeSessionId: state.activeSessionId,
    activeDailyDateKey: state.activeDailyDateKey,
    dailyBrowseMode: state.dailyBrowseMode,
    dailySelectedDateKey: state.dailySelectedDateKey,
    dailyCalendarMonth:
      state.dailyBrowseMode === "month"
        ? buildDailyCalendarMonthView(
            state.dailySelectedDateKey,
            state.dailyCompletedDateKeys,
            options.todayDateKey(),
          )
        : null,
    lastHint: state.lastHint,
    remainingHints: state.remainingHints,
    activeNumber,
    hintPulseVisible,
    sessionTimerRunning: isSessionTimerRunning(state),
    sessionTimerMode: state.sessionTimerMode,
    sessionTimerText: getSessionClockText(state, nowMs),
    challengeRemainingSeconds: getChallengeRemainingSeconds(state, nowMs),
    challengeFailed: state.challengeFailed,
    bestTimeText:
      state.bestTimeMs === null ? null : formatClock(Math.floor(state.bestTimeMs / 1_000)),
    dailyStreakCount: state.dailyStreakCount,
    progressSummary: state.progressSummary,
  };
}
