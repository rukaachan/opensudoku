import { describe, test, expect } from "bun:test";
import { simulateKeys, assertions } from "./helpers";

describe("Render helper utilities", () => {
  describe("simulateKeys", () => {
    test("calls handler for each key", async () => {
      const calls: string[] = [];
      await simulateKeys(["a", "b", "c"], (k) => calls.push(k));
      expect(calls).toEqual(["a", "b", "c"]);
    });

    test("handles empty key array", async () => {
      const calls: string[] = [];
      await simulateKeys([], (k) => calls.push(k));
      expect(calls).toEqual([]);
    });
  });

  describe("assertions", () => {
    test("boardsEqual returns true for identical boards", () => {
      const board = [
        [1, 2],
        [3, 4],
      ];
      expect(assertions.boardsEqual(board, board)).toBe(true);
    });

    test("boardsEqual returns false for different boards", () => {
      const a = [
        [1, 2],
        [3, 4],
      ];
      const b = [
        [1, 2],
        [3, 5],
      ];
      expect(assertions.boardsEqual(a, b)).toBe(false);
    });

    test("cellMatches validates value", () => {
      const cell = { value: 5, isGiven: false, notes: [] };
      expect(assertions.cellMatches(cell, { value: 5 })).toBe(true);
      expect(assertions.cellMatches(cell, { value: 3 })).toBe(false);
    });

    test("cellMatches validates isGiven", () => {
      const cell = { value: 5, isGiven: true, notes: [] };
      expect(assertions.cellMatches(cell, { isGiven: true })).toBe(true);
      expect(assertions.cellMatches(cell, { isGiven: false })).toBe(false);
    });

    test("cellMatches validates notes", () => {
      const cell = { value: null, isGiven: false, notes: [1, 2, 3] };
      expect(assertions.cellMatches(cell, { notes: [1, 2, 3] })).toBe(true);
      expect(assertions.cellMatches(cell, { notes: [1, 2] })).toBe(false);
    });
  });
});
