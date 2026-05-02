<script lang="ts">
  import Timer from "$lib/components/shared/Timer.svelte"
  import TeamScore from "$lib/components/shared/TeamScore.svelte"
  import PostTurn from "$lib/components/phases/PostTurn.svelte"
  import ExplainerView from "$lib/components/phases/ExplainerView.svelte"
  import RoundEnd from "$lib/components/phases/RoundEnd.svelte"
  import type { Database } from "firebase/database"
  import type { Team, Player, GameState } from "$lib/db-types"
  import { getTimeRemaining } from "$lib/game/timer"
  import { getWordDisplayedAt } from "$lib/game/word-display"
  import { handleTimerExpiry } from "$lib/game/turn-expiry"

  let {
    db,
    roomId,
    playerId,
    hat,
    phase,
    round,
    currentExplainerId,
    currentTeamId,
    currentWordId,
    currentWordText,
    lastAction,
    timerStartedAt,
    timerDuration,
    pausedAt,
    timeRemainingAtPause,
    wordsGuessedThisTurn,
    teams,
    players,
    config,
  }: {
    db: Database
    roomId: string
    playerId: string
    hat: string[]
    phase: GameState["phase"]
    round: number
    currentExplainerId: string
    currentTeamId: string
    currentWordId: string | null
    currentWordText: string | null
    lastAction: GameState["lastAction"]
    timerStartedAt: number | null
    timerDuration: number
    pausedAt: number | null
    timeRemainingAtPause: number | null
    wordsGuessedThisTurn: number
    teams: Record<string, Team>
    players: Record<string, Player>
    config: { skipPenalty: boolean; timerDuration: number }
  } = $props()

  const isExplainer = $derived(playerId === currentExplainerId)

  const explainerName = $derived(players[currentExplainerId]?.name ?? "Unknown")

  // Compute next team and explainer for PostTurn display.
  // Always rotates to next team (round-robin), uses that team's currentPlayerIndex.
  const teamIds = $derived(Object.keys(teams).sort())
  const nextTeamId = $derived.by(() => {
    const currentPos = teamIds.indexOf(currentTeamId)
    if (currentPos === -1) return currentTeamId
    const nextPos = (currentPos + 1) % teamIds.length
    return teamIds[nextPos]!
  })
  const nextTeam = $derived(teams[nextTeamId])
  const nextExplainerId = $derived.by(() => {
    if (!nextTeam?.playerOrder) return ""
    const idx = nextTeam.currentPlayerIndex ?? 0
    return nextTeam.playerOrder[idx] ?? ""
  })
  const nextExplainerName = $derived.by(() => players[nextExplainerId]?.name ?? "Unknown")
  const nextTeamName = $derived.by(() => nextTeam?.name ?? "Unknown")

  // Client-side only: track wordDisplayedAt for timer expiry check
  let wordDisplayed = $state<{ id: string | null; displayedAt: number | null }>({
    id: null,
    displayedAt: null,
  })

  let prevWordId: string | null = null // plain let — NOT $state. Writing it must not re-trigger $effect
  let timerExpiryError = $state("")

  $effect(() => {
    if (phase !== "explaining") return

    const displayedAt = getWordDisplayedAt(currentWordId, prevWordId)
    wordDisplayed = { id: currentWordId, displayedAt }
    prevWordId = currentWordId

    // Reset on phase exit
    return () => {
      wordDisplayed = { id: null, displayedAt: null }
      prevWordId = null
    }
  })

  // Timer expiry watcher — only explainer writes (single-writer-per-turn invariant)
  $effect(() => {
    if (!isExplainer) return
    if (phase !== "explaining") return

    const remaining = getTimeRemaining(timerStartedAt, timerDuration, pausedAt, timeRemainingAtPause)
    if (remaining > 0) {
      // Set up interval to check every 100ms
      let fired = false
      const interval = setInterval(() => {
        if (fired) return
        const r = getTimeRemaining(timerStartedAt, timerDuration, pausedAt, timeRemainingAtPause)
        if (r <= 0) {
          fired = true
          clearInterval(interval)
          handleTimerExpiry(
            db,
            roomId,
            timerStartedAt,
            timerDuration,
            pausedAt,
            timeRemainingAtPause,
            wordDisplayed.id,
            wordDisplayed.displayedAt,
          ).catch((err: unknown) => {
            timerExpiryError = err instanceof Error ? err.message : "Timer expiry failed"
          })
        }
      }, 100)
      return () => clearInterval(interval)
    } else {
      // Already expired on mount — fire immediately
      handleTimerExpiry(
        db,
        roomId,
        timerStartedAt,
        timerDuration,
        pausedAt,
        timeRemainingAtPause,
        wordDisplayed.id,
        wordDisplayed.displayedAt,
      ).catch((err: unknown) => {
        timerExpiryError = err instanceof Error ? err.message : "Timer expiry failed"
      })
    }
  })
</script>

{#if timerExpiryError}
  <div class="p-2 mb-3 bg-red-50 border border-red-300 rounded text-red-700 text-sm" role="alert">
    {timerExpiryError}
  </div>
{/if}

<!-- Round indicator -->
<p class="text-center text-sm text-gray-500 mb-2">Round {round} of 3</p>
<p class="text-center text-sm text-gray-500 mb-2">Words left in the hat: {hat.length}</p>
<!-- Team scoreboard header -->
<div class="flex gap-2 mb-3">
  {#each Object.entries(teams) as [tid, team] (tid)}
    {@const total = (team.roundScores.round1 ?? 0) + (team.roundScores.round2 ?? 0) + (team.roundScores.round3 ?? 0)}
    <div class="flex-1">
      <TeamScore teamName={team.name} score={total} isActive={tid === currentTeamId} />
    </div>
  {/each}
</div>

{#if phase === "waiting_start"}
  {#if isExplainer}
    <ExplainerView
      {db}
      {roomId}
      {playerId}
      {phase}
      {round}
      {currentWordId}
      {currentWordText}
      {currentExplainerId}
      {currentTeamId}
      {lastAction}
      {teams}
      skipPenalty={config.skipPenalty}
    />
  {:else}
    <div class="text-center">
      <p class="text-lg text-gray-700 mb-2" aria-live="polite">
        {explainerName} is explaining next
      </p>
      <p class="text-sm text-gray-500 mb-4">Waiting to start...</p>
    </div>
  {/if}
  <Timer
    timerStartedAt={null}
    {timerDuration}
    pausedAt={null}
    timeRemainingAtPause={null}
  />
{:else if phase === "explaining"}
  {#if isExplainer}
    <ExplainerView
      {db}
      {roomId}
      {playerId}
      {phase}
      {round}
      {currentWordId}
      {currentWordText}
      {currentExplainerId}
      {currentTeamId}
      {lastAction}
      {teams}
      skipPenalty={config.skipPenalty}
    />
    <Timer
      {timerStartedAt}
      {timerDuration}
      {pausedAt}
      {timeRemainingAtPause}
    />
  {:else}
    <!-- Observer view: timer only, no word -->
    <div class="text-center">
      <p class="text-sm text-gray-500 mb-2">{explainerName} is explaining</p>
      <Timer
        {timerStartedAt}
        {timerDuration}
        {pausedAt}
        {timeRemainingAtPause}
      />
    </div>
  {/if}
{:else if phase === "post_expiry"}
  {#if isExplainer}
    <ExplainerView
      {db}
      {roomId}
      {playerId}
      {phase}
      {round}
      {currentWordId}
      {currentWordText}
      {currentExplainerId}
      {currentTeamId}
      {lastAction}
      {teams}
      skipPenalty={config.skipPenalty}
    />
    <Timer
      {timerStartedAt}
      {timerDuration}
      {pausedAt}
      {timeRemainingAtPause}
    />
  {:else}
    <!-- Observer view: show revealed word + timer at 0 -->
    <div class="text-center">
      <p class="text-sm text-gray-500 mb-2">{explainerName}'s time is up</p>
      <Timer
        {timerStartedAt}
        {timerDuration}
        {pausedAt}
        {timeRemainingAtPause}
      />
      <!-- {#if currentWordText}
        <p class="mt-3 text-xl font-semibold text-gray-800">The word was: <span class="text-blue-700">{currentWordText}</span></p>
      {/if} -->
    </div>
  {/if}
{:else if phase === "post_turn"}
  <PostTurn
    {db}
    {roomId}
    wordsGuessed={wordsGuessedThisTurn}
    nextExplainerName={nextExplainerName}
    nextTeamName={nextTeamName}
  />
{:else if phase === "round_end"}
  <RoundEnd
    {db}
    {roomId}
    {playerId}
    {round}
    {teams}
    {players}
  />
{/if}