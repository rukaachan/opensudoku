import { createTestRenderer } from "@opentui/core/testing";
import type { CapturedFrame } from "@opentui/core";

export interface OpenTUIHarness {
  renderer: Awaited<ReturnType<typeof createTestRenderer>>["renderer"];
  renderOnce(): Promise<void>;
  captureSpans(): CapturedFrame;
  captureCharFrame(): string;
  resize(width: number, height: number): void;
  cleanup(): void;
}

export async function createOpenTUIHarness(options?: {
  width?: number;
  height?: number;
}): Promise<OpenTUIHarness> {
  const testRenderer = await createTestRenderer({
    width: options?.width ?? 80,
    height: options?.height ?? 24,
    useAlternateScreen: false,
    useConsole: false,
  });

  return {
    renderer: testRenderer.renderer,
    async renderOnce(): Promise<void> {
      await testRenderer.renderOnce();
    },
    captureSpans(): CapturedFrame {
      return testRenderer.captureSpans();
    },
    captureCharFrame(): string {
      return testRenderer.captureCharFrame();
    },
    resize(width: number, height: number): void {
      testRenderer.resize(width, height);
    },
    cleanup(): void {
      testRenderer.renderer.destroy();
    },
  };
}

export async function simulateKeys(keys: string[], handler: (key: string) => void): Promise<void> {
  for (const key of keys) {
    handler(key);
  }
}
