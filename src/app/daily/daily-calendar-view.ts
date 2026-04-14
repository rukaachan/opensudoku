import { parseDailyDateKey } from "../../domain/daily";
import type { DailyDateKey } from "../puzzle-tools";

export interface DailyCalendarCellView {
  dateKey: DailyDateKey;
  day: number;
  inCurrentMonth: boolean;
  isCompletedCurrentMonth: boolean;
  isSelected: boolean;
}

export interface DailyCalendarMonthView {
  monthLabel: string;
  weeks: DailyCalendarCellView[][];
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function toUtcDateKey(year: number, month: number, day: number): DailyDateKey {
  return `${year.toString().padStart(4, "0")}-${pad2(month + 1)}-${pad2(day)}` as DailyDateKey;
}

function sameUtcMonth(dateKey: DailyDateKey, monthKey: DailyDateKey): boolean {
  return dateKey.slice(0, 7) === monthKey.slice(0, 7);
}

export function buildDailyCalendarMonthView(
  selectedDateKey: DailyDateKey | null,
  completedDateKeys: DailyDateKey[],
  currentDateKey: DailyDateKey,
): DailyCalendarMonthView | null {
  if (!selectedDateKey) {
    return null;
  }
  const selected = parseDailyDateKey(selectedDateKey);
  if (!selected) {
    return null;
  }

  const selectedYear = selected.getUTCFullYear();
  const selectedMonth = selected.getUTCMonth();
  const monthLabel = selected.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const firstOfMonth = new Date(Date.UTC(selectedYear, selectedMonth, 1));
  const firstWeekday = firstOfMonth.getUTCDay();
  const gridStart = new Date(Date.UTC(selectedYear, selectedMonth, 1 - firstWeekday));
  const completedSet = new Set(completedDateKeys);
  const weeks: DailyCalendarCellView[][] = [];

  for (let week = 0; week < 6; week++) {
    const cells: DailyCalendarCellView[] = [];
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const cellDate = new Date(gridStart);
      cellDate.setUTCDate(gridStart.getUTCDate() + week * 7 + dayOffset);
      const dateKey = toUtcDateKey(
        cellDate.getUTCFullYear(),
        cellDate.getUTCMonth(),
        cellDate.getUTCDate(),
      );
      const inCurrentMonth = sameUtcMonth(dateKey, selectedDateKey);
      const inMarkerMonth = sameUtcMonth(dateKey, currentDateKey);
      cells.push({
        dateKey,
        day: cellDate.getUTCDate(),
        inCurrentMonth,
        isCompletedCurrentMonth: inMarkerMonth && completedSet.has(dateKey),
        isSelected: dateKey === selectedDateKey,
      });
    }
    weeks.push(cells);
  }

  return { monthLabel, weeks };
}
