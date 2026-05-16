<script lang="ts">
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

  let {
    db,
    roomId,
    playerId,
    phase,
    round,
    currentWordId,
    currentWordText,
    currentExplainerId,
    currentTeamId,
    lastAction,
    teams,
    skipPenalty,
  }: {
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
  } = $props()

  // Only render for explainer
  const isExplainer = $derived(playerId === currentExplainerId)

  // Local state
  let wordDisplayedAt = $state<number | null>(null)
  let prevWordId: string | null = null // plain let — NOT $state. Writing it must not re-trigger $effect
  let postExpirySelectedTeam = $state<string | null>(null)
  let errorMessage = $state("")
  let cooldownRemaining = $state<number>(0)

  // Track wordDisplayedAt when currentWordId changes
  $effect(() => {
    const displayed = getWordDisplayedAt(currentWordId, prevWordId)
    wordDisplayedAt = displayed
    prevWordId = currentWordId
  })

  // Cooldown ticker: updates cooldownRemaining every 100ms while in explaining phase
  $effect(() => {
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

  // Reset wordDisplayedAt when phase leaves explaining/post_expiry
  $effect(() => {
    if (phase !== "explaining" && phase !== "post_expiry") {
      wordDisplayedAt = null
    } else if (phase === "post_expiry") {
      postExpirySelectedTeam = null
      errorMessage = ""
    }
  })

  // Timer expiry sound + vibrate on phase transition to post_expiry/post_turn
  $effect(() => {
    if (phase === "post_expiry" || phase === "post_turn") {
      try {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = "sine"
        osc.frequency.value = 200
        gain.gain.value = 0.3
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.3)
      } catch {
        // Audio not available — silently skip
      }
      try {
        navigator.vibrate(300)
      } catch {
        // Vibration not available — silently skip
      }
    }
  })

  // Derived: Skip disabled when round 3 or within 2s of word appearing
  const skipDisabled = $derived(round === 3 || cooldownRemaining > 0)

  // lastAction from RTDB can be undefined (Firebase strips null).
  // Check truthiness: undefined, null, {type:null} all mean "no action".
  const hasLastAction = $derived(
    lastAction != null && lastAction.type !== null,
  )

  async function handleStart() {
    try {
      errorMessage = ""
      await startTurn(db, roomId)
    } catch (err: unknown) {
      errorMessage = err instanceof Error ? err.message : "Failed to start turn"
    }
  }

  async function handleGuessed() {
    if (phase !== "explaining" && phase !== "post_expiry") return
    try {
      errorMessage = ""

      if (phase === "post_expiry") {
        if (!postExpirySelectedTeam) {
          errorMessage = "Select a team first"
          return
        }
        await completePostExpiryGuessed(
          db,
          roomId,
          postExpirySelectedTeam,
          currentExplainerId,
          round,
        )
        return
      }

      // explaining phase
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
    if (phase !== "explaining" && phase !== "post_expiry") return
    if (skipDisabled && phase === "explaining") return
    try {
      errorMessage = ""

      if (phase === "post_expiry") {
        if (!currentWordId) return
        await completePostExpirySkip(db, roomId, currentWordId)
        return
      }

      // explaining phase
      if (!currentWordId) return
      const nextWordId = await recordSkip(
        db,
        roomId,
        currentWordId,
        currentTeamId,
        skipPenalty,
        round,
      )
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
      await undoLastAction(db, roomId, round, skipPenalty)
    } catch (err: unknown) {
      errorMessage = err instanceof Error ? err.message : "Failed to undo"
    }
  }
</script>

<div class="text-center p-4">
  {#if errorMessage}
    <div class="p-2 mb-3 bg-error-container border border-error rounded text-on-error-container text-body-md" role="alert">
      {errorMessage}
    </div>
  {/if}

  {#if phase === "waiting_start"}
    {#if isExplainer}
      <button
        class="w-full min-h-[44px] px-6 py-3 bg-primary text-on-primary font-display font-semibold rounded text-body-lg"
        aria-label="Start turn"
        onclick={handleStart}
      >
        Start
      </button>
    {:else}
      <p class="text-body-lg text-on-surface-variant">Waiting for explainer to start...</p>
    {/if}

  {:else if phase === "explaining"}
    {#if currentWordText}
      <p class="font-display text-display text-on-surface mb-6">{currentWordText}</p>
    {:else}
      <p class="text-on-surface-variant italic mb-6 text-body-lg">Drawing word...</p>
    {/if}

    <div class="flex flex-col gap-3 w-full max-w-sm mx-auto">
      {#if isExplainer}
        <button
          class="w-full min-h-[48px] px-6 py-3 bg-success text-on-success font-display font-semibold rounded-lg text-body-lg active:scale-98 transition-transform"
          aria-label="Guessed"
          onclick={handleGuessed}
        >
          Guessed
        </button>

        <button
          class="w-full min-h-[48px] px-6 py-3 rounded-lg font-display font-semibold text-body-lg transition-colors"
          class:bg-surface-container={skipDisabled}
          class:text-on-surface-variant={skipDisabled}
          class:cursor-not-allowed={skipDisabled}
          class:bg-on-tertiary-container={!skipDisabled}
          class:text-on-tertiary={!skipDisabled}
          aria-label="Skip"
          aria-disabled={skipDisabled}
          disabled={skipDisabled}
          onclick={handleSkip}
        >
          Skip
        </button>

        {#if hasLastAction}
          <button
            class="w-full min-h-[48px] px-6 py-3 bg-surface-container-high text-on-surface font-display font-semibold rounded-lg text-body-md border border-outline-variant"
            aria-label="Undo"
            onclick={handleUndo}
          >
            Undo
          </button>
        {/if}
      {/if}
    </div>

  {:else if phase === "post_expiry"}
    {#if currentWordText}
      <p class="font-display text-display text-on-surface mb-6">{currentWordText}</p>
    {/if}

    <div class="flex flex-col gap-3 w-full max-w-sm mx-auto">
      {#if isExplainer}
        <!-- Team selector for Guessed -->
        <div class="mb-1">
          <label class="block text-body-md font-medium text-on-surface mb-1 text-left" for="team-select">
            Which team guessed?
          </label>
          <select
            id="team-select"
            class="min-h-[48px] px-3 py-2 border border-outline-variant rounded-lg w-full text-body-md bg-surface-container-lowest"
            bind:value={postExpirySelectedTeam}
            aria-label="Select team that guessed"
          >
            <option value={null}>-- Select team --</option>
            {#each Object.entries(teams) as [tid, team] (tid)}
              <option value={tid}>{team.name}</option>
            {/each}
          </select>
        </div>

        <button
          class="w-full min-h-[48px] px-6 py-3 bg-success text-on-success font-display font-semibold rounded-lg text-body-lg active:scale-98 transition-transform disabled:opacity-50"
          aria-label="Confirm guessed"
          disabled={!postExpirySelectedTeam}
          onclick={handleGuessed}
        >
          Guessed
        </button>

        <button
          class="w-full min-h-[48px] px-6 py-3 bg-on-tertiary-container text-on-tertiary font-display font-semibold rounded-lg text-body-lg"
          aria-label="Skip"
          onclick={handleSkip}
        >
          Skip
        </button>
      {/if}
    </div>

  {:else}
    <!-- Other phases show nothing -->
  {/if}
</div>
