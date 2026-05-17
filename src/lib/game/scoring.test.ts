import { describe, it, expect } from "vitest"
import { ref, set, get } from "firebase/database"
import { awardPoint, applyPenalty } from "./scoring"
import { incrementWordsGuessedThisTurn } from "./turn"
import { makeDatabase, nextRoomId, seedFullGameState } from "./__test-helpers"

describe("awardPoint", () => {
  it("increments team roundScores[currentRound] by 1 (AC 6)", async () => {
    const db = makeDatabase()
    const roomId = nextRoomId("scoring")
    await seedFullGameState(db, roomId) // round=2, team-1 roundScores.round2 = 3

    await awardPoint(db, roomId, "team-1", "player-0", 2)

    const snap = await get(ref(db, `rooms/${roomId}/teams/team-1/roundScores`))
    const scores = snap.val()
    expect(scores.round2).toBe(4) // 3 + 1
    expect(scores.round1).toBe(5) // unchanged
  })

  it("increments playerStats/{explainerId}/wordsExplained by 1 (AC 7)", async () => {
    const db = makeDatabase()
    const roomId = nextRoomId("scoring")
    await seedFullGameState(db, roomId)

    await awardPoint(db, roomId, "team-1", "player-0", 2)

    const snap = await get(ref(db, `rooms/${roomId}/gameState/playerStats/player-0`))
    expect(snap.val().wordsExplained).toBe(4) // 3 + 1
  })

  it("works for round 1, 2, 3 — writes to correct roundN key", async () => {
    for (const r of [1, 2, 3]) {
      const db = makeDatabase()
      const roomId = nextRoomId("scoring")
      await seedFullGameState(db, roomId, { round: r })

      await awardPoint(db, roomId, "team-1", "player-0", r)

      const snap = await get(ref(db, `rooms/${roomId}/teams/team-1/roundScores`))
      const scores = snap.val()
      const key = `round${r}`
      expect(scores[key]).toBeGreaterThan(0)
    }
  })

  it("increments wordsGuessedThisTurn by 1 (Phase 3.3 PostTurn display)", async () => {
    const db = makeDatabase()
    const roomId = nextRoomId("scoring")
    await seedFullGameState(db, roomId, { wordsGuessedThisTurn: 2 })

    await incrementWordsGuessedThisTurn(db, roomId)

    const snap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = snap.val()
    expect(gs.wordsGuessedThisTurn).toBe(3) // 2 + 1
  })
})

describe("applyPenalty", () => {
  it("decrements roundScores by 1 when skipPenalty is true (AC 8)", async () => {
    const db = makeDatabase()
    const roomId = nextRoomId("scoring")
    await seedFullGameState(db, roomId) // team-1 roundScores.round2 = 3

    await applyPenalty(db, roomId, "team-1", true, 2)

    const snap = await get(ref(db, `rooms/${roomId}/teams/team-1/roundScores`))
    const scores = snap.val()
    expect(scores.round2).toBe(2) // 3 - 1
  })

  it("does nothing (no write) when skipPenalty is false (AC 9)", async () => {
    const db = makeDatabase()
    const roomId = nextRoomId("scoring")
    await seedFullGameState(db, roomId)

    await applyPenalty(db, roomId, "team-1", false, 2)

    const snap = await get(ref(db, `rooms/${roomId}/teams/team-1/roundScores`))
    const scores = snap.val()
    expect(scores.round2).toBe(3) // unchanged
  })

  it("score never goes below 0 (clamp at 0)", async () => {
    const db = makeDatabase()
    const roomId = nextRoomId("scoring")
    await seedFullGameState(db, roomId, { round: 1 })
    // Set team-1 round1 score to 0
    await set(ref(db, `rooms/${roomId}/teams/team-1/roundScores/round1`), 0)

    await applyPenalty(db, roomId, "team-1", true, 1)

    const snap = await get(ref(db, `rooms/${roomId}/teams/team-1/roundScores`))
    const scores = snap.val()
    expect(scores.round1).toBe(0) // clamped, not -1
  })
})
