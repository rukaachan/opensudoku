import type { Board, Selection } from "../../domain/board";
import type { DailyDateKey, Difficulty, SessionType } from "../puzzle-tools";
import type { DailyCalendarMonthView } from "../daily/daily-calendar-view";
import type { requestHint } from "../puzzle-tools";
import type { SessionTimerMode } from "./session-timer";
import type { ProgressSummary } from "../progression/progression-store";

export type AppScreen = "root" | "play" | "daily" | "generator" | "progress" | "solver" | "help";

export type DailyBrowseMode = "month" | "year";
export type CandidateDisplayMode = "minimal" | "count" | "full";

export interface RootAction {
  id: "play" | "daily" | "generator" | "progress" | "solver" | "help" | "quit";
  label: string;
}

export interface BoardCellView {
  row: number;
  col: number;
  value: number;
  isGiven: boolean;
  notes: number[];
  selected: boolean;
  inSelectedRow: boolean;
  inSelectedCol: boolean;
  matchesActiveNumber: boolean;
  invalidForActiveNumber: boolean;
}

export interface GameplayViewModel {
  screen: AppScreen;
  rootActions: RootAction[];
  rootFocusIndex: number;
  boardRows: BoardCellView[][];
  selection: Selection;
  notesMode: boolean;
  candidateDisplayMode: CandidateDisplayMode;
  status: string;
  solved: boolean;
  invalid: boolean;
  activeDifficulty: Difficulty | null;
  activeSessionType: SessionType | null;
  activeSessionId: string | null;
  activeDailyDateKey: DailyDateKey | null;
  dailyBrowseMode: DailyBrowseMode;
  dailySelectedDateKey: DailyDateKey | null;
  dailyCalendarMonth: DailyCalendarMonthView | null;
  lastHint: ReturnType<typeof requestHint>["hint"];
  remainingHints: number;
  activeNumber: number | null;
  hintPulseVisible: boolean;
  sessionTimerRunning: boolean;
  sessionTimerMode: SessionTimerMode;
  sessionTimerText: string;
  challengeRemainingSeconds: number | null;
  challengeFailed: boolean;
  bestTimeText: string | null;
  dailyStreakCount: number;
  progressSummary: ProgressSummary | null;
}

export const ROOT_ACTIONS: RootAction[] = [
  { id: "play", label: "Play" },
  { id: "daily", label: "Daily" },
  { id: "generator", label: "Generator" },
  { id: "progress", label: "Progress" },
  { id: "solver", label: "Solver Checks" },
  { id: "help", label: "Help" },
  { id: "quit", label: "Quit" },
];

export const DEFAULT_PUZZLE =
  "530070000600195000098000060800060003400803001700020006060000280000419005000080079";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function isDigitKey(
  key: string,
): key is "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" {
  return /^[1-9]$/.test(key);
}

export function isClearKey(key: string): boolean {
  return key === "0" || key === "." || key === "backspace" || key === "delete" || key === "c";
}

export function getConflictType(
  board: Board,
  row: number,
  col: number,
  value: number,
): "row" | "column" | "box" {
  for (let checkCol = 0; checkCol < 9; checkCol++) {
    if (checkCol === col) continue;
    if (board.getCell(row, checkCol).value === value) return "row";
  }

  for (let checkRow = 0; checkRow < 9; checkRow++) {
    if (checkRow === row) continue;
    if (board.getCell(checkRow, col).value === value) return "column";
  }

  return "box";
}

export function buildBoardRows(
  board: Board,
  selection: Selection,
  activeNumber: number | null,
): BoardCellView[][] {
  const boardRows: BoardCellView[][] = [];
  for (let row = 0; row < 9; row++) {
    const rowCells: BoardCellView[] = [];
    for (let col = 0; col < 9; col++) {
      const cell = board.getCell(row, col);
      const selected = selection.row === row && selection.col === col;
      const matchesActiveNumber =
        activeNumber !== null && cell.value !== 0 && cell.value === activeNumber;
      const invalidForActiveNumber =
        activeNumber !== null &&
        !selected &&
        cell.value === 0 &&
        board.wouldConflict(row, col, activeNumber);
      rowCells.push({
        row,
        col,
        value: cell.value,
        isGiven: cell.isGiven,
        notes: [...cell.notes],
        selected,
        inSelectedRow: selection.row === row,
        inSelectedCol: selection.col === col,
        matchesActiveNumber,
        invalidForActiveNumber,
      });
    }
    boardRows.push(rowCells);
  }
  return boardRows;
}
