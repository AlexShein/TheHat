# Technical Task: CI Pipeline (GitHub Actions, Free Tier)

## Goal

Implement automated guardrails that run on every PR and on push to `main`. The pipeline must catch what AI-generated code most commonly breaks: type errors, lint violations, broken tests, invalid Firebase security rules, and a build that silently fails.

GitHub Free Tier budget: 2,000 minutes/month for private repos (unlimited for public). All jobs below are fast by design — full pipeline target: **< 4 minutes**.

---

## Jobs

### Job 1: `lint-and-typecheck`
**Trigger:** PR open/update, push to `main`
**Runner:** `ubuntu-latest`

Steps:
1. Checkout repo
2. Setup Node.js (version from `.nvmrc`)
3. `npm ci`
4. `npx eslint . --max-warnings 0` — fail on any warning
5. `npx tsc --noEmit` — type-check without emitting files

**Why:** TypeScript with `any` silently permitted and lint warnings ignored are the two most common ways AI-generated code looks correct but isn't. This job runs in ~30s and is the fastest feedback loop.

---

### Job 2: `unit-tests`
**Trigger:** PR open/update, push to `main`
**Runner:** `ubuntu-latest`

Steps:
1. Checkout, Node setup, `npm ci`
2. Start Firebase Emulators (RTDB only) via `firebase emulators:exec`
3. Run `npm test` (Vitest)
4. Enforce coverage threshold: **functions ≥ 80%** for files in `src/lib/game/`

**Why:** `src/lib/game/` contains the hat transaction, timer math, turn rotation, and scoring logic — the entire game engine. These are pure functions or functions testable against the RTDB emulator. 80% is achievable and meaningful. UI components are excluded from coverage requirements (too costly for MVP).

**Emulator config** (`firebase.json` emulators block):
```json
{
  "emulators": {
    "database": { "port": 9000 },
    "ui": { "enabled": false }
  }
}
```

Set env var `FIREBASE_DATABASE_EMULATOR_HOST=localhost:9000` in the CI environment.

---

### Job 3: `firebase-rules`
**Trigger:** PR open/update, push to `main`
**Runner:** `ubuntu-latest`

Steps:
1. Checkout, Node setup, `npm ci`
2. Install `@firebase/rules-unit-testing`
3. Start RTDB emulator
4. Run rules test suite: `npm run test:rules`

**Rules tests must cover:**
- Admin can create a room; non-admin cannot
- Room member can write to their own player node; cannot write to another player's node
- Only `currentExplainerId` can write to `gameState` during a turn (stretch goal — complex to express in Rules, may be enforced in client only)
- No one can write to `/admins` from client
- Anyone can read a room by ID (security through obscurity is intentional)

**Why:** Security Rules are the only real access control in this app. They are easy to accidentally break when restructuring the schema. A rules test suite takes ~1 hour to write and saves hours of debugging production access errors.

---

### Job 4: `build`
**Trigger:** PR open/update, push to `main`
**Runner:** `ubuntu-latest`

Steps:
1. Checkout, Node setup, `npm ci`
2. Create `.env` from CI secrets (all `VITE_FIREBASE_*` vars must be set as GitHub secrets — use dummy values for build verification)
3. `npm run build` — SvelteKit static build
4. Assert `build/` directory is non-empty

**Why:** SvelteKit builds can fail silently on certain Svelte 5 rune usages or missing env vars without this check. Catches "works in dev, broken in prod" class of errors. Dummy Firebase config values are sufficient — we're verifying the build compiles, not that it connects.

---

### Job 5: `bundle-size` *(lightweight gate)*
**Trigger:** PR open/update only
**Runner:** `ubuntu-latest`

Steps:
1. Checkout, Node setup, `npm ci`
2. `npm run build`
3. Run `npx bundlesize` or a simple bash check:
   ```bash
   MAX_KB=250
   ACTUAL=$(du -sk build/_app/immutable/chunks/ | awk '{sum+=$1} END {print sum}')
   [ "$ACTUAL" -le "$MAX_KB" ] || (echo "Bundle too large: ${ACTUAL}KB > ${MAX_KB}KB" && exit 1)
   ```
4. Post bundle size as a PR comment (use `actions/github-script`)

**Why:** AI-generated code imports entire libraries for small utilities. A 250KB JS budget for an MVP game UI is generous. Catching regressions here prevents "why is this game app 2MB" surprises. Does not fail the PR — only reports. Adjust threshold after first clean build.

---

## Workflow File Structure

```
.github/
  workflows/
    ci.yml            # Jobs 1, 2, 3, 4 combined (sequential, fail-fast)
    bundle-size.yml   # Job 5 (separate, non-blocking)
```

Combine jobs 1–4 in one workflow with `needs:` dependencies:
```
lint-and-typecheck → unit-tests
lint-and-typecheck → firebase-rules
unit-tests + firebase-rules → build
```

Fail-fast: if lint fails, don't waste minutes running tests.

---

## GitHub Branch Protection Rules (set manually in repo settings)

- Require PRs before merging to `main`
- Require status checks to pass: `lint-and-typecheck`, `unit-tests`, `firebase-rules`, `build`
- Require at least 1 approval (even if it's just you — forces a review pass)
- Do not allow bypassing required checks (including admins)

**Why the last point matters:** The temptation to bypass CI "just this once" for a quick fix is exactly when AI-generated regressions slip through.

---

## GitHub Secrets Required

```
VITE_FIREBASE_API_KEY          # dummy value ok for build job
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_DATABASE_URL
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
FIREBASE_TOKEN                 # for firebase emulators:exec in CI
```

Generate `FIREBASE_TOKEN` with `firebase login:ci` locally.

---

## npm Scripts Required (package.json)

```json
{
  "scripts": {
    "test": "vitest run --coverage",
    "test:rules": "vitest run src/lib/rules.test.ts",
    "test:watch": "vitest",
    "lint": "eslint . --max-warnings 0",
    "typecheck": "tsc --noEmit",
    "build": "vite build"
  }
}
```

---

## Out of Scope for MVP CI

- **Playwright / E2E tests** — valuable, but setup cost is high and flakiness on free tier runners is significant. Add post-MVP.
- **Lighthouse CI** — performance auditing is premature until UI is stable.
- **Deployment automation** — deploy manually with `firebase deploy` for MVP. Add CD once the game is stable.
- **Dependency vulnerability scanning** — Dependabot alerts are sufficient at this scale.
