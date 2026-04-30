import { initializeApp } from "firebase/app"
import { getDatabase, connectDatabaseEmulator } from "firebase/database"
import { getAuth, connectAuthEmulator } from "firebase/auth"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

export const db = getDatabase(app)
export const auth = getAuth(app)

if (import.meta.env.VITE_USE_EMULATOR === "true") {
  connectDatabaseEmulator(db, "localhost", 9000)
  connectAuthEmulator(auth, "http://localhost:9099")
}
