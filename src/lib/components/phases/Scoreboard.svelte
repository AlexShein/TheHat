<script lang="ts">
  import { restartGame } from "$lib/game/turn-round"
  import type { Database } from "firebase/database"
  import type { Team, Player, GameState } from "$lib/db-types"
  import { getTeamColorClasses } from "$lib/team-colors"

  let {
    db,
    roomId,
    playerId,
    round,
    teams,
    players,
    playerStats,
  }: {
    db: Database
    roomId: string
    playerId: string
    round: number
    teams: Record<string, Team>
    players: Record<string, Player>
    playerStats: GameState["playerStats"]
  } = $props()

  const isAdmin = $derived(players[playerId]?.isAdmin ?? false)

  // Compute team totals
  const teamScores = $derived(
    Object.entries(teams).map(([tid, team]) => ({
      teamId: tid,
      name: team.name,
      total: (team.roundScores.round1 ?? 0) + (team.roundScores.round2 ?? 0) + (team.roundScores.round3 ?? 0),
    })),
  )

  // Sort teams by total descending, then by name for stable order
  const sortedTeams = $derived([...teamScores].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)))

  // Build player list with team names and wordsExplained
  const playerRows = $derived(
    Object.entries(players)
      .map(([pid, player]) => ({
        playerId: pid,
        name: player.name,
        teamName: teams[player.teamId ?? ""]?.name ?? "—",
        wordsExplained: playerStats[pid]?.wordsExplained ?? 0,
      }))
      .sort((a, b) => b.wordsExplained - a.wordsExplained || a.name.localeCompare(b.name)),
  )

  let restarting = $state(false)

  async function handleRestart(): Promise<void> {
    restarting = true
    try {
      await restartGame(db, roomId)
    } finally {
      restarting = false
    }
  }
</script>

<div class="p-6 text-center">
  <h2 class="font-display text-headline-md text-on-surface mb-2">Game Over</h2>
  <p class="text-body-md text-on-surface-variant mb-6">Completed after {round} rounds</p>

  <!-- Team scores -->
  <table class="w-full mb-6 text-left" aria-label="Final team scores">
    <thead>
      <tr class="border-b border-outline-variant">
        <th class="py-2 pr-4 font-display text-label-caps text-on-surface-variant">Team</th>
        <th class="py-2 font-display text-label-caps text-on-surface-variant text-right">Score</th>
      </tr>
    </thead>
    <tbody>
      {#each sortedTeams as team (team.teamId)}
        {@const tc = getTeamColorClasses(team.teamId)}
        <tr class="border-b border-outline-variant">
          <td class="py-2 pr-4 text-body-md text-on-surface border-l-8 pl-3 {tc.stripe}">{team.name}</td>
          <td class="py-2 text-right font-display font-semibold text-headline-md text-on-surface">{team.total}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  <!-- Per-player stats -->
  <table class="w-full mb-6 text-left" aria-label="Player statistics">
    <thead>
      <tr class="border-b border-outline-variant">
        <th class="py-2 pr-4 font-display text-label-caps text-on-surface-variant">Player</th>
        <th class="py-2 pr-4 font-display text-label-caps text-on-surface-variant">Team</th>
        <th class="py-2 font-display text-label-caps text-on-surface-variant text-right">Words Explained</th>
      </tr>
    </thead>
    <tbody>
      {#each playerRows as row (row.playerId)}
        <tr class="border-b border-outline-variant">
          <td class="py-2 pr-4 text-body-md text-on-surface">{row.name}</td>
          <td class="py-2 pr-4 text-body-md text-on-surface-variant">{row.teamName}</td>
          <td class="py-2 text-right font-display font-semibold text-body-md text-on-surface">{row.wordsExplained}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  {#if isAdmin}
    <button
      onclick={handleRestart}
      disabled={restarting}
      class="min-h-11 px-6 py-3 bg-primary text-on-primary font-display font-semibold rounded
             disabled:opacity-50 disabled:cursor-not-allowed
             transition-colors text-body-md"
      aria-label="Restart game"
    >
      {restarting ? "Restarting…" : "Restart"}
    </button>
  {:else}
    <p class="text-body-md text-on-surface-variant">Waiting for the game admin to restart…</p>
  {/if}
</div>