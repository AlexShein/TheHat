<script lang="ts">
  import type { Database } from "firebase/database"
  import type { GameState } from "$lib/db-types"
  import { pauseGame } from "$lib/game/turn-pause"
  import { resumeGame } from "$lib/game/turn-pause"
  import { reassignExplainer } from "$lib/game/turn-reassign"

  let {
    db,
    roomId,
    callerUid,
    phase,
    pausedAt,
    currentExplainerId,
    teamPlayerOrder,
    playerNames,
  }: {
    db: Database
    roomId: string
    callerUid: string
    phase: GameState["phase"]
    pausedAt: number | null
    currentExplainerId: string
    teamPlayerOrder: string[]
    playerNames: Record<string, string>
  } = $props()

  const isPaused = $derived(pausedAt !== null)
  const canPause = $derived(!isPaused && (phase === "explaining" || phase === "post_expiry"))

  let selectedExplainerId = $state(currentExplainerId)
  let actionError = $state("")
  let actionSuccess = $state("")
  let busy = $state(false)

  async function handlePause() {
    actionError = ""
    actionSuccess = ""
    busy = true
    try {
      await pauseGame(db, roomId, callerUid)
      actionSuccess = "Game paused"
    } catch (err: unknown) {
      actionError = err instanceof Error ? err.message : "Failed to pause"
    } finally {
      busy = false
    }
  }

  async function handleResume() {
    actionError = ""
    actionSuccess = ""
    busy = true
    try {
      await resumeGame(db, roomId, callerUid)
      actionSuccess = "Game resumed"
    } catch (err: unknown) {
      actionError = err instanceof Error ? err.message : "Failed to resume"
    } finally {
      busy = false
    }
  }

  async function handleReassign() {
    if (selectedExplainerId === currentExplainerId) return
    actionError = ""
    actionSuccess = ""
    busy = true
    try {
      await reassignExplainer(db, roomId, selectedExplainerId, callerUid)
      actionSuccess = `Explainer changed to ${playerNames[selectedExplainerId] ?? selectedExplainerId}`
    } catch (err: unknown) {
      actionError = err instanceof Error ? err.message : "Failed to reassign"
      selectedExplainerId = currentExplainerId
    } finally {
      busy = false
    }
  }
</script>

<div class="border-t border-gray-200 pt-4 mt-4">
  <h2 class="text-sm font-semibold text-gray-600 mb-2" aria-label="Admin controls">Admin Controls</h2>

  {#if actionError}
    <div class="p-2 mb-2 bg-red-50 border border-red-300 rounded text-red-700 text-sm" role="alert">
      {actionError}
    </div>
  {/if}
  {#if actionSuccess}
    <div class="p-2 mb-2 bg-green-50 border border-green-300 rounded text-green-700 text-sm" role="status">
      {actionSuccess}
    </div>
  {/if}

  <!-- AC 1 & 2: Pause/Resume toggle -->
  <div class="mb-3">
    {#if canPause}
      <button
        class="w-full min-h-[44px] px-4 py-2 bg-amber-500 text-white font-medium rounded-lg disabled:opacity-50"
        disabled={busy}
        onclick={handlePause}
        aria-label="Pause game"
      >
        {busy ? "Pausing…" : "Pause Game"}
      </button>
    {:else if isPaused}
      <button
        class="w-full min-h-[44px] px-4 py-2 bg-green-600 text-white font-medium rounded-lg disabled:opacity-50"
        disabled={busy}
        onclick={handleResume}
        aria-label="Resume game"
      >
        {busy ? "Resuming…" : "Resume Game"}
      </button>
    {/if}
  </div>

  <!-- AC 3 & 4: Change Explainer picker -->
  <div>
    <label for="explainer-picker" class="block text-sm font-medium text-gray-700 mb-1">
      Change Explainer
    </label>
    <select
      id="explainer-picker"
      class="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-base disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={!isPaused || busy}
      bind:value={selectedExplainerId}
      aria-label="Change explainer"
    >
      {#each teamPlayerOrder as pid (pid)}
        <option value={pid}>
          {playerNames[pid] ?? pid}{pid === currentExplainerId ? " (current)" : ""}
        </option>
      {/each}
    </select>
    {#if isPaused}
      <button
        class="mt-2 w-full min-h-[44px] px-4 py-2 bg-blue-600 text-white font-medium rounded-lg disabled:opacity-50"
        disabled={busy || selectedExplainerId === currentExplainerId}
        onclick={handleReassign}
        aria-label="Reassign explainer"
      >
        {busy ? "Reassigning…" : "Reassign Explainer"}
      </button>
    {/if}
  </div>
</div>