import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { getDatabase, connectDatabaseEmulator, ref, set, get } from "firebase/database"
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app"
import { getAuth, connectAuthEmulator, signInAnonymously, signOut } from "firebase/auth"
import { initializeGameState, InvalidPhaseTransitionError, MinPlayersError } from "./turn"

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

  // Sign in to main app and register as admin
  const auth = getAuth(app)
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true })
  const cred = await signInAnonymously(auth)
  adminUid = cred.user.uid

  // Seed /admins/{uid} so application-level admin check passes
  const db = getDatabase(app)
  connectDatabaseEmulator(db, "127.0.0.1", 9000)
  await set(ref(db, `admins/${adminUid}`), true)
})

afterAll(async () => {
  await deleteApp(app)
})

async function seedRoom(
  db: ReturnType<typeof getDatabase>,
  roomId: string,
  options: {
    playerCount?: number
    wordCount?: number
    numTeams?: number
    status?: string
  } = {},
) {
  const pc = options.playerCount ?? 4
  const wc = options.wordCount ?? 3
  const nt = options.numTeams ?? 2
  const status = options.status ?? "pre-start"

  await set(ref(db, `rooms/${roomId}/config`), {
    wordCount: wc,
    numTeams: nt,
    skipPenalty: false,
    timerDuration: 60,
  })

  await set(ref(db, `rooms/${roomId}/meta`), {
    createdBy: adminUid,
    createdAt: 0,
    lastActiveAt: 0,
  })

  await set(ref(db, `rooms/${roomId}/status`), status)

  for (let i = 0; i < pc; i++) {
    const pid = `player-${i}`
    const teamNum = (i % nt) + 1
    await set(ref(db, `rooms/${roomId}/players/${pid}`), {
      name: `Player ${i}`,
      color: `#${i.toString(16).padStart(6, "0")}`,
      teamId: `team-${teamNum}`,
      wordsSubmitted: true,
      ready: true,
      connected: true,
      isAdmin: i === 0,
    })

    for (let w = 0; w < wc; w++) {
      await set(ref(db, `rooms/${roomId}/words/${pid}-word-${w}`), {
        text: `word-${i}-${w}`,
        addedBy: pid,
      })
    }
  }
}

function allWordIds(playerCount: number, wordCount: number): string[] {
  const ids: string[] = []
  for (let i = 0; i < playerCount; i++) {
    for (let w = 0; w < wordCount; w++) {
      ids.push(`player-${i}-word-${w}`)
    }
  }
  return ids
}

describe("initializeGameState", () => {
  // ── Hat construction ──────────────────────────────────────

  it("builds hat with length = totalPlayers × config.wordCount", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedRoom(db, roomId, { playerCount: 4, wordCount: 3 })

    await initializeGameState(db, roomId, adminUid, true)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    expect(gs.hat).toHaveLength(12) // 4 players × 3 words
  })

  it("hat contains every wordId from /words/ exactly once per player who submitted", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedRoom(db, roomId, { playerCount: 3, wordCount: 2 })

    await initializeGameState(db, roomId, adminUid, true)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    const expected = allWordIds(3, 2)
    expect(gs.hat.sort()).toEqual(expected.sort())
  })

  it("duplicate word texts produce distinct wordIds in hat", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedRoom(db, roomId, { playerCount: 2, wordCount: 2 })

    // Add duplicate-text words with distinct keys
    await set(ref(db, `rooms/${roomId}/words/dup-1`), {
      text: "same-text",
      addedBy: "player-0",
    })
    await set(ref(db, `rooms/${roomId}/words/dup-2`), {
      text: "same-text",
      addedBy: "player-1",
    })

    await initializeGameState(db, roomId, adminUid, true)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    // dup-1 and dup-2 should both be in hat (plus the 4 seed words)
    expect(gs.hat).toContain("dup-1")
    expect(gs.hat).toContain("dup-2")
  })

  // ── Team initialization ───────────────────────────────────

  it("creates team nodes for all config.numTeams", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedRoom(db, roomId, { numTeams: 2 })

    await initializeGameState(db, roomId, adminUid, true)

    const teamsSnap = await get(ref(db, `rooms/${roomId}/teams`))
    const teams = teamsSnap.val()
    expect(Object.keys(teams)).toHaveLength(2)
    expect(teams["team-1"]).toBeDefined()
    expect(teams["team-2"]).toBeDefined()
  })

  it("each team has name, currentPlayerIndex: 0, roundScores all 0", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedRoom(db, roomId, { numTeams: 2 })

    await initializeGameState(db, roomId, adminUid, true)

    const teamsSnap = await get(ref(db, `rooms/${roomId}/teams`))
    const teams = teamsSnap.val()
    for (const teamId of ["team-1", "team-2"]) {
      expect(teams[teamId].name).toMatch(/Team/)
      expect(teams[teamId].currentPlayerIndex).toBe(0)
      expect(teams[teamId].roundScores).toEqual({
        round1: 0,
        round2: 0,
        round3: 0,
      })
    }
  })

  it("playerOrder is a permutation of all players assigned to that team", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedRoom(db, roomId, { playerCount: 4, numTeams: 2 })

    await initializeGameState(db, roomId, adminUid, true)

    const teamsSnap = await get(ref(db, `rooms/${roomId}/teams`))
    const teams = teamsSnap.val()
    // Team 1 gets player-0, player-2 (indices 0,2 mod 2)
    expect(teams["team-1"].playerOrder.sort()).toEqual(["player-0", "player-2"].sort())
    // Team 2 gets player-1, player-3
    expect(teams["team-2"].playerOrder.sort()).toEqual(["player-1", "player-3"].sort())
  })

  // ── gameState fields ──────────────────────────────────────

  it("sets round: 1, phase: 'waiting_start', currentWordId: null, lastAction: null", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedRoom(db, roomId)

    await initializeGameState(db, roomId, adminUid, true)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    expect(gs.round).toBe(1)
    expect(gs.phase).toBe("waiting_start")
    expect(gs.currentWordId).toBeUndefined()
    expect(gs.lastAction).toBeUndefined()
  })

  it("sets currentTeamId to first team", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedRoom(db, roomId, { numTeams: 2 })

    await initializeGameState(db, roomId, adminUid, true)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    expect(gs.currentTeamId).toBe("team-1")
  })

  it("sets currentExplainerId to playerOrder[0] of currentTeamId", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedRoom(db, roomId, { playerCount: 2, numTeams: 2 })

    await initializeGameState(db, roomId, adminUid, true)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    const teamsSnap = await get(ref(db, `rooms/${roomId}/teams`))
    const teams = teamsSnap.val()
    expect(gs.currentExplainerId).toBe(teams[gs.currentTeamId].playerOrder[0])
  })

  it("initializes timerStartedAt, pausedAt, timeRemainingAtPause to null", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedRoom(db, roomId)

    await initializeGameState(db, roomId, adminUid, true)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    expect(gs.timerStartedAt).toBeUndefined()
    expect(gs.pausedAt).toBeUndefined()
    expect(gs.timeRemainingAtPause).toBeUndefined()
  })

  it("initializes playerStats as empty {} for every player", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedRoom(db, roomId, { playerCount: 3 })

    await initializeGameState(db, roomId, adminUid, true)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    expect(gs.playerStats).toEqual({
      "player-0": { wordsExplained: 0 },
      "player-1": { wordsExplained: 0 },
      "player-2": { wordsExplained: 0 },
    })
  })

  // ── Status transition ordering ────────────────────────────

  it("writes status: 'playing' only after gameState is complete", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedRoom(db, roomId)

    await initializeGameState(db, roomId, adminUid, true)

    const statusSnap = await get(ref(db, `rooms/${roomId}/status`))
    const gameSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    expect(statusSnap.val()).toBe("playing")
    expect(gameSnap.exists()).toBe(true)
    expect(gameSnap.val().hat).toBeTruthy()
  })

  // ── Bypass flag ───────────────────────────────────────────

  it("with bypassMinPlayers=true and 1 player per team: succeeds", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    // 1 player only
    await seedRoom(db, roomId, { playerCount: 1, numTeams: 2 })
    // Add second player manually with team-2
    await set(ref(db, `rooms/${roomId}/players/player-1`), {
      name: "Player 1",
      color: "#111111",
      teamId: "team-2",
      wordsSubmitted: true,
      ready: true,
      connected: true,
      isAdmin: false,
    })
    await set(ref(db, `rooms/${roomId}/words/player-1-word-0`), {
      text: "w1",
      addedBy: "player-1",
    })

    await initializeGameState(db, roomId, adminUid, true)

    const statusSnap = await get(ref(db, `rooms/${roomId}/status`))
    expect(statusSnap.val()).toBe("playing")
  })

  it("with bypassMinPlayers=false and 1 player per team: throws MinPlayersError", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedRoom(db, roomId, { playerCount: 1, numTeams: 2 })

    await expect(initializeGameState(db, roomId, adminUid, false)).rejects.toThrow(MinPlayersError)
  })

  it("MinPlayersError includes teamId and count", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedRoom(db, roomId, { playerCount: 1, numTeams: 2 })

    try {
      await initializeGameState(db, roomId, adminUid, false)
      expect.fail("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(MinPlayersError)
      const err = e as MinPlayersError
      expect(err.teamId).toBeTruthy()
      expect(err.count).toBe(1)
    }
  })

  // ── Guard conditions ──────────────────────────────────────

  it("throws InvalidPhaseTransitionError when status is 'word-entry'", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedRoom(db, roomId, { status: "word-entry" })

    await expect(initializeGameState(db, roomId, adminUid, true)).rejects.toThrow(InvalidPhaseTransitionError)
  })

  it("throws InvalidPhaseTransitionError when status is 'playing' (idempotency)", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedRoom(db, roomId, { status: "playing" })

    await expect(initializeGameState(db, roomId, adminUid, true)).rejects.toThrow(InvalidPhaseTransitionError)
  })

  it("throws InvalidPhaseTransitionError when status is 'finished'", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedRoom(db, roomId, { status: "finished" })

    await expect(initializeGameState(db, roomId, adminUid, true)).rejects.toThrow(InvalidPhaseTransitionError)
  })

  // ── Edge cases ────────────────────────────────────────────

  it("throws when no players exist in room", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await set(ref(db, `rooms/${roomId}/meta`), {
      createdBy: adminUid,
      createdAt: 0,
      lastActiveAt: 0,
    })
    await set(ref(db, `rooms/${roomId}/config`), {
      wordCount: 3,
      numTeams: 2,
      skipPenalty: false,
      timerDuration: 60,
    })
    await set(ref(db, `rooms/${roomId}/status`), "pre-start")

    await expect(initializeGameState(db, roomId, adminUid, true)).rejects.toThrow("No players")
  })

  it("throws when no words exist in room", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedRoom(db, roomId, { playerCount: 2 })
    // Remove all words
    await set(ref(db, `rooms/${roomId}/words`), null)

    await expect(initializeGameState(db, roomId, adminUid, true)).rejects.toThrow("No words")
  })

  it("player with teamId=null: excluded from teams", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedRoom(db, roomId, { playerCount: 3, numTeams: 2 })
    // Unassign one player
    await set(ref(db, `rooms/${roomId}/players/player-2/teamId`), null)

    await initializeGameState(db, roomId, adminUid, true)

    const teamsSnap = await get(ref(db, `rooms/${roomId}/teams`))
    const teams = teamsSnap.val()
    const allOrdered = [...teams["team-1"].playerOrder, ...teams["team-2"].playerOrder]
    expect(allOrdered).not.toContain("player-2")
  })

  it("playerStats excludes unassigned players (teamId=null)", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedRoom(db, roomId, { playerCount: 3, numTeams: 2 })
    // Unassign one player
    await set(ref(db, `rooms/${roomId}/players/player-2/teamId`), null)

    await initializeGameState(db, roomId, adminUid, true)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    // player-2 had teamId=null — should not appear in playerStats
    expect(gs.playerStats["player-2"]).toBeUndefined()
    // assigned players still present
    expect(gs.playerStats["player-0"]).toEqual({ wordsExplained: 0 })
    expect(gs.playerStats["player-1"]).toEqual({ wordsExplained: 0 })
  })

  // ── Permission ─────────────────────────────────────────────

  it("called by non-admin client throws permission-denied", async () => {
    // Create a separate FirebaseApp for the non-admin user
    const nonAdminApp = initializeApp(
      {
        projectId: "the-hat-dev",
        apiKey: "fake-api-key-nonadmin",
        databaseURL: "http://127.0.0.1:9000?ns=the-hat-dev",
      },
      `non-admin-${Date.now()}`,
    )
    const nonAdminDb = getDatabase(nonAdminApp)
    connectDatabaseEmulator(nonAdminDb, "127.0.0.1", 9000)
    const nonAdminAuth = getAuth(nonAdminApp)
    connectAuthEmulator(nonAdminAuth, "http://127.0.0.1:9099", { disableWarnings: true })

    // Sign in as non-admin (not on /admins whitelist for this separate app)
    const cred = await signInAnonymously(nonAdminAuth)
    const nonAdminUid = cred.user.uid

    const roomId = `test-${Date.now()}-${roomIdx++}`
    // Seed room with admin-app so room exists
    const db = makeDatabase()
    await seedRoom(db, roomId)

    // Use non-admin uid — should fail application-level check
    await expect(initializeGameState(nonAdminDb, roomId, nonAdminUid, true)).rejects.toThrow(/permission/i)

    await signOut(nonAdminAuth)
    await deleteApp(nonAdminApp)
  })

  it("player who submitted 0 words: their wordIds not in hat", async () => {
    const db = makeDatabase()
    const roomId = `test-${Date.now()}-${roomIdx++}`
    await seedRoom(db, roomId, { playerCount: 3, wordCount: 2 })
    // Remove all words submitted by player-1
    await set(ref(db, `rooms/${roomId}/words/player-1-word-0`), null)
    await set(ref(db, `rooms/${roomId}/words/player-1-word-1`), null)

    await initializeGameState(db, roomId, adminUid, true)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    // player-0 and player-2 each had 2 words → 4 total
    expect(gs.hat).toHaveLength(4)
    expect(gs.hat).not.toContain("player-1-word-0")
    expect(gs.hat).not.toContain("player-1-word-1")
  })
})
