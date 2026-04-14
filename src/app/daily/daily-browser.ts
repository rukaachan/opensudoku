import { parseDailyDateKey, toDailyDateKey, type DailyDateKey } from "../../domain/daily";

export type DailyBrowseMode = "month" | "year";

export function getTodayDailyDateKey(now: Date = new Date()): DailyDateKey {
  return toDailyDateKey(now);
}

export function shiftDailyDateKey(
  dateKey: DailyDateKey,
  unit: "day" | "month" | "year",
  delta: -1 | 1,
  preferredDay?: number,
): DailyDateKey {
  const parsed = parseDailyDateKey(dateKey) ?? parseDailyDateKey(getTodayDailyDateKey());
  if (!parsed) {
    return getTodayDailyDateKey();
  }

  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth();
  const day = parsed.getUTCDate();

  if (unit === "day") {
    const moved = new Date(Date.UTC(year, month, day + delta));
    return toDailyDateKey(moved);
  }

  if (unit === "month") {
    const movedMonth = month + delta;
    const targetYear = year + Math.floor(movedMonth / 12);
    const targetMonth = ((movedMonth % 12) + 12) % 12;
    const targetDay = preferredDay ?? day;
    const clampedDay = Math.min(targetDay, daysInUtcMonth(targetYear, targetMonth));
    return toDailyDateKey(new Date(Date.UTC(targetYear, targetMonth, clampedDay)));
  }

  const targetYear = year + delta;
  const targetDay = preferredDay ?? day;
  const clampedDay = Math.min(targetDay, daysInUtcMonth(targetYear, month));
  return toDailyDateKey(new Date(Date.UTC(targetYear, month, clampedDay)));
}

function daysInUtcMonth(year: number, zeroBasedMonth: number): number {
  return new Date(Date.UTC(year, zeroBasedMonth + 1, 0)).getUTCDate();
}
