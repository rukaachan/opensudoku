import { Board, parseBoard } from "../../domain/board";
import { createDailyPuzzle, type DailyDateKey } from "../../domain/daily";
import { Difficulty, createPuzzle } from "../../domain/generator";
import { getHint, type Hint } from "../../domain/hint";
import { HintUnavailableError, type HintFailureReason } from "../../domain/hint";
import { solve } from "../../domain/solver";

export { Difficulty };
export type { DailyDateKey };

const SOLVER_KNOWN_SOLVABLE =
  "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const SOLVER_KNOWN_INVALID =
  "554678912672195348198342567859761423426853791713924856961537284287419635345286179";
const SOLVER_KNOWN_UNSOLVABLE =
  "004000910000105040190042000000791420400000000710000850000530000200019600040080000";

export type SessionType = "generated" | "daily";

export interface GeneratedPuzzleResult {
  board: Board;
  difficulty: Difficulty;
  status: string;
  sessionType: SessionType;
  sessionId: string;
  dailyDateKey: DailyDateKey | null;
}

export function runGeneratorByKey(key: string): GeneratedPuzzleResult | { status: string } | null {
  const selected =
    key === "1"
      ? { difficulty: Difficulty.Easy, label: "easy", sessionTag: "easy" }
      : key === "2"
        ? { difficulty: Difficulty.Medium, label: "medium", sessionTag: "medium" }
        : key === "3"
          ? { difficulty: Difficulty.Hard, label: "hard", sessionTag: "hard" }
          : key === "4"
            ? { difficulty: Difficulty.Hard, label: "extreme hard", sessionTag: "extreme-hard" }
            : null;

  if (!selected) {
    if (/^\d$/.test(key)) {
      return {
        status: `Unsupported difficulty key: ${key}. Supported: 1 easy, 2 medium, 3 hard, 4 extreme hard.`,
      };
    }
    return null;
  }

  const generated = createPuzzle(selected.difficulty);
  if (generated.status !== "success" || !generated.puzzle) {
    return { status: generated.message ?? "Generator failed." };
  }

  return {
    board: generated.puzzle.clone(),
    difficulty: selected.difficulty,
    status: `Generated ${selected.label} puzzle. Play mode active.`,
    sessionType: "generated",
    sessionId: `generated:${selected.sessionTag}:${Date.now()}`,
    dailyDateKey: null,
  };
}

export function runDailyByDateKey(
  dateKey: DailyDateKey,
): GeneratedPuzzleResult | { status: string } {
  const daily = createDailyPuzzle(dateKey);
  if (daily.status !== "success" || !daily.puzzle || !daily.difficulty) {
    return { status: daily.message ?? `Daily puzzle unavailable for ${dateKey}.` };
  }

  return {
    board: daily.puzzle.clone(),
    difficulty: daily.difficulty,
    status: `Daily ${dateKey} (${daily.difficulty}) puzzle ready.`,
    sessionType: "daily",
    sessionId: `daily:${dateKey}`,
    dailyDateKey: dateKey,
  };
}

function getSolverInputBoard(key: string, currentBoard: Board): Board | null {
  if (key === "1") return parseBoard(SOLVER_KNOWN_SOLVABLE);
  if (key === "2") return parseBoard(SOLVER_KNOWN_INVALID);
  if (key === "3") return parseBoard(SOLVER_KNOWN_UNSOLVABLE);
  if (key === "c") return currentBoard.clone();
  return null;
}

export function runSolverByKey(key: string, currentBoard: Board): string | null {
  const input = getSolverInputBoard(key, currentBoard);
  if (!input) {
    return null;
  }

  const result = solve(input);
  if (result.status === "solved") {
    return key === "c" ? "Solver: solved current board." : "Solver: solved known puzzle.";
  }

  if (result.status === "invalid") {
    return "Solver: invalid puzzle input.";
  }

  return "Solver: unsolvable puzzle.";
}

export interface HintRequestResult {
  hint: Hint | null;
  failure: HintFailureReason | "unexpected_error" | null;
  status: string;
}

export function requestHint(board: Board): HintRequestResult {
  try {
    const hint = getHint(board);
    return {
      hint,
      failure: null,
      status: `Hint r${hint.row + 1}c${hint.col + 1}=${hint.value}: ${hint.type}.`,
    };
  } catch (error) {
    if (error instanceof HintUnavailableError) {
      return {
        hint: null,
        failure: error.reason,
        status: `Hint unavailable: ${error.message}`,
      };
    }
    return {
      hint: null,
      failure: "unexpected_error",
      status:
        error instanceof Error
          ? `Unexpected hint failure: ${error.message}`
          : "Unexpected hint failure.",
    };
  }
}
