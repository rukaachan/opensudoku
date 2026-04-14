import { ROOT_ACTIONS, clamp } from "./gameplay-model";
import type { GameplayState } from "./gameplay-state";

export interface RootKeyHandlers {
  startPlay: () => void;
  startDailyBrowse: () => void;
  startProgressScreen: () => void;
  openMenuScreen: () => void;
}

export function handleRootScreenKey(
  state: GameplayState,
  key: string,
  handlers: RootKeyHandlers,
): "continue" | "quit-app" {
  if (key === "up" || key === "w") {
    state.rootFocusIndex = clamp(state.rootFocusIndex - 1, 0, ROOT_ACTIONS.length - 1);
    return "continue";
  }
  if (key === "down" || key === "s") {
    state.rootFocusIndex = clamp(state.rootFocusIndex + 1, 0, ROOT_ACTIONS.length - 1);
    return "continue";
  }

  const byHotkey = ROOT_ACTIONS.findIndex((action) => action.label[0].toLowerCase() === key);
  if (byHotkey >= 0) state.rootFocusIndex = byHotkey;
  if (key !== "enter" && key !== " " && byHotkey < 0) return "continue";

  const action = ROOT_ACTIONS[state.rootFocusIndex].id;
  if (action === "play") return (handlers.startPlay(), "continue");
  if (action === "daily") return (handlers.startDailyBrowse(), "continue");
  if (action === "progress") return (handlers.startProgressScreen(), "continue");
  if (action === "generator" || action === "solver" || action === "help")
    return (handlers.openMenuScreen(), "continue");
  return "quit-app";
}
