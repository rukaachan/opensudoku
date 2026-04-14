import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function isRepoRoot(candidate: string): boolean {
  return (
    existsSync(join(candidate, "package.json")) && existsSync(join(candidate, "src", "index.ts"))
  );
}

export function resolveRepoRoot(fromDir: string): string {
  let cursor = resolve(fromDir);
  while (true) {
    if (isRepoRoot(cursor)) return cursor;
    const parent = dirname(cursor);
    if (parent === cursor) {
      throw new Error(`Could not resolve repository root from: ${fromDir}`);
    }
    cursor = parent;
  }
}
