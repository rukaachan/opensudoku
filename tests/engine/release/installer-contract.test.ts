import { describe, expect, test } from "bun:test";
import { access } from "node:fs/promises";
import { join } from "path";
import { resolveRepoRoot } from "../../repo-root";

const repoRoot = resolveRepoRoot(import.meta.dir);

describe("release migration contract", () => {
  test("release-facing files advertise curl installer flow without exe artifacts", async () => {
    const readme = await Bun.file(join(repoRoot, "README.md")).text();
    const packageJson = await Bun.file(join(repoRoot, "package.json")).text();

    expect(readme).not.toContain("opensudoku.exe");
    expect(readme).toContain("install.ps1");
    expect(readme).toContain("curl.exe -fsSL");
    expect(packageJson).not.toContain("build:release");
    expect(packageJson).not.toContain("test:release-cli");
  });

  test("legacy exe release helpers are removed and new installer script exists", async () => {
    const stalePaths = [
      join(repoRoot, "scripts", "build-release.ts"),
      join(repoRoot, "scripts", "install.ps1"),
      join(repoRoot, "scripts", "test-installer-smoke.ts"),
      join(repoRoot, "scripts", "test-release-cli.ts"),
      join(repoRoot, "src", "app", "installer-smoke-harness.ts"),
    ];
    await expect(Promise.all(stalePaths.map((filePath) => access(filePath)))).rejects.toThrow();
    await expect(access(join(repoRoot, "scripts", "release", "install.ps1"))).resolves.toBeNull();
  });
});
