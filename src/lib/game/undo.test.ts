import { describe, it, expect } from "vitest"
import { ref, set, get } from "firebase/database"
import { undoLastAction, UndoNotAvailableError } from "./scoring"
import { makeDatabase, nextRoomId, seedFullGameState, seedWords } from "./__test-helpers"
import type { LastAction } from "$lib/db-types"

describe("undoLastAction", () => {
  it("type=guessed: decrements score, decrements wordsExplained, returns both words to hat, clears lastAction (AC 10)", async () => {
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
      hat: ["w-2", "w-3"],
    })
    await seedWords(db, roomId)

    await undoLastAction(db, roomId, 2, true)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()

    expect(gs.lastAction).toBeUndefined()
    expect(gs.currentWordId).toBe("w-5")
    expect(gs.hat).toContain("w-1")
    expect(gs.hat).toContain("w-5")
    expect(gs.hat).toHaveLength(4)

    const statsSnap = await get(ref(db, `rooms/${roomId}/gameState/playerStats/player-0`))
    expect(statsSnap.val().wordsExplained).toBe(2)

    const scoreSnap = await get(ref(db, `rooms/${roomId}/teams/team-1/roundScores`))
    expect(scoreSnap.val().round2).toBe(2)
  })

  it("type=guessed: restores currentWordText to action.wordId's word text", async () => {
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
      currentWordText: "apple",
      hat: ["w-2", "w-3"],
    })
    await seedWords(db, roomId)

    await undoLastAction(db, roomId, 2, true)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    expect(gs.currentWordText).toBe("guessed-five")
  })

  it("type=skipped: reverses penalty if applied, returns word to hat, sets currentWordId to undone word (AC 11)", async () => {
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
      hat: ["w-2", "w-3"],
    })
    await seedWords(db, roomId)

    await undoLastAction(db, roomId, 2, true)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()

    expect(gs.lastAction).toBeUndefined()
    expect(gs.currentWordId).toBe("w-skipped")
    expect(gs.hat).toContain("w-skipped")
    expect(gs.hat).toContain("w-2")
    expect(gs.hat).toContain("w-3")
    expect(gs.hat).toContain("w-0")
    expect(gs.hat).toHaveLength(4)

    const scoreSnap = await get(ref(db, `rooms/${roomId}/teams/team-1/roundScores`))
    expect(scoreSnap.val().round2).toBe(4)
  })

  it("type=skipped: restores currentWordText to skipped word's text", async () => {
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
      currentWordText: "zero-word",
      hat: ["w-2", "w-3"],
    })
    await seedWords(db, roomId)

    await undoLastAction(db, roomId, 2, true)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    expect(gs.currentWordText).toBe("skipped-word")
  })

  it("currentWordId present in hat after undo (current word returns to hat, not lost)", async () => {
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
      currentWordText: "apple",
      hat: ["w-2", "w-3"],
    })
    await seedWords(db, roomId)

    await undoLastAction(db, roomId, 2, true)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()

    expect(gs.hat).toContain("w-1")
    expect(gs.currentWordId).toBe("w-5")
  })

  it("type=skipped with scoreWasPenalty=false: no score adjustment", async () => {
    const db = makeDatabase()
    const roomId = nextRoomId("scoring")
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
    await seedWords(db, roomId)

    await undoLastAction(db, roomId, 2, true)

    const scoreSnap = await get(ref(db, `rooms/${roomId}/teams/team-1/roundScores`))
    expect(scoreSnap.val().round2).toBe(3)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    expect(gs.hat).toContain("w-no-penalty")
    expect(gs.hat).toContain("w-x")
    expect(gs.hat).toContain("w-1")
    expect(gs.hat).toContain("w-2")
    expect(gs.hat).toHaveLength(4)
    expect(gs.currentWordId).toBe("w-no-penalty")
  })

  it("when lastAction is null: throws UndoNotAvailableError (AC 12)", async () => {
    const db = makeDatabase()
    const roomId = nextRoomId("scoring")
    await seedFullGameState(db, roomId, { lastAction: null })

    await expect(undoLastAction(db, roomId, 2, true)).rejects.toThrow(UndoNotAvailableError)
  })

  it("undo after score=0: score stays 0 (no negative score)", async () => {
    const db = makeDatabase()
    const roomId = nextRoomId("scoring")
    const lastAction: LastAction = {
      type: "guessed",
      wordId: "w-z",
      scoredTeamId: "team-1",
      scoreWasPenalty: false,
    }
    await set(ref(db, `rooms/${roomId}/teams/team-1/roundScores/round2`), 0)
    await seedFullGameState(db, roomId, {
      lastAction,
      currentWordId: "w-current",
      hat: ["w-1"],
    })
    await seedWords(db, roomId)
    await set(ref(db, `rooms/${roomId}/teams/team-1/roundScores/round2`), 0)

    await undoLastAction(db, roomId, 2, true)

    const scoreSnap = await get(ref(db, `rooms/${roomId}/teams/team-1/roundScores`))
    expect(scoreSnap.val().round2).toBe(0)
  })

  it("undo twice: second call throws UndoNotAvailableError (lastAction already null)", async () => {
    const db = makeDatabase()
    const roomId = nextRoomId("scoring")
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
    await seedWords(db, roomId)

    await undoLastAction(db, roomId, 2, true)

    await expect(undoLastAction(db, roomId, 2, true)).rejects.toThrow(UndoNotAvailableError)
  })
})
