<script lang="ts">
  import { reassignExplainer } from "$lib/game/turn-reassign"
  import type { Database } from "firebase/database"

  let {
    db,
    roomId,
    callerUid,
    isAdmin,
    explainerName,
    teamPlayerOrder,
    playerNames,
  }: {
    db: Database
    roomId: string
    callerUid: string
    isAdmin: boolean
    explainerName: string
    teamPlayerOrder: string[]
    playerNames: Record<string, string>
  } = $props()

  let selectedPlayerId = $state("")
  let reassignError = $state("")
  let reassignSuccess = $state("")
  let busy = $state(false)

  async function handleReassign() {
    if (!selectedPlayerId) return
    reassignError = ""
    reassignSuccess = ""
    busy = true
    try {
      await reassignExplainer(db, roomId, selectedPlayerId, callerUid)
      reassignSuccess = `Explainer reassigned to ${playerNames[selectedPlayerId] ?? selectedPlayerId}`
    } catch (err: unknown) {
      reassignError = err instanceof Error ? err.message : "Reassign failed"
    } finally {
      busy = false
    }
  }
</script>

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
  role="alertdialog"
  aria-label="Explainer disconnected"
>
  <div class="bg-white rounded-xl shadow-2xl p-6 w-11/12 max-w-sm text-center">
    <p class="text-lg font-semibold text-gray-900 mb-2">
      Explainer disconnected
    </p>
    <p class="text-sm text-gray-600 mb-4">
      {explainerName} has disconnected. Game paused.
    </p>

    {#if reassignError}
      <div class="p-2 mb-3 bg-red-50 border border-red-300 rounded text-red-700 text-sm" role="alert">
        {reassignError}
      </div>
    {/if}
    {#if reassignSuccess}
      <div class="p-2 mb-3 bg-green-50 border border-green-300 rounded text-green-700 text-sm" role="status">
        {reassignSuccess}
      </div>
    {/if}

    {#if isAdmin}
      <!-- AC 7: Admin sees Reassign button with picker -->
      <label for="disconnect-picker" class="block text-sm font-medium text-gray-700 mb-1">
        Reassign to
      </label>
      <select
        id="disconnect-picker"
        class="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-base mb-3 disabled:opacity-50"
        bind:value={selectedPlayerId}
        disabled={busy}
        aria-label="Reassign explainer to"
      >
        <option value="" disabled>Select a player</option>
        {#each teamPlayerOrder as pid (pid)}
          {#if playerNames[pid]}
            <option value={pid}>{playerNames[pid]}</option>
          {/if}
        {/each}
      </select>
      <button
        class="w-full min-h-[44px] px-4 py-2 bg-blue-600 text-white font-medium rounded-lg disabled:opacity-50"
        disabled={busy || !selectedPlayerId}
        onclick={handleReassign}
        aria-label="Reassign explainer"
      >
        {busy ? "Reassigning…" : "Reassign Explainer"}
      </button>
    {:else}
      <!-- AC 7: Non-admin sees waiting message -->
      <p class="text-sm text-gray-500 italic">Waiting for admin to reassign…</p>
    {/if}
  </div>
</div>