<script lang="ts">
  import { db } from "$lib/firebase"
  import type { Player } from "$lib/db-types"
  import { joinTeam, setReady, checkAllReady } from "$lib/game/lobby"

  let {
    roomId,
    playerId,
    isAdmin,
    bypassMinPlayers,
    players,
    config,
    onstart,
  }: {
    roomId: string
    playerId: string
    isAdmin: boolean
    bypassMinPlayers: boolean
    players: Record<string, Player>
    config: { numTeams: number }
    onstart: () => Promise<void>
  } = $props()

  let teamError = $state("")
  let readyError = $state("")
  let startError = $state("")
  let joiningTeam = $state(false)
  let togglingReady = $state(false)
  let starting = $state(false)

  const currentPlayer = $derived(players[playerId])
  const selectedTeamId = $derived(currentPlayer?.teamId ?? null)
  const isReady = $derived(currentPlayer?.ready ?? false)

  const readyCheck = $derived(checkAllReady(players, config.numTeams, bypassMinPlayers))

  // Team cards: compute player count per team
  const teamPlayers = $derived.by(() => {
    const map: Record<string, Player[]> = {}
    for (let i = 1; i <= config.numTeams; i++) {
      map[`team-${i}`] = []
    }
    for (const p of Object.values(players)) {
      if (p.teamId && map[p.teamId]) {
        map[p.teamId]!.push(p)
      }
    }
    return map
  })

  async function handleJoin(teamId: string) {
    teamError = ""
    joiningTeam = true
    try {
      await joinTeam(db, roomId, playerId, teamId)
    } catch (e) {
      teamError = e instanceof Error ? e.message : "Failed to join team"
    } finally {
      joiningTeam = false
    }
  }

  async function handleToggleReady() {
    readyError = ""
    togglingReady = true
    try {
      await setReady(db, roomId, playerId, !isReady)
    } catch (e) {
      readyError = e instanceof Error ? e.message : "Failed to toggle ready"
    } finally {
      togglingReady = false
    }
  }

  async function handleStart() {
    startError = ""
    starting = true
    try {
      await onstart()
    } catch (e) {
      startError = e instanceof Error ? e.message : "Failed to start game"
    } finally {
      starting = false
    }
  }
</script>

<div class="mx-auto max-w-md px-4 pt-4 pb-8">
  <h1 class="text-xl font-bold text-center mb-4" id="lobby-heading">Team Selection</h1>

  <!-- Team cards grid -->
  <div class="grid gap-3 mb-6" role="group" aria-labelledby="lobby-heading">
    {#each Object.entries(teamPlayers) as [teamId, teamMates] (teamId)}
      {@const teamNum = teamId.split("-")[1]}
      {@const count = teamMates.length}
      {@const isSelected = teamId === selectedTeamId}

      <div
        class="rounded-xl border-2 p-3 min-h-[72px] flex flex-col gap-2 transition-colors"
        class:border-blue-500={isSelected}
        class:bg-blue-50={isSelected}
        class:border-gray-200={!isSelected}
        aria-label="Team {teamNum} — {count} player{count === 1 ? '' : 's'}"
      >
        <div class="flex items-center justify-between">
          <span class="font-semibold text-base">Team {teamNum}</span>
          <span class="text-sm text-gray-500">{count} player{count === 1 ? "" : "s"}</span>
        </div>

        <!-- Player colored dots -->
        <div class="flex gap-1.5 flex-wrap" aria-label="Players on Team {teamNum}">
          {#each teamMates as mate (mate.name + mate.color)}
            <span
              class="inline-block w-6 h-6 rounded-full border border-white/30"
              style="background-color: {mate.color}"
              aria-label="{mate.name}"
              title="{mate.name}"
            ></span>{mate.name}
          {/each}
          {#if count === 0}
            <span class="text-sm text-gray-400 italic">No players yet</span>
          {/if}
        </div>

        <!-- Join / Switch button -->
        {#if !selectedTeamId}
          <button
            class="w-full py-2.5 min-h-[44px] bg-blue-600 text-white font-medium rounded-lg text-base disabled:opacity-50"
            disabled={joiningTeam}
            onclick={() => handleJoin(teamId)}
            aria-label="Join Team {teamNum}"
          >
            {joiningTeam ? "Joining..." : "Join"}
          </button>
        {:else if !isSelected}
          <button
            class="w-full py-2.5 min-h-[44px] bg-gray-200 text-gray-700 font-medium rounded-lg text-base disabled:opacity-50"
            disabled={joiningTeam}
            onclick={() => handleJoin(teamId)}
            aria-label="Switch to Team {teamNum}"
          >
            {joiningTeam ? "Switching..." : "Switch"}
          </button>
        {:else}
          <span class="text-sm text-blue-600 font-medium py-2.5 text-center">Your team</span>
        {/if}
      </div>
    {/each}
  </div>

  {#if teamError}
    <div class="p-2 bg-red-50 border border-red-300 rounded text-red-700 text-sm mb-3" role="alert">
      {teamError}
    </div>
  {/if}

  <!-- Ready toggle -->
  <div class="flex items-center justify-between min-h-[44px] mb-6">
    <label for="ready-toggle" class="text-base font-medium cursor-pointer">
      Ready to play
    </label>
    <button
      id="ready-toggle"
      role="switch"
      aria-checked={isReady}
      class="relative inline-flex h-8 w-14 items-center rounded-full transition-colors min-w-[56px] min-h-[44px] flex-shrink-0"
      class:bg-blue-600={isReady}
      class:bg-gray-300={!isReady}
      class:opacity-50={!selectedTeamId}
      disabled={!selectedTeamId || togglingReady}
      onclick={handleToggleReady}
      aria-label={isReady ? "Mark as not ready" : "Mark as ready"}
    >
      <span
        class="inline-block h-6 w-6 rounded-full bg-white transition-transform transform ml-1"
        class:translate-x-6={isReady}
      ></span>
    </button>
  </div>

  {#if readyError}
    <div class="p-2 bg-red-50 border border-red-300 rounded text-red-700 text-sm mb-3" role="alert">
      {readyError}
    </div>
  {/if}

  <!-- Start Game button — admin only -->
  {#if startError}
    <div class="p-2 bg-red-50 border border-red-300 rounded text-red-700 text-sm mb-3" role="alert">
      {startError}
    </div>
  {/if}

  {#if isAdmin}
    <button
      class="w-full py-3 min-h-[44px] bg-green-600 text-white font-bold rounded-lg text-lg disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={!readyCheck.allReady || starting}
      onclick={handleStart}
      aria-label="Start the game"
      aria-busy={starting}
      title={starting ? "Starting game…" : (readyCheck.reason || "Start Game")}
    >
      {starting
        ? "Starting game…"
        : readyCheck.allReady
          ? "Start Game"
          : readyCheck.reason}
    </button>
  {/if}

  {#if !isAdmin && !readyCheck.allReady}
    <p class="text-center text-sm text-gray-500">Waiting for host to start the game…</p>
  {/if}
</div>