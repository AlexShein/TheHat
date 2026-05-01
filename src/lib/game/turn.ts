import { get, ref, set } from "firebase/database"
import type { Database } from "firebase/database"
import type { GameState, Team, RoomConfig, Player, PlayerStats } from "$lib/db-types"

type ROUND = "round1" | "round2" | "round3"
const ROUNDS: ROUND[] = ["round1", "round2", "round3"]

/** Error thrown when status transition is invalid */
export class InvalidPhaseTransitionError extends Error {
  constructor(public currentStatus: string) {
    super(`Cannot transition from "${currentStatus}"`)
    this.name = "InvalidPhaseTransitionError"
  }
}

/** Error thrown when any team has fewer than 2 players (bypass not enabled). */
export class MinPlayersError extends Error {
  constructor(
    public teamId: string,
    public count: number,
  ) {
    super(`Team ${teamId} has only ${count} player(s). Minimum 2 required.`)
    this.name = "MinPlayersError"
  }
}

/** Fisher-Yates shuffle — returns new array, does not mutate input. */
function shuffle<T>(arr: T[]): T[] {
  const result: T[] = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const a = result[i] as T
    const b = result[j] as T
    result[i] = b
    result[j] = a
  }
  return result
}

/**
 * Initializes game state and transitions room from pre-start → playing.
 * Must be called by admin (required by security rules).
 *
 * Reads all players and all words from RTDB. Writes teams, gameState, then status.
 * Status is written LAST — all clients see the full gameState atomically.
 *
 * @param db - Firebase RTDB instance
 * @param roomId - Room identifier
 * @param bypassMinPlayers - when true, skips the ≥2-players-per-team check
 */
export async function initializeGameState(
  db: Database,
  roomId: string,
  bypassMinPlayers: boolean,
): Promise<void> {
  // 1. Guard: only allow transition from "pre-start"
  const statusSnap = await get(ref(db, `rooms/${roomId}/status`))
  const currentStatus = statusSnap.val() as string | null

  if (currentStatus !== "pre-start") {
    throw new InvalidPhaseTransitionError(currentStatus ?? "unknown")
  }

  // 2. Read config, players, words in parallel
  const [configSnap, playersSnap, wordsSnap] = await Promise.all([
    get(ref(db, `rooms/${roomId}/config`)),
    get(ref(db, `rooms/${roomId}/players`)),
    get(ref(db, `rooms/${roomId}/words`)),
  ])

  const config = configSnap.val() as RoomConfig | null
  if (!config) throw new Error("Room config not found")

  const players = (playersSnap.val() as Record<string, Player> | null) ?? {}

  // 3. Validate players exist
  const playerIds = Object.keys(players)
  if (playerIds.length === 0) throw new Error("No players in room")

  // 4. Read word IDs from words node
  const wordsRaw = wordsSnap.val() as Record<string, unknown> | null
  const wordIds = Object.keys(wordsRaw ?? {})
  if (wordIds.length === 0) throw new Error("No words in room")

  // 5. Group players by teamId — skip unassigned (teamId === null)
  const teamPlayers: Record<string, string[]> = {}
  for (const [pid, p] of Object.entries(players)) {
    if (p.teamId === null) continue
    const tid = p.teamId
    if (!teamPlayers[tid]) teamPlayers[tid] = []
    teamPlayers[tid]!.push(pid)
  }

  const numTeams = config.numTeams

  // 6. Validate min players per team (unless bypassed)
  if (!bypassMinPlayers) {
    for (let i = 0; i < numTeams; i++) {
      const tid = `team-${i + 1}`
      const members: string[] = teamPlayers[tid] ?? []
      if (members.length < 2) {
        throw new MinPlayersError(tid, members.length)
      }
    }
  }

  // 7. Build hat: shuffled copy of all wordIds
  const hat = shuffle(wordIds)

  // 8. Build teams with shuffled playerOrder
  const teams: Record<string, Team> = {}
  const teamIds: string[] = []
  for (let i = 0; i < numTeams; i++) {
    const tid = `team-${i + 1}`
    teamIds.push(tid)
    const members = teamPlayers[tid] ?? []
    teams[tid] = {
      name: `Team ${i + 1}`,
      playerOrder: shuffle(members),
      currentPlayerIndex: 0,
      roundScores: {
        round1: 0,
        round2: 0,
        round3: 0,
      },
    }
    // Initialize round scores for rounds 1-3
    for (const r of ROUNDS) {
      teams[tid]!.roundScores[r] = 0
    }
  }

  // 9. Determine first team and first explainer
  const firstTeamId = teamIds[0]
  if (!firstTeamId) throw new Error("No teams created")
  const firstExplainerId = teams[firstTeamId]?.playerOrder[0]
  if (!firstExplainerId) throw new Error("No players in first team")

  // 10. Build per-player stats (all start at 0)
  const playerStats: Record<string, PlayerStats> = {}
  for (const pid of playerIds) {
    playerStats[pid] = { wordsExplained: 0 }
  }

  // 11. Assemble full GameState
  const gameState: GameState = {
    hat,
    currentWordId: null,
    currentTeamId: firstTeamId,
    currentExplainerId: firstExplainerId,
    round: 1,
    phase: "waiting_start",
    timerStartedAt: null,
    timerDuration: config.timerDuration,
    pausedAt: null,
    timeRemainingAtPause: null,
    lastAction: null,
    playerStats,
  }

  // 12. Write teams and gameState before status
  await set(ref(db, `rooms/${roomId}/teams`), teams)
  await set(ref(db, `rooms/${roomId}/gameState`), gameState)

  // 13. Write status LAST — atomic to all observers, gate on all prior writes
  await set(ref(db, `rooms/${roomId}/status`), "playing")
}
