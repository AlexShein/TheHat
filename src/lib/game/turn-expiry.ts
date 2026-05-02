import { ref, get, set, update } from "firebase/database"
import type { Database } from "firebase/database"
import type { GameState } from "$lib/db-types"
import { getTimeRemaining } from "./timer"

/**
 * Checks timer state and current word display duration.
 * Called periodically (every 100ms timer tick in GameMain) or on timer expiry.
 *
 * When getTimeRemaining() <= 0 and phase === 'explaining':
 *   - wordDisplayedAt tracked client-side (not in RTDB).
 *   - If Date.now() - wordDisplayedAt > 2000: write phase 'post_expiry'.
 *   - If <= 2000ms: write phase 'post_turn', currentWordId=null.
 *   - If currentWordId is null AND hat is empty: write phase 'round_end'.
 *   - If currentWordId is null AND hat is not empty: write phase 'post_turn'.
 *
 * Does nothing when phase !== 'explaining', timer not started, or timer paused.
 *
 * IMPORTANT: Only explainer's client should call this (single-writer-per-turn invariant).
 */
export async function handleTimerExpiry(
  db: Database,
  roomId: string,
  timerStartedAt: number | null,
  timerDuration: number,
  pausedAt: number | null,
  timeRemainingAtPause: number | null,
  currentWordId: string | null,
  wordDisplayedAt: number | null,
): Promise<void> {
  // Guard: only act during explaining phase
  const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
  if (!gsSnap.exists()) return

  const gs = gsSnap.val() as GameState
  if (gs.phase !== "explaining") return

  // Timer not started or paused — nothing to check
  const remaining = getTimeRemaining(timerStartedAt, timerDuration, pausedAt, timeRemainingAtPause)
  if (remaining > 0) return

  // Timer expired — decide phase
  if (currentWordId !== null && wordDisplayedAt !== null && Date.now() - wordDisplayedAt > 2000) {
    // Word displayed >2s — give explainer chance to act (post_expiry)
    await set(ref(db, `rooms/${roomId}/gameState/phase`), "post_expiry")
  } else {
    // Word not displayed long enough or no word drawn
    // Check hat emptiness: if hat empty, go directly to round_end
    const hat = gs.hat ?? []
    if (hat.length === 0 && currentWordId === null) {
      // Hat was already empty — round is over
      await update(ref(db, `rooms/${roomId}/gameState`), {
        phase: "round_end",
        currentWordId: null,
      })
    } else {
      // Normal post_turn — use update() to avoid clobbering concurrent field writes
      await update(ref(db, `rooms/${roomId}/gameState`), {
        phase: "post_turn",
        currentWordId: null,
      })
    }
  }
}

/**
 * Ends turn immediately when hat is empty mid-turn.
 * Writes phase: 'post_turn', currentWordId: null.
 * Does NOT trigger post_expiry — hat empty skips the post-expiry decision phase entirely.
 * Only acts when phase === 'explaining'. No-op otherwise.
 */
export async function endTurnEarly(db: Database, roomId: string): Promise<void> {
  const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
  if (!gsSnap.exists()) return

  const gs = gsSnap.val() as GameState

  // Guard: only act during explaining phase (finding 4 fix)
  if (gs.phase !== "explaining") return

  // Use update() — targeted write, no stale spread (finding 1 fix)
  await update(ref(db, `rooms/${roomId}/gameState`), {
    phase: "post_turn",
    currentWordId: null,
  })
}
