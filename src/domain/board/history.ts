import type { Board } from "./board-model";
import type { Move } from "./types";

interface BoardSnapshot {
  cellMeta: Uint16Array;
  noteMasks: Uint16Array;
}

interface HistoryEntry {
  boardSnapshot: BoardSnapshot;
  nextBoardSnapshot?: BoardSnapshot;
  move: Move | null;
  type: "move" | "clear" | "note" | "batch";
  row?: number;
  col?: number;
  noteValue?: number;
  noteAdded?: boolean;
}

export class History {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];

  private captureSnapshot(board: Board): BoardSnapshot {
    const cellMeta = new Uint16Array(81);
    const noteMasks = new Uint16Array(81);

    for (let i = 0; i < 81; i++) {
      const cell = board.getCellAt(i);
      cellMeta[i] =
        (cell.value & 0x000f) | (cell.isGiven ? 0x0010 : 0) | (cell.notesManual ? 0x0020 : 0);
      let mask = 0;
      for (const note of cell.notes) mask |= 1 << (note - 1);
      noteMasks[i] = mask;
    }

    return { cellMeta, noteMasks };
  }

  private restoreSnapshot(board: Board, snapshot: BoardSnapshot): void {
    for (let i = 0; i < 81; i++) {
      const cell = board.getCellAt(i);
      const meta = snapshot.cellMeta[i];
      cell.value = meta & 0x000f;
      cell.isGiven = (meta & 0x0010) !== 0;
      cell.notesManual = (meta & 0x0020) !== 0;
      const mask = snapshot.noteMasks[i];
      const notes: number[] = [];
      for (let note = 1; note <= 9; note++) {
        if ((mask & (1 << (note - 1))) !== 0) notes.push(note);
      }
      cell.notes = notes;
    }
  }

  private snapshotsEqual(left: BoardSnapshot, right: BoardSnapshot): boolean {
    for (let i = 0; i < 81; i++) {
      if (left.cellMeta[i] !== right.cellMeta[i] || left.noteMasks[i] !== right.noteMasks[i])
        return false;
    }
    return true;
  }

  record(board: Board, move: Move): HistoryEntry | null {
    const targetCell = board.getCell(move.row, move.col);
    if (targetCell.isGiven) return null;
    if (targetCell.value === move.value) return null;
    if (board.wouldConflict(move.row, move.col, move.value)) return null;

    const entry: HistoryEntry = {
      boardSnapshot: this.captureSnapshot(board),
      move,
      type: "move",
    };

    board.setValue(move.row, move.col, move.value);
    this.undoStack.push(entry);
    this.redoStack = [];
    return entry;
  }

  recordClear(board: Board, row: number, col: number): HistoryEntry | null {
    const cell = board.getCell(row, col);
    if (cell.isGiven || (cell.value === 0 && cell.notes.length === 0)) return null;

    const entry: HistoryEntry = {
      boardSnapshot: this.captureSnapshot(board),
      move: null,
      type: "clear",
      row,
      col,
    };

    board.clearCell(row, col);
    this.undoStack.push(entry);
    this.redoStack = [];
    return entry;
  }

  recordNote(
    board: Board,
    row: number,
    col: number,
    noteValue: number,
    added: boolean,
  ): HistoryEntry | null {
    const cell = board.getCell(row, col);
    if (cell.isGiven) return null;

    const noteAlreadyPresent = cell.notes.includes(noteValue);
    if ((added && noteAlreadyPresent) || (!added && !noteAlreadyPresent)) return null;

    const entry: HistoryEntry = {
      boardSnapshot: this.captureSnapshot(board),
      move: null,
      type: "note",
      row,
      col,
      noteValue,
      noteAdded: added,
    };

    board.setNote(row, col, noteValue, added);
    this.undoStack.push(entry);
    this.redoStack = [];
    return entry;
  }

  recordBatch(board: Board, mutate: () => void): HistoryEntry | null {
    const before = this.captureSnapshot(board);
    mutate();
    const after = this.captureSnapshot(board);
    if (this.snapshotsEqual(before, after)) return null;

    const entry: HistoryEntry = {
      boardSnapshot: before,
      nextBoardSnapshot: after,
      move: null,
      type: "batch",
    };

    this.undoStack.push(entry);
    this.redoStack = [];
    return entry;
  }

  undo(board: Board): Board {
    if (!this.canUndo()) return board;
    const entry = this.undoStack.pop()!;
    this.redoStack.push(entry);
    this.restoreSnapshot(board, entry.boardSnapshot);
    return board;
  }

  redo(board: Board): Board {
    if (!this.canRedo()) return board;

    const entry = this.redoStack.pop()!;
    this.undoStack.push(entry);

    if (entry.type === "move" && entry.move) {
      board.setValue(entry.move.row, entry.move.col, entry.move.value);
    } else if (entry.type === "clear" && entry.row !== undefined && entry.col !== undefined) {
      board.clearCell(entry.row, entry.col);
    } else if (
      entry.type === "note" &&
      entry.row !== undefined &&
      entry.col !== undefined &&
      entry.noteValue !== undefined &&
      entry.noteAdded !== undefined
    ) {
      board.setNote(entry.row, entry.col, entry.noteValue, entry.noteAdded);
    } else if (entry.type === "batch" && entry.nextBoardSnapshot) {
      this.restoreSnapshot(board, entry.nextBoardSnapshot);
    }

    return board;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  get undoCount(): number {
    return this.undoStack.length;
  }

  get redoCount(): number {
    return this.redoStack.length;
  }
}
