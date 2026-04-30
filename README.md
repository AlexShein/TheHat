# TheHat

Word guessing game mobile-first web app.

## Admin Management

Admins are stored in RTDB at `/admins/{uid}: true`. Three scripts in `scripts/` manage admins without needing the Firebase Console.

### Prerequisites

1. **Service account key:** Download from [Firebase Console](https://console.firebase.google.com) → Project Settings → Service Accounts → Generate new private key. Save as `service-account.json` in the project root (git-ignored).
2. **Database URL:** Get from Firebase Console → Realtime Database → Data tab. Looks like:
   ```
   https://the-word-guessing-game-default-rtdb.europe-west1.firebasedatabase.app
   ```

### Setup (one-time)

```bash
export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/service-account.json"
export FIREBASE_DATABASE_URL="https://YOUR-PROJECT-default-rtdb.REGION.firebasedatabase.app"
```

### Commands

```bash
# List current admins
npx tsx scripts/list-admins.ts

# Add admin by email (user must have signed in via Google at least once)
npx tsx scripts/add-admin.ts friend@gmail.com

# Remove admin by email
npx tsx scripts/remove-admin.ts friend@gmail.com
```

### How it works

- Scripts use Firebase Admin SDK with a service account (bypasses RTDB security rules).
- Email → UID resolution via `admin.auth().getUserByEmail()`. No separate lookup table needed.
- User must have signed into the app with Google at least once before they can be made admin (otherwise Firebase Auth has no record of them).
- Remove uses `ref.set(null)` which deletes the node. Rules prevent admin self-removal via the app.

## Development

```bash
npm install
npm run dev:solo         # Dev server with solo bypass
npm run emulators        # Firebase emulators (RTDB + Auth)
npm run dev:solo:full    # Both together
```

### First admin setup

Before running the admin scripts, add your own UID manually via the Firebase Console once:

1. Sign in to the app locally with Google.
2. Open DevTools → Application → Session Storage → copy `firebase:authUser` UID.
3. In Firebase Console → Realtime Database → add `/admins/{YOUR_UID}` with value `true`.
4. Deploy rules: `firebase deploy --only database`.

After this, use `scripts/add-admin.ts` for everyone else.
