import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

type TerminalCue = "fail" | "success" | "complete";

interface CueEvent {
  sequence: number;
  cue: TerminalCue;
  tone: string;
  timestamp: string;
}

interface CueEvidenceArtifact {
  schemaVersion: 1;
  pid: number;
  startedAt: string;
  events: CueEvent[];
}

const LIVE_CUE_ARTIFACT_ENV = "OPEN_SUDOKU_LIVE_CUE_EVIDENCE_PATH";
let cachedPath: string | null = null;
let cachedArtifact: CueEvidenceArtifact | null = null;

function createFreshArtifact(): CueEvidenceArtifact {
  return {
    schemaVersion: 1,
    pid: process.pid,
    startedAt: new Date().toISOString(),
    events: [],
  };
}

function loadArtifact(path: string): CueEvidenceArtifact {
  if (cachedPath === path && cachedArtifact) return cachedArtifact;

  cachedPath = path;
  cachedArtifact = createFreshArtifact();
  return cachedArtifact;
}

export function recordLiveCueEvidence(cue: TerminalCue, tone: string): void {
  const path = process.env[LIVE_CUE_ARTIFACT_ENV];
  if (!path) return;

  const artifact = loadArtifact(path);
  artifact.events.push({
    sequence: artifact.events.length + 1,
    cue,
    tone,
    timestamp: new Date().toISOString(),
  });

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(artifact, null, 2));
}
