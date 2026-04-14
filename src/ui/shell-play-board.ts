import { RGBA, TextAttributes, TextRenderable, type CliRenderer } from "@opentui/core";
import type { CandidateDisplayMode, GameplayViewModel } from "../app/gameplay";
import { formatCell } from "./cell-format";

export const CELL_WIDTH = 3;
export const BOARD_START_ROW = 2;
export const PLAY_BOARD_TOP_OFFSET = 1;
const GROUP_SEPARATOR_TEXT = " │ ";
export const GROUP_SEPARATOR_WIDTH = GROUP_SEPARATOR_TEXT.length;

const HORIZONTAL_SEPARATOR = Array.from(
  { length: 9 * CELL_WIDTH + 2 * GROUP_SEPARATOR_WIDTH },
  (_, index) =>
    index === 3 * CELL_WIDTH + Math.floor(GROUP_SEPARATOR_WIDTH / 2) ||
    index === 6 * CELL_WIDTH + GROUP_SEPARATOR_WIDTH + Math.floor(GROUP_SEPARATOR_WIDTH / 2)
      ? "┼"
      : "─",
).join("");

const ROOT_SEPARATOR_FG = RGBA.fromHex("#94a3b8");
const CELL_NORMAL_FG = RGBA.fromHex("#e5e7eb");
const CELL_GIVEN_FG = RGBA.fromHex("#93c5fd");
const CELL_MATCH_FG = RGBA.fromHex("#fde68a");
const CELL_INVALID_FG = RGBA.fromHex("#fca5a5");
const CELL_GUIDE_ROW_BG = RGBA.fromHex("#1f2937");
const CELL_GUIDE_COL_BG = RGBA.fromHex("#263348");
const CELL_SELECTED_FG = RGBA.fromHex("#111827");
const CELL_SELECTED_BG = RGBA.fromHex("#facc15");

function getBoardVisualRow(row: number): number {
  return BOARD_START_ROW + row + Math.floor(row / 3);
}

function getCellLeft(col: number): number {
  return col * CELL_WIDTH + Math.floor(col / 3) * GROUP_SEPARATOR_WIDTH;
}

function formatCandidateCell(notes: number[], mode: CandidateDisplayMode, width: number): string {
  if (mode === "minimal") return " . ".padEnd(width, " ");
  if (mode === "count") return `·${Math.min(9, notes.length)}`.padStart(2, " ").padEnd(width, " ");
  return formatCell(0, notes, width);
}

export function mountPlayBoard(options: {
  renderer: CliRenderer;
  viewModel: GameplayViewModel;
  top: number;
  left: number;
  mounted: TextRenderable[];
  mountLine: (
    content: unknown,
    top: number,
    style?: { fg?: RGBA; bg?: RGBA; attributes?: number; left?: number },
  ) => void;
}): void {
  const { renderer, viewModel, top, left, mounted, mountLine } = options;

  for (let divider = 1; divider <= 2; divider += 1) {
    const dividerTop = top + BOARD_START_ROW + PLAY_BOARD_TOP_OFFSET + divider * 3 + (divider - 1);
    mountLine(HORIZONTAL_SEPARATOR, dividerTop, {
      left,
      fg: ROOT_SEPARATOR_FG,
      attributes: TextAttributes.BOLD,
    });
  }

  for (let row = 0; row < 9; row += 1) {
    const boardTop = top + getBoardVisualRow(row) + PLAY_BOARD_TOP_OFFSET;
    for (let col = 0; col < 9; col += 1) {
      const cell = viewModel.boardRows[row]![col]!;
      const isSelected = cell.selected;
      const isHintPulseCell =
        viewModel.hintPulseVisible &&
        viewModel.lastHint !== null &&
        viewModel.lastHint.row === row &&
        viewModel.lastHint.col === col &&
        cell.value === 0;
      const text = isHintPulseCell
        ? formatCell(viewModel.lastHint!.value, [], CELL_WIDTH)
        : cell.value !== 0
          ? formatCell(cell.value, [], CELL_WIDTH)
          : formatCandidateCell(
              cell.notes,
              viewModel.notesMode ? "full" : viewModel.candidateDisplayMode,
              CELL_WIDTH,
            );
      const bg = isSelected
        ? CELL_SELECTED_BG
        : cell.inSelectedRow
          ? CELL_GUIDE_ROW_BG
          : cell.inSelectedCol
            ? CELL_GUIDE_COL_BG
            : undefined;
      const fg = isSelected
        ? CELL_SELECTED_FG
        : isHintPulseCell
          ? CELL_MATCH_FG
          : cell.invalidForActiveNumber
            ? CELL_INVALID_FG
            : cell.matchesActiveNumber
              ? CELL_MATCH_FG
              : cell.isGiven
                ? CELL_GIVEN_FG
                : CELL_NORMAL_FG;
      const renderable = new TextRenderable(renderer, {
        content: text,
        position: "absolute",
        left: left + getCellLeft(col),
        top: boardTop,
        width: CELL_WIDTH,
        height: 1,
        fg,
        bg,
        attributes: isSelected ? TextAttributes.BOLD : TextAttributes.NONE,
      });
      renderer.root.add(renderable);
      mounted.push(renderable);
    }

    for (let group = 1; group <= 2; group += 1) {
      const renderable = new TextRenderable(renderer, {
        content: GROUP_SEPARATOR_TEXT,
        position: "absolute",
        left: left + group * (3 * CELL_WIDTH) + (group - 1) * GROUP_SEPARATOR_WIDTH,
        top: boardTop,
        fg: ROOT_SEPARATOR_FG,
        attributes: TextAttributes.BOLD,
      });
      renderer.root.add(renderable);
      mounted.push(renderable);
    }
  }
}
