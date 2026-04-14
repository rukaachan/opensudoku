import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const MAX_LOC = 300;

function lineCount(relativePath: string): number {
  const content = readFileSync(join(ROOT, relativePath), "utf8");
  return content.split(/\r?\n/).length;
}

describe("LoC compliance for board refactor targets", () => {
  test("src/domain/board.ts is at or under 300 lines", () => {
    expect(lineCount("src/domain/board.ts")).toBeLessThanOrEqual(MAX_LOC);
  });

  test("tests/engine/domain-board.test.ts is at or under 300 lines", () => {
    expect(lineCount("tests/engine/domain-board.test.ts")).toBeLessThanOrEqual(MAX_LOC);
  });
});
