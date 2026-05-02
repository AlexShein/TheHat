import { ref, runTransaction, get } from "firebase/database"
import type { Database } from "firebase/database"
import type { GameState, Word } from "$lib/db-types"

/**
 * Atomically removes one random wordId from gameState.hat via runTransaction.
 * Hat pre-check outside transaction (fast path for empty hat).
 * Random index chosen inside transaction to guard against concurrent reads
 * picking the same word. Returns the drawn wordId, or null if hat was empty.
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

  // Pre-fetch all word texts since random pick happens inside transaction
  const wordsSnap = await get(ref(db, `rooms/${roomId}/words`))
  const wordsMap = new Map<string, string>()
  if (wordsSnap.exists()) {
    const words = wordsSnap.val() as Record<string, Word>
    for (const [id, w] of Object.entries(words)) {
      if (w?.text) wordsMap.set(id, w.text)
    }
  }

  // Single transaction: pick random word from CURRENT hat, remove, write all fields
  const result = await runTransaction(gsRef, (current) => {
    if (current === null) return null

    const currentGs = current as GameState
    const currentHat: string[] = currentGs.hat ?? []

    if (currentHat.length === 0) return null

    // Pick random word from CURRENT hat (inside transaction for safety)
    const idx = Math.floor(Math.random() * currentHat.length)
    const drawnWordId = currentHat[idx]!

    const newHat = currentHat.filter((id) => id !== drawnWordId)
    const wordText = wordsMap.get(drawnWordId) ?? null

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
