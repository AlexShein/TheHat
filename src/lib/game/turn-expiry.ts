import { ref, get, set } from "firebase/database"
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
 *   - If <= 2000ms or currentWordId is null: write phase 'post_turn', currentWordId=null.
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
    // Word has been displayed for >2s — give explainer chance to act
    await set(ref(db, `rooms/${roomId}/gameState/phase`), "post_expiry")
  } else {
    // Word was not displayed long enough, or no word was drawn — skip post_expiry
    await set(ref(db, `rooms/${roomId}/gameState`), {
      ...gs,
      phase: "post_turn",
      currentWordId: null,
    })
  }
}

/**
 * Ends turn immediately when hat is empty mid-turn.
 * Writes phase: 'post_turn', currentWordId: null.
 * Does NOT trigger post_expiry — hat empty skips the post-expiry decision phase entirely.
 */
export async function endTurnEarly(db: Database, roomId: string): Promise<void> {
  const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
  if (!gsSnap.exists()) return

  const gs = gsSnap.val() as GameState
  await set(ref(db, `rooms/${roomId}/gameState`), {
    ...gs,
    phase: "post_turn",
    currentWordId: null,
  })
}
