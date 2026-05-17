import type { Database } from "firebase/database"
import type { Team, Player, GameState } from "$lib/db-types"
import { getTimeRemaining } from "$lib/game/timer"
import { getWordDisplayedAt } from "$lib/game/word-display"
import { handleTimerExpiry } from "$lib/game/turn-expiry"
import { getTeamColorClasses } from "$lib/team-colors"

export interface GameMainProps {
  db: Database
  roomId: string
  playerId: string
  hat: string[]
  phase: GameState["phase"]
  round: number
  currentExplainerId: string
  currentTeamId: string
  currentWordId: string | null
  currentWordText: string | null
  lastAction: GameState["lastAction"]
  timerStartedAt: number | null
  timerDuration: number
  pausedAt: number | null
  timeRemainingAtPause: number | null
  wordsGuessedThisTurn: number
  teams: Record<string, Team>
  players: Record<string, Player>
  config: { skipPenalty: boolean; timerDuration: number }
}

export function createGameMainLogic(props: () => GameMainProps) {
  let timerExpiryError = $state("")

  const isExplainer = $derived(props().playerId === props().currentExplainerId)
  const explainerName = $derived(props().players[props().currentExplainerId]?.name ?? "Unknown")

  const teamIds = $derived(Object.keys(props().teams).sort())

  const teamColor = $derived.by(() => {
    return getTeamColorClasses(props().currentTeamId).bar
  })

  const nextTeamId = $derived.by(() => {
    const currentPos = teamIds.indexOf(props().currentTeamId)
    if (currentPos === -1) return props().currentTeamId
    const nextPos = (currentPos + 1) % teamIds.length
    return teamIds[nextPos]!
  })

  const nextTeam = $derived(props().teams[nextTeamId])
  const nextExplainerId = $derived.by(() => {
    if (!nextTeam?.playerOrder) return ""
    const idx = nextTeam.currentPlayerIndex ?? 0
    return nextTeam.playerOrder[idx] ?? ""
  })
  const nextExplainerName = $derived.by(() => props().players[nextExplainerId]?.name ?? "Unknown")
  const nextTeamName = $derived.by(() => nextTeam?.name ?? "Unknown")

  // Client-side wordDisplayed tracking for timer expiry
  let wordDisplayed = $state<{ id: string | null; displayedAt: number | null }>({
    id: null,
    displayedAt: null,
  })
  let prevWordId: string | null = null

  $effect(() => {
    const { phase, currentWordId } = props()
    if (phase !== "explaining") return

    const displayedAt = getWordDisplayedAt(currentWordId, prevWordId)
    wordDisplayed = { id: currentWordId, displayedAt }
    prevWordId = currentWordId

    return () => {
      wordDisplayed = { id: null, displayedAt: null }
      prevWordId = null
    }
  })

  // Timer expiry watcher — only explainer writes (single-writer-per-turn invariant)
  $effect(() => {
    if (!isExplainer) return
    const { phase, db, roomId, timerStartedAt, timerDuration, pausedAt, timeRemainingAtPause } = props()
    if (phase !== "explaining") return

    const remaining = getTimeRemaining(timerStartedAt, timerDuration, pausedAt, timeRemainingAtPause)
    if (remaining > 0) {
      let fired = false
      const interval = setInterval(() => {
        if (fired) return
        const r = getTimeRemaining(timerStartedAt, timerDuration, pausedAt, timeRemainingAtPause)
        if (r <= 0) {
          fired = true
          clearInterval(interval)
          handleTimerExpiry(
            db,
            roomId,
            timerStartedAt,
            timerDuration,
            pausedAt,
            timeRemainingAtPause,
            wordDisplayed.id,
            wordDisplayed.displayedAt,
          ).catch((err: unknown) => {
            timerExpiryError = err instanceof Error ? err.message : "Timer expiry failed"
          })
        }
      }, 100)
      return () => clearInterval(interval)
    } else {
      handleTimerExpiry(
        db,
        roomId,
        timerStartedAt,
        timerDuration,
        pausedAt,
        timeRemainingAtPause,
        wordDisplayed.id,
        wordDisplayed.displayedAt,
      ).catch((err: unknown) => {
        timerExpiryError = err instanceof Error ? err.message : "Timer expiry failed"
      })
    }
  })

  return {
    get isExplainer() {
      return isExplainer
    },
    get explainerName() {
      return explainerName
    },
    get teamIds() {
      return teamIds
    },
    get teamColor() {
      return teamColor
    },
    get nextTeamId() {
      return nextTeamId
    },
    get nextTeam() {
      return nextTeam
    },
    get nextExplainerId() {
      return nextExplainerId
    },
    get nextExplainerName() {
      return nextExplainerName
    },
    get nextTeamName() {
      return nextTeamName
    },
    get timerExpiryError() {
      return timerExpiryError
    },
  }
}
