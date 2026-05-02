<script lang="ts">
  import { db } from "$lib/firebase"
  import type { Database } from "firebase/database"
  import type { GameState, Team } from "$lib/db-types"
  import { getWordDisplayedAt } from "$lib/game/word-display"
  import { startTurn } from "$lib/game/turn-start"
  import { drawWord, returnWord } from "$lib/game/hat"
  import { awardPoint, applyPenalty, undoLastAction } from "$lib/game/scoring"
  import { endTurnEarly } from "$lib/game/turn-expiry"

  let {
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

  // Only render for explainer — checked in template via {#if}
  const isExplainer = $derived(playerId === currentExplainerId)

  // Local state
  let wordDisplayedAt = $state<number | null>(null)
  let prevWordId = $state<string | null>(null)
  let postExpirySelectedTeam = $state<string | null>(null)
  let errorMessage = $state("")

  // Track wordDisplayedAt when currentWordId changes
  $effect(() => {
    const displayed = getWordDisplayedAt(currentWordId, prevWordId)
    wordDisplayedAt = displayed
    prevWordId = currentWordId
  })

  // Reset wordDisplayedAt when phase moves away from explaining/post_expiry
  $effect(() => {
    if (phase !== "explaining" && phase !== "post_expiry") {
      wordDisplayedAt = null
    } else if (phase === "post_expiry") {
      postExpirySelectedTeam = null
      errorMessage = ""
    }
  })

  // Timer expiry sound + vibrate on phase transition
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
        // Audio not available — silent
      }
      try {
        navigator.vibrate(300)
      } catch {
        // Vibration not available — silently skip
      }
    }
  })

  // Derived: Skip disabled conditions
  const skipDisabled = $derived(
    round === 3 ||
      (wordDisplayedAt !== null && Date.now() - wordDisplayedAt < 2000),
  )

  async function handleStart() {
    try {
      errorMessage = ""
      await startTurn(db as Database, roomId)
    } catch (err: unknown) {
      errorMessage = err instanceof Error ? err.message : "Failed to start turn"
    }
  }

  async function handleGuessed() {
    if (phase !== "explaining" && phase !== "post_expiry") return
    try {
      errorMessage = ""
      const scoredTeamId = phase === "post_expiry" ? postExpirySelectedTeam : currentTeamId
      if (!scoredTeamId) {
        errorMessage = "Select a team first"
        return
      }

      await awardPoint(db as Database, roomId, scoredTeamId, currentExplainerId, round)

      if (phase === "post_expiry") {
        // AC 10: after post_expiry guessed → post_turn, clear word
        const { update, ref } = await import("firebase/database")
        await update(ref(db, `rooms/${roomId}/gameState`), {
          phase: "post_turn",
          currentWordId: null,
          lastAction: null,
        })
        return
      }

      // explaining phase: draw next word
      const nextWordId = await drawWord(db as Database, roomId)
      if (nextWordId === null) {
        // Hat empty — end turn early
        await endTurnEarly(db as Database, roomId)
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
      if (currentWordId !== null) {
        await returnWord(db as Database, roomId, currentWordId)
      }

      if (phase === "post_expiry") {
        // AC 11: post_expiry skip → post_turn, clear word
        const { update, ref } = await import("firebase/database")
        await update(ref(db, `rooms/${roomId}/gameState`), {
          phase: "post_turn",
          currentWordId: null,
          lastAction: null,
        })
        return
      }

      if (skipPenalty) {
        await applyPenalty(db as Database, roomId, currentTeamId, true, round)
      }

      const nextWordId = await drawWord(db as Database, roomId)
      if (nextWordId === null) {
        await endTurnEarly(db as Database, roomId)
      }
    } catch (err: unknown) {
      errorMessage = err instanceof Error ? err.message : "Failed to skip"
    }
  }

  async function handleUndo() {
    if (lastAction === null || lastAction.type === null) return
    try {
      errorMessage = ""
      await undoLastAction(db as Database, roomId, round, skipPenalty)
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
        class="min-h-11 px-4 py-2 rounded-lg font-semibold"
        class:bg-gray-300={skipDisabled}
        class:text-gray-500={skipDisabled}
        class:bg-orange-500={!skipDisabled}
        class:text-white={!skipDisabled}
        aria-label="Skip"
        aria-disabled={skipDisabled}
        disabled={skipDisabled}
        onclick={handleSkip}
      >
        Skip
      </button>

      {#if lastAction !== null && lastAction.type !== null}
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
    <!-- waiting_start is handled above, other phases show nothing -->
  {/if}
  </div>
{/if}
