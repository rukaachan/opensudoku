import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { stageReleaseAssets } from "../../../src/app/release-artifacts";
import { resolveRepoRoot } from "../../repo-root";

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runBundleSession(options: {
  cwd: string;
  env: NodeJS.ProcessEnv;
  keys: string[];
  timeoutMs?: number;
}) {
  const child = Bun.spawn(["bun", "run", "start"], {
    cwd: options.cwd,
    env: options.env,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdoutPromise = new Response(child.stdout).text();
  const stderrPromise = new Response(child.stderr).text();

  void (async () => {
    for (const key of options.keys) {
      await sleep(350);
      child.stdin.write(key);
    }
  })();

  const timeoutMs = options.timeoutMs ?? 10_000;
  const result = await Promise.race([
    child.exited.then((exitCode) => ({ exitCode, timedOut: false })),
    sleep(timeoutMs).then(() => ({ exitCode: -1, timedOut: true })),
  ]);
  if (result.timedOut) {
    child.kill();
    await child.exited;
  }

  const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
  return { ...result, stdout, stderr };
}

async function expandBundleArchive(bundlePath: string, destination: string): Promise<void> {
  const extract = Bun.spawn(
    [
      "powershell",
      "-NoProfile",
      "-Command",
      `Expand-Archive -Path '${bundlePath}' -DestinationPath '${destination}' -Force`,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [extractExitCode, extractStderr] = await Promise.all([
    extract.exited,
    new Response(extract.stderr).text(),
  ]);
  expect(extractExitCode, extractStderr || "Expand-Archive exited non-zero").toBe(0);
}

async function createTempWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "opensudoku-release-test-"));
  const srcDir = join(root, "src");
  const scriptsDir = join(root, "scripts");
  const releaseScriptsDir = join(scriptsDir, "release");
  const packagePath = join(root, "package.json");
  await mkdir(srcDir, { recursive: true });
  await mkdir(scriptsDir, { recursive: true });
  await mkdir(releaseScriptsDir, { recursive: true });
  await writeFile(
    packagePath,
    JSON.stringify({
      name: "opensudoku",
      version: "0.1.0",
      scripts: {
        start: "bun run src/index.ts",
        "smoke-test": "bun run scripts/smoke-test.ts",
      },
      dependencies: { "@opentui/core": "^0.1.90" },
      devDependencies: { typescript: "^6.0.2" },
      engines: { bun: ">=1.3.0" },
    }),
  );
  await writeFile(join(root, "bun.lock"), "lockfileVersion = 0\n");
  await writeFile(
    join(root, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { target: "ESNext" } }),
  );
  await writeFile(join(root, "README.md"), "# OpenSudoku\n");
  await writeFile(join(srcDir, "index.ts"), "console.log('opensudoku')");
  await writeFile(join(scriptsDir, "smoke-test.ts"), "console.log('smoke')");
  await writeFile(join(scriptsDir, "smoke-test-runner.ts"), "export {}\n");
  await writeFile(join(releaseScriptsDir, "install.ps1"), "Write-Host 'install'\n");
  return { root, srcDir, scriptsDir, packagePath };
}

describe("release staging local bundle preconditions", () => {
  test(
    "stages the Bun bundle zip, manifest, quickstart, and installer contract",
    async () => {
      const ws = await createTempWorkspace();
      const staged = await stageReleaseAssets({ repoRoot: ws.root });

      expect(staged.version).toBe("0.1.0");
      expect(staged.bundleFile).toBe("opensudoku-bun-v0.1.0.zip");
      expect(staged.quickstartFile).toBe("QUICKSTART.md");
      expect(staged.installerFile).toBe("install.ps1");

      const manifest = JSON.parse(await readFile(staged.manifestPath, "utf8"));
      expect(manifest.version).toBe("0.1.0");
      expect(manifest.bundleFile).toBe("opensudoku-bun-v0.1.0.zip");
      expect(manifest.quickstartFile).toBe("QUICKSTART.md");
      expect(manifest.installerFile).toBe("install.ps1");
      expect(typeof manifest.bundleSha256).toBe("string");
      expect(manifest.bundleSha256.length).toBe(64);
      expect(typeof manifest.installerSha256).toBe("string");
      expect(manifest.installerSha256.length).toBe(64);
      expect(manifest.curlInstallExample).toContain("install.ps1");
      expect(manifest.setupCommand).toBe("bun install --frozen-lockfile");
      expect(manifest.startCommand).toBe("bun run start");
    },
    { timeout: 60_000 },
  );

  test(
    "fails explicitly when required source artifacts are missing",
    async () => {
      const ws = await createTempWorkspace();
      await rm(join(ws.root, "src", "index.ts"));
      await expect(stageReleaseAssets({ repoRoot: ws.root })).rejects.toThrow(
        "Missing required release artifact",
      );
    },
    { timeout: 60_000 },
  );

  test(
    "staged Bun bundle passes clean-room setup/help/version/readiness commands from a path with spaces",
    async () => {
      const repoRoot = resolveRepoRoot(import.meta.dir);
      const stage = await stageReleaseAssets({ repoRoot });
      const cleanRoomRoot = await mkdtemp(join(tmpdir(), "opensudoku clean room "));

      try {
        await expandBundleArchive(stage.bundlePath, cleanRoomRoot);
        const bundleRoot = join(cleanRoomRoot, stage.bundleFile.replace(/\.zip$/, ""));
        const env = { ...process.env, LOCALAPPDATA: join(cleanRoomRoot, "localappdata") };
        const commands = [
          ["bun", "install", "--frozen-lockfile"],
          ["bun", "run", "start", "--", "--help"],
          ["bun", "run", "start", "--", "--version"],
          ["bun", "run", "smoke-test"],
        ];

        for (const command of commands) {
          const proc = Bun.spawn(command, {
            cwd: bundleRoot,
            env,
            stdout: "pipe",
            stderr: "pipe",
          });
          const [exitCode, stdout, stderr] = await Promise.all([
            proc.exited,
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
          ]);
          expect(exitCode, `${command.join(" ")} failed\n${stderr || stdout}`).toBe(0);
        }
      } finally {
        await rm(cleanRoomRoot, { recursive: true, force: true });
      }
    },
    { timeout: 120_000 },
  );

  test(
    "staged Bun bundle supports an outside-repo assisted solve and relaunches with persisted progress",
    async () => {
      const repoRoot = resolveRepoRoot(import.meta.dir);
      const stage = await stageReleaseAssets({ repoRoot });
      const cleanRoomRoot = await mkdtemp(join(tmpdir(), "opensudoku release journey "));

      try {
        await expandBundleArchive(stage.bundlePath, cleanRoomRoot);
        const bundleRoot = join(cleanRoomRoot, stage.bundleFile.replace(/\.zip$/, ""));
        const localAppData = join(cleanRoomRoot, "localappdata");
        const env = {
          ...process.env,
          LOCALAPPDATA: localAppData,
          OPEN_SUDOKU_START_BOARD:
            "034678912672195348198342567859761423426853791713924856961537284287419635345286179",
        };

        const install = Bun.spawn(["bun", "install", "--frozen-lockfile"], {
          cwd: bundleRoot,
          env,
          stdout: "pipe",
          stderr: "pipe",
        });
        expect(await install.exited, await new Response(install.stderr).text()).toBe(0);

        const solveRun = await runBundleSession({
          cwd: bundleRoot,
          env,
          keys: ["p", "h", "5", "q"],
          timeoutMs: 12_000,
        });
        expect(solveRun.timedOut).toBe(false);
        expect(solveRun.exitCode).toBe(0);

        const progression = JSON.parse(
          await readFile(join(localAppData, "OpenSudoku", "progression.json"), "utf8"),
        ) as {
          s: { g: number; a: number };
        };
        expect(progression.s.g).toBe(1);
        expect(progression.s.a).toBe(1);

        const progressRun = await runBundleSession({
          cwd: bundleRoot,
          env,
          keys: ["\u001b[B", "\u001b[B", "\u001b[B", "\r", "q"],
          timeoutMs: 12_000,
        });
        expect(progressRun.timedOut).toBe(false);
        expect(progressRun.exitCode).toBe(0);

        const progressed = JSON.parse(
          await readFile(join(localAppData, "OpenSudoku", "progression.json"), "utf8"),
        ) as {
          s: { g: number; a: number };
        };
        expect(progressed.s.g).toBe(1);
        expect(progressed.s.a).toBe(1);
      } finally {
        await rm(cleanRoomRoot, { recursive: true, force: true });
      }
    },
    { timeout: 120_000 },
  );
});
