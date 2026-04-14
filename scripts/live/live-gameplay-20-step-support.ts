export type CueType = "fail" | "success" | "complete";

export function parseCueTypes(cueRaw: string): CueType[] {
  const parsed = JSON.parse(cueRaw) as { events?: Array<{ cue?: string }> };
  const events = Array.isArray(parsed.events) ? parsed.events : [];
  return [
    ...new Set(
      events
        .map((event) => event.cue)
        .filter((cue): cue is CueType => cue === "fail" || cue === "success" || cue === "complete"),
    ),
  ];
}

export function parseHudLines(frame: string): Record<string, string> {
  const labels = ["Timer", "Active", "Hints", "Hint", "Challenge", "Best", "Daily"] as const;
  const parsed: Record<string, string> = {};
  for (const line of frame.split("\n")) {
    const trimmed = line.trim();
    for (const label of labels) {
      if (trimmed.includes(`${label}:`))
        parsed[label] = trimmed.slice(trimmed.indexOf(`${label}:`));
    }
    if (trimmed.includes("Streak ")) parsed.Streak = trimmed;
  }
  return parsed;
}
