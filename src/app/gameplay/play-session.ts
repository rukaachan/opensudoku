import {
  isClearKey,
  isDigitKey,
  getConflictType,
  type CandidateDisplayMode,
} from "./gameplay-model";
import { Selection } from "../../domain/board";
import { requestHint } from "../puzzle-tools";
import { applyChallengeExpiry, enableChallengeCountdown } from "./session-timer";
import type { GameplayState } from "./gameplay-state";
export interface PlaySessionHandlers {
  goRoot: () => void;
  goRootToPlayFocus: () => void;
  queueFeedback: (feedback: "fail" | "success" | "complete") => void;
  refreshBoardFlags: () => void;
  registerStrike: (reason: string) => void;
  maxStrikes: number;
  nowMs: number;
}
function applySelectionIntent(state: GameplayState): void {
  const selected = state.board.getCell(state.selection.row, state.selection.col);
  if (selected.value !== 0) {
    state.activeNumber = selected.value;
  }
}
function moveSelection(state: GameplayState, direction: "up" | "down" | "left" | "right"): void {
  const beforeRow = state.selection.row;
  const beforeCol = state.selection.col;
  if (direction === "up") state.selection = state.selection.moveUp();
  if (direction === "down") state.selection = state.selection.moveDown();
  if (direction === "left") state.selection = state.selection.moveLeft();
  if (direction === "right") state.selection = state.selection.moveRight();
  if (state.selection.row === beforeRow && state.selection.col === beforeCol) return;
  applySelectionIntent(state);
}
function nextCandidateDisplayMode(mode: CandidateDisplayMode): CandidateDisplayMode {
  return mode === "minimal" ? "count" : mode === "count" ? "full" : "minimal";
}
export function handlePlayKey(
  state: GameplayState,
  key: string,
  handlers: PlaySessionHandlers,
): void {
  if (key === "escape" || key === "q") return void handlers.goRootToPlayFocus();
  if (key === "up" || key === "w") return void moveSelection(state, "up");
  if (key === "down" || key === "s") return void moveSelection(state, "down");
  if (key === "left" || key === "a") return void moveSelection(state, "left");
  if (key === "right" || key === "d") return void moveSelection(state, "right");
  if (key === "n") {
    if (state.runLocked) {
      state.notesMode = !state.notesMode;
      return;
    }
    state.notesMode = !state.notesMode;
    state.status = state.notesMode ? "Notes mode enabled." : "Notes mode disabled.";
    return;
  }
  if (key === "v") {
    state.candidateDisplayMode = nextCandidateDisplayMode(state.candidateDisplayMode);
    state.status = `Candidate view: ${state.candidateDisplayMode} (visual only).`;
    return;
  }
  if (key === "h") {
    const hint = state.lastHint;
    if (hint) {
      const hintGuidanceActive =
        state.selection.row === hint.row &&
        state.selection.col === hint.col &&
        state.activeNumber === hint.value;
      if (hintGuidanceActive) {
        state.activeNumber = null;
        state.hintPulseUntilMs = null;
        state.status = "Hint hidden. Press H to show again.";
      } else {
        state.selection = new Selection(hint.row, hint.col);
        state.activeNumber = hint.value;
        state.hintPulseUntilMs = handlers.nowMs + 1500;
        state.status = "Hint shown on board.";
      }
      handlers.queueFeedback("success");
      return;
    }
    if (state.remainingHints <= 0) {
      state.lastHint = null;
      state.status = "No hints left in this game.";
      state.hintPulseUntilMs = null;
      handlers.queueFeedback("fail");
      return;
    }
    const result = requestHint(state.board);
    state.lastHint = result.hint;
    if (result.hint) {
      state.remainingHints -= 1;
      state.usedHints = true;
      state.selection = new Selection(result.hint.row, result.hint.col);
      state.activeNumber = result.hint.value;
      state.hintPulseUntilMs = handlers.nowMs + 1500;
      state.status = "Hint shown on board.";
      handlers.queueFeedback("success");
    } else {
      state.activeNumber = null;
      state.hintPulseUntilMs = null;
      state.status =
        result.failure === "solved"
          ? "Puzzle already solved."
          : result.failure === "contradictory"
            ? "Puzzle has conflicts, so a hint is unavailable."
            : result.failure === "no_logical_hint"
              ? "No clear hint right now. Try another move first."
              : result.status;
      handlers.queueFeedback("fail");
    }
    return;
  }
  if (applyChallengeExpiry(state, handlers.nowMs)) {
    handlers.queueFeedback("fail");
    return;
  }
  if (state.runLocked) {
    if (isDigitKey(key) || isClearKey(key) || key === "u" || key === "r") {
      if (
        !state.challengeFailed &&
        !/(run locked|run stopped|run failed|time expired)/i.test(state.status)
      ) {
        state.status = `Strike ${handlers.maxStrikes}/${handlers.maxStrikes} — run locked. Press Esc, then Play to restart.`;
      }
      handlers.queueFeedback("fail");
    }
    return;
  }
  if (key === "t") {
    const challenge = enableChallengeCountdown(state, handlers.nowMs);
    state.status = challenge.status;
    return;
  }
  if (key === "u") {
    if (state.history.canUndo()) {
      state.history.undo(state.board);
      state.status = "Undo applied.";
      handlers.refreshBoardFlags();
    }
    return;
  }
  if (key === "r") {
    if (state.history.canRedo()) {
      state.history.redo(state.board);
      state.status = "Redo applied.";
      handlers.refreshBoardFlags();
    }
    return;
  }
  const row = state.selection.row;
  const col = state.selection.col;
  const cell = state.board.getCell(row, col);
  if (isDigitKey(key)) {
    state.activeNumber = Number(key);
    if (cell.isGiven) {
      handlers.registerStrike("Cell is locked (given).");
      handlers.queueFeedback("fail");
      state.activeNumber = null;
      state.hintPulseUntilMs = null;
      return;
    }
    if (state.notesMode) {
      if (cell.value !== 0) {
        state.status = "Notes can only be edited on empty editable cells.";
        handlers.queueFeedback("fail");
        state.activeNumber = null;
        state.hintPulseUntilMs = null;
        return;
      }
      const add = !cell.notes.includes(Number(key));
      const recorded = state.history.recordNote(state.board, row, col, Number(key), add);
      if (recorded) {
        state.usedNotes = true;
        state.status = add ? `Added note ${key}.` : `Removed note ${key}.`;
        handlers.refreshBoardFlags();
        handlers.queueFeedback("success");
      }
      return;
    }
    if (state.board.wouldConflict(row, col, Number(key))) {
      const type = getConflictType(state.board, row, col, Number(key));
      handlers.registerStrike(
        `${type[0].toUpperCase()}${type.slice(1)} conflict: ${key} cannot be placed here.`,
      );
      handlers.queueFeedback("fail");
      state.activeNumber = null;
      state.hintPulseUntilMs = null;
      return;
    }
    const recorded = state.history.record(state.board, { row, col, value: Number(key) });
    if (recorded) {
      state.lastHint = null;
      state.hintPulseUntilMs = null;
      state.status = `Placed ${key} at r${row + 1}c${col + 1}.`;
      handlers.refreshBoardFlags();
      handlers.queueFeedback(state.solved ? "complete" : "success");
    }
    return;
  }
  if (isClearKey(key)) {
    if (cell.isGiven) {
      handlers.registerStrike("Cell is locked (given).");
      handlers.queueFeedback("fail");
      return;
    }
    const recorded = state.history.recordClear(state.board, row, col);
    if (recorded) {
      state.lastHint = null;
      state.hintPulseUntilMs = null;
      state.status = `Cleared r${row + 1}c${col + 1}.`;
      handlers.refreshBoardFlags();
      handlers.queueFeedback("success");
    }
  }
}
