#!/usr/bin/env node

/**
 * Add an admin to RTDB by email.
 * Resolves email → UID via Firebase Auth, writes /admins/{uid}: true.
 *
 * Prerequisites:
 *   1. Set GOOGLE_APPLICATION_CREDENTIALS to path of service account JSON file
 *      (download from Firebase Console → Project Settings → Service Accounts)
 *   2. Set FIREBASE_DATABASE_URL to your RTDB URL
 *      (e.g. https://the-word-guessing-game-default-rtdb.europe-west1.firebasedatabase.app)
 *
 * Usage:
 *   npx tsx scripts/add-admin.ts friend@gmail.com
 */

import { strict as assert } from "node:assert"
import { initializeApp, cert } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getDatabase } from "firebase-admin/database"

const email = process.argv[2]
if (!email) {
  console.error("Usage: npx tsx scripts/add-admin.ts <email>")
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
  await db.ref(`/admins/${user.uid}`).set(true)
  console.log(`✅ Admin added: ${email} (UID: ${user.uid})`)
} catch (err) {
  if (err instanceof Error && "code" in err && err.code === "auth/user-not-found") {
    console.error(`❌ No Firebase Auth user found for email: ${email}`)
    console.error("   The user must sign in via Google at least once before they can be made admin.")
  } else {
    console.error("❌ Failed to add admin:", err instanceof Error ? err.message : String(err))
  }
  process.exit(1)
}
