# Phase 3.3 — GameMain Shell, TeamScore & PostTurn

## Definition

Observer-side UI for active game. `GameMain.svelte` reads from `gameStateStore` and renders sub-components based on `phase`:

- `waiting_start`: shows "Waiting for explainer..." + current explainer name + timer (not running).
- `explaining` / `post_expiry`: renders `ExplainerView` (Phase 3.5) for explainer, observer view (timer + word placeholder) for others.
- `post_turn`: renders `PostTurn.svelte` — shows words-guessed count for team that just played.
- `round_end`: placeholder (Phase 4 builds `RoundEnd`).

`TeamScore.svelte` — reusable component showing team name, score, highlight when active. Used in GameMain header.

No Firebase writes. All state from `gameStateStore`. Phase 3.5 plugs ExplainerView into this shell.

## Acceptance Criteria

1. `GameMain.svelte` renders without console errors when `gameStateStore` provides valid data.
2. In `waiting_start` phase: shows current explainer name, "Waiting to start..." text, timer at full duration (not counting down).
3. In `explaining` phase: explainer sees `ExplainerView` placeholder (Phase 3.5), observers see timer + current word indicator (not the word text — observers never see the word). **CONFLICT FLAG: PRD says "all players see timer", but word is visible only to explainer. Implementation plan says observer view is non-interactive timer + team scoreboards. Verify.**
4. In `post_expiry` phase: explainer sees `ExplainerView` with post-expiry mode (Guessed + team selector + Skip), observers see timer at 0.
5. In `post_turn` phase: `PostTurn.svelte` renders, showing count of words guessed this turn by the active team.
6. `PostTurn.svelte` shows correct words-guessed count by reading `playerStats` delta or `team roundScores` increment. **CONFLICT FLAG: Implementation plan says "count of words guessed this turn by active team" but no dedicated field exists in schema for per-turn count. Must derive from lastAction history or track separately. Recommendation: add `wordsGuessedThisTurn: number` field to `gameState` for PostTurn display. Update `db-types.ts`.**
7. `TeamScore.svelte` displays team name and total score (sum of round1 + round2 + round3). Active team highlighted.
8. `TeamScore.svelte` touch targets ≥ 44px (if interactive — currently read-only display).
9. All components use Tailwind only. No inline styles.
10. `GameMain.svelte` is an observer — no Firebase writes, only reads from store.

## Files I Will Touch

| File                                             | Reason                                                                                                         |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `src/components/phases/GameMain.svelte` (NEW)    | Phase-switching container. Reads `gameStateStore`, renders sub-components. Observer only — no Firebase writes. |
| `src/components/shared/TeamScore.svelte` (NEW)   | Team score display. Reads team data from store or props. Highlight active team.                                |
| `src/components/phases/PostTurn.svelte` (NEW)    | Post-turn summary screen. Shows words guessed count. Next turn countdown or admin advance.                     |
| `src/lib/db-types.ts` (MODIFY)                   | Add `wordsGuessedThisTurn: number` to `GameState` interface. Add `PostExpiryMode` to `GamePhase` if needed.    |
| `src/routes/room/[roomId]/+page.svelte` (MODIFY) | Replace `playing` placeholder with `<GameMain>` component, pass `roomId` + store refs.                         |

## Interfaces I Will Introduce or Modify

```typescript
// src/components/phases/GameMain.svelte

<script lang="ts">
  import type { GameStateStore } from "$lib/stores/gameState.svelte"

  let {
    roomId: string,
    playerId: string,
    gameState: GameStateStore,
    isAdmin: boolean,
  }: {
    roomId: string
    playerId: string
    gameState: GameStateStore
    isAdmin: boolean
  } = $props()
</script>

// Renders based on gameState.phase:
// waiting_start → "Waiting for {explainer}" + Timer
// explaining / post_expiry → ExplainerView (if playerId === currentExplainerId) else ObserverView
// post_turn → PostTurn
// round_end → placeholder "Round End — Phase 4"
```

```typescript
// src/components/shared/TeamScore.svelte

<script lang="ts">
  let {
    teamName: string,
    score: number,
    isActive: boolean,
  }: {
    teamName: string
    score: number
    isActive: boolean
  } = $props()
</script>
```

```typescript
// src/components/phases/PostTurn.svelte

<script lang="ts">
  let {
    wordsGuessed: number,
    nextExplainerName: string,
    nextTeamName: string,
  }: {
    wordsGuessed: number
    nextExplainerName: string
    nextTeamName: string
  } = $props()
</script>
```

```typescript
// src/lib/db-types.ts — add to GameState interface

export interface GameState {
  // ... existing fields
  wordsGuessedThisTurn: number // reset to 0 on each new turn, incremented on Guessed
}
```

```typescript
// src/routes/room/[roomId]/+page.svelte — replace placeholder

// Replace:
//   {:else if screen.kind === "playing"}
//     <p class="text-center text-gray-600">Game — coming soon</p>
// With:
//   {:else if screen.kind === "playing"}
//     <GameMain
//       roomId={data.roomId}
//       playerId={localPlayerId}
//       gameState={gameStateStore}
//       isAdmin={playersStore.players[localPlayerId]?.isAdmin ?? false}
//     />
```

## Tests I Will Write First

No unit tests for Svelte components in this sub-phase (components are declarative UI with no business logic — all logic in `lib/game/`). Visual verification via `npm run dev:solo:full`:

```
Manual test checklist:
  [ ] GameMain renders "Waiting for explainer" in waiting_start phase
  [ ] TeamScore shows correct team names and scores from RTDB
  [ ] TeamScore highlights active team when isActive=true
  [ ] PostTurn shows wordsGuessed count
  [ ] Observer view shows timer but not currentWord text during explaining
  [ ] Post-expiry observer view shows revealed word text
```

## Constraints I Am Applying

| Constraint                                   | How Applied                                                                                                                                           |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Svelte 5 Runes Only                          | `$props()` for all component inputs. `$state` for any local UI state (e.g., transition animation flag). No `$:` or stores.                            |
| Decoupled Logic                              | `GameMain.svelte` reads from `gameStateStore`, never calls Firebase directly. All write calls deferred to Phase 3.5 (ExplainerView).                  |
| Firebase: Server Timestamp Is the Only Clock | Not applicable — no timestamps written.                                                                                                               |
| Firebase: Hat Mutations Are Transactions     | Not applicable — no writes to hat.                                                                                                                    |
| Firebase: Disconnect Registration Order      | Not applicable.                                                                                                                                       |
| RTDB Is the Single Source of Truth           | All state from `gameStateStore`. No derived state stored in component local vars beyond `$derived` computations.                                      |
| Strict Typing                                | All `$props()` typed. No `any`.                                                                                                                       |
| No Silent Failures                           | Store connection errors surfaced via store error state. UI shows error banner if store disconnected.                                                  |
| Single Responsibility                        | `GameMain.svelte` — phase router only, ≤ 60 lines. `TeamScore.svelte` — score display only, ≤ 30 lines. `PostTurn.svelte` — summary only, ≤ 40 lines. |
| Test Before Implement                        | Manual test checklist above. Components too thin to justify unit tests — logic is in Phase 3.2 and 3.4.                                               |
| Styling                                      | Tailwind only. All touch targets ≥ 44px. No `style=` attributes.                                                                                      |
| Accessibility                                | All text visible (not color-only). Team scores have team name as visible label. Timer has `aria-live="polite"` (Phase 3.1).                           |
| Linting                                      | `npm run lint` after implementation.                                                                                                                  |

## Risks

1. **Schema gap for `wordsGuessedThisTurn`:** No existing field tracks per-turn count for PostTurn display. Must add to `GameState` interface, write in `awardPoint()` (Phase 3.2), reset in `advanceTurn()` (Phase 3.4). Coordinate across sub-phases. PostTurn reads this field. **Risk: if Phase 3.2 doesn't write it, PostTurn shows 0.**
2. **Post-expiry word visibility:** PRD says all players see word after expiry. Implementation plan says `post_expiry` view shows word + Guessed (with team selector) + Skip. Observer view must read `currentWordId` from store and display word text by reading from `/words/{id}`. This requires a word text lookup. **Add `wordsStore` or pass word text via `gameState`? Current schema only stores wordIds. Decision: post_expiry observer reads from `/words/{currentWordId}/text` via a one-shot `get()`. Or include `currentWordText` in gameState. Simpler: include `revealedWord` field in `LastAction` or `GameState`. Flag for 3.4 turn orchestration.**
3. **`+page.svelte` store instantiation:** `gameStateStore` must be created only when `status === 'playing'`. Creating it earlier subscribes to non-existent node → error. Use `$effect` with guard, or instantiate lazily in GameMain.

## Conflicts Flagged

**CONFLICT 1: Post-expiry word visibility for observers.** PRD Phase 8: "timer expiry triggers sound alert ... if current word displayed >2s: Guessed and Skip remain active. Explainer decides." Implies post-expiry word is visible to all (explainer shows it, observers need it for context). Implementation plan AC: "post_expiry view: word shown, Guessed (+ team selector)". Implementation: observers should see the word text after expiry. Requires either `currentWordText` field in `gameState` (written at draw time) or observers fetching from `/words/{currentWordId}`. **Recommendation: add `currentWordText: string | null` to `gameState`. Write it in `drawWord()`. Read it everywhere. This avoids extra RTDB round-trips for observers.**

**CONFLICT 2: `wordsGuessedThisTurn` field missing.** Implementation plan says PostTurn shows "count of words guessed this turn by active team." No schema field exists. **Resolution: add `wordsGuessedThisTurn: number` to `GameState`. Increment in `awardPoint()` (Phase 3.2). Reset to 0 in `advanceTurn()` (Phase 3.4). PostTurn reads it. Add to `db-types.ts`. All three sub-phases must coordinate.**

**CONFLICT 3: `post_expiry` team selector on observer side.** PRD says "Explainer decides: was it guessed? If yes, selects which team guessed it." Only explainer has Guessed button with team selector. Observers cannot act. GameMain should render ExplainerView for explainer, observer view (word + timer at 0) for others during `post_expiry`. No conflict — just design clarification.
