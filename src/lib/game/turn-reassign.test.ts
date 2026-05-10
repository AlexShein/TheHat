import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { getDatabase, connectDatabaseEmulator, ref, set, get } from "firebase/database"
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app"
import { getAuth, connectAuthEmulator, signInAnonymously, signOut } from "firebase/auth"
import { reassignExplainer, ExplainerNotInTeamError, PauseRequiredError } from "./turn-reassign"

const firebaseConfig = {
  projectId: "the-hat-dev",
  apiKey: "fake-api-key",
  databaseURL: "http://127.0.0.1:9000?ns=the-hat-dev",
}

let app: FirebaseApp
let adminUid: string
let roomIdx = 0

function makeDatabase(): ReturnType<typeof getDatabase> {
  const db = getDatabase(app)
  connectDatabaseEmulator(db, "127.0.0.1", 9000)
  return db
}

beforeAll(async () => {
  app = initializeApp(firebaseConfig)

  const auth = getAuth(app)
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true })
  const cred = await signInAnonymously(auth)
  adminUid = cred.user.uid

  const db = getDatabase(app)
  connectDatabaseEmulator(db, "127.0.0.1", 9000)
  await set(ref(db, `admins/${adminUid}`), true)
})

afterAll(async () => {
  await deleteApp(app)
})

/**
 * Seeds a playing room with two teams, paused state, and player order.
 * Default currentExplainerId = "player-0" (index 0 in team-1's playerOrder).
 * Default newPlayerId target = "player-1" (index 1 in team-1's playerOrder).
 */
async function seedPausedRoom(
  db: ReturnType<typeof getDatabase>,
  roomId: string,
  overrides: Partial<{
    pausedAt: number | null
    currentTeamId: string
    currentExplainerId: string
    currentPlayerIndex: number
    playerOrder: string[]
  }> = {},
) {
  const currentTeamId = overrides.currentTeamId ?? "team-1"
  const playerOrder = overrides.playerOrder ?? ["player-0", "player-1", "player-2"]

  await set(ref(db, `rooms/${roomId}/config`), {
    wordCount: 3,
    numTeams: 2,
    skipPenalty: false,
    timerDuration: 60000,
  })

  await set(ref(db, `rooms/${roomId}/meta`), {
    createdBy: adminUid,
    createdAt: 0,
    lastActiveAt: 0,
  })

  await set(ref(db, `rooms/${roomId}/status`), "playing")

  await set(ref(db, `rooms/${roomId}/teams`), {
    "team-1": {
      name: "Team 1",
      playerOrder,
      currentPlayerIndex: overrides.currentPlayerIndex ?? 0,
      roundScores: { round1: 0, round2: 0, round3: 0 },
    },
    "team-2": {
      name: "Team 2",
      playerOrder: ["player-3", "player-4", "player-5"],
      currentPlayerIndex: 0,
      roundScores: { round1: 0, round2: 0, round3: 0 },
    },
  })

  await set(ref(db, `rooms/${roomId}/gameState`), {
    round: 1,
    currentTeamId,
    currentExplainerId: overrides.currentExplainerId ?? "player-0",
    timerStartedAt: Date.now(),
    timerDuration: 60000,
    pausedAt: overrides.pausedAt !== undefined ? overrides.pausedAt : Date.now(),
    timeRemainingAtPause: 40000,
    phase: "explaining",
    hat: ["w1", "w2", "w3"],
    currentWordId: "w1",
    currentWordText: "test-word",
    wordsGuessedThisTurn: 0,
    lastAction: null,
    playerStats: {},
  })
}

describe("reassignExplainer", () => {
  it("updates currentExplainerId and currentPlayerIndex to new player in same team", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedPausedRoom(db, roomId)

    await reassignExplainer(db, roomId, "player-1", adminUid)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    expect(gs.currentExplainerId).toBe("player-1")

    const teamSnap = await get(ref(db, `rooms/${roomId}/teams/team-1`))
    const team = teamSnap.val()
    expect(team.currentPlayerIndex).toBe(1)
  })

  it("works when reassigning to player at index 0 (edge: first in order)", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    // currentExplainerId is "player-1" (index 1), reassign to "player-0" (index 0)
    await seedPausedRoom(db, roomId, {
      currentExplainerId: "player-1",
      currentPlayerIndex: 1,
    })

    await reassignExplainer(db, roomId, "player-0", adminUid)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    expect(gs.currentExplainerId).toBe("player-0")

    const teamSnap = await get(ref(db, `rooms/${roomId}/teams/team-1`))
    const team = teamSnap.val()
    expect(team.currentPlayerIndex).toBe(0)
  })

  it("throws ExplainerNotInTeamError when newPlayerId not in currentTeam.playerOrder", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedPausedRoom(db, roomId)

    // "player-99" is not in any team's playerOrder
    await expect(reassignExplainer(db, roomId, "player-99", adminUid)).rejects.toThrow(
      ExplainerNotInTeamError,
    )
  })

  it("throws PauseRequiredError when game is not paused", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    // pausedAt = null means game is not paused
    await seedPausedRoom(db, roomId, { pausedAt: null })

    await expect(reassignExplainer(db, roomId, "player-1", adminUid)).rejects.toThrow(PauseRequiredError)
  })

  it("throws permission error when caller is not admin/creator", async () => {
    const nonAdminApp = initializeApp(
      {
        projectId: "the-hat-dev",
        apiKey: "fake-api-key-nonadmin",
        databaseURL: "http://127.0.0.1:9000?ns=the-hat-dev",
      },
      `non-admin-reassign-${Date.now()}`,
    )
    const nonAdminDb = getDatabase(nonAdminApp)
    connectDatabaseEmulator(nonAdminDb, "127.0.0.1", 9000)
    const nonAdminAuth = getAuth(nonAdminApp)
    connectAuthEmulator(nonAdminAuth, "http://127.0.0.1:9099", { disableWarnings: true })

    const cred = await signInAnonymously(nonAdminAuth)
    const nonAdminUid = cred.user.uid

    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedPausedRoom(db, roomId)

    await expect(reassignExplainer(nonAdminDb, roomId, "player-1", nonAdminUid)).rejects.toThrow(
      /permission/i,
    )

    await signOut(nonAdminAuth)
    await deleteApp(nonAdminApp)
  })

  it("is idempotent — calling twice with same playerId leaves state unchanged", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedPausedRoom(db, roomId)

    await reassignExplainer(db, roomId, "player-1", adminUid)

    // Second call with same playerId should not throw or change state
    await reassignExplainer(db, roomId, "player-1", adminUid)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    expect(gs.currentExplainerId).toBe("player-1")

    const teamSnap = await get(ref(db, `rooms/${roomId}/teams/team-1`))
    const team = teamSnap.val()
    expect(team.currentPlayerIndex).toBe(1)
  })

  it("maintains consistency: currentPlayerIndex resolves to currentExplainerId after reassign", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedPausedRoom(db, roomId, {
      playerOrder: ["alpha", "beta", "gamma"],
      currentExplainerId: "alpha",
      currentPlayerIndex: 0,
    })

    await reassignExplainer(db, roomId, "gamma", adminUid)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    const teamSnap = await get(ref(db, `rooms/${roomId}/teams/team-1`))
    const team = teamSnap.val()

    // Consistency: team.playerOrder[team.currentPlayerIndex] === gs.currentExplainerId
    expect(team.playerOrder[team.currentPlayerIndex]).toBe("gamma")
    expect(team.playerOrder[team.currentPlayerIndex]).toBe(gs.currentExplainerId)
  })
})
