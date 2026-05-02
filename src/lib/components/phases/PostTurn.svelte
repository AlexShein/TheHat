<script lang="ts">
  import { advanceTurn } from "$lib/game/turn-advance"
  import type { Database } from "firebase/database"

  let {
    db,
    roomId,
    wordsGuessed,
    nextExplainerName,
    nextTeamName,
    onAdvance,
  }: {
    db: Database
    roomId: string
    wordsGuessed: number
    nextExplainerName: string
    nextTeamName: string
    onAdvance?: () => void
  } = $props()

  let advancing = $state(false)

  async function handleContinue() {
    advancing = true
    try {
      await advanceTurn(db, roomId)
      onAdvance?.()
    } finally {
      advancing = false
    }
  }
</script>

<div class="text-center py-6">
  <p class="text-lg text-gray-700 mb-2" aria-live="polite">
    <span class="font-semibold">{nextTeamName}</span> turn is over
  </p>
  <p class="text-4xl font-bold text-blue-700 mb-4">
    {wordsGuessed}
  </p>
  <p class="text-sm text-gray-500">words guessed this turn</p>
  <p class="mt-4 text-sm text-gray-600">
    Next: <span class="font-semibold">{nextExplainerName}</span>
  </p>
  <button
    class="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg text-lg font-semibold
           hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed
           min-h-[44px] min-w-[44px]"
    onclick={handleContinue}
    disabled={advancing}
    aria-label="Continue to next turn"
  >
    {advancing ? "Starting next turn..." : "Continue"}
  </button>
</div>
