# Phase 3.5 — ExplainerView: Start, Guessed, Skip, Undo, Timer Expiry Actions

## Definition

Explainer's interactive controls. Renders only when `playerId === gameState.currentExplainerId`. Three modes based on `phase`:

- **Pre-start** (`waiting_start`): Start button. On press: write `timerStartedAt: serverTimestamp()`, `phase: 'explaining'`, call `drawWord()`, record `wordDisplayedAt = Date.now()` locally.
- **Active turn** (`explaining`): Shows current word text. Three buttons: Guessed, Skip (disabled first 2s + disabled in round 3), Undo. Each calls phase 3.2 scoring/hat functions + writes `lastAction`. Plays sound + vibrate on timer expiry (via 3.4 `handleTimerExpiry()` triggered by 3.3 timer `$effect`).
- **Post-expiry** (`post_expiry`): Current word shown. Guessed button opens team selector (which team guessed?). Skip button. No timer running.

All Firebase writes go through `src/lib/game/` functions (Phase 3.2, 3.4). ExplainerView is a thin controller — calls functions, passes result to UI. No direct Firebase calls in component.

Timer expiry sound (Web Audio 200Hz beep, 0.3s) + `navigator.vibrate(300)` triggered in `$effect` when `gameState.phase` transitions from `'explaining'` to `'post_expiry'` or `'post_turn'`.

## Acceptance Criteria

1. Start button visible only in `waiting_start` phase, only for explainer.
2. Start press: writes `timerStartedAt: serverTimestamp()`, `phase: 'explaining'`, calls `drawWord()`.
3. After `drawWord()` succeeds: word text displayed to explainer. `wordDisplayedAt` recorded as `Date.now()`.
4. Guessed button: calls `awardPoint(activeTeamId)`, increments `wordsGuessedThisTurn`, calls `drawWord()`, writes `lastAction: { type: 'guessed', wordId, scoredTeamId, scoreWasPenalty: false }`.
5. After Guessed on last word (hat empty after `drawWord()` returns null): calls `endTurnEarly()` → phase becomes `post_turn`. Does not draw new word.
6. Skip button: disabled (`aria-disabled`, grayed) when `Date.now() - wordDisplayedAt < 2000` OR `gameState.round === 3`.
7. Skip press: calls `returnWord(currentWordId)`, `drawWord()`, `applyPenalty()` if `config.skipPenalty === true`, writes `lastAction: { type: 'skipped', wordId, scoredTeamId: null, scoreWasPenalty }`. 2s lockout resets for new word.
8. Undo button: calls `undoLastAction()` (Phase 3.2). After undo, UI updates from store: previous word shown, score reverted, Undo hidden if `lastAction` becomes null.
9. Undo button always visible when `lastAction !== null`. Hidden when `lastAction === null`.
10. Post-expiry mode (`post_expiry`): Guessed button opens team selector (list of all team names). On select + confirm: `awardPoint(selectedTeamId)`, write `phase: 'post_turn'`, `currentWordId: null`, `lastAction: null`.
11. Post-expiry Skip: `returnWord(currentWordId)`, write `phase: 'post_turn'`, `currentWordId: null`, `lastAction: null`.
12. Timer expiry: Web Audio beep (200Hz, 0.3s) + `navigator.vibrate(300)` when `phase` changes from `'explaining'` to `'post_expiry'` or `'post_turn'`.
13. All buttons have `aria-label`. All touch targets ≥ 44px.
14. ExplainerView renders nothing (returns empty fragment) when `playerId !== currentExplainerId`.

## Files I Will Touch

| File                                                             | Reason                                                                                                          |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `src/lib/components/phases/ExplainerView.svelte` (NEW)           | All explainer controls. Thin controller — calls Phase 3.2/3.4 functions. No direct Firebase.                    |
| `src/lib/game/word-display.ts` (NEW)                             | `getWordDisplayedAt(): number` — pure function. Tracks when currentWordId changed locally. For 2s Skip lockout. |
| `src/lib/components/phases/ExplainerView.svelte` (test — manual) | Component too thin for unit tests. All logic in `lib/game/`. Manual test checklist below.                       |

## Interfaces I Will Introduce or Modify

```typescript
// src/lib/components/phases/ExplainerView.svelte

<script lang="ts">
  import type { GameStateStore } from "$lib/stores/gameState.svelte"

  let {
    db: Database,
    roomId: string,
    playerId: string,
    gameState: GameStateStore,
    config: { skipPenalty: boolean; timerDuration: number },
  }: {
    db: Database
    roomId: string
    playerId: string
    gameState: GameStateStore
    config: { skipPenalty: boolean; timerDuration: number }
  } = $props()

  // Local state (NOT in RTDB):
  //   wordDisplayedAt: number | null — set when currentWordId changes from null to string
  //   postExpirySelectedTeam: string | null — team selector state in post_expiry mode
</script>

// Renders:
// waiting_start → Start button
// explaining → word text + Guessed + Skip + Undo buttons
// post_expiry → word text + Guessed (with team selector) + Skip button
// all other phases → empty
```

```typescript
// src/lib/game/word-display.ts (NEW)

/**
 * Pure function. Returns Date.now() when wordId changed from null to non-null.
 * Caller manages prevWordId ref and calls this on each change.
 * Returns null if wordId hasn't changed.
 */
export function getWordDisplayedAt(currentWordId: string | null, previousWordId: string | null): number | null
```

## Tests I Will Write First

No unit tests for `ExplainerView.svelte` — component is pure glue calling `lib/game/` functions. All critical logic tested in Phase 3.2 and 3.4.

`word-display.ts` — pure function, unit test:

```typescript
// src/lib/game/word-display.test.ts (NEW)

describe("getWordDisplayedAt", () => {
  it("returns Date.now() when wordId changes from null to non-null")

  it("returns null when wordId unchanged")

  it("returns null when both null")

  it("returns new Date.now() when wordId changes from 'old' to 'new'")
})
```

Manual test checklist via `npm run dev:solo:full`:

```
  [ ] Start button visible in waiting_start, only for explainer
  [ ] Start press: timer starts, word appears
  [ ] Guessed: score increments, next word drawn
  [ ] Guessed on last word: post_turn shown
  [ ] Skip disabled first 2s after word appears
  [ ] Skip disabled in round 3 entirely
  [ ] Skip: word returns to hat, penalty applied if enabled
  [ ] Undo after Guessed: score decremented, previous word shown
  [ ] Undo after Skip: word restored, penalty reversed
  [ ] Undo hidden when lastAction is null
  [ ] Post-expiry Guessed: team selector shown, score awarded
  [ ] Post-expiry Skip: word returned, phase post_turn
  [ ] Timer expiry: beep sound + vibration
```

## Constraints I Am Applying

| Constraint                                   | How Applied                                                                                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Svelte 5 Runes Only                          | `$props()` for inputs. `$state` for local `wordDisplayedAt`, `postExpirySelectedTeam`. No `$:` or stores.                                                                      |
| Decoupled Logic                              | ExplainerView calls `drawWord()`, `awardPoint()`, `returnWord()`, `applyPenalty()`, `undoLastAction()`, `endTurnEarly()` — all in `lib/game/`. No Firebase calls in component. |
| Firebase: Server Timestamp Is the Only Clock | Start press writes `timerStartedAt` via `serverTimestamp()`. `wordDisplayedAt` uses local `Date.now()` (not stored in RTDB — per implementation plan).                         |
| Firebase: Hat Mutations Are Transactions     | `drawWord()` and `returnWord()` in `hat.ts` use `runTransaction()`. ExplainerView does not touch hat directly.                                                                 |
| Firebase: Disconnect Registration Order      | Not applicable.                                                                                                                                                                |
| RTDB Is the Single Source of Truth           | All game state from `gameStateStore`. `wordDisplayedAt` is local-only (not duplicated in RTDB).                                                                                |
| Strict Typing                                | All `$props()` typed. No `any`.                                                                                                                                                |
| No Silent Failures                           | On `drawWord()` returning null (empty hat): explicitly call `endTurnEarly()`. Not silently ignored.                                                                            |
| Single Responsibility                        | ExplainerView ≤ 150 lines (3 modes × ~50 lines each). Buttons as small inline functions, not separate files.                                                                   |
| Test Before Implement                        | `word-display.test.ts` first. Component tested manually (logic tested in Phase 3.2, 3.4).                                                                                      |
| Styling                                      | Tailwind only. All buttons ≥ 44px touch target. No inline `style=`.                                                                                                            |
| Accessibility                                | Every button has `aria-label`. Skip disabled state uses `aria-disabled`. Word text is visible to explainer.                                                                    |
| Linting                                      | `npm run lint` after implementation.                                                                                                                                           |

## Risks

1. **Double-tap Guessed on last word:** First `drawWord()` returns null → `endTurnEarly()` called. Second tap during async gap could call `drawWord()` again on already-empty hat. Mitigation: `gameState.phase` changes to `post_turn` by `endTurnEarly()`. ExplainerView checks `phase === 'explaining'` before processing taps. Second tap hits disabled phase → ignored.
2. **`wordDisplayedAt` local state reset on phase change:** When `phase` changes from `explaining` to `post_expiry` (timer expiry), `wordDisplayedAt` stays (word still shown). When `phase` changes to `post_turn` or `waiting_start`, `wordDisplayedAt` should reset to null. Track via `$effect` watching `phase`.
3. **Post-expiry team selector shows wrong teams:** Must read all team IDs from `gameState.teams` keys. Phase 3.3 `TeamScore` already has team list — pass it down or derive from store. Ensure `awardPoint()` call uses `selectedTeamId` not `currentTeamId`.

## Conflicts Flagged

**CONFLICT: Post-expiry Guessed writes `currentWordId: null` but implementation plan says it shouldn't.** Implementation plan: "Guessed in post_expiry: awardPoint(selectedTeamId), write phase: 'post_turn'." Does not mention clearing `currentWordId`. But PRD Phase 8: post-expiry word is last word of turn — after decision, turn ends. `currentWordId` should be cleared because no more words in this turn. **Resolution: clear `currentWordId: null` on post_expiry Guessed and Skip. Matches `post_turn` semantics.**

**CONFLICT: ExplainerView line count vs Single Responsibility constraint.** ExplainerView has 3 modes (waiting_start, explaining, post_expiry) with button handlers for each. Could hit ~150 lines. Constraint says ≤ 200 lines per file. At 150 lines it's compliant. If it grows: extract `PostExpiryTeamSelector.svelte` as separate component. Flag for implementer.
