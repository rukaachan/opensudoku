import type { GameplayViewModel } from "../app/gameplay";

function shouldShowStatus(status: unknown, routineStatuses: string[]): boolean {
  const normalized = normalizeStatus(status);
  if (normalized === "Unavailable" || normalized.trim().length === 0) return false;
  return !routineStatuses.includes(normalized);
}

export function getRootLines(viewModel: GameplayViewModel): string[] {
  const lines = [
    "OpenSudoku",
    ...viewModel.rootActions.map(
      (action, index) => `${index === viewModel.rootFocusIndex ? ">" : " "} ${action.label}`,
    ),
    "",
    "Arrows/WASD move • Enter select • q quit",
  ];

  if (shouldShowStatus(viewModel.status, ["Use arrows/WASD + Enter to choose."])) {
    lines.push(`Status: ${normalizeStatus(viewModel.status)}`);
  }

  return lines;
}

function normalizeStatus(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint")
    return String(value);
  if (value instanceof Error) return value.message || "Unavailable";
  return "Unavailable";
}

export function getDailyLines(viewModel: GameplayViewModel): string[] {
  const selected = viewModel.dailySelectedDateKey ?? "Unavailable";
  return [
    "Daily",
    `Selected: ${selected}`,
    `Browse mode: ${viewModel.dailyBrowseMode}`,
    "Up/Down: ±day | Left/Right: ±month or ±year",
    "m month | y year | t today | Enter open | Esc return | q quit",
    "",
    `Status: ${normalizeStatus(viewModel.status)}`,
  ];
}

export function getGeneratorLines(status: string): string[] {
  const lines = [
    "Generator",
    "1 Easy | 2 Medium | 3 Hard | 4 Extreme Hard",
    "Enter/Esc return • q quit",
  ];

  if (shouldShowStatus(status, ["Generator screen."])) {
    lines.push(`Status: ${normalizeStatus(status)}`);
  }

  return lines;
}

export function getProgressLines(viewModel: GameplayViewModel): string[] {
  const summary = viewModel.progressSummary;
  const formatBest = (value: string | null): string => value ?? "None";
  return [
    "Progress",
    summary === null || summary.generalSolves === 0
      ? "No local progression yet."
      : "Local progression summary.",
    `General Solves: ${summary?.generalSolves ?? 0}`,
    `Assisted Solves: ${summary?.assistedSolves ?? 0}`,
    `Challenge Wins: ${summary?.challengeWins ?? 0}`,
    `Best Normal: ${formatBest(summary?.bestNormalMs !== null && summary ? formatDuration(summary.bestNormalMs) : null)}`,
    `Best Easy: ${formatBest(summary?.bestEasyMs !== null && summary ? formatDuration(summary.bestEasyMs) : null)}`,
    `Best Medium: ${formatBest(summary?.bestMediumMs !== null && summary ? formatDuration(summary.bestMediumMs) : null)}`,
    `Best Hard: ${formatBest(summary?.bestHardMs !== null && summary ? formatDuration(summary.bestHardMs) : null)}`,
    `Daily Streak: ${summary?.dailyStreakCount ?? 0}`,
    `Latest Daily Completion: ${summary?.latestDailyCompletion ?? "None"}`,
    "",
    "Enter/Esc return • q quit",
  ];
}

function formatDuration(valueMs: number): string {
  const totalSeconds = Math.floor(valueMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function getSolverLines(status: string): string[] {
  const lines = [
    "Solver Checks",
    "1 Known solvable | 2 Known invalid | 3 Known unsolvable | c Current board",
    "Read-only checks; does not change your board.",
    "Enter/Esc return • q quit",
  ];

  if (shouldShowStatus(status, ["Solver screen."])) {
    lines.push(`Status: ${normalizeStatus(status)}`);
  }

  return lines;
}

export function getHelpLines(): string[] {
  return [
    "Help",
    "Root: arrows/WASD move focus, Enter select.",
    "Play: 1-9 set, 0/. clear, n notes, v candidate view, h hint, u undo, r redo, t challenge timer.",
    "Candidate view cycles MIN/CNT/FULL (display only).",
    "Enter/Esc return • q quit",
  ];
}
