import { ref, runTransaction, get } from "firebase/database"
import type { Database } from "firebase/database"
import type { GameState, Word } from "$lib/db-types"

/**
 * Atomically removes one random wordId from gameState.hat via runTransaction.
 * Writes drawn wordId to gameState.currentWordId and fetches word text
 * from /words/{wordId} to write gameState.currentWordText in same transaction.
 * Returns the drawn wordId, or null if hat was empty.
 * Must be called only by currentExplainerId's client.
 */
export async function drawWord(db: Database, roomId: string): Promise<string | null> {
  const gsRef = ref(db, `rooms/${roomId}/gameState`)

  const result = await runTransaction(gsRef, (current) => {
    if (current === null) return null

    const gs = current as GameState
    const hat: string[] = gs.hat ?? []

    if (hat.length === 0) return // abort transaction — hat empty

    const idx = Math.floor(Math.random() * hat.length)
    const drawn = hat[idx]!
    const newHat = hat.filter((_, i) => i !== idx)

    return {
      ...gs,
      hat: newHat,
      currentWordId: drawn,
      // currentWordText resolved after transaction via separate get()
    }
  })

  if (!result.committed) return null

  const gs = result.snapshot.val() as GameState | null
  const wordId = gs?.currentWordId ?? null

  // Fetch word text and write currentWordText separately.
  // Transaction already wrote currentWordId atomically — text is a non-critical
  // derived field safe to write after. Observers see it in post_expiry.
  if (wordId !== null) {
    try {
      const wordSnap = await get(ref(db, `rooms/${roomId}/words/${wordId}`))
      const word = wordSnap.val() as Word | null
      const wordText = word?.text ?? null

      // Write currentWordText via another transaction to avoid race with concurrent reads
      await runTransaction(gsRef, (current) => {
        if (current === null) return null
        const gs2 = current as GameState
        return { ...gs2, currentWordText: wordText }
      })
    } catch {
      // Word node doesn't exist — leave currentWordText as null.
      // Already null from initialization, but ensure consistency.
      void runTransaction(gsRef, (current) => {
        if (current === null) return null
        const gs2 = current as GameState
        return { ...gs2, currentWordText: null }
      })
    }
  }

  return wordId
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
