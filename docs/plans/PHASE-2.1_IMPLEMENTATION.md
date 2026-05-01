# Phase 2.1 — Word Entry

## Definition

Word entry screen for all players. Each player types words into an input, sees their submitted list, and submits when they reach `config.wordCount`. Words persist to RTDB at `/rooms/{roomId}/words/{wordId}`. On submit, `player.wordsSubmitted` flips to `true`. Admin sees an "Advance to Lobby" button after all players have submitted words — clicking it writes `status: 'pre-start'`.

**Why this split:** Word entry is a self-contained vertical — input validation, RTDB persistence, and submit gate. No dependency on teams, lobby, or game init. Isolates 3 files. Independent testable: create room, add words, verify in emulator, submit, verify `wordsSubmitted`, advance to lobby.

## Acceptance Criteria

1. Player sees text input + "Add" button. Input disabled when word list = `config.wordCount`.
2. Each word added writes a node at `/rooms/{roomId}/words/{wordId}` with `{ text, addedBy }`.
3. Player's submitted words displayed as a list below input. Duplicates allowed (separate wordIds).
4. "Submit Words" button appears only when word count equals `config.wordCount`.
5. Submit writes `player.wordsSubmitted = true` to RTDB. Input and button disappear; list remains read-only.
6. Duplicate words at submission: each is a separate `/words/{wordId}` node with unique id.
7. Admin sees "Advance to Lobby" button visible only when ALL players in room have `wordsSubmitted === true` AND admin's own words are submitted.
8. Admin "Advance to Lobby" writes `status: 'pre-start'`. Non-admin cannot write status (enforced by rules).
9. On hard-refresh with valid `?p=`, words persist and show submitted state (read from RTDB).
10. Empty word or whitespace-only word rejected client-side (no RTDB write).
11. Word length ≤ 50 characters (client-side validation).
12. All touch targets ≥ 44px. Input and buttons have `aria-label`.

## Files I Will Touch

| File                                               | Reason                                                                                                |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/lib/game/words.ts` (NEW)                      | `addWord()`, `submitWords()`, `getPlayerWords()` — all RTDB read/write for words node                 |
| `src/lib/components/phases/WordEntry.svelte` (NEW) | Input + list + submit button UI. Reads `roomStore.config`, `playersStore`, calls `words.ts` functions |
| `src/lib/game/words.test.ts` (NEW)                 | Tests for addWord, submitWords, getPlayerWords against emulator                                       |
| `src/routes/room/[roomId]/+page.svelte` (MODIFY)   | Replace `word-entry` placeholder with `<WordEntry>` component. Pass `roomId`, `playerId`, `isAdmin`   |

## Interfaces I Will Introduce or Modify

```typescript
// src/lib/game/words.ts

/** Adds one word to /rooms/{roomId}/words/{wordId}. Returns the generated wordId. */
export async function addWord(db: Database, roomId: string, playerId: string, text: string): Promise<string>

/** Marks player.wordsSubmitted = true. Does NOT re-write words — assumes all words already persisted. */
export async function submitWords(db: Database, roomId: string, playerId: string): Promise<void>

/** Reads all words for a player from /rooms/{roomId}/words where addedBy === playerId. */
export async function getPlayerWords(
  db: Database,
  roomId: string,
  playerId: string,
): Promise<Record<string, Word>>

/** Advances room status from word-entry to pre-start. Admin-only (enforced by rules). */
export async function advanceToLobby(db: Database, roomId: string): Promise<void>
```

```typescript
// WordEntry.svelte (props)
let {
  roomId,
  playerId,
  isAdmin,
}: {
  roomId: string
  playerId: string
  isAdmin: boolean
} = $props()
```

## Tests I Will Write First

```typescript
// src/lib/game/words.test.ts

describe("addWord", () => {
  it("writes a word node with correct text and addedBy fields")
  // AC 2

  it("returns a unique wordId for each call (no collisions)")
  // AC 6

  it("rejects empty string with a typed error before writing to RTDB")
  // AC 10

  it("rejects whitespace-only string with a typed error")
  // AC 10

  it("rejects text longer than 50 characters with a typed error")
  // AC 11

  it("allows duplicate text — creates separate wordId nodes")
  // AC 6
})

describe("submitWords", () => {
  it("sets player.wordsSubmitted to true")
  // AC 5

  it("is idempotent — calling twice does not throw")
  // edge case: double-tap

  it("does not overwrite other player fields (name, color, teamId, ready)")
  // regression: partial set
})

describe("getPlayerWords", () => {
  it("returns all words where addedBy matches playerId")
  // AC 9

  it("returns empty record when player has no words")
  // empty state

  it("does not return other players' words")
  // isolation
})

describe("advanceToLobby", () => {
  it("writes status: 'pre-start' to room")
  // AC 8

  it("called by non-admin throws permission-denied")
  // AC 8 — enforced by security rules
})
```

## Constraints I Am Applying

| Constraint                                   | How Applied                                                                                                                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Svelte 5 Runes Only                          | `WordEntry.svelte` uses `$state`, `$derived`, `$props`. No `$:` or stores.                                                                                                                 |
| Decoupled Logic                              | All RTDB writes in `words.ts`. Component only calls exported functions.                                                                                                                    |
| Strict Typing                                | All function signatures use `Database`, `Word` interfaces. No `any`. `unknown` + type guards for snapshot values.                                                                          |
| No Silent Failures                           | `addWord()` throws typed `WordValidationError` for empty/whitespace/too-long. `submitWords()` throws on RTDB write failure.                                                                |
| Single Responsibility                        | `addWord` ≤ 15 lines. `submitWords` ≤ 10 lines. `getPlayerWords` ≤ 15 lines. `advanceToLobby` ≤ 5 lines. Component ≤ 150 lines.                                                            |
| Test Before Implement                        | Write `words.test.ts` first. All tests pass against emulator before component is built.                                                                                                    |
| Styling                                      | Tailwind utilities only. All buttons/inputs ≥ 44px touch target. No inline `style=`.                                                                                                       |
| Accessibility                                | Input has `aria-label="Enter a word"`. Add button has `aria-label="Add word"`. Submit button has `aria-label="Submit all words"`. Word list items use `<li>` with visible text.            |
| RTDB Is the Single Source of Truth           | Word list in component derives from RTDB read via `getPlayerWords()`. No duplicate in component state beyond form input. Words shown after add come from re-reading RTDB, not local array. |
| Firebase: Server Timestamp Is the Only Clock | Not applicable to this sub-phase (no timer fields touched).                                                                                                                                |

## Risks

1. **TOCTOU on wordsSubmitted check for admin "Advance to Lobby":** Admin client reads all players' `wordsSubmitted` fields, but new player could join between read and status write. Mitigation: status write validates rules server-side; new player joining after advance is harmless (they'll be in lobby but word-entry is over).
2. **Word count mismatch:** Player adds words while admin changes `config.wordCount` in RTDB (unlikely but possible). Mitigation: `config.wordCount` is read reactively via store; submit button visibility uses `$derived` from current config value.
3. **Emulator test isolation:** Word nodes from one test could bleed into another. Mitigation: each test uses unique `roomId` + `playerId`; `beforeEach` cleans up via `set(ref(db, roomPath), null)`.

## Sequencing Recommendation

Implement `words.ts` + tests first (pure RTDB logic, testable independently). Then `WordEntry.svelte` (reads from existing stores, calls words.ts functions). Finally modify `+page.svelte` to wire WordEntry into the `word-entry` status branch. All testable with `npm run dev:solo:full` — create room, enter words, submit, verify in emulator UI.

## Conflicts Flagged

**CONFLICT: Security rules — `gameState.write` requires admin auth.** Not relevant to this sub-phase (we only write to `words` and `players/{id}/wordsSubmitted`). No conflict for 2.1.

**CONFLICT: Security rules — `status.write` requires admin auth.** `advanceToLobby()` writes status. This is correct per design — only admin advances phases. Non-admin call will throw permission-denied, which is appropriate. Conflict resolved by design.
