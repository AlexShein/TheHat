import { afterAll, beforeAll } from "vitest"
import { getDatabase, connectDatabaseEmulator, ref, set } from "firebase/database"
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app"
import { getAuth, connectAuthEmulator, signInAnonymously } from "firebase/auth"
import type { PlayerStats } from "$lib/db-types"

const firebaseConfig = {
  projectId: "the-hat-dev",
  apiKey: "fake-api-key",
  databaseURL: "http://127.0.0.1:9000?ns=the-hat-dev",
}

export let app: FirebaseApp

let _counter = 0
/** Unique room ID per test call. Avoids collisions without mutable export. */
export function nextRoomId(prefix: string): string {
  return `${prefix}-${Date.now()}-${_counter++}`
}

beforeAll(async () => {
  app = initializeApp(firebaseConfig)
  const auth = getAuth(app)
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true })
  const cred = await signInAnonymously(auth)

  // Seed admins/{uid} so gameState writes pass security rules
  const db = getDatabase(app)
  connectDatabaseEmulator(db, "127.0.0.1", 9000)
  await set(ref(db, `admins/${cred.user.uid}`), true)
})

afterAll(async () => {
  await deleteApp(app)
})

export function makeDatabase(): ReturnType<typeof getDatabase> {
  const db = getDatabase(app)
  connectDatabaseEmulator(db, "127.0.0.1", 9000)
  return db
}

export async function seedFullGameState(
  db: ReturnType<typeof getDatabase>,
  roomId: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const base = {
    hat: ["w-1", "w-2", "w-3"],
    currentWordId: "w-1",
    round: 2,
    currentTeamId: "team-1",
    currentExplainerId: "player-0",
    timerStartedAt: null,
    timerDuration: 60,
    pausedAt: null,
    timeRemainingAtPause: null,
    phase: "explaining",
    lastAction: null,
    playerStats: {
      "player-0": { wordsExplained: 3 },
      "player-1": { wordsExplained: 0 },
    } as Record<string, PlayerStats>,
    ...overrides,
  }

  // Set teams with round scores explicitly
  await set(ref(db, `rooms/${roomId}/teams/team-1`), {
    name: "Team 1",
    playerOrder: ["player-0", "player-2"],
    currentPlayerIndex: 0,
    roundScores: {
      round1: 5,
      round2: 3,
      round3: 0,
    },
  })

  await set(ref(db, `rooms/${roomId}/gameState`), base)
  await set(ref(db, `rooms/${roomId}/config`), {
    wordCount: 3,
    numTeams: 2,
    skipPenalty: true,
    timerDuration: 60,
  })
}

/** Seeds words nodes so undo can resolve currentWordText. */
export async function seedWords(db: ReturnType<typeof getDatabase>, roomId: string): Promise<void> {
  await set(ref(db, `rooms/${roomId}/words/w-1`), { text: "apple", addedBy: "p1" })
  await set(ref(db, `rooms/${roomId}/words/w-2`), { text: "banana", addedBy: "p1" })
  await set(ref(db, `rooms/${roomId}/words/w-3`), { text: "cherry", addedBy: "p1" })
  await set(ref(db, `rooms/${roomId}/words/w-5`), { text: "guessed-five", addedBy: "p1" })
  await set(ref(db, `rooms/${roomId}/words/w-skipped`), { text: "skipped-word", addedBy: "p1" })
  await set(ref(db, `rooms/${roomId}/words/w-0`), { text: "zero-word", addedBy: "p1" })
  await set(ref(db, `rooms/${roomId}/words/w-no-penalty`), { text: "no-penalty-word", addedBy: "p1" })
  await set(ref(db, `rooms/${roomId}/words/w-x`), { text: "x-word", addedBy: "p1" })
  await set(ref(db, `rooms/${roomId}/words/w-z`), { text: "z-word", addedBy: "p1" })
  await set(ref(db, `rooms/${roomId}/words/w-current`), { text: "current-word", addedBy: "p1" })
  await set(ref(db, `rooms/${roomId}/words/w-c`), { text: "c-word", addedBy: "p1" })
  await set(ref(db, `rooms/${roomId}/words/w-dbl`), { text: "dbl-word", addedBy: "p1" })
  await set(ref(db, `rooms/${roomId}/words/w-b`), { text: "b-word", addedBy: "p1" })
  await set(ref(db, `rooms/${roomId}/words/w-d`), { text: "d-word", addedBy: "p1" })
}
