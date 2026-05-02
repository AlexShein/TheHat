import { ref, update } from "firebase/database"
import { serverTimestamp } from "firebase/database"
import type { Database } from "firebase/database"
import { drawWord } from "./hat"

/**
 * Starts the explainer's turn. Writes timerStartedAt (serverTimestamp) and
 * phase='explaining' atomically, then draws first word from the hat.
 *
 * Returns the drawn wordId, or null if hat was empty.
 * Only call from explainer's client during 'waiting_start' phase.
 */
export async function startTurn(db: Database, roomId: string): Promise<string | null> {
  await update(ref(db, `rooms/${roomId}/gameState`), {
    timerStartedAt: serverTimestamp(),
    phase: "explaining",
  })

  const wordId = await drawWord(db, roomId)
  return wordId
}
