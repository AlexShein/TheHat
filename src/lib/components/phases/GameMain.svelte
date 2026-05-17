<script lang="ts">
  import Timer from "$lib/components/shared/Timer.svelte"
  import TeamScore from "$lib/components/shared/TeamScore.svelte"
  import PostTurn from "$lib/components/phases/PostTurn.svelte"
  import ExplainerView from "$lib/components/phases/ExplainerView.svelte"
  import RoundEnd from "$lib/components/phases/RoundEnd.svelte"
  import type { Database } from "firebase/database"
  import type { Team, Player, GameState } from "$lib/db-types"
  import { createGameMainLogic } from "./game-main-logic.svelte"

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

  const logic = createGameMainLogic(() => ({
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
  }))
</script>

{#if logic.timerExpiryError}
  <div class="p-2 mb-3 bg-error-container border border-error rounded text-on-error-container text-body-md" role="alert">
    {logic.timerExpiryError}
  </div>
{/if}

<div class="h-1 {logic.teamColor} opacity-80" role="presentation" aria-hidden="true"></div>

<p class="text-center text-body-md text-on-surface-variant mb-2">Round {round} of 3</p>
<p class="text-center text-body-md text-on-surface-variant mb-2">Words left in the hat: {hat.length}</p>

<div class="flex gap-2 mb-3">
  {#each Object.entries(teams) as [tid, team] (tid)}
    {@const total = (team.roundScores.round1 ?? 0) + (team.roundScores.round2 ?? 0) + (team.roundScores.round3 ?? 0)}
    <div class="flex-1">
      <TeamScore teamName={team.name} teamId={tid} score={total} isActive={tid === currentTeamId} />
    </div>
  {/each}
</div>

{#if phase === "waiting_start"}
  {#if logic.isExplainer}
    <Timer {timerStartedAt} {timerDuration} {pausedAt} {timeRemainingAtPause} />
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
      {hat}
    />
  {:else}
    <div class="text-center">
      <p class="text-body-lg text-on-surface mb-2" aria-live="polite">
        {logic.explainerName} is explaining next
      </p>
      <p class="text-body-md text-on-surface-variant mb-4">Waiting to start...</p>
    </div>
  {/if}
{:else if phase === "explaining"}
  {#if logic.isExplainer}
    <Timer {timerStartedAt} {timerDuration} {pausedAt} {timeRemainingAtPause} />
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
      {hat}
    />
  {:else}
    <div class="text-center">
      <p class="text-body-md text-on-surface-variant mb-2">{logic.explainerName} is explaining</p>
      <Timer {timerStartedAt} {timerDuration} {pausedAt} {timeRemainingAtPause} />
    </div>
  {/if}
{:else if phase === "post_expiry"}
  {#if logic.isExplainer}
    <Timer {timerStartedAt} {timerDuration} {pausedAt} {timeRemainingAtPause} />
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
      {hat}
    />
  {:else}
    <div class="text-center">
      <p class="text-body-md text-on-surface-variant mb-2">{logic.explainerName}'s time is up</p>
      <Timer {timerStartedAt} {timerDuration} {pausedAt} {timeRemainingAtPause} />
    </div>
  {/if}
{:else if phase === "post_turn"}
  <PostTurn
    {db}
    {roomId}
    wordsGuessed={wordsGuessedThisTurn}
    nextExplainerName={logic.nextExplainerName}
    nextTeamName={logic.nextTeamName}
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