import { ref, runTransaction, get } from "firebase/database"
import type { Database } from "firebase/database"
import type { GameState, Word } from "$lib/db-types"

/**
 * Atomically removes one random wordId from gameState.hat via runTransaction.
 * Reads hat outside transaction (safe under single-writer-per-turn),
 * pre-fetches word text, then single transaction verifies+removes+writes
 * currentWordId and currentWordText all atomically.
 * Returns the drawn wordId, or null if hat was empty.
 * Must be called only by currentExplainerId's client.
 */
export async function drawWord(db: Database, roomId: string): Promise<string | null> {
  const gsRef = ref(db, `rooms/${roomId}/gameState`)

  // Read current hat outside transaction — safe: single-writer-per-turn
  const gsSnap = await get(gsRef)
  if (!gsSnap.exists()) return null
  const gs = gsSnap.val() as GameState
  const hat: string[] = gs.hat ?? []
  if (hat.length === 0) return null

  const idx = Math.floor(Math.random() * hat.length)
  const drawnWordId = hat[idx]!

  // Pre-fetch word text — word node may not exist (ghost-word edge case)
  let wordText: string | null = null
  try {
    const wordSnap = await get(ref(db, `rooms/${roomId}/words/${drawnWordId}`))
    if (wordSnap.exists()) {
      const word = wordSnap.val() as Word
      wordText = word.text ?? null
    }
  } catch {
    // Word node missing — currentWordText stays null
  }

  // Single transaction: verify word still in hat, remove, write all fields
  const result = await runTransaction(gsRef, (current) => {
    if (current === null) return null

    const currentGs = current as GameState
    const currentHat: string[] = currentGs.hat ?? []

    // Verify word is still present (stale read guard)
    if (!currentHat.includes(drawnWordId)) return // abort — word already drawn

    const newHat = currentHat.filter((id) => id !== drawnWordId)

    return {
      ...currentGs,
      hat: newHat,
      currentWordId: drawnWordId,
      currentWordText: wordText,
    }
  })

  if (!result.committed) return null
  const finalGs = result.snapshot.val() as GameState | null
  return finalGs?.currentWordId ?? null
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
