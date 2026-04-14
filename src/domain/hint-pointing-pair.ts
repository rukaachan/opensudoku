import { Board } from "./board";

export interface PointingPairMove {
  row: number;
  col: number;
  value: number;
  rationale: string;
}

export function findPointingPairSingle(board: Board): PointingPairMove | null {
  const candidates = buildCandidateGrid(board);

  for (let boxRowStart = 0; boxRowStart < 9; boxRowStart += 3) {
    for (let boxColStart = 0; boxColStart < 9; boxColStart += 3) {
      for (let digit = 1; digit <= 9; digit++) {
        const positions = getDigitPositionsInBox(candidates, boxRowStart, boxColStart, digit);
        if (positions.length < 2) continue;

        const allInSameRow = positions.every((position) => position.row === positions[0]!.row);
        if (allInSameRow) {
          const row = positions[0]!.row;
          const rowHint = findPointingRowSingle(
            candidates,
            row,
            boxColStart,
            digit,
            boxRowStart,
            boxColStart,
          );
          if (rowHint) return rowHint;
        }

        const allInSameCol = positions.every((position) => position.col === positions[0]!.col);
        if (allInSameCol) {
          const col = positions[0]!.col;
          const colHint = findPointingColSingle(
            candidates,
            col,
            boxRowStart,
            digit,
            boxRowStart,
            boxColStart,
          );
          if (colHint) return colHint;
        }
      }
    }
  }

  return null;
}

function findPointingRowSingle(
  candidates: number[][][],
  row: number,
  boxColStart: number,
  eliminatedDigit: number,
  boxRowStart: number,
  sourceBoxColStart: number,
): PointingPairMove | null {
  for (let col = 0; col < 9; col++) {
    if (col >= boxColStart && col < boxColStart + 3) continue;
    if (!candidates[row]![col]!.includes(eliminatedDigit)) continue;

    const remainingCandidates = candidates[row]![col]!.filter((value) => value !== eliminatedDigit);
    if (remainingCandidates.length !== 1) continue;

    const value = remainingCandidates[0]!;
    return {
      row,
      col,
      value,
      rationale:
        `Pointing pair: in box (${Math.floor(boxRowStart / 3) + 1}, ${Math.floor(sourceBoxColStart / 3) + 1}), ` +
        `digit ${eliminatedDigit} is confined to row ${row + 1}, so ${eliminatedDigit} is eliminated from ` +
        `r${row + 1}c${col + 1}, leaving only ${value}.`,
    };
  }
  return null;
}

function findPointingColSingle(
  candidates: number[][][],
  col: number,
  boxRowStart: number,
  eliminatedDigit: number,
  sourceBoxRowStart: number,
  boxColStart: number,
): PointingPairMove | null {
  for (let row = 0; row < 9; row++) {
    if (row >= boxRowStart && row < boxRowStart + 3) continue;
    if (!candidates[row]![col]!.includes(eliminatedDigit)) continue;

    const remainingCandidates = candidates[row]![col]!.filter((value) => value !== eliminatedDigit);
    if (remainingCandidates.length !== 1) continue;

    const value = remainingCandidates[0]!;
    return {
      row,
      col,
      value,
      rationale:
        `Pointing pair: in box (${Math.floor(sourceBoxRowStart / 3) + 1}, ${Math.floor(boxColStart / 3) + 1}), ` +
        `digit ${eliminatedDigit} is confined to column ${col + 1}, so ${eliminatedDigit} is eliminated from ` +
        `r${row + 1}c${col + 1}, leaving only ${value}.`,
    };
  }
  return null;
}

function buildCandidateGrid(board: Board): number[][][] {
  return Array.from({ length: 9 }, (_, row) =>
    Array.from({ length: 9 }, (_, col) => getCandidates(board, row, col)),
  );
}

function getDigitPositionsInBox(
  candidates: number[][][],
  boxRowStart: number,
  boxColStart: number,
  digit: number,
): Array<{ row: number; col: number }> {
  const positions: Array<{ row: number; col: number }> = [];

  for (let row = boxRowStart; row < boxRowStart + 3; row++) {
    for (let col = boxColStart; col < boxColStart + 3; col++) {
      if (candidates[row]![col]!.includes(digit)) {
        positions.push({ row, col });
      }
    }
  }

  return positions;
}

function getCandidates(board: Board, row: number, col: number): number[] {
  if (board.getCell(row, col).value !== 0) return [];

  const candidates: number[] = [];
  for (let digit = 1; digit <= 9; digit++) {
    if (!board.wouldConflict(row, col, digit)) {
      candidates.push(digit);
    }
  }
  return candidates;
}
