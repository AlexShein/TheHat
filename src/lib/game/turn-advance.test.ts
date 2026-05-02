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
  it("increments current team's currentPlayerIndex, wraps at playerOrder.length, then switches to next team", async () => {
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
    // team-1's index advances to 2 (for next time team-1 gets turn)
    expect(teams["team-1"].currentPlayerIndex).toBe(2)
    // team-2's index unchanged (will be team-2's first player)
    expect(teams["team-2"].currentPlayerIndex).toBe(0)

    // Must switch to team-2
    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    expect(gs.currentTeamId).toBe("team-2")
    expect(gs.currentExplainerId).toBe("player-1") // team-2's first player
    expect(gs.phase).toBe("waiting_start")
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
    await set(ref(db, `rooms/${roomId}/gameState/phase`), "post_turn")

    await advanceTurn(db, roomId)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    expect(gs.currentTeamId).toBe("team-3") // team-2 → team-3
    expect(gs.currentExplainerId).toBe("player-5")

    // Now advance from team-3 last player → wrap to team-1
    // team-1's currentPlayerIndex is 1 (advanced during first turn), so next explainer is player-2
    await set(ref(db, `rooms/${roomId}/teams/team-3/currentPlayerIndex`), 1)
    await set(ref(db, `rooms/${roomId}/gameState/currentTeamId`), "team-3")
    await set(ref(db, `rooms/${roomId}/gameState/currentExplainerId`), "player-6")
    await set(ref(db, `rooms/${roomId}/gameState/phase`), "post_turn")

    await advanceTurn(db, roomId)

    const gsSnap2 = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs2 = gsSnap2.val()
    expect(gs2.currentTeamId).toBe("team-1") // team-3 → team-1 (wrap)
    expect(gs2.currentExplainerId).toBe("player-2") // team-1 uses its currentPlayerIndex (1)
  })

  // AC 3
  it("resolves next explainer from next team's currentPlayerIndex", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    // team-2 finished previous turn with index 1 (player-3)
    // Next time team-2 gets a turn, it should use index 1 again
    await seedAdvanceTurn(db, roomId, {
      teams: {
        "team-1": {
          name: "Team 1",
          playerOrder: ["player-0", "player-5"],
          currentPlayerIndex: 0,
          roundScores: { round1: 0, round2: 0, round3: 0 },
        },
        "team-2": {
          name: "Team 2",
          playerOrder: ["player-1", "player-3", "player-7"],
          currentPlayerIndex: 1, // team-2 was at player-3 last time
          roundScores: { round1: 0, round2: 0, round3: 0 },
        },
        "team-3": {
          name: "Team 3",
          playerOrder: ["player-9"],
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

    // team-1 finishes → next team is team-2, should use team-2's currentPlayerIndex (1)
    await advanceTurn(db, roomId)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    expect(gs.currentTeamId).toBe("team-2")
    expect(gs.currentExplainerId).toBe("player-3") // team-2 playerOrder[1]

    // team-1's index advanced to 1 (for next time)
    const teamsSnap = await get(ref(db, `rooms/${roomId}/teams`))
    const teams = teamsSnap.val()
    expect(teams["team-1"].currentPlayerIndex).toBe(1) // advanced from 0
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

  // AC: phase guard — only acts during post_turn
  it("when phase is not 'post_turn': does nothing and preserves state", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    await seedAdvanceTurn(db, roomId, {
      gameState: {
        round: 1,
        currentTeamId: "team-1",
        currentExplainerId: "player-0",
        phase: "explaining", // not post_turn
        hat: ["word-a", "word-b"],
        currentWordId: "word-a",
        wordsGuessedThisTurn: 2,
        lastAction: { type: "guessed", wordId: "word-x", scoredTeamId: "team-1", scoreWasPenalty: false },
        timerDuration: 60,
        playerStats: {},
      },
    })

    await advanceTurn(db, roomId)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    // Must not change — wrong phase
    expect(gs.phase).toBe("explaining")
    expect(gs.currentWordId).toBe("word-a")
    expect(gs.wordsGuessedThisTurn).toBe(2)
    expect(gs.currentTeamId).toBe("team-1")
  })

  it("when phase is 'waiting_start': does nothing and preserves state", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    await seedAdvanceTurn(db, roomId, {
      gameState: {
        round: 1,
        currentTeamId: "team-1",
        currentExplainerId: "player-0",
        phase: "waiting_start", // already waiting
        hat: ["word-a"],
        currentWordId: null,
        wordsGuessedThisTurn: 0,
        lastAction: null,
        timerDuration: 60,
        playerStats: {},
      },
    })

    await advanceTurn(db, roomId)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    // Must not double-advance
    expect(gs.phase).toBe("waiting_start")
    expect(gs.currentTeamId).toBe("team-1")
  })

  // BUGFIX: next turn always goes to OTHER team, never same team
  it("always switches to next team — never picks explainer from same team", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    // 2 teams, 2 players each. team-1 just finished turn with first player (index 0).
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
        hat: ["word-a", "word-b"],
        currentWordId: null,
        wordsGuessedThisTurn: 3,
        lastAction: null,
        timerDuration: 60,
        playerStats: {},
      },
    })

    await advanceTurn(db, roomId)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    // Must switch to team-2, never stay on team-1
    expect(gs.currentTeamId).toBe("team-2")
    expect(gs.currentExplainerId).toBe("player-1") // team-2's first player
    expect(gs.phase).toBe("waiting_start")

    // team-1's playerIndex advances to 1 (for next time team-1's turn comes)
    const teamsSnap = await get(ref(db, `rooms/${roomId}/teams`))
    const teams = teamsSnap.val()
    expect(teams["team-1"].currentPlayerIndex).toBe(1)
  })

  // BUGFIX: after last player of a team, rotate to next team too
  it("after last player of team: wraps that team's index and switches to next team", async () => {
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
        hat: ["word-a"],
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
    expect(gs.currentTeamId).toBe("team-2")
    expect(gs.currentExplainerId).toBe("player-1")
    expect(gs.phase).toBe("waiting_start")

    const teamsSnap = await get(ref(db, `rooms/${roomId}/teams`))
    const teams = teamsSnap.val()
    expect(teams["team-1"].currentPlayerIndex).toBe(0) // wrapped
  })
})
