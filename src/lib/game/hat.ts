import { ref, runTransaction } from "firebase/database"
import type { Database } from "firebase/database"
import type { GameState } from "$lib/db-types"

/**
 * Atomically removes one random wordId from gameState.hat via runTransaction.
 * Writes drawn wordId to gameState.currentWordId in same transaction.
 * Returns the drawn wordId, or null if hat was empty.
 * Must be called only by currentExplainerId's client.
 */
export async function drawWord(db: Database, roomId: string): Promise<string | null> {
  const gsRef = ref(db, `rooms/${roomId}/gameState`)

  const result = await runTransaction(gsRef, (current) => {
    if (current === null) return null

    const gs = current as GameState
    const hat: string[] = gs.hat ?? []

    if (hat.length === 0) return current // abort — hat empty, no mutation

    const idx = Math.floor(Math.random() * hat.length)
    const drawn = hat[idx]!
    const newHat = hat.filter((_, i) => i !== idx)

    return {
      ...gs,
      hat: newHat,
      currentWordId: drawn,
    }
  })

  if (!result.committed) return null

  const gs = result.snapshot.val() as GameState | null
  return gs?.currentWordId ?? null
}

/**
 * Atomically adds wordId back to gameState.hat via runTransaction.
 * Idempotent — dup check within transaction ensures word added at most once.
 */
export async function returnWord(db: Database, roomId: string, wordId: string): Promise<void> {
  const gsRef = ref(db, `rooms/${roomId}/gameState`)

  await runTransaction(gsRef, (current) => {
    if (current === null) return null

    const gs = current as GameState
    const hat: string[] = gs.hat ?? []

    if (hat.includes(wordId)) return current // idempotent — already present

    return {
      ...gs,
      hat: [...hat, wordId],
    }
  })
}
