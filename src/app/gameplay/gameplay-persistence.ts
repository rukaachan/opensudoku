import type { DailyDateKey } from "../../domain/daily";
import {
  readBestTimeMs as readBestTimeStoreMs,
  recordBestTimeMs as recordBestTimeStoreMs,
  type BestTimeScope,
} from "./best-time-store";
import {
  getDailyStreakCount as getDailyStoreStreakCount,
  getLatestCompletedDailyDateKey,
  listCompletedDailyDateKeys as listDailyStoreDateKeys,
  recordDailyCompletion as recordDailyStoreCompletion,
  recordDailyCompletionByTimestamp,
} from "../daily/daily-completion-store";
import {
  hasCompletedSession,
  readProgressCounts,
  type GeneratedProgressDifficulty,
  type ProgressSummary,
  recordSolveProgress,
} from "../progression/progression-store";

export interface GameplayPersistence {
  readBestTimeMs(scope: BestTimeScope): number | null;
  recordBestTimeMs(scope: BestTimeScope, elapsedMs: number): number;
  hasCompletedSession(sessionId: string | null): boolean;
  readProgressSummary(nowMs: number): ProgressSummary | null;
  listCompletedDailyDateKeys(): DailyDateKey[];
  recordDailyCompletion(dateKey: DailyDateKey, completedAtMs: number): void;
  recordDailyCompletionByTimestamp(completedAtMs: number): DailyDateKey;
  recordSolveProgress(options: {
    sessionId: string | null;
    sessionType: "normal" | "generated" | "daily" | null;
    generatedDifficulty: GeneratedProgressDifficulty | null;
    creditedDailyDateKey: string | null;
    assisted: boolean;
    challengeWin: boolean;
  }): boolean;
  getDailyStreakCount(nowMs: number): number;
}

export function createGameplayPersistence(
  bestTimeStorePath: string,
  dailyCompletionStorePath: string,
  progressionStorePath: string,
): GameplayPersistence {
  return {
    readBestTimeMs(scope: BestTimeScope): number | null {
      return readBestTimeStoreMs(bestTimeStorePath, scope);
    },
    recordBestTimeMs(scope: BestTimeScope, elapsedMs: number): number {
      return recordBestTimeStoreMs(bestTimeStorePath, scope, elapsedMs);
    },
    hasCompletedSession(sessionId: string | null): boolean {
      return hasCompletedSession(progressionStorePath, sessionId);
    },
    readProgressSummary(nowMs: number): ProgressSummary {
      const counts = readProgressCounts(progressionStorePath);
      return {
        generalSolves: counts.g,
        assistedSolves: counts.a,
        challengeWins: counts.c,
        bestNormalMs: readBestTimeStoreMs(bestTimeStorePath, "normal"),
        bestEasyMs: readBestTimeStoreMs(bestTimeStorePath, "generated:easy"),
        bestMediumMs: readBestTimeStoreMs(bestTimeStorePath, "generated:medium"),
        bestHardMs: readBestTimeStoreMs(bestTimeStorePath, "generated:hard"),
        dailyStreakCount: getDailyStoreStreakCount(dailyCompletionStorePath, nowMs),
        latestDailyCompletion: getLatestCompletedDailyDateKey(dailyCompletionStorePath),
      };
    },
    listCompletedDailyDateKeys(): DailyDateKey[] {
      return listDailyStoreDateKeys(dailyCompletionStorePath);
    },
    recordDailyCompletion(dateKey: DailyDateKey, completedAtMs: number): void {
      recordDailyStoreCompletion(dailyCompletionStorePath, dateKey, completedAtMs);
    },
    recordDailyCompletionByTimestamp(completedAtMs: number): DailyDateKey {
      return recordDailyCompletionByTimestamp(dailyCompletionStorePath, completedAtMs);
    },
    recordSolveProgress(options): boolean {
      return recordSolveProgress(progressionStorePath, options);
    },
    getDailyStreakCount(nowMs: number): number {
      return getDailyStoreStreakCount(dailyCompletionStorePath, nowMs);
    },
  };
}
