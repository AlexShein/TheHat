<script lang="ts">
  import type { Database } from "firebase/database"
  import type { GameState, Team } from "$lib/db-types"
  import { playExpiryFeedback } from "./explainer-audio.svelte"
  import { createExplainerLogic } from "./explainer-logic.svelte"

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
    hat,
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
    hat: string[]
  } = $props()

  const logic = createExplainerLogic(() => ({
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
    hat,
  }))

  $effect(() => {
    playExpiryFeedback(phase)
  })
</script>

<div class="text-center p-4">
  {#if logic.errorMessage}
    <div class="p-2 mb-3 bg-error-container border border-error rounded text-on-error-container text-body-md" role="alert">
      {logic.errorMessage}
    </div>
  {/if}

  {#if phase === "waiting_start"}
    {#if logic.isExplainer}
      <button
        class="w-full min-h-[44px] px-6 py-3 bg-primary text-on-primary font-display font-semibold rounded text-body-lg"
        aria-label="Start turn"
        onclick={logic.handleStart}
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
      {#if logic.isExplainer}
        <button
          class="w-full min-h-[48px] px-6 py-3 bg-success text-on-success font-display font-semibold rounded-lg text-body-lg active:scale-98 transition-transform"
          aria-label="Guessed"
          onclick={logic.handleGuessed}
        >
          Guessed
        </button>

        <button
          class="w-full min-h-[48px] px-6 py-3 rounded-lg font-display font-semibold text-body-lg transition-colors"
          class:bg-surface-container={logic.skipDisabled}
          class:text-on-surface-variant={logic.skipDisabled}
          class:cursor-not-allowed={logic.skipDisabled}
          class:bg-on-tertiary-container={!logic.skipDisabled}
          class:text-on-tertiary={!logic.skipDisabled}
          aria-label="Skip"
          aria-disabled={logic.skipDisabled}
          disabled={logic.skipDisabled}
          onclick={logic.handleSkip}
        >
          Skip
        </button>

        {#if logic.hasLastAction}
          <button
            class="w-full min-h-[48px] px-6 py-3 bg-surface-container-high text-on-surface font-display font-semibold rounded-lg text-body-md border border-outline-variant"
            aria-label="Undo"
            onclick={logic.handleUndo}
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
      {#if logic.isExplainer}
        <!-- Team selector for Guessed -->
        <div class="mb-1">
          <label class="block text-body-md font-medium text-on-surface mb-1 text-left" for="team-select">
            Which team guessed?
          </label>
          <select
            id="team-select"
            class="min-h-[48px] px-3 py-2 border border-outline-variant rounded-lg w-full text-body-md bg-surface-container-lowest"
            bind:value={logic.postExpirySelectedTeam}
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
          disabled={!logic.postExpirySelectedTeam}
          onclick={logic.handleGuessed}
        >
          Guessed
        </button>

        <button
          class="w-full min-h-[48px] px-6 py-3 bg-on-tertiary-container text-on-tertiary font-display font-semibold rounded-lg text-body-lg"
          aria-label="Skip"
          onclick={logic.handleSkip}
        >
          Skip
        </button>
      {/if}
    </div>

  {:else}
    <!-- Other phases show nothing -->
  {/if}
</div>