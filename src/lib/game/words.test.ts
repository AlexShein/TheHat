import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing"
import type { Database } from "firebase/database"
import fs from "node:fs"
import path from "node:path"
import { createRoom } from "./room"
import { joinRoom } from "./room"
import type { Word } from "$lib/db-types"

let testEnv: RulesTestEnvironment

const ADMIN_UID = "admin-words-123"
const PLAYER_1_UID = "player-words-456"
const PLAYER_2_UID = "player-words-789"

function emulatorDb(uid: string) {
  return testEnv.authenticatedContext(uid).database()
}

beforeAll(async () => {
  const rules = fs.readFileSync(path.resolve("database.rules.json"), "utf8")

  testEnv = await initializeTestEnvironment({
    projectId: "demo-words-test",
    database: {
      host: "localhost",
      port: 9000,
      rules,
    },
  })

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref(`admins/${ADMIN_UID}`).set(true)
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

// Import the functions under test — dynamic import after env setup
let addWord: typeof import("./words").addWord
let submitWords: typeof import("./words").submitWords
let getPlayerWords: typeof import("./words").getPlayerWords
let advanceToLobby: typeof import("./words").advanceToLobby

beforeAll(async () => {
  const mod = await import("./words")
  addWord = mod.addWord
  submitWords = mod.submitWords
  getPlayerWords = mod.getPlayerWords
  advanceToLobby = mod.advanceToLobby
})

describe("addWord", () => {
  it("writes a word node with correct text and addedBy fields", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 3, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )

    // Join player
    const playerDb = emulatorDb(PLAYER_1_UID)
    await joinRoom(playerDb as unknown as Database, roomId, PLAYER_1_UID, "Alice", "red", false)

    const wordId = await addWord(playerDb as unknown as Database, roomId, PLAYER_1_UID, "elephant")

    expect(wordId).toBeTypeOf("string")
    expect(wordId.length).toBeGreaterThan(0)

    const snap = await adminDb.ref(`rooms/${roomId}/words/${wordId}`).once("value")
    expect(snap.exists()).toBe(true)
    const word = snap.val() as Word
    expect(word.text).toBe("elephant")
    expect(word.addedBy).toBe(PLAYER_1_UID)
  })

  it("returns a unique wordId for each call", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 3, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )

    const playerDb = emulatorDb(PLAYER_1_UID)
    await joinRoom(playerDb as unknown as Database, roomId, PLAYER_1_UID, "Alice", "red", false)

    const id1 = await addWord(playerDb as unknown as Database, roomId, PLAYER_1_UID, "cat")
    const id2 = await addWord(playerDb as unknown as Database, roomId, PLAYER_1_UID, "dog")

    expect(id1).not.toBe(id2)
  })

  it("rejects empty string with a typed error before writing to RTDB", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 3, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )

    const playerDb = emulatorDb(PLAYER_1_UID)
    await joinRoom(playerDb as unknown as Database, roomId, PLAYER_1_UID, "Alice", "red", false)

    await expect(addWord(playerDb as unknown as Database, roomId, PLAYER_1_UID, "")).rejects.toThrow(
      "Word cannot be empty",
    )
  })

  it("rejects whitespace-only string with a typed error", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 3, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )

    const playerDb = emulatorDb(PLAYER_1_UID)
    await joinRoom(playerDb as unknown as Database, roomId, PLAYER_1_UID, "Alice", "red", false)

    await expect(addWord(playerDb as unknown as Database, roomId, PLAYER_1_UID, "   ")).rejects.toThrow(
      "Word cannot be empty",
    )
  })

  it("rejects text longer than 50 characters with a typed error", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 3, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )

    const playerDb = emulatorDb(PLAYER_1_UID)
    await joinRoom(playerDb as unknown as Database, roomId, PLAYER_1_UID, "Alice", "red", false)

    const longWord = "a".repeat(51)
    await expect(addWord(playerDb as unknown as Database, roomId, PLAYER_1_UID, longWord)).rejects.toThrow(
      "Word must be 50 characters or fewer",
    )
  })

  it("allows duplicate text — creates separate wordId nodes", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 3, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )

    const playerDb = emulatorDb(PLAYER_1_UID)
    await joinRoom(playerDb as unknown as Database, roomId, PLAYER_1_UID, "Alice", "red", false)

    const id1 = await addWord(playerDb as unknown as Database, roomId, PLAYER_1_UID, "duplicate")
    const id2 = await addWord(playerDb as unknown as Database, roomId, PLAYER_1_UID, "duplicate")

    expect(id1).not.toBe(id2)

    const wordsSnap = await adminDb.ref(`rooms/${roomId}/words`).once("value")
    const words = wordsSnap.val() as Record<string, Word>
    expect(Object.keys(words)).toHaveLength(2)
  })
})

describe("submitWords", () => {
  it("sets player.wordsSubmitted to true", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 3, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )

    const playerDb = emulatorDb(PLAYER_1_UID)
    await joinRoom(playerDb as unknown as Database, roomId, PLAYER_1_UID, "Alice", "red", false)

    await submitWords(playerDb as unknown as Database, roomId, PLAYER_1_UID)

    const snap = await adminDb.ref(`rooms/${roomId}/players/${PLAYER_1_UID}/wordsSubmitted`).once("value")
    expect(snap.val()).toBe(true)
  })

  it("is idempotent — calling twice does not throw", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 3, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )

    const playerDb = emulatorDb(PLAYER_1_UID)
    await joinRoom(playerDb as unknown as Database, roomId, PLAYER_1_UID, "Alice", "red", false)

    await submitWords(playerDb as unknown as Database, roomId, PLAYER_1_UID)
    // Second call should not throw
    await expect(submitWords(playerDb as unknown as Database, roomId, PLAYER_1_UID)).resolves.toBeUndefined()
  })

  it("does not overwrite other player fields", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 3, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )

    const playerDb = emulatorDb(PLAYER_1_UID)
    await joinRoom(playerDb as unknown as Database, roomId, PLAYER_1_UID, "Alice", "red", false)

    await submitWords(playerDb as unknown as Database, roomId, PLAYER_1_UID)

    const snap = await adminDb.ref(`rooms/${roomId}/players/${PLAYER_1_UID}`).once("value")
    const player = snap.val() as {
      name: string
      color: string
      teamId: unknown
      ready: boolean
      connected: boolean
    }
    expect(player.name).toBe("Alice")
    expect(player.color).toBe("red")
    expect(player.teamId).toBeUndefined()
    expect(player.ready).toBe(false)
    expect(player.connected).toBe(true)
  })
})

describe("getPlayerWords", () => {
  it("returns all words where addedBy matches playerId", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 3, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )

    const playerDb = emulatorDb(PLAYER_1_UID)
    await joinRoom(playerDb as unknown as Database, roomId, PLAYER_1_UID, "Alice", "red", false)

    const id1 = await addWord(playerDb as unknown as Database, roomId, PLAYER_1_UID, "alpha")
    const id2 = await addWord(playerDb as unknown as Database, roomId, PLAYER_1_UID, "beta")

    const words = await getPlayerWords(playerDb as unknown as Database, roomId, PLAYER_1_UID)

    expect(Object.keys(words)).toHaveLength(2)
    expect(words[id1]!.text).toBe("alpha")
    expect(words[id1]!.addedBy).toBe(PLAYER_1_UID)
    expect(words[id2]!.text).toBe("beta")
  })

  it("returns empty record when player has no words", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 3, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )

    const playerDb = emulatorDb(PLAYER_1_UID)
    await joinRoom(playerDb as unknown as Database, roomId, PLAYER_1_UID, "Alice", "red", false)

    const words = await getPlayerWords(playerDb as unknown as Database, roomId, PLAYER_1_UID)
    expect(words).toEqual({})
  })

  it("does not return other players' words", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 3, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )

    const db1 = emulatorDb(PLAYER_1_UID)
    const db2 = emulatorDb(PLAYER_2_UID)
    await joinRoom(db1 as unknown as Database, roomId, PLAYER_1_UID, "Alice", "red", false)
    await joinRoom(db2 as unknown as Database, roomId, PLAYER_2_UID, "Bob", "blue", false)

    await addWord(db1 as unknown as Database, roomId, PLAYER_1_UID, "alice-word")
    await addWord(db2 as unknown as Database, roomId, PLAYER_2_UID, "bob-word")

    const aliceWords = await getPlayerWords(db1 as unknown as Database, roomId, PLAYER_1_UID)
    expect(Object.keys(aliceWords)).toHaveLength(1)
    const word = Object.values(aliceWords)[0] as Word
    expect(word.addedBy).toBe(PLAYER_1_UID)
  })
})

describe("advanceToLobby", () => {
  it("writes status: 'pre-start' and creates team nodes", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 3, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await advanceToLobby(ctx.database() as unknown as Database, roomId)
    })

    const statusSnap = await adminDb.ref(`rooms/${roomId}/status`).once("value")
    expect(statusSnap.val()).toBe("pre-start")

    // Verify team nodes created
    const team1Snap = await adminDb.ref(`rooms/${roomId}/teams/team-1`).once("value")
    const team2Snap = await adminDb.ref(`rooms/${roomId}/teams/team-2`).once("value")
    expect(team1Snap.exists()).toBe(true)
    expect(team2Snap.exists()).toBe(true)
    expect(team1Snap.val().name).toBe("Team 1")
    expect(team2Snap.val().name).toBe("Team 2")
    expect(team1Snap.val().playerOrder).toBeUndefined()
    expect(team1Snap.val().currentPlayerIndex).toBe(0)
    expect(team1Snap.val().roundScores).toEqual({ round1: 0, round2: 0, round3: 0 })
  })

  it("called by non-admin throws permission-denied", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 3, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )

    const playerDb = emulatorDb(PLAYER_1_UID)
    await expect(advanceToLobby(playerDb as unknown as Database, roomId)).rejects.toThrow(
      /permission_denied/i,
    )
  })
})
