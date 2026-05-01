import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest"
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app"
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  type Auth,
} from "firebase/auth"
import { getDatabase, connectDatabaseEmulator, type Database } from "firebase/database"
import { ref, set } from "firebase/database"
import { initAuth, isAdmin, signInAnonymously, signInDevEmail, signOut } from "./auth"

let app: FirebaseApp
let auth: Auth
let db: Database

const TEST_EMAIL = "admin@test.com"
const TEST_PASSWORD = "password123"
const NON_ADMIN_EMAIL = "player@test.com"
let adminUid: string

/** Ensure a test user exists in the auth emulator. Idempotent — safe to call in parallel suites. */
async function ensureEmailUser(email: string, password: string): Promise<string> {
  try {
    // Try sign-in first (emulator may already have this user from another suite)
    const cred = await signInWithEmailAndPassword(auth, email, password)
    return cred.user.uid
  } catch (err: unknown) {
    const code = (err as { code?: string }).code
    if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      return cred.user.uid
    }
    throw err
  }
}

beforeAll(async () => {
  app = initializeApp({
    projectId: "demo-auth-test",
    apiKey: "fake-api-key",
  })
  auth = getAuth(app)
  connectAuthEmulator(auth, "http://localhost:9099")
  db = getDatabase(app)
  connectDatabaseEmulator(db, "localhost", 9000)

  // Create or retrieve test users in Auth Emulator (idempotent for parallel suites)
  adminUid = await ensureEmailUser(TEST_EMAIL, TEST_PASSWORD)
  await signOut(auth)

  await ensureEmailUser(NON_ADMIN_EMAIL, TEST_PASSWORD)
  await signOut(auth)

  // Seed /admins (idempotent — set overwrites)
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

describe("signInAnonymously", () => {
  it("creates anonymous user with valid UID when signed out", async () => {
    expect(auth.currentUser).toBeNull()

    await signInAnonymously(auth)

    expect(auth.currentUser).not.toBeNull()
    expect(auth.currentUser!.isAnonymous).toBe(true)
    expect(auth.currentUser!.uid).toBeTypeOf("string")
    expect(auth.currentUser!.uid.length).toBeGreaterThan(0)
  })

  it("resolves immediately when already signed in anonymously", async () => {
    await signInAnonymously(auth)
    const uid = auth.currentUser!.uid

    // Second call should not throw or change user
    await signInAnonymously(auth)

    expect(auth.currentUser!.uid).toBe(uid)
    expect(auth.currentUser!.isAnonymous).toBe(true)
  })
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
