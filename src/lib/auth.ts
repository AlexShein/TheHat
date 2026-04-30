import {
  type Auth,
  type User,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth"
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
/** Google sign-in via popup with redirect fallback for popup-blocked browsers. */
export async function signInWithGoogle(auth: Auth): Promise<void> {
  const provider = new GoogleAuthProvider()
  try {
    await signInWithPopup(auth, provider)
  } catch (err: unknown) {
    const error = err as { code?: string }
    if (error.code === "auth/popup-blocked" || error.code === "auth/popup-closed-by-user") {
      await signInWithRedirect(auth, provider)
      return
    }
    throw err
  }
}

/** Call on page load to handle redirect result after signInWithRedirect. */
export async function handleRedirectResult(auth: Auth): Promise<void> {
  await getRedirectResult(auth)
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
