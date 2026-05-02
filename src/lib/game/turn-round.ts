import { ref, get, set, update } from "firebase/database"
import type { Database } from "firebase/database"
import type { GameState } from "$lib/db-types"

/**
 * Fisher-Yates shuffle. Returns new array, does not mutate input.
 */
function shuffle<T>(arr: T[]): T[] {
  const result: T[] = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const a = result[i]!
    const b = result[j]!
    result[i] = b
    result[j] = a
  }
  return result
}

/**
 * Handles round_end → next state.
 *
 * When round < 3:
 *   - Shuffles all wordIds from /rooms/{id}/words/ back into hat.
 *   - Increments round.
 *   - Writes phase: 'waiting_start', currentWordId=null, lastAction=null,
 *     wordsGuessedThisTurn=0.
 *   - Preserves currentTeamId, currentExplainerId, playerStats.
 *   - Leaves status unchanged ('playing').
 *
 * When round === 3:
 *   - Writes status: 'finished'. Game is over.
 *   - Does NOT modify gameState further — scoreboard phase reads frozen state.
 *
 * Only acts when gameState.phase === 'round_end'. Returns early otherwise.
 */
export async function endRound(db: Database, roomId: string): Promise<void> {
  const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
  if (!gsSnap.exists()) return

  const gs = gsSnap.val() as GameState

  // Guard: only act during round_end phase
  if (gs.phase !== "round_end") return

  if (gs.round === 3) {
    // Game finished — write status, leave gameState frozen for scoreboard
    await set(ref(db, `rooms/${roomId}/status`), "finished")
    return
  }

  // Refill hat from all word IDs in the room
  const wordsSnap = await get(ref(db, `rooms/${roomId}/words`))
  const wordIds = Object.keys(wordsSnap.val() ?? {})

  // Shuffle all words back into the hat
  const newHat = shuffle(wordIds)

  // Use update() for targeted writes — avoids stale ...gs spread clobbering concurrent field changes
  await update(ref(db, `rooms/${roomId}/gameState`), {
    hat: newHat,
    round: gs.round + 1,
    phase: "waiting_start",
    currentWordId: null,
    currentWordText: null,
    lastAction: null,
    wordsGuessedThisTurn: 0,
  })
}
