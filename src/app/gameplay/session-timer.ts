import { Difficulty } from "../puzzle-tools";
import type { GameplayState } from "./gameplay-state";

export type SessionTimerMode = "stopwatch" | "challenge";

const MS_PER_SECOND = 1_000;

const CHALLENGE_SECONDS_BY_DIFFICULTY: Record<Difficulty, number> = {
  [Difficulty.Easy]: 15 * 60,
  [Difficulty.Medium]: 10 * 60,
  [Difficulty.Hard]: 5 * 60,
};

export function startSessionTimer(state: GameplayState, nowMs: number): void {
  state.sessionStartedAtMs = nowMs;
  state.sessionStoppedAtMs = null;
  state.sessionTimerMode = "stopwatch";
  state.challengeTotalSeconds = null;
  state.challengeFailed = false;
}

export function getSessionElapsedMs(state: GameplayState, nowMs: number): number {
  if (state.sessionStartedAtMs === null) return 0;
  const endMs = state.sessionStoppedAtMs ?? nowMs;
  return Math.max(0, endMs - state.sessionStartedAtMs);
}

export function getChallengeRemainingSeconds(state: GameplayState, nowMs: number): number | null {
  if (state.sessionTimerMode !== "challenge" || state.challengeTotalSeconds === null) {
    return null;
  }

  const elapsedMs = getSessionElapsedMs(state, nowMs);
  const remainingMs = Math.max(0, state.challengeTotalSeconds * MS_PER_SECOND - elapsedMs);
  return Math.ceil(remainingMs / MS_PER_SECOND);
}

export function formatClock(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(clamped / 60);
  const remainSeconds = clamped % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainSeconds).padStart(2, "0")}`;
}

export function getSessionClockText(state: GameplayState, nowMs: number): string {
  const remaining = getChallengeRemainingSeconds(state, nowMs);
  if (remaining !== null) return formatClock(remaining);

  const elapsedSeconds = Math.floor(getSessionElapsedMs(state, nowMs) / MS_PER_SECOND);
  return formatClock(elapsedSeconds);
}

export function isSessionTimerRunning(state: GameplayState): boolean {
  return (
    state.screen === "play" &&
    state.sessionStartedAtMs !== null &&
    state.sessionStoppedAtMs === null
  );
}

export function enableChallengeCountdown(
  state: GameplayState,
  nowMs: number,
): { enabled: boolean; status: string } {
  if (state.activeSessionType !== "generated" || !state.activeDifficulty) {
    return {
      enabled: false,
      status: "Challenge mode requires an active generated easy, medium, or hard session.",
    };
  }

  const totalSeconds = CHALLENGE_SECONDS_BY_DIFFICULTY[state.activeDifficulty];
  state.sessionStartedAtMs = nowMs;
  state.sessionStoppedAtMs = null;
  state.sessionTimerMode = "challenge";
  state.challengeTotalSeconds = totalSeconds;
  state.challengeFailed = false;

  return {
    enabled: true,
    status: `Challenge mode: ${state.activeDifficulty} ${formatClock(totalSeconds)} countdown started.`,
  };
}

export function freezeSessionTimer(state: GameplayState, nowMs: number): void {
  if (state.sessionStartedAtMs === null || state.sessionStoppedAtMs !== null) return;
  state.sessionStoppedAtMs = nowMs;
}

export function applyChallengeExpiry(state: GameplayState, nowMs: number): boolean {
  const remaining = getChallengeRemainingSeconds(state, nowMs);
  if (remaining === null || remaining > 0 || state.challengeFailed) {
    return false;
  }

  state.challengeFailed = true;
  state.runLocked = true;
  freezeSessionTimer(state, nowMs);
  state.status = "Time expired — run locked. Press Esc, then Play to restart.";
  return true;
}
