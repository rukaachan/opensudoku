import { History, Selection, parseBoard, type Board } from "../../domain/board";
import { getTodayDailyDateKey } from "../daily/daily-browser";
import { resolveBestTimeScope, resolveBestTimeStorePath } from "./best-time-store";
import { resolveDailyCompletionStorePath } from "../daily/daily-completion-store";
import { resolveProgressionStorePath } from "../progression/progression-store";
import { type GeneratedPuzzleResult } from "../puzzle-tools";
import { DEFAULT_PUZZLE, type GameplayViewModel } from "./gameplay-model";
import { createGameplayPersistence, type GameplayPersistence } from "./gameplay-persistence";
import { type PressResult } from "./gameplay-input-signature";
import {
  createInitialGameplayState,
  getDateKeyDayOfMonth,
  MAX_HINTS_PER_SESSION,
  MAX_STRIKES,
} from "./gameplay-controller-state";
import { refreshBoardFlags } from "./gameplay-controller-solve";
import { buildGameplayViewModel } from "./gameplay-controller-view-model";
import { handleGameplayPress } from "./gameplay-controller-press";
import type { GameplayState } from "./gameplay-state";
import { applyChallengeExpiry, getSessionClockText, startSessionTimer } from "./session-timer";

export interface GameplayController {
  readonly state: GameplayState;
  press(key: string): PressResult;
  tick(): boolean;
  consumeTerminalFeedback(): "fail" | "success" | "complete" | null;
  getViewModel(): GameplayViewModel;
}

export function createGameplayController(options?: {
  board?: Board;
  now?: () => number;
  bestTimeDataRoot?: string;
  persistence?: GameplayPersistence;
}): GameplayController {
  const now = options?.now ?? Date.now;
  const todayDateKey = (): ReturnType<typeof getTodayDailyDateKey> =>
    getTodayDailyDateKey(new Date(now()));
  const bestTimeStorePath = resolveBestTimeStorePath(options?.bestTimeDataRoot);
  const dailyCompletionStorePath = resolveDailyCompletionStorePath(options?.bestTimeDataRoot);
  const progressionStorePath = resolveProgressionStorePath(options?.bestTimeDataRoot);
  const persistence =
    options?.persistence ??
    createGameplayPersistence(bestTimeStorePath, dailyCompletionStorePath, progressionStorePath);
  const baseBoard = options?.board ? options.board.clone() : parseBoard(DEFAULT_PUZZLE);
  const state = createInitialGameplayState({
    board: options?.board,
    now,
    bestTimeStorePath,
    dailyCompletionStorePath,
  });

  let pendingFeedback: "fail" | "success" | "complete" | null = null;
  let lastTickClockText: string | null = null;
  let lastTickHintPulseSuppressed = false;
  let hydratedBestTimeScope: ReturnType<typeof resolveBestTimeScope> | null = null;

  const queueFeedback = (feedback: "fail" | "success" | "complete"): void => {
    pendingFeedback = feedback;
  };
  const hydratePersistedSessionStats = (nowMs: number): void => {
    hydratedBestTimeScope = resolveBestTimeScope(state);
    state.bestTimeMs = persistence.readBestTimeMs(hydratedBestTimeScope);
    state.dailyStreakCount = persistence.getDailyStreakCount(nowMs);
  };
  const ensureHydratedScope = (nowMs: number): void => {
    const scope = resolveBestTimeScope(state);
    if (scope === hydratedBestTimeScope) return;
    hydratedBestTimeScope = scope;
    state.bestTimeMs = persistence.readBestTimeMs(scope);
    state.dailyStreakCount = persistence.getDailyStreakCount(nowMs);
  };
  const hydrateDailyBrowseState = (): void => {
    state.dailyCompletedDateKeys = persistence.listCompletedDailyDateKeys();
  };
  const hydrateProgressSummary = (nowMs: number): void => {
    state.progressSummary = persistence.readProgressSummary(nowMs);
  };
  const resetTransientSessionState = (): void => {
    state.history = new History();
    state.selection = new Selection(0, 0);
    state.notesMode = false;
    state.candidateDisplayMode = "minimal";
    state.lastHint = null;
    state.remainingHints = MAX_HINTS_PER_SESSION;
    state.activeNumber = null;
    state.hintPulseUntilMs = null;
    state.strikeCount = 0;
    state.runLocked = false;
    state.challengeFailed = false;
    state.usedHints = false;
    state.usedNotes = false;
  };

  const updateDailyStatus = (): void => {
    const selected = state.dailySelectedDateKey ?? todayDateKey();
    state.dailySelectedDateKey = selected;
    state.dailyBrowseAnchorDay = state.dailyBrowseAnchorDay ?? getDateKeyDayOfMonth(selected);
    state.status = `Daily ${selected} • ${state.dailyBrowseMode} view.`;
  };
  const startPlay = (): void => {
    state.screen = "play";
    state.board = baseBoard.clone();
    resetTransientSessionState();
    state.activeDifficulty = null;
    state.activeSessionType = null;
    state.activeSessionId = `normal:${now()}`;
    state.activeDailyDateKey = null;
    state.status = "Play ready. Start entering values.";
    const nowMs = now();
    startSessionTimer(state, nowMs);
    lastTickClockText = getSessionClockText(state, nowMs);
    hydratePersistedSessionStats(nowMs);
    refreshBoardFlags(state, { now, persistence, hydrateProgressSummary });
  };
  const startDailyBrowse = (): void => {
    state.screen = "daily";
    state.dailyBrowseMode = "month";
    state.dailySelectedDateKey = state.dailySelectedDateKey ?? todayDateKey();
    state.dailyBrowseAnchorDay = state.dailySelectedDateKey
      ? getDateKeyDayOfMonth(state.dailySelectedDateKey)
      : getDateKeyDayOfMonth(todayDateKey());
    hydrateDailyBrowseState();
    updateDailyStatus();
  };
  const startProgressScreen = (): void => {
    state.screen = "progress";
    state.status = "Progress ready. Showing local stats.";
    hydrateProgressSummary(now());
  };
  const applyGeneratedSession = (result: GeneratedPuzzleResult): void => {
    state.screen = "play";
    state.board = result.board;
    resetTransientSessionState();
    state.activeDifficulty = result.difficulty;
    state.activeSessionType = result.sessionType;
    state.activeSessionId = result.sessionId;
    state.activeDailyDateKey = result.dailyDateKey;
    state.solved = false;
    state.invalid = state.board.hasContradiction();
    state.status = result.status;
    const nowMs = now();
    startSessionTimer(state, nowMs);
    lastTickClockText = getSessionClockText(state, nowMs);
    hydratePersistedSessionStats(nowMs);
  };
  const goRoot = (): void => {
    state.screen = "root";
    state.status = "Use arrows/WASD + Enter to choose.";
    lastTickClockText = null;
  };
  const goRootToPlayFocus = (): void => {
    goRoot();
    state.rootFocusIndex = 0;
  };
  const registerStrike = (reason: string): void => {
    state.strikeCount += 1;
    if (state.strikeCount >= MAX_STRIKES) {
      state.runLocked = true;
      state.status = `Strike ${MAX_STRIKES}/${MAX_STRIKES} — run locked. Press Esc, then Play to restart.`;
      return;
    }
    state.status = `Strike ${state.strikeCount}/${MAX_STRIKES}. ${reason}`;
  };

  return {
    state,
    press(key: string): PressResult {
      return handleGameplayPress({
        state,
        key,
        now,
        todayDateKey,
        startPlay,
        startDailyBrowse,
        startProgressScreen,
        hydrateProgressSummary,
        applyGeneratedSession,
        updateDailyStatus,
        goRoot,
        goRootToPlayFocus,
        queueFeedback,
        refreshBoardFlags: () =>
          refreshBoardFlags(state, { now, persistence, hydrateProgressSummary }),
        registerStrike,
        maxStrikes: MAX_STRIKES,
      });
    },
    tick(): boolean {
      if (state.screen !== "play") {
        lastTickClockText = null;
        lastTickHintPulseSuppressed = false;
        return false;
      }
      const nowMs = now();
      if (applyChallengeExpiry(state, nowMs)) {
        queueFeedback("fail");
        lastTickClockText = getSessionClockText(state, nowMs);
        return true;
      }
      const currentClockText = getSessionClockText(state, nowMs);
      const hasVisibleClockChange = currentClockText !== lastTickClockText;
      lastTickClockText = currentClockText;
      const hintPulseSuppressed =
        state.hintPulseUntilMs !== null &&
        nowMs < state.hintPulseUntilMs &&
        Math.floor(nowMs / 250) % 2 === 1;
      const hasPulseVisibilityChange = hintPulseSuppressed !== lastTickHintPulseSuppressed;
      lastTickHintPulseSuppressed = hintPulseSuppressed;
      return hasVisibleClockChange || hasPulseVisibilityChange;
    },
    consumeTerminalFeedback(): "fail" | "success" | "complete" | null {
      const feedback = pendingFeedback;
      pendingFeedback = null;
      return feedback;
    },
    getViewModel(): GameplayViewModel {
      return buildGameplayViewModel({ state, nowMs: now(), todayDateKey, ensureHydratedScope });
    },
  };
}
