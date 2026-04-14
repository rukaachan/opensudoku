import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { GameplayState } from "./gameplay-state";

type GeneratedBestTimeScope = "generated:easy" | "generated:medium" | "generated:hard";
export type BestTimeScope = "normal" | GeneratedBestTimeScope | `daily:${string}`;

interface BestTimeStoreShape {
  v: 2;
  b: {
    n?: number;
    g?: Partial<Record<"easy" | "medium" | "hard", number>>;
    d?: Record<string, number>;
  };
}

interface ParsedBestTimeStoreShape {
  v?: 1 | 2;
  b?: {
    n?: unknown;
    g?: { easy?: unknown; medium?: unknown; hard?: unknown } | null;
    d?: Record<string, number> | null;
  } | null;
}

function getDefaultDataRoot(): string {
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData && localAppData.trim() !== "") return localAppData;
  return join(homedir(), "AppData", "Local");
}

export function resolveBestTimeStorePath(dataRootOverride?: string): string {
  const dataRoot =
    dataRootOverride && dataRootOverride.trim() !== "" ? dataRootOverride : getDefaultDataRoot();
  return join(dataRoot, "OpenSudoku", "best-times.json");
}

function readStore(storePath: string): BestTimeStoreShape {
  try {
    if (!existsSync(storePath)) return { v: 2, b: {} };
    const parsed = JSON.parse(readFileSync(storePath, "utf8")) as ParsedBestTimeStoreShape;
    if ((parsed.v !== 1 && parsed.v !== 2) || typeof parsed.b !== "object" || parsed.b === null)
      return { v: 2, b: {} };
    return {
      v: 2,
      b: {
        n: typeof parsed.b.n === "number" ? parsed.b.n : undefined,
        g:
          typeof parsed.b.g === "object" && parsed.b.g !== null
            ? {
                easy: typeof parsed.b.g.easy === "number" ? parsed.b.g.easy : undefined,
                medium: typeof parsed.b.g.medium === "number" ? parsed.b.g.medium : undefined,
                hard: typeof parsed.b.g.hard === "number" ? parsed.b.g.hard : undefined,
              }
            : undefined,
        d: typeof parsed.b.d === "object" && parsed.b.d !== null ? parsed.b.d : undefined,
      },
    };
  } catch {
    return { v: 2, b: {} };
  }
}

function writeStore(storePath: string, store: BestTimeStoreShape): void {
  mkdirSync(dirname(storePath), { recursive: true });
  writeFileSync(storePath, JSON.stringify(store), "utf8");
}

export function resolveBestTimeScope(state: GameplayState): BestTimeScope {
  if (state.activeSessionType === "daily" && state.activeDailyDateKey) {
    return `daily:${state.activeDailyDateKey}`;
  }
  if (
    state.activeSessionType === "generated" &&
    (state.activeDifficulty === "easy" ||
      state.activeDifficulty === "medium" ||
      state.activeDifficulty === "hard")
  ) {
    return `generated:${state.activeDifficulty}`;
  }
  return "normal";
}

export function readBestTimeMs(storePath: string, scope: BestTimeScope): number | null {
  const store = readStore(storePath);
  if (scope === "normal") return store.b.n ?? null;
  if (scope.startsWith("generated:"))
    return store.b.g?.[scope.slice("generated:".length) as "easy" | "medium" | "hard"] ?? null;
  const dateKey = scope.slice("daily:".length);
  return store.b.d?.[dateKey] ?? null;
}

export function recordBestTimeMs(
  storePath: string,
  scope: BestTimeScope,
  elapsedMs: number,
): number {
  const safeElapsed = Math.max(0, Math.floor(elapsedMs));
  const store = readStore(storePath);

  const current =
    scope === "normal"
      ? (store.b.n ?? null)
      : scope.startsWith("generated:")
        ? (store.b.g?.[scope.slice("generated:".length) as "easy" | "medium" | "hard"] ?? null)
        : (store.b.d?.[scope.slice("daily:".length)] ?? null);

  const next = current === null || safeElapsed < current ? safeElapsed : current;

  if (scope === "normal") {
    store.b.n = next;
  } else if (scope.startsWith("generated:")) {
    const difficulty = scope.slice("generated:".length) as "easy" | "medium" | "hard";
    store.b.g = store.b.g ?? {};
    store.b.g[difficulty] = next;
  } else {
    const dateKey = scope.slice("daily:".length);
    store.b.d = store.b.d ?? {};
    store.b.d[dateKey] = next;
  }

  writeStore(storePath, store);
  return next;
}
