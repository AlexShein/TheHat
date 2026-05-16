import { ref, set, get, push, type DataSnapshot } from "firebase/database"
import type { Database } from "firebase/database"
import type { Word, RoomConfig } from "$lib/db-types"

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
 * Updates the text of an existing word at /rooms/{roomId}/words/{wordId}.
 * Validates text with same rules as addWord. Verifies addedBy matches playerId —
 * throws if word belongs to another player. Reads existing node first to check ownership.
 * No-op if newText equals existing text (still validates, writes idempotently).
 * Throws WordValidationError for empty/whitespace/too-long input.
 */
export async function updateWord(
  db: Database,
  roomId: string,
  wordId: string,
  playerId: string,
  newText: string,
): Promise<void> {
  const cleanText = validateWordText(newText)

  const wordRef = ref(db, `rooms/${roomId}/words/${wordId}`)
  const snap: DataSnapshot = await get(wordRef)

  if (!snap.exists()) {
    throw new Error("Word not found")
  }

  const existing = snap.val() as unknown
  if (typeof existing !== "object" || existing === null) {
    throw new Error("Word data is malformed")
  }

  const word = existing as Record<string, unknown>
  if (typeof word.text === "string" && word.text === cleanText) {
    return // no-op: same text
  }

  // Ownership check — application-level enforcement
  if (word.addedBy !== playerId) {
    throw new Error("Word does not belong to this player")
  }

  await set(wordRef, {
    text: cleanText,
    addedBy: word.addedBy,
  })
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
 * Creates team nodes matching config.numTeams. Admin-only write to
 * /rooms/{roomId}/status and /rooms/{roomId}/teams — security rules
 * enforce both. Non-admin call throws permission-denied.
 */
export async function advanceToLobby(db: Database, roomId: string): Promise<void> {
  const configSnap = await get(ref(db, `rooms/${roomId}/config`))
  const config = configSnap.val() as RoomConfig | null
  if (!config) throw new Error("Room config not found — cannot create teams")

  // Create team nodes in parallel
  const teamPromises: Promise<void>[] = []
  for (let i = 1; i <= config.numTeams; i++) {
    teamPromises.push(
      set(ref(db, `rooms/${roomId}/teams/team-${i}`), {
        name: `Team ${i}`,
        playerOrder: [],
        currentPlayerIndex: 0,
        roundScores: { round1: 0, round2: 0, round3: 0 },
      }),
    )
  }
  await Promise.all(teamPromises)

  // Set status last — observers react to status change, teams must exist first
  await set(ref(db, `rooms/${roomId}/status`), "pre-start")
}
