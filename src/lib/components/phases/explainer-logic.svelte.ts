import type { Database } from "firebase/database"
import type { GameState, Team } from "$lib/db-types"
import { getWordDisplayedAt } from "$lib/game/word-display"
import { startTurn } from "$lib/game/turn-start"
import { undoLastAction } from "$lib/game/scoring"
import {
  recordGuessed,
  recordSkip,
  completePostExpiryGuessed,
  completePostExpirySkip,
} from "$lib/game/explainer-actions"
import { endTurnEarly } from "$lib/game/turn-expiry"

export interface ExplainerProps {
  db: Database
  roomId: string
  playerId: string
  phase: GameState["phase"]
  round: number
  currentWordId: string | null
  currentWordText: string | null
  currentExplainerId: string
  currentTeamId: string
  lastAction: GameState["lastAction"]
  teams: Record<string, Team>
  skipPenalty: boolean
  hat: string[]
}

export function createExplainerLogic(props: () => ExplainerProps) {
  let wordDisplayedAt = $state<number | null>(null)
  let prevWordId: string | null = null
  let postExpirySelectedTeam = $state<string | null>(null)
  let errorMessage = $state("")
  let cooldownRemaining = $state<number>(0)

  const isExplainer = $derived(props().playerId === props().currentExplainerId)

  // Track wordDisplayedAt when currentWordId changes
  $effect(() => {
    const { currentWordId } = props()
    const displayed = getWordDisplayedAt(currentWordId, prevWordId)
    wordDisplayedAt = displayed
    prevWordId = currentWordId
  })

  // Cooldown ticker
  $effect(() => {
    const { phase } = props()
    if (phase !== "explaining" || wordDisplayedAt === null) {
      cooldownRemaining = 0
      return
    }
    const tick = () => {
      const elapsed = Date.now() - (wordDisplayedAt ?? Date.now())
      cooldownRemaining = Math.max(0, 2000 - elapsed)
    }
    tick()
    const interval = setInterval(tick, 100)
    return () => clearInterval(interval)
  })

  // Reset on phase change
  $effect(() => {
    const { phase } = props()
    if (phase !== "explaining" && phase !== "post_expiry") {
      wordDisplayedAt = null
    } else if (phase === "post_expiry") {
      postExpirySelectedTeam = null
      errorMessage = ""
    }
  })

  const skipDisabled = $derived(props().round === 3 || props().hat.length === 0 || cooldownRemaining > 0)

  const hasLastAction = $derived(props().lastAction != null && props().lastAction?.type !== null)

  async function handleStart() {
    const { db, roomId } = props()
    try {
      errorMessage = ""
      await startTurn(db, roomId)
    } catch (err: unknown) {
      errorMessage = err instanceof Error ? err.message : "Failed to start turn"
    }
  }

  async function handleGuessed() {
    const { db, roomId, phase, currentWordId, currentTeamId, currentExplainerId, round } = props()
    if (phase !== "explaining" && phase !== "post_expiry") return
    try {
      errorMessage = ""
      if (phase === "post_expiry") {
        if (!postExpirySelectedTeam) {
          errorMessage = "Select a team first"
          return
        }
        await completePostExpiryGuessed(db, roomId, postExpirySelectedTeam, currentExplainerId, round)
        return
      }
      if (!currentWordId) return
      const nextWordId = await recordGuessed(
        db,
        roomId,
        currentWordId,
        currentTeamId,
        currentExplainerId,
        round,
      )
      if (nextWordId === null) {
        await endTurnEarly(db, roomId)
      }
    } catch (err: unknown) {
      errorMessage = err instanceof Error ? err.message : "Failed to record guess"
    }
  }

  async function handleSkip() {
    const { db, roomId, phase, currentWordId, currentTeamId, skipPenalty, round } = props()
    if (phase !== "explaining" && phase !== "post_expiry") return
    if (skipDisabled && phase === "explaining") return
    try {
      errorMessage = ""
      if (phase === "post_expiry") {
        if (!currentWordId) return
        await completePostExpirySkip(db, roomId, currentWordId)
        return
      }
      if (!currentWordId) return
      const nextWordId = await recordSkip(db, roomId, currentWordId, currentTeamId, skipPenalty, round)
      if (nextWordId === null) {
        await endTurnEarly(db, roomId)
      }
    } catch (err: unknown) {
      errorMessage = err instanceof Error ? err.message : "Failed to skip"
    }
  }

  async function handleUndo() {
    if (!hasLastAction) return
    try {
      errorMessage = ""
      await undoLastAction(props().db, props().roomId, props().round, props().skipPenalty)
    } catch (err: unknown) {
      errorMessage = err instanceof Error ? err.message : "Failed to undo"
    }
  }

  return {
    get isExplainer() {
      return isExplainer
    },
    get wordDisplayedAt() {
      return wordDisplayedAt
    },
    get cooldownRemaining() {
      return cooldownRemaining
    },
    get skipDisabled() {
      return skipDisabled
    },
    get hasLastAction() {
      return hasLastAction
    },
    get postExpirySelectedTeam() {
      return postExpirySelectedTeam
    },
    set postExpirySelectedTeam(v: string | null) {
      postExpirySelectedTeam = v
    },
    get errorMessage() {
      return errorMessage
    },
    handleStart,
    handleGuessed,
    handleSkip,
    handleUndo,
  }
}
