<script lang="ts">
  import { onMount } from "svelte"
  import type { PageProps } from "./$types"
  import NameEntry from "$lib/components/phases/NameEntry.svelte"
  import WordEntry from "$lib/components/phases/WordEntry.svelte"
  import Lobby from "$lib/components/phases/Lobby.svelte"
  import { createRoomStore } from "$lib/stores/room.svelte"
  import { createPlayersStore } from "$lib/stores/players.svelte"
  import { RoomStatus } from "$lib/db-types"
  import { auth } from "$lib/firebase"
  import { signInAnonymously } from "$lib/auth"
  import { authStore } from "$lib/stores/auth.svelte"

  let { data }: PageProps = $props()

  const roomStore = (() => createRoomStore(data.roomId))()
  const playersStore = (() => createPlayersStore(data.roomId))()

  let status = $derived(roomStore.status)

  let localPlayerId = $state<string | null>(null)
  let authError = $state("")

  // Ensure user is authenticated for room context. Anonymous sign-in
  // only fires when no user present — admin/Google users skip it.
  onMount(() => {
    if (!authStore.currentUser) {
      signInAnonymously(auth).catch((err: unknown) => {
        authError = err instanceof Error ? err.message : "Authentication failed"
      })
    }
  })

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
  {#if authError}
    <div class="p-3 bg-red-50 border border-red-300 rounded text-red-700 text-sm mb-4" role="alert">
      {authError}
    </div>
  {/if}

  {#if !status}
    <!-- Loading: RTDB hasn't returned data yet -->
    <div class="flex justify-center mt-12" role="status" aria-label="Loading room">
      <div class="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
    </div>
  {:else if status === RoomStatus.WordEntry}
    {#if localPlayerId && playersStore.players[localPlayerId]}
      <!-- Player already joined, but word-entry phase -->
      <WordEntry
        roomId={data.roomId}
        playerId={localPlayerId}
        isAdmin={playersStore.players[localPlayerId]?.isAdmin ?? false}
      />
    {:else}
      <NameEntry
        roomId={data.roomId}
        onjoined={(playerId) => {
          localPlayerId = playerId
        }}
      />
    {/if}
  {:else if status === RoomStatus.PreStart}
    {#if localPlayerId && playersStore.players[localPlayerId] && roomStore.config}
      <Lobby
        roomId={data.roomId}
        playerId={localPlayerId}
        isAdmin={playersStore.players[localPlayerId]?.isAdmin ?? false}
        bypassMinPlayers={import.meta.env.VITE_DEV_BYPASS_MIN_PLAYERS === "true"}
        players={playersStore.players}
        config={{ numTeams: roomStore.config.numTeams }}
        onstart={() => {
          // TODO Phase 2.3: wire to initializeGameState()
        }}
      />
    {:else}
      <p class="text-center text-gray-600">Loading lobby…</p>
    {/if}
  {:else if status === RoomStatus.Playing}
    <p class="text-center text-gray-600">Game — coming soon</p>
  {:else if status === RoomStatus.Finished}
    <p class="text-center text-gray-600">Game Over — coming soon</p>
  {:else}
    <p class="text-center text-red-600">Unknown room state: {String(status)}</p>
  {/if}
</div>