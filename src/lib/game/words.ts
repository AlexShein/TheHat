import { ref, set, get, push } from "firebase/database"
import type { Database } from "firebase/database"
import type { Word } from "$lib/db-types"

/** Validation error thrown by addWord for client-side rejections */
export class WordValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "WordValidationError"
  }
}

/** Trims and validates word text. Throws WordValidationError if invalid. */
function validateWordText(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length === 0) {
    throw new WordValidationError("Word cannot be empty")
  }
  if (trimmed.length > 50) {
    throw new WordValidationError("Word must be 50 characters or fewer")
  }
  return trimmed
}

/**
 * Adds one word to /rooms/{roomId}/words/{wordId}.
 * Returns the generated wordId.
 * Throws WordValidationError if text is empty, whitespace-only, or >50 chars.
 */
export async function addWord(db: Database, roomId: string, playerId: string, text: string): Promise<string> {
  const cleanText = validateWordText(text)

  const wordsRef = ref(db, `rooms/${roomId}/words`)
  const newRef = push(wordsRef)
  const wordId = newRef.key as string

  await set(newRef, {
    text: cleanText,
    addedBy: playerId,
  })

  return wordId
}

/**
 * Sets player.wordsSubmitted = true at /rooms/{roomId}/players/{playerId}/wordsSubmitted.
 * Uses set() — idempotent, safe to call multiple times.
 */
export async function submitWords(db: Database, roomId: string, playerId: string): Promise<void> {
  await set(ref(db, `rooms/${roomId}/players/${playerId}/wordsSubmitted`), true)
}

/**
 * Reads all words from /rooms/{roomId}/words where addedBy === playerId.
 * Returns Record<wordId, Word>. Returns empty object if no words found.
 */
export async function getPlayerWords(
  db: Database,
  roomId: string,
  playerId: string,
): Promise<Record<string, Word>> {
  const snap = await get(ref(db, `rooms/${roomId}/words`))

  if (!snap.exists()) return {}

  const raw = snap.val() as unknown
  if (typeof raw !== "object" || raw === null) return {}

  const result: Record<string, Word> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const word = value as Record<string, unknown>
    if (typeof word?.text === "string" && word.addedBy === playerId) {
      result[key] = { text: word.text, addedBy: word.addedBy }
    }
  }
  return result
}

/**
 * Advances room status from 'word-entry' to 'pre-start'.
 * Admin-only. Security rules enforce write permission on /rooms/{roomId}/status.
 * Non-admin call throws permission-denied.
 */
export async function advanceToLobby(db: Database, roomId: string): Promise<void> {
  await set(ref(db, `rooms/${roomId}/status`), "pre-start")
}
