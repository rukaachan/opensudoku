import { describe, test, expect } from "bun:test";
import { Board, parseBoard } from "../../src/domain/board";
import { getHint } from "../../src/domain/hint";
import { HintUnavailableError } from "../../src/domain/hint";
import { HintType } from "../../src/domain/hint";
import { auditShallowHintBaseline } from "../../src/domain/hint";
import { requestHint } from "../../src/app/puzzle-tools";

const DEEPER_POINTING_PAIR_FIXTURE = {
  name: "hard-pointing-pair-r7c6",
  puzzle: "000027300802056001040809002103600007000703900000002000400000000007900860010008500",
  expected: { row: 6, col: 5, value: 5, type: HintType.PointingPair },
};
const BASE_HINT_PUZZLE =
  "530070000600195000098000060800060003400803001700020006060000280000419005000080079";

describe("Hint", () => {
  describe("getHint - basic functionality", () => {
    test("returns a hint for a valid puzzle", () => {
      const board = parseBoard(BASE_HINT_PUZZLE);
      const hint = getHint(board);

      expect(hint).not.toBeNull();
      expect(hint.type).toBeDefined();
      expect(hint.row).toBeGreaterThanOrEqual(0);
      expect(hint.row).toBeLessThan(9);
      expect(hint.col).toBeGreaterThanOrEqual(0);
      expect(hint.col).toBeLessThan(9);
    });

    test("hint value is valid (1-9)", () => {
      const board = parseBoard(BASE_HINT_PUZZLE);
      const hint = getHint(board);

      expect(hint.value).toBeGreaterThanOrEqual(1);
      expect(hint.value).toBeLessThanOrEqual(9);
    });

    test("hint targets an empty cell", () => {
      const board = parseBoard(BASE_HINT_PUZZLE);
      const hint = getHint(board);

      const cell = board.getCell(hint.row, hint.col);
      expect(cell.value).toBe(0);
    });

    test("hint value doesn't conflict with row", () => {
      const board = parseBoard(BASE_HINT_PUZZLE);
      const hint = getHint(board);

      for (let c = 0; c < 9; c++) {
        if (c !== hint.col) {
          expect(board.getCell(hint.row, c).value).not.toBe(hint.value);
        }
      }
    });

    test("hint value doesn't conflict with column", () => {
      const board = parseBoard(BASE_HINT_PUZZLE);
      const hint = getHint(board);

      for (let r = 0; r < 9; r++) {
        if (r !== hint.row) {
          expect(board.getCell(r, hint.col).value).not.toBe(hint.value);
        }
      }
    });

    test("hint value doesn't conflict with box", () => {
      const board = parseBoard(BASE_HINT_PUZZLE);
      const hint = getHint(board);

      const boxRow = Math.floor(hint.row / 3) * 3;
      const boxCol = Math.floor(hint.col / 3) * 3;

      for (let r = boxRow; r < boxRow + 3; r++) {
        for (let c = boxCol; c < boxCol + 3; c++) {
          if (r !== hint.row || c !== hint.col) {
            expect(board.getCell(r, c).value).not.toBe(hint.value);
          }
        }
      }
    });
  });

  describe("getHint - rationale data", () => {
    test("hint includes rationale message", () => {
      const board = parseBoard(BASE_HINT_PUZZLE);
      const hint = getHint(board);

      expect(hint.rationale).toBeDefined();
      expect(typeof hint.rationale).toBe("string");
      expect(hint.rationale.length).toBeGreaterThan(0);
    });

    test("hint includes type", () => {
      const board = parseBoard(BASE_HINT_PUZZLE);
      const hint = getHint(board);

      expect(hint.type).toBeDefined();
      expect(Object.values(HintType).includes(hint.type)).toBe(true);
    });
  });

  describe("getHint - edge cases", () => {
    test("named deeper fixture proves shallow exhaustion and returns declared pointing-pair move", () => {
      const board = parseBoard(DEEPER_POINTING_PAIR_FIXTURE.puzzle);
      const before = board.toString();
      const shallowAudit = auditShallowHintBaseline(board);

      expect(shallowAudit.hasNakedSingle).toBe(false);
      expect(shallowAudit.hasHiddenSingle).toBe(false);

      const hint = getHint(board);
      expect(hint).toMatchObject(DEEPER_POINTING_PAIR_FIXTURE.expected);
      expect(hint.rationale).toContain("Pointing pair");
      expect(board.toString()).toBe(before);
    });

    test("hint on unconstrained board throws error instead of arbitrary guess", () => {
      const { createEmptyBoard } = require("../../src/domain/board");
      const board = createEmptyBoard();

      // An empty board has no logical constraints - should throw
      expect(() => getHint(board)).toThrow("No logically justified hint available");
    });

    test("solved and contradictory cases throw distinct unavailable reasons", () => {
      const solved = parseBoard(
        "534678912672195348198342567859761423426853791713924856961537284287419635345286179",
      );
      const contradictory = parseBoard(
        "554678912672195348198342567859761423426853791713924856961537284287419635345286179",
      );

      expect(() => getHint(solved)).toThrow(HintUnavailableError);
      expect(() => getHint(contradictory)).toThrow(HintUnavailableError);

      try {
        getHint(solved);
      } catch (error) {
        expect(error).toBeInstanceOf(HintUnavailableError);
        expect((error as HintUnavailableError).reason).toBe("solved");
      }

      try {
        getHint(contradictory);
      } catch (error) {
        expect(error).toBeInstanceOf(HintUnavailableError);
        expect((error as HintUnavailableError).reason).toBe("contradictory");
      }
    });

    test("no-logical-hint case reports reason without mutating board", () => {
      const board = parseBoard("0".repeat(81));
      const before = board.toString();

      expect(() => getHint(board)).toThrow(HintUnavailableError);
      expect(board.toString()).toBe(before);

      try {
        getHint(board);
      } catch (error) {
        expect(error).toBeInstanceOf(HintUnavailableError);
        expect((error as HintUnavailableError).reason).toBe("no_logical_hint");
      }
    });

    test("hint provides different hints on different calls", () => {
      const board = parseBoard(BASE_HINT_PUZZLE);
      const hint1 = getHint(board);

      // Make the suggested move
      board.setValue(hint1.row, hint1.col, hint1.value);

      const hint2 = getHint(board);

      // Second hint should be different (different cell or value)
      const isDifferent =
        hint1.row !== hint2.row || hint1.col !== hint2.col || hint1.value !== hint2.value;
      expect(isDifferent).toBe(true);
    });
  });

  describe("requestHint", () => {
    test("maps distinct failure reasons into stable result fields", () => {
      const solved = parseBoard(
        "534678912672195348198342567859761423426853791713924856961537284287419635345286179",
      );
      const contradictory = parseBoard(
        "554678912672195348198342567859761423426853791713924856961537284287419635345286179",
      );
      const noLogical = parseBoard("0".repeat(81));

      expect(requestHint(solved)).toMatchObject({ hint: null, failure: "solved" });
      expect(requestHint(contradictory)).toMatchObject({ hint: null, failure: "contradictory" });
      expect(requestHint(noLogical)).toMatchObject({ hint: null, failure: "no_logical_hint" });
    });

    test("classifies unexpected engine exceptions separately from no-logical-hint", () => {
      const explosiveBoard = {
        isSolved: () => false,
        hasContradiction: () => false,
        getCell: () => {
          throw new Error("simulated hint engine fault");
        },
      } as unknown as Board;

      expect(requestHint(explosiveBoard)).toMatchObject({
        hint: null,
        failure: "unexpected_error",
      });
    });

    test("exposes visibly distinct status text for success and each failure class", () => {
      const success = requestHint(parseBoard(DEEPER_POINTING_PAIR_FIXTURE.puzzle)).status;
      const solved = requestHint(
        parseBoard(
          "534678912672195348198342567859761423426853791713924856961537284287419635345286179",
        ),
      ).status;
      const contradictory = requestHint(
        parseBoard(
          "554678912672195348198342567859761423426853791713924856961537284287419635345286179",
        ),
      ).status;
      const noLogical = requestHint(parseBoard("0".repeat(81))).status;
      const unexpected = requestHint({
        isSolved: () => false,
        hasContradiction: () => false,
        getCell: () => {
          throw new Error("boom");
        },
      } as unknown as Board).status;

      expect(success).toMatch(/^Hint r\d+c\d+=\d:/);
      expect(solved).toContain("already solved");
      expect(contradictory).toContain("contradictions");
      expect(noLogical).toContain("No logically justified hint");
      expect(unexpected).toContain("Unexpected hint failure");
    });
  });
});
