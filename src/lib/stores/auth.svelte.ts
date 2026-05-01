import type { User } from "firebase/auth"

/** Module-level reactive auth state. Components import and read directly. */
export const authStore = {
  currentUser: null as User | null,
  loading: true,
} as {
  currentUser: User | null
  loading: boolean
  setUser(user: User | null): void
  setLoading(v: boolean): void
}

// Reactive state — Svelte 5 compiler transforms $state in .svelte.ts files
let currentUser: User | null = $state(null)
let loading: boolean = $state(true)

authStore.setUser = (user: User | null) => {
  currentUser = user
  loading = false
}

authStore.setLoading = (v: boolean) => {
  loading = v
}

// Getters re-evaluate on every access, tracking $state deps in components
Object.defineProperty(authStore, "currentUser", {
  get() {
    return currentUser
  },
  enumerable: true,
  configurable: true,
})

Object.defineProperty(authStore, "loading", {
  get() {
    return loading
  },
  enumerable: true,
  configurable: true,
})

/** Reset to initial state. Exported for tests. */
export function resetAuthStore(): void {
  currentUser = null
  loading = true
}
