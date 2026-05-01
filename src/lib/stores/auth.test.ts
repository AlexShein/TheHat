import { describe, it, expect, beforeEach } from "vitest"
import { authStore, resetAuthStore } from "./auth.svelte"

describe("authStore", () => {
  beforeEach(() => {
    resetAuthStore()
  })

  it("initial state: currentUser null, loading true", () => {
    expect(authStore.currentUser).toBeNull()
    expect(authStore.loading).toBe(true)
  })

  it("setUser updates currentUser and sets loading false", () => {
    const mockUser = { uid: "abc", email: "test@test.com" } as never
    authStore.setUser(mockUser)
    expect(authStore.currentUser).toBe(mockUser)
    expect(authStore.loading).toBe(false)
  })

  it("setUser with null clears currentUser, loading false", () => {
    authStore.setUser(null)
    expect(authStore.currentUser).toBeNull()
    expect(authStore.loading).toBe(false)
  })

  it("setLoading updates loading independently", () => {
    authStore.setLoading(false)
    expect(authStore.loading).toBe(false)
    expect(authStore.currentUser).toBeNull()
  })

  it("multiple setUser calls update state", () => {
    const user1 = { uid: "a" } as never
    const user2 = { uid: "b" } as never
    authStore.setUser(user1)
    expect(authStore.currentUser).toBe(user1)
    authStore.setUser(user2)
    expect(authStore.currentUser).toBe(user2)
  })

  it("resetAuthStore returns to initial state", () => {
    const mockUser = { uid: "abc" } as never
    authStore.setUser(mockUser)
    resetAuthStore()
    expect(authStore.currentUser).toBeNull()
    expect(authStore.loading).toBe(true)
  })
})
