import { constants } from "fs";
import { createHash } from "node:crypto";
import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "path";

const DEFAULT_RELEASE_REPO = "rukaachan/opensudoku";
const RELEASE_REPO = process.env.OPEN_SUDOKU_RELEASE_REPO?.trim() || DEFAULT_RELEASE_REPO;

function toInstallScriptUrl(repoSlug: string, releaseVersion = "latest"): string {
  const base =
    releaseVersion === "latest"
      ? `https://github.com/${repoSlug}/releases/latest/download`
      : `https://github.com/${repoSlug}/releases/download/${releaseVersion}`;
  return `${base}/install.ps1`;
}

function toInstallCurlCommand(repoSlug: string, releaseVersion = "latest"): string {
  return `curl.exe -fsSL ${toInstallScriptUrl(repoSlug, releaseVersion)} | powershell -NoProfile -ExecutionPolicy Bypass -`;
}

export interface StagedReleaseAssets {
  version: string;
  tag: string;
  stagedDir: string;
  bundlePath: string;
  quickstartPath: string;
  manifestPath: string;
  installerPath: string;
  bundleFile: string;
  quickstartFile: string;
  installerFile: string;
}

async function readPackageMetadata(
  repoRoot: string,
): Promise<{ version: string; requiredBun: string }> {
  const packageJsonPath = join(repoRoot, "package.json");
  const pkg = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
    version?: unknown;
    engines?: { bun?: unknown };
  };
  if (typeof pkg.version !== "string" || pkg.version.trim() === "") {
    throw new Error(
      `Release precondition failed: package.json is missing a valid "version" at ${packageJsonPath}.`,
    );
  }
  return {
    version: pkg.version.trim(),
    requiredBun:
      typeof pkg.engines?.bun === "string" && pkg.engines.bun.trim() !== ""
        ? pkg.engines.bun.trim()
        : ">=1.3.0",
  };
}

async function assertReadable(filePath: string, artifactLabel: string): Promise<void> {
  try {
    await access(filePath, constants.R_OK);
  } catch {
    throw new Error(`Missing required release artifact: ${artifactLabel} (${filePath})`);
  }
}

function toSha256Hex(payload: string | Uint8Array): string {
  return createHash("sha256").update(payload).digest("hex");
}

export async function stageReleaseAssets(options: {
  repoRoot: string;
}): Promise<StagedReleaseAssets> {
  const { repoRoot } = options;
  const { version, requiredBun } = await readPackageMetadata(repoRoot);
  const tag = `v${version}`;
  const requiredSources = [
    "package.json",
    "bun.lock",
    "tsconfig.json",
    "README.md",
    join("src", "index.ts"),
    join("scripts", "smoke-test.ts"),
    join("scripts", "smoke-test-runner.ts"),
    join("scripts", "release", "install.ps1"),
  ];
  for (const source of requiredSources) {
    await assertReadable(join(repoRoot, source), source);
  }

  const stagedDir = join(repoRoot, "dist", "release", "local", tag);
  const bundleRootName = `opensudoku-bun-${tag}`;
  const bundleRootPath = join(stagedDir, bundleRootName);
  const bundleFile = `${bundleRootName}.zip`;
  const quickstartFile = "QUICKSTART.md";
  const installerFile = "install.ps1";
  const bundlePath = join(stagedDir, bundleFile);
  const quickstartPath = join(stagedDir, quickstartFile);
  const manifestPath = join(stagedDir, "release-manifest.json");
  const installerPath = join(stagedDir, installerFile);

  await rm(stagedDir, { recursive: true, force: true });
  await mkdir(stagedDir, { recursive: true });
  await mkdir(bundleRootPath, { recursive: true });

  for (const source of ["package.json", "bun.lock", "tsconfig.json", "README.md"]) {
    await cp(join(repoRoot, source), join(bundleRootPath, source));
  }
  await cp(join(repoRoot, "src"), join(bundleRootPath, "src"), { recursive: true });
  await mkdir(join(bundleRootPath, "scripts"), { recursive: true });
  await cp(
    join(repoRoot, "scripts", "smoke-test.ts"),
    join(bundleRootPath, "scripts", "smoke-test.ts"),
  );
  await cp(
    join(repoRoot, "scripts", "smoke-test-runner.ts"),
    join(bundleRootPath, "scripts", "smoke-test-runner.ts"),
  );
  await cp(join(repoRoot, "scripts", "release", "install.ps1"), installerPath);

  const quickstart = [
    "# OpenSudoku Bun Bundle",
    "",
    `Required Bun: ${requiredBun}`,
    "",
    "## Setup",
    "```bash",
    "bun install --frozen-lockfile",
    "```",
    "",
    "## Start",
    "```bash",
    "bun run start",
    "```",
    "",
    "## Verify",
    "```bash",
    "bun run start -- --help",
    "bun run start -- --version",
    "bun run smoke-test",
    "```",
    "",
    "## Windows one-line installer (GitHub Releases)",
    "```powershell",
    toInstallCurlCommand(RELEASE_REPO),
    "```",
    "",
  ].join("\n");
  await writeFile(quickstartPath, quickstart, "utf8");

  const zip = Bun.spawn(
    [
      "powershell",
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${bundleRootPath}' -DestinationPath '${bundlePath}' -Force`,
    ],
    { cwd: repoRoot, stdout: "pipe", stderr: "pipe" },
  );
  const [zipExitCode, zipStdout, zipStderr] = await Promise.all([
    zip.exited,
    new Response(zip.stdout).text(),
    new Response(zip.stderr).text(),
  ]);
  if (zipExitCode !== 0) {
    throw new Error(
      `Release staging failed: could not create bundle zip.\n${zipStderr || zipStdout}`.trim(),
    );
  }
  await rm(bundleRootPath, { recursive: true, force: true });

  const bundleSha256 = toSha256Hex(await readFile(bundlePath));
  const installerSha256 = toSha256Hex(await readFile(installerPath));
  const manifest = {
    version,
    tag,
    bundleFile,
    quickstartFile,
    installerFile,
    requiredBun,
    setupCommand: "bun install --frozen-lockfile",
    startCommand: "bun run start",
    helpCommand: "bun run start -- --help",
    versionCommand: "bun run start -- --version",
    readinessCommand: "bun run smoke-test",
    bundleSha256,
    installerSha256,
    curlInstallExample: toInstallCurlCommand(RELEASE_REPO),
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  return {
    version,
    tag,
    stagedDir,
    bundlePath,
    quickstartPath,
    manifestPath,
    installerPath,
    bundleFile,
    quickstartFile,
    installerFile,
  };
}
