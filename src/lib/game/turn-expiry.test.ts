import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { getDatabase, connectDatabaseEmulator, ref, set, get } from "firebase/database"
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app"
import { getAuth, connectAuthEmulator, signInAnonymously } from "firebase/auth"
import { handleTimerExpiry, endTurnEarly } from "./turn-expiry"

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

async function seedGameState(
  db: ReturnType<typeof getDatabase>,
  roomId: string,
  overrides: Record<string, unknown> = {},
) {
  const base = {
    round: 1,
    currentTeamId: "team-1",
    currentExplainerId: "player-0",
    timerStartedAt: null,
    timerDuration: 60,
    pausedAt: null,
    timeRemainingAtPause: null,
    phase: "explaining",
    hat: ["word-1", "word-2"],
    currentWordId: "word-1",
    currentWordText: "test-word",
    wordsGuessedThisTurn: 1,
    lastAction: null,
    playerStats: { "player-0": { wordsExplained: 1 } },
  }
  await set(ref(db, `rooms/${roomId}/gameState`), { ...base, ...overrides })
}

// ── handleTimerExpiry ────────────────────────────────────────

describe("handleTimerExpiry", () => {
  it("when timeRemaining<=0, wordDisplayed >2s: writes phase='post_expiry'", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    const sixtyOneSecAgo = Date.now() - 61000
    await seedGameState(db, roomId, {
      timerStartedAt: sixtyOneSecAgo,
      timerDuration: 60000,
      currentWordId: "word-1",
    })

    // word displayed 3s ago
    const wordDisplayedAt = Date.now() - 3000

    await handleTimerExpiry(db, roomId, sixtyOneSecAgo, 60000, null, null, "word-1", wordDisplayedAt)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    expect(gs.phase).toBe("post_expiry")
  })

  it("when timeRemaining<=0, wordDisplayed <=2s: writes phase='post_turn', currentWordId=null", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    const sixtyOneSecAgo = Date.now() - 61000
    await seedGameState(db, roomId, {
      timerStartedAt: sixtyOneSecAgo,
      timerDuration: 60000,
      currentWordId: "word-1",
    })

    // word displayed only 1s ago
    const wordDisplayedAt = Date.now() - 1000

    await handleTimerExpiry(db, roomId, sixtyOneSecAgo, 60000, null, null, "word-1", wordDisplayedAt)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    expect(gs.phase).toBe("post_turn")
    // RTDB removes explicit null values — field may be absent (undefined)
    expect(gs.currentWordId).toBeFalsy()
  })

  it("when timeRemaining<=0, wordDisplayed <=2000ms boundary: writes phase='post_turn'", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    const sixtyOneSecAgo = Date.now() - 61000
    await seedGameState(db, roomId, {
      timerStartedAt: sixtyOneSecAgo,
      timerDuration: 60000,
      currentWordId: "word-1",
    })

    // word displayed 1.5s ago — clearly <= 2000ms, avoids Date.now() drift flakiness
    const wordDisplayedAt = Date.now() - 1500

    await handleTimerExpiry(db, roomId, sixtyOneSecAgo, 60000, null, null, "word-1", wordDisplayedAt)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    expect(gs.phase).toBe("post_turn")
  })

  it("when timeRemaining<=0, currentWordId is null: writes phase='post_turn'", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    const sixtyOneSecAgo = Date.now() - 61000
    await seedGameState(db, roomId, {
      timerStartedAt: sixtyOneSecAgo,
      timerDuration: 60000,
      currentWordId: null,
    })

    await handleTimerExpiry(
      db,
      roomId,
      sixtyOneSecAgo,
      60000,
      null,
      null,
      null,
      null, // currentWordId=null, wordDisplayedAt=null
    )

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    expect(gs.phase).toBe("post_turn")
    // RTDB removes explicit null values
    expect(gs.currentWordId).toBeFalsy()
  })

  it("when phase !== 'explaining': does nothing", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    const sixtyOneSecAgo = Date.now() - 61000
    await seedGameState(db, roomId, {
      timerStartedAt: sixtyOneSecAgo,
      timerDuration: 60000,
      phase: "waiting_start", // not explaining
    })

    const wordDisplayedAt = Date.now() - 3000

    await handleTimerExpiry(db, roomId, sixtyOneSecAgo, 60000, null, null, "word-1", wordDisplayedAt)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    expect(gs.phase).toBe("waiting_start") // unchanged
  })

  it("when timerStartedAt is null: does nothing", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    await seedGameState(db, roomId, {
      timerStartedAt: null, // timer not started
      phase: "explaining",
    })

    await handleTimerExpiry(db, roomId, null, 60000, null, null, "word-1", Date.now() - 3000)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    expect(gs.phase).toBe("explaining") // unchanged
  })

  it("when pausedAt is not null: does nothing", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    const sixtyOneSecAgo = Date.now() - 61000
    await seedGameState(db, roomId, {
      timerStartedAt: sixtyOneSecAgo,
      timerDuration: 60000,
      pausedAt: Date.now() - 10000, // paused
      timeRemainingAtPause: 30000,
      phase: "explaining",
    })

    await handleTimerExpiry(
      db,
      roomId,
      sixtyOneSecAgo,
      60000,
      Date.now() - 10000,
      30000,
      "word-1",
      Date.now() - 3000,
    )

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    expect(gs.phase).toBe("explaining") // unchanged — timer paused
  })

  it("when timeRemaining > 0: does nothing", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    // timerStartedAt 10s ago, 60s duration → ~50s remaining
    const tenSecAgo = Date.now() - 10000
    await seedGameState(db, roomId, {
      timerStartedAt: tenSecAgo,
      timerDuration: 60000,
      phase: "explaining",
    })

    await handleTimerExpiry(db, roomId, tenSecAgo, 60000, null, null, "word-1", Date.now() - 1000)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    expect(gs.phase).toBe("explaining") // unchanged
  })
})

// ── endTurnEarly ─────────────────────────────────────────────

describe("endTurnEarly", () => {
  it("writes phase='post_turn', currentWordId=null", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    await seedGameState(db, roomId, {
      phase: "explaining",
      currentWordId: "word-1",
    })

    await endTurnEarly(db, roomId)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    expect(gs.phase).toBe("post_turn")
    // RTDB removes explicit null values
    expect(gs.currentWordId).toBeFalsy()
  })

  it("preserves other gameState fields", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    await seedGameState(db, roomId, {
      phase: "explaining",
      currentWordId: "word-1",
      hat: ["word-2", "word-3"],
      round: 1,
      currentTeamId: "team-1",
      wordsGuessedThisTurn: 2,
    })

    await endTurnEarly(db, roomId)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    expect(gs.phase).toBe("post_turn")
    // RTDB removes explicit null values
    expect(gs.currentWordId).toBeFalsy()
    expect(gs.hat).toEqual(["word-2", "word-3"])
    expect(gs.round).toBe(1)
    expect(gs.currentTeamId).toBe("team-1")
    expect(gs.wordsGuessedThisTurn).toBe(2)
  })

  it("when gameState does not exist: does nothing (no-op)", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`

    // Don't seed gameState — node doesn't exist
    await set(ref(db, `rooms/${roomId}/config`), {
      wordCount: 3,
      numTeams: 2,
      skipPenalty: false,
      timerDuration: 60,
    })

    // Should not throw
    await expect(endTurnEarly(db, roomId)).resolves.toBeUndefined()

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    expect(snap.exists()).toBe(false)
  })
})
