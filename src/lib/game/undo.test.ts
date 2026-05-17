import { describe, it, expect } from "vitest"
import { ref, set, get } from "firebase/database"
import { undoLastAction, UndoNotAvailableError } from "./scoring"
import { makeDatabase, nextRoomId, seedFullGameState, seedWords } from "./__test-helpers"
import type { LastAction } from "$lib/db-types"

describe("undoLastAction", () => {
  it("type=guessed: decrements score, decrements wordsExplained, currentWordId returns to hat, action.wordId NOT in hat (regression fix)", async () => {
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
    // action.wordId becomes currentWordId — NOT in hat
    expect(gs.currentWordId).toBe("w-5")
    // old currentWordId goes back to hat
    expect(gs.hat).toContain("w-1")
    expect(gs.hat).toContain("w-2")
    expect(gs.hat).toContain("w-3")
    // action.wordId must NOT be in hat (regression fix)
    expect(gs.hat).not.toContain("w-5")
    expect(gs.hat).toHaveLength(3)

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

  it("type=skipped: reverses penalty if applied, action.wordId NOT in hat, currentWordId returned to hat (regression fix)", async () => {
    const db = makeDatabase()
    const roomId = nextRoomId("scoring")
    const lastAction: LastAction = {
      type: "skipped",
      wordId: "w-skipped",
      scoredTeamId: "team-1",
      scoreWasPenalty: true,
    }
    // Simulate post-skip state: recordSkip already called returnWord on "w-skipped"
    // so it's in hat. Need hat to contain "w-skipped" to verify undo REMOVES it.
    await seedFullGameState(db, roomId, {
      lastAction,
      currentWordId: "w-0",
      hat: ["w-skipped", "w-2", "w-3"],
    })
    await seedWords(db, roomId)

    await undoLastAction(db, roomId, 2, true)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()

    expect(gs.lastAction).toBeUndefined()
    expect(gs.currentWordId).toBe("w-skipped")
    // action.wordId must NOT be in hat (regression fix — was duplicate)
    expect(gs.hat).not.toContain("w-skipped")
    // old currentWordId goes back to hat
    expect(gs.hat).toContain("w-0")
    expect(gs.hat).toContain("w-2")
    expect(gs.hat).toContain("w-3")
    expect(gs.hat).toHaveLength(3)

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
      hat: ["w-skipped", "w-2", "w-3"],
    })
    await seedWords(db, roomId)

    await undoLastAction(db, roomId, 2, true)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    expect(gs.currentWordText).toBe("skipped-word")
  })

  it("currentWordId returned to hat, action.wordId becomes currentWordId (not in hat)", async () => {
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
    expect(gs.hat).not.toContain("w-5")
    expect(gs.currentWordId).toBe("w-5")
  })

  it("type=skipped with scoreWasPenalty=false: action.wordId not in hat, removed if present", async () => {
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
      // recordSkip already called returnWord — "w-no-penalty" is in hat
      hat: ["w-no-penalty", "w-1", "w-2"],
    })
    await seedWords(db, roomId)

    await undoLastAction(db, roomId, 2, true)

    const scoreSnap = await get(ref(db, `rooms/${roomId}/teams/team-1/roundScores`))
    expect(scoreSnap.val().round2).toBe(3)

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    // action.wordId removed from hat
    expect(gs.hat).not.toContain("w-no-penalty")
    // old currentWordId returned to hat
    expect(gs.hat).toContain("w-x")
    expect(gs.hat).toContain("w-1")
    expect(gs.hat).toContain("w-2")
    expect(gs.hat).toHaveLength(3)
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

    const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
    const gs = gsSnap.val()
    expect(gs.currentWordId).toBe("w-z")
    expect(gs.hat).toContain("w-1")
    expect(gs.hat).toContain("w-current")
    expect(gs.hat).not.toContain("w-z")
    expect(gs.hat).toHaveLength(2)
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

  describe("regression: action.wordId never re-added to hat", () => {
    it("guessed word not in hat after undo — only as currentWordId", async () => {
      const db = makeDatabase()
      const roomId = nextRoomId("scoring")
      const lastAction: LastAction = {
        type: "guessed",
        wordId: "w-guess",
        scoredTeamId: "team-1",
        scoreWasPenalty: false,
      }
      await seedFullGameState(db, roomId, {
        lastAction,
        currentWordId: "w-curr",
        hat: ["w-a", "w-b"],
      })
      await seedWords(db, roomId)

      await undoLastAction(db, roomId, 2, true)

      const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
      const gs = gsSnap.val()
      expect(gs.hat).not.toContain("w-guess")
      expect(gs.currentWordId).toBe("w-guess")
    })

    it("skipped word removed from hat after undo — recordSkip already returned it", async () => {
      const db = makeDatabase()
      const roomId = nextRoomId("scoring")
      const lastAction: LastAction = {
        type: "skipped",
        wordId: "w-skip",
        scoredTeamId: "team-1",
        scoreWasPenalty: true,
      }
      // Simulate: recordSkip already called returnWord on "w-skip", it's now in hat
      await seedFullGameState(db, roomId, {
        lastAction,
        currentWordId: "w-next",
        hat: ["w-skip", "w-a", "w-b"],
      })
      await seedWords(db, roomId)

      await undoLastAction(db, roomId, 2, true)

      const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
      const gs = gsSnap.val()
      expect(gs.hat).not.toContain("w-skip")
      expect(gs.hat).toContain("w-next")
      expect(gs.currentWordId).toBe("w-skip")
    })
  })
})
