// Cell state enumeration
export enum CellState {
  Empty = 0,
  Given = 1,
  UserValue = 2,
}

// Represents a single cell in the Sudoku grid
export class Cell {
  row: number;
  col: number;
  value: number = 0;
  notes: number[] = [];
  notesManual: boolean = false;
  isGiven: boolean = false;

  constructor(row: number, col: number) {
    this.row = row;
    this.col = col;
  }

  get state(): CellState {
    if (this.isGiven) return CellState.Given;
    if (this.value !== 0) return CellState.UserValue;
    return CellState.Empty;
  }
}

// A move in the Sudoku game
export interface Move {
  row: number;
  col: number;
  value: number;
}
