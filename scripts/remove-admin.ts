#!/usr/bin/env node

/**
 * Remove an admin from RTDB by email.
 * Resolves email → UID via Firebase Auth, deletes /admins/{uid}.
 *
 * Prerequisites: same as add-admin.ts
 *
 * Usage:
 *   npx tsx scripts/remove-admin.ts friend@gmail.com
 */

import { strict as assert } from "node:assert"
import { initializeApp, cert } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getDatabase } from "firebase-admin/database"

const email = process.argv[2]
if (!email) {
  console.error("Usage: npx tsx scripts/remove-admin.ts <email>")
  process.exit(1)
}

assert.ok(process.env.GOOGLE_APPLICATION_CREDENTIALS, "GOOGLE_APPLICATION_CREDENTIALS env var is required")
assert.ok(process.env.FIREBASE_DATABASE_URL, "FIREBASE_DATABASE_URL env var is required")

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS as string
const app = initializeApp({
  credential: cert(serviceAccountPath),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
})

const auth = getAuth(app)
const db = getDatabase(app)

try {
  const user = await auth.getUserByEmail(email)
  await db.ref(`/admins/${user.uid}`).set(null)
  console.log(`✅ Admin removed: ${email} (UID: ${user.uid})`)
} catch (err) {
  if (err instanceof Error && "code" in err && err.code === "auth/user-not-found") {
    console.error(`❌ No Firebase Auth user found for email: ${email}`)
  } else {
    console.error("❌ Failed to remove admin:", err instanceof Error ? err.message : String(err))
  }
  process.exit(1)
}
