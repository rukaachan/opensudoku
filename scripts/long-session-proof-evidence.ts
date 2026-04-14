#!/usr/bin/env bun

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  recordDailyCompletion,
  listCompletedDailyDateKeys,
} from "../src/app/daily/daily-completion-store";
import {
  buildDeepUndoRedoTrace,
  buildPersistenceArtifact,
  buildRejectedNoopHistoryTrace,
  bandMb,
  deltaMb,
} from "./long-session-phases";
import { runLivePhase } from "./long-session-runner";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const missionDir = join(repoRoot, "dist");
const outputDir = join(
  missionDir,
  "evidence",
  "long-session-stability",
  "long-session-proof-completion",
);
const canonicalOutputPath = join(
  repoRoot,
  "dist",
  "validation",
  "long-session-stability",
  "user-testing",
  "evidence",
  "long-session-stability-evidence.json",
);
const DAILY_STORE_PATH = join(outputDir, "daily-completions.json");
const EMPTY_BOARD = "0".repeat(81);

async function main() {
  await mkdir(outputDir, { recursive: true });
  const playIdle = await runLivePhase({
    repoRoot,
    name: "play-idle-90s",
    keySteps: [
      { atMs: 500, key: "p" },
      { atMs: 90_500, key: "d" },
      { atMs: 91_000, key: "a" },
    ],
    sampleTimesMs: [5_000, 15_000, 25_000, 35_000, 45_000, 55_000, 65_000, 75_000, 85_000, 95_000],
    durationMs: 96_000,
  });
  const rejected = await runLivePhase({
    repoRoot,
    name: "rejected-noop-200-inputs",
    keySteps: [
      { atMs: 500, key: "p" },
      ...Array.from({ length: 200 }, (_, i) => ({
        atMs: 3_000 + i * 20,
        key: i % 2 === 0 ? "5" : "w",
      })),
    ],
    sampleTimesMs: [2_800, 7_200, 8_800],
    durationMs: 9_000,
  });
  const accepted = await runLivePhase({
    repoRoot,
    name: "accepted-300-mutations",
    keySteps: [
      { atMs: 500, key: "p" },
      { atMs: 700, key: "n" },
      ...Array.from({ length: 300 }, (_, i) => ({
        atMs: 1_000 + i * 20,
        key: i % 2 === 0 ? "1" : "2",
      })),
    ],
    sampleTimesMs: [800, 2_500, 5_000, 8_000, 12_000, 17_000],
    durationMs: 18_000,
    startBoard: EMPTY_BOARD,
  });
  const cycles = [];
  for (let cycle = 1; cycle <= 5; cycle++) {
    const phase = await runLivePhase({
      repoRoot,
      name: `fresh-session-cycle-${cycle}`,
      keySteps: [
        { atMs: 300, key: "p" },
        { atMs: 1_000, key: "q" },
        { atMs: 1_300, key: "g" },
        { atMs: 2_000, key: "escape" },
        { atMs: 2_300, key: "d" },
        { atMs: 2_700, key: "enter" },
      ],
      sampleTimesMs: [3_000, 13_000],
      durationMs: 14_000,
    });
    cycles.push(phase);
  }
  const dailyNow = Date.UTC(2026, 3, 5, 12, 0, 0);
  recordDailyCompletion(DAILY_STORE_PATH, "2026-04-01", dailyNow + 30_000);
  recordDailyCompletion(DAILY_STORE_PATH, "2026-04-01", dailyNow - 30_000);
  recordDailyCompletion(DAILY_STORE_PATH, "2026-04-01", dailyNow + 90_000);
  recordDailyCompletion(DAILY_STORE_PATH, "2026-04-02", dailyNow + 120_000);
  const dailyRaw = JSON.parse(await readFile(DAILY_STORE_PATH, "utf8")) as {
    c: Record<string, number>;
  };
  const dailyReadback = {
    generatedAt: new Date().toISOString(),
    assertion: "VAL-LONG-006",
    completedDateKeys: listCompletedDailyDateKeys(DAILY_STORE_PATH),
    earliestPerDate: dailyRaw.c,
    check: {
      "2026-04-01": Math.min(dailyNow + 30_000, dailyNow - 30_000, dailyNow + 90_000),
      "2026-04-02": dailyNow + 120_000,
    },
    matchesExpected: dailyRaw.c["2026-04-01"] === dailyNow - 30_000,
  };
  const rejectedHistory = buildRejectedNoopHistoryTrace();
  const deepUndoRedo = buildDeepUndoRedoTrace(EMPTY_BOARD);
  const persistenceArtifact = buildPersistenceArtifact();
  const cycleChecks = cycles.map((cycle) => {
    const baseline = cycle.samples[0];
    const settled = cycle.samples.at(-1);
    const settleDeltaMb =
      baseline && settled ? deltaMb(baseline.privateBytes, settled.privateBytes) : null;
    return {
      phase: cycle.phase,
      baselineSampleElapsedMs: baseline?.elapsedMs ?? null,
      settleSampleElapsedMs: settled?.elapsedMs ?? null,
      settleDeltaMb,
      within25MbBand: settleDeltaMb !== null ? Math.abs(settleDeltaMb) <= 25 : false,
    };
  });
  const acceptedBaseline = accepted.samples[0] ?? null;
  const acceptedSettled = accepted.samples.at(-1) ?? null;
  const acceptedDelta =
    acceptedBaseline && acceptedSettled
      ? deltaMb(acceptedBaseline.privateBytes, acceptedSettled.privateBytes)
      : null;

  await writeFile(
    join(outputDir, "play-idle-90s-private-memory.json"),
    JSON.stringify(playIdle, null, 2),
  );
  await writeFile(
    join(outputDir, "rejected-noop-200-private-memory.json"),
    JSON.stringify(rejected, null, 2),
  );
  await writeFile(
    join(outputDir, "accepted-mutation-300-private-memory.json"),
    JSON.stringify(accepted, null, 2),
  );
  await writeFile(
    join(outputDir, "session-cycle-settle-private-memory.json"),
    JSON.stringify(
      { generatedAt: new Date().toISOString(), assertion: "VAL-LONG-004", cycles, cycleChecks },
      null,
      2,
    ),
  );
  await writeFile(
    join(outputDir, "rejected-noop-200-history-trace.json"),
    JSON.stringify(rejectedHistory, null, 2),
  );
  await writeFile(
    join(outputDir, "deep-undo-redo-checkpoints.json"),
    JSON.stringify(deepUndoRedo, null, 2),
  );
  await writeFile(
    join(outputDir, "daily-earliest-completion-readback.json"),
    JSON.stringify(dailyReadback, null, 2),
  );
  await writeFile(
    join(outputDir, "long-session-persistence-calls.json"),
    JSON.stringify(persistenceArtifact, null, 2),
  );

  const plateauBand = bandMb(playIdle.samples.slice(-6));
  const summary = {
    generatedAt: new Date().toISOString(),
    assertions: [
      "VAL-LONG-001",
      "VAL-LONG-002",
      "VAL-LONG-003",
      "VAL-LONG-004",
      "VAL-LONG-006",
      "VAL-LONG-007",
      "VAL-LONG-009",
    ],
    surface: "local-cli-tui-and-controller-harness",
    artifacts: {
      playIdle90s: join(outputDir, "play-idle-90s-private-memory.json"),
      rejectedNoop200: join(outputDir, "rejected-noop-200-private-memory.json"),
      rejectedNoopHistory: join(outputDir, "rejected-noop-200-history-trace.json"),
      acceptedMutation300: join(outputDir, "accepted-mutation-300-private-memory.json"),
      sessionCycleSettle: join(outputDir, "session-cycle-settle-private-memory.json"),
      deepUndoRedo: join(outputDir, "deep-undo-redo-checkpoints.json"),
      dailyEarliestPerDate: join(outputDir, "daily-earliest-completion-readback.json"),
      persistenceCalls: join(outputDir, "long-session-persistence-calls.json"),
    },
    checks: {
      valLong001: {
        responsive: playIdle.responsive,
        lastSixBandMb: plateauBand,
        within20MbBand: plateauBand <= 20,
      },
      valLong002: {
        inputCount: 200,
        memoryDeltaMb: rejected.privateMemoryDeltaMb,
        memoryDeltaWithin10Mb: Math.abs(rejected.privateMemoryDeltaMb) <= 10,
        undoUnchanged: rejectedHistory.undoUnchanged,
      },
      valLong003: {
        acceptedMutations: deepUndoRedo.acceptedMutations,
        undoReachedStart: deepUndoRedo.undoReachedStart,
        redoReachedEnd: deepUndoRedo.redoReachedEnd,
      },
      valLong004: {
        cycleCount: cycles.length,
        settleWindowSeconds: 10,
        everyCycleWithin25Mb: cycleChecks.every((c) => c.within25MbBand),
        cycleChecks,
      },
      valLong006: { earliestPerDateRetained: dailyReadback.matchesExpected },
      valLong009: {
        acceptedMutations: 300,
        baselineSample: acceptedBaseline,
        settleSample: acceptedSettled,
        memoryDeltaMb: acceptedDelta,
        memoryDeltaWithin120Mb: acceptedDelta !== null ? acceptedDelta <= 120 : false,
      },
    },
  };
  await writeFile(canonicalOutputPath, JSON.stringify(summary, null, 2));
}

await main();
