import { Cell, type Move } from "./types";

export class Board {
  cells: Cell[] = [];

  constructor() {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        this.cells.push(new Cell(row, col));
      }
    }
  }

  getCell(row: number, col: number): Cell {
    if (row < 0 || row >= 9) throw new Error("Row out of bounds");
    if (col < 0 || col >= 9) throw new Error("Column out of bounds");
    return this.cells[row * 9 + col];
  }

  getCellAt(index: number): Cell {
    if (index < 0 || index >= 81) throw new Error("Cell index out of bounds");
    return this.cells[index];
  }

  setValue(row: number, col: number, value: number): void {
    const cell = this.getCell(row, col);
    if (cell.isGiven) throw new Error("Cannot modify given cell");
    if (value < 1 || value > 9) throw new Error("Value must be between 1 and 9");
    cell.value = value;
    cell.notes = [];
    cell.notesManual = false;
  }

  setNote(
    row: number,
    col: number,
    noteValue: number,
    add: boolean,
    source: "manual" | "auto" = "manual",
  ): void {
    if (noteValue < 1 || noteValue > 9) throw new Error("Note value must be between 1 and 9");
    const cell = this.getCell(row, col);
    if (cell.isGiven) throw new Error("Cannot modify given cell");

    const noteIndex = cell.notes.indexOf(noteValue);
    if (add && noteIndex === -1) {
      cell.notes.push(noteValue);
      cell.notes.sort((a, b) => a - b);
      if (source === "manual") cell.notesManual = true;
    } else if (!add && noteIndex !== -1) {
      cell.notes.splice(noteIndex, 1);
      if (source === "manual" && cell.notes.length > 0) cell.notesManual = true;
    }

    if (cell.notes.length === 0) {
      cell.notesManual = false;
    } else if (source === "auto") {
      cell.notesManual = false;
    }
  }

  clearCell(row: number, col: number): void {
    const cell = this.getCell(row, col);
    if (cell.isGiven) throw new Error("Cannot clear given cell");
    cell.value = 0;
    cell.notes = [];
    cell.notesManual = false;
  }

  wouldConflict(row: number, col: number, value: number): boolean {
    for (let c = 0; c < 9; c++) {
      if (c !== col && this.getCell(row, c).value === value) return true;
    }

    for (let r = 0; r < 9; r++) {
      if (r !== row && this.getCell(r, col).value === value) return true;
    }

    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let r = boxRow; r < boxRow + 3; r++) {
      for (let c = boxCol; c < boxCol + 3; c++) {
        if ((r !== row || c !== col) && this.getCell(r, c).value === value) return true;
      }
    }

    return false;
  }

  hasConflict(row: number, col: number): boolean {
    const cell = this.getCell(row, col);
    if (cell.value === 0) return false;

    const value = cell.value;

    for (let c = 0; c < 9; c++) {
      if (c === col) continue;
      const other = this.getCell(row, c);
      if (other.value !== 0 && other.value === value) return true;
    }

    for (let r = 0; r < 9; r++) {
      if (r === row) continue;
      const other = this.getCell(r, col);
      if (other.value !== 0 && other.value === value) return true;
    }

    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let r = boxRow; r < boxRow + 3; r++) {
      for (let c = boxCol; c < boxCol + 3; c++) {
        if (r === row && c === col) continue;
        const other = this.getCell(r, c);
        if (other.value !== 0 && other.value === value) return true;
      }
    }

    return false;
  }

  applyMove(move: Move): Move | null {
    const cell = this.getCell(move.row, move.col);
    if (cell.isGiven) return null;
    if (this.wouldConflict(move.row, move.col, move.value)) return null;
    this.setValue(move.row, move.col, move.value);
    return move;
  }

  hasContradiction(): boolean {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (this.getCell(row, col).value !== 0 && this.hasConflict(row, col)) return true;
      }
    }
    return false;
  }

  isSolved(): boolean {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const cell = this.getCell(row, col);
        if (cell.value === 0 || this.hasConflict(row, col)) return false;
      }
    }
    return true;
  }

  cloneCells(): Cell[] {
    return this.cells.map((cell) => {
      const next = new Cell(cell.row, cell.col);
      next.value = cell.value;
      next.notes = [...cell.notes];
      next.notesManual = cell.notesManual;
      next.isGiven = cell.isGiven;
      return next;
    });
  }

  restoreCells(snapshot: Cell[]): void {
    for (let i = 0; i < 81; i++) {
      this.cells[i].value = snapshot[i].value;
      this.cells[i].notes = [...snapshot[i].notes];
      this.cells[i].notesManual = snapshot[i].notesManual;
      this.cells[i].isGiven = snapshot[i].isGiven;
    }
  }

  clone(): Board {
    const next = new Board();
    next.restoreCells(this.cloneCells());
    return next;
  }
}

export function createEmptyBoard(): Board {
  return new Board();
}

export function parseBoard(boardString: string): Board {
  if (boardString.length !== 81) {
    throw new Error("Board string must be exactly 81 characters");
  }

  const board = new Board();
  for (let i = 0; i < 81; i++) {
    const value = parseInt(boardString[i], 10);
    if (isNaN(value)) throw new Error("Board string must contain only digits 0-9");
    if (value !== 0) {
      board.cells[i].value = value;
      board.cells[i].isGiven = true;
    }
  }

  return board;
}

export function boardToString(board: Board): string {
  return board.cells.map((cell) => cell.value.toString()).join("");
}

export function isValidPuzzle(boardString: string): boolean {
  try {
    return !parseBoard(boardString).hasContradiction();
  } catch {
    return false;
  }
}
