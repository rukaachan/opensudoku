import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export type GeneratedProgressDifficulty = "easy" | "medium" | "hard";

export interface ProgressSummary {
  generalSolves: number;
  assistedSolves: number;
  challengeWins: number;
  bestNormalMs: number | null;
  bestEasyMs: number | null;
  bestMediumMs: number | null;
  bestHardMs: number | null;
  dailyStreakCount: number;
  latestDailyCompletion: string | null;
}

interface ProgressionStoreShape {
  v: 1;
  s: {
    g: number;
    a: number;
    c: number;
    n: number;
    ge: Record<GeneratedProgressDifficulty, number>;
    d: Record<string, number>;
  };
  x: {
    completedSessions: Record<string, true>;
  };
}

function getDefaultDataRoot(): string {
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData && localAppData.trim() !== "") return localAppData;
  return join(homedir(), "AppData", "Local");
}

function createDefaultStore(): ProgressionStoreShape {
  return {
    v: 1,
    s: {
      g: 0,
      a: 0,
      c: 0,
      n: 0,
      ge: { easy: 0, medium: 0, hard: 0 },
      d: {},
    },
    x: { completedSessions: {} },
  };
}

export function resolveProgressionStorePath(dataRootOverride?: string): string {
  const dataRoot =
    dataRootOverride && dataRootOverride.trim() !== "" ? dataRootOverride : getDefaultDataRoot();
  return join(dataRoot, "OpenSudoku", "progression.json");
}

function readStore(storePath: string): ProgressionStoreShape {
  try {
    if (!existsSync(storePath)) return createDefaultStore();
    const parsed = JSON.parse(readFileSync(storePath, "utf8")) as Partial<ProgressionStoreShape>;
    const base = createDefaultStore();
    if (
      parsed.v !== 1 ||
      typeof parsed.s !== "object" ||
      parsed.s === null ||
      typeof parsed.x !== "object" ||
      parsed.x === null
    ) {
      return base;
    }
    return {
      v: 1,
      s: {
        g: typeof parsed.s.g === "number" ? parsed.s.g : 0,
        a: typeof parsed.s.a === "number" ? parsed.s.a : 0,
        c: typeof parsed.s.c === "number" ? parsed.s.c : 0,
        n: typeof parsed.s.n === "number" ? parsed.s.n : 0,
        ge: {
          easy: typeof parsed.s.ge?.easy === "number" ? parsed.s.ge.easy : 0,
          medium: typeof parsed.s.ge?.medium === "number" ? parsed.s.ge.medium : 0,
          hard: typeof parsed.s.ge?.hard === "number" ? parsed.s.ge.hard : 0,
        },
        d:
          typeof parsed.s.d === "object" && parsed.s.d !== null
            ? Object.fromEntries(
                Object.entries(parsed.s.d).filter(([, value]) => typeof value === "number"),
              )
            : {},
      },
      x: {
        completedSessions:
          typeof parsed.x.completedSessions === "object" && parsed.x.completedSessions !== null
            ? Object.fromEntries(Object.keys(parsed.x.completedSessions).map((key) => [key, true]))
            : {},
      },
    };
  } catch {
    return createDefaultStore();
  }
}

function writeStore(storePath: string, store: ProgressionStoreShape): void {
  mkdirSync(dirname(storePath), { recursive: true });
  writeFileSync(storePath, JSON.stringify(store), "utf8");
}

export function recordSolveProgress(
  storePath: string,
  options: {
    sessionId: string | null;
    sessionType: "normal" | "generated" | "daily" | null;
    generatedDifficulty: GeneratedProgressDifficulty | null;
    creditedDailyDateKey: string | null;
    assisted: boolean;
    challengeWin: boolean;
  },
): boolean {
  const store = readStore(storePath);
  if (options.sessionId && store.x.completedSessions[options.sessionId]) return false;

  store.s.g += 1;
  if (options.assisted) store.s.a += 1;
  if (options.challengeWin) store.s.c += 1;

  if (options.sessionType === "normal") {
    store.s.n += 1;
  } else if (options.sessionType === "generated" && options.generatedDifficulty) {
    store.s.ge[options.generatedDifficulty] += 1;
  } else if (options.sessionType === "daily" && options.creditedDailyDateKey) {
    store.s.d[options.creditedDailyDateKey] = (store.s.d[options.creditedDailyDateKey] ?? 0) + 1;
  }

  if (options.sessionId) store.x.completedSessions[options.sessionId] = true;
  writeStore(storePath, store);
  return true;
}

export function readProgressCounts(storePath: string): ProgressionStoreShape["s"] {
  return readStore(storePath).s;
}

export function hasCompletedSession(storePath: string, sessionId: string | null): boolean {
  if (!sessionId) return false;
  return Boolean(readStore(storePath).x.completedSessions[sessionId]);
}
