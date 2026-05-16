/**
 * Pure predicates for auto-pause detection.
 * No Firebase calls, no side effects. Testable in isolation.
 *
 * Used by +page.svelte $effect blocks to decide when to call pauseGame().
 */

/**
 * Determines if auto-pause should fire when the explainer disconnects.
 * Only returns true on a true→false transition of `isConnected`
 * during eligible phases when the game is not already paused.
 */
export function shouldAutoPauseOnExplainerDisconnect(
  wasConnected: boolean,
  isConnected: boolean,
  phase: string,
  pausedAt: number | null,
): boolean {
  // Only fire on true→false transition
  if (!wasConnected || isConnected) return false
  // Only during explaining or post_expiry
  if (phase !== "explaining" && phase !== "post_expiry") return false
  // Don't fire if already paused
  if (pausedAt !== null) return false
  return true
}

/**
 * Determines if auto-pause should fire when any team drops below 2 connected players.
 * Returns the teamId that dropped below threshold, or null.
 *
 * @param teamConnectedCounts - Map of teamId → count of connected players
 * @param phase - current gameState.phase
 * @param pausedAt - current pausedAt (null = not paused)
 * @param bypassMinPlayers - if true (VITE_DEV_BYPASS_MIN_PLAYERS), never triggers
 */
export function shouldAutoPauseOnTeamDrop(
  teamConnectedCounts: Map<string, number>,
  phase: string,
  pausedAt: number | null,
  bypassMinPlayers: boolean,
): string | null {
  if (bypassMinPlayers) return null
  if (pausedAt !== null) return null
  // Only during gameplay phases where pausing makes sense
  if (phase !== "explaining" && phase !== "post_expiry" && phase !== "waiting_start") return null

  for (const [teamId, count] of teamConnectedCounts) {
    if (count < 2) return teamId
  }
  return null
}
