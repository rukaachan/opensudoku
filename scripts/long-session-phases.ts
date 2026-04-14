import { boardToString, parseBoard } from "../src/domain/board";
import { createGameplayController } from "../src/app/gameplay";
import type { GameplayPersistence } from "../src/app/gameplay-persistence";

export type KeyStep = { atMs: number; key: string };
export type Sample = {
  elapsedMs: number;
  sampledPid: number;
  timestamp: string;
  cpuMs: number;
  privateBytes: number;
  workingSetBytes: number;
};

export type LivePhase = {
  phase: string;
  pid: number;
  generatedAt: string;
  exitCode: number;
  responsive: boolean;
  sampleCount: number;
  privateMemoryDeltaMb: number;
  samples: Sample[];
  stdoutTail: string;
  stderrTail: string;
};

export const toMb = (bytes: number): number => Number((bytes / 1024 / 1024).toFixed(3));
export const deltaMb = (aBytes: number, bBytes: number): number =>
  Number(toMb(bBytes - aBytes).toFixed(3));
export const bandMb = (samples: Sample[]): number =>
  Number(
    toMb(
      Math.max(...samples.map((s) => s.privateBytes)) -
        Math.min(...samples.map((s) => s.privateBytes)),
    ).toFixed(3),
  );

export function buildDeepUndoRedoTrace(emptyBoard: string) {
  const controller = createGameplayController({ board: parseBoard(emptyBoard) });
  controller.press("p");
  controller.press("n");
  for (let i = 0; i < 300; i += 1) controller.press(i % 2 === 0 ? "1" : "2");
  const start = `${boardToString(parseBoard(emptyBoard))}|r1c1=[]|undo=0|redo=0`;
  const endCell = controller.state.board.getCell(0, 0);
  const end = `${boardToString(controller.state.board)}|r1c1=[${endCell.notes.join(",")}]|undo=${controller.state.history.undoCount}|redo=${controller.state.history.redoCount}`;
  const endBoard = boardToString(controller.state.board);
  const trace: Array<{ step: string; undo: number; redo: number; snapshot: string }> = [
    {
      step: "accepted-end",
      undo: controller.state.history.undoCount,
      redo: controller.state.history.redoCount,
      snapshot: end,
    },
  ];
  let undoReachedStart = false;
  let redoReachedEnd = false;

  while (controller.state.history.canUndo()) {
    controller.press("u");
    if (controller.state.history.undoCount % 50 === 0 || controller.state.history.undoCount === 0) {
      const c = controller.state.board.getCell(0, 0);
      trace.push({
        step: `undo-${trace.length}`,
        undo: controller.state.history.undoCount,
        redo: controller.state.history.redoCount,
        snapshot: `${boardToString(controller.state.board)}|r1c1=[${c.notes.join(",")}]`,
      });
    }
    undoReachedStart ||=
      boardToString(controller.state.board) === emptyBoard &&
      controller.state.history.undoCount === 0;
  }

  while (controller.state.history.canRedo()) {
    controller.press("r");
    if (controller.state.history.redoCount % 50 === 0 || controller.state.history.redoCount === 0) {
      const c = controller.state.board.getCell(0, 0);
      trace.push({
        step: `redo-${trace.length}`,
        undo: controller.state.history.undoCount,
        redo: controller.state.history.redoCount,
        snapshot: `${boardToString(controller.state.board)}|r1c1=[${c.notes.join(",")}]`,
      });
    }
    redoReachedEnd ||=
      controller.state.history.redoCount === 0 &&
      boardToString(controller.state.board) === endBoard;
  }

  return {
    generatedAt: new Date().toISOString(),
    assertion: "VAL-LONG-003",
    acceptedMutations: 300,
    startCheckpoint: start,
    endCheckpoint: end,
    undoReachedStart,
    redoReachedEnd,
    trace,
  };
}

export function buildRejectedNoopHistoryTrace() {
  const controller = createGameplayController();
  controller.press("p");
  const undoAtStart = controller.state.history.undoCount;
  const redoAtStart = controller.state.history.redoCount;
  let rejectedCount = 0;
  let noopCount = 0;
  for (let i = 0; i < 200; i += 1) {
    const key = i % 2 === 0 ? "5" : "w";
    const beforeBoard = boardToString(controller.state.board);
    const beforeUndo = controller.state.history.undoCount;
    controller.press(key);
    const afterBoard = boardToString(controller.state.board);
    const afterUndo = controller.state.history.undoCount;
    if (key === "5" && beforeBoard === afterBoard && beforeUndo === afterUndo) rejectedCount += 1;
    if (key === "w" && beforeBoard === afterBoard && beforeUndo === afterUndo) noopCount += 1;
  }
  return {
    generatedAt: new Date().toISOString(),
    assertion: "VAL-LONG-002",
    inputCount: 200,
    undoAtStart,
    redoAtStart,
    undoAtEnd: controller.state.history.undoCount,
    redoAtEnd: controller.state.history.redoCount,
    rejectedCount,
    noopCount,
    undoUnchanged:
      undoAtStart === controller.state.history.undoCount &&
      redoAtStart === controller.state.history.redoCount,
  };
}

export function buildPersistenceArtifact() {
  let phase = "init";
  const calls: Record<string, Record<string, number>> = {};
  const tick = (method: string): void => {
    calls[phase] ??= {};
    calls[phase]![method] = (calls[phase]![method] ?? 0) + 1;
  };
  const persistence: GameplayPersistence = {
    readBestTimeMs: () => (tick("readBestTimeMs"), null),
    recordBestTimeMs: (_scope, elapsedMs) => (tick("recordBestTimeMs"), elapsedMs),
    listCompletedDailyDateKeys: () => (tick("listCompletedDailyDateKeys"), []),
    recordDailyCompletion: () => void tick("recordDailyCompletion"),
    getDailyStreakCount: () => (tick("getDailyStreakCount"), 0),
  };
  const controller = createGameplayController({ persistence });
  phase = "root_allowed_hydration";
  controller.getViewModel();
  phase = "root_idle";
  for (let i = 0; i < 40; i += 1) controller.getViewModel();
  phase = "play_start_hydration";
  controller.press("p");
  controller.getViewModel();
  phase = "play_idle";
  for (let i = 0; i < 40; i += 1) {
    controller.tick();
    controller.getViewModel();
  }
  phase = "play_input";
  ["d", "a", "n", "1", "1", "n", "backspace", "h"].forEach((k) => controller.press(k));
  controller.getViewModel();
  phase = "help_handoff";
  controller.press("q");
  controller.press("h");
  controller.getViewModel();
  phase = "help_idle";
  for (let i = 0; i < 20; i += 1) controller.getViewModel();
  phase = "generator_handoff";
  controller.press("escape");
  controller.press("g");
  controller.getViewModel();
  phase = "generator_idle";
  for (let i = 0; i < 20; i += 1) controller.getViewModel();
  phase = "solver_handoff";
  controller.press("escape");
  controller.press("s");
  controller.getViewModel();
  phase = "solver_idle";
  for (let i = 0; i < 20; i += 1) controller.getViewModel();
  phase = "daily_browse_hydration";
  controller.press("escape");
  controller.press("d");
  controller.getViewModel();
  phase = "daily_idle";
  for (let i = 0; i < 20; i += 1) controller.getViewModel();
  return {
    generatedAt: new Date().toISOString(),
    assertion: "VAL-LONG-007",
    callsByPhase: calls,
    forbiddenPhases: [
      "root_idle",
      "play_idle",
      "play_input",
      "help_idle",
      "generator_idle",
      "solver_idle",
      "daily_idle",
    ],
  };
}
