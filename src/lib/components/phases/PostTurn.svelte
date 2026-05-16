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
  <p class="text-headline-md font-display text-on-surface mb-2" aria-live="polite">
    <span class="font-semibold">{nextTeamName}</span> turn is over
  </p>
  <p class="text-display font-display text-on-surface mb-4">
    {wordsGuessed}
  </p>
  <p class="text-body-md text-on-surface-variant">words guessed this turn</p>
  <p class="mt-4 text-body-md text-on-surface-variant">
    Next: <span class="font-display font-semibold">{nextExplainerName}</span>
  </p>
  <button
    class="mt-6 px-6 py-3 bg-primary text-on-primary rounded font-display font-semibold
           active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed
           min-h-[44px] min-w-[44px] text-body-md"
    onclick={handleContinue}
    disabled={advancing}
    aria-label="Continue to next turn"
  >
    {advancing ? "Starting next turn..." : "Continue"}
  </button>
</div>
