import { ref, set, get } from "firebase/database"
import type { Database } from "firebase/database"
import type { GameState, LastAction } from "$lib/db-types"

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
 * Reads gameState atomically, computes rollback, writes back.
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
  const snap = await get(gsRef)
  if (!snap.exists()) throw new UndoNotAvailableError()

  const gs = snap.val() as GameState
  const action: LastAction | null | undefined = gs.lastAction ?? null

  if (!action || action.type === null) {
    throw new UndoNotAvailableError()
  }

  // Compute new hat — restore lastAction.wordId always.
  // Restore currentWordId only for guessed (both words were consumed).
  const hat: string[] = [...(gs.hat ?? [])]
  if (action.type === "guessed" && gs.currentWordId !== null && !hat.includes(gs.currentWordId)) {
    hat.push(gs.currentWordId)
  }
  if (action.wordId !== null && !hat.includes(action.wordId)) {
    hat.push(action.wordId)
  }

  // Compute updated playerStats
  const playerStats = { ...(gs.playerStats ?? {}) }
  const explainerId = gs.currentExplainerId
  if (action.type === "guessed" && explainerId && playerStats[explainerId]) {
    playerStats[explainerId] = {
      wordsExplained: Math.max(0, playerStats[explainerId]!.wordsExplained - 1),
    }
  }

  // Write gameState atomically (hat + currentWordId + lastAction + playerStats)
  await set(gsRef, {
    ...gs,
    hat,
    currentWordId: action.wordId,
    lastAction: null,
    playerStats,
  })

  // Roll back team score at separate path
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
