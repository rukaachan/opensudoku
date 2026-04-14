#!/usr/bin/env bun

import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { stageReleaseAssets } from "../src/app/release-artifacts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
OpenSudoku Release Staging

Usage:
  bun run stage:release

Description:
  Stages the Bun bundle zip, release manifest, QUICKSTART guide, and install.ps1 under
  dist/release/local/v<version>/.
`);
  process.exit(0);
}

try {
  const staged = await stageReleaseAssets({ repoRoot });
  console.log(`Staged release assets for ${staged.tag}:`);
  console.log(`- ${staged.bundlePath}`);
  console.log(`- ${staged.manifestPath}`);
  console.log(`- ${staged.quickstartPath}`);
  console.log(`- ${staged.installerPath}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Release staging failed: ${message}`);
  process.exit(1);
}
