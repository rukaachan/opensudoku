import { RGBA, TextAttributes, type CliRenderer, type TextRenderable } from "@opentui/core";
import type { CandidateDisplayMode, GameplayViewModel } from "../app/gameplay";
import {
  BOARD_START_ROW,
  CELL_WIDTH,
  GROUP_SEPARATOR_WIDTH,
  mountPlayBoard,
} from "./shell-play-board";

const ROOT_NORMAL_FG = RGBA.fromHex("#e5e7eb");
const ROOT_TITLE_FG = RGBA.fromHex("#facc15");
const PLAY_LABEL_FG = RGBA.fromHex("#fef08a");
const CANDIDATE_BADGE_FG = RGBA.fromHex("#22d3ee");
const CANDIDATE_BADGE_BG = RGBA.fromHex("#0f172a");

function formatCandidateModeBadge(mode: CandidateDisplayMode): string {
  if (mode === "minimal") return "MIN";
  if (mode === "count") return "CNT";
  return "FULL";
}

export function mountPlayScreen(options: {
  renderer: CliRenderer;
  viewModel: GameplayViewModel;
  top: number;
  mounted: TextRenderable[];
  mountLine: (
    content: unknown,
    top: number,
    style?: { fg?: RGBA; bg?: RGBA; attributes?: number; left?: number },
  ) => void;
  toDisplayText: (value: unknown) => string;
  getCenterAlignedLeft: (content: string) => number;
  getCenteredLeft: (contentWidth: number) => number;
}): void {
  const {
    renderer,
    viewModel,
    top,
    mounted,
    mountLine,
    toDisplayText,
    getCenterAlignedLeft,
    getCenteredLeft,
  } = options;
  const modeLine = `Mode: ${viewModel.notesMode ? "Notes" : "Values"} • Cand view: ${viewModel.candidateDisplayMode}`;
  const difficultyValue =
    viewModel.activeDifficulty === null ? "default" : toDisplayText(viewModel.activeDifficulty);
  const difficultyLine = `Difficulty: ${difficultyValue}`;
  const timerLabel = viewModel.sessionTimerMode === "challenge" ? "Challenge Timer" : "Timer";
  const timerLine = `${timerLabel}: ${viewModel.sessionTimerText}`;
  const bestLine = viewModel.bestTimeText ? `Best: ${viewModel.bestTimeText}` : null;
  const challengeLine =
    viewModel.sessionTimerMode === "challenge"
      ? `Challenge: ${viewModel.challengeFailed ? "FAILED" : "ACTIVE"}`
      : null;
  const dailyStreakLine =
    viewModel.activeSessionType === "daily" && viewModel.dailyStreakCount >= 3
      ? `Streak ${viewModel.dailyStreakCount}`
      : null;
  const dailyBannerLine =
    viewModel.activeSessionType === "daily"
      ? dailyStreakLine
        ? `★ Daily Challenger ★ ${dailyStreakLine}`
        : "★ Daily Challenger ★"
      : null;
  const dailyLine =
    viewModel.activeSessionType === "daily" && viewModel.activeDailyDateKey
      ? `Daily: ${toDisplayText(viewModel.activeDailyDateKey)}`
      : null;
  const selectionLine = `Selection: r${viewModel.selection.row + 1}c${viewModel.selection.col + 1}`;
  const statusLine = `Status: ${toDisplayText(viewModel.status)}`;
  const activeLine = `Active: ${viewModel.activeNumber ?? "-"}  Hints: ${viewModel.remainingHints}`;
  const hintLine = viewModel.lastHint
    ? `Hint: r${viewModel.lastHint.row + 1}c${viewModel.lastHint.col + 1}=${viewModel.lastHint.value} (${viewModel.lastHint.type})`
    : null;
  const stateLine = viewModel.invalid
    ? "State: INVALID"
    : viewModel.solved
      ? "State: SOLVED"
      : null;
  const headerLines = [
    "OpenSudoku Play",
    "Move: WASD/arrows, 1-9, Backspace/Delete clear",
    "N notes, V cand-view, H hint, U/R undo-redo, T challenge, Esc root, q quit",
  ];
  const left = getCenteredLeft(33);
  const candidateBadge = `[CAND ${formatCandidateModeBadge(viewModel.candidateDisplayMode)}]`;
  const badgeLeft = left + 9 * CELL_WIDTH + 2 * GROUP_SEPARATOR_WIDTH - candidateBadge.length;
  const infoStartRow = BOARD_START_ROW + 13;
  const badgeRow = infoStartRow - 1;
  const modeRow = infoStartRow;
  const difficultyRow = modeRow + 1;
  const timerRow = difficultyRow + 1;
  const challengeRow = challengeLine ? timerRow + 1 : null;
  const bestRow = bestLine ? (challengeRow ?? timerRow) + 1 : null;
  const dailyBannerRow = dailyBannerLine ? (bestRow ?? challengeRow ?? timerRow) + 1 : null;
  const dailyRow = dailyLine ? (dailyBannerRow ?? bestRow ?? challengeRow ?? timerRow) + 1 : null;
  const selectionRow = (dailyRow ?? dailyBannerRow ?? bestRow ?? challengeRow ?? timerRow) + 1;
  const statusRow = selectionRow + 1;
  const activeRow = statusRow + 1;
  const hintRow = hintLine ? activeRow + 1 : null;
  const stateRow = stateLine ? (hintRow ?? activeRow) + 1 : null;

  mountLine(headerLines[0], top, {
    left: getCenterAlignedLeft(headerLines[0]),
    fg: ROOT_TITLE_FG,
    attributes: TextAttributes.BOLD,
  });
  mountLine(headerLines[1], top + 1, {
    left: getCenterAlignedLeft(headerLines[1]),
    fg: ROOT_NORMAL_FG,
  });
  mountLine(headerLines[2], top + 2, {
    left: getCenterAlignedLeft(headerLines[2]),
    fg: ROOT_NORMAL_FG,
  });
  mountLine(candidateBadge, top + badgeRow, {
    left: badgeLeft,
    fg: CANDIDATE_BADGE_FG,
    bg: CANDIDATE_BADGE_BG,
    attributes: TextAttributes.BOLD,
  });

  mountPlayBoard({ renderer, viewModel, top, left, mounted, mountLine });

  mountLine(modeLine, top + modeRow, {
    left: getCenterAlignedLeft(modeLine),
    fg: PLAY_LABEL_FG,
    attributes: TextAttributes.BOLD,
  });
  mountLine(difficultyLine, top + difficultyRow, {
    left: getCenterAlignedLeft(difficultyLine),
    fg: PLAY_LABEL_FG,
    attributes: TextAttributes.BOLD,
  });
  mountLine(timerLine, top + timerRow, {
    left: getCenterAlignedLeft(timerLine),
    fg: PLAY_LABEL_FG,
    attributes: TextAttributes.BOLD,
  });
  if (challengeLine && challengeRow !== null) {
    mountLine(challengeLine, top + challengeRow, {
      left: getCenterAlignedLeft(challengeLine),
      fg: viewModel.challengeFailed ? RGBA.fromHex("#f87171") : PLAY_LABEL_FG,
      attributes: TextAttributes.BOLD,
    });
  }
  if (bestLine && bestRow !== null) {
    mountLine(bestLine, top + bestRow, {
      left: getCenterAlignedLeft(bestLine),
      fg: PLAY_LABEL_FG,
      attributes: TextAttributes.BOLD,
    });
  }
  if (dailyBannerLine && dailyBannerRow !== null) {
    mountLine(dailyBannerLine, top + dailyBannerRow, {
      left: getCenterAlignedLeft(dailyBannerLine),
      fg: ROOT_NORMAL_FG,
      attributes: TextAttributes.BOLD,
    });
  }
  if (dailyLine && dailyRow !== null) {
    mountLine(dailyLine, top + dailyRow, {
      left: getCenterAlignedLeft(dailyLine),
      fg: PLAY_LABEL_FG,
      attributes: TextAttributes.BOLD,
    });
  }
  mountLine(selectionLine, top + selectionRow, {
    left: getCenterAlignedLeft(selectionLine),
    fg: PLAY_LABEL_FG,
    attributes: TextAttributes.BOLD,
  });
  mountLine(statusLine, top + statusRow, {
    left: getCenterAlignedLeft(statusLine),
    fg: PLAY_LABEL_FG,
    attributes: TextAttributes.BOLD,
  });
  mountLine(activeLine, top + activeRow, {
    left: getCenterAlignedLeft(activeLine),
    fg: ROOT_NORMAL_FG,
    attributes: TextAttributes.BOLD,
  });
  if (hintLine && hintRow !== null)
    mountLine(hintLine, top + hintRow, {
      left: getCenterAlignedLeft(hintLine),
      fg: ROOT_NORMAL_FG,
    });
  if (stateLine && stateRow !== null) {
    mountLine(stateLine, top + stateRow, {
      left: getCenterAlignedLeft(stateLine),
      fg: viewModel.invalid ? RGBA.fromHex("#f87171") : RGBA.fromHex("#86efac"),
      attributes: TextAttributes.BOLD,
    });
  }
}
