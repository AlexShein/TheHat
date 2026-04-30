import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing"
import fs from "node:fs"
import path from "node:path"

let testEnv: RulesTestEnvironment

const ADMIN_UID = "admin-123"

beforeAll(async () => {
  const rules = fs.readFileSync(path.resolve("database.rules.json"), "utf8")

  testEnv = await initializeTestEnvironment({
    projectId: "demo-thehat-test",
    database: {
      host: "localhost",
      port: 9000,
      rules,
    },
  })

  // Seed admin whitelist bypassing rules
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref(`admins/${ADMIN_UID}`).set(true)
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

describe("security rules", () => {
  it("admin uid can write to /rooms/{roomId}", async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID).database()
    await expect(
      db.ref("rooms/testRoom/meta").set({ createdBy: ADMIN_UID, createdAt: 1, lastActiveAt: 1 }),
    ).resolves.toBeUndefined()
  })

  it("anonymous uid cannot write to /rooms/{roomId} — permission-denied", async () => {
    const db = testEnv.unauthenticatedContext().database()
    await expect(
      db.ref("rooms/testRoom/meta").set({ createdBy: "anon", createdAt: 1, lastActiveAt: 1 }),
    ).rejects.toThrow("PERMISSION_DENIED")
  })

  it("any client cannot write to /admins — permission-denied", async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID).database()
    await expect(db.ref("admins/new-uid").set(true)).rejects.toThrow("PERMISSION_DENIED")
  })

  it("unauthenticated client can read a room by ID", async () => {
    const adminDb = testEnv.authenticatedContext(ADMIN_UID).database()
    await adminDb.ref("rooms/testRoomRead/meta").set({ createdBy: ADMIN_UID, createdAt: 1, lastActiveAt: 1 })

    const anonDb = testEnv.unauthenticatedContext().database()
    const snapshot = await anonDb.ref("rooms/testRoomRead/meta").once("value")
    expect(snapshot.val()).toEqual({ createdBy: ADMIN_UID, createdAt: 1, lastActiveAt: 1 })
  })

  it("unauthenticated client cannot read /admins — permission-denied", async () => {
    const anonDb = testEnv.unauthenticatedContext().database()
    await expect(anonDb.ref("admins/admin-123").once("value")).rejects.toThrow(/permission_denied/)
  })
})
