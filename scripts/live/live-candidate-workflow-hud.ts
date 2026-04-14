export type HudLines = {
  Mode: string;
  Status: string;
  Active: string;
  Hints: string;
};

const HUD_LABELS = ["Mode", "Status", "Active", "Hints"] as const;

type HudLabel = (typeof HUD_LABELS)[number];

function extractLabelSegment(line: string, label: HudLabel): string | null {
  const marker = `${label}:`;
  const markerIndex = line.indexOf(marker);
  if (markerIndex < 0) return null;
  return line.slice(markerIndex).trim();
}

function includesOtherLabels(line: string, allowed: HudLabel[]): HudLabel[] {
  return HUD_LABELS.filter((label) => !allowed.includes(label) && line.includes(`${label}:`));
}

function parseActiveAndOptionalHints(line: string, hud: Partial<HudLines>): void {
  const activeSegment = extractLabelSegment(line, "Active");
  if (!activeSegment) {
    throw new Error("Malformed combined Active/Hints HUD line.");
  }

  const hintsIndex = activeSegment.indexOf("Hints:");
  if (hintsIndex > 0) {
    const activePart = activeSegment.slice(0, hintsIndex).trimEnd();
    const hintsPart = activeSegment.slice(hintsIndex).trim();
    if (!extractLabelSegment(activePart, "Active") || !extractLabelSegment(hintsPart, "Hints")) {
      throw new Error("Malformed combined Active/Hints HUD line.");
    }
    hud.Active = activePart;
    hud.Hints = hintsPart;
    return;
  }

  const unexpected = includesOtherLabels(activeSegment, ["Active"]);
  if (unexpected.length > 0) {
    throw new Error(
      `Malformed HUD line for 'Active:'; found additional HUD label(s): ${unexpected.join(", ")}.`,
    );
  }
  hud.Active = activeSegment;
}

export function parseRequiredHudLines(frame: string): HudLines {
  const hud: Partial<HudLines> = {};

  for (const rawLine of frame.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const modeLine = extractLabelSegment(line, "Mode");
    if (modeLine) {
      const unexpected = includesOtherLabels(modeLine, ["Mode"]);
      if (unexpected.length > 0) {
        throw new Error(
          `Malformed HUD line for 'Mode:'; found additional HUD label(s): ${unexpected.join(", ")}.`,
        );
      }
      hud.Mode = modeLine;
      continue;
    }

    const statusLine = extractLabelSegment(line, "Status");
    if (statusLine) {
      const unexpected = includesOtherLabels(statusLine, ["Status"]);
      if (unexpected.length > 0) {
        throw new Error(
          `Malformed HUD line for 'Status:'; found additional HUD label(s): ${unexpected.join(", ")}.`,
        );
      }
      hud.Status = statusLine;
      continue;
    }

    if (extractLabelSegment(line, "Active")) {
      parseActiveAndOptionalHints(line, hud);
      continue;
    }

    const hintsLine = extractLabelSegment(line, "Hints");
    if (hintsLine) {
      const unexpected = includesOtherLabels(hintsLine, ["Hints"]);
      if (unexpected.length > 0) {
        throw new Error(
          `Malformed HUD line for 'Hints:'; found additional HUD label(s): ${unexpected.join(", ")}.`,
        );
      }
      hud.Hints = hintsLine;
    }
  }

  for (const label of HUD_LABELS) {
    if (!hud[label]) {
      throw new Error(`Missing required HUD line '${label}:' in live frame.`);
    }
  }

  return hud as HudLines;
}
