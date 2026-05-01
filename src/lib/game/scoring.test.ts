import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { getDatabase, connectDatabaseEmulator, ref, set, get } from "firebase/database"
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app"
import { getAuth, connectAuthEmulator, signInAnonymously } from "firebase/auth"
import { awardPoint, applyPenalty, undoLastAction, UndoNotAvailableError } from "./scoring"
import type { PlayerStats, LastAction } from "$lib/db-types"

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

  // Seed admins/{uid} so gameState writes pass security rules
  const db = getDatabase(app)
  connectDatabaseEmulator(db, "127.0.0.1", 9000)
  await set(ref(db, `admins/${cred.user.uid}`), true)
})

afterAll(async () => {
  await deleteApp(app)
})

async function seedFullGameState(
  db: ReturnType<typeof getDatabase>,
  roomId: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const base = {
    hat: ["w-1", "w-2", "w-3"],
    currentWordId: "w-1",
    round: 2,
    currentTeamId: "team-1",
    currentExplainerId: "player-0",
    timerStartedAt: null,
    timerDuration: 60,
    pausedAt: null,
    timeRemainingAtPause: null,
    phase: "explaining",
    lastAction: null,
    playerStats: {
      "player-0": { wordsExplained: 3 },
      "player-1": { wordsExplained: 0 },
    } as Record<string, PlayerStats>,
    ...overrides,
  }

  // Set teams with round scores explicitly
  await set(ref(db, `rooms/${roomId}/teams/team-1`), {
    name: "Team 1",
    playerOrder: ["player-0", "player-2"],
    currentPlayerIndex: 0,
    roundScores: {
      round1: 5,
      round2: 3,
      round3: 0,
    },
  })

  await set(ref(db, `rooms/${roomId}/gameState`), base)
  await set(ref(db, `rooms/${roomId}/config`), {
    wordCount: 3,
    numTeams: 2,
    skipPenalty: true,
    timerDuration: 60,
  })
}

describe("awardPoint", () => {
  it("increments team roundScores[currentRound] by 1 (AC 6)", async () => {
    const db = makeDatabase()
    const roomId = `scoring-${Date.now()}-${idx++}`
    await seedFullGameState(db, roomId) // round=2, team-1 roundScores.round2 = 3

    await awardPoint(db, roomId, "team-1", "player-0", 2)

    const snap = await get(ref(db, `rooms/${roomId}/teams/team-1/roundScores`))
    const scores = snap.val()
    expect(scores.round2).toBe(4) // 3 + 1
    expect(scores.round1).toBe(5) // unchanged
  })

  it("increments playerStats/{explainerId}/wordsExplained by 1 (AC 7)", async () => {
    const db = makeDatabase()
    const roomId = `scoring-${Date.now()}-${idx++}`
    await seedFullGameState(db, roomId)

    await awardPoint(db, roomId, "team-1", "player-0", 2)

    const snap = await get(ref(db, `rooms/${roomId}/gameState/playerStats/player-0`))
    expect(snap.val().wordsExplained).toBe(4) // 3 + 1
  })

  it("works for round 1, 2, 3 — writes to correct roundN key", async () => {
    for (const r of [1, 2, 3]) {
      const db = makeDatabase()
      const roomId = `scoring-${Date.now()}-${idx++}`
      await seedFullGameState(db, roomId, { round: r })

      await awardPoint(db, roomId, "team-1", "player-0", r)

      const snap = await get(ref(db, `rooms/${roomId}/teams/team-1/roundScores`))
      const scores = snap.val()
      const key = `round${r}`
      expect(scores[key]).toBeGreaterThan(0)
    }
  })
})

describe("applyPenalty", () => {
  it("decrements roundScores by 1 when skipPenalty is true (AC 8)", async () => {
    const db = makeDatabase()
    const roomId = `scoring-${Date.now()}-${idx++}`
    await seedFullGameState(db, roomId) // team-1 roundScores.round2 = 3

    await applyPenalty(db, roomId, "team-1", true, 2)

    const snap = await get(ref(db, `rooms/${roomId}/teams/team-1/roundScores`))
    const scores = snap.val()
    expect(scores.round2).toBe(2) // 3 - 1
  })

  it("does nothing (no write) when skipPenalty is false (AC 9)", async () => {
    const db = makeDatabase()
    const roomId = `scoring-${Date.now()}-${idx++}`
    await seedFullGameState(db, roomId)

    await applyPenalty(db, roomId, "team-1", false, 2)

    const snap = await get(ref(db, `rooms/${roomId}/teams/team-1/roundScores`))
    const scores = snap.val()
    expect(scores.round2).toBe(3) // unchanged
  })

  it("score never goes below 0 (clamp at 0)", async () => {
    const db = makeDatabase()
    const roomId = `scoring-${Date.now()}-${idx++}`
    await seedFullGameState(db, roomId, {
      round: 1,
    })
    // Set team-1 round1 score to 0
    await set(ref(db, `rooms/${roomId}/teams/team-1/roundScores/round1`), 0)

    await applyPenalty(db, roomId, "team-1", true, 1)

    const snap = await get(ref(db, `rooms/${roomId}/teams/team-1/roundScores`))
    const scores = snap.val()
    expect(scores.round1).toBe(0) // clamped, not -1
  })
})

describe("undoLastAction", () => {
  it("type=guessed: decrements score, decrements wordsExplained, returns both words to hat, clears lastAction (AC 10)", async () => {
    const db = makeDatabase()
    const roomId = `scoring-${Date.now()}-${idx++}`
    const lastAction: LastAction = {
      type: "guessed",
      wordId: "w-5",
      scoredTeamId: "team-1",
      scoreWasPenalty: false,
    }
    // seed: team-1 round2=3, player-0 wordsExplained=3, currentWordId="w-1", hat=["w-1","w-2","w-3"]
    await seedFullGameState(db, roomId, {
      lastAction,
      currentWordId: "w-1",
      hat: ["w-2", "w-3"],
    })

    await undoLastAction(db, roomId, 2, true)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()

    // lastAction cleared (RTDB strips null => undefined)
    expect(gs.lastAction).toBeUndefined()

    // currentWordId set to lastAction.wordId (the undone word)
    expect(gs.currentWordId).toBe("w-5")

    // hat contains both: old-remaining + restored wordIds (w-5 + currentWordId w-1 returned)
    // Actually AC says: "returns both currentWordId and lastAction.wordId to hat"
    expect(gs.hat).toContain("w-1") // currentWordId restored
    expect(gs.hat).toContain("w-5") // lastAction.wordId restored
    expect(gs.hat).toHaveLength(4) // w-2, w-3 + w-1 + w-5

    // player stats decremented
    const statsSnap = await get(ref(db, `rooms/${roomId}/gameState/playerStats/player-0`))
    expect(statsSnap.val().wordsExplained).toBe(2) // 3 - 1

    // team score decremented
    const scoreSnap = await get(ref(db, `rooms/${roomId}/teams/team-1/roundScores`))
    expect(scoreSnap.val().round2).toBe(2) // 3 - 1
  })

  it("type=skipped: reverses penalty if applied, returns word to hat, sets currentWordId to undone word (AC 11)", async () => {
    const db = makeDatabase()
    const roomId = `scoring-${Date.now()}-${idx++}`
    const lastAction: LastAction = {
      type: "skipped",
      wordId: "w-skipped",
      scoredTeamId: "team-1",
      scoreWasPenalty: true, // penalty WAS applied
    }
    // seed: team-1 round2=3, currentWordId="w-0", hat=["w-2","w-3"]
    await seedFullGameState(db, roomId, {
      lastAction,
      currentWordId: "w-0",
      hat: ["w-2", "w-3"],
    })

    await undoLastAction(db, roomId, 2, true)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()

    // lastAction cleared (RTDB strips null => undefined)
    expect(gs.lastAction).toBeUndefined()

    // currentWordId restored to skipped word
    expect(gs.currentWordId).toBe("w-skipped")

    // w-skipped returned to hat, remaining words still there
    expect(gs.hat).toContain("w-skipped")
    expect(gs.hat).toContain("w-2")
    expect(gs.hat).toContain("w-3")
    expect(gs.hat).toHaveLength(3)

    // Penalty reversed: team score +1 back
    const scoreSnap = await get(ref(db, `rooms/${roomId}/teams/team-1/roundScores`))
    expect(scoreSnap.val().round2).toBe(4) // 3 + 1 (penalty reversed)
  })

  it("type=skipped with scoreWasPenalty=false: no score adjustment", async () => {
    const db = makeDatabase()
    const roomId = `scoring-${Date.now()}-${idx++}`
    const lastAction: LastAction = {
      type: "skipped",
      wordId: "w-no-penalty",
      scoredTeamId: "team-1",
      scoreWasPenalty: false,
    }
    await seedFullGameState(db, roomId, {
      lastAction,
      currentWordId: "w-x",
      hat: ["w-1", "w-2"],
    })

    await undoLastAction(db, roomId, 2, true)

    // Score unchanged
    const scoreSnap = await get(ref(db, `rooms/${roomId}/teams/team-1/roundScores`))
    expect(scoreSnap.val().round2).toBe(3) // unchanged
  })

  it("when lastAction is null: throws UndoNotAvailableError (AC 12)", async () => {
    const db = makeDatabase()
    const roomId = `scoring-${Date.now()}-${idx++}`
    await seedFullGameState(db, roomId, { lastAction: null })

    await expect(undoLastAction(db, roomId, 2, true)).rejects.toThrow(UndoNotAvailableError)
  })

  it("undo after score=0: score stays 0 (no negative score)", async () => {
    const db = makeDatabase()
    const roomId = `scoring-${Date.now()}-${idx++}`
    const lastAction: LastAction = {
      type: "guessed",
      wordId: "w-z",
      scoredTeamId: "team-1",
      scoreWasPenalty: false,
    }
    // team-1 round2 = 0
    await set(ref(db, `rooms/${roomId}/teams/team-1/roundScores/round2`), 0)
    await seedFullGameState(db, roomId, {
      lastAction,
      currentWordId: "w-current",
      hat: ["w-1"],
    })
    // Set score to 0 after seed (seed defaults round2=3)
    await set(ref(db, `rooms/${roomId}/teams/team-1/roundScores/round2`), 0)

    await undoLastAction(db, roomId, 2, true)

    const scoreSnap = await get(ref(db, `rooms/${roomId}/teams/team-1/roundScores`))
    expect(scoreSnap.val().round2).toBe(0) // clamped
  })

  it("undo twice: second call throws UndoNotAvailableError (lastAction already null)", async () => {
    const db = makeDatabase()
    const roomId = `scoring-${Date.now()}-${idx++}`
    const lastAction: LastAction = {
      type: "guessed",
      wordId: "w-dbl",
      scoredTeamId: "team-1",
      scoreWasPenalty: false,
    }
    await seedFullGameState(db, roomId, {
      lastAction,
      currentWordId: "w-c",
      hat: ["w-1"],
    })

    await undoLastAction(db, roomId, 2, true)

    // Second call should throw
    await expect(undoLastAction(db, roomId, 2, true)).rejects.toThrow(UndoNotAvailableError)
  })
})
