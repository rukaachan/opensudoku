import { boardToString } from "../../../src/domain/board";
import type { GameplayController } from "../../../src/app/gameplay";
import type { CapturedFrame } from "@opentui/core";
import { createOpenTUIHarness } from "../helpers";
import { mountGameplayScreen } from "../../../src/ui/shell";

export interface ControllerFrameCapture {
  frame: CapturedFrame;
  text: string;
}

export async function captureControllerFrame(
  controller: GameplayController,
): Promise<ControllerFrameCapture> {
  const harness = await createOpenTUIHarness({ width: 100, height: 30 });
  const mounted = mountGameplayScreen(harness.renderer, controller.getViewModel());
  try {
    await harness.renderOnce();
    return {
      frame: harness.captureSpans(),
      text: harness.captureCharFrame(),
    };
  } finally {
    mounted.cleanup();
    harness.cleanup();
  }
}

export interface SessionSnapshot {
  board: string;
  undo: number;
  redo: number;
  selectionRow: number;
  selectionCol: number;
  notesMode: boolean;
  activeDifficulty: string | null;
  solved: boolean;
  invalid: boolean;
  lastHint: string | null;
}

export function snapshotSession(controller: GameplayController): SessionSnapshot {
  const { state } = controller;
  return {
    board: boardToString(state.board),
    undo: state.history.undoCount,
    redo: state.history.redoCount,
    selectionRow: state.selection.row,
    selectionCol: state.selection.col,
    notesMode: state.notesMode,
    activeDifficulty: state.activeDifficulty,
    solved: state.solved,
    invalid: state.invalid,
    lastHint: state.lastHint
      ? `${state.lastHint.row}:${state.lastHint.col}:${state.lastHint.value}:${state.lastHint.type}`
      : null,
  };
}
