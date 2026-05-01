import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing"
import type { Database } from "firebase/database"
import fs from "node:fs"
import path from "node:path"
import { createRoom } from "./room"
import { joinRoomAsCurrentUser } from "./room"
import type { Player } from "$lib/db-types"

let testEnv: RulesTestEnvironment

const ADMIN_UID = "admin-join-123"
const PLAYER_UID_1 = "player-join-456"
const PLAYER_UID_2 = "player-join-789"

function emulatorDb(uid: string) {
  return testEnv.authenticatedContext(uid).database()
}

beforeAll(async () => {
  const rules = fs.readFileSync(path.resolve("database.rules.json"), "utf8")

  testEnv = await initializeTestEnvironment({
    projectId: "demo-join-test",
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

describe("joinRoomAsCurrentUser", () => {
  it("writes player at /rooms/{roomId}/players/{playerId} with name, unique color, and connected:true", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 5, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )

    const playerDb = emulatorDb(PLAYER_UID_1)
    await joinRoomAsCurrentUser(playerDb as unknown as Database, roomId, PLAYER_UID_1, "Test Player")

    const snap = await playerDb.ref(`rooms/${roomId}/players/${PLAYER_UID_1}`).once("value")
    expect(snap.exists()).toBe(true)
    const player = snap.val() as Player
    expect(player.name).toBe("Test Player")
    expect(player.color).toBeTypeOf("string")
    expect(player.connected).toBe(true)
    expect(player.wordsSubmitted).toBe(false)
    expect(player.ready).toBe(false)
    expect(player.teamId).toBeUndefined()
  })

  it("assigns different colors to two players in same room", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 5, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )

    const db1 = emulatorDb(PLAYER_UID_1)
    const db2 = emulatorDb(PLAYER_UID_2)

    await joinRoomAsCurrentUser(db1 as unknown as Database, roomId, PLAYER_UID_1, "Player One")
    await joinRoomAsCurrentUser(db2 as unknown as Database, roomId, PLAYER_UID_2, "Player Two")

    const snap1 = await db1.ref(`rooms/${roomId}/players/${PLAYER_UID_1}`).once("value")
    const snap2 = await db1.ref(`rooms/${roomId}/players/${PLAYER_UID_2}`).once("value")

    const p1 = snap1.val() as Player
    const p2 = snap2.val() as Player
    expect(p1.color).not.toBe(p2.color)
  })

  it("preserves name and color on reconnect for same playerId", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 5, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )

    const playerDb = emulatorDb(PLAYER_UID_1)
    await joinRoomAsCurrentUser(playerDb as unknown as Database, roomId, PLAYER_UID_1, "Original Name")

    // Reconnect with different display name
    await joinRoomAsCurrentUser(playerDb as unknown as Database, roomId, PLAYER_UID_1, "New Name")

    const snap = await playerDb.ref(`rooms/${roomId}/players/${PLAYER_UID_1}`).once("value")
    const player = snap.val() as Player
    expect(player.name).toBe("Original Name")
    expect(player.color).toBeTypeOf("string")
    expect(player.connected).toBe(true)
  })

  it("throws when all 16 colors are taken", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 5, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )

    // Seed 16 players so all colors consumed (must use actual PLAYER_COLORS values)

    const { PLAYER_COLORS } = await import("$lib/colors")
    for (let i = 0; i < 16; i++) {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx
          .database()
          .ref(`rooms/${roomId}/players/player-full-${i}`)
          .set({
            name: `Player ${i}`,
            color: PLAYER_COLORS[i],
            wordsSubmitted: false,
            ready: false,
            connected: true,
            isAdmin: false,
          })
      })
    }

    const extraDb = testEnv.authenticatedContext("player-full-16").database()
    await expect(
      joinRoomAsCurrentUser(extraDb as unknown as Database, roomId, "player-full-16", "Extra Player"),
    ).rejects.toThrow("Maximum number of players reached")
  })

  it("registers onDisconnect and sets connected:true after call (order verified in registerDisconnect tests)", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 5, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )

    const playerDb = emulatorDb(PLAYER_UID_1)
    await joinRoomAsCurrentUser(playerDb as unknown as Database, roomId, PLAYER_UID_1, "Connected Player")

    // After joinRoomAsCurrentUser, connected must be true
    // (onDisconnect registration order contract is verified by registerDisconnect tests)
    const snap = await adminDb.ref(`rooms/${roomId}/players/${PLAYER_UID_1}/connected`).once("value")
    expect(snap.val()).toBe(true)
  })

  it("writes isAdmin:true for user in /admins whitelist", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 5, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )

    // ADMIN_UID is in /admins (set in beforeAll)
    const playerDb = emulatorDb(ADMIN_UID)
    await joinRoomAsCurrentUser(playerDb as unknown as Database, roomId, ADMIN_UID, "Admin Player")

    const snap = await playerDb.ref(`rooms/${roomId}/players/${ADMIN_UID}`).once("value")
    const player = snap.val() as Player
    expect(player.isAdmin).toBe(true)
  })

  it("writes isAdmin:false for user not in /admins whitelist", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 5, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )

    // PLAYER_UID_1 is NOT in /admins whitelist
    const playerDb = emulatorDb(PLAYER_UID_1)
    await joinRoomAsCurrentUser(playerDb as unknown as Database, roomId, PLAYER_UID_1, "Regular Player")

    const snap = await playerDb.ref(`rooms/${roomId}/players/${PLAYER_UID_1}`).once("value")
    const player = snap.val() as Player
    expect(player.isAdmin).toBe(false)
  })
})
