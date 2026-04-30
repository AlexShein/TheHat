# Data Schema: Firebase Realtime Database

## Full Schema

```
/admins/
  {uid}: true                          # Whitelist. Set manually by project author.

/rooms/
  {roomId}/                            # roomId: nanoid(8), e.g. "xK9mP2qL"
    meta/
      createdBy: string                # Admin uid
      createdAt: number                # Server timestamp (ms)
      lastActiveAt: number             # Updated on any player disconnect; used for cleanup TTL

    config/
      wordCount: number                # Words required per player (default: 5)
      numTeams: number                 # Number of teams (default: 2)
      skipPenalty: boolean             # If true, skip costs active team -1 point (default: false)
      timerDuration: number            # Turn duration in milliseconds (default: 60000)

    status: string
      # Enum: 'word-entry' | 'pre-start' | 'playing' | 'finished'
      # Controls which screen all clients render.

    players/
      {playerId}/                      # playerId: nanoid(8), generated on name entry
        name: string                   # Display name chosen by player
        color: string                  # Hex color, assigned randomly on join (e.g. "#E74C3C")
        teamId: string | null          # Assigned in pre-start lobby
        wordsSubmitted: boolean        # True after player submits their word list
        ready: boolean                 # True after player marks ready in lobby
        connected: boolean             # Managed by onDisconnect(); true = online
        isAdmin: boolean               # True if this player's session belongs to the admin uid

    teams/
      {teamId}/                        # teamId: "team-1", "team-2", etc.
        name: string                   # Display name e.g. "Team 1"
        playerOrder: string[]          # Array of playerIds in rotation order (set at game start)
        currentPlayerIndex: number     # Index into playerOrder for current explainer
        roundScores/
          round1: number
          round2: number
          round3: number

    words/
      {wordId}/                        # wordId: nanoid(8)
        text: string                   # The word/phrase
        addedBy: string                # playerId

    gameState/
      round: number                    # Current round: 1, 2, or 3

      currentTeamId: string            # teamId of the team whose turn it is
      currentExplainerId: string       # playerId of the active explainer

      # Timer fields
      timerStartedAt: number | null    # Server timestamp when timer started (or was resumed)
      timerDuration: number            # Copy of config.timerDuration (ms) — convenience
      pausedAt: number | null          # Server timestamp when paused; null if running
      timeRemainingAtPause: number | null  # ms remaining when paused

      phase: string
        # Enum:
        # 'waiting_start'  — turn assigned, waiting for explainer to press Start
        # 'explaining'     — timer running, word active
        # 'post_expiry'    — timer expired, pending guessed/skip decision on last word
        # 'post_turn'      — turn complete, showing results
        # 'round_end'      — hat empty, round summary shown

      hat: string[]                    # Array of wordIds remaining in hat for this round
                                       # Drawn via runTransaction() — atomic

      currentWordId: string | null     # wordId of the word currently being explained

      # Last action — for Undo support
      lastAction/
        type: string | null            # 'guessed' | 'skipped' | null
        wordId: string | null          # The word that was acted on
        scoredTeamId: string | null    # teamId that received a point (null for skips)
        scoreWasPenalty: boolean       # True if this was a skip with penalty applied

      # Per-player stats (accumulated across all rounds)
      playerStats/
        {playerId}/
          wordsExplained: number       # Count of words successfully explained by this player
```

---

## Key Invariants

1. **`hat` is the single source of truth for remaining words.** Only modified via `runTransaction()` by the active explainer's client. Never modified directly by other clients.

2. **`timerStartedAt` is always a Firebase server timestamp.** Never a client-side `Date.now()`. Use `serverTimestamp()` from Firebase SDK.

3. **`currentExplainerId` must always be a player in `currentTeamId`'s `playerOrder`.** Enforced by client logic; admin override validated before write.

4. **`players/{id}/connected` is always written by `onDisconnect()`.** Never toggled manually except on reconnect (set to `true` on re-join).

5. **`status` drives top-level screen routing.** `gameState.phase` drives sub-screens within the playing phase. Do not use `phase` when `status !== 'playing'`.

---

## State Transitions

### `status` transitions
```
[room created] → 'word-entry'
  → (all players submitted words AND ready) → 'pre-start'
  → (admin triggers start) → 'playing'
  → (round 3 complete) → 'finished'
  → (admin restarts) → 'word-entry'
```

### `gameState.phase` transitions (while status === 'playing')
```
'waiting_start'
  → (explainer presses Start) → 'explaining'

'explaining'
  → (timer reaches 0, word displayed >2s) → 'post_expiry'
  → (timer reaches 0, no word / word displayed <2s) → 'post_turn'
  → (hat emptied mid-turn) → 'post_turn'

'post_expiry'
  → (explainer presses Guessed or Skip) → 'post_turn'

'post_turn'
  → (next team confirmed) →
      if hat not empty: 'waiting_start' (next team's turn)
      if hat empty: 'round_end'

'round_end'
  → (all players acknowledged / auto-advance) →
      if round < 3: 'waiting_start' (hat refilled, next team continues)
      if round === 3: status → 'finished'
```

---

## Color Palette

Fixed palette assigned on join, collision-avoided within a room:

```javascript
const PLAYER_COLORS = [
  '#E74C3C', // red
  '#3498DB', // blue
  '#2ECC71', // green
  '#F39C12', // orange
  '#9B59B6', // purple
  '#1ABC9C', // teal
  '#E91E63', // pink
  '#FF5722', // deep orange
  '#607D8B', // blue-grey
  '#CDDC39', // lime
  '#795548', // brown
  '#00BCD4', // cyan
];
```

Assignment: on player join, read existing player colors, pick a random color not yet in use.

---

## Computed Values (Client-Side Only, Not Stored)

These are derived in Svelte stores — never written to RTDB:

| Value | Derivation |
|---|---|
| `timeRemaining` | `timerDuration - (Date.now() - timerStartedAt)` when running; `timeRemainingAtPause` when paused |
| `isMyTurn` | `gameState.currentExplainerId === myPlayerId` |
| `currentTeamScore` | Sum of `teams/{currentTeamId}/roundScores` across all rounds |
| `canSkip` | `phase === 'explaining'` AND `wordDisplayedAt + 2000 < Date.now()` AND `round !== 3` |
| `hatSize` | `gameState.hat.length` |
| `allPlayersReady` | All players have `wordsSubmitted === true` AND `ready === true` |

---

## RTDB Indexes Required

Add to `database.rules.json` for query performance:

```json
{
  "rules": {
    "rooms": {
      ".indexOn": ["meta/lastActiveAt"]
    }
  }
}
```

This enables the cleanup function's `orderByChild('meta/lastActiveAt')` query to work efficiently.
