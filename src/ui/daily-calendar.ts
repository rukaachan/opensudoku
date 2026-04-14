import { RGBA, TextAttributes, TextRenderable, type CliRenderer } from "@opentui/core";
import type { GameplayViewModel } from "../app/gameplay";

const ROOT_TITLE_FG = RGBA.fromHex("#facc15");
const ROOT_FOCUS_FG = RGBA.fromHex("#111827");
const ROOT_FOCUS_BG = RGBA.fromHex("#facc15");
const ROOT_NORMAL_FG = RGBA.fromHex("#e5e7eb");
const ROOT_SEPARATOR_FG = RGBA.fromHex("#94a3b8");
const COMPLETED_FG = RGBA.fromHex("#facc15");

function getCenteredLeft(viewportWidth: number, contentWidth: number): number {
  return Math.max(0, Math.floor((viewportWidth - contentWidth) / 2));
}

function getCenterAlignedTop(viewportHeight: number, contentHeight: number): number {
  return Math.max(0, Math.floor((viewportHeight - contentHeight) / 2));
}

function toDisplayText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value === null || value === undefined) {
    return "Unavailable";
  }
  if (value instanceof Error) {
    return value.message || "Unavailable";
  }
  return "Unavailable";
}

function mountLine(
  renderer: CliRenderer,
  mounted: TextRenderable[],
  content: string,
  top: number,
  left: number,
  style?: {
    fg?: RGBA;
    bg?: RGBA;
    attributes?: number;
  },
): void {
  const line = new TextRenderable(renderer, {
    content,
    position: "absolute",
    top,
    left,
    fg: style?.fg,
    bg: style?.bg,
    attributes: style?.attributes,
  });
  renderer.root.add(line);
  mounted.push(line);
}

function normalizeDailyBrowseMode(value: unknown): string {
  return value === "month" || value === "year" ? value : "Unavailable";
}

export function mountDailyBrowseScreen(
  renderer: CliRenderer,
  viewModel: GameplayViewModel,
  mounted: TextRenderable[],
  viewportWidth: number,
  viewportHeight: number,
): void {
  const selected =
    viewModel.dailySelectedDateKey === null
      ? "Unavailable"
      : toDisplayText(viewModel.dailySelectedDateKey);
  const browseMode = normalizeDailyBrowseMode(viewModel.dailyBrowseMode);
  const metadataLine = `Selected: ${selected} | Browse: ${browseMode}`;
  const routineStatus = `Daily ${selected} • ${browseMode} view.`;
  const status = toDisplayText(viewModel.status);
  const showStatus =
    status !== "Unavailable" && status.trim().length > 0 && status !== routineStatus;
  const footerLine = `Browse: ↑/↓ day, ←/→ ${browseMode}; m month, y year, t today, Enter open, Esc return, q quit`;

  const hasMonthGrid =
    viewModel.dailyBrowseMode === "month" && viewModel.dailyCalendarMonth !== null;
  const calendarWidth = 28;
  const contentWidth = Math.max(
    metadataLine.length,
    footerLine.length,
    hasMonthGrid ? calendarWidth : 0,
  );
  const contentHeight = 2 + (showStatus ? 1 : 0) + (hasMonthGrid ? 8 : 0) + 1;
  const left = getCenteredLeft(viewportWidth, contentWidth);
  const top = getCenterAlignedTop(viewportHeight, contentHeight);

  mountLine(renderer, mounted, "Daily", top, left, {
    fg: ROOT_TITLE_FG,
    attributes: TextAttributes.BOLD,
  });
  mountLine(renderer, mounted, metadataLine, top + 1, left, { fg: ROOT_NORMAL_FG });

  let contentTop = top + 2;
  if (showStatus) {
    mountLine(renderer, mounted, `Status: ${status}`, contentTop, left, { fg: ROOT_NORMAL_FG });
    contentTop += 1;
  }

  if (hasMonthGrid && viewModel.dailyCalendarMonth) {
    const monthTop = contentTop;
    const monthLeft = getCenteredLeft(
      viewportWidth,
      Math.max(calendarWidth, viewModel.dailyCalendarMonth.monthLabel.length),
    );
    mountLine(renderer, mounted, viewModel.dailyCalendarMonth.monthLabel, monthTop, monthLeft, {
      fg: ROOT_TITLE_FG,
      attributes: TextAttributes.BOLD,
    });

    const weekdays = "Su  Mo  Tu  We  Th  Fr  Sa ";
    mountLine(
      renderer,
      mounted,
      weekdays,
      monthTop + 1,
      getCenteredLeft(viewportWidth, weekdays.length),
      {
        fg: ROOT_SEPARATOR_FG,
        attributes: TextAttributes.BOLD,
      },
    );

    const gridLeft = getCenteredLeft(viewportWidth, calendarWidth);
    viewModel.dailyCalendarMonth.weeks.forEach((week, weekIndex) => {
      week.forEach((cell, dayIndex) => {
        const token = `${cell.day.toString().padStart(2, " ")}${cell.isCompletedCurrentMonth ? "*" : " "} `;
        const fg = cell.isSelected
          ? ROOT_FOCUS_FG
          : cell.isCompletedCurrentMonth
            ? COMPLETED_FG
            : cell.inCurrentMonth
              ? ROOT_NORMAL_FG
              : ROOT_SEPARATOR_FG;
        const bg = cell.isSelected ? ROOT_FOCUS_BG : undefined;
        const attributes = cell.isSelected ? TextAttributes.BOLD : TextAttributes.NONE;

        const span = new TextRenderable(renderer, {
          content: token,
          position: "absolute",
          top: monthTop + 2 + weekIndex,
          left: gridLeft + dayIndex * 4,
          fg,
          bg,
          attributes,
        });
        renderer.root.add(span);
        mounted.push(span);
      });
    });

    mountLine(renderer, mounted, footerLine, monthTop + 8, left, { fg: ROOT_NORMAL_FG });
    return;
  }

  mountLine(renderer, mounted, footerLine, contentTop, left, { fg: ROOT_NORMAL_FG });
}
