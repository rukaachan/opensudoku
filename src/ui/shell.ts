import { RGBA, TextRenderable, type CliRenderer } from "@opentui/core";
import type { GameplayViewModel } from "../app/gameplay";
import { mountDailyBrowseScreen } from "./daily-calendar";
import { mountPlayScreen } from "./shell-play";
import { mountCenteredLines, mountRootScreen } from "./shell-static-screens";

function getCenteredLeft(viewportWidth: number, contentWidth: number): number {
  return Math.max(0, Math.floor((viewportWidth - contentWidth) / 2));
}

function getViewportWidth(renderer: CliRenderer): number {
  return renderer.width > 0 ? renderer.width : 100;
}

function getViewportHeight(renderer: CliRenderer): number {
  return renderer.height > 0 ? renderer.height : 30;
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

export function mountGameplayScreen(
  renderer: CliRenderer,
  viewModel: GameplayViewModel,
): { cleanup: () => void } {
  const mounted: TextRenderable[] = [];
  const viewportWidth = getViewportWidth(renderer);
  const viewportHeight = getViewportHeight(renderer);
  const viewportCenter = viewportWidth / 2;
  const getCenterAlignedLeft = (content: string): number =>
    Math.max(0, Math.floor(viewportCenter - content.length / 2));
  const getCenterAlignedTop = (contentHeight: number): number =>
    Math.max(0, Math.floor((viewportHeight - contentHeight) / 2));

  const mountLine = (
    content: unknown,
    top: number,
    style?: { fg?: RGBA; bg?: RGBA; attributes?: number; left?: number },
  ): void => {
    const normalized = toDisplayText(content);
    const line = new TextRenderable(renderer, {
      content: normalized,
      position: "absolute",
      top,
      left: style?.left ?? 0,
      fg: style?.fg,
      bg: style?.bg,
      attributes: style?.attributes,
    });
    renderer.root.add(line);
    mounted.push(line);
  };

  if (viewModel.screen === "root") {
    mountRootScreen({
      viewModel,
      viewportWidth,
      top: 0,
      mountLine,
      getCenterTop: getCenterAlignedTop,
    });
  } else if (viewModel.screen === "play") {
    mountPlayScreen({
      renderer,
      viewModel,
      top: getCenterAlignedTop(19),
      mounted,
      mountLine,
      toDisplayText,
      getCenterAlignedLeft,
      getCenteredLeft: (contentWidth) => getCenteredLeft(viewportWidth, contentWidth),
    });
  } else if (viewModel.screen === "daily") {
    mountDailyBrowseScreen(renderer, viewModel, mounted, viewportWidth, viewportHeight);
  } else if (
    viewModel.screen === "generator" ||
    viewModel.screen === "progress" ||
    viewModel.screen === "solver" ||
    viewModel.screen === "help"
  ) {
    mountCenteredLines({
      viewModel,
      viewportWidth,
      top: 0,
      mountLine,
      getCenterTop: getCenterAlignedTop,
      screen: viewModel.screen,
      toDisplayText,
    });
  }

  return {
    cleanup(): void {
      for (const renderable of mounted) {
        renderable.destroy();
      }
    },
  };
}
export { getCellSpanFromFrame, getRootActionSpanFromFrame } from "./shell-frame";
