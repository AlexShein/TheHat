# Local Development Setup

## Prerequisites

- Node.js (use version in `.nvmrc`)
- Firebase CLI: `npm install -g firebase-tools`
- Java 11+ (required for Firebase Emulator Suite)
- A Firebase project created at console.firebase.google.com

---

## First-Time Setup

```bash
# Clone and install
git clone <repo>
cd hat-game
npm install

# Authenticate Firebase CLI
firebase login

# Link to your Firebase project
firebase use --add   # select your project, alias it "default"

# Install emulators
firebase init emulators
# Select: Realtime Database, Functions, Hosting
# Accept default ports
```

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
# Fill in values from Firebase Console → Project Settings → Your Apps
```

---

## Running Locally

**Always develop against emulators, never live Firebase.**

```bash
# Terminal 1: start emulators
npm run emulators

# Terminal 2: start SvelteKit dev server
npm run dev
```

When `VITE_USE_EMULATOR=true` is set (it is, in `.env.local`), the app automatically connects to emulators instead of live Firebase.

---

## Emulator Ports

| Service           | Port |
| ----------------- | ---- |
| Realtime Database | 9000 |
| Functions         | 5001 |
| Hosting           | 5000 |
| Emulator UI       | 4000 |

Access Emulator UI at `http://localhost:4000` — use this to inspect RTDB state during development.

---

## Environment Variables

**`.env.example`** (commit this):

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_USE_EMULATOR=true
```

**`.env.local`** (never commit — gitignored):

- Contains real values
- `VITE_USE_EMULATOR=true` for local dev
- Set `VITE_USE_EMULATOR=false` only when testing against live Firebase intentionally

---

## Firebase Init Code Pattern

```typescript
// src/lib/firebase.ts
import { initializeApp } from "firebase/app"
import { getDatabase, connectDatabaseEmulator } from "firebase/database"
import { getAuth, connectAuthEmulator } from "firebase/auth"

const app = initializeApp({
  /* env vars */
})
export const db = getDatabase(app)
export const auth = getAuth(app)

if (import.meta.env.VITE_USE_EMULATOR === "true") {
  connectDatabaseEmulator(db, "localhost", 9000)
  connectAuthEmulator(auth, "http://localhost:9099")
}
```

**This pattern must not be changed without updating CI configuration.**

---

## Running Tests

```bash
# Unit tests (requires emulators running)
npm run test       # firebase emulators:exec --only database "vitest run"

# Security rules tests
npm run test:rules
```

## npm Scripts Reference

```json
{
  "emulators": "firebase emulators:start --only database,functions",
  "dev": "vite dev",
  "build": "vite build",
  "test": "firebase emulators:exec --only database 'vitest run --coverage'",
  "test:rules": "firebase emulators:exec --only database 'vitest run src/lib/rules.test.ts'",
  "test:watch": "vitest",
  "lint": "eslint . --max-warnings 0",
  "typecheck": "tsc --noEmit"
}
```

---

## Seeding Emulator Data

For fast iteration, seed the emulator with a game in progress:

```bash
# After emulators are running:
npx ts-node scripts/seed-emulator.ts
```

Create `scripts/seed-emulator.ts` with a full room in `playing` status. This lets you jump directly to any game phase without clicking through the setup flow every time.

**Seed states to implement (in priority order):**

1. Room in `explaining` phase, mid-turn, 5 words in hat
2. Room at timer expiry (`post_expiry` phase)
3. Room at round 2, `waiting_start`
4. Full scoreboard (`finished` status)

---

## Deploying

```bash
# Deploy everything
firebase deploy

# Deploy only hosting (most common)
firebase deploy --only hosting

# Deploy only functions
firebase deploy --only functions
```

**Never deploy from a branch.** Deploy only from `main` after CI passes.

---

## Troubleshooting

**Emulator won't start:** Check Java is installed (`java -version`). Firebase Emulator requires Java 11+.

**Auth not working in emulator:** `connectAuthEmulator` must be called with `http://` prefix on the URL.

**RTDB transactions behaving differently in emulator:** The emulator does not replicate Firebase's exact transaction retry behavior. If a transaction test passes locally but fails in production, test against live Firebase with a test room.

**"Permission denied" errors:** Check RTDB Security Rules in `database.rules.json`. Use the Emulator UI Rules Playground to test specific read/write operations.
