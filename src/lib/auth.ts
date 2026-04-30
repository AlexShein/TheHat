import { type Auth, type User, onAuthStateChanged } from "firebase/auth"
import { signInWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth"
import { type Database, ref, get } from "firebase/database"

export class AdminRequiredError extends Error {
  constructor() {
    super("Only admins can create rooms")
    this.name = "AdminRequiredError"
  }
}

/** Subscribe to auth state changes. Returns unsubscribe function. */
export function initAuth(auth: Auth, callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback)
}

/**
 * Emulator-only email/password sign-in.
 * Throws if not running against emulator or credentials invalid.
 */
export async function signInDevEmail(auth: Auth, email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password)
}

/**
 * Google sign-in via popup (production) or email/password fallback (emulator).
 * In emulator: first creates the user if not exists, then signs in.
 */
export async function signInWithGoogle(): Promise<void> {
  // Phase 1.2 will implement the full Google popup flow
  // For now, this placeholder exists for the interface contract
  throw new Error("signInWithGoogle() not implemented — Phase 1.2")
}

/** Sign out current user. */
export async function signOut(auth: Auth): Promise<void> {
  await firebaseSignOut(auth)
}

/** Checks whether the currently signed-in user is in the /admins whitelist. */
export async function isAdmin(db: Database, auth: Auth): Promise<boolean> {
  const user = auth.currentUser
  if (!user) return false

  const snap = await get(ref(db, `admins/${user.uid}`))
  return snap.exists()
}
