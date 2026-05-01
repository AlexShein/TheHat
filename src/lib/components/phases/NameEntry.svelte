<script lang="ts">
  import { db } from "$lib/firebase"
  import { joinRoomAsCurrentUser } from "$lib/game/room"
  import { PlayerLimitError } from "$lib/colors"
  import { authStore } from "$lib/stores/auth.svelte"
  import { browser } from "$app/environment"
  import { replaceState } from "$app/navigation"
  import { resolve } from '$app/paths';
  import { page } from '$app/state';

  interface Props {
    roomId: string
    onjoined?: (playerId: string) => void
  }

  const url = $derived(page.url);
  let { roomId, onjoined }: Props = $props()

  let name = $state("")
  let error = $state("")
  let joining = $state(false)
  let joined = $state(false)

  const MIN_NAME_LENGTH = 2

  async function handleSubmit(e: Event) {
    e.preventDefault()
    error = ""

    const trimmed = name.trim()
    if (trimmed.length < MIN_NAME_LENGTH) {
      error = `Name must be at least ${MIN_NAME_LENGTH} characters`
      return
    }

    const user = authStore.currentUser
    if (!user) {
      error = "Sign in required to join"
      return
    }

    joining = true

    try {
      const playerId = user.uid
      await joinRoomAsCurrentUser(db, roomId, playerId, trimmed)

      if (browser) {

        const newUrl = new URL(url);
        newUrl.searchParams.set("p", playerId)
        const path = `${newUrl.pathname}${newUrl.search}${newUrl.hash}`;
        replaceState(resolve(path, {"p": playerId}), {})
      }
      joined = true
      onjoined?.(playerId)
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