#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing Node dependencies..."
npm ci

echo ""
echo "==> Creating .env.local for emulator mode..."
cat > .env.local << 'EOF'
VITE_FIREBASE_API_KEY=emulator-key
VITE_FIREBASE_AUTH_DOMAIN=localhost
VITE_FIREBASE_DATABASE_URL=http://localhost:9000?ns=the-word-guessing-game
VITE_FIREBASE_PROJECT_ID=the-word-guessing-game
VITE_FIREBASE_APP_ID=emulator-app
VITE_USE_EMULATOR=true
EOF

echo ""
echo "==> Dev container ready."
echo "    Start with:  npm run dev:full"
echo "    Test with:   npm test"
echo "    Lint with:   npm run lint"
