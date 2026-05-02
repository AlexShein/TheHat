<script lang="ts">
  import Timer from "$lib/components/shared/Timer.svelte"
  import TeamScore from "$lib/components/shared/TeamScore.svelte"
  import PostTurn from "$lib/components/phases/PostTurn.svelte"
  import ExplainerView from "$lib/components/phases/ExplainerView.svelte"
  import type { Database } from "firebase/database"
  import type { Team, Player, GameState } from "$lib/db-types"

  let {
    db,
    roomId,
    playerId,
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