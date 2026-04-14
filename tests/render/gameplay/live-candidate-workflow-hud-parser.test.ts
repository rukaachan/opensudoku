import { describe, expect, test } from "bun:test";

import { parseRequiredHudLines } from "../../../scripts/live/live-candidate-workflow-hud.ts";

describe("live candidate workflow HUD parser", () => {
  test("parses real standalone Mode/Status/Active/Hints lines", () => {
    const frame = [
      "OpenSudoku Play",
      "Mode: NOTES",
      "Status: Hint available",
      "Active: 7",
      "Hints: 1",
    ].join("\n");

    expect(parseRequiredHudLines(frame)).toEqual({
      Mode: "Mode: NOTES",
      Status: "Status: Hint available",
      Active: "Active: 7",
      Hints: "Hints: 1",
    });
  });

  test("rejects wrapped status fragments that only contain Active/Hints substrings", () => {
    const frame = [
      "OpenSudoku Play",
      "Mode: NOTES",
      "Status: Hint: r1c3=1 Active: 1 Hints: 1",
    ].join("\n");

    expect(() => parseRequiredHudLines(frame)).toThrow("Malformed HUD line for 'Status:'");
  });

  test("parses standalone Active line that also carries Hints on the same visible HUD row", () => {
    const frame = [
      "OpenSudoku Play",
      "Mode: NOTES",
      "Status: Hint available",
      "Active: 4  Hints: 1",
    ].join("\n");

    expect(parseRequiredHudLines(frame)).toEqual({
      Mode: "Mode: NOTES",
      Status: "Status: Hint available",
      Active: "Active: 4",
      Hints: "Hints: 1",
    });
  });
});
