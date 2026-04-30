#!/usr/bin/env node

/**
 * List all admins in RTDB.
 * Reads /admins/, resolves each UID → email via Firebase Auth.
 *
 * Prerequisites: same as add-admin.ts
 *
 * Usage:
 *   npx tsx scripts/list-admins.ts
 */

import { strict as assert } from "node:assert"
import { initializeApp, cert } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getDatabase } from "firebase-admin/database"

assert.ok(process.env.GOOGLE_APPLICATION_CREDENTIALS, "GOOGLE_APPLICATION_CREDENTIALS env var is required")
assert.ok(process.env.FIREBASE_DATABASE_URL, "FIREBASE_DATABASE_URL env var is required")

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS as string
const app = initializeApp({
  credential: cert(serviceAccountPath),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
})

const auth = getAuth(app)
const db = getDatabase(app)

const snapshot = await db.ref("/admins").get()
const admins = snapshot.val() as Record<string, boolean> | null

if (!admins) {
  console.log("No admins found.")
  process.exit(0)
}

console.log("Admins:\n")

const entries = await Promise.allSettled(
  Object.keys(admins).map(async (uid: string) => {
    try {
      const user = await auth.getUser(uid)
      return { uid, email: user.email }
    } catch {
      return { uid, email: "(user not found in Auth)" }
    }
  }),
)

for (const result of entries) {
  if (result.status === "fulfilled") {
    console.log(`  ${result.value.email}  (UID: ${result.value.uid})`)
  } else {
    console.log(`  (error resolving: ${String(result.reason)})`)
  }
}
