import { type GeneratedPuzzleResult, runGeneratorByKey, runSolverByKey } from "../puzzle-tools";
import { ROOT_ACTIONS } from "./gameplay-model";
import {
  finalizePressResult,
  getInputMutationSignature,
  type PressResult,
} from "./gameplay-input-signature";
import { handleRootScreenKey } from "./non-play-navigation";
import { handlePlayKey } from "./play-session";
import type { GameplayState } from "./gameplay-state";
import { handleDailyBrowseKey } from "../daily/daily-browse-keys";

export function handleGameplayPress(options: {
  state: GameplayState;
  key: string;
  now: () => number;
  todayDateKey: () => string;
  startPlay: () => void;
  startDailyBrowse: () => void;
  startProgressScreen: () => void;
  hydrateProgressSummary: (nowMs: number) => void;
  applyGeneratedSession: (result: GeneratedPuzzleResult) => void;
  updateDailyStatus: () => void;
  goRoot: () => void;
  goRootToPlayFocus: () => void;
  queueFeedback: (feedback: "fail" | "success" | "complete") => void;
  refreshBoardFlags: () => void;
  registerStrike: (reason: string) => void;
  maxStrikes: number;
}): PressResult {
  const beforeSignature = getInputMutationSignature(options.state);
  const normalized = options.key.toLowerCase();

  if (options.state.screen === "root") {
    return finalizePressResult(
      options.state,
      beforeSignature,
      handleRootScreenKey(options.state, normalized, {
        startPlay: options.startPlay,
        startDailyBrowse: options.startDailyBrowse,
        startProgressScreen: options.startProgressScreen,
        openMenuScreen: () => {
          const action = ROOT_ACTIONS[options.state.rootFocusIndex];
          if (
            action.id === "generator" ||
            action.id === "solver" ||
            action.id === "help" ||
            action.id === "progress"
          ) {
            options.state.screen = action.id;
            if (action.id === "progress") options.hydrateProgressSummary(options.now());
            options.state.status = `${action.label} screen.`;
          }
        },
      }),
    );
  }

  if (normalized === "q") return finalizePressResult(options.state, beforeSignature, "quit-app");

  if (options.state.screen === "help" || options.state.screen === "progress") {
    if (normalized === "escape" || normalized === "enter") options.goRoot();
    return finalizePressResult(options.state, beforeSignature, "continue");
  }

  if (options.state.screen === "daily") {
    handleDailyBrowseKey(options.state, normalized, {
      todayDateKey: options.todayDateKey,
      goRoot: options.goRoot,
      updateDailyStatus: options.updateDailyStatus,
      applyGeneratedSession: options.applyGeneratedSession,
    });
    return finalizePressResult(options.state, beforeSignature, "continue");
  }

  if (options.state.screen === "generator") {
    if (normalized === "escape" || normalized === "enter") {
      options.goRoot();
      return finalizePressResult(options.state, beforeSignature, "continue");
    }
    const result = runGeneratorByKey(normalized);
    if (result && "board" in result) options.applyGeneratedSession(result);
    else if (result) options.state.status = result.status;
    return finalizePressResult(options.state, beforeSignature, "continue");
  }

  if (options.state.screen === "solver") {
    if (normalized === "escape" || normalized === "enter") {
      options.goRoot();
      return finalizePressResult(options.state, beforeSignature, "continue");
    }
    const solverStatus = runSolverByKey(normalized, options.state.board);
    if (solverStatus) options.state.status = solverStatus;
    return finalizePressResult(options.state, beforeSignature, "continue");
  }

  handlePlayKey(options.state, normalized, {
    goRoot: options.goRoot,
    goRootToPlayFocus: options.goRootToPlayFocus,
    queueFeedback: options.queueFeedback,
    refreshBoardFlags: options.refreshBoardFlags,
    registerStrike: options.registerStrike,
    maxStrikes: options.maxStrikes,
    nowMs: options.now(),
  });

  return finalizePressResult(options.state, beforeSignature, "continue");
}
