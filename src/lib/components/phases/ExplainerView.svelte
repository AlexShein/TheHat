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

{#if isExplainer}
  <div class="text-center p-4">
  {#if errorMessage}
    <div class="p-2 mb-3 bg-red-50 border border-red-300 rounded text-red-700 text-sm" role="alert">
      {errorMessage}
    </div>
  {/if}

  {#if phase === "waiting_start"}
    <button
      class="w-full min-h-11 px-6 py-3 bg-green-600 text-white font-semibold rounded-lg"
      aria-label="Start turn"
      onclick={handleStart}
    >
      Start
    </button>

  {:else if phase === "explaining"}
    {#if currentWordText}
      <p class="text-2xl font-bold text-blue-900 mb-4">{currentWordText}</p>
    {:else}
      <p class="text-gray-400 italic mb-4">Drawing word...</p>
    {/if}

    <div class="flex gap-2 justify-center flex-wrap">
      <button
        class="min-h-11 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg"
        aria-label="Guessed"
        onclick={handleGuessed}
      >
        Guessed
      </button>

      <button
        class="min-h-11 px-4 py-2 rounded-lg font-semibold inline-flex items-center gap-2"
        class:bg-gray-300={skipDisabled}
        class:text-gray-500={skipDisabled}
        class:cursor-not-allowed={skipDisabled}
        class:bg-orange-500={!skipDisabled}
        class:text-white={!skipDisabled}
        aria-label="Skip"
        aria-disabled={skipDisabled}
        disabled={skipDisabled}
        onclick={handleSkip}
      >
        {#if skipDisabled}
          <svg class="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
        {/if}
        Skip
      </button>

      {#if hasLastAction}
        <button
          class="min-h-11 px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg"
          aria-label="Undo"
          onclick={handleUndo}
        >
          Undo
        </button>
      {/if}
    </div>

  {:else if phase === "post_expiry"}
    {#if currentWordText}
      <p class="text-2xl font-bold text-orange-900 mb-4">{currentWordText}</p>
    {/if}

    <!-- Team selector for Guessed -->
    <div class="mb-3">
      <label class="block text-sm font-medium text-gray-700 mb-1" for="team-select">
        Which team guessed?
      </label>
      <select
        id="team-select"
        class="min-h-11 px-3 py-2 border border-gray-300 rounded-lg w-full max-w-xs"
        bind:value={postExpirySelectedTeam}
        aria-label="Select team that guessed"
      >
        <option value={null}>-- Select team --</option>
        {#each Object.entries(teams) as [tid, team] (tid)}
          <option value={tid}>{team.name}</option>
        {/each}
      </select>
    </div>

    <div class="flex gap-2 justify-center flex-wrap">
      <button
        class="min-h-11 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg"
        class:opacity-50={!postExpirySelectedTeam}
        aria-label="Confirm guessed"
        disabled={!postExpirySelectedTeam}
        onclick={handleGuessed}
      >
        Guessed
      </button>

      <button
        class="min-h-11 px-4 py-2 bg-orange-500 text-white font-semibold rounded-lg"
        aria-label="Skip"
        onclick={handleSkip}
      >
        Skip
      </button>
    </div>

  {:else}
    <!-- Other phases show nothing -->
  {/if}
  </div>
{/if}