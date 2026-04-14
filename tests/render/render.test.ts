/**
 * Render tests for OpenSudoku TUI testing
 *
 * IMPORTANT: These tests verify meaningful harness behavior using real OpenTUI primitives:
 * - createOpenTUIHarness creates a real OpenTUI test renderer
 * - renderOnce performs a real render pass
 * - captureSpans/captureCharFrame capture actual frame output
 * - Tests prove a genuine render pass/frame assertion path with exact text and span styling
 */
import { describe, test, expect } from "bun:test";
import {
  createOpenTUIHarness,
  captureFrame,
  renderBoardFixture,
  verifyBoardRender,
  validateBoardFixture,
  type MockSelection,
} from "./helpers";

const padRow = (row: string) => row.padEnd(80, " ");

describe("Render infrastructure", () => {
  describe("createOpenTUIHarness - real OpenTUI test renderer", () => {
    test("creates harness with real OpenTUI test renderer", async () => {
      const harness = await createOpenTUIHarness({ width: 80, height: 24 });

      // Verify we got a real test renderer with all expected methods
      expect(harness).toHaveProperty("renderOnce");
      expect(harness).toHaveProperty("captureSpans");
      expect(harness).toHaveProperty("captureCharFrame");
      expect(harness).toHaveProperty("resize");
      expect(harness).toHaveProperty("cleanup");

      // The underlying renderer should exist
      expect(harness.renderer).toBeDefined();

      harness.cleanup();
    });

    test("creates harness with custom dimensions", async () => {
      const harness = await createOpenTUIHarness({ width: 120, height: 40 });

      // Resize and verify dimensions are applied
      harness.resize(120, 40);

      const spans = harness.captureSpans();
      expect(spans.cols).toBeGreaterThan(0);
      expect(spans.rows).toBeGreaterThan(0);

      harness.cleanup();
    });
  });

  describe("captureFrame - real OpenTUI harness behavior", () => {
    test("captures frame with correct dimensions from real render pass", async () => {
      const result = await captureFrame({ width: 80, height: 24 });

      // The harness should produce real output dimensions
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);

      // Content should have actual rendered lines (may have trailing newline, so use >=)
      expect(result.content.length).toBeGreaterThanOrEqual(result.height);

      // Spans should have actual span data
      expect(result.spans).toHaveProperty("lines");
      expect(result.spans.cols).toBe(result.width);
      expect(result.spans.rows).toBe(result.height);
    });

    test("captureFrame with custom dimensions uses those dimensions", async () => {
      const result = await captureFrame({ width: 120, height: 40 });

      expect(result.width).toBe(120);
      expect(result.height).toBe(40);
      // Content may have trailing newline, so use >= instead of exact match
      expect(result.content.length).toBeGreaterThanOrEqual(40);
    });
  });

  describe("validateBoardFixture - explicit failure on invalid input", () => {
    test("valid 9x9 board passes validation", () => {
      const validBoard = [
        [5, 3, 0, 0, 7, 0, 0, 0, 0],
        [6, 0, 0, 1, 9, 5, 0, 0, 0],
        [0, 9, 8, 0, 0, 0, 0, 6, 0],
        [8, 0, 0, 0, 6, 0, 0, 0, 3],
        [4, 0, 0, 8, 0, 3, 0, 0, 1],
        [7, 0, 0, 0, 2, 0, 0, 0, 6],
        [0, 6, 0, 0, 0, 0, 2, 8, 0],
        [0, 0, 0, 4, 1, 9, 0, 0, 5],
        [0, 0, 0, 0, 8, 0, 0, 7, 9],
      ];

      // Should not throw for valid board
      expect(() => validateBoardFixture({ board: validBoard })).not.toThrow();
    });

    test("invalid board with extra rows fails explicitly", () => {
      const invalidBoard = Array(10)
        .fill(null)
        .map(() => [1, 2, 3, 4, 5, 6, 7, 8, 9]);

      // Should throw with explicit error
      expect(() => validateBoardFixture({ board: invalidBoard })).toThrow(
        "Invalid board: expected 9 rows, got 10",
      );
    });

    test("invalid cell value fails explicitly", () => {
      const invalidBoard = [
        [5, 3, 0, 0, 7, 0, 0, 0, 0],
        [6, 0, 0, 1, 9, 5, 0, 0, 0],
        [0, 9, 8, 0, 0, 0, 0, 6, 0],
        [8, 0, 0, 0, 6, 0, 0, 0, 3],
        [4, 0, 0, 8, 0, 3, 0, 0, 1],
        [7, 0, 0, 0, 2, 0, 0, 0, 6],
        [0, 6, 0, 0, 0, 0, 2, 8, 0],
        [0, 0, 0, 4, 1, 9, 0, 0, 15], // Invalid: 15 > 9
        [0, 0, 0, 0, 8, 0, 0, 7, 9],
      ];

      expect(() => validateBoardFixture({ board: invalidBoard })).toThrow(
        "Invalid board: cell [7,8] has value 15, expected 0-9",
      );
    });

    test("invalid selection fails explicitly", () => {
      const validBoard = Array(9)
        .fill(null)
        .map(() => Array(9).fill(0));
      const invalidSelection: MockSelection = { row: 10, col: 5 };

      expect(() =>
        validateBoardFixture({ board: validBoard, selection: invalidSelection }),
      ).toThrow("Invalid selection: [10,5] out of bounds");
    });
  });

  describe("verifyBoardRender - meaningful output assertions", () => {
    test("renderBoardFixture mounts a deterministic board and captures exact row text", async () => {
      const validBoard = [
        [5, 3, 0, 0, 7, 0, 0, 0, 0],
        [6, 0, 0, 1, 9, 5, 0, 0, 0],
        [0, 9, 8, 0, 0, 0, 0, 6, 0],
        [8, 0, 0, 0, 6, 0, 0, 0, 3],
        [4, 0, 0, 8, 0, 3, 0, 0, 1],
        [7, 0, 0, 0, 2, 0, 0, 0, 6],
        [0, 6, 0, 0, 0, 0, 2, 8, 0],
        [0, 0, 0, 4, 1, 9, 0, 0, 5],
        [0, 0, 0, 0, 8, 0, 0, 7, 9],
      ];

      const result = await renderBoardFixture({ board: validBoard });

      expect(result.content.slice(0, 9)).toEqual([
        padRow(" 5  3  .  .  7  .  .  .  . "),
        padRow(" 6  .  .  1  9  5  .  .  . "),
        padRow(" .  9  8  .  .  .  .  6  . "),
        padRow(" 8  .  .  .  6  .  .  .  3 "),
        padRow(" 4  .  .  8  .  3  .  .  1 "),
        padRow(" 7  .  .  .  2  .  .  .  6 "),
        padRow(" .  6  .  .  .  .  2  8  . "),
        padRow(" .  .  .  4  1  9  .  .  5 "),
        padRow(" .  .  .  .  8  .  .  7  9 "),
      ]);
    });

    test("board with selection renders exact rows and distinct selected-cell span styling", async () => {
      const board = [
        [5, 3, 0, 0, 7, 0, 0, 0, 0],
        [6, 0, 0, 1, 9, 5, 0, 0, 0],
        [0, 9, 8, 0, 0, 0, 0, 6, 0],
        [8, 0, 0, 0, 6, 0, 0, 0, 3],
        [4, 0, 0, 8, 0, 3, 0, 0, 1],
        [7, 0, 0, 0, 2, 0, 0, 0, 6],
        [0, 6, 0, 0, 0, 0, 2, 8, 0],
        [0, 0, 0, 4, 1, 9, 0, 0, 5],
        [0, 0, 0, 0, 8, 0, 0, 7, 9],
      ];

      const result = await verifyBoardRender(board, { row: 0, col: 0 });

      expect(result.rowLines).toEqual([
        padRow(" 5  3  .  .  7  .  .  .  . "),
        padRow(" 6  .  .  1  9  5  .  .  . "),
        padRow(" .  9  8  .  .  .  .  6  . "),
        padRow(" 8  .  .  .  6  .  .  .  3 "),
        padRow(" 4  .  .  8  .  3  .  .  1 "),
        padRow(" 7  .  .  .  2  .  .  .  6 "),
        padRow(" .  6  .  .  .  .  2  8  . "),
        padRow(" .  .  .  4  1  9  .  .  5 "),
        padRow(" .  .  .  .  8  .  .  7  9 "),
      ]);
      expect(result.rowText).toBe(result.rowLines.join("\n"));
      expect(result.selectedCellHasDistinctStyle).toBe(true);
      expect(result.selectedCellSpan?.text).toBe(" 5 ");
      expect(result.unselectedCellSpan?.text).toContain(" 3 ");
      expect(result.selectedCellSpan?.bg).not.toEqual(result.unselectedCellSpan?.bg);
      expect(result.selectedCellSpan?.fg).not.toEqual(result.unselectedCellSpan?.fg);
      expect(result.selectedCellSpan?.attributes).not.toBe(result.unselectedCellSpan?.attributes);
    });

    test("invalid board with extra rows fails", async () => {
      const invalidBoard = Array(10)
        .fill(null)
        .map(() => [1, 2, 3, 4, 5, 6, 7, 8, 9]);

      await expect(verifyBoardRender(invalidBoard)).rejects.toThrow(
        "Invalid board: expected 9 rows, got 10",
      );
    });

    test("invalid cell value fails", async () => {
      const invalidBoard = [
        [5, 3, 0, 0, 7, 0, 0, 0, 0],
        [6, 0, 0, 1, 9, 5, 0, 0, 0],
        [0, 9, 8, 0, 0, 0, 0, 6, 0],
        [8, 0, 0, 0, 6, 0, 0, 0, 3],
        [4, 0, 0, 8, 0, 3, 0, 0, 1],
        [7, 0, 0, 0, 2, 0, 0, 0, 6],
        [0, 6, 0, 0, 0, 0, 2, 8, 0],
        [0, 0, 0, 4, 1, 9, 0, 0, 15], // Invalid: 15 > 9
        [0, 0, 0, 0, 8, 0, 0, 7, 9],
      ];

      await expect(verifyBoardRender(invalidBoard)).rejects.toThrow(
        "Invalid board: cell [7,8] has value 15, expected 0-9",
      );
    });
  });
});
