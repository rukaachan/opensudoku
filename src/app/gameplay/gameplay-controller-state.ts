import { History, Selection, parseBoard, type Board } from "../../domain/board";
import { getTodayDailyDateKey } from "../daily/daily-browser";
import { DEFAULT_PUZZLE } from "./gameplay-model";
import type { GameplayState } from "./gameplay-state";

export const MAX_STRIKES = 3;
export const MAX_HINTS_PER_SESSION = 2;

export function createInitialGameplayState(options: {
  board?: Board;
  now: () => number;
  bestTimeStorePath: string;
  dailyCompletionStorePath: string;
}): GameplayState {
  const baseBoard = options.board ? options.board.clone() : parseBoard(DEFAULT_PUZZLE);
  const todayDateKey = getTodayDailyDateKey(new Date(options.now()));
  return {
    screen: "root",
    rootFocusIndex: 0,
    board: baseBoard.clone(),
    history: new History(),
    selection: new Selection(0, 0),
    notesMode: false,
    candidateDisplayMode: "minimal",
    status: "Use arrows/WASD + Enter to choose.",
    solved: false,
    invalid: baseBoard.hasContradiction(),
    activeDifficulty: null,
    activeSessionType: null,
    activeSessionId: null,
    activeDailyDateKey: null,
    dailyBrowseMode: "month",
    dailySelectedDateKey: todayDateKey,
    dailyBrowseAnchorDay: Number(todayDateKey.slice(8, 10)),
    lastHint: null,
    remainingHints: MAX_HINTS_PER_SESSION,
    activeNumber: null,
    hintPulseUntilMs: null,
    strikeCount: 0,
    runLocked: false,
    sessionStartedAtMs: null,
    sessionStoppedAtMs: null,
    sessionTimerMode: "stopwatch",
    challengeTotalSeconds: null,
    challengeFailed: false,
    usedHints: false,
    usedNotes: false,
    bestTimeMs: null,
    bestTimeStorePath: options.bestTimeStorePath,
    dailyCompletionStorePath: options.dailyCompletionStorePath,
    dailyStreakCount: 0,
    dailyCompletedDateKeys: [],
    progressSummary: null,
  };
}

export function getDateKeyDayOfMonth(dateKey: string): number {
  return Number(dateKey.slice(8, 10));
}
