<script lang="ts">
  import { endRound } from "$lib/game/turn-round"
  import TeamScore from "$lib/components/shared/TeamScore.svelte"
  import type { Database } from "firebase/database"
  import type { Team, Player } from "$lib/db-types"

  let {
    db,
    roomId,
    playerId,
    round,
    teams,
    players,
  }: {
    db: Database
    roomId: string
    playerId: string
    round: number
    teams: Record<string, Team>
    players: Record<string, Player>
  } = $props()

  const isAdmin = $derived(players[playerId]?.isAdmin ?? false)
  const isLastRound = $derived(round === 3)

  let loading = $state(false)

  async function handleClick(): Promise<void> {
    loading = true
    try {
      await endRound(db, roomId)
    } finally {
      loading = false
    }
  }
</script>

<div class="text-center p-6">
  <p class="font-display text-headline-md text-on-surface mb-4">Round {round} Complete</p>
  <p>Round score</p>
  <div class="flex gap-2 mb-6">
    {#each Object.entries(teams) as [tid, team] (tid)}
      {@const total = round == 1 ? (team.roundScores.round1 ?? 0): round == 2 ? (team.roundScores.round2 ?? 0) : (team.roundScores.round3 ?? 0)}
      <div class="flex-1">
        <TeamScore teamName={team.name} teamId={tid} score={total} isActive={false} />
      </div>
    {/each}
  </div>

  {#if isAdmin}
    {#if isLastRound}
      <button
        onclick={handleClick}
        disabled={loading}
        class="min-h-11 px-6 py-3 bg-primary text-on-primary font-display font-semibold rounded
               disabled:opacity-50 disabled:cursor-not-allowed
               transition-colors text-body-md"
      >
        {loading ? "Loading…" : "See Results"}
      </button>
    {:else}
      <button
        onclick={handleClick}
        disabled={loading}
        class="min-h-11 px-6 py-3 bg-primary text-on-primary font-display font-semibold rounded
               disabled:opacity-50 disabled:cursor-not-allowed
               transition-colors text-body-md"
      >
        {loading ? "Loading…" : "Next Round"}
      </button>
    {/if}
  {:else}
    <p class="text-body-md text-on-surface-variant">Waiting for the game admin to continue…</p>
  {/if}
</div>