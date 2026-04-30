<script lang="ts">
  import { db } from "$lib/firebase"
  import { joinRoom, registerDisconnect } from "$lib/game/room"
  import { assignColor, PlayerLimitError } from "$lib/colors"
  import { createPlayersStore } from "$lib/stores/players.svelte"
  import { browser } from "$app/environment"

  interface Props {
    roomId: string
  }

  let { roomId }: Props = $props()

  let name = $state("")
  let error = $state("")
  let joining = $state(false)
  let joined = $state(false)

  const MIN_NAME_LENGTH = 2

  function generatePlayerId(): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
    let id = ""
    for (let i = 0; i < 12; i++) {
      id += chars[Math.floor(Math.random() * chars.length)]
    }
    return id
  }

  async function handleSubmit(e: Event) {
    e.preventDefault()
    error = ""

    const trimmed = name.trim()
    if (trimmed.length < MIN_NAME_LENGTH) {
      error = `Name must be at least ${MIN_NAME_LENGTH} characters`
      return
    }

    joining = true

    try {
      // Get used colors from existing players
      const playersStore = createPlayersStore(roomId)
      const usedColors = new Set<string>(
        Object.values(playersStore.players).map((p) => (p as { color: string }).color),
      )

      const color = assignColor(usedColors)
      const playerId = generatePlayerId()

      await joinRoom(db, roomId, playerId, trimmed, color)
      await registerDisconnect(db, roomId, playerId)

      // Write playerId to URL
      if (browser) {
        const url = new URL(window.location.href)
        url.searchParams.set("p", playerId)
        history.replaceState({}, "", url.toString())
      }

      joined = true
      playersStore.destroy()
    } catch (e: unknown) {
      if (e instanceof PlayerLimitError) {
        error = "Room is full — all player slots taken"
      } else {
        error = e instanceof Error ? e.message : "Failed to join room"
      }
      joining = false
    }
  }
</script>

<div class="space-y-5">
  <h2 class="text-xl font-semibold text-center">Join Room</h2>
  <p class="text-sm text-gray-600 text-center">Room: <span class="font-mono font-bold">{roomId}</span></p>

  {#if joined}
    <div class="text-center space-y-3">
      <p class="text-green-600 font-medium">Joined!</p>
      <p class="text-sm text-gray-600">Waiting for game to start…</p>
    </div>
  {:else}
    <form onsubmit={handleSubmit} class="space-y-4">
      <label class="block" for="player-name">
        <span class="text-sm text-gray-700">Your name</span>
        <input
          id="player-name"
          type="text"
          bind:value={name}
          maxlength={30}
          class="mt-1 block w-full rounded border border-gray-300 px-3 py-2 min-h-[44px]"
          placeholder="Enter your name"
        />
      </label>

      {#if error}
        <p class="text-sm text-red-600" role="alert">{error}</p>
      {/if}

      <button
        type="submit"
        disabled={joining}
        class="w-full rounded bg-blue-600 px-4 py-3 text-white font-medium min-h-[44px] disabled:opacity-50"
        aria-label="Confirm and join room"
      >
        {joining ? "Joining..." : "Join"}
      </button>
    </form>
  {/if}
</div>