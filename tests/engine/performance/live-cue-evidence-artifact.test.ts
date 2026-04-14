import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const LIVE_CUE_ARTIFACT_ENV = "OPEN_SUDOKU_LIVE_CUE_EVIDENCE_PATH";

describe("live cue evidence artifact freshness", () => {
  test("resets stale cue events at process start so each run writes fresh evidence only", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "opensudoku-live-cue-app-"));
    const cuePath = join(tempDir, "live-cue.events.json");

    try {
      const staleArtifact = {
        schemaVersion: 1,
        pid: 12345,
        startedAt: "2000-01-01T00:00:00.000Z",
        events: [
          { sequence: 1, cue: "fail", tone: "error", timestamp: "2000-01-01T00:00:01.000Z" },
          { sequence: 2, cue: "fail", tone: "error", timestamp: "2000-01-01T00:00:02.000Z" },
        ],
      };
      await writeFile(cuePath, JSON.stringify(staleArtifact, null, 2));
      process.env[LIVE_CUE_ARTIFACT_ENV] = cuePath;

      const modulePath = `../../../src/app/live-cue-evidence.ts?fresh=${Date.now()}`;
      const { recordLiveCueEvidence } = await import(modulePath);
      recordLiveCueEvidence("success", "chime");

      const raw = await readFile(cuePath, "utf8");
      const parsed = JSON.parse(raw) as { events?: Array<{ cue: string; sequence: number }> };
      expect(parsed.events).toHaveLength(1);
      expect(parsed.events?.[0]?.cue).toBe("success");
      expect(parsed.events?.[0]?.sequence).toBe(1);
    } finally {
      delete process.env[LIVE_CUE_ARTIFACT_ENV];
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
