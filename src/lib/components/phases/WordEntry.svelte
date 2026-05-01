<script lang="ts">
  import { onMount } from "svelte"
  import { db } from "$lib/firebase"
  import { addWord, submitWords, getPlayerWords, advanceToLobby, WordValidationError } from "$lib/game/words"
  import { createRoomStore } from "$lib/stores/room.svelte"
  import { createPlayersStore } from "$lib/stores/players.svelte"
  import type { Word } from "$lib/db-types"

  interface Props {
    roomId: string
    playerId: string
    isAdmin: boolean
  }

  let { roomId, playerId, isAdmin }: Props = $props()

  const roomStore = $derived(createRoomStore(roomId))
  const playersStore = $derived(createPlayersStore(roomId))

  let inputText = $state("")
  let myWords: Record<string, Word> = $state({})
  let error = $state("")
  let submitted = $state(false)
  let advancing = $state(false)

  const wordCount = $derived(roomStore.config?.wordCount ?? 0)
  const myWordCount = $derived(Object.keys(myWords).length)
  const isComplete = $derived(myWordCount >= wordCount && wordCount > 0)
  const inputDisabled = $derived(isComplete || submitted)

  const allPlayersSubmitted = $derived(
    submitted && Object.values(playersStore.players).every((p) => p.wordsSubmitted),
  )

  onMount(() => {
    loadWords()
    return () => {
      roomStore.destroy()
      playersStore.destroy()
    }
  })

  async function loadWords() {
    try {
      myWords = await getPlayerWords(db, roomId, playerId)
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : "Failed to load words"
    }
  }

  // Sync submitted state from RTDB store — handles hard-refresh and external changes
  $effect(() => {
    const me = playersStore.players[playerId]
    if (me?.wordsSubmitted) {
      submitted = true
    }
  })

  async function handleAdd() {
    const trimmed = inputText.trim()
    if (!trimmed) return
    if (isComplete || submitted) return

    error = ""
    try {
      await addWord(db, roomId, playerId, trimmed)
      inputText = ""
      await loadWords()
    } catch (e: unknown) {
      if (e instanceof WordValidationError) {
        error = e.message
      } else {
        error = e instanceof Error ? e.message : "Failed to add word"
      }
    }
  }

  async function handleSubmit() {
    if (!isComplete) return
    error = ""
    try {
      await submitWords(db, roomId, playerId)
      submitted = true
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : "Failed to submit words"
    }
  }

  async function handleAdvance() {
    error = ""
    advancing = true
    try {
      await advanceToLobby(db, roomId)
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : "Failed to advance"
      advancing = false
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAdd()
    }
  }
</script>

<div class="space-y-5">
  <h2 class="text-xl font-semibold text-center">Enter Your Words</h2>
  <p class="text-sm text-gray-600 text-center">
    {#if wordCount > myWordCount}
      Add {wordCount - myWordCount} more word{wordCount - myWordCount !== 1 ? "s" : ""}
    {:else if wordCount > 0}
      All {wordCount} words added — submit to continue
    {/if}
  </p>

  {#if error}
    <p class="text-sm text-red-600 text-center" role="alert">{error}</p>
  {/if}

  {#if !submitted}
    <div class="flex gap-2">
      <label class="sr-only" for="word-input">Enter a word</label>
      <input
        id="word-input"
        type="text"
        bind:value={inputText}
        disabled={inputDisabled}
        onkeydown={handleKeydown}
        maxlength={50}
        class="flex-1 rounded border border-gray-300 px-3 py-2 min-h-[44px] disabled:bg-gray-100"
        placeholder="Type a word…"
        aria-label="Enter a word"
      />
      <button
        onclick={handleAdd}
        disabled={inputDisabled || inputText.trim().length === 0}
        class="rounded bg-blue-600 px-4 min-h-[44px] text-white font-medium disabled:opacity-50"
        aria-label="Add word"
      >
        Add
      </button>
    </div>
  {/if}

  {#if myWordCount > 0}
    <ul class="space-y-1" aria-label="Your submitted words">
      {#each Object.entries(myWords) as [wordId, word] (wordId)}
        <li class="rounded border border-gray-200 px-3 py-2 text-sm bg-gray-50">{word.text}</li>
      {/each}
    </ul>
  {/if}

  {#if isComplete && !submitted}
    <button
      onclick={handleSubmit}
      class="w-full rounded bg-green-600 px-4 py-3 text-white font-medium min-h-[44px]"
      aria-label="Submit all words"
    >
      Submit Words
    </button>
  {/if}

  {#if submitted}
    <p class="text-center text-green-600 font-medium">Words submitted!</p>
  {/if}

  {#if isAdmin && allPlayersSubmitted}
    <button
      onclick={handleAdvance}
      disabled={advancing}
      class="w-full rounded bg-purple-600 px-4 py-3 text-white font-medium min-h-[44px] disabled:opacity-50"
      aria-label="Advance to lobby"
    >
      {advancing ? "Advancing..." : "Advance to Lobby"}
    </button>
  {/if}
</div>