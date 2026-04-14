import type { CapturedFrame, CapturedSpan } from "@opentui/core";
import { RGBA, TextAttributes, TextRenderable } from "@opentui/core";
import { createOpenTUIHarness, type OpenTUIHarness } from "./harness";

export interface MockSelection {
  row: number;
  col: number;
}

export interface BoardFixture {
  board: number[][];
  selection?: MockSelection;
}

export interface TerminalFrame {
  width: number;
  height: number;
  content: string[];
  spans: CapturedFrame;
}

export interface BoardRenderResult {
  rowText: string;
  rowLines: string[];
  selectedCellHasDistinctStyle: boolean;
  selectedCellSpan?: CapturedSpan;
  unselectedCellSpan?: CapturedSpan;
  spans: CapturedFrame;
  charFrame: string;
}

const CELL_WIDTH = 3;
const BOARD_SIZE = 9;
const DEFAULT_HARNESS_WIDTH = 80;
const DEFAULT_HARNESS_HEIGHT = 24;
const UNSELECTED_FG = RGBA.fromHex("#e5e7eb");
const SELECTED_FG = RGBA.fromHex("#111827");
const SELECTED_BG = RGBA.fromHex("#facc15");

export function validateBoardFixture(fixture: BoardFixture): void {
  const { board, selection } = fixture;
  if (!board || board.length !== 9) {
    throw new Error(`Invalid board: expected 9 rows, got ${board?.length ?? 0}`);
  }

  for (let row = 0; row < 9; row++) {
    if (!board[row] || board[row].length !== 9) {
      throw new Error(
        `Invalid board: row ${row} has ${board[row]?.length ?? 0} columns, expected 9`,
      );
    }
    for (let col = 0; col < 9; col++) {
      const cell = board[row][col];
      if (cell < 0 || cell > 9) {
        throw new Error(`Invalid board: cell [${row},${col}] has value ${cell}, expected 0-9`);
      }
    }
  }

  if (
    selection &&
    (selection.row < 0 || selection.row >= 9 || selection.col < 0 || selection.col >= 9)
  ) {
    throw new Error(`Invalid selection: [${selection.row},${selection.col}] out of bounds`);
  }
}

function formatCell(value: number): string {
  return ` ${value === 0 ? "." : String(value)} `;
}

function findComparisonCell(selection?: MockSelection): MockSelection | undefined {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (!selection || selection.row !== row || selection.col !== col) {
        return { row, col };
      }
    }
  }
  return undefined;
}

function getCellSpan(frame: CapturedFrame, row: number, col: number): CapturedSpan | undefined {
  const line = frame.lines[row];
  if (!line) return undefined;

  const cellStart = col * CELL_WIDTH;
  const cellEnd = cellStart + CELL_WIDTH;
  let offset = 0;
  for (const span of line.spans) {
    const spanStart = offset;
    const spanEnd = offset + span.width;
    offset = spanEnd;
    if (spanStart <= cellStart && spanEnd >= cellEnd) return span;
  }
  return undefined;
}

function mountBoardFixture(harness: OpenTUIHarness, fixture: BoardFixture): TextRenderable[] {
  const mounted: TextRenderable[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const isSelected = fixture.selection?.row === row && fixture.selection?.col === col;
      const text = new TextRenderable(harness.renderer, {
        content: formatCell(fixture.board[row][col]),
        position: "absolute",
        left: col * CELL_WIDTH,
        top: row,
        width: CELL_WIDTH,
        height: 1,
        fg: isSelected ? SELECTED_FG : UNSELECTED_FG,
        bg: isSelected ? SELECTED_BG : undefined,
        attributes: isSelected ? TextAttributes.BOLD : TextAttributes.NONE,
      });
      harness.renderer.root.add(text);
      mounted.push(text);
    }
  }
  return mounted;
}

export async function renderBoardFixture(
  fixture: BoardFixture,
  harness?: OpenTUIHarness,
): Promise<TerminalFrame> {
  validateBoardFixture(fixture);
  const ownedHarness =
    harness ??
    (await createOpenTUIHarness({ width: DEFAULT_HARNESS_WIDTH, height: DEFAULT_HARNESS_HEIGHT }));
  const activeHarness = harness ?? ownedHarness;
  const mounted = mountBoardFixture(activeHarness, fixture);

  try {
    await activeHarness.renderOnce();
    const spans = activeHarness.captureSpans();
    return {
      width: spans.cols,
      height: spans.rows,
      content: activeHarness.captureCharFrame().split("\n").slice(0, spans.rows),
      spans,
    };
  } finally {
    for (const renderable of mounted) renderable.destroy();
    if (!harness) ownedHarness.cleanup();
  }
}

export async function captureFrame(options?: {
  width?: number;
  height?: number;
}): Promise<TerminalFrame> {
  const harness = await createOpenTUIHarness(options);
  try {
    await harness.renderOnce();
    const spans = harness.captureSpans();
    return {
      width: spans.cols,
      height: spans.rows,
      content: harness.captureCharFrame().split("\n"),
      spans,
    };
  } finally {
    harness.cleanup();
  }
}

export async function verifyBoardRender(
  board: number[][],
  selection?: MockSelection,
): Promise<BoardRenderResult> {
  const harness = await createOpenTUIHarness({
    width: DEFAULT_HARNESS_WIDTH,
    height: DEFAULT_HARNESS_HEIGHT,
  });
  try {
    const frame = await renderBoardFixture({ board, selection }, harness);
    const rowLines = frame.content.slice(0, BOARD_SIZE);
    const selectedCellSpan = selection
      ? getCellSpan(frame.spans, selection.row, selection.col)
      : undefined;
    const comparisonCell = findComparisonCell(selection);
    const unselectedCellSpan = comparisonCell
      ? getCellSpan(frame.spans, comparisonCell.row, comparisonCell.col)
      : undefined;
    return {
      rowText: rowLines.join("\n"),
      rowLines,
      selectedCellHasDistinctStyle: Boolean(
        selection &&
        selectedCellSpan &&
        unselectedCellSpan &&
        (!selectedCellSpan.bg.equals(unselectedCellSpan.bg) ||
          !selectedCellSpan.fg.equals(unselectedCellSpan.fg) ||
          selectedCellSpan.attributes !== unselectedCellSpan.attributes),
      ),
      selectedCellSpan,
      unselectedCellSpan,
      spans: frame.spans,
      charFrame: harness.captureCharFrame(),
    };
  } finally {
    harness.cleanup();
  }
}
