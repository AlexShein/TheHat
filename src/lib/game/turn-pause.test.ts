import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { getDatabase, connectDatabaseEmulator, ref, set, get } from "firebase/database"
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app"
import { getAuth, connectAuthEmulator, signInAnonymously, signOut } from "firebase/auth"
import { pauseGame, resumeGame, PauseNotAvailableError, ResumeNotAvailableError } from "./turn-pause"
import { getTimeRemaining } from "./timer"

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

async function seedPlayingRoom(
  db: ReturnType<typeof getDatabase>,
  roomId: string,
  overrides: Partial<{
    timerStartedAt: number | null
    pausedAt: number | null
    timeRemainingAtPause: number | null
    phase: string
  }> = {},
) {
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

  await set(ref(db, `rooms/${roomId}/admins/${adminUid}`), true)

  const timerStartedAt = overrides.timerStartedAt !== undefined ? overrides.timerStartedAt : Date.now()
  const phase = overrides.phase ?? "explaining"

  await set(ref(db, `rooms/${roomId}/gameState`), {
    round: 1,
    currentTeamId: "team-1",
    currentExplainerId: "player-0",
    timerStartedAt,
    timerDuration: 60000,
    pausedAt: overrides.pausedAt ?? null,
    timeRemainingAtPause: overrides.timeRemainingAtPause ?? null,
    phase,
    hat: ["w1", "w2", "w3"],
    currentWordId: "w1",
    currentWordText: "test-word",
    wordsGuessedThisTurn: 0,
    lastAction: null,
    playerStats: {},
  })
}

describe("pauseGame", () => {
  it("writes pausedAt as server timestamp when timer is running", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedPlayingRoom(db, roomId)

    await pauseGame(db, roomId, adminUid)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    // pausedAt should be a number (resolved server timestamp)
    expect(typeof gs.pausedAt).toBe("number")
    expect(gs.pausedAt).toBeGreaterThan(0)
  })

  it("writes timeRemainingAtPause within 200ms of expected remaining", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    const startedAt = Date.now()
    await seedPlayingRoom(db, roomId, { timerStartedAt: startedAt })

    const pausePromise = pauseGame(db, roomId, adminUid)
    const callTime = Date.now()

    await pausePromise

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    // timeRemainingAtPause should be approximately 60000 - (callTime - startedAt)
    const expectedRemaining = Math.max(0, 60000 - (callTime - startedAt))
    const delta = Math.abs(gs.timeRemainingAtPause - expectedRemaining)
    expect(delta).toBeLessThanOrEqual(200)
  })

  it("throws PauseNotAvailableError when timerStartedAt is null", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedPlayingRoom(db, roomId, { timerStartedAt: null, phase: "explaining" })

    await expect(pauseGame(db, roomId, adminUid)).rejects.toThrow(PauseNotAvailableError)
  })

  it("throws PauseNotAvailableError when already paused", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedPlayingRoom(db, roomId, { pausedAt: Date.now(), timeRemainingAtPause: 40000 })

    await expect(pauseGame(db, roomId, adminUid)).rejects.toThrow(PauseNotAvailableError)
  })

  it("throws PauseNotAvailableError when phase is 'waiting_start'", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedPlayingRoom(db, roomId, { phase: "waiting_start" })

    await expect(pauseGame(db, roomId, adminUid)).rejects.toThrow(PauseNotAvailableError)
  })

  it("throws PauseNotAvailableError when phase is 'post_turn'", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedPlayingRoom(db, roomId, { phase: "post_turn" })

    await expect(pauseGame(db, roomId, adminUid)).rejects.toThrow(PauseNotAvailableError)
  })

  it("throws PauseNotAvailableError when phase is 'round_end'", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedPlayingRoom(db, roomId, { phase: "round_end" })

    await expect(pauseGame(db, roomId, adminUid)).rejects.toThrow(PauseNotAvailableError)
  })

  it("throws permission-denied when caller is not admin and not room creator", async () => {
    const nonAdminApp = initializeApp(
      {
        projectId: "the-hat-dev",
        apiKey: "fake-api-key-nonadmin",
        databaseURL: "http://127.0.0.1:9000?ns=the-hat-dev",
      },
      `non-admin-pause-${Date.now()}`,
    )
    const nonAdminDb = getDatabase(nonAdminApp)
    connectDatabaseEmulator(nonAdminDb, "127.0.0.1", 9000)
    const nonAdminAuth = getAuth(nonAdminApp)
    connectAuthEmulator(nonAdminAuth, "http://127.0.0.1:9099", { disableWarnings: true })

    const cred = await signInAnonymously(nonAdminAuth)
    const nonAdminUid = cred.user.uid

    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedPlayingRoom(db, roomId)

    await expect(pauseGame(nonAdminDb, roomId, nonAdminUid)).rejects.toThrow(/permission/i)

    await signOut(nonAdminAuth)
    await deleteApp(nonAdminApp)
  })
})

describe("resumeGame", () => {
  it("clears pausedAt and timeRemainingAtPause", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedPlayingRoom(db, roomId, {
      pausedAt: Date.now(),
      timeRemainingAtPause: 40000,
      phase: "explaining",
    })

    await resumeGame(db, roomId, adminUid)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    // RTDB removes keys set to null; they become undefined in snapshot
    expect(gs.pausedAt).toBeUndefined()
    expect(gs.timeRemainingAtPause).toBeUndefined()
  })

  it("sets synthetic timerStartedAt such that getTimeRemaining() ≈ timeRemainingAtPause", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    const frozenRemaining = 40000
    await seedPlayingRoom(db, roomId, {
      pausedAt: Date.now(),
      timeRemainingAtPause: frozenRemaining,
      phase: "explaining",
    })

    await resumeGame(db, roomId, adminUid)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()

    const computed = getTimeRemaining(
      gs.timerStartedAt,
      60000,
      gs.pausedAt ?? null,
      gs.timeRemainingAtPause ?? null,
    )

    const delta = Math.abs(computed - frozenRemaining)
    expect(delta).toBeLessThanOrEqual(200)
  })

  it("sets timerStartedAt to a number greater than 0", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedPlayingRoom(db, roomId, {
      pausedAt: Date.now(),
      timeRemainingAtPause: 40000,
      phase: "explaining",
    })

    await resumeGame(db, roomId, adminUid)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    expect(typeof gs.timerStartedAt).toBe("number")
    expect(gs.timerStartedAt).toBeGreaterThan(0)
  })

  it("throws ResumeNotAvailableError when not paused", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedPlayingRoom(db, roomId, { pausedAt: null })

    await expect(resumeGame(db, roomId, adminUid)).rejects.toThrow(ResumeNotAvailableError)
  })

  it("throws permission-denied when caller is not admin and not room creator", async () => {
    const nonAdminApp = initializeApp(
      {
        projectId: "the-hat-dev",
        apiKey: "fake-api-key-nonadmin",
        databaseURL: "http://127.0.0.1:9000?ns=the-hat-dev",
      },
      `non-admin-resume-${Date.now()}`,
    )
    const nonAdminDb = getDatabase(nonAdminApp)
    connectDatabaseEmulator(nonAdminDb, "127.0.0.1", 9000)
    const nonAdminAuth = getAuth(nonAdminApp)
    connectAuthEmulator(nonAdminAuth, "http://127.0.0.1:9099", { disableWarnings: true })

    const cred = await signInAnonymously(nonAdminAuth)
    const nonAdminUid = cred.user.uid

    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedPlayingRoom(db, roomId, {
      pausedAt: Date.now(),
      timeRemainingAtPause: 40000,
      phase: "explaining",
    })

    await expect(resumeGame(nonAdminDb, roomId, nonAdminUid)).rejects.toThrow(/permission/i)

    await signOut(nonAdminAuth)
    await deleteApp(nonAdminApp)
  })

  it("pause → resume roundtrip: getTimeRemaining unchanged within 200ms", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    const startedAt = Date.now()
    await seedPlayingRoom(db, roomId, { timerStartedAt: startedAt, phase: "explaining" })

    // Wait a bit so some time passes, then pause
    await new Promise((r) => setTimeout(r, 500))
    await pauseGame(db, roomId, adminUid)

    // Read frozen remaining
    const pausedSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const pausedGs = pausedSnap.val()
    const frozenRemaining = pausedGs.timeRemainingAtPause as number

    // Wait more, then resume
    await new Promise((r) => setTimeout(r, 300))
    await resumeGame(db, roomId, adminUid)

    // Read restored state
    const resumeSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const resumeGs = resumeSnap.val()

    const restoredRemaining = getTimeRemaining(resumeGs.timerStartedAt as number, 60000, null, null)

    const delta = Math.abs(restoredRemaining - frozenRemaining)
    expect(delta).toBeLessThanOrEqual(200)
  })
})
