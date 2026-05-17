import { describe, it, expect } from "vitest"
import { ref, get } from "firebase/database"
import { undoLastAction } from "./scoring"
import { makeDatabase, nextRoomId, seedFullGameState, seedWords } from "./__test-helpers"
import type { LastAction } from "$lib/db-types"

describe("undoLastAction — regression fixes", () => {
  it("type=skipped: action.wordId REMOVED from hat (returnWord added it, undo removes)", async () => {
    const db = makeDatabase()
    const roomId = nextRoomId("scoring")
    const lastAction: LastAction = {
      type: "skipped",
      wordId: "w-skipped",
      scoredTeamId: "team-1",
      scoreWasPenalty: true,
    }
    // Simulate: w-skipped was skipped during recordSkip → returnWord put it back in hat.
    // Hat before undo: [w-2, w-3, w-skipped] (3 items)
    // After undo: w-skipped becomes currentWordId. w-0 goes to hat. w-skipped REMOVED from hat.
    await seedFullGameState(db, roomId, {
      lastAction,
      currentWordId: "w-0",
      currentWordText: "zero-word",
      hat: ["w-2", "w-3", "w-skipped"],
    })
    await seedWords(db, roomId)

    await undoLastAction(db, roomId, 2, true)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()

    // w-skipped NOT in hat — only as currentWordId
    expect(gs.hat).not.toContain("w-skipped")
    expect(gs.hat).toContain("w-2")
    expect(gs.hat).toContain("w-3")
    expect(gs.hat).toContain("w-0")
    expect(gs.hat).toHaveLength(3)
    expect(gs.currentWordId).toBe("w-skipped")
    expect(gs.currentWordText).toBe("skipped-word")
  })

  it("type=guessed: decrements wordsGuessedThisTurn by 1, action.wordId not in hat", async () => {
    const db = makeDatabase()
    const roomId = nextRoomId("scoring")
    const lastAction: LastAction = {
      type: "guessed",
      wordId: "w-5",
      scoredTeamId: "team-1",
      scoreWasPenalty: false,
    }
    await seedFullGameState(db, roomId, {
      lastAction,
      currentWordId: "w-1",
      wordsGuessedThisTurn: 3,
      hat: ["w-2", "w-3"],
    })
    await seedWords(db, roomId)

    await undoLastAction(db, roomId, 2, true)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    expect(gs.wordsGuessedThisTurn).toBe(2)
    // Regression: action.wordId not in hat
    expect(gs.hat).not.toContain("w-5")
    expect(gs.currentWordId).toBe("w-5")
  })

  it("type=skipped: does NOT decrement wordsGuessedThisTurn (skip never incremented it)", async () => {
    const db = makeDatabase()
    const roomId = nextRoomId("scoring")
    const lastAction: LastAction = {
      type: "skipped",
      wordId: "w-skipped",
      scoredTeamId: "team-1",
      scoreWasPenalty: true,
    }
    await seedFullGameState(db, roomId, {
      lastAction,
      currentWordId: "w-0",
      wordsGuessedThisTurn: 3,
      hat: ["w-2", "w-3"],
    })
    await seedWords(db, roomId)

    await undoLastAction(db, roomId, 2, true)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    expect(gs.wordsGuessedThisTurn).toBe(3)
  })

  it("full cycle: guess → undo → w-5 becomes currentWordId, w-1 returns to hat, w-5 NOT in hat", async () => {
    const db = makeDatabase()
    const roomId = nextRoomId("scoring")
    const lastAction: LastAction = {
      type: "guessed",
      wordId: "w-5",
      scoredTeamId: "team-1",
      scoreWasPenalty: false,
    }
    await seedFullGameState(db, roomId, {
      lastAction,
      currentWordId: "w-1",
      wordsGuessedThisTurn: 1,
      hat: ["w-2", "w-3"],
    })
    await seedWords(db, roomId)

    await undoLastAction(db, roomId, 2, true)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    expect(gs.wordsGuessedThisTurn).toBe(0)
    expect(gs.currentWordId).toBe("w-5")
    expect(gs.hat).toContain("w-1")
    expect(gs.hat).not.toContain("w-5")
  })
})
