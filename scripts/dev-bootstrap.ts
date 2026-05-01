/**
 * Seeds Auth Emulator with test users and creates /admins entries in RTDB.
 * Uses Firebase Admin SDK pointed at emulators — admin SDK bypasses rules.
 * Run before dev sessions: npm run dev:bootstrap
 *
 * Creates:
 *   - admin@test.com / password123 → /admins/{uid}
 *   - player@test.com / password123 → non-admin player
 */
import { initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getDatabase } from "firebase-admin/database"

// Point Admin SDK at emulators
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099"
process.env.FIREBASE_DATABASE_EMULATOR_HOST = "localhost:9000"

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || "the-word-guessing-game"

initializeApp({
  projectId,
  databaseURL: `http://localhost:9000?ns=${projectId}-default-rtdb`,
})

const auth = getAuth()
const db = getDatabase()

async function findOrCreateUser(email: string, password: string) {
  try {
    let existing = await auth.getUserByEmail(email)
    console.log(`  Found existing user: ${email} (uid: ${existing.uid})`)
    if (!existing) {
      existing = await auth.createUser({
        email,
        password,
      })
    } else {
      // Update password in case it changed
      await auth.updateUser(existing.uid, { password })
    }
    return existing.uid
  } catch (err: unknown) {
    const e = err as { code?: string }
    if (e.code === "auth/user-not-found") {
      const newUser = await auth.createUser({ email, password })
      console.log(`  Created user: ${email} (uid: ${newUser.uid})`)
      return newUser.uid
    }
    throw err
  }
}

async function seed() {
  console.log("Seeding emulators...")

  const adminUid = await findOrCreateUser("admin@test.com", "password123")
  await db.ref(`admins/${adminUid}`).set(true)
  console.log(`✓ Admin set: admin@test.com (uid: ${adminUid})`)

  // DEBUG: verify the write
  const verifySnap = await db.ref(`admins/${adminUid}`).get()
  console.log("[bootstrap] Verify admin write:", verifySnap.exists(), verifySnap.val())
  const allAdminsSnap = await db.ref("admins").get()
  console.log("[bootstrap] All admins:", JSON.stringify(allAdminsSnap.val()))

  const playerUid = await findOrCreateUser("player@test.com", "password123")
  console.log(`✓ Player ready: player@test.com (uid: ${playerUid})`)

  console.log("✓ Bootstrap complete")
  process.exit(0)
}

seed().catch((err) => {
  console.error("Bootstrap failed:", err)
  process.exit(1)
})
