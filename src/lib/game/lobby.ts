import { ref, set, get } from "firebase/database"
import type { Database } from "firebase/database"
import type { Player } from "$lib/db-types"

/** Thrown when attempting to join a team that doesn't exist in /rooms/{roomId}/teams */
export class TeamNotFoundError extends Error {
  constructor(teamId: string) {
    super(`Team not found: ${teamId}`)
    this.name = "TeamNotFoundError"
  }
}

/** Thrown when attempting to set ready while teamId is null */
export class ReadyWithoutTeamError extends Error {
  constructor() {
    super("Must select a team before marking ready")
    this.name = "ReadyWithoutTeamError"
  }
}

/**
 * Writes player.teamId to join a team.
 * Validates that the team node exists in /rooms/{roomId}/teams/{teamId}.
 * Atomic write — only teamId field changes. Switching teams overwrites old value.
 */
export async function joinTeam(
  db: Database,
  roomId: string,
  playerId: string,
  teamId: string,
): Promise<void> {
  const teamSnap = await get(ref(db, `rooms/${roomId}/teams/${teamId}`))
  if (!teamSnap.exists()) {
    throw new TeamNotFoundError(teamId)
  }

  await set(ref(db, `rooms/${roomId}/players/${playerId}/teamId`), teamId)
}

/**
 * Writes player.ready = value.
 * Throws ReadyWithoutTeamError if player.teamId is null (guard — UI should disable button).
 */
export async function setReady(
  db: Database,
  roomId: string,
  playerId: string,
  ready: boolean,
): Promise<void> {
  const snap = await get(ref(db, `rooms/${roomId}/players/${playerId}`))
  const player = snap.val() as Player | null

  if (!player?.teamId) {
    throw new ReadyWithoutTeamError()
  }

  await set(ref(db, `rooms/${roomId}/players/${playerId}/ready`), ready)
}

/**
 * Pure function — checks if all players have submitted words AND are ready AND
 * every team has ≥ 2 players (unless bypassMinPlayers is true).
 * Returns { allReady: boolean; reason: string } for UI feedback.
 */
export function checkAllReady(
  players: Record<string, Player>,
  numTeams: number,
  bypassMinPlayers: boolean,
): { allReady: boolean; reason: string } {
  const reasons: string[] = []

  // 1. All players must have submitted words
  const notSubmitted = Object.entries(players).filter(([, p]) => !p.wordsSubmitted)
  if (notSubmitted.length > 0) {
    reasons.push(`${notSubmitted.length} player(s) haven't submitted words`)
  }

  // 2. All players must be ready
  const notReady = Object.entries(players).filter(([, p]) => !p.ready)
  if (notReady.length > 0) {
    reasons.push(`${notReady.length} player(s) not ready`)
  }

  // 3. Every team must have ≥ 2 players (unless bypassed)
  if (!bypassMinPlayers) {
    const noTeam = Object.values(players).filter((p) => !p.teamId)
    if (noTeam.length > 0) {
      reasons.push(`${noTeam.length} player(s) haven't selected a team`)
    }

    for (let i = 1; i <= numTeams; i++) {
      const teamId = `team-${i}`
      const count = Object.values(players).filter((p) => p.teamId === teamId).length
      if (count < 2) {
        reasons.push(`Team ${i} has ${count} player(s), need at least 2`)
      }
    }
  }

  return {
    allReady: reasons.length === 0,
    reason: reasons.join("; "),
  }
}
