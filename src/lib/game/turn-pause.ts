import { get, ref, set, serverTimestamp } from "firebase/database"
import type { Database } from "firebase/database"

/** Thrown when pauseGame() is called but timer isn't in a pausable state. */
export class PauseNotAvailableError extends Error {
  constructor(public reason: string) {
    super(`Cannot pause: ${reason}`)
    this.name = "PauseNotAvailableError"
  }
}

/** Thrown when resumeGame() is called but game isn't currently paused. */
export class ResumeNotAvailableError extends Error {
  constructor(public reason: string) {
    super(`Cannot resume: ${reason}`)
    this.name = "ResumeNotAvailableError"
  }
}

/**
 * Freezes the timer.
 * Writes pausedAt (serverTimestamp) and computed timeRemainingAtPause.
 * Only admin or room creator may call.
 *
 * Guards:
 * - timerStartedAt must be non-null (timer running)
 * - pausedAt must be null (not already paused)
 * - phase must be 'explaining' or 'post_expiry'
 */
export async function pauseGame(db: Database, roomId: string, callerUid: string): Promise<void> {
  // 1. Permission check
  await checkAdminOrCreator(db, roomId, callerUid)

  // 2. Read current game state
  const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
  const gs = gsSnap.val() as Record<string, unknown> | null
  if (!gs) throw new Error("Game state not found")

  const timerStartedAt = gs["timerStartedAt"] as number | null
  const pausedAt = gs["pausedAt"] as number | null
  const phase = gs["phase"] as string
  const timerDuration = gs["timerDuration"] as number

  // 3. Guard: timer must be started (null or absent)
  if (timerStartedAt == null) {
    throw new PauseNotAvailableError("Timer not started")
  }

  // 4. Guard: not already paused (null or absent)
  if (pausedAt != null) {
    throw new PauseNotAvailableError("Already paused")
  }

  // 5. Guard: phase must be explaining or post_expiry
  if (phase !== "explaining" && phase !== "post_expiry") {
    throw new PauseNotAvailableError(`Phase is "${phase}", not explaining or post_expiry`)
  }

  // 6. Compute remaining time from client clock (may drift ≤200ms from server)
  const elapsed = Date.now() - timerStartedAt
  const timeRemainingAtPause = Math.max(0, timerDuration - elapsed)

  // 7. Write pausedAt (serverTimestamp) + timeRemainingAtPause (plain number)
  await set(ref(db, `rooms/${roomId}/gameState/pausedAt`), serverTimestamp())
  await set(ref(db, `rooms/${roomId}/gameState/timeRemainingAtPause`), timeRemainingAtPause)
}

/**
 * Restores the timer from pause.
 * Computes synthetic timerStartedAt = now - (timerDuration - timeRemainingAtPause)
 * and writes it as a plain number. Clears pausedAt and timeRemainingAtPause.
 * Only admin or room creator may call.
 *
 * Guards:
 * - pausedAt must be non-null (game is paused)
 */
export async function resumeGame(db: Database, roomId: string, callerUid: string): Promise<void> {
  // 1. Permission check
  await checkAdminOrCreator(db, roomId, callerUid)

  // 2. Read current game state
  const gsSnap = await get(ref(db, `rooms/${roomId}/gameState`))
  const gs = gsSnap.val() as Record<string, unknown> | null
  if (!gs) throw new Error("Game state not found")

  const pausedAt = gs["pausedAt"] as number | null
  const timeRemainingAtPause = gs["timeRemainingAtPause"] as number | null
  const timerDuration = gs["timerDuration"] as number

  // 3. Guard: must be paused (null or absent means not paused)
  if (pausedAt == null) {
    throw new ResumeNotAvailableError("Game is not paused")
  }
  if (timeRemainingAtPause == null) {
    throw new ResumeNotAvailableError("timeRemainingAtPause is missing")
  }

  // 4. Compute synthetic timerStartedAt
  // We want: getTimeRemaining(synthetic, duration, null, null) ≈ timeRemainingAtPause
  // elapsed = Date.now() - synthetic
  // remaining = duration - elapsed = duration - (Date.now() - synthetic) = duration - Date.now() + synthetic
  // Set: timeRemainingAtPause = duration - Date.now() + synthetic
  // => synthetic = timeRemainingAtPause - duration + Date.now()
  const syntheticTimerStartedAt = Date.now() - (timerDuration - timeRemainingAtPause)

  // 5. Write synthetic timerStartedAt and clear pause fields
  await set(ref(db, `rooms/${roomId}/gameState/timerStartedAt`), syntheticTimerStartedAt)
  await set(ref(db, `rooms/${roomId}/gameState/pausedAt`), null)
  await set(ref(db, `rooms/${roomId}/gameState/timeRemainingAtPause`), null)
}

/** Verifies callerUid is in /admins/ or is the room creator. */
async function checkAdminOrCreator(db: Database, roomId: string, callerUid: string): Promise<void> {
  const [adminSnap, creatorSnap] = await Promise.all([
    get(ref(db, `admins/${callerUid}`)),
    get(ref(db, `rooms/${roomId}/meta/createdBy`)),
  ])
  const isAdmin = adminSnap.exists()
  const isCreator = creatorSnap.val() === callerUid
  if (!isAdmin && !isCreator) {
    throw new Error("Permission denied: caller is not admin or room creator")
  }
}
