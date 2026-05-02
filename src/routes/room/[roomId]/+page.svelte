<script lang="ts">
  import { onMount } from "svelte"
  import type { PageProps } from "./$types"
  import NameEntry from "$lib/components/phases/NameEntry.svelte"
  import WordEntry from "$lib/components/phases/WordEntry.svelte"
  import Lobby from "$lib/components/phases/Lobby.svelte"
  import GameMain from "$lib/components/phases/GameMain.svelte"
  import { createRoomStore } from "$lib/stores/room.svelte"
  import { createPlayersStore } from "$lib/stores/players.svelte"
  import { createGameStateStore } from "$lib/stores/gameState.svelte"
  import { createTeamsStore } from "$lib/stores/teams.svelte"
  import { getRoomRoute } from "$lib/game/room-route"
  import { auth, db } from "$lib/firebase"
  import { signInAnonymously } from "$lib/auth"
  import { authStore } from "$lib/stores/auth.svelte"
  import { initializeGameState } from "$lib/game/turn"

  let { data }: PageProps = $props()

  const roomStore = (() => createRoomStore(data.roomId))()
  const playersStore = (() => createPlayersStore(data.roomId))()

  let localPlayerId = $state<string | null>(null)
  let authError = $state("")

  let gameStateStore = $state<ReturnType<typeof createGameStateStore> | null>(null)
  let teamsStore = $state<ReturnType<typeof createTeamsStore> | null>(null)

  // Lazily create/destroy playing-phase stores when status transitions
  $effect(() => {
    if (roomStore.status === "playing") {
      gameStateStore = createGameStateStore(data.roomId)
      teamsStore = createTeamsStore(data.roomId)
    } else {
      gameStateStore?.destroy()
      gameStateStore = null
      teamsStore?.destroy()
      teamsStore = null
    }
  })

  let screen = $derived(
    getRoomRoute(
      roomStore.status,
      localPlayerId !== null && playersStore.players[localPlayerId] !== undefined,
      roomStore.config !== null,
    ),
  )

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

  {#if screen.kind === "loading"}
    <div class="flex justify-center mt-12" role="status" aria-label="Loading room">
      <div class="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
    </div>
  {:else if screen.kind === "name-entry"}
    <NameEntry
      roomId={data.roomId}
      onjoined={(playerId) => {
        localPlayerId = playerId
      }}
    />
  {:else if screen.kind === "word-entry"}
    <WordEntry
      roomId={data.roomId}
      playerId={localPlayerId!}
      isAdmin={playersStore.players[localPlayerId!]?.isAdmin ?? false}
    />
  {:else if screen.kind === "lobby"}
    <Lobby
      roomId={data.roomId}
      playerId={localPlayerId!}
      isAdmin={playersStore.players[localPlayerId!]?.isAdmin ?? false}
      bypassMinPlayers={import.meta.env.VITE_DEV_BYPASS_MIN_PLAYERS === "true"}
      players={playersStore.players}
      config={{ numTeams: roomStore.config!.numTeams }}
      onstart={async () => {
        const uid = authStore.currentUser?.uid
        if (!uid) throw new Error("Not authenticated")
        await initializeGameState(
          db,
          data.roomId,
          uid,
          import.meta.env.VITE_DEV_BYPASS_MIN_PLAYERS === "true",
        )
      }}
    />
  {:else if screen.kind === "playing"}
    {#if gameStateStore && teamsStore && localPlayerId}
      <GameMain
        {db}
        roomId={data.roomId}
        playerId={localPlayerId}
        hat={gameStateStore.hat}
        phase={gameStateStore.phase}
        round={gameStateStore.round}
        currentExplainerId={gameStateStore.currentExplainerId}
        currentTeamId={gameStateStore.currentTeamId}
        currentWordId={gameStateStore.currentWordId}
        currentWordText={gameStateStore.currentWordText}
        lastAction={gameStateStore.lastAction}
        timerStartedAt={gameStateStore.timerStartedAt}
        timerDuration={gameStateStore.timerDuration}
        pausedAt={gameStateStore.pausedAt}
        timeRemainingAtPause={gameStateStore.timeRemainingAtPause}
        wordsGuessedThisTurn={gameStateStore.wordsGuessedThisTurn}
        teams={teamsStore.teams}
        players={playersStore.players}
        config={{ skipPenalty: roomStore.config?.skipPenalty ?? false, timerDuration: gameStateStore.timerDuration }}
      />
    {:else}
      <div class="flex justify-center mt-12" role="status" aria-label="Loading game">
        <div class="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    {/if}
  {:else if screen.kind === "finished"}
    <p class="text-center text-gray-600">Game Over — coming soon</p>
  {:else if screen.kind === "game-already-started"}
    <p class="text-center text-gray-600">Game already started</p>
  {:else if screen.kind === "unknown"}
    <p class="text-center text-red-600">Unknown room state: {screen.raw}</p>
  {/if}
</div>