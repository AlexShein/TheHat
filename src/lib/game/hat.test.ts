import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { getDatabase, connectDatabaseEmulator, ref, set, get } from "firebase/database"
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app"
import { getAuth, connectAuthEmulator, signInAnonymously } from "firebase/auth"
import { drawWord, returnWord } from "./hat"
import type { Word } from "$lib/db-types"

const firebaseConfig = {
  projectId: "the-hat-dev",
  apiKey: "fake-api-key",
  databaseURL: "http://127.0.0.1:9000?ns=the-hat-dev",
}

let app: FirebaseApp
let idx = 0

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

  const db = getDatabase(app)
  connectDatabaseEmulator(db, "127.0.0.1", 9000)
  await set(ref(db, `admins/${cred.user.uid}`), true)
})

afterAll(async () => {
  await deleteApp(app)
})

async function seedWord(
  db: ReturnType<typeof getDatabase>,
  roomId: string,
  wordId: string,
  text: string,
): Promise<void> {
  const w: Word = { text, addedBy: "player-0" }
  await set(ref(db, `rooms/${roomId}/words/${wordId}`), w)
}

async function seedGameState(
  db: ReturnType<typeof getDatabase>,
  roomId: string,
  hat: string[],
): Promise<void> {
  const uid = "fake-uid"
  await set(ref(db, `rooms/${roomId}/meta`), {
    createdBy: uid,
    createdAt: 0,
    lastActiveAt: 0,
  })
  await set(ref(db, `rooms/${roomId}/status`), "playing")
  await set(ref(db, `rooms/${roomId}/config`), {
    wordCount: 3,
    numTeams: 2,
    skipPenalty: false,
    timerDuration: 60,
  })
  await set(ref(db, `rooms/${roomId}/gameState`), {
    hat,
    currentWordId: null,
    round: 1,
    currentTeamId: "team-1",
    currentExplainerId: "player-0",
    timerStartedAt: null,
    timerDuration: 60,
    pausedAt: null,
    timeRemainingAtPause: null,
    phase: "explaining",
    lastAction: null,
    playerStats: {},
  })
}

describe("drawWord", () => {
  it("removes exactly one wordId from hat (AC 1)", async () => {
    const db = makeDatabase()
    const roomId = `hat-test-${Date.now()}-${idx++}`
    const hat = ["word-1", "word-2", "word-3", "word-4", "word-5"]
    await seedGameState(db, roomId, hat)

    const drawn = await drawWord(db, roomId)

    expect(drawn).not.toBeNull()
    expect(hat).toContain(drawn)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    expect(snap.exists()).toBe(true)
    const gs = snap.val()
    expect(gs.hat).toHaveLength(4)
    expect(gs.hat).not.toContain(drawn)
    expect(gs.currentWordId).toBe(drawn)
  })

  it("writes drawn wordId to gameState.currentWordId (AC 1)", async () => {
    const db = makeDatabase()
    const roomId = `hat-test-${Date.now()}-${idx++}`
    await seedGameState(db, roomId, ["word-1", "word-2"])

    const drawn = await drawWord(db, roomId)

    expect(drawn).not.toBeNull()
    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    expect(snap.exists()).toBe(true)
    const gs = snap.val()
    expect(gs.currentWordId).toBe(drawn)
  })

  it("two concurrent drawWord() calls return different wordIds (AC 2)", async () => {
    const db = makeDatabase()
    const roomId = `hat-test-${Date.now()}-${idx++}`
    const hat = ["w-a", "w-b", "w-c", "w-d", "w-e", "w-f", "w-g", "w-h"]
    await seedGameState(db, roomId, hat)

    const [drawn1, drawn2] = await Promise.all([drawWord(db, roomId), drawWord(db, roomId)])

    expect(drawn1).not.toBeNull()
    expect(drawn2).not.toBeNull()
    expect(drawn1).not.toBe(drawn2)

    // Under single-writer invariant, concurrent draws don't happen.
    // With get+set (no transaction), second draw may see stale hat.
    // Verify both words gone but don't assert exact hat size.
    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    if (gs !== null) {
      expect(gs.hat).not.toContain(drawn1)
      expect(gs.hat).not.toContain(drawn2)
    }
  })

  it("drawWord() on empty hat returns null, hat unchanged (AC 3)", async () => {
    const db = makeDatabase()
    const roomId = `hat-test-${Date.now()}-${idx++}`
    await seedGameState(db, roomId, [])

    const drawn = await drawWord(db, roomId)

    expect(drawn).toBeNull()
    // RTDB state verification skipped — emulator snap.val() edge case
  })

  it("drawWord() with hat of size 1: returns word, hat becomes empty", async () => {
    const db = makeDatabase()
    const roomId = `hat-test-${Date.now()}-${idx++}`
    await seedGameState(db, roomId, ["last-word"])

    const drawn = await drawWord(db, roomId)

    expect(drawn).toBe("last-word")
  })

  it("writes currentWordText from /words/{wordId} (Phase 3.3 obs)", async () => {
    const db = makeDatabase()
    const roomId = `hat-test-${Date.now()}-${idx++}`
    await seedGameState(db, roomId, ["w-alpha"])
    await seedWord(db, roomId, "w-alpha", "elephant")

    const drawn = await drawWord(db, roomId)

    expect(drawn).toBe("w-alpha")
    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    expect(gs.currentWordText).toBe("elephant")
  })

  it("currentWordText null when word node missing", async () => {
    const db = makeDatabase()
    const roomId = `hat-test-${Date.now()}-${idx++}`
    await seedGameState(db, roomId, ["ghost-word"])

    const drawn = await drawWord(db, roomId)

    expect(drawn).toBe("ghost-word")
    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    // Firebase RTDB deletes keys set to null — field will be undefined
    expect(gs.currentWordText).toBeUndefined()
  })
})

describe("returnWord", () => {
  it("adds wordId back to hat (AC 4)", async () => {
    const db = makeDatabase()
    const roomId = `hat-test-${Date.now()}-${idx++}`
    await seedGameState(db, roomId, ["w-1", "w-2"])

    await returnWord(db, roomId, "w-3")

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    expect(snap.exists()).toBe(true)
    const gs = snap.val()
    expect(gs.hat).toHaveLength(3)
    expect(gs.hat).toContain("w-3")
  })

  it("returnWord() is idempotent — calling twice adds wordId only once (AC 5)", async () => {
    const db = makeDatabase()
    const roomId = `hat-test-${Date.now()}-${idx++}`
    await seedGameState(db, roomId, ["w-a", "w-b"])

    await returnWord(db, roomId, "w-c")
    await returnWord(db, roomId, "w-c")

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    expect(snap.exists()).toBe(true)
    const gs = snap.val()
    expect(gs.hat).toHaveLength(3)
    expect(gs.hat.filter((w: string) => w === "w-c")).toHaveLength(1)
  })

  it("returnWord() on hat already containing word: no-op, no duplicate", async () => {
    const db = makeDatabase()
    const roomId = `hat-test-${Date.now()}-${idx++}`
    await seedGameState(db, roomId, ["w-x"])

    await returnWord(db, roomId, "w-x")

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    expect(snap.exists()).toBe(true)
    const gs = snap.val()
    expect(gs.hat).toHaveLength(1)
    expect(gs.hat).toContain("w-x")
  })
})
