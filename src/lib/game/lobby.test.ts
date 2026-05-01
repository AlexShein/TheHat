import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing"
import type { Database } from "firebase/database"
import fs from "node:fs"
import path from "node:path"
import { createRoom, joinRoom } from "./room"
import { advanceToLobby } from "./words"
import type { Player } from "$lib/db-types"

let testEnv: RulesTestEnvironment

const ADMIN_UID = "admin-lobby-001"
const P1_UID = "player-lobby-001"

function emulatorDb(uid: string) {
  return testEnv.authenticatedContext(uid).database()
}

beforeAll(async () => {
  const rules = fs.readFileSync(path.resolve("database.rules.json"), "utf8")

  testEnv = await initializeTestEnvironment({
    projectId: "demo-lobby-test",
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

let joinTeam: typeof import("./lobby").joinTeam
let setReady: typeof import("./lobby").setReady
let checkAllReady: typeof import("./lobby").checkAllReady

beforeAll(async () => {
  const mod = await import("./lobby")
  joinTeam = mod.joinTeam
  setReady = mod.setReady
  checkAllReady = mod.checkAllReady
})

describe("joinTeam", () => {
  it("writes player.teamId to the specified team", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 3, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )
    const playerDb = emulatorDb(P1_UID)
    await joinRoom(playerDb as unknown as Database, roomId, P1_UID, "Alice", "red", false)
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await advanceToLobby(ctx.database() as unknown as Database, roomId)
    })

    await joinTeam(playerDb as unknown as Database, roomId, P1_UID, "team-1")

    const snap = await adminDb.ref(`rooms/${roomId}/players/${P1_UID}/teamId`).once("value")
    expect(snap.val()).toBe("team-1")
  })

  it("switching from team A to team B writes new teamId", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 3, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )
    const playerDb = emulatorDb(P1_UID)
    await joinRoom(playerDb as unknown as Database, roomId, P1_UID, "Alice", "red", false)
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await advanceToLobby(ctx.database() as unknown as Database, roomId)
    })

    await joinTeam(playerDb as unknown as Database, roomId, P1_UID, "team-1")
    await joinTeam(playerDb as unknown as Database, roomId, P1_UID, "team-2")

    const snap = await adminDb.ref(`rooms/${roomId}/players/${P1_UID}/teamId`).once("value")
    expect(snap.val()).toBe("team-2")
  })

  it("does not modify other player fields when setting teamId", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 3, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )
    const playerDb = emulatorDb(P1_UID)
    await joinRoom(playerDb as unknown as Database, roomId, P1_UID, "Alice", "red", false)
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await advanceToLobby(ctx.database() as unknown as Database, roomId)
    })

    await joinTeam(playerDb as unknown as Database, roomId, P1_UID, "team-1")

    const snap = await adminDb.ref(`rooms/${roomId}/players/${P1_UID}`).once("value")
    const p = snap.val() as Player
    expect(p.name).toBe("Alice")
    expect(p.color).toBe("red")
    expect(p.wordsSubmitted).toBe(false)
    expect(p.ready).toBe(false)
    expect(p.connected).toBe(true)
    expect(p.isAdmin).toBe(false)
  })

  it("throws TeamNotFoundError when team does not exist", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 3, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )
    const playerDb = emulatorDb(P1_UID)
    await joinRoom(playerDb as unknown as Database, roomId, P1_UID, "Alice", "red", false)
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await advanceToLobby(ctx.database() as unknown as Database, roomId)
    })

    await expect(
      joinTeam(playerDb as unknown as Database, roomId, P1_UID, "team-nonexistent"),
    ).rejects.toThrow("Team not found: team-nonexistent")
  })
})

describe("setReady", () => {
  it("writes player.ready = true", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 3, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )
    const playerDb = emulatorDb(P1_UID)
    await joinRoom(playerDb as unknown as Database, roomId, P1_UID, "Alice", "red", false)
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await advanceToLobby(ctx.database() as unknown as Database, roomId)
    })
    await joinTeam(playerDb as unknown as Database, roomId, P1_UID, "team-1")

    await setReady(playerDb as unknown as Database, roomId, P1_UID, true)

    const snap = await adminDb.ref(`rooms/${roomId}/players/${P1_UID}/ready`).once("value")
    expect(snap.val()).toBe(true)
  })

  it("writes player.ready = false when un-toggling", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 3, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )
    const playerDb = emulatorDb(P1_UID)
    await joinRoom(playerDb as unknown as Database, roomId, P1_UID, "Alice", "red", false)
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await advanceToLobby(ctx.database() as unknown as Database, roomId)
    })
    await joinTeam(playerDb as unknown as Database, roomId, P1_UID, "team-1")
    await setReady(playerDb as unknown as Database, roomId, P1_UID, true)

    await setReady(playerDb as unknown as Database, roomId, P1_UID, false)

    const snap = await adminDb.ref(`rooms/${roomId}/players/${P1_UID}/ready`).once("value")
    expect(snap.val()).toBe(false)
  })

  it("throws ReadyWithoutTeamError when teamId is null", async () => {
    const adminDb = emulatorDb(ADMIN_UID)
    const roomId = await createRoom(
      adminDb as unknown as Database,
      { wordCount: 3, numTeams: 2, skipPenalty: false, timerDuration: 60 },
      ADMIN_UID,
    )
    const playerDb = emulatorDb(P1_UID)
    await joinRoom(playerDb as unknown as Database, roomId, P1_UID, "Alice", "red", false)
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await advanceToLobby(ctx.database() as unknown as Database, roomId)
    })

    await expect(setReady(playerDb as unknown as Database, roomId, P1_UID, true)).rejects.toThrow(
      "Must select a team before marking ready",
    )
  })
})

describe("checkAllReady", () => {
  function makePlayer(overrides: Partial<Player> = {}): Player {
    return {
      name: "Test",
      color: "red",
      teamId: "team-1",
      wordsSubmitted: true,
      ready: true,
      connected: true,
      isAdmin: false,
      ...overrides,
    }
  }

  it("returns {allReady: true} when all submitted + ready, all teams ≥ 2", () => {
    const players: Record<string, Player> = {
      p1: makePlayer({ teamId: "team-1" }),
      p2: makePlayer({ teamId: "team-1" }),
      p3: makePlayer({ teamId: "team-2" }),
      p4: makePlayer({ teamId: "team-2" }),
    }

    const result = checkAllReady(players, 2, false)
    expect(result.allReady).toBe(true)
    expect(result.reason).toBe("")
  })

  it("returns {allReady: false} when any player has wordsSubmitted = false", () => {
    const players: Record<string, Player> = {
      p1: makePlayer({ teamId: "team-1" }),
      p2: makePlayer({ teamId: "team-1" }),
      p3: makePlayer({ teamId: "team-2", wordsSubmitted: false }),
      p4: makePlayer({ teamId: "team-2" }),
    }

    const result = checkAllReady(players, 2, false)
    expect(result.allReady).toBe(false)
    expect(result.reason).toContain("words")
  })

  it("returns {allReady: false} when any player has ready = false", () => {
    const players: Record<string, Player> = {
      p1: makePlayer({ teamId: "team-1" }),
      p2: makePlayer({ teamId: "team-1", ready: false }),
      p3: makePlayer({ teamId: "team-2" }),
      p4: makePlayer({ teamId: "team-2" }),
    }

    const result = checkAllReady(players, 2, false)
    expect(result.allReady).toBe(false)
    expect(result.reason).toContain("ready")
  })

  it("returns {allReady: false} when any team has < 2 players", () => {
    const players: Record<string, Player> = {
      p1: makePlayer({ teamId: "team-1" }),
      p2: makePlayer({ teamId: "team-1" }),
      p3: makePlayer({ teamId: "team-2" }),
    }

    const result = checkAllReady(players, 2, false)
    expect(result.allReady).toBe(false)
    expect(result.reason).toContain("Team")
  })

  it("returns {allReady: true} with bypass=true when single player is ready, team has 1", () => {
    const players: Record<string, Player> = {
      p1: makePlayer({ teamId: "team-1" }),
    }

    const result = checkAllReady(players, 2, true)
    expect(result.allReady).toBe(true)
  })

  it("returns {allReady: true} with bypass when multiple teams have 1 player each", () => {
    const players: Record<string, Player> = {
      p1: makePlayer({ teamId: "team-1" }),
      p2: makePlayer({ teamId: "team-2" }),
    }

    const result = checkAllReady(players, 2, true)
    expect(result.allReady).toBe(true)
  })

  it("returns reason string explaining multiple failures", () => {
    const players: Record<string, Player> = {
      p1: makePlayer({
        teamId: "team-1",
        wordsSubmitted: false,
        ready: false,
      }),
    }

    const result = checkAllReady(players, 2, false)
    expect(result.allReady).toBe(false)
    expect(result.reason).toContain("words")
    expect(result.reason).toContain("ready")
    expect(result.reason).toContain("Team")
  })
})
