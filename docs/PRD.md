# PRD: Hat Game (Шляпа) — Web App MVP

## Overview

A real-time multiplayer web app for the party game "Hat" (Шляпа). Players are split into teams. Each turn, one player explains words from a hat while their team guesses. Three rounds, same words reused each round. Personal-use MVP — no public hosting, no scale requirements, no anti-cheat beyond basic access control.

**Target users:** A private group of friends. ~5–15 players per session.

---

## Roles

| Role       | Description                                                                                                                                           |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin**  | Authenticated via Google. Must be on a hardcoded whitelist (`/admins/{uid}` in RTDB). Can create rooms, pause the timer, change the active explainer. |
| **Player** | Anyone with the room link. No authentication required. Identified by a session-scoped name + auto-assigned color.                                     |

---

## Game Flow

### Phase 0 — Landing Page

- Visited at root route `/`.
- **Admin** (authenticated via Google, whitelisted): sees "Create Game" button.
- **Non-admin** (unauthenticated or not whitelisted): sees "Join a game" — text field to enter room ID or paste full invite link. Button navigates to `/room/{roomId}`.
- No authentication required to join — room ID from the link is sufficient.

### Phase 1 — Room Creation (Admin only)

- Admin creates a room. Room gets a short unique ID (nanoid, ~8 chars).
- Admin configures:
  - Number of teams (min 2)
  - Words per player (default: 5)
  - Skip penalty: off by default. When enabled, skipping costs the active team -1 point.
  - Timer duration: 60 seconds (default, configurable)
- Admin shares invite link or QR code. Both are generated client-side.

### Phase 2 — Join & Name Entry

- Players open the invite link and enter a display name.
- Each player is assigned a unique color from a fixed palette (assigned randomly on join, collision-avoided).
- Player ID is persisted in the URL (`?player=uid`) so page refresh doesn't break the session.

### Phase 3 — Word Entry

- Players see only: an input field, their already-submitted words, and a submit button.
- Submit button appears only when the required word count is reached.
- Duplicate words are allowed — they are simply added to the hat as separate entries.
- Words from all players are pooled into one shared "hat."

### Phase 4 — Pre-Start Lobby

- Players see: total player count, "ready" player count, team selector.
- Each player selects a team. Team cards show current player count.
- Minimum 2 players per team to start.
- Game starts automatically when all players have submitted words AND marked ready.

### Phase 5 — Main Game Screen (all players)

- Header: current round (1/2/3), name of the active explainer, admin controls (admin only).
- Center: large countdown timer. Non-interactive for players who are not the active explainer.
- Below timer: team scoreboards. Active team's block is highlighted.
- Corner: settings icon → change name or switch team.

### Phase 6 — Active Turn (explainer's view)

- Explainer sees: large timer + **Start** button.
- On Start: timer begins. A random word is drawn from the hat (atomic transaction).
- Controls:
  - ✅ **Guessed** — available immediately. Scores 1 point for the active team. Next word drawn.
  - ❌ **Skip** — available after 2 seconds. Word returns to hat. If skip penalty is on, -1 point for active team. **Disabled entirely in round 3.**
  - ↩ **Undo** — always available. Reverts the last action (either guessed or skipped). Previous word returns to hat, current word returns to hat. Score adjusted accordingly.

### Phase 7 — Hat Empty Mid-Turn

- If the hat empties during an active turn (timer still running): the round ends immediately.
- If round 3 just ended: game ends (transitions to `status: 'finished'`).
- Otherwise: round counter increments, all words return to hat, turn passes to the next team.
- Timer stops. No post-expiry decision phase is triggered.

### Phase 8 — Timer End

- Timer expiry triggers: sound alert + vibration (on supported devices).
- If the current word has been displayed for >2 seconds at time of expiry:
  - Guessed and Skip buttons remain active.
  - Explainer decides: was it guessed? If yes, selects which team guessed it. That team gets the point.
  - **Explainer must explicitly press Skip** if no one guessed the word. It does not auto-return to hat.
- If no word was active at expiry (hat was already empty): transition directly to next round. No post-expiry decision needed.
- Word is only visible to the explainer. New explainer is only picked after the post-expiry dicision is made.

### Phase 9 — Post-Turn Screen

- Explainer's team sees how many words they successfully guessed this turn.
- Turn passes to the next team (round-robin). Within a team, players rotate in a fixed order.

### Phase 10 — Round End

- Round ends when the hat is empty (either mid-turn or post-turn).
- All words are returned to the hat for the next round.
- **Team turn order continues from where it left off** — does not reset between rounds.
- Round counter increments for all players.

### Phase 11 — Scoreboard (after round 3)

- Shows: total points per team, words successfully explained per player.
- Admin sees a **Restart** button.
- On restart:
  - Players return to word entry screen.
  - **Team assignments are preserved.** Player rotation order within teams continues.
  - Previous words are cleared. New words must be entered.

---

## Admin Controls

- **Pause timer** — freezes the game for all players.
- **Change explainer** — only available when timer is paused. Same team only.
- Admin controls are surfaced in a persistent header element, visible only to the admin.

---

## Disconnection Handling

- Player disconnect detected via Firebase `onDisconnect()` — sets `connected: false`.
- **Active explainer disconnects:** game auto-pauses for everyone. Admin can reassign.
- **Non-explainer disconnects:** game continues. Player marked disconnected in UI.
- **Team drops below 2 players mid-game:** game pauses. Warning shown. Admin presses "Continue anyway." Intent: physically hand a phone to a friend.

---

## URL / Session Persistence

- Route: `/room/{roomId}?player={uid}`
- On page load with valid roomId + playerId: reconnect directly to active game phase.
- No localStorage dependency for core session state.

---

## Room Lifecycle

- Deleted 1 hour after last player disconnects. Handled by scheduled Cloud Function.

---

## Access Control

- Room creation: admin whitelist only (`/admins/{uid}` in RTDB).
- Room access: anyone with the link. Security through obscurity sufficient for MVP.

---

## Resolved Design Decisions

| Question                                 | Decision                                                        |
| ---------------------------------------- | --------------------------------------------------------------- |
| Hat empties mid-turn?                    | Round ends immediately. Game ends if no rounds remain.          |
| Timer expires with no active word?       | Move to next round directly. No post-expiry decision.           |
| Undo works for both guessed and skipped? | Yes.                                                            |
| Turn order on restart?                   | Continues from where it left off. Teams preserved.              |
| Team below 2 players mid-game?           | Auto-pause. Admin explicitly continues ("phone handoff" model). |
| Admin change explainer to other team?    | No. Same team only.                                             |
| Post-expiry unguessed word?              | Explainer explicitly presses Skip. No auto-return.              |
