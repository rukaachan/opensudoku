import { describe, expect, test } from "bun:test";
import { join } from "path";
import { resolveRepoRoot } from "../../repo-root";

const repoRoot = resolveRepoRoot(import.meta.dir);

describe("bundle release helpers", () => {
  test("release helper surfaces keep local Bun bundle staging only", async () => {
    const stageScript = await Bun.file(join(repoRoot, "scripts", "stage-release.ts")).text();
    const releaseArtifacts = await Bun.file(
      join(repoRoot, "src", "app", "release", "release-artifacts.ts"),
    ).text();
    const installerScript = await Bun.file(
      join(repoRoot, "scripts", "release", "install.ps1"),
    ).text();

    expect(stageScript).not.toContain(".exe");
    expect(stageScript).toContain("install.ps1");
    expect(releaseArtifacts).toContain("installerFile");
    expect(releaseArtifacts).toContain("bundleSha256");
    expect(releaseArtifacts).toContain("curlInstallExample");
    expect(installerScript).toContain("releases/latest/download");
    expect(installerScript).toContain("bun install --frozen-lockfile");
    expect(installerScript).toContain("[switch]$Uninstall");
    expect(installerScript).toContain("OpenSudoku uninstall completed.");
  });
});
