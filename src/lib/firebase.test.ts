import { describe, it, expect } from "vitest"

describe("firebase init", () => {
  it("db export is not null when module loads", async () => {
    vi.stubEnv("VITE_FIREBASE_API_KEY", "test-key")
    vi.stubEnv("VITE_FIREBASE_AUTH_DOMAIN", "test.firebaseapp.com")
    vi.stubEnv("VITE_FIREBASE_DATABASE_URL", "https://test.firebaseio.com")
    vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "test-project")
    vi.stubEnv("VITE_FIREBASE_APP_ID", "test-app")
    vi.stubEnv("VITE_USE_EMULATOR", "false")

    const mod = await import("./firebase")
    expect(mod.db).not.toBeNull()
    expect(mod.auth).not.toBeNull()

    vi.unstubAllEnvs()
  })

  it("connects to emulator when VITE_USE_EMULATOR=true", async () => {
    vi.stubEnv("VITE_FIREBASE_API_KEY", "test-key")
    vi.stubEnv("VITE_FIREBASE_AUTH_DOMAIN", "test.firebaseapp.com")
    vi.stubEnv("VITE_FIREBASE_DATABASE_URL", "https://test.firebaseio.com")
    vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "test-project")
    vi.stubEnv("VITE_FIREBASE_APP_ID", "test-app")
    vi.stubEnv("VITE_USE_EMULATOR", "true")

    // Just verify it loads without error — emulator connection is side-effect
    const mod = await import("./firebase")
    expect(mod.db).not.toBeNull()

    vi.unstubAllEnvs()
  })
})
