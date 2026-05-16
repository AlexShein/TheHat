<script lang="ts">
  import { auth, db } from "$lib/firebase"
  import { createRoom } from "$lib/game/room"
  import type { RoomConfig } from "$lib/db-types"

  interface Props {
    isAdmin: boolean
    onRoomCreated: (roomId: string) => void
  }

  let { isAdmin, onRoomCreated }: Props = $props()

  let numTeams = $state(2)
  let wordCount = $state(7)
  let timerDuration = $state(60)
  let skipPenalty = $state(false)
  let error = $state("")
  let creating = $state(false)

  const MAX_TEAMS = 4
  const MIN_TEAMS = 2
  const MAX_WORDS = 20
  const MIN_WORDS = 3

  async function handleSubmit(e: Event) {
    e.preventDefault()
    error = ""
    if (!isAdmin) {
      error = "Only admin can create a room"
      return
    }
    const user = auth.currentUser
    if (!user) {
      error = "You must be signed in to create a room"
      return
    }
    if (numTeams < MIN_TEAMS || numTeams > MAX_TEAMS) {
      error = `Teams must be between ${MIN_TEAMS} and ${MAX_TEAMS}`
      return
    }
    if (wordCount < MIN_WORDS || wordCount > MAX_WORDS) {
      error = `Words per player must be between ${MIN_WORDS} and ${MAX_WORDS}`
      return
    }
    if (timerDuration < 10) {
      error = "Timer must be at least 10 seconds"
      return
    }

    const config: RoomConfig = {
      numTeams,
      wordCount,
      'timerDuration': timerDuration*1000,
      skipPenalty: skipPenalty ?? false,
    }

    creating = true
    try {
      const roomId = await createRoom(db, config, user.uid)
      onRoomCreated(roomId)
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : "Failed to create room"
      creating = false
    }
  }

  function clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val))
  }
</script>

<form onsubmit={handleSubmit} class="space-y-5 display-flex">
  <h2 class="font-display text-headline-md text-on-surface text-center">Create Game Room</h2>

  <label class="block" for="num-teams">
    <span class="text-body-md text-on-surface">Number of Teams</span>
    <div class="flex items-center gap-2 mt-1">
      <button
        type="button"
        class="min-h-[44px] min-w-[44px] rounded border border-outline-variant bg-surface-container text-body-lg text-on-surface text-center"
        onclick={() => (numTeams = clamp(numTeams - 1, MIN_TEAMS, MAX_TEAMS))}
        aria-label="Decrease teams"
      >−</button>
      <input
        id="num-teams"
        type="number"
        min={MIN_TEAMS}
        max={MAX_TEAMS}
        bind:value={numTeams}
        class="w-16 text-center rounded border border-outline-variant bg-surface-container px-2 py-2 min-h-[44px] text-body-md text-on-surface"
      />
      <button
        type="button"
        class="min-h-[44px] min-w-[44px] rounded border border-outline-variant bg-surface-container text-body-lg text-on-surface"
        onclick={() => (numTeams = clamp(numTeams + 1, MIN_TEAMS, MAX_TEAMS))}
        aria-label="Increase teams"
      >+</button>
    </div>
  </label>

  <label class="block" for="word-count">
    <span class="text-body-md text-on-surface">Words Per Player</span>
    <div class="flex items-center gap-2 mt-1">
      <button
        type="button"
        class="min-h-[44px] min-w-[44px] rounded border border-outline-variant bg-surface-container text-body-lg text-on-surface"
        onclick={() => (wordCount = clamp(wordCount - 1, MIN_WORDS, MAX_WORDS))}
        aria-label="Decrease words per player"
      >−</button>
      <input
        id="word-count"
        type="number"
        min={MIN_WORDS}
        max={MAX_WORDS}
        bind:value={wordCount}
        class="w-16 text-center rounded border border-outline-variant bg-surface-container px-2 py-2 min-h-[44px] text-body-md text-on-surface"
      />
      <button
        type="button"
        class="min-h-[44px] min-w-[44px] rounded border border-outline-variant bg-surface-container text-body-lg text-on-surface"
        onclick={() => (wordCount = clamp(wordCount + 1, MIN_WORDS, MAX_WORDS))}
        aria-label="Increase words per player"
      >+</button>
    </div>
  </label>

  <label class="block" for="timer-duration">
    <span class="text-body-md text-on-surface">Timer Duration (seconds)</span>
    <input
      id="timer-duration"
      type="number"
      min={10}
      bind:value={timerDuration}
      class="mt-1 block w-full rounded border border-outline-variant bg-surface-container px-3 py-2 min-h-[44px] text-body-md text-on-surface"
    />
  </label>

  <label class="flex items-center gap-3 min-h-[44px]">
    <input
      type="checkbox"
      bind:checked={skipPenalty}
      class="h-5 w-5 rounded border-outline-variant"
    />
    <span class="text-body-md text-on-surface">Enable Skip Penalty</span>
  </label>

  {#if error}
    <p class="text-body-md text-error" role="alert">{error}</p>
  {/if}

  <button
    type="submit"
    disabled={creating}
    class="w-full rounded bg-primary text-on-primary font-display font-semibold py-3 min-h-[44px] disabled:opacity-50 text-body-md"
    aria-label="Create room"
  >
    {creating ? "Creating..." : "Create Room"}
  </button>
</form>