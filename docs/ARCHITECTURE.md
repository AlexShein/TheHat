# Architecture: Hat Game MVP

## Stack Overview

| Layer    | Technology                        | Rationale                                                                                                        |
| -------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Frontend | SvelteKit + Svelte 5              | File-based routing, SSR for landing, reactive stores map naturally to RTDB subscriptions                         |
| Database | Firebase Realtime Database (RTDB) | Cheaper than Firestore for high-frequency writes, built-in presence detection, free Spark tier covers MVP easily |
| Auth     | Firebase Auth (Google Sign-In)    | Zero-effort OAuth, native RTDB Rules integration                                                                 |
| Hosting  | Firebase Hosting                  | Free CDN + HTTPS, seamless SvelteKit adapter                                                                     |
| Backend  | Cloud Functions v2 (Node.js)      | One function only: scheduled room cleanup. No persistent server needed.                                          |
| QR Code  | `qrcode` npm package              | Client-side generation, no backend                                                                               |

**Why RTDB over Firestore for this use case:**
Firestore bills per document read/write. During an active game turn, state updates fire 10–20 times per minute across all connected clients. RTDB bills by data transferred, not operations — significantly cheaper for this pattern. At Spark plan limits (1GB storage, 10GB/month transfer), a group of friends will never hit the ceiling.

**Why no dedicated backend:**
The only server-side logic needed is room cleanup. Everything else — timer math, turn logic, word drawing — can be handled client-side with RTDB transactions providing atomicity guarantees. Adding a backend would introduce deployment complexity, cold start latency, and cost with no benefit at this scale.

---

## Key Architectural Decisions

### 1. Timer: Server Timestamp as Source of Truth

**Problem:** Timer must be synchronized across all clients. Client-local timers drift and break on disconnect/reconnect.

**Solution:** Store `timerStartedAt` as a Firebase server timestamp. Each client computes remaining time locally:

```
remaining = timerDuration - (clientNow - timerStartedAt)
```

**Pause/Resume logic:**

- On pause: write `pausedAt = serverTimestamp`, `timeRemainingAtPause = remaining`.
- On resume: write new `timerStartedAt = serverTimestamp - (timerDuration - timeRemainingAtPause)`, clear pause fields.

No Cloud Function ticking every second. Pure math on client. Timer accuracy: ±1s is acceptable for this game.

### 2. Word Drawing: RTDB Transaction

**Problem:** Two clients must never draw the same word simultaneously.

**Solution:** Use `runTransaction()` on the `hat` array node. Transaction reads current hat, removes one word atomically, returns updated hat. Word is written to `gameState.currentWordId` in the same transaction batch.

```javascript
// Pseudocode
runTransaction(hatRef, (currentHat) => {
  if (!currentHat?.length) return // abort — hat empty
  const idx = Math.floor(Math.random() * currentHat.length)
  const wordId = currentHat[idx]
  set(currentWordRef, wordId) // set separately after tx commit
  return currentHat.filter((_, i) => i !== idx)
})
```

Only the active explainer's client executes this transaction. Other clients are read-only observers.

### 3. Explainer Disconnect: Optimistic Pause

**Problem:** If the explainer disconnects, the timer continues server-side (it's just a timestamp). Game appears to continue for others.

**Solution:**

- `onDisconnect(playerConnectedRef).set(false)` registered on join.
- All clients observe `players/{explainerId}/connected`. If it flips to `false` while `gameState.phase === 'explaining'`:
  - UI shows a "Paused — waiting for reconnect" overlay.
  - Timer is visually frozen (client ignores `timerStartedAt` math while overlay is active).
- Admin can manually write `gameState.pausedAt` to make the pause "official" in RTDB.
- This is optimistic — the timer technically keeps ticking in RTDB. Admin must resume manually. Acceptable for MVP.

### 4. Single Route, Phase-Based Rendering

**Problem:** Game has 6+ distinct screens. Managing them as separate routes complicates reconnect logic.

**Solution:** One route: `/room/[roomId]`. A top-level component reads `room.status` and `gameState.phase` and renders the appropriate screen component. URL always contains roomId. Player ID stored in query param (`?p=uid`).

On page load:

1. Read `roomId` from route, `playerId` from query param.
2. If player node exists in RTDB → reconnect directly.
3. If no player node → show name entry screen.

### 5. Who Can Write What

Only the active explainer writes to `gameState` during a turn (draw word, mark guessed/skipped, undo). Admin can write `pausedAt` and `currentExplainerId` at any time (when paused). All other clients are read-only observers of `gameState`.

This single-writer-per-turn model avoids most conflict scenarios without needing complex locking.

---

## Firebase Security Rules (Minimal MVP)

```json
{
  "rules": {
    "admins": {
      ".read": "auth != null",
      ".write": false
    },
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": "auth != null && root.child('admins').child(auth.uid).exists() ||
                   root.child('rooms').child($roomId).child('players').child(auth.uid).exists()"
      }
    }
  }
}
```

Note: This is a starting point. Tighten per-node rules once the data schema is stable. At minimum, ensure room creation requires admin whitelist check.

---

## Client Architecture (SvelteKit)

Tests should be added for every component / helper function

```
src/
  lib/
    firebase.ts          # Firebase app init, db/auth exports
    stores/
      room.ts            # Writable store: room meta + config
      players.ts         # Writable store: players map
      gameState.ts       # Writable store: full gameState node
    game/
      timer.ts           # Derived store: computes remaining from timerStartedAt
      hat.ts             # Transaction helpers: drawWord, returnWord
      turn.ts            # Turn logic: nextTeam, nextExplainer, endRound
    auth.ts              # Admin auth helpers
  routes/
    +page.svelte         # Landing page
    room/
      [roomId]/
        +page.svelte     # Main game route — phase switcher
        +page.ts         # Load: validate roomId, read playerId from URL
  components/
    phases/
      NameEntry.svelte
      WordEntry.svelte
      Lobby.svelte
      GameMain.svelte
      ExplainerView.svelte
      PostTurn.svelte
      Scoreboard.svelte
    shared/
      Timer.svelte
      TeamScore.svelte
      AdminControls.svelte
      DisconnectOverlay.svelte
```

### Store Strategy

RTDB subscriptions are established in `+page.ts` load function (or `onMount`) and written into Svelte stores. Components read from stores only — they never call Firebase directly. Game action functions live in `lib/game/` and are called from components via event handlers.

This keeps components dumb and testable.

---

## Cloud Function: Room Cleanup

**Trigger:** Firebase Scheduled Function, runs every 30 minutes.

**Logic:**

1. Query all rooms where `meta.lastActiveAt < now - 1 hour`.
2. Delete those room nodes.

```typescript
// functions/src/cleanup.ts
export const cleanupRooms = onSchedule("every 30 minutes", async () => {
  const db = getDatabase()
  const cutoff = Date.now() - 60 * 60 * 1000
  const snapshot = await db.ref("rooms").orderByChild("meta/lastActiveAt").endAt(cutoff).once("value")
  const updates: Record<string, null> = {}
  snapshot.forEach((child) => {
    updates[child.key!] = null
  })
  await db.ref().update(updates)
})
```

Update `meta/lastActiveAt` via `onDisconnect` on the last connected player, or periodically from any connected client.

---

## Deployment

```bash
# Firebase project setup
firebase init hosting functions database

# SvelteKit build
npm run build  # outputs to build/

# Deploy all
firebase deploy
```

Use `@sveltejs/adapter-static` with `fallback: '200.html'` for SPA behavior on Firebase Hosting. The `200.html` fallback ensures deep links (`/room/xyz`) work correctly.

---

## Known Weaknesses & Accepted Trade-offs

| Issue                                                                                     | Impact                                                           | Decision                                |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------- |
| Timer continues ticking if explainer disconnects (only paused visually)                   | Minor inconsistency — admin must manually resume after reconnect | Accepted for MVP                        |
| No per-field RTDB rules — broad room-level write access                                   | Any room member can write anything to the room node              | Accepted for MVP (friends only)         |
| Explainer's client is the sole writer during turn — if their browser hangs, turn is stuck | Game stuck until admin intervenes                                | Admin can reassign explainer; mitigated |
| `onDisconnect` can take 30–60s to fire on ungraceful disconnect                           | Disconnect detection is slow                                     | Acceptable; game pauses, not crashes    |
