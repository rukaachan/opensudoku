import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { parseDailyDateKey, toDailyDateKey, type DailyDateKey } from "../../domain/daily";

interface DailyCompletionStoreShape {
  v: 1;
  c: Record<string, number>;
}

function getDefaultDataRoot(): string {
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData && localAppData.trim() !== "") return localAppData;
  return join(homedir(), "AppData", "Local");
}

export function resolveDailyCompletionStorePath(dataRootOverride?: string): string {
  const dataRoot =
    dataRootOverride && dataRootOverride.trim() !== "" ? dataRootOverride : getDefaultDataRoot();
  return join(dataRoot, "OpenSudoku", "daily-completions.json");
}

function readStore(storePath: string): DailyCompletionStoreShape {
  try {
    if (!existsSync(storePath)) return { v: 1, c: {} };
    const parsed = JSON.parse(
      readFileSync(storePath, "utf8"),
    ) as Partial<DailyCompletionStoreShape>;
    if (parsed.v !== 1 || typeof parsed.c !== "object" || parsed.c === null) return { v: 1, c: {} };
    const cleaned: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed.c)) {
      if (typeof value === "number" && parseDailyDateKey(key as DailyDateKey)) {
        cleaned[key] = value;
      }
    }
    return { v: 1, c: cleaned };
  } catch {
    return { v: 1, c: {} };
  }
}

function writeStore(storePath: string, store: DailyCompletionStoreShape): void {
  mkdirSync(dirname(storePath), { recursive: true });
  writeFileSync(storePath, JSON.stringify(store), "utf8");
}

function shiftUtcDateKey(dateKey: DailyDateKey, deltaDays: number): DailyDateKey {
  const parsed = parseDailyDateKey(dateKey);
  if (!parsed) return toDailyDateKey(new Date(0));
  parsed.setUTCDate(parsed.getUTCDate() + deltaDays);
  return toDailyDateKey(parsed);
}

export function recordDailyCompletion(
  storePath: string,
  dateKey: DailyDateKey,
  completedAtMs: number,
): void {
  if (!parseDailyDateKey(dateKey)) return;
  const store = readStore(storePath);
  const safeCompletedAt = Math.max(0, Math.floor(completedAtMs));
  const existing = store.c[dateKey] ?? null;
  store.c[dateKey] = existing === null ? safeCompletedAt : Math.min(existing, safeCompletedAt);
  writeStore(storePath, store);
}

export function recordDailyCompletionByTimestamp(
  storePath: string,
  completedAtMs: number,
): DailyDateKey {
  return toDailyDateKey(new Date(completedAtMs));
}

export function listCompletedDailyDateKeys(storePath: string): DailyDateKey[] {
  const store = readStore(storePath);
  return Object.keys(store.c)
    .filter((key): key is DailyDateKey => parseDailyDateKey(key as DailyDateKey) !== null)
    .sort();
}

export function getLatestCompletedDailyDateKey(storePath: string): DailyDateKey | null {
  const keys = listCompletedDailyDateKeys(storePath);
  return keys.length > 0 ? keys[keys.length - 1] : null;
}

export function getDailyStreakCount(storePath: string, nowMs: number): number {
  const todayKey = toDailyDateKey(new Date(nowMs));
  const store = readStore(storePath);
  const eligibleKeys = Object.keys(store.c).filter(
    (key) => key <= todayKey && parseDailyDateKey(key as DailyDateKey),
  );
  if (eligibleKeys.length === 0) return 0;

  const eligibleSet = new Set(eligibleKeys);
  const yesterdayKey = shiftUtcDateKey(todayKey, -1);
  let cursor: DailyDateKey | null = eligibleSet.has(todayKey)
    ? todayKey
    : eligibleSet.has(yesterdayKey)
      ? yesterdayKey
      : null;
  if (!cursor) return 0;

  let streak = 0;
  while (eligibleSet.has(cursor)) {
    streak += 1;
    cursor = shiftUtcDateKey(cursor, -1);
  }
  return streak;
}
