import { Difficulty, createPuzzle, type PuzzleResult, type RandomSource } from "./generator";

export type DailyDateKey = `${number}-${number}-${number}`;

const DAY_MS = 24 * 60 * 60 * 1000;
const ROTATION: Difficulty[] = [Difficulty.Easy, Difficulty.Medium, Difficulty.Hard];

export interface DailyPuzzleResult extends PuzzleResult {
  dateKey: DailyDateKey;
}

export function parseDailyDateKey(dateKey: DailyDateKey): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return null;
  }

  const [yearStr, monthStr, dayStr] = dateKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return candidate;
}

export function toDailyDateKey(date: Date): DailyDateKey {
  const year = date.getUTCFullYear().toString().padStart(4, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}` as DailyDateKey;
}

export function getDailyDifficulty(date: Date): Difficulty {
  const dayIndex = Math.floor(date.getTime() / DAY_MS);
  const normalized = ((dayIndex % ROTATION.length) + ROTATION.length) % ROTATION.length;
  return ROTATION[normalized];
}

export function createDailyPuzzle(dateKey: DailyDateKey): DailyPuzzleResult {
  const date = parseDailyDateKey(dateKey);
  if (!date) {
    return {
      status: "error",
      puzzle: null,
      message: `Invalid daily date key: ${dateKey}`,
      dateKey,
    };
  }

  const difficulty = getDailyDifficulty(date);
  const rng = createSeededRandom(hashDateKey(dateKey));
  const result = createPuzzle(difficulty, { rng });

  if (result.status !== "success" || !result.puzzle || !result.solution || !result.difficulty) {
    return {
      status: "error",
      puzzle: null,
      message: result.message ?? `Failed to build daily puzzle for ${dateKey}`,
      dateKey,
    };
  }

  return {
    ...result,
    dateKey,
  };
}

function hashDateKey(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
