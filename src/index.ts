#!/usr/bin/env bun

/**
 * OpenSudoku - Terminal Sudoku game built with OpenTUI
 */

// Known valid CLI arguments
const KNOWN_ARGS = new Set(["--help", "-h", "--version", "-v"]);

interface CliParseResult {
  kind: "interactive" | "help" | "version" | "error";
  message?: string;
}

function formatHelpText(): string {
  return `
OpenSudoku - Terminal Sudoku game built with OpenTUI

Usage:
  bun run start [options]

Options:
  --help, -h     Show this help message
  --version, -v  Show version

Examples:
  bun run start              Start the game
  bun run start -- --help    Show this help
`;
}

export function parseCliArguments(userArgs: string[]): CliParseResult {
  // Separate positional arguments from flags
  const positionalArgs = userArgs.filter((arg) => arg && !arg.startsWith("-"));
  const flagArgs = userArgs.filter((arg) => arg && arg.startsWith("-"));

  if (positionalArgs.length > 0) {
    return {
      kind: "error",
      message: `error: unexpected argument${positionalArgs.length > 1 ? "s" : ""}: ${positionalArgs.join(", ")}`,
    };
  }

  const unknownFlags = flagArgs.filter((arg) => !KNOWN_ARGS.has(arg));
  if (unknownFlags.length > 0) {
    return {
      kind: "error",
      message: `error: unknown option${unknownFlags.length > 1 ? "s" : ""}: ${unknownFlags.join(", ")}`,
    };
  }

  if (userArgs.includes("--help") || userArgs.includes("-h")) {
    return { kind: "help" };
  }

  if (userArgs.includes("--version") || userArgs.includes("-v")) {
    return { kind: "version" };
  }

  return { kind: "interactive" };
}

export function greet(greetingName: string = "World"): string {
  return `Hello, ${greetingName}! Welcome to OpenSudoku.`;
}

export async function runCli(userArgs: string[] = process.argv.slice(2)): Promise<number> {
  const parseResult = parseCliArguments(userArgs);

  if (parseResult.kind === "error") {
    console.error(parseResult.message);
    console.error("Run 'bun run start -- --help' for available options.");
    return 1;
  }

  if (parseResult.kind === "help") {
    console.log(formatHelpText());
    return 0;
  }

  if (parseResult.kind === "version") {
    const { name, version } = await import("../package.json", { with: { type: "json" } });
    console.log(`${name} v${version}`);
    return 0;
  }

  const { startInteractiveApp } = await import("./runtime/runtime-app");
  await startInteractiveApp();
  return 0;
}

if (import.meta.main) {
  const exitCode = await runCli();
  process.exit(exitCode);
}
