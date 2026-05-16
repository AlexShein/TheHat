<script lang="ts">
  import { onMount } from "svelte"
  import { db } from "$lib/firebase"
  import { addWord, updateWord, submitWords, getPlayerWords, advanceToLobby, WordValidationError } from "$lib/game/words"
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
  let editingWordId = $state<string | null>(null)
  let editText = $state("")

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

  function startEdit(wordId: string, currentText: string) {
    if (submitted) return
    editingWordId = wordId
    editText = currentText
    error = ""
  }

  async function confirmEdit() {
    if (editingWordId === null) return
    const trimmed = editText.trim()
    if (!trimmed) {
      error = "Word cannot be empty"
      return
    }
    error = ""
    try {
      await updateWord(db, roomId, editingWordId, playerId, trimmed)
      editingWordId = null
      editText = ""
      await loadWords()
    } catch (e: unknown) {
      if (e instanceof WordValidationError) {
        error = e.message
      } else {
        error = e instanceof Error ? e.message : "Failed to update word"
      }
    }
  }

  function cancelEdit() {
    editingWordId = null
    editText = ""
    error = ""
  }

  function handleEditKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault()
      confirmEdit()
    } else if (e.key === "Escape") {
      e.preventDefault()
      cancelEdit()
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
        <li class="rounded border border-gray-200 px-3 py-2 text-sm bg-gray-50 flex items-center gap-2 min-h-[44px]">
          {#if editingWordId === wordId}
            <label class="sr-only" for="edit-word-input">Edit word</label>
            <input
              id="edit-word-input"
              type="text"
              bind:value={editText}
              maxlength={50}
              onkeydown={handleEditKeydown}
              class="flex-1 rounded border border-blue-400 px-2 py-1 bg-white min-h-[44px]"
              aria-label="Edit word"
            />
            <button
              onclick={confirmEdit}
              disabled={editText.trim().length === 0}
              class="shrink-0 rounded bg-green-600 text-white w-[44px] h-[44px] flex items-center justify-center disabled:opacity-50"
              aria-label="Confirm edit"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
              </svg>
            </button>
            <button
              onclick={cancelEdit}
              class="shrink-0 rounded bg-gray-300 text-gray-700 w-[44px] h-[44px] flex items-center justify-center"
              aria-label="Cancel edit"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
          {:else}
            <span class="flex-1">{word.text}</span>
            {#if !submitted}
              <button
                onclick={() => startEdit(wordId, word.text)}
                class="shrink-0 rounded text-gray-400 hover:text-blue-600 w-[44px] h-[44px] flex items-center justify-center"
                aria-label="Edit word"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
            {/if}
          {/if}
        </li>
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