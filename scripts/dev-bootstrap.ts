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

initializeApp({
  projectId: "demo-bootstrap",
  databaseURL: "http://localhost:9000?ns=demo-bootstrap-default-rtdb",
})

const auth = getAuth()
const db = getDatabase()

async function seed() {
  console.log("Seeding emulators...")

  // Create admin user
  const adminUser = await auth.createUser({
    email: "admin@test.com",
    password: "password123",
  })
  await db.ref(`admins/${adminUser.uid}`).set(true)
  console.log(`✓ Admin created: admin@test.com (uid: ${adminUser.uid})`)

  // Create player user
  const playerUser = await auth.createUser({
    email: "player@test.com",
    password: "password123",
  })
  console.log(`✓ Player created: player@test.com (uid: ${playerUser.uid})`)

  console.log("✓ Bootstrap complete")
}

seed().catch((err) => {
  console.error("Bootstrap failed:", err)
  process.exit(1)
})
