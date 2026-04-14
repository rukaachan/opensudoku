// Selection position on the board
export class Selection {
  row: number;
  col: number;

  constructor(row: number, col: number) {
    this.row = row;
    this.col = col;
  }

  moveUp(): Selection {
    return new Selection(Math.max(0, this.row - 1), this.col);
  }

  moveDown(): Selection {
    return new Selection(Math.min(8, this.row + 1), this.col);
  }

  moveLeft(): Selection {
    return new Selection(this.row, Math.max(0, this.col - 1));
  }

  moveRight(): Selection {
    return new Selection(this.row, Math.min(8, this.col + 1));
  }

  equals(other: Selection): boolean {
    return this.row === other.row && this.col === other.col;
  }
}
