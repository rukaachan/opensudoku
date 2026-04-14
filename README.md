# OpenSudoku

OpenSudoku is a Windows-first, offline terminal Sudoku game built with Bun, TypeScript, and `@opentui/core`.

## Highlights

- Keyboard-first terminal gameplay.
- Contextual hint flow with focus and pulse guidance.
- Candidate view modes (`minimal`, `count`, `full`) in Play.
- Daily browsing and local progression tracking.
- Fully offline operation (no telemetry, no cloud sync).

## Requirements

- Bun `>=1.3.0`
- Windows PowerShell (release staging and install flow)

## Quick Start (from source)

### 1) Install dependencies

```bash
bun install
```

### 2) Launch

```bash
bun run start
```

### 3) CLI help/version

```bash
bun run start -- --help
bun run start -- --version
```

## Gameplay Notes

- Press `h` during Play to request a logical hint.
- Each new puzzle session starts with `2` hints.
- Press `v` to cycle candidate view (`minimal` → `count` → `full`).
- Press `n` to toggle Notes mode.
- Press `t` to toggle challenge timer mode on generated runs.
- Solver menu is **Solver Checks** (read-only checks, no board mutation).

## Windows one-line install (GitHub Releases)

```powershell
$repo = "rukaachan/opensudoku"
curl.exe -fsSL "https://github.com/$repo/releases/latest/download/install.ps1" | powershell -NoProfile -ExecutionPolicy Bypass -
```

What it does:

- Downloads release manifest and bundle.
- Verifies bundle checksum.
- Installs under `%LOCALAPPDATA%\OpenSudoku`.
- Creates launcher: `%LOCALAPPDATA%\OpenSudoku\opensudoku.cmd`.
- Adds install directory to user PATH (if missing).

### Uninstall completed install

```powershell
$repo = "rukaachan/opensudoku"
curl.exe -fsSL "https://github.com/$repo/releases/latest/download/install.ps1" | powershell -NoProfile -ExecutionPolicy Bypass -Uninstall -
```

Tip: installer default repo can also be overridden with `OPEN_SUDOKU_RELEASE_REPO`.

## Available Scripts

- `bun run start` — launch interactive TUI
- `bun test ./tests` — run full test suite
- `bun run smoke-test` — runtime smoke checks
- `bun run bench` — benchmark suite
- `bun run stage:release` — stage local release artifacts under `dist/release/local/v<version>/`
- `bun run lint` — run oxlint
- `bun run format` — run oxfmt
- `bun run format:check` — check formatting with oxfmt

## Validation Commands

```bash
bunx tsc --noEmit
bun run lint
bun test ./tests
bun run smoke-test
bun run bench -- --suite full --json dist/evidence/task-11-bench.json
```

## Project Layout

- `src/domain/` — pure Sudoku engine logic (board, solver, generator, hints)
- `src/app/` — gameplay orchestration, persistence boundaries, release/install logic
- `src/ui/` — terminal rendering and shell composition
- `src/runtime/` — runtime bootstrap
- `scripts/live/` — live evidence harnesses
- `scripts/perf/` — benchmark/signoff tooling
- `scripts/release/` — release installer flow
- `tests/engine/` — engine and contract tests
- `tests/render/` — render/runtime behavior tests
