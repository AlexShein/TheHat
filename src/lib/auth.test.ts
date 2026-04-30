import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest"
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app"
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, type Auth } from "firebase/auth"
import { getDatabase, connectDatabaseEmulator, type Database } from "firebase/database"
import { ref, set } from "firebase/database"
import { initAuth, isAdmin, signInDevEmail, signOut } from "./auth"

let app: FirebaseApp
let auth: Auth
let db: Database

const TEST_EMAIL = "admin@test.com"
const TEST_PASSWORD = "password123"
const NON_ADMIN_EMAIL = "player@test.com"
let adminUid: string

beforeAll(async () => {
  app = initializeApp({
    projectId: "demo-auth-test",
    apiKey: "fake-api-key",
  })
  auth = getAuth(app)
  connectAuthEmulator(auth, "http://localhost:9099")
  db = getDatabase(app)
  connectDatabaseEmulator(db, "localhost", 9000)

  // Create test users in Auth Emulator
  const adminCred = await createUserWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD)
  adminUid = adminCred.user.uid
  await signOut(auth)

  await createUserWithEmailAndPassword(auth, NON_ADMIN_EMAIL, TEST_PASSWORD)
  await signOut(auth)

  // Seed /admins
  await set(ref(db, `admins/${adminUid}`), true)
})

afterAll(async () => {
  await deleteApp(app)
})

beforeEach(async () => {
  // Sign out between tests
  if (auth.currentUser) {
    await signOut(auth)
  }
})

describe("auth", () => {
  it("initAuth() returns currentUser=null before sign in", async () => {
    let currentUser: unknown = undefined
    const unsub = initAuth(auth, (user) => {
      currentUser = user
    })

    // onAuthStateChanged fires immediately with current state (null)
    // Wait a tick for async auth state resolution
    await new Promise((r) => setTimeout(r, 100))
    expect(currentUser).toBeNull()
    unsub()
  })

  it("signInDevEmail() creates user in Auth Emulator and returns signed in", async () => {
    await signInDevEmail(auth, TEST_EMAIL, TEST_PASSWORD)
    expect(auth.currentUser).not.toBeNull()
    expect(auth.currentUser?.email).toBe(TEST_EMAIL)
  })

  it("signInDevEmail() throws on bad credentials", async () => {
    await expect(signInDevEmail(auth, "nope@test.com", "wrong")).rejects.toThrow()
  })

  it("isAdmin() returns true when uid exists in /admins", async () => {
    await signInDevEmail(auth, TEST_EMAIL, TEST_PASSWORD)
    const result = await isAdmin(db, auth)
    expect(result).toBe(true)
  })

  it("isAdmin() returns false when uid absent from /admins", async () => {
    await signInDevEmail(auth, NON_ADMIN_EMAIL, TEST_PASSWORD)
    const result = await isAdmin(db, auth)
    expect(result).toBe(false)
  })

  it("isAdmin() returns false when not authenticated", async () => {
    // signed out via beforeEach
    const result = await isAdmin(db, auth)
    expect(result).toBe(false)
  })
})
