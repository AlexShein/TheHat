<script lang="ts">
  import Timer from "$lib/components/shared/Timer.svelte"
  import TeamScore from "$lib/components/shared/TeamScore.svelte"
  import PostTurn from "$lib/components/phases/PostTurn.svelte"
  import type { Team, Player } from "$lib/db-types"

  let {
    playerId,
    phase,
    round,
    currentExplainerId,
    currentTeamId,
    timerStartedAt,
    timerDuration,
    pausedAt,
    timeRemainingAtPause,
    currentWordText,
    wordsGuessedThisTurn,
    teams,
    players,
  }: {
    playerId: string
    phase: string
    round: number
    currentExplainerId: string
    currentTeamId: string
    timerStartedAt: number | null
    timerDuration: number
    pausedAt: number | null
    timeRemainingAtPause: number | null
    currentWordText: string | null
    wordsGuessedThisTurn: number
    teams: Record<string, Team>
    players: Record<string, Player>
  } = $props()

  const isExplainer = $derived(playerId === currentExplainerId)

  const explainerName = $derived(players[currentExplainerId]?.name ?? "Unknown")
</script>

<!-- Round indicator -->
<p class="text-center text-sm text-gray-500 mb-2">Round {round} of 3</p>

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
  <div class="text-center">
    <p class="text-lg text-gray-700 mb-2" aria-live="polite">
      {explainerName} is explaining next
    </p>
    <p class="text-sm text-gray-500 mb-4">Waiting to start...</p>
    <Timer
      timerStartedAt={null}
      timerDuration={timerDuration}
      pausedAt={null}
      timeRemainingAtPause={null}
    />
  </div>
{:else if phase === "explaining"}
  {#if isExplainer}
    <!-- Phase 3.5 ExplainerView placeholder -->
    <div class="text-center p-6 bg-blue-50 rounded">
      <p class="text-blue-700 font-semibold mb-2">You are explaining</p>
      {#if currentWordText}
        <p class="text-2xl font-bold text-blue-900 mb-4">{currentWordText}</p>
      {:else}
        <p class="text-gray-400 italic mb-4">Word not yet drawn</p>
      {/if}
      <Timer
        timerStartedAt={timerStartedAt}
        timerDuration={timerDuration}
        pausedAt={pausedAt}
        timeRemainingAtPause={timeRemainingAtPause}
      />
    </div>
  {:else}
    <!-- Observer view: timer only, no word -->
    <div class="text-center">
      <p class="text-sm text-gray-500 mb-2">{explainerName} is explaining</p>
      <Timer
        timerStartedAt={timerStartedAt}
        timerDuration={timerDuration}
        pausedAt={pausedAt}
        timeRemainingAtPause={timeRemainingAtPause}
      />
    </div>
  {/if}
{:else if phase === "post_expiry"}
  {#if isExplainer}
    <!-- Phase 3.5 ExplainerView post-expiry mode -->
    <div class="text-center p-6 bg-orange-50 rounded">
      <p class="text-orange-700 font-semibold mb-2">Time's up! Make your call.</p>
      {#if currentWordText}
        <p class="text-2xl font-bold text-orange-900 mb-4">{currentWordText}</p>
      {/if}
      <Timer
        timerStartedAt={timerStartedAt}
        timerDuration={timerDuration}
        pausedAt={pausedAt}
        timeRemainingAtPause={timeRemainingAtPause}
      />
    </div>
  {:else}
    <!-- Observer view: show revealed word + timer at 0 -->
    <div class="text-center">
      <p class="text-sm text-gray-500 mb-2">{explainerName}'s time is up</p>
      <Timer
        timerStartedAt={timerStartedAt}
        timerDuration={timerDuration}
        pausedAt={pausedAt}
        timeRemainingAtPause={timeRemainingAtPause}
      />
      {#if currentWordText}
        <p class="mt-3 text-xl font-semibold text-gray-800">The word was: <span class="text-blue-700">{currentWordText}</span></p>
      {/if}
    </div>
  {/if}
{:else if phase === "post_turn"}
  <PostTurn
    wordsGuessed={wordsGuessedThisTurn}
    nextExplainerName={explainerName}
    nextTeamName={teams[currentTeamId]?.name ?? "Unknown"}
  />
{:else if phase === "round_end"}
  <div class="text-center p-6">
    <p class="text-xl font-semibold text-gray-700">Round End</p>
    <p class="text-sm text-gray-500">Phase 4 — Scoreboard coming soon</p>
  </div>
{/if}