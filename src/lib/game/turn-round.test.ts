import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { getDatabase, connectDatabaseEmulator, ref, set, get } from "firebase/database"
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app"
import { getAuth, connectAuthEmulator, signInAnonymously } from "firebase/auth"
import { endRound } from "./turn-round"

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

async function seedEndRound(
  db: ReturnType<typeof getDatabase>,
  roomId: string,
  overrides: { gameState?: Record<string, unknown>; words?: Record<string, unknown> } = {},
) {
  const defaultWords: Record<string, unknown> = {
    "word-a": { text: "apple", addedBy: "player-0" },
    "word-b": { text: "banana", addedBy: "player-1" },
    "word-c": { text: "cherry", addedBy: "player-2" },
    "word-d": { text: "date", addedBy: "player-3" },
  }

  const defaultGameState = {
    round: 1,
    currentTeamId: "team-2",
    currentExplainerId: "player-1",
    timerStartedAt: null,
    timerDuration: 60,
    pausedAt: null,
    timeRemainingAtPause: null,
    phase: "round_end",
    hat: [],
    currentWordId: null,
    currentWordText: null,
    wordsGuessedThisTurn: 3,
    lastAction: { type: "guessed", wordId: "word-d", scoredTeamId: "team-1", scoreWasPenalty: false },
    playerStats: { "player-0": { wordsExplained: 2 }, "player-1": { wordsExplained: 1 } },
  }

  const teams = {
    "team-1": {
      name: "Team 1",
      playerOrder: ["player-0", "player-2"],
      currentPlayerIndex: 1,
      roundScores: { round1: 3, round2: 0, round3: 0 },
    },
    "team-2": {
      name: "Team 2",
      playerOrder: ["player-1", "player-3"],
      currentPlayerIndex: 0,
      roundScores: { round1: 2, round2: 0, round3: 0 },
    },
  }

  await set(ref(db, `rooms/${roomId}/teams`), teams)
  await set(ref(db, `rooms/${roomId}/words`), overrides.words ?? defaultWords)
  await set(ref(db, `rooms/${roomId}/gameState`), overrides.gameState ?? defaultGameState)
  await set(ref(db, `rooms/${roomId}/status`), "playing")
}

describe("endRound", () => {
  it("when round < 3: refills hat from all wordIds, increments round, writes waiting_start", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    await seedEndRound(db, roomId)

    await endRound(db, roomId)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    expect(gs.phase).toBe("waiting_start")
    expect(gs.round).toBe(2)
    // Hat refilled with all 4 words (shuffled)
    expect(gs.hat).toHaveLength(4)
    expect(gs.hat).toContain("word-a")
    expect(gs.hat).toContain("word-b")
    expect(gs.hat).toContain("word-c")
    expect(gs.hat).toContain("word-d")
    // Turn order preserved
    expect(gs.currentTeamId).toBe("team-2")
    expect(gs.currentExplainerId).toBe("player-1")
    // Clean slate fields
    expect(gs.currentWordId).toBeFalsy()
    expect(gs.lastAction).toBeFalsy()
    expect(gs.wordsGuessedThisTurn).toBe(0)
    // Status unchanged (still playing)
    const statusSnap = await get(ref(db, `rooms/${roomId}/status`))
    expect(statusSnap.val()).toBe("playing")
  })

  it("when round === 3: writes status='finished', game frozen", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    await seedEndRound(db, roomId, {
      gameState: {
        round: 3,
        currentTeamId: "team-1",
        currentExplainerId: "player-0",
        timerStartedAt: null,
        timerDuration: 60,
        pausedAt: null,
        timeRemainingAtPause: null,
        phase: "round_end",
        hat: [],
        currentWordId: null,
        currentWordText: null,
        wordsGuessedThisTurn: 5,
        lastAction: null,
        playerStats: {},
      },
    })

    await endRound(db, roomId)

    const statusSnap = await get(ref(db, `rooms/${roomId}/status`))
    expect(statusSnap.val()).toBe("finished")

    // gameState unchanged (no hat refill, no round increment beyond 3)
    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    expect(gs.round).toBe(3)
    expect(gs.phase).toBe("round_end")
    // RTDB doesn't preserve empty arrays — hat may be absent (undefined)
    expect(gs.hat).toBeFalsy()
  })

  it("when phase !== 'round_end': does nothing", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    await seedEndRound(db, roomId, {
      gameState: {
        round: 1,
        currentTeamId: "team-1",
        currentExplainerId: "player-0",
        timerStartedAt: null,
        timerDuration: 60,
        pausedAt: null,
        timeRemainingAtPause: null,
        phase: "explaining", // wrong phase
        hat: ["word-a"],
        currentWordId: "word-a",
        currentWordText: "apple",
        wordsGuessedThisTurn: 2,
        lastAction: null,
        playerStats: {},
      },
    })

    await endRound(db, roomId)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    expect(gs.phase).toBe("explaining") // unchanged
    expect(gs.round).toBe(1) // unchanged
    expect(gs.hat).toEqual(["word-a"]) // unchanged
  })

  it("when gameState does not exist: does nothing", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    // Only words node, no gameState
    await set(ref(db, `rooms/${roomId}/words`), {
      "word-a": { text: "apple", addedBy: "p1" },
    })

    await expect(endRound(db, roomId)).resolves.toBeUndefined()

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    expect(gsSnap.exists()).toBe(false)
  })

  it("preserves playerStats and scores across rounds", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    await seedEndRound(db, roomId, {
      gameState: {
        round: 1,
        currentTeamId: "team-1",
        currentExplainerId: "player-0",
        timerStartedAt: null,
        timerDuration: 60,
        pausedAt: null,
        timeRemainingAtPause: null,
        phase: "round_end",
        hat: [],
        currentWordId: null,
        currentWordText: null,
        wordsGuessedThisTurn: 3,
        lastAction: null,
        playerStats: { "player-0": { wordsExplained: 5 }, "player-1": { wordsExplained: 3 } },
      },
    })

    await endRound(db, roomId)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    expect(gs.playerStats).toEqual({
      "player-0": { wordsExplained: 5 },
      "player-1": { wordsExplained: 3 },
    })
  })
})
