<script lang="ts">
  let {
    wordsGuessed,
    nextExplainerName,
    nextTeamName,
  }: {
    wordsGuessed: number
    nextExplainerName: string
    nextTeamName: string
  } = $props()

  // wordsGuessed reads from gameState.wordsGuessedThisTurn — written by
  // awardPoint() (Phase 3.2) and reset by advanceTurn() (Phase 3.4).
  // If Phase 3.4 isn't wired, this always shows 0.
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
    Next: <span class="font-semibold">{nextExplainerName}</span> from {nextTeamName}
  </p>
</div>