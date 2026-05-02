/**
 * Pure function — no Firebase, no side effects.
 *
 * Computes remaining time in milliseconds from server-timestamped start
 * and client `Date.now()`.  When the timer is paused (`pausedAt !== null`)
 * the remaining time is frozen at `timeRemainingAtPause`.
 *
 * All timestamp parameters are epoch milliseconds (serverTimestamp values).
 */
export function getTimeRemaining(
  timerStartedAt: number | null,
  timerDuration: number,
  pausedAt: number | null,
  timeRemainingAtPause: number | null,
): number {
  const timerDurationMs = timerDuration * 1000
  // Timer not started yet — return full duration
  if (timerStartedAt === null) {
    return timerDurationMs
  }

  // Timer is paused — return frozen remaining, falling back to 0
  if (pausedAt !== undefined) {
    return timeRemainingAtPause ?? 0
  }

  // Timer is running — compute elapsed from client clock
  const elapsed = Date.now() - timerStartedAt
  const remaining = timerDurationMs - elapsed

  // Clamp: never return negative
  return remaining > 0 ? remaining : 0
}
