import { stat } from "node:fs/promises";
import { resolve } from "path";

export interface SmokeEvidence {
  timestamp: string;
  exitCode: number;
  checks: Array<{ name: string; passed: boolean }>;
  artifacts?: { liveStartupTranscript?: string };
}

export interface BenchEvidence {
  timestamp: string;
  suite: string;
  exitCode: number;
  benchmarks: Array<{ name: string; durationMs: number; runs: number }>;
}

export interface LiveTranscriptEvidence {
  timestamp: string;
  phases: Array<{
    phase: "startup-root" | "play-entry" | "first-input" | "clean-exit";
    observed: boolean;
    signal?: string;
    signalIndex?: number;
  }>;
}

export interface HotPathEvidence {
  generatedAt: string;
  benchmarkTimestamp: string;
  suite: string;
  benchOutputPath: string;
  metrics: Array<{ name: string; durationMs: number; runs: number; avgDurationMs: number }>;
}

export interface ArtifactReadback {
  path: string;
  exists: boolean;
  readable: boolean;
  sizeBytes: number;
  modifiedAt: string | null;
}

const STALE_ARTIFACT_MAX_AGE_MS = 15 * 60 * 1000;
const toCanonicalPath = (value: string): string => resolve(value).toLowerCase();

const parseIsoTimestamp = (value: string, label: string): Date => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} is not a valid ISO timestamp`);
  return parsed;
};

const ensureFreshTimestamp = (value: string, label: string, now: Date): Date => {
  const parsed = parseIsoTimestamp(value, label);
  const ageMs = now.getTime() - parsed.getTime();
  if (ageMs < -60_000) throw new Error(`${label} is in the future`);
  if (ageMs > STALE_ARTIFACT_MAX_AGE_MS) throw new Error(`${label} is stale (ageMs=${ageMs})`);
  return parsed;
};

const readJsonArtifact = async <T>(path: string, label: string): Promise<T> => {
  const file = Bun.file(path);
  if (!(await file.exists())) throw new Error(`${label} is missing at ${path}`);
  let raw = "";
  try {
    raw = await file.text();
  } catch {
    throw new Error(`${label} is unreadable at ${path}`);
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`${label} is unreadable JSON at ${path}`);
  }
};

const expectPhase = (
  transcript: LiveTranscriptEvidence,
  phaseName: "startup-root" | "play-entry" | "first-input" | "clean-exit",
  requireSignal: boolean,
): { signal: string; signalIndex: number } => {
  const phase = transcript.phases.find((candidate) => candidate.phase === phaseName);
  if (!phase || !phase.observed)
    throw new Error(`live transcript missing observed phase ${phaseName}`);
  if (!requireSignal) return { signal: "", signalIndex: -1 };
  if (typeof phase.signal !== "string" || phase.signal.length === 0)
    throw new Error(`live transcript phase ${phaseName} missing signal`);
  if (typeof phase.signalIndex !== "number" || phase.signalIndex < 0)
    throw new Error(`live transcript phase ${phaseName} missing signal index`);
  return { signal: phase.signal, signalIndex: phase.signalIndex };
};

export async function readArtifact(path: string): Promise<ArtifactReadback> {
  const file = Bun.file(path);
  const exists = await file.exists();
  if (!exists) return { path, exists: false, readable: false, sizeBytes: 0, modifiedAt: null };

  let readable = false;
  try {
    await file.text();
    readable = true;
  } catch {
    readable = false;
  }
  const fileStat = await stat(path);
  return {
    path,
    exists: true,
    readable,
    sizeBytes: fileStat.size,
    modifiedAt: fileStat.mtime.toISOString(),
  };
}

export async function validateBenchArtifact(
  path: string,
  expectedSuite: string,
): Promise<BenchEvidence> {
  const now = new Date();
  const bench = await readJsonArtifact<BenchEvidence>(path, "benchmark artifact");
  if (bench.exitCode !== 0) throw new Error("benchmark artifact indicates failed run");
  if (bench.suite !== expectedSuite)
    throw new Error("benchmark artifact suite is out-of-sync with requested suite");
  if (!Array.isArray(bench.benchmarks) || bench.benchmarks.length === 0)
    throw new Error("benchmark artifact appears placeholder-only");
  for (const metric of bench.benchmarks) {
    if (typeof metric.name !== "string" || metric.name.length === 0)
      throw new Error("benchmark artifact contains placeholder metric names");
    if (
      !Number.isFinite(metric.durationMs) ||
      metric.durationMs <= 0 ||
      !Number.isFinite(metric.runs) ||
      metric.runs <= 0
    ) {
      throw new Error("benchmark artifact contains placeholder metric values");
    }
  }
  ensureFreshTimestamp(bench.timestamp, "benchmark artifact timestamp", now);
  return bench;
}

export async function validateSmokeAndTranscriptArtifacts(
  smokePath: string,
  expectedTranscriptPath: string,
): Promise<void> {
  const now = new Date();
  const smoke = await readJsonArtifact<SmokeEvidence>(smokePath, "smoke artifact");
  if (smoke.exitCode !== 0) throw new Error("smoke artifact indicates failed run");
  const smokeLiveCheck = smoke.checks.find(
    (check) => check.name === "live-startup-root-play-first-input-clean-exit",
  );
  if (!smokeLiveCheck?.passed)
    throw new Error("smoke artifact is missing a passing live startup/play/input/exit check");
  ensureFreshTimestamp(smoke.timestamp, "smoke artifact timestamp", now);

  const transcriptPath = smoke.artifacts?.liveStartupTranscript;
  if (!transcriptPath) throw new Error("smoke artifact is missing live transcript reference");
  if (toCanonicalPath(transcriptPath) !== toCanonicalPath(expectedTranscriptPath)) {
    throw new Error("smoke artifact transcript path is out-of-sync with expected transcript path");
  }

  const transcript = await readJsonArtifact<LiveTranscriptEvidence>(
    transcriptPath,
    "live transcript artifact",
  );
  const transcriptTime = ensureFreshTimestamp(
    transcript.timestamp,
    "live transcript timestamp",
    now,
  );
  const smokeTime = parseIsoTimestamp(smoke.timestamp, "smoke artifact timestamp");
  if (Math.abs(transcriptTime.getTime() - smokeTime.getTime()) > 120_000) {
    throw new Error("live transcript timestamp is out-of-sync with smoke artifact timestamp");
  }

  const startup = expectPhase(transcript, "startup-root", true);
  const playEntry = expectPhase(transcript, "play-entry", true);
  const firstInput = expectPhase(transcript, "first-input", true);
  expectPhase(transcript, "clean-exit", false);
  if (firstInput.signal === playEntry.signal)
    throw new Error("live transcript first-input signal must differ from play-entry signal");
  if (
    !(startup.signalIndex < playEntry.signalIndex && playEntry.signalIndex < firstInput.signalIndex)
  ) {
    throw new Error("live transcript startup/play-entry/first-input signal ordering is invalid");
  }
}

export async function validateHotPathArtifacts(options: {
  hotPathArtifactPaths: string[];
  expectedBenchPath: string;
  benchTimestamp: string;
  expectedSuite: string;
}): Promise<void> {
  if (options.hotPathArtifactPaths.length === 0)
    throw new Error("hot-path artifact list is missing");
  const now = new Date();
  const benchTime = parseIsoTimestamp(options.benchTimestamp, "benchmark artifact timestamp");
  for (const path of options.hotPathArtifactPaths) {
    const hotPath = await readJsonArtifact<HotPathEvidence>(path, "hot-path artifact");
    ensureFreshTimestamp(hotPath.generatedAt, "hot-path artifact generatedAt", now);
    const hotPathBenchTime = ensureFreshTimestamp(
      hotPath.benchmarkTimestamp,
      "hot-path artifact benchmarkTimestamp",
      now,
    );
    if (Math.abs(hotPathBenchTime.getTime() - benchTime.getTime()) > 120_000) {
      throw new Error(
        "hot-path artifact timestamp is out-of-sync with benchmark artifact timestamp",
      );
    }
    if (toCanonicalPath(hotPath.benchOutputPath) !== toCanonicalPath(options.expectedBenchPath)) {
      throw new Error("hot-path artifact bench path is out-of-sync with benchmark artifact path");
    }
    if (hotPath.suite !== options.expectedSuite)
      throw new Error("hot-path artifact suite is out-of-sync with requested suite");
    if (!Array.isArray(hotPath.metrics) || hotPath.metrics.length === 0)
      throw new Error("hot-path artifact is placeholder-only");
    for (const metric of hotPath.metrics) {
      if (typeof metric.name !== "string" || metric.name.length === 0)
        throw new Error("hot-path artifact has placeholder metric names");
      if (
        !Number.isFinite(metric.durationMs) ||
        metric.durationMs <= 0 ||
        !Number.isFinite(metric.runs) ||
        metric.runs <= 0 ||
        !Number.isFinite(metric.avgDurationMs) ||
        metric.avgDurationMs <= 0
      ) {
        throw new Error("hot-path artifact has placeholder metric values");
      }
    }
  }
}
