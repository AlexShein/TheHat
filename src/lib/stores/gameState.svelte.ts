import { onValue, ref } from "firebase/database"
import { db } from "$lib/firebase"
import type { GameState } from "$lib/db-types"

/**
 * Reactive subscription to `/rooms/{roomId}/gameState`.
 * Returns the full game state as a read-only `$state` snapshot.
 * Call `destroy()` to unsubscribe (e.g., in `$effect` cleanup).
 */
export function createGameStateStore(roomId: string) {
  const gameStateRef = ref(db, `rooms/${roomId}/gameState`)

  let round = $state<number>(1)
  let phase = $state<GameState["phase"]>("waiting_start")
  let currentTeamId = $state<string>("")
  let currentExplainerId = $state<string>("")
  let timerStartedAt = $state<number | null>(null)
  let timerDuration = $state<number>(60_000)
  let hat = $state<string[]>([])
  let currentWordId = $state<string | null>(null)
  let currentWordText = $state<string | null>(null)
  let wordsGuessedThisTurn = $state<number>(0)
  let lastAction = $state<GameState["lastAction"]>(null)
  let playerStats = $state<GameState["playerStats"]>({})
  let pausedAt = $state<number | null>(null)
  let timeRemainingAtPause = $state<number | null>(null)

  const unsubscribe = onValue(gameStateRef, (snap) => {
    const gs: GameState | null = snap.exists() ? snap.val() : null
    if (!gs) return

    round = gs.round
    phase = gs.phase
    currentTeamId = gs.currentTeamId
    currentExplainerId = gs.currentExplainerId
    timerStartedAt = gs.timerStartedAt
    timerDuration = gs.timerDuration
    hat = gs.hat
    currentWordId = gs.currentWordId
    currentWordText = gs.currentWordText ?? null
    wordsGuessedThisTurn = gs.wordsGuessedThisTurn ?? 0
    lastAction = gs.lastAction
    playerStats = gs.playerStats
    pausedAt = gs.pausedAt
    timeRemainingAtPause = gs.timeRemainingAtPause
  })

  return {
    get round() {
      return round
    },
    get phase() {
      return phase
    },
    get currentTeamId() {
      return currentTeamId
    },
    get currentExplainerId() {
      return currentExplainerId
    },
    get timerStartedAt() {
      return timerStartedAt
    },
    get timerDuration() {
      return timerDuration
    },
    get hat() {
      return hat
    },
    get currentWordId() {
      return currentWordId
    },
    get currentWordText() {
      return currentWordText
    },
    get wordsGuessedThisTurn() {
      return wordsGuessedThisTurn
    },
    get lastAction() {
      return lastAction
    },
    get playerStats() {
      return playerStats
    },
    get pausedAt() {
      return pausedAt
    },
    get timeRemainingAtPause() {
      return timeRemainingAtPause
    },
    destroy() {
      unsubscribe()
    },
  }
}
