import type { CapturedFrame, CapturedSpan } from "@opentui/core";

const CELL_WIDTH = 3;
const ROOT_ACTION_START_ROW = 1;

export function getCellSpanFromFrame(
  frame: CapturedFrame,
  row: number,
  col: number,
): CapturedSpan | undefined {
  const boardTop = frame.lines.findIndex((line) =>
    line.spans
      .map((span) => span.text)
      .join("")
      .includes("│"),
  );
  if (boardTop < 0) return undefined;

  const targetLine = frame.lines[boardTop + row + Math.floor(row / 3)];
  if (!targetLine) return undefined;

  const lineText = targetLine.spans.map((span) => span.text).join("");
  const leadingSpaces = lineText.search(/\S/);
  const boardLeft = leadingSpaces > 0 ? leadingSpaces - 1 : 0;
  const cellStart = boardLeft + col * CELL_WIDTH + Math.floor(col / 3) * 3;
  const cellEnd = cellStart + CELL_WIDTH;
  let offset = 0;
  let joined = "";
  let styleSource: CapturedSpan | undefined;

  for (const span of targetLine.spans) {
    const spanStart = offset;
    const spanEnd = offset + span.width;
    offset = spanEnd;
    const overlapStart = Math.max(spanStart, cellStart);
    const overlapEnd = Math.min(spanEnd, cellEnd);
    if (overlapStart < overlapEnd) {
      joined += span.text.slice(overlapStart - spanStart, overlapEnd - spanStart);
      if (!styleSource) styleSource = span;
    }
  }

  if (!styleSource || joined.length === 0) return undefined;
  return {
    text: joined,
    fg: styleSource.fg,
    bg: styleSource.bg,
    attributes: styleSource.attributes,
    width: CELL_WIDTH,
  };
}

export function getRootActionSpanFromFrame(
  frame: CapturedFrame,
  actionIndex: number,
): CapturedSpan | undefined {
  const titleRow = frame.lines.findIndex((line) =>
    line.spans
      .map((span) => span.text)
      .join("")
      .includes("OpenSudoku"),
  );
  if (titleRow < 0) return undefined;
  const actionLine = frame.lines[titleRow + ROOT_ACTION_START_ROW + actionIndex];
  return actionLine?.spans.find((span) => span.text.trim().length > 0);
}
