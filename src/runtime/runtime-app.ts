import { createCliRenderer, type KeyEvent } from "@opentui/core";
import { createGameplayController } from "../app/gameplay";
import { recordLiveCueEvidence } from "../app/live-cue-evidence";
import { parseBoard } from "../domain/board";
import { mountGameplayScreen } from "../ui/shell";

function normalizeKey(event: KeyEvent): string {
  if (event.name === "return") return "enter";
  if (event.name === "escape") return "escape";
  if (event.name === "backspace") return "backspace";
  if (event.name === "delete") return "delete";
  if (event.name === "space") return " ";
  return event.name?.toLowerCase() ?? "";
}

function emitTerminalFeedback(feedback: "fail" | "success" | "complete" | null): void {
  if (!feedback || !process.stdout?.write) return;
  const tone =
    feedback === "fail" ? "\u0007" : feedback === "success" ? "\u0007\u0007" : "\u0007\u0007\u0007";
  process.stdout.write(tone);
  recordLiveCueEvidence(feedback, tone);
}

function resolveBootBoardFromEnv(): ReturnType<typeof parseBoard> | undefined {
  const board = process.env.OPEN_SUDOKU_START_BOARD;
  if (!board) return undefined;
  try {
    return parseBoard(board);
  } catch {
    return undefined;
  }
}

export async function startInteractiveApp(): Promise<void> {
  const renderer = await createCliRenderer({
    useAlternateScreen: true,
    useConsole: false,
    exitOnCtrlC: true,
  });

  const controller = createGameplayController({ board: resolveBootBoardFromEnv() });
  let mounted: { cleanup: () => void } = { cleanup: () => {} };

  const rerender = async (): Promise<void> => {
    mounted.cleanup();
    mounted = mountGameplayScreen(renderer, controller.getViewModel());
    renderer.requestRender();
  };

  let renderInFlight = false;
  const rerenderSafe = async (): Promise<void> => {
    if (renderInFlight) return;
    renderInFlight = true;
    try {
      await rerender();
    } finally {
      renderInFlight = false;
    }
  };

  renderer.keyInput.on("keypress", async (event) => {
    const result = controller.press(normalizeKey(event));
    const tickChanged = controller.tick();
    emitTerminalFeedback(controller.consumeTerminalFeedback());
    if (result === "quit-app") {
      renderer.destroy();
      return;
    }
    if (tickChanged || result === "continue") await rerenderSafe();
  });

  const timerInterval = setInterval(() => {
    if (controller.tick()) void rerenderSafe();
  }, 250);

  renderer.start();
  await rerenderSafe();

  await new Promise<void>((resolve) => {
    renderer.once("destroy", () => {
      clearInterval(timerInterval);
      mounted.cleanup();
      resolve();
    });
  });
}
