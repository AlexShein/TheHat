import { describe, it, expect } from "vitest"
import { ref, get } from "firebase/database"
import { undoLastAction } from "./scoring"
import { makeDatabase, nextRoomId, seedFullGameState, seedWords } from "./__test-helpers"
import type { LastAction } from "$lib/db-types"

describe("undoLastAction — regression fixes", () => {
  it("type=skipped: does NOT duplicate action.wordId in hat (returnWord already added it)", async () => {
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
    // After undo: currentWordId=w-0 goes to hat. w-skipped should NOT be added again.
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

    // Hat should contain: w-2, w-3, w-skipped, w-0 — exactly 4 items, no duplicate w-skipped
    expect(gs.hat).toContain("w-skipped")
    const skipCount = gs.hat.filter((id: string) => id === "w-skipped").length
    expect(skipCount).toBe(1)
    expect(gs.hat).toHaveLength(4)
    expect(gs.currentWordId).toBe("w-skipped")
    expect(gs.currentWordText).toBe("skipped-word")
  })

  it("type=guessed: decrements wordsGuessedThisTurn by 1", async () => {
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

  it("full cycle: guess → undo → wordsGuessedThisTurn goes to 0 so re-guess would be 1", async () => {
    const db = makeDatabase()
    const roomId = nextRoomId("scoring")
    const lastAction: LastAction = {
      type: "guessed",
      wordId: "w-5",
      scoredTeamId: "team-1",
      scoreWasPenalty: false,
    }
    // Simulate: w-5 was guessed, count went to 1, new word w-1 was drawn
    await seedFullGameState(db, roomId, {
      lastAction,
      currentWordId: "w-1",
      wordsGuessedThisTurn: 1,
      hat: ["w-2", "w-3"],
    })
    await seedWords(db, roomId)

    // Undo the guess
    await undoLastAction(db, roomId, 2, true)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    // wordsGuessedThisTurn should be back to 0
    expect(gs.wordsGuessedThisTurn).toBe(0)
    // w-1 returned to hat, w-5 restored as current
    expect(gs.currentWordId).toBe("w-5")
    expect(gs.hat).toContain("w-1")
  })
})
