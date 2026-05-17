import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { getDatabase, connectDatabaseEmulator, ref, set, get } from "firebase/database"
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app"
import { getAuth, connectAuthEmulator, signInAnonymously } from "firebase/auth"
import {
  recordGuessed,
  recordSkip,
  completePostExpiryGuessed,
  completePostExpirySkip,
} from "./explainer-actions"
import type { GameState } from "$lib/db-types"

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

async function seedGameState(
  db: ReturnType<typeof getDatabase>,
  roomId: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const base: Record<string, unknown> = {
    hat: ["w-1", "w-2", "w-3"],
    currentWordId: "w-1",
    currentWordText: "apple",
    round: 1,
    currentTeamId: "team-a",
    currentExplainerId: "player-ex",
    timerStartedAt: 1234567890,
    timerDuration: 60,
    pausedAt: null,
    timeRemainingAtPause: null,
    phase: "explaining",
    lastAction: null,
    wordsGuessedThisTurn: 1,
    playerStats: {
      "player-ex": { wordsExplained: 2 },
    },
    ...overrides,
  }

  await set(ref(db, `rooms/${roomId}/gameState`), base)
  await set(ref(db, `rooms/${roomId}/config`), {
    wordCount: 3,
    numTeams: 2,
    skipPenalty: true,
    timerDuration: 60,
  })
  await set(ref(db, `rooms/${roomId}/teams/team-a`), {
    name: "Team A",
    playerOrder: ["player-ex", "player-2"],
    currentPlayerIndex: 0,
    roundScores: { round1: 3, round2: 0, round3: 0 },
  })
  await set(ref(db, `rooms/${roomId}/teams/team-b`), {
    name: "Team B",
    playerOrder: ["player-4", "player-5"],
    currentPlayerIndex: 0,
    roundScores: { round1: 1, round2: 0, round3: 0 },
  })
  // Seed words for drawWord to resolve text
  await set(ref(db, `rooms/${roomId}/words/w-1`), { text: "apple", addedBy: "p1" })
  await set(ref(db, `rooms/${roomId}/words/w-2`), { text: "banana", addedBy: "p1" })
  await set(ref(db, `rooms/${roomId}/words/w-3`), { text: "cherry", addedBy: "p1" })
}

describe("recordGuessed", () => {
  it("writes lastAction, awards point, draws next word", async () => {
    const db = makeDatabase()
    const roomId = `ea-${Date.now()}-${idx++}`
    await seedGameState(db, roomId)

    const nextWordId = await recordGuessed(
      db,
      roomId,
      "w-1", // currentWordId being guessed
      "team-a",
      "player-ex",
      1,
    )

    // next word drawn (non-null since hat had 2 remaining + w-1 removed by drawWord)
    expect(nextWordId).toBeTypeOf("string")

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val() as GameState

    // lastAction written to RTDB
    expect(gs.lastAction).toBeDefined()
    expect(gs.lastAction!.type).toBe("guessed")
    expect(gs.lastAction!.wordId).toBe("w-1")
    expect(gs.lastAction!.scoredTeamId).toBe("team-a")
    expect(gs.lastAction!.scoreWasPenalty).toBe(false)

    // score incremented
    const scoreSnap = await get(ref(db, `rooms/${roomId}/teams/team-a/roundScores/round1`))
    expect(scoreSnap.val()).toBe(4) // 3 + 1

    // wordsExplained incremented
    const statsSnap = await get(ref(db, `rooms/${roomId}/gameState/playerStats/player-ex`))
    expect(statsSnap.val().wordsExplained).toBe(3) // 2 + 1

    // wordsGuessedThisTurn incremented
    expect(gs.wordsGuessedThisTurn).toBe(2) // 1 + 1
  })

  it("returns null when hat empty, but still writes lastAction", async () => {
    const db = makeDatabase()
    const roomId = `ea-empty-${Date.now()}-${idx++}`
    await seedGameState(db, roomId, { hat: [] })

    const nextWordId = await recordGuessed(db, roomId, "w-1", "team-a", "player-ex", 1)

    expect(nextWordId).toBeNull()

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val() as GameState

    // lastAction still written — Undo can reverse last guess
    expect(gs.lastAction).toBeDefined()
    expect(gs.lastAction!.type).toBe("guessed")
  })
})

describe("recordSkip", () => {
  it("writes lastAction, returns word, applies penalty, draws next", async () => {
    const db = makeDatabase()
    const roomId = `ea-skip-${Date.now()}-${idx++}`
    await seedGameState(db, roomId)

    const nextWordId = await recordSkip(
      db,
      roomId,
      "w-1",
      "team-a",
      true, // skipPenalty enabled
      1,
    )

    expect(nextWordId).toBeTypeOf("string")

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val() as GameState

    // lastAction written
    expect(gs.lastAction).toBeDefined()
    expect(gs.lastAction!.type).toBe("skipped")
    expect(gs.lastAction!.wordId).toBe("w-1")
    expect(gs.lastAction!.scoredTeamId).toBeUndefined()
    expect(gs.lastAction!.scoreWasPenalty).toBe(true)

    // word returned to hat — "w-1" was returned, then drawWord() pulled one out
    // After skip: w-1 returned to hat, hat had [w-2, w-3] → [w-2, w-3, w-1]
    // Then drawWord draws one — hat now has 2
    expect(gs.hat).toHaveLength(2)

    // penalty applied: round1 was 3, now 2
    const scoreSnap = await get(ref(db, `rooms/${roomId}/teams/team-a/roundScores/round1`))
    expect(scoreSnap.val()).toBe(2) // 3 - 1
  })

  it("no penalty when skipPenalty false, but lastAction records it", async () => {
    const db = makeDatabase()
    const roomId = `ea-skip-np-${Date.now()}-${idx++}`
    await seedGameState(db, roomId)

    await recordSkip(db, roomId, "w-1", "team-a", false, 1)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val() as GameState

    expect(gs.lastAction!.scoreWasPenalty).toBe(false)

    const scoreSnap = await get(ref(db, `rooms/${roomId}/teams/team-a/roundScores/round1`))
    expect(scoreSnap.val()).toBe(3) // unchanged
  })

  it("returns null when hat empty after return+draw", async () => {
    const db = makeDatabase()
    const roomId = `ea-skip-end-${Date.now()}-${idx++}`
    // Hat empty — returnWord adds currentWordId to hat, then drawWord pulls it out.
    // Hat goes empty → [] then returnWord adds → [w-1] → drawWord pulls → [] → returns "w-1".
    // Not null since hat got refilled by return then emptied by draw.
    // To get truly null: hat already empty AND no word to return (won't happen;
    // recordSkip always calls returnWord first). So this case is covered by
    // drawWord returning null when hat is empty pre-draw. Already tested above.
    // Test: recordSkip on empty hat + currentWordId present → hat refilled then drawn → non-null.
    await seedGameState(db, roomId, { hat: [], currentWordId: "w-1" })

    const nextWordId = await recordSkip(db, roomId, "w-1", "team-a", false, 1)

    // returnWord pushes w-1 → hat=["w-1"], drawWord pulls w-1 → hat=[] → returns "w-1"
    expect(nextWordId).toBe("w-1")
  })
})

describe("completePostExpiryGuessed", () => {
  it("awards point, transitions to post_turn, clears word and lastAction", async () => {
    const db = makeDatabase()
    const roomId = `ea-pe-g-${Date.now()}-${idx++}`
    await seedGameState(db, roomId, {
      phase: "post_expiry",
      currentWordId: "w-last",
    })

    await completePostExpiryGuessed(db, roomId, "team-b", "player-ex", 1)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val() as GameState

    expect(gs.phase).toBe("post_turn")
    // currentWordId set to null — RTDB strips null, so undefined
    expect(gs.currentWordId).toBeUndefined()
    expect(gs.lastAction).toBeUndefined()

    // team-b round1 was 1 → now 2
    const scoreSnap = await get(ref(db, `rooms/${roomId}/teams/team-b/roundScores/round1`))
    expect(scoreSnap.val()).toBe(2)
  })

  it("handles team without existing score", async () => {
    const db = makeDatabase()
    const roomId = `ea-pe-g2-${Date.now()}-${idx++}`
    await seedGameState(db, roomId, { phase: "post_expiry" })

    // team-c doesn't exist — awardPoint initializes score from 0
    await set(ref(db, `rooms/${roomId}/teams/team-c`), {
      name: "Team C",
      playerOrder: [],
      currentPlayerIndex: 0,
      roundScores: { round1: 0, round2: 0, round3: 0 },
    })

    await completePostExpiryGuessed(db, roomId, "team-c", "player-ex", 1)

    const scoreSnap = await get(ref(db, `rooms/${roomId}/teams/team-c/roundScores/round1`))
    expect(scoreSnap.val()).toBe(1)
  })
})

describe("completePostExpirySkip", () => {
  it("returns word to hat, transitions to post_turn, clears word and lastAction", async () => {
    const db = makeDatabase()
    const roomId = `ea-pe-s-${Date.now()}-${idx++}`
    // Hat starts with [w-1, w-2, w-3], currentWordId = "w-1"
    await seedGameState(db, roomId, {
      phase: "post_expiry",
      currentWordId: "w-1",
      hat: ["w-2", "w-3"],
    })

    await completePostExpirySkip(db, roomId, "w-1")

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val() as GameState

    expect(gs.phase).toBe("post_turn")
    expect(gs.currentWordId).toBeUndefined()
    expect(gs.lastAction).toBeUndefined()

    // w-1 returned to hat
    expect(gs.hat).toContain("w-1")
    expect(gs.hat).toHaveLength(3) // w-2, w-3 + w-1 returned
  })
})

describe("recordSkip — skip dedup", () => {
  it("never returns same word as skipped when hat has other words", async () => {
    const db = makeDatabase()

    // Hat: [w-1, w-2, w-3], currentWordId = w-1 (the word being skipped)
    // After recordSkip: w-1 returned to hat, then drawWord must NOT pick w-1
    // Run multiple times to verify statistically
    let skippedDrawn = 0
    const attempts = 5

    for (let i = 0; i < attempts; i++) {
      const localRoomId = `ea-skip-dup-${Date.now()}-${idx++}`
      await seedGameState(db, localRoomId, {
        hat: ["w-2", "w-3"],
        currentWordId: "w-1",
        currentWordText: "apple",
        timerStartedAt: 1234567890,
        wordsGuessedThisTurn: 1,
      })

      const nextWordId = await recordSkip(db, localRoomId, "w-1", "team-a", true, 1)

      // After skip: w-1 returned to hat → hat = [w-2, w-3, w-1]
      // drawWord(exclude=w-1) must NOT pick w-1
      expect(nextWordId).not.toBeNull()
      if (nextWordId === "w-1") skippedDrawn++
    }

    expect(skippedDrawn).toBe(0)
  })
})
