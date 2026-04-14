import { RGBA, TextAttributes } from "@opentui/core";
import type { GameplayViewModel } from "../app/gameplay";
import {
  getGeneratorLines,
  getHelpLines,
  getProgressLines,
  getRootLines,
  getSolverLines,
} from "./shell-content";

const ROOT_TITLE_FG = RGBA.fromHex("#facc15");
const ROOT_FOCUS_FG = RGBA.fromHex("#111827");
const ROOT_FOCUS_BG = RGBA.fromHex("#facc15");
const ROOT_NORMAL_FG = RGBA.fromHex("#e5e7eb");
const ROOT_ACTION_START_ROW = 1;

export function mountRootScreen(options: {
  viewModel: GameplayViewModel;
  viewportWidth: number;
  top: number;
  mountLine: (
    content: unknown,
    top: number,
    style?: { fg?: RGBA; bg?: RGBA; attributes?: number; left?: number },
  ) => void;
  getCenterTop: (height: number) => number;
}): void {
  const { viewModel, viewportWidth, top, mountLine, getCenterTop } = options;
  const lines = getRootLines(viewModel);
  const left = Math.max(
    0,
    Math.floor((viewportWidth - Math.max(...lines.map((line) => line.length))) / 2),
  );
  const centeredTop = top + getCenterTop(lines.length);
  lines.forEach((line, index) => {
    if (index === 0) {
      mountLine(line, centeredTop + index, {
        left,
        fg: ROOT_TITLE_FG,
        attributes: TextAttributes.BOLD,
      });
      return;
    }
    const isFocused =
      index >= ROOT_ACTION_START_ROW &&
      index < ROOT_ACTION_START_ROW + viewModel.rootActions.length &&
      index - ROOT_ACTION_START_ROW === viewModel.rootFocusIndex;
    if (isFocused) {
      mountLine(line, centeredTop + index, {
        left,
        fg: ROOT_FOCUS_FG,
        bg: ROOT_FOCUS_BG,
        attributes: TextAttributes.BOLD,
      });
      return;
    }
    mountLine(line, centeredTop + index, { left, fg: ROOT_NORMAL_FG });
  });
}

export function mountCenteredLines(options: {
  viewModel: GameplayViewModel;
  viewportWidth: number;
  top: number;
  mountLine: (
    content: unknown,
    top: number,
    style?: { fg?: RGBA; bg?: RGBA; attributes?: number; left?: number },
  ) => void;
  getCenterTop: (height: number) => number;
  screen: "generator" | "solver" | "progress" | "help";
  toDisplayText: (value: unknown) => string;
}): void {
  const { viewModel, viewportWidth, top, mountLine, getCenterTop, screen, toDisplayText } = options;
  const lines = (
    screen === "generator"
      ? getGeneratorLines(toDisplayText(viewModel.status))
      : screen === "solver"
        ? getSolverLines(toDisplayText(viewModel.status))
        : screen === "progress"
          ? getProgressLines(viewModel)
          : getHelpLines()
  ).map(toDisplayText);
  const left = Math.max(
    0,
    Math.floor((viewportWidth - Math.max(...lines.map((line) => line.length))) / 2),
  );
  const centeredTop = top + getCenterTop(lines.length);
  lines.forEach((line, index) =>
    mountLine(line, centeredTop + index, { left, fg: ROOT_NORMAL_FG }),
  );
}
