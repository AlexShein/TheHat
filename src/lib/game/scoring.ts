import { ref, set, get, runTransaction } from "firebase/database"
import type { Database } from "firebase/database"
import type { GameState, LastAction, Word } from "$lib/db-types"
import { incrementWordsGuessedThisTurn } from "./turn"

export class UndoNotAvailableError extends Error {
  constructor() {
    super("No last action to undo")
    this.name = "UndoNotAvailableError"
  }
}

/**
 * Increments team roundScores for current round by 1.
 * Increments explainer's playerStats.wordsExplained by 1.
 */
export async function awardPoint(
  db: Database,
  roomId: string,
  teamId: string,
  explainerId: string,
  currentRound: number,
): Promise<void> {
  const scorePath = `rooms/${roomId}/teams/${teamId}/roundScores/round${currentRound}`
  const statsPath = `rooms/${roomId}/gameState/playerStats/${explainerId}/wordsExplained`

  const [scoreSnap, statsSnap] = await Promise.all([get(ref(db, scorePath)), get(ref(db, statsPath))])

  const currentScore: number = scoreSnap.val() ?? 0
  const currentExplained: number = statsSnap.val() ?? 0

  await Promise.all([
    set(ref(db, scorePath), currentScore + 1),
    set(ref(db, statsPath), currentExplained + 1),
    incrementWordsGuessedThisTurn(db, roomId),
  ])
}

/**
 * Decrements team roundScores for current round by 1.
 * No-op when skipPenalty is false. Clamps at 0.
 */
export async function applyPenalty(
  db: Database,
  roomId: string,
  teamId: string,
  skipPenalty: boolean,
  currentRound: number,
): Promise<void> {
  if (!skipPenalty) return

  const scorePath = `rooms/${roomId}/teams/${teamId}/roundScores/round${currentRound}`
  const scoreSnap = await get(ref(db, scorePath))
  const currentScore: number = scoreSnap.val() ?? 0
  const newScore = Math.max(0, currentScore - 1)

  await set(ref(db, scorePath), newScore)
}

/**
 * Reverses last action (guessed or skipped).
 * Reads gameState + words, computes rollback, writes via runTransaction.
 * Safe under single-writer-per-turn invariant.
 * Throws UndoNotAvailableError if lastAction is null.
 */
export async function undoLastAction(
  db: Database,
  roomId: string,
  currentRound: number,
  skipPenalty: boolean,
): Promise<void> {
  const gsRef = ref(db, `rooms/${roomId}/gameState`)

  // Read gameState + words pre-transaction
  const [gsSnap, wordsSnap] = await Promise.all([get(gsRef), get(ref(db, `rooms/${roomId}/words`))])

  if (!gsSnap.exists()) throw new UndoNotAvailableError()

  const gs = gsSnap.val() as GameState
  const action: LastAction | null | undefined = gs.lastAction ?? null

  if (!action || action.type === null) {
    throw new UndoNotAvailableError()
  }

  // Build words lookup for currentWordText resolution
  const wordsMap = new Map<string, string>()
  if (wordsSnap.exists()) {
    const words = wordsSnap.val() as Record<string, Word>
    for (const [id, w] of Object.entries(words)) {
      if (w?.text) wordsMap.set(id, w.text)
    }
  }

  // Compute word text for the restored word
  const restoredWordText = action.wordId ? (wordsMap.get(action.wordId) ?? null) : null

  // Run transaction: atomically update hat + currentWordId + currentWordText + lastAction + playerStats
  await runTransaction(gsRef, (current) => {
    if (current === null) return null

    const currentGs = current as GameState
    const hat: string[] = [...(currentGs.hat ?? [])]

    // Return currentWordId to hat (the word explainer was looking at when action happened)
    if (currentGs.currentWordId !== null && !hat.includes(currentGs.currentWordId)) {
      hat.push(currentGs.currentWordId)
    }

    // Return action.wordId to hat — it also becomes currentWordId below.
    // Both currentWordId and action.wordId land in hat per existing test expectations.
    if (action.wordId !== null && !hat.includes(action.wordId)) {
      hat.push(action.wordId)
    }

    // Compute updated playerStats
    const playerStats = { ...(currentGs.playerStats ?? {}) }
    const explainerId = currentGs.currentExplainerId
    if (action.type === "guessed" && explainerId && playerStats[explainerId]) {
      playerStats[explainerId] = {
        wordsExplained: Math.max(0, playerStats[explainerId]!.wordsExplained - 1),
      }
    }

    return {
      ...currentGs,
      hat,
      currentWordId: action.wordId,
      currentWordText: restoredWordText,
      lastAction: null,
      playerStats,
    }
  })

  // Roll back team score at separate path (not part of transaction — score is separate RTDB node)
  await rollbackTeamScore(db, roomId, action, currentRound, skipPenalty)
}

/** Writes score adjustment for team based on lastAction type. */
async function rollbackTeamScore(
  db: Database,
  roomId: string,
  action: LastAction,
  currentRound: number,
  skipPenalty: boolean,
): Promise<void> {
  if (action.scoredTeamId === null) return

  const scorePath = `rooms/${roomId}/teams/${action.scoredTeamId}/roundScores/round${currentRound}`
  const scoreSnap = await get(ref(db, scorePath))
  const currentScore: number = scoreSnap.val() ?? 0

  if (action.type === "guessed") {
    await set(ref(db, scorePath), Math.max(0, currentScore - 1))
  } else if (action.type === "skipped" && action.scoreWasPenalty && skipPenalty) {
    await set(ref(db, scorePath), currentScore + 1)
  }
}
