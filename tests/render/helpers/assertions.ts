export interface Buffer {
  clear(): void;
  write(x: number, y: number, text: string): void;
  getScreen(): Screen;
  resize(width: number, height: number): void;
}

export interface Screen {
  width: number;
  height: number;
  lines: string[];
}

export type RenderComponent =
  | string
  | { render(buffer: Buffer, deltaTime: number): Promise<void> }
  | { toString(): string };

export interface CellState {
  row: number;
  col: number;
  value: number | null;
  isGiven: boolean;
  notes: number[];
  hasConflict: boolean;
}

export const assertions = {
  boardsEqual(a: number[][], b: number[][]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i].length !== b[i].length) return false;
      for (let j = 0; j < a[i].length; j++) {
        if (a[i][j] !== b[i][j]) return false;
      }
    }
    return true;
  },

  cellMatches(
    actual: { value: number | null; isGiven: boolean; notes: number[] },
    expected: { value?: number | null; isGiven?: boolean; notes?: number[] },
  ): boolean {
    if (expected.value !== undefined && actual.value !== expected.value) return false;
    if (expected.isGiven !== undefined && actual.isGiven !== expected.isGiven) return false;
    if (expected.notes === undefined) return true;
    const actualNotes = new Set(actual.notes);
    const expectedNotes = new Set(expected.notes);
    if (actualNotes.size !== expectedNotes.size) return false;
    for (const n of expectedNotes) {
      if (!actualNotes.has(n)) return false;
    }
    return true;
  },
};
