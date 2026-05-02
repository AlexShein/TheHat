import { ref, set, update } from "firebase/database"
import type { Database } from "firebase/database"
import type { LastAction } from "$lib/db-types"
import { awardPoint, applyPenalty } from "./scoring"
import { drawWord, returnWord } from "./hat"

/**
 * Records a Guessed action: writes lastAction to RTDB, awards point,
 * increments wordsGuessedThisTurn (via awardPoint), draws next word.
 *
 * Returns the next wordId drawn, or null if hat is empty.
 * Caller must check for null and call endTurnEarly() if needed.
 */
export async function recordGuessed(
  db: Database,
  roomId: string,
  currentWordId: string,
  teamId: string,
  explainerId: string,
  currentRound: number,
): Promise<string | null> {
  // Write lastAction first — must exist before awardPoint so Undo can read it
  const lastAction: LastAction = {
    type: "guessed",
    wordId: currentWordId,
    scoredTeamId: teamId,
    scoreWasPenalty: false,
  }
  await set(ref(db, `rooms/${roomId}/gameState/lastAction`), lastAction)

  // Award point (also increments wordsGuessedThisTurn)
  await awardPoint(db, roomId, teamId, explainerId, currentRound)

  // Draw next word
  return drawWord(db, roomId)
}

/**
 * Records a Skipped action: writes lastAction to RTDB, returns current word
 * to hat, applies penalty if skipPenalty is true, draws next word.
 *
 * Returns the next wordId drawn, or null if hat is empty.
 * Caller must check for null and call endTurnEarly() if needed.
 */
export async function recordSkip(
  db: Database,
  roomId: string,
  currentWordId: string,
  teamId: string,
  skipPenalty: boolean,
  currentRound: number,
): Promise<string | null> {
  // Apply penalty first (so score is updated before we write lastAction)
  await applyPenalty(db, roomId, teamId, skipPenalty, currentRound)

  // Return word to hat
  await returnWord(db, roomId, currentWordId)

  // Write lastAction after score changes are committed
  const lastAction: LastAction = {
    type: "skipped",
    wordId: currentWordId,
    scoredTeamId: null,
    scoreWasPenalty: skipPenalty,
  }
  await set(ref(db, `rooms/${roomId}/gameState/lastAction`), lastAction)

  // Draw next word
  return drawWord(db, roomId)
}

/**
 * Completes post-expiry with a Guessed action: awards point to selected team,
 * transitions to post_turn, clears currentWordId and lastAction.
 *
 * Only valid during 'post_expiry' phase.
 */
export async function completePostExpiryGuessed(
  db: Database,
  roomId: string,
  selectedTeamId: string,
  explainerId: string,
  currentRound: number,
): Promise<void> {
  // Award point to the team selected in post_expiry team selector
  await awardPoint(db, roomId, selectedTeamId, explainerId, currentRound)

  // Transition to post_turn, clear current word and lastAction
  await update(ref(db, `rooms/${roomId}/gameState`), {
    phase: "post_turn",
    currentWordId: null,
    lastAction: null,
  })
}

/**
 * Completes post-expiry with a Skip action: returns word to hat,
 * transitions to post_turn, clears currentWordId and lastAction.
 *
 * Only valid during 'post_expiry' phase.
 */
export async function completePostExpirySkip(
  db: Database,
  roomId: string,
  currentWordId: string,
): Promise<void> {
  // Return word to hat
  await returnWord(db, roomId, currentWordId)

  // Transition to post_turn, clear current word and lastAction
  await update(ref(db, `rooms/${roomId}/gameState`), {
    phase: "post_turn",
    currentWordId: null,
    lastAction: null,
  })
}
