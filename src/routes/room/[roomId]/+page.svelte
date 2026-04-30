<script lang="ts">
  import type { PageProps } from "./$types"
  import NameEntry from "$lib/components/phases/NameEntry.svelte"
  import { createRoomStore } from "$lib/stores/room.svelte"
  import { createPlayersStore } from "$lib/stores/players.svelte"
  import { RoomStatus } from "$lib/db-types"

  let { data }: PageProps = $props()

  const roomStore = (() => createRoomStore(data.roomId))()
  const playersStore = (() => createPlayersStore(data.roomId))()

  let status = $derived(roomStore.status)

  let localPlayerId = $state<string | null>(null)

  $effect(() => {
    localPlayerId = data.playerId

    function checkUrl() {
      const p = new URL(window.location.href).searchParams.get("p")
      if (p && p !== localPlayerId) {
        localPlayerId = p
      }
    }
    checkUrl()
    window.addEventListener("popstate", checkUrl)
    return () => window.removeEventListener("popstate", checkUrl)
  })
</script>

<div class="mx-auto max-w-md px-4 pt-8">
  {#if !status}
    <!-- Loading: RTDB hasn't returned data yet -->
    <div class="flex justify-center mt-12" role="status" aria-label="Loading room">
      <div class="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
    </div>
  {:else if status === RoomStatus.WordEntry}
    {#if localPlayerId && playersStore.players[localPlayerId]}
      <!-- Player already joined, but word-entry phase -->
      <p class="text-center text-gray-600">Word Entry — coming soon</p>
    {:else}
      <NameEntry roomId={data.roomId} />
    {/if}
  {:else if status === RoomStatus.PreStart}
    <p class="text-center text-gray-600">Lobby — coming soon</p>
  {:else if status === RoomStatus.Playing}
    <p class="text-center text-gray-600">Game — coming soon</p>
  {:else if status === RoomStatus.Finished}
    <p class="text-center text-gray-600">Game Over — coming soon</p>
  {:else}
    <p class="text-center text-red-600">Unknown room state: {String(status)}</p>
  {/if}
</div>