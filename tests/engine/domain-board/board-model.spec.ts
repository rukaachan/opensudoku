import { describe, expect, test } from "bun:test";
import { boardToString, createEmptyBoard, parseBoard } from "../../../src/domain/board";

describe("Board model", () => {
  describe("board creation", () => {
    test("createEmptyBoard returns 9x9 grid with all empty cells", () => {
      const board = createEmptyBoard();
      expect(board.cells.length).toBe(81);
      for (const cell of board.cells) {
        expect(cell.value).toBe(0);
        expect(cell.notes).toEqual([]);
        expect(cell.isGiven).toBe(false);
      }
    });

    test("parseBoard parses valid 81-character string", () => {
      const puzzle =
        "000000000000000000000000000000000000000000000000000000000000000000000000000000000";
      const board = parseBoard(puzzle);
      expect(board.cells.length).toBe(81);
    });

    test("parseBoard parses board with given values", () => {
      const puzzle =
        "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
      const board = parseBoard(puzzle);
      expect(board.cells[0].value).toBe(5);
      expect(board.cells[0].isGiven).toBe(true);
      expect(board.cells[1].value).toBe(3);
      expect(board.cells[1].isGiven).toBe(true);
    });

    test("parseBoard rejects string not of length 81", () => {
      expect(() => parseBoard("123")).toThrow("Board string must be exactly 81 characters");
    });
  });

  describe("cell access", () => {
    test("getCell returns cell at valid row/col", () => {
      const board = createEmptyBoard();
      const cell = board.getCell(4, 4);
      expect(cell.row).toBe(4);
      expect(cell.col).toBe(4);
    });

    test("getCell throws for out of bounds", () => {
      const board = createEmptyBoard();
      expect(() => board.getCell(9, 4)).toThrow("Row out of bounds");
      expect(() => board.getCell(4, 9)).toThrow("Column out of bounds");
    });
  });

  describe("locked givens", () => {
    test("given cells reject value mutation", () => {
      const board = parseBoard(
        "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
      );
      expect(board.cells[0].isGiven).toBe(true);
      expect(() => board.setValue(0, 0, 9)).toThrow("Cannot modify given cell");
    });

    test("given cells reject notes mutation", () => {
      const board = parseBoard(
        "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
      );
      expect(() => board.setNote(0, 0, 1, true)).toThrow("Cannot modify given cell");
    });

    test("given cells reject clear", () => {
      const board = parseBoard(
        "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
      );
      expect(() => board.clearCell(0, 0)).toThrow("Cannot clear given cell");
    });
  });

  describe("value mutation", () => {
    test("setValue on empty cell succeeds", () => {
      const board = createEmptyBoard();
      board.setValue(4, 4, 5);
      expect(board.cells[40].value).toBe(5);
      expect(board.cells[40].isGiven).toBe(false);
    });

    test("setValue replaces existing value", () => {
      const board = createEmptyBoard();
      board.setValue(4, 4, 5);
      board.setValue(4, 4, 9);
      expect(board.cells[40].value).toBe(9);
    });

    test("setValue clears notes when value is committed", () => {
      const board = createEmptyBoard();
      board.setNote(4, 4, 1, true);
      board.setNote(4, 4, 2, true);
      expect(board.cells[40].notes).toEqual([1, 2]);
      board.setValue(4, 4, 5);
      expect(board.cells[40].value).toBe(5);
      expect(board.cells[40].notes).toEqual([]);
    });

    test("setValue rejects value 0 (use clearCell)", () => {
      const board = createEmptyBoard();
      expect(() => board.setValue(4, 4, 0)).toThrow("Value must be between 1 and 9");
    });

    test("setValue rejects invalid values", () => {
      const board = createEmptyBoard();
      expect(() => board.setValue(4, 4, 10)).toThrow("Value must be between 1 and 9");
    });
  });

  describe("notes mutation", () => {
    test("setNote adds note to empty cell", () => {
      const board = createEmptyBoard();
      board.setNote(4, 4, 1, true);
      expect(board.cells[40].notes).toContain(1);
    });

    test("setNote removes note when toggled off", () => {
      const board = createEmptyBoard();
      board.setNote(4, 4, 1, true);
      board.setNote(4, 4, 1, false);
      expect(board.cells[40].notes).not.toContain(1);
    });

    test("setNote rejects invalid note values", () => {
      const board = createEmptyBoard();
      expect(() => board.setNote(4, 4, 0, true)).toThrow("Note value must be between 1 and 9");
      expect(() => board.setNote(4, 4, 10, true)).toThrow("Note value must be between 1 and 9");
    });
  });

  describe("clear cell", () => {
    test("clearCell clears value", () => {
      const board = createEmptyBoard();
      board.setValue(4, 4, 5);
      board.clearCell(4, 4);
      expect(board.cells[40].value).toBe(0);
    });

    test("clearCell clears notes", () => {
      const board = createEmptyBoard();
      board.setNote(4, 4, 1, true);
      board.setNote(4, 4, 2, true);
      board.clearCell(4, 4);
      expect(board.cells[40].notes).toEqual([]);
    });
  });

  describe("boardToString", () => {
    test("serializes board to 81-char string", () => {
      const board = createEmptyBoard();
      board.setValue(0, 0, 5);
      const str = boardToString(board);
      expect(str.length).toBe(81);
      expect(str[0]).toBe("5");
    });
  });
});
