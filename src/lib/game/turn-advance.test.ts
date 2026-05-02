import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { getDatabase, connectDatabaseEmulator, ref, set, get } from "firebase/database"
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app"
import { getAuth, connectAuthEmulator, signInAnonymously } from "firebase/auth"
import { advanceTurn } from "./turn-advance"

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

async function seedAdvanceTurn(
  db: ReturnType<typeof getDatabase>,
  roomId: string,
  opts: {
    teams?: Record<string, unknown>
    gameState?: Record<string, unknown>
  } = {},
) {
  // Default: 2 teams with 2 players each
  const defaultTeams = {
    "team-1": {
      name: "Team 1",
      playerOrder: ["player-0", "player-2"],
      currentPlayerIndex: 0,
      roundScores: { round1: 3, round2: 0, round3: 0 },
    },
    "team-2": {
      name: "Team 2",
      playerOrder: ["player-1", "player-3"],
      currentPlayerIndex: 0,
      roundScores: { round1: 2, round2: 0, round3: 0 },
    },
  }

  const defaultGameState = {
    round: 1,
    currentTeamId: "team-1",
    currentExplainerId: "player-0",
    timerStartedAt: null,
    timerDuration: 60,
    pausedAt: null,
    timeRemainingAtPause: null,
    phase: "post_turn",
    hat: ["word-a", "word-b", "word-c"],
    currentWordId: "word-x",
    currentWordText: "something",
    wordsGuessedThisTurn: 3,
    lastAction: { type: "guessed", wordId: "word-x", scoredTeamId: "team-1", scoreWasPenalty: false },
    playerStats: { "player-0": { wordsExplained: 1 }, "player-2": { wordsExplained: 0 } },
  }

  await set(ref(db, `rooms/${roomId}/teams`), opts.teams ?? defaultTeams)
  await set(ref(db, `rooms/${roomId}/gameState`), opts.gameState ?? defaultGameState)
}

describe("advanceTurn", () => {
  // AC 1
  it("increments currentPlayerIndex, wraps at playerOrder.length", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    await seedAdvanceTurn(db, roomId, {
      teams: {
        "team-1": {
          name: "Team 1",
          playerOrder: ["player-0", "player-2", "player-5"],
          currentPlayerIndex: 1, // currently player-2
          roundScores: { round1: 0, round2: 0, round3: 0 },
        },
        "team-2": {
          name: "Team 2",
          playerOrder: ["player-1", "player-3"],
          currentPlayerIndex: 0,
          roundScores: { round1: 0, round2: 0, round3: 0 },
        },
      },
      gameState: {
        round: 1,
        currentTeamId: "team-1",
        currentExplainerId: "player-2",
        phase: "post_turn",
        hat: ["word-1"],
        currentWordId: null,
        wordsGuessedThisTurn: 2,
        lastAction: null,
        timerDuration: 60,
        playerStats: {},
      },
    })

    await advanceTurn(db, roomId)

    const teamsSnap = await get(ref(db, `rooms/${roomId}/teams`))
    const teams = teamsSnap.val()
    expect(teams["team-1"].currentPlayerIndex).toBe(2) // index 2 → player-5
    expect(teams["team-2"].currentPlayerIndex).toBe(0) // team-2 unchanged
  })

  // AC 1 wrap
  it("wraps currentPlayerIndex to 0 after last player in team, then cycles team", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    await seedAdvanceTurn(db, roomId, {
      teams: {
        "team-1": {
          name: "Team 1",
          playerOrder: ["player-0", "player-2"],
          currentPlayerIndex: 1, // last player
          roundScores: { round1: 0, round2: 0, round3: 0 },
        },
        "team-2": {
          name: "Team 2",
          playerOrder: ["player-1", "player-3"],
          currentPlayerIndex: 0,
          roundScores: { round1: 0, round2: 0, round3: 0 },
        },
      },
      gameState: {
        round: 1,
        currentTeamId: "team-1",
        currentExplainerId: "player-2",
        phase: "post_turn",
        hat: ["word-1"],
        currentWordId: null,
        wordsGuessedThisTurn: 2,
        lastAction: null,
        timerDuration: 60,
        playerStats: {},
      },
    })

    await advanceTurn(db, roomId)

    const teamsSnap = await get(ref(db, `rooms/${roomId}/teams`))
    const teams = teamsSnap.val()
    // team-1 index wraps to 0
    expect(teams["team-1"].currentPlayerIndex).toBe(0)
    // currentTeamId now team-2
    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    expect(gs.currentTeamId).toBe("team-2")
    expect(gs.currentExplainerId).toBe("player-1") // team-2 playerOrder[0]
  })

  // AC 2
  it("cycles teams round-robin: team A → B → C → A", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    await seedAdvanceTurn(db, roomId, {
      teams: {
        "team-1": {
          name: "Team 1",
          playerOrder: ["player-0", "player-2"],
          currentPlayerIndex: 1, // last player of team-1
          roundScores: { round1: 0, round2: 0, round3: 0 },
        },
        "team-2": {
          name: "Team 2",
          playerOrder: ["player-1", "player-3"],
          currentPlayerIndex: 0,
          roundScores: { round1: 0, round2: 0, round3: 0 },
        },
        "team-3": {
          name: "Team 3",
          playerOrder: ["player-5", "player-6"],
          currentPlayerIndex: 0,
          roundScores: { round1: 0, round2: 0, round3: 0 },
        },
      },
      gameState: {
        round: 1,
        currentTeamId: "team-2",
        currentExplainerId: "player-1",
        phase: "post_turn",
        hat: ["word-1"],
        currentWordId: null,
        wordsGuessedThisTurn: 1,
        lastAction: null,
        timerDuration: 60,
        playerStats: {},
      },
    })

    await advanceTurn(db, roomId)

    // Current team was team-2, index 0 → goes to index 1 (player-3). Not wrapping, so stays team-2.
    // Let's redo: set team-2 index to 1 (last player) so it wraps to team-3.
    // Actually the test should demonstrate wrap. Fix:
    await set(ref(db, `rooms/${roomId}/teams/team-2/currentPlayerIndex`), 1)
    await set(ref(db, `rooms/${roomId}/gameState/currentTeamId`), "team-2")
    await set(ref(db, `rooms/${roomId}/gameState/currentExplainerId`), "player-3")

    await advanceTurn(db, roomId)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    expect(gs.currentTeamId).toBe("team-3") // team-2 → team-3
    expect(gs.currentExplainerId).toBe("player-5")

    // Now advance from team-3 last player → wrap to team-1
    await set(ref(db, `rooms/${roomId}/teams/team-3/currentPlayerIndex`), 1)
    await set(ref(db, `rooms/${roomId}/gameState/currentTeamId`), "team-3")
    await set(ref(db, `rooms/${roomId}/gameState/currentExplainerId`), "player-6")

    await advanceTurn(db, roomId)

    const gsSnap2 = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs2 = gsSnap2.val()
    expect(gs2.currentTeamId).toBe("team-1") // team-3 → team-1 (wrap)
    expect(gs2.currentExplainerId).toBe("player-0")
  })

  // AC 3
  it("correctly resolves currentExplainerId from new index", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    await seedAdvanceTurn(db, roomId, {
      teams: {
        "team-1": {
          name: "Team 1",
          playerOrder: ["player-0", "player-5", "player-7"],
          currentPlayerIndex: 1, // player-5
          roundScores: { round1: 0, round2: 0, round3: 0 },
        },
        "team-2": {
          name: "Team 2",
          playerOrder: ["player-1"],
          currentPlayerIndex: 0,
          roundScores: { round1: 0, round2: 0, round3: 0 },
        },
      },
      gameState: {
        round: 1,
        currentTeamId: "team-1",
        currentExplainerId: "player-5",
        phase: "post_turn",
        hat: ["word-1"],
        currentWordId: null,
        wordsGuessedThisTurn: 1,
        lastAction: null,
        timerDuration: 60,
        playerStats: {},
      },
    })

    await advanceTurn(db, roomId)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    // player-5 index 1 → next index 2 → player-7
    expect(gs.currentExplainerId).toBe("player-7")
    expect(gs.currentTeamId).toBe("team-1") // still same team, didn't wrap
  })

  // AC 4
  it("writes phase='waiting_start', currentWordId=null, lastAction=null, wordsGuessedThisTurn=0", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    await seedAdvanceTurn(db, roomId)

    await advanceTurn(db, roomId)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    expect(gs.phase).toBe("waiting_start")
    // RTDB removes explicit null values — fields may be absent (undefined)
    expect(gs.currentWordId).toBeFalsy()
    expect(gs.lastAction).toBeFalsy()
    expect(gs.wordsGuessedThisTurn).toBe(0)
  })

  // AC 5
  it("after hat empty: writes phase='round_end', preserves turn order", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    await seedAdvanceTurn(db, roomId, {
      gameState: {
        round: 1,
        currentTeamId: "team-1",
        currentExplainerId: "player-0",
        phase: "post_turn",
        hat: [], // empty hat
        currentWordId: null,
        wordsGuessedThisTurn: 2,
        lastAction: null,
        timerDuration: 60,
        playerStats: {},
      },
    })

    await advanceTurn(db, roomId)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    expect(gs.phase).toBe("round_end")
    // Turn order preserved — currentTeamId and currentPlayerIndex unchanged from original
    expect(gs.currentTeamId).toBe("team-1")
    expect(gs.currentExplainerId).toBe("player-0") // unchanged because we don't advance when hat empty
  })

  it("after hat empty: does NOT update currentPlayerIndex or currentTeamId", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    await seedAdvanceTurn(db, roomId, {
      teams: {
        "team-1": {
          name: "Team 1",
          playerOrder: ["player-0", "player-2"],
          currentPlayerIndex: 0,
          roundScores: { round1: 0, round2: 0, round3: 0 },
        },
        "team-2": {
          name: "Team 2",
          playerOrder: ["player-1"],
          currentPlayerIndex: 0,
          roundScores: { round1: 0, round2: 0, round3: 0 },
        },
      },
      gameState: {
        round: 1,
        currentTeamId: "team-1",
        currentExplainerId: "player-0",
        phase: "post_turn",
        hat: [],
        currentWordId: null,
        wordsGuessedThisTurn: 2,
        lastAction: null,
        timerDuration: 60,
        playerStats: {},
      },
    })

    await advanceTurn(db, roomId)

    const teamsSnap = await get(ref(db, `rooms/${roomId}/teams`))
    const teams = teamsSnap.val()
    // Indices unchanged
    expect(teams["team-1"].currentPlayerIndex).toBe(0)
    expect(teams["team-2"].currentPlayerIndex).toBe(0)
  })

  // Edge: single player team
  it("team with 1 player: currentPlayerIndex stays 0 (wraps to self)", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    await seedAdvanceTurn(db, roomId, {
      teams: {
        "team-1": {
          name: "Team 1",
          playerOrder: ["player-0"],
          currentPlayerIndex: 0,
          roundScores: { round1: 0, round2: 0, round3: 0 },
        },
        "team-2": {
          name: "Team 2",
          playerOrder: ["player-1", "player-3"],
          currentPlayerIndex: 0,
          roundScores: { round1: 0, round2: 0, round3: 0 },
        },
      },
      gameState: {
        round: 1,
        currentTeamId: "team-1",
        currentExplainerId: "player-0",
        phase: "post_turn",
        hat: ["word-1"],
        currentWordId: null,
        wordsGuessedThisTurn: 1,
        lastAction: null,
        timerDuration: 60,
        playerStats: {},
      },
    })

    await advanceTurn(db, roomId)

    const teamsSnap = await get(ref(db, `rooms/${roomId}/teams`))
    const teams = teamsSnap.val()
    // team-1 index wraps 0→0 (mod 1 = 0), then wraps to team-2
    expect(teams["team-1"].currentPlayerIndex).toBe(0)
    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    expect(gs.currentTeamId).toBe("team-2")
    expect(gs.currentExplainerId).toBe("player-1")
  })

  // Edge: gameState doesn't exist
  it("when gameState does not exist: does nothing", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    await set(ref(db, `rooms/${roomId}/teams`), {
      "team-1": {
        name: "T1",
        playerOrder: ["p1"],
        currentPlayerIndex: 0,
        roundScores: { round1: 0, round2: 0, round3: 0 },
      },
    })
    // No gameState node

    await expect(advanceTurn(db, roomId)).resolves.toBeUndefined()
  })

  // Edge: teams don't exist
  it("when teams do not exist: does nothing", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    await set(ref(db, `rooms/${roomId}/gameState`), {
      round: 1,
      currentTeamId: "team-1",
      phase: "post_turn",
      hat: ["w1"],
      currentWordId: null,
      timerDuration: 60,
      playerStats: {},
    })
    // No teams node

    await expect(advanceTurn(db, roomId)).resolves.toBeUndefined()
  })
})
