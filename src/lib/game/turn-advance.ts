import { ref, get, set, update } from "firebase/database"
import type { Database } from "firebase/database"
import type { GameState, Team } from "$lib/db-types"

/**
 * Advances turn to next team (round-robin). Always rotates teams between turns.
 * Advances current team's currentPlayerIndex (saved for when that team plays again).
 * Uses next team's existing currentPlayerIndex to select explainer.
 *
 * Writes: phase ('waiting_start' or 'round_end'), currentTeamId, currentExplainerId,
 *        currentWordId=null, lastAction=null, wordsGuessedThisTurn=0.
 *
 * If hat.length === 0, writes phase: 'round_end' without advancing turn order.
 * Reads teams/{teamId}/playerOrder and teams/{teamId}/currentPlayerIndex from RTDB.
 */
export async function advanceTurn(db: Database, roomId: string): Promise<void> {
  const [gsSnap, teamsSnap] = await Promise.all([
    get(ref(db, `rooms/${roomId}/gameState`)),
    get(ref(db, `rooms/${roomId}/teams`)),
  ])

  if (!gsSnap.exists() || !teamsSnap.exists()) return

  const gs = gsSnap.val() as GameState

  // Phase guard: only advance during post_turn
  if (gs.phase !== "post_turn") return

  const teams = teamsSnap.val() as Record<string, Team>

  const hat: string[] = gs.hat ?? []

  // Hat empty → round_end, do NOT advance turn order (AC 5)
  if (hat.length === 0) {
    await update(ref(db, `rooms/${roomId}/gameState`), {
      phase: "round_end",
      currentWordId: null,
      lastAction: null,
      wordsGuessedThisTurn: 0,
    })
    return
  }

  // Collect sorted team IDs (consistent ordering: team-1, team-2, ...)
  const teamIds = Object.keys(teams).sort()
  if (teamIds.length === 0) return

  const currentTeamId = gs.currentTeamId
  const currentTeam = teams[currentTeamId]

  if (!currentTeam) return

  const playerOrder = currentTeam.playerOrder ?? []
  if (playerOrder.length === 0) return

  const currentIndex = currentTeam.currentPlayerIndex ?? 0

  // Always rotate to next team. Advance current team's index for next time.
  const nextCurrentTeamIndex = (currentIndex + 1) % playerOrder.length
  const currentTeamPos = teamIds.indexOf(currentTeamId)
  const nextTeamPos = (currentTeamPos + 1) % teamIds.length
  const nextTeamId = teamIds[nextTeamPos]!

  const nextTeam = teams[nextTeamId]
  if (!nextTeam) return

  // Use next team's existing currentPlayerIndex to pick explainer
  const nextTeamIndex = nextTeam.currentPlayerIndex ?? 0
  const nextExplainerId = nextTeam.playerOrder?.[nextTeamIndex]
  if (!nextExplainerId) return

  // Save current team's advanced index for when it gets next turn
  await set(ref(db, `rooms/${roomId}/teams/${currentTeamId}/currentPlayerIndex`), nextCurrentTeamIndex)

  // Write gameState — use update() for targeted writes, avoids stale ...gs spread
  await update(ref(db, `rooms/${roomId}/gameState`), {
    phase: "waiting_start",
    currentTeamId: nextTeamId,
    currentExplainerId: nextExplainerId,
    currentWordId: null,
    lastAction: null,
    wordsGuessedThisTurn: 0,
  })
}
