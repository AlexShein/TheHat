import { ref, get, update } from "firebase/database"
import type { Database } from "firebase/database"
import type { GameState, Team } from "$lib/db-types"

/** Thrown when newPlayerId is not in currentTeam.playerOrder. */
export class ExplainerNotInTeamError extends Error {
  constructor(
    public playerId: string,
    public teamId: string,
  ) {
    super(`Player "${playerId}" is not in team "${teamId}"`)
    this.name = "ExplainerNotInTeamError"
  }
}

/** Thrown when reassignExplainer() is called but game is not paused. */
export class PauseRequiredError extends Error {
  constructor() {
    super("Game must be paused to reassign the explainer")
    this.name = "PauseRequiredError"
  }
}

/**
 * Reassigns the explainer to a different player within the current team.
 * Only callable when game is paused AND caller is admin or room creator.
 *
 * Reads: gameState (currentTeamId, pausedAt),
 *        teams/{currentTeamId} (playerOrder)
 * Writes: gameState.currentExplainerId,
 *         teams/{currentTeamId}/currentPlayerIndex
 *
 * Both writes use update() for atomicity within each path.
 * Idempotent — reassigning to same playerId is a no-op.
 */
export async function reassignExplainer(
  db: Database,
  roomId: string,
  newPlayerId: string,
  callerUid: string,
): Promise<void> {
  // 1. Permission check — admin or room creator
  await checkAdminOrCreator(db, roomId, callerUid)

  // 2. Read gameState and teams
  const [gsSnap, teamsSnap] = await Promise.all([
    get(ref(db, `rooms/${roomId}/gameState`)),
    get(ref(db, `rooms/${roomId}/teams`)),
  ])

  const gs = gsSnap.val() as GameState | null
  if (!gs) throw new Error("Game state not found")

  // 3. Guard: must be paused
  if (gs.pausedAt == null) {
    throw new PauseRequiredError()
  }

  const currentTeamId = gs.currentTeamId
  const teams = teamsSnap.val() as Record<string, Team> | null
  if (!teams) throw new Error("Teams not found")

  const currentTeam = teams[currentTeamId]
  if (!currentTeam) throw new Error(`Team "${currentTeamId}" not found`)

  const playerOrder = currentTeam.playerOrder ?? []
  const newIndex = playerOrder.indexOf(newPlayerId)

  // 4. Guard: newPlayerId must be in current team's playerOrder
  if (newIndex === -1) {
    throw new ExplainerNotInTeamError(newPlayerId, currentTeamId)
  }

  // 5. Idempotency check — if already the current explainer, skip writes
  if (gs.currentExplainerId === newPlayerId && currentTeam.currentPlayerIndex === newIndex) {
    return
  }

  // 6. Write currentExplainerId + currentPlayerIndex
  //    Two update() calls (separate RTDB paths) — both are atomic per-path
  await Promise.all([
    update(ref(db, `rooms/${roomId}/gameState`), {
      currentExplainerId: newPlayerId,
    }),
    update(ref(db, `rooms/${roomId}/teams/${currentTeamId}`), {
      currentPlayerIndex: newIndex,
    }),
  ])
}

/** Verifies callerUid is in /admins/ or is the room creator. */
async function checkAdminOrCreator(db: Database, roomId: string, callerUid: string): Promise<void> {
  const [adminSnap, creatorSnap] = await Promise.all([
    get(ref(db, `admins/${callerUid}`)),
    get(ref(db, `rooms/${roomId}/meta/createdBy`)),
  ])
  const isAdmin = adminSnap.exists()
  const isCreator = creatorSnap.val() === callerUid
  if (!isAdmin && !isCreator) {
    throw new Error("Permission denied: caller is not admin or room creator")
  }
}
