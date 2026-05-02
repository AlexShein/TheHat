import { ref, get, set, update } from "firebase/database"
import type { Database } from "firebase/database"
import type { GameState, Team } from "$lib/db-types"

/**
 * Advances to next explainer in team, or next team if team exhausted.
 * Writes: phase, currentTeamId, currentExplainerId, currentPlayerIndex,
 *        currentWordId=null, lastAction=null, wordsGuessedThisTurn=0.
 *
 * If hat.length === 0 after advance, writes phase: 'round_end' instead of 'waiting_start'.
 * Reads teams/{teamId}/playerOrder and teams/{teamId}/currentPlayerIndex from RTDB.
 */
export async function advanceTurn(db: Database, roomId: string): Promise<void> {
  const [gsSnap, teamsSnap] = await Promise.all([
    get(ref(db, `rooms/${roomId}/gameState`)),
    get(ref(db, `rooms/${roomId}/teams`)),
  ])

  if (!gsSnap.exists() || !teamsSnap.exists()) return

  const gs = gsSnap.val() as GameState
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
  const nextIndex = (currentIndex + 1) % playerOrder.length

  // Determine if we stay on same team or move to next
  let nextTeamId: string
  let newIndex: number

  if (nextIndex !== 0) {
    // Still within same team — advance index only
    nextTeamId = currentTeamId
    newIndex = nextIndex
  } else {
    // Wrapped within team — move to next team, reset index to 0
    const currentTeamPos = teamIds.indexOf(currentTeamId)
    const nextTeamPos = (currentTeamPos + 1) % teamIds.length
    nextTeamId = teamIds[nextTeamPos]!
    newIndex = 0
  }

  const nextTeam = teams[nextTeamId]
  if (!nextTeam) return

  const nextExplainerId = nextTeam.playerOrder?.[newIndex]
  if (!nextExplainerId) return

  // Update currentPlayerIndex for both old and new teams when wrapping
  if (nextTeamId !== currentTeamId) {
    // Wrapping to next team: reset old team's index to 0
    await set(ref(db, `rooms/${roomId}/teams/${currentTeamId}/currentPlayerIndex`), 0)
  }
  await set(ref(db, `rooms/${roomId}/teams/${nextTeamId}/currentPlayerIndex`), newIndex)

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
